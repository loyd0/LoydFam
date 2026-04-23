"use client";

import { useState, useTransition } from "react";
import { StickyNote, Plus, Pencil, Trash2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { createNote, updateNote, deleteNote } from "@/app/(app)/people/actions";

interface NoteRecord {
  id: string;
  title: string | null;
  markdown: string;
  tiptapJson: unknown;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string | null; email: string } | null;
}

interface NotesPanelProps {
  entityType: "PERSON" | "EVENT" | "RELATIONSHIP" | "PLACE";
  entityId: string;
  notes: NoteRecord[];
  canEdit: boolean;
  onChange: () => void;
}

function relativeTime(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function NotesPanel({ entityType, entityId, notes, canEdit, onChange }: NotesPanelProps) {
  const [composing, setComposing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4 border-t border-border/40 pt-6">
      <div className="flex items-center justify-between border-b border-border/40 pb-2">
        <h3 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <StickyNote className="h-5 w-5 opacity-70 text-muted-foreground" />
          Notes
          <span className="text-sm font-normal text-muted-foreground">({notes.length})</span>
        </h3>
        {canEdit && !composing && (
          <Button size="xs" variant="outline" onClick={() => setComposing(true)}>
            <Plus className="h-3 w-3" />
            <span className="hidden sm:inline">Add note</span>
          </Button>
        )}
      </div>

      {composing && (
        <NoteComposer
          entityType={entityType}
          entityId={entityId}
          onCancel={() => setComposing(false)}
          onSaved={() => {
            setComposing(false);
            onChange();
          }}
        />
      )}

      {notes.length === 0 && !composing && (
        <p className="text-sm italic text-muted-foreground pt-2">No notes yet.</p>
      )}

      <div className="space-y-4 pt-2">
        {notes.map((note) =>
          editingId === note.id ? (
            <NoteComposer
              key={note.id}
              entityType={entityType}
              entityId={entityId}
              existing={note}
              onCancel={() => setEditingId(null)}
              onSaved={() => {
                setEditingId(null);
                onChange();
              }}
            />
          ) : (
            <NoteCard
              key={note.id}
              note={note}
              canEdit={canEdit}
              onEdit={() => setEditingId(note.id)}
              onDeleted={onChange}
            />
          ),
        )}
      </div>
    </div>
  );
}

function NoteCard({
  note,
  canEdit,
  onEdit,
  onDeleted,
}: {
  note: NoteRecord;
  canEdit: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const author = note.createdBy?.name || note.createdBy?.email || "Unknown";
  const edited = note.updatedAt !== note.createdAt;

  function handleDelete() {
    if (!confirm("Delete this note?")) return;
    startTransition(async () => {
      await deleteNote(note.id);
      onDeleted();
    });
  }

  return (
    <article className="group rounded-lg border border-border/50 bg-card/50 p-4 transition-colors hover:border-border">
      <header className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {note.title && <p className="font-medium text-sm">{note.title}</p>}
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {author} · {relativeTime(note.createdAt)}
            {edited && <span className="italic"> (edited)</span>}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 print:hidden">
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={onEdit}
              aria-label="Edit note"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
              disabled={pending}
              aria-label="Delete note"
            >
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            </Button>
          </div>
        )}
      </header>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
        {note.markdown}
      </div>
    </article>
  );
}

function NoteComposer({
  entityType,
  entityId,
  existing,
  onCancel,
  onSaved,
}: {
  entityType: "PERSON" | "EVENT" | "RELATIONSHIP" | "PLACE";
  entityId: string;
  existing?: NoteRecord;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [markdown, setMarkdown] = useState(existing?.markdown ?? "");
  const [tiptapJson, setTiptapJson] = useState<unknown>(existing?.tiptapJson ?? null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (!markdown.trim()) {
      setError("Please write something");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        if (existing) {
          await updateNote(existing.id, { title: title || null, markdown, tiptapJson });
        } else {
          await createNote(entityType, entityId, { title: title || null, markdown, tiptapJson });
        }
        onSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save note");
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {existing ? "Edit note" : "New note"}
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onCancel}
          disabled={pending}
          aria-label="Cancel"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      <Input
        placeholder="Title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <NoteEditor
        initialMarkdown={existing?.markdown}
        initialTiptap={existing?.tiptapJson}
        onChange={(v) => {
          setMarkdown(v.markdown);
          setTiptapJson(v.tiptapJson);
        }}
        autoFocus
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save note"}
        </Button>
      </div>
    </div>
  );
}
