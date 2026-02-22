/**
 * Shared Loyd-lineage filter helpers.
 * Used by API routes to restrict queries to the "Loyd Only" view mode.
 */

// Surnames that are definitively Loyd lineage (guard the DB side from SQL injection via enum)
export const LOYD_SURNAMES = [
  "LOYD",
  "LLOYD",
  "LOYD-DAVIES",
  "LOYD DAVIES",
  "CORMACK-LOYD",
  "LOYD (CHARLTON)",
] as const;

/**
 * Returns a Prisma where fragment that restricts results to Loyd-lineage people.
 * Combine with other AND clauses as needed.
 */
export function loydOnlyWhere() {
  return {
    OR: [
      { primaryExternalKey: { startsWith: "LOYD:" } },
      { surname: { in: LOYD_SURNAMES as unknown as string[] } },
    ],
  };
}

/**
 * SQL fragment (raw string) for use in $queryRaw calls.
 * Assumes the people table is aliased as `p`.
 */
export const LOYD_ONLY_SQL = `(p."primaryExternalKey" LIKE 'LOYD:%' OR p.surname IN ('LOYD','LLOYD','LOYD-DAVIES','LOYD DAVIES','CORMACK-LOYD','LOYD (CHARLTON)'))`;

/**
 * Same as LOYD_ONLY_SQL but for tables aliased differently.
 * @param alias - table alias (default: "p")
 */
export function loydOnlySql(alias = "p") {
  return `(${alias}."primaryExternalKey" LIKE 'LOYD:%' OR ${alias}.surname IN ('LOYD','LLOYD','LOYD-DAVIES','LOYD DAVIES','CORMACK-LOYD','LOYD (CHARLTON)'))`;
}

/**
 * Parses the loydOnly query param from a URL.
 */
export function parseLoydOnly(searchParams: URLSearchParams): boolean {
  return searchParams.get("loydOnly") === "true";
}
