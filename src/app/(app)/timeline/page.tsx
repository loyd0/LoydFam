"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  Baby,
  Skull,
  Church,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";

interface TimelineEvent {
  id: string;
  type: string;
  dateYear: number | null;
  dateMonth: number | null;
  dateDay: number | null;
  dateText: string | null;
  dateIsApprox: boolean;
  people: {
    id: string;
    displayName: string;
    gender: string;
    role: string;
  }[];
}

interface TimelineResponse {
  events: TimelineEvent[];
  total: number;
  page: number;
  totalPages: number;
}

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const EVENT_TYPES = [
  { value: "", label: "All Events" },
  { value: "BIRTH", label: "Births" },
  { value: "DEATH", label: "Deaths" },
  { value: "MARRIAGE", label: "Marriages" },
];

function EventIcon({ type }: { type: string }) {
  switch (type) {
    case "BIRTH":
      return <Baby className="h-4 w-4 text-emerald-500" />;
    case "DEATH":
      return <Skull className="h-4 w-4 text-muted-foreground" />;
    case "MARRIAGE":
      return <Church className="h-4 w-4 text-pink-500" />;
    default:
      return <Calendar className="h-4 w-4 text-chart-2" />;
  }
}

function formatEventDate(event: TimelineEvent): string {
  const parts: string[] = [];
  if (event.dateDay) parts.push(String(event.dateDay));
  if (event.dateMonth) parts.push(MONTH_NAMES[event.dateMonth]);
  if (event.dateYear) parts.push(String(event.dateYear));
  if (parts.length > 0) return parts.join(" ");
  return event.dateText || "Unknown date";
}

export default function TimelinePage() {
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("");

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "40");
      if (typeFilter) params.set("type", typeFilter);

      const res = await fetch(`/api/timeline?${params}`);
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Timeline</h1>
        <p className="mt-1 text-muted-foreground">
          Chronological feed of births, deaths, marriages, and other events.
          {data && (
            <span className="ml-2 font-medium text-foreground">
              {data.total.toLocaleString()} events
            </span>
          )}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {EVENT_TYPES.map((t) => (
          <Button
            key={t.value}
            size="sm"
            variant={typeFilter === t.value ? "default" : "outline"}
            onClick={() => {
              setTypeFilter(t.value);
              setPage(1);
            }}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {/* Event feed */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border/50" />

        <div className="space-y-1">
          {loading && !data
            ? [1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-start gap-4 pl-10 py-3">
                  <Skeleton className="h-12 w-full max-w-md rounded-lg" />
                </div>
              ))
            : data?.events.map((event) => (
                <div key={event.id} className="flex items-start gap-4 group">
                  <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-background bg-card shadow-sm">
                    <EventIcon type={event.type} />
                  </div>
                  <Card className="flex-1 border-border/50 bg-card/80 backdrop-blur group-hover:bg-card/90 transition-colors">
                    <CardContent className="flex items-center gap-3 py-3 px-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="text-[10px] capitalize"
                          >
                            {event.type.toLowerCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatEventDate(event)}
                            {event.dateIsApprox && " (approx.)"}
                          </span>
                        </div>
                        <div className="mt-1">
                          {event.people.map((person) => (
                            <Link
                              key={person.id}
                              href={`/people/${person.id}`}
                              className="text-sm font-medium hover:underline mr-2"
                            >
                              {person.displayName}
                            </Link>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
        </div>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {data.page} of {data.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page >= data.totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {data && data.events.length === 0 && !loading && (
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardContent className="py-10 text-center">
            <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No events yet. Import the workbook to populate the timeline.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
