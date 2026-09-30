import assert from "node:assert/strict";
import Module from "node:module";
import test, { after, mock } from "node:test";

let role = "VIEWER";
let verifiedPersonId: string | null = null;
let canUpload = true;
let userLookups = 0;
const originalLoad = (Module as typeof Module & { _load: (...args: unknown[]) => unknown })._load;
const loader = mock.method(Module as typeof Module & { _load: (...args: unknown[]) => unknown }, "_load", function (this: unknown, request: string, ...rest: unknown[]) {
  if (request === "@/lib/auth") return { auth: async () => ({ user: { id: "user-1", role } }) };
  if (request === "@/lib/permission-store") return { getUserPermissions: async () => ({ "media.upload": canUpload }) };
  if (request === "@/lib/prisma") return { prisma: { user: { findUnique: async () => { userLookups++; return { verifiedPersonId }; } } } };
  return originalLoad.call(this, request, ...rest);
});
after(() => loader.mock.restore());
const authz = import("./authz");

test("rejects an ownership mismatch for a non-admin", async () => {
  const { requireOwnedPerson, AuthzError } = await authz;
  role = "VIEWER"; canUpload = true; verifiedPersonId = "person-2"; userLookups = 0;
  await assert.rejects(requireOwnedPerson("person-1", "media.upload"), (error: unknown) => error instanceof AuthzError && error.status === 403);
  assert.equal(userLookups, 1);
});

test("allows an admin without looking up verified ownership", async () => {
  const { requireOwnedPerson } = await authz;
  role = "ADMIN"; userLookups = 0;
  assert.equal((await requireOwnedPerson("person-1", "media.upload")).user.id, "user-1");
  assert.equal(userLookups, 0);
});

test("checks capability before verified ownership", async () => {
  const { requireOwnedPerson, AuthzError } = await authz;
  role = "VIEWER"; canUpload = false; verifiedPersonId = "person-1"; userLookups = 0;
  await assert.rejects(requireOwnedPerson("person-1", "media.upload"), (error: unknown) => error instanceof AuthzError && error.status === 403 && error.message === "Forbidden");
  assert.equal(userLookups, 0);
});
