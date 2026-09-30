import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loydOnlyWhere, parseLoydOnly } from "@/lib/loyd-filter";
import { findClosestSharedAncestors, parentRelationshipLabels } from "@/lib/relationship-ancestors";
import { apiPermissionError } from "@/lib/permission-guards";

interface PathNode {
  id: string;
  displayName: string;
  gender: string;
  relation: string;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await apiPermissionError("relationship.view", session.user);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const aId = searchParams.get("a");
  const bId = searchParams.get("b");
  const loydOnly = parseLoydOnly(searchParams);

  if (!aId || !bId) {
    return NextResponse.json({ error: "Missing a or b param" }, { status: 400 });
  }

  // Load adjacency: parent-child edges + partnership edges (undirected BFS)
  const [parentChildEdges, partnerships, people] = await Promise.all([
    prisma.parentChild.findMany({
      select: { parentId: true, childId: true, type: true },
    }),
    prisma.partnership.findMany({
      select: { personAId: true, personBId: true },
    }),
    prisma.person.findMany({
      where: loydOnly
        ? { AND: [{ isPlaceholder: false }, loydOnlyWhere()] }
        : { isPlaceholder: false },
      select: { id: true, displayName: true, gender: true },
    }),
  ]);

  const personMap = new Map(people.map((p) => [p.id, p]));
  if (!personMap.has(aId) || !personMap.has(bId)) {
    return NextResponse.json({ error: "Person not found in the selected family view." }, { status: 404 });
  }
  const visibleParentEdges = parentChildEdges.filter((edge) => personMap.has(edge.parentId) && personMap.has(edge.childId));
  const commonAncestors = findClosestSharedAncestors(aId, bId, visibleParentEdges)
    .filter((ancestor) => personMap.has(ancestor.id))
    .map((ancestor) => ({ ...ancestor, displayName: personMap.get(ancestor.id)!.displayName }));

  if (aId === bId) {
    const person = personMap.get(aId)!;
    return NextResponse.json({
      path: [{ id: person.id, displayName: person.displayName, gender: person.gender, relation: "start" }],
      connected: true,
      steps: 0,
      commonAncestors,
    });
  }

  // Build undirected adjacency map with edge labels
  const adj = new Map<string, { id: string; label: string }[]>();
  function addEdge(a: string, b: string, aToB: string, bToA: string) {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push({ id: b, label: aToB });
    adj.get(b)!.push({ id: a, label: bToA });
  }

  for (const pc of visibleParentEdges) {
    const labels = parentRelationshipLabels(pc.type);
    addEdge(pc.parentId, pc.childId, labels.parentToChild, labels.childToParent);
  }
  for (const p of partnerships) {
    if (!personMap.has(p.personAId) || !personMap.has(p.personBId)) continue;
    addEdge(p.personAId, p.personBId, "partner of", "partner of");
  }

  // BFS
  const visited = new Map<string, { from: string; label: string } | null>();
  visited.set(aId, null);
  const queue: string[] = [aId];

  let found = false;
  outer: while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of adj.get(current) ?? []) {
      if (!visited.has(neighbor.id)) {
        visited.set(neighbor.id, { from: current, label: neighbor.label });
        if (neighbor.id === bId) {
          found = true;
          break outer;
        }
        queue.push(neighbor.id);
      }
    }
  }

  if (!found) {
    return NextResponse.json({ path: [], connected: false, commonAncestors });
  }

  // Reconstruct path
  const path: PathNode[] = [];
  let current: string | null = bId;
  while (current) {
    const p = personMap.get(current);
    const meta = visited.get(current);
    path.unshift({
      id: current,
      displayName: p?.displayName ?? current,
      gender: p?.gender ?? "UNKNOWN",
      relation: meta?.label ?? "start",
    });
    current = meta?.from ?? null;
  }

  return NextResponse.json({ path, connected: true, steps: path.length - 1, commonAncestors });
}
