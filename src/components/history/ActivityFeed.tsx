"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Clock,
  ChevronDown,
  ChevronUp,
  FileEdit,
  FilePlus,
  FileX,
  Link2,
  Link2Off,
  StickyNote,
  Image as ImageIcon,
  Upload,
  UserPlus,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface ActivityRecord {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  meta: unknown;
  actor: { id: string; name: string | null; email: string } | null;
}

interface ActivityFeedProps {
  entityType?: string;
  entityId?: string;
  limit?: number;
  defaultOpen?: boolean;
  title?: string;
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

function iconFor(type: string) {
  const cls = "h-3.5 w-3.5";
  switch (type) {
    case "ENTITY_CREATED":
      return <FilePlus className={cls + " text-emerald-500"} />;
    case "ENTITY_UPDATED":
      return <FileEdit className={cls + " text-chart-2"} />;
    case "ENTITY_DELETED":
      return <FileX className={cls + " text-destructive"} />;
    case "RELATIONSHIP_CREATED":
      return <Link2 className={cls + " text-chart-1"} />;
    case "RELATIONSHIP_DELETED":
      return <Link2Off className={cls + " text-muted-foreground"} />;
    case "EVENT_CREATED":
    case "EVENT_UPDATED":
    case "EVENT_DELETED":
      return <Clock className={cls + " text-chart-2"} />;
    case "NOTE_CREATED":
    case "NOTE_UPDATED":
    case "NOTE_DELETED":
      return <StickyNote className={cls + " text-amber-500"} />;
    case "MEDIA_ADDED":
    case "MEDIA_DELETED":
      return <ImageIcon className={cls + " text-chart-4"} />;
    case "IMPORT_RUN":
      return <Upload className={cls + " text-chart-5"} />;
    case "USER_JOINED":
      return <UserCheck className={cls + " text-emerald-500"} />;
    case "INVITE_SENT":
      return <UserPlus className={cls + " text-chart-1"} />;
    default:
      return <Clock className={cls + " text-muted-foreground"} />;
  }
}

export function ActivityFeed({
  entityType,
  entityId,
  limit = 20,
  defaultOpen = false,
  title = "History",
}: ActivityFeedProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [activities, setActivities] = useState<ActivityRecord[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (entityType) params.set("entityType", entityType);
      if (entityId) params.set("entityId", entityId);
      params.set("limit", String(limit));
      const res = await fetch(`/api/activity?${params}`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities);
      }
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, limit]);

  useEffect(() => {
    if (open && activities === null) load();
  }, [open, activities, load]);

  return (
    <div className="space-y-3 border-t border-border/40 pt-6 print:hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <h3 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Clock className="h-5 w-5 opacity-70 text-muted-foreground" />
          {title}
          {activities && (
            <span className="text-sm font-normal text-muted-foreground">
              ({activities.length})
            </span>
          )}
        </h3>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="pt-2 space-y-2">
          {loading && activities === null && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 rounded-md" />
              ))}
            </div>
          )}
          {activities && activities.length === 0 && (
            <p className="text-sm italic text-muted-foreground">No history recorded.</p>
          )}
          {activities && activities.length > 0 && (
            <ol className="relative space-y-0.5">
              {activities.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted/30"
                >
                  <span className="mt-1 shrink-0">{iconFor(a.type)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-foreground/90">{a.message}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {a.actor?.name || a.actor?.email || "System"} · {relativeTime(a.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {activities && activities.length >= limit && (
            <Button variant="ghost" size="xs" className="w-full" onClick={load}>
              Refresh
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
