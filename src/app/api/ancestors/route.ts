import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loydOnlyWhere, parseLoydOnly } from "@/lib/loyd-filter";
import { apiPermissionError } from "@/lib/permission-guards";
import { parseAncestorDepth, walkAncestors } from "@/lib/ancestor-walk";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await apiPermissionError("fanChart.view", session.user);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const personId = searchParams.get("personId");
  const depth = parseAncestorDepth(searchParams.get("depth"));
  const loydOnly = parseLoydOnly(searchParams);

  if (!personId) {
    return NextResponse.json({ error: "Missing personId" }, { status: 400 });
  }

  const { ancestors, maxDepth } = await walkAncestors(personId, depth, {
    people: ids => prisma.person.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, displayName: true, gender: true,
        events: {
          where: { event: { type: { in: ["BIRTH", "DEATH"] } } },
          include: { event: { select: { type: true, dateYear: true } } },
          orderBy: [{ event: { dateYear: "asc" } }, { eventId: "asc" }],
        },
      },
    }),
    parents: childIds => prisma.parentChild.findMany({
      where: { childId: { in: childIds } },
      select: { childId: true, parentId: true, type: true, parent: { select: { gender: true } } },
    }),
  });

  // Also include root lookup for person selector (filtered by loydOnly)
  const rootsWhere = loydOnly
    ? { AND: [{ isPlaceholder: false }, loydOnlyWhere()] }
    : { isPlaceholder: false };
  const roots = await prisma.person.findMany({
    where: rootsWhere,
    select: { id: true, displayName: true },
    orderBy: { displayName: "asc" },
    take: 500,
  });

  return NextResponse.json({ ancestors, roots, maxDepth });
}
