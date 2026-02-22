"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";

interface PersonEvent {
  id: string;
  event: {
    id: string;
    type: string;
    dateExact: string | null;
    dateYear: number | null;
    dateMonth: number | null;
    dateDay: number | null;
    dateText: string | null;
    dateIsApprox: boolean;
  };
  role: string;
}

interface RelatedPerson {
  id: string;
  displayName: string;
  gender: string;
}

interface SpouseInfo {
  id: string;
  displayName: string;
  gender: string;
  isPlaceholder: boolean;
  type: string;
  notes: string | null;
  marriageDate: {
    exact: string | null;
    year: number | null;
    text: string | null;
  } | null;
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
  contact: {
    emails: string[];
    mobile: string | null;
    landline: string | null;
    address2000: string | null;
    postalAddress2021: string | null;
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
  person: RelatedPerson;
  onNavigate?: (id: string) => void;
}) {
  if (onNavigate) {
    return (
      <button
        onClick={() => onNavigate(person.id)}
        className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/50 -mx-2 transition-colors w-full text-left"
      >
        <span
          className={`inline-block h-2 w-2 rounded-full shrink-0 ${
            person.gender === "MALE"
              ? "bg-primary"
              : person.gender === "FEMALE"
              ? "bg-[oklch(0.50_0.10_155)]"
              : "bg-muted-foreground"
          }`}
        />
        {person.displayName}
      </button>
    );
  }
  return (
    <Link
      href={`/people/${person.id}`}
      className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/50 -mx-2 transition-colors"
    >
      <span
        className={`inline-block h-2 w-2 rounded-full shrink-0 ${
          person.gender === "MALE"
            ? "bg-primary"
            : person.gender === "FEMALE"
            ? "bg-[oklch(0.50_0.10_155)]"
            : "bg-muted-foreground"
        }`}
      />
      {person.displayName}
    </Link>
  );
}

interface PersonProfileProps {
  /** The person ID to load */
  personId: string;
  /** If inside a drawer, pass this to enable in-drawer navigation between related profiles */
  onNavigate?: (id: string) => void;
  /** Whether to render as standalone page (shows back button) */
  standalone?: boolean;
}

export function PersonProfile({
  personId,
  onNavigate,
  standalone = false,
}: PersonProfileProps) {
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPerson(null);
    setLoading(true);
    setError(null);
    async function load() {
      try {
        const res = await fetch(`/api/people/${personId}`);
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
    }
    load();
  }, [personId]);

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

  return (
    <div className="space-y-8 animate-page-in print:p-0">
      {/* Header */}
      <div className="flex items-start gap-4">
        {standalone && (
          <Button asChild variant="ghost" size="icon" className="mt-1 shrink-0 print:hidden">
            <Link href="/people">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        )}
        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
            person.gender === "MALE"
              ? "bg-primary/10 text-primary"
              : person.gender === "FEMALE"
              ? "bg-[oklch(0.50_0.10_155/0.12)] text-[oklch(0.35_0.08_155)]"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <UserIcon className="h-7 w-7" />
        </div>
        <div className="flex-1 min-w-0 border-b border-border/60 pb-6">
          <h2 className={`font-semibold tracking-tight text-foreground ${standalone ? "text-4xl" : "text-3xl"}`}>
            {person.displayName}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-foreground/80">
            <span className="uppercase tracking-widest text-xs font-medium text-muted-foreground">
              {person.gender === "MALE"
                ? "Male"
                : person.gender === "FEMALE"
                ? "Female"
                : "Unknown"}
            </span>
            {generation != null && (
              <span className="uppercase tracking-widest text-xs font-medium text-muted-foreground border-l border-border pl-4">Gen {generation}</span>
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
          </div>
          {!standalone && (
            <Button asChild variant="outline" size="sm" className="mt-3 gap-1.5">
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
              className="mt-3 gap-1.5 print:hidden"
              onClick={() => window.print()}
            >
              <Printer className="h-3.5 w-3.5" />
              Print Profile
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Key Facts */}
        <div className="space-y-4">
          <h3 className="text-2xl font-semibold text-foreground border-b border-border/40 pb-2 flex items-center gap-2">
            <UserIcon className="h-5 w-5 opacity-70 text-muted-foreground" />
            Key Facts
          </h3>
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
            {person.knownAs && (
              <Fact label="Known as" value={person.knownAs} />
            )}
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
          <h3 className="text-2xl font-semibold text-foreground border-b border-border/40 pb-2 flex items-center gap-2">
            <Users className="h-5 w-5 opacity-70 text-muted-foreground" />
            Relationships
          </h3>
          <div className="space-y-6 pt-2">
            {person.parents.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                  Parents
                </p>
                <div className="space-y-1">
                  {person.parents.map((p) => (
                    <PersonLink key={p.id} person={p} onNavigate={onNavigate} />
                  ))}
                </div>
              </div>
            )}

            {person.spouses.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                  Spouse{person.spouses.length > 1 ? "s" : ""}
                </p>
                <div className="space-y-1">
                  {person.spouses.map((s) => (
                    <div key={s.id}>
                      {s.isPlaceholder ? (
                        <span className="text-sm px-2">{s.displayName}</span>
                      ) : (
                        <PersonLink person={s} onNavigate={onNavigate} />
                      )}
                      {s.notes && (
                        <p className="text-xs text-muted-foreground ml-6 mt-0.5">
                          {s.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {person.children.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                  Children ({person.children.length})
                </p>
                <div className="space-y-1">
                  {person.children.map((c) => (
                    <PersonLink key={c.id} person={c} onNavigate={onNavigate} />
                  ))}
                </div>
              </div>
            )}

            {person.parents.length === 0 &&
              person.spouses.length === 0 &&
              person.children.length === 0 && (
                <p className="text-muted-foreground">
                  No relationships recorded.
                </p>
              )}
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          <h3 className="text-2xl font-semibold text-foreground border-b border-border/40 pb-2 flex items-center gap-2">
            <Calendar className="h-5 w-5 opacity-70 text-muted-foreground" />
            Timeline
          </h3>
          <div className="pt-2">
            {person.events.length > 0 ? (
              <div className="space-y-3">
                {person.events.map((pe) => (
                  <div key={pe.id} className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <EventIcon type={pe.event.type} />
                    </div>
                    <div>
                      <p className="text-sm font-medium capitalize">
                        {pe.event.type.toLowerCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(pe.event)}
                        {pe.event.dateIsApprox && " (approx.)"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">
                No events recorded.
              </p>
            )}
          </div>
        </div>

        {/* Contact */}
        {person.contact && (
          <div className="space-y-4 border-t border-border/40 pt-6 md:border-none md:pt-0">
            <h3 className="text-2xl font-semibold text-foreground border-b border-border/40 pb-2 flex items-center gap-2">
              <Heart className="h-5 w-5 opacity-70 text-muted-foreground" />
              Contact
            </h3>
            <div className="space-y-4 pt-2">
              {person.contact.emails?.length > 0 && (
                <Fact
                  label="Email"
                  value={person.contact.emails.join(", ")}
                />
              )}
              {person.contact.mobile && (
                <Fact label="Mobile" value={person.contact.mobile} />
              )}
              {person.contact.landline && (
                <Fact label="Landline" value={person.contact.landline} />
              )}
              {person.contact.postalAddress2021 && (
                <Fact
                  label="Address (2021)"
                  value={person.contact.postalAddress2021}
                />
              )}
              {person.contact.address2000 && (
                <Fact
                  label="Address (2000)"
                  value={person.contact.address2000}
                />
              )}
            </div>
          </div>
        )}

        {/* Biography */}
        {(person.biographyMd || person.biographyShortMd) && (
          <div className="space-y-4 border-t border-border/40 pt-6 md:col-span-2">
            <h3 className="text-2xl font-semibold text-foreground border-b border-border/40 pb-2 flex items-center gap-2">
              <BookOpen className="h-5 w-5 opacity-70 text-muted-foreground" />
              Biography
            </h3>
            <div className="pt-2">
              <p className="text-base leading-relaxed whitespace-pre-wrap text-foreground/90">
                {person.biographyShortMd || person.biographyMd}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
