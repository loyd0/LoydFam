import assert from "node:assert/strict";
import Module from "node:module";
import test, { after, mock } from "node:test";
import type { NextRequest } from "next/server";

const personId = "00000000-0000-4000-8000-000000000001";
let mayUpload = true;
let ownershipChecks = 0;
const putCalls: { pathname: string; options: Record<string, unknown> }[] = [];

class AuthzError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
process.env.BLOB_READ_WRITE_TOKEN = "test-token";
const originalLoad = (Module as typeof Module & { _load: (...args: unknown[]) => unknown })._load;
const loader = mock.method(Module as typeof Module & { _load: (...args: unknown[]) => unknown }, "_load", function (this: unknown, request: string, ...rest: unknown[]) {
  if (request === "@vercel/blob") return {
    put: async (pathname: string, _bytes: Buffer, options: Record<string, unknown>) => {
      putCalls.push({ pathname, options });
      return { pathname };
    },
  };
  if (request === "@/lib/auth") return { auth: async () => ({ user: { id: "user-1" } }) };
  if (request === "@/lib/authz") return {
    AuthzError,
    requireOwnedPerson: async (_personId: string, capability: string) => {
      ownershipChecks++;
      assert.equal(capability, "media.upload");
      if (!mayUpload) throw new AuthzError(403, "Forbidden");
      return { user: { id: "user-1" } };
    },
  };
  if (request === "@/lib/prisma") return { prisma: { person: { findUnique: async () => ({ id: personId }) } } };
  return originalLoad.call(this, request, ...rest);
});
after(() => {
  loader.mock.restore();
  if (originalToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
  else process.env.BLOB_READ_WRITE_TOKEN = originalToken;
});
const route = import("../app/api/media/upload/route");

function uploadRequest(content: string): NextRequest {
  const form = new FormData();
  form.set("personId", personId);
  form.set("file", new File([content], "document.pdf", { type: "application/pdf" }));
  return new Request("http://localhost/api/media/upload", { method: "POST", body: form }) as NextRequest;
}

test("server upload enforces ownership before writing the blob", async () => {
  const { POST } = await route;
  mayUpload = false; ownershipChecks = 0; putCalls.length = 0;
  const response = await POST(uploadRequest("%PDF-1.7"));
  assert.equal(response.status, 403);
  assert.equal(ownershipChecks, 1);
  assert.equal(putCalls.length, 0);
});

test("server upload forces private access and returns only the key", async () => {
  const { POST } = await route;
  mayUpload = true; putCalls.length = 0;
  const response = await POST(uploadRequest("%PDF-1.7"));
  assert.equal(response.status, 200);
  assert.equal(putCalls.length, 1);
  assert.equal(putCalls[0].options.access, "private");
  assert.equal(putCalls[0].options.addRandomSuffix, false);
  assert.equal(putCalls[0].options.allowOverwrite, false);
  assert.match(putCalls[0].pathname, new RegExp(`^media/${personId}/[0-9a-f-]{36}\\.pdf$`));
  assert.deepEqual(await response.json(), { blobKey: putCalls[0].pathname });
});

test("invalid file signature is rejected without storing bytes", async () => {
  const { POST } = await route;
  mayUpload = true; putCalls.length = 0;
  const response = await POST(uploadRequest("not a PDF"));
  assert.equal(response.status, 400);
  assert.equal(putCalls.length, 0);
});

test("old JSON token request cannot mint an upload token", async () => {
  const { POST } = await route;
  mayUpload = true; putCalls.length = 0;
  const request = new Request("http://localhost/api/media/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "blob.generate-client-token", payload: { pathname: `media/${personId}/file.pdf` } }),
  }) as NextRequest;
  const response = await POST(request);
  assert.notEqual(response.status, 200);
  assert.equal(putCalls.length, 0);
  assert.equal((await response.json()).clientToken, undefined);
});
