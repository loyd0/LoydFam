import type { SavedViewScope } from "@/generated/prisma/client";
import type { PermissionKey } from "@/lib/permissions";

export const SCOPE_PERMISSIONS: Record<SavedViewScope, PermissionKey> = {
  PEOPLE: "people.view", STATS: "stats.view", TREE: "tree.view", TIMELINE: "timeline.view",
};
