import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock3, FileClock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AuthzError, requireSession } from "@/lib/authz";
import { allowedRevisionTypes } from "@/lib/permissions";
import { getUserPermissions } from "@/lib/permission-store";
import { getProperty } from "@/lib/research-store";
import { getRevisionChanges, getRevisionPropertyName, getRevisionVersion, type RevisionSnapshot } from "@/lib/revision-display";
import { RestoreRevision } from "@/components/properties/RestoreRevision";

function formatDate(date: Date) {
  return date.toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: "UTC" }) + " UTC";
}

function displaySnapshot(snapshot: RevisionSnapshot) {
  const value = snapshot && typeof snapshot === "object" ? snapshot as Record<string, unknown> : null;
  return value && "content" in value ? value.content as RevisionSnapshot : snapshot;
}

function actorLabel(value: string | null, isAdmin: boolean) {
  const label = value?.trim();
  if (!label) return "Unassigned actor";
  return !isAdmin && label.includes("@") ? "Family member" : label;
}

export default async function RevisionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let session;
  try {
    session = await requireSession();
  } catch (error) {
    if (error instanceof AuthzError && error.status === 401) redirect("/login");
    throw error;
  }
  const permissions = await getUserPermissions(session.user);
  if (!permissions["history.view"]) notFound();
  const allowedTypes = allowedRevisionTypes(permissions, session.user.role);
  const isAdmin = session.user.role === "ADMIN";
  const revision = await prisma.recordRevision.findUnique({ where: { id } });
  if (!revision) notFound();
  if (allowedTypes && !allowedTypes.includes(revision.entityType)) notFound();

  const isProperty = revision.entityType === "property";

  const before = revision.before as RevisionSnapshot;
  const after = revision.after as RevisionSnapshot;
  const changes = getRevisionChanges(before, after, { fullText: true });
  const fullPropertyFields = isProperty && after ? getRevisionChanges(null, after, { fullText: true }) : [];
  const currentProperty = isProperty ? await getProperty(revision.entityId) : null;
  const propertyName = getRevisionPropertyName(after) ?? currentProperty?.property.name ?? revision.entityId;
  const previousRevision = await prisma.recordRevision.findFirst({
    where: { entityType: revision.entityType, entityId: revision.entityId, sequence: { lt: revision.sequence } },
    orderBy: { sequence: "desc" },
    select: { id: true, after: true },
  });
  const newerRevision = await prisma.recordRevision.findFirst({
    where: { entityType: revision.entityType, entityId: revision.entityId, sequence: { gt: revision.sequence } },
    orderBy: { sequence: "asc" },
    select: { id: true },
  });
  const beforeVersion = getRevisionVersion(before);
  const afterVersion = getRevisionVersion(after);

  return <article className="mx-auto max-w-4xl space-y-6 pb-8">
    <Link href={isProperty ? `/properties/${encodeURIComponent(revision.entityId)}/history` : "/history"} className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
      <ArrowLeft className="size-4" /> Back to {isProperty ? "property history" : "system history"}
    </Link>
    <header className="space-y-3">
      <p className="text-sm text-muted-foreground">{isProperty ? "Family property" : `System record · ${revision.entityType}`} · {revision.operation}</p>
      <h1 className="flex items-center gap-3 break-words text-3xl font-semibold tracking-tight sm:text-4xl"><FileClock className="size-7 shrink-0 text-primary" />{isProperty ? propertyName : revision.entityId}</h1>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-2"><Clock3 className="size-4" />{formatDate(revision.createdAt)}</span>
        {beforeVersion !== null && <span>Version {beforeVersion} → {afterVersion ?? "removed"}</span>}
        <span>Changed by {actorLabel(revision.actorLabel, isAdmin)}</span>
      </div>
      <p className="whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-4 text-sm leading-6">{revision.reason?.trim() || "No reason recorded"}</p>
    </header>

    {changes.length === 0 ? <p className="rounded-xl border p-5 text-sm text-muted-foreground">No field-level differences are available for this snapshot.</p> : <section className="space-y-3" aria-labelledby="changed-fields-heading">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="changed-fields-heading" className="text-xl font-semibold">Changed fields</h2>
        <p className="text-sm text-muted-foreground">{changes.length} change{changes.length === 1 ? "" : "s"}</p>
      </div>
      <div className="space-y-3">
        {changes.map((change) => <section key={change.path} className="min-w-0 rounded-xl border p-4">
          <h3 className="break-words font-medium">{change.label}</h3>
          <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-2">
            <div className="min-w-0 rounded-lg bg-destructive/5 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Before</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{change.before}</p>
            </div>
            <div className="min-w-0 rounded-lg bg-primary/5 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">After</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{change.after}</p>
            </div>
          </div>
        </section>)}
      </div>
    </section>}

    {isProperty && fullPropertyFields.length > 0 && <details className="rounded-xl border p-4 sm:p-5">
      <summary className="flex min-h-11 cursor-pointer items-center py-2 font-semibold">Full saved version <span className="ml-2 text-sm font-normal text-muted-foreground">{fullPropertyFields.length} fields</span></summary>
      <dl className="mt-3 divide-y border-t">
        {fullPropertyFields.map((field) => <div key={field.path} className="grid min-w-0 gap-1 py-3 sm:grid-cols-[minmax(10rem,1fr)_minmax(0,2fr)] sm:gap-4">
          <dt className="break-words text-sm font-medium">{field.label}</dt>
          <dd className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{field.after}</dd>
        </div>)}
      </dl>
    </details>}

    {revision.entityType !== "property" && <section className="grid gap-3 md:grid-cols-2" aria-label="Snapshot details">
      <details className="rounded-xl border p-4">
        <summary className="min-h-11 cursor-pointer py-2 font-medium">Full before snapshot</summary>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-3 text-xs leading-5">{JSON.stringify(displaySnapshot(before), null, 2) ?? "No previous snapshot"}</pre>
      </details>
      <details className="rounded-xl border p-4">
        <summary className="min-h-11 cursor-pointer py-2 font-medium">Full after snapshot</summary>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-3 text-xs leading-5">{JSON.stringify(displaySnapshot(after), null, 2) ?? "No resulting snapshot"}</pre>
      </details>
    </section>}

    <nav className="flex flex-wrap gap-2 border-t pt-5" aria-label="Adjacent revisions">
      {previousRevision && <Link href={`/history/${encodeURIComponent(previousRevision.id)}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm underline underline-offset-4 hover:bg-muted">Older revision <ArrowLeft className="size-4" /></Link>}
      {newerRevision && <Link href={`/history/${encodeURIComponent(newerRevision.id)}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm underline underline-offset-4 hover:bg-muted">Newer revision <ArrowRight className="size-4" /></Link>}
    </nav>

    {isProperty && session.user.role === "ADMIN" && currentProperty && after && <section className="border-t pt-5">
      <RestoreRevision slug={revision.entityId} revisionId={revision.id} currentVersion={currentProperty.version} revisionVersion={afterVersion} />
    </section>}
  </article>;
}
