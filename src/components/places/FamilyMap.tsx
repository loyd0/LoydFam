"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { buildDatedJourneys, type PlacePoint } from "@/lib/places";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Search, Users, X } from "lucide-react";
import { useViewMode } from "@/hooks/use-view-mode";
import { useIsMobile } from "@/hooks/use-mobile";

const LeafletCanvas = dynamic(() => import("./LeafletCanvas"), { ssr: false });

type ResponseData = { points: PlacePoint[]; unresolvedCount: number; evidenceCount: number; resolvedEvidenceCount: number };

export function FamilyMap() {
  const [data, setData] = useState<ResponseData | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationSearch, setLocationSearch] = useState("");
  const [branch, setBranch] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [showJourneys, setShowJourneys] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<"map" | "places">("map");
  const isMobile = useIsMobile();
  const { isLoydOnly: loydOnly } = useViewMode();

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) { setBusy(true); setError(null); } });
    const params = new URLSearchParams();
    if (yearFrom) params.set("yearFrom", yearFrom);
    if (yearTo) params.set("yearTo", yearTo);
    if (loydOnly) params.set("loydOnly", "true");
    fetch(`/api/places?${params}`).then((r) => r.ok ? r.json() : Promise.reject()).then((value) => { if (active) setData(value); }).catch(() => { if (active) setError("Could not load locations. Please refresh to try again."); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [yearFrom, yearTo, loydOnly]);

  const branches = useMemo(() => [...new Set(data?.points.flatMap((p) => p.evidence.map((e) => e.branch).filter((x): x is string => Boolean(x))) ?? [])].sort(), [data]);
  const points = useMemo(() => (data?.points ?? []).filter((p) => {
    const matchesText = !locationSearch || p.canonical.toLowerCase().includes(locationSearch.toLowerCase());
    const matchesBranch = !branch || p.evidence.some((e) => e.branch === branch);
    if (!matchesText || !matchesBranch) return false;
    return true;
  }).map((p) => branch ? { ...p, evidence: p.evidence.filter((e) => e.branch === branch) } : p), [data, locationSearch, branch]);
  const journeys = useMemo(() => buildDatedJourneys(points), [points]);
  const selected = points.find((p) => p.id === selectedId) ?? null;
  const coverage = data?.evidenceCount ? Math.round(data.resolvedEvidenceCount / data.evidenceCount * 100) : 0;
  const activeFilterCount = Number(Boolean(locationSearch)) + Number(Boolean(branch)) + Number(Boolean(yearFrom)) + Number(Boolean(yearTo));

  function selectPlace(id: string) {
    setSelectedId(id);
    if (isMobile) setMobilePanel("places");
  }

  return <div className="family-map-page min-w-0 space-y-5" data-mobile-panel={mobilePanel}>
    <div>
      <Link href="/properties#property-map" className="mb-2 inline-flex min-h-11 items-center gap-2 text-sm text-primary underline underline-offset-4"><MapPin className="size-4" />Explore historic houses &amp; estates</Link>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Family Map</h1>
      <p className="family-map-description mt-1 max-w-3xl text-sm text-muted-foreground sm:text-base">Recorded places from family events and residence fields. Markers show recognized city or country centers.</p>
    </div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <Button type="button" variant="outline" className="family-map-filter-trigger w-full justify-between md:hidden" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}>
      <span className="flex items-center gap-2"><Search className="size-4" /> Map filters</span>
      <span className="text-xs text-muted-foreground">{activeFilterCount ? `${activeFilterCount} active` : filtersOpen ? "Close" : "Optional"}</span>
    </Button>
    <Card className={`family-map-filter-card ${filtersOpen ? "block" : "hidden md:block"} border-border/50`}><CardContent className="p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[190px] flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={locationSearch} onChange={(e) => setLocationSearch(e.target.value)} aria-label="Find a location" placeholder="Find a location" className="pl-9" /></div>
        <select aria-label="Family branch" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={branch} onChange={(e) => setBranch(e.target.value)}><option value="">All branches</option>{branches.map((value) => <option value={value} key={value}>{value}</option>)}</select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">From <Input aria-label="From year" inputMode="numeric" value={yearFrom} onChange={(e) => setYearFrom(e.target.value.replace(/\D/g, "").slice(0, 4))} className="w-20" /></label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">To <Input aria-label="To year" inputMode="numeric" value={yearTo} onChange={(e) => setYearTo(e.target.value.replace(/\D/g, "").slice(0, 4))} className="w-20" /></label>
        {(locationSearch || branch || yearFrom || yearTo) && <Button variant="ghost" size="sm" onClick={() => { setLocationSearch(""); setBranch(""); setYearFrom(""); setYearTo(""); }}>Clear</Button>}
      </div>
    </CardContent></Card>
    {journeys.length ? <>
      <label className="hidden min-h-11 items-center gap-2 text-sm md:flex"><input type="checkbox" checked={showJourneys} onChange={e => setShowJourneys(e.target.checked)} /> Show connections between dated places ({journeys.length} people)</label>
      <details className="md:hidden"><summary className="flex min-h-11 cursor-pointer items-center justify-between text-sm font-medium">Historical connections <span className="text-xs text-muted-foreground">{journeys.length} people</span></summary><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={showJourneys} onChange={e => setShowJourneys(e.target.checked)} /> Show connections between dated places</label></details>
    </> : <>
      <p className="family-map-connection-help hidden text-sm text-muted-foreground md:block">Dated connections appear when a person has places recorded in different years. Undated country lists do not establish a travel route.</p>
      <details className="md:hidden"><summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">About historical connections</summary><p className="pb-2 text-sm text-muted-foreground">Dated connections appear when a person has places recorded in different years. Undated country lists do not establish a travel route.</p></details>
    </>}
    <div role="tablist" aria-label="Map and place details" className="family-map-panel-tabs grid grid-cols-2 gap-1 rounded-lg border bg-muted/50 p-1 md:hidden">
      <button role="tab" aria-selected={mobilePanel === "map"} onClick={() => setMobilePanel("map")} className={`min-h-11 rounded-md px-3 text-sm font-medium ${mobilePanel === "map" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>Map</button>
      <button role="tab" aria-selected={mobilePanel === "places"} onClick={() => setMobilePanel("places")} className={`min-h-11 rounded-md px-3 text-sm font-medium ${mobilePanel === "places" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>Places <span className="text-xs">({points.length})</span></button>
    </div>
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className={`${mobilePanel === "map" ? "" : "hidden md:block"} family-map-canvas relative min-h-[min(62svh,620px)] overflow-hidden rounded-xl border border-border/60 bg-muted md:min-h-[520px]`}>
        {busy && <div className="absolute inset-x-0 top-2 z-[500] mx-auto w-fit rounded-full bg-background/90 px-3 py-1 text-xs shadow">Loading historical records…</div>}
        <LeafletCanvas points={points} onSelect={selectPlace} journeys={showJourneys ? journeys : []} />
      </div>
      <Card className={`${mobilePanel === "places" ? "" : "hidden md:block"} family-map-places max-h-[min(72svh,720px)] min-h-[320px] overflow-hidden border-border/50 xl:max-h-[640px]`}><CardContent className="flex h-full flex-col p-0">
        {selected ? <>
          <div className="flex items-start justify-between border-b p-4"><div><h2 className="font-semibold">{selected.canonical}</h2><p className="text-xs text-muted-foreground">{selected.kind.toLowerCase()} centroid · high confidence · recognized place name</p></div><Button variant="ghost" size="icon" aria-label="Close place preview" onClick={() => setSelectedId(null)}><X className="h-4 w-4" /></Button></div>
          <div className="overflow-y-auto p-3">{selected.evidence.map((item, i) => <Link href={`/people/${item.personId}`} key={`${item.id}:${item.personId}:${i}`} className="block min-h-16 rounded-lg p-3 hover:bg-muted"><p className="font-medium">{item.personName}</p><p className="text-sm text-muted-foreground">{item.label}{item.year ? ` · ${item.year}` : ""}</p><p className="mt-1 text-xs text-primary">Open profile →</p></Link>)}</div>
        </> : <>
          <div className="border-b p-4"><h2 className="font-semibold">Map coverage</h2><p className="mt-1 text-sm text-muted-foreground">{data?.resolvedEvidenceCount ?? 0} of {data?.evidenceCount ?? 0} evidence records resolved ({coverage}%).</p></div>
          <div className="overflow-y-auto p-4 text-sm text-muted-foreground"><div className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><p>{points.length} recognized places shown. Click a marker or location below to see the linked historical records.</p></div>{data?.unresolvedCount ? <p className="mt-3">{data.unresolvedCount} text entries could not be placed with the built-in name list. They are omitted from the map instead of guessed.</p> : null}
            <div className="mt-4 space-y-1">{points.slice(0, 120).map((p) => <button key={p.id} onClick={() => setSelectedId(p.id)} className="flex min-h-11 w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-muted"><span>{p.canonical}</span><span className="flex items-center gap-1 text-xs"><Users className="h-3 w-3" />{p.evidence.length}</span></button>)}</div>
          </div>
        </>}
      </CardContent></Card>
    </div>
    <p className="text-xs text-muted-foreground">Coordinates indicate a city or country center, not a person’s home or an exact event site.</p>
  </div>;
}
