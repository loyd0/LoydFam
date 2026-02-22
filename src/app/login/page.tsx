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
        <Label htmlFor="email" className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Email address
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="font-sans text-sm focus-visible:ring-primary h-11"
          required
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Password
        </Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="font-sans text-sm focus-visible:ring-primary h-11"
          required
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm font-sans animate-in fade-in bg-destructive/10 text-destructive p-3 rounded-md">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button 
        type="submit" 
        disabled={loading}
        className="w-full h-11 mt-4 font-sans font-medium text-sm transition-all"
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
    <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-8">
      <div className="w-full max-w-md space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20 relative overflow-hidden">
            <Image 
              src="/family-crest.svg" 
              alt="Loyd Crest" 
              fill 
              className="object-contain p-2 dark:invert" 
            />
          </div>
          <div className="space-y-2">
            <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground">
              Loyd Family
            </h1>
            <p className="font-sans text-sm text-muted-foreground">
              Sign in to your account
            </p>
          </div>
        </div>

        {/* Login Form Container */}
        <div className="bg-card border border-border shadow-sm rounded-xl p-6 sm:p-8">
          <Suspense fallback={
            <div className="w-full space-y-4 animate-pulse">
              <div className="h-10 bg-muted/30 rounded w-full"></div>
              <div className="h-10 bg-muted/30 rounded w-full"></div>
              <div className="h-10 bg-primary/20 rounded w-full"></div>
            </div>
          }>
            <LoginForm />
          </Suspense>
        </div>

        {/* Footer */}
        <div className="text-center font-sans text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Loyd Family History. Invite-only access.</p>
        </div>
      </div>
    </div>
  );
}
