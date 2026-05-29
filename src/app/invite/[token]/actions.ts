"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

interface AcceptInput {
  token: string;
  name: string | null;
  password: string;
}

export async function acceptInvite({ token, name, password }: AcceptInput): Promise<{ userId: string }> {
  if (password.length < 8) throw new Error("Password must be at least 8 characters");
  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite || invite.status !== "PENDING" || !invite.token) {
    throw new Error("This invite is no longer valid");
  }
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    throw new Error("This invite has expired");
  }

  const existing = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existing) throw new Error("This email already has an account. Please sign in.");

  const hash = await bcrypt.hash(password, 12);

  const [user] = await prisma.$transaction([
    prisma.user.create({
      data: {
        email: invite.email,
        name: name ?? invite.name,
        passwordHash: hash,
        role: invite.role,
      },
    }),
    prisma.invite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", token: null, usedAt: new Date() },
    }),
  ]);

  await logActivity({
    actorUserId: user.id,
    type: "USER_JOINED",
    entityType: "user",
    entityId: user.id,
    message: `${user.name || user.email} joined`,
  });

  return { userId: user.id };
}
