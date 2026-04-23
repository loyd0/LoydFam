"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addEvent,
  updateEvent,
  deleteEvent,
  type EventInput,
} from "@/app/(app)/people/actions";
import { Loader2, Trash2 } from "lucide-react";

interface ExistingEvent {
  eventId: string;
  type: EventInput["type"];
  dateExact?: string | null;
  dateYear?: number | null;
  dateMonth?: number | null;
  dateDay?: number | null;
  dateText?: string | null;
  dateIsApprox?: boolean;
  description?: string | null;
}

interface Props {
  personId: string;
  existing?: ExistingEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EventDialog({ personId, existing, open, onOpenChange }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<EventInput["type"]>(existing?.type ?? "BIRTH");
  const [dateExact, setDateExact] = useState(
    existing?.dateExact ? existing.dateExact.slice(0, 10) : "",
  );
  const [year, setYear] = useState(existing?.dateYear?.toString() ?? "");
  const [month, setMonth] = useState(existing?.dateMonth?.toString() ?? "");
  const [day, setDay] = useState(existing?.dateDay?.toString() ?? "");
  const [dateText, setDateText] = useState(existing?.dateText ?? "");
  const [isApprox, setIsApprox] = useState(existing?.dateIsApprox ?? false);
  const [description, setDescription] = useState(existing?.description ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: EventInput = {
      type,
      dateExact: dateExact || null,
      dateYear: year ? Number(year) : null,
      dateMonth: month ? Number(month) : null,
      dateDay: day ? Number(day) : null,
      dateText: dateText || null,
      dateIsApprox: isApprox,
      description: description || null,
    };
    startTransition(async () => {
      try {
        if (existing) {
          await updateEvent(existing.eventId, personId, payload);
        } else {
          await addEvent(personId, payload);
        }
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  function handleDelete() {
    if (!existing) return;
    if (!confirm("Delete this event?")) return;
    setError(null);
    startDelete(async () => {
      try {
        await deleteEvent(existing.eventId, personId);
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit event" : "Add event"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Type
            </Label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as EventInput["type"])}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="BIRTH">Birth</option>
              <option value="DEATH">Death</option>
              <option value="MARRIAGE">Marriage</option>
              <option value="RESIDENCE">Residence</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Exact date (if known)
            </Label>
            <Input type="date" value={dateExact} onChange={(e) => setDateExact(e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Year
              </Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="1890"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Month
              </Label>
              <Input
                type="number"
                min={1}
                max={12}
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Day
              </Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Free-text date (e.g. &ldquo;c. 1890&rdquo;)
            </Label>
            <Input value={dateText} onChange={(e) => setDateText(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isApprox}
              onChange={(e) => setIsApprox(e.target.checked)}
            />
            Approximate
          </label>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Description
            </Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            {existing && (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive hover:text-destructive"
                disabled={pending || deleting}
                onClick={handleDelete}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={pending || deleting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || deleting}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
