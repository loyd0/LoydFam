import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Surnames considered "Loyd lineage" for the direct filter
const LOYD_SURNAMES = new Set(["LOYD", "LLOYD", "LOYD-DAVIES", "LOYD DAVIES", "CORMACK-LOYD", "LOYD (CHARLTON)"]);

function isLoydLineage(surname: string | null, primaryExternalKey: string | null): boolean {
  // The 190 numbered Loyds always have LOYD: prefix — definitive check
  if (primaryExternalKey?.startsWith("LOYD:")) return true;
  if (!surname) return false;
  return LOYD_SURNAMES.has(surname.toUpperCase().trim());
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rootId = searchParams.get("root");
  const depth = Math.min(10, Math.max(1, parseInt(searchParams.get("depth") || "4", 10)));
  // lineage=direct: stop traversal at non-Loyd children (show them as leaf nodes)
  // lineage=full: show everyone
  const lineage = searchParams.get("lineage") === "direct" ? "direct" : "full";

  // If no root specified, find the earliest ancestor
  let rootPerson;
  if (rootId) {
    rootPerson = await prisma.person.findUnique({
      where: { id: rootId },
      select: { id: true, displayName: true, primaryExternalKey: true, surname: true },
    });
  } else {
    rootPerson = await prisma.person.findFirst({
      where: { isPlaceholder: false, legacyGeneration: { not: null } },
      orderBy: { legacyGeneration: "asc" },
      select: { id: true, displayName: true, primaryExternalKey: true, surname: true },
    });
  }

  if (!rootPerson) {
    return NextResponse.json({ nodes: [], edges: [], roots: [] });
  }

  // Get all available root options
  const roots = await prisma.person.findMany({
    where: { isPlaceholder: false },
    orderBy: [{ legacyGeneration: "asc" }, { displayName: "asc" }],
    take: 200,
    select: {
      id: true,
      displayName: true,
      legacyGeneration: true,
      generationFromWilliam: true,
    },
  });

  // ── Pre-load the "direct Loyd" person set for direct lineage filter ──
  // Use the authoritative LOYD: primaryExternalKey prefix — covers all 190 numbered Loyds
  // regardless of surname spelling (LOYD, LLOYD, etc.)
  const directLoydIds = new Set<string>();
  if (lineage === "direct") {
    const loydPeople = await prisma.person.findMany({
      where: {
        OR: [
          { primaryExternalKey: { startsWith: "LOYD:" } },
          // Also include anyone with an explicit Loyd/Lloyd surname (catches edge cases)
          { surname: { in: ["LOYD", "LLOYD", "CORMACK-LOYD", "LOYD (CHARLTON)"] } },
        ],
      },
      select: { id: true },
    });
    for (const p of loydPeople) directLoydIds.add(p.id);
  }

  // ── Batched BFS ──────────────────────────────────────────────
  // One query per depth level.

  interface TreeEdge {
    parentId: string;
    childId: string;
  }

  const edges: TreeEdge[] = [];
  const allPersonIds = new Set<string>([rootPerson.id]);

  // BFS by depth level — one query per level
  let currentLevelIds = [rootPerson.id];

  for (let d = 0; d < depth && currentLevelIds.length > 0; d++) {
    // In direct mode, only expand Loyd-lineage nodes further
    const expandIds =
      lineage === "direct"
        ? currentLevelIds.filter((id) => directLoydIds.has(id) || d === 0)
        : currentLevelIds;

    if (expandIds.length === 0) break;

    // Batch-fetch all children for the current level
    const childRels = await prisma.parentChild.findMany({
      where: { parentId: { in: expandIds } },
      select: { parentId: true, childId: true },
    });

    if (childRels.length === 0) break;

    const nextLevelIds: string[] = [];
    for (const rel of childRels) {
      // Always add child as a node and edge (so non-Loyd leaf nodes are visible)
      edges.push({ parentId: rel.parentId, childId: rel.childId });
      if (!allPersonIds.has(rel.childId)) {
        allPersonIds.add(rel.childId);
        // In direct mode, only queue Loyd-lineage children for further expansion
        if (lineage === "full" || directLoydIds.has(rel.childId)) {
          nextLevelIds.push(rel.childId);
        }
      }
    }

    currentLevelIds = nextLevelIds;
  }

  // Batch-fetch all partnerships for discovered people — only for spouse NAME labels, not as tree nodes
  const allIds = Array.from(allPersonIds);
  const partnerships = await prisma.partnership.findMany({
    where: {
      OR: [
        { personAId: { in: allIds } },
        { personBId: { in: allIds } },
      ],
    },
    select: { personAId: true, personBId: true },
  });

  // NOTE: We do NOT add spouse IDs to allPersonIds — spouses are shown as name labels only,
  // not as separate tree nodes (which caused them to render as a flat row of orphans).
  const partnershipList = partnerships;

  // Single bulk load of ALL people + their birth/death events
  const allPeople = await prisma.person.findMany({
    where: { id: { in: Array.from(allPersonIds) } },
    select: {
      id: true,
      displayName: true,
      gender: true,
      surname: true,
      knownAs: true,
      residencyText: true,
      primaryExternalKey: true,
      legacyGeneration: true,
      generationFromWilliam: true,
      events: {
        include: { event: true },
        where: { event: { type: { in: ["BIRTH", "DEATH"] } } },
      },
    },
  });

  // Build a spouse-name lookup: personId -> spouse display names (from people in the tree)
  const spouseNames = new Map<string, string[]>();
  for (const p of partnershipList) {
    if (!spouseNames.has(p.personAId)) spouseNames.set(p.personAId, []);
    if (!spouseNames.has(p.personBId)) spouseNames.set(p.personBId, []);
  }

  // We need to resolve display names after loading people
  const personDisplayNames = new Map<string, string>();
  for (const person of allPeople) {
    personDisplayNames.set(person.id, person.displayName);
  }
  for (const p of partnershipList) {
    const aName = personDisplayNames.get(p.personBId) ?? "Unknown";
    const bName = personDisplayNames.get(p.personAId) ?? "Unknown";
    if (spouseNames.has(p.personAId)) spouseNames.get(p.personAId)!.push(aName);
    if (spouseNames.has(p.personBId)) spouseNames.get(p.personBId)!.push(bName);
  }

  // Map to response format
  const nodes = allPeople.map((p) => {
    const birth = p.events.find((e) => e.event.type === "BIRTH");
    const death = p.events.find((e) => e.event.type === "DEATH");
    const isLoyd = isLoydLineage(p.surname, p.primaryExternalKey ?? null);
    return {
      id: p.id,
      displayName: p.displayName,
      gender: p.gender,
      surname: p.surname,
      knownAs: p.knownAs,
      residencyText: p.residencyText,
      birthYear: birth?.event.dateYear ?? null,
      deathYear: death?.event.dateYear ?? null,
      isLiving: !death,
      generation: p.legacyGeneration ?? p.generationFromWilliam ?? null,
      spouseNames: spouseNames.get(p.id) ?? [],
      isLoyd,  // flag so the UI can visually distinguish non-Loyd leaf nodes
    };
  });

  return NextResponse.json({
    nodes,
    edges,
    rootId: rootPerson.id,
    lineage,
    roots: roots.map((r) => ({
      id: r.id,
      displayName: r.displayName,
      generation: r.legacyGeneration ?? r.generationFromWilliam,
    })),
  });
}
