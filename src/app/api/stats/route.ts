import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseLoydOnly } from "@/lib/loyd-filter";

// SQL snippet added to person table queries when loydOnly is true
// Assumes table aliased as "p"
const LOYD_SQL_P = `(p."primaryExternalKey" LIKE 'LOYD:%' OR p.surname IN ('LOYD','LLOYD','LOYD-DAVIES','LOYD DAVIES','CORMACK-LOYD','LOYD (CHARLTON)'))`;
// Without table alias (bare people table)
const LOYD_SQL_BARE = `("primaryExternalKey" LIKE 'LOYD:%' OR surname IN ('LOYD','LLOYD','LOYD-DAVIES','LOYD DAVIES','CORMACK-LOYD','LOYD (CHARLTON)'))`;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const loydOnly = parseLoydOnly(searchParams);

  // Loyd-only Prisma where fragment
  const loydWhere = loydOnly
    ? {
        AND: [
          { isPlaceholder: false },
          {
            OR: [
              { primaryExternalKey: { startsWith: "LOYD:" } },
              { surname: { in: ["LOYD", "LLOYD", "LOYD-DAVIES", "LOYD DAVIES", "CORMACK-LOYD", "LOYD (CHARLTON)"] } },
            ],
          },
        ],
      }
    : { isPlaceholder: false };

  // Conditional SQL fragment
  const lSqlP = loydOnly ? `AND ${LOYD_SQL_P}` : "";
  const lSqlBare = loydOnly ? `AND ${LOYD_SQL_BARE}` : "";

  const [
    totalPeople,
    livingCount,
    deceasedCount,
    genderBreakdown,
    birthsByDecade,
    birthsByMonth,
    lifespanData,
    lifespanByGender,
    ageAtDeathBuckets,
    topNames,
    topSurnames,
    generationCounts,
    dataCompleteness,
    childrenPerCouple,
    generationGap,
    longevityByGeneration,
    partnershipCount,
    marriageAgeDistribution,
    livingAgeDistribution,
    surnameDiversityByGeneration,
  ] = await Promise.all([
    // ─── Population basics ────────────────────────────────────────────────────
    prisma.person.count({ where: loydWhere }),

    // Living = born but no death event, and born within last 120 years
    prisma.$queryRawUnsafe<[{ count: bigint }]>(`
      SELECT COUNT(DISTINCT p.id)::bigint as count FROM people p
      INNER JOIN person_events pe ON pe."personId" = p.id
      INNER JOIN events e ON e.id = pe."eventId" AND e.type = 'BIRTH'
      LEFT JOIN person_events pd ON pd."personId" = p.id
      LEFT JOIN events ed ON ed.id = pd."eventId" AND ed.type = 'DEATH'
      WHERE p."isPlaceholder" = false
        ${lSqlP}
        AND ed.id IS NULL
        AND e."dateYear" IS NOT NULL
        AND e."dateYear" > (EXTRACT(YEAR FROM CURRENT_DATE)::int - 120)
    `).then((r) => Number(r[0]?.count ?? 0)),

    prisma.$queryRawUnsafe<[{ count: bigint }]>(`
      SELECT COUNT(DISTINCT p.id)::bigint as count FROM people p
      INNER JOIN person_events pd ON pd."personId" = p.id
      INNER JOIN events ed ON ed.id = pd."eventId" AND ed.type = 'DEATH'
      WHERE p."isPlaceholder" = false
        ${lSqlP}
    `).then((r) => Number(r[0]?.count ?? 0)),

    prisma.person.groupBy({
      by: ["gender"],
      where: loydWhere,
      _count: true,
    }),

    // ─── Births by decade ─────────────────────────────────────────────────────
    prisma.$queryRawUnsafe<{ decade: number; count: bigint }[]>(`
      SELECT (e."dateYear" / 10 * 10) as decade, COUNT(*)::bigint as count
      FROM events e
      INNER JOIN person_events pe ON pe."eventId" = e.id
      INNER JOIN people p ON p.id = pe."personId" AND p."isPlaceholder" = false
      WHERE e.type = 'BIRTH' AND e."dateYear" IS NOT NULL
        ${lSqlP}
      GROUP BY decade ORDER BY decade
    `),

    // ─── Births by month (seasonality) ────────────────────────────────────────
    prisma.$queryRawUnsafe<{ month: number; count: bigint }[]>(`
      SELECT e."dateMonth" as month, COUNT(*)::bigint as count
      FROM events e
      INNER JOIN person_events pe ON pe."eventId" = e.id
      INNER JOIN people p ON p.id = pe."personId" AND p."isPlaceholder" = false
      WHERE e.type = 'BIRTH' AND e."dateMonth" IS NOT NULL
        ${lSqlP}
      GROUP BY month ORDER BY month
    `),

    // ─── Lifespan data (all) ──────────────────────────────────────────────────
    prisma.$queryRawUnsafe<{ lifespan: number; displayName: string }[]>(`
      SELECT
        (ed."dateYear" - eb."dateYear") as lifespan,
        p."displayName"
      FROM people p
      INNER JOIN person_events peb ON peb."personId" = p.id
      INNER JOIN events eb ON eb.id = peb."eventId" AND eb.type = 'BIRTH' AND eb."dateYear" IS NOT NULL
      INNER JOIN person_events ped ON ped."personId" = p.id
      INNER JOIN events ed ON ed.id = ped."eventId" AND ed.type = 'DEATH' AND ed."dateYear" IS NOT NULL
      WHERE p."isPlaceholder" = false ${lSqlP} AND (ed."dateYear" - eb."dateYear") BETWEEN 1 AND 130
      ORDER BY lifespan DESC
    `),

    // ─── Lifespan by gender ───────────────────────────────────────────────────
    prisma.$queryRawUnsafe<{ gender: string; avg_lifespan: number; median_lifespan: number; count: bigint }[]>(`
      SELECT
        p.gender,
        ROUND(AVG(ed."dateYear" - eb."dateYear"))::int as avg_lifespan,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (ed."dateYear" - eb."dateYear"))::int as median_lifespan,
        COUNT(*)::bigint as count
      FROM people p
      INNER JOIN person_events peb ON peb."personId" = p.id
      INNER JOIN events eb ON eb.id = peb."eventId" AND eb.type = 'BIRTH' AND eb."dateYear" IS NOT NULL
      INNER JOIN person_events ped ON ped."personId" = p.id
      INNER JOIN events ed ON ed.id = ped."eventId" AND ed.type = 'DEATH' AND ed."dateYear" IS NOT NULL
      WHERE p."isPlaceholder" = false ${lSqlP}
        AND (ed."dateYear" - eb."dateYear") BETWEEN 1 AND 130
        AND p.gender != 'UNKNOWN'
      GROUP BY p.gender
    `),

    // ─── Age at death distribution (10-year buckets) ──────────────────────────
    prisma.$queryRawUnsafe<{ bucket: number; count: bigint }[]>(`
      SELECT
        ((ed."dateYear" - eb."dateYear") / 10 * 10) as bucket,
        COUNT(*)::bigint as count
      FROM people p
      INNER JOIN person_events peb ON peb."personId" = p.id
      INNER JOIN events eb ON eb.id = peb."eventId" AND eb.type = 'BIRTH' AND eb."dateYear" IS NOT NULL
      INNER JOIN person_events ped ON ped."personId" = p.id
      INNER JOIN events ed ON ed.id = ped."eventId" AND ed.type = 'DEATH' AND ed."dateYear" IS NOT NULL
      WHERE p."isPlaceholder" = false ${lSqlP} AND (ed."dateYear" - eb."dateYear") BETWEEN 0 AND 120
      GROUP BY bucket ORDER BY bucket
    `),

    // ─── Top first names ──────────────────────────────────────────────────────
    prisma.$queryRawUnsafe<{ name: string; count: bigint }[]>(`
      SELECT "givenName1" as name, COUNT(*)::bigint as count
      FROM people
      WHERE "isPlaceholder" = false AND "givenName1" IS NOT NULL AND "givenName1" != ''
        ${lSqlBare}
      GROUP BY "givenName1"
      ORDER BY count DESC
      LIMIT 20
    `),

    // ─── Top surnames ─────────────────────────────────────────────────────────
    prisma.$queryRawUnsafe<{ name: string; count: bigint }[]>(`
      SELECT surname as name, COUNT(*)::bigint as count
      FROM people
      WHERE "isPlaceholder" = false AND surname IS NOT NULL AND surname != ''
        ${lSqlBare}
      GROUP BY surname
      ORDER BY count DESC
      LIMIT 15
    `),

    // ─── Generation distribution ──────────────────────────────────────────────
    prisma.$queryRawUnsafe<{ generation: number; count: bigint }[]>(`
      SELECT COALESCE("legacyGeneration", "generationFromWilliam") as generation, COUNT(*)::bigint as count
      FROM people
      WHERE "isPlaceholder" = false ${lSqlBare}
      AND COALESCE("legacyGeneration", "generationFromWilliam") IS NOT NULL
      GROUP BY generation ORDER BY generation
    `),

    // ─── Data completeness ────────────────────────────────────────────────────
    Promise.all([
      prisma.person.count({ where: loydWhere }),
      prisma.$queryRawUnsafe<[{ count: bigint }]>(`
        SELECT COUNT(DISTINCT p.id)::bigint as count FROM people p
        INNER JOIN person_events pe ON pe."personId" = p.id
        INNER JOIN events e ON e.id = pe."eventId" AND e.type = 'BIRTH' AND e."dateYear" IS NOT NULL
        WHERE p."isPlaceholder" = false ${lSqlP}
      `).then((r) => Number(r[0]?.count ?? 0)),
      prisma.$queryRawUnsafe<[{ count: bigint }]>(`
        SELECT COUNT(DISTINCT p.id)::bigint as count FROM people p
        INNER JOIN person_events pe ON pe."personId" = p.id
        INNER JOIN events e ON e.id = pe."eventId" AND e.type = 'DEATH' AND e."dateYear" IS NOT NULL
        WHERE p."isPlaceholder" = false ${lSqlP}
      `).then((r) => Number(r[0]?.count ?? 0)),
      prisma.person.count({ where: { ...loydWhere, gender: { not: "UNKNOWN" } } }),
      prisma.$queryRawUnsafe<[{ count: bigint }]>(`
        SELECT COUNT(DISTINCT p.id)::bigint as count FROM people p
        WHERE p."isPlaceholder" = false ${lSqlP}
        AND EXISTS (SELECT 1 FROM parent_child pc WHERE pc."childId" = p.id)
      `).then((r) => Number(r[0]?.count ?? 0)),
      prisma.$queryRawUnsafe<[{ count: bigint }]>(`
        SELECT COUNT(DISTINCT p.id)::bigint as count FROM people p
        WHERE p."isPlaceholder" = false ${lSqlP}
        AND EXISTS (
          SELECT 1 FROM partnerships pt WHERE pt."personAId" = p.id OR pt."personBId" = p.id
        )
      `).then((r) => Number(r[0]?.count ?? 0)),
    ]),

    // ─── Children per couple ──────────────────────────────────────────────────
    prisma.$queryRawUnsafe<{ children: number; count: bigint }[]>(`
      SELECT child_count as children, COUNT(*)::bigint as count
      FROM (
        SELECT pc."parentId", COUNT(*)::int as child_count
        FROM parent_child pc
        INNER JOIN people p ON p.id = pc."parentId" AND p."isPlaceholder" = false ${lSqlP}
        GROUP BY pc."parentId"
      ) t
      WHERE child_count <= 20
      GROUP BY child_count ORDER BY child_count
    `),

    // ─── Generation gap (parent age at child birth) ───────────────────────────
    prisma.$queryRawUnsafe<{ generation: number; avg_gap: number; count: bigint }[]>(`
      SELECT
        COALESCE(parent."legacyGeneration", parent."generationFromWilliam") as generation,
        ROUND(AVG(eb_child."dateYear" - eb_parent."dateYear"))::int as avg_gap,
        COUNT(*)::bigint as count
      FROM parent_child pc
      INNER JOIN people parent ON parent.id = pc."parentId" AND parent."isPlaceholder" = false
      INNER JOIN people child ON child.id = pc."childId" AND child."isPlaceholder" = false
      INNER JOIN person_events peb_p ON peb_p."personId" = parent.id
      INNER JOIN events eb_parent ON eb_parent.id = peb_p."eventId" AND eb_parent.type = 'BIRTH' AND eb_parent."dateYear" IS NOT NULL
      INNER JOIN person_events peb_c ON peb_c."personId" = child.id
      INNER JOIN events eb_child ON eb_child.id = peb_c."eventId" AND eb_child.type = 'BIRTH' AND eb_child."dateYear" IS NOT NULL
      WHERE COALESCE(parent."legacyGeneration", parent."generationFromWilliam") IS NOT NULL
        AND (eb_child."dateYear" - eb_parent."dateYear") BETWEEN 10 AND 60
        ${loydOnly ? `AND ${LOYD_SQL_P.replace(/\bp\b/g, "parent")}` : ""}
      GROUP BY generation
      ORDER BY generation
    `),

    // ─── Longevity by generation ──────────────────────────────────────────────
    prisma.$queryRawUnsafe<{ generation: number; avg_lifespan: number; count: bigint }[]>(`
      SELECT
        COALESCE(p."legacyGeneration", p."generationFromWilliam") as generation,
        ROUND(AVG(ed."dateYear" - eb."dateYear"))::int as avg_lifespan,
        COUNT(*)::bigint as count
      FROM people p
      INNER JOIN person_events peb ON peb."personId" = p.id
      INNER JOIN events eb ON eb.id = peb."eventId" AND eb.type = 'BIRTH' AND eb."dateYear" IS NOT NULL
      INNER JOIN person_events ped ON ped."personId" = p.id
      INNER JOIN events ed ON ed.id = ped."eventId" AND ed.type = 'DEATH' AND ed."dateYear" IS NOT NULL
      WHERE p."isPlaceholder" = false ${lSqlP}
        AND (ed."dateYear" - eb."dateYear") BETWEEN 1 AND 130
        AND COALESCE(p."legacyGeneration", p."generationFromWilliam") IS NOT NULL
      GROUP BY generation
      HAVING COUNT(*) >= 2
      ORDER BY generation
    `),

    // ─── Partnership count ────────────────────────────────────────────────────
    prisma.partnership.count(),

    // ─── Marriage age distribution ────────────────────────────────────────────
    prisma.$queryRawUnsafe<{ age_bucket: number; gender: string; count: bigint }[]>(`
      SELECT
        (EXTRACT(YEAR FROM em."dateExact")::int - eb."dateYear") / 5 * 5 as age_bucket,
        p.gender,
        COUNT(*)::bigint as count
      FROM partnerships pt
      INNER JOIN events em ON em.id = pt."startEventId" AND em.type = 'MARRIAGE' AND em."dateExact" IS NOT NULL
      INNER JOIN (
        SELECT pt2.id as pt_id, unnest(ARRAY[pt2."personAId", pt2."personBId"]) as person_id
        FROM partnerships pt2
      ) pp ON pp.pt_id = pt.id
      INNER JOIN people p ON p.id = pp.person_id AND p."isPlaceholder" = false AND p.gender != 'UNKNOWN'
      INNER JOIN person_events peb ON peb."personId" = p.id
      INNER JOIN events eb ON eb.id = peb."eventId" AND eb.type = 'BIRTH' AND eb."dateYear" IS NOT NULL
      WHERE (EXTRACT(YEAR FROM em."dateExact")::int - eb."dateYear") BETWEEN 10 AND 80
        ${lSqlP}
      GROUP BY age_bucket, gender
      ORDER BY age_bucket, gender
    `),

    // ─── Living age distribution ──────────────────────────────────────────────
    prisma.$queryRawUnsafe<{ age_bucket: number; count: bigint }[]>(`
      SELECT
        ((EXTRACT(YEAR FROM CURRENT_DATE)::int - eb."dateYear") / 10 * 10) as age_bucket,
        COUNT(*)::bigint as count
      FROM people p
      INNER JOIN person_events peb ON peb."personId" = p.id
      INNER JOIN events eb ON eb.id = peb."eventId" AND eb.type = 'BIRTH' AND eb."dateYear" IS NOT NULL
      LEFT JOIN person_events ped ON ped."personId" = p.id
      LEFT JOIN events ed ON ed.id = ped."eventId" AND ed.type = 'DEATH'
      WHERE p."isPlaceholder" = false ${lSqlP}
        AND ed.id IS NULL
        AND eb."dateYear" > (EXTRACT(YEAR FROM CURRENT_DATE)::int - 110)
      GROUP BY age_bucket
      ORDER BY age_bucket
    `),

    // ─── Surname diversity by generation ──────────────────────────────────────
    prisma.$queryRawUnsafe<{ generation: number; unique_surnames: bigint; total: bigint }[]>(`
      SELECT
        COALESCE("legacyGeneration", "generationFromWilliam") as generation,
        COUNT(DISTINCT LOWER(surname))::bigint as unique_surnames,
        COUNT(*)::bigint as total
      FROM people
      WHERE "isPlaceholder" = false ${lSqlBare}
        AND surname IS NOT NULL AND surname != ''
        AND COALESCE("legacyGeneration", "generationFromWilliam") IS NOT NULL
      GROUP BY generation
      ORDER BY generation
    `),
  ]);

  // ─── Compute lifespan stats ────────────────────────────────────────────────
  const lifespans = lifespanData.map((d) => d.lifespan);
  const sorted = [...lifespans].sort((a, b) => a - b);
  const avgLifespan =
    sorted.length > 0
      ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length)
      : 0;
  const medianLifespan =
    sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;

  // ─── Children per couple stats ─────────────────────────────────────────────
  const totalCouplesWithChildren = childrenPerCouple.reduce(
    (s, r) => s + Number(r.count),
    0
  );
  const totalChildrenRecorded = childrenPerCouple.reduce(
    (s, r) => s + r.children * Number(r.count),
    0
  );
  const avgChildrenPerCouple =
    totalCouplesWithChildren > 0
      ? Math.round((totalChildrenRecorded / totalCouplesWithChildren) * 10) / 10
      : 0;

  const [
    totalForCompleteness,
    withDob,
    withDod,
    withGender,
    withParents,
    withSpouse,
  ] = dataCompleteness;

  return NextResponse.json({
    // ── Population ────────────────────────────────────────────────────────────
    population: {
      total: totalPeople,
      living: livingCount,
      deceased: deceasedCount,
      partnerships: partnershipCount,
      genderBreakdown: genderBreakdown.map((g) => ({
        gender: g.gender,
        count: g._count,
      })),
    },

    // ── Births ────────────────────────────────────────────────────────────────
    birthsByDecade: birthsByDecade.map((d) => ({
      decade: d.decade,
      label: `${d.decade}s`,
      count: Number(d.count),
    })),
    birthsByMonth: birthsByMonth.map((m) => ({
      month: m.month,
      label: [
        "",
        "Jan","Feb","Mar","Apr","May","Jun",
        "Jul","Aug","Sep","Oct","Nov","Dec",
      ][m.month] ?? String(m.month),
      count: Number(m.count),
    })),

    // ── Longevity ─────────────────────────────────────────────────────────────
    longevity: {
      average: avgLifespan,
      median: medianLifespan,
      sampleSize: lifespans.length,
      oldest: lifespanData.slice(0, 10).map((d) => ({
        name: d.displayName,
        age: d.lifespan,
      })),
      youngest: lifespanData
        .slice(-10)
        .reverse()
        .map((d) => ({
          name: d.displayName,
          age: d.lifespan,
        })),
    },
    lifespanByGender: lifespanByGender.map((g) => ({
      gender: g.gender,
      avg: g.avg_lifespan,
      median: g.median_lifespan,
      count: Number(g.count),
    })),
    ageAtDeathBuckets: ageAtDeathBuckets.map((b) => ({
      bucket: b.bucket,
      label: `${b.bucket}–${b.bucket + 9}`,
      count: Number(b.count),
    })),
    longevityByGeneration: longevityByGeneration.map((g) => ({
      generation: g.generation,
      avgLifespan: g.avg_lifespan,
      count: Number(g.count),
    })),

    // ── Names ─────────────────────────────────────────────────────────────────
    topNames: topNames.map((n) => ({
      name: n.name,
      count: Number(n.count),
    })),
    topSurnames: topSurnames.map((n) => ({
      name: n.name,
      count: Number(n.count),
    })),

    // ── Generations ───────────────────────────────────────────────────────────
    generations: generationCounts.map((g) => ({
      generation: g.generation,
      count: Number(g.count),
    })),

    // ── Family structure ──────────────────────────────────────────────────────
    familyStructure: {
      avgChildrenPerCouple,
      totalCouplesWithChildren,
      childrenDistribution: childrenPerCouple.map((c) => ({
        children: c.children,
        count: Number(c.count),
      })),
      generationGap: generationGap.map((g) => ({
        generation: g.generation,
        avgGap: g.avg_gap,
        count: Number(g.count),
      })),
    },

    // ── Marriage ──────────────────────────────────────────────────────────────
    marriageAgeDistribution: marriageAgeDistribution.map((m) => ({
      ageBucket: m.age_bucket,
      label: `${m.age_bucket}–${m.age_bucket + 4}`,
      gender: m.gender,
      count: Number(m.count),
    })),

    // ── Living age ────────────────────────────────────────────────────────────
    livingAgeDistribution: livingAgeDistribution.map((b) => ({
      ageBucket: b.age_bucket,
      label: `${b.age_bucket}s`,
      count: Number(b.count),
    })),

    // ── Genetics / diversity ──────────────────────────────────────────────────
    surnameDiversity: surnameDiversityByGeneration.map((s) => ({
      generation: s.generation,
      uniqueSurnames: Number(s.unique_surnames),
      total: Number(s.total),
      diversityRatio:
        Number(s.total) > 0
          ? Math.round((Number(s.unique_surnames) / Number(s.total)) * 100) / 100
          : 0,
    })),

    // ── Data completeness ─────────────────────────────────────────────────────
    dataCompleteness: {
      total: totalForCompleteness,
      withDob: {
        count: withDob,
        pct:
          totalForCompleteness > 0
            ? Math.round((withDob / totalForCompleteness) * 100)
            : 0,
      },
      withDod: {
        count: withDod,
        pct:
          totalForCompleteness > 0
            ? Math.round((withDod / totalForCompleteness) * 100)
            : 0,
      },
      withGender: {
        count: withGender,
        pct:
          totalForCompleteness > 0
            ? Math.round((withGender / totalForCompleteness) * 100)
            : 0,
      },
      withParents: {
        count: withParents,
        pct:
          totalForCompleteness > 0
            ? Math.round((withParents / totalForCompleteness) * 100)
            : 0,
      },
      withSpouse: {
        count: withSpouse,
        pct:
          totalForCompleteness > 0
            ? Math.round((withSpouse / totalForCompleteness) * 100)
            : 0,
      },
    },
  });
}
