import { test } from "node:test";
import assert from "node:assert/strict";
import { renderInviteEmail, renderPasswordResetEmail } from "./emails/templates";

test("account emails escape user text and preserve the action link in both formats", async () => {
  const invite = await renderInviteEmail({ name: '<script>alert(1)</script>', inviterName: '<img src=x onerror=alert(1)>', acceptUrl: 'https://loyd.family/invite/example', expiresHours: 72 });
  assert.doesNotMatch(invite.html, /<script>|<img src=x/);
  assert.match(invite.html, /&lt;script&gt;/);
  for (const content of [invite.html, invite.text]) {
    assert.match(content, /https:\/\/loyd.family\/invite\/example/);
    assert.match(content.replace(/<!--.*?-->/g, ""), /72 hours/);
  }
  const reset = await renderPasswordResetEmail({ name: 'Sam', resetUrl: 'https://loyd.family/reset-password/example', expiresMinutes: 60 });
  for (const content of [reset.html, reset.text]) {
    assert.match(content, /https:\/\/loyd.family\/reset-password\/example/);
    assert.match(content.replace(/<!--.*?-->/g, ""), /60 minutes/);
    assert.match(content, /Your password will stay the same/);
  }
});
