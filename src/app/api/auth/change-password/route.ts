import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditedPrisma } from "@/lib/audited-prisma";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Current and new password are required" }, { status: 400 });
  }
  const { currentPassword, newPassword } = body as Record<string, unknown>;

  if (typeof currentPassword !== "string" || typeof newPassword !== "string" || !currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "Current and new password are required" },
      { status: 400 }
    );
  }

  if (newPassword.length < 8 || Buffer.byteLength(newPassword, "utf8") > 72) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters and no more than 72 UTF-8 bytes" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });

  if (!user || !user.passwordHash) {
    return NextResponse.json(
      { error: "Account not found" },
      { status: 404 }
    );
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 403 }
    );
  }

  const hash = await bcrypt.hash(newPassword, 12);
  const changed = await auditedPrisma(session.user, "Change account password").user.updateMany({
    where: { id: session.user.id, passwordHash: user.passwordHash },
    data: { passwordHash: hash },
  });
  if (changed.count !== 1) {
    return NextResponse.json(
      { error: "Password changed while this request was processing. Please sign in again." },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true });
}
