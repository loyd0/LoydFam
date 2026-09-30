import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import Module from "node:module";
import test, { after, mock } from "node:test";

const bytes = Buffer.from("archived workbook bytes");
const checksum = createHash("sha256").update(bytes).digest("hex");
const getCalls: string[] = [];
const originalLoad = (Module as typeof Module & { _load: (...args: unknown[]) => unknown })._load;
const loader = mock.method(Module as typeof Module & { _load: (...args: unknown[]) => unknown }, "_load", function (this: unknown, request: string, ...rest: unknown[]) {
  if (request === "@vercel/blob") return {
    get: async (url: string) => {
      getCalls.push(url);
      return { statusCode: 200, stream: new Blob([bytes]).stream() };
    },
    put: async () => { throw new Error("Unexpected upload"); },
  };
  return originalLoad.call(this, request, ...rest);
});
after(() => loader.mock.restore());
const sourceStorage = import("./source-storage");

test("rejects a workbook whose bytes do not match the declared source hash before upload", async () => {
  const { archiveSourceWorkbook } = await sourceStorage;
  await assert.rejects(archiveSourceWorkbook(Buffer.from("workbook bytes"), "not-the-checksum", "source.xlsx"), /checksum does not match/);
});

test("sanitizes archived workbook names to a basename", async () => {
  const { safeSourceFilename } = await sourceStorage;
  assert.equal(safeSourceFilename("../../family records.xlsx"), "family_records.xlsx");
});

test("rejects non-private workbook URLs before fetching", async () => {
  const { readArchivedSourceWorkbook } = await sourceStorage;
  getCalls.length = 0;
  for (const url of [
    "http://archive.private.blob.vercel-storage.com/source.xlsx",
    "https://archive.blob.vercel-storage.com/source.xlsx",
    "https://archive.private.blob.vercel-storage.com.evil.example/source.xlsx",
  ]) await assert.rejects(readArchivedSourceWorkbook(url, checksum), /not a private Vercel Blob URL/);
  assert.equal(getCalls.length, 0);
});

test("reads and verifies a private workbook URL", async () => {
  const { readArchivedSourceWorkbook } = await sourceStorage;
  getCalls.length = 0;
  const url = "https://archive.private.blob.vercel-storage.com/source.xlsx";
  assert.deepEqual(await readArchivedSourceWorkbook(url, checksum), bytes);
  assert.deepEqual(getCalls, [url]);
});
