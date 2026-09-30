"use client";

import Link from "next/link";
import { getRevisionChanges } from "@/lib/revision-display";
import { useEffect, useState } from "react";
import { Check, Clock3, FilePenLine, RefreshCw, X } from "lucide-react";

type Amendment = { id: string; targetType: string; targetId: string; targetLabel?: string; status: string; note?: string; reviewReason?: string | null; createdAt: string; reviewedAt?: string | null; changes?: Record<string, unknown> };
const labels: Record<string, string> = { PENDING: "Awaiting review", APPROVED: "Approved and published", REJECTED: "Not approved", APPLIED_MANUALLY: "Resolved by an administrator" };
export default function MyAmendments() {
  const [items, setItems] = useState<Amendment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/amendments", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load your amendments.");
      setItems(data.amendments);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to load your amendments."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  return <div className="mx-auto max-w-4xl space-y-8 pb-8">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6"><div className="space-y-3"><p className="text-xs uppercase tracking-widest text-primary">Your contributions</p><h1 className="text-3xl font-semibold">My amendments</h1><p className="max-w-xl text-sm leading-7 text-muted-foreground">Follow the changes you have suggested to people and properties. The published record changes after an administrator approves your amendment.</p></div><button onClick={load} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm disabled:opacity-50"><RefreshCw className="size-4" />Refresh</button></header>
    {error && <p role="alert" className="rounded-lg border border-destructive p-4 text-sm text-destructive">{error}</p>}
    {loading ? <p role="status" className="text-muted-foreground">Loading your contributions…</p> : items.length === 0 ? <div className="space-y-4 rounded-xl border p-6 sm:p-10"><FilePenLine className="size-7 text-primary" /><h2 className="text-xl font-semibold">Your next discovery belongs here</h2><p className="max-w-lg text-sm leading-7 text-muted-foreground">Open a person or property and choose “Suggest an amendment”. Add the correction and any supporting sources; you can follow its review here.</p><div className="flex flex-wrap gap-4"><Link href="/people" className="inline-flex min-h-11 items-center text-sm text-primary underline">Browse people</Link><Link href="/properties" className="inline-flex min-h-11 items-center text-sm text-primary underline">Browse properties</Link></div></div> : <ol className="space-y-4">{items.map(item => {
      const accepted = item.status === "APPROVED" || item.status === "APPLIED_MANUALLY";
      const Icon = accepted ? Check : item.status === "REJECTED" ? X : Clock3;
      return <li key={item.id} className="space-y-4 rounded-xl border p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">{item.targetType === "PERSON" ? "Person" : "Property"} · Submitted {new Date(item.createdAt).toLocaleDateString("en-GB")}</p><Link href={item.targetType === "PERSON" ? `/people/${item.targetId}` : `/properties/${item.targetId}`} className="mt-1 inline-flex min-h-11 items-center text-lg font-semibold underline-offset-4 hover:underline">{item.targetLabel || item.targetId}</Link></div><span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs ${accepted ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}><Icon className="size-4" />{labels[item.status] || item.status}</span></div>{item.note && <p className="whitespace-pre-wrap text-sm leading-7">{item.note}</p>}{item.reviewReason && <div className="border-l-2 border-primary/40 pl-4"><p className="text-xs font-medium text-muted-foreground">Administrator’s response</p><p className="mt-1 whitespace-pre-wrap text-sm leading-7">{item.reviewReason}</p></div>}{item.changes && Object.keys(item.changes).length > 0 && <details className="text-sm"><summary className="min-h-11 cursor-pointer py-3 text-primary">View submitted changes</summary><dl className="space-y-4 rounded-lg bg-muted/50 p-4">{getRevisionChanges({}, item.changes, { fullText: true }).map(change => <div key={change.path}><dt className="font-medium">{change.label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{change.after}</dd></div>)}</dl></details>}</li>;
    })}</ol>}
  </div>;
}
