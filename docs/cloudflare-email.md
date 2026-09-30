# Cloudflare email delivery

Invitation and password reset messages use Cloudflare Email Service's REST API directly from the Next.js server. Resend has been removed. The account database and website hosting do not need to move.

## Configuration

1. In the Cloudflare account that owns `loyd.family`, open Email Service → Email Sending and onboard the sending domain. Review the DNS preview first; preserve existing mailbox MX records. Cloudflare uses its `cf-bounce` return-path subdomain for bounces.
2. Check SPF, DKIM and DMARC status in Email Sending. Domain setup requires Cloudflare DNS and the account's Email Sending entitlement.
3. Create a restricted API token with **Email Sending: Edit** for this account.
4. Set these server-only variables in the Vercel project's Preview environment:
   - `CLOUDFLARE_EMAIL_ACCOUNT_ID`: the domain's Cloudflare account ID.
   - `CLOUDFLARE_EMAIL_API_TOKEN`: the restricted token.
   - `EMAIL_FROM`: a plain address on the onboarded domain, `archive@notify.loyd.family`.
   - `APP_URL`: `https://loyd-family-preview.vercel.app`.
5. Redeploy the preview. A read-only credential check is available with `node scripts/check-cloudflare-email.mjs .env.vercel-preview.local`. Domain DNS status must also be checked in Cloudflare.
6. With an explicitly authorized test recipient, send an invitation and verify delivery and the acceptance link. API acceptance is not proof of inbox delivery. Preview deployment protection also applies to email links.

The adapter requires Cloudflare to accept the actual recipient into its delivered or queued list. Suppressions, bounces, API errors and timeouts do not report success. There is no automatic retry of uncertain sends. Logs exclude credentials, email bodies and recipient details. Missing configuration leaves invitation links available for manual sharing and explains unavailable reset delivery. Password reset responses do not disclose whether an account exists.

## Current provisioning — 30 September 2026

Namecheap now delegates `loyd.family` to `dexter.ns.cloudflare.com` and `mariah.ns.cloudflare.com`. Cloudflare zone `85710591d33633e7a5f2c4dd5adcfa45` in Antler Digital account `39577afe428b5f5704b8b6acf283da1e` became active at 07:37 UTC. All six original website and iCloud records were verified unchanged, with proxying disabled. Netlify's zone remains available for rollback; its original records are backed up locally.

Email Sending is enabled for `notify.loyd.family`, with return path `cf-bounce.notify.loyd.family`. Its six subdomain DNS records were applied and Cloudflare reports DNS ready with no errors. Existing incoming iCloud mail records are unchanged.

Remaining: create a restricted Email Sending token, configure the Preview environment and verify delivery to an explicitly authorized recipient. The connector cannot manage API tokens (Cloudflare error 9109); Cloudflare dashboard sign-in has been requested. No token is configured and email delivery is not yet verified. `APP_URL` is set for Preview.

References: [Cloudflare send setup](https://developers.cloudflare.com/email-service/get-started/send-emails/), [REST API](https://developers.cloudflare.com/email-service/api/send-emails/rest-api/).
