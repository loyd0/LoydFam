import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { auditedPrisma } from "@/lib/audited-prisma";
import { prisma } from "@/lib/prisma";
import { getUserPermissions } from "@/lib/permission-store";
import { SCOPE_PERMISSIONS } from "@/lib/saved-view-permissions";

/** Delete one of the current user's saved views. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.savedView.findFirst({ where: { id, userId: session.user.id }, select: { scope: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const permissions = await getUserPermissions(session.user);
  if (!permissions[SCOPE_PERMISSIONS[existing.scope]]) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // Scope the delete to the owner so users can't remove others' views.
  const result = await auditedPrisma(session.user, "Delete saved view").savedView.deleteMany({
    where: { id, userId: session.user.id },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
