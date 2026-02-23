"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Invalid credentials.");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Email address
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="text-sm focus-visible:ring-primary h-11"
          required
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Password
        </Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="text-sm focus-visible:ring-primary h-11"
          required
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm animate-in fade-in bg-destructive/10 text-destructive p-3 rounded-md">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-11 mt-4 font-medium text-sm transition-all"
      >
        {loading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Signing in...</span>
          </div>
        ) : (
          "Sign In"
        )}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-background">

      {/* ── Left / single column: form ────────────────────────── */}
      <div className="flex w-full flex-col lg:w-1/2">
        <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-12">
          <div className="w-full max-w-sm space-y-6">

            {/* Mobile: crest above the form */}
            <div className="flex flex-col items-center gap-3 lg:hidden">
              <Image
                src="/family-crest.svg"
                alt="Loyd Family Crest"
                width={120}
                height={120}
                className="object-contain"
                unoptimized
                priority
              />
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign in</h1>
              <p className="text-sm text-muted-foreground">Access the Loyd Family archive.</p>
            </div>

            {/* Desktop: text heading only (crest is on the right panel) */}
            <div className="hidden lg:block space-y-1">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Welcome back</h1>
              <p className="text-sm text-muted-foreground">Sign in to access the Loyd Family archive.</p>
            </div>

            {/* Form card */}
            <div className="bg-card border border-border shadow-sm rounded-xl p-6 sm:p-8">
              <Suspense fallback={
                <div className="w-full space-y-4 animate-pulse">
                  <div className="h-10 bg-muted/30 rounded w-full" />
                  <div className="h-10 bg-muted/30 rounded w-full" />
                  <div className="h-10 bg-primary/20 rounded w-full" />
                </div>
              }>
                <LoginForm />
              </Suspense>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              © {new Date().getFullYear()} Loyd Family History. Invite-only access.
            </p>
          </div>
        </div>
      </div>

      {/* ── Right column: crest hero (desktop only) ───────────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.08)_0%,transparent_70%)]" />
        <div className="relative z-10 flex flex-col items-center gap-8 px-12 text-center">
          <Image
            src="/family-crest.svg"
            alt="Loyd Family Crest"
            width={380}
            height={380}
            className="object-contain drop-shadow-2xl"
            unoptimized
            priority
          />
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-primary-foreground tracking-tight">
              Loyd Family History
            </h2>
            <p className="text-sm text-primary-foreground/70 max-w-xs">
              Preserving our story across generations.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
