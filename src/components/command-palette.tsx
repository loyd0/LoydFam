"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useViewMode } from "@/hooks/use-view-mode";
import {
  User as UserIcon,
  Baby,
  Skull,
  Church,
  Search,
  ArrowRight,
  Command,
  X,
} from "lucide-react";

interface SearchPerson {
  id: string;
  displayName: string;
  surname: string | null;
  gender: string;
  generation: number | null;
  birthYear: number | null;
  deathYear: number | null;
}

interface SearchEvent {
  id: string;
  type: string;
  dateYear: number | null;
  people: { id: string; displayName: string }[];
}

interface SearchResults {
  people: SearchPerson[];
  events: SearchEvent[];
}

const EVENT_ICONS: Record<string, React.FC<{ className?: string }>> = {
  BIRTH: Baby,
  DEATH: Skull,
  MARRIAGE: Church,
};

export function CommandPalette() {
  const router = useRouter();
  const { isLoydOnly } = useViewMode();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keyboard shortcut to open
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(null);
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const loydParam = isLoydOnly ? "&loydOnly=true" : "";
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}${loydParam}`);
      if (res.ok) setResults(await res.json());
    } finally {
      setLoading(false);
    }
  }, [isLoydOnly]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 250);
  }, [query, search]);

  const allItems = [
    ...(results?.people.map((p) => ({ type: "person" as const, data: p })) ?? []),
    ...(results?.events.map((e) => ({ type: "event" as const, data: e })) ?? []),
  ];

  function navigate(item: (typeof allItems)[number]) {
    if (item.type === "person") {
      router.push(`/people/${item.data.id}`);
    }
    setOpen(false);
  }

  // Keyboard navigation inside palette
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && allItems[selected]) {
      navigate(allItems[selected]);
    }
  }

  if (!open) return null;

  const genderColor = (g: string) =>
    g === "MALE"
      ? "text-sky-600 bg-sky-500/10"
      : g === "FEMALE"
      ? "text-pink-600 bg-pink-500/10"
      : "text-muted-foreground bg-muted";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4"
      style={{ backdropFilter: "blur(4px)", backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        className="w-full max-w-xl border-t-4 border-t-primary border-x border-b border-border/60 bg-card shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200"
        style={{ maxHeight: "70vh", display: "flex", flexDirection: "column" }}
      >
        {/* Search bar */}
        <div className="flex items-center gap-4 px-5 py-4 border-b border-border/40">
          <Search className="h-5 w-5 text-primary/70 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search people, events…"
            className="flex-1 bg-transparent text-base font-medium outline-none placeholder:font-normal placeholder:text-muted-foreground/80"
          />
          {loading && (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/30 border-t-primary shrink-0" />
          )}
          <button
            onClick={() => setOpen(false)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1 p-2">
          {!results && !loading && query.length < 2 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Command className="mx-auto mb-2 h-6 w-6 opacity-30" />
              Type at least 2 characters to search…
            </div>
          )}

          {results && results.people.length === 0 && results.events.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {results && results.people.length > 0 && (
            <div className="mb-2">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                People
              </p>
              {results.people.map((person, i) => {
                const isSelected = selected === i;
                const dates = `${person.birthYear ?? "?"}–${person.deathYear ?? "living"}`;
                return (
                  <button
                    key={person.id}
                    onClick={() => navigate({ type: "person", data: person })}
                    onMouseEnter={() => setSelected(i)}
                    className={`flex w-full items-center gap-4 px-3 py-3 text-left transition-all ${
                      isSelected ? "bg-primary/5 text-primary border-l-2 border-primary" : "border-l-2 border-transparent hover:bg-muted/30"
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-none border border-border/40 text-xs font-bold ${genderColor(person.gender)}`}
                    >
                      <UserIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-tight truncate ${isSelected ? "font-semibold text-foreground" : "font-medium text-foreground/80"}`}>
                        {person.displayName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {dates}
                        {person.generation != null && ` · Gen ${person.generation}`}
                      </p>
                    </div>
                    <ArrowRight className={`h-4 w-4 shrink-0 transition-opacity ${isSelected ? "opacity-100 text-primary" : "opacity-0"}`} />
                  </button>
                );
              })}
            </div>
          )}

          {results && results.events.length > 0 && (
            <div>
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Events
              </p>
              {results.events.map((event, i) => {
                const globalIdx = (results?.people.length ?? 0) + i;
                const isSelected = selected === globalIdx;
                const Icon = EVENT_ICONS[event.type] ?? Search;
                const names = event.people.map((p) => p.displayName).join(", ");
                return (
                  <button
                    key={event.id}
                    onClick={() => {
                      if (event.people[0]) router.push(`/people/${event.people[0].id}`);
                      setOpen(false);
                    }}
                    onMouseEnter={() => setSelected(globalIdx)}
                    className={`flex w-full items-center gap-4 px-3 py-3 text-left transition-all ${
                      isSelected ? "bg-primary/5 text-primary border-l-2 border-primary" : "border-l-2 border-transparent hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none border border-border/40 bg-muted/30">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-tight truncate capitalize ${isSelected ? "font-semibold text-foreground" : "font-medium text-foreground/80"}`}>
                        {event.type.toLowerCase()} — {event.dateYear ?? "Unknown year"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{names}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border/50 px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><kbd className="rounded border bg-muted px-1">↑↓</kbd> Navigate</span>
          <span className="flex items-center gap-1"><kbd className="rounded border bg-muted px-1">↵</kbd> Open</span>
          <span className="flex items-center gap-1"><kbd className="rounded border bg-muted px-1">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
