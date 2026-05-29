import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AcceptInviteForm } from "@/app/invite/[token]/AcceptInviteForm";
import { AlertCircle } from "lucide-react";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await prisma.invite.findUnique({ where: { token } });

  if (!invite || invite.status !== "PENDING") {
    return <Expired message="This invite has already been used or revoked." />;
  }

  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return <Expired message="This invite has expired. Please ask the admin for a new one." />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/family-crest.svg"
            alt="Loyd Family Crest"
            width={96}
            height={96}
            className="object-contain"
          />
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to the family archive</h1>
          <p className="text-center text-sm text-muted-foreground">
            Set your password to activate your account as <strong>{invite.email}</strong>.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <AcceptInviteForm
            token={token}
            email={invite.email}
            name={invite.name ?? ""}
          />
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Already have an account? <Link href="/login" className="underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

function Expired({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Invite unavailable</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Link
          href="/login"
          className="inline-block rounded-md border border-border px-4 py-2 text-sm hover:bg-muted/40"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}
