import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiAnyPermissionError } from "@/lib/permission-guards";
import { getBookRoot } from "@/lib/default-person";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await apiAnyPermissionError([
    "people.view", "tree.view", "mindmap.view", "fanChart.view", "generations.view", "relationship.view",
  ], session.user);
  if (denied) return denied;
  const [root, user] = await Promise.all([
    getBookRoot(),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { linkedPersonId: true } }),
  ]);
  const ids = [root?.id, user?.linkedPersonId].filter((id): id is string => Boolean(id));
  const people = await prisma.person.findMany({
    where: { id: { in: ids }, isPlaceholder: false },
    select: {
      id: true, displayName: true, gender: true, externalId: true, sourceSystem: true,
      primaryExternalKey: true, legacyGeneration: true, generationFromWilliam: true,
      events: { where: { event: { type: { in: ["BIRTH", "DEATH"] } } }, select: { event: { select: { type: true, dateYear: true } } } },
    },
  });
  const serialize = (id?: string | null) => {
    const person = people.find((entry) => entry.id === id);
    return person ? {
      id: person.id, displayName: person.displayName, gender: person.gender,
      externalId: person.externalId, sourceSystem: person.sourceSystem,
      numberSystem: person.primaryExternalKey.split(":")[0],
      generation: person.legacyGeneration ?? person.generationFromWilliam,
      birthYear: person.events.find((entry) => entry.event.type === "BIRTH")?.event.dateYear ?? null,
      deathYear: person.events.find((entry) => entry.event.type === "DEATH")?.event.dateYear ?? null,
    } : null;
  };
  const bookRoot = serialize(root?.id);
  return NextResponse.json({ root: bookRoot, self: serialize(user?.linkedPersonId) ?? bookRoot });
}
