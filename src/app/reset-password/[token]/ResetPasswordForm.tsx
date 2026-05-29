"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2 } from "lucide-react";
import { resetPassword } from "@/app/reset-password/[token]/actions";

interface Props {
  token: string;
  email: string;
}

export function ResetPasswordForm({ token, email }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    startTransition(async () => {
      try {
        await resetPassword({ token, password });
        const res = await signIn("credentials", { email, password, redirect: false });
        if (res?.error) {
          router.push("/login");
          return;
        }
        router.push("/");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reset");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="rp-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          New password
        </Label>
        <Input
          id="rp-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          minLength={8}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rp-confirm" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Confirm password
        </Label>
        <Input
          id="rp-confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" disabled={pending} className="w-full h-11">
        {pending ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving…
          </span>
        ) : (
          "Save new password"
        )}
      </Button>
    </form>
  );
}
