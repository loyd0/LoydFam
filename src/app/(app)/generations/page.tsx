"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  ChevronDown,
  ChevronRight,
  User as UserIcon,
  Baby,
  Heart,
  TrendingUp,
} from "lucide-react";

interface GenerationPerson {
  id: string;
  displayName: string;
  gender: string;
  surname: string | null;
  birthYear: number | null;
  deathYear: number | null;
  isLiving: boolean;
}

interface Generation {
  generation: number;
  count: number;
  stats: {
    male: number;
    female: number;
    living: number;
    avgLifespan: number | null;
  };
  people: GenerationPerson[];
}

const genderColor = (g: string) =>
  g === "MALE"
    ? "bg-sky-500/10 text-sky-700 dark:text-sky-400"
    : g === "FEMALE"
    ? "bg-pink-500/10 text-pink-700 dark:text-pink-400"
    : "bg-muted text-muted-foreground";

export default function GenerationsPage() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set([1, 2]));
  const [genderFilter, setGenderFilter] = useState<"" | "MALE" | "FEMALE">("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/generations");
      if (res.ok) {
        const data = await res.json();
        setGenerations(data.generations);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(gen: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(gen)) next.delete(gen);
      else next.add(gen);
      return next;
    });
  }

  const total = generations.reduce((s, g) => s + g.count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Generation Explorer</h1>
        <p className="mt-1 text-muted-foreground">
          Browse all family members organised by generation.
          {!loading && total > 0 && (
            <span className="ml-2 font-medium text-foreground">
              {total.toLocaleString()} people across {generations.length} generations
            </span>
          )}
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={genderFilter || "all"}
          onValueChange={(v) => setGenderFilter(v === "all" ? "" : (v as "MALE" | "FEMALE"))}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All genders</SelectItem>
            <SelectItem value="MALE">Male</SelectItem>
            <SelectItem value="FEMALE">Female</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpanded(new Set(generations.map((g) => g.generation)))}
        >
          Expand All
        </Button>
        <Button variant="outline" size="sm" onClick={() => setExpanded(new Set())}>
          Collapse All
        </Button>
      </div>

      {/* Summary tiles */}
      {!loading && generations.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Generations</p>
              <p className="text-2xl font-bold mt-0.5">{generations.length}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Living</p>
              <p className="text-2xl font-bold mt-0.5 text-emerald-600">
                {generations.reduce((s, g) => s + g.stats.living, 0)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Largest Gen</p>
              <p className="text-2xl font-bold mt-0.5">
                {generations.length > 0
                  ? `Gen ${generations.reduce((a, b) => (a.count > b.count ? a : b)).generation}`
                  : "—"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total People</p>
              <p className="text-2xl font-bold mt-0.5">{total.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Generation accordion */}
      <div className="space-y-2">
        {loading
          ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)
          : generations.map((gen, idx) => {
              const isOpen = expanded.has(gen.generation);
              const filteredPeople = genderFilter
                ? gen.people.filter((p) => p.gender === genderFilter)
                : gen.people;

              return (
                <div
                  key={gen.generation}
                  className="rounded-xl border border-border/50 bg-card/80 backdrop-blur overflow-hidden transition-all"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  {/* Header row */}
                  <button
                    onClick={() => toggle(gen.generation)}
                    className="flex w-full items-center gap-4 px-4 py-3.5 hover:bg-muted/30 transition-colors text-left"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-bold">
                      {gen.generation}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">Generation {gen.generation}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">{gen.count} people</span>
                        {gen.stats.living > 0 && (
                          <span className="text-xs text-emerald-600 flex items-center gap-1">
                            <Heart className="h-2.5 w-2.5" /> {gen.stats.living} living
                          </span>
                        )}
                        {gen.stats.avgLifespan && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="h-2.5 w-2.5" /> avg {gen.stats.avgLifespan} yrs
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Gender donut */}
                    <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="text-sky-600">{gen.stats.male}M</span>
                      <span>/</span>
                      <span className="text-pink-600">{gen.stats.female}F</span>
                    </div>
                    {/* Width bar */}
                    <div className="hidden md:block w-24 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/60 transition-all duration-500"
                        style={{
                          width: `${(gen.count / Math.max(...generations.map((g) => g.count))) * 100}%`,
                        }}
                      />
                    </div>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200" />
                    )}
                  </button>

                  {/* People grid */}
                  {isOpen && (
                    <div className="border-t border-border/30 px-4 py-3">
                      {filteredPeople.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">
                          No people match the current filter.
                        </p>
                      ) : (
                        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {filteredPeople.map((p) => (
                            <Link
                              key={p.id}
                              href={`/people/${p.id}`}
                              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/40 transition-colors group"
                            >
                              <div
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${genderColor(p.gender)}`}
                              >
                                {p.gender === "MALE" ? (
                                  <UserIcon className="h-3.5 w-3.5" />
                                ) : p.gender === "FEMALE" ? (
                                  <Baby className="h-3.5 w-3.5" />
                                ) : (
                                  <Users className="h-3.5 w-3.5" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate leading-tight group-hover:text-primary transition-colors">
                                  {p.displayName}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {p.birthYear ?? "?"}–{p.isLiving ? "living" : (p.deathYear ?? "?")}
                                </p>
                              </div>
                              {p.isLiving && (
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                              )}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
      </div>

      {!loading && generations.length === 0 && (
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardContent className="py-16 text-center">
            <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No data yet. Import the workbook to populate generations.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
