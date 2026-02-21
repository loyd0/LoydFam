"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  CheckCircle2,
  XCircle,
  Loader2,
  FileSpreadsheet,
  Clock,
} from "lucide-react";

interface ImportSummary {
  importRunId: string;
  sheetsProcessed: number;
  rawRowsStored: number;
  peopleUpserted: number;
  eventsUpserted: number;
  relationshipsCreated: number;
  partnershipsCreated: number;
  contactsUpserted: number;
  issuesCount: number;
}

interface ImportRun {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  filename: string;
  summary: ImportSummary | null;
}

export default function ImportsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [history, setHistory] = useState<ImportRun[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (res.ok) {
        const data = await res.json();
        if (data.lastImport) {
          setHistory([data.lastImport]);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setResult(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Import failed");
      } else {
        setResult(data.summary);
        setFile(null);
        loadHistory();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setImporting(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.name.endsWith(".xlsx")) {
      setFile(droppedFile);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Imports</h1>
        <p className="mt-1 text-muted-foreground">
          Upload the Excel workbook, preview changes, and run imports.
        </p>
      </div>

      {/* Upload area */}
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-4 w-4 text-chart-1" />
            Upload Workbook
          </CardTitle>
          <CardDescription>
            Supports .xlsx files. Imports are idempotent — safe to re-run.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-8 transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border/50 bg-muted/30"
            }`}
          >
            {file ? (
              <>
                <FileSpreadsheet className="h-10 w-10 text-emerald-500" />
                <div className="text-center">
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB — Ready to import
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleImport}
                    disabled={importing}
                  >
                    {importing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing…
                      </>
                    ) : (
                      "Start Import"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFile(null)}
                    disabled={importing}
                  >
                    Remove
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-muted-foreground/40" />
                <div className="text-center">
                  <p className="text-sm font-medium">
                    Drop your Excel workbook here, or click to browse
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Supports .xlsx files
                  </p>
                </div>
                <label>
                  <input
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setFile(f);
                    }}
                  />
                  <Button variant="outline" size="sm" asChild>
                    <span>Select file</span>
                  </Button>
                </label>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Import result */}
      {result && (
        <Card className="border-emerald-500/30 bg-emerald-500/5 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              Import Successful
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Sheets Processed", value: result.sheetsProcessed },
                { label: "Raw Rows Stored", value: result.rawRowsStored.toLocaleString() },
                { label: "People Upserted", value: result.peopleUpserted },
                { label: "Events Upserted", value: result.eventsUpserted },
                { label: "Parent-Child Links", value: result.relationshipsCreated },
                { label: "Partnerships", value: result.partnershipsCreated },
                { label: "Contacts", value: result.contactsUpserted },
                { label: "Validation Issues", value: result.issuesCount },
              ].map((stat) => (
                <div key={stat.label} className="rounded-md bg-background/60 p-3">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-lg font-bold">{stat.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive/30 bg-destructive/5 backdrop-blur">
          <CardContent className="flex items-center gap-3 pt-6">
            <XCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Import history */}
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-base">Import History</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length > 0 ? (
            <div className="space-y-3">
              {history.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center gap-3 rounded-lg border border-border/50 p-3"
                >
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{run.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {run.startedAt
                        ? new Date(run.startedAt).toLocaleString()
                        : "—"}
                    </p>
                  </div>
                  <Badge
                    variant={
                      run.status === "COMPLETED"
                        ? "default"
                        : run.status === "FAILED"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {run.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No imports have been run yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
