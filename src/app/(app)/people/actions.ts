"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { Prisma } from "@/generated/prisma/client";
import { auditedPrisma } from "@/lib/audited-prisma";
import { AuthzError, requireAdmin, requirePermission, requireOwnedPerson } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { parsePersonPatch } from "@/lib/amendment-validation";
import { logActivity, describeChange } from "@/lib/activity";
import { assertValidEvent, assertValidParentType, normalizeEventDateFields, wouldCreateParentCycle } from "@/lib/genealogy-validation";
import { resolveHistoricalPlace } from "@/lib/places";

function stripEmpty<T extends object>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (typeof v === "string" && v.trim() === "") {
      out[k] = null;
    } else {
      out[k] = v;
    }
  }
  return out as Partial<T>;
}

function buildDisplayName(p: {
  givenName1?: string | null;
  givenName2?: string | null;
  givenName3?: string | null;
  surname?: string | null;
  knownAs?: string | null;
}): string {
  const parts = [p.givenName1, p.givenName2, p.givenName3, p.surname]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim());
  if (parts.length) return parts.join(" ");
  if (p.knownAs?.trim()) return p.knownAs.trim();
  return "Unnamed";
}

export interface PersonPatch {
  givenName1?: string | null;
  givenName2?: string | null;
  givenName3?: string | null;
  surname?: string | null;
  knownAs?: string | null;
  preferredName?: string | null;
  birthName?: string | null;
  gender?: "MALE" | "FEMALE" | "UNKNOWN";
  residencyText?: string | null;
  biographyMd?: string | null;
  biographyShortMd?: string | null;
  legacyGeneration?: number | null;
  generationFromWilliam?: number | null;
}

export async function createPerson(patch: PersonPatch): Promise<{ id: string }> {
  const session = await requireAdmin();
  const db = auditedPrisma(session.user, "Create family person");
  const displayName = buildDisplayName(patch);
  const person = await db.person.create({
    data: {
      ...stripEmpty(patch),
      displayName,
      primaryExternalKey: `MANUAL:${randomUUID()}`,
      sourceSystem: "MANUAL",
      gender: patch.gender ?? "UNKNOWN",
    },
  });
  await logActivity({
    actorUserId: session.user.id,
    type: "ENTITY_CREATED",
    entityType: "person",
    entityId: person.id,
    message: `Created ${displayName}`,
  });
  revalidatePath("/people");
  revalidatePath(`/people/${person.id}`);
  return { id: person.id };
}

export async function updatePerson(
  id: string,
  patch: PersonPatch,
): Promise<{ id: string; displayName: string }> {
  const session = await requireOwnedPerson(id);
  const parsed = parsePersonPatch(patch);
  if (!parsed) throw new Error("The person changes contain unsupported fields.");
  const safePatch = parsed as PersonPatch;
  const db = auditedPrisma(session.user, "Update family person");
  const before = await db.person.findUniqueOrThrow({ where: { id } });
  const merged = { ...before, ...stripEmpty(safePatch) };
  const displayName = buildDisplayName(merged);

  const updated = await db.person.update({
    where: session.user.role === "ADMIN" ? { id } : { id, verifiedUsers: { some: { id: session.user.id } } },
    data: { ...stripEmpty(safePatch), displayName },
  });

  const { changed, diff } = describeChange(
    before as unknown as Record<string, unknown>,
    { ...stripEmpty(safePatch), displayName } as Partial<Record<string, unknown>>,
  );

  if (changed.length > 0) {
    await logActivity({
      actorUserId: session.user.id,
      type: "ENTITY_UPDATED",
      entityType: "person",
      entityId: id,
      message: `Updated ${updated.displayName} (${changed.join(", ")})`,
      meta: { changed, diff },
    });
  }
  revalidatePath(`/people/${id}`);
  revalidatePath("/people");
  return { id: updated.id, displayName: updated.displayName };
}

export async function deletePerson(id: string): Promise<void> {
  const session = await requireAdmin();
  const db = auditedPrisma(session.user, "Delete family person");
  const person = await db.person.findUniqueOrThrow({ where: { id } });
  await db.person.delete({ where: { id } });
  await logActivity({
    actorUserId: session.user.id,
    type: "ENTITY_DELETED",
    entityType: "person",
    entityId: id,
    message: `Deleted ${person.displayName}`,
  });
  revalidatePath("/people");
}

// ─── Events ──────────────────────────────────────────────────

export interface EventInput {
  type: "BIRTH" | "DEATH" | "MARRIAGE" | "RESIDENCE" | "OTHER";
  dateExact?: string | null; // ISO date (yyyy-mm-dd)
  dateYear?: number | null;
  dateMonth?: number | null;
  dateDay?: number | null;
  dateText?: string | null;
  dateIsApprox?: boolean;
  description?: string | null;
  locationText?: string | null;
}

async function resolveOrCreateEventPlace(tx: Prisma.TransactionClient, sourceText: string | null | undefined): Promise<string | null> {
  if (sourceText == null || sourceText.trim() === "") return null;
  const resolution = resolveHistoricalPlace(sourceText);
  const type = resolution?.kind ?? "OTHER";
  const name = resolution?.canonical ?? sourceText.trim();
  const lat = resolution?.lat ?? null;
  const lng = resolution?.lng ?? null;
  const existing = await tx.place.findFirst({
    where: resolution
      ? { type, name, lat, lng }
      : { type: "OTHER", name, sourceText },
    select: { id: true },
  });
  if (existing) return existing.id;
  const place = await tx.place.create({
    data: {
      type,
      name,
      country: null,
      lat,
      lng,
      sourceText,
    },
    select: { id: true },
  });
  return place.id;
}

async function eventTransaction<T>(db: import("@/generated/prisma/client").PrismaClient, operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await db.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt === 0 && error && typeof error === "object" && "code" in error && error.code === "P2034") continue;
      if (error && typeof error === "object" && "code" in error && error.code === "P2034") {
        throw new Error("The event data changed while saving. Please try again.");
      }
      throw error;
    }
  }
  throw new Error("The event data changed while saving. Please try again.");
}

const EVENT_ADMIN_REVIEW_MESSAGE = "This event is not exclusively linked to your verified person record. Ask an administrator to review the change.";

async function requireEventEditor(personId: string) {
  try {
    return await requireOwnedPerson(personId);
  } catch (error) {
    if (error instanceof AuthzError && error.status === 403) {
      throw new Error("Only an administrator or the verified person can edit this event. Otherwise, submit an amendment for administrator review.");
    }
    throw error;
  }
}

async function assertVerifiedEventOwner(tx: Prisma.TransactionClient, userId: string, personId: string): Promise<void> {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { verifiedPersonId: true } });
  if (user?.verifiedPersonId !== personId) throw new Error(EVENT_ADMIN_REVIEW_MESSAGE);
}

async function assertPersonalEvent(tx: Prisma.TransactionClient, eventId: string, personId: string): Promise<void> {
  const event = await tx.event.findUnique({
    where: { id: eventId },
    select: {
      personEvents: { select: { personId: true } },
      partnershipStarts: { select: { id: true } },
      partnershipEnds: { select: { id: true } },
    },
  });
  if (!event || event.personEvents.length !== 1 || event.personEvents[0]?.personId !== personId || event.partnershipStarts.length > 0 || event.partnershipEnds.length > 0) {
    throw new Error(EVENT_ADMIN_REVIEW_MESSAGE);
  }
}

function normalizeEventData(input: EventInput) {
  const date = normalizeEventDateFields(input);
  return stripEmpty({
    type: input.type,
    dateExact: date.dateExact ? new Date(date.dateExact) : null,
    dateYear: date.dateYear,
    dateMonth: date.dateMonth,
    dateDay: date.dateDay,
    dateText: input.dateText ?? null,
    dateIsApprox: input.dateIsApprox ?? false,
    descriptionMd: input.description ?? null,
  });
}

export async function addEvent(
  personId: string,
  input: EventInput,
  role: string = "subject",
): Promise<{ eventId: string }> {
  const session = await requireEventEditor(personId);
  const db = auditedPrisma(session.user, "Add person event");
  assertValidEvent(input);
  if (input.locationText != null && (typeof input.locationText !== "string" || input.locationText.length > 500)) {
    throw new Error("Location must be 500 characters or fewer.");
  }
  const event = await eventTransaction(db, async (tx) => {
    if (session.user.role !== "ADMIN") await assertVerifiedEventOwner(tx, session.user.id, personId);
    const person = await tx.person.findUnique({ where: { id: personId }, select: { id: true } });
    if (!person) throw new Error("That person could not be found. Refresh the page and try again.");
    const placeId = await resolveOrCreateEventPlace(tx, input.locationText);
    return tx.event.create({
      data: {
        ...normalizeEventData(input),
        placeId,
        personEvents: { create: { personId, role: session.user.role === "ADMIN" ? role : "subject" } },
      } as never,
      select: { id: true },
    });
  });
  await logActivity({
    actorUserId: session.user.id,
    type: "EVENT_CREATED",
    entityType: "person",
    entityId: personId,
    message: `Added ${input.type.toLowerCase()} event for ${personId}`,
    meta: { eventId: event.id, ...input },
  });
  revalidatePath(`/people/${personId}`);
  return { eventId: event.id };
}

export async function updateEvent(
  eventId: string,
  personId: string,
  input: EventInput,
): Promise<void> {
  const session = await requireEventEditor(personId);
  const db = auditedPrisma(session.user, "Update person event");
  assertValidEvent(input);
  if (input.locationText != null && (typeof input.locationText !== "string" || input.locationText.length > 500)) {
    throw new Error("Location must be 500 characters or fewer.");
  }
  await eventTransaction(db, async (tx) => {
    const linkage = await tx.personEvent.findFirst({ where: { eventId, personId }, select: { id: true } });
    if (!linkage) throw new Error("This event is no longer linked to that person. Refresh the page and try again.");
    if (session.user.role !== "ADMIN") {
      await assertVerifiedEventOwner(tx, session.user.id, personId);
      await assertPersonalEvent(tx, eventId, personId);
    }
    const placeId = await resolveOrCreateEventPlace(tx, input.locationText);
    return tx.event.update({
      where: { id: eventId },
      data: { ...normalizeEventData(input), placeId } as never,
    });
  });
  await logActivity({
    actorUserId: session.user.id,
    type: "EVENT_UPDATED",
    entityType: "person",
    entityId: personId,
    message: `Updated ${input.type.toLowerCase()} event`,
    meta: { eventId, ...input },
  });
  revalidatePath(`/people/${personId}`);
}

export async function deleteEvent(eventId: string, personId: string): Promise<void> {
  const session = await requireEventEditor(personId);
  const db = auditedPrisma(session.user, "Delete person event");
  await eventTransaction(db, async (tx) => {
    const linkage = await tx.personEvent.findFirst({ where: { eventId, personId }, select: { id: true } });
    if (!linkage) throw new Error("This event is no longer linked to that person. Refresh the page and try again.");
    if (session.user.role !== "ADMIN") {
      await assertVerifiedEventOwner(tx, session.user.id, personId);
      await assertPersonalEvent(tx, eventId, personId);
    }
    await tx.event.delete({ where: { id: eventId } });
  });
  await logActivity({
    actorUserId: session.user.id,
    type: "EVENT_DELETED",
    entityType: "person",
    entityId: personId,
    message: `Removed event`,
    meta: { eventId },
  });
  revalidatePath(`/people/${personId}`);
}

// ─── Relationships ────────────────────────────────────────────

export async function addParent(childId: string, parentId: string, type: string = "BIOLOGICAL"): Promise<void> {
  const session = await requireAdmin();
  const db = auditedPrisma(session.user, "Add parent-child relationship");
  assertValidParentType(type);
  if (childId === parentId) throw new Error("A person cannot be their own parent.");
  try {
    await db.$transaction(async (tx) => {
      const [parent, child] = await Promise.all([
        tx.person.findUnique({ where: { id: parentId }, select: { id: true } }),
        tx.person.findUnique({ where: { id: childId }, select: { id: true } }),
      ]);
      if (!parent || !child) throw new Error("That person could not be found. Refresh the page and try again.");
      const edges = await tx.parentChild.findMany({ select: { parentId: true, childId: true } });
      if (wouldCreateParentCycle(edges, parentId, childId)) {
        throw new Error("This parent relationship would create a family tree cycle. Remove the conflicting link first.");
      }
      await tx.parentChild.upsert({
        where: { parentId_childId: { parentId, childId } },
        update: { type },
        create: { parentId, childId, type },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2034") {
      throw new Error("The family tree changed while saving. Refresh the page and try again.");
    }
    throw error;
  }
  const [parent, child] = await Promise.all([
    db.person.findUnique({ where: { id: parentId } }),
    db.person.findUnique({ where: { id: childId } }),
  ]);
  await logActivity({
    actorUserId: session.user.id,
    type: "RELATIONSHIP_CREATED",
    entityType: "person",
    entityId: childId,
    message: `Linked ${parent?.displayName ?? "parent"} as parent of ${child?.displayName ?? "child"}`,
    meta: { parentId, childId, kind: "parent" },
  });
  revalidatePath(`/people/${childId}`);
  revalidatePath(`/people/${parentId}`);
}

export async function removeParentChild(parentId: string, childId: string): Promise<void> {
  const session = await requireAdmin();
  const db = auditedPrisma(session.user, "Remove parent-child relationship");
  const relationship = await db.parentChild.findUnique({ where: { parentId_childId: { parentId, childId } }, select: { id: true } });
  if (!relationship) throw new Error("That parent relationship no longer exists. Refresh the page and try again.");
  await db.parentChild.delete({
    where: { parentId_childId: { parentId, childId } },
  });
  await logActivity({
    actorUserId: session.user.id,
    type: "RELATIONSHIP_DELETED",
    entityType: "person",
    entityId: childId,
    message: `Unlinked parent-child`,
    meta: { parentId, childId },
  });
  revalidatePath(`/people/${childId}`);
  revalidatePath(`/people/${parentId}`);
}

export async function addPartnership(
  personAId: string,
  personBId: string,
  type: "MARRIAGE" | "PARTNER" | "UNKNOWN" = "MARRIAGE",
  notes?: string,
): Promise<void> {
  const session = await requireAdmin();
  const db = auditedPrisma(session.user, "Add partnership");
  if (personAId === personBId) throw new Error("A person cannot partner with themselves");
  if (!["MARRIAGE", "PARTNER", "UNKNOWN"].includes(type)) throw new Error("Choose a valid partnership type.");
  // Normalise ordering so (a,b) and (b,a) don't duplicate
  const [a, b] = [personAId, personBId].sort();
  const people = await db.person.findMany({ where: { id: { in: [a, b] } }, select: { id: true } });
  if (people.length !== 2) throw new Error("That person could not be found. Refresh the page and try again.");
  await db.partnership.upsert({
    where: { personAId_personBId: { personAId: a, personBId: b } },
    update: { type, notesMd: notes ?? null },
    create: { personAId: a, personBId: b, type, notesMd: notes ?? null },
  });
  const [pa, pb] = await Promise.all([
    db.person.findUnique({ where: { id: a } }),
    db.person.findUnique({ where: { id: b } }),
  ]);
  await logActivity({
    actorUserId: session.user.id,
    type: "RELATIONSHIP_CREATED",
    entityType: "person",
    entityId: personAId,
    message: `Linked ${pa?.displayName} with ${pb?.displayName} (${type.toLowerCase()})`,
    meta: { personAId: a, personBId: b, type },
  });
  revalidatePath(`/people/${personAId}`);
  revalidatePath(`/people/${personBId}`);
}

export async function removePartnership(partnershipId: string): Promise<void> {
  const session = await requireAdmin();
  const db = auditedPrisma(session.user, "Remove partnership");
  const p = await db.partnership.findUnique({ where: { id: partnershipId } });
  if (!p) return;
  await db.partnership.delete({ where: { id: partnershipId } });
  await logActivity({
    actorUserId: session.user.id,
    type: "RELATIONSHIP_DELETED",
    entityType: "person",
    entityId: p.personAId,
    message: `Removed partnership`,
    meta: { partnershipId, personAId: p.personAId, personBId: p.personBId },
  });
  revalidatePath(`/people/${p.personAId}`);
  revalidatePath(`/people/${p.personBId}`);
}

// ─── Tags ─────────────────────────────────────────────────────

export async function addTag(personId: string, rawName: string): Promise<void> {
  const session = await requireAdmin();
  const db = auditedPrisma(session.user, "Add person tag");
  const name = rawName.trim();
  if (!name) throw new Error("Tag name is required");
  if (name.length > 100) throw new Error("Tag name must be 100 characters or fewer.");

  const { tag, person } = await db.$transaction(async (tx) => {
    const person = await tx.person.findUnique({ where: { id: personId }, select: { id: true, displayName: true } });
    if (!person) throw new Error("That person could not be found. Refresh the page and try again.");
    // Serialize the case-insensitive lookup with creation and linking. This also
    // ensures a failed link cannot leave an unreferenced tag behind.
    const existing = await tx.tag.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    const tag = existing ?? await tx.tag.create({ data: { name } });
    await tx.tagLink.upsert({
      where: { tagId_entityType_entityId: { tagId: tag.id, entityType: "PERSON", entityId: personId } },
      update: {},
      create: { tagId: tag.id, entityType: "PERSON", entityId: personId },
    });
    return { tag, person };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await logActivity({
    actorUserId: session.user.id,
    type: "TAG_ADDED",
    entityType: "person",
    entityId: personId,
    message: `Tagged ${person?.displayName ?? personId} with "${tag.name}"`,
    meta: { tagId: tag.id, tagName: tag.name },
  });
  revalidatePath(`/people/${personId}`);
}

export async function removeTag(personId: string, tagId: string): Promise<void> {
  const session = await requireAdmin();
  const db = auditedPrisma(session.user, "Remove family tag");
  await db.$transaction(async (tx) => {
    await tx.tagLink.deleteMany({ where: { tagId, entityType: "PERSON", entityId: personId } });
    // Clean up orphaned tags (no remaining links) to keep the tag list tidy.
    const remaining = await tx.tagLink.count({ where: { tagId } });
    if (remaining === 0) await tx.tag.deleteMany({ where: { id: tagId } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  revalidatePath(`/people/${personId}`);
}

// ─── Contact ──────────────────────────────────────────────────

export interface ContactPatch {
  emails?: string[];
  mobile?: string | null;
  landline?: string | null;
  address2000?: string | null;
  postalAddress2021?: string | null;
  comments?: string | null;
}

export async function upsertContact(personId: string, patch: ContactPatch): Promise<void> {
  const session = await requireOwnedPerson(personId);
  if (!patch || typeof patch !== "object" || Array.isArray(patch) ||
    Object.keys(patch).some((key) => !["emails", "mobile", "landline", "address2000", "postalAddress2021", "comments"].includes(key)) ||
    (patch.emails !== undefined && (!Array.isArray(patch.emails) || patch.emails.length > 10 || patch.emails.some((email) => typeof email !== "string" || email.length > 320))) ||
    [patch.mobile, patch.landline, patch.address2000, patch.postalAddress2021, patch.comments]
      .some((value) => value !== undefined && value !== null && (typeof value !== "string" || value.length > 5000))) {
    throw new Error("Contact details contain unsupported fields.");
  }
  const db = auditedPrisma(session.user, "Update person contact details");
  const data = {
    emails: patch.emails ?? [],
    mobile: patch.mobile ?? null,
    landline: patch.landline ?? null,
    address2000: patch.address2000 ?? null,
    postalAddress2021: patch.postalAddress2021 ?? null,
    comments: patch.comments ?? null,
  };
  await db.contact.upsert({
    where: { personId },
    update: data,
    create: { personId, ...data },
  });
  await logActivity({
    actorUserId: session.user.id,
    type: "ENTITY_UPDATED",
    entityType: "contact",
    entityId: personId,
    message: `Updated contact details`,
  });
  revalidatePath(`/people/${personId}`);
}

// ─── Notes ────────────────────────────────────────────────────

export interface NoteInput {
  title?: string | null;
  markdown: string;
  tiptapJson?: unknown;
}

export async function createNote(
  entityType: "PERSON" | "EVENT" | "RELATIONSHIP" | "PLACE",
  entityId: string,
  input: NoteInput,
): Promise<{ id: string }> {
  const session = await requirePermission("notes.edit");
  if (session.user.role !== "ADMIN") {
    if (entityType !== "PERSON") throw new AuthzError(403, "Only admins can edit notes for shared records.");
    await requireOwnedPerson(entityId, "notes.edit");
  }
  if (!entityId || typeof entityId !== "string" || !input || typeof input.markdown !== "string" ||
    input.markdown.length > 50_000 || (input.title != null && (typeof input.title !== "string" || input.title.length > 300))) {
    throw new Error("Note content is invalid or too long.");
  }
  const db = auditedPrisma(session.user, "Create family note");
  const note = await db.note.create({
    data: {
      entityType,
      entityId,
      title: input.title ?? null,
      markdown: input.markdown,
      tiptapJson: (input.tiptapJson ?? null) as never,
      createdByUserId: session.user.id,
    },
  });
  await logActivity({
    actorUserId: session.user.id,
    type: "NOTE_CREATED",
    entityType: entityType.toLowerCase(),
    entityId,
    message: `Added note${input.title ? `: ${input.title}` : ""}`,
    meta: { noteId: note.id },
  });
  revalidatePath(`/people/${entityId}`);
  return { id: note.id };
}

export async function updateNote(
  noteId: string,
  input: NoteInput,
): Promise<void> {
  const session = await requirePermission("notes.edit");
  const existing = await prisma.note.findUniqueOrThrow({ where: { id: noteId } });
  if (session.user.role !== "ADMIN") {
    if (existing.entityType !== "PERSON") throw new AuthzError(403, "Only admins can edit notes for shared records.");
    await requireOwnedPerson(existing.entityId, "notes.edit");
  }
  if (!input || typeof input.markdown !== "string" || input.markdown.length > 50_000 ||
    (input.title != null && (typeof input.title !== "string" || input.title.length > 300))) {
    throw new Error("Note content is invalid or too long.");
  }
  const db = auditedPrisma(session.user, "Update family note");
  await db.note.update({
    where: { id: noteId },
    data: {
      title: input.title ?? null,
      markdown: input.markdown,
      tiptapJson: (input.tiptapJson ?? null) as never,
    },
  });
  await logActivity({
    actorUserId: session.user.id,
    type: "NOTE_UPDATED",
    entityType: existing.entityType.toLowerCase(),
    entityId: existing.entityId,
    message: `Updated note${input.title ? `: ${input.title}` : ""}`,
    meta: { noteId },
  });
  revalidatePath(`/people/${existing.entityId}`);
}

export async function deleteNote(noteId: string): Promise<void> {
  const session = await requirePermission("notes.edit");
  const existing = await prisma.note.findUniqueOrThrow({ where: { id: noteId } });
  if (session.user.role !== "ADMIN") {
    if (existing.entityType !== "PERSON") throw new AuthzError(403, "Only admins can edit notes for shared records.");
    await requireOwnedPerson(existing.entityId, "notes.edit");
  }
  const db = auditedPrisma(session.user, "Delete family note");
  await db.note.delete({ where: { id: noteId } });
  await logActivity({
    actorUserId: session.user.id,
    type: "NOTE_DELETED",
    entityType: existing.entityType.toLowerCase(),
    entityId: existing.entityId,
    message: `Deleted note`,
    meta: { noteId },
  });
  revalidatePath(`/people/${existing.entityId}`);
}
