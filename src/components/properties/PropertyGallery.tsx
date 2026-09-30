"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { ArrowLeft, ArrowRight, Expand } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { PropertyRecord } from "@/lib/properties";
import { PropertyImagePlaceholder } from "./PropertyImagePlaceholder";

type ArchiveImage = PropertyRecord["images"][number];

function Credit({ image }: { image: ArchiveImage }) {
  return <p className="text-xs leading-relaxed text-muted-foreground">{image.caption}{image.dateLabel && ` · ${image.dateLabel}`}<br />{image.credit} · <a href={image.sourceUrl} target="_blank" rel="noreferrer" className="inline-block py-2 underline underline-offset-4">Original image &amp; record</a> · <a href={image.licenseUrl} target="_blank" rel="noreferrer" className="inline-block py-2 underline underline-offset-4">{image.license}</a></p>;
}

export function PropertyGallery({ images: sourceImages, name, title = "In pictures", featured = false }: { images: ArchiveImage[]; name: string; title?: string; featured?: boolean }) {
  const images = [...sourceImages].sort((a, b) => Number(a.kind === "portrait") - Number(b.kind === "portrait"));
  const [selected, setSelected] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const gridId = useId();
  if (!images.length) return featured ? <PropertyImagePlaceholder /> : null;
  const active = selected === null ? null : images[selected];
  const move = (direction: number) => setSelected((current) => current === null ? null : (current + direction + images.length) % images.length);
  return <section className="space-y-4" aria-label={featured ? `Featured photograph of ${name}` : `${title}: ${name}`}>
    {!featured && <h3 className="text-lg font-semibold">{title}</h3>}
    <div id={gridId} className="grid gap-6 sm:grid-cols-2">
      {(featured ? images.slice(0, 1) : expanded ? images : images.slice(0, 5)).map((image, index) => <figure key={image.url} className={index === 0 && image.kind !== "portrait" ? "space-y-2 sm:col-span-2" : "space-y-2"}>
        <button onClick={() => setSelected(index)} className="group relative block w-full overflow-hidden rounded-lg bg-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" aria-label={featured && images.length > 1 ? `View all ${images.length} pictures of ${name}` : `Enlarge: ${image.caption}`}>
          <Image src={image.url} alt={image.caption} width={image.width ?? 1200} height={image.height ?? 800} unoptimized loading={featured && index === 0 ? "eager" : "lazy"} style={{ maxWidth: image.width && image.width < 400 ? image.width * 2 : undefined }} className="mx-auto max-h-[55svh] w-full object-contain" />
          <span className="absolute bottom-3 right-3 flex min-h-11 items-center gap-2 rounded-full bg-background/95 px-3 text-xs shadow-sm"><Expand className="size-4" aria-hidden="true" />{featured && images.length > 1 ? `View all ${images.length} pictures` : "Enlarge"}</span>
        </button>
        <figcaption><Credit image={image} /></figcaption>
      </figure>)}
    </div>
    {!featured && images.length > 5 && <button aria-expanded={expanded} aria-controls={gridId} onClick={() => setExpanded(value => !value)} className="flex min-h-11 w-full items-center justify-center rounded-lg border px-4 py-3 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">{expanded ? "Show fewer pictures" : `Show all ${images.length} pictures`}</button>}
    <Dialog open={active !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
      <DialogContent className="sm:max-w-5xl" onKeyDown={(event) => {
        if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
        if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
      }}>
        <DialogTitle className="pr-12 leading-snug">{name} · {selected === null ? 0 : selected + 1} of {images.length}</DialogTitle>
        <DialogDescription className="sr-only">Image viewer. Use the previous and next buttons or arrow keys to move between images.</DialogDescription>
        {active && <>
          <Image src={active.url} alt={active.caption} width={active.width ?? 1200} height={active.height ?? 800} unoptimized style={{ maxWidth: active.width && active.width < 400 ? active.width * 2 : undefined }} className="mx-auto max-h-[60svh] w-full object-contain" />
          <Credit image={active} />
          {images.length > 1 && <div className="flex justify-between gap-3">
            <button onClick={() => move(-1)} className="flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm"><ArrowLeft className="size-4" />Previous</button>
            <button onClick={() => move(1)} className="flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm">Next<ArrowRight className="size-4" /></button>
          </div>}
        </>}
      </DialogContent>
    </Dialog>
  </section>;
}
