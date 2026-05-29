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
import { Textarea } from "@/components/ui/textarea";
import { updatePerson, type PersonPatch } from "@/app/(app)/people/actions";
import { Loader2 } from "lucide-react";

interface Props {
  personId: string;
  initial: PersonPatch;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PersonIdentityDialog({ personId, initial, open, onOpenChange }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<PersonPatch>(initial);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof PersonPatch>(key: K, value: PersonPatch[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await updatePerson(personId, form);
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit identity & biography</DialogTitle>
          <DialogDescription>Update names, gender, and life narrative.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Surname">
              <Input
                value={form.surname ?? ""}
                onChange={(e) => update("surname", e.target.value)}
              />
            </Field>
            <Field label="Known as">
              <Input
                value={form.knownAs ?? ""}
                onChange={(e) => update("knownAs", e.target.value)}
              />
            </Field>
            <Field label="First name">
              <Input
                value={form.givenName1 ?? ""}
                onChange={(e) => update("givenName1", e.target.value)}
              />
            </Field>
            <Field label="Middle name">
              <Input
                value={form.givenName2 ?? ""}
                onChange={(e) => update("givenName2", e.target.value)}
              />
            </Field>
            <Field label="Third name">
              <Input
                value={form.givenName3 ?? ""}
                onChange={(e) => update("givenName3", e.target.value)}
              />
            </Field>
            <Field label="Preferred name">
              <Input
                value={form.preferredName ?? ""}
                onChange={(e) => update("preferredName", e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Gender">
              <select
                value={form.gender ?? "UNKNOWN"}
                onChange={(e) => update("gender", e.target.value as PersonPatch["gender"])}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="UNKNOWN">Unknown</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </Field>
            <Field label="Generation (legacy)">
              <Input
                type="number"
                value={form.legacyGeneration ?? ""}
                onChange={(e) =>
                  update(
                    "legacyGeneration",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
              />
            </Field>
            <Field label="Gen. from William">
              <Input
                type="number"
                value={form.generationFromWilliam ?? ""}
                onChange={(e) =>
                  update(
                    "generationFromWilliam",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
              />
            </Field>
          </div>

          <Field label="Countries lived in">
            <Input
              value={form.residencyText ?? ""}
              onChange={(e) => update("residencyText", e.target.value)}
              placeholder="UK, Australia, …"
            />
          </Field>

          <Field label="Short biography">
            <Textarea
              rows={3}
              value={form.biographyShortMd ?? ""}
              onChange={(e) => update("biographyShortMd", e.target.value)}
              placeholder="One-line summary"
            />
          </Field>

          <Field label="Full biography">
            <Textarea
              rows={6}
              value={form.biographyMd ?? ""}
              onChange={(e) => update("biographyMd", e.target.value)}
            />
          </Field>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
