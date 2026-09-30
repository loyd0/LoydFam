import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { properties as originalProperties, type PropertyRecord } from "@/lib/properties";

export const getProperties = cache(async (): Promise<PropertyRecord[]> => {
  const records = await prisma.propertyArticle.findMany();
  const published = new Map(records.map(record => [record.slug, record.content as unknown as PropertyRecord]));
  return originalProperties.map(original => published.get(original.slug) ?? original);
});
export async function getProperty(slug: string) {
  const original = originalProperties.find(property => property.slug === slug);
  if (!original) return null;
  const record = await prisma.propertyArticle.findUnique({ where: { slug } });
  return { property: record ? record.content as unknown as PropertyRecord : original, version: record?.version ?? 0 };
}
export async function getPropertiesForPerson(personId: string): Promise<Pick<PropertyRecord, "slug" | "name" | "location">[]> {
  const originalSlugs = originalProperties
    .filter(property => property.people.some(person => person.id === personId))
    .map(property => property.slug);
  // Include articles newly linked to this person and overrides of originals that
  // might have removed the link. The JSON predicate runs in Postgres.
  const originalPredicate = originalSlugs.length
    ? Prisma.sql`slug IN (${Prisma.join(originalSlugs)}) OR `
    : Prisma.empty;
  const records = await prisma.$queryRaw<{ slug: string; content: PropertyRecord }[]>(Prisma.sql`
    SELECT slug, content FROM property_articles
    WHERE ${originalPredicate}EXISTS (
      SELECT 1 FROM jsonb_array_elements(content->'people') AS linked_person
      WHERE linked_person->>'id' = ${personId}
    )
  `);
  const published = new Map(records.map(record => [record.slug, record.content]));
  return originalProperties
    .map(original => published.get(original.slug) ?? original)
    .filter(property => property.people.some(person => person.id === personId))
    .map(({ slug, name, location }) => ({ slug, name, location }));
}
export async function findProperties(query: string) {
  const safeQuery = typeof query === "string" ? query.slice(0, 200) : "";
  const words = safeQuery.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’']/g, "").split(/\s+/).filter(Boolean);
  return (await getProperties()).filter(p => {
    const text = [p.name, p.location, p.category, ...p.aliases, ...p.relatedNames].join(" ").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’']/g, "");
    return words.every(word => text.includes(word));
  });
}
