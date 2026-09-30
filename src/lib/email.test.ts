import { test } from "node:test";
import assert from "node:assert/strict";
import { appUrl, emailConfigured, sendMail } from "./email";

test("Cloudflare email configuration and recipient acceptance", async (t) => {
  const env = { ...process.env };
  const originalFetch = globalThis.fetch;
  t.after(() => { process.env = env; globalThis.fetch = originalFetch; });
  delete process.env.CLOUDFLARE_EMAIL_API_TOKEN;
  assert.equal(emailConfigured(), false);
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("should not send"); };
  assert.equal((await sendMail({ to: "person@example.test", subject: "test", html: "test" })).sent, false);
  assert.equal(calls, 0);

  process.env.CLOUDFLARE_EMAIL_API_TOKEN = "test-token";
  process.env.CLOUDFLARE_EMAIL_ACCOUNT_ID = "a".repeat(32);
  process.env.EMAIL_FROM = "archive@loyd.family";
  assert.equal(emailConfigured(), true);
  let body: Record<string, unknown> = {};
  globalThis.fetch = async (url, options) => {
    assert.equal(url, `https://api.cloudflare.com/client/v4/accounts/${"a".repeat(32)}/email/sending/send`);
    assert.equal((options?.headers as Record<string,string>).Authorization, "Bearer test-token");
    body = JSON.parse(options?.body as string);
    return Response.json({ success: true, result: { message_id: "message-1", queued: ["person@example.test"] } });
  };
  const mail = { to: "person@example.test", subject: "Invitation", html: "<p>Hello</p>", text: "Hello" };
  assert.deepEqual(await sendMail(mail), { sent: true, id: "message-1" });
  assert.deepEqual(body.from, { address: "archive@loyd.family", name: "Loyd Family History" });
  assert.equal(body.text, "Hello");

  for (const result of [
    { message_id: "id", suppressed_recipients: [mail.to] },
    { message_id: "id", permanent_bounces: [mail.to], queued: [mail.to] },
    { message_id: "id", queued: ["someone-else@example.test"] },
    { queued: [mail.to] },
  ]) {
    globalThis.fetch = async () => Response.json({ success: true, result });
    assert.equal((await sendMail(mail)).sent, false);
  }
  globalThis.fetch = async () => Response.json({ secret: "never expose provider errors" }, { status: 403 });
  const failed = await sendMail(mail);
  assert.equal(failed.sent, false);
  assert.equal(failed.uncertain, undefined);
  assert.doesNotMatch(failed.error!, /secret/);
  globalThis.fetch = async () => { throw new Error("private provider details"); };
  const uncertain = await sendMail(mail);
  assert.equal(uncertain.sent, false);
  assert.equal(uncertain.uncertain, true);
  process.env.EMAIL_FROM = "Name <archive@loyd.family>";
  assert.equal(emailConfigured(), false);

  process.env.APP_URL = "https://loyd-family-preview.vercel.app/";
  assert.equal(appUrl("invite/example"), "https://loyd-family-preview.vercel.app/invite/example");
});
