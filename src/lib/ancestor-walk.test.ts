import assert from "node:assert/strict";
import test from "node:test";
import { parseAncestorDepth, walkAncestors } from "./ancestor-walk";

test("omitted depth walks the full chart with one person and parent read per level", async () => {
  const people = [
    { id: "child", displayName: "Child", gender: "FEMALE", events: [] },
    { id: "father", displayName: "Father", gender: "MALE", events: [] },
    { id: "mother", displayName: "Mother", gender: "FEMALE", events: [] },
    { id: "grandfather", displayName: "Grandfather", gender: "MALE", events: [{ event: { type: "DEATH", dateYear: 1920 } }] },
  ];
  const relations = [
    { childId: "child", parentId: "father", type: "BIOLOGICAL", parent: { gender: "MALE" } },
    { childId: "child", parentId: "mother", type: "BIOLOGICAL", parent: { gender: "FEMALE" } },
    { childId: "father", parentId: "grandfather", type: "BIOLOGICAL", parent: { gender: "MALE" } },
    // A cycle must not keep the full-depth request running.
    { childId: "grandfather", parentId: "child", type: "BIOLOGICAL", parent: { gender: "FEMALE" } },
  ];
  const peopleCalls: string[][] = [];
  const parentCalls: string[][] = [];
  const reader = {
    async people(ids: string[]) {
      peopleCalls.push(ids);
      return people.filter(person => ids.includes(person.id));
    },
    async parents(ids: string[]) {
      parentCalls.push(ids);
      return relations.filter(relation => ids.includes(relation.childId));
    },
  };

  assert.equal(parseAncestorDepth(null), null);
  assert.equal(parseAncestorDepth("full"), null);
  const full = await walkAncestors("child", parseAncestorDepth(null), reader);
  assert.deepEqual(full.ancestors.map(({ id, pedigreePosition }) => [id, pedigreePosition]), [
    ["child", 1], ["father", 2], ["mother", 3], ["grandfather", 4],
  ]);
  assert.equal(full.maxDepth, 2);
  assert.deepEqual(peopleCalls, [["child"], ["father", "mother"], ["grandfather"]]);
  assert.deepEqual(parentCalls, [["child"], ["father", "mother"], ["grandfather"]]);

  peopleCalls.length = 0;
  parentCalls.length = 0;
  const limited = await walkAncestors("child", parseAncestorDepth("1"), reader);
  assert.deepEqual(limited.ancestors.map(person => person.id), ["child", "father", "mother"]);
  assert.deepEqual(peopleCalls, [["child"], ["father", "mother"]]);
  assert.deepEqual(parentCalls, [["child"]]);
});
