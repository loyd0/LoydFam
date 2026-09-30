export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendMailResult {
  /** Cloudflare accepted the recipient for delivery; this is not an inbox receipt. */
  sent: boolean;
  id?: string;
  error?: string;
  fallbackMessage?: string;
}

export function appUrl(path: string): string {
  const base = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL || process.env.VERCEL_URL || "http://localhost:3000";
  const normalized = base.startsWith("http") ? base : `https://${base}`;
  return `${normalized.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export function fromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || "";
}

export function emailConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_EMAIL_API_TOKEN?.trim() &&
    /^[a-f0-9]{32}$/i.test(process.env.CLOUDFLARE_EMAIL_ACCOUNT_ID || "") &&
    /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(fromAddress()));
}

interface CloudflareSendResponse {
  success?: boolean;
  result?: {
    message_id?: string;
    delivered?: string[];
    queued?: string[];
    permanent_bounces?: string[];
    suppressed_recipients?: string[];
  };
}

/** Cloudflare Email Service REST API. Credentials never leave the server. */
export async function sendMail(options: SendMailOptions): Promise<SendMailResult> {
  if (!emailConfigured()) {
    return { sent: false, fallbackMessage: "Email delivery is not configured. Share the link directly with the user." };
  }
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_EMAIL_ACCOUNT_ID}/email/sending/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.CLOUDFLARE_EMAIL_API_TOKEN!.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: { address: fromAddress(), name: "Loyd Family History" },
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );
    // Provider payloads can contain addresses; keep them out of logs and public errors.
    if (!response.ok) {
      console.error(`[email] Cloudflare rejected sending (HTTP ${response.status})`);
      return { sent: false, error: "Email could not be sent. Please try again later or share the invitation link directly." };
    }
    const data = await response.json() as CloudflareSendResponse;
    const result = data.result;
    const sameRecipient = (address: string) => address.toLowerCase() === options.to.toLowerCase();
    const rejected = [...(result?.permanent_bounces || []), ...(result?.suppressed_recipients || [])].some(sameRecipient);
    const accepted = [...(result?.delivered || []), ...(result?.queued || [])].some(sameRecipient);
    if (!data.success || !result?.message_id || rejected || !accepted) {
      return { sent: false, error: "The email provider did not accept this recipient. Share the invitation link directly or check the address." };
    }
    return { sent: true, id: result.message_id };
  } catch {
    // Do not automatically retry: a timed-out request might already have been accepted.
    console.error("[email] Cloudflare delivery request failed");
    return { sent: false, error: "Email delivery could not be confirmed. Please try again later." };
  }
}
