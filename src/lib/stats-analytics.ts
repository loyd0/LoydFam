/** Small, deterministic calculations shared by the stats route and unit tests. */
export function summarizeValues(values: number[]) {
  const valid = values.filter(Number.isFinite).sort((a, b) => a - b);
  const middle = Math.floor(valid.length / 2);

  return {
    count: valid.length,
    average: valid.length
      ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length)
      : 0,
    median: valid.length
      ? valid.length % 2
        ? valid[middle]
        : Math.round((valid[middle - 1] + valid[middle]) / 2)
      : 0,
  };
}

export function coverage(count: number, total: number) {
  return {
    count,
    pct: total > 0 ? Math.round((count / total) * 100) : 0,
  };
}

/** Returns a count-weighted average and its contributing record count. */
export function weightedMean<T>(rows: T[], value: (row: T) => number, weight: (row: T) => number) {
  const usable = rows.filter((row) => Number.isFinite(value(row)) && weight(row) > 0);
  const count = usable.reduce((sum, row) => sum + weight(row), 0);
  return {
    count,
    average: count
      ? Math.round((usable.reduce((sum, row) => sum + value(row) * weight(row), 0) / count) * 10) / 10
      : 0,
  };
}
