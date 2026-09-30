"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useViewMode } from "@/hooks/use-view-mode";
import { usePermissions } from "@/hooks/use-permissions";
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
import { Network, Plus, Minus } from "lucide-react";
import { PersonPicker, type PickedPerson } from "@/components/people/PersonPicker";

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
  gender?: string;
  externalId?: string | null;
  sourceSystem?: string | null;
  numberSystem?: string | null;
  birthYear?: number | null;
  deathYear?: number | null;
}

interface TreeData {
  nodes: TreePerson[];
  edges: TreeEdge[];
  rootId: string;
  roots: RootOption[];
}

// ─── Page Component ──────────────────────────────────────────────
export default function MindMapPage() {
  const { isLoydOnly } = useViewMode();
  const { can } = usePermissions();
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rootId, setRootId] = useState<string>(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("root") ?? "");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Fetch the complete recorded descendant tree for local expand/collapse.
  const fetchTree = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (rootId) params.set("root", rootId);
      params.set("depth", "full");
      params.set("lineage", "full");
      if (isLoydOnly) params.set("loydOnly", "true");

      const res = await fetch(`/api/tree?${params}`);
      if (res.ok) {
        const data: TreeData = await res.json();
        setTreeData(data);
        if (!rootId && data.rootId) {
          setRootId(data.rootId);
        }
        // Start with all recorded descendants visible; each branch can be collapsed.
        setExpandedNodes(new Set(data.nodes.map((person) => person.id)));
      }
    } finally {
      setLoading(false);
    }
  }, [rootId, isLoydOnly]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const selectedRoot = treeData?.roots.find((person) => person.id === rootId);
  const selectedRootPerson: PickedPerson | null = selectedRoot
    ? { ...selectedRoot, gender: selectedRoot.gender ?? "UNKNOWN" }
    : null;

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
          <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-primary !border-0 !opacity-50 !-ml-1 z-10" />
          
          <div 
            className={`
              relative flex flex-col items-start w-[260px] p-4 bg-card shadow-sm transition-all duration-300
              ${isMale ? "border-l-4 border-[var(--node-male)]" : isFemale ? "border-l-4 border-[var(--node-female)]" : "border-l-4 border-border"}
              border-y border-r border-border/40 hover:shadow-md
            `}
          >
            {/* Header / Name */}
            <div className="flex items-start gap-4 w-full">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold truncate text-foreground">{shortName}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{years}</p>
                
                {person.spouseNames.length > 0 && (
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-2 truncate">
                    m. {person.spouseNames[0]} {person.spouseNames.length > 1 ? `+${person.spouseNames.length - 1}` : ''}
                  </p>
                )}
              </div>
            </div>

            {/* Badges row */}
            <div className="flex items-center gap-3 mt-3">
              {person.generation != null && (
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/80 font-medium">
                  Gen {person.generation}
                </span>
              )}
              {person.isLiving && (
                <span className="text-[10px] uppercase tracking-widest text-emerald-600/80 font-medium border-l border-border/50 pl-3">
                  Living
                </span>
              )}
              {!person.isLoyd && (
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium border-l border-border/50 pl-3">
                  {person.surname ?? "Non-Loyd"}
                </span>
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
                  bg-card border shadow-sm transition-all duration-200 hover:scale-110 z-10
                  ${data.isExpanded ? "border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/50"}
                `}
              >
                {data.isExpanded ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-primary !border-0 !opacity-50 !-mr-1 z-10" />
        </div>
      );
    }
  }), []);

  return (
    <div className="space-y-8 animate-page-in">
      <div className="flex items-center justify-between border-b border-border/60 pb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Mind Map</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Explore the family tree horizontally. Click the +/- buttons to expand branches.
          </p>
        </div>
        
        {can("people.view") && <div className="w-full max-w-md sm:w-[340px]"><PersonPicker value={selectedRootPerson} onChange={(person) => setRootId(person?.id ?? "")} label="Mind map starting person" placeholder="Search name or family number…" /></div>}
      </div>

      <div className="border border-border/40 bg-background overflow-hidden relative shadow-sm">
        <div className="h-[750px] relative w-full">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm z-50">
              <Network className="w-10 h-10 text-primary/30 animate-pulse mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Loading tree structure...</p>
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-3">
              <Network className="w-12 h-12 text-muted-foreground/30" />
              <p className="text-muted-foreground">No tree data found for this person.</p>
              <p className="text-xs text-muted-foreground">Choose a different starting person above, or link yourself in Account Settings.</p>
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
              className="bg-transparent"
            >
              <Background gap={40} size={1} color="var(--color-primary)" className="opacity-[0.03]" />
              <Controls showInteractive={false} className="border-border/50 shadow-sm rounded-none overflow-hidden flex-col gap-0" />
              <MiniMap 
                className="border-border/50 shadow-sm rounded-none overflow-hidden bg-background/90 backdrop-blur-md" 
                nodeColor="var(--primary)" 
                maskColor="var(--background)"
              />
            </ReactFlow>
          )}
        </div>
      </div>

    </div>
  );
}
