"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Users,
  TreePine,
  CalendarDays,
  AlertTriangle,
  Cake,
  Search,
  ArrowRight,
  Baby,
  Skull,
  Church,
  History,
  GitMerge,
  Layers,
  PieChart,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface DashboardData {
  stats: {
    totalPeople: number;
    livingCount: number;
    totalEvents: number;
    issueCount: number;
  };
  dataQuality: {
    missingDob: number;
    missingDod: number;
    missingParents: number;
    missingGender: number;
    missingSpouse: number;
  };
  upcomingBirthdays: {
    id: string;
    displayName: string;
    birthMonth: number;
    birthDay: number;
    birthYear?: number | null;
  }[];
  recentActivity: {
    id: string;
    type: string;
    message: string;
    createdAt: string;
  }[];
  lastImport: {
    id: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    filename: string;
  } | null;
}

interface TodayEvent {
  id: string;
  type: string;
  dateYear: number | null;
  dateIsApprox: boolean;
  people: { id: string; displayName: string; gender: string; role: string }[];
}

interface TodayData {
  month: number;
  day: number;
  events: TodayEvent[];
}

const MONTH_NAMES = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTH_NAMES_LONG = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function EventTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "BIRTH": return <Baby className="h-3.5 w-3.5 text-emerald-500" />;
    case "DEATH": return <Skull className="h-3.5 w-3.5 text-muted-foreground" />;
    case "MARRIAGE": return <Church className="h-3.5 w-3.5 text-pink-500" />;
    default: return <CalendarDays className="h-3.5 w-3.5 text-chart-2" />;
  }
}

function daysUntil(month: number, day: number): number {
  const now = new Date();
  const thisYear = now.getFullYear();
  let target = new Date(thisYear, month - 1, day);
  if (target < now) target = new Date(thisYear + 1, month - 1, day);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function ageAtBirthday(birthYear: number | null | undefined, month: number): number | null {
  if (!birthYear) return null;
  const thisYear = new Date().getFullYear();
  const nowMonth = new Date().getMonth() + 1;
  return thisYear - birthYear + (month < nowMonth ? 1 : 0);
}

const quickLinks = [
  { href: "/generations", icon: Layers, label: "Generations", desc: "Browse by generation" },
  { href: "/fan-chart", icon: PieChart, label: "Fan Chart", desc: "Ancestor pedigree" },
  { href: "/relationship", icon: GitMerge, label: "Relationship", desc: "Find connections" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [todayData, setTodayData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      const [dashRes, todayRes] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/today"),
      ]);
      if (dashRes.ok) setData(await dashRes.json());
      if (todayRes.ok) setTodayData(await todayRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/people?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  const stats = data
    ? [
        { label: "Total People", value: data.stats.totalPeople.toLocaleString(), icon: Users, colour: "text-chart-1" },
        { label: "Living", value: data.stats.livingCount.toLocaleString(), icon: TreePine, colour: "text-emerald-500" },
        { label: "Events", value: data.stats.totalEvents.toLocaleString(), icon: CalendarDays, colour: "text-chart-2" },
        { label: "Data Issues", value: data.stats.issueCount.toLocaleString(), icon: AlertTriangle, colour: "text-amber-500" },
      ]
    : [
        { label: "Total People", value: "—", icon: Users, colour: "text-chart-1" },
        { label: "Living", value: "—", icon: TreePine, colour: "text-emerald-500" },
        { label: "Events", value: "—", icon: CalendarDays, colour: "text-chart-2" },
        { label: "Data Issues", value: "—", icon: AlertTriangle, colour: "text-amber-500" },
      ];

  return (
    <div className="space-y-12 animate-page-in">
      {/* Header */}
      <div className="border-b border-border/60 pb-6">
        <h1 className="font-serif text-5xl font-medium tracking-normal text-primary">Overview</h1>
        <p className="mt-3 font-serif italic text-lg text-foreground/80">
          The Loyd family history database at a glance.
        </p>
      </div>

      {/* Quick search */}
      <form onSubmit={handleSearch} className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Quick search people, events, places…"
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </form>

      {/* Stats tiles */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, idx) => (
          <div
            key={s.label}
            className="border-l-2 border-primary/20 bg-background pl-4 py-2 animate-in fade-in slide-in-from-bottom-2 hover:border-primary transition-colors duration-300"
            style={{ animationDelay: `${idx * 60}ms`, animationFillMode: "both" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`h-4 w-4 ${s.colour}`} />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {s.label}
              </p>
            </div>
            <div>
              {loading ? (
                <Skeleton className="h-7 w-16 mt-1" />
              ) : (
                <div className="font-serif text-3xl font-medium text-foreground">{s.value}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Quick links to new features */}
      <div className="grid gap-4 sm:grid-cols-3 pt-4 border-t border-border/40">
        {quickLinks.map((l) => (
          <Link key={l.href} href={l.href}>
            <div className="flex items-center gap-4 p-4 border border-border/50 bg-card hover:bg-muted/20 hover:border-primary/40 transition-all duration-300 group cursor-pointer h-full shadow-sm">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-primary/5 text-primary border border-primary/10 transition-colors">
                <l.icon className="h-5 w-5 opacity-80" />
              </div>
              <div className="flex-1">
                <p className="font-serif text-lg font-medium text-foreground group-hover:text-primary transition-colors">{l.label}</p>
                <p className="font-serif italic text-xs text-muted-foreground mt-0.5">{l.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
          </Link>
        ))}
      </div>

      {/* This Day in History + Birthdays */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* This Day in History */}
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-amber-500" />
              This Day in Family History
              {todayData && (
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  {MONTH_NAMES_LONG[todayData.month]} {todayData.day}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-2.5 w-24" />
                  </div>
                </div>
              ))
            ) : todayData && todayData.events.length > 0 ? (
              todayData.events.map((event, idx) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 rounded-md px-2 py-1.5 -mx-2 hover:bg-muted/40 transition-colors animate-in fade-in slide-in-from-right-2"
                  style={{ animationDelay: `${idx * 50}ms`, animationFillMode: "both" }}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                    <EventTypeIcon type={event.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    {event.people.slice(0, 1).map((p) => (
                      <Link
                        key={p.id}
                        href={`/people/${p.id}`}
                        className="text-sm font-medium hover:text-primary hover:underline transition-colors block truncate"
                      >
                        {p.displayName}
                      </Link>
                    ))}
                    <p className="text-xs text-muted-foreground capitalize">
                      {event.type.toLowerCase()}
                      {event.dateYear && ` in ${event.dateYear}`}
                      {event.dateYear && ` · ${new Date().getFullYear() - event.dateYear} years ago`}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-xs text-muted-foreground py-4">
                {data?.stats.totalPeople
                  ? "No recorded events on this date."
                  : "Import data to see historical events."}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Birthdays */}
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cake className="h-4 w-4 text-pink-400" />
              Upcoming Birthdays
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))
            ) : data && data.upcomingBirthdays.length > 0 ? (
              data.upcomingBirthdays.map((b, idx) => {
                const days = daysUntil(b.birthMonth, b.birthDay);
                const age = ageAtBirthday(b.birthYear, b.birthMonth);
                return (
                  <Link
                    key={b.id}
                    href={`/people/${b.id}`}
                    className="flex items-center gap-3 rounded-md px-2 py-1.5 -mx-2 hover:bg-muted/50 transition-colors animate-in fade-in"
                    style={{ animationDelay: `${idx * 50}ms`, animationFillMode: "both" }}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pink-500/10 text-pink-500 text-xs font-bold shrink-0">
                      {b.birthDay}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{b.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {MONTH_NAMES[b.birthMonth]} {b.birthDay}
                        {age != null && ` · turns ${age}`}
                      </p>
                    </div>
                    <Badge
                      variant={days <= 7 ? "default" : "secondary"}
                      className={`text-[10px] shrink-0 ${days <= 7 ? "bg-pink-500/90" : ""}`}
                    >
                      {days === 0 ? "Today!" : days === 1 ? "Tomorrow" : `${days} days`}
                    </Badge>
                  </Link>
                );
              })
            ) : (
              <p className="text-center text-xs text-muted-foreground py-4">
                {data?.stats.totalPeople
                  ? "No birthdays with known dates"
                  : "Import data to see birthdays"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Recent Activity
            {data && data.recentActivity.length === 0 && (
              <Badge variant="secondary" className="text-[10px]">None yet</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-md" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
              </div>
            ))
          ) : data && data.recentActivity.length > 0 ? (
            data.recentActivity.map((a) => (
              <div key={a.id} className="flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-chart-1 shrink-0" />
                <div>
                  <p className="text-sm">{a.message}</p>
                  <p className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Activity will appear after the first import
            </p>
          )}
        </CardContent>
      </Card>

      {/* Data quality tiles */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Data Quality</h2>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {(data
            ? [
                { label: "Missing DOB", value: data.dataQuality.missingDob },
                { label: "Missing DOD", value: data.dataQuality.missingDod },
                { label: "Missing Parents", value: data.dataQuality.missingParents },
                { label: "No Gender", value: data.dataQuality.missingGender },
                { label: "No Spouse", value: data.dataQuality.missingSpouse },
              ]
            : [
                { label: "Missing DOB", value: "—" },
                { label: "Missing DOD", value: "—" },
                { label: "Missing Parents", value: "—" },
                { label: "No Gender", value: "—" },
                { label: "No Spouse", value: "—" },
              ]
          ).map((item) => (
            <Card key={item.label} className="border-border/50 bg-card/80 backdrop-blur">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                {loading ? (
                  <Skeleton className="mt-1 h-6 w-10" />
                ) : (
                  <p className="mt-1 text-xl font-bold">{item.value}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
