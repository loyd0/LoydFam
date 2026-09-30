import test from "node:test";
import assert from "node:assert/strict";
import { properties } from "./properties";
import { validateResearch, changedFields } from "./research-validation";
import { getRevisionChanges } from "./revision-display";

test("all reviewed research passes the publishing contract", () => {
  for (const p of properties) assert.doesNotThrow(() => validateResearch(p, p.slug), p.slug);
});
test("gallery placement survives heading removal but rejects malformed metadata", () => {
  const p = structuredClone(properties.find(property => property.images.length)!);
  p.images[0].sectionHeading = "A heading that was removed";
  assert.doesNotThrow(() => validateResearch(p, p.slug));
  (p.images[0] as unknown as Record<string, unknown>).sectionHeading = { hidden: true };
  assert.throws(() => validateResearch(p, p.slug), /Image sections/);
});
test("research rejects broken citations, unsafe URLs and ungrounded map metadata", () => {
  const p = structuredClone(properties[0]);
  p.paragraphs[0].sourceIds = ["missing"];
  assert.throws(() => validateResearch(p, p.slug), /valid source/);
  const unsafe = structuredClone(properties[0]);
  unsafe.sources[1].url = "javascript:alert(1)";
  assert.throws(() => validateResearch(unsafe, unsafe.slug), /Sources/);
  const map = structuredClone(properties.find(p => p.mapLocation)!);
  map.mapLocation!.lat = 100;
  assert.throws(() => validateResearch(map, map.slug), /Map locations/);
  assert.throws(() => validateResearch(properties[0], "wrong-place"), /identifier/);
});
test("revision field comparison detects removals and nested evidence changes", () => {
  assert.deepEqual(changedFields({name:"House",sources:[{url:"a"}],old:"removed"},{name:"House",sources:[{url:"b"}]}),["sources","old"]);
});

test("research validation safely rejects malformed nested records and invalid dates", () => {
  const brokenSource = structuredClone(properties[0]);
  (brokenSource.sources as unknown[])[0] = null;
  assert.throws(() => validateResearch(brokenSource, brokenSource.slug), /Sources/);

  const brokenParagraph = structuredClone(properties[0]);
  (brokenParagraph.paragraphs as unknown[])[0] = null;
  assert.throws(() => validateResearch(brokenParagraph, brokenParagraph.slug), /paragraphs/);

  const badDate = structuredClone(properties[0]);
  badDate.statusChecked = "2026-02-31";
  assert.throws(() => validateResearch(badDate, badDate.slug), /date/);
});

test("research rejects credential-bearing source URLs and key-order-only changes", () => {
  const credentialUrl = structuredClone(properties[0]);
  const source = credentialUrl.sources.find((item) => item.id !== "workbook")!;
  source.url = "https://user:password@example.org/source";
  assert.throws(() => validateResearch(credentialUrl, credentialUrl.slug), /Sources/);

  assert.deepEqual(
    changedFields({ content: { name: "House", location: "Village" } }, { content: { location: "Village", name: "House" } }),
    [],
  );
});


test("revision comparisons can show complete changed prose without making list summaries huge", () => {
  const oldText = "Earlier account.";
  const newText = "New evidence. ".repeat(80);
  const before = { content: { paragraphs: [{ heading: "History", text: oldText, sourceIds: ["s1"] }] } };
  const after = { content: { paragraphs: [{ heading: "History", text: newText, sourceIds: ["s1"] }] } };
  assert.ok(getRevisionChanges(before, after)[0].after.length <= 280);
  assert.equal(getRevisionChanges(before, after, { fullText: true })[0].after, newText);
});


test("revision comparisons keep duplicate dated entries distinct", () => {
  const before = { content: { timeline: [
    { date: "1900", text: "Earlier first event", sourceIds: ["s1"] },
    { date: "1900", text: "Unchanged second event", sourceIds: ["s1"] },
  ] } };
  const after = { content: { timeline: [
    { date: "1900", text: "Corrected first event", sourceIds: ["s1"] },
    { date: "1900", text: "Unchanged second event", sourceIds: ["s1"] },
  ] } };
  const changes = getRevisionChanges(before, after, { fullText: true });
  assert.equal(changes.length, 1);
  assert.match(changes[0].path, /1900 #1/);
  assert.equal(changes[0].before, "Earlier first event");
  assert.equal(changes[0].after, "Corrected first event");
});
