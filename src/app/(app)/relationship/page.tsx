"use client";

import { useState, useEffect, useCallback } from "react";
import { useViewMode } from "@/hooks/use-view-mode";
import { usePermissions } from "@/hooks/use-permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { PersonPicker, type PickedPerson } from "@/components/people/PersonPicker";
import {
  ArrowRight,
  GitMerge,
  User as UserIcon,
  Search,
  Heart,
} from "lucide-react";

interface PathNode {
  id: string;
  displayName: string;
  gender: string;
  relation: string;
}

interface PathResult {
  path: PathNode[];
  connected: boolean;
  steps: number;
  commonAncestors: Array<{
    id: string;
    displayName: string;
    stepsFromA: number;
    stepsFromB: number;
    linkTypesFromA: string[];
    linkTypesFromB: string[];
  }>;
}

const linkTypeLabel = (types: string[]) => types.map((type) => ({
  BIOLOGICAL: "biological link recorded",
  STEP: "step-parent link recorded",
  ADOPTIVE: "adoptive link recorded",
  UNKNOWN: "parent link recorded",
}[type] ?? "parent link recorded")).join(", ");

const genderColor = (g: string) =>
  g === "MALE"
    ? "bg-sky-500/10 text-sky-700 border-sky-200"
    : g === "FEMALE"
    ? "bg-pink-500/10 text-pink-700 border-pink-200"
    : "bg-muted text-muted-foreground border-border";

export default function RelationshipPage() {
  const { isLoydOnly } = useViewMode();
  const { can } = usePermissions();
  const [personA, setPersonA] = useState<PickedPerson | null>(null);
  const [personB, setPersonB] = useState<PickedPerson | null>(null);
  const [result, setResult] = useState<PathResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const aUrl = params.get("a");
    const bUrl = params.get("b");
    const loadById = async (id: string) => {
      const response = await fetch(`/api/search?id=${encodeURIComponent(id)}`);
      if (!response.ok) return null;
      const data = await response.json();
      return (data.people?.[0] as PickedPerson | undefined) ?? null;
    };
    const defaults = fetch("/api/account/default-people").then((r) => r.ok ? r.json() : null);
    Promise.all([
      aUrl ? loadById(aUrl) : defaults.then((d) => d?.self ?? null),
      bUrl ? loadById(bUrl) : defaults.then((d) => d?.root ?? null),
    ]).then(([a, b]) => { if (!cancelled) { setPersonA(a); setPersonB(b); } }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const find = useCallback(async () => {
    if (!personA || !personB) return;
    setLoading(true);
    setResult(null);
    try {
      const loydParam = isLoydOnly ? "&loydOnly=true" : "";
      const res = await fetch(`/api/relationship?a=${encodeURIComponent(personA.id)}&b=${encodeURIComponent(personB.id)}${loydParam}`);
      if (res.ok) setResult(await res.json());
    } finally {
      setLoading(false);
    }
  }, [personA, personB, isLoydOnly]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Relationship Finder</h1>
        <p className="mt-1 text-muted-foreground">
          Discover how any two family members are connected through the family tree.
        </p>
      </div>

      {/* Person selectors */}
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <GitMerge className="h-4 w-4 text-chart-1" />
            Select Two People
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Person A</label>
              <PersonPicker value={personA} onChange={setPersonA} label="First person" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Person B</label>
              <PersonPicker value={personB} onChange={setPersonB} excludeIds={personA ? [personA.id] : undefined} label="Second person" />
            </div>
          </div>

          <Button
            onClick={find}
            disabled={!personA || !personB || loading}
            className="w-full sm:w-auto gap-2"
          >
            {loading ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Find Connection
          </Button>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card className="border-border/50 bg-card/80 backdrop-blur animate-in fade-in slide-in-from-bottom-4 duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Heart className="h-4 w-4 text-pink-500" />
              {result.connected
                ? `Connected in ${result.steps} step${result.steps !== 1 ? "s" : ""}`
                : "No connection found"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {result.connected && result.path.length > 0 ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">Shortest relationship path</h3>
                  <p className="text-xs text-muted-foreground">This path follows recorded parent links and partner links.</p>
                </div>
                {/* Path visualisation */}
                <div className="flex flex-wrap items-center gap-2">
                  {result.path.map((node, i) => (
                    <div key={node.id} className="flex items-center gap-2">
                      <div className="flex flex-col items-center">
                        {can("people.view") ? <Link href={`/people/${node.id}`}>
                          <div className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-80 ${genderColor(node.gender)}`}>
                            <UserIcon className="h-3.5 w-3.5" />
                            {node.displayName.split("(")[0].trim()}
                          </div>
                        </Link> : <div className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium ${genderColor(node.gender)}`}>
                          <UserIcon className="h-3.5 w-3.5" />
                          {node.displayName.split("(")[0].trim()}
                        </div>}
                        {i > 0 && (
                          <span className="text-[10px] text-muted-foreground mt-0.5 capitalize">
                            {node.relation}
                          </span>
                        )}
                      </div>
                      {i < result.path.length - 1 && (
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {personA && personB && (
                    <Badge variant="secondary">
                      {personA.displayName.split(" ")[0]} ↔ {personB.displayName.split(" ")[0]}: {result.steps} degrees of separation
                    </Badge>
                  )}
                </div>
              </div>
              ) : (
              <p className="text-sm text-muted-foreground">
                These two people are not connected through the tree data currently imported. This may be because one or both are missing parent or partnership links.
              </p>
              )}

              {result.commonAncestors?.length ? (
                <section className="space-y-3 border-t pt-4">
                  <div>
                    <h3 className="text-sm font-semibold">Closest shared recorded ancestor{result.commonAncestors.length > 1 ? "s" : ""}</h3>
                    <p className="text-xs text-muted-foreground">Found through parent links only. Link labels describe the recorded relationship and do not infer biological kinship.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {result.commonAncestors.map((ancestor) => (
                      <div key={ancestor.id} className="rounded-lg border bg-card p-3">
                        {can("people.view") ? <Link href={`/people/${ancestor.id}`} className="font-medium underline-offset-4 hover:underline">{ancestor.displayName}</Link> : <p className="font-medium">{ancestor.displayName}</p>}
                        <p className="mt-1 text-xs text-muted-foreground">{ancestor.stepsFromA} parent-link step{ancestor.stepsFromA !== 1 ? "s" : ""} from {personA?.displayName ?? "Person A"}; {ancestor.stepsFromB} from {personB?.displayName ?? "Person B"}.</p>
                        <p className="mt-1 text-xs text-muted-foreground">A: {linkTypeLabel(ancestor.linkTypesFromA)} · B: {linkTypeLabel(ancestor.linkTypesFromB)}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <GitMerge className="h-12 w-12 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">
            Select two people above and click &ldquo;Find Connection&rdquo; to trace the shortest family path between them.
          </p>
        </div>
      )}
    </div>
  );
}
