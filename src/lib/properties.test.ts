import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { properties, searchProperties } from "./properties";
import locations from "../content/property-locations.json";

test("published property accounts have resolvable evidence and licensed local images", () => {
  assert.ok(properties.length > 30, "The compiled collection must be present");
  assert.equal(new Set(properties.map((p) => p.slug)).size, properties.length);
  for (const property of properties) {
    assert.ok(property.sources.some((s) => s.id === "workbook"), property.slug);
    const sourceIds = new Set(property.sources.map((s) => s.id));
    assert.equal(sourceIds.size, property.sources.length, property.slug);
    for (const claim of [...property.paragraphs, ...property.timeline]) {
      assert.ok(claim.sourceIds.length, `${property.slug}: an uncited claim`);
      for (const id of claim.sourceIds) assert.ok(sourceIds.has(id), `${property.slug}: missing source ${id}`);
    }
    for (const image of property.images) {
      assert.ok((image.width ?? 0) > 0 && (image.height ?? 0) > 0, `${property.slug}: missing image dimensions`);
      assert.ok(image.credit && image.license && image.licenseUrl && image.sourceUrl, property.slug);
      assert.ok(image.url.startsWith("/properties/"), property.slug);
      assert.ok(fs.existsSync(path.join(process.cwd(), "public", image.url)), property.slug);
    }
    const archiveUrls = new Set<string>();
    for (const record of property.archiveImages ?? []) {
      assert.ok(record.title && record.description && record.institution, property.slug);
      assert.equal(new URL(record.url).protocol, "https:", property.slug);
      assert.ok(!archiveUrls.has(record.url), `${property.slug}: duplicate archive image record`);
      archiveUrls.add(record.url);
    }
    assert.equal(new Set(property.people.map((p) => p.id)).size, property.people.length);
  }
});

test("search finds named properties and preserves distinct same-name places", () => {
  assert.ok(searchProperties("Overstone").some((p) => p.slug === "overstone-park"));
  assert.ok(searchProperties("Cilycwm").some((p) => p.slug === "court-henry"));
  assert.ok(searchProperties("Stoneden").some((p) => p.slug === "cwrt-henri"));
  assert.ok(!searchProperties("an-impossible-property-name").length);
});

test("property map uses sourced locations and excludes unresolved identities", () => {
  const slugs = new Set(properties.map((property) => property.slug));
  assert.equal(new Set(locations.map((point) => point.slug)).size, locations.length);
  assert.ok(!locations.some((point) => point.slug === "idaho"), "Conflicting Idaho locations must not become a pin");
  for (const point of locations) {
    assert.ok(slugs.has(point.slug), point.slug);
    assert.ok(Number.isFinite(point.lat) && Math.abs(point.lat) <= 90, point.slug);
    assert.ok(Number.isFinite(point.lng) && Math.abs(point.lng) <= 180, point.slug);
    assert.ok(point.explanation && point.label, point.slug);
    assert.equal(new URL(point.sourceUrl).protocol, "https:");
    assert.equal(new URL(point.mapSourceUrl).protocol, "https:");
    assert.ok(["building", "estate", "locality"].includes(point.precision));
    if (point.precision === "building") {
      assert.ok(point.gridReference, `${point.slug}: building needs an authoritative grid reference`);
      assert.ok(point.mapSourceUrl.includes("historicengland.org.uk/listing/"), point.slug);
    }
  }
});
