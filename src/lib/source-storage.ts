import { createHash } from "node:crypto";
import { get, put } from "@vercel/blob";

const WORKBOOK_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function safeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() || "workbook.xlsx";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "workbook.xlsx";
}

function sourcePath(sha: string, filename: string): string {
  return `family-source-workbooks/${sha}/${safeFilename(filename)}`;
}

async function streamBuffer(stream: ReadableStream<Uint8Array> | null): Promise<Buffer> {
  if (!stream) throw new Error("Archived workbook has no content stream");
  return Buffer.from(await new Response(stream).arrayBuffer());
}

/** Uploads an original workbook to private Blob storage and verifies its exact bytes. */
export async function archiveSourceWorkbook(buffer: Buffer, expectedSha: string, filename: string, existingUrl?: string | null): Promise<string> {
  const actualSha = sha256(buffer);
  if (actualSha !== expectedSha) throw new Error("Workbook checksum does not match the expected source hash");

  const pathname = sourcePath(expectedSha, filename);
  const existing = await get(existingUrl || pathname, { access: "private" });
  if (existing?.statusCode === 200) {
    const existingBytes = await streamBuffer(existing.stream);
    if (sha256(existingBytes) !== expectedSha) throw new Error("Archived workbook checksum does not match its source hash");
    return existing.blob.url;
  }

  const uploaded = await put(pathname, buffer, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: WORKBOOK_CONTENT_TYPE,
  });
  const verified = await get(uploaded.url, { access: "private" });
  if (!verified || verified.statusCode !== 200) throw new Error("Uploaded workbook could not be read back for verification");
  const uploadedBytes = await streamBuffer(verified.stream);
  if (sha256(uploadedBytes) !== expectedSha) throw new Error("Uploaded workbook checksum does not match its source hash");
  return uploaded.url;
}

/** Reads and checksum-verifies a private source workbook before serving it. */
export async function readArchivedSourceWorkbook(url: string, expectedSha: string): Promise<Buffer> {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error("Invalid archived workbook reference"); }
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".private.blob.vercel-storage.com")) {
    throw new Error("Archived workbook reference is not a private Vercel Blob URL");
  }
  const result = await get(url, { access: "private" });
  if (!result || result.statusCode !== 200) throw new Error("Archived workbook is unavailable");
  const bytes = await streamBuffer(result.stream);
  if (sha256(bytes) !== expectedSha) throw new Error("Archived workbook checksum does not match its source hash");
  return bytes;
}

export { safeFilename as safeSourceFilename };
