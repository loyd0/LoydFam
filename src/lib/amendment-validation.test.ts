import assert from "node:assert/strict";
import test from "node:test";
import { parsePersonPatch, parseAmendmentNote } from "./amendment-validation";

test("amendments reject ownership, role and source-identity changes", () => {
  for (const field of ["role", "verifiedPersonId", "linkedPersonId", "primaryExternalKey", "id", "updatedAt", "isPlaceholder"]) {
    assert.equal(parsePersonPatch({ [field]: "attacker-controlled" }), null, field);
  }
  assert.equal(parsePersonPatch({ givenName1: { set: "Unsafe nested mutation" } }), null);
});
test("person amendments enforce field types and distinguish requests from empty edits", () => {
  assert.equal(parsePersonPatch({ gender: null }), null);
  assert.equal(parsePersonPatch({ gender: "ADMIN" }), null);
  assert.equal(parsePersonPatch({ generationFromWilliam: 1.5 }), null);
  assert.equal(parsePersonPatch({ givenName1: "x".repeat(301) }), null);
  assert.equal(parsePersonPatch({}), null);
  assert.deepEqual(parsePersonPatch({}, true), {});
  assert.deepEqual(parsePersonPatch({ preferredName: "Sam", biographyMd: null }), { preferredName: "Sam", biographyMd: null });
});
test("review notes must contain bounded, non-whitespace context", () => {
  assert.equal(parseAmendmentNote("  "), null);
  assert.equal(parseAmendmentNote("x".repeat(2001)), null);
  assert.equal(parseAmendmentNote({ note: "wrong type" }), null);
  assert.equal(parseAmendmentNote("  Original register confirms the date.  "), "Original register confirms the date.");
});
