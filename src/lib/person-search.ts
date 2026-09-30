export interface PersonSearchItem {
  id: string;
  displayName: string;
  surname: string | null;
  gender: string;
  generation: number | null;
  birthYear: number | null;
  deathYear: number | null;
  externalId: string | null;
  sourceSystem: string | null;
  numberSystem: string | null;
  branch: string | null;
}

export function parsePersonSearchQuery(query: string): { text: string; familyNumber: string | null; sourceSystem: string | null } {
  const text = query.trim();
  const prefixed = /^(LOYD|GIRLS)\s*[:#-]?\s*([A-Z0-9-]*\d[A-Z0-9-]*|[A-Z0-9]+)$/i.exec(text);
  if (prefixed) return { text, familyNumber: prefixed[2], sourceSystem: prefixed[1].toUpperCase() };
  const plainNumber = /^#?(-?\d+|[A-Z0-9-]*\d[A-Z0-9-]*)$/i.exec(text);
  if (plainNumber) return { text, familyNumber: plainNumber[1], sourceSystem: null };
  return { text, familyNumber: null, sourceSystem: null };
}

/** Match names, aliases supplied by the caller, and exact legacy family numbers. */
export function personMatchesQuery(person: PersonSearchItem, query: string): boolean {
  const parsed = parsePersonSearchQuery(query);
  const q = parsed.text.toLocaleLowerCase();
  if (!q) return false;
  const externalId = person.externalId?.toLocaleLowerCase() ?? "";
  const familyNumberMatch = parsed.familyNumber !== null && externalId === parsed.familyNumber && (!parsed.sourceSystem || person.numberSystem?.toUpperCase() === parsed.sourceSystem);
  if (familyNumberMatch) return true;
  if (q.length < 2) return false;
  return [person.displayName, person.surname, person.branch, person.externalId]
    .some((value) => value?.toLocaleLowerCase().includes(q));
}

export function comparePersonSearchResults(a: PersonSearchItem, b: PersonSearchItem, query: string): number {
  const q = query.trim().toLocaleLowerCase().replace(/^(loyd|girls)\s*[:#-]?\s*/i, "").replace(/^#/, "").trim();
  const rank = (person: PersonSearchItem) => {
    if (person.externalId?.toLocaleLowerCase() === q) return 0;
    const name = person.displayName.toLocaleLowerCase();
    if (name === q) return 1;
    if (name.startsWith(q)) return 2;
    return 3;
  };
  return rank(a) - rank(b) || a.displayName.localeCompare(b.displayName) || (a.externalId ?? "").localeCompare(b.externalId ?? "");
}

export function personSearchLabel(person: PersonSearchItem): string {
  const years = person.birthYear || person.deathYear
    ? `${person.birthYear ?? "?"}–${person.deathYear ?? ""}`
    : "Dates unknown";
  const branch = person.branch ? ` · ${person.branch}` : "";
  const number = person.externalId
    ? ` · ${person.numberSystem ?? person.sourceSystem ?? "Family"} #${person.externalId}`
    : "";
  return `${years}${number}${branch}`;
}
