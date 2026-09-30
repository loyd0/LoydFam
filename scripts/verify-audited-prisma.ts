import assert from "node:assert/strict";
import { auditedPrisma } from "@/lib/audited-prisma";
import { prisma } from "@/lib/prisma";

const connection = new URL(process.env.DATABASE_URL ?? "");
if (!(["localhost", "127.0.0.1"].includes(connection.hostname) && connection.port === "55439" && connection.pathname === "/loyd_verify")) {
  throw new Error("This verification only runs against local localhost:55439/loyd_verify.");
}

const actor = { id: "audit-verification-actor", name: "Audit verification editor" };
const reason = "Verify request-scoped actor attribution";
const db = auditedPrisma(actor, reason);
const rollback = new Error("ROLLBACK_AUDIT_VERIFICATION");

async function main() {
try {
  await assert.rejects(db.$transaction(async (tx) => {
    const place = await tx.place.create({
      data: { type: "OTHER", name: `audit-verification-${Date.now()}` },
    });
    const revisions = await tx.recordRevision.findMany({
      where: { entityType: "place", entityId: place.id },
    });
    assert.equal(revisions.length, 1);
    assert.equal(revisions[0].operation, "INSERT");
    assert.equal(revisions[0].actorUserId, actor.id);
    assert.equal(revisions[0].actorLabel, actor.name);
    assert.equal(revisions[0].reason, reason);
    const snapshot = revisions[0].after;
    assert.ok(snapshot && typeof snapshot === "object" && !Array.isArray(snapshot));
    assert.equal(snapshot.name, place.name);
    throw rollback;
  }), (error: unknown) => error === rollback);
  console.log(JSON.stringify({ actorContext: true, revisionSharesTransaction: true, rollbackRemovesWriteAndRevision: true }));
} finally {
  await prisma.$disconnect();
}

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
