import { isDeepStrictEqual } from "node:util";
import type { PropertyRecord } from "./properties";

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertOnlyKeys(value: Record<string, unknown>, allowed: readonly string[], label: string) {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) throw new Error(`${label} contains an unsupported field.`);
}

function text(value: unknown, maxLength = 20000): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function safeHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || /[\u0000-\u0020\u007f]/.test(value)) return false;
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && Boolean(parsed.hostname) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function sourceIds(value: unknown, ids: Set<string>): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= ids.size && value.every((id) => typeof id === "string" && ids.has(id));
}

export function validateResearch(value: unknown, slug: string): asserts value is PropertyRecord {
  if (!isRecord(value)) throw new Error("A property record is required.");
  const p = value;
  assertOnlyKeys(p, ["slug", "name", "location", "category", "summary", "connection", "status", "statusChecked", "confidence", "paragraphs", "timeline", "sources", "uncertainties", "images", "archiveImages", "relatedNames", "aliases", "people", "mapLocation"], "Property record");

  if (p.slug !== slug || !/^[a-z0-9-]+$/.test(slug)) throw new Error("The property identifier cannot change.");
  for (const field of ["name", "location", "category", "summary", "connection", "status", "statusChecked"] as const) {
    if (!text(p[field], 12000)) throw new Error(`Please provide a valid ${field}.`);
  }
  if (!validDate(p.statusChecked as string)) throw new Error("Use a valid source-check date.");
  if (p.confidence !== "corroborated" && p.confidence !== "partial" && p.confidence !== "unresolved") throw new Error("Choose an evidence status.");

  const arrayFields = ["paragraphs", "timeline", "sources", "uncertainties", "images", "relatedNames", "aliases", "people"] as const;
  for (const key of arrayFields) if (!Array.isArray(p[key]) || p[key].length > 500) throw new Error(`Invalid ${key}.`);
  if (p.archiveImages !== undefined && (!Array.isArray(p.archiveImages) || p.archiveImages.length > 200)) throw new Error("Invalid archive references.");

  const ids = new Set<string>();
  for (const rawSource of p.sources as unknown[]) {
    if (!isRecord(rawSource)) throw new Error("Sources need unique IDs, titles and valid web addresses.");
    assertOnlyKeys(rawSource, ["id", "title", "url", "publisher", "accessed", "note"], "Source");
    if (!text(rawSource.id, 100) || !/^[a-zA-Z0-9_-]+$/.test(rawSource.id) || ids.has(rawSource.id) || !text(rawSource.title, 1000) || !(rawSource.url === null || safeHttpUrl(rawSource.url))) throw new Error("Sources need unique IDs, titles and valid web addresses.");
    for (const optional of ["publisher", "accessed", "note"] as const) {
      if (rawSource[optional] !== undefined && rawSource[optional] !== null && (typeof rawSource[optional] !== "string" || rawSource[optional].length > 12000)) throw new Error("Source details must be plain text.");
    }
    ids.add(rawSource.id);
  }
  if (!ids.has("workbook")) throw new Error("Preserve the original workbook source.");

  for (const rawParagraph of p.paragraphs as unknown[]) {
    if (!isRecord(rawParagraph)) throw new Error("History paragraphs need a heading, account and source references.");
    assertOnlyKeys(rawParagraph, ["heading", "text", "sourceIds"], "History paragraph");
    if (!text(rawParagraph.heading, 1000) || !text(rawParagraph.text) || !sourceIds(rawParagraph.sourceIds, ids)) throw new Error("Every history paragraph needs a heading, account and valid source reference.");
  }
  for (const rawEvent of p.timeline as unknown[]) {
    if (!isRecord(rawEvent)) throw new Error("Timeline entries need a date, event and source references.");
    assertOnlyKeys(rawEvent, ["date", "text", "sourceIds"], "Timeline entry");
    if (!text(rawEvent.date, 200) || !text(rawEvent.text) || !sourceIds(rawEvent.sourceIds, ids)) throw new Error("Every timeline entry needs a date, event and valid source reference.");
  }
  for (const key of ["uncertainties", "relatedNames", "aliases"] as const) {
    if (!(p[key] as unknown[]).every((item) => text(item))) throw new Error("Lists must contain non-empty text.");
  }

  for (const rawImage of p.images as unknown[]) {
    if (!isRecord(rawImage)) throw new Error("Images require a local archive file, caption, credit and rights/source links.");
    assertOnlyKeys(rawImage, ["url", "sourceUrl", "caption", "credit", "license", "licenseUrl", "originalUrl", "width", "height", "kind", "dateLabel", "sectionHeading"], "Image");
    if (typeof rawImage.url !== "string" || !/^\/properties\/[a-z0-9-]+\.(webp|jpg|png)$/.test(rawImage.url) || !safeHttpUrl(rawImage.sourceUrl) || !safeHttpUrl(rawImage.licenseUrl) || !text(rawImage.caption) || !text(rawImage.credit, 1000) || !text(rawImage.license, 500)) throw new Error("Images require a local archive file, caption, credit and rights/source links.");
    if (rawImage.width !== undefined && (!Number.isInteger(rawImage.width) || (rawImage.width as number) <= 0)) throw new Error("Image dimensions must be positive integers.");
    if (rawImage.height !== undefined && (!Number.isInteger(rawImage.height) || (rawImage.height as number) <= 0)) throw new Error("Image dimensions must be positive integers.");
    if (rawImage.kind !== undefined && !["portrait", "historic", "present"].includes(rawImage.kind as string)) throw new Error("Choose a valid image type.");
    if (rawImage.originalUrl !== undefined && !safeHttpUrl(rawImage.originalUrl)) throw new Error("Original image links must use a valid web address.");
    if (rawImage.dateLabel !== undefined && (typeof rawImage.dateLabel !== "string" || rawImage.dateLabel.length > 100)) throw new Error("Image dates must be plain text.");
    if (rawImage.sectionHeading !== undefined && (typeof rawImage.sectionHeading !== "string" || rawImage.sectionHeading.length > 1000)) throw new Error("Image sections must be plain text.");
  }

  for (const rawReference of (p.archiveImages ?? []) as unknown[]) {
    if (!isRecord(rawReference)) throw new Error("Archive references need a title, institution, description and valid URL.");
    assertOnlyKeys(rawReference, ["title", "url", "institution", "description", "kind", "dateLabel"], "Archive reference");
    if (!safeHttpUrl(rawReference.url) || !text(rawReference.title, 1000) || !text(rawReference.institution, 1000) || !text(rawReference.description)) throw new Error("Archive references need a title, institution, description and valid URL.");
    if (rawReference.kind !== undefined && (typeof rawReference.kind !== "string" || rawReference.kind.length > 100)) throw new Error("Archive reference type must be plain text.");
    if (rawReference.dateLabel !== undefined && (typeof rawReference.dateLabel !== "string" || rawReference.dateLabel.length > 100)) throw new Error("Archive reference dates must be plain text.");
  }

  for (const rawPerson of p.people as unknown[]) {
    if (!isRecord(rawPerson)) throw new Error("Invalid linked profiles.");
    assertOnlyKeys(rawPerson, ["id", "name", "key"], "Linked profile");
    if (!text(rawPerson.id, 200) || !text(rawPerson.name, 1000) || !text(rawPerson.key, 100)) throw new Error("Invalid linked profiles.");
  }
  const people = p.people as Record<string, unknown>[];
  if (new Set(people.map((person) => person.id)).size !== people.length) throw new Error("Linked profiles must be unique.");

  if (p.mapLocation !== undefined && p.mapLocation !== null) {
    if (!isRecord(p.mapLocation)) throw new Error("Map locations need valid coordinates, precision, an explanation and source links.");
    const point = p.mapLocation;
    assertOnlyKeys(point, ["slug", "lat", "lng", "label", "precision", "explanation", "sourceUrl", "mapSourceUrl", "gridReference", "coordinateMethod"], "Map location");
    if (point.slug !== slug || typeof point.lat !== "number" || !Number.isFinite(point.lat) || Math.abs(point.lat) > 90 || typeof point.lng !== "number" || !Number.isFinite(point.lng) || Math.abs(point.lng) > 180 || !["building", "estate", "locality"].includes(point.precision as string) || !text(point.label, 1000) || !text(point.explanation) || !safeHttpUrl(point.sourceUrl) || !safeHttpUrl(point.mapSourceUrl)) throw new Error("Map locations need valid coordinates, precision, an explanation and source links.");
    for (const optional of ["gridReference", "coordinateMethod"] as const) if (point[optional] !== undefined && (typeof point[optional] !== "string" || point[optional].length > 1000)) throw new Error("Coordinate details must be plain text.");
  }

  let size: number;
  try {
    size = JSON.stringify(p).length;
  } catch {
    throw new Error("The property record must contain JSON-compatible values.");
  }
  if (size > 300000) throw new Error("This article is too large for a single revision.");
}

export function changedFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => !isDeepStrictEqual(before[key], after[key]));
}

/** An empty submitted section must not erase published research by accident. */
export function assertPreservedResearchSections(current: PropertyRecord, proposed: PropertyRecord): void {
  for (const section of ["paragraphs", "images", "people"] as const) {
    if (current[section].length > 0 && proposed[section].length === 0) {
      throw new Error(`The current article has ${section}. Preserve them in the draft before saving.`);
    }
  }
}
