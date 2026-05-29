"use client";

import { useEffect, useRef, useState } from "react";
import { Search, UserCircle2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface PickedPerson {
  id: string;
  displayName: string;
  gender: string;
  birthYear?: number | null;
  deathYear?: number | null;
}

interface PersonPickerProps {
  value: PickedPerson | null;
  onChange: (p: PickedPerson | null) => void;
  excludeIds?: string[];
  placeholder?: string;
  autoFocus?: boolean;
}

export function PersonPicker({
  value,
  onChange,
  excludeIds = [],
  placeholder = "Search people…",
  autoFocus,
}: PersonPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(
            (data.people as PickedPerson[]).filter((p) => !excludeIds.includes(p.id)),
          );
        }
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, excludeIds]);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
        <UserCircle2 className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-sm truncate">{value.displayName}</span>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          onClick={() => onChange(null)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={query}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="pl-10"
        />
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          {loading && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No matches</div>
          )}
          {!loading &&
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(p);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
              >
                <span
                  className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                    p.gender === "MALE"
                      ? "bg-primary"
                      : p.gender === "FEMALE"
                      ? "bg-[oklch(0.50_0.10_155)]"
                      : "bg-muted-foreground"
                  }`}
                />
                <span className="flex-1 truncate">{p.displayName}</span>
                {(p.birthYear || p.deathYear) && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {p.birthYear ?? "?"}–{p.deathYear ?? ""}
                  </span>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
