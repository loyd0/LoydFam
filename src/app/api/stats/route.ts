import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseLoydOnly } from "@/lib/loyd-filter";
import { coverage, summarizeValues, weightedMean } from "@/lib/stats-analytics";
import { apiPermissionError } from "@/lib/permission-guards";

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
  const denied = await apiPermissionError("stats.view", session.user);
  if (denied) return denied;

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
    namesByGeneration,
    branchSummaries,
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
      WHERE p."isPlaceholder" = false
        ${lSqlP}
        AND NOT EXISTS (
          SELECT 1 FROM person_events pd
          JOIN events ed ON ed.id = pd."eventId" AND ed.type = 'DEATH'
          WHERE pd."personId" = p.id
        )
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
      WITH birth_years AS (
        SELECT pe."personId", MIN(e."dateYear") as year
        FROM person_events pe JOIN events e ON e.id=pe."eventId"
        WHERE e.type='BIRTH' AND e."dateYear" IS NOT NULL GROUP BY pe."personId"
      )
      SELECT (b.year / 10 * 10) as decade, COUNT(*)::bigint as count
      FROM birth_years b JOIN people p ON p.id=b."personId" AND p."isPlaceholder"=false
      WHERE true ${lSqlP}
      GROUP BY decade ORDER BY decade
    `),

    // ─── Births by month (seasonality) ────────────────────────────────────────
    prisma.$queryRawUnsafe<{ month: number; count: bigint }[]>(`
      WITH birth_months AS (
        SELECT pe."personId", MIN(e."dateMonth") as month
        FROM person_events pe JOIN events e ON e.id=pe."eventId"
        WHERE e.type='BIRTH' AND e."dateMonth" IS NOT NULL GROUP BY pe."personId"
      )
      SELECT b.month, COUNT(*)::bigint as count
      FROM birth_months b JOIN people p ON p.id=b."personId" AND p."isPlaceholder"=false
      WHERE true ${lSqlP}
      GROUP BY month ORDER BY month
    `),

    // ─── Lifespan data (all) ──────────────────────────────────────────────────
    prisma.$queryRawUnsafe<{ lifespan: number; displayName: string }[]>(`
      WITH birth_years AS (
        SELECT pe."personId", MIN(e."dateYear") as year
        FROM person_events pe JOIN events e ON e.id = pe."eventId"
        WHERE e.type = 'BIRTH' AND e."dateYear" IS NOT NULL GROUP BY pe."personId"
      ), death_years AS (
        SELECT pe."personId", MIN(e."dateYear") as year
        FROM person_events pe JOIN events e ON e.id = pe."eventId"
        WHERE e.type = 'DEATH' AND e."dateYear" IS NOT NULL GROUP BY pe."personId"
      )
      SELECT (d.year - b.year) as lifespan, p."displayName"
      FROM people p
      INNER JOIN birth_years b ON b."personId" = p.id
      INNER JOIN death_years d ON d."personId" = p.id
      WHERE p."isPlaceholder" = false ${lSqlP} AND (d.year - b.year) BETWEEN 0 AND 130
      ORDER BY lifespan DESC
    `),

    // ─── Lifespan by gender ───────────────────────────────────────────────────
    prisma.$queryRawUnsafe<{ gender: string; avg_lifespan: number; median_lifespan: number; count: bigint }[]>(`
      WITH birth_years AS (
        SELECT pe."personId", MIN(e."dateYear") as year FROM person_events pe JOIN events e ON e.id=pe."eventId" WHERE e.type='BIRTH' AND e."dateYear" IS NOT NULL GROUP BY pe."personId"
      ), death_years AS (
        SELECT pe."personId", MIN(e."dateYear") as year FROM person_events pe JOIN events e ON e.id=pe."eventId" WHERE e.type='DEATH' AND e."dateYear" IS NOT NULL GROUP BY pe."personId"
      )
      SELECT p.gender, ROUND(AVG(d.year-b.year))::int as avg_lifespan,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (d.year-b.year))::int as median_lifespan,
        COUNT(*)::bigint as count
      FROM people p
      INNER JOIN birth_years b ON b."personId"=p.id INNER JOIN death_years d ON d."personId"=p.id
      WHERE p."isPlaceholder" = false ${lSqlP}
        AND (d.year-b.year) BETWEEN 0 AND 130
        AND p.gender != 'UNKNOWN'
      GROUP BY p.gender
    `),

    // ─── Age at death distribution (10-year buckets) ──────────────────────────
    prisma.$queryRawUnsafe<{ bucket: number; count: bigint }[]>(`
      WITH birth_years AS (
        SELECT pe."personId", MIN(e."dateYear") as year FROM person_events pe JOIN events e ON e.id=pe."eventId" WHERE e.type='BIRTH' AND e."dateYear" IS NOT NULL GROUP BY pe."personId"
      ), death_years AS (
        SELECT pe."personId", MIN(e."dateYear") as year FROM person_events pe JOIN events e ON e.id=pe."eventId" WHERE e.type='DEATH' AND e."dateYear" IS NOT NULL GROUP BY pe."personId"
      )
      SELECT
        ((d.year - b.year) / 10 * 10) as bucket,
        COUNT(DISTINCT p.id)::bigint as count
      FROM people p
      INNER JOIN birth_years b ON b."personId"=p.id INNER JOIN death_years d ON d."personId"=p.id
      WHERE p."isPlaceholder" = false ${lSqlP} AND (d.year-b.year) BETWEEN 0 AND 120
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

    prisma.$queryRawUnsafe<{ generation: number; name: string; count: bigint }[]>(`
      WITH name_counts AS (
        SELECT COALESCE("legacyGeneration", "generationFromWilliam") as generation,
          "givenName1" as name, COUNT(*)::bigint as count
        FROM people
        WHERE "isPlaceholder" = false ${lSqlBare}
          AND "givenName1" IS NOT NULL AND "givenName1" != ''
          AND COALESCE("legacyGeneration", "generationFromWilliam") IS NOT NULL
        GROUP BY generation, name
      ), ranked AS (
        SELECT generation, name, count,
          ROW_NUMBER() OVER (PARTITION BY generation ORDER BY count DESC, name) as rank
        FROM name_counts
      )
      SELECT generation, name, count FROM ranked WHERE rank <= 3
      ORDER BY generation, rank
    `),

    prisma.$queryRawUnsafe<{ branch: string | null; members: bigint; with_birth_year: bigint; with_death_record: bigint; generations: bigint }[]>(`
      SELECT p."branchRootExternalId" as branch,
        COUNT(*)::bigint as members,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM person_events pe JOIN events e ON e.id=pe."eventId"
          WHERE pe."personId"=p.id AND e.type='BIRTH' AND e."dateYear" IS NOT NULL
        ))::bigint as with_birth_year,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM person_events pe JOIN events e ON e.id=pe."eventId"
          WHERE pe."personId"=p.id AND e.type='DEATH'
        ))::bigint as with_death_record,
        COUNT(DISTINCT COALESCE(p."legacyGeneration", p."generationFromWilliam"))::bigint as generations
      FROM people p
      WHERE p."isPlaceholder"=false ${lSqlP}
      GROUP BY p."branchRootExternalId"
      ORDER BY members DESC, p."branchRootExternalId" ASC NULLS LAST
      LIMIT 12
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

    // ─── Recorded children per parent ────────────────────────────────────────
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
      WITH birth_years AS (
        SELECT pe."personId", MIN(e."dateYear") as year FROM person_events pe JOIN events e ON e.id=pe."eventId" WHERE e.type='BIRTH' AND e."dateYear" IS NOT NULL GROUP BY pe."personId"
      ), death_years AS (
        SELECT pe."personId", MIN(e."dateYear") as year FROM person_events pe JOIN events e ON e.id=pe."eventId" WHERE e.type='DEATH' AND e."dateYear" IS NOT NULL GROUP BY pe."personId"
      )
      SELECT
        COALESCE(p."legacyGeneration", p."generationFromWilliam") as generation,
        ROUND(AVG(d.year - b.year))::int as avg_lifespan,
        COUNT(*)::bigint as count
      FROM people p
      INNER JOIN birth_years b ON b."personId" = p.id
      INNER JOIN death_years d ON d."personId" = p.id
      WHERE p."isPlaceholder" = false ${lSqlP}
        AND (d.year - b.year) BETWEEN 0 AND 130
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
      WHERE p."isPlaceholder" = false ${lSqlP}
        AND NOT EXISTS (
          SELECT 1 FROM person_events ped
          JOIN events ed ON ed.id = ped."eventId" AND ed.type = 'DEATH'
          WHERE ped."personId" = p.id
        )
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
  const lifespanSummary = summarizeValues(lifespans);

  // ─── Recorded children per parent stats ───────────────────────────────────
  const totalParentsWithChildren = childrenPerCouple.reduce(
    (s, r) => s + Number(r.count),
    0
  );
  const childrenSummary = weightedMean(
    childrenPerCouple,
    (row) => row.children,
    (row) => Number(row.count),
  );

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
      average: lifespanSummary.average,
      median: lifespanSummary.median,
      sampleSize: lifespanSummary.count,
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
    namesByGeneration: namesByGeneration.map((row) => ({
      generation: row.generation,
      name: row.name,
      count: Number(row.count),
    })),
    branches: (() => {
      let branchIndex = 0;
      return branchSummaries.map((row) => ({
        // Keep imported root identifiers out of the response; rank the named groups by size.
        label: row.branch ? `Branch ${++branchIndex}` : "Unassigned",
        members: Number(row.members),
        withBirthYear: Number(row.with_birth_year),
        withDeathRecord: Number(row.with_death_record),
        generations: Number(row.generations),
      }));
    })(),

    // ── Family structure ──────────────────────────────────────────────────────
    familyStructure: {
      avgChildrenPerParent: childrenSummary.average,
      totalParentsWithChildren,
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
        ...coverage(withDob, totalForCompleteness),
      },
      withDod: {
        ...coverage(withDod, totalForCompleteness),
      },
      withGender: {
        ...coverage(withGender, totalForCompleteness),
      },
      withParents: {
        ...coverage(withParents, totalForCompleteness),
      },
      withSpouse: {
        ...coverage(withSpouse, totalForCompleteness),
      },
    },
  });
}
