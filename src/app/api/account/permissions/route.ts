import { NextResponse } from "next/server";
import { requireSession, AuthzError } from "@/lib/authz";
import { getUserPermissions } from "@/lib/permission-store";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requireSession();
    const [permissions, account] = await Promise.all([
      getUserPermissions(session.user),
      prisma.user.findUnique({ where: { id: session.user.id }, select: { verifiedPersonId: true } }),
    ]);
    return NextResponse.json({ permissions, ownedPersonId: account?.verifiedPersonId ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthzError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
