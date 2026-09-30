import Link from "next/link";
import Image from "next/image";
import { PropertyMap } from "@/components/properties/PropertyMap";
import { PropertyImagePlaceholder } from "@/components/properties/PropertyImagePlaceholder";
import { ArrowUpRight, MapPin, Search } from "lucide-react";
import { getProperties, findProperties } from "@/lib/research-store";
import { requirePagePermission } from "@/lib/permission-guards";

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePagePermission("properties.view");
  const { q = "" } = await searchParams;
  const featured = ["overstone-park", "lockinge", "langleybury", "coombe-house", "lillesden-house", "ballogie-estate", "hesleyside", "sprivers", "whiligh-estate"];
  const rank = (slug: string) => featured.includes(slug) ? featured.indexOf(slug) : featured.length;
  const properties = await getProperties();
  const matches = (await findProperties(q)).sort((a, b) => rank(a.slug) - rank(b.slug) || a.name.localeCompare(b.name));
  return <div className="mx-auto max-w-6xl space-y-8">
    <header className="max-w-3xl space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">The family archive</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Houses, land &amp; family history</h1>
      <p className="text-base leading-relaxed text-muted-foreground">The places woven through the Loyd records: estates, homes and farms, with their family connections, histories and what can be established today.</p>
      <p className="text-sm leading-relaxed text-muted-foreground">Ownership, residence and connections through marriage are distinguished in each account. Sources and unresolved details accompany the stories.</p>
    </header>
    <form className="flex max-w-xl gap-2" role="search">
      <label className="sr-only" htmlFor="property-search">Search property, place or family name</label>
      <input id="property-search" name="q" defaultValue={q} placeholder="Property, place or family name…" className="h-12 min-w-0 flex-1 rounded-lg border bg-background px-4 text-base" />
      <button className="flex min-h-12 shrink-0 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"><Search className="size-4" aria-hidden="true" />Search</button>
    </form>
    <p className="text-sm text-muted-foreground">{matches.length} {matches.length === 1 ? "place" : "places"}{q ? ` matching “${q}”` : " in the collection"} · Living research archive</p>
    {matches.length === 0 && <p className="rounded-xl border p-6">No matching places. <Link href="/properties" className="underline underline-offset-4">See all {properties.length} places</Link>.</p>}
    {matches.length > 0 && <div id="property-map" className="scroll-mt-20"><PropertyMap properties={matches.map(({ slug, name, location, mapLocation }) => ({ slug, name, location, mapLocation }))} /></div>}
    <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
      {matches.map((property) => <article key={property.slug} className="min-w-0 border-b pb-6">
        {!property.images.length && <div className="mb-4"><PropertyImagePlaceholder /></div>}
        {property.images[0] && <Link href={`/properties/${property.slug}`} tabIndex={-1} aria-hidden="true" className="mb-4 block overflow-hidden rounded-lg bg-muted">
          <Image src={property.images[0].url} alt="" loading="lazy" unoptimized width={property.images[0].width ?? 800} height={property.images[0].height ?? 500} className="aspect-[8/5] w-full object-cover" />
        </Link>}
        {property.images[0] && <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground"><a href={property.images[0].sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">Image: {property.images[0].credit}</a> · <a href={property.images[0].licenseUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">{property.images[0].license}</a></p>}
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{property.category}</p>
        <h2 className="text-xl font-semibold"><Link href={`/properties/${property.slug}`} className="inline-flex min-h-11 items-center gap-2 underline-offset-4 hover:underline">{property.name}<ArrowUpRight className="size-4 shrink-0" aria-hidden="true" /></Link></h2>
        <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground"><MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{property.location}</p>
        <p className="mt-3 text-sm leading-relaxed">{property.summary}</p>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{property.status}</p>
      </article>)}
    </div>
  </div>;
}
