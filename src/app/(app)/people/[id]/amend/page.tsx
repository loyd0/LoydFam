"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import { updatePerson, type PersonPatch } from "@/app/(app)/people/actions";

const fields = [["givenName1", "First name"], ["givenName2", "Second name"], ["givenName3", "Third name"], ["surname", "Surname"], ["knownAs", "Known as"], ["preferredName", "Preferred name"], ["birthName", "Birth name"]] as const;
const prose = [["residencyText", "Places lived"], ["biographyShortMd", "Short biography"], ["biographyMd", "Life and family history"]] as const;
const input = "mt-2 min-h-11 w-full rounded-lg border bg-background px-3 py-2 text-base";
type RecordData = PersonPatch & { id: string; displayName: string; updatedAt: string };
export default function AmendPerson({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { ownedPersonId, isAdmin, loading: permissionsLoading } = usePermissions();
  const [person, setPerson] = useState<RecordData | null>(null);
  const [draft, setDraft] = useState<PersonPatch>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  const direct = isAdmin || ownedPersonId === id;
  useEffect(() => {
    let active = true;
    fetch(`/api/people/${id}`, { cache: "no-store" }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to open this record.");
      if (active) { setPerson(data); setDraft(Object.fromEntries([...fields, ...prose].map(([key]) => [key, data[key] ?? ""]).concat([["gender", data.gender ?? "UNKNOWN"]]))); }
    }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [id]);
  const changes = Object.fromEntries(Object.entries(draft).filter(([key, value]) => (person?.[key as keyof PersonPatch] ?? "") !== (value ?? ""))) as PersonPatch;
  const dirty = Object.keys(changes).length > 0 && !saved;
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!person) return;
    setSaving(true); setError("");
    try {
      if (direct && Object.keys(changes).length && !note.trim()) await updatePerson(id, changes);
      else {
        const response = await fetch("/api/amendments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType: "PERSON", targetId: id, baseVersion: person.updatedAt, changes, note }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to submit your amendment.");
      }
      setSaved(true); router.push(direct && Object.keys(changes).length && !note.trim() ? `/people/${id}` : "/amendments"); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Your draft could not be saved. Please try again."); }
    finally { setSaving(false); }
  }
  if (!person || permissionsLoading) return <div className="p-6" role="status">{error || "Opening the family record…"}</div>;
  return <div className="mx-auto max-w-3xl space-y-7 pb-8">
    <Link className="inline-flex min-h-11 items-center text-sm underline underline-offset-4" href={`/people/${id}`}>Back to {person.displayName}</Link>
    <header className="space-y-3"><p className="text-xs uppercase tracking-widest text-primary">{direct ? "Your family record" : "Contribute to the archive"}</p><h1 className="text-3xl font-semibold">{direct ? "Edit" : "Suggest changes to"} {person.displayName}</h1><p className="text-sm leading-7 text-muted-foreground">{direct ? "Keep your names, biography and places lived up to date. Saved changes appear in the record and its history. You can edit your personal events and contact details from your profile. To request a correction to shared events or family relationships, describe it below; adding a review note sends the whole amendment to an administrator." : "Your changes will be reviewed by an administrator before they appear in this person’s record. Explain what has changed and include sources where possible."}</p></header>
    <form onSubmit={submit} className="space-y-7"><fieldset disabled={saving} className="space-y-7 disabled:opacity-60">
      <section className="grid gap-4 sm:grid-cols-2">{fields.map(([key, label]) => <label key={key} className="text-sm font-medium">{label}<input className={input} maxLength={300} value={draft[key] ?? ""} onChange={event => setDraft({ ...draft, [key]: event.target.value })} /></label>)}<label className="text-sm font-medium">Gender<select className={input} value={draft.gender} onChange={event => setDraft({ ...draft, gender: event.target.value as PersonPatch["gender"] })}><option value="UNKNOWN">Unspecified</option><option value="MALE">Male</option><option value="FEMALE">Female</option></select></label></section>
      {prose.map(([key, label]) => <label key={key} className="block text-sm font-medium">{label}<textarea className={input} rows={key === "biographyMd" ? 10 : 4} value={draft[key] ?? ""} onChange={event => setDraft({ ...draft, [key]: event.target.value })} /></label>)}
      {<label className="block text-sm font-medium">Reason, supporting sources or another correction<textarea required={!direct || !dirty} maxLength={2000} rows={4} className={input} value={note} onChange={event => setNote(event.target.value)} placeholder="Explain the correction and sources. For dates, events or family relationships, describe what should change here; an administrator will review it." /></label>}
      {error && <p role="alert" className="rounded-lg border border-destructive p-4 text-sm text-destructive">{error}</p>}
      <button disabled={(!dirty && !note.trim()) || saving} className="min-h-12 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50">{saving ? "Saving…" : direct && !note.trim() ? "Save my record" : "Submit for approval"}</button>
    </fieldset></form>
  </div>;
}
