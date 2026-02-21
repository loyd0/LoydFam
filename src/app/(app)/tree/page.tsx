"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { TreePine, Minus, Plus, X, ExternalLink, User as UserIcon } from "lucide-react";
import Link from "next/link";

interface TreePerson {
  [key: string]: unknown;
  id: string;
  displayName: string;
  gender: string;
  surname: string | null;
  knownAs: string | null;
  residencyText: string | null;
  birthYear: number | null;
  deathYear: number | null;
  isLiving: boolean;
  generation: number | null;
  spouseNames: string[];
  isLoyd: boolean;
}

interface TreeEdge {
  parentId: string;
  childId: string;
}

interface RootOption {
  id: string;
  displayName: string;
  generation: number | null;
}

interface TreeData {
  nodes: TreePerson[];
  edges: TreeEdge[];
  rootId: string;
  roots: RootOption[];
}

// ─── Custom node component ────────────────────────────────────
function PersonNodeComponent({ data }: { data: TreePerson }) {
  const isMale = data.gender === "MALE";
  const isFemale = data.gender === "FEMALE";
  const dimmed = data.isLoyd === false; // non-Loyd leaf node

  const borderStyle = dimmed
    ? { borderStyle: "dashed", borderColor: "var(--color-border)", opacity: 0.5 }
    : isMale
    ? { borderColor: "var(--node-male)" }
    : isFemale
    ? { borderColor: "var(--node-female)" }
    : { borderColor: "var(--color-border)" };

  const bgStyle = dimmed
    ? { backgroundColor: "var(--color-muted)" }
    : isMale
    ? { backgroundColor: "var(--node-male-bg)" }
    : isFemale
    ? { backgroundColor: "var(--node-female-bg)" }
    : { backgroundColor: "var(--color-card)" };


  const shortName = data.displayName.split("(")[0]?.trim() || data.displayName;
  const years = `${data.birthYear ?? "?"}\u2013${data.isLiving ? "living" : data.deathYear ?? "?"}`;

  return (
    <div
      className={`rounded-lg border-2 px-3 py-2 shadow-sm min-w-[140px] text-center cursor-pointer hover:shadow-md transition-shadow${dimmed ? " opacity-60" : ""}`}
      style={{ ...borderStyle, ...bgStyle }}
    >
      <p className={`text-xs font-semibold truncate max-w-[160px]${dimmed ? " text-muted-foreground" : ""}`}>
        {shortName}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{years}</p>
      {data.isLiving && (
        <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
          Living
        </span>
      )}
      {dimmed && (
        <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
          {data.surname ?? "Non-Loyd"}
        </span>
      )}
    </div>
  );
}

const nodeTypes = { person: PersonNodeComponent };

// ─── Profile card popup ───────────────────────────────────────
function ProfileCard({
  person,
  onClose,
}: {
  person: TreePerson;
  onClose: () => void;
}) {
  const generation = person.generation;
  const shortName = person.displayName.split("(")[0]?.trim() || person.displayName;
  const years = `${person.birthYear ?? "?"}–${person.isLiving ? "present" : person.deathYear ?? "?"}`;

  return (
    <div className="absolute top-4 right-4 z-50 w-80 animate-in fade-in slide-in-from-right-4 duration-200">
      <Card className="border-primary/20 shadow-lg bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                style={{
                  backgroundColor:
                    person.gender === "MALE"
                      ? "var(--node-male-bg)"
                      : person.gender === "FEMALE"
                      ? "var(--node-female-bg)"
                      : "var(--color-muted)",
                  color:
                    person.gender === "MALE"
                      ? "var(--node-male)"
                      : person.gender === "FEMALE"
                      ? "var(--node-female)"
                      : "var(--color-muted-foreground)",
                }}
              >
                <UserIcon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-sm leading-tight">{shortName}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{years}</p>
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 -mt-1 -mr-1"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-2.5">
          {/* Badges */}
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {person.gender === "MALE"
                ? "Male"
                : person.gender === "FEMALE"
                ? "Female"
                : "Unknown"}
            </Badge>
            {generation != null && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                Gen {generation}
              </Badge>
            )}
            {person.isLiving && (
              <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0 hover:bg-primary/10">
                Living
              </Badge>
            )}
          </div>

          {/* Details */}
          <div className="space-y-1.5 text-xs">
            {person.knownAs && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Known as</span>
                <span className="font-medium">{person.knownAs}</span>
              </div>
            )}
            {person.surname && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Surname</span>
                <span className="font-medium">{person.surname}</span>
              </div>
            )}
            {person.spouseNames.length > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Spouse</span>
                <span className="font-medium text-right max-w-[55%] truncate">
                  {person.spouseNames.join(", ")}
                </span>
              </div>
            )}
            {person.residencyText && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Residency</span>
                <span className="font-medium text-right max-w-[55%] truncate">
                  {person.residencyText}
                </span>
              </div>
            )}
          </div>

          {/* Full profile link */}
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full text-xs h-8 mt-1"
          >
            <Link href={`/people/${person.id}`}>
              View Full Profile
              <ExternalLink className="ml-1.5 h-3 w-3" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────
export default function TreePage() {
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRoot, setSelectedRoot] = useState<string>("");
  const [depth, setDepth] = useState(4);
  const [lineage, setLineage] = useState<"direct" | "full">("full");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedPerson, setSelectedPerson] = useState<TreePerson | null>(null);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedRoot) params.set("root", selectedRoot);
      params.set("depth", String(depth));
      params.set("lineage", lineage);

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
  }, [selectedRoot, depth, lineage]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  // Layout the tree when data changes
  useEffect(() => {
    if (!treeData || treeData.nodes.length === 0) return;

    const { layoutNodes, layoutEdges } = layoutTree(treeData);
    setNodes(layoutNodes);
    setEdges(layoutEdges);

    // Auto-select root person for profile card on load
    const rootNode = treeData.nodes.find((n) => n.id === treeData.rootId);
    if (rootNode) {
      setSelectedPerson(rootNode);
    }
  }, [treeData, setNodes, setEdges]);

  // Handle node click to show profile card
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const person = treeData?.nodes.find((n) => n.id === node.id);
      if (person) {
        setSelectedPerson(person);
      }
    },
    [treeData]
  );

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
        <div className="h-[600px] relative">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-3">
                <TreePine className="h-10 w-10 text-primary/30 mx-auto animate-pulse" />
                <p className="text-sm text-muted-foreground">
                  Loading family tree…
                </p>
              </div>
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-3">
                <TreePine className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">
                  No tree data available. Import the workbook first.
                </p>
              </div>
            </div>
          ) : (
            <>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.1}
                maxZoom={2}
                defaultEdgeOptions={{
                  type: "smoothstep",
                  animated: false,
                  style: { stroke: "var(--color-border)", strokeWidth: 1.5 },
                }}
              >
                <Background gap={20} size={1} />
                <Controls showInteractive={false} />
                <MiniMap
                  nodeColor={(n) => {
                    const data = n.data as unknown as TreePerson;
                    const isDark = document.documentElement.classList.contains("dark");
                    if (data.gender === "MALE") return isDark ? "oklch(0.68 0.18 155)" : "oklch(0.32 0.10 155)";
                    if (data.gender === "FEMALE") return isDark ? "oklch(0.68 0.18 220)" : "oklch(0.48 0.14 220)";
                    return isDark ? "rgb(100, 116, 139)" : "rgb(156, 163, 175)";
                  }}
                  maskColor={document.documentElement.classList.contains("dark") ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.06)"}
                />
              </ReactFlow>

              {/* Profile card overlay */}
              {selectedPerson && (
                <ProfileCard
                  person={selectedPerson}
                  onClose={() => setSelectedPerson(null)}
                />
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

// ─── Tree layout algorithm ────────────────────────────────────

function layoutTree(data: TreeData) {
  const NODE_WIDTH = 170;
  const NODE_HEIGHT = 70;
  const H_GAP = 40;   // horizontal gap between siblings
  const V_GAP = 90;   // vertical gap between generations
  const SPOUSE_GAP = 20; // gap between a person and their spouse node

  // Build lookup maps
  const childrenMap = new Map<string, string[]>();
  const parentMap = new Map<string, string>(); // childId -> parentId (first parent)
  const nodeMap = new Map<string, TreePerson>();

  for (const n of data.nodes) nodeMap.set(n.id, n);

  for (const e of data.edges) {
    if (!childrenMap.has(e.parentId)) childrenMap.set(e.parentId, []);
    childrenMap.get(e.parentId)!.push(e.childId);
    if (!parentMap.has(e.childId)) parentMap.set(e.childId, e.parentId);
  }

  // Build spouse map: personId -> [spouseId, ...]
  // We only show spouses of nodes that are in the main BFS tree
  const spouseMap = new Map<string, string[]>();
  for (const e of data.edges) {
    // edges here are parent-child; spouses come from API separately
    // We'll detect spouses as nodes not reachable via parent-child from root
  }

  // First pass: find all nodes reachable from root via parent-child BFS
  const inTree = new Set<string>();
  const queue = [data.rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (inTree.has(id)) continue;
    inTree.add(id);
    for (const cid of childrenMap.get(id) ?? []) queue.push(cid);
  }

  // Nodes NOT in the tree are spouses/orphans — match them to their tree partner
  const notInTree = data.nodes.filter((n) => !inTree.has(n.id));
  for (const orphan of notInTree) {
    // Find their tree partner via data.edges (the API includes partnership edges implicitly
    // by including spouse nodes in the response). We detect partners by finding who
    // lists this person as a spouse (data comes without explicit spouse edges,
    // so we pair by closest-generation tree node that shares a parent-child child with them).
    // Simpler approach: just pair each non-tree node to its nearest tree neighbor
    // by checking if any tree node has a child in common (sibling detection).
    // Since the API doesn't send explicit spouse edges, we can't do better without changes.
    // For now: attach each non-tree node as a spouse of the root person at the same depth,
    // OR find the tree node whose children include nodes also near this node.

    // Best approximation without explicit spouse edges:
    // Place non-tree nodes beside the tree node that appears at the same generation level.
    // We'll handle this in the positioning phase below.
  }

  // Compute subtree widths (children only, not spouses — spouses add width at render time)
  const subtreeWidth = new Map<string, number>();

  function computeWidth(id: string): number {
    if (subtreeWidth.has(id)) return subtreeWidth.get(id)!;
    const children = childrenMap.get(id) ?? [];
    if (children.length === 0) {
      subtreeWidth.set(id, NODE_WIDTH);
      return NODE_WIDTH;
    }
    const total = children.reduce((sum, cid) => sum + computeWidth(cid) + H_GAP, -H_GAP);
    const width = Math.max(NODE_WIDTH, total);
    subtreeWidth.set(id, width);
    return width;
  }

  computeWidth(data.rootId);

  // Position all tree nodes using standard recursive layout
  const positions = new Map<string, { x: number; y: number }>();

  function positionNode(id: string, x: number, y: number) {
    positions.set(id, { x, y });
    const children = childrenMap.get(id) ?? [];
    if (children.length === 0) return;

    const totalWidth = children.reduce(
      (sum, cid) => sum + computeWidth(cid) + H_GAP,
      -H_GAP
    );
    let currentX = x - totalWidth / 2 + (subtreeWidth.get(id)! / 2 - totalWidth / 2);
    // Centre children under parent
    currentX = x + (subtreeWidth.get(id)! - totalWidth) / 2;

    for (const cid of children) {
      const cw = computeWidth(cid);
      positionNode(cid, currentX, y + NODE_HEIGHT + V_GAP);
      currentX += cw + H_GAP;
    }
  }

  positionNode(data.rootId, 0, 0);

  // Now place non-tree nodes (spouses/placeholders) beside their closest tree neighbour
  // Group non-tree nodes by generation estimation using their potential children's position
  const spouseOffset = new Map<string, number>(); // treeNodeId -> next spouse slot

  for (const orphan of notInTree) {
    // Find tree nodes that are children of this orphan (if it's a parent of tree nodes)
    const myTreeChildren = (childrenMap.get(orphan.id) ?? []).filter((c) => inTree.has(c));

    if (myTreeChildren.length > 0) {
      // This orphan IS a parent of some tree nodes — position beside the other parent
      const firstChild = myTreeChildren[0];
      const childPos = positions.get(firstChild);
      if (childPos) {
        // Place at same Y as children's parent level
        const parentId = parentMap.get(firstChild);
        const partnerPos = parentId ? positions.get(parentId) : undefined;
        const yPos = partnerPos ? partnerPos.y : childPos.y - NODE_HEIGHT - V_GAP;
        const slot = spouseOffset.get(parentId ?? firstChild) ?? 0;
        const xPos = partnerPos
          ? partnerPos.x + subtreeWidth.get(parentId ?? firstChild)! + SPOUSE_GAP + NODE_WIDTH * slot
          : childPos.x;
        positions.set(orphan.id, { x: xPos, y: yPos });
        spouseOffset.set(parentId ?? firstChild, slot + 1);
        continue;
      }
    }

    // Find a tree node that is a sibling (shares same parent) — not easily detectable without spouse edges
    // Fallback: place below the tree in a row (not ABOVE, so they don't confuse the hierarchy)
    const maxY = Math.max(...Array.from(positions.values()).map((p) => p.y));
    const orphanSlot = spouseOffset.get("__orphan__") ?? 0;
    positions.set(orphan.id, {
      x: orphanSlot * (NODE_WIDTH + H_GAP),
      y: maxY + NODE_HEIGHT + V_GAP * 2,
    });
    spouseOffset.set("__orphan__", orphanSlot + 1);
  }

  const layoutNodes: Node[] = data.nodes
    .filter((n) => positions.has(n.id))
    .map((n) => ({
      id: n.id,
      type: "person",
      position: positions.get(n.id)!,
      data: n,
    }));

  const layoutEdges: Edge[] = data.edges.map((e, i) => ({
    id: `e-${i}`,
    source: e.parentId,
    target: e.childId,
    type: "smoothstep",
  }));

  return { layoutNodes, layoutEdges };
}

