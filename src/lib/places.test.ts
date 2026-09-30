import assert from "node:assert/strict";
import test from "node:test";
import { extractLocationPoints, resolveHistoricalPlace, resolveHistoricalPlaces, buildDatedJourneys } from "./places";

test("recognizes supported historical cities and countries at coarse coordinates", () => {
  assert.deepEqual(resolveHistoricalPlace("Edinburgh, Scotland"), {
    canonical: "Edinburgh", kind: "CITY", lat: 55.953, lng: -3.188,
    confidence: "high", provenance: "recognized place name",
  });
  assert.equal(resolveHistoricalPlace("United Kingdom")?.canonical, "United Kingdom");
});

test("does not guess unsupported locations or substring matches", () => {
  assert.equal(resolveHistoricalPlace("West Londonderry"), null);
  assert.equal(resolveHistoricalPlace("New England"), null);
  assert.equal(resolveHistoricalPlace("17 Example Road"), null);
  assert.equal(resolveHistoricalPlace(null), null);
});

test("groups records into canonical places and counts unresolved evidence", () => {
  const { points, unresolvedCount } = extractLocationPoints([
    { id: "1", personId: "p1", personName: "Ada", label: "birth", year: 1880, eventType: "BIRTH", branch: null, locationText: "London, England" },
    { id: "2", personId: "p2", personName: "Eli", label: "death", year: 1940, eventType: "DEATH", branch: null, locationText: "London" },
    { id: "3", personId: "p3", personName: "Sam", label: "residence", year: null, eventType: "RESIDENCE", branch: null, locationText: "Somewhere unknown" },
  ]);
  assert.equal(points.length, 1);
  assert.equal(points[0].canonical, "London");
  assert.equal(points[0].evidence.length, 2);
  assert.equal(unresolvedCount, 1);
});


test("preserves multiple recorded countries without inventing travel order", () => {
  const places = resolveHistoricalPlaces("England, Canada and Australia");
  assert.deepEqual(new Set(places.map(p => p.canonical)), new Set(["England", "Canada", "Australia"]));
  assert.equal(resolveHistoricalPlaces("England; United Kingdom; UK").filter(p => p.canonical === "United Kingdom").length, 1);
});


test("dated connections exclude undated and ambiguous same-year places", () => {
  const input = (id: string, year: number | null, locationText: string) => ({ id, personId: "a", personName: "Example", year, locationText, label: "event", eventType: "RESIDENCE", branch: null });
  const { points } = extractLocationPoints([input("1", 1900, "England"), input("2", 1920, "Canada"), input("3", null, "Australia"), input("4", 1910, "France"), input("5", 1910, "Italy")]);
  const paths = buildDatedJourneys(points);
  assert.equal(paths.length, 1);
  assert.deepEqual(paths[0].stops.map(p => [p.place, p.year]), [["England", 1900], ["Canada", 1920]]);
});
