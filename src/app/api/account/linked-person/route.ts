import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditedPrisma } from "@/lib/audited-prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { verifiedPersonId: true, linkedPerson: { select: {
      id: true, displayName: true, gender: true, externalId: true, sourceSystem: true,
      primaryExternalKey: true,
      legacyGeneration: true, generationFromWilliam: true,
      events: { where: { event: { type: { in: ["BIRTH", "DEATH"] } } }, select: { event: { select: { type: true, dateYear: true } } }, take: 2 },
    } } },
  });
  const person = user?.linkedPerson;
  const birthYear = person?.events.find((entry) => entry.event.type === "BIRTH")?.event.dateYear ?? null;
  const deathYear = person?.events.find((entry) => entry.event.type === "DEATH")?.event.dateYear ?? null;
  return NextResponse.json({ ownedPersonId: user?.verifiedPersonId ?? null, person: person ? {
    id: person.id, displayName: person.displayName, gender: person.gender,
    externalId: person.externalId, sourceSystem: person.sourceSystem,
    numberSystem: person.primaryExternalKey.includes(":") ? person.primaryExternalKey.split(":", 1)[0] : null,
    generation: person.legacyGeneration ?? person.generationFromWilliam, birthYear, deathYear,
  } : null });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { personId?: unknown } | null;
  const personId = body?.personId;
  if (personId !== null && typeof personId !== "string") return NextResponse.json({ error: "Choose a valid family person." }, { status: 400 });
  if (typeof personId === "string") {
    const person = await prisma.person.findFirst({ where: { id: personId, isPlaceholder: false }, select: { id: true } });
    if (!person) return NextResponse.json({ error: "Person not found." }, { status: 404 });
  }
  await auditedPrisma(session.user, "Link account to a family person").user.update({ where: { id: session.user.id }, data: { linkedPersonId: personId } });
  return NextResponse.json({ success: true });
}
