import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type")?.toUpperCase();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, parseInt(searchParams.get("limit") || "50", 10));
  const skip = (page - 1) * limit;

  const yearFrom = searchParams.get("yearFrom") ? parseInt(searchParams.get("yearFrom")!, 10) : null;
  const yearTo = searchParams.get("yearTo") ? parseInt(searchParams.get("yearTo")!, 10) : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (type && ["BIRTH", "DEATH", "MARRIAGE", "RESIDENCE", "OTHER"].includes(type)) {
    where.type = type;
  }
  if (yearFrom !== null || yearTo !== null) {
    where.dateYear = {};
    if (yearFrom !== null) where.dateYear.gte = yearFrom;
    if (yearTo !== null) where.dateYear.lte = yearTo;
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: [{ dateYear: "asc" }, { dateMonth: "asc" }, { dateDay: "asc" }],
      skip,
      take: limit,
      include: {
        personEvents: {
          include: {
            person: {
              select: { id: true, displayName: true, gender: true },
            },
          },
        },
        place: true,
      },
    }),
    prisma.event.count({ where }),
  ]);

  return NextResponse.json({
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      dateExact: e.dateExact,
      dateYear: e.dateYear,
      dateMonth: e.dateMonth,
      dateDay: e.dateDay,
      dateText: e.dateText,
      dateIsApprox: e.dateIsApprox,
      people: e.personEvents.map((pe) => ({
        id: pe.person.id,
        displayName: pe.person.displayName,
        gender: pe.person.gender,
        role: pe.role,
      })),
      place: e.place,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
