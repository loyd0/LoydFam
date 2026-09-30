/** Publish reviewed research without overwriting family edits. DATABASE_URL must be explicit. */
import fs from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { setAuditContext } from "../src/lib/audit";
import { validateResearch } from "../src/lib/research-validation";
import type { PropertyRecord } from "../src/lib/properties";
import type { Prisma } from "../src/generated/prisma/client";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL explicitly before publishing.");
  const { prisma } = await import("../src/lib/prisma");
  try {
  const [baselinePath, inputPath, ...flags] = process.argv.slice(2);
  if (!baselinePath || !inputPath) throw new Error("Usage: tsx scripts/publish-research.ts BASELINE.json REVIEWED.json [--apply]");
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8")) as PropertyRecord[];
  const incoming = JSON.parse(fs.readFileSync(inputPath, "utf8")) as PropertyRecord[];
  const baselineBySlug = new Map(baseline.map(p => [p.slug, p]));
  for (const p of [...baseline, ...incoming]) validateResearch(p, p.slug);
  if (baselineBySlug.size !== baseline.length || new Set(incoming.map(p => p.slug)).size !== incoming.length) throw new Error("Duplicate property identifiers.");
  const existing = await prisma.propertyArticle.findMany();
  const bySlug = new Map(existing.map(p => [p.slug, p]));
  let created = 0, revised = 0;
  for (const article of incoming) {
    const original = baselineBySlug.get(article.slug);
    if (!original) throw new Error(`Missing previously published baseline: ${article.slug}`);
    const current = bySlug.get(article.slug);
    if (current && !isDeepStrictEqual(current.content, original) && !isDeepStrictEqual(current.content, article)) throw new Error(`Conflict: ${article.slug} has an independent edit. Review it before publishing.`);
    if (!current) created++;
    if (!isDeepStrictEqual(current?.content ?? original, article)) revised++;
  }
  if (flags.includes("--apply")) await prisma.$transaction(async tx => {
    for (const article of incoming) {
      const original = baselineBySlug.get(article.slug)!;
      let current = await tx.propertyArticle.findUnique({ where: { slug: article.slug } });
      if (!current) {
        await setAuditContext(tx, {name:"Archive baseline"}, "Initial recorded version of the previously published account. Earlier edits were not tracked and are not reconstructed.");
        current = await tx.propertyArticle.create({ data: { slug: article.slug, content: original as unknown as Prisma.InputJsonValue, version: 1 } });
      }
      if (isDeepStrictEqual(current.content, article)) continue;
      if (!isDeepStrictEqual(current.content, original)) throw new Error(`Concurrent research edit: ${article.slug}`);
      await setAuditContext(tx, {name:"Archive editorial team"}, "Property account revised; source references, image credits and historical uncertainties retained.");
      const result = await tx.propertyArticle.updateMany({ where: {slug:article.slug,version:current.version}, data:{content:article as unknown as Prisma.InputJsonValue,version:{increment:1}} });
      if (result.count !== 1) throw new Error(`Concurrent edit: ${article.slug}`);
    }
  }, {timeout:120000});
  console.log(JSON.stringify({mode:flags.includes("--apply")?"published":"dry-run",initialVersions:created,revised,properties:incoming.length}));
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error("Research publishing failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
