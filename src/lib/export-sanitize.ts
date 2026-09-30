/** Prevent a spreadsheet from evaluating user-supplied text as a formula. */
export function csvCell(value: string): string {
  const safe = /^[\t\r\n]/.test(value) || /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

/** Keep user-supplied GEDCOM values on one record line and escape xref markers. */
export function gedcomText(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/@/g, "@@");
}
