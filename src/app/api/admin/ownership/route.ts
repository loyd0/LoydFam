import { NextResponse } from "next/server";
import { AuthzError, requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { auditedPrisma } from "@/lib/audited-prisma";
import { isPlainObject } from "@/lib/permissions";

function failure(error: unknown) {
  if (error instanceof AuthzError) return NextResponse.json({ error: error.message }, { status: error.status });
  throw error;
}

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({ orderBy: { name: "asc" }, select: {
      id: true, name: true, email: true, role: true,
      linkedPerson: { select: { id: true, displayName: true } },
      verifiedPerson: { select: { id: true, displayName: true } },
    } });
    return NextResponse.json({ users }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAdmin();
    const body: unknown = await request.json().catch(() => null);
    if (!isPlainObject(body) || typeof body.userId !== "string" || !body.userId ||
      !(body.personId === null || (typeof body.personId === "string" && body.personId))) {
      return NextResponse.json({ error: "Valid userId and personId are required." }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { id: body.userId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    if (body.personId !== null) {
      const person = await prisma.person.findFirst({ where: { id: body.personId as string, isPlaceholder: false }, select: { id: true } });
      if (!person) return NextResponse.json({ error: "Person not found." }, { status: 404 });
    }
    const updated = await auditedPrisma(session.user, "Confirm account ownership of a family person").user.update({
      where: { id: body.userId }, data: { verifiedPersonId: body.personId as string | null },
      select: { id: true, verifiedPerson: { select: { id: true, displayName: true } } },
    });
    return NextResponse.json({ user: updated });
  } catch (error) { return failure(error); }
}
