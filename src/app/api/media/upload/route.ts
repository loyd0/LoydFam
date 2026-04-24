import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Vercel Blob is not configured (missing BLOB_READ_WRITE_TOKEN). Ask an admin to set this env var.",
      },
      { status: 503 },
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"],
        maximumSizeInBytes: 20 * 1024 * 1024,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {
        /* No-op: metadata persistence happens in a separate server action after upload */
      },
    });
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 400 },
    );
  }
}
