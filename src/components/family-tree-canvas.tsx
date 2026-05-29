"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type ReactFlowInstance,
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
import { X, ExternalLink, User as UserIcon } from "lucide-react";
import Link from "next/link";

// ─── Shared types ─────────────────────────────────────────────
export interface TreePerson {
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

export interface TreeEdge {
  parentId: string;
  childId: string;
}

export interface TreeData {
  nodes: TreePerson[];
  edges: TreeEdge[];
  rootId: string;
}

// ─── Custom node component ────────────────────────────────────
// Visual width is pinned to NODE_WIDTH so the layout algorithm's sibling
// spacing always matches what is rendered (long names truncate, never overlap).
function PersonNodeComponent({
  data,
  selected,
}: {
  data: TreePerson;
  selected?: boolean;
}) {
  const isMale = data.gender === "MALE";
  const isFemale = data.gender === "FEMALE";
  const dimmed = data.isLoyd === false; // non-Loyd leaf node

  const accent = dimmed
    ? "var(--color-border)"
    : isMale
    ? "var(--node-male)"
    : isFemale
    ? "var(--node-female)"
    : "var(--color-border)";

  const bgStyle = dimmed
    ? { backgroundColor: "var(--color-muted)" }
    : isMale
    ? { backgroundColor: "var(--node-male-bg)" }
    : isFemale
    ? { backgroundColor: "var(--node-female-bg)" }
    : { backgroundColor: "var(--color-card)" };

  const shortName = data.displayName.split("(")[0]?.trim() || data.displayName;
  const years = `${data.birthYear ?? "?"}–${data.isLiving ? "living" : data.deathYear ?? "?"}`;

  return (
    <div
      className={`rounded-lg border-2 px-3 py-2 text-center cursor-pointer transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5${
        dimmed ? " opacity-60" : ""
      }`}
      style={{
        width: 170,
        borderStyle: dimmed ? "dashed" : "solid",
        borderColor: accent,
        ...bgStyle,
        // A single focus ring marks the currently-selected person —
        // the "you are here" of the tree.
        boxShadow: selected
          ? `0 0 0 3px color-mix(in oklch, ${accent} 35%, transparent), 0 4px 12px color-mix(in oklch, ${accent} 22%, transparent)`
          : "0 1px 2px oklch(0 0 0 / 0.06)",
      }}
    >
      {/* Hidden anchors so React Flow can route parent→child edges
          (top = incoming from parent, bottom = outgoing to children). */}
      <Handle
        id="in"
        type="target"
        position={Position.Top}
        isConnectable={false}
        style={{ opacity: 0, background: "transparent" }}
      />
      <Handle
        id="out"
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        style={{ opacity: 0, background: "transparent" }}
      />
      <p className={`text-xs font-semibold truncate${dimmed ? " text-muted-foreground" : ""}`}>
        {shortName}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">{years}</p>
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

// ─── Canvas ───────────────────────────────────────────────────
// Pure presentation: receives a laid-out-able TreeData and renders the
// interactive React Flow graph. No data-fetching here — callers (the live
// page, the demo page) own that, which keeps this component testable.
export function FamilyTreeCanvas({ data }: { data: TreeData }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const rfInstance = useRef<ReactFlowInstance<Node, Edge> | null>(null);

  // SSR-safe dark-mode flag. Reading `document` during render crashes static
  // prerendering, so we default to light on the server and correct on mount.
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Auto-select the root person whenever the dataset changes, so the profile
  // card opens on "you are here". Adjusting state during render off a tracked
  // prop is React's recommended alternative to a setState-in-effect.
  const [prevData, setPrevData] = useState<TreeData | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<TreePerson | null>(null);
  if (data !== prevData) {
    setPrevData(data);
    setSelectedPerson(data?.nodes.find((n) => n.id === data.rootId) ?? null);
  }

  // Frame the viewport on the root and their immediate children at a readable
  // zoom. Fitting the entire (often very wide) descendant tree would shrink
  // nodes to illegibility, so we frame the top and let the user pan/zoom.
  const focusOnRoot = useCallback((d: TreeData, layoutEdges: Edge[]) => {
    const instance = rfInstance.current;
    if (!instance) return;
    const childIds = layoutEdges
      .filter((e) => e.source === d.rootId)
      .map((e) => e.target);
    const focusNodes = [d.rootId, ...childIds].map((id) => ({ id }));
    window.requestAnimationFrame(() => {
      instance.fitView({ nodes: focusNodes, padding: 0.25, maxZoom: 0.9, duration: 400 });
    });
  }, []);

  useEffect(() => {
    if (!data || data.nodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const { layoutNodes, layoutEdges } = layoutTree(data);
    setNodes(layoutNodes);
    setEdges(layoutEdges);

    // Frame the viewport once nodes are measured.
    const t = setTimeout(() => focusOnRoot(data, layoutEdges), 80);
    return () => clearTimeout(t);
  }, [data, setNodes, setEdges, focusOnRoot]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const person = data.nodes.find((n) => n.id === node.id);
      if (person) setSelectedPerson(person);
    },
    [data]
  );

  return (
    <div className="h-[600px] relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onInit={(instance) => {
          rfInstance.current = instance;
        }}
        nodeTypes={nodeTypes}
        minZoom={0.08}
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
          pannable
          zoomable
          nodeColor={(n) => {
            const d = n.data as unknown as TreePerson;
            // Match the node palette exactly: male = navy/slate (hue 240),
            // female = forest green (hue 150).
            if (d.gender === "MALE")
              return isDark ? "oklch(0.75 0.08 240)" : "oklch(0.40 0.08 240)";
            if (d.gender === "FEMALE")
              return isDark ? "oklch(0.75 0.12 150)" : "oklch(0.45 0.12 150)";
            return isDark ? "oklch(0.45 0.01 160)" : "oklch(0.80 0.01 160)";
          }}
          maskColor={isDark ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.06)"}
        />
      </ReactFlow>

      {selectedPerson && (
        <ProfileCard
          person={selectedPerson}
          onClose={() => setSelectedPerson(null)}
        />
      )}
    </div>
  );
}

// ─── Tree layout algorithm ────────────────────────────────────
function layoutTree(data: TreeData) {
  const NODE_WIDTH = 170;
  const NODE_HEIGHT = 70;
  const H_GAP = 40; // horizontal gap between siblings
  const V_GAP = 90; // vertical gap between generations

  // Build parent -> children adjacency for the recursive layout.
  const childrenMap = new Map<string, string[]>();
  for (const e of data.edges) {
    if (!childrenMap.has(e.parentId)) childrenMap.set(e.parentId, []);
    childrenMap.get(e.parentId)!.push(e.childId);
  }

  // Compute subtree widths
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

  // `x` is the LEFT edge of the band reserved for this node's whole subtree.
  function positionNode(id: string, x: number, y: number) {
    const bandWidth = subtreeWidth.get(id)!;
    // Centre the node itself over its band (not pinned to the left edge —
    // otherwise every ancestor stacks down the left side of the tree).
    positions.set(id, { x: x + (bandWidth - NODE_WIDTH) / 2, y });

    const children = childrenMap.get(id) ?? [];
    if (children.length === 0) return;

    const totalWidth = children.reduce(
      (sum, cid) => sum + computeWidth(cid) + H_GAP,
      -H_GAP
    );
    // Centre the row of children within this node's band.
    let currentX = x + (bandWidth - totalWidth) / 2;

    for (const cid of children) {
      const cw = computeWidth(cid);
      positionNode(cid, currentX, y + NODE_HEIGHT + V_GAP);
      currentX += cw + H_GAP;
    }
  }

  positionNode(data.rootId, 0, 0);

  // Safety net: every node the API returns is a descendant of the root, so the
  // recursion above positions all of them. If that invariant is ever broken
  // (e.g. a future API change reintroduces detached spouse nodes), lay the
  // stragglers out in a labelled row below rather than dropping them silently.
  const orphans = data.nodes.filter((n) => !positions.has(n.id));
  if (orphans.length > 0) {
    const maxY = Math.max(0, ...Array.from(positions.values()).map((p) => p.y));
    orphans.forEach((n, i) => {
      positions.set(n.id, {
        x: i * (NODE_WIDTH + H_GAP),
        y: maxY + NODE_HEIGHT + V_GAP * 2,
      });
    });
  }

  const layoutNodes: Node[] = data.nodes
    .filter((n) => positions.has(n.id))
    .map((n) => ({
      id: n.id,
      type: "person",
      position: positions.get(n.id)!,
      selected: n.id === data.rootId,
      data: n,
    }));

  const layoutEdges: Edge[] = data.edges.map((e, i) => ({
    id: `e-${i}`,
    source: e.parentId,
    target: e.childId,
    sourceHandle: "out",
    targetHandle: "in",
    type: "smoothstep",
  }));

  return { layoutNodes, layoutEdges };
}
