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

const MONTH_NAMES = [
  "",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (res.ok) {
        setData(await res.json());
      }
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
        {
          label: "Total People",
          value: data.stats.totalPeople.toLocaleString(),
          icon: Users,
          colour: "text-chart-1",
        },
        {
          label: "Living",
          value: data.stats.livingCount.toLocaleString(),
          icon: TreePine,
          colour: "text-emerald-500",
        },
        {
          label: "Events",
          value: data.stats.totalEvents.toLocaleString(),
          icon: CalendarDays,
          colour: "text-chart-2",
        },
        {
          label: "Data Issues",
          value: data.stats.issueCount.toLocaleString(),
          icon: AlertTriangle,
          colour: "text-amber-500",
        },
      ]
    : [
        { label: "Total People", value: "—", icon: Users, colour: "text-chart-1" },
        { label: "Living", value: "—", icon: TreePine, colour: "text-emerald-500" },
        { label: "Events", value: "—", icon: CalendarDays, colour: "text-chart-2" },
        { label: "Data Issues", value: "—", icon: AlertTriangle, colour: "text-amber-500" },
      ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Overview of the Loyd family history database.
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card
            key={s.label}
            className="border-border/50 bg-card/80 backdrop-blur"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">
                {s.label}
              </CardDescription>
              <s.icon className={`h-4 w-4 ${s.colour}`} />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <div className="text-2xl font-bold">{s.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Birthdays */}
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cake className="h-4 w-4 text-pink-400" />
              Upcoming Birthdays
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
              data.upcomingBirthdays.map((b) => (
                <Link
                  key={b.id}
                  href={`/people/${b.id}`}
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 -mx-2 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pink-500/10 text-pink-500 text-xs font-medium">
                    {b.birthDay}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{b.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {MONTH_NAMES[b.birthMonth]} {b.birthDay}
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              ))
            ) : (
              <p className="text-center text-xs text-muted-foreground">
                {data?.stats.totalPeople
                  ? "No birthdays with known dates"
                  : "Import data to see birthdays"}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Recent Activity
              {data && data.recentActivity.length === 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  None yet
                </Badge>
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
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString()}
                    </p>
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
      </div>

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
            <Card
              key={item.label}
              className="border-border/50 bg-card/80 backdrop-blur"
            >
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
