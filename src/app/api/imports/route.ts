import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const runs = await prisma.importRun.findMany({
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    include: { sourceFile: { select: { originalFilename: true, sha256: true, blobUrl: true } }, _count: { select: { sheets: true, issues: true } } },
  });
  return NextResponse.json({ imports: runs.map((run) => ({
    id: run.id,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    filename: run.sourceFile.originalFilename,
    sha256: run.sourceFile.sha256,
    sourceArchived: Boolean(run.sourceFile.blobUrl),
    summary: run.summary,
    sheetsCount: run._count.sheets,
    issuesCount: run._count.issues,
  })) });
}
