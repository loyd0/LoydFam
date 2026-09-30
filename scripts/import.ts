/** Shared workbook importer. Usage: npx tsx scripts/import.ts [--dry-run] [--file path.xlsx] */

import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Use the preview connection first when both local env files are present.
config({ path: [resolve(process.cwd(), ".env.local"), resolve(process.cwd(), ".env")] });

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const fileArg = args.indexOf("--file");
  const filePath = resolve(process.cwd(), fileArg >= 0 ? args[fileArg + 1] || "" : "POST 2022 LOYD BOOK BOOK DATABASE_6.xlsx");
  const buffer = Buffer.from(readFileSync(filePath));
  const filename = filePath.split(/[\\/]/).pop() || "workbook.xlsx";
  const { previewImport, runImport } = await import("../src/lib/importer/run-import");

  if (dryRun) {
    const preview = await previewImport(buffer, filename);
    console.log(JSON.stringify({
      dryRun: true,
      filename: preview.filename,
      sha256: preview.sha256,
      alreadyImported: preview.alreadyImported,
      savedSummary: preview.savedSummary,
      sheets: preview.sheets,
      rawRows: preview.rawRows,
      counts: preview.counts,
      existingPeople: preview.existingPeople.length,
      newPeople: preview.newPeople.length,
    }, null, 2));
    return;
  }

  const summary = await runImport(buffer, filename);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("Import failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
