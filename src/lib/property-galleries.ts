import type { PropertyRecord } from "./properties";

/** Keep every image reachable even when a history heading is renamed or removed. */
export function propertyGalleries(property: Pick<PropertyRecord, "images" | "paragraphs">) {
  const featured = property.images.find(image => image.kind !== "portrait") ?? property.images[0];
  const sections: PropertyRecord["images"][] = property.paragraphs.map(() => []);
  const remaining: PropertyRecord["images"] = [];
  for (const image of property.images) {
    if (image === featured) continue;
    const index = image.sectionHeading ? property.paragraphs.findIndex(paragraph => paragraph.heading === image.sectionHeading) : -1;
    if (index >= 0) sections[index].push(image);
    else remaining.push(image);
  }
  return { featured, sections, remaining };
}
