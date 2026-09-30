import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loydOnlyWhere, parseLoydOnly } from "@/lib/loyd-filter";
import { parsePersonSearchQuery } from "@/lib/person-search";
import type { Prisma } from "@/generated/prisma/client";
import { findProperties } from "@/lib/research-store";
import { getUserPermissions } from "@/lib/permission-store";
import { searchDenialResponse } from "@/lib/search-access";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permissions = await getUserPermissions(session.user);
  const canSearchPeople = permissions["people.view"] || permissions["tree.view"] || permissions["mindmap.view"] || permissions["fanChart.view"] || permissions["relationship.view"] || permissions["generations.view"];
  const canSearchEvents = permissions["people.view"] || permissions["timeline.view"];
  const canSearchProperties = permissions["properties.view"];

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const exactId = searchParams.get("id")?.trim();
  const loydOnly = parseLoydOnly(searchParams);
  const parsedQuery = parsePersonSearchQuery(q);
  const numberQuery = parsedQuery.familyNumber;
  const identifierSearch = numberQuery !== null || (/^[A-Z0-9:#-]+$/i.test(q) && /\d/.test(q));

  const denied = searchDenialResponse(canSearchPeople, canSearchEvents, canSearchProperties);
  if (denied) return denied;
  if (!exactId && q.length < 2 && !identifierSearch) {
    return NextResponse.json({ people: [], events: [] });
  }

  const exactOR: Prisma.PersonWhereInput[] = exactId ? [{ id: exactId }] : parsedQuery.sourceSystem
    ? [{ primaryExternalKey: { equals: `${parsedQuery.sourceSystem}:${numberQuery}`, mode: "insensitive" } }]
    : [
      { externalId: { equals: parsedQuery.familyNumber ?? q.replace(/^#/, ""), mode: "insensitive" } },
      { primaryExternalKey: { equals: q, mode: "insensitive" } },
    ];
  const nameOR: Prisma.PersonWhereInput[] = !exactId && !identifierSearch && q.length >= 2 ? [
    { displayName: { contains: q, mode: "insensitive" } },
    { surname: { contains: q, mode: "insensitive" } },
    { givenName1: { contains: q, mode: "insensitive" } },
    { knownAs: { contains: q, mode: "insensitive" } },
    { aliases: { some: { value: { contains: q, mode: "insensitive" } } } },
  ] : [];
  const andClauses: Prisma.PersonWhereInput[] = [
    { isPlaceholder: false },
    {
      OR: [...exactOR, ...nameOR],
    },
  ];

  if (loydOnly) {
    andClauses.push(loydOnlyWhere());
  }

  const baseClauses: Prisma.PersonWhereInput[] = [{ isPlaceholder: false }, ...(loydOnly ? [loydOnlyWhere()] : [])];
  const personSelection = {
    id: true, displayName: true, surname: true, gender: true,
    externalId: true, sourceSystem: true, primaryExternalKey: true, branchRootExternalId: true,
    legacyGeneration: true, generationFromWilliam: true,
    events: {
      where: { event: { type: { in: ["BIRTH" as const, "DEATH" as const] } } },
      include: { event: { select: { type: true, dateYear: true } } }, take: 2,
    },
  };
  const [exactPeople, namePeople, events] = await Promise.all([
    canSearchPeople ? prisma.person.findMany({
      where: { AND: [...baseClauses, { OR: exactOR }] },
      take: 20, select: personSelection, orderBy: { displayName: "asc" },
    }) : Promise.resolve([]),
    canSearchPeople && nameOR.length ? prisma.person.findMany({
      where: { AND: [...baseClauses, { OR: nameOR }] },
      take: 15, select: personSelection, orderBy: { displayName: "asc" },
    }) : Promise.resolve([]),
    !canSearchEvents || q.length < 2 || identifierSearch ? Promise.resolve([]) : prisma.event.findMany({
      where: {
        dateYear: { not: null },
        type: { in: ["BIRTH", "DEATH", "MARRIAGE"] },
        personEvents: { some: { person: { AND: andClauses } } },
      },
      take: 8,
      select: {
        id: true, type: true, dateYear: true, dateText: true,
        personEvents: { take: 2, select: { person: { select: { id: true, displayName: true } } } },
      },
      orderBy: [{ dateYear: "asc" }],
    }),
  ]);

  const people = [...new Map([...exactPeople, ...namePeople].map((person) => [person.id, person])).values()].slice(0, 15);
  const branchKeys = [...new Set(people.map((p) => p.branchRootExternalId).filter((key): key is string => Boolean(key)))];
  const branchPeople = branchKeys.length ? await prisma.person.findMany({
    where: { primaryExternalKey: { in: branchKeys } },
    select: { primaryExternalKey: true, displayName: true },
  }) : [];
  const branchNames = new Map(branchPeople.map((person) => [person.primaryExternalKey, person.displayName]));

  return NextResponse.json({
    properties: canSearchProperties && !exactId ? (await findProperties(q)).slice(0, 8).map(({ slug, name, location }) => ({ slug, name, location })) : [],
    people: people.map((p) => {
      const birth = p.events.find((e) => e.event.type === "BIRTH");
      const death = p.events.find((e) => e.event.type === "DEATH");
      return {
        id: p.id,
        displayName: p.displayName,
        surname: p.surname,
        gender: p.gender,
        generation: p.legacyGeneration ?? p.generationFromWilliam,
        birthYear: birth?.event.dateYear,
        deathYear: death?.event.dateYear,
        externalId: p.externalId,
        sourceSystem: p.sourceSystem,
        numberSystem: p.primaryExternalKey.includes(":") ? p.primaryExternalKey.split(":", 1)[0] : null,
        branch: p.branchRootExternalId ? branchNames.get(p.branchRootExternalId) ?? p.branchRootExternalId : null,
      };
    }),
    events: canSearchEvents ? events.map((e) => ({
      id: e.id,
      type: e.type,
      dateYear: e.dateYear,
      people: e.personEvents.map((pe) => ({
        id: pe.person.id,
        displayName: pe.person.displayName,
      })),
    })) : [],
  });
}
