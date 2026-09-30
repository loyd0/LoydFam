import assert from "node:assert/strict";
import test from "node:test";
import { csvCell, gedcomText } from "./export-sanitize";

test("CSV cells neutralize formula starts before quoting", () => {
  assert.equal(csvCell("=1+1"), "'=1+1");
  assert.equal(csvCell("+SUM(1,2)"), `"'+SUM(1,2)"`);
  assert.equal(csvCell("  @cmd"), "'  @cmd");
  assert.equal(csvCell("-1+2"), "'-1+2");
  assert.equal(csvCell("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(csvCell("\t=1"), "'\t=1");
  assert.equal(csvCell("\r=1"), `"'\r=1"`);
  assert.equal(csvCell("\n=1"), `"'\n=1"`);
  assert.equal(csvCell(" \t=1"), "' \t=1");
  assert.equal(csvCell("ordinary, name"), '"ordinary, name"');
});

test("GEDCOM values cannot inject record lines or xrefs", () => {
  assert.equal(gedcomText("Jane\r\n0 @I999@ INDI"), "Jane 0 @@I999@@ INDI");
});
