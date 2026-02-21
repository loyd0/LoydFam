import * as XLSX from "xlsx";
import { createHash } from "crypto";

export interface SheetData {
  sheetName: string;
  headers: string[];
  rows: Record<string, unknown>[];
}

export interface ParsedWorkbook {
  sha256: string;
  sheets: SheetData[];
}

/**
 * Parse an xlsx buffer into a structured representation of every sheet.
 * Returns all sheets (raw data preserved) plus a sha256 of the file.
 */
export function parseWorkbook(buffer: Buffer): ParsedWorkbook {
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const wb = XLSX.read(buffer, { type: "buffer" });

  const sheets: SheetData[] = wb.SheetNames.map((sheetName) => {
    const ws = wb.Sheets[sheetName];

    // Get raw array-of-arrays for headers
    const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
    const headerRow = (raw[0] as unknown[]) || [];
    const headers = headerRow.map((h) => (h != null ? String(h) : ""));

    // Get rows as key-value objects
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: null,
    });

    return { sheetName, headers, rows };
  });

  return { sha256, sheets };
}

/**
 * Compute a hash of a row's JSON for diffing between imports.
 */
export function hashRow(row: Record<string, unknown>): string {
  const sorted = JSON.stringify(row, Object.keys(row).sort());
  return createHash("sha256").update(sorted).digest("hex");
}
