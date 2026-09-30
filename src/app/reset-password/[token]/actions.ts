"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auditedPrisma } from "@/lib/audited-prisma";
import { logActivity } from "@/lib/activity";
import { isAccountToken, isExpiredAt } from "@/lib/account-token";

export async function resetPassword(input: { token: string; password: string }): Promise<void> {
  if (!input || typeof input !== "object") throw new Error("Reset link is invalid or expired");
  const { token, password } = input;
  if (!isAccountToken(token)) throw new Error("Reset link is invalid or expired");
  if (typeof password !== "string" || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("Password must be at least 8 characters and no more than 72 UTF-8 bytes");
  }
  const reset = await prisma.passwordReset.findUnique({ where: { token } });
  if (!reset || reset.usedAt || isExpiredAt(reset.expiresAt, new Date())) {
    throw new Error("Reset link is invalid or expired");
  }

  const hash = await bcrypt.hash(password, 12);
  const now = new Date();
  const db = auditedPrisma({ id: reset.userId, name: "Account owner (password reset)" }, "Reset account password using a valid reset link");
  await db.$transaction(async (tx) => {
    // Serialize all reset consumption for this account, including different active links.
    const lockedUsers = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM users WHERE id = ${reset.userId} FOR UPDATE
    `;
    if (!lockedUsers.length) throw new Error("Reset link is invalid or expired");

    const consumed = await tx.passwordReset.updateMany({
      where: {
        id: reset.id,
        userId: reset.userId,
        token,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) throw new Error("Reset link is invalid or expired");

    await tx.user.update({ where: { id: reset.userId }, data: { passwordHash: hash } });
    // Expire any other active resets for this user so they can't be replayed
    await tx.passwordReset.updateMany({
      where: {
        userId: reset.userId,
        id: { not: reset.id },
        usedAt: null,
      },
      data: { usedAt: now },
    });
  });

  await logActivity({
    actorUserId: reset.userId,
    type: "ENTITY_UPDATED",
    entityType: "user",
    entityId: reset.userId,
    message: "Password reset",
  });
}
