import type { ReactNode } from "react";
import { requirePageAnyPermission } from "@/lib/permission-guards";

export default async function PeopleLayout({ children }: { children: ReactNode }) {
  await requirePageAnyPermission(["people.view", "people.edit"]);
  return children;
}
