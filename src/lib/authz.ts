import { auth } from "@/lib/auth";
import type { Session } from "next-auth";

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
