"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useViewMode } from "@/hooks/use-view-mode";
import { usePermissions, type PermissionKey } from "@/hooks/use-permissions";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { parsePersonSearchQuery, personSearchLabel, type PersonSearchItem } from "@/lib/person-search";
import { ArrowRight, Calendar, Loader2, Search, UserRound } from "lucide-react";

type SearchEvent = { id: string; type: string; dateYear: number | null; people: { id: string; displayName: string }[] };
type SearchResults = { people: PersonSearchItem[]; events: SearchEvent[]; properties?: { slug: string; name: string; location: string }[] };
const sections = [
  { name: "Dashboard", path: "/", permission: "dashboard.view" },
  { name: "People", path: "/people", permission: "people.view" },
  { name: "Family tree", path: "/tree", permission: "tree.view" },
  { name: "Relationship finder", path: "/relationship", permission: "relationship.view" },
  { name: "Generations", path: "/generations", permission: "generations.view" },
  { name: "Family map", path: "/map", permission: "map.view" },
  { name: "Family properties · Houses and estates", path: "/properties", permission: "properties.view" },
  { name: "Ancestor fan chart", path: "/fan-chart", permission: "fanChart.view" },
  { name: "Mind map", path: "/mindmap", permission: "mindmap.view" },
  { name: "Timeline", path: "/timeline", permission: "timeline.view" },
  { name: "Statistics", path: "/stats", permission: "stats.view" },
  { name: "System history", path: "/history", permission: "history.view" },
  { name: "My account · This is me", path: "/settings" },
  { name: "Admin permissions", path: "/admin/permissions", adminOnly: true },
  { name: "User management", path: "/admin/settings", adminOnly: true },
  { name: "Imports", path: "/admin/imports", adminOnly: true },
  { name: "Data quality", path: "/admin/data-quality", adminOnly: true },
] satisfies { name: string; path: string; permission?: PermissionKey; adminOnly?: boolean }[];

export function CommandPalette() {
  const router = useRouter();
  const { isLoydOnly } = useViewMode();
  const { can } = usePermissions();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const parsed = parsePersonSearchQuery(query);
  const ready = parsed.text.length >= 2 || parsed.familyNumber !== null;

  useEffect(() => {
    const toggle = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (document.activeElement instanceof HTMLElement) returnFocus.current = document.activeElement;
        setOpen((current) => !current);
        setQuery(""); setResults(null); setError(false);
      }
    };
    window.addEventListener("keydown", toggle);
    return () => window.removeEventListener("keydown", toggle);
  }, []);

  useEffect(() => {
    setResults(null); setError(false);
    if (!open || !ready) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query.trim() });
        if (isLoydOnly) params.set("loydOnly", "true");
        const response = await fetch(`/api/search?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search unavailable");
        const data = await response.json();
        if (!controller.signal.aborted) setResults(data);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 120);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, open, ready, isLoydOnly]);

  function navigate(path: string) { setOpen(false); router.push(path); }
  const matchingSections = sections.filter((section) =>
    (!section.permission || can(section.permission)) &&
    (!section.adminOnly || session?.user?.role === "ADMIN") &&
    section.name.toLowerCase().includes(query.trim().toLowerCase())
  );
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent
      className="top-[max(env(safe-area-inset-top),0.5rem)] bottom-auto flex max-h-[calc(100dvh-1rem)] flex-col gap-0 overflow-hidden p-0 pb-0 sm:top-[12vh] sm:max-h-[76dvh] sm:max-w-xl sm:translate-y-0 sm:p-0"
      onCloseAutoFocus={(event) => { event.preventDefault(); returnFocus.current?.focus(); }}
    >
      <DialogTitle className="sr-only">Search the family archive</DialogTitle>
      <DialogDescription className="sr-only">Find a person by name or original family number, or jump to a section.</DialogDescription>
      <Command shouldFilter={false} className="min-h-0 rounded-none bg-card">
        <CommandInput aria-label="Search name, family number or section" placeholder="Name, family number or section…" value={query} onValueChange={(value) => { setResults(null); setQuery(value); }} className="h-14 pr-12 text-base" />
        <CommandList className="min-h-0 max-h-[calc(100dvh-8rem)] flex-1 overscroll-contain px-2 pb-3 sm:max-h-[60dvh]">
          {loading && <p role="status" className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Searching the archive…</p>}
          {error && <p role="alert" className="p-4 text-sm text-destructive">Search could not load. Check your connection and try again.</p>}
          {can("people.view") && results?.people.length ? <CommandGroup heading="People">
            {results.people.map((person) => <CommandItem key={person.id} value={`person-${person.id}`} onSelect={() => navigate(`/people/${person.id}`)} className="min-h-16 cursor-pointer gap-3 py-3">
              <UserRound className="size-5" aria-hidden="true" />
              <span className="min-w-0 flex-1"><span className="block break-words font-medium">{person.displayName}</span><span className="block whitespace-normal text-xs leading-relaxed text-muted-foreground">{personSearchLabel(person)}</span></span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </CommandItem>)}
          </CommandGroup> : null}
          {(can("people.view") || can("timeline.view")) && results?.events.length ? <CommandGroup heading="Recorded events">
            {results.events.map((event) => <CommandItem key={event.id} value={`event-${event.id}`} onSelect={() => navigate(can("people.view") && event.people[0] ? `/people/${event.people[0].id}` : "/timeline")} className="min-h-16 cursor-pointer gap-3 py-3">
              <Calendar className="size-5" aria-hidden="true" />
              <span className="min-w-0"><span className="block capitalize">{event.type.toLowerCase()} · {event.dateYear ?? "Year unknown"}</span><span className="block whitespace-normal text-xs text-muted-foreground">{event.people.map((person) => person.displayName).join(", ")}</span></span>
            </CommandItem>)}
          </CommandGroup> : null}
          {can("properties.view") && results?.properties?.length ? <CommandGroup heading="Family properties">
            {results.properties.map((property) => <CommandItem key={property.slug} value={`property-${property.slug}`} onSelect={() => navigate(`/properties/${property.slug}`)} className="min-h-16 cursor-pointer gap-3 py-3"><Search className="size-5" aria-hidden="true" /><span className="min-w-0"><span className="block font-medium">{property.name}</span><span className="block whitespace-normal text-xs text-muted-foreground">{property.location}</span></span></CommandItem>)}
          </CommandGroup> : null}
          {results && (!can("people.view") || !results.people.length) && (!(can("people.view") || can("timeline.view")) || !results.events.length) && (!can("properties.view") || !results.properties?.length) && !loading && <p className="p-4 text-sm text-muted-foreground">No family records match “{query}”. Try a surname, property name or a number such as LOYD:42.</p>}
          {matchingSections.length > 0 && <CommandGroup heading="Go to">
            {matchingSections.map((section) => <CommandItem key={section.path} value={section.path} onSelect={() => navigate(section.path)} className="min-h-11 cursor-pointer"><Search className="size-4" aria-hidden="true" />{section.name}</CommandItem>)}
          </CommandGroup>}
        </CommandList>
      </Command>
    </DialogContent>
  </Dialog>;
}
