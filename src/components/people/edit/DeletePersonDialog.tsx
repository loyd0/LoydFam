"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deletePerson } from "@/app/(app)/people/actions";
import { AlertTriangle, Loader2 } from "lucide-react";

interface Props {
  personId: string;
  personName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeletePersonDialog({ personId, personName, open, onOpenChange }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const disabled = pending || confirm.trim() !== personName;

  function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await deletePerson(personId);
        onOpenChange(false);
        router.push("/people");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete {personName}?
          </DialogTitle>
          <DialogDescription>
            This permanently removes the person, their relationships, contact, and all linked
            events. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleDelete} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Type{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                {personName}
              </code>{" "}
              to confirm
            </Label>
            <Input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
              autoFocus
            />
          </div>

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
            <Button type="submit" variant="destructive" disabled={disabled}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete permanently"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
