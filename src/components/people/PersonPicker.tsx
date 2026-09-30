"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search, UserCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { personSearchLabel } from "@/lib/person-search";

export interface PickedPerson {
  id: string;
  displayName: string;
  gender: string;
  birthYear?: number | null;
  deathYear?: number | null;
  externalId?: string | null;
  sourceSystem?: string | null;
  numberSystem?: string | null;
  branch?: string | null;
  generation?: number | null;
}

interface PersonPickerProps {
  value: PickedPerson | null;
  onChange: (person: PickedPerson | null) => void;
  excludeIds?: string[];
  placeholder?: string;
  autoFocus?: boolean;
  label?: string;
  disabled?: boolean;
}

const NO_EXCLUSIONS: string[] = [];
function detail(person: PickedPerson) {
  return personSearchLabel({
    id: person.id, displayName: person.displayName, surname: null, gender: person.gender,
    generation: person.generation ?? null, birthYear: person.birthYear ?? null, deathYear: person.deathYear ?? null,
    externalId: person.externalId ?? null, sourceSystem: person.sourceSystem ?? null,
    numberSystem: person.numberSystem ?? null, branch: person.branch ?? null,
  });
}

function isSearchable(term: string) {
  return term.length >= 2 || /^#?[a-z0-9]*\d[a-z0-9]*$/i.test(term) || /^(loyd|girls)\s*[:#-]?\s*[a-z0-9]+$/i.test(term);
}

export function PersonPicker({
  value,
  onChange,
  excludeIds = NO_EXCLUSIONS,
  placeholder = "Search by name or family number…",
  autoFocus = false,
  label = "Search people",
  disabled = false,
}: PersonPickerProps) {
  const uid = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const focusTriggerOnClose = useRef(false);
  const exclusionKey = excludeIds.join("|");
  const searchReady = isSearchable(query.trim());

  useEffect(() => {
    if (!autoFocus || disabled) return;
    setOpen(true);
  }, [autoFocus, disabled]);

  useEffect(() => {
    const term = query.trim();
    const id = ++requestId.current;
    request.current?.abort();
    setResults([]);
    setError(false);
    setLoading(false);
    if (timer.current) clearTimeout(timer.current);
    if (!isSearchable(term)) return;

    timer.current = setTimeout(async () => {
      const controller = new AbortController();
      request.current = controller;
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search failed");
        const data = await response.json() as { people?: PickedPerson[] };
        if (id !== requestId.current || controller.signal.aborted) return;
        const excluded = new Set(exclusionKey.split("|").filter(Boolean));
        setResults((data.people ?? []).filter((person) => !excluded.has(person.id)));
        setActive(0);
      } catch (cause) {
        if (id === requestId.current && !(cause instanceof DOMException && cause.name === "AbortError")) {
          setResults([]);
          setError(true);
        }
      } finally {
        if (id === requestId.current && !controller.signal.aborted) setLoading(false);
      }
    }, 100);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      request.current?.abort();
    };
  }, [query, exclusionKey]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else if (focusTriggerOnClose.current) {
      focusTriggerOnClose.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !results[active]) return;
    document.getElementById(`${uid}-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, results, uid]);

  function choose(person: PickedPerson) {
    onChange(person);
    setQuery("");
    setResults([]);
    focusTriggerOnClose.current = true;
    setOpen(false);
  }

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      focusTriggerOnClose.current = true;
      setOpen(false);
      setQuery("");
    } else if (event.key === "ArrowDown" && results.length) {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp" && results.length) {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && results[active]) {
      event.preventDefault();
      choose(results[active]);
    }
  }

  return <div ref={rootRef} className="min-w-0" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    {open ? <div className="relative">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input ref={inputRef} value={query} role="combobox" aria-label={label} aria-expanded={open} aria-controls={`${uid}-results`} aria-autocomplete="list" aria-activedescendant={results[active] ? `${uid}-option-${active}` : undefined} placeholder={placeholder} onChange={(event) => {setQuery(event.target.value); setActive(0);}} onKeyDown={onSearchKeyDown} className="h-11 pl-9 pr-12 text-base" />
      {query && <Button type="button" size="icon" variant="ghost" aria-label="Clear search" className="absolute right-0 top-0 h-11 w-11" onClick={() => {setQuery(""); inputRef.current?.focus();}}><X className="size-4" /></Button>}
    </div> : <div className="flex min-w-0 items-center gap-1">
      <Button ref={triggerRef} type="button" variant="outline" disabled={disabled} className="h-auto min-h-11 min-w-0 flex-1 justify-start gap-2 px-3 py-2 text-left font-normal" aria-label={value ? `${label}: ${value.displayName}. Change person` : label} aria-haspopup="listbox" aria-expanded={false} onClick={() => setOpen(true)} onKeyDown={(event) => {
        if (event.key === "ArrowDown") {event.preventDefault(); setOpen(true);}
      }}>
        {value ? <UserCircle2 aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /> : <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}
        <span className="min-w-0 flex-1"><span className={`block break-words text-sm ${value ? "text-foreground" : "text-muted-foreground"}`}>{value?.displayName ?? placeholder}</span>{value && <span className="block whitespace-normal break-words text-xs text-muted-foreground">{detail(value)}</span>}</span>
      </Button>
      {value && <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={`Clear ${value.displayName}`} onClick={() => onChange(null)}><X className="size-4" /></Button>}
    </div>}
    {open && <div className="mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-sm">
      <div id={`${uid}-results`} role="listbox" aria-label="Matching people" className="max-h-[min(320px,40svh)] overflow-y-auto overscroll-contain p-2" onMouseDown={(event) => event.preventDefault()}>
        {!searchReady && <p className="px-3 py-4 text-sm text-muted-foreground">Type a name or original family number.</p>}
        {searchReady && loading && <p role="status" className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Searching family…</p>}
        {searchReady && !loading && error && <p role="alert" className="px-3 py-4 text-sm text-destructive">Search failed. Check your connection and try again.</p>}
        {searchReady && !loading && !error && results.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">No matching people. Try another name or number.</p>}
        {results.map((person, index) => <button id={`${uid}-option-${index}`} key={person.id} type="button" tabIndex={-1} role="option" aria-selected={active === index} onMouseEnter={() => setActive(index)} onClick={() => choose(person)} className={`flex min-h-11 w-full min-w-0 items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-accent ${active === index ? "bg-accent" : ""}`}>
          <span className={`h-2 w-2 shrink-0 rounded-full ${person.gender === "MALE" ? "bg-primary" : person.gender === "FEMALE" ? "bg-emerald-600" : "bg-muted-foreground"}`} />
          <span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium">{person.displayName}</span><span className="block whitespace-normal break-words text-xs text-muted-foreground">{detail(person)}</span></span>
        </button>)}

      </div>
      <p className="border-t px-3 py-2 text-xs text-muted-foreground">↑ ↓ to move · Enter to choose · Esc to close</p>
    </div>}
  </div>;
}
