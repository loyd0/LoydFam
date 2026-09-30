import { Html, Head, Preview, Body, Container, Heading, Text, Button, Section, Hr, Link, render } from "@react-email/components";
import type { ReactNode } from "react";

const paragraph = { color: "#3c4b44", fontSize: 16, lineHeight: "26px" };
const muted = { color: "#65746b", fontSize: 13, lineHeight: "21px" };

function ArchiveEmail({ preview, title, children }: { preview: string; title: string; children: ReactNode }) {
  return <Html lang="en">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={{ fontFamily: "Arial, Helvetica, sans-serif", backgroundColor: "#f8f6f0", margin: 0, padding: "24px 12px" }}>
      <Container style={{ backgroundColor: "#fffefa", borderRadius: 12, padding: "32px 24px", maxWidth: 520, margin: "0 auto", border: "1px solid #dde5de", borderTop: "4px solid #24553d" }}>
        <Text style={{ color: "#24553d", fontSize: 18, fontWeight: 700, margin: 0 }}>Loyd Family</Text>
        <Text style={{ ...muted, margin: "2px 0 28px" }}>History archive</Text>
        <Heading as="h1" style={{ fontSize: 26, lineHeight: "34px", color: "#172e22", margin: "0 0 20px", fontWeight: 600 }}>{title}</Heading>
        {children}
        <Hr style={{ borderColor: "#dde5de", margin: "30px 0 16px" }} />
        <Text style={{ ...muted, margin: 0 }}>Loyd Family History</Text>
        <Text style={{ ...muted, margin: "4px 0 0" }}>Our people, places and stories, across generations.</Text>
      </Container>
    </Body>
  </Html>;
}

function ActionLink({ url, label }: { url: string; label: string }) {
  return <>
    <Section style={{ margin: "26px 0" }}>
      <Button href={url} style={{ backgroundColor: "#24553d", color: "#ffffff", padding: "14px 22px", borderRadius: 7, fontSize: 16, fontWeight: 600, textDecoration: "none" }}>{label}</Button>
    </Section>
    <Text style={muted}>If the button doesn’t work, copy this link into your browser:</Text>
    <Link href={url} style={{ color: "#24553d", fontSize: 13, lineHeight: "21px", wordBreak: "break-all" }}>{url}</Link>
  </>;
}

interface InviteEmailProps {
  name?: string | null;
  inviterName: string;
  acceptUrl: string;
  expiresHours: number;
}
export function InviteEmail({ name, inviterName, acceptUrl, expiresHours }: InviteEmailProps) {
  return <ArchiveEmail preview="You’re invited to explore the Loyd family archive." title="A place for our family’s story">
    <Text style={paragraph}>{name ? `Hello ${name},` : "Hello,"}</Text>
    <Text style={paragraph}>{inviterName} has invited you to the Loyd Family History archive. Explore the photographs, stories and places that connect our family across generations.</Text>
    <Text style={paragraph}>Create your account to start exploring and help keep the family record alive.</Text>
    <ActionLink url={acceptUrl} label="Accept your invitation" />
    <Text style={muted}>Your invitation expires in {expiresHours} hours. This link is personal to you; please don’t forward it.</Text>
  </ArchiveEmail>;
}
interface PasswordResetEmailProps {
  name?: string | null;
  resetUrl: string;
  expiresMinutes: number;
}
export function PasswordResetEmail({ name, resetUrl, expiresMinutes }: PasswordResetEmailProps) {
  return <ArchiveEmail preview="Your password reset link for the Loyd family archive." title="Reset your password">
    <Text style={paragraph}>{name ? `Hello ${name},` : "Hello,"}</Text>
    <Text style={paragraph}>We received a request to reset the password for your Loyd Family account. Follow the link below to choose a new password.</Text>
    <ActionLink url={resetUrl} label="Choose a new password" />
    <Text style={muted}>This link expires in {expiresMinutes} minutes. If you didn’t request a reset, you can ignore this email. Your password will stay the same.</Text>
  </ArchiveEmail>;
}
export async function renderInviteEmail(props: InviteEmailProps): Promise<{ html: string; text: string }> {
  const html = await render(<InviteEmail {...props} />);
  return { html, text: await render(<InviteEmail {...props} />, { plainText: true }) };
}
export async function renderPasswordResetEmail(props: PasswordResetEmailProps): Promise<{ html: string; text: string }> {
  const html = await render(<PasswordResetEmail {...props} />);
  return { html, text: await render(<PasswordResetEmail {...props} />, { plainText: true }) };
}
export async function renderDeliveryTestEmail(archiveUrl: string): Promise<{ html: string; text: string }> {
  const email = <ArchiveEmail preview="A delivery check from the Loyd family archive." title="A note from the family archive">
    <Text style={paragraph}>Hello Sam,</Text>
    <Text style={paragraph}>This is the email delivery test you requested for Loyd Family History, sent through Cloudflare.</Text>
    <Text style={paragraph}>Invitations and password resets share this design: warm paper tones, forest green and clear, simple type.</Text>
    <ActionLink url={archiveUrl} label="Visit the family archive" />
    <Text style={muted}>This is a delivery test. It does not change your account or password.</Text>
  </ArchiveEmail>;
  return { html: await render(email), text: await render(email, { plainText: true }) };
}
