"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, ChevronRight, Loader2, RotateCcw, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PERMISSION_KEYS, type PermissionKey, type PermissionMap, type PermissionOverrides } from "@/lib/permissions";

type AdminUserPermissions = {
  id: string;
  name: string | null;
  email: string;
  role: "ADMIN" | "VIEWER";
  overrides: PermissionOverrides;
  permissions: PermissionMap;
};

type PermissionSnapshot = {
  version: number;
  defaults: PermissionMap;
  users: AdminUserPermissions[];
};

type PermissionInfo = { label: string; description: string; group: "Pages" | "Actions" };
type Choice = "inherit" | "allow" | "deny";

const PERMISSION_INFO: Record<PermissionKey, PermissionInfo> = {
  "dashboard.view": { label: "Dashboard", description: "Open the family overview.", group: "Pages" },
  "people.view": { label: "People", description: "Browse family profiles and records.", group: "Pages" },
  "tree.view": { label: "Family tree", description: "Browse the family tree.", group: "Pages" },
  "map.view": { label: "Family map", description: "View family locations on the map.", group: "Pages" },
  "properties.view": { label: "Family properties", description: "Browse houses, estates, and related history.", group: "Pages" },
  "mindmap.view": { label: "Mind map", description: "View the family mind map.", group: "Pages" },
  "timeline.view": { label: "Timeline", description: "Browse family events by date.", group: "Pages" },
  "stats.view": { label: "Statistics", description: "View family statistics.", group: "Pages" },
  "generations.view": { label: "Generations", description: "Browse family generations.", group: "Pages" },
  "fanChart.view": { label: "Fan chart", description: "View the ancestor fan chart.", group: "Pages" },
  "relationship.view": { label: "Relationship finder", description: "Find relationships between family members.", group: "Pages" },
  "history.view": { label: "System history", description: "View changes in permitted sections. Account and security history stays with administrators.", group: "Pages" },
  "people.edit": { label: "Edit people", description: "Change profiles, events, relationships and contact details.", group: "Actions" },
  "properties.edit": { label: "Edit properties", description: "Change property records.", group: "Actions" },
  "media.upload": { label: "Manage photos and documents", description: "Upload, caption, choose profile photos and remove media.", group: "Actions" },
  "notes.edit": { label: "Edit notes", description: "Create and update family notes.", group: "Actions" },
  "sources.download": { label: "Download files and exports", description: "Download source workbooks and bulk family exports.", group: "Actions" },
};

async function readSnapshot(): Promise<PermissionSnapshot> {
  const response = await fetch("/api/admin/permissions", { cache: "no-store" });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.defaults || !Array.isArray(data.users)) {
    throw new Error(data?.error || "Could not load permission settings.");
  }
  return data as PermissionSnapshot;
}

function RuleChoices({
  label, choice, isDefaults, disabled, onChange,
}: {
  label: string;
  choice: Choice;
  isDefaults: boolean;
  disabled: boolean;
  onChange: (choice: Choice) => void;
}) {
  const choices: { value: Choice; label: string }[] = isDefaults
    ? [{ value: "allow", label: "Allow" }, { value: "deny", label: "Deny" }]
    : [{ value: "inherit", label: "Inherit" }, { value: "allow", label: "Allow" }, { value: "deny", label: "Deny" }];
  return <div role="group" aria-label={`${label} access rule`} className={`grid w-full items-stretch rounded-lg border border-border bg-muted/60 p-1 sm:w-64 sm:shrink-0 ${isDefaults ? "grid-cols-2" : "grid-cols-3"}`}>
    {choices.map(({ value, label: optionLabel }) => {
      const selected = choice === value;
      const selectedStyle = value === "allow"
        ? "bg-primary/10 text-primary ring-1 ring-primary/40"
        : value === "deny"
          ? "bg-destructive/10 text-destructive ring-1 ring-destructive/40"
          : "bg-card text-foreground ring-1 ring-border";
      return <button
        key={value}
        type="button"
        aria-pressed={selected}
        disabled={disabled}
        onClick={() => { if (!selected) onChange(value); }}
        className={`flex min-h-11 items-center justify-center gap-1 rounded-md px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 ${selected ? `${selectedStyle} shadow-sm` : "text-muted-foreground hover:bg-card/70 hover:text-foreground"}`}
      >{selected && <Check aria-hidden="true" className="size-3.5 shrink-0" />}{optionLabel}</button>;
    })}
  </div>;
}

export default function AdminPermissionsPage() {
  const [snapshot, setSnapshot] = useState<PermissionSnapshot | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("defaults");
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSnapshot(await readSnapshot());
      setError(null);
      setSaved(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load permission settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selectedUser = useMemo(
    () => snapshot?.users.find((user) => user.id === selectedUserId) ?? null,
    [snapshot, selectedUserId],
  );
  const isDefaults = selectedUserId === "defaults";
  const isLockedAdmin = selectedUser?.role === "ADMIN";
  const accounts = useMemo(() => snapshot?.users.filter((user) =>
    `${user.name ?? ""} ${user.email}`.toLowerCase().includes(accountSearch.trim().toLowerCase())
  ) ?? [], [accountSearch, snapshot]);
  const entries = PERMISSION_KEYS.filter((key) => {
    if (key === "people.edit" || key === "properties.edit") return false;
    const info = PERMISSION_INFO[key];
    const query = filter.trim().toLowerCase();
    return !query || `${info.label} ${info.description} ${key}`.toLowerCase().includes(query);
  });

  const save = useCallback(async (body: Record<string, unknown>) => {
    if (!snapshot || saving || isLockedAdmin) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const response = await fetch("/api/admin/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: snapshot.version, ...body }),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 409) {
        setSnapshot(await readSnapshot());
        setError("These settings changed in another session. The latest version is loaded; review it and apply your change again.");
        return;
      }
      if (!response.ok || !data?.defaults || !Array.isArray(data.users)) {
        throw new Error(data?.error || "Could not save this permission change.");
      }
      setSnapshot(data as PermissionSnapshot);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this permission change.");
    } finally {
      setSaving(false);
    }
  }, [isLockedAdmin, saving, snapshot]);

  function changePermission(key: PermissionKey, value: Choice) {
    const current: Choice = isDefaults ? snapshot?.defaults[key] ? "allow" : "deny" : selectedUser?.overrides[key] ?? "inherit";
    if (value === current) return;
    if (isDefaults) void save({ defaults: { [key]: value === "allow" } });
    else if (selectedUser) void save({ userId: selectedUser.id, overrides: { [key]: value } });
  }

  function effectivePermission(key: PermissionKey) {
    const allowed = isDefaults ? snapshot?.defaults[key] === true : selectedUser?.permissions[key] === true;
    if (!allowed) return false;
    const peopleRequired = key === "people.edit" || key === "media.upload" || key === "notes.edit";
    if (peopleRequired) return isDefaults ? snapshot?.defaults["people.view"] === true : selectedUser?.permissions["people.view"] === true;
    if (key === "properties.edit") return isDefaults ? snapshot?.defaults["properties.view"] === true : selectedUser?.permissions["properties.view"] === true;
    return allowed;
  }

  function accessDetail(key: PermissionKey): string {
    if (isLockedAdmin) return "Administrator access is always on";
    const override = selectedUser?.overrides[key];
    const requested = isDefaults ? snapshot?.defaults[key] : override === "allow" || (!override && snapshot?.defaults[key]);
    if (requested && !effectivePermission(key)) {
      return key === "properties.edit" ? "Also needs Family properties" : "Also needs People";
    }
    if (isDefaults) return "Default for viewer accounts";
    if (!override) return `Inherited: ${snapshot?.defaults[key] ? "allowed" : "denied"} by default`;
    return "Personal rule";
  }

  return <div className="mx-auto max-w-6xl space-y-6 pb-10">
    <header className="border-b border-border pb-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Administration <ChevronRight aria-hidden="true" className="mx-1 inline size-3" /> Access</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Permissions</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Choose what family members can open and which separate actions they can take. Confirmed account holders can edit their own record; changes to other people and properties go through administrator review.</p>
        </div>
        <div aria-live="polite" className="flex min-h-9 items-center gap-2 text-sm text-muted-foreground">
          {loading ? <><Loader2 aria-hidden="true" className="size-4 animate-spin" />Loading…</>
            : saving ? <><Loader2 aria-hidden="true" className="size-4 animate-spin" />Saving change…</>
              : saved ? <><Check aria-hidden="true" className="size-4 text-primary" />All changes saved</>
                : snapshot ? "Changes save automatically" : null}
        </div>
      </div>
    </header>

    {error && <div role="alert" className="flex flex-wrap items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-foreground">
      <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
      <span className="min-w-0 flex-1">{error}</span>
      {!snapshot && <Button size="sm" variant="outline" onClick={() => void load()}>Try again</Button>}
    </div>}

    <div className="grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="min-w-0 rounded-xl border border-border bg-card p-4 lg:sticky lg:top-6">
        <button type="button" aria-expanded={accountPickerOpen} aria-controls="permission-account-picker" onClick={() => setAccountPickerOpen((open) => !open)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden">
          <span className="min-w-0"><span className="block text-xs font-medium text-muted-foreground">Access for</span><span className="block truncate font-semibold">{isDefaults ? "Default access" : selectedUser?.name || selectedUser?.email || "Choose an account"}</span></span>
          <span className="shrink-0 text-sm font-medium text-primary">{accountPickerOpen ? "Done" : "Change"}</span>
        </button>
        <div id="permission-account-picker" className={`${accountPickerOpen ? "block border-t border-border pt-4" : "hidden"} mt-2 lg:mt-0 lg:block lg:border-0 lg:pt-0`}>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><Users aria-hidden="true" className="size-4 text-primary" />Access for</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">Select the shared rule or an account.</p>
          <button type="button" onClick={() => { setSelectedUserId("defaults"); setAccountPickerOpen(false); }} aria-pressed={isDefaults} className={`mt-4 flex min-h-12 w-full items-center justify-between rounded-lg px-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isDefaults ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
            Default access <span className="text-xs font-normal">All viewers</span>
          </button>
          <div className="mt-4 border-t border-border pt-4">
            <label htmlFor="permission-account-search" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Individual accounts</label>
            <div className="relative mt-2">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="permission-account-search" value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} placeholder="Find an account" className="h-11 pl-9" />
            </div>
            <div role="group" className="mt-2 max-h-48 space-y-1 overflow-y-auto" aria-label="Accounts">
              {loading && !snapshot ? <p className="px-3 py-3 text-sm text-muted-foreground">Loading accounts…</p>
                : accounts.length ? accounts.map((user) => <button key={user.id} type="button" onClick={() => { setSelectedUserId(user.id); setAccountPickerOpen(false); }} aria-pressed={selectedUserId === user.id} className={`block min-h-12 w-full rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedUserId === user.id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
                  <span className="block truncate text-sm font-medium">{user.name || user.email}</span>
                  <span className="block truncate text-xs text-muted-foreground">{user.email}{user.role === "ADMIN" ? " · Administrator" : ""}</span>
                </button>) : <p className="px-3 py-3 text-sm text-muted-foreground">{snapshot?.users.length ? "No matching accounts." : "No accounts yet."}</p>}
            </div>
          </div>
        </div>
      </aside>

      <section className="min-w-0 space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{isDefaults ? "Shared rule" : isLockedAdmin ? "Administrator" : "Personal rules"}</p>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">{isDefaults ? "Default access" : selectedUser?.name || selectedUser?.email || "Choose an account"}</h2>
            <p className="mt-1 max-w-xl text-sm leading-5 text-muted-foreground">{isDefaults ? "These choices apply to every viewer unless a personal rule changes them." : isLockedAdmin ? "Administrators always have full access. Their rules cannot be changed here." : selectedUser ? "Inherit follows the default. Allow and Deny set a rule for this account." : "Choose an account to review personal access."}</p>
          </div>
          <div className="relative w-full sm:max-w-64">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Find a permission" aria-label="Find a permission" className="h-11 pl-9" />
          </div>
        </div>

        {loading && !snapshot ? <div role="status" className="rounded-xl border bg-card px-5 py-10 text-center text-sm text-muted-foreground">Loading permissions…</div>
          : snapshot && (isDefaults || selectedUser) ? entries.length ? (["Pages", "Actions"] as const).map((group) => {
            const groupKeys = entries.filter((key) => PERMISSION_INFO[key].group === group);
            if (!groupKeys.length) return null;
            return <section key={group} aria-labelledby={`permissions-${group.toLowerCase()}`} className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border bg-muted/40 px-4 py-3 sm:px-5">
                <h3 id={`permissions-${group.toLowerCase()}`} className="font-display text-base font-semibold">{group === "Pages" ? "Pages and views" : "Changes and downloads"}</h3>
                <p className="text-sm text-muted-foreground">{group === "Pages" ? "Places in the archive this account can open." : "Actions this account can take after opening a permitted section."}</p>
              </div>
              <div className="divide-y divide-border">
                {groupKeys.map((key) => {
                  const info = PERMISSION_INFO[key];
                  const choice: Choice = isDefaults ? snapshot.defaults[key] ? "allow" : "deny" : selectedUser?.overrides[key] ?? "inherit";
                  const allowed = effectivePermission(key);
                  return <div key={key} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:px-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h4 className="text-sm font-semibold text-foreground">{info.label}</h4>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${allowed ? "text-primary" : "text-muted-foreground"}`}><span aria-hidden="true" className={`size-1.5 rounded-full ${allowed ? "bg-primary" : "bg-muted-foreground"}`} />{allowed ? "Can access" : "No access"}</span>
                      </div>
                      <p className="mt-1 text-sm leading-5 text-muted-foreground">{info.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{accessDetail(key)}</p>
                    </div>
                    <RuleChoices label={info.label} choice={choice} isDefaults={isDefaults} disabled={loading || saving || isLockedAdmin} onChange={(value) => changePermission(key, value)} />
                  </div>;
                })}
              </div>
            </section>;
          }) : <div className="rounded-xl border bg-card px-5 py-10 text-center">
            <p className="font-medium">No permissions match “{filter}”.</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a shorter name or search for a page or action.</p>
            <Button className="mt-4" variant="outline" onClick={() => setFilter("")}>Clear search</Button>
          </div> : !loading && <div className="rounded-xl border bg-card px-5 py-10 text-center text-sm text-muted-foreground">Permission settings are unavailable.</div>}

        {snapshot && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm text-muted-foreground">
          <p>Changes are checked on the server and recorded in history.</p>
          <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={() => void load()} disabled={loading || saving}><RotateCcw aria-hidden="true" className="size-4" />Refresh</Button>
        </footer>}
      </section>
    </div>
  </div>;
}
