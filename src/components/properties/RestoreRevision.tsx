"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { restoreProperty } from "@/app/(app)/properties/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function RestoreRevision({
  slug,
  revisionId,
  currentVersion,
  revisionVersion,
}: {
  slug: string;
  revisionId: string;
  currentVersion: number;
  revisionVersion: number | null;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError("");
    startTransition(async () => {
      try {
        const result = await restoreProperty(slug, revisionId, currentVersion, reason);
        if (result.error) {
          setError(result.error);
          return;
        }
        router.push(`/properties/${encodeURIComponent(slug)}/history`);
        router.refresh();
      } catch {
        setError("The request failed or could not be confirmed. Refresh the history before trying again.");
      }
    });
  }

  if (!confirming) {
    return <Button type="button" variant="outline" className="min-h-11" onClick={() => setConfirming(true)}>
      <RotateCcw className="size-4" /> Restore this version
    </Button>;
  }

  return <div className="w-full space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 sm:max-w-xl">
    <div>
      <h3 className="font-semibold">Restore this account version?</h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        This saves the selected snapshot as a new version{revisionVersion ? ` based on version ${revisionVersion}` : ""}. The current account remains in the history.
      </p>
    </div>
    <label className="block space-y-2 text-sm font-medium" htmlFor={`restore-reason-${revisionId}`}>
      Reason for restoring
      <Textarea
        id={`restore-reason-${revisionId}`}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="For example, restore the previous source-supported wording."
        className="text-base"
      />
    </label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <Button type="button" className="min-h-11" disabled={isPending || !reason.trim()} onClick={submit}>
        {isPending ? "Restoring…" : "Confirm restore"}
      </Button>
      <Button type="button" variant="ghost" className="min-h-11" disabled={isPending} onClick={() => { setConfirming(false); setError(""); }}>
        Cancel
      </Button>
    </div>
  </div>;
}
