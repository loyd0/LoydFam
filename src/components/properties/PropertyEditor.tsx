"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PropertyRecord } from "@/lib/properties";
import { saveProperty } from "@/app/(app)/properties/actions";

const input = "mt-1 min-h-11 w-full rounded-md border bg-background px-3 py-2 text-base";
export function PropertyEditor({ property, version, proposal = false }: { property: PropertyRecord; version: number; proposal?: boolean }) {
  const [draft, setDraft] = useState(property);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const dirty = JSON.stringify(draft) !== JSON.stringify(property);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function field<K extends keyof PropertyRecord>(key: K, value: PropertyRecord[K]) { setDraft(d => ({ ...d, [key]: value })); }
  function renameHeading(index: number, heading: string) {
    setDraft(d => ({ ...d,
      paragraphs: d.paragraphs.map((paragraph, i) => i === index ? { ...paragraph, heading } : paragraph),
      images: d.images.map(image => image.sectionHeading === d.paragraphs[index].heading ? { ...image, sectionHeading: heading } : image),
    }));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      if (proposal) {
        const response = await fetch("/api/amendments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType: "PROPERTY", targetId: property.slug, baseVersion: version, changes: draft, note: reason }) });
        const data = await response.json();
        if (!response.ok) { setError(data.error || "Unable to submit your amendment."); return; }
        router.push("/amendments"); router.refresh(); return;
      }
      const result = await saveProperty(property.slug, version, draft, reason);
      if (result.error) { setError(result.error); return; }
      router.push(`/properties/${property.slug}/history`); router.refresh();
    } catch { setError("Unable to save. Your draft is still here; please try again."); }
    finally { setSaving(false); }
  }
  return <form onSubmit={submit} className="space-y-8">
    <p className="text-sm leading-relaxed text-muted-foreground">Editing version {version || "not yet recorded"}. Keep uncertain claims explicit and cite a source for every history paragraph and timeline entry. {proposal ? "Your amendment will go to an administrator for review. The published article stays as it is until approval." : "Your changes are published when you save."}</p>
    <fieldset disabled={saving} className="space-y-8 disabled:opacity-60">
      <section className="grid gap-4 sm:grid-cols-2">
        {(["name", "location", "category"] as const).map(key => <label key={key} className="text-sm font-medium capitalize">{key}<input required className={input} value={draft[key]} onChange={e => field(key, e.target.value)} /></label>)}
        <label className="text-sm font-medium">Evidence status<select className={input} value={draft.confidence} onChange={e => field("confidence", e.target.value as PropertyRecord["confidence"])}><option value="corroborated">Corroborated</option><option value="partial">Partially established</option><option value="unresolved">Unresolved</option></select></label>
        {([['summary','Introduction'],['connection','Family connection'],['status','The place today']] as const).map(([key,label]) => <label key={key} className="text-sm font-medium sm:col-span-2">{label}<textarea required rows={3} className={input} value={draft[key]} onChange={e => field(key, e.target.value)} /></label>)}
        <label className="text-sm font-medium">Sources last checked<input type="date" required className={input} value={draft.statusChecked} onChange={e => field("statusChecked", e.target.value)} /></label>
      </section>
      <section className="space-y-4"><h2 className="text-xl font-semibold">History</h2>
        {draft.paragraphs.map((item, i) => <div key={i} className="space-y-3 rounded-lg border p-4">
          <label className="block text-sm">Heading<input required className={input} value={item.heading} onChange={e => renameHeading(i, e.target.value)} /></label>
          <label className="block text-sm">Account<textarea required rows={6} className={input} value={item.text} onChange={e => field("paragraphs", draft.paragraphs.map((x,j) => j === i ? { ...x, text: e.target.value } : x))} /></label>
          <SourcePicker sources={draft.sources} selected={item.sourceIds} onChange={sourceIds => field("paragraphs", draft.paragraphs.map((x,j) => j === i ? { ...x, sourceIds } : x))} />
          <button type="button" className="min-h-11 text-sm text-destructive underline" onClick={() => field("paragraphs", draft.paragraphs.filter((_,j) => j !== i))}>Remove paragraph {i+1}</button>
        </div>)}
        <button type="button" className="min-h-11 rounded border px-4 text-sm" onClick={() => field("paragraphs", [...draft.paragraphs, { heading: "", text: "", sourceIds: [] }])}>Add history paragraph</button>
      </section>
      {draft.images.length > 0 && <details className="rounded-lg border p-4">
        <summary className="min-h-11 cursor-pointer text-xl font-semibold">Photographs in the history · {draft.images.length}</summary>
        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">Place each gallery beside the part of the history it illustrates. The opening photograph also opens the full collection. Credits and source links stay with every image.</p>
        <div className="space-y-5">{draft.images.map((image, i) => <label key={image.url} className="block border-t pt-4 text-sm">
          <span className="block leading-relaxed">{image.caption}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{image.dateLabel || image.credit}</span>
          <select className={input} aria-label={`History section for photograph ${i + 1}`} value={draft.paragraphs.some(p => p.heading === image.sectionHeading) ? image.sectionHeading : ""} onChange={e => field("images", draft.images.map((x, j) => j === i ? { ...x, sectionHeading: e.target.value } : x))}>
            <option value="">More photographs after the history</option>
            {[...new Set(draft.paragraphs.map(p => p.heading).filter(Boolean))].map(heading => <option key={heading} value={heading}>{heading}</option>)}
          </select>
        </label>)}</div>
      </details>}
      <section className="space-y-4"><h2 className="text-xl font-semibold">Timeline</h2>
        {draft.timeline.map((item, i) => <div key={i} className="space-y-3 rounded-lg border p-4">
          <label className="block text-sm">Date or period<input required className={input} value={item.date} onChange={e => field("timeline", draft.timeline.map((x,j) => j === i ? { ...x, date: e.target.value } : x))} /></label>
          <label className="block text-sm">Event<textarea required rows={3} className={input} value={item.text} onChange={e => field("timeline", draft.timeline.map((x,j) => j === i ? { ...x, text: e.target.value } : x))} /></label>
          <SourcePicker sources={draft.sources} selected={item.sourceIds} onChange={sourceIds => field("timeline", draft.timeline.map((x,j) => j === i ? { ...x, sourceIds } : x))} />
          <button type="button" className="min-h-11 text-sm text-destructive underline" onClick={() => field("timeline", draft.timeline.filter((_,j) => j !== i))}>Remove timeline entry {i+1}</button>
        </div>)}
        <button type="button" className="min-h-11 rounded border px-4 text-sm" onClick={() => field("timeline", [...draft.timeline, { date: "", text: "", sourceIds: [] }])}>Add timeline entry</button>
      </section>
      <section className="space-y-4"><h2 className="text-xl font-semibold">Sources</h2><p className="text-sm text-muted-foreground">Add the source, then select it beneath the paragraphs or events it supports. Preserve the original workbook reference.</p>
        {draft.sources.map((item, i) => <div key={item.id} className="space-y-3 rounded-lg border p-4"><p className="text-xs text-muted-foreground">Reference {item.id}</p>
          {([['title','Source title'],['url','Web address'],['publisher','Publisher or archive'],['note','Evidence notes']] as const).map(([key,label]) => <label key={key} className="block text-sm">{label}<input type={key === 'url' ? 'url' : 'text'} required={key === 'title'} className={input} value={item[key] ?? ""} onChange={e => field("sources", draft.sources.map((x,j) => j === i ? { ...x, [key]: key === 'url' ? e.target.value || null : e.target.value } : x))} /></label>)}
          {item.id !== "workbook" && <button type="button" className="min-h-11 text-sm text-destructive underline" onClick={() => field("sources", draft.sources.filter((_,j) => j !== i))}>Remove source {item.id}</button>}
        </div>)}
        <button type="button" className="min-h-11 rounded border px-4 text-sm" onClick={() => field("sources", [...draft.sources, { id: `s_${crypto.randomUUID().slice(0,8)}`, title: "", url: null }])}>Add source</button>
      </section>
      <section className="space-y-4"><h2 className="text-xl font-semibold">Other details</h2>
        {([['uncertainties','What remains uncertain'],['aliases','Other place names'],['relatedNames','Associated people’s names']] as const).map(([key,label]) => <label key={key} className="block text-sm font-medium">{label} <span className="font-normal text-muted-foreground">— one per line</span><textarea rows={4} className={input} value={draft[key].join('\n')} onChange={e => field(key, e.target.value.split('\n'))} onBlur={() => field(key, draft[key].map(s => s.trim()).filter(Boolean))} /></label>)}
      </section>
      <section className="space-y-4"><h2 className="text-xl font-semibold">Map location and evidence</h2>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={Boolean(draft.mapLocation)} onChange={e => field("mapLocation", e.target.checked ? {slug:property.slug,lat:0,lng:0,label:property.name,precision:"locality",explanation:"",sourceUrl:"",mapSourceUrl:""} : null)} />Show a sourced location on the map</label>
        {draft.mapLocation && <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
          {(["lat","lng"] as const).map(key => <label key={key} className="text-sm">{key === "lat" ? "Latitude" : "Longitude"}<input type="number" step="any" min={key === "lat" ? -90 : -180} max={key === "lat" ? 90 : 180} required className={input} value={draft.mapLocation![key]} onChange={e => field("mapLocation", {...draft.mapLocation!, [key]: e.target.valueAsNumber})} /></label>)}
          <label className="text-sm">Precision<select className={input} value={draft.mapLocation.precision} onChange={e => field("mapLocation", {...draft.mapLocation!,precision:e.target.value as "building"|"estate"|"locality"})}><option value="locality">Approximate locality</option><option value="estate">Approximate estate</option><option value="building">Verified building</option></select></label>
          {([['label','Map label'],['explanation','Location evidence and limitations'],['sourceUrl','Research source URL'],['mapSourceUrl','Coordinate source URL']] as const).map(([key,label]) => <label key={key} className="text-sm sm:col-span-2">{label}<input required type={key.endsWith('Url') ? 'url' : 'text'} className={input} value={draft.mapLocation![key]} onChange={e => field("mapLocation", {...draft.mapLocation!,[key]:e.target.value})} /></label>)}
        </div>}
        <p className="text-sm text-muted-foreground">Use a building pin only when the property identity and coordinates are supported. Leave unresolved places unpinned.</p>
      </section>
      <section className="space-y-4"><h2 className="text-xl font-semibold">Archive image references</h2>
        {(draft.archiveImages ?? []).map((item,i) => <div key={i} className="space-y-3 rounded-lg border p-4">{([['title','Title'],['url','Archive web address'],['institution','Archive or institution'],['description','Description and identity notes']] as const).map(([key,label]) => <label key={key} className="block text-sm">{label}<textarea required rows={key === 'description' ? 3 : 1} className={input} value={item[key]} onChange={e => field("archiveImages", draft.archiveImages!.map((x,j) => j === i ? {...x,[key]: e.target.value} : x))} /></label>)}<button type="button" className="min-h-11 text-sm text-destructive underline" onClick={() => field("archiveImages", draft.archiveImages!.filter((_,j) => j !== i))}>Remove archive reference {i+1}</button></div>)}
        <button type="button" className="min-h-11 rounded border px-4 text-sm" onClick={() => field("archiveImages", [...draft.archiveImages ?? [], {title:"",url:"",institution:"",description:""}])}>Add archive reference</button>
        <p className="text-sm text-muted-foreground">Existing licensed image files and linked family profiles are preserved when you save.</p>
      </section>
      <label className="block text-sm font-medium">Reason for this change<textarea required maxLength={2000} rows={3} className={input} placeholder="Describe the new evidence, correction or update." value={reason} onChange={e => setReason(e.target.value)} /></label>
      {error && <p role="alert" className="rounded-lg border border-destructive p-4 text-sm text-destructive">{error}</p>}
      <button disabled={!dirty || saving} className="min-h-12 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50">{saving ? "Saving…" : proposal ? "Submit for approval" : "Publish revision"}</button>
    </fieldset>
  </form>;
}
function SourcePicker({ sources, selected, onChange }: { sources: PropertyRecord["sources"]; selected: string[]; onChange: (ids: string[]) => void }) {
  return <fieldset className="rounded border p-3"><legend className="px-1 text-sm font-medium">Supporting sources</legend><div className="max-h-52 space-y-1 overflow-y-auto">{sources.map(source => <label key={source.id} className="flex min-h-11 items-start gap-3 py-2 text-sm"><input type="checkbox" className="mt-1 size-4 shrink-0" checked={selected.includes(source.id)} onChange={e => onChange(e.target.checked ? [...selected, source.id] : selected.filter(id => id !== source.id))} /><span>{source.title || "Untitled source"} <span className="text-xs text-muted-foreground">({source.id})</span></span></label>)}</div></fieldset>;
}
