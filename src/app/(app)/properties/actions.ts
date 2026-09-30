"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { setAuditContext } from "@/lib/audit";
import { assertPreservedResearchSections, validateResearch } from "@/lib/research-validation";
import { properties, type PropertyRecord } from "@/lib/properties";
import { Prisma } from "@/generated/prisma/client";
import { isDeepStrictEqual } from "node:util";

export async function saveProperty(slug: string, expectedVersion: number, content: unknown, reason: string) {
  const session = await requireAdmin();
  if (typeof reason !== "string" || !reason.trim() || reason.trim().length > 2000) return { error: "Add a short reason for this change (up to 2,000 characters)." };
  try {
    validateResearch(content, slug);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0) throw new Error("Reload the current version before editing.");
    const original = properties.find(p => p.slug === slug);
    if (!original) throw new Error("Property not found.");
    const result = await prisma.$transaction(async tx => {
      const existing = await tx.propertyArticle.findUnique({ where: { slug } });
      if ((existing?.version ?? 0) !== expectedVersion) throw new Error("Someone has edited this page since you opened it. Your draft is still here; reload the page in another tab and compare before saving.");
      assertPreservedResearchSections(existing ? existing.content as unknown as PropertyRecord : original, content);
      if (existing && isDeepStrictEqual(existing.content, content)) throw new Error("There are no changes to save.");
      if (!existing) {
        await setAuditContext(tx, {}, "Initial recorded version of the previously published account. Earlier edit history is unavailable.");
        await tx.propertyArticle.create({ data: { slug, content: original as unknown as Prisma.InputJsonValue, version: 1 } });
      }
      await setAuditContext(tx, session.user, reason.trim());
      const version = existing?.version ?? 1;
      const update = await tx.propertyArticle.updateMany({ where: { slug, version }, data: { content: content as unknown as Prisma.InputJsonValue, version: { increment: 1 } } });
      if (update.count !== 1) throw new Error("Another edit was saved first. Reload and compare before saving.");
      return version + 1;
    });
    revalidatePath("/properties", "layout");
    revalidatePath("/history");
    return { version: result };
  } catch (error) {
    return { error: error instanceof Error && !(error instanceof Prisma.PrismaClientKnownRequestError) ? error.message : "The change could not be saved. Your draft has been preserved; please try again." };
  }
}

export async function restoreProperty(slug: string, revisionId: string, version: number, reason: string) {
  await requireAdmin();
  if (typeof slug !== "string" || !/^[a-z0-9-]+$/.test(slug) || typeof revisionId !== "string" || !revisionId) return { error: "That revision does not belong to this property." };
  if (!Number.isInteger(version) || version < 0) return { error: "Reload the current property before restoring a revision." };
  if (typeof reason !== "string" || !reason.trim()) return { error: "Explain why you are restoring this version." };
  if (reason.trim().length > 1950) return { error: "Keep the restoration reason under 1,950 characters." };
  const revision = await prisma.recordRevision.findUnique({ where: { id: revisionId } });
  if (!revision || revision.entityType !== "property" || revision.entityId !== slug) return { error: "That revision does not belong to this property." };
  const snapshot = revision.after as { content?: PropertyRecord; version?: number } | null;
  if (!snapshot?.content) return { error: "This revision has no restorable account." };
  return saveProperty(slug, version, snapshot.content, `Restored version ${snapshot.version ?? "unknown"}: ${reason.trim()}`);
}
