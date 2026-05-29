"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { Tag as TagIcon, Plus, X, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addTag, removeTag } from "@/app/(app)/people/actions";

export interface PersonTag {
  id: string;
  name: string;
  colour: string | null;
  linkId?: string;
}

export function TagsSection({
  personId,
  tags,
  canEdit,
  onChange,
}: {
  personId: string;
  tags: PersonTag[];
  canEdit: boolean;
  onChange: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!adding) return;
    inputRef.current?.focus();
    let cancelled = false;
    fetch("/api/tags")
      .then((r) => (r.ok ? r.json() : { tags: [] }))
      .then((d: { tags: { name: string }[] }) => {
        if (!cancelled) setSuggestions(d.tags.map((t) => t.name));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [adding]);

  const existingNames = new Set(tags.map((t) => t.name.toLowerCase()));
  const filtered = suggestions.filter(
    (s) =>
      !existingNames.has(s.toLowerCase()) &&
      s.toLowerCase().includes(value.trim().toLowerCase())
  );

  function submit(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      await addTag(personId, trimmed);
      setValue("");
      setAdding(false);
      onChange();
    });
  }

  function handleRemove(tagId: string) {
    startTransition(async () => {
      await removeTag(personId, tagId);
      onChange();
    });
  }

  if (!canEdit && tags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <TagIcon className="h-3.5 w-3.5" />
        Tags
      </span>

      {tags.map((tag) => (
        <Badge
          key={tag.id}
          variant="secondary"
          className="group gap-1 font-normal"
          style={
            tag.colour
              ? { backgroundColor: `${tag.colour}20`, color: tag.colour }
              : undefined
          }
        >
          {tag.name}
          {canEdit && (
            <button
              onClick={() => handleRemove(tag.id)}
              disabled={pending}
              className="opacity-50 transition-opacity hover:opacity-100"
              aria-label={`Remove tag ${tag.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}

      {tags.length === 0 && !adding && canEdit && (
        <span className="text-xs italic text-muted-foreground">No tags yet.</span>
      )}

      {canEdit && !adding && (
        <Button
          variant="outline"
          size="xs"
          onClick={() => setAdding(true)}
          className="gap-1 print:hidden"
        >
          <Plus className="h-3 w-3" />
          Add tag
        </Button>
      )}

      {canEdit && adding && (
        <div className="relative print:hidden">
          <div className="flex items-center gap-1">
            <Input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit(value);
                } else if (e.key === "Escape") {
                  setAdding(false);
                  setValue("");
                }
              }}
              placeholder="Tag name…"
              className="h-7 w-40 text-sm"
              disabled={pending}
            />
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => submit(value)}
              disabled={pending || !value.trim()}
              aria-label="Confirm tag"
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setValue("");
              }}
              aria-label="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          {filtered.length > 0 && (
            <div className="absolute left-0 top-9 z-50 w-48 overflow-hidden rounded-md border border-border bg-popover shadow-md">
              {filtered.slice(0, 6).map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
