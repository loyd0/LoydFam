import { NextResponse } from "next/server";
import { AuthzError, requireAdmin } from "@/lib/authz";
import { AmendmentError, listAdminAmendments, reviewAmendment } from "@/lib/amendment-store";
import { isPlainObject } from "@/lib/permissions";

function failure(error: unknown) {
  if (error instanceof AuthzError || error instanceof AmendmentError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
    return NextResponse.json({ error: "This proposal changed during review. Reload and try again." }, { status: 409 });
  }
  throw error;
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const status = new URL(request.url).searchParams.get("status");
    if (status && !["PENDING", "APPROVED", "APPLIED_MANUALLY", "REJECTED"].includes(status)) {
      throw new AmendmentError("Invalid status.", 400);
    }
    return NextResponse.json({ amendments: await listAdminAmendments(status as "PENDING" | "APPROVED" | "APPLIED_MANUALLY" | "REJECTED" | undefined) },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAdmin();
    const body: unknown = await request.json().catch(() => null);
    if (!isPlainObject(body) || typeof body.id !== "string" || !["APPROVE", "REJECT", "RESOLVE"].includes(body.decision as string)) {
      throw new AmendmentError("Choose a valid review decision.", 400);
    }
    const reason = typeof body.reason === "string" ? body.reason.trim() : null;
    const amendment = await reviewAmendment(body.id, body.decision as "APPROVE" | "REJECT" | "RESOLVE", reason, session.user);
    return NextResponse.json({ amendment });
  } catch (error) { return failure(error); }
}
