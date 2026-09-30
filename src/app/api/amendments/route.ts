import { NextResponse } from "next/server";
import { AuthzError, requireSession } from "@/lib/authz";
import { getUserPermissions } from "@/lib/permission-store";
import { AmendmentError, listMyAmendments, submitAmendment } from "@/lib/amendment-store";
import { isPlainObject } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { properties } from "@/lib/properties";

function failure(error: unknown) {
  if (error instanceof AuthzError || error instanceof AmendmentError) return NextResponse.json({ error: error.message }, { status: error.status });
  throw error;
}

export async function GET() {
  try {
    const session = await requireSession();
    const amendments = await listMyAmendments(session.user.id);
    const personIds = [...new Set(amendments.filter((item) => item.targetType === "PERSON").map((item) => item.targetId))];
    const people = await prisma.person.findMany({ where: { id: { in: personIds } }, select: { id: true, displayName: true } });
    const names = new Map(people.map((person) => [person.id, person.displayName]));
    return NextResponse.json({ amendments: amendments.map((item) => ({
      ...item,
      targetLabel: item.targetType === "PERSON" ? names.get(item.targetId) ?? "Family person"
        : properties.find((property) => property.slug === item.targetId)?.name ?? "Family property",
      changes: item.payload,
      payload: undefined,
    })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body: unknown = await request.json().catch(() => null);
    if (!isPlainObject(body)) throw new AmendmentError("Invalid proposal.", 400);
    const permissions = await getUserPermissions(session.user);
    if (body.targetType === "PERSON" && !permissions["people.view"]) throw new AmendmentError("People access is required.", 403);
    if (body.targetType === "PROPERTY" && !permissions["properties.view"]) throw new AmendmentError("Property access is required.", 403);
    const amendment = await submitAmendment(body, session.user);
    return NextResponse.json({ id: amendment.id, status: amendment.status }, { status: 201 });
  } catch (error) { return failure(error); }
}
