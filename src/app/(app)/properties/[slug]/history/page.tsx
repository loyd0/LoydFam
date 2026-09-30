import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock3, FileClock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getProperty } from "@/lib/research-store";
import { AuthzError, requireSession } from "@/lib/authz";
import { getRevisionChanges, getRevisionVersion, type RevisionSnapshot } from "@/lib/revision-display";

function formatDate(date: Date) {
  return date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
}

export default async function PropertyHistoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let isAdmin = false;
  try {
    isAdmin = (await requireSession()).user.role === "ADMIN";
  } catch (error) {
    if (error instanceof AuthzError && error.status === 401) redirect("/login");
    throw error;
  }

  const record = await getProperty(slug);
  if (!record) notFound();
  const revisions = await prisma.recordRevision.findMany({
    where: { entityType: "property", entityId: slug },
    orderBy: { sequence: "desc" },
  });

  return <div className="mx-auto max-w-4xl space-y-6 pb-8">
    <Link href={`/properties/${encodeURIComponent(slug)}`} className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
      <ArrowLeft className="size-4" /> Back to {record.property.name}
    </Link>
    <header className="space-y-2">
      <p className="text-sm text-muted-foreground">Family properties · Version {record.version}</p>
      <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl"><FileClock className="size-7 text-primary" /> Edit history</h1>
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Recorded edits to {record.property.name}, including who made the change and why.</p>
    </header>
    <aside className="rounded-xl border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
      This history begins when version tracking was introduced. The published account is the starting baseline; earlier edits were not recorded.
    </aside>

    {revisions.length === 0 ? <section className="rounded-xl border p-6">
      <h2 className="font-semibold">No edits recorded yet</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">The current account is available as the baseline. An initial history entry is created with its first tracked edit.</p>
    </section> : <ol className="space-y-3">
      {revisions.map((revision) => {
        const before = revision.before as RevisionSnapshot;
        const after = revision.after as RevisionSnapshot;
        const changes = getRevisionChanges(before, after);
        const version = getRevisionVersion(after);
        const label = revision.actorLabel?.trim() || "Unassigned actor";
        const actor = !isAdmin && label.includes("@") ? "Family member" : label;
        return <li key={revision.id} className="rounded-xl border p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="font-semibold">{version ? `Version ${version}` : "Recorded revision"}</h2>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{revision.operation}</span>
              </div>
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="size-4 shrink-0" />{formatDate(revision.createdAt)}</p>
              <p className="text-sm">{actor}</p>
            </div>
            <Link href={`/history/${encodeURIComponent(revision.id)}`} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border px-4 text-sm font-medium underline underline-offset-4 hover:bg-muted">View comparison</Link>
          </div>
          <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Changed fields</p><p className="mt-1 text-sm">{changes.length ? `${changes.length} field${changes.length === 1 ? "" : "s"}` : "Snapshot recorded"}</p></div>
            <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reason</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{revision.reason?.trim() || "No reason recorded"}</p></div>
          </div>
          {!!changes.length && <ul className="mt-3 flex flex-wrap gap-2" aria-label="Fields changed">
            {changes.slice(0, 5).map((change) => <li key={change.path} className="max-w-full truncate rounded-full bg-primary/5 px-3 py-1 text-xs text-primary">{change.label}</li>)}
            {changes.length > 5 && <li className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">+{changes.length - 5} more</li>}
          </ul>}
        </li>;
      })}
    </ol>}
  </div>;
}
