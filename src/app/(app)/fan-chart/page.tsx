"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { GitBranch, User as UserIcon } from "lucide-react";

interface AncestorNode {
  id: string;
  displayName: string;
  gender: string;
  birthYear: number | null;
  deathYear: number | null;
  isLiving: boolean;
  pedigreePosition: number;
}

interface AncestorData {
  ancestors: AncestorNode[];
  roots: { id: string; displayName: string }[];
}

const MAX_DEPTH = 4;

function getGeneration(pos: number): number {
  return Math.floor(Math.log2(pos));
}

function nodeColor(gender: string) {
  if (gender === "MALE") return { fill: "oklch(0.35 0.08 155 / 0.12)", stroke: "oklch(0.35 0.08 155)", text: "oklch(0.2 0.06 155)" };
  if (gender === "FEMALE") return { fill: "oklch(0.50 0.10 155 / 0.12)", stroke: "oklch(0.50 0.10 155)", text: "oklch(0.3 0.08 155)" };
  return { fill: "oklch(0.96 0.01 155)", stroke: "oklch(0.75 0.04 155)", text: "oklch(0.4 0.02 155)" };
}

export default function FanChartPage() {
  const [data, setData] = useState<AncestorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [depth, setDepth] = useState(3);
  const [rootsLoading, setRootsLoading] = useState(true);
  const [roots, setRoots] = useState<{ id: string; displayName: string }[]>([]);
  const [hoveredPos, setHoveredPos] = useState<number | null>(null);

  // Load roots list once
  useEffect(() => {
    fetch("/api/ancestors?personId=__roots_only__&depth=0")
      .then((r) => r.json())
      .then((d) => {
        setRoots(d.roots ?? []);
        if (d.roots?.[0]) setSelectedId(d.roots[0].id);
      })
      .finally(() => setRootsLoading(false));
  }, []);

  const fetchAncestors = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ancestors?personId=${selectedId}&depth=${depth}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [selectedId, depth]);

  useEffect(() => {
    if (selectedId) fetchAncestors();
  }, [fetchAncestors, selectedId]);

  // Build SVG fan chart
  const svgContent = useMemo(() => {
    if (!data || data.ancestors.length === 0) return null;

    const W = 600;
    const H = 600;
    const cx = W / 2;
    const cy = H / 2 + 20;
    const innerR = 44;
    const ringW = 68;

    const ancMap = new Map(data.ancestors.map((a) => [a.pedigreePosition, a]));

    const elements: React.ReactNode[] = [];
    const maxGen = Math.min(depth, MAX_DEPTH);

    for (let gen = 1; gen <= maxGen; gen++) {
      const startPos = Math.pow(2, gen);
      const endPos = Math.pow(2, gen + 1) - 1;
      const count = endPos - startPos + 1;
      const gapAngle = gen === 1 ? 0 : 1; // degrees gap between sections
      const r0 = innerR + (gen - 1) * ringW;
      const r1 = r0 + ringW - 2;

      for (let pos = startPos; pos <= endPos; pos++) {
        const idx = pos - startPos;
        const sliceDeg = 360 / count;
        const startDeg = -90 + idx * sliceDeg + gapAngle / 2;
        const endDeg = startDeg + sliceDeg - gapAngle;

        const startRad = (startDeg * Math.PI) / 180;
        const endRad = (endDeg * Math.PI) / 180;

        const x0 = cx + r0 * Math.cos(startRad);
        const y0 = cy + r0 * Math.sin(startRad);
        const x1 = cx + r1 * Math.cos(startRad);
        const y1 = cy + r1 * Math.sin(startRad);
        const x2 = cx + r1 * Math.cos(endRad);
        const y2 = cy + r1 * Math.sin(endRad);
        const x3 = cx + r0 * Math.cos(endRad);
        const y3 = cy + r0 * Math.sin(endRad);

        const large = endDeg - startDeg > 180 ? 1 : 0;

        const pathD = [
          `M ${x0} ${y0}`,
          `L ${x1} ${y1}`,
          `A ${r1} ${r1} 0 ${large} 1 ${x2} ${y2}`,
          `L ${x3} ${y3}`,
          `A ${r0} ${r0} 0 ${large} 0 ${x0} ${y0}`,
          "Z",
        ].join(" ");

        const ancestor = ancMap.get(pos);
        const colors = nodeColor(ancestor?.gender ?? "UNKNOWN");
        const isHovered = hoveredPos === pos;

        // Label
        const midAngle = ((startDeg + endDeg) / 2 * Math.PI) / 180;
        const labelR = (r0 + r1) / 2;
        const lx = cx + labelR * Math.cos(midAngle);
        const ly = cy + labelR * Math.sin(midAngle);
        const rotateDeg = (startDeg + endDeg) / 2 + 90;
        const name = ancestor
          ? ancestor.displayName.split("(")[0].split(" ").slice(0, 2).join(" ").trim()
          : "";
        const year = ancestor?.birthYear ? `b. ${ancestor.birthYear}` : "";

        elements.push(
          <g key={pos} onMouseEnter={() => setHoveredPos(pos)} onMouseLeave={() => setHoveredPos(null)}>
            <path
              d={pathD}
              fill={ancestor ? colors.fill : "oklch(0.97 0.005 155)"}
              stroke={ancestor ? colors.stroke : "oklch(0.88 0.01 155)"}
              strokeWidth={isHovered ? 2 : 1}
              style={{ transition: "fill 0.2s, stroke-width 0.1s", cursor: ancestor ? "pointer" : "default", filter: isHovered ? "brightness(0.93)" : "none" }}
            />
            {ancestor && name && sliceDeg > 15 && (
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={sliceDeg > 40 ? 9 : 7}
                fill={colors.text}
                transform={`rotate(${rotateDeg}, ${lx}, ${ly})`}
                style={{ pointerEvents: "none", fontFamily: "inherit", fontWeight: 500 }}
              >
                <tspan x={lx} dy="-5">{name}</tspan>
                {year && sliceDeg > 25 && <tspan x={lx} dy="10" fontSize={6} fill="oklch(0.5 0.03 155)">{year}</tspan>}
              </text>
            )}
          </g>
        );
      }
    }

    // Centre circle — subject
    const subject = ancMap.get(1);
    const subjectColors = nodeColor(subject?.gender ?? "UNKNOWN");
    elements.push(
      <g key="subject">
        <circle cx={cx} cy={cy} r={innerR - 2} fill={subject ? subjectColors.fill : "oklch(0.97 0.005 155)"} stroke={subject ? subjectColors.stroke : "oklch(0.88 0.01 155)"} strokeWidth={1.5} />
        {subject && (
          <>
            <text x={cx} y={cy - 6} textAnchor="middle" fontSize={8} fontWeight={600} fill={subjectColors.text} style={{ fontFamily: "inherit" }}>
              {subject.displayName.split(" ")[0]}
            </text>
            <text x={cx} y={cy + 6} textAnchor="middle" fontSize={7} fill="oklch(0.5 0.03 155)" style={{ fontFamily: "inherit" }}>
              {subject.birthYear ?? ""}
            </text>
          </>
        )}
      </g>
    );

    return elements;
  }, [data, depth, hoveredPos]);

  const hoveredAncestor = hoveredPos != null ? data?.ancestors.find((a) => a.pedigreePosition === hoveredPos) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ancestor Fan Chart</h1>
        <p className="mt-1 text-muted-foreground">
          Radial pedigree chart showing ancestors outward by generation. Hover a segment for details.
        </p>
      </div>

      {/* Controls */}
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardContent className="flex flex-wrap items-center gap-4 pt-4">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Subject:</span>
            {rootsLoading ? (
              <Skeleton className="h-9 w-[260px]" />
            ) : (
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="w-[260px]">
                  <SelectValue placeholder="Select person" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {roots.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Depth:</span>
            {([1, 2, 3, 4] as const).map((d) => (
              <Button
                key={d}
                size="sm"
                variant={depth === d ? "default" : "outline"}
                className="h-8 w-8 p-0"
                onClick={() => setDepth(d)}
              >
                {d}
              </Button>
            ))}
          </div>

          {data && (
            <p className="ml-auto text-xs text-muted-foreground">
              {data.ancestors.length} ancestors shown
            </p>
          )}
        </CardContent>
      </Card>

      {/* Chart */}
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Card className="border-border/50 bg-card/80 backdrop-blur overflow-hidden">
          <CardContent className="p-0 flex items-center justify-center" style={{ minHeight: 520 }}>
            {loading ? (
              <div className="text-center space-y-3">
                <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">Building fan chart…</p>
              </div>
            ) : data && data.ancestors.length > 0 ? (
              <svg viewBox="0 0 600 600" className="w-full max-w-[520px]" style={{ userSelect: "none" }}>
                {svgContent}
              </svg>
            ) : (
              <div className="text-center space-y-3 p-8">
                <GitBranch className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">
                  {selectedId ? "No ancestors found for this person." : "Select a person to generate the fan chart."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hover detail panel */}
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserIcon className="h-4 w-4 text-chart-1" />
              {hoveredAncestor ? "Ancestor Detail" : "Legend"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hoveredAncestor ? (
              <div className="space-y-3">
                <div>
                  <p className="font-semibold">{hoveredAncestor.displayName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {hoveredAncestor.birthYear ?? "?"}–
                    {hoveredAncestor.isLiving ? "living" : (hoveredAncestor.deathYear ?? "?")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    {hoveredAncestor.gender === "MALE" ? "Male" : hoveredAncestor.gender === "FEMALE" ? "Female" : "Unknown"}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    Gen {getGeneration(hoveredAncestor.pedigreePosition)}
                  </Badge>
                  {hoveredAncestor.isLiving && (
                    <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 border-0">Living</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Ahnentafel #{hoveredAncestor.pedigreePosition}</p>
                  {hoveredAncestor.pedigreePosition === 2 && <p className="text-primary font-medium">Father</p>}
                  {hoveredAncestor.pedigreePosition === 3 && <p className="text-primary font-medium">Mother</p>}
                  {hoveredAncestor.pedigreePosition === 4 && <p className="text-primary font-medium">Paternal Grandfather</p>}
                  {hoveredAncestor.pedigreePosition === 5 && <p className="text-primary font-medium">Paternal Grandmother</p>}
                  {hoveredAncestor.pedigreePosition === 6 && <p className="text-primary font-medium">Maternal Grandfather</p>}
                  {hoveredAncestor.pedigreePosition === 7 && <p className="text-primary font-medium">Maternal Grandmother</p>}
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-muted-foreground">
                <p>Hover over a segment to see ancestor details.</p>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-5 rounded" style={{ background: "oklch(0.35 0.08 155 / 0.2)", border: "1px solid oklch(0.35 0.08 155)" }} />
                    <span>Male</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-5 rounded" style={{ background: "oklch(0.50 0.10 155 / 0.2)", border: "1px solid oklch(0.50 0.10 155)" }} />
                    <span>Female</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-5 rounded" style={{ background: "oklch(0.96 0.01 155)", border: "1px solid oklch(0.88 0.01 155)" }} />
                    <span>Unknown / no data</span>
                  </div>
                </div>
                <p className="mt-2">Rings expand outward from the centre (you) through parents, grandparents, etc.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
