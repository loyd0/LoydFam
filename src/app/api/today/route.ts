import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use today's date (UTC)
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();

  const events = await prisma.event.findMany({
    where: {
      dateMonth: month,
      dateDay: day,
      type: { in: ["BIRTH", "DEATH", "MARRIAGE"] },
    },
    include: {
      personEvents: {
        include: {
          person: {
            select: { id: true, displayName: true, gender: true },
          },
        },
        where: { person: { isPlaceholder: false } },
      },
    },
    orderBy: [{ dateYear: "asc" }],
    take: 20,
  });

  return NextResponse.json({
    month,
    day,
    events: events
      .filter((e) => e.personEvents.length > 0)
      .map((e) => ({
        id: e.id,
        type: e.type,
        dateYear: e.dateYear,
        dateIsApprox: e.dateIsApprox,
        people: e.personEvents.map((pe) => ({
          id: pe.person.id,
          displayName: pe.person.displayName,
          gender: pe.person.gender,
          role: pe.role,
        })),
      })),
  });
}
