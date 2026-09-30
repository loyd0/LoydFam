"use server";

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { appUrl, emailConfigured, sendMail } from "@/lib/email";
import { renderPasswordResetEmail } from "@/lib/emails/templates";
import { isAccountToken } from "@/lib/account-token";

const EXPIRES_MINUTES = 60;

function newToken(): string {
  return randomBytes(24).toString("hex");
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  if (!emailConfigured()) {
    return { message: "Password reset email is not configured yet. Please contact the family administrator for help." };
  }
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  const friendly = {
    message: "If that email is in our records, we’ll attempt to send a reset link. If it doesn’t arrive, contact the family administrator.",
  };
  if (!normalized || !normalized.includes("@")) return friendly;

  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) return friendly;

  const token = newToken();
  if (!isAccountToken(token)) throw new Error("Unable to create a reset link");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXPIRES_MINUTES * 60 * 1000);

  const reset = await prisma.$transaction(async (tx) => {
    // Serialize reset issuance and consumption per user so only the newest link stays active.
    const lockedUsers = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM users WHERE id = ${user.id} FOR UPDATE
    `;
    if (!lockedUsers.length) return null;
    await tx.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    });
    return tx.passwordReset.create({
      data: { userId: user.id, token, expiresAt },
    });
  });
  if (!reset) return friendly;

  const resetUrl = appUrl(`/reset-password/${token}`);
  const { html, text } = await renderPasswordResetEmail({
    name: user.name,
    resetUrl,
    expiresMinutes: EXPIRES_MINUTES,
  });

  const delivery = await sendMail({
    to: user.email,
    subject: "Reset your Loyd Family password",
    html,
    text,
  });

  // A timeout can happen after the provider accepts the email. Keep this link
  // usable until expiry, consumption, or a newer reset supersedes it.
  if (!delivery.sent && !delivery.uncertain) {
    await prisma.passwordReset.updateMany({ where: { id: reset.id, usedAt: null }, data: { usedAt: new Date() } });
  }

  return friendly;
}
