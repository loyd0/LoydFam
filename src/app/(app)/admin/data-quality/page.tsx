"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface ImportIssue {
  id: string;
  severity: string;
  code: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
}

export default function DataQualityPage() {
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState("");

  const loadIssues = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/data-quality");
      if (res.ok) {
        const data = await res.json();
        setIssues(data.issues);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  const filtered = severityFilter
    ? issues.filter((i) => i.severity === severityFilter)
    : issues;

  const counts = {
    ERROR: issues.filter((i) => i.severity === "ERROR").length,
    WARNING: issues.filter((i) => i.severity === "WARNING").length,
    INFO: issues.filter((i) => i.severity === "INFO").length,
  };

  function SeverityIcon({ severity }: { severity: string }) {
    switch (severity) {
      case "ERROR":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "WARNING":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Quality</h1>
        <p className="mt-1 text-muted-foreground">
          Review missing data flags, conflicts, and potential duplicates.
        </p>
      </div>

      {/* Severity summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        {(
          [
            { key: "ERROR", label: "Errors", color: "text-destructive", count: counts.ERROR },
            { key: "WARNING", label: "Warnings", color: "text-amber-500", count: counts.WARNING },
            { key: "INFO", label: "Info", color: "text-blue-500", count: counts.INFO },
          ] as const
        ).map((s) => (
          <Card
            key={s.key}
            className={`border-border/50 bg-card/80 backdrop-blur cursor-pointer transition-colors ${
              severityFilter === s.key ? "ring-2 ring-primary" : ""
            }`}
            onClick={() =>
              setSeverityFilter(severityFilter === s.key ? "" : s.key)
            }
          >
            <CardContent className="flex items-center gap-3 pt-4">
              <ShieldAlert className={`h-5 w-5 ${s.color}`} />
              <div>
                <p className="text-xl font-bold">{s.count}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Issues list */}
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
              Issues
              {severityFilter && (
                <Badge variant="outline" className="text-xs">
                  {severityFilter}
                </Badge>
              )}
            </span>
            <span className="text-xs text-muted-foreground font-normal">
              {filtered.length} issues
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : filtered.length > 0 ? (
            <div className="divide-y divide-border/50">
              {filtered.slice(0, 100).map((issue) => (
                <div
                  key={issue.id}
                  className="flex items-start gap-3 py-3"
                >
                  <SeverityIcon severity={issue.severity} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {issue.code}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm">{issue.message}</p>
                  </div>
                  {issue.entityId && issue.entityType === "PERSON" && (
                    <Link
                      href={`/people/${issue.entityId}`}
                      className="text-xs text-primary hover:underline shrink-0"
                    >
                      View →
                    </Link>
                  )}
                </div>
              ))}
              {filtered.length > 100 && (
                <p className="pt-3 text-xs text-muted-foreground text-center">
                  Showing first 100 of {filtered.length} issues
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {issues.length > 0
                ? "No issues matching the current filter."
                : "No data quality issues found. Run an import to generate quality checks."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
