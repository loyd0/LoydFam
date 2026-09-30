import { isPlainObject } from "@/lib/permissions";

export const PERSON_PATCH_KEYS = [
  "givenName1", "givenName2", "givenName3", "surname", "knownAs", "preferredName",
  "birthName", "gender", "residencyText", "biographyMd", "biographyShortMd",
  "legacyGeneration", "generationFromWilliam",
] as const;
export type PersonPatchKey = (typeof PERSON_PATCH_KEYS)[number];
export type ValidPersonPatch = {
  givenName1?: string | null; givenName2?: string | null; givenName3?: string | null;
  surname?: string | null; knownAs?: string | null; preferredName?: string | null;
  birthName?: string | null; gender?: "MALE" | "FEMALE" | "UNKNOWN";
  residencyText?: string | null; biographyMd?: string | null; biographyShortMd?: string | null;
  legacyGeneration?: number | null; generationFromWilliam?: number | null;
};

const NAME_FIELDS = new Set<PersonPatchKey>([
  "givenName1", "givenName2", "givenName3", "surname", "knownAs", "preferredName", "birthName",
]);
const LONG_TEXT_FIELDS = new Set<PersonPatchKey>(["residencyText", "biographyMd", "biographyShortMd"]);
const NUMBER_FIELDS = new Set<PersonPatchKey>(["legacyGeneration", "generationFromWilliam"]);

export function parsePersonPatch(input: unknown, allowEmpty = false): ValidPersonPatch | null {
  if (!isPlainObject(input)) return null;
  const entries = Object.entries(input).filter(([, value]) => value !== undefined);
  if (!entries.length && !allowEmpty) return null;
  const result: Record<string, unknown> = {};
  for (const [rawKey, value] of entries) {
    if (!(PERSON_PATCH_KEYS as readonly string[]).includes(rawKey)) return null;
    const key = rawKey as PersonPatchKey;
    if (key === "gender" && value !== "MALE" && value !== "FEMALE" && value !== "UNKNOWN") return null;
    if (value !== null) {
      if (NAME_FIELDS.has(key) && (typeof value !== "string" || value.length > 300)) return null;
      if (LONG_TEXT_FIELDS.has(key) && (typeof value !== "string" || value.length > 50000)) return null;
      if (NUMBER_FIELDS.has(key) && (!Number.isInteger(value) || (value as number) < -100 || (value as number) > 1000)) return null;
    }
    result[key] = value;
  }
  return result as ValidPersonPatch;
}

export function displayNameFor(person: {
  givenName1?: string | null; givenName2?: string | null; givenName3?: string | null;
  surname?: string | null; knownAs?: string | null;
}): string {
  const parts = [person.givenName1, person.givenName2, person.givenName3, person.surname]
    .filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
    .map((part) => part.trim());
  return parts.join(" ") || person.knownAs?.trim() || "Unnamed";
}

export function parseAmendmentNote(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 2000
    ? value.trim() : null;
}
