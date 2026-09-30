"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center gap-5 p-6">
    <h1 className="text-3xl font-semibold">This page couldn’t load</h1>
    <p className="text-muted-foreground">Try again, or return to the overview. If you were saving a change, check the record before submitting it again.</p>
    <div className="flex gap-3"><Button onClick={reset}>Try again</Button><Button asChild variant="outline"><Link href="/">Back to overview</Link></Button></div>
  </main>;
}
