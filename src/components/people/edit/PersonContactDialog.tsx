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
import { upsertContact, type ContactPatch } from "@/app/(app)/people/actions";
import { Loader2 } from "lucide-react";

interface Props {
  personId: string;
  initial: ContactPatch;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PersonContactDialog({ personId, initial, open, onOpenChange }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [emailsStr, setEmailsStr] = useState((initial.emails ?? []).join(", "));
  const [mobile, setMobile] = useState(initial.mobile ?? "");
  const [landline, setLandline] = useState(initial.landline ?? "");
  const [address2000, setAddress2000] = useState(initial.address2000 ?? "");
  const [postalAddress2021, setPostalAddress2021] = useState(initial.postalAddress2021 ?? "");
  const [comments, setComments] = useState(initial.comments ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await upsertContact(personId, {
          emails: emailsStr
            .split(/[,;\n]/)
            .map((s) => s.trim())
            .filter(Boolean),
          mobile: mobile || null,
          landline: landline || null,
          address2000: address2000 || null,
          postalAddress2021: postalAddress2021 || null,
          comments: comments || null,
        });
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit contact details</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Emails (separate with commas)
            </Label>
            <Input
              value={emailsStr}
              onChange={(e) => setEmailsStr(e.target.value)}
              placeholder="one@example.com, two@example.com"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Mobile
              </Label>
              <Input value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Landline
              </Label>
              <Input value={landline} onChange={(e) => setLandline(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Current postal address
            </Label>
            <Textarea
              rows={2}
              value={postalAddress2021}
              onChange={(e) => setPostalAddress2021(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Historical address (circa 2000)
            </Label>
            <Textarea
              rows={2}
              value={address2000}
              onChange={(e) => setAddress2000(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Comments
            </Label>
            <Textarea
              rows={2}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
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
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
