import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface AncestorNode {
  id: string;
  displayName: string;
  gender: string;
  birthYear: number | null;
  deathYear: number | null;
  isLiving: boolean;
  pedigreePosition: number; // Ahnentafel number: 1=subject, 2=father, 3=mother, 4=paternal grandfather...
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const personId = searchParams.get("personId");
  const depth = Math.min(5, Math.max(1, parseInt(searchParams.get("depth") || "4", 10)));

  if (!personId) {
    return NextResponse.json({ error: "Missing personId" }, { status: 400 });
  }

  // BFS up the tree using Ahnentafel numbering
  const ancestors: AncestorNode[] = [];
  const personCache = new Map<string, { id: string; displayName: string; gender: string; birthYear: number | null; deathYear: number | null; isLiving: boolean }>();

  async function loadPerson(id: string) {
    if (personCache.has(id)) return personCache.get(id)!;
    const p = await prisma.person.findUnique({
      where: { id },
      select: {
        id: true,
        displayName: true,
        gender: true,
        events: {
          where: { event: { type: { in: ["BIRTH", "DEATH"] } } },
          include: { event: { select: { type: true, dateYear: true } } },
          take: 2,
        },
      },
    });
    if (!p) return null;
    const birth = p.events.find((e) => e.event.type === "BIRTH");
    const death = p.events.find((e) => e.event.type === "DEATH");
    const data = {
      id: p.id,
      displayName: p.displayName,
      gender: p.gender,
      birthYear: birth?.event.dateYear ?? null,
      deathYear: death?.event.dateYear ?? null,
      isLiving: !death,
    };
    personCache.set(id, data);
    return data;
  }

  // Queue: [personId, ahnentafelNum, currentDepth]
  const queue: [string, number, number][] = [[personId, 1, 0]];

  while (queue.length > 0) {
    const [currentId, ahnNum, currentDepth] = queue.shift()!;
    const person = await loadPerson(currentId);
    if (!person) continue;

    ancestors.push({ ...person, pedigreePosition: ahnNum });

    if (currentDepth >= depth) continue;

    // Get parents
    const parentRels = await prisma.parentChild.findMany({
      where: { childId: currentId },
      select: { parentId: true, parent: { select: { gender: true } } },
    });

    // Father = ahnNum*2, Mother = ahnNum*2+1
    const father = parentRels.find((r) => r.parent.gender === "MALE");
    const mother = parentRels.find((r) => r.parent.gender !== "MALE");

    if (father) queue.push([father.parentId, ahnNum * 2, currentDepth + 1]);
    if (mother) queue.push([mother.parentId, ahnNum * 2 + 1, currentDepth + 1]);
  }

  // Also include root lookup for person selector
  const roots = await prisma.person.findMany({
    where: { isPlaceholder: false },
    select: { id: true, displayName: true },
    orderBy: { displayName: "asc" },
    take: 500,
  });

  return NextResponse.json({ ancestors, roots });
}
