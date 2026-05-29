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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TreePine, Minus, Plus } from "lucide-react";
import {
  FamilyTreeCanvas,
  type TreeData as CanvasTreeData,
} from "@/components/family-tree-canvas";

interface RootOption {
  id: string;
  displayName: string;
  generation: number | null;
}

interface TreeData extends CanvasTreeData {
  roots: RootOption[];
}

// ─── Main page ────────────────────────────────────────────────
export default function TreePage() {
  const { isLoydOnly } = useViewMode();
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRoot, setSelectedRoot] = useState<string>("");
  const [depth, setDepth] = useState(4);
  // Default to 'direct' when loydOnly is active
  const [lineage, setLineage] = useState<"direct" | "full">("direct");

  // Sync lineage with global mode (only override if user hasn't explicitly set full)
  useEffect(() => {
    setLineage(isLoydOnly ? "direct" : "full");
  }, [isLoydOnly]);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedRoot) params.set("root", selectedRoot);
      params.set("depth", String(depth));
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
          <div className="flex items-center gap-2">
            <TreePine className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Root:</span>
            {treeData && treeData.roots.length > 0 ? (
              <Select
                value={selectedRoot}
                onValueChange={(value) => setSelectedRoot(value)}
              >
                <SelectTrigger className="w-[260px]">
                  <SelectValue placeholder="Select root person" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {treeData.roots.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.displayName}
                      {r.generation != null && ` (Gen ${r.generation})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Skeleton className="h-9 w-[260px]" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Depth:</span>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => setDepth((d) => Math.max(1, d - 1))}
              disabled={depth <= 1}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Badge variant="secondary" className="min-w-[2rem] justify-center">
              {depth}
            </Badge>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => setDepth((d) => Math.min(10, d + 1))}
              disabled={depth >= 10}
            >
              <Plus className="h-3 w-3" />
            </Button>
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
                No tree data available. Import the workbook first.
              </p>
            </div>
          </div>
        ) : (
          <FamilyTreeCanvas data={treeData} />
        )}
      </Card>
    </div>
  );
}
