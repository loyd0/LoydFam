"use server";

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { appUrl, sendMail } from "@/lib/email";
import { renderPasswordResetEmail } from "@/lib/emails/templates";

const EXPIRES_MINUTES = 60;

function newToken(): string {
  return randomBytes(24).toString("hex");
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const normalized = email.trim().toLowerCase();
  const friendly = {
    message: "If that email is in our records, a reset link has been sent.",
  };
  if (!normalized || !normalized.includes("@")) return friendly;

  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) return friendly;

  const token = newToken();
  const expiresAt = new Date(Date.now() + EXPIRES_MINUTES * 60 * 1000);

  await prisma.passwordReset.create({
    data: { userId: user.id, token, expiresAt },
  });

  const resetUrl = appUrl(`/reset-password/${token}`);
  const { html, text } = await renderPasswordResetEmail({
    name: user.name,
    resetUrl,
    expiresMinutes: EXPIRES_MINUTES,
  });

  await sendMail({
    to: user.email,
    subject: "Reset your Loyd Family password",
    html,
    text,
  });

  return friendly;
}
