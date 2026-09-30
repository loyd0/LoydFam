import { ImageIcon } from "lucide-react";

export function PropertyImagePlaceholder() {
  return <div className="flex aspect-[8/5] w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 px-6 text-center text-muted-foreground">
    <ImageIcon className="size-8 opacity-60" strokeWidth={1.25} aria-hidden="true" />
    <p className="text-sm">No photographs available</p>
  </div>;
}
