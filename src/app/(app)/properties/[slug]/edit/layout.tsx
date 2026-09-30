import type { ReactNode } from "react";
import { requirePagePermission } from "@/lib/permission-guards";

export default async function EditPropertyLayout({ children }: { children: ReactNode }) {
  await requirePagePermission("properties.edit");
  return children;
}
