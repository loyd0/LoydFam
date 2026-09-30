/** Read-only readiness check. Never sends email or prints credentials. */
import { config } from "dotenv";
config({ path: process.argv[2] || ".env.local", quiet: true });
const account = process.env.CLOUDFLARE_EMAIL_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_EMAIL_API_TOKEN;
const from = process.env.EMAIL_FROM;
if (!/^[a-f0-9]{32}$/i.test(account || "") || !token || !from) {
  console.error("Set CLOUDFLARE_EMAIL_ACCOUNT_ID, CLOUDFLARE_EMAIL_API_TOKEN, and EMAIL_FROM in the selected environment file.");
  process.exit(1);
}
const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/email/sending/limits`, {
  headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000),
});
const data = await response.json();
console.log(JSON.stringify({ provider: "Cloudflare Email Service", accountAccessible: response.ok && data.success, httpStatus: response.status, senderConfigured: Boolean(from), note: "This read-only check does not confirm sender DNS verification or message delivery. Check Email Sending domain status in Cloudflare." }));
if (!response.ok || !data.success) process.exitCode = 1;
