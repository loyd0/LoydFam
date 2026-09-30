import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserPermissions } from "@/lib/permission-store";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permissions = await getUserPermissions(session.user);
  if (!permissions["history.view"]) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  const requestedLimit = Number(searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(50, Math.trunc(requestedLimit))) : 20;

  const isAdmin = session.user.role === "ADMIN";
  // Account, import and contact events can contain emails or operational data.
  // Family members only receive activity for sections they can currently view.
  const allowedTypes = [
    ...(permissions["people.view"] ? ["person"] : []),
    ...(permissions["properties.view"] ? ["property"] : []),
  ];
  const where: Prisma.ActivityWhereInput = {
    ...(entityType && entityId ? { entityId } : {}),
    ...(entityType && entityId && isAdmin ? { entityType } : {}),
    ...(!isAdmin ? { entityType: { in: allowedTypes } } : {}),
    ...(!isAdmin && entityType && entityId ? { AND: [{ entityType }] } : {}),
  };

  const activities = await prisma.activity.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({
    activities: activities.map((a) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      createdAt: a.createdAt,
      meta: isAdmin ? a.meta : null,
      actor: a.actor
        ? isAdmin ? { id: a.actor.id, name: a.actor.name, email: a.actor.email } : { name: a.actor.name || "Family contributor" }
        : null,
    })),
  });
}
