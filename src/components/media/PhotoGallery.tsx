"use client";

import { useState, useTransition, useRef } from "react";
import NextImage from "next/image";
import { upload } from "@vercel/blob/client";
import { ImagePlus, Star, Trash2, Loader2, AlertCircle, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  attachMediaToPerson,
  removeMediaFromPerson,
  setPrimaryMedia,
} from "@/app/(app)/people/media-actions";

interface MediaLinkRecord {
  id: string;
  isPrimary: boolean;
  sortOrder: number;
  media: {
    id: string;
    blobUrl: string;
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

export function PhotoGallery({ personId, mediaLinks, canEdit, onChange }: PhotoGalleryProps) {
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/media/upload",
        contentType: file.type,
      });
      let width: number | undefined;
      let height: number | undefined;
      try {
        const dims = await readImageDimensions(file);
        width = dims.width;
        height = dims.height;
      } catch {}
      await attachMediaToPerson({
        personId,
        blobUrl: blob.url,
        mimeType: file.type,
        fileSize: file.size,
        width,
        height,
      });
      onChange();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(msg.includes("BLOB_READ_WRITE_TOKEN") ? "Photo uploads aren't configured yet (missing Vercel Blob token)." : msg);
    } finally {
      setUploading(false);
    }
  }

  function handleRemove(mediaId: string) {
    if (!confirm("Remove this photo?")) return;
    startTransition(async () => {
      await removeMediaFromPerson(mediaId, personId);
      onChange();
    });
  }

  function handleSetPrimary(mediaId: string) {
    startTransition(async () => {
      await setPrimaryMedia(mediaId, personId);
      onChange();
    });
  }

  const primary = mediaLinks.find((l) => l.isPrimary);
  const rest = mediaLinks.filter((l) => !l.isPrimary);
  const ordered = primary ? [primary, ...rest] : mediaLinks;

  return (
    <div className="space-y-4 border-t border-border/40 pt-6">
      <div className="flex items-center justify-between border-b border-border/40 pb-2">
        <h3 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <ImageIcon className="h-5 w-5 opacity-70 text-muted-foreground" />
          Photos
          <span className="text-sm font-normal text-muted-foreground">
            ({mediaLinks.length})
          </span>
        </h3>
        {canEdit && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <Button
              size="xs"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
              <span className="hidden sm:inline">{uploading ? "Uploading…" : "Add photo"}</span>
            </Button>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {mediaLinks.length === 0 && (
        <p className="text-sm italic text-muted-foreground pt-2">No photos yet.</p>
      )}

      {mediaLinks.length > 0 && (
        <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3 md:grid-cols-4">
          {ordered.map((link) => (
            <figure
              key={link.id}
              className="group relative overflow-hidden rounded-lg border border-border bg-muted/30"
            >
              <div className="aspect-square relative w-full">
                <NextImage
                  src={link.media.blobUrl}
                  alt={link.media.caption ?? "Family photo"}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
                  className="object-cover"
                  unoptimized
                />
              </div>
              {link.isPrimary && (
                <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground shadow-sm">
                  <Star className="h-3 w-3 fill-current" />
                  Primary
                </div>
              )}
              {canEdit && (
                <div className="absolute bottom-0 left-0 right-0 flex items-center gap-1 bg-background/90 p-1.5 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 print:hidden">
                  {!link.isPrimary && (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      className="h-6"
                      onClick={() => handleSetPrimary(link.media.id)}
                      disabled={pending}
                      aria-label="Set as primary"
                      title="Set as primary"
                    >
                      <Star className="h-3 w-3" />
                    </Button>
                  )}
                  <div className="flex-1" />
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="h-6 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemove(link.media.id)}
                    disabled={pending}
                    aria-label="Remove photo"
                    title="Remove"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
