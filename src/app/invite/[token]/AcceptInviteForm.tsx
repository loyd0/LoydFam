"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2 } from "lucide-react";
import { acceptInvite } from "@/app/invite/[token]/actions";

interface Props {
  token: string;
  email: string;
  name: string;
}

export function AcceptInviteForm({ token, email, name }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [displayName, setDisplayName] = useState(name);
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
        await acceptInvite({ token, name: displayName.trim() || null, password });
        const res = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });
        if (res?.error) {
          setError("Account created — please sign in from the login page.");
          router.push("/login");
          return;
        }
        router.push("/");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="accept-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Your name
        </Label>
        <Input
          id="accept-name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Email
        </Label>
        <Input value={email} disabled />
      </div>
      <div className="space-y-2">
        <Label htmlFor="accept-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Choose a password
        </Label>
        <Input
          id="accept-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="accept-confirm" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Confirm password
        </Label>
        <Input
          id="accept-confirm"
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
            <Loader2 className="h-4 w-4 animate-spin" /> Activating…
          </span>
        ) : (
          "Activate account"
        )}
      </Button>
    </form>
  );
}
