"use client";

import { useRef, useState, useTransition } from "react";
import NextImage from "next/image";
import { AlertCircle, Download, FileText, Image as ImageIcon, ImagePlus, Loader2, Pencil, Save, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mediaUrl } from "@/lib/media-url";
import {
  attachMediaToPerson,
  removeMediaFromPerson,
  setPrimaryMedia,
  updateMediaCaption,
} from "@/app/(app)/people/media-actions";

interface MediaLinkRecord {
  id: string;
  isPrimary: boolean;
  sortOrder: number;
  media: {
    id: string;
    type: "PHOTO" | "DOCUMENT" | "OTHER";
    mimeType: string | null;
    caption: string | null;
    width: number | null;
    height: number | null;
  };
}

interface PhotoGalleryProps {
  personId: string;
  mediaLinks: MediaLinkRecord[];
  canEdit: boolean;
  onChange: () => void;
}

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

export function PhotoGallery({ personId, mediaLinks, canEdit, onChange }: PhotoGalleryProps) {
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    const extension = EXTENSION_BY_MIME[file.type];
    if (!extension) {
      setError("Choose a JPG, PNG, WebP, GIF, HEIC image, or PDF.");
      return;
    }
    if (file.size <= 0 || file.size > 4 * 1024 * 1024) {
      setError("Files must be smaller than 4 MB.");
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.set("personId", personId);
      form.set("file", file);
      const response = await fetch("/api/media/upload", { method: "POST", body: form });
      const result = await response.json() as { blobKey?: string; error?: string };
      if (!response.ok || !result.blobKey) throw new Error(result.error || "Upload failed");
      let width: number | undefined;
      let height: number | undefined;
      if (file.type.startsWith("image/")) {
        try {
          const dims = await readImageDimensions(file);
          width = dims.width;
          height = dims.height;
        } catch {
          // Image dimensions are optional display metadata.
        }
      }
      await attachMediaToPerson({ personId, blobKey: result.blobKey, width, height });
      onChange();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message.includes("BLOB_READ_WRITE_TOKEN")
        ? "Photo and document uploads are not configured yet."
        : message);
    } finally {
      setUploading(false);
    }
  }

  function handleRemove(mediaId: string) {
    if (!confirm("Remove this media item?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await removeMediaFromPerson(mediaId, personId);
        onChange();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not remove this media item.");
      }
    });
  }

  function handleSetPrimary(mediaId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await setPrimaryMedia(mediaId, personId);
        onChange();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update the primary photo.");
      }
    });
  }

  function beginCaptionEdit(link: MediaLinkRecord) {
    setEditingCaptionId(link.media.id);
    setCaptionDraft(link.media.caption ?? "");
  }

  function saveCaption(mediaId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await updateMediaCaption(mediaId, personId, captionDraft);
        setEditingCaptionId(null);
        onChange();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save caption.");
      }
    });
  }

  const primary = mediaLinks.find((link) => link.isPrimary);
  const ordered = primary ? [primary, ...mediaLinks.filter((link) => !link.isPrimary)] : mediaLinks;

  return (
    <section className="space-y-4 border-t border-border/40 pt-6" aria-label="Photos and documents">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-2">
        <h3 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <ImageIcon className="h-5 w-5 text-muted-foreground opacity-70" />
          Photos &amp; Documents
          <span className="text-sm font-normal text-muted-foreground">({mediaLinks.length})</span>
        </h3>
        {canEdit && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,application/pdf"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                event.target.value = "";
              }}
            />
            <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {uploading ? "Uploading…" : "Add photo or PDF"}
            </Button>
          </>
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {ordered.length === 0 && <p className="pt-2 text-sm italic text-muted-foreground">No photos or documents yet.</p>}

      {ordered.length > 0 && (
        <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3 md:grid-cols-4">
          {ordered.map((link) => {
            const isDocument = link.media.type === "DOCUMENT" || link.media.mimeType === "application/pdf";
            const url = mediaUrl(link.media.id);
            const editing = editingCaptionId === link.media.id;
            return (
              <figure key={link.id} className="overflow-hidden rounded-lg border border-border bg-muted/30">
                {isDocument ? (
                  <a href={url} target="_blank" rel="noreferrer" className="flex aspect-square flex-col items-center justify-center gap-3 p-4 text-center text-muted-foreground hover:bg-muted/70" aria-label="Open PDF in a new tab">
                    <FileText className="h-12 w-12" />
                    <span className="line-clamp-3 text-sm font-medium text-foreground">{link.media.caption || "PDF document"}</span>
                    <span className="flex items-center gap-1 text-xs"><Download className="h-3.5 w-3.5" />Open document</span>
                  </a>
                ) : (
                  <a href={url} target="_blank" rel="noreferrer" className="relative block aspect-square w-full" aria-label={`View ${link.media.caption || "family photo"} full size`}>
                    <NextImage
                      src={url}
                      alt={link.media.caption || "Family photo"}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
                      className="object-cover"
                      unoptimized
                    />
                    {link.isPrimary && <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground shadow-sm"><Star className="h-3 w-3 fill-current" />Primary</span>}
                  </a>
                )}

                {link.isPrimary && isDocument && <div className="px-2 pt-2 text-xs text-muted-foreground">Primary photo</div>}
                <figcaption className="space-y-2 p-2">
                  {editing ? (
                    <div className="space-y-2">
                      <label className="sr-only" htmlFor={`caption-${link.media.id}`}>Caption</label>
                      <input id={`caption-${link.media.id}`} value={captionDraft} maxLength={500} onChange={(event) => setCaptionDraft(event.target.value)} className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" placeholder="Add a caption" />
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-8 flex-1" onClick={() => saveCaption(link.media.id)} disabled={pending}><Save className="h-3.5 w-3.5" />Save</Button>
                        <Button size="icon-sm" variant="ghost" className="h-8 w-8" onClick={() => setEditingCaptionId(null)} aria-label="Cancel caption edit"><X className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-8 items-start justify-between gap-1">
                      <p className="break-words text-xs text-muted-foreground">{link.media.caption || (isDocument ? "PDF document" : "No caption")}</p>
                      {canEdit && <Button size="icon-sm" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => beginCaptionEdit(link)} aria-label="Edit caption"><Pencil className="h-3.5 w-3.5" /></Button>}
                    </div>
                  )}
                  {canEdit && (
                    <div className="flex flex-wrap items-center gap-1 border-t border-border/50 pt-1">
                      {!isDocument && !link.isPrimary && <Button size="sm" variant="ghost" className="h-8" onClick={() => handleSetPrimary(link.media.id)} disabled={pending}><Star className="h-3.5 w-3.5" /><span className="text-xs">Primary</span></Button>}
                      {isDocument && <a className="flex h-8 items-center gap-1 px-2 text-xs text-muted-foreground underline" href={mediaUrl(link.media.id, { download: true })}><Download className="h-3.5 w-3.5" />Download</a>}
                      <Button size="icon-sm" variant="ghost" className="ml-auto h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleRemove(link.media.id)} disabled={pending} aria-label="Remove media item"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}
    </section>
  );
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read image dimensions."));
    };
    image.src = objectUrl;
  });
}
