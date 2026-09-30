import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiPermissionError } from "@/lib/permission-guards";

/** Returns all tags with their usage counts, for autocomplete and filtering. */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await apiPermissionError("people.view", session.user);
  if (denied) return denied;

  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { tagLinks: true } } },
  });

  return NextResponse.json({
    tags: tags.map((t) => ({
      id: t.id,
      name: t.name,
      colour: t.colour,
      count: t._count.tagLinks,
    })),
  });
}
