/** Coarse, deterministic place recognition for historical family records. */
export type PlaceResolution = {
  canonical: string;
  kind: "CITY" | "COUNTRY";
  lat: number;
  lng: number;
  confidence: "high";
  provenance: "recognized place name";
};

const countries: Record<string, { name: string; lat: number; lng: number }> = {
  "united kingdom": { name: "United Kingdom", lat: 54.5, lng: -3 }, uk: { name: "United Kingdom", lat: 54.5, lng: -3 }, britain: { name: "United Kingdom", lat: 54.5, lng: -3 }, england: { name: "England", lat: 52.5, lng: -1.5 }, scotland: { name: "Scotland", lat: 56.5, lng: -4 }, wales: { name: "Wales", lat: 52.3, lng: -3.7 }, ireland: { name: "Ireland", lat: 53.4, lng: -8 }, "united states": { name: "United States", lat: 39.8, lng: -98.6 }, usa: { name: "United States", lat: 39.8, lng: -98.6 }, canada: { name: "Canada", lat: 56, lng: -106 }, australia: { name: "Australia", lat: -25, lng: 134 }, "new zealand": { name: "New Zealand", lat: -41, lng: 174 }, india: { name: "India", lat: 22, lng: 79 }, pakistan: { name: "Pakistan", lat: 30, lng: 70 }, "south africa": { name: "South Africa", lat: -29, lng: 24 }, uae: { name: "United Arab Emirates", lat: 24.3, lng: 54.4 }, "united arab emirates": { name: "United Arab Emirates", lat: 24.3, lng: 54.4 }, france: { name: "France", lat: 46.2, lng: 2.2 }, germany: { name: "Germany", lat: 51.2, lng: 10.4 }, italy: { name: "Italy", lat: 42.8, lng: 12.8 }, spain: { name: "Spain", lat: 40.4, lng: -3.7 }, china: { name: "China", lat: 35.9, lng: 104.2 }, japan: { name: "Japan", lat: 36.2, lng: 138.3 }, kenya: { name: "Kenya", lat: 0.2, lng: 37.9 }, egypt: { name: "Egypt", lat: 26.8, lng: 30.8 }, cyprus: { name: "Cyprus", lat: 35.1, lng: 33.4 }, malaysia: { name: "Malaysia", lat: 4.2, lng: 102 }, singapore: { name: "Singapore", lat: 1.35, lng: 103.8 }, swaziland: { name: "Eswatini", lat: -26.5, lng: 31.5 }, eswatini: { name: "Eswatini", lat: -26.5, lng: 31.5 }, oman: { name: "Oman", lat: 21.5, lng: 55.9 }, "hong kong": { name: "Hong Kong", lat: 22.3, lng: 114.2 }, switzerland: { name: "Switzerland", lat: 46.8, lng: 8.2 }, mexico: { name: "Mexico", lat: 23.6, lng: -102.5 },
};

const cities: Record<string, [string, number, number]> = {
  london: ["London", 51.507, -0.128], edinburgh: ["Edinburgh", 55.953, -3.188], glasgow: ["Glasgow", 55.864, -4.252], liverpool: ["Liverpool", 53.408, -2.991], manchester: ["Manchester", 53.48, -2.242], cardiff: ["Cardiff", 51.482, -3.179], birmingham: ["Birmingham", 52.486, -1.89], aberdeen: ["Aberdeen", 57.149, -2.094], dublin: ["Dublin", 53.35, -6.26], cork: ["Cork", 51.898, -8.475], sydney: ["Sydney", -33.869, 151.209], melbourne: ["Melbourne", -37.814, 144.963], perth: ["Perth", -31.952, 115.861], auckland: ["Auckland", -36.85, 174.764], toronto: ["Toronto", 43.653, -79.383], vancouver: ["Vancouver", 49.282, -123.121], "new york": ["New York", 40.713, -74.006], "los angeles": ["Los Angeles", 34.052, -118.244], delhi: ["Delhi", 28.614, 77.209], karachi: ["Karachi", 24.861, 67.01], dubai: ["Dubai", 25.204, 55.27], "abu dhabi": ["Abu Dhabi", 24.454, 54.377], paris: ["Paris", 48.857, 2.352], rome: ["Rome", 41.903, 12.496], "cape town": ["Cape Town", -33.925, 18.424],
};

function normalize(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Recognizes every named country in a residence field, without inventing a route. */
export function resolveHistoricalPlaces(value: string | null | undefined): PlaceResolution[] {
  if (!value?.trim()) return [];
  if (/\b(road|street|avenue|lane|drive|postcode|postal code)\b/i.test(value) || /\b\d{1,3}\b/.test(value)) return [];
  const text = ` ${normalize(value).replace(/\bnew england\b|\bnew south wales\b/g, "")} `;
  const segments = value.split(/[,;|/]+/).map(normalize).filter(Boolean);
  const matchedCountries = Object.entries(countries).filter(([key]) => text.includes(` ${key} `));
  const city = Object.entries(cities).find(([key]) => segments.includes(key));
  // A city with no broader country list is a single place; multi-country histories retain all countries.
  if (city && matchedCountries.length <= 1) return [{ canonical: city[1][0], kind: "CITY", lat: city[1][1], lng: city[1][2], confidence: "high", provenance: "recognized place name" }];
  return [...new Map(matchedCountries.map(([, country]) => [country.name, {
    canonical: country.name, kind: "COUNTRY" as const, lat: country.lat, lng: country.lng,
    confidence: "high" as const, provenance: "recognized place name" as const,
  }])).values()];
}

export function resolveHistoricalPlace(value: string | null | undefined): PlaceResolution | null {
  return resolveHistoricalPlaces(value)[0] ?? null;
}

export type PlaceEvidence = { id: string; personName: string; personId: string; label: string; year: number | null; eventType: string; branch: string | null };
export type PlacePoint = PlaceResolution & { id: string; evidence: PlaceEvidence[] };

/** Groups event/person location evidence by the canonical coarse location. */
export function extractLocationPoints(records: Array<PlaceEvidence & { locationText: string | null }>): { points: PlacePoint[]; unresolvedCount: number } {
  const grouped = new Map<string, PlacePoint>();
  let unresolvedCount = 0;
  for (const record of records) {
    const places = resolveHistoricalPlaces(record.locationText);
    if (!places.length) { if (record.locationText?.trim()) unresolvedCount++; continue; }
    for (const place of places) {
    const key = `${place.kind}:${place.canonical}`;
    const existing = grouped.get(key);
    const evidence = { id: record.id, personName: record.personName, personId: record.personId, label: record.label, year: record.year, eventType: record.eventType, branch: record.branch };
    if (existing) existing.evidence.push(evidence);
    else grouped.set(key, { ...place, id: key, evidence: [evidence] });
    }
  }
  return { points: [...grouped.values()], unresolvedCount };
}

export type DatedJourney = { personId: string; personName: string; stops: Array<{ lat: number; lng: number; year: number; place: string }> };

/** Connections between dated records, not proof of a travel route. Ambiguous same-year places are omitted. */
export function buildDatedJourneys(points: PlacePoint[]): DatedJourney[] {
  const people = new Map<string, { name: string; years: Map<number, Map<string, PlacePoint>> }>();
  for (const point of points) for (const evidence of point.evidence) {
    if (evidence.year == null) continue;
    let person = people.get(evidence.personId);
    if (!person) { person = { name: evidence.personName, years: new Map() }; people.set(evidence.personId, person); }
    const places = person.years.get(evidence.year) ?? new Map<string, PlacePoint>();
    places.set(point.id, point); person.years.set(evidence.year, places);
  }
  const journeys: DatedJourney[] = [];
  for (const [personId, person] of people) {
    const stops: DatedJourney['stops'] = [];
    for (const [year, places] of [...person.years].sort(([a],[b]) => a-b)) {
      if (places.size !== 1) continue;
      const point = [...places.values()][0];
      if (stops.at(-1)?.place !== point.canonical) stops.push({ lat: point.lat, lng: point.lng, year, place: point.canonical });
    }
    if (stops.length > 1) journeys.push({ personId, personName: person.name, stops });
  }
  return journeys;
}
