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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PersonPicker } from "@/components/people/PersonPicker";
import { addParent, addPartnership } from "@/app/(app)/people/actions";
import { Loader2 } from "lucide-react";

interface PickedPerson {
  id: string;
  displayName: string;
  gender: string;
}

type Mode = "parent" | "child" | "spouse";

interface Props {
  personId: string;
  mode: Mode;
  excludeIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RelationshipDialog({
  personId,
  mode,
  excludeIds,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState<PickedPerson | null>(null);
  const [type, setType] = useState("MARRIAGE");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!picked) {
      setError("Please select a person");
      return;
    }
    startTransition(async () => {
      try {
        if (mode === "parent") {
          await addParent(personId, picked.id, "BIOLOGICAL");
        } else if (mode === "child") {
          await addParent(picked.id, personId, "BIOLOGICAL");
        } else {
          await addPartnership(personId, picked.id, type as "MARRIAGE" | "PARTNER", notes || undefined);
        }
        setPicked(null);
        setNotes("");
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  const title =
    mode === "parent" ? "Add parent" : mode === "child" ? "Add child" : "Add spouse / partner";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setPicked(null);
          setNotes("");
          setError(null);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Person
            </Label>
            <PersonPicker
              value={picked}
              onChange={setPicked}
              excludeIds={[personId, ...excludeIds]}
              autoFocus
            />
          </div>

          {mode === "spouse" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Relationship
                </Label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="MARRIAGE">Marriage</option>
                  <option value="PARTNER">Partner</option>
                  <option value="UNKNOWN">Unknown</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Notes
                </Label>
                <Textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional (dates, second marriage, etc.)"
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !picked}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Link"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
