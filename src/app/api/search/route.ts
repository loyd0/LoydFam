import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loydOnlyWhere, parseLoydOnly } from "@/lib/loyd-filter";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const loydOnly = parseLoydOnly(searchParams);

  if (q.length < 2) {
    return NextResponse.json({ people: [], events: [] });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const andClauses: any[] = [
    { isPlaceholder: false },
    {
      OR: [
        { displayName: { contains: q, mode: "insensitive" } },
        { surname: { contains: q, mode: "insensitive" } },
        { givenName1: { contains: q, mode: "insensitive" } },
        { knownAs: { contains: q, mode: "insensitive" } },
      ],
    },
  ];

  if (loydOnly) {
    andClauses.push(loydOnlyWhere());
  }

  const [people, events] = await Promise.all([
    prisma.person.findMany({
      where: { AND: andClauses },
      take: 15,
      select: {
        id: true,
        displayName: true,
        surname: true,
        gender: true,
        legacyGeneration: true,
        generationFromWilliam: true,
        events: {
          where: { event: { type: { in: ["BIRTH", "DEATH"] } } },
          include: { event: { select: { type: true, dateYear: true } } },
          take: 2,
        },
      },
      orderBy: { displayName: "asc" },
    }),

    loydOnly
      ? // When filtering to Loyds, only show events involving Loyd people
        prisma.event.findMany({
          where: {
            dateYear: { not: null },
            type: { in: ["BIRTH", "DEATH", "MARRIAGE"] },
            personEvents: {
              some: {
                person: {
                  isPlaceholder: false,
                  OR: loydOnlyWhere().OR,
                },
              },
            },
          },
          take: 8,
          select: {
            id: true,
            type: true,
            dateYear: true,
            dateText: true,
            personEvents: {
              take: 2,
              select: {
                person: { select: { id: true, displayName: true } },
              },
            },
          },
          orderBy: [{ dateYear: "asc" }],
        })
      : prisma.event.findMany({
          where: {
            dateYear: { not: null },
            personEvents: {
              some: {
                person: { isPlaceholder: false },
              },
            },
            type: { in: ["BIRTH", "DEATH", "MARRIAGE"] },
          },
          take: 8,
          select: {
            id: true,
            type: true,
            dateYear: true,
            dateText: true,
            personEvents: {
              take: 2,
              select: {
                person: { select: { id: true, displayName: true } },
              },
            },
          },
          orderBy: [{ dateYear: "asc" }],
        }),
  ]);

  return NextResponse.json({
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
      };
    }),
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      dateYear: e.dateYear,
      people: e.personEvents.map((pe) => ({
        id: pe.person.id,
        displayName: pe.person.displayName,
      })),
    })),
  });
}
