import { NextResponse } from "next/server";
import { AuthzError, requireAdmin } from "@/lib/authz";
import { isPlainObject, parseDefaultPatch, parseOverridePatch } from "@/lib/permissions";
import {
  getAdminPermissionSnapshot, PermissionConflictError, PermissionUserNotFoundError,
  updatePermissionPolicy,
} from "@/lib/permission-store";

function errorResponse(error: unknown) {
  if (error instanceof AuthzError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof PermissionConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof PermissionUserNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
  throw error;
}

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await getAdminPermissionSnapshot(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAdmin();
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
    if (!isPlainObject(body) || !Number.isSafeInteger(body.expectedVersion) || (body.expectedVersion as number) < 0) {
      return NextResponse.json({ error: "A nonnegative expectedVersion is required" }, { status: 400 });
    }
    const isDefaults = Object.hasOwn(body, "defaults");
    const isOverrides = Object.hasOwn(body, "overrides");
    if (isDefaults === isOverrides) return NextResponse.json({ error: "Specify defaults or user overrides" }, { status: 400 });
    const allowedFields = isDefaults ? ["expectedVersion", "defaults"] : ["expectedVersion", "userId", "overrides"];
    if (Object.keys(body).some((key) => !allowedFields.includes(key))) return NextResponse.json({ error: "Unknown field" }, { status: 400 });
    if (isDefaults) {
      const defaults = parseDefaultPatch(body.defaults);
      if (!defaults) return NextResponse.json({ error: "Invalid permission defaults" }, { status: 400 });
      return NextResponse.json(await updatePermissionPolicy({ expectedVersion: body.expectedVersion as number, defaults }, session.user));
    }
    const overrides = parseOverridePatch(body.overrides);
    if (typeof body.userId !== "string" || !body.userId || !overrides) {
      return NextResponse.json({ error: "Valid userId and overrides required" }, { status: 400 });
    }
    return NextResponse.json(await updatePermissionPolicy({ expectedVersion: body.expectedVersion as number, userId: body.userId, overrides }, session.user));
  } catch (error) { return errorResponse(error); }
}
