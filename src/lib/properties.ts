import compiled from "@/content/properties.json";

export interface PropertyLocation {
  slug: string; lat: number; lng: number; label: string;
  precision: "building" | "estate" | "locality";
  explanation: string; sourceUrl: string; mapSourceUrl: string;
  gridReference?: string; coordinateMethod?: string;
}

export interface PropertyRecord {
  mapLocation?: PropertyLocation | null;
  slug: string;
  name: string;
  location: string;
  category: string;
  summary: string;
  connection: string;
  status: string;
  statusChecked: string;
  confidence: "corroborated" | "partial" | "unresolved";
  paragraphs: { heading: string; text: string; sourceIds: string[] }[];
  timeline: { date: string; text: string; sourceIds: string[] }[];
  sources: { id: string; title: string; url: string | null; publisher?: string; accessed?: string; note?: string }[];
  uncertainties: string[];
  images: { url: string; originalUrl?: string; sourceUrl: string; caption: string; credit: string; license: string; licenseUrl: string; width?: number; height?: number; kind?: "portrait" | "historic" | "present"; dateLabel?: string; sectionHeading?: string }[];
  archiveImages?: { title: string; url: string; institution: string; description: string; kind?: string; dateLabel?: string }[];
  relatedNames: string[];
  aliases: string[];
  people: { id: string; name: string; key: string }[];
}

export const properties = compiled as PropertyRecord[];

export function searchProperties(query: string) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return properties.filter((property) => {
    const text = normalize([property.name, property.location, property.category, ...property.aliases, ...property.relatedNames].join(" "));
    return words.every((word) => text.includes(word));
  });
}

function normalize(text: string) {
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").toLowerCase();
}

export function propertiesForPerson(id: string) {
  return properties.filter((property) => property.people.some((person) => person.id === id));
}
