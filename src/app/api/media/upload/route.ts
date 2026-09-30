import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AuthzError, requireOwnedPerson } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { hasMediaSignature, mediaPathname } from "@/lib/media-url";

const MAX_UPLOAD_SIZE = 4 * 1024 * 1024;
class UploadInputError extends Error {}
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Vercel Blob is not configured (missing BLOB_READ_WRITE_TOKEN)." }, { status: 503 });
  }

  try {
    const form = await request.formData();
    const personId = form.get("personId");
    const file = form.get("file");
    if (typeof personId !== "string" || !(file instanceof File)) {
      throw new UploadInputError("A person and file are required.");
    }
    await requireOwnedPerson(personId, "media.upload");
    if (!(await prisma.person.findUnique({ where: { id: personId }, select: { id: true } }))) {
      throw new UploadInputError("Person not found.");
    }
    const extension = EXTENSION_BY_MIME[file.type];
    if (!extension || file.size <= 0 || file.size > MAX_UPLOAD_SIZE) {
      throw new UploadInputError("Choose a supported image or PDF smaller than 4 MB.");
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!hasMediaSignature(bytes, file.type)) {
      throw new UploadInputError("File content does not match an allowed image or PDF.");
    }
    const pathname = `media/${personId}/${randomUUID()}.${extension}`;
    if (mediaPathname(personId, pathname)?.mimeType !== file.type) {
      throw new UploadInputError("Invalid media upload path or file type.");
    }
    await put(pathname, bytes, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: file.type,
    });
    return NextResponse.json({ blobKey: pathname });
  } catch (err) {
    if (err instanceof AuthzError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof UploadInputError) return NextResponse.json({ error: err.message }, { status: 400 });
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 502 });
  }
}
