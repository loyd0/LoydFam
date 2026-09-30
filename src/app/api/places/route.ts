import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseLoydOnly } from "@/lib/loyd-filter";
import { extractLocationPoints, type PlaceEvidence } from "@/lib/places";
import { apiPermissionError } from "@/lib/permission-guards";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await apiPermissionError("map.view", session.user);
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const loydOnly = parseLoydOnly(params);
  const yearFrom = Number(params.get("yearFrom")) || null;
  const yearTo = Number(params.get("yearTo")) || null;
  const hasYearFilter = Boolean(yearFrom || yearTo);
  const [events, people] = await Promise.all([
    prisma.event.findMany({
      where: {
        place: { isNot: null },
        ...(yearFrom || yearTo ? { dateYear: { ...(yearFrom ? { gte: yearFrom } : {}), ...(yearTo ? { lte: yearTo } : {}) } } : {}),
        ...(loydOnly ? { personEvents: { some: { person: { isPlaceholder: false, OR: [{ primaryExternalKey: { startsWith: "LOYD:" } }, { surname: { in: ["LOYD", "LLOYD", "LOYD-DAVIES", "LOYD DAVIES", "CORMACK-LOYD", "LOYD (CHARLTON)"] } }] } } } } : {}),
      },
      include: { place: true, personEvents: { include: { person: { select: { id: true, displayName: true, branchRootExternalId: true, isPlaceholder: true } } } } },
    }),
    prisma.person.findMany({
      where: { isPlaceholder: false, ...(loydOnly ? { OR: [{ primaryExternalKey: { startsWith: "LOYD:" } }, { surname: { in: ["LOYD", "LLOYD", "LOYD-DAVIES", "LOYD DAVIES", "CORMACK-LOYD", "LOYD (CHARLTON)"] } }] } : {}) },
      select: { id: true, primaryExternalKey: true, displayName: true, branchRootExternalId: true, residencyText: true, personPlaces: { include: { place: true } } },
    }),
  ]);

  const branchNames = new Map(people.map((person) => [person.primaryExternalKey, person.displayName]));
  const branchLabel = (id: string | null) => id ? branchNames.get(id) ?? id : null;
  const records: Array<PlaceEvidence & { locationText: string | null }> = [];
  for (const event of events) {
    if (!event.place || ["ADDRESS", "HOUSE"].includes(event.place.type)) continue;
    for (const pe of event.personEvents) {
      if (pe.person.isPlaceholder) continue;
      records.push({ id: event.id, personId: pe.person.id, personName: pe.person.displayName, label: event.type.toLowerCase(), year: event.dateYear, eventType: event.type, branch: branchLabel(pe.person.branchRootExternalId), locationText: [event.place.name, event.place.country].filter(Boolean).join(", ") });
    }
  }
  for (const person of people) {
    if (!hasYearFilter && person.residencyText) records.push({ id: `residency:${person.id}`, personId: person.id, personName: person.displayName, label: "Recorded residency", year: null, eventType: "RESIDENCE", branch: branchLabel(person.branchRootExternalId), locationText: person.residencyText });
    for (const link of person.personPlaces) {
      if (hasYearFilter) continue;
      if (["ADDRESS", "HOUSE"].includes(link.place.type)) continue;
      records.push({ id: link.id, personId: person.id, personName: person.displayName, label: "Recorded place", year: null, eventType: "RESIDENCE", branch: branchLabel(person.branchRootExternalId), locationText: [link.place.name, link.place.country].filter(Boolean).join(", ") });
    }
  }
  const result = extractLocationPoints(records);
  return NextResponse.json({ ...result, evidenceCount: records.length, resolvedEvidenceCount: new Set(result.points.flatMap((p) => p.evidence.map((e) => `${e.id}:${e.personId}`))).size });
}
