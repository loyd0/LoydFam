import { NextResponse } from "next/server";
import { AuthzError, requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { user } = await requireSession();
    const [mine, review] = await Promise.all([
      prisma.amendment.count({ where: { status: "PENDING", proposedByUserId: user.id } }),
      user.role === "ADMIN" ? prisma.amendment.count({ where: { status: "PENDING" } }) : Promise.resolve(0),
    ]);
    return NextResponse.json({ mine, review }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthzError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
