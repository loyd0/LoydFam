import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PERMISSIONS, normalizeDefaults, normalizeOverrides, resolvePermissions,
  type PermissionKey, type PermissionMap, type PermissionOverrides,
} from "@/lib/permissions";
import type { Prisma } from "@/generated/prisma/client";

const POLICY_ID = "family";
type OverridesByUser = Record<string, PermissionOverrides>;

function storedOverrides(value: unknown): OverridesByUser {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const result: OverridesByUser = {};
  for (const [userId, entry] of Object.entries(value)) {
    if (userId) result[userId] = normalizeOverrides(entry);
  }
  return result;
}

export async function getUserPermissions(user: { id: string; role: string }): Promise<PermissionMap> {
  if (user.role === "ADMIN") return resolvePermissions(null, null, "ADMIN");
  const policy = await prisma.permissionPolicy.findUnique({ where: { id: POLICY_ID }, select: { defaults: true, overrides: true } });
  const overrides = storedOverrides(policy?.overrides)[user.id];
  return resolvePermissions(policy?.defaults, overrides, "VIEWER");
}

export async function getAdminPermissionSnapshot() {
  const [policy, users] = await Promise.all([
    prisma.permissionPolicy.findUnique({ where: { id: POLICY_ID } }),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, email: true, role: true } }),
  ]);
  const defaults = normalizeDefaults(policy?.defaults);
  const byUser = storedOverrides(policy?.overrides);
  return {
    version: policy?.version ?? 0,
    defaults,
    users: users.map((user) => ({
      ...user,
      overrides: byUser[user.id] ?? {},
      permissions: resolvePermissions(defaults, byUser[user.id], user.role),
    })),
  };
}

export class PermissionConflictError extends Error {
  constructor() { super("Permissions changed. Reload and try again."); }
}
export class PermissionUserNotFoundError extends Error {
  constructor() { super("User not found"); }
}

export type PermissionChange =
  | { expectedVersion: number; defaults: Partial<PermissionMap> }
  | { expectedVersion: number; userId: string; overrides: Partial<Record<PermissionKey, "allow" | "deny" | "inherit">> };

export async function updatePermissionPolicy(change: PermissionChange, actor: { id: string; name?: string | null }) {
  try {
    await prisma.$transaction(async (tx) => {
      // No migration seed is required. Two first writes serialize at the unique key.
      await tx.permissionPolicy.createMany({
        data: [{ id: POLICY_ID, defaults: DEFAULT_PERMISSIONS, overrides: {}, version: 0 }],
        skipDuplicates: true,
      });
      const current = await tx.permissionPolicy.findUniqueOrThrow({ where: { id: POLICY_ID } });
      if (current.version !== change.expectedVersion) throw new PermissionConflictError();

      const defaults = normalizeDefaults(current.defaults);
      const byUser = storedOverrides(current.overrides);
      if ("defaults" in change) {
        Object.assign(defaults, change.defaults);
      } else {
        const user = await tx.user.findUnique({ where: { id: change.userId }, select: { id: true } });
        if (!user) throw new PermissionUserNotFoundError();
        const overrides = { ...byUser[change.userId] };
        for (const [key, setting] of Object.entries(change.overrides) as [PermissionKey, "allow" | "deny" | "inherit"][]) {
          if (setting === "inherit") delete overrides[key];
          else overrides[key] = setting;
        }
        if (Object.keys(overrides).length) byUser[change.userId] = overrides;
        else delete byUser[change.userId];
      }

      const updated = await tx.permissionPolicy.updateMany({
        where: { id: POLICY_ID, version: change.expectedVersion },
        data: { defaults, overrides: byUser, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new PermissionConflictError();
      await tx.recordRevision.create({
        data: {
          entityType: "permission_policy",
          entityId: POLICY_ID,
          operation: "UPDATE",
          before: { version: current.version, defaults: normalizeDefaults(current.defaults), overrides: storedOverrides(current.overrides) } as Prisma.InputJsonObject,
          after: { version: current.version + 1, defaults, overrides: byUser } as Prisma.InputJsonObject,
          actorUserId: actor.id,
          actorLabel: actor.name || "Family administrator",
          reason: "defaults" in change ? "Change default permissions" : `Change permissions for user ${change.userId}`,
        },
      });
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      throw new PermissionConflictError();
    }
    throw error;
  }
  return getAdminPermissionSnapshot();
}
