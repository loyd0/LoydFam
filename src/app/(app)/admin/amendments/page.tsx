"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PersonPicker, type PickedPerson } from "@/components/people/PersonPicker";

type Amendment = {
  id: string;
  targetType: "PERSON" | "PROPERTY";
  targetId: string;
  targetLabel: string;
  baseVersion: string;
  payload: unknown;
  note: string | null;
  status: "PENDING" | "APPROVED" | "APPLIED_MANUALLY" | "REJECTED";
  proposedBy: { id: string; name: string | null; email: string } | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewReason: string | null;
};

type OwnershipUser = {
  id: string; name: string | null; email: string;
  linkedPerson: { id: string; displayName: string } | null;
  verifiedPerson: { id: string; displayName: string } | null;
};

function targetHref(item: Amendment) {
  return item.targetType === "PERSON" ? `/people/${item.targetId}` : `/properties/${item.targetId}`;
}

function dateLabel(value: string) {
  return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminAmendmentsPage() {
  const [items, setItems] = useState<Amendment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/amendments${showAll ? "" : "?status=PENDING"}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load amendments.");
      setItems(data.amendments);
      setSelectedId((current) => data.amendments.some((item: Amendment) => item.id === current) ? current : data.amendments[0]?.id ?? null);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load amendments.");
    } finally { setLoading(false); }
  }, [showAll]);

  useEffect(() => { void load(); }, [load]);
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const manual = selected?.targetType === "PERSON" && selected.payload && typeof selected.payload === "object" && !Array.isArray(selected.payload) && Object.keys(selected.payload).length === 0;

  async function decide(decision: "APPROVE" | "REJECT" | "RESOLVE") {
    if (!selected || saving) return;
    if (decision !== "APPROVE" && !reason.trim()) { setError("Add a short review note for this decision."); return; }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/amendments", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, decision, reason: reason.trim() || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not review this proposal.");
      setReason("");
      setMessage(decision === "APPROVE" ? "Approved and published." : decision === "RESOLVE" ? "Marked as applied manually." : "Proposal rejected.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not review this proposal.");
    } finally { setSaving(false); }
  }

  return <div className="mx-auto max-w-6xl space-y-8 pb-12">
    <header className="border-b pb-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Administration / Review</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Family amendments</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Review suggested corrections before they become part of the published family record. A changed source record must be compared again before approval.</p>
    </header>

    {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"><AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />{error}</div>}
    {message && <div role="status" className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm"><Check aria-hidden="true" className="size-4 text-primary" />{message}</div>}

    <section aria-labelledby="review-queue-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 id="review-queue-heading" className="font-display text-xl font-semibold">Review queue</h2><p className="text-sm text-muted-foreground">{showAll ? "Recent decisions and pending requests" : "Waiting for an administrator"}</p></div>
        <div className="flex gap-2"><Button variant={showAll ? "outline" : "default"} size="sm" onClick={() => setShowAll(false)}>Pending</Button><Button variant={showAll ? "default" : "outline"} size="sm" onClick={() => setShowAll(true)}>All</Button></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <div className="max-h-[36rem] space-y-2 overflow-y-auto rounded-xl border bg-card p-3">
          {loading ? <p className="p-4 text-sm text-muted-foreground"><Loader2 aria-hidden="true" className="mr-2 inline size-4 animate-spin" />Loading requests…</p>
            : items.length ? items.map((item) => <button key={item.id} type="button" onClick={() => { setSelectedId(item.id); setReason(""); setError(null); }} aria-pressed={selectedId === item.id} className={`block min-h-16 w-full rounded-lg px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedId === item.id ? "bg-primary/10" : "hover:bg-muted"}`}>
              <span className="flex items-start justify-between gap-2"><span className="min-w-0 truncate text-sm font-semibold">{item.targetLabel}</span><span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">{item.status === "APPLIED_MANUALLY" ? "Resolved" : item.status.toLowerCase()}</span></span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">{item.targetType === "PERSON" ? "Person" : "Property"} · {item.proposedBy?.name || item.proposedBy?.email || "Former account"} · {dateLabel(item.createdAt)}</span>
            </button>) : <div className="p-4 text-sm text-muted-foreground">{showAll ? "No amendments have been submitted." : "No amendments are waiting for review."}</div>}
        </div>
        <div className="min-w-0 rounded-xl border bg-card p-5 sm:p-6">
          {selected ? <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-primary">{selected.targetType === "PERSON" ? "Person record" : "Property article"}</p><h3 className="mt-1 font-display text-2xl font-semibold">{selected.targetLabel}</h3><p className="mt-1 text-sm text-muted-foreground">Submitted by {selected.proposedBy?.name || selected.proposedBy?.email || "Former account"} on {dateLabel(selected.createdAt)}</p></div>
              <Link href={targetHref(selected)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary underline underline-offset-4">Open current record <ArrowUpRight aria-hidden="true" className="size-4" /></Link>
            </div>
            <section><h4 className="text-sm font-semibold">Reason for the correction</h4><p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm leading-6">{selected.note || "No explanation provided."}</p></section>
            {manual ? <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm leading-6"><strong>Manual correction requested.</strong> This request has no structured field changes. Open the current record, make the correction separately, then mark it resolved with a review note.</div>
              : <section><h4 className="text-sm font-semibold">Proposed values</h4><p className="mt-1 text-xs text-muted-foreground">Compare these values with the current record before approval.</p><pre className="mt-3 max-h-96 overflow-auto rounded-lg border bg-muted/30 p-4 text-xs leading-6">{JSON.stringify(selected.payload, null, 2)}</pre></section>}
            {selected.status === "PENDING" ? <div className="space-y-3 border-t pt-5">
              <label htmlFor="amendment-review-reason" className="text-sm font-semibold">Review note {manual ? "(required)" : "(required for rejection)"}</label>
              <textarea id="amendment-review-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} rows={3} placeholder="Explain your decision to the contributor" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              <div className="flex flex-wrap gap-2">
                <Button disabled={saving} onClick={() => void decide(manual ? "RESOLVE" : "APPROVE")}>{saving && <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />}{manual ? "Mark resolved" : "Approve and publish"}</Button>
                <Button disabled={saving} variant="outline" onClick={() => void decide("REJECT")}>Reject</Button>
              </div>
            </div> : <p className="border-t pt-4 text-sm text-muted-foreground">{selected.status === "APPROVED" ? "Approved and published" : selected.status === "APPLIED_MANUALLY" ? "Applied manually" : "Rejected"}{selected.reviewedAt ? ` on ${dateLabel(selected.reviewedAt)}` : ""}{selected.reviewReason ? ` · ${selected.reviewReason}` : ""}</p>}
          </div> : <p className="py-10 text-center text-sm text-muted-foreground">Select a request to review its details.</p>}
        </div>
      </div>
    </section>
    <OwnershipPanel />
  </div>;
}

function OwnershipPanel() {
  const [users, setUsers] = useState<OwnershipUser[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [candidate, setCandidate] = useState<PickedPerson | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const user = users.find((item) => item.id === selectedId);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/ownership", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load accounts.");
      setUsers(data.users);
      setSelectedId((current) => current || data.users[0]?.id || "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load accounts."); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function setOwner(personId: string | null) {
    if (!selectedId) return;
    setBusy(true); setError(null); setSaved(false);
    try {
      const response = await fetch("/api/admin/ownership", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: selectedId, personId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not confirm ownership.");
      await load(); setCandidate(null); setSaved(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not confirm ownership."); }
    finally { setBusy(false); }
  }

  return <section aria-labelledby="ownership-heading" className="space-y-4 border-t pt-8">
    <div><h2 id="ownership-heading" className="font-display text-xl font-semibold">Confirmed own records</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Confirm which family profile an account may edit directly. A person selected by the account for comparison does not grant edit access.</p></div>
    <div className="grid gap-5 rounded-xl border bg-card p-5 lg:grid-cols-2">
      <div className="space-y-3"><label htmlFor="ownership-user" className="text-sm font-semibold">Account</label><select id="ownership-user" value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setCandidate(null); setSaved(false); }} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="">Select an account</option>{users.map((item) => <option key={item.id} value={item.id}>{item.name || item.email} · {item.email}</option>)}</select>
        {user && <div className="space-y-1 rounded-lg bg-muted/40 p-4 text-sm"><p>Confirmed: <strong>{user.verifiedPerson?.displayName || "None"}</strong></p><p className="text-muted-foreground">Selected by account: {user.linkedPerson?.displayName || "None"}</p>{user.verifiedPerson && <Button size="sm" variant="outline" className="mt-2" disabled={busy} onClick={() => void setOwner(null)}>Remove confirmation</Button>}</div>}
      </div>
      <div className="space-y-3"><p className="text-sm font-semibold">Find the person to confirm</p><PersonPicker value={candidate} onChange={setCandidate} label="Search for an account's family person" disabled={busy || !selectedId} /><Button type="button" disabled={busy || !selectedId || !candidate} onClick={() => void setOwner(candidate!.id)}>Confirm this person for {user?.name || user?.email || "account"}</Button>
      </div>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}{saved && <p role="status" className="text-sm text-primary">Confirmed record saved.</p>}
  </section>;
}
