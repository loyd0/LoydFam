import assert from "node:assert/strict";
import test from "node:test";
import { comparePersonSearchResults, parsePersonSearchQuery, personMatchesQuery, personSearchLabel, type PersonSearchItem } from "./person-search";

const person = (input: Partial<PersonSearchItem> = {}): PersonSearchItem => ({
  id: "1", displayName: "Sam Loyd", surname: "Loyd", gender: "MALE", generation: 3,
  birthYear: 1950, deathYear: null, externalId: "42", sourceSystem: "LOYD_BOOK_2022", numberSystem: "LOYD", branch: "William Loyd", ...input,
});

test("person search accepts names and exact legacy family numbers in common formats", () => {
  const sam = person();
  assert.equal(personMatchesQuery(sam, "sam loyd"), true);
  assert.equal(personMatchesQuery(sam, "42"), true);
  assert.equal(personMatchesQuery(sam, "#42"), true);
  assert.equal(personMatchesQuery(person({ externalId: "2caba", numberSystem: "GIRLS" }), "GIRLS:2caba"), true);
  assert.equal(personMatchesQuery(person({ externalId: "2caba", numberSystem: "GIRLS" }), "2caba"), true);
  assert.equal(personMatchesQuery(sam, "LOYD:42"), true);
  assert.equal(personMatchesQuery(person({ externalId: "70aab", numberSystem: "GIRLS" }), "70aab"), true);
  assert.equal(personMatchesQuery(person({ externalId: "70aab", numberSystem: "GIRLS" }), "GIRLS:70aab"), true);
  assert.equal(personMatchesQuery(person({ externalId: "42", numberSystem: "GIRLS" }), "LOYD:42"), false);
  assert.equal(personMatchesQuery(person({ externalId: "-1", numberSystem: "GIRLS" }), "-1"), true);
  assert.equal(personMatchesQuery(person({ numberSystem: "GIRLS" }), "LOYD:42"), false);
  assert.equal(personMatchesQuery(sam, "43"), false);
  assert.equal(personMatchesQuery(sam, "s"), false);
});

test("prefixed family numbers retain their source so duplicate numbering schemes stay separate", () => {
  assert.deepEqual(parsePersonSearchQuery("LOYD:42"), { text: "LOYD:42", familyNumber: "42", sourceSystem: "LOYD" });
  assert.deepEqual(parsePersonSearchQuery("girls #42"), { text: "girls #42", familyNumber: "42", sourceSystem: "GIRLS" });
  assert.deepEqual(parsePersonSearchQuery("GIRLS:70aab"), { text: "GIRLS:70aab", familyNumber: "70aab", sourceSystem: "GIRLS" });
  assert.deepEqual(parsePersonSearchQuery("#42"), { text: "#42", familyNumber: "42", sourceSystem: null });
  assert.equal(parsePersonSearchQuery("Ada Loyd").familyNumber, null);
});

test("duplicate names stay distinct and display useful differentiating context", () => {
  const first = person();
  const second = person({ id: "2", externalId: "84", birthYear: 1880, deathYear: 1940, branch: "John Loyd" });
  assert.notEqual(first.id, second.id);
  assert.match(personSearchLabel(first), /1950–/);
  assert.match(personSearchLabel(first), /LOYD #42/);
  assert.match(personSearchLabel(first), /William Loyd/);
  assert.match(personSearchLabel(second), /1880–1940/);
  assert.ok(comparePersonSearchResults(first, second, "42") < 0);
});
