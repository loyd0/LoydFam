import assert from "node:assert/strict";
import test from "node:test";
import { coverage, summarizeValues, weightedMean } from "./stats-analytics";

test("summarizeValues handles empty, odd, even, and invalid samples", () => {
  assert.deepEqual(summarizeValues([]), { count: 0, average: 0, median: 0 });
  assert.deepEqual(summarizeValues([3, 1, 2]), { count: 3, average: 2, median: 2 });
  assert.deepEqual(summarizeValues([4, 1, 2, 3]), { count: 4, average: 3, median: 3 });
  assert.deepEqual(summarizeValues([1, Number.NaN, Number.POSITIVE_INFINITY]), {
    count: 1, average: 1, median: 1,
  });
});

test("coverage is based on the full population and handles no records", () => {
  assert.deepEqual(coverage(3, 8), { count: 3, pct: 38 });
  assert.deepEqual(coverage(0, 0), { count: 0, pct: 0 });
});

test("weightedMean respects contributing record counts", () => {
  const result = weightedMean(
    [{ age: 20, count: 1 }, { age: 30, count: 3 }, { age: 90, count: 0 }],
    (row) => row.age,
    (row) => row.count,
  );
  assert.deepEqual(result, { count: 4, average: 27.5 });
  assert.deepEqual(weightedMean([], (row: { n: number }) => row.n, () => 1), {
    count: 0, average: 0,
  });
});
