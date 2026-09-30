import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { auditedPrisma } from "@/lib/audited-prisma";
import { setAuditContext } from "@/lib/audit";
import { getProperty } from "@/lib/research-store";
import { properties } from "@/lib/properties";
import { assertPreservedResearchSections, validateResearch } from "@/lib/research-validation";
import { displayNameFor, parseAmendmentNote, parsePersonPatch } from "@/lib/amendment-validation";
import { isPlainObject } from "@/lib/permissions";

type Actor = { id: string; name?: string | null; role: string };
export class AmendmentError extends Error {
  constructor(message: string, public status: 400 | 403 | 404 | 409) { super(message); }
}

export async function submitAmendment(input: unknown, actor: Actor) {
  if (!isPlainObject(input) || (input.targetType !== "PERSON" && input.targetType !== "PROPERTY") ||
    typeof input.targetId !== "string" || !input.targetId || !Object.hasOwn(input, "changes")) {
    throw new AmendmentError("Choose a person or property and provide changes.", 400);
  }
  const note = parseAmendmentNote(input.note);
  if (!note) throw new AmendmentError("Explain the proposed correction in 2,000 characters or fewer.", 400);
  if (input.targetType === "PERSON") {
    if (typeof input.baseVersion !== "string" || Number.isNaN(new Date(input.baseVersion).getTime())) {
      throw new AmendmentError("Reload the person record before proposing a change.", 400);
    }
    const patch = parsePersonPatch(input.changes, true);
    if (!patch) throw new AmendmentError("The person changes contain unsupported fields.", 400);
    const person = await prisma.person.findUnique({ where: { id: input.targetId }, select: { updatedAt: true, isPlaceholder: true } });
    if (!person || person.isPlaceholder) throw new AmendmentError("Person not found.", 404);
    if (person.updatedAt.toISOString() !== new Date(input.baseVersion).toISOString()) {
      throw new AmendmentError("This person changed since you opened the record. Reload and compare your proposal.", 409);
    }
    const amendment = await auditedPrisma(actor, "Submit person amendment").amendment.create({
      data: { targetType: "PERSON", targetId: input.targetId, baseVersion: person.updatedAt.toISOString(),
        payload: patch as Prisma.InputJsonObject, note, proposedByUserId: actor.id },
    });
    return amendment;
  }
  if (!Number.isSafeInteger(input.baseVersion) || (input.baseVersion as number) < 0) {
    throw new AmendmentError("Reload the property before proposing a change.", 400);
  }
  const record = await getProperty(input.targetId);
  if (!record) throw new AmendmentError("Property not found.", 404);
  if (record.version !== input.baseVersion) {
    throw new AmendmentError("This property changed since you opened it. Reload and compare your proposal.", 409);
  }
  try { validateResearch(input.changes, input.targetId); }
  catch (error) { throw new AmendmentError(error instanceof Error ? error.message : "Invalid property changes.", 400); }
  return auditedPrisma(actor, "Submit property amendment").amendment.create({
    data: { targetType: "PROPERTY", targetId: input.targetId, baseVersion: String(record.version),
      payload: input.changes as unknown as Prisma.InputJsonObject, note, proposedByUserId: actor.id },
  });
}

export async function listMyAmendments(userId: string) {
  return prisma.amendment.findMany({ where: { proposedByUserId: userId }, orderBy: { createdAt: "desc" }, take: 100,
    select: { id: true, targetType: true, targetId: true, note: true, status: true, createdAt: true,
      reviewedAt: true, reviewReason: true, payload: true, baseVersion: true } });
}

export async function listAdminAmendments(status?: "PENDING" | "APPROVED" | "APPLIED_MANUALLY" | "REJECTED") {
  const amendments = await prisma.amendment.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 200 });
  const userIds = [...new Set(amendments.flatMap((item) => [item.proposedByUserId, item.reviewedByUserId].filter((id): id is string => Boolean(id))))];
  const personIds = [...new Set(amendments.filter((item) => item.targetType === "PERSON").map((item) => item.targetId))];
  const [users, people] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }),
    prisma.person.findMany({ where: { id: { in: personIds } }, select: { id: true, displayName: true } }),
  ]);
  const byId = new Map(users.map((user) => [user.id, user]));
  const names = new Map(people.map((person) => [person.id, person.displayName]));
  return amendments.map((item) => ({ ...item,
    targetLabel: item.targetType === "PERSON" ? names.get(item.targetId) ?? "Family person" : properties.find((property) => property.slug === item.targetId)?.name ?? "Family property",
    proposedBy: byId.get(item.proposedByUserId) ?? null,
    reviewedBy: item.reviewedByUserId ? byId.get(item.reviewedByUserId) ?? null : null }));
}

export async function reviewAmendment(
  id: string, decision: "APPROVE" | "REJECT" | "RESOLVE", reason: string | null, actor: Actor,
) {
  if (!id || !["APPROVE", "REJECT", "RESOLVE"].includes(decision)) throw new AmendmentError("Choose a valid review decision.", 400);
  if (reason && reason.length > 2000) throw new AmendmentError("Keep the review reason under 2,000 characters.", 400);
  if (decision !== "APPROVE" && !reason) throw new AmendmentError("Explain the review decision.", 400);
  const db = auditedPrisma(actor, `Review amendment ${id}: ${decision.toLowerCase()}`);
  const result = await db.$transaction(async (tx) => {
    const amendment = await tx.amendment.findUnique({ where: { id } });
    if (!amendment) throw new AmendmentError("Amendment not found.", 404);
    if (amendment.status !== "PENDING") throw new AmendmentError("This amendment has already been reviewed.", 409);

    if (decision === "APPROVE" && amendment.targetType === "PERSON") {
      const patch = parsePersonPatch(amendment.payload, true);
      if (!patch) throw new AmendmentError("The proposed person fields are invalid.", 400);
      if (!Object.keys(patch).length) throw new AmendmentError("This request describes a manual correction. Make the change first, then mark it resolved.", 400);
      const person = await tx.person.findUnique({ where: { id: amendment.targetId } });
      if (!person) throw new AmendmentError("Person no longer exists.", 409);
      if (person.updatedAt.toISOString() !== amendment.baseVersion) throw new AmendmentError("Person changed since this proposal. Review the current record before proceeding.", 409);
      const displayName = displayNameFor({ ...person, ...patch });
      const updated = await tx.person.updateMany({
        where: { id: person.id, updatedAt: person.updatedAt }, data: { ...patch, displayName },
      });
      if (updated.count !== 1) throw new AmendmentError("Person changed while approving. Reload and review again.", 409);
    }
    if (decision === "APPROVE" && amendment.targetType === "PROPERTY") {
      const original = properties.find((item) => item.slug === amendment.targetId);
      if (!original) throw new AmendmentError("Property no longer exists.", 409);
      try { validateResearch(amendment.payload, amendment.targetId); }
      catch { throw new AmendmentError("The proposed property fields are invalid.", 400); }
      const existing = await tx.propertyArticle.findUnique({ where: { slug: amendment.targetId } });
      if (String(existing?.version ?? 0) !== amendment.baseVersion) throw new AmendmentError("Property changed since this proposal. Review the current article before proceeding.", 409);
      try { assertPreservedResearchSections(existing ? existing.content as unknown as typeof original : original, amendment.payload as unknown as typeof original); }
      catch (error) { throw new AmendmentError(error instanceof Error ? error.message : "The proposal drops published research.", 409); }
      if (!existing) {
        await setAuditContext(tx, {}, "Initial recorded version of the previously published account. Earlier edit history is unavailable.");
        await tx.propertyArticle.create({ data: { slug: amendment.targetId, content: original as unknown as Prisma.InputJsonObject, version: 1 } });
        await setAuditContext(tx, actor, `Approve amendment ${id}${reason ? `: ${reason}` : ""}`);
      }
      const updated = await tx.propertyArticle.updateMany({
        where: { slug: amendment.targetId, version: existing?.version ?? 1 },
        data: { content: amendment.payload as Prisma.InputJsonObject, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new AmendmentError("Property changed while approving. Reload and review again.", 409);
    }
    const status = decision === "APPROVE" ? "APPROVED" : decision === "RESOLVE" ? "APPLIED_MANUALLY" : "REJECTED";
    return tx.amendment.update({ where: { id, status: "PENDING" },
      data: { status, reviewedByUserId: actor.id, reviewReason: reason, reviewedAt: new Date() } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (decision === "APPROVE") {
    if (result.targetType === "PERSON") revalidatePath(`/people/${result.targetId}`);
    else revalidatePath(`/properties/${result.targetId}`);
  }
  revalidatePath("/admin/amendments");
  revalidatePath("/amendments");
  return result;
}
