import type { ReactNode } from "react";
import { requirePagePermission } from "@/lib/permission-guards";

export default async function PermissionLayout({ children }: { children: ReactNode }) {
  await requirePagePermission("mindmap.view");
  return children;
}
