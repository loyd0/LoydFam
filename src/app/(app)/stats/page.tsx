"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  Dna,
  BarChart3,
  Calendar,
  Flame,
  MapPin,
  Baby,
  BookOpen,
  Microscope,
  FlaskConical,
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
  familyStructure: {
    avgChildrenPerCouple: number;
    totalCouplesWithChildren: number;
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

const MONTH_NAMES = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

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
            {unit}
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
  { id: "genetics", label: "Genetics & Family", icon: Dna },
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
  const maxDecade = Math.max(...data.birthsByDecade.map((d) => d.count), 1);

  const pieData = data.population.genderBreakdown.map((g) => ({
    name: g.gender === "MALE" ? "Male" : g.gender === "FEMALE" ? "Female" : "Unknown",
    value: g.count,
    color: GENDER_COLS[g.gender],
  }));

  return (
    <div className="space-y-6">
      {/* KPI tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Total People"
          value={data.population.total}
          icon={Users}
          colour="text-[#1a4731]"
        />
        <StatTile
          label="Living Members"
          value={data.population.living}
          icon={Heart}
          colour="text-emerald-600"
          sub={`${Math.round((data.population.living / data.population.total) * 100)}% of tree`}
        />
        <StatTile
          label="Deceased"
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
              Population growth wave of the Loyd family over {data.birthsByDecade.length} recorded decades
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
              Birth Seasonality
            </CardTitle>
            <CardDescription>
              Monthly birth distribution — reveals pre-industrial agricultural and religious patterns
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
            <InsightCard
              icon={Microscope}
              title="Seasonality Science"
              colour="bg-amber-50 border-amber-200"
              iconColour="text-amber-700"
            >
              Pre-industrial English families showed autumn/winter birth peaks (Sept–Jan), linked to spring
              marriages and agricultural cycles. Deviation from this pattern suggests urbanisation or migration.
              Studies of 17th–19th century English parish records show up to 30% more births in Q4 compared
              to Q2.
            </InsightCard>
          </CardContent>
        </Card>
      )}

      {/* Living age distribution */}
      {data.livingAgeDistribution.length > 0 && (
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-emerald-500" />
              Age Distribution of Living Members
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
    <div className="space-y-6">
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
          icon={Microscope}
          title={`Gender Longevity Gap: ${Math.abs(genderGap)} years`}
          colour={genderGap > 0 ? "bg-rose-50 border-rose-200" : "bg-blue-50 border-blue-200"}
          iconColour={genderGap > 0 ? "text-rose-700" : "text-blue-700"}
        >
          {genderGap > 0
            ? `Women in the Loyd family outlive men by ${genderGap} years on average. `
            : `Men in the Loyd family outlive women by ${Math.abs(genderGap)} years on average. `}
          Modern UK data shows a female longevity advantage of ~3.7 years (ONS 2022). Historical
          advantages were lower due to childbirth mortality — any deviation here is genealogically significant.
          The female biological advantage is linked to oestrogen's cardioprotective effects and lower
          baseline inflammation markers (Austad & Bartke, 2016).
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
                Mortality curve based on {data.longevity.sampleSize} individuals with known birth & death years
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
                  <Tooltip content={<ChartTooltip unit=" yrs" />} />
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
              <InsightCard
                icon={FlaskConical}
                title="Secular Longevity Trend"
                colour="bg-emerald-50 border-emerald-200"
                iconColour="text-emerald-700"
              >
                A persistent rise across generations reflects the global secular trend — average
                human lifespan increased by ~2.5 years per decade in the 20th century (Oeppen &
                Vaupel, 2002, Science). A flat or declining trend in later generations may indicate
                data completeness issues (younger generations haven&apos;t yet died).
              </InsightCard>
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
  const maxSurname = Math.max(...data.topSurnames.map((n) => n.count), 1);

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
              Most common family names — reveals marriage patterns and lineage branches
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

      <InsightCard
        icon={FlaskConical}
        title="Naming Science: The Patrilineal Naming Effect"
        colour="bg-blue-50 border-blue-200"
        iconColour="text-blue-700"
      >
        Studies of pre-1900 British families show ~35% of firstborn sons received the father&apos;s
        given name (Mateos et al., 2007). The dominance of names like &apos;William&apos;, &apos;John&apos;, and
        &apos;Thomas&apos; in English genealogies reflects both patrilineal naming traditions and the
        Norman/Saxon cultural legacy. A high frequency of one name (e.g., Loyd&apos;s ancestor William)
        across multiple generations indicates strong descent-line naming conventions — a heritable cultural
        trait studied in anthropological genetics (Guglielmino et al., 1995).
      </InsightCard>

      <InsightCard
        icon={MapPin}
        title="Surname Diversity: A Marker of Migration"
        colour="bg-purple-50 border-purple-200"
        iconColour="text-purple-700"
      >
        The number of distinct surnames entering a lineage across generations directly tracks
        geographic and social mobility. A rapid increase in unique surnames indicates out-marriage
        into new communities — a marker of geographic expansion. Conversely, a stable, low-diversity
        surname pool indicates endogamy (marrying within community), which is measurable as a form
        of &apos;isolation by distance&apos; in population genetics (Wright, 1943).
      </InsightCard>
    </div>
  );
}

// ─── GENETICS TAB ─────────────────────────────────────────────────────────────

function GeneticsTab({ data }: { data: StatsData }) {
  const uniqueSurnames = new Set(data.topSurnames.map((s) => s.name.toLowerCase())).size;
  const totalPeople = data.population.total;
  // Rough effective population size approximation from surname diversity
  // Ne ≈ (unique surnames)^2 / (expected unique surnames under random mating)
  const surnameRatio =
    totalPeople > 0 ? Math.round((uniqueSurnames / totalPeople) * 100) : 0;

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
          label="Avg. Children / Couple"
          value={data.familyStructure.avgChildrenPerCouple}
          icon={Baby}
          colour="text-[#266044]"
          sub="among couples with known children"
        />
        <StatTile
          label="Couples with Children"
          value={data.familyStructure.totalCouplesWithChildren}
          icon={Heart}
          colour="text-rose-500"
        />
        <div className="col-span-1 rounded-xl border border-border/50 bg-card/80 backdrop-blur p-4 flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Unique Surnames
          </span>
          <div className="text-2xl font-bold text-[#1a4731]">
            <AnimatedNumber value={uniqueSurnames} />
          </div>
          <p className="text-xs text-muted-foreground">{surnameRatio}% of total population</p>
        </div>
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
                Children per couple — higher numbers reflect pre-contraception fertility patterns
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
                  <Tooltip content={<ChartTooltip unit=" couples" />} />
                  <Bar
                    dataKey="count"
                    name="Couples"
                    fill={C.green4}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
              <InsightCard
                icon={Dna}
                title="Fertility Science"
                colour="bg-emerald-50 border-emerald-200"
                iconColour="text-emerald-700"
              >
                Pre-1900 English families averaged 5–7 live births, with high infant mortality (~20%
                before age 5). Modern-era couples average 1.8–2.2 children in England (ONS). A
                bimodal distribution suggests the dataset spans both eras. Large families (7+) are
                a genetic diversity amplifier — more offspring = broader allele spread.
              </InsightCard>
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
                Average parent age at birth of child — tracks modernisation of family timing
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
              <InsightCard
                icon={FlaskConical}
                title="Generational Timing"
                colour="bg-teal-50 border-teal-200"
                iconColour="text-teal-700"
              >
                Historically, English women married at ~22–24 years (pre-1900). Modern UK averages
                are ~31 years (ONS 2022). A rising generation gap across the tree directly mirrors this
                demographic transition — suggesting the dataset captures multiple centuries of change.
                Earlier marriages also correlate with higher lifetime fertility (Barclay & Kolk, 2017).
              </InsightCard>
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
              Age at first marriage — one of the strongest demographic indicators of era and social class
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
              <Dna className="h-4 w-4 text-purple-500" />
              Surname Diversity by Generation
            </CardTitle>
            <CardDescription>
              Unique surnames entering each generation — a proxy for genetic admixture and exogamy
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
            <InsightCard
              icon={Dna}
              title="Effective Population Size (Ne) Estimation"
              colour="bg-purple-50 border-purple-200"
              iconColour="text-purple-700"
            >
              Surname diversity is used as a proxy for genetic diversity in isolated populations
              (Jobling, 2001; Lasker, 1985). A diversity ratio &gt; 0.5 indicates good outbreeding.
              A declining ratio across generations may indicate drift toward endogamy (cousin marriage),
              which increases the coefficient of inbreeding (F) — raising risk of expressing recessive
              traits. Small effective population sizes (Ne &lt; 50) are considered a conservation concern
              in ecology and can apply analogously to isolated human lineages.
            </InsightCard>
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

  const overallScore = Math.round(
    completenessItems.reduce((s, i) => s + i.pct, 0) / completenessItems.length
  );

  return (
    <div className="space-y-6">
      {/* Score tile */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur p-5 flex flex-col items-center justify-center text-center">
          <div
            className="text-5xl font-black mb-1"
            style={{ color: overallScore >= 70 ? C.green2 : overallScore >= 40 ? C.amber : C.rose }}
          >
            {overallScore}%
          </div>
          <p className="text-sm text-muted-foreground">Overall Completeness Score</p>
          <Badge
            className="mt-2"
            variant={overallScore >= 70 ? "default" : "secondary"}
          >
            {overallScore >= 80
              ? "Excellent"
              : overallScore >= 60
              ? "Good"
              : overallScore >= 40
              ? "Fair"
              : "Needs Work"}
          </Badge>
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
        icon={Microscope}
        title="Why Data Completeness Matters for Genealogical Research"
        colour="bg-slate-50 border-slate-200"
        iconColour="text-slate-600"
      >
        Research accuracy in family history studies is directly dependent on completeness metrics.
        A birth date coverage below 60% significantly limits the ability to calculate lifespans,
        generational gaps, and population cohort analysis. Studies in record linkage (Christen &
        Goiser, 2007) recommend &gt;80% field completeness for statistical validity. Missing parent
        links break inheritance chains, making genetic coefficient calculations impossible.
        Prioritise importing death records and parent links to unlock the longevity and genetics
        analysis sections of this dashboard.
      </InsightCard>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("population");

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) setData(await res.json());
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Family Analytics</h1>
          <p className="mt-1 text-muted-foreground">
            Deep analysis of{" "}
            <strong className="text-foreground">
              {data.population.total.toLocaleString()}
            </strong>{" "}
            people across {data.generations.length} generations — science-backed insights into
            demography, genetics & family structure.
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0 mt-1">
          Live data
        </Badge>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-2 border-b border-border/50 pb-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border border-b-0 transition-all ${
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
      <div>
        {activeTab === "population" && <PopulationTab data={data} />}
        {activeTab === "longevity" && <LongevityTab data={data} />}
        {activeTab === "names" && <NamesTab data={data} />}
        {activeTab === "genetics" && <GeneticsTab data={data} />}
        {activeTab === "quality" && <QualityTab data={data} />}
      </div>
    </div>
  );
}
