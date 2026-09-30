"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useViewMode } from "@/hooks/use-view-mode";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Heart,
  Clock,
  TrendingUp,
  BarChart3,
  Calendar,
  Flame,
  Baby,
  BookOpen,
  ShieldCheck,
  Activity,
} from "lucide-react";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface StatsData {
  population: {
    total: number;
    living: number;
    deceased: number;
    partnerships: number;
    genderBreakdown: { gender: string; count: number }[];
  };
  birthsByDecade: { decade: number; label: string; count: number }[];
  birthsByMonth: { month: number; label: string; count: number }[];
  longevity: {
    average: number;
    median: number;
    sampleSize: number;
    oldest: { name: string; age: number }[];
    youngest: { name: string; age: number }[];
  };
  lifespanByGender: {
    gender: string;
    avg: number;
    median: number;
    count: number;
  }[];
  ageAtDeathBuckets: { bucket: number; label: string; count: number }[];
  longevityByGeneration: { generation: number; avgLifespan: number; count: number }[];
  topNames: { name: string; count: number }[];
  topSurnames: { name: string; count: number }[];
  generations: { generation: number; count: number }[];
  namesByGeneration: { generation: number; name: string; count: number }[];
  branches: { label: string; members: number; withBirthYear: number; withDeathRecord: number; generations: number }[];
  familyStructure: {
    avgChildrenPerParent: number;
    totalParentsWithChildren: number;
    childrenDistribution: { children: number; count: number }[];
    generationGap: { generation: number; avgGap: number; count: number }[];
  };
  marriageAgeDistribution: {
    ageBucket: number;
    label: string;
    gender: string;
    count: number;
  }[];
  livingAgeDistribution: { ageBucket: number; label: string; count: number }[];
  surnameDiversity: {
    generation: number;
    uniqueSurnames: number;
    total: number;
    diversityRatio: number;
  }[];
  dataCompleteness: {
    total: number;
    withDob: { count: number; pct: number };
    withDod: { count: number; pct: number };
    withGender: { count: number; pct: number };
    withParents: { count: number; pct: number };
    withSpouse: { count: number; pct: number };
  };
}

// ─── CHART COLOURS (forest green palette) ────────────────────────────────────

const C = {
  green1: "#1a4731",
  green2: "#266044",
  green3: "#347a57",
  green4: "#52a37d",
  green5: "#82c4a0",
  teal: "#2d7d6f",
  amber: "#b5860d",
  rose: "#c0404a",
  blue: "#2460a7",
  slate: "#64748b",
  muted: "#9ca3af",
};

const GENDER_COLS: Record<string, string> = {
  MALE: C.blue,
  FEMALE: C.rose,
  UNKNOWN: C.muted,
};


// ─── ANIMATED COUNTER ─────────────────────────────────────────────────────────

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (value === 0) return;
    const duration = 1200;
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value]);

  return (
    <span>
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}

// ─── INSIGHT CALLOUT ──────────────────────────────────────────────────────────

function InsightCard({
  icon: Icon,
  title,
  children,
  colour = "bg-emerald-50 border-emerald-200",
  iconColour = "text-emerald-700",
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  colour?: string;
  iconColour?: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${colour}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 shrink-0 ${iconColour}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold mb-1">{title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{children}</p>
        </div>
      </div>
    </div>
  );
}

// ─── CUSTOM TOOLTIP ───────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
  unit = "",
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-background/95 backdrop-blur px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-medium mb-1 text-foreground">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold">
            {p.value.toLocaleString()}
            {unit === " people" && p.value === 1 ? " person" : unit}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── TAB COMPONENT ────────────────────────────────────────────────────────────

type Tab =
  | "population"
  | "longevity"
  | "names"
  | "genetics"
  | "quality";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "population", label: "Population", icon: Users },
  { id: "longevity", label: "Longevity", icon: Activity },
  { id: "names", label: "Names", icon: BookOpen },
  { id: "genetics", label: "Family Structure", icon: Baby },
  { id: "quality", label: "Data Quality", icon: ShieldCheck },
];

// ─── STAT TILE ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  icon: Icon,
  colour,
  sub,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  colour: string;
  sub?: string;
}) {
  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${colour}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${colour}`}>
          <AnimatedNumber value={value} />
        </div>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── POPULATION TAB ───────────────────────────────────────────────────────────

function PopulationTab({ data }: { data: StatsData }) {

  const pieData = data.population.genderBreakdown.map((g) => ({
    name: g.gender === "MALE" ? "Male" : g.gender === "FEMALE" ? "Female" : "Unknown",
    value: g.count,
    color: GENDER_COLS[g.gender],
  }));

  return (
    <div className="space-y-6">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <StatTile
          label="Total People"
          value={data.population.total}
          icon={Users}
          colour="text-[#1a4731]"
        />
        <StatTile
          label="Likely Living"
          value={data.population.living}
          icon={Heart}
          colour="text-emerald-600"
          sub={`${data.population.total ? Math.round((data.population.living / data.population.total) * 100) : 0}% with recent birth dates and no recorded death`}
        />
        <StatTile
          label="Death Recorded"
          value={data.population.deceased}
          icon={Clock}
          colour="text-slate-500"
        />
        <StatTile
          label="Partnerships"
          value={data.population.partnerships}
          icon={Heart}
          colour="text-rose-500"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Births by decade — area chart */}
        <Card className="lg:col-span-2 border-border/50 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-[#266044]" />
              Births by Decade
            </CardTitle>
            <CardDescription>
              Recorded birth events by decade; repeated records for one person are counted once
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.birthsByDecade} margin={{ left: -10, right: 10 }}>
                <defs>
                  <linearGradient id="birthsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor={C.green3} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={C.green3} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip unit=" people" />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Births"
                  stroke={C.green3}
                  strokeWidth={2}
                  fill="url(#birthsGrad)"
                  dot={{ r: 3, fill: C.green3 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gender pie */}
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-[#266044]" />
              Gender Split
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => [
                    `${(v as number).toLocaleString()} (${Math.round(((v as number) / data.population.total) * 100)}%)`,
                  ]}
                />
                <Legend iconSize={10} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Births by month — seasonality */}
      {data.birthsByMonth.length > 0 && (
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="h-4 w-4 text-amber-500" />
              Birth Month Records
            </CardTitle>
            <CardDescription>
              Distribution among people with a recorded birth month; dates and coverage may be incomplete
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.birthsByMonth} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip unit=" births" />} />
                <Bar dataKey="count" name="Births" fill={C.amber} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground">This chart describes recorded months only. It cannot establish seasonal causes, and incomplete month data can change the apparent distribution.</p>
          </CardContent>
        </Card>
      )}

      {/* Living age distribution */}
      {data.livingAgeDistribution.length > 0 && (
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-emerald-500" />
              Age Estimate for People without Recorded Deaths
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.livingAgeDistribution} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip unit=" people" />} />
                <Bar dataKey="count" name="Living" fill={C.green4} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground">Estimated from recorded birth years within the last 110 years and no recorded death event. Missing death records mean this is an upper-bound proxy, not a verified living count.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── LONGEVITY TAB ────────────────────────────────────────────────────────────

function LongevityTab({ data }: { data: StatsData }) {
  const maleData = data.lifespanByGender.find((g) => g.gender === "MALE");
  const femaleData = data.lifespanByGender.find((g) => g.gender === "FEMALE");
  const genderGap =
    maleData && femaleData ? femaleData.avg - maleData.avg : null;

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Average Lifespan"
          value={data.longevity.average}
          icon={TrendingUp}
          colour="text-[#1a4731]"
          sub="years (with known birth & death)"
        />
        <StatTile
          label="Median Lifespan"
          value={data.longevity.median}
          icon={BarChart3}
          colour="text-[#266044]"
          sub="50th percentile"
        />
        {maleData && (
          <StatTile
            label="Male Avg. Lifespan"
            value={maleData.avg}
            icon={Users}
            colour="text-blue-600"
            sub={`${maleData.count} men with full dates`}
          />
        )}
        {femaleData && (
          <StatTile
            label="Female Avg. Lifespan"
            value={femaleData.avg}
            icon={Users}
            colour="text-rose-500"
            sub={`${femaleData.count} women with full dates`}
          />
        )}
      </div>

      {genderGap !== null && (
        <InsightCard
          icon={Users}
          title={`Recorded average difference: ${Math.abs(genderGap)} years`}
          colour={genderGap > 0 ? "bg-rose-50 border-rose-200" : "bg-blue-50 border-blue-200"}
          iconColour={genderGap > 0 ? "text-rose-700" : "text-blue-700"}
        >
          In this subset with recorded birth and death years, the {genderGap > 0 ? "female" : "male"} group average is higher. This is a descriptive difference only; it may reflect small samples, uneven date coverage, and generations that are fully observed.
        </InsightCard>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Age at death histogram */}
        {data.ageAtDeathBuckets.length > 0 && (
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-[#266044]" />
                Age at Death Distribution
              </CardTitle>
              <CardDescription>
                {data.longevity.sampleSize} people with recorded birth and death years; year-only age estimates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.ageAtDeathBuckets} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip unit=" people" />} />
                  <Bar
                    dataKey="count"
                    name="Deaths"
                    radius={[4, 4, 0, 0]}
                    fill={C.green2}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Longevity by generation */}
        {data.longevityByGeneration.length > 0 && (
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-[#347a57]" />
                Lifespan Trend by Generation
              </CardTitle>
              <CardDescription>
                Does each generation live longer? (secular longevity trend)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data.longevityByGeneration} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="generation"
                    tickFormatter={(v) => `Gen ${v}`}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis tick={{ fontSize: 11 }} unit=" yr" />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const row = data.longevityByGeneration.find((item) => item.generation === Number(label));
                    return (
                      <div className="rounded-lg border bg-background/95 px-3 py-2 shadow-lg text-xs">
                        <p className="font-medium">Generation {label}</p>
                        <p>Mean recorded lifespan: <strong>{payload[0]?.value} years</strong></p>
                        <p>People with recorded birth and death years: <strong>{row?.count ?? 0}</strong></p>
                      </div>
                    );
                  }}
                />
                  <Line
                    type="monotone"
                    dataKey="avgLifespan"
                    name="Avg Lifespan"
                    stroke={C.green3}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: C.green3 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground">Later generations are less likely to have completed lifespans recorded (right censoring), so generation averages are not directly comparable.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Longest-lived */}
      {data.longevity.oldest.length > 0 && (
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="h-4 w-4 text-amber-500" />
              Longest-Lived Members
            </CardTitle>
            <CardDescription>
              Top 10 by recorded lifespan. World record is 122 years (Jeanne Calment, 1997).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.longevity.oldest.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white`}
                    style={{
                      background: i === 0 ? "#b5860d" : i === 1 ? "#8a8a8a" : i === 2 ? "#8c6b3e" : C.green3,
                    }}
                  >
                    {i + 1}
                  </div>
                  <span className="flex-1 text-sm font-medium truncate">{p.name}</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 rounded-full bg-[#347a57]/30"
                      style={{ width: `${Math.round((p.age / (data.longevity.oldest[0]?.age || 100)) * 80)}px` }}
                    >
                      <div
                        className="h-full rounded-full bg-[#347a57]"
                        style={{ width: "100%" }}
                      />
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {p.age} yrs
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── NAMES TAB ────────────────────────────────────────────────────────────────

function NamesTab({ data }: { data: StatsData }) {
  const maxName = Math.max(...data.topNames.map((n) => n.count), 1);

  const chartColors = [
    C.green1, C.green2, C.green3, C.green4, C.green5,
    C.teal, C.amber, C.blue, "#7c5cbf", "#c06040",
    C.green1, C.green2, C.green3, C.green4, C.green5,
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top first names */}
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4 text-[#266044]" />
              Top First Names
            </CardTitle>
            <CardDescription>
              Most common given names across all {data.population.total.toLocaleString()} people
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart
                layout="vertical"
                data={data.topNames.slice(0, 15)}
                margin={{ left: 20, right: 30, top: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip unit=" people" />} />
                <Bar dataKey="count" name="Count" radius={[0, 4, 4, 0]}>
                  {data.topNames.slice(0, 15).map((_, i) => (
                    <Cell key={i} fill={chartColors[i % chartColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top surnames */}
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-[#347a57]" />
              Top Surnames
            </CardTitle>
            <CardDescription>
              Most frequent recorded family names
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart
                layout="vertical"
                data={data.topSurnames.slice(0, 15)}
                margin={{ left: 20, right: 30, top: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip unit=" people" />} />
                <Bar dataKey="count" name="Count" radius={[0, 4, 4, 0]}>
                  {data.topSurnames.slice(0, 15).map((_, i) => (
                    <Cell key={i} fill={chartColors[i % chartColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Name frequency list — condensed */}
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-[#52a37d]" />
            First Name Frequency Table
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {data.topNames.map((n, i) => (
              <div key={n.name} className="flex items-center gap-2 py-1">
                <span className="text-xs text-muted-foreground w-5 shrink-0 text-right">
                  {i + 1}
                </span>
                <span className="text-sm font-medium w-24 truncate">{n.name}</span>
                <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(n.count / maxName) * 100}%`,
                      background: C.green3,
                    }}
                  />
                </div>
                <span className="text-xs font-semibold w-6 text-right shrink-0">
                  {n.count}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {data.namesByGeneration.length > 0 && (
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4 text-[#266044]" />
              Most Recorded Given Names by Generation
            </CardTitle>
            <CardDescription>Top three names within each recorded generation, with the count shown for context</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.namesByGeneration.map((row) => (
                <div key={`${row.generation}-${row.name}`} className="flex items-center justify-between border-b border-border/40 py-2 text-sm">
                  <span><span className="mr-2 text-muted-foreground">Gen {row.generation}</span>{row.name}</span>
                  <span className="text-xs text-muted-foreground">{row.count}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Generation labels come from the family tree’s recorded generation fields. Name spellings are grouped as entered.</p>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">Name frequencies summarize the recorded names in this tree. They do not identify naming causes or migration patterns.</p>
    </div>
  );
}

// ─── FAMILY STRUCTURE TAB ─────────────────────────────────────────────────────

function GeneticsTab({ data }: { data: StatsData }) {

  // Marriage age data — pivot for chart
  const marriagePivot: Record<string, { label: string; MALE?: number; FEMALE?: number }> = {};
  for (const row of data.marriageAgeDistribution) {
    if (!marriagePivot[row.ageBucket]) {
      marriagePivot[row.ageBucket] = { label: row.label };
    }
    marriagePivot[row.ageBucket][row.gender as "MALE" | "FEMALE"] = row.count;
  }
  const marriageChartData = Object.values(marriagePivot).sort(
    (a, b) => parseInt(a.label) - parseInt(b.label)
  );

  return (
    <div className="space-y-6">
      {/* KPI tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Avg. Linked Children / Parent"
          value={data.familyStructure.avgChildrenPerParent}
          icon={Baby}
          colour="text-[#266044]"
          sub="among parents with at least one linked child"
        />
        <StatTile
          label="Parents with Linked Children"
          value={data.familyStructure.totalParentsWithChildren}
          icon={Heart}
          colour="text-rose-500"
        />
        <div className="col-span-1 rounded-xl border border-border/50 bg-card/80 backdrop-blur p-4 flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Generation Span
          </span>
          <div className="text-2xl font-bold text-[#1a4731]">
            <AnimatedNumber value={data.generations.length} />
          </div>
          <p className="text-xs text-muted-foreground">recorded generations</p>
        </div>
      </div>

      {data.branches.length > 0 && (
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-[#266044]" />
              Branch Coverage Comparison
            </CardTitle>
            <CardDescription>Groups use the imported branch-root field. Counts describe tree records, with birth and death coverage shown for context.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.branches.map((branch) => (
                <div key={branch.label} className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-border/40 py-2 text-sm">
                  <span className="min-w-20 font-medium">{branch.label}</span>
                  <span className="text-muted-foreground">{branch.members.toLocaleString()} people</span>
                  <span className="text-muted-foreground">{branch.generations} generations</span>
                  <span className="text-muted-foreground">{branch.withBirthYear.toLocaleString()} birth years</span>
                  <span className="text-muted-foreground">{branch.withDeathRecord.toLocaleString()} death records</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Children per couple distribution */}
        {data.familyStructure.childrenDistribution.length > 0 && (
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Baby className="h-4 w-4 text-[#266044]" />
                Family Size Distribution
              </CardTitle>
              <CardDescription>
              Recorded children linked to each parent. This is not a complete fertility measure.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={data.familyStructure.childrenDistribution}
                  margin={{ left: -10, right: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                  <XAxis dataKey="children" tick={{ fontSize: 11 }} label={{ value: "Children", position: "insideBottom", offset: -3, fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} label={{ value: "Couples", angle: -90, position: "insideLeft", fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip unit=" parents" />} />
                  <Bar
                    dataKey="count"
                    name="Parents"
                    fill={C.green4}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground">Only recorded parent-child links are counted; missing links and unrecorded children can make family sizes appear smaller.</p>
            </CardContent>
          </Card>
        )}

        {/* Generation gap */}
        {data.familyStructure.generationGap.length > 0 && (
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-[#347a57]" />
                Generation Gap Trend
              </CardTitle>
              <CardDescription>
                Mean parent age at recorded child birth by generation (year-only dates)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={data.familyStructure.generationGap}
                  margin={{ left: -10, right: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="generation"
                    tickFormatter={(v) => `G${v}`}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis tick={{ fontSize: 11 }} unit=" yr" />
                  <Tooltip content={<ChartTooltip unit=" yrs" />} />
                  <Line
                    type="monotone"
                    dataKey="avgGap"
                    name="Avg Parent Age"
                    stroke={C.teal}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: C.teal }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground">Sample sizes vary by generation. Incomplete and year-only dates limit precision; this pattern alone does not explain why timing changed.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Marriage age distribution */}
      {marriageChartData.length > 0 && (
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Heart className="h-4 w-4 text-rose-500" />
              Marriage Age Distribution (by Gender)
            </CardTitle>
            <CardDescription>
              Recorded partnership start age, using exact marriage dates and birth years where available
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={marriageChartData} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip unit=" people" />} />
                <Legend />
                <Bar dataKey="MALE" name="Male" fill={C.blue} radius={[4, 4, 0, 0]} />
                <Bar dataKey="FEMALE" name="Female" fill={C.rose} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Surname diversity by generation */}
      {data.surnameDiversity.length > 0 && (
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-purple-500" />
              Surname Diversity by Generation
            </CardTitle>
            <CardDescription>
              Distinct recorded surnames and people with surnames by generation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.surnameDiversity} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                <XAxis
                  dataKey="generation"
                  tickFormatter={(v) => `Gen ${v}`}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = data.surnameDiversity.find((s) => s.generation === Number(label));
                    return (
                      <div className="rounded-lg border bg-background/95 px-3 py-2 shadow-lg text-xs">
                        <p className="font-medium">Generation {label}</p>
                        <p>Unique surnames: <strong>{payload[0]?.value}</strong></p>
                        {d && <p>Diversity ratio: <strong>{(d.diversityRatio * 100).toFixed(0)}%</strong></p>}
                      </div>
                    );
                  }}
                />
                <Bar dataKey="uniqueSurnames" name="Unique Surnames" fill="#7c5cbf" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground">Surname counts reflect recorded names only. They do not measure genetic diversity, relatedness, inbreeding, or migration.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── DATA QUALITY TAB ─────────────────────────────────────────────────────────

function QualityTab({ data }: { data: StatsData }) {
  const dc = data.dataCompleteness;

  const radarData = [
    { axis: "Birth Date", value: dc.withDob.pct, full: 100 },
    { axis: "Death Date", value: dc.withDod.pct, full: 100 },
    { axis: "Gender", value: dc.withGender.pct, full: 100 },
    { axis: "Parents", value: dc.withParents.pct, full: 100 },
    { axis: "Spouse", value: dc.withSpouse.pct, full: 100 },
  ];

  const completenessItems = [
    {
      label: "Date of Birth",
      count: dc.withDob.count,
      pct: dc.withDob.pct,
      colour: "#266044",
    },
    {
      label: "Date of Death",
      count: dc.withDod.count,
      pct: dc.withDod.pct,
      colour: "#347a57",
    },
    {
      label: "Gender Known",
      count: dc.withGender.count,
      pct: dc.withGender.pct,
      colour: "#2460a7",
    },
    {
      label: "Parents Linked",
      count: dc.withParents.count,
      pct: dc.withParents.pct,
      colour: "#52a37d",
    },
    {
      label: "Spouse Linked",
      count: dc.withSpouse.count,
      pct: dc.withSpouse.pct,
      colour: "#c0404a",
    },
  ];

  const averageFieldCoverage = Math.round(
    completenessItems.reduce((s, i) => s + i.pct, 0) / completenessItems.length
  );

  return (
    <div className="space-y-6">
      {/* Score tile */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur p-5 flex flex-col items-center justify-center text-center">
          <div
            className="text-5xl font-black mb-1"
            style={{ color: C.green2 }}
          >
            {averageFieldCoverage}%
          </div>
          <p className="text-sm text-muted-foreground">Mean of five field coverage rates</p>
        </div>
        <StatTile
          label="Total People Tracked"
          value={dc.total}
          icon={Users}
          colour="text-[#1a4731]"
        />
        <StatTile
          label="With DOB"
          value={dc.withDob.count}
          icon={Calendar}
          colour="text-[#266044]"
          sub={`${dc.withDob.pct}% coverage`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Radar chart */}
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-[#266044]" />
              Completeness Radar
            </CardTitle>
            <CardDescription>
              5-dimension data quality spider chart
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11 }} />
                <Radar
                  name="Completeness"
                  dataKey="value"
                  stroke={C.green3}
                  fill={C.green3}
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
                <Tooltip formatter={(v) => [`${v as number}%`, "Completeness"]} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Completeness bars */}
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-[#347a57]" />
              Dimension Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {completenessItems.map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {item.count.toLocaleString()} / {dc.total.toLocaleString()}
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0"
                      style={{ color: item.colour }}
                    >
                      {item.pct}%
                    </Badge>
                  </div>
                </div>
                <div className="h-3 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${item.pct}%`,
                      background: item.colour,
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <InsightCard
        icon={Activity}
        title="Coverage and interpretation"
        colour="bg-slate-50 border-slate-200"
        iconColour="text-slate-600"
      >
        Each percentage uses all non-placeholder people as its denominator. Death-date coverage
        should be read carefully because many living people have no death event; absent records do
        not prove that a person is living. Analyses use recorded years, so they are approximate and
        can be affected by missing or conflicting records.
      </InsightCard>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function StatsContent() {
  const { isLoydOnly } = useViewMode();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("population");

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const qs = isLoydOnly ? "?loydOnly=true" : "";
      const res = await fetch(`/api/stats${qs}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [isLoydOnly]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Family Analytics</h1>
          <p className="mt-1 text-muted-foreground">Loading deep analysis…</p>
        </div>
        <div className="flex gap-2">
          {TABS.map((t) => (
            <Skeleton key={t.id} className="h-9 w-28 rounded-lg" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Family Analytics</h1>
        <p className="text-muted-foreground">
          No data available. Import the workbook first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Family Analytics</h1>
          <p className="mt-1 text-muted-foreground">
            Deep analysis of{" "}
            <strong className="text-foreground">
              {data.population.total.toLocaleString()}
            </strong>{" "}
            people across {data.generations.length} recorded generations — summaries of births,
            lifespans, names, and family structure.
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0 mt-1">
          Live data
        </Badge>
      </div>

      {/* Tab bar */}
      <div role="tablist" aria-label="Analytics sections" className="flex min-w-0 flex-nowrap gap-1 overflow-x-auto border-b border-border/50 pb-0 -mx-3 px-3 sm:mx-0 sm:flex-wrap sm:gap-2 sm:px-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={active}
              className={`flex min-h-12 shrink-0 items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-t-lg border border-b-0 transition-all sm:px-4 ${
                active
                  ? "bg-card border-border/50 text-foreground shadow-sm -mb-px pb-[1px] border-b-transparent"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="min-w-0">
        {activeTab === "population" && <PopulationTab data={data} />}
        {activeTab === "longevity" && <LongevityTab data={data} />}
        {activeTab === "names" && <NamesTab data={data} />}
        {activeTab === "genetics" && <GeneticsTab data={data} />}
        {activeTab === "quality" && <QualityTab data={data} />}
      </div>
    </div>
  );
}
