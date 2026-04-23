import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  const limit = Math.min(50, Number(searchParams.get("limit") ?? 20));

  const where = entityType && entityId ? { entityType, entityId } : {};

  const activities = await prisma.activity.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      actor: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({
    activities: activities.map((a) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      createdAt: a.createdAt,
      meta: a.meta,
      actor: a.actor
        ? { id: a.actor.id, name: a.actor.name, email: a.actor.email }
        : null,
    })),
  });
}
