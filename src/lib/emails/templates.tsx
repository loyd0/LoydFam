import { Html, Body, Container, Heading, Text, Button, Section, Hr } from "@react-email/components";
import { render } from "@react-email/components";

interface InviteEmailProps {
  name?: string | null;
  inviterName: string;
  acceptUrl: string;
  expiresHours: number;
}

export function InviteEmail({ name, inviterName, acceptUrl, expiresHours }: InviteEmailProps) {
  return (
    <Html>
      <Body style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", backgroundColor: "#fafaf9", margin: 0, padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: 12, padding: 32, maxWidth: 520, margin: "0 auto", border: "1px solid #e6eae7" }}>
          <Heading as="h1" style={{ fontSize: 22, color: "#1a2e24", margin: 0, fontWeight: 600 }}>
            Welcome to the Loyd Family History
          </Heading>
          <Text style={{ color: "#3c4b44", fontSize: 15, lineHeight: 1.6, marginTop: 16 }}>
            {name ? `Hi ${name},` : "Hi,"}
          </Text>
          <Text style={{ color: "#3c4b44", fontSize: 15, lineHeight: 1.6 }}>
            {inviterName} has invited you to the Loyd Family History archive. It has photos,
            stories, dates and relationships for hundreds of family members going back many
            generations.
          </Text>
          <Section style={{ textAlign: "center", margin: "28px 0" }}>
            <Button
              href={acceptUrl}
              style={{
                backgroundColor: "#2a5442",
                color: "#ffffff",
                padding: "12px 24px",
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Accept invite & set password
            </Button>
          </Section>
          <Text style={{ color: "#6b7a73", fontSize: 13, lineHeight: 1.5 }}>
            This link will expire in {expiresHours} hours. If the button doesn&rsquo;t work, copy
            and paste this URL into your browser:
          </Text>
          <Text style={{ color: "#2a5442", fontSize: 13, wordBreak: "break-all" }}>
            {acceptUrl}
          </Text>
          <Hr style={{ borderColor: "#e6eae7", margin: "24px 0 12px" }} />
          <Text style={{ color: "#98a39c", fontSize: 12, textAlign: "center" }}>
            Loyd Family History · Preserving our story across generations
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

interface PasswordResetEmailProps {
  name?: string | null;
  resetUrl: string;
  expiresMinutes: number;
}

export function PasswordResetEmail({ name, resetUrl, expiresMinutes }: PasswordResetEmailProps) {
  return (
    <Html>
      <Body style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", backgroundColor: "#fafaf9", margin: 0, padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: 12, padding: 32, maxWidth: 520, margin: "0 auto", border: "1px solid #e6eae7" }}>
          <Heading as="h1" style={{ fontSize: 22, color: "#1a2e24", margin: 0, fontWeight: 600 }}>
            Reset your password
          </Heading>
          <Text style={{ color: "#3c4b44", fontSize: 15, lineHeight: 1.6, marginTop: 16 }}>
            {name ? `Hi ${name},` : "Hi,"}
          </Text>
          <Text style={{ color: "#3c4b44", fontSize: 15, lineHeight: 1.6 }}>
            Someone (hopefully you) requested a password reset for your Loyd Family account. Click
            below to pick a new one.
          </Text>
          <Section style={{ textAlign: "center", margin: "28px 0" }}>
            <Button
              href={resetUrl}
              style={{
                backgroundColor: "#2a5442",
                color: "#ffffff",
                padding: "12px 24px",
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Reset password
            </Button>
          </Section>
          <Text style={{ color: "#6b7a73", fontSize: 13, lineHeight: 1.5 }}>
            This link expires in {expiresMinutes} minutes. If you didn&rsquo;t request a reset,
            you can ignore this email.
          </Text>
          <Hr style={{ borderColor: "#e6eae7", margin: "24px 0 12px" }} />
          <Text style={{ color: "#98a39c", fontSize: 12, textAlign: "center" }}>
            Loyd Family History
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderInviteEmail(props: InviteEmailProps): Promise<{ html: string; text: string }> {
  const html = await render(<InviteEmail {...props} />);
  const text = `${props.name ? `Hi ${props.name},\n\n` : ""}${props.inviterName} has invited you to the Loyd Family History archive.\n\nAccept the invite: ${props.acceptUrl}\n\nThis link expires in ${props.expiresHours} hours.`;
  return { html, text };
}

export async function renderPasswordResetEmail(props: PasswordResetEmailProps): Promise<{ html: string; text: string }> {
  const html = await render(<PasswordResetEmail {...props} />);
  const text = `${props.name ? `Hi ${props.name},\n\n` : ""}Reset your Loyd Family password: ${props.resetUrl}\n\nThis link expires in ${props.expiresMinutes} minutes.`;
  return { html, text };
}
