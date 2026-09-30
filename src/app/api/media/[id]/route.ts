import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mediaPathname } from "@/lib/media-url";
import { apiPermissionError } from "@/lib/permission-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await apiPermissionError("people.view", session.user);
  if (denied) return denied;

  const { id } = await params;
  const media = await prisma.media.findUnique({
    where: { id },
    include: { mediaLinks: { where: { entityType: "PERSON" }, select: { entityId: true } } },
  });
  if (!media?.blobKey || !media.mediaLinks.length) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }
  const storedPath = mediaPathname(media.mediaLinks[0].entityId, media.blobKey);
  if (!storedPath?.mimeType) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  try {
    const blob = await get(media.blobKey, { access: "private", useCache: false });
    if (!blob || blob.statusCode !== 200 || !blob.stream) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }
    const mimeType = blob.blob.contentType;
    if (mimeType !== storedPath.mimeType || mimeType !== media.mimeType) {
      return NextResponse.json({ error: "Media type verification failed" }, { status: 415 });
    }
    const extension = media.blobKey.split(".").pop() ?? "bin";
    const download = request.nextUrl.searchParams.get("download") === "1";
    const headers = new Headers({
      "Content-Type": mimeType,
      "Content-Length": String(blob.blob.size),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="media-${id}.${extension}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    if (mimeType === "application/pdf") headers.set("Content-Security-Policy", "sandbox; default-src 'none'; style-src 'unsafe-inline';");
    return new Response(blob.stream, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: "Unable to retrieve media" }, { status: 502 });
  }
}
