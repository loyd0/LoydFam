import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SCOPES = ["PEOPLE", "STATS", "TREE", "TIMELINE"] as const;
type Scope = (typeof SCOPES)[number];

/** List the current user's saved views, optionally filtered by scope. */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scopeParam = request.nextUrl.searchParams.get("scope")?.toUpperCase();
  const scope = SCOPES.includes(scopeParam as Scope) ? (scopeParam as Scope) : undefined;

  const views = await prisma.savedView.findMany({
    where: { userId: session.user.id, ...(scope ? { scope } : {}) },
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

  const view = await prisma.savedView.create({
    data: {
      userId: session.user.id,
      name,
      scope: scopeRaw as Scope,
      filterJson: filter,
    },
  });

  return NextResponse.json({ view });
}
