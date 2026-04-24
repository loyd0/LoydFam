"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/app/forgot-password/actions";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{ done: boolean; message: string } | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await requestPasswordReset(email.trim().toLowerCase());
      setResult({ done: true, message: r.message });
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/family-crest.svg" alt="Loyd Family Crest" width={96} height={96} className="object-contain" />
          <h1 className="text-2xl font-semibold tracking-tight">Forgotten password</h1>
          <p className="text-center text-sm text-muted-foreground">
            Enter your email and we&rsquo;ll send a reset link.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          {result ? (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <p className="text-sm text-foreground/90">{result.message}</p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">Back to sign in</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" disabled={pending} className="w-full h-11">
                {pending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </span>
                ) : (
                  "Send reset link"
                )}
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/login" className="underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
