/** Authenticated same-origin route for private media. Never expose a Blob URL to the browser. */
export function mediaUrl(mediaId: string, options?: { download?: boolean }) {
  const url = `/api/media/${encodeURIComponent(mediaId)}`;
  return options?.download ? `${url}?download=1` : url;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
};

export function mediaExtensionMime(extension: string) {
  return MIME_BY_EXTENSION[extension.toLowerCase()] ?? null;
}

export function mediaPathname(personId: string, pathname: string) {
  const escapedPersonId = personId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = pathname.match(new RegExp(`^media/${escapedPersonId}/[0-9a-f-]{36}\\.([a-z0-9]+)$`, "i"));
  return match ? { extension: match[1].toLowerCase(), mimeType: mediaExtensionMime(match[1]) } : null;
}

export function hasMediaSignature(bytes: Uint8Array, mimeType: string) {
  const starts = (...signature: number[]) => signature.every((value, index) => bytes[index] === value);
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.slice(start, start + length));

  switch (mimeType) {
    case "image/jpeg": return starts(0xff, 0xd8, 0xff);
    case "image/png": return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/gif": return ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a";
    case "image/webp": return ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP";
    case "image/heic":
    case "image/heif": return ascii(4, 4) === "ftyp" && ["heic", "heix", "hevc", "mif1", "msf1"].includes(ascii(8, 4));
    case "application/pdf": return ascii(0, 5) === "%PDF-";
    default: return false;
  }
}
