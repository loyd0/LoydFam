import { requirePagePermission } from "@/lib/permission-guards";

export default async function NewPersonLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission("people.edit");
  return children;
}
