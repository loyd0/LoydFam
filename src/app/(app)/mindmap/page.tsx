"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  Handle,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Network, Search, User as UserIcon, Plus, Minus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

// ─── Interfaces ──────────────────────────────────────────────────
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

interface SearchPerson {
  id: string;
  displayName: string;
  surname: string | null;
  gender: string;
  generation: number | null;
  birthYear: number | null;
  deathYear: number | null;
}

// ─── Page Component ──────────────────────────────────────────────
export default function MindMapPage() {
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rootId, setRootId] = useState<string>("");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Search Dialog State
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchPerson[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // 1. Fetch search results directly
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.people || []);
        }
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 2. Fetch entire tree sub-graph (depth 10 to cover expansions locally)
  const fetchTree = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (rootId) params.set("root", rootId);
      params.set("depth", "10"); // fetch up to 10 generations locally for client-side expansion
      params.set("lineage", "full");

      const res = await fetch(`/api/tree?${params}`);
      if (res.ok) {
        const data: TreeData = await res.json();
        setTreeData(data);
        if (!rootId && data.rootId) {
          setRootId(data.rootId);
        }
        // Initialize expanded nodes with just the root
        setExpandedNodes(new Set([data.rootId || ""]));
      }
    } finally {
      setLoading(false);
    }
  }, [rootId]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  // 3. Layout the tree whenever data or expanded nodes change
  useEffect(() => {
    if (!treeData || treeData.nodes.length === 0) return;
    
    // Convert edges to a map for easy child lookup
    const childrenMap = new Map<string, string[]>();
    for (const e of treeData.edges) {
      if (!childrenMap.has(e.parentId)) childrenMap.set(e.parentId, []);
      childrenMap.get(e.parentId)!.push(e.childId);
    }

    const NODE_WIDTH = 260;
    const NODE_HEIGHT = 100;
    const H_GAP = 80;
    const V_GAP = 20;

    // Traverse the visible tree and compute heights
    const visibleNodes = new Set<string>();
    const nodeHeights = new Map<string, number>();

    // First pass: compute height needed for each visible subtree
    function computeHeight(id: string): number {
      visibleNodes.add(id);
      const isExpanded = expandedNodes.has(id);
      const children = childrenMap.get(id) || [];
      
      if (!isExpanded || children.length === 0) {
        nodeHeights.set(id, NODE_HEIGHT);
        return NODE_HEIGHT;
      }

      let totalHeight = 0;
      for (const cid of children) {
        totalHeight += computeHeight(cid);
      }
      totalHeight += Math.max(0, children.length - 1) * V_GAP;
      
      const height = Math.max(NODE_HEIGHT, totalHeight);
      nodeHeights.set(id, height);
      return height;
    }

    computeHeight(treeData.rootId);

    // Second pass: assign positions
    const positions = new Map<string, { x: number; y: number }>();

    function positionNode(id: string, x: number, yStart: number) {
      const children = childrenMap.get(id) || [];
      const isExpanded = expandedNodes.has(id);
      
      // Center this node vertically relative to its total assigned subtree height
      const mySubtreeHeight = nodeHeights.get(id)!;
      const myY = yStart + mySubtreeHeight / 2 - NODE_HEIGHT / 2;
      positions.set(id, { x, y: myY });

      if (isExpanded && children.length > 0) {
        let currentY = yStart;
        for (const cid of children) {
          if (visibleNodes.has(cid)) {
            const childHeight = nodeHeights.get(cid)!;
            positionNode(cid, x + NODE_WIDTH + H_GAP, currentY);
            currentY += childHeight + V_GAP;
          }
        }
      }
    }

    positionNode(treeData.rootId, 0, 0);

    // Filter nodes and edges to only visible ones
    const layoutNodes: Node[] = treeData.nodes
      .filter((n) => visibleNodes.has(n.id))
      .map((n) => {
        const children = childrenMap.get(n.id) || [];
        const hasChildren = children.length > 0;
        const isExpanded = expandedNodes.has(n.id);
        
        return {
          id: n.id,
          type: "mindmapNode",
          position: positions.get(n.id)!,
          data: {
            person: n,
            hasChildren,
            isExpanded,
            childrenCount: children.length,
            onToggle: () => {
              setExpandedNodes((prev) => {
                const next = new Set(prev);
                if (next.has(n.id)) next.delete(n.id);
                else next.add(n.id);
                return next;
              });
            },
          },
        };
      });

    const layoutEdges: Edge[] = treeData.edges
      .filter((e) => visibleNodes.has(e.parentId) && visibleNodes.has(e.childId) && expandedNodes.has(e.parentId))
      .map((e) => ({
        id: `e-${e.parentId}-${e.childId}`,
        source: e.parentId,
        target: e.childId,
        type: "smoothstep",
        style: { stroke: "currentColor", strokeWidth: 1.5, opacity: 0.4 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "currentColor", opacity: 0.4 },
      }));

    setNodes(layoutNodes);
    setEdges(layoutEdges);

  }, [treeData, expandedNodes, setNodes, setEdges]);

  // Create custom node type outside of render loop using useMemo
  const nodeTypes = useMemo(() => ({
    mindmapNode: ({ data }: { data: { person: TreePerson; hasChildren: boolean; isExpanded: boolean; childrenCount: number; onToggle: () => void; } }) => {
      const person: TreePerson = data.person;
      const isMale = person.gender === "MALE";
      const isFemale = person.gender === "FEMALE";
      const shortName = person.displayName.split("(")[0]?.trim() || person.displayName;
      const years = `${person.birthYear ?? "?"} - ${person.isLiving ? "living" : person.deathYear ?? "?"}`;
      
      return (
        <div className="flex items-center group">
          <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-primary !border-2 !border-background !-ml-1 z-10" />
          
          <div 
            className={`
              relative flex flex-col items-start w-[240px] p-3 rounded-xl border-2 shadow-sm bg-card transition-all duration-300
              ${isMale ? "border-[var(--node-male)]" : isFemale ? "border-[var(--node-female)]" : "border-border"}
            `}
          >
            {/* Header / Name */}
            <div className="flex items-start gap-3 w-full">
              <div 
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 shadow-sm"
                style={{
                  backgroundColor: isMale ? "var(--node-male-bg)" : isFemale ? "var(--node-female-bg)" : "var(--color-muted)",
                  color: isMale ? "var(--node-male)" : isFemale ? "var(--node-female)" : "var(--color-muted-foreground)",
                }}
              >
                <UserIcon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold truncate leading-tight text-foreground">{shortName}</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">{years}</p>
                
                {person.spouseNames.length > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1 truncate">
                    m. {person.spouseNames[0]} {person.spouseNames.length > 1 ? `+${person.spouseNames.length - 1}` : ''}
                  </p>
                )}
              </div>
            </div>

            {/* Badges row */}
            <div className="flex items-center gap-1.5 mt-2.5">
              {person.generation != null && (
                <Badge variant="secondary" className="px-1.5 py-0 text-[9px] font-semibold h-4">
                  Gen {person.generation}
                </Badge>
              )}
              {person.isLiving && (
                <Badge className="px-1.5 py-0 text-[9px] font-semibold h-4 bg-green-500/10 text-green-600 hover:bg-green-500/20 dark:bg-green-500/20 dark:text-green-400 border-transparent">
                  Living
                </Badge>
              )}
              {!person.isLoyd && (
                <Badge variant="outline" className="px-1.5 py-0 text-[9px] font-semibold h-4 border-dashed text-muted-foreground">
                  {person.surname ?? "Non-Loyd"}
                </Badge>
              )}
            </div>

            {/* Expand / Collapse Button */}
            {data.hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  data.onToggle();
                }}
                className={`
                  absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center 
                  bg-background border-2 shadow-sm transition-all duration-200 hover:scale-110 z-10
                  ${data.isExpanded ? "border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/50"}
                `}
              >
                {data.isExpanded ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {!data.isExpanded && data.childrenCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[8px] font-bold px-1 rounded-full border-2 border-background">
                    {data.childrenCount}
                  </span>
                )}
              </button>
            )}
          </div>

          <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-primary !border-2 !border-background !-mr-1 z-10" />
        </div>
      );
    }
  }), []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mind Map</h1>
          <p className="mt-1 text-muted-foreground">
            Explore the family tree horizontally. Click the +/- buttons to expand branches.
          </p>
        </div>
        
        <Button onClick={() => setSearchOpen(true)} className="gap-2 shadow-sm">
          <Search className="w-4 h-4" />
          <span className="hidden sm:inline">Search Starting Person</span>
          <span className="sm:hidden">Search</span>
        </Button>
      </div>

      <Card className="border-border/50 bg-card/80 backdrop-blur overflow-hidden relative">
        <div className="h-[650px] relative w-full">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm z-50">
              <Network className="w-10 h-10 text-primary/30 animate-pulse mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Loading tree structure...</p>
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-3">
              <Network className="w-12 h-12 text-muted-foreground/30" />
              <p className="text-muted-foreground">No tree data found for this person.</p>
              <Button variant="outline" onClick={() => setSearchOpen(true)}>Choose a different root</Button>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.1}
              maxZoom={1.5}
              proOptions={{ hideAttribution: true }}
              className="bg-dot-pattern"
            >
              <Background gap={20} size={1} color="var(--color-border)" className="opacity-20" />
              <Controls showInteractive={false} className="border-border/50 shadow-sm rounded-lg overflow-hidden flex-col gap-0" />
              <MiniMap 
                className="border-border/50 shadow-sm rounded-lg overflow-hidden bg-card/50 backdrop-blur-md" 
                nodeColor="var(--primary)" 
                maskColor="var(--background)"
              />
            </ReactFlow>
          )}
        </div>
      </Card>

      {/* CMDK Search Dialog */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput 
          placeholder="Search for a starting person..." 
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList>
          <CommandEmpty>
            {searchLoading ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Searching...
              </div>
            ) : (
              "No people found."
            )}
          </CommandEmpty>
          
          <CommandGroup heading="People">
            {searchResults.map((person) => (
              <CommandItem
                key={person.id}
                onSelect={() => {
                  setRootId(person.id);
                  setSearchOpen(false);
                  setSearchQuery("");
                }}
                className="flex items-center gap-3 py-3"
              >
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: person.gender === "MALE" ? "var(--node-male-bg)" : person.gender === "FEMALE" ? "var(--node-female-bg)" : "var(--color-muted)",
                    color: person.gender === "MALE" ? "var(--node-male)" : person.gender === "FEMALE" ? "var(--node-female)" : "var(--color-muted-foreground)",
                  }}
                >
                  <UserIcon className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-sm truncate">{person.displayName}</span>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{person.birthYear ?? "?"} - {person.deathYear ?? "?"}</span>
                    {person.generation != null && (
                      <span className="px-1 py-0.5 rounded-sm bg-secondary text-secondary-foreground font-medium">Gen {person.generation}</span>
                    )}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
