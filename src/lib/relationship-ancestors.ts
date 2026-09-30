export interface ParentRelationshipEdge {
  parentId: string;
  childId: string;
  type: "BIOLOGICAL" | "STEP" | "ADOPTIVE" | "UNKNOWN" | string;
}

export interface AncestorDistance {
  id: string;
  parentLinkSteps: number;
  linkTypes: string[];
}

/** Find nearest shared recorded ancestors by traversing parent links upward only. */
export function findClosestSharedAncestors(
  personAId: string,
  personBId: string,
  edges: ParentRelationshipEdge[],
): { id: string; stepsFromA: number; stepsFromB: number; linkTypesFromA: string[]; linkTypesFromB: string[] }[] {
  const byChild = new Map<string, ParentRelationshipEdge[]>();
  for (const edge of edges) {
    const values = byChild.get(edge.childId) ?? [];
    values.push(edge);
    byChild.set(edge.childId, values);
  }
  const getAncestors = (startId: string) => {
    const found = new Map<string, AncestorDistance>();
    const queue: Array<{ id: string; steps: number; types: Set<string> }> = [{ id: startId, steps: 0, types: new Set() }];
    const visited = new Set([startId]);
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const current = queue[cursor];
      for (const edge of byChild.get(current.id) ?? []) {
        if (visited.has(edge.parentId)) continue;
        visited.add(edge.parentId);
        const types = new Set(current.types); types.add(edge.type);
        found.set(edge.parentId, { id: edge.parentId, parentLinkSteps: current.steps + 1, linkTypes: [...types].sort() });
        queue.push({ id: edge.parentId, steps: current.steps + 1, types });
      }
    }
    return found;
  };

  const aAncestors = getAncestors(personAId), bAncestors = getAncestors(personBId);
  const shared = [...aAncestors.values()].flatMap((a) => {
    const b = bAncestors.get(a.id);
    return b ? [{ id: a.id, stepsFromA: a.parentLinkSteps, stepsFromB: b.parentLinkSteps, linkTypesFromA: a.linkTypes, linkTypesFromB: b.linkTypes }] : [];
  });
  if (!shared.length) return [];
  shared.sort((a, b) => a.stepsFromA + a.stepsFromB - (b.stepsFromA + b.stepsFromB) || Math.max(a.stepsFromA, a.stepsFromB) - Math.max(b.stepsFromA, b.stepsFromB) || a.id.localeCompare(b.id));
  const closestDistance = shared[0].stepsFromA + shared[0].stepsFromB;
  return shared.filter((ancestor) => ancestor.stepsFromA + ancestor.stepsFromB === closestDistance);
}

export function parentRelationshipLabels(type: string): { parentToChild: string; childToParent: string } {
  switch (type) {
    case "BIOLOGICAL": return { parentToChild: "recorded biological parent of", childToParent: "child of recorded biological parent" };
    case "STEP": return { parentToChild: "recorded step-parent of", childToParent: "child of recorded step-parent" };
    case "ADOPTIVE": return { parentToChild: "recorded adoptive parent of", childToParent: "child of recorded adoptive parent" };
    default: return { parentToChild: "recorded parent of", childToParent: "child of recorded parent" };
  }
}
