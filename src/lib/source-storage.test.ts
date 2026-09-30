import assert from "node:assert/strict";
import test from "node:test";
import { archiveSourceWorkbook, safeSourceFilename } from "./source-storage";

test("rejects a workbook whose bytes do not match the declared source hash before upload", async () => {
  await assert.rejects(
    archiveSourceWorkbook(Buffer.from("workbook bytes"), "not-the-checksum", "source.xlsx"),
    /checksum does not match/,
  );
});

test("sanitizes archived workbook names to a basename", () => {
  assert.equal(safeSourceFilename("../../family records.xlsx"), "family_records.xlsx");
});
