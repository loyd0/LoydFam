"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PersonPicker, type PickedPerson } from "@/components/people/PersonPicker";
import {
  Lock,
  CheckCircle2,
  XCircle,
  Loader2,
  User,
  Shield,
} from "lucide-react";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [linkedPerson, setLinkedPerson] = useState<PickedPerson | null>(null);
  const [linkLoading, setLinkLoading] = useState(true);
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkMessage, setLinkMessage] = useState("");
  const linkSelectionVersion = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const initialVersion = linkSelectionVersion.current;
    fetch("/api/account/linked-person", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        if (!controller.signal.aborted && linkSelectionVersion.current === initialVersion) setLinkedPerson(data.person);
      })
      .catch(() => {
        if (!controller.signal.aborted && linkSelectionVersion.current === initialVersion) setLinkMessage("Could not load your linked family person.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLinkLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function saveLinkedPerson(person: PickedPerson | null) {
    linkSelectionVersion.current += 1;
    const saveVersion = linkSelectionVersion.current;
    const previous = linkedPerson;
    setLinkedPerson(person); setLinkMessage("");
    setLinkSaving(true);
    try {
      const response = await fetch("/api/account/linked-person", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId: person?.id ?? null }),
      });
      if (!response.ok) throw new Error("Save failed");
      if (linkSelectionVersion.current === saveVersion) {
        setLinkMessage(person ? "Saved. Person tools will use this as your starting person." : "Cleared. Person tools will use their standard starting person.");
      }
    } catch {
      if (linkSelectionVersion.current === saveVersion) {
        setLinkedPerson(previous); setLinkMessage("Could not save your selection. Please try again.");
      }
    } finally {
      if (linkSelectionVersion.current === saveVersion) setLinkSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);

    if (newPassword !== confirmPassword) {
      setResult({ success: false, message: "Passwords do not match." });
      return;
    }

    if (newPassword.length < 8) {
      setResult({
        success: false,
        message: "Password must be at least 8 characters.",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, message: "Password changed successfully!" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setResult({ success: false, message: data.error || "Failed to change password." });
      }
    } catch {
      setResult({ success: false, message: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your account and security.
        </p>
      </div>

      {/* Account info */}
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-chart-2" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex min-w-0 flex-wrap items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold">
              {(session?.user?.name || session?.user?.email || "?")[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="break-words font-medium">{session?.user?.name || "—"}</p>
              <p className="break-all text-sm text-muted-foreground">
                {session?.user?.email}
              </p>
            </div>
            <Badge
              variant="outline"
              className="flex items-center gap-1"
            >
              <Shield className="h-3 w-3" />
              {session?.user?.role || "VIEWER"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4 text-chart-2" />This is me</CardTitle>
          <CardDescription>Choose the family record that represents you. Family tools use it as their starting person. An administrator separately confirms ownership before you can edit that record directly.</CardDescription>
        </CardHeader>
        <CardContent className="max-w-xl space-y-2">
          {linkLoading ? <p className="text-sm text-muted-foreground">Loading your selection…</p> : <PersonPicker value={linkedPerson} onChange={saveLinkedPerson} label="Choose who you are in the family" disabled={linkSaving} />}
          {linkSaving && <p role="status" className="text-xs text-muted-foreground">Saving your selection…</p>}
          {linkMessage && <p role="status" className="text-xs text-muted-foreground">{linkMessage}</p>}
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4 text-chart-1" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your password to keep your account secure.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="Min 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>

            {result && (
              <div
                className={`flex items-center gap-2 text-sm ${
                  result.success ? "text-emerald-600" : "text-destructive"
                }`}
              >
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                {result.message}
              </div>
            )}

            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating…
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
