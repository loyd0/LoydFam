"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { logActivity } from "@/lib/activity";
import { appUrl, sendMail } from "@/lib/email";
import { renderInviteEmail } from "@/lib/emails/templates";

const INVITE_EXPIRES_HOURS = 72;

function newToken(): string {
  return randomBytes(24).toString("hex");
}

export interface CreateInviteInput {
  email: string;
  name?: string | null;
  role: "ADMIN" | "VIEWER";
}

export interface CreateInviteResult {
  inviteId: string;
  email: string;
  acceptUrl: string;
  emailSent: boolean;
  emailError?: string;
  emailFallback?: string;
}

export async function createInvite(input: CreateInviteInput): Promise<CreateInviteResult> {
  const session = await requireAdmin();
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Valid email required");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("This email already has an account");

  const token = newToken();
  const expiresAt = new Date(Date.now() + INVITE_EXPIRES_HOURS * 60 * 60 * 1000);

  const invite = await prisma.invite.upsert({
    where: { email },
    create: {
      email,
      name: input.name ?? null,
      role: input.role,
      token,
      expiresAt,
      status: "PENDING",
      invitedBy: session.user.id,
    },
    update: {
      name: input.name ?? null,
      role: input.role,
      token,
      expiresAt,
      status: "PENDING",
      invitedBy: session.user.id,
      usedAt: null,
    },
  });

  const acceptUrl = appUrl(`/invite/${token}`);
  const inviter = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });
  const inviterName = inviter?.name || inviter?.email || "The Loyd admin";

  const { html, text } = await renderInviteEmail({
    name: input.name ?? undefined,
    inviterName,
    acceptUrl,
    expiresHours: INVITE_EXPIRES_HOURS,
  });

  const result = await sendMail({
    to: email,
    subject: "You're invited to the Loyd Family History",
    html,
    text,
  });

  await logActivity({
    actorUserId: session.user.id,
    type: "INVITE_SENT",
    entityType: "user",
    entityId: invite.id,
    message: `Invited ${email} as ${input.role}`,
    meta: { inviteId: invite.id, emailSent: result.sent },
  });

  revalidatePath("/admin/settings");

  return {
    inviteId: invite.id,
    email,
    acceptUrl,
    emailSent: result.sent,
    emailError: result.error,
    emailFallback: result.fallbackMessage,
  };
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const session = await requireAdmin();
  await prisma.invite.update({
    where: { id: inviteId },
    data: { status: "REVOKED", token: null },
  });
  await logActivity({
    actorUserId: session.user.id,
    type: "INVITE_SENT",
    entityType: "user",
    entityId: inviteId,
    message: "Revoked invite",
  });
  revalidatePath("/admin/settings");
}
