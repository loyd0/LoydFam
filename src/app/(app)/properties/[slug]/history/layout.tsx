import type { ReactNode } from "react";
import { requirePagePermission } from "@/lib/permission-guards";

export default async function PropertyHistoryLayout({ children }: { children: ReactNode }) {
  await requirePagePermission("history.view");
  await requirePagePermission("properties.view");
  return children;
}
