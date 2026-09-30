import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { getUserPermissions } from "@/lib/permission-store";
import { prisma } from "@/lib/prisma";
import type { PermissionKey } from "@/lib/permissions";
export type { PermissionKey } from "@/lib/permissions";

export type Role = "ADMIN" | "VIEWER";

export class AuthzError extends Error {
  status: 401 | 403;
  constructor(status: 401 | 403, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireSession(): Promise<Session & { user: { id: string; role: Role } }> {
  const session = await auth();
  if (!session?.user?.id) throw new AuthzError(401, "Unauthorized");
  return session as Session & { user: { id: string; role: Role } };
}

export async function requireAdmin(): Promise<Session & { user: { id: string; role: Role } }> {
  const session = await requireSession();
  if (session.user.role !== "ADMIN") throw new AuthzError(403, "Admin only");
  return session;
}

export function isAdmin(session: Session | null | undefined): boolean {
  return session?.user?.role === "ADMIN";
}

export async function hasPermission(key: PermissionKey, user: { id: string; role: string }): Promise<boolean> {
  const permissions = await getUserPermissions({ id: user.id, role: user.role === "ADMIN" ? "ADMIN" : "VIEWER" });
  return permissions[key];
}

export async function hasAnyPermission(keys: readonly PermissionKey[], user: { id: string; role: string }): Promise<boolean> {
  const permissions = await getUserPermissions({ id: user.id, role: user.role === "ADMIN" ? "ADMIN" : "VIEWER" });
  return keys.some((key) => permissions[key]);
}

export async function requirePermission(key: PermissionKey): Promise<Session & { user: { id: string; role: Role } }> {
  const session = await requireSession();
  if (!(await hasPermission(key, session.user))) throw new AuthzError(403, "Forbidden");
  return session;
}

export async function requireOwnedPerson(personId: string, capability?: PermissionKey) {
  const session = await requireSession();
  if (session.user.role === "ADMIN") return session;
  if (capability && !(await hasPermission(capability, session.user))) throw new AuthzError(403, "Forbidden");
  const account = await prisma.user.findUnique({ where: { id: session.user.id }, select: { verifiedPersonId: true } });
  if (account?.verifiedPersonId !== personId) throw new AuthzError(403, "Only your verified family record can be changed directly.");
  return session;
}
