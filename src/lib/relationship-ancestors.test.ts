import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findClosestSharedAncestors, parentRelationshipLabels } from "./relationship-ancestors";

describe("findClosestSharedAncestors", () => {
  it("returns the nearest common recorded ancestor and distances", () => {
    const edges = [
      { parentId: "ancestor", childId: "parent-a", type: "BIOLOGICAL" },
      { parentId: "ancestor", childId: "parent-b", type: "BIOLOGICAL" },
      { parentId: "parent-a", childId: "a", type: "STEP" },
      { parentId: "parent-b", childId: "b", type: "ADOPTIVE" },
      { parentId: "old", childId: "ancestor", type: "UNKNOWN" },
    ];
    assert.deepEqual(findClosestSharedAncestors("a", "b", edges), [{
      id: "ancestor", stepsFromA: 2, stepsFromB: 2,
      linkTypesFromA: ["BIOLOGICAL", "STEP"], linkTypesFromB: ["ADOPTIVE", "BIOLOGICAL"],
    }]);
  });

  it("handles disconnected graphs and cycles without looping", () => {
    assert.deepEqual(findClosestSharedAncestors("a", "b", []), []);
    const edges = [
      { parentId: "ancestor", childId: "a", type: "UNKNOWN" },
      { parentId: "a", childId: "ancestor", type: "STEP" },
      { parentId: "ancestor", childId: "b", type: "ADOPTIVE" },
    ];
    assert.equal(findClosestSharedAncestors("a", "b", edges)[0]?.id, "ancestor");
  });

  it("uses explicit recorded-link labels for non-biological and unknown types", () => {
    assert.equal(parentRelationshipLabels("STEP").parentToChild, "recorded step-parent of");
    assert.equal(parentRelationshipLabels("ADOPTIVE").childToParent, "child of recorded adoptive parent");
    assert.equal(parentRelationshipLabels("UNKNOWN").parentToChild, "recorded parent of");
  });
});
