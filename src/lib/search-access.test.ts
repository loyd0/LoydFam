import assert from "node:assert/strict";
import test from "node:test";
import { searchDenialResponse } from "./search-access";

test("search rejects a user denied every catalog", async () => {
  const response = searchDenialResponse(false, false, false);
  assert.equal(response?.status, 403);
  assert.deepEqual(await response?.json(), { error: "Forbidden" });
  assert.equal(searchDenialResponse(true, false, false), null);
  assert.equal(searchDenialResponse(false, true, false), null);
  assert.equal(searchDenialResponse(false, false, true), null);
});
