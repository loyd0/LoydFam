export default function Loading() {
  return <div role="status" className="flex min-h-48 items-center justify-center gap-3 text-muted-foreground"><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />Loading family records…</div>;
}
