"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Settings,
  UserPlus,
  Mail,
  CheckCircle2,
  XCircle,
  Loader2,
  Users,
  Copy,
  Trash2,
  Shield,
} from "lucide-react";

interface UserRecord {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
}

interface InviteRecord {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  usedAt: string | null;
}

export default function AdminSettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("VIEWER");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    success: boolean;
    message: string;
    tempPassword?: string;
  } | null>(null);

  // Redirect non-admins
  useEffect(() => {
    if (session && session.user?.role !== "ADMIN") {
      router.push("/");
    }
  }, [session, router]);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        setInvites(data.invites);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    setInviteResult(null);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteName,
          role: inviteRole,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setInviteResult({
          success: true,
          message: `Created user ${inviteEmail}`,
          tempPassword: data.tempPassword,
        });
        setInviteEmail("");
        setInviteName("");
        setInviteRole("VIEWER");
        loadData();
      } else {
        setInviteResult({
          success: false,
          message: data.error || "Failed to invite",
        });
      }
    } catch {
      setInviteResult({ success: false, message: "Network error" });
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(userId: string, role: string) {
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    if (res.ok) loadData();
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm("Are you sure you want to delete this user?")) return;
    const res = await fetch(`/api/admin/settings?userId=${userId}`, {
      method: "DELETE",
    });
    if (res.ok) loadData();
  }

  if (session && session.user?.role !== "ADMIN") {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-8 w-8 text-primary" />
          Admin Settings
        </h1>
        <p className="mt-1 text-muted-foreground">
          Manage users, roles, and invitations.
        </p>
      </div>

      {/* Create new user */}
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4 text-chart-1" />
            Create User
          </CardTitle>
          <CardDescription>
            Create a new account with a temporary password. Share the password
            with the user so they can sign in and change it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invite-name">Name (optional)</Label>
                <Input
                  id="invite-name"
                  type="text"
                  placeholder="John Loyd"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="family@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="VIEWER">Viewer</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <Button type="submit" disabled={inviting}>
                {inviting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create User"
                )}
              </Button>
            </div>
          </form>

          {inviteResult && (
            <div className="mt-4 space-y-2">
              <div
                className={`flex items-center gap-2 text-sm ${
                  inviteResult.success ? "text-emerald-600" : "text-destructive"
                }`}
              >
                {inviteResult.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                {inviteResult.message}
              </div>
              {inviteResult.tempPassword && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      Temporary Password (shown once)
                    </p>
                    <code className="mt-1 block text-sm font-mono">
                      {inviteResult.tempPassword}
                    </code>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        inviteResult.tempPassword!
                      );
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current users */}
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-chart-2" />
            Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : users.length > 0 ? (
            <div className="divide-y divide-border/50">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 py-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
                    {(user.name || user.email)[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {user.name || user.email}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                  <select
                    value={user.role}
                    onChange={(e) =>
                      handleRoleChange(user.id, e.target.value)
                    }
                    disabled={user.id === session?.user?.id}
                    className="h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                  {user.id !== session?.user?.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteUser(user.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  {user.id === session?.user?.id && (
                    <Badge variant="outline" className="text-[10px]">
                      <Shield className="mr-1 h-3 w-3" />
                      You
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No users yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Pending invites */}
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-amber-500" />
            Invite History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-10 rounded-lg" />
          ) : invites.length > 0 ? (
            <div className="divide-y divide-border/50">
              {invites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center gap-3 py-3"
                >
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Created{" "}
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    variant={
                      inv.status === "ACCEPTED"
                        ? "default"
                        : inv.status === "REVOKED"
                        ? "destructive"
                        : "secondary"
                    }
                    className="text-[10px]"
                  >
                    {inv.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No invitations yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
