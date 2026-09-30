import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readArchivedSourceWorkbook, safeSourceFilename } from "@/lib/source-storage";
import { apiPermissionError } from "@/lib/permission-guards";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await apiPermissionError("sources.download", session.user);
  if (denied) return denied;

  const { id } = await params;
  const run = await prisma.importRun.findUnique({ where: { id }, include: { sourceFile: true } });
  if (!run) return NextResponse.json({ error: "Import run not found" }, { status: 404 });
  if (!run.sourceFile.blobUrl) return NextResponse.json({ error: "Original workbook is not archived" }, { status: 404 });

  try {
    const bytes = await readArchivedSourceWorkbook(run.sourceFile.blobUrl, run.sourceFile.sha256);
    const filename = safeSourceFilename(run.sourceFile.originalFilename);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": String(bytes.byteLength),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Archived workbook could not be verified or downloaded" }, { status: 502 });
  }
}
