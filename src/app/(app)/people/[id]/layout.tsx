import type { ReactNode } from "react";
import { requirePagePermission } from "@/lib/permission-guards";

export default async function PersonProfileLayout({ children }: { children: ReactNode }) {
  await requirePagePermission("people.view");
  return children;
}
