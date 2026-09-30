import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { hasAnyPermission, hasPermission, type Role } from "@/lib/authz";
import type { PermissionKey } from "@/lib/permissions";

type PermissionUser = { id: string; role: string };

function permissionUser(user: PermissionUser) {
  return { ...user, role: user.role as Role };
}

export async function requirePagePermission(permission: PermissionKey) {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  if (!session?.user?.id) notFound();
  if (!(await hasPermission(permission, permissionUser(session.user)))) notFound();
}

export async function requirePageAnyPermission(permissions: PermissionKey[]) {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  if (!session?.user?.id) notFound();
  if (!(await hasAnyPermission(permissions, permissionUser(session.user)))) notFound();
}

export async function apiPermissionError(permission: PermissionKey, user: PermissionUser) {
  if (await hasPermission(permission, permissionUser(user))) return null;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function apiAnyPermissionError(permissions: PermissionKey[], user: PermissionUser) {
  if (await hasAnyPermission(permissions, permissionUser(user))) return null;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
