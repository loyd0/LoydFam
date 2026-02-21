import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    totalPeople,
    livingCount,
    totalEvents,
    issueCount,
    upcomingBirthdays,
    recentActivity,
    lastImport,
  ] = await Promise.all([
    // Total non-placeholder people
    prisma.person.count({ where: { isPlaceholder: false } }),

    // Living people: have a birth event but no death event
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT p.id)::bigint as count
      FROM people p
      INNER JOIN person_events pe_birth ON pe_birth."personId" = p.id
      INNER JOIN events e_birth ON e_birth.id = pe_birth."eventId" AND e_birth.type = 'BIRTH'
      LEFT JOIN person_events pe_death ON pe_death."personId" = p.id
      LEFT JOIN events e_death ON e_death.id = pe_death."eventId" AND e_death.type = 'DEATH'
      WHERE p."isPlaceholder" = false
      AND e_death.id IS NULL
    `.then((r) => Number(r[0]?.count ?? 0)),

    // Total events
    prisma.event.count(),

    // Data quality issues
    prisma.importIssue.count(),

    // Upcoming birthdays: people with birth month/day matching upcoming dates
    prisma.$queryRaw<
      { id: string; displayName: string; birthMonth: number; birthDay: number }[]
    >`
      SELECT DISTINCT p.id, p."displayName", e."dateMonth" as "birthMonth", e."dateDay" as "birthDay"
      FROM people p
      INNER JOIN person_events pe ON pe."personId" = p.id
      INNER JOIN events e ON e.id = pe."eventId" AND e.type = 'BIRTH'
      LEFT JOIN person_events pe_death ON pe_death."personId" = p.id
      LEFT JOIN events e_death ON e_death.id = pe_death."eventId" AND e_death.type = 'DEATH'
      WHERE p."isPlaceholder" = false
      AND e_death.id IS NULL
      AND e."dateMonth" IS NOT NULL
      AND e."dateDay" IS NOT NULL
      ORDER BY e."dateMonth", e."dateDay"
      LIMIT 10
    `,

    // Recent activity
    prisma.activity.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),

    // Last import
    prisma.importRun.findFirst({
      orderBy: { startedAt: "desc" },
      include: { sourceFile: true },
    }),
  ]);

  // Data quality counts
  const [missingDob, missingDod, missingParents, missingGender, missingSpouse] =
    await Promise.all([
      prisma.importIssue.count({ where: { code: "MISSING_DOB" } }),
      prisma.importIssue.count({ where: { code: "PARTIAL_DOD" } }),
      // People with no parent-child links as child
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint as count FROM people p
        WHERE p."isPlaceholder" = false
        AND NOT EXISTS (SELECT 1 FROM parent_child pc WHERE pc."childId" = p.id)
      `.then((r) => Number(r[0]?.count ?? 0)),
      prisma.person.count({
        where: { isPlaceholder: false, gender: "UNKNOWN" },
      }),
      // People with no partnerships
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint as count FROM people p
        WHERE p."isPlaceholder" = false
        AND NOT EXISTS (
          SELECT 1 FROM partnerships pt
          WHERE pt."personAId" = p.id OR pt."personBId" = p.id
        )
      `.then((r) => Number(r[0]?.count ?? 0)),
    ]);

  return NextResponse.json({
    stats: {
      totalPeople,
      livingCount,
      totalEvents,
      issueCount,
    },
    dataQuality: {
      missingDob,
      missingDod,
      missingParents,
      missingGender,
      missingSpouse,
    },
    upcomingBirthdays,
    recentActivity,
    lastImport: lastImport
      ? {
          id: lastImport.id,
          status: lastImport.status,
          startedAt: lastImport.startedAt,
          finishedAt: lastImport.finishedAt,
          filename: lastImport.sourceFile.originalFilename,
          summary: lastImport.summary,
        }
      : null,
  });
}
