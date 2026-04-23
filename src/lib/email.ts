import { Resend } from "resend";

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendMailResult {
  sent: boolean;
  id?: string;
  error?: string;
  fallbackMessage?: string;
}

export function appUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL ||
    "http://localhost:3000";
  const normalized = base.startsWith("http") ? base : `https://${base}`;
  return `${normalized.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export function fromAddress(): string {
  return process.env.RESEND_FROM || "Loyd Family History <noreply@loydfamily.local>";
}

export async function sendMail(options: SendMailOptions): Promise<SendMailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`[email] RESEND_API_KEY not set — skipping send to ${options.to}`);
    return {
      sent: false,
      fallbackMessage:
        "Email delivery is not configured. Share the link directly with the user.",
    };
  }
  try {
    const resend = new Resend(key);
    const { data, error } = await resend.emails.send({
      from: fromAddress(),
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    if (error) {
      console.error("[email] send failed", error);
      return { sent: false, error: error.message };
    }
    return { sent: true, id: data?.id };
  } catch (err) {
    console.error("[email] send threw", err);
    return {
      sent: false,
      error: err instanceof Error ? err.message : "Unknown email error",
    };
  }
}
