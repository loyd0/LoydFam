import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AlertCircle } from "lucide-react";
import { ResetPasswordForm } from "@/app/reset-password/[token]/ResetPasswordForm";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const reset = await prisma.passwordReset.findUnique({ where: { token } });
  const user = reset ? await prisma.user.findUnique({ where: { id: reset.userId } }) : null;

  if (!reset || reset.usedAt || reset.expiresAt < new Date() || !user) {
    return <Invalid />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/family-crest.svg" alt="Loyd Family Crest" width={96} height={96} className="object-contain" />
          <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
          <p className="text-center text-sm text-muted-foreground">
            Choose a new password for <strong>{user.email}</strong>.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <ResetPasswordForm token={token} email={user.email} />
        </div>
      </div>
    </div>
  );
}

function Invalid() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Link invalid or expired</h1>
        <p className="text-sm text-muted-foreground">Please request a fresh password reset.</p>
        <Link
          href="/forgot-password"
          className="inline-block rounded-md border border-border px-4 py-2 text-sm hover:bg-muted/40"
        >
          Request new link
        </Link>
      </div>
    </div>
  );
}
