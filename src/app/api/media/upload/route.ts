import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/lib/auth";
import { AuthzError, hasPermission, requireOwnedPerson } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { mediaPathname } from "@/lib/media-url";

const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission("media.upload", session.user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Vercel Blob is not configured (missing BLOB_READ_WRITE_TOKEN). Ask an admin to set this env var.",
      },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as HandleUploadBody;
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const [prefix, personId] = pathname.split("/");
        const file = mediaPathname(personId ?? "", pathname);
        if (prefix !== "media" || !file?.mimeType) {
          throw new Error("Invalid media upload path or file type.");
        }
        await requireOwnedPerson(personId, "media.upload");
        const person = await prisma.person.findUnique({ where: { id: personId }, select: { id: true } });
        if (!person) throw new Error("Person not found.");
        return {
          allowedContentTypes: [file.mimeType],
          maximumSizeInBytes: MAX_UPLOAD_SIZE,
          validUntil: Date.now() + 10 * 60 * 1000,
        };
      },
    });
    return NextResponse.json(json);
  } catch (err) {
    if (err instanceof AuthzError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 400 },
    );
  }
}
