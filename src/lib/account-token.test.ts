import assert from "node:assert/strict";
import test from "node:test";
import { isAccountToken, isExpiredAt } from "./account-token";

test("account tokens must match the random hex format used by invite and reset issuers", () => {
  assert.equal(isAccountToken("a".repeat(48)), true);
  assert.equal(isAccountToken("a".repeat(47)), false);
  assert.equal(isAccountToken("A".repeat(48)), false);
  assert.equal(isAccountToken("g".repeat(48)), false);
  assert.equal(isAccountToken(null), false);
});

test("expiry is exclusive at the boundary while nullable invites remain non-expiring", () => {
  const now = new Date("2026-09-29T12:00:00.000Z");
  assert.equal(isExpiredAt(new Date("2026-09-29T11:59:59.999Z"), now), true);
  assert.equal(isExpiredAt(now, now), true);
  assert.equal(isExpiredAt(new Date("2026-09-29T12:00:00.001Z"), now), false);
  assert.equal(isExpiredAt(null, now), false);
});
