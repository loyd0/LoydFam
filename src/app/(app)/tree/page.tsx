"use client";

import { useState, useEffect, useCallback } from "react";
import { useViewMode } from "@/hooks/use-view-mode";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PersonPicker, type PickedPerson } from "@/components/people/PersonPicker";
import { TreePine, Minus, Plus } from "lucide-react";
import {
  FamilyTreeCanvas,
  type TreeData as CanvasTreeData,
} from "@/components/family-tree-canvas";
import { FamilyTree3D } from "@/components/family-tree-3d";

interface RootOption {
  id: string;
  displayName: string;
  generation: number | null;
  gender: string;
  birthYear: number | null;
  deathYear: number | null;
  externalId: string | null;
  sourceSystem: string | null;
}

interface TreeData extends CanvasTreeData {
  roots: RootOption[];
  maxDepth: number;
}

// ─── Main page ────────────────────────────────────────────────
export default function TreePage() {
  const { isLoydOnly } = useViewMode();
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRoot, setSelectedRoot] = useState<string>(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("root") ?? "");
  const [depth, setDepth] = useState<number | null>(null);
  // Default to 'direct' when loydOnly is active
  const [lineage, setLineage] = useState<"direct" | "full">("direct");
  const [focusedPersonId, setFocusedPersonId] = useState<string>();
  const [treeView, setTreeView] = useState<"2d" | "3d">("2d");
  const jumpToPerson = (id: string) => {
    if (!treeData?.nodes.some(person => person.id === id)) {
      setSelectedRoot(id);
      setDepth(null);
      setLineage("full");
    }
    setFocusedPersonId(undefined);
    window.requestAnimationFrame(() => setFocusedPersonId(id));
  };

  useEffect(() => {
    setTreeView(window.matchMedia("(max-width: 767px)").matches ? "2d" : "3d");
  }, []);

  // Sync lineage with global mode (only override if user hasn't explicitly set full)
  useEffect(() => {
    setLineage(isLoydOnly ? "direct" : "full");
  }, [isLoydOnly]);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedRoot) params.set("root", selectedRoot);
      params.set("depth", depth == null ? "full" : String(depth));
      params.set("lineage", lineage);
      if (isLoydOnly) params.set("loydOnly", "true");

      const res = await fetch(`/api/tree?${params}`);
      if (res.ok) {
        const data: TreeData = await res.json();
        setTreeData(data);
        if (!selectedRoot && data.rootId) {
          setSelectedRoot(data.rootId);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [selectedRoot, depth, lineage, isLoydOnly]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Family Tree</h1>
          <p className="mt-1 text-muted-foreground">
            Interactive family tree visualisation. Click a person to view their
            profile.
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardContent className="flex flex-wrap items-center gap-4 pt-4">
      <div className="flex w-full min-w-0 flex-none items-center gap-2 sm:w-auto sm:min-w-[250px]">
            <TreePine className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Root:</span>
            {treeData ? <div className="min-w-0 flex-1 sm:w-[300px] sm:flex-none"><PersonPicker
              value={treeData.roots.find((root) => root.id === selectedRoot) as PickedPerson | undefined ?? null}
              onChange={(person) => { setDepth(null); setSelectedRoot(person?.id ?? ""); }}
              label="Choose family tree root"
              placeholder="Search name or family number…"
            /></div> : <Skeleton className="h-9 w-full max-w-[260px]" />}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Depth:</span>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              aria-label="Reduce tree depth"
              onClick={() => setDepth((d) => d == null ? Math.max(1, (treeData?.maxDepth ?? 1) - 1) : Math.max(1, d - 1))}
              disabled={depth === 1 || (depth == null && (treeData?.maxDepth ?? 1) <= 1)}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Badge variant="secondary" className="min-w-[2rem] justify-center">
              {depth ?? "Full"}
            </Badge>
            <Button size="sm" variant={depth == null ? "default" : "outline"} className="h-8 px-2" onClick={() => setDepth(null)} disabled={depth == null}>Full</Button>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              aria-label="Increase tree depth"
              onClick={() => setDepth((d) => d == null ? null : d + 1)}
              disabled={depth == null}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-border/60 p-1" aria-label="Tree display mode">
            <button type="button" aria-pressed={treeView === "2d"} onClick={() => setTreeView("2d")} className={`rounded-md px-3 py-1 text-xs font-medium ${treeView === "2d" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>2D</button>
            <button type="button" aria-pressed={treeView === "3d"} onClick={() => setTreeView("3d")} className={`rounded-md px-3 py-1 text-xs font-medium ${treeView === "3d" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>3D</button>
          </div>

          {/* Lineage filter */}
          <div className="flex items-center gap-1.5 rounded-lg border border-border/60 p-1">
            <button
              onClick={() => setLineage("full")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                lineage === "full"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Full Family
            </button>
            <button
              onClick={() => setLineage("direct")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                lineage === "direct"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Direct Loyds
            </button>
          </div>

          {treeData && (
            <p className="ml-auto text-xs text-muted-foreground">
              {treeData.nodes.length} people shown
            </p>
          )}
          <div className="w-full min-w-0 md:max-w-sm">
            <PersonPicker value={null} label="Find anyone in the family" placeholder="Find a person by name or number…" onChange={(person) => { if (person) jumpToPerson(person.id); }} />
          </div>
        </CardContent>
      </Card>

      {/* Tree canvas */}
      <Card className="border-border/50 bg-card/80 backdrop-blur overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-[600px]">
            <div className="text-center space-y-3">
              <TreePine className="h-10 w-10 text-primary/30 mx-auto animate-pulse" />
              <p className="text-sm text-muted-foreground">
                Loading family tree…
              </p>
            </div>
          </div>
        ) : !treeData || treeData.nodes.length === 0 ? (
          <div className="flex items-center justify-center h-[600px]">
            <div className="text-center space-y-3">
              <TreePine className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">
                Choose a starting person above, or link your family person in Account Settings.
              </p>
            </div>
          </div>
        ) : treeView === "2d" ? (
          <FamilyTreeCanvas data={treeData} focusPersonId={focusedPersonId} />
        ) : (
          <FamilyTree3D data={treeData} focusPersonId={focusedPersonId} />
        )}
      </Card>
    </div>
  );
}
