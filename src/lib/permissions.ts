/** Stable capability names used by the server and the permissions UI. */
export const PERMISSION_KEYS = [
  "dashboard.view", "people.view", "tree.view", "map.view", "properties.view",
  "mindmap.view", "timeline.view", "stats.view", "generations.view",
  "fanChart.view", "relationship.view", "people.edit", "properties.edit",
  "media.upload", "notes.edit", "sources.download", "history.view",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];
export type PermissionMap = Record<PermissionKey, boolean>;
export type PermissionOverrides = Partial<Record<PermissionKey, "allow" | "deny">>;
export type Role = "ADMIN" | "VIEWER";

export const DEFAULT_PERMISSIONS: PermissionMap = {
  "dashboard.view": true,
  "people.view": true,
  "tree.view": true,
  "map.view": true,
  "properties.view": true,
  "mindmap.view": true,
  "timeline.view": true,
  "stats.view": true,
  "generations.view": true,
  "fanChart.view": true,
  "relationship.view": true,
  "people.edit": false,
  "properties.edit": false,
  "media.upload": false,
  "notes.edit": false,
  "sources.download": false,
  "history.view": false,
};

const VIEW_DEPENDENCIES: Partial<Record<PermissionKey, PermissionKey>> = {
  "people.edit": "people.view",
  "properties.edit": "properties.view",
  "media.upload": "people.view",
  "notes.edit": "people.view",
};

const keys = new Set<string>(PERMISSION_KEYS);
export function isPermissionKey(value: string): value is PermissionKey {
  return keys.has(value);
}

export function normalizeDefaults(value: unknown): PermissionMap {
  const result = { ...DEFAULT_PERMISSIONS };
  if (isPlainObject(value)) {
    for (const key of PERMISSION_KEYS) {
      if (typeof value[key] === "boolean") result[key] = value[key];
    }
  }
  return result;
}

export function normalizeOverrides(value: unknown): PermissionOverrides {
  const result: PermissionOverrides = {};
  if (isPlainObject(value)) {
    for (const key of PERMISSION_KEYS) {
      if (value[key] === "allow" || value[key] === "deny") result[key] = value[key];
    }
  }
  return result;
}

export function resolvePermissions(
  defaults: Partial<PermissionMap> | unknown,
  overrides: PermissionOverrides | unknown,
  role: Role,
): PermissionMap {
  if (role === "ADMIN") return Object.fromEntries(PERMISSION_KEYS.map((key) => [key, true])) as PermissionMap;
  const resolved = normalizeDefaults(defaults);
  const individual = normalizeOverrides(overrides);
  for (const key of PERMISSION_KEYS) {
    if (individual[key] === "allow") resolved[key] = true;
    if (individual[key] === "deny") resolved[key] = false;
  }
  for (const [key, dependency] of Object.entries(VIEW_DEPENDENCIES) as [PermissionKey, PermissionKey][]) {
    if (!resolved[dependency]) resolved[key] = false;
  }
  return resolved;
}

/** Revision entity types visible in system history for the effective section access. */
export function allowedRevisionTypes(permissions: PermissionMap, role: Role): string[] | null {
  if (role === "ADMIN") return null; // no type restriction
  const allowed: string[] = [];
  if (permissions["properties.view"]) allowed.push("property");
  if (permissions["people.view"]) {
    allowed.push("person", "alias", "attribute", "event", "person_event", "parent_child", "partnership", "tag", "tag_link", "note", "media", "media_link");
  }
  if (permissions["map.view"]) allowed.push("place", "person_place");
  return allowed;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseDefaultPatch(value: unknown): Partial<PermissionMap> | null {
  if (!isPlainObject(value) || !Object.keys(value).length) return null;
  const result: Partial<PermissionMap> = {};
  for (const [key, setting] of Object.entries(value)) {
    if (!isPermissionKey(key) || typeof setting !== "boolean") return null;
    result[key] = setting;
  }
  return result;
}

export function parseOverridePatch(value: unknown): Partial<Record<PermissionKey, "allow" | "deny" | "inherit">> | null {
  if (!isPlainObject(value) || !Object.keys(value).length) return null;
  const result: Partial<Record<PermissionKey, "allow" | "deny" | "inherit">> = {};
  for (const [key, setting] of Object.entries(value)) {
    if (!isPermissionKey(key) || (setting !== "allow" && setting !== "deny" && setting !== "inherit")) return null;
    result[key] = setting;
  }
  return result;
}
