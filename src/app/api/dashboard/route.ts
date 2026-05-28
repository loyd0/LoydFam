import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseLoydOnly, LOYD_ONLY_SQL } from "@/lib/loyd-filter";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const loydOnly = parseLoydOnly(searchParams);

  // Optional Loyd-only SQL fragment for raw queries (people aliased as `p`).
  // LOYD_ONLY_SQL is a constant — no user input — so interpolation is safe.
  const loydSql = loydOnly ? `AND ${LOYD_ONLY_SQL}` : "";

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
    loydOnly
      ? prisma.person.count({
          where: {
            AND: [
              { isPlaceholder: false },
              {
                OR: [
                  { primaryExternalKey: { startsWith: "LOYD:" } },
                  { surname: { in: ["LOYD", "LLOYD", "LOYD-DAVIES", "LOYD DAVIES", "CORMACK-LOYD", "LOYD (CHARLTON)"] } },
                ],
              },
            ],
          },
        })
      : prisma.person.count({ where: { isPlaceholder: false } }),

    // Living people: have a birth event but no death event
    prisma.$queryRawUnsafe<[{ count: bigint }]>(`
      SELECT COUNT(DISTINCT p.id)::bigint as count
      FROM people p
      INNER JOIN person_events pe_birth ON pe_birth."personId" = p.id
      INNER JOIN events e_birth ON e_birth.id = pe_birth."eventId" AND e_birth.type = 'BIRTH'
      WHERE p."isPlaceholder" = false
      AND NOT EXISTS (
        SELECT 1 FROM person_events pe_death
        JOIN events e_death ON e_death.id = pe_death."eventId" AND e_death.type = 'DEATH'
        WHERE pe_death."personId" = p.id
      )
      ${loydSql}
    `).then((r) => Number(r[0]?.count ?? 0)),

    // Total events (not filtered — it's a global count)
    prisma.event.count(),

    // Data quality issues
    prisma.importIssue.count(),

    // Upcoming birthdays
    prisma.$queryRawUnsafe<
      { id: string; displayName: string; birthMonth: number; birthDay: number; birthYear: number | null }[]
    >(`
      SELECT DISTINCT p.id, p."displayName",
        e."dateMonth" as "birthMonth", e."dateDay" as "birthDay", e."dateYear" as "birthYear",
        MOD(
          (e."dateMonth" * 31 + e."dateDay")
          - (EXTRACT(MONTH FROM CURRENT_DATE)::int * 31 + EXTRACT(DAY FROM CURRENT_DATE)::int)
          + 372, 372) as sort_key
      FROM people p
      INNER JOIN person_events pe ON pe."personId" = p.id
      INNER JOIN events e ON e.id = pe."eventId" AND e.type = 'BIRTH'
      WHERE p."isPlaceholder" = false
      AND NOT EXISTS (
        SELECT 1 FROM person_events pe_death
        JOIN events e_death ON e_death.id = pe_death."eventId" AND e_death.type = 'DEATH'
        WHERE pe_death."personId" = p.id
      )
      AND e."dateMonth" IS NOT NULL
      AND e."dateDay" IS NOT NULL
      ${loydSql}
      ORDER BY sort_key
      LIMIT 10
    `),

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
