import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditedPrisma } from "@/lib/audited-prisma";
import { getUserPermissions } from "@/lib/permission-store";
import { SCOPE_PERMISSIONS } from "@/lib/saved-view-permissions";

const SCOPES = ["PEOPLE", "STATS", "TREE", "TIMELINE"] as const;
type Scope = (typeof SCOPES)[number];

/** List the current user's saved views, optionally filtered by scope. */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scopeParam = request.nextUrl.searchParams.get("scope")?.toUpperCase();
  if (scopeParam && !SCOPES.includes(scopeParam as Scope)) return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  const scope = SCOPES.includes(scopeParam as Scope) ? (scopeParam as Scope) : undefined;
  const permissions = await getUserPermissions(session.user);
  if (scope && !permissions[SCOPE_PERMISSIONS[scope]]) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const allowedScopes = SCOPES.filter((entry) => permissions[SCOPE_PERMISSIONS[entry]]);

  const views = await prisma.savedView.findMany({
    where: { userId: session.user.id, scope: scope ?? { in: allowedScopes } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ views });
}

/** Create a saved view for the current user. */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const scopeRaw = typeof body?.scope === "string" ? body.scope.toUpperCase() : "";
  const filter = body?.filter ?? {};

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!SCOPES.includes(scopeRaw as Scope)) {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }
  const permissions = await getUserPermissions(session.user);
  if (!permissions[SCOPE_PERMISSIONS[scopeRaw as Scope]]) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const view = await auditedPrisma(session.user, "Create saved view").savedView.create({
    data: {
      userId: session.user.id,
      name,
      scope: scopeRaw as Scope,
      filterJson: filter,
    },
  });

  return NextResponse.json({ view });
}
