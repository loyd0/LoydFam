"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePermissions } from "@/hooks/use-permissions";
import { useViewMode } from "@/hooks/use-view-mode";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  Filter,
  X,
  UserPlus,
  Download,
} from "lucide-react";
import { PersonProfile } from "@/components/people/PersonProfile";
import { SavedViews, type PeopleFilter } from "@/components/people/SavedViews";

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
  const { can, isAdmin } = usePermissions();
  const canEditPerson = isAdmin && can("people.edit");
  const { isLoydOnly } = useViewMode();
  const [data, setData] = useState<PeopleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [gender, setGender] = useState<"" | "MALE" | "FEMALE">("");
  const [living, setLiving] = useState(false);
  const [generation, setGeneration] = useState<string>("");
  const [tag, setTag] = useState<string>("");
  const [availableTags, setAvailableTags] = useState<{ name: string; count: number }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

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
  }, [gender, living, generation, tag, limit]);

  // Load available tags for the filter dropdown
  useEffect(() => {
    fetch("/api/tags")
      .then((r) => (r.ok ? r.json() : { tags: [] }))
      .then((d: { tags: { name: string; count: number }[] }) => setAvailableTags(d.tags))
      .catch(() => {});
  }, []);

  // Reset page and data when mode changes
  useEffect(() => {
    setPage(1);
    setData(null);
  }, [isLoydOnly]);

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
      if (tag) params.set("tag", tag);
      if (isLoydOnly) params.set("loydOnly", "true");

      const res = await fetch(`/api/people?${params}`);
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, page, limit, gender, living, generation, tag, isLoydOnly]);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const hasFilters = gender !== "" || living || generation !== "" || tag !== "";
  const activeFilterCount = Number(Boolean(gender)) + Number(living) + Number(Boolean(generation)) + Number(Boolean(tag));

  function clearFilters() {
    setGender("");
    setLiving(false);
    setGeneration("");
    setTag("");
    setQuery("");
    setPage(1);
  }

  const currentFilter: PeopleFilter = { q: query, gender, generation, tag, living };

  function applyView(f: PeopleFilter) {
    setQuery(f.q ?? "");
    setGender(f.gender ?? "");
    setGeneration(f.generation ?? "");
    setTag(f.tag ?? "");
    setLiving(Boolean(f.living));
    setPage(1);
  }

  function exportData(format: "csv" | "json" | "gedcom") {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (gender) params.set("gender", gender);
    if (living) params.set("living", "true");
    if (generation) params.set("generation", generation);
    if (tag) params.set("tag", tag);
    if (isLoydOnly) params.set("loydOnly", "true");
    params.set("format", format);
    const link = document.createElement("a");
    link.href = `/api/export?${params}`;
    link.download = "";
    link.click();
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
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {/* Title */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">People</h1>
          <p className="mt-1 text-muted-foreground">
            Searchable directory of all people in the family tree.
            {data && (
              <span className="ml-2 font-medium text-foreground">
                {data.total.toLocaleString()} people
              </span>
            )}
          </p>
        </div>
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
          {can("sources.download") && <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1 gap-1.5 sm:flex-none" aria-label="Export people">
                <Download className="h-4 w-4" />
                <span>Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Export {data ? `${data.total.toLocaleString()} people` : "people"}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => exportData("csv")}>
                CSV (spreadsheet)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportData("json")}>
                JSON (structured)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportData("gedcom")}>
                GEDCOM (genealogy)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>}
          {canEditPerson && (
            <Button asChild size="sm" className="flex-1 gap-1.5 sm:flex-none">
              <Link href="/people/new">
                <UserPlus className="h-4 w-4" />
                <span>Add person</span>
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Search + Filters toolbar */}
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
        {/* Search */}
        <div className="relative min-w-0 flex-1 sm:min-w-[220px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or number…"
            className="pl-10"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 sm:hidden">
          <Button type="button" variant="outline" className="flex-1 justify-between" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}>
            <span className="flex items-center gap-2"><Filter className="size-4" /> Filters</span>
            <span className="text-xs text-muted-foreground">{activeFilterCount ? `${activeFilterCount} active` : filtersOpen ? "Close" : "Optional"}</span>
          </Button>
          {(hasFilters || query) && <Button type="button" variant="ghost" onClick={clearFilters} aria-label="Clear search and filters">Clear</Button>}
        </div>

        <div className={`${filtersOpen ? "grid" : "hidden"} grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap sm:gap-3`}>

        {/* Gender filter */}
        <Select
          value={gender || "all"}
          onValueChange={(v) => setGender(v === "all" ? "" : (v as "MALE" | "FEMALE"))}
        >
          <SelectTrigger className="w-full sm:w-[130px]">
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
          <SelectTrigger className="w-full sm:w-[140px]">
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

        {/* Tag filter — only shown when tags exist */}
        {availableTags.length > 0 && (
          <Select
            value={tag || "all"}
            onValueChange={(v) => setTag(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {availableTags.map((t) => (
                <SelectItem key={t.name} value={t.name}>
                  {t.name} ({t.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Living toggle */}
        <Button
          variant={living ? "default" : "outline"}
          size="sm"
          className="h-10 w-full gap-1.5 sm:w-auto"
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
            className="h-10 w-full text-muted-foreground gap-1 sm:w-auto"
            onClick={clearFilters}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}

        {/* Saved views */}
        <SavedViews
          current={currentFilter}
          hasFilters={hasFilters || query !== ""}
          onApply={applyView}
        />

        {/* Spacer */}
        <div className="hidden flex-1 sm:block" />

        {/* Page size */}
        <div className="col-span-2 flex items-center justify-between gap-2 sm:justify-start">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page</span>
          <Select
            value={String(limit)}
            onValueChange={(v) => setLimit(Number(v))}
          >
            <SelectTrigger className="w-[84px] sm:w-[75px]">
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
          {tag && (
            <Badge
              variant="secondary"
              className="cursor-pointer gap-1 hover:bg-destructive/10"
              onClick={() => setTag("")}
            >
              Tag: {tag}
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
              <Table className="table-fixed sm:table-auto">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 pl-4" />
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Dates</TableHead>
                    <TableHead className="hidden md:table-cell">Gen</TableHead>
                    <TableHead className="hidden text-right pr-4 sm:table-cell">Status</TableHead>
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
                      <TableCell className="min-w-0 whitespace-normal">
                        <div className="flex min-w-0 items-start justify-between gap-1.5">
                          <p className="min-w-0 break-words whitespace-normal font-medium text-sm leading-tight">
                          {person.displayName}
                          </p>
                          <div className="flex shrink-0 items-center gap-1 sm:hidden">
                            {person.isLiving && <span className="size-2 rounded-full bg-emerald-500" aria-label="Living" title="Living" />}
                            <Badge variant="outline" className="text-[10px]">{person.gender === "MALE" ? "M" : person.gender === "FEMALE" ? "F" : "?"}</Badge>
                          </div>
                        </div>
                        {person.knownAs && (
                          <p className="text-xs text-muted-foreground">
                            &ldquo;{person.knownAs}&rdquo;
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
                      <TableCell className="hidden text-right pr-4 sm:table-cell">
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
              <div className="flex flex-col gap-2 border-t border-border/50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
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
                    aria-label="Previous page"
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
                    aria-label="Next page"
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
