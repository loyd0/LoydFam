export interface ParentEdge { parentId: string; childId: string }

export interface NormalizedEventDateFields {
  dateExact: string | null;
  dateYear: number | null;
  dateMonth: number | null;
  dateDay: number | null;
}

const EVENT_TYPES = new Set(["BIRTH", "DEATH", "MARRIAGE", "RESIDENCE", "OTHER"]);
const PARENT_TYPES = new Set(["BIOLOGICAL", "STEP", "ADOPTIVE", "UNKNOWN"]);

export function assertValidEvent(input: {
  type: string;
  dateExact?: string | null;
  dateYear?: number | null;
  dateMonth?: number | null;
  dateDay?: number | null;
}): void {
  if (!EVENT_TYPES.has(input.type)) throw new Error("Choose a valid event type.");
  const { dateExact } = input;
  let exactParts: { year: number; month: number; day: number } | undefined;
  if (dateExact != null && dateExact !== "") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateExact);
    if (!match) throw new Error("Enter the exact date as YYYY-MM-DD.");
    const [, y, m, d] = match;
    if (Number(y) < 1) throw new Error("Enter a year from 0001 to 9999.");
    const parsed = new Date(`${dateExact}T00:00:00.000Z`);
    if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== dateExact) throw new Error("Enter a real calendar date.");
    exactParts = { year: Number(y), month: Number(m), day: Number(d) };
  }

  const year = assertIntegerInRange(input.dateYear, 1, 9999, "Year");
  const month = assertIntegerInRange(input.dateMonth, 1, 12, "Month");
  const day = assertIntegerInRange(input.dateDay, 1, 31, "Day");
  if (day != null && (year == null || month == null)) throw new Error("Enter a year and month when specifying a day.");
  if (month != null && year == null) throw new Error("Enter a year when specifying a month.");
  if (year != null && month != null && day != null) {
    const parsed = new Date(0);
    parsed.setUTCHours(0, 0, 0, 0);
    parsed.setUTCFullYear(year, month - 1, day);
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
      throw new Error("Enter a real calendar date.");
    }
  }
  if (exactParts && [year, month, day].some((part, index) => part != null && part !== [exactParts.year, exactParts.month, exactParts.day][index])) {
    throw new Error("The exact date and year, month, and day must agree.");
  }
}

/** Keep the searchable date parts populated when a precise date is supplied. */
export function normalizeEventDateFields(input: {
  type: string;
  dateExact?: string | null;
  dateYear?: number | null;
  dateMonth?: number | null;
  dateDay?: number | null;
}): NormalizedEventDateFields {
  assertValidEvent(input);
  const exactParts = input.dateExact ? input.dateExact.split("-").map(Number) : [];
  const [exactYear, exactMonth, exactDay] = exactParts;
  return {
    dateExact: input.dateExact || null,
    dateYear: input.dateYear ?? exactYear ?? null,
    dateMonth: input.dateMonth ?? exactMonth ?? null,
    dateDay: input.dateDay ?? exactDay ?? null,
  };
}

function assertIntegerInRange(value: number | null | undefined, min: number, max: number, label: string): number | null {
  if (value == null) return null;
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  return value;
}

export function assertValidParentType(type: string): asserts type is "BIOLOGICAL" | "STEP" | "ADOPTIVE" | "UNKNOWN" {
  if (!PARENT_TYPES.has(type)) throw new Error("Choose a valid parent relationship type.");
}

/** Returns true when adding parent -> child would close a directed cycle. */
export function wouldCreateParentCycle(edges: ParentEdge[], parentId: string, childId: string): boolean {
  if (parentId === childId) return true;
  const children = new Map<string, string[]>();
  for (const edge of edges) {
    const values = children.get(edge.parentId) ?? [];
    values.push(edge.childId);
    children.set(edge.parentId, values);
  }
  const pending = [childId];
  const visited = new Set<string>();
  while (pending.length) {
    const current = pending.pop()!;
    if (current === parentId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...(children.get(current) ?? []));
  }
  return false;
}
