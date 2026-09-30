import assert from "node:assert/strict";
import test from "node:test";
import { extractCanonical } from "./canonical-extract";
import type { SheetData } from "./parse-workbook";

function sheet(sheetName: string, rows: Record<string, unknown>[]): SheetData {
  return { sheetName, headers: [...new Set(rows.flatMap((row) => Object.keys(row)))], rows };
}

test("keeps exact-key alias, name, and residency enrichment from supplementary sheets", () => {
  const result = extractCanonical([
    sheet("Loyd List 1-190 - Edit", [{
      "Loyd ##": 7, Surname: "Example", "1st Name": "Alex", "Known as": null,
      Sex: "F", "Year of Birth": 1901,
    }]),
    sheet("Hatch&Match Details", [{
      "LOYD #": 7, Surname: null, "1st Name": "Alexandra", "2nd Name": "M",
      "KNOWN AS": "Lex", Sex: "F", GENERATION: 3,
    }]),
    sheet("BiographyMarriageDetsCountries", [{
      "Loyd #": 7, "Countries lived in": "Sampleland", "WIFE/HUSBAND": null,
    }]),
  ]);

  assert.equal(result.people.length, 1);
  assert.deepEqual(
    (({ primaryExternalKey, givenName1, givenName2, knownAs, preferredName, residencyText }) => ({
      primaryExternalKey, givenName1, givenName2, knownAs, preferredName, residencyText,
    }))(result.people[0]),
    {
      primaryExternalKey: "LOYD:7",
      givenName1: "Alex",
      givenName2: "M",
      knownAs: "Lex",
      preferredName: "Lex",
      residencyText: "Sampleland",
    },
  );
});

test("does not interpret categorical photo status as an expected photo count", () => {
  const result = extractCanonical([
    sheet("Loyd List 1-190 - Edit", [{ "Loyd ##": 2, Surname: "Example", "1st Name": "Sam" }]),
    sheet("Generations&Photos- CostsAT1", [{ "Loyd #": 2, Photo: 1, "Photo Provider #": "P-2" }]),
  ]);

  assert.equal(result.people[0].expectedPhotoCount, null);
});
