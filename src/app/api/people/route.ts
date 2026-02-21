import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));
  const gender = searchParams.get("gender")?.toUpperCase();
  const generation = searchParams.get("generation");
  const living = searchParams.get("living"); // "true" → only people with no death event
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const andClauses: any[] = [{ isPlaceholder: false }];

  // Text search — name fields
  if (q) {
    andClauses.push({
      OR: [
        { displayName: { contains: q, mode: "insensitive" } },
        { surname: { contains: q, mode: "insensitive" } },
        { givenName1: { contains: q, mode: "insensitive" } },
        { knownAs: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  // Gender filter
  if (gender && ["MALE", "FEMALE", "UNKNOWN"].includes(gender)) {
    andClauses.push({ gender });
  }

  // Generation filter (separate AND so it doesn't collide with name OR)
  if (generation) {
    const gen = parseInt(generation, 10);
    if (!isNaN(gen)) {
      andClauses.push({
        OR: [{ legacyGeneration: gen }, { generationFromWilliam: gen }],
      });
    }
  }

  // Living filter — exclude people who have a DEATH event
  if (living === "true") {
    andClauses.push({
      events: {
        none: {
          event: { type: "DEATH" },
        },
      },
    });
  }

  const where = andClauses.length === 1 ? andClauses[0] : { AND: andClauses };

  const [people, total] = await Promise.all([
    prisma.person.findMany({
      where,
      orderBy: [{ legacyGeneration: "asc" }, { displayName: "asc" }],
      skip,
      take: limit,
      include: {
        events: {
          include: { event: true },
          where: {
            event: { type: { in: ["BIRTH", "DEATH"] } },
          },
        },
      },
    }),
    prisma.person.count({ where }),
  ]);

  const formatted = people.map((p) => {
    const birthEvent = p.events.find((pe) => pe.event.type === "BIRTH");
    const deathEvent = p.events.find((pe) => pe.event.type === "DEATH");

    return {
      id: p.id,
      displayName: p.displayName,
      surname: p.surname,
      givenName1: p.givenName1,
      knownAs: p.knownAs,
      gender: p.gender,
      generation: p.legacyGeneration ?? p.generationFromWilliam,
      birthYear: birthEvent?.event.dateYear,
      deathYear: deathEvent?.event.dateYear,
      isLiving: !deathEvent,
    };
  });

  return NextResponse.json({
    people: formatted,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}

