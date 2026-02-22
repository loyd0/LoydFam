import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password;
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [users, invites] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    }),
    prisma.invite.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        usedAt: true,
      },
    }),
  ]);

  return NextResponse.json({ users, invites });
}

/** POST — create a new user (invite) with a temporary password */
export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const email = body.email?.trim()?.toLowerCase();
  const role = body.role === "ADMIN" ? "ADMIN" : "VIEWER";
  const name = body.name?.trim() || null;

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "Valid email required" },
      { status: 400 }
    );
  }

  // Check already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json(
      { error: "This email is already registered" },
      { status: 409 }
    );
  }

  const tempPassword = generateTempPassword();
  const hash = await bcrypt.hash(tempPassword, 12);

  // Create the user + invite record in a transaction
  const [user] = await prisma.$transaction([
    prisma.user.create({
      data: { email, name, passwordHash: hash, role },
    }),
    prisma.invite.upsert({
      where: { email },
      update: { status: "ACCEPTED", role, invitedBy: session.user.id, usedAt: new Date() },
      create: { email, role, status: "ACCEPTED", invitedBy: session.user.id, usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({
    success: true,
    user: { id: user.id, email: user.email, role: user.role },
    tempPassword,
  });
}

/** PATCH — change a user's role */
export async function PATCH(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { userId, role } = body;

  if (!userId || !["ADMIN", "VIEWER"].includes(role)) {
    return NextResponse.json(
      { error: "Valid userId and role required" },
      { status: 400 }
    );
  }

  // Prevent self-demotion
  if (userId === session.user.id) {
    return NextResponse.json(
      { error: "You cannot change your own role" },
      { status: 400 }
    );
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, email: true, role: true },
  });

  return NextResponse.json({ success: true, user });
}

/** DELETE — remove a user */
export async function DELETE(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "userId required" },
      { status: 400 }
    );
  }

  // Prevent self-deletion
  if (userId === session.user.id) {
    return NextResponse.json(
      { error: "You cannot delete yourself" },
      { status: 400 }
    );
  }

  await prisma.user.delete({ where: { id: userId } });

  return NextResponse.json({ success: true });
}
