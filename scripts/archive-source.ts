/** Archive an already imported workbook. Defaults to read-only; pass --execute to upload. */

import { config } from "dotenv";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

config({ path: [resolve(process.cwd(), ".env.local"), resolve(process.cwd(), ".env")] });

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes("--execute");
  const fileArg = args.indexOf("--file");
  const filePath = resolve(process.cwd(), fileArg >= 0 ? args[fileArg + 1] || "" : "POST 2022 LOYD BOOK BOOK DATABASE_6.xlsx");
  const filename = filePath.split(/[\\/]/).pop() || "workbook.xlsx";
  const buffer = Buffer.from(readFileSync(filePath));
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const { prisma } = await import("../src/lib/prisma");
  try {
    const source = await prisma.sourceFile.findUnique({ where: { sha256 }, select: { id: true, blobUrl: true } });
    if (!source) throw new Error("No matching imported source file record exists; nothing was archived");
    if (!execute) {
      console.log(JSON.stringify({ mode: "dry-run", filename, sourceRecordFound: true, alreadyArchived: Boolean(source.blobUrl), bytes: buffer.byteLength }, null, 2));
      return;
    }
    const { archiveSourceWorkbook } = await import("../src/lib/source-storage");
    const blobUrl = await archiveSourceWorkbook(buffer, sha256, filename, source.blobUrl);
    await prisma.sourceFile.update({ where: { id: source.id }, data: { blobUrl } });
    console.log(JSON.stringify({ mode: "archived", filename, sourceRecordFound: true, checksumVerified: true, bytes: buffer.byteLength }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Source archive failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
