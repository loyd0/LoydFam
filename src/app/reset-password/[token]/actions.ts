"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

export async function resetPassword({ token, password }: { token: string; password: string }): Promise<void> {
  if (password.length < 8) throw new Error("Password must be at least 8 characters");
  const reset = await prisma.passwordReset.findUnique({ where: { token } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    throw new Error("Reset link is invalid or expired");
  }

  const hash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: hash } }),
    prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    // Expire any other active resets for this user so they can't be replayed
    prisma.passwordReset.updateMany({
      where: {
        userId: reset.userId,
        id: { not: reset.id },
        usedAt: null,
      },
      data: { usedAt: new Date() },
    }),
  ]);

  await logActivity({
    actorUserId: reset.userId,
    type: "ENTITY_UPDATED",
    entityType: "user",
    entityId: reset.userId,
    message: "Password reset",
  });
}
