"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auditedPrisma } from "@/lib/audited-prisma";
import { logActivity } from "@/lib/activity";
import { isAccountToken, isExpiredAt } from "@/lib/account-token";

interface AcceptInput {
  token: string;
  name: string | null;
  password: string;
}

export async function acceptInvite(input: AcceptInput): Promise<{ userId: string }> {
  if (!input || typeof input !== "object") throw new Error("This invite is no longer valid");
  const { token, name, password } = input;
  if (!isAccountToken(token)) throw new Error("This invite is no longer valid");
  if (typeof password !== "string" || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("Password must be at least 8 characters and no more than 72 UTF-8 bytes");
  }
  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite || invite.status !== "PENDING" || !invite.token) {
    throw new Error("This invite is no longer valid");
  }
  if (isExpiredAt(invite.expiresAt, new Date())) {
    throw new Error("This invite has expired");
  }

  const existing = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existing) throw new Error("This email already has an account. Please sign in.");

  const hash = await bcrypt.hash(password, 12);
  const acceptedAt = new Date();

  const db = auditedPrisma({ name: "Invite accepted" }, "Create account from a valid invitation");
  const user = await db.$transaction(async (tx) => {
    const claim = await tx.invite.updateMany({
      where: {
        id: invite.id,
        token,
        status: "PENDING",
        OR: [{ expiresAt: null }, { expiresAt: { gt: acceptedAt } }],
      },
      data: { status: "ACCEPTED", token: null, usedAt: acceptedAt },
    });
    if (claim.count !== 1) throw new Error("This invite is no longer valid or has expired");

    return tx.user.create({
      data: {
        email: invite.email,
        name: typeof name === "string" ? name.trim().slice(0, 120) || invite.name : invite.name,
        passwordHash: hash,
        role: invite.role,
      },
    });
  });

  await logActivity({
    actorUserId: user.id,
    type: "USER_JOINED",
    entityType: "user",
    entityId: user.id,
    message: `${user.name || user.email} joined`,
  });

  return { userId: user.id };
}
