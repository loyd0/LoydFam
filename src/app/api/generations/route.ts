import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const people = await prisma.person.findMany({
    where: { isPlaceholder: false },
    select: {
      id: true,
      displayName: true,
      gender: true,
      surname: true,
      legacyGeneration: true,
      generationFromWilliam: true,
      events: {
        where: { event: { type: { in: ["BIRTH", "DEATH"] } } },
        include: { event: { select: { type: true, dateYear: true } } },
        take: 2,
      },
    },
    orderBy: [{ legacyGeneration: "asc" }, { displayName: "asc" }],
  });

  // Group by generation
  const genMap = new Map<
    number,
    {
      generation: number;
      people: {
        id: string;
        displayName: string;
        gender: string;
        surname: string | null;
        birthYear: number | null;
        deathYear: number | null;
        isLiving: boolean;
      }[];
      stats: {
        male: number;
        female: number;
        living: number;
        avgLifespan: number | null;
      };
    }
  >();

  for (const p of people) {
    const gen = p.legacyGeneration ?? p.generationFromWilliam;
    if (gen == null) continue;

    if (!genMap.has(gen)) {
      genMap.set(gen, { generation: gen, people: [], stats: { male: 0, female: 0, living: 0, avgLifespan: null } });
    }

    const birth = p.events.find((e) => e.event.type === "BIRTH");
    const death = p.events.find((e) => e.event.type === "DEATH");
    const isLiving = !death;

    genMap.get(gen)!.people.push({
      id: p.id,
      displayName: p.displayName,
      gender: p.gender,
      surname: p.surname,
      birthYear: birth?.event.dateYear ?? null,
      deathYear: death?.event.dateYear ?? null,
      isLiving,
    });
  }

  // Compute stats per generation
  const generations = Array.from(genMap.values()).map((g) => {
    const males = g.people.filter((p) => p.gender === "MALE").length;
    const females = g.people.filter((p) => p.gender === "FEMALE").length;
    const living = g.people.filter((p) => p.isLiving).length;

    const lifespans = g.people
      .filter((p) => p.birthYear && p.deathYear)
      .map((p) => p.deathYear! - p.birthYear!);
    const avgLifespan =
      lifespans.length > 0
        ? Math.round(lifespans.reduce((a, b) => a + b, 0) / lifespans.length)
        : null;

    return {
      generation: g.generation,
      count: g.people.length,
      stats: { male: males, female: females, living, avgLifespan },
      people: g.people,
    };
  });

  generations.sort((a, b) => a.generation - b.generation);

  return NextResponse.json({ generations });
}
