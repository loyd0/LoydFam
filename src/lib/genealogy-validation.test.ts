import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertValidEvent, assertValidParentType, normalizeEventDateFields, wouldCreateParentCycle } from "./genealogy-validation";

describe("genealogy validation", () => {
  it("accepts valid exact and partial dates, including leap days", () => {
    assert.doesNotThrow(() => assertValidEvent({ type: "BIRTH", dateExact: "2000-02-29" }));
    assert.doesNotThrow(() => assertValidEvent({ type: "DEATH", dateYear: 1880, dateMonth: 2, dateDay: 29 }));
    assert.doesNotThrow(() => assertValidEvent({ type: "RESIDENCE", dateExact: "0001-01-01", dateYear: 1 }));
  });

  it("rejects impossible or contradictory date fields", () => {
    assert.throws(() => assertValidEvent({ type: "BIRTH", dateExact: "1900-02-29" }), /real calendar date/i);
    assert.throws(() => assertValidEvent({ type: "BIRTH", dateYear: 2020, dateMonth: 2, dateDay: 30 }), /real calendar date/i);
    assert.throws(() => assertValidEvent({ type: "BIRTH", dateExact: "1900-01-02", dateYear: 1901 }), /must agree/i);
    assert.throws(() => assertValidEvent({ type: "BIRTH", dateMonth: 2 }), /year/i);
  });

  it("derives searchable date components from exact dates and preserves clearing", () => {
    assert.deepEqual(normalizeEventDateFields({ type: "BIRTH", dateExact: "1901-04-09" }), {
      dateExact: "1901-04-09", dateYear: 1901, dateMonth: 4, dateDay: 9,
    });
    assert.deepEqual(normalizeEventDateFields({ type: "BIRTH", dateExact: "1901-04-09", dateYear: 1901 }), {
      dateExact: "1901-04-09", dateYear: 1901, dateMonth: 4, dateDay: 9,
    });
    assert.deepEqual(normalizeEventDateFields({ type: "BIRTH", dateExact: null, dateYear: 1901, dateMonth: null, dateDay: null }), {
      dateExact: null, dateYear: 1901, dateMonth: null, dateDay: null,
    });
  });

  it("prevents a directed parent-child cycle while allowing step and adoptive links", () => {
    const edges = [{ parentId: "a", childId: "b" }, { parentId: "b", childId: "c" }];
    assert.equal(wouldCreateParentCycle(edges, "c", "a"), true);
    assert.equal(wouldCreateParentCycle(edges, "a", "c"), false);
    assert.equal(wouldCreateParentCycle(edges, "a", "a"), true);
    assert.doesNotThrow(() => assertValidParentType("STEP"));
    assert.doesNotThrow(() => assertValidParentType("ADOPTIVE"));
  });
});
