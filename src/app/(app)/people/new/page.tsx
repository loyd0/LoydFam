"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createPerson, type PersonPatch } from "@/app/(app)/people/actions";
import { ArrowLeft, Loader2, UserPlus } from "lucide-react";

export default function NewPersonPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<PersonPatch>({
    gender: "UNKNOWN",
  });

  if (status === "loading") {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  if (session && session.user?.role !== "ADMIN") {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-muted-foreground">Only admins can add people.</p>
        <Button asChild variant="outline">
          <Link href="/people">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to People
          </Link>
        </Button>
      </div>
    );
  }

  function update<K extends keyof PersonPatch>(key: K, value: PersonPatch[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.givenName1 && !form.surname && !form.knownAs) {
      setError("Enter at least a first name, surname, or known-as");
      return;
    }
    startTransition(async () => {
      try {
        const { id } = await createPerson(form);
        router.push(`/people/${id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create");
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-6 animate-page-in">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/people">
            <ArrowLeft className="h-4 w-4" />
            Back to people
          </Link>
        </Button>
        <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
          <UserPlus className="h-7 w-7 text-primary" />
          Add person
        </h1>
        <p className="mt-1 text-muted-foreground">
          Create a new person in the family record. You can add events, relationships, and
          details after this first step.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identity</CardTitle>
          <CardDescription>
            At minimum, give them a name so they can be found. Everything else is editable later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="First name">
                <Input
                  autoFocus
                  value={form.givenName1 ?? ""}
                  onChange={(e) => update("givenName1", e.target.value)}
                />
              </Field>
              <Field label="Surname">
                <Input
                  value={form.surname ?? ""}
                  onChange={(e) => update("surname", e.target.value)}
                />
              </Field>
              <Field label="Middle name">
                <Input
                  value={form.givenName2 ?? ""}
                  onChange={(e) => update("givenName2", e.target.value)}
                />
              </Field>
              <Field label="Known as">
                <Input
                  value={form.knownAs ?? ""}
                  onChange={(e) => update("knownAs", e.target.value)}
                />
              </Field>
            </div>

            <Field label="Gender">
              <select
                value={form.gender}
                onChange={(e) => update("gender", e.target.value as PersonPatch["gender"])}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="UNKNOWN">Unknown</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </Field>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create person"}
              </Button>
              <Button type="button" variant="outline" asChild disabled={pending}>
                <Link href="/people">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
