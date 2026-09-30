import assert from "node:assert/strict";
import Module from "node:module";
import test, { after, mock } from "node:test";

const token = "a".repeat(48);
const expiresAt = new Date(Date.now() + 3_600_000);
let inviteClaimCount = 1;
let resetClaimCount = 1;
let inviteUserCreates = 0;
let passwordUpdates = 0;
let siblingExpirations = 0;
let logCalls = 0;
let delivery = { sent: true, uncertain: false };
let rejectedResetMarks = 0;
let invitedUserExists = false;
const invite = { id: "invite-1", token, status: "PENDING", expiresAt, email: "family@example.com", name: "Family", role: "VIEWER" };
const reset = { id: "reset-1", userId: "user-1", token, usedAt: null, expiresAt };
const tx = {
  invite: { updateMany: async () => ({ count: inviteClaimCount }) },
  user: {
    create: async () => { inviteUserCreates++; return { id: "user-1", email: invite.email, name: invite.name }; },
    update: async () => { passwordUpdates++; return {}; },
  },
  passwordReset: {
    updateMany: async (args: { where: { id?: string; userId?: string; usedAt?: null } }) => {
      if (args.where.id === reset.id) return { count: resetClaimCount };
      siblingExpirations++;
      return { count: 1 };
    },
    create: async (args: { data: { token: string } }) => ({ id: reset.id, token: args.data.token }),
  },
  $queryRaw: async () => [{ id: "user-1" }],
};
const prisma = {
  invite: { findUnique: async () => invite },
  user: { findUnique: async (args: { where: { email?: string } }) => args.where.email ? (invitedUserExists ? { id: "user-1", name: "Family", email: "family@example.com" } : null) : null },
  passwordReset: {
    findUnique: async () => reset,
    updateMany: async () => { rejectedResetMarks++; return { count: 1 }; },
  },
  $transaction: async (fn: (transaction: typeof tx) => Promise<unknown>) => fn(tx),
};
const originalLoad = (Module as typeof Module & { _load: (...args: unknown[]) => unknown })._load;
const loader = mock.method(Module as typeof Module & { _load: (...args: unknown[]) => unknown }, "_load", function (this: unknown, request: string, ...rest: unknown[]) {
  if (request === "@/lib/prisma") return { prisma };
  if (request === "@/lib/audited-prisma") return { auditedPrisma: () => ({ $transaction: prisma.$transaction }) };
  if (request === "@/lib/activity") return { logActivity: async () => { logCalls++; } };
  if (request === "bcryptjs") return { __esModule: true, default: { hash: async () => "hashed-password" }, hash: async () => "hashed-password" };
  if (request === "@/lib/email") return {
    appUrl: (path: string) => `https://family.example${path}`,
    emailConfigured: () => true,
    sendMail: async () => delivery,
  };
  if (request === "@/lib/emails/templates") return { renderPasswordResetEmail: async () => ({ html: "html", text: "text" }) };
  return originalLoad.call(this, request, ...rest);
});
after(() => loader.mock.restore());
const inviteAction = import("../app/invite/[token]/actions");
const resetAction = import("../app/reset-password/[token]/actions");
const forgotAction = import("../app/forgot-password/actions");

test("an invite claim lost to another acceptance creates no user", async () => {
  const { acceptInvite } = await inviteAction;
  inviteClaimCount = 0; inviteUserCreates = 0; logCalls = 0; invitedUserExists = false;
  await assert.rejects(acceptInvite({ token, name: "Family", password: "strong-password" }), /no longer valid or has expired/);
  assert.equal(inviteUserCreates, 0);
  assert.equal(logCalls, 0);
});

test("a reset can be consumed once and expires sibling links", async () => {
  const { resetPassword } = await resetAction;
  resetClaimCount = 1; passwordUpdates = 0; siblingExpirations = 0; logCalls = 0;
  await resetPassword({ token, password: "strong-password" });
  assert.equal(passwordUpdates, 1);
  assert.equal(siblingExpirations, 1);
  assert.equal(logCalls, 1);
  resetClaimCount = 0;
  await assert.rejects(resetPassword({ token, password: "strong-password" }), /invalid or expired/);
  assert.equal(passwordUpdates, 1);
  assert.equal(siblingExpirations, 1);
});

test("an uncertain reset email leaves its token active but a definite rejection burns it", async () => {
  const { requestPasswordReset } = await forgotAction;
  delivery = { sent: false, uncertain: true }; rejectedResetMarks = 0; invitedUserExists = true;
  await requestPasswordReset("family@example.com");
  assert.equal(rejectedResetMarks, 0);
  delivery = { sent: false, uncertain: false };
  await requestPasswordReset("family@example.com");
  assert.equal(rejectedResetMarks, 1);
});
