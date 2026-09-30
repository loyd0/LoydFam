import assert from "node:assert/strict";
import Module from "node:module";
import test, { after, mock } from "node:test";
import { properties } from "./properties";

const actor = { id: "reviewer-1", role: "ADMIN" };
const changedAt = new Date("2026-09-29T10:00:00.000Z");
const openedAt = new Date("2026-09-29T09:00:00.000Z");
const originalProperty = properties.find((item) => item.paragraphs.length && item.images.length && item.people.length)!;
let personVersion = changedAt;
let amendment: Record<string, unknown>;
let personUpdateCount = 1;
let propertyVersion = 0;
let propertyContent: unknown = null;
let amendmentWrites = 0;
let propertyWrites = 0;
const tx = {
  amendment: {
    findUnique: async () => amendment,
    update: async (args: { data: { status: string } }) => { amendmentWrites++; return { ...amendment, ...args.data }; },
  },
  person: {
    findUnique: async () => ({ id: "person-1", updatedAt: personVersion, givenName1: "A", surname: "Loyd" }),
    updateMany: async () => ({ count: personUpdateCount }),
  },
  propertyArticle: {
    findUnique: async () => propertyContent === null ? null : { version: propertyVersion, content: propertyContent },
    create: async () => { propertyWrites++; return {}; },
    updateMany: async () => { propertyWrites++; return { count: 1 }; },
  },
};
const db = {
  $transaction: async (fn: (transaction: typeof tx) => Promise<unknown>) => fn(tx),
  amendment: { create: async () => ({ id: "new-amendment" }) },
};
const prisma = {
  person: { findUnique: async () => ({ updatedAt: personVersion, isPlaceholder: false }) },
  amendment: { findMany: async () => [] },
};
const originalLoad = (Module as typeof Module & { _load: (...args: unknown[]) => unknown })._load;
const loader = mock.method(Module as typeof Module & { _load: (...args: unknown[]) => unknown }, "_load", function (this: unknown, request: string, ...rest: unknown[]) {
  if (request === "next/cache") return { revalidatePath: () => {} };
  if (request === "@/lib/prisma") return { prisma };
  if (request === "@/lib/audited-prisma") return { auditedPrisma: () => db };
  if (request === "@/lib/audit") return { setAuditContext: async () => {} };
  if (request === "@/lib/research-store") return { getProperty: async () => ({ property: originalProperty, version: propertyVersion }) };
  return originalLoad.call(this, request, ...rest);
});
after(() => loader.mock.restore());
const store = import("./amendment-store");

function personAmendment() {
  amendment = { id: "amendment-1", status: "PENDING", targetType: "PERSON", targetId: "person-1", baseVersion: openedAt.toISOString(), payload: { givenName1: "B" } };
  amendmentWrites = 0;
  personUpdateCount = 1;
}

test("submission rejects a stale person base version with 409", async () => {
  const { submitAmendment, AmendmentError } = await store;
  personVersion = changedAt;
  await assert.rejects(submitAmendment({ targetType: "PERSON", targetId: "person-1", baseVersion: openedAt.toISOString(), changes: { givenName1: "B" }, note: "Correction" }, actor),
    (error: unknown) => error instanceof AmendmentError && error.status === 409);
});

test("approval rejects an updated person and a lost conditional update", async () => {
  const { reviewAmendment, AmendmentError } = await store;
  personAmendment(); personVersion = changedAt;
  await assert.rejects(reviewAmendment("amendment-1", "APPROVE", null, actor), (error: unknown) => error instanceof AmendmentError && error.status === 409);
  assert.equal(amendmentWrites, 0);
  personVersion = openedAt; personUpdateCount = 0;
  await assert.rejects(reviewAmendment("amendment-1", "APPROVE", null, actor), (error: unknown) => error instanceof AmendmentError && error.status === 409);
  assert.equal(amendmentWrites, 0);
});

test("a second review of the same amendment returns 409", async () => {
  const { reviewAmendment, AmendmentError } = await store;
  personAmendment(); amendment.status = "APPROVED";
  await assert.rejects(reviewAmendment("amendment-1", "REJECT", "Already handled", actor), (error: unknown) => error instanceof AmendmentError && error.status === 409);
  assert.equal(amendmentWrites, 0);
});

test("approval refuses a proposal that clears published paragraphs, images, or people", async () => {
  const { reviewAmendment, AmendmentError } = await store;
  for (const section of ["paragraphs", "images", "people"] as const) {
    amendment = { id: "amendment-1", status: "PENDING", targetType: "PROPERTY", targetId: originalProperty.slug,
      baseVersion: "0", payload: { ...originalProperty, [section]: [] } };
    propertyVersion = 0; propertyContent = null; propertyWrites = 0; amendmentWrites = 0;
    await assert.rejects(reviewAmendment("amendment-1", "APPROVE", null, actor),
      (error: unknown) => error instanceof AmendmentError && error.status === 409 && error.message.includes(section));
    assert.equal(propertyWrites, 0);
    assert.equal(amendmentWrites, 0);
  }
});
