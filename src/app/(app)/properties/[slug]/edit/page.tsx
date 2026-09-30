import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/authz";
import { getProperty } from "@/lib/research-store";
import { PropertyEditor } from "@/components/properties/PropertyEditor";
export default async function EditProperty({ params }: { params: Promise<{ slug: string }> }) {
  const session = await requirePermission("properties.view");
  const proposal = session.user.role !== "ADMIN";
  const { slug } = await params;
  const record = await getProperty(slug);
  if (!record) notFound();
  return <div className="mx-auto max-w-3xl space-y-6 pb-8"><Link href={`/properties/${slug}`} className="inline-flex min-h-11 items-center text-sm underline">Back to {record.property.name}</Link><h1 className="text-3xl font-semibold">{proposal ? "Suggest changes to" : "Edit"} {record.property.name}</h1><PropertyEditor property={record.property} version={record.version} proposal={proposal} /></div>;
}
