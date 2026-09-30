import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { boundFamilyTree, layoutFamilyTree } from "./family-tree-layout";
import type { TreeData, TreePerson } from "./family-tree-canvas";

const person = (id: string, displayName = id): TreePerson => ({
  id, displayName, gender: "UNKNOWN", surname: null, knownAs: null,
  residencyText: null, birthYear: null, deathYear: null, isLiving: false,
  generation: null, spouseNames: [], isLoyd: true,
});

describe("layoutFamilyTree", () => {
  it("places descendants by generation with deterministic sibling order", () => {
    const data: TreeData = {
      rootId: "root", nodes: [person("root"), person("b", "B"), person("a", "A"), person("grand")],
      edges: [{ parentId: "root", childId: "b" }, { parentId: "root", childId: "a" }, { parentId: "a", childId: "grand" }],
    };
    const layout = layoutFamilyTree(data);
    assert.deepEqual(layout.map(({ person: p }) => p.id), ["root", "a", "b", "grand"]);
    assert.ok(Math.abs(layout[0].position.y) < Number.EPSILON);
    assert.equal(layout[1].position.y, layout[2].position.y);
    assert.ok(layout[3].position.y < layout[1].position.y);
  });

  it("ignores cycles and nodes disconnected from the selected root", () => {
    const data: TreeData = {
      rootId: "root", nodes: [person("root"), person("child"), person("orphan")],
      edges: [{ parentId: "root", childId: "child" }, { parentId: "child", childId: "root" }],
    };
    assert.deepEqual(layoutFamilyTree(data).map(({ person: p }) => p.id), ["root", "child"]);
  });

  it("lays out every recorded generation beyond the former depth cap", () => {
    const nodes = Array.from({ length: 26 }, (_, index) => person(`p${index}`));
    const edges = nodes.slice(1).map((node, index) => ({ parentId: `p${index}`, childId: node.id }));
    const layout = layoutFamilyTree({ rootId: "p0", nodes, edges });
    assert.equal(layout.length, 26);
    assert.equal(layout.at(-1)?.person.id, "p25");
  });

  it("keeps the initial view bounded around the root", () => {
    const data: TreeData = {
      rootId: "root", nodes: [person("root"), person("b"), person("a"), person("grand")],
      edges: [{ parentId: "root", childId: "b" }, { parentId: "root", childId: "a" }, { parentId: "a", childId: "grand" }],
    };
    const bounded = boundFamilyTree(data, 2);
    assert.deepEqual(bounded.nodes.map((p) => p.id), ["root", "a"]);
    assert.deepEqual(bounded.edges, [{ parentId: "root", childId: "a" }]);
  });
});
