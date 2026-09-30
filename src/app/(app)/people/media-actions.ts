"use server";

import { revalidatePath } from "next/cache";
import { del, get, head } from "@vercel/blob";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { auditedPrisma } from "@/lib/audited-prisma";
import { requireOwnedPerson } from "@/lib/authz";
import { logActivity } from "@/lib/activity";
import { hasMediaSignature, mediaPathname } from "@/lib/media-url";

const MAX_UPLOAD_SIZE = 4 * 1024 * 1024;

interface AttachMediaInput {
  personId: string;
  blobKey: string;
  width?: number;
  height?: number;
  caption?: string | null;
}

async function verifyPrivateUpload(personId: string, blobKey: string) {
  const path = mediaPathname(personId, blobKey);
  if (!path?.mimeType) throw new Error("Invalid media upload path.");

  const metadata = await head(blobKey);
  if (metadata.pathname !== blobKey || metadata.size <= 0 || metadata.size > MAX_UPLOAD_SIZE) {
    throw new Error("Uploaded file is missing or exceeds the 4 MB limit.");
  }
  if (metadata.contentType !== path.mimeType) {
    throw new Error("File type does not match the uploaded file extension.");
  }

  const result = await get(blobKey, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error("Could not verify the uploaded file.");
  }
  const reader = result.stream.getReader();
  let bytes = new Uint8Array();
  try {
    while (bytes.length < 16) {
      const chunk = await reader.read();
      if (chunk.done) break;
      const combined = new Uint8Array(bytes.length + chunk.value.length);
      combined.set(bytes);
      combined.set(chunk.value, bytes.length);
      bytes = combined;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  if (!hasMediaSignature(bytes, path.mimeType)) {
    throw new Error("Uploaded file content does not match an allowed image or PDF.");
  }

  return { blobUrl: metadata.url, mimeType: metadata.contentType, fileSize: metadata.size };
}

export async function attachMediaToPerson(input: AttachMediaInput): Promise<{ mediaId: string }> {
  const session = await requireOwnedPerson(input.personId, "media.upload");
  const db = auditedPrisma(session.user, "Attach media to a family person");
  const verified = await verifyPrivateUpload(input.personId, input.blobKey);
  let media;
  try {
    media = await db.$transaction(async (tx) => {
      const person = await tx.person.findUnique({ where: { id: input.personId }, select: { id: true } });
      if (!person) throw new Error("Person not found.");
      const existing = await tx.media.findUnique({ where: { blobKey: input.blobKey }, select: { id: true } });
      if (existing) throw new Error("This uploaded file has already been attached.");
      const existingLinksCount = await tx.mediaLink.count({
        where: { entityType: "PERSON", entityId: input.personId },
      });
      const existingPhotoCount = await tx.mediaLink.count({
        where: { entityType: "PERSON", entityId: input.personId, media: { type: "PHOTO" } },
      });
      const record = await tx.media.create({
        data: {
          type: verified.mimeType === "application/pdf" ? "DOCUMENT" : "PHOTO",
          blobUrl: verified.blobUrl,
          blobKey: input.blobKey,
          mimeType: verified.mimeType,
          fileSize: verified.fileSize,
          width: input.width ?? null,
          height: input.height ?? null,
          caption: input.caption?.trim().slice(0, 500) || null,
          createdByUserId: session.user.id,
        },
      });
      await tx.mediaLink.create({
        data: {
          mediaId: record.id,
          entityType: "PERSON",
          entityId: input.personId,
          isPrimary: existingPhotoCount === 0 && verified.mimeType !== "application/pdf",
          sortOrder: existingLinksCount,
        },
      });
      return record;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("This uploaded file has already been attached.");
    }
    throw error;
  }

  const person = await prisma.person.findUnique({ where: { id: input.personId } });
  await logActivity({
    actorUserId: session.user.id,
    type: "MEDIA_ADDED",
    entityType: "person",
    entityId: input.personId,
    message: `Added media to ${person?.displayName ?? "person"}`,
    meta: { mediaId: media.id },
  });

  revalidatePath(`/people/${input.personId}`);
  return { mediaId: media.id };
}

export async function removeMediaFromPerson(mediaId: string, personId: string): Promise<void> {
  const session = await requireOwnedPerson(personId, "media.upload");
  const db = auditedPrisma(session.user, "Remove media from a family person");

  const removed = await db.mediaLink.deleteMany({
    where: { mediaId, entityType: "PERSON", entityId: personId },
  });
  if (removed.count !== 1) throw new Error("This media is no longer attached to that person.");

  // If no other entity links reference this media, remove its metadata and private blob.
  const remaining = await prisma.mediaLink.count({ where: { mediaId } });
  if (remaining === 0) {
    const media = await prisma.media.findUnique({ where: { id: mediaId }, select: { blobKey: true } });
    await db.media.delete({ where: { id: mediaId } });
    if (media?.blobKey) await del(media.blobKey).catch(() => undefined);
  }

  await logActivity({
    actorUserId: session.user.id,
    type: "MEDIA_DELETED",
    entityType: "person",
    entityId: personId,
    message: "Removed a photo",
    meta: { mediaId },
  });

  revalidatePath(`/people/${personId}`);
}

export async function updateMediaCaption(mediaId: string, personId: string, caption: string): Promise<void> {
  const session = await requireOwnedPerson(personId, "media.upload");
  const db = auditedPrisma(session.user, "Update family media caption");
  const link = await prisma.mediaLink.findFirst({
    where: { mediaId, entityType: "PERSON", entityId: personId },
    select: { id: true },
  });
  if (!link) throw new Error("Media is not attached to this person.");
  await db.media.update({
    where: { id: mediaId },
    data: { caption: caption.trim().slice(0, 500) || null },
  });
  revalidatePath(`/people/${personId}`);
}

export async function setPrimaryMedia(mediaId: string, personId: string): Promise<void> {
  const session = await requireOwnedPerson(personId, "media.upload");
  const db = auditedPrisma(session.user, "Change primary family photo");
  const photoLink = await prisma.mediaLink.findFirst({
    where: { mediaId, entityType: "PERSON", entityId: personId, media: { type: "PHOTO" } },
    select: { id: true },
  });
  if (!photoLink) throw new Error("Only photos can be set as primary.");
  await db.$transaction(async (tx) => {
    await tx.mediaLink.updateMany({
      where: { entityType: "PERSON", entityId: personId },
      data: { isPrimary: false },
    });
    await tx.mediaLink.updateMany({
      where: { mediaId, entityType: "PERSON", entityId: personId },
      data: { isPrimary: true },
    });
  });
  await logActivity({
    actorUserId: session.user.id,
    type: "ENTITY_UPDATED",
    entityType: "person",
    entityId: personId,
    message: "Set primary photo",
    meta: { mediaId },
  });
  revalidatePath(`/people/${personId}`);
}
