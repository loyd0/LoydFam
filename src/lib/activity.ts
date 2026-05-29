import { prisma } from "@/lib/prisma";
import type { ActivityType } from "@/generated/prisma/client";

interface LogActivityInput {
  actorUserId?: string | null;
  type: ActivityType;
  entityType?: string | null;
  entityId?: string | null;
  message: string;
  meta?: Record<string, unknown> | null;
}

export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await prisma.activity.create({
      data: {
        type: input.type,
        actorUserId: input.actorUserId ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        message: input.message,
        meta: (input.meta ?? null) as never,
      },
    });
  } catch (err) {
    console.error("[activity] failed to write", err);
  }
}

export function describeChange<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): { changed: string[]; diff: Record<string, { from: unknown; to: unknown }> } {
  const changed: string[] = [];
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    const b = before[key];
    const a = after[key as keyof T];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      changed.push(key);
      diff[key] = { from: b, to: a };
    }
  }
  return { changed, diff };
}
