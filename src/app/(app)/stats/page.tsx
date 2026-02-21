"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Users,
  Heart,
  Clock,
  FileText,
  TrendingUp,
} from "lucide-react";

interface StatsData {
  population: {
    total: number;
    living: number;
    deceased: number;
    genderBreakdown: { gender: string; count: number }[];
  };
  birthsByDecade: { decade: number; count: number }[];
  longevity: {
    average: number;
    median: number;
    oldest: { name: string; age: number }[];
    youngest: { name: string; age: number }[];
  };
  topNames: { name: string; count: number }[];
  generations: { generation: number; count: number }[];
  dataCompleteness: {
    total: number;
    withDob: { count: number; pct: number };
    withGender: { count: number; pct: number };
    withParents: { count: number; pct: number };
    withSpouse: { count: number; pct: number };
  };
}

export default function StatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Statistics</h1>
          <p className="mt-1 text-muted-foreground">Loading analytics…</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Statistics</h1>
        <p className="text-muted-foreground">
          No data available. Import the workbook first.
        </p>
      </div>
    );
  }

  const maxDecadeCount = Math.max(
    ...data.birthsByDecade.map((d) => d.count),
    1
  );
  const maxNameCount = Math.max(...data.topNames.map((n) => n.count), 1);
  const maxGenCount = Math.max(...data.generations.map((g) => g.count), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Statistics</h1>
        <p className="mt-1 text-muted-foreground">
          Deep analytics across {data.population.total.toLocaleString()} people
          in the family tree.
        </p>
      </div>

      {/* Population overview */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Total People"
          value={data.population.total}
          icon={<Users className="h-4 w-4" />}
          colour="text-chart-1"
        />
        <StatTile
          label="Living"
          value={data.population.living}
          icon={<Heart className="h-4 w-4" />}
          colour="text-emerald-500"
        />
        <StatTile
          label="Deceased"
          value={data.population.deceased}
          icon={<Clock className="h-4 w-4" />}
          colour="text-muted-foreground"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Gender breakdown */}
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-chart-1" />
              Gender Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.population.genderBreakdown.map((g) => {
              const pct = data.population.total > 0
                ? Math.round((g.count / data.population.total) * 100)
                : 0;
              const color =
                g.gender === "MALE"
                  ? "bg-blue-500"
                  : g.gender === "FEMALE"
                  ? "bg-pink-500"
                  : "bg-muted-foreground";
              return (
                <div key={g.gender}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm capitalize">
                      {g.gender.toLowerCase()}
                    </span>
                    <span className="text-sm font-medium">
                      {g.count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Longevity */}
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-chart-2" />
              Longevity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="rounded-md bg-muted/50 p-3 text-center">
                <p className="text-2xl font-bold">{data.longevity.average}</p>
                <p className="text-xs text-muted-foreground">Average Age</p>
              </div>
              <div className="rounded-md bg-muted/50 p-3 text-center">
                <p className="text-2xl font-bold">{data.longevity.median}</p>
                <p className="text-xs text-muted-foreground">Median Age</p>
              </div>
            </div>
            {data.longevity.oldest.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                  Longest Lived
                </p>
                {data.longevity.oldest.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm py-1"
                  >
                    <span className="truncate max-w-[200px]">{p.name}</span>
                    <Badge variant="secondary">{p.age} yrs</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Births by decade */}
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-chart-3" />
              Births by Decade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {data.birthsByDecade.map((d) => (
                <div key={d.decade} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-12 shrink-0">
                    {d.decade}s
                  </span>
                  <div className="flex-1 h-4 rounded bg-muted/50 overflow-hidden">
                    <div
                      className="h-full rounded bg-chart-1/70 transition-all"
                      style={{
                        width: `${(d.count / maxDecadeCount) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium w-6 text-right">
                    {d.count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top names */}
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-chart-4" />
              Most Common First Names
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {data.topNames.map((n, i) => (
                <div key={n.name} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4 shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm w-20 shrink-0 truncate">
                    {n.name}
                  </span>
                  <div className="flex-1 h-3 rounded bg-muted/50 overflow-hidden">
                    <div
                      className="h-full rounded bg-chart-4/70 transition-all"
                      style={{
                        width: `${(n.count / maxNameCount) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium w-6 text-right">
                    {n.count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Generation distribution */}
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-chart-5" />
              Generation Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {data.generations.map((g) => (
                <div key={g.generation} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-12 shrink-0">
                    Gen {g.generation}
                  </span>
                  <div className="flex-1 h-4 rounded bg-muted/50 overflow-hidden">
                    <div
                      className="h-full rounded bg-chart-5/70 transition-all"
                      style={{
                        width: `${(g.count / maxGenCount) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium w-8 text-right">
                    {g.count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Data completeness */}
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-amber-500" />
              Data Completeness
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Date of Birth", ...data.dataCompleteness.withDob },
              { label: "Gender", ...data.dataCompleteness.withGender },
              { label: "Parents Known", ...data.dataCompleteness.withParents },
              { label: "Spouse Known", ...data.dataCompleteness.withSpouse },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm">{item.label}</span>
                  <span className="text-sm font-medium">
                    {item.count}/{data.dataCompleteness.total} ({item.pct}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      item.pct >= 80
                        ? "bg-emerald-500"
                        : item.pct >= 50
                        ? "bg-amber-500"
                        : "bg-destructive"
                    }`}
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon,
  colour,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  colour: string;
}) {
  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={colour}>{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}
