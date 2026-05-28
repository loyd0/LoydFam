"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { logActivity, describeChange } from "@/lib/activity";

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
  const displayName = buildDisplayName(patch);
  const person = await prisma.person.create({
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
  const session = await requireAdmin();
  const before = await prisma.person.findUniqueOrThrow({ where: { id } });
  const merged = { ...before, ...stripEmpty(patch) };
  const displayName = buildDisplayName(merged);

  const updated = await prisma.person.update({
    where: { id },
    data: { ...stripEmpty(patch), displayName },
  });

  const { changed, diff } = describeChange(
    before as unknown as Record<string, unknown>,
    { ...stripEmpty(patch), displayName } as Partial<Record<string, unknown>>,
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
  const person = await prisma.person.findUniqueOrThrow({ where: { id } });
  await prisma.person.delete({ where: { id } });
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
}

function normalizeEventData(input: EventInput) {
  return stripEmpty({
    type: input.type,
    dateExact: input.dateExact ? new Date(input.dateExact) : null,
    dateYear: input.dateYear ?? null,
    dateMonth: input.dateMonth ?? null,
    dateDay: input.dateDay ?? null,
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
  const session = await requireAdmin();
  const event = await prisma.event.create({
    data: {
      ...normalizeEventData(input),
      personEvents: { create: { personId, role } },
    } as never,
  });
  const person = await prisma.person.findUnique({ where: { id: personId } });
  await logActivity({
    actorUserId: session.user.id,
    type: "EVENT_CREATED",
    entityType: "person",
    entityId: personId,
    message: `Added ${input.type.toLowerCase()} event for ${person?.displayName ?? personId}`,
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
  const session = await requireAdmin();
  await prisma.event.update({
    where: { id: eventId },
    data: normalizeEventData(input) as never,
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
  const session = await requireAdmin();
  await prisma.event.delete({ where: { id: eventId } });
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
  if (childId === parentId) throw new Error("A person cannot be their own parent");
  await prisma.parentChild.upsert({
    where: { parentId_childId: { parentId, childId } },
    update: { type: type as never },
    create: { parentId, childId, type: type as never },
  });
  const [parent, child] = await Promise.all([
    prisma.person.findUnique({ where: { id: parentId } }),
    prisma.person.findUnique({ where: { id: childId } }),
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
  await prisma.parentChild.delete({
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
  if (personAId === personBId) throw new Error("A person cannot partner with themselves");
  // Normalise ordering so (a,b) and (b,a) don't duplicate
  const [a, b] = [personAId, personBId].sort();
  await prisma.partnership.upsert({
    where: { personAId_personBId: { personAId: a, personBId: b } },
    update: { type, notesMd: notes ?? null },
    create: { personAId: a, personBId: b, type, notesMd: notes ?? null },
  });
  const [pa, pb] = await Promise.all([
    prisma.person.findUnique({ where: { id: a } }),
    prisma.person.findUnique({ where: { id: b } }),
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
  const p = await prisma.partnership.findUnique({ where: { id: partnershipId } });
  if (!p) return;
  await prisma.partnership.delete({ where: { id: partnershipId } });
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
  const name = rawName.trim();
  if (!name) throw new Error("Tag name is required");

  // Find or create the tag (case-insensitive match on name).
  const existing = await prisma.tag.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  const tag = existing ?? (await prisma.tag.create({ data: { name } }));

  await prisma.tagLink.upsert({
    where: {
      tagId_entityType_entityId: { tagId: tag.id, entityType: "PERSON", entityId: personId },
    },
    update: {},
    create: { tagId: tag.id, entityType: "PERSON", entityId: personId },
  });

  const person = await prisma.person.findUnique({ where: { id: personId } });
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
  await requireAdmin();
  await prisma.tagLink.deleteMany({
    where: { tagId, entityType: "PERSON", entityId: personId },
  });
  // Clean up orphaned tags (no remaining links) to keep the tag list tidy.
  const remaining = await prisma.tagLink.count({ where: { tagId } });
  if (remaining === 0) {
    await prisma.tag.delete({ where: { id: tagId } }).catch(() => {});
  }
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
  const session = await requireAdmin();
  const data = {
    emails: patch.emails ?? [],
    mobile: patch.mobile ?? null,
    landline: patch.landline ?? null,
    address2000: patch.address2000 ?? null,
    postalAddress2021: patch.postalAddress2021 ?? null,
    comments: patch.comments ?? null,
  };
  await prisma.contact.upsert({
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
  const session = await requireAdmin();
  const note = await prisma.note.create({
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
  const session = await requireAdmin();
  const existing = await prisma.note.findUniqueOrThrow({ where: { id: noteId } });
  await prisma.note.update({
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
  const session = await requireAdmin();
  const existing = await prisma.note.findUniqueOrThrow({ where: { id: noteId } });
  await prisma.note.delete({ where: { id: noteId } });
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
