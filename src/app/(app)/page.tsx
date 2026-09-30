import { redirect } from "next/navigation";
import DashboardContent from "./dashboard-content";
import { requireSession } from "@/lib/authz";
import { getUserPermissions } from "@/lib/permission-store";
import type { PermissionKey, Role } from "@/lib/permissions";

const fallbackPages: Array<[PermissionKey, string]> = [
  ["people.view", "/people"],
  ["tree.view", "/tree"],
  ["mindmap.view", "/mindmap"],
  ["fanChart.view", "/fan-chart"],
  ["map.view", "/map"],
  ["properties.view", "/properties"],
  ["timeline.view", "/timeline"],
  ["stats.view", "/stats"],
  ["generations.view", "/generations"],
  ["relationship.view", "/relationship"],
];

export default async function DashboardPage() {
  const session = await requireSession();
  const user = { id: session.user.id, role: session.user.role as Role };
  const permissions = await getUserPermissions(user);
  if (permissions["dashboard.view"]) return <DashboardContent />;

  for (const [permission, path] of fallbackPages) {
    if (permissions[permission]) redirect(path);
  }
  redirect("/settings");
}
