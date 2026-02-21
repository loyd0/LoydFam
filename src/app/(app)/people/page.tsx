"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  Filter,
  X,
} from "lucide-react";
import { PersonProfile } from "@/components/people/PersonProfile";

interface PersonRow {
  id: string;
  displayName: string;
  surname: string | null;
  givenName1: string | null;
  knownAs: string | null;
  gender: string;
  generation: number | null;
  birthYear: number | null;
  deathYear: number | null;
  isLiving: boolean;
}

interface PeopleResponse {
  people: PersonRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const PAGE_SIZES = [10, 25, 50, 100];

const GENERATIONS = Array.from({ length: 14 }, (_, i) => i + 1);

export default function PeoplePage() {
  const [data, setData] = useState<PeopleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [gender, setGender] = useState<"" | "MALE" | "FEMALE">("");
  const [living, setLiving] = useState(false);
  const [generation, setGeneration] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [gender, living, generation, limit]);

  const fetchPeople = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedQuery) params.set("q", debouncedQuery);
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (gender) params.set("gender", gender);
      if (living) params.set("living", "true");
      if (generation) params.set("generation", generation);

      const res = await fetch(`/api/people?${params}`);
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, page, limit, gender, living, generation]);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const hasFilters = gender !== "" || living || generation !== "";

  function clearFilters() {
    setGender("");
    setLiving(false);
    setGeneration("");
    setQuery("");
    setPage(1);
  }

  function openDrawer(id: string) {
    setSelectedId(id);
    setDrawerOpen(true);
  }

  function handleDrawerNavigate(id: string) {
    setSelectedId(id);
  }

  const genderColor = (g: string) =>
    g === "MALE"
      ? "bg-sky-500/10 text-sky-700 dark:text-sky-400"
      : g === "FEMALE"
      ? "bg-pink-500/10 text-pink-700 dark:text-pink-400"
      : "bg-muted text-muted-foreground";

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">People</h1>
        <p className="mt-1 text-muted-foreground">
          Searchable directory of all people in the family tree.
          {data && (
            <span className="ml-2 font-medium text-foreground">
              {data.total.toLocaleString()} people
            </span>
          )}
        </p>
      </div>

      {/* Search + Filters toolbar */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Search */}
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name…"
            className="pl-10"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Gender filter */}
        <Select
          value={gender || "all"}
          onValueChange={(v) => setGender(v === "all" ? "" : (v as "MALE" | "FEMALE"))}
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

        {/* Generation filter */}
        <Select
          value={generation || "all"}
          onValueChange={(v) => setGeneration(v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Generation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All generations</SelectItem>
            {GENERATIONS.map((g) => (
              <SelectItem key={g} value={String(g)}>
                Generation {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Living toggle */}
        <Button
          variant={living ? "default" : "outline"}
          size="sm"
          className="h-10 gap-1.5"
          onClick={() => setLiving((v) => !v)}
        >
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              living ? "bg-emerald-300" : "bg-emerald-500/50"
            }`}
          />
          Living only
        </Button>

        {/* Clear filters */}
        {(hasFilters || query) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-10 text-muted-foreground gap-1"
            onClick={clearFilters}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Page size */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page</span>
          <Select
            value={String(limit)}
            onValueChange={(v) => setLimit(Number(v))}
          >
            <SelectTrigger className="w-[75px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active filter chips */}
      {hasFilters && (
        <div className="flex flex-wrap gap-2">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Filter className="h-3 w-3" /> Filters:
          </span>
          {gender && (
            <Badge
              variant="secondary"
              className="cursor-pointer gap-1 hover:bg-destructive/10"
              onClick={() => setGender("")}
            >
              {gender === "MALE" ? "Male" : "Female"}
              <X className="h-3 w-3" />
            </Badge>
          )}
          {generation && (
            <Badge
              variant="secondary"
              className="cursor-pointer gap-1 hover:bg-destructive/10"
              onClick={() => setGeneration("")}
            >
              Gen {generation}
              <X className="h-3 w-3" />
            </Badge>
          )}
          {living && (
            <Badge
              variant="secondary"
              className="cursor-pointer gap-1 hover:bg-destructive/10 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              onClick={() => setLiving(false)}
            >
              Living only
              <X className="h-3 w-3" />
            </Badge>
          )}
        </div>
      )}

      {/* Table */}
      <Card className="border-border/50 bg-card/80 backdrop-blur overflow-hidden">
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : data && data.people.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 pl-4" />
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Dates</TableHead>
                    <TableHead className="hidden md:table-cell">Gen</TableHead>
                    <TableHead className="text-right pr-4">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.people.map((person) => (
                    <TableRow
                      key={person.id}
                      className="cursor-pointer transition-colors"
                      onClick={() => openDrawer(person.id)}
                    >
                      {/* Avatar */}
                      <TableCell className="pl-4 pr-0">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-full ${genderColor(person.gender)}`}
                        >
                          <UserIcon className="h-4 w-4" />
                        </div>
                      </TableCell>

                      {/* Name */}
                      <TableCell>
                        <p className="font-medium text-sm leading-tight">
                          {person.displayName}
                        </p>
                        {person.knownAs && (
                          <p className="text-xs text-muted-foreground">
                            "{person.knownAs}"
                          </p>
                        )}
                      </TableCell>

                      {/* Dates */}
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {person.birthYear ?? "?"}
                        {" – "}
                        {person.isLiving ? "living" : (person.deathYear ?? "?")}
                      </TableCell>

                      {/* Generation */}
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {person.generation != null ? `Gen ${person.generation}` : "—"}
                      </TableCell>

                      {/* Status badges */}
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {person.isLiving && (
                            <Badge className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-0">
                              Living
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px]">
                            {person.gender === "MALE"
                              ? "M"
                              : person.gender === "FEMALE"
                              ? "F"
                              : "?"}
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-border/50 px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  {((data.page - 1) * data.limit + 1).toLocaleString()}–
                  {Math.min(data.page * data.limit, data.total).toLocaleString()} of{" "}
                  {data.total.toLocaleString()} people
                  {loading && (
                    <span className="ml-2 animate-pulse">Updating…</span>
                  )}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs px-2 text-muted-foreground">
                    {data.page} / {data.totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                    disabled={page >= data.totalPages || loading}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Users className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {debouncedQuery || hasFilters
                  ? "No people match your search or filters."
                  : "Import data from the Excel workbook to populate the people directory."}
              </p>
              {(debouncedQuery || hasFilters) && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl overflow-y-auto"
        >
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center justify-between gap-2 text-base text-muted-foreground font-normal">
              <span className="flex items-center gap-2">
                <UserIcon className="h-4 w-4" />
                Person Profile
              </span>
              {selectedId && (
                <Button asChild variant="outline" size="sm" className="text-xs gap-1.5">
                  <Link href={`/people/${selectedId}`}>
                    View Full Page →
                  </Link>
                </Button>
              )}
            </SheetTitle>
          </SheetHeader>
          {selectedId && (
            <PersonProfile
              personId={selectedId}
              onNavigate={handleDrawerNavigate}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
