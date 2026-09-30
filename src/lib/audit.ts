import type { Prisma } from "@/generated/prisma/client";

export async function setAuditContext(tx: Prisma.TransactionClient, actor: { id?: string; name?: string | null }, reason: string) {
  await tx.$queryRaw`SELECT set_config('archive.actor_id', ${actor.id ?? ""}, true), set_config('archive.actor_label', ${actor.name || (actor.id ? "Family administrator" : "Research import")}, true), set_config('archive.reason', ${reason}, true)`;
}
