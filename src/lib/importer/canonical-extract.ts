/**
 * Canonical extraction – transforms raw sheet rows into Prisma-ready
 * upsert payloads for Person, Event, ParentChild, Partnership, Contact, etc.
 *
 * Sheet-specific mapping functions follow the rules in BUILD.md §3.
 */

import type { SheetData } from "./parse-workbook";

// ─── Types for canonical payloads ─────────────────────────────

export interface PersonPayload {
  primaryExternalKey: string;
  sourceSystem: string;
  externalId: string;
  surname: string | null;
  givenName1: string | null;
  givenName2: string | null;
  givenName3: string | null;
  knownAs: string | null;
  preferredName: string | null;
  displayName: string;
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  isPlaceholder: boolean;
  biographyMd: string | null;
  biographyShortMd: string | null;
  residencyText: string | null;
  dspFlag: boolean | null;
  expectedPhotoCount: number | null;
  legacyGeneration: number | null;
  generationFromWilliam: number | null;
  descendantGeneration: string | null;
  lengthMetric: string | null;
  rawNameString: string | null;
  branchRootExternalId: string | null;
}

export interface EventPayload {
  /** Deterministic key for upsert: "<personKey>:<type>" */
  key: string;
  type: "BIRTH" | "DEATH" | "MARRIAGE" | "RESIDENCE" | "OTHER";
  dateExact: Date | null;
  dateYear: number | null;
  dateMonth: number | null;
  dateDay: number | null;
  dateText: string | null;
  dateIsApprox: boolean;
  personKey: string;
  role: string;
}

export interface ParentChildPayload {
  parentKey: string;
  childKey: string;
  type: "BIOLOGICAL" | "STEP" | "ADOPTIVE" | "UNKNOWN";
}

export interface PartnershipPayload {
  personAKey: string;
  personBKey: string;
  type: "MARRIAGE" | "PARTNER" | "UNKNOWN";
  notesMd: string | null;
}

export interface ContactPayload {
  personKey: string;
  emails: string[];
  mobile: string | null;
  landline: string | null;
  address2000: string | null;
  postalAddress2021: string | null;
  establishingContact: string | null;
  comments: string | null;
  ageCurrentExcel: number | null;
  numberOfKids2000: number | null;
}

export interface CanonicalData {
  people: PersonPayload[];
  events: EventPayload[];
  parentChild: ParentChildPayload[];
  partnerships: PartnershipPayload[];
  contacts: ContactPayload[];
}

// ─── Helpers ──────────────────────────────────────────────────

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" || s === "0" || s === " - " || s === "-" ? null : s;
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function mapGender(v: unknown): "MALE" | "FEMALE" | "UNKNOWN" {
  const s = String(v ?? "").toLowerCase().trim();
  if (s === "boy" || s === "male" || s === "m") return "MALE";
  if (s === "girl" || s === "female" || s === "f") return "FEMALE";
  return "UNKNOWN";
}

// ─── Name-based gender inference ─────────────────────────────
// Used as a fallback when the Sex/Male/Female column is blank.
// Only includes names where the gender is strongly unambiguous.

const MALE_NAMES = new Set([
  // Common English male names
  "aaron","adam","alan","albert","alex","alexander","alfred","andrew","anthony","arnold",
  "arthur","barry","ben","benjamin","bernard","bill","bob","brad","bradley","brendan",
  "brian","bruce","callum","cameron","carl","charles","charlie","chris","christian",
  "christopher","clarence","claude","clive","colin","craig","daniel","david","dean",
  "dennis","derek","desmond","donald","douglas","duncan","edward","eric","ernest",
  "evan","frank","fred","frederick","gary","george","gerald","gordon","graham","grant",
  "gregory","harold","harry","henry","herbert","howard","hugh","ian","jack","jacob",
  "james","jason","jeffrey","jeremy","jim","joe","joel","john","jonathan","joseph",
  "joshua","julian","justin","keith","kenneth","kevin","kyle","larry","lawrence",
  "liam","luke","malcolm","mark","martin","matthew","michael","neil","nicholas","nigel",
  "noah","norman","oliver","oscar","patrick","paul","peter","philip","raymond","richard",
  "robert","roger","ronald","ross","roy","ryan","samuel","scott","sean","simon","stanley",
  "stephen","steven","stuart","terry","thomas","timothy","tom","tony","trevor","victor",
  "vincent","walter","warren","william","willie",
  // Irish / Celtic male names common in Loyd family context
  "brendan","cian","ciaran","colm","conor","declan","dermot","donal","eamonn","emmett",
  "fergus","fintan","frank","joe","kieran","lorcan","niall","oisin","padraig","ronan",
  "rory","seamus","shane","tadhg",
  // Extra from genealogy context
  "augustus","chester","clarence","clyde","edgar","elijah","elmer","floyd","floyd",
  "gilbert","glen","harvey","herman","horace","irving","ivan","jerome","lester","lloyd",
  "melvin","merv","mervin","mervyn","mortimer","murray","neville","orville","ossian",
  "percival","percy","ralph","randolph","raymond","reginald","rupert","russell","sydney",
  "theo","theodore","vincent","wilfred","willis","winfield",
]);

const FEMALE_NAMES = new Set([
  // Common English female names
  "abigail","ada","adelaide","agnes","alice","alison","amanda","amber","amelia","amy",
  "andrea","angela","ann","anna","anne","annette","april","audrey","barbara","beatrice",
  "betty","beverley","beverly","brenda","bridget","caitlin","carol","caroline","carolyn",
  "catherine","charlotte","cheryl","chloe","christine","claire","claudia","colleen",
  "constance","cynthia","daisy","dawn","deborah","denise","diana","donna","doris",
  "dorothy","edith","eleanor","eliza","elizabeth","ella","ellen","emily","emma","esther",
  "ethel","eve","evelyn","fiona","florence","frances","gabrielle","gemma","gertrude",
  "gillian","grace","hannah","harriet","hazel","heather","helen","hilary","holly","ida",
  "irene","iris","isabella","jacqueline","jane","janet","jean","jennifer","jessica",
  "joan","joanne","joanna","josephine","joyce","judith","julia","june","karen","kate",
  "kathleen","katie","kathryn","laura","leah","lillian","lisa","lorraine","louisa",
  "louise","lucy","lynne","margaret","maria","mary","maureen","megan","melanie",
  "molly","muriel","nancy","naomi","nora","norma","olivia","pamela","patricia",
  "pauline","pearl","penelope","rachel","rebecca","rosemary","ruth","sally","sandra",
  "sarah","sharon","sheila","shirley","sophie","stella","stephanie","susan","sylvia",
  "teresa","theresa","tina","tracy","valerie","vera","veronica","victoria","violet",
  "virginia","wendy","winifred","yvonne",
  // Irish / Celtic female names
  "aoife","brigid","caoimhe","ciara","deirdre","eimear","eileen","fionnuala","grainne",
  "mairead","maeve","muireann","niamh","orla","roisin","seona","siobhan","sorcha",
  // Extra from genealogy context
  "adeline","agatha","bernadette","blanche","celeste","clementine","delia","edna",
  "elspeth","euphemia","eugenia","evangeline","gwendoline","honora","hortense","isadora",
  "letitia","lois","lottie","mabel","madeleine","madge","mavis","minnie","mabel","myra",
  "nellie","nettie","octavia","olive","opal","prudence","queenie","rosalie","rowena",
  "ruby","thelma","thomasina","wilhelmina","winnie","zelda",
]);

/**
 * Infer gender from a person's given first name.
 * Returns UNKNOWN if the name is not in either list, or is in both (genuinely ambiguous).
 */
function inferGenderFromName(givenName1: string | null): "MALE" | "FEMALE" | "UNKNOWN" {
  if (!givenName1) return "UNKNOWN";
  // Take only the first word (e.g. "Mary Jane" → "Mary")
  const firstName = givenName1.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, "");
  if (!firstName) return "UNKNOWN";
  const isMale = MALE_NAMES.has(firstName);
  const isFemale = FEMALE_NAMES.has(firstName);
  if (isMale && !isFemale) return "MALE";
  if (isFemale && !isMale) return "FEMALE";
  return "UNKNOWN"; // truly ambiguous (e.g. "Vivian", "Leslie", "Kim")
}

/**
 * Resolve gender: prefer explicit column value, fall back to name inference.
 */
function resolveGender(
  rawGenderCol: unknown,
  givenName1: string | null
): "MALE" | "FEMALE" | "UNKNOWN" {
  const explicit = mapGender(rawGenderCol);
  if (explicit !== "UNKNOWN") return explicit;
  return inferGenderFromName(givenName1);
}

/** Valid year range for genealogical data */
const MIN_YEAR = 1500;
const MAX_YEAR = 2100;

function isValidYear(y: number): boolean {
  return Number.isInteger(y) && y >= MIN_YEAR && y <= MAX_YEAR;
}

/**
 * Convert an Excel serial date number to a JS Date.
 * Excel epoch is 1900-01-01 (serial = 1), but Excel incorrectly treats
 * 1900 as a leap year, so serials >= 60 need a -1 day adjustment.
 */
function excelSerialToDate(serial: number): Date {
  // Excel epoch: 1899-12-30 (because serial 1 = Jan 1, 1900 and the leap-year bug)
  const epoch = Date.UTC(1899, 11, 30); // 1899-12-30
  const msPerDay = 86_400_000;
  return new Date(epoch + serial * msPerDay);
}

/**
 * Parse a date value from the Excel workbook.
 * Handles:
 *  - Excel serial date numbers (e.g. 44854 → 2022-10-19)
 *  - DD/MM/YYYY strings
 *  - MM/DD/YYYY strings (only when month > 12 makes DD/MM impossible)
 *  - YYYY-MM-DD (ISO) strings
 *  - Year-only values (e.g. "1842", "c1900")
 *  - Approximate markers: c, ~, ?
 */
function parseDate(v: unknown): {
  exact: Date | null;
  year: number | null;
  month: number | null;
  day: number | null;
  text: string | null;
  isApprox: boolean;
} {
  const empty = { exact: null, year: null, month: null, day: null, text: null, isApprox: false };
  if (v == null) return empty;

  // Handle Excel serial dates (numbers from the XLSX library)
  if (typeof v === "number" && v > 1 && v < 200_000) {
    // This is almost certainly an Excel serial date
    const d = excelSerialToDate(v);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    if (isValidYear(year)) {
      return { exact: d, year, month, day, text: `${day}/${month}/${year}`, isApprox: false };
    }
    // If out of range, treat as unknown
    return { ...empty, text: String(v) };
  }

  const raw = String(v).trim();
  const lowerRaw = raw.toLowerCase();
  if (!raw || raw === "0" || raw === " - " || raw === "-" || lowerRaw === "unknown" || lowerRaw === "date unknown" || lowerRaw === "not known") {
    return { ...empty, text: null };
  }

  // Check for approximate date markers
  const isApprox = /^[c~]|[?]/.test(raw);
  // Strip leading c/~ for parsing
  const cleaned = raw.replace(/^[c~]+\s*/, "").replace(/[?]+$/, "").trim();

  // If the cleaned value is a large number (Excel serial as string), parse it
  const asNum = Number(cleaned);
  if (!isNaN(asNum) && asNum > 2200 && asNum < 200_000) {
    const d = excelSerialToDate(asNum);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    if (isValidYear(year)) {
      return { exact: d, year, month, day, text: raw, isApprox };
    }
    return { ...empty, text: raw, isApprox };
  }

  // Try DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = cleaned.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10);
    const month = parseInt(ddmmyyyy[2], 10);
    const year = parseInt(ddmmyyyy[3], 10);
    if (isValidYear(year) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const exact = new Date(Date.UTC(year, month - 1, day));
      return { exact, year, month, day, text: raw, isApprox };
    }
  }

  // Try YYYY-MM-DD (ISO format)
  const iso = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const year = parseInt(iso[1], 10);
    const month = parseInt(iso[2], 10);
    const day = parseInt(iso[3], 10);
    if (isValidYear(year) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const exact = new Date(Date.UTC(year, month - 1, day));
      return { exact, year, month, day, text: raw, isApprox };
    }
  }

  // Try just a year (4-digit)
  const yearOnly = cleaned.match(/^(\d{4})$/);
  if (yearOnly) {
    const year = parseInt(yearOnly[1], 10);
    if (isValidYear(year)) {
      return { exact: null, year, month: null, day: null, text: raw, isApprox: isApprox || raw.startsWith("c") };
    }
  }

  // Try YYYY/YY or YYYY/YYYY year range — take first year
  const yearRange = cleaned.match(/^(\d{4})\/\d{2,4}$/);
  if (yearRange) {
    const year = parseInt(yearRange[1], 10);
    if (isValidYear(year)) {
      return { exact: null, year, month: null, day: null, text: raw, isApprox: true };
    }
  }

  // Fallback: store as text only (don't guess)
  return { ...empty, text: raw, isApprox };
}

function buildDisplayName(
  givenName1: string | null,
  surname: string | null,
  externalId: string,
  yearBirth: unknown,
  yearDeath: unknown
): string {
  const name = givenName1 || surname || "Unknown";
  const yb = str(yearBirth) ?? "?";
  const yd = str(yearDeath) ?? "?";
  return `${name} (${externalId}): ${yb}–${yd}`;
}

// ─── Sheet extractors ─────────────────────────────────────────

function extractLoydList(sheet: SheetData, result: CanonicalData) {
  for (const row of sheet.rows) {
    const loydNum = row["Loyd ##"];
    if (loydNum == null) continue;

    const externalId = String(loydNum);
    const primaryKey = `LOYD:${externalId}`;

    const surname = str(row["Surname"]);
    const gn1 = str(row["1st Name"]);
    const gn2 = str(row["2nd Name"]);
    const gn3 = str(row["3rd Name"]);
    const knownAs = str(row["Known as"]);
    const gender = resolveGender(row["Sex"], gn1);
    const generation = num(row["Generation"]);
    const rawName = str(row["Name"]) || str(row["Forename (Loyd#) Yr of B"]);

    const person: PersonPayload = {
      primaryExternalKey: primaryKey,
      sourceSystem: "LOYD_BOOK_2022",
      externalId,
      surname,
      givenName1: gn1,
      givenName2: gn2,
      givenName3: gn3,
      knownAs,
      preferredName: knownAs || gn1,
      displayName: rawName || buildDisplayName(gn1, surname, externalId, row["Year of Birth"], row["Year of Death"]),
      gender,
      isPlaceholder: false,
      biographyMd: null,
      biographyShortMd: null,
      residencyText: null,
      dspFlag: null,
      expectedPhotoCount: null,
      legacyGeneration: generation,
      generationFromWilliam: null,
      descendantGeneration: null,
      lengthMetric: null,
      rawNameString: rawName,
      branchRootExternalId: null,
    };

    result.people.push(person);

    // Birth event — prefer DoB (DD/MM/YYYY string) over "Dob Entered" (Excel serial)
    const dobParsed = parseDate(row["DoB"] || row["Dob Entered"]);
    const birthYear = num(row["Year of Birth"]);
    const birthMonth = num(row["BIRTH MONTH"]);
    const birthDay = num(row["BIRTH DAY"]);

    result.events.push({
      key: `${primaryKey}:BIRTH`,
      type: "BIRTH",
      dateExact: dobParsed.exact,
      dateYear: dobParsed.year || birthYear,
      dateMonth: dobParsed.month || birthMonth,
      dateDay: dobParsed.day || birthDay,
      dateText: dobParsed.text,
      dateIsApprox: dobParsed.isApprox,
      personKey: primaryKey,
      role: "subject",
    });

    // Death event
    const dodParsed = parseDate(row["DoD"]);
    const deathYear = num(row["Year of Death"]);
    const deathMonth = num(row["DEATH MONTH"]);
    const deathDay = num(row["DEATH DAY"]);
    // Guard: reject obviously wrong death years (Excel artifacts like 1900)
    const validDeathYear = deathYear && isValidYear(deathYear) ? deathYear : null;

    if (validDeathYear || dodParsed.exact || dodParsed.year) {
      result.events.push({
        key: `${primaryKey}:DEATH`,
        type: "DEATH",
        dateExact: dodParsed.exact,
        dateYear: dodParsed.year || validDeathYear,
        dateMonth: dodParsed.month || deathMonth,
        dateDay: dodParsed.day || deathDay,
        dateText: dodParsed.text,
        dateIsApprox: dodParsed.isApprox,
        personKey: primaryKey,
        role: "subject",
      });
    }

    // Marriage event
    const domParsed = parseDate(row["DoM "]);
    if (domParsed.exact || domParsed.text) {
      result.events.push({
        key: `${primaryKey}:MARRIAGE`,
        type: "MARRIAGE",
        dateExact: domParsed.exact,
        dateYear: domParsed.year,
        dateMonth: domParsed.month,
        dateDay: domParsed.day,
        dateText: domParsed.text,
        dateIsApprox: domParsed.isApprox,
        personKey: primaryKey,
        role: "subject",
      });
    }

    // Parent-child: father
    const fatherLoyd = row["Father's Loyd #"];
    if (fatherLoyd != null && fatherLoyd !== "" && !isNaN(Number(fatherLoyd))) {
      result.parentChild.push({
        parentKey: `LOYD:${fatherLoyd}`,
        childKey: primaryKey,
        type: "BIOLOGICAL",
      });
    }

    // Parent-child: mother (via Mothers' Loyd # which is like "1_W" — meaning spouse of Loyd #1)
    // We don't create the mother person here — she comes from the bios or is a placeholder
  }
}

function extractGirlsDescendants(sheet: SheetData, result: CanonicalData) {
  for (const row of sheet.rows) {
    const loydAlpha = row["Loyd ##"];
    if (loydAlpha == null) continue;

    const externalId = String(loydAlpha);
    // Skip rows that look like pivot table data (no real identifier)
    if (!externalId || externalId === "undefined") continue;

    const primaryKey = `GIRLS:${externalId}`;
    const surname = str(row["Surname"]);
    const gn1 = str(row["1st Name"]);
    const gn2 = str(row["2nd Name"]);
    const gn3 = str(row["3rd Name"]);
    const knownAs = str(row["Known as"]);
    const gender = resolveGender(row["Male/Female"], gn1);
    const genFromWilliam = num(row["Generation from William (#1)"]);
    const descGen = str(row["Loyd Descendant Generation"]);
    const lengthMetric = str(row["Length"]);
    const rawName = str(row["Birth Name"]) || str(row["Forename (Loyd#) Yr of B"]);
    const additionalInfo = str(row["Additional Information"]);

    const person: PersonPayload = {
      primaryExternalKey: primaryKey,
      sourceSystem: "LOYD_BOOK_2022",
      externalId,
      surname,
      givenName1: gn1,
      givenName2: gn2,
      givenName3: gn3,
      knownAs,
      preferredName: knownAs || gn1,
      displayName: rawName || buildDisplayName(gn1, surname, externalId, row["Year of Birth"], row["Year of Death"]),
      gender,
      isPlaceholder: false,
      biographyMd: additionalInfo,
      biographyShortMd: null,
      residencyText: null,
      dspFlag: null,
      expectedPhotoCount: null,
      legacyGeneration: null,
      generationFromWilliam: genFromWilliam,
      descendantGeneration: descGen,
      lengthMetric,
      rawNameString: rawName,
      branchRootExternalId: str(row["Father's Loyd Loyd #"]),
    };

    result.people.push(person);

    // Birth event — prefer DoB (DD/MM/YYYY string) over "Dob Entered" (Excel serial)
    const dobParsed = parseDate(row["DoB"] || row["Dob Entered"]);
    const birthYear = num(row["Year of Birth"]);

    result.events.push({
      key: `${primaryKey}:BIRTH`,
      type: "BIRTH",
      dateExact: dobParsed.exact,
      dateYear: dobParsed.year || birthYear,
      dateMonth: dobParsed.month,
      dateDay: dobParsed.day,
      dateText: dobParsed.text || (birthYear ? String(birthYear) : null),
      dateIsApprox: dobParsed.isApprox,
      personKey: primaryKey,
      role: "subject",
    });

    // Death event
    const dodParsed = parseDate(row["DoD"] || row["DOD Entered"]);
    const deathYear = num(row["Year of Death"]);
    // 1900 is Excel's formula default when no death date is entered (epoch artifact)
    // Only trust Year of Death if it's != 1900, OR if there is an actual DoD text/date
    const validDeathYear = deathYear && isValidYear(deathYear) && (deathYear !== 1900 || dodParsed.text || dodParsed.exact) ? deathYear : null;

    if (validDeathYear || dodParsed.exact || dodParsed.year) {
      result.events.push({
        key: `${primaryKey}:DEATH`,
        type: "DEATH",
        dateExact: dodParsed.exact,
        dateYear: dodParsed.year || validDeathYear,
        dateMonth: dodParsed.month,
        dateDay: dodParsed.day,
        dateText: dodParsed.text,
        dateIsApprox: dodParsed.isApprox,
        personKey: primaryKey,
        role: "subject",
      });
    }

    // Marriage event
    const domParsed = parseDate(row["DoM "]);
    if (domParsed.exact || domParsed.text) {
      result.events.push({
        key: `${primaryKey}:MARRIAGE`,
        type: "MARRIAGE",
        dateExact: domParsed.exact,
        dateYear: domParsed.year,
        dateMonth: domParsed.month,
        dateDay: domParsed.day,
        dateText: domParsed.text,
        dateIsApprox: domParsed.isApprox,
        personKey: primaryKey,
        role: "subject",
      });
    }

    // Parent-child: from PARENT's Loyd #
    //   Numeric parent (e.g. "107")  → LOYD:{n}  (male Loyd family member)
    //   Alpha-numeric parent (e.g. "18bbabb") → GIRLS:{id} (female descendant)
    const parentLoyd = row["PARENT's Loyd #"];
    if (parentLoyd != null && parentLoyd !== "") {
      const parentStr = String(parentLoyd).trim();
      if (parentStr) {
        const parentKey = !isNaN(Number(parentStr))
          ? `LOYD:${parentStr}`
          : `GIRLS:${parentStr}`;
        result.parentChild.push({
          parentKey,
          childKey: primaryKey,
          type: "BIOLOGICAL",
        });
      }
    }

    // Spouse / partner
    const spouseText = str(row["Husband/WIFE/Partner"]);
    const marriageNotes = str(row["Marriage Notes"]);
    if (spouseText) {
      // Create a placeholder spouse person
      const spouseKey = `SPOUSE:${primaryKey}:1`;
      result.people.push({
        primaryExternalKey: spouseKey,
        sourceSystem: "LOYD_BOOK_2022",
        externalId: spouseKey,
        surname: null,
        givenName1: spouseText.split(" ")[0] || spouseText,
        givenName2: null,
        givenName3: null,
        knownAs: null,
        preferredName: spouseText,
        displayName: spouseText,
        gender: gender === "MALE" ? "FEMALE" : gender === "FEMALE" ? "MALE" : "UNKNOWN",
        isPlaceholder: true,
        biographyMd: null,
        biographyShortMd: null,
        residencyText: null,
        dspFlag: null,
        expectedPhotoCount: null,
        legacyGeneration: null,
        generationFromWilliam: null,
        descendantGeneration: null,
        lengthMetric: null,
        rawNameString: spouseText,
        branchRootExternalId: null,
      });

      result.partnerships.push({
        personAKey: primaryKey,
        personBKey: spouseKey,
        type: "MARRIAGE",
        notesMd: marriageNotes,
      });
    }
  }
}

function extractBiosAndSpouse(sheet: SheetData, result: CanonicalData) {
  for (const row of sheet.rows) {
    const loydNum = row["Loyd #"];
    if (loydNum == null) continue;

    const primaryKey = `LOYD:${loydNum}`;

    // Find existing person and enrich (we just push — run-import will merge)
    const bioFull = str(row["Additional Biographical Information (Full Address)"]);
    const bioShort = str(row["Additional Biographical Information (Short address)"]);
    const countries = str(row["Countries lived in"]);
    const spouseText = str(row["WIFE/HUSBAND"]);
    const marriageNotes = str(row["Marriage Notes"]);

    // Update person with bio/residency (push a partial update marker)
    if (bioFull || bioShort || countries) {
      // We'll find the person in the array and enrich
      const existing = result.people.find((p) => p.primaryExternalKey === primaryKey);
      if (existing) {
        if (bioFull) existing.biographyMd = bioFull;
        if (bioShort) existing.biographyShortMd = bioShort;
        if (countries) existing.residencyText = countries;
      }
    }

    // Spouse (only if not already created via core list)
    if (spouseText) {
      const existingPartnership = result.partnerships.find(
        (p) => p.personAKey === primaryKey || p.personBKey === primaryKey
      );
      if (!existingPartnership) {
        const gender = resolveGender(row["Gender"], spouseText.split("(")[0]?.trim().split(" ")[0] || null);
        const spouseKey = `SPOUSE:${primaryKey}:1`;
        result.people.push({
          primaryExternalKey: spouseKey,
          sourceSystem: "LOYD_BOOK_2022",
          externalId: spouseKey,
          surname: null,
          givenName1: spouseText.split("(")[0]?.trim().split(" ")[0] || spouseText,
          givenName2: null,
          givenName3: null,
          knownAs: null,
          preferredName: spouseText,
          displayName: spouseText,
          gender: gender === "MALE" ? "FEMALE" : gender === "FEMALE" ? "MALE" : "UNKNOWN",
          isPlaceholder: true,
          biographyMd: null,
          biographyShortMd: null,
          residencyText: null,
          dspFlag: null,
          expectedPhotoCount: null,
          legacyGeneration: null,
          generationFromWilliam: null,
          descendantGeneration: null,
          lengthMetric: null,
          rawNameString: spouseText,
          branchRootExternalId: null,
        });

        result.partnerships.push({
          personAKey: primaryKey,
          personBKey: spouseKey,
          type: "MARRIAGE",
          notesMd: marriageNotes,
        });
      } else if (marriageNotes && !existingPartnership.notesMd) {
        existingPartnership.notesMd = marriageNotes;
      }
    }
  }
}

function extractHatchMatch(sheet: SheetData, result: CanonicalData) {
  for (const row of sheet.rows) {
    const loydNum = row["LOYD #"];
    if (loydNum == null) continue;

    const externalId = String(loydNum);
    const primaryKey = `LOYD:${externalId}`;

    // This sheet supplements — only create the person if not already present
    const existing = result.people.find((p) => p.primaryExternalKey === primaryKey);
    if (!existing) {
      // Thomas (-1) and any others not in the main list
      const surname = str(row["Surname"]);
      const gn1 = str(row["1st Name"]);
      const gender = resolveGender(row["Sex"] || row["SEX"], gn1);
      const generation = num(row["GENERATION"]);

      result.people.push({
        primaryExternalKey: primaryKey,
        sourceSystem: "LOYD_BOOK_2022",
        externalId,
        surname,
        givenName1: gn1,
        givenName2: str(row["2nd Name"]),
        givenName3: str(row["3rd Name"]),
        knownAs: str(row["Known as"]) || str(row["KNOWN AS"]),
        preferredName: str(row["Known as"]) || gn1,
        displayName: str(row["KNOWN AS"]) || buildDisplayName(gn1, surname, externalId, row["Year of Birth"], row["Year of Death"]),
        gender,
        isPlaceholder: false,
        biographyMd: null,
        biographyShortMd: null,
        residencyText: null,
        dspFlag: null,
        expectedPhotoCount: null,
        legacyGeneration: generation,
        generationFromWilliam: null,
        descendantGeneration: null,
        lengthMetric: null,
        rawNameString: str(row["Lineage Reference"]),
        branchRootExternalId: null,
      });

      // Birth event for supplementary person
      const dobParsed = parseDate(row["DoB"]);
      const birthYear = num(row["Year of Birth"]);
      result.events.push({
        key: `${primaryKey}:BIRTH`,
        type: "BIRTH",
        dateExact: dobParsed.exact,
        dateYear: dobParsed.year || birthYear,
        dateMonth: dobParsed.month,
        dateDay: dobParsed.day,
        dateText: dobParsed.text || (birthYear ? String(birthYear) : null),
        dateIsApprox: dobParsed.isApprox,
        personKey: primaryKey,
        role: "subject",
      });

      // Death event
      const deathYear = num(row["Year of Death"]);
      if (deathYear) {
        result.events.push({
          key: `${primaryKey}:DEATH`,
          type: "DEATH",
          dateExact: null,
          dateYear: deathYear,
          dateMonth: null,
          dateDay: null,
          dateText: String(deathYear),
          dateIsApprox: false,
          personKey: primaryKey,
          role: "subject",
        });
      }

      // Father link
      const fatherId = row["Father #"];
      if (fatherId != null && fatherId !== "" && fatherId !== "Not Known" && !isNaN(Number(fatherId))) {
        result.parentChild.push({
          parentKey: `LOYD:${fatherId}`,
          childKey: primaryKey,
          type: "BIOLOGICAL",
        });
      }
    }
  }
}

function extractContacts(sheet: SheetData, result: CanonicalData) {
  for (const row of sheet.rows) {
    const loydNum = row["Loyd ##"];
    if (loydNum == null) continue;

    const primaryKey = `LOYD:${loydNum}`;
    const emailRaw = str(row["Email"]);
    const emails = emailRaw ? emailRaw.split(/[;,]/).map((e) => e.trim()).filter(Boolean) : [];

    result.contacts.push({
      personKey: primaryKey,
      emails,
      mobile: str(row["Mobile"]),
      landline: str(row["Landline"]),
      address2000: str(row["2000 Address"]),
      postalAddress2021: str(row["Postal Address in 2021"]),
      establishingContact: str(row["Establishing Contact"]),
      comments: str(row["Comments - Covered by"]),
      ageCurrentExcel: num(row["Age - Current"]),
      numberOfKids2000: num(row["Number of Kids in 2000"]),
    });
  }
}

// ─── Main extraction ──────────────────────────────────────────

const SHEET_EXTRACTORS: Record<string, (sheet: SheetData, result: CanonicalData) => void> = {
  "Loyd List 1-190 - Edit": extractLoydList,
  "All Girls & Descendants": extractGirlsDescendants,
  // These two sheets also contain girls' descendants with the same column structure
  "Women from #85 onwards": extractGirlsDescendants,
  "Women before #85": extractGirlsDescendants,
  "Updated Bios & Spouse Details": extractBiosAndSpouse,
  "BiographyMarriageDetsCountries": extractBiosAndSpouse,
  "Hatch&Match Details": extractHatchMatch,
  "Contacts": extractContacts,
};

export function extractCanonical(sheets: SheetData[]): CanonicalData {
  const result: CanonicalData = {
    people: [],
    events: [],
    parentChild: [],
    partnerships: [],
    contacts: [],
  };

  // Process in a specific order to ensure enrichment works
  const orderedSheets = [
    "Loyd List 1-190 - Edit",
    "All Girls & Descendants",
    "Women from #85 onwards",  // Additional girls/descendants data
    "Women before #85",        // Additional girls/descendants data
    "Hatch&Match Details",
    "Updated Bios & Spouse Details",
    "BiographyMarriageDetsCountries",
    "Contacts",
  ];

  for (const sheetName of orderedSheets) {
    const sheet = sheets.find((s) => s.sheetName === sheetName);
    const extractor = SHEET_EXTRACTORS[sheetName];
    if (sheet && extractor) {
      extractor(sheet, result);
    }
  }

  // Deduplicate people by primaryExternalKey (keep first, merge later enrichment)
  const seen = new Map<string, PersonPayload>();
  for (const p of result.people) {
    if (!seen.has(p.primaryExternalKey)) {
      seen.set(p.primaryExternalKey, p);
    }
    // If duplicate, the enrichment from bios already happened in-place
  }
  result.people = Array.from(seen.values());

  // Deduplicate events by key
  const seenEvents = new Map<string, EventPayload>();
  for (const e of result.events) {
    if (!seenEvents.has(e.key)) {
      seenEvents.set(e.key, e);
    }
  }
  result.events = Array.from(seenEvents.values());

  // Deduplicate parent-child
  const seenPC = new Set<string>();
  result.parentChild = result.parentChild.filter((pc) => {
    const key = `${pc.parentKey}->${pc.childKey}`;
    if (seenPC.has(key)) return false;
    seenPC.add(key);
    return true;
  });

  return result;
}
