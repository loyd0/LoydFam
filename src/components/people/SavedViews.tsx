"use client";

import { useState, useEffect, useCallback } from "react";
import { Bookmark, Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface PeopleFilter {
  q: string;
  gender: "" | "MALE" | "FEMALE";
  generation: string;
  tag: string;
  living: boolean;
}

interface SavedView {
  id: string;
  name: string;
  filterJson: PeopleFilter;
}

function describe(f: PeopleFilter): string {
  const parts: string[] = [];
  if (f.q) parts.push(`"${f.q}"`);
  if (f.gender) parts.push(f.gender === "MALE" ? "Male" : "Female");
  if (f.generation) parts.push(`Gen ${f.generation}`);
  if (f.tag) parts.push(`#${f.tag}`);
  if (f.living) parts.push("Living");
  return parts.length ? parts.join(" · ") : "No filters";
}

export function SavedViews({
  current,
  hasFilters,
  onApply,
}: {
  current: PeopleFilter;
  hasFilters: boolean;
  onApply: (filter: PeopleFilter) => void;
}) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch("/api/saved-views?scope=PEOPLE")
      .then((r) => (r.ok ? r.json() : { views: [] }))
      .then((d: { views: SavedView[] }) => setViews(d.views))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await fetch("/api/saved-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, scope: "PEOPLE", filter: current }),
      });
      setName("");
      setSaveOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/saved-views/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-10 gap-1.5">
            <Bookmark className="h-4 w-4" />
            <span className="hidden sm:inline">Views</span>
            {views.length > 0 && (
              <span className="ml-0.5 rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                {views.length}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Saved views</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {views.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              No saved views yet. Apply some filters and save them for quick access.
            </p>
          ) : (
            views.map((v) => (
              <DropdownMenuItem
                key={v.id}
                onClick={() => onApply(v.filterJson)}
                className="flex items-start justify-between gap-2"
              >
                <span className="flex-1 min-w-0">
                  <span className="block truncate font-medium">{v.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {describe(v.filterJson)}
                  </span>
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(v.id);
                  }}
                  className="mt-0.5 text-muted-foreground hover:text-destructive"
                  aria-label={`Delete view ${v.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!hasFilters}
            onClick={() => setSaveOpen(true)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Save current filters
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save view</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
              }}
              placeholder="View name (e.g. Living Loyds, Gen 5)"
            />
            <p className="text-xs text-muted-foreground">{describe(current)}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !name.trim()} className="gap-1.5">
              <Check className="h-4 w-4" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
