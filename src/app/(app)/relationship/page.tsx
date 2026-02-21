"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  GitMerge,
  User as UserIcon,
  Search,
  Heart,
} from "lucide-react";

interface PersonOption {
  id: string;
  displayName: string;
  gender: string;
}

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
}

const genderColor = (g: string) =>
  g === "MALE"
    ? "bg-sky-500/10 text-sky-700 border-sky-200"
    : g === "FEMALE"
    ? "bg-pink-500/10 text-pink-700 border-pink-200"
    : "bg-muted text-muted-foreground border-border";

export default function RelationshipPage() {
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [personA, setPersonA] = useState("");
  const [personB, setPersonB] = useState("");
  const [result, setResult] = useState<PathResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/people?limit=500&page=1")
      .then((r) => r.json())
      .then((d) => setPeople(d.people ?? []))
      .finally(() => setLoadingPeople(false));
  }, []);

  const find = useCallback(async () => {
    if (!personA || !personB) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/relationship?a=${personA}&b=${personB}`);
      if (res.ok) setResult(await res.json());
    } finally {
      setLoading(false);
    }
  }, [personA, personB]);

  const personAData = people.find((p) => p.id === personA);
  const personBData = people.find((p) => p.id === personB);

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
              {loadingPeople ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={personA} onValueChange={setPersonA}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select first person…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {people.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Person B</label>
              {loadingPeople ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={personB} onValueChange={setPersonB}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select second person…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {people.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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
            {result.connected && result.path.length > 0 ? (
              <div className="space-y-4">
                {/* Path visualisation */}
                <div className="flex flex-wrap items-center gap-2">
                  {result.path.map((node, i) => (
                    <div key={node.id} className="flex items-center gap-2">
                      <div className="flex flex-col items-center">
                        <Link href={`/people/${node.id}`}>
                          <div className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-80 ${genderColor(node.gender)}`}>
                            <UserIcon className="h-3.5 w-3.5" />
                            {node.displayName.split("(")[0].trim()}
                          </div>
                        </Link>
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
                  {personAData && personBData && (
                    <Badge variant="secondary">
                      {personAData.displayName.split(" ")[0]} ↔ {personBData.displayName.split(" ")[0]}: {result.steps} degrees of separation
                    </Badge>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                These two people are not connected through the tree data currently imported. This may be because one or both are missing parent or partnership links.
              </p>
            )}
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
