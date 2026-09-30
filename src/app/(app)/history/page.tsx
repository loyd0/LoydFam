import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowLeft, ArrowRight, FileClock, Search, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AuthzError, requireSession } from "@/lib/authz";
import { allowedRevisionTypes } from "@/lib/permissions";
import { getUserPermissions } from "@/lib/permission-store";
import { getRevisionPropertyName, getRevisionSummary, getRevisionVersion, type RevisionSnapshot } from "@/lib/revision-display";
import { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 25;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function validDate(value: string, end = false): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function dateLabel(date: Date) {
  return date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
}

function actorLabel(value: string | null, isAdmin: boolean) {
  const label = value?.trim();
  if (!label) return "Unassigned actor";
  return !isAdmin && label.includes("@") ? "Family member" : label;
}

function queryHref(params: Record<string, string>, page: number) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) next.set(key, value);
  if (page > 1) next.set("page", String(page));
  const query = next.toString();
  return `/history${query ? `?${query}` : ""}`;
}

function FilterForm({
  tab, q, entity, actor, from, to,
}: { tab: string; q: string; entity: string; actor: string; from: string; to: string }) {
  return <form action="/history" method="get" className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6">
    <input type="hidden" name="tab" value={tab} />
    <label className="space-y-1.5 text-sm font-medium sm:col-span-2 lg:col-span-2">Search
      <span className="relative block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input name="q" defaultValue={q} placeholder="ID, operation, reason…" className="h-11 w-full rounded-lg border bg-background pl-9 pr-3 text-base" /></span>
    </label>
    <label className="space-y-1.5 text-sm font-medium">Entity type
      <input name="entity" defaultValue={entity} placeholder="person, property…" className="h-11 w-full rounded-lg border bg-background px-3 text-base" />
    </label>
    <label className="space-y-1.5 text-sm font-medium">Actor
      <input name="actor" defaultValue={actor} placeholder="Name or email" className="h-11 w-full rounded-lg border bg-background px-3 text-base" />
    </label>
    <label className="space-y-1.5 text-sm font-medium">From
      <input type="date" name="from" defaultValue={from} className="h-11 w-full rounded-lg border bg-background px-3 text-base" />
    </label>
    <label className="space-y-1.5 text-sm font-medium">To
      <input type="date" name="to" defaultValue={to} className="h-11 w-full rounded-lg border bg-background px-3 text-base" />
    </label>
    <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-6">
      <button className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 font-medium text-primary-foreground hover:opacity-90" type="submit">Apply filters</button>
      <Link href={`/history?tab=${tab}`} className="inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm hover:bg-muted">Clear</Link>
    </div>
  </form>;
}

function Pager({ page, pages, params }: { page: number; pages: number; params: Record<string, string> }) {
  if (pages <= 1) return null;
  return <nav className="flex items-center justify-between gap-3" aria-label="History pages">
    <p className="text-sm text-muted-foreground">Page {page} of {pages}</p>
    <div className="flex gap-2">
      {page > 1 ? <Link href={queryHref(params, page - 1)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm hover:bg-muted"><ArrowLeft className="size-4" />Previous</Link> : <span className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm text-muted-foreground/60"><ArrowLeft className="size-4" />Previous</span>}
      {page < pages ? <Link href={queryHref(params, page + 1)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm hover:bg-muted">Next<ArrowRight className="size-4" /></Link> : <span className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm text-muted-foreground/60">Next<ArrowRight className="size-4" /></span>}
    </div>
  </nav>;
}

export default async function HistoryPage({ searchParams }: { searchParams: SearchParams }) {
  let session;
  try {
    session = await requireSession();
  } catch (error) {
    if (error instanceof AuthzError && error.status === 401) redirect("/login");
    throw error;
  }
  const isAdmin = session.user.role === "ADMIN";
  const permissions = await getUserPermissions(session.user);
  if (!permissions["history.view"]) {
    return <section className="mx-auto max-w-2xl rounded-xl border p-6 sm:p-8">
      <h1 className="flex items-center gap-3 text-2xl font-semibold"><ShieldCheck className="size-6 text-primary" />History access unavailable</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Ask an administrator to grant access to record history.</p>
      <Link href="/" className="mt-4 inline-flex min-h-11 items-center underline underline-offset-4">Return to your available section</Link>
    </section>;
  }

  const raw = await searchParams;
  const tab = first(raw.tab) === "activity" ? "activity" : "revisions";
  const q = first(raw.q).trim().slice(0, 200);
  const entity = first(raw.entity).trim().slice(0, 100);
  const actor = first(raw.actor).trim().slice(0, 100);
  const from = first(raw.from);
  const to = first(raw.to);
  const requestedPage = Number.parseInt(first(raw.page), 10);
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
  const whereDate = { ...(validDate(from) ? { gte: validDate(from) } : {}), ...(validDate(to, true) ? { lte: validDate(to, true) } : {}) };
  const dateFilter = Object.keys(whereDate).length ? { createdAt: whereDate } : {};
  const filterParams = { tab, q, entity, actor, from, to };
  const allowedTypes = allowedRevisionTypes(permissions, session.user.role);

  if (tab === "activity") {
    const where: Prisma.ActivityWhereInput = {
      ...dateFilter,
      AND: [
        ...(entity ? [{ entityType: { contains: entity, mode: "insensitive" as const } }] : []),
        ...(allowedTypes ? [{ entityType: { in: allowedTypes } }] : []),
      ],
      ...(actor ? { actor: { is: isAdmin
        ? { OR: [{ name: { contains: actor, mode: "insensitive" } }, { email: { contains: actor, mode: "insensitive" } }] }
        : { name: { contains: actor, mode: "insensitive" } } } } : {}),
      ...(q ? { OR: [{ message: { contains: q, mode: "insensitive" } }, { entityId: { contains: q, mode: "insensitive" } },] } : {}),
    };
    const total = await prisma.activity.count({ where });
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const currentPage = Math.min(page, pages);
    const rows = await prisma.activity.findMany({ where, include: { actor: { select: isAdmin ? { name: true, email: true } : { name: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (currentPage - 1) * PAGE_SIZE, take: PAGE_SIZE });
    return <div className="mx-auto max-w-5xl space-y-6 pb-8">
      <HistoryHeader tab={tab} total={total} />
      <HistoryTabs tab={tab} />
      <aside className="rounded-xl border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">The Activity feed includes changes to sections you can view. Account, security and import details remain available only to administrators.</aside>
      <FilterForm {...filterParams} />
      <Pager page={currentPage} pages={pages} params={filterParams} />
      {rows.length === 0 ? <EmptyState /> : <ol className="space-y-3">
        {rows.map((row) => {
          const actorEmail = isAdmin && row.actor && "email" in row.actor && typeof row.actor.email === "string" ? row.actor.email : null;
          return <li key={row.id} className="rounded-xl border p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1"><p className="flex flex-wrap items-center gap-2 font-semibold"><span className="rounded-full bg-muted px-2.5 py-1 text-xs">{row.type}</span>{row.entityType && <span className="text-sm font-normal text-muted-foreground">{row.entityType}{row.entityId ? ` · ${row.entityId}` : ""}</span>}</p><p className="text-sm leading-6">{row.message}</p></div>
            <time className="shrink-0 text-sm text-muted-foreground">{dateLabel(row.createdAt)}</time>
          </div>
          <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">{row.actor?.name || actorEmail || "Unassigned actor"}{row.actor?.name && actorEmail ? ` · ${actorEmail}` : ""}</p>
        </li>;})}
      </ol>}
      <Pager page={currentPage} pages={pages} params={filterParams} />
    </div>;
  }

  const where: Prisma.RecordRevisionWhereInput = {
    ...dateFilter,
    AND: [
      ...(entity ? [{ entityType: { contains: entity, mode: "insensitive" as const } }] : []),
      ...(allowedTypes ? [{ entityType: { in: allowedTypes } }] : []),
      ...(q ? [{ OR: [{ entityId: { contains: q, mode: "insensitive" as const } }, { operation: { contains: q, mode: "insensitive" as const } }, { reason: { contains: q, mode: "insensitive" as const } }, { actorLabel: { contains: q, mode: "insensitive" as const } }] }] : []),
    ],
    ...(actor ? { OR: isAdmin
      ? [{ actorLabel: { contains: actor, mode: "insensitive" as const } }, { actorUserId: { contains: actor, mode: "insensitive" as const } }]
      : [{ actorLabel: { contains: actor, mode: "insensitive" as const } }] } : {}),
  };
  const total = await prisma.recordRevision.count({ where });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const rows = await prisma.recordRevision.findMany({ where, orderBy: { sequence: "desc" }, skip: (currentPage - 1) * PAGE_SIZE, take: PAGE_SIZE });
  return <div className="mx-auto max-w-5xl space-y-6 pb-8">
    <HistoryHeader tab={tab} total={total} />
    <HistoryTabs tab={tab} />
    <aside className="rounded-xl border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">This log records changes from the start of database revision tracking. The Activity feed is kept separately and also includes account, media, and import events.</aside>
    <FilterForm {...filterParams} />
    <Pager page={currentPage} pages={pages} params={filterParams} />
    {rows.length === 0 ? <EmptyState /> : <ol className="space-y-3">
      {rows.map((row) => {
        const before = row.before as RevisionSnapshot;
        const after = row.after as RevisionSnapshot;
        const version = getRevisionVersion(after);
        const name = row.entityType === "property" ? getRevisionPropertyName(after) : null;
        const summary = getRevisionSummary(before, after, 4);
        return <li key={row.id} className="rounded-xl border p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{row.entityType}</span><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{row.operation}</span>{version !== null && <span className="text-xs text-muted-foreground">Version {version}</span>}</div>
              <h2 className="break-words font-semibold">{name ? `${name} · ` : ""}{row.entityId}</h2>
              <p className="text-sm text-muted-foreground">{actorLabel(row.actorLabel, isAdmin)} · {dateLabel(row.createdAt)}</p>
              <p className="break-words text-sm leading-6">{row.reason?.trim() || "No reason recorded"}</p>
              {summary.length > 0 && <p className="text-xs leading-5 text-muted-foreground">Changed: {summary.join(" · ")}</p>}
            </div>
            <Link href={`/history/${encodeURIComponent(row.id)}`} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border px-4 text-sm font-medium underline underline-offset-4 hover:bg-muted">View comparison</Link>
          </div>
        </li>;
      })}
    </ol>}
    <Pager page={currentPage} pages={pages} params={filterParams} />
  </div>;
}

function HistoryHeader({ tab, total }: { tab: string; total: number }) {
  const Icon = tab === "activity" ? Activity : FileClock;
  return <header className="space-y-2"><p className="text-sm text-muted-foreground">Administration · {total.toLocaleString("en-GB")} records</p><h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl"><Icon className="size-7 text-primary" />History</h1><p className="max-w-2xl text-sm leading-6 text-muted-foreground">Review who changed family records, what changed, and why.</p></header>;
}

function HistoryTabs({ tab }: { tab: string }) {
  return <nav className="flex flex-wrap gap-2" aria-label="History type">
    <Link aria-current={tab === "revisions" ? "page" : undefined} href="/history?tab=revisions" className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium ${tab === "revisions" ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`}><FileClock className="size-4" />Detailed revisions</Link>
    <Link aria-current={tab === "activity" ? "page" : undefined} href="/history?tab=activity" className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium ${tab === "activity" ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`}><Activity className="size-4" />Activity feed</Link>
  </nav>;
}

function EmptyState() {
  return <section className="rounded-xl border p-6"><h2 className="font-semibold">No records match these filters</h2><p className="mt-2 text-sm text-muted-foreground">Try a broader date range or a shorter search.</p></section>;
}
