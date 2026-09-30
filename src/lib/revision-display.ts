export type RevisionSnapshot = Record<string, unknown> | null | undefined;

export interface RevisionChange {
  path: string;
  label: string;
  before: string;
  after: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function compact(value: unknown, maxLength = 280): string {
  if (value === null || value === undefined || value === "") return "—";
  let text: string;
  if (typeof value === "string") text = value;
  else if (typeof value === "number" || typeof value === "boolean") text = String(value);
  else if (Array.isArray(value)) text = value.length ? `${value.length} items` : "No items";
  else if (asRecord(value)) text = "Structured content";
  else text = String(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}

function itemIdentity(item: unknown, index: number): string {
  const record = asRecord(item);
  if (!record) return String(index + 1);
  for (const key of ["id", "slug", "heading", "date", "title", "name", "url"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return String(index + 1);
}

function flatten(value: unknown, path: string, output: Map<string, unknown>, depth = 0) {
  if (depth > 5) {
    output.set(path, compact(value));
    return;
  }
  const record = asRecord(value);
  if (record) {
    const entries = Object.entries(record);
    if (!entries.length) output.set(path, "Empty");
    for (const [key, child] of entries) {
      if (path === "" && ["id", "createdAt", "updatedAt", "slug", "version"].includes(key)) continue;
      flatten(child, path ? `${path}.${key}` : key, output, depth + 1);
    }
    return;
  }
  if (Array.isArray(value)) {
    if (!value.length) output.set(path, "No items");
    value.forEach((item, index) => {
      const identity = itemIdentity(item, index);
      flatten(item, `${path}[${identity} #${index + 1}]`, output, depth + 1);
    });
    return;
  }
  output.set(path, value);
}

function labelFor(path: string): string {
  return path
    .replace(/^content\./, "")
    .replace(/\[([^\]]+)\]/g, " · $1")
    .split(".")
    .map((part) => part.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]/g, " "))
    .join(" › ");
}

export function getRevisionChanges(before: RevisionSnapshot, after: RevisionSnapshot, options: { fullText?: boolean } = {}): RevisionChange[] {
  const beforeRecord = asRecord(before);
  const afterRecord = asRecord(after);
  const beforeContent = beforeRecord && "content" in beforeRecord ? beforeRecord.content : before;
  const afterContent = afterRecord && "content" in afterRecord ? afterRecord.content : after;
  const beforeFields = new Map<string, unknown>();
  const afterFields = new Map<string, unknown>();
  flatten(beforeContent, "", beforeFields);
  flatten(afterContent, "", afterFields);

  const paths = new Set([...beforeFields.keys(), ...afterFields.keys()]);
  const changes: RevisionChange[] = [];
  for (const path of paths) {
    const oldValue = beforeFields.has(path) ? beforeFields.get(path) : undefined;
    const newValue = afterFields.has(path) ? afterFields.get(path) : undefined;
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue;
    changes.push({
      path,
      label: labelFor(path),
      before: compact(oldValue, options.fullText ? 20000 : 280),
      after: compact(newValue, options.fullText ? 20000 : 280),
    });
  }
  return changes;
}

export function getRevisionVersion(snapshot: RevisionSnapshot): number | null {
  const record = asRecord(snapshot);
  return typeof record?.version === "number" ? record.version : null;
}

export function getRevisionPropertyName(snapshot: RevisionSnapshot): string | null {
  const record = asRecord(snapshot);
  const content = asRecord(record?.content);
  return typeof content?.name === "string" ? content.name : null;
}

export function getRevisionSummary(before: RevisionSnapshot, after: RevisionSnapshot, limit = 3): string[] {
  return getRevisionChanges(before, after).slice(0, limit).map((change) => change.label);
}
