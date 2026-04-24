"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  User as UserIcon,
  Heart,
  Calendar,
  Users,
  MapPin,
  BookOpen,
  ArrowLeft,
  Baby,
  Skull,
  Church,
  ExternalLink,
  Printer,
  Pencil,
  Plus,
  X,
  Trash2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { PersonIdentityDialog } from "@/components/people/edit/PersonIdentityDialog";
import { PersonContactDialog } from "@/components/people/edit/PersonContactDialog";
import { EventDialog } from "@/components/people/edit/EventDialog";
import { RelationshipDialog } from "@/components/people/edit/RelationshipDialog";
import { DeletePersonDialog } from "@/components/people/edit/DeletePersonDialog";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { ActivityFeed } from "@/components/history/ActivityFeed";
import { PhotoGallery } from "@/components/media/PhotoGallery";
import {
  removeParentChild,
  removePartnership,
} from "@/app/(app)/people/actions";

interface PersonEvent {
  id: string;
  eventId?: string;
  event: {
    id: string;
    type: string;
    dateExact: string | null;
    dateYear: number | null;
    dateMonth: number | null;
    dateDay: number | null;
    dateText: string | null;
    dateIsApprox: boolean;
    descriptionMd?: string | null;
  };
  role: string;
}

interface RelatedPerson {
  id: string;
  displayName: string;
  gender: string;
  relationId?: string;
}

interface SpouseInfo {
  id: string;
  displayName: string;
  gender: string;
  isPlaceholder: boolean;
  type: string;
  notes: string | null;
  partnershipId?: string;
  marriageDate: {
    exact: string | null;
    year: number | null;
    text: string | null;
  } | null;
}

interface NoteRecord {
  id: string;
  title: string | null;
  markdown: string;
  tiptapJson: unknown;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string | null; email: string } | null;
}

interface MediaLinkRecord {
  id: string;
  isPrimary: boolean;
  sortOrder: number;
  media: {
    id: string;
    blobUrl: string;
    mimeType: string | null;
    caption: string | null;
    width: number | null;
    height: number | null;
  };
}

export interface PersonDetail {
  id: string;
  displayName: string;
  surname: string | null;
  givenName1: string | null;
  givenName2: string | null;
  givenName3: string | null;
  knownAs: string | null;
  preferredName: string | null;
  gender: string;
  isPlaceholder: boolean;
  biographyMd: string | null;
  biographyShortMd: string | null;
  residencyText: string | null;
  legacyGeneration: number | null;
  generationFromWilliam: number | null;
  rawNameString: string | null;
  events: PersonEvent[];
  parents: RelatedPerson[];
  children: RelatedPerson[];
  spouses: SpouseInfo[];
  notes?: NoteRecord[];
  mediaLinks?: MediaLinkRecord[];
  contact: {
    emails: string[];
    mobile: string | null;
    landline: string | null;
    address2000: string | null;
    postalAddress2021: string | null;
    comments?: string | null;
  } | null;
}

function formatDate(event: PersonEvent["event"]): string {
  if (event.dateExact) {
    return new Date(event.dateExact).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  if (event.dateText) return event.dateText;
  if (event.dateYear) {
    const parts: (number | string)[] = [event.dateYear];
    if (event.dateMonth) parts.unshift(event.dateMonth);
    if (event.dateDay) parts.unshift(event.dateDay);
    return parts.join("/");
  }
  return "Unknown";
}

function EventIcon({ type }: { type: string }) {
  switch (type) {
    case "BIRTH":
      return <Baby className="h-4 w-4 text-emerald-500" />;
    case "DEATH":
      return <Skull className="h-4 w-4 text-muted-foreground" />;
    case "MARRIAGE":
      return <Church className="h-4 w-4 text-pink-500" />;
    default:
      return <Calendar className="h-4 w-4 text-chart-2" />;
  }
}

function Fact({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      {icon && <span className="mt-0.5 text-muted-foreground">{icon}</span>}
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}

function PersonLink({
  person,
  onNavigate,
}: {
  person: { id: string; displayName: string; gender: string };
  onNavigate?: (id: string) => void;
}) {
  const dot = (
    <span
      className={`inline-block h-2 w-2 rounded-full shrink-0 ${
        person.gender === "MALE"
          ? "bg-primary"
          : person.gender === "FEMALE"
          ? "bg-[oklch(0.50_0.10_155)]"
          : "bg-muted-foreground"
      }`}
    />
  );
  if (onNavigate) {
    return (
      <button
        onClick={() => onNavigate(person.id)}
        className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/50 -mx-2 transition-colors w-full text-left"
      >
        {dot}
        {person.displayName}
      </button>
    );
  }
  return (
    <Link
      href={`/people/${person.id}`}
      className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/50 -mx-2 transition-colors"
    >
      {dot}
      {person.displayName}
    </Link>
  );
}

function SectionHeader({
  icon,
  title,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-2">
      <h3 className="text-2xl font-semibold text-foreground flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {action && <div className="print:hidden">{action}</div>}
    </div>
  );
}

function EditButton({ onClick, label = "Edit" }: { onClick: () => void; label?: string }) {
  return (
    <Button
      variant="ghost"
      size="xs"
      onClick={onClick}
      className="text-muted-foreground hover:text-foreground"
      aria-label={label}
    >
      <Pencil className="h-3 w-3" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button variant="outline" size="xs" onClick={onClick}>
      <Plus className="h-3 w-3" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

interface PersonProfileProps {
  personId: string;
  onNavigate?: (id: string) => void;
  standalone?: boolean;
}

export function PersonProfile({ personId, onNavigate, standalone = false }: PersonProfileProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const isAdmin = session?.user?.role === "ADMIN";
  const [pending, startTransition] = useTransition();

  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [identityOpen, setIdentityOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PersonEvent | null>(null);
  const [newEventOpen, setNewEventOpen] = useState(false);
  const [relationMode, setRelationMode] = useState<null | "parent" | "child" | "spouse">(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/people/${personId}`, { cache: "no-store" });
      if (!res.ok) {
        setError("Person not found");
        return;
      }
      setPerson(await res.json());
    } catch {
      setError("Failed to load");
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    setPerson(null);
    setLoading(true);
    setError(null);
    load();
  }, [personId, load]);

  function refreshAfterEdit() {
    load();
    router.refresh();
  }

  async function handleRemoveParent(parentId: string) {
    if (!confirm("Unlink this parent?")) return;
    startTransition(async () => {
      await removeParentChild(parentId, personId);
      refreshAfterEdit();
    });
  }

  async function handleRemoveChild(childId: string) {
    if (!confirm("Unlink this child?")) return;
    startTransition(async () => {
      await removeParentChild(personId, childId);
      refreshAfterEdit();
    });
  }

  async function handleRemovePartnership(partnershipId: string) {
    if (!confirm("Remove this partnership?")) return;
    startTransition(async () => {
      await removePartnership(partnershipId);
      refreshAfterEdit();
    });
  }

  if (loading) {
    return (
      <div className="space-y-6 p-1">
        <div className="flex items-center gap-3">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">{error || "Not found"}</p>
        {standalone && (
          <Button asChild variant="outline">
            <Link href="/people">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to People
            </Link>
          </Button>
        )}
      </div>
    );
  }

  const birthEvent = person.events.find((e) => e.event.type === "BIRTH");
  const deathEvent = person.events.find((e) => e.event.type === "DEATH");
  const generation = person.legacyGeneration ?? person.generationFromWilliam;

  const parentIds = person.parents.map((p) => p.id);
  const childIds = person.children.map((c) => c.id);
  const spouseIds = person.spouses.map((s) => s.id);

  return (
    <div className="space-y-8 animate-page-in print:p-0">
      {/* Header */}
      <div className="flex items-start gap-3 sm:gap-4">
        {standalone && (
          <Button asChild variant="ghost" size="icon" className="mt-1 shrink-0 print:hidden">
            <Link href="/people">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        )}
        <div
          className={`flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
            person.gender === "MALE"
              ? "bg-primary/10 text-primary"
              : person.gender === "FEMALE"
              ? "bg-[oklch(0.50_0.10_155/0.12)] text-[oklch(0.35_0.08_155)]"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <UserIcon className="h-6 w-6 sm:h-7 sm:w-7" />
        </div>
        <div className="flex-1 min-w-0 border-b border-border/60 pb-6">
          <div className="flex items-start justify-between gap-3">
            <h2
              className={`font-semibold tracking-tight text-foreground ${
                standalone ? "text-2xl sm:text-3xl lg:text-4xl" : "text-xl sm:text-2xl lg:text-3xl"
              }`}
            >
              {person.displayName}
            </h2>
            {isAdmin && standalone && (
              <div className="shrink-0 print:hidden">
                <EditButton onClick={() => setIdentityOpen(true)} />
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-foreground/80">
            <span className="uppercase tracking-widest text-xs font-medium text-muted-foreground">
              {person.gender === "MALE"
                ? "Male"
                : person.gender === "FEMALE"
                ? "Female"
                : "Unknown"}
            </span>
            {generation != null && (
              <span className="uppercase tracking-widest text-xs font-medium text-muted-foreground border-l border-border pl-4">
                Gen {generation}
              </span>
            )}
            {birthEvent && (
              <span className="text-muted-foreground border-l border-border pl-4">
                b. {formatDate(birthEvent.event)}
              </span>
            )}
            {deathEvent && (
              <span className="text-muted-foreground border-l border-border pl-4">
                d. {formatDate(deathEvent.event)}
              </span>
            )}
            {!deathEvent && birthEvent && (
              <span className="uppercase tracking-widest text-xs font-medium text-emerald-600/80 border-l border-border pl-4">
                Living
              </span>
            )}
            {person.isPlaceholder && (
              <Badge variant="outline" className="text-[10px]">Placeholder</Badge>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {!standalone && (
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link href={`/people/${person.id}`}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  View Full Profile
                </Link>
              </Button>
            )}
            {standalone && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 print:hidden"
                onClick={() => window.print()}
              >
                <Printer className="h-3.5 w-3.5" />
                Print
              </Button>
            )}
            {isAdmin && standalone && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive print:hidden"
                onClick={() => setDeleteOpen(true)}
                disabled={pending}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Delete person
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Key Facts */}
        <div className="space-y-4">
          <SectionHeader
            icon={<UserIcon className="h-5 w-5 opacity-70 text-muted-foreground" />}
            title="Key Facts"
            action={isAdmin ? <EditButton onClick={() => setIdentityOpen(true)} /> : null}
          />
          <div className="space-y-4 pt-2">
            {person.surname && <Fact label="Surname" value={person.surname} />}
            {person.givenName1 && (
              <Fact
                label="Given Names"
                value={[person.givenName1, person.givenName2, person.givenName3]
                  .filter(Boolean)
                  .join(" ")}
              />
            )}
            {person.knownAs && <Fact label="Known as" value={person.knownAs} />}
            {person.residencyText && (
              <Fact
                label="Countries Lived In"
                value={person.residencyText}
                icon={<MapPin className="h-3.5 w-3.5" />}
              />
            )}
            {!person.surname && !person.givenName1 && !person.knownAs && !person.residencyText && (
              <p className="text-muted-foreground">No details recorded.</p>
            )}
          </div>
        </div>

        {/* Relationships */}
        <div className="space-y-4">
          <SectionHeader
            icon={<Users className="h-5 w-5 opacity-70 text-muted-foreground" />}
            title="Relationships"
          />
          <div className="space-y-6 pt-2">
            <RelationList
              label="Parents"
              people={person.parents}
              onNavigate={onNavigate}
              isAdmin={isAdmin}
              onRemove={(id) => handleRemoveParent(id)}
              onAdd={() => setRelationMode("parent")}
              emptyLabel="Add parent"
            />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Spouse{person.spouses.length > 1 ? "s" : ""}
                </p>
                {isAdmin && (
                  <AddButton onClick={() => setRelationMode("spouse")} label="Add" />
                )}
              </div>
              <div className="space-y-1">
                {person.spouses.map((s) => (
                  <div key={s.id + (s.partnershipId ?? "")} className="group flex items-center gap-1">
                    <div className="flex-1 min-w-0">
                      {s.isPlaceholder ? (
                        <span className="text-sm px-2">{s.displayName}</span>
                      ) : (
                        <PersonLink person={s} onNavigate={onNavigate} />
                      )}
                      {s.notes && (
                        <p className="text-xs text-muted-foreground ml-6 mt-0.5">{s.notes}</p>
                      )}
                    </div>
                    {isAdmin && s.partnershipId && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive print:hidden"
                        onClick={() => handleRemovePartnership(s.partnershipId!)}
                        disabled={pending}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                {person.spouses.length === 0 && isAdmin && (
                  <p className="text-xs text-muted-foreground italic">No spouses linked.</p>
                )}
              </div>
            </div>

            <RelationList
              label={`Children (${person.children.length})`}
              people={person.children}
              onNavigate={onNavigate}
              isAdmin={isAdmin}
              onRemove={(id) => handleRemoveChild(id)}
              onAdd={() => setRelationMode("child")}
              emptyLabel="Add child"
            />

            {!isAdmin &&
              person.parents.length === 0 &&
              person.spouses.length === 0 &&
              person.children.length === 0 && (
                <p className="text-muted-foreground">No relationships recorded.</p>
              )}
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          <SectionHeader
            icon={<Calendar className="h-5 w-5 opacity-70 text-muted-foreground" />}
            title="Timeline"
            action={
              isAdmin ? (
                <AddButton onClick={() => setNewEventOpen(true)} label="Add event" />
              ) : null
            }
          />
          <div className="pt-2">
            {person.events.length > 0 ? (
              <div className="space-y-3">
                {person.events.map((pe) => (
                  <div key={pe.id} className="group flex items-start gap-3">
                    <div className="mt-0.5">
                      <EventIcon type={pe.event.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium capitalize">
                        {pe.event.type.toLowerCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(pe.event)}
                        {pe.event.dateIsApprox && " (approx.)"}
                      </p>
                      {pe.event.descriptionMd && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {pe.event.descriptionMd}
                        </p>
                      )}
                    </div>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="opacity-0 group-hover:opacity-100 print:hidden"
                        onClick={() => setEditingEvent(pe)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No events recorded.</p>
            )}
          </div>
        </div>

        {/* Contact */}
        <div className="space-y-4 md:col-span-1">
          <SectionHeader
            icon={<Heart className="h-5 w-5 opacity-70 text-muted-foreground" />}
            title="Contact"
            action={isAdmin ? <EditButton onClick={() => setContactOpen(true)} /> : null}
          />
          <div className="space-y-4 pt-2">
            {person.contact?.emails && person.contact.emails.length > 0 && (
              <Fact label="Email" value={person.contact.emails.join(", ")} />
            )}
            {person.contact?.mobile && <Fact label="Mobile" value={person.contact.mobile} />}
            {person.contact?.landline && (
              <Fact label="Landline" value={person.contact.landline} />
            )}
            {person.contact?.postalAddress2021 && (
              <Fact label="Address (2021)" value={person.contact.postalAddress2021} />
            )}
            {person.contact?.address2000 && (
              <Fact label="Address (2000)" value={person.contact.address2000} />
            )}
            {!person.contact && isAdmin && (
              <p className="text-xs text-muted-foreground italic">No contact details yet.</p>
            )}
          </div>
        </div>

        {/* Biography */}
        {(person.biographyMd || person.biographyShortMd || isAdmin) && (
          <div className="space-y-4 border-t border-border/40 pt-6 md:col-span-2">
            <SectionHeader
              icon={<BookOpen className="h-5 w-5 opacity-70 text-muted-foreground" />}
              title="Biography"
              action={isAdmin ? <EditButton onClick={() => setIdentityOpen(true)} /> : null}
            />
            <div className="pt-2">
              {person.biographyMd || person.biographyShortMd ? (
                <p className="text-base leading-relaxed whitespace-pre-wrap text-foreground/90">
                  {person.biographyShortMd || person.biographyMd}
                </p>
              ) : (
                <p className="text-sm italic text-muted-foreground">No biography yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Photos */}
        {standalone && (
          <div className="md:col-span-2">
            <PhotoGallery
              personId={person.id}
              mediaLinks={person.mediaLinks ?? []}
              canEdit={isAdmin}
              onChange={refreshAfterEdit}
            />
          </div>
        )}

        {/* Notes */}
        {standalone && (
          <div className="md:col-span-2">
            <NotesPanel
              entityType="PERSON"
              entityId={person.id}
              notes={person.notes ?? []}
              canEdit={isAdmin}
              onChange={refreshAfterEdit}
            />
          </div>
        )}

        {/* Activity */}
        {standalone && (
          <div className="md:col-span-2">
            <ActivityFeed entityType="person" entityId={person.id} />
          </div>
        )}
      </div>

      {/* Edit dialogs */}
      {isAdmin && (
        <>
          <PersonIdentityDialog
            personId={person.id}
            initial={{
              surname: person.surname,
              givenName1: person.givenName1,
              givenName2: person.givenName2,
              givenName3: person.givenName3,
              knownAs: person.knownAs,
              preferredName: person.preferredName,
              gender: person.gender as "MALE" | "FEMALE" | "UNKNOWN",
              residencyText: person.residencyText,
              biographyMd: person.biographyMd,
              biographyShortMd: person.biographyShortMd,
              legacyGeneration: person.legacyGeneration,
              generationFromWilliam: person.generationFromWilliam,
            }}
            open={identityOpen}
            onOpenChange={(o) => {
              setIdentityOpen(o);
              if (!o) refreshAfterEdit();
            }}
          />
          <PersonContactDialog
            personId={person.id}
            initial={{
              emails: person.contact?.emails ?? [],
              mobile: person.contact?.mobile ?? null,
              landline: person.contact?.landline ?? null,
              address2000: person.contact?.address2000 ?? null,
              postalAddress2021: person.contact?.postalAddress2021 ?? null,
              comments: person.contact?.comments ?? null,
            }}
            open={contactOpen}
            onOpenChange={(o) => {
              setContactOpen(o);
              if (!o) refreshAfterEdit();
            }}
          />
          <EventDialog
            personId={person.id}
            open={newEventOpen}
            onOpenChange={(o) => {
              setNewEventOpen(o);
              if (!o) refreshAfterEdit();
            }}
          />
          {editingEvent && (
            <EventDialog
              personId={person.id}
              existing={{
                eventId: editingEvent.event.id,
                type: editingEvent.event.type as "BIRTH" | "DEATH" | "MARRIAGE" | "RESIDENCE" | "OTHER",
                dateExact: editingEvent.event.dateExact,
                dateYear: editingEvent.event.dateYear,
                dateMonth: editingEvent.event.dateMonth,
                dateDay: editingEvent.event.dateDay,
                dateText: editingEvent.event.dateText,
                dateIsApprox: editingEvent.event.dateIsApprox,
                description: editingEvent.event.descriptionMd,
              }}
              open={!!editingEvent}
              onOpenChange={(o) => {
                if (!o) {
                  setEditingEvent(null);
                  refreshAfterEdit();
                }
              }}
            />
          )}
          {relationMode && (
            <RelationshipDialog
              personId={person.id}
              mode={relationMode}
              excludeIds={[...parentIds, ...childIds, ...spouseIds]}
              open={!!relationMode}
              onOpenChange={(o) => {
                if (!o) {
                  setRelationMode(null);
                  refreshAfterEdit();
                }
              }}
            />
          )}
          <DeletePersonDialog
            personId={person.id}
            personName={person.displayName}
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
          />
        </>
      )}

      {pending && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm shadow-lg print:hidden">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving…
        </div>
      )}
    </div>
  );
}

function RelationList({
  label,
  people,
  onNavigate,
  isAdmin,
  onRemove,
  onAdd,
  emptyLabel,
}: {
  label: string;
  people: RelatedPerson[];
  onNavigate?: (id: string) => void;
  isAdmin: boolean;
  onRemove: (id: string) => void;
  onAdd: () => void;
  emptyLabel: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {isAdmin && <AddButton onClick={onAdd} label={emptyLabel} />}
      </div>
      <div className="space-y-1">
        {people.map((p) => (
          <div key={p.id} className="group flex items-center gap-1">
            <div className="flex-1 min-w-0">
              <PersonLink person={p} onNavigate={onNavigate} />
            </div>
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon-xs"
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive print:hidden"
                onClick={() => onRemove(p.id)}
                aria-label={`Remove ${p.displayName}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
        {people.length === 0 && isAdmin && (
          <p className="text-xs text-muted-foreground italic">None linked.</p>
        )}
      </div>
    </div>
  );
}
