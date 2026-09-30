"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, FileSpreadsheet, Loader2, Upload, XCircle } from "lucide-react";

interface ImportSummary {
  importRunId: string; sheetsProcessed: number; rawRowsStored: number; peopleUpserted: number;
  eventsUpserted: number; relationshipsCreated: number; partnershipsCreated: number;
  contactsUpserted: number; issuesCount: number; alreadyImported?: boolean;
}
interface ImportPreview {
  sha256: string; filename: string; alreadyImported: boolean; savedSummary: ImportSummary | null;
  sheets: { sheetName: string; rows: number; columns: number }[]; rawRows: number;
  counts: { people: number; events: number; parentChild: number; partnerships: number; contacts: number };
  existingPeople: { key: string; displayName: string }[]; newPeople: { key: string; displayName: string }[];
}
interface ImportRun {
  id: string; status: string; startedAt: string | null; finishedAt: string | null; filename: string;
  sha256: string; sourceArchived: boolean; sheetsCount: number; issuesCount: number; summary: ImportSummary | null;
}

export default function ImportsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [history, setHistory] = useState<ImportRun[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/imports");
      if (response.ok) setHistory((await response.json()).imports);
    } catch { /* history remains available on the next refresh */ }
  }, []);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  function chooseFile(next: File | null) {
    setFile(next); setPreview(null); setResult(null); setError(null);
  }

  async function handlePreview() {
    if (!file) return;
    setPreviewing(true); setError(null); setResult(null);
    try {
      const body = new FormData(); body.append("file", file);
      const response = await fetch("/api/import/preview", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Preview failed");
      setPreview(data.preview);
    } catch (err) { setError(String(err)); }
    finally { setPreviewing(false); }
  }

  async function handleImport() {
    if (!file || !preview) return;
    setImporting(true); setError(null); setResult(null);
    try {
      const body = new FormData(); body.append("file", file);
      const response = await fetch("/api/import", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Import failed");
      setResult(data.summary); setFile(null); setPreview(null); await loadHistory();
    } catch (err) { setError(String(err)); }
    finally { setImporting(false); }
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault(); setDragOver(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped?.name.toLowerCase().endsWith(".xlsx")) chooseFile(dropped);
  }

  const numberStats = result ? [
    ["Sheets", result.sheetsProcessed], ["Raw rows", result.rawRowsStored], ["People", result.peopleUpserted],
    ["Events", result.eventsUpserted], ["Parent-child links", result.relationshipsCreated],
    ["Partnerships", result.partnershipsCreated], ["Contacts", result.contactsUpserted], ["Issues", result.issuesCount],
  ] as const : [];

  return <div className="min-w-0 space-y-5 sm:space-y-6">
    <div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Imports</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground sm:text-base">Preview workbook changes before importing. Completed workbooks are skipped on repeat uploads.</p></div>

    <Card className="border-border/50 bg-card/80">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Upload className="h-4 w-4 text-chart-1" />Upload Workbook</CardTitle><CardDescription>Supports .xlsx files up to 20 MB.</CardDescription></CardHeader>
      <CardContent><div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop} className={`flex min-h-[170px] flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-5 text-center transition-colors sm:p-8 ${dragOver ? "border-primary bg-primary/5" : "border-border/50 bg-muted/30"}`}>
        {file ? <><FileSpreadsheet className="h-10 w-10 text-emerald-600" /><div className="text-center"><p className="text-sm font-medium">{file.name}</p><p className="mt-1 text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p></div><div className="flex gap-2"><Button size="sm" onClick={handlePreview} disabled={previewing || importing}>{previewing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing…</> : "Preview workbook"}</Button><Button size="sm" variant="outline" onClick={() => chooseFile(null)} disabled={previewing || importing}>Remove</Button></div></> : <><Upload className="h-10 w-10 text-muted-foreground/40" /><div className="text-center"><p className="text-sm font-medium">Drop an Excel workbook here, or browse</p><p className="mt-1 text-xs text-muted-foreground">Supports .xlsx files</p></div><label><input type="file" accept=".xlsx" className="hidden" onChange={(e) => chooseFile(e.target.files?.[0] ?? null)} /><Button variant="outline" size="sm" asChild><span>Select file</span></Button></label></>}
      </div></CardContent>
    </Card>

    {preview && <Card className="border-border/50 bg-card/80"><CardHeader><CardTitle className="text-base">Preview: {preview.filename}</CardTitle><CardDescription>SHA-256: <span className="font-mono text-xs">{preview.sha256}</span></CardDescription></CardHeader><CardContent className="space-y-4">
      {preview.alreadyImported && <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">This exact workbook has a completed import. Starting it again will return the saved result and skip all writes.</div>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[["Sheets", preview.sheets.length], ["Raw rows", preview.rawRows], ["People", preview.counts.people], ["Events", preview.counts.events], ["Relationships", preview.counts.parentChild + preview.counts.partnerships], ["Contacts", preview.counts.contacts], ["Existing people", preview.existingPeople.length], ["New people", preview.newPeople.length]].map(([label, value]) => <div key={label} className="rounded-md bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>)}</div>
      <div className="grid gap-4 md:grid-cols-2"><PeopleKeyList title="Already in family records" people={preview.existingPeople} /><PeopleKeyList title="New people from this workbook" people={preview.newPeople} /></div>
      <div className="space-y-1"><p className="text-sm font-medium">Workbook sheets</p>{preview.sheets.map((sheet) => <p key={sheet.sheetName} className="text-sm text-muted-foreground">{sheet.sheetName} · {sheet.rows.toLocaleString()} rows · {sheet.columns} columns</p>)}</div>
      <Button onClick={handleImport} disabled={importing || preview.alreadyImported}>{importing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing…</> : preview.alreadyImported ? "Already imported" : "Start import"}</Button>
    </CardContent></Card>}

    {result && <Card className="border-emerald-500/30 bg-emerald-500/5"><CardHeader><CardTitle className="flex items-center gap-2 text-base text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-5 w-5" />{result.alreadyImported ? "Workbook already imported" : "Import complete"}</CardTitle><CardDescription>{result.alreadyImported ? "The saved result was returned; no database records were changed." : `Run ${result.importRunId}`}</CardDescription></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{numberStats.map(([label, value]) => <div key={label} className="rounded-md bg-background/70 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold">{value.toLocaleString()}</p></div>)}</div></CardContent></Card>}

    {error && <Card className="border-destructive/30 bg-destructive/5"><CardContent className="flex items-center gap-3 pt-6"><XCircle className="h-5 w-5 text-destructive" /><p className="text-sm text-destructive">{error}</p></CardContent></Card>}

    <Card className="border-border/50 bg-card/80"><CardHeader><CardTitle className="text-base">Import History</CardTitle><CardDescription>All recorded runs, newest first.</CardDescription></CardHeader><CardContent>{history.length ? <div className="space-y-3">{history.map((run) => <div key={run.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 p-3"><Clock className="h-4 w-4 text-muted-foreground" /><div className="min-w-[220px] flex-1"><p className="text-sm font-medium">{run.filename}</p><p className="text-xs text-muted-foreground">{run.startedAt ? new Date(run.startedAt).toLocaleString() : "No start time"} · {run.sheetsCount} sheets · {run.issuesCount} issues</p><p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{run.sha256}</p></div><Badge variant={run.status === "COMPLETED" ? "default" : run.status === "FAILED" ? "destructive" : "secondary"}>{run.status}</Badge>{run.summary && <span className="w-full text-xs text-muted-foreground sm:w-auto">{run.summary.peopleUpserted ?? 0} people · {run.summary.eventsUpserted ?? 0} events</span>}{run.sourceArchived && <a href={`/api/imports/${run.id}/source`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">Download original</a>}</div>)}</div> : <p className="text-sm text-muted-foreground">No imports have been run yet.</p>}</CardContent></Card>
  </div>;
}

function PeopleKeyList({ title, people }: { title: string; people: { key: string; displayName: string }[] }) {
  return <div className="rounded-md border border-border/50"><p className="border-b px-3 py-2 text-sm font-medium">{title} · {people.length}</p><div className="max-h-48 overflow-auto p-2">{people.length ? people.map((person) => <p key={person.key} className="px-1 py-1 text-xs"><span className="font-medium">{person.displayName}</span><span className="ml-2 font-mono text-muted-foreground">{person.key}</span></p>) : <p className="px-1 py-2 text-xs text-muted-foreground">None</p>}</div></div>;
}
