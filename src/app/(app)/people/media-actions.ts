"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { logActivity } from "@/lib/activity";

interface AttachMediaInput {
  personId: string;
  blobUrl: string;
  mimeType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  caption?: string | null;
}

export async function attachMediaToPerson(input: AttachMediaInput): Promise<{ mediaId: string }> {
  const session = await requireAdmin();

  const existingLinksCount = await prisma.mediaLink.count({
    where: { entityType: "PERSON", entityId: input.personId },
  });

  const [media] = await prisma.$transaction([
    prisma.media.create({
      data: {
        type: "PHOTO",
        blobUrl: input.blobUrl,
        mimeType: input.mimeType ?? null,
        fileSize: input.fileSize ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        caption: input.caption ?? null,
        createdByUserId: session.user.id,
      },
    }),
  ]);

  await prisma.mediaLink.create({
    data: {
      mediaId: media.id,
      entityType: "PERSON",
      entityId: input.personId,
      isPrimary: existingLinksCount === 0,
      sortOrder: existingLinksCount,
    },
  });

  const person = await prisma.person.findUnique({ where: { id: input.personId } });
  await logActivity({
    actorUserId: session.user.id,
    type: "MEDIA_ADDED",
    entityType: "person",
    entityId: input.personId,
    message: `Added a photo to ${person?.displayName ?? "person"}`,
    meta: { mediaId: media.id },
  });

  revalidatePath(`/people/${input.personId}`);
  return { mediaId: media.id };
}

export async function removeMediaFromPerson(mediaId: string, personId: string): Promise<void> {
  const session = await requireAdmin();

  await prisma.mediaLink.deleteMany({
    where: { mediaId, entityType: "PERSON", entityId: personId },
  });

  // If no other entity links reference this media, also delete the media row.
  const remaining = await prisma.mediaLink.count({ where: { mediaId } });
  if (remaining === 0) {
    await prisma.media.delete({ where: { id: mediaId } });
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

export async function setPrimaryMedia(mediaId: string, personId: string): Promise<void> {
  const session = await requireAdmin();
  await prisma.$transaction([
    prisma.mediaLink.updateMany({
      where: { entityType: "PERSON", entityId: personId },
      data: { isPrimary: false },
    }),
    prisma.mediaLink.updateMany({
      where: { mediaId, entityType: "PERSON", entityId: personId },
      data: { isPrimary: true },
    }),
  ]);
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
