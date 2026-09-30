import type { TreeData, TreePerson } from "@/components/family-tree-canvas";

export interface TreePoint { x: number; y: number; z: number }
export interface PositionedPerson { person: TreePerson; position: TreePoint }

export function boundFamilyTree(data: TreeData, maxPeople: number): TreeData {
  const byId = new Map(data.nodes.map((person) => [person.id, person]));
  if (!byId.has(data.rootId) || maxPeople < 1) return { ...data, nodes: [], edges: [] };
  const children = new Map<string, string[]>();
  for (const edge of data.edges) {
    if (!byId.has(edge.parentId) || !byId.has(edge.childId)) continue;
    const list = children.get(edge.parentId) ?? [];
    if (!list.includes(edge.childId)) list.push(edge.childId);
    children.set(edge.parentId, list);
  }
  for (const ids of children.values()) ids.sort((a, b) =>
    (byId.get(a)?.displayName ?? "").localeCompare(byId.get(b)?.displayName ?? "") || a.localeCompare(b));
  const included = new Set([data.rootId]);
  const edges: TreeData["edges"] = [];
  let level = [data.rootId];
  while (level.length && included.size < maxPeople) {
    const next: string[] = [];
    for (const parentId of level) for (const childId of children.get(parentId) ?? []) {
      if (included.size >= maxPeople) break;
      if (included.has(childId)) continue;
      included.add(childId); next.push(childId); edges.push({ parentId, childId });
    }
    level = next;
  }
  return { ...data, nodes: data.nodes.filter((person) => included.has(person.id)), edges };
}

/** Deterministic breadth-level layout with stable sibling ordering and cycle protection. */
export function layoutFamilyTree(data: TreeData): PositionedPerson[] {
  const byId = new Map(data.nodes.map((person) => [person.id, person]));
  if (!byId.has(data.rootId)) return [];
  const children = new Map<string, string[]>();
  for (const edge of data.edges) {
    if (!byId.has(edge.parentId) || !byId.has(edge.childId)) continue;
    const list = children.get(edge.parentId) ?? [];
    if (!list.includes(edge.childId)) list.push(edge.childId);
    children.set(edge.parentId, list);
  }
  for (const ids of children.values()) ids.sort((a, b) =>
    (byId.get(a)?.displayName ?? "").localeCompare(byId.get(b)?.displayName ?? "") || a.localeCompare(b));

  const levels: string[][] = [[data.rootId]];
  const seen = new Set([data.rootId]);
  for (let level = 0; level < levels.length; level++) {
    const next: string[] = [];
    for (const id of levels[level]) for (const childId of children.get(id) ?? []) {
      if (!seen.has(childId)) { seen.add(childId); next.push(childId); }
    }
    if (!next.length) break;
    levels.push(next);
  }

  // Evenly distribute each generation on a plane; vertical spacing conveys descent.
  const result: PositionedPerson[] = [];
  levels.forEach((ids, generation) => ids.forEach((id, index) => {
    const spread = Math.max(1, ids.length - 1);
    result.push({ person: byId.get(id)!, position: {
      x: (index - spread / 2) * 3.1,
      y: -generation * 3.2,
      z: Math.sin(index * 0.7 + generation) * 0.5,
    } });
  }));
  return result;
}
