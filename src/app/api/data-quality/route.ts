import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const issues = await prisma.importIssue.findMany({
    orderBy: [
      { severity: "asc" }, // ERROR first
      { code: "asc" },
    ],
    take: 500,
    select: {
      id: true,
      severity: true,
      code: true,
      message: true,
      entityType: true,
      entityId: true,
    },
  });

  return NextResponse.json({ issues });
}
