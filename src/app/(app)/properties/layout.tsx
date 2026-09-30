import type { ReactNode } from "react";
import { requirePageAnyPermission } from "@/lib/permission-guards";

export default async function PropertiesLayout({ children }: { children: ReactNode }) {
  await requirePageAnyPermission(["properties.view", "properties.edit"]);
  return children;
}
