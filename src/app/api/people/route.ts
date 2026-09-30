import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loydOnlyWhere, parseLoydOnly } from "@/lib/loyd-filter";
import { parsePersonSearchQuery } from "@/lib/person-search";
import type { Prisma } from "@/generated/prisma/client";
import { apiPermissionError } from "@/lib/permission-guards";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await apiPermissionError("people.view", session.user);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));
  const gender = searchParams.get("gender")?.toUpperCase();
  const generation = searchParams.get("generation");
  const living = searchParams.get("living"); // "true" → only people with no death event
  const tag = searchParams.get("tag")?.trim();
  const loydOnly = parseLoydOnly(searchParams);
  const skip = (page - 1) * limit;

  const andClauses: Prisma.PersonWhereInput[] = [{ isPlaceholder: false }];

  // Loyd-only filter
  if (loydOnly) {
    andClauses.push(loydOnlyWhere());
  }

  // Text search — name fields
  if (q) {
    const parsedQuery = parsePersonSearchQuery(q);
    const identifierSearch = parsedQuery.familyNumber !== null || (/^[A-Z0-9:#-]+$/i.test(q) && /\d/.test(q));
    const exactWhere: Prisma.PersonWhereInput[] = parsedQuery.sourceSystem
      ? [{ primaryExternalKey: { equals: `${parsedQuery.sourceSystem}:${parsedQuery.familyNumber}`, mode: "insensitive" } }]
      : [
          { externalId: { equals: parsedQuery.familyNumber ?? q.replace(/^#/, ""), mode: "insensitive" } },
          { primaryExternalKey: { equals: q, mode: "insensitive" } },
        ];
    const nameWhere: Prisma.PersonWhereInput[] = [
        { displayName: { contains: q, mode: "insensitive" } },
        { surname: { contains: q, mode: "insensitive" } },
        { givenName1: { contains: q, mode: "insensitive" } },
        { knownAs: { contains: q, mode: "insensitive" } },
        { aliases: { some: { value: { contains: q, mode: "insensitive" } } } },
    ];
    andClauses.push({ OR: identifierSearch ? exactWhere : [...nameWhere, ...exactWhere] });
  }

  // Gender filter
  if (gender && ["MALE", "FEMALE", "UNKNOWN"].includes(gender)) {
    andClauses.push({ gender: gender as "MALE" | "FEMALE" | "UNKNOWN" });
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

  // Tag filter
  if (tag) {
    andClauses.push({
      tagLinks: { some: { entityType: "PERSON", tag: { name: tag } } },
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
