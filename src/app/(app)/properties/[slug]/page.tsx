import Link from "next/link";
import { PropertyMap } from "@/components/properties/PropertyMap";
import { PropertyGallery } from "@/components/properties/PropertyGallery";
import { getProperty } from "@/lib/research-store";
import { requireSession } from "@/lib/authz";
import { getUserPermissions } from "@/lib/permission-store";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { type PropertyRecord } from "@/lib/properties";
import { propertyGalleries } from "@/lib/property-galleries";

function References({ ids, property }: { ids: string[]; property: PropertyRecord }) {
  return <span className="ml-1 inline-flex flex-wrap gap-1" aria-label="Sources">{ids.map((id) => {
    const index = property.sources.findIndex((source) => source.id === id);
    return <a key={id} href={`#source-${id}`} className="inline-flex min-h-8 min-w-8 items-center justify-center rounded text-xs font-medium text-primary underline underline-offset-4" aria-label={`Source ${index + 1}: ${property.sources[index]?.title}`}>[{index + 1}]</a>;
  })}</span>;
}

export default async function PropertyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const record = await getProperty(slug);
  if (!record) notFound();
  const { property, version } = record;
  const galleries = propertyGalleries(property);
  const session = await requireSession();
  const permissions = await getUserPermissions(session.user);
  const canViewProperties = permissions["properties.view"];
  const canEditProperties = session.user.role === "ADMIN" && permissions["properties.edit"];
  if (!canViewProperties && !canEditProperties) notFound();
  const canViewPeople = permissions["people.view"];
  const canViewMap = permissions["map.view"];
  const canViewHistory = permissions["history.view"];
  return <article className="mx-auto max-w-4xl space-y-8 pb-6">
    <Link href="/properties" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />All family places</Link>
    <header className="space-y-4">
      <p className="text-sm text-muted-foreground">{property.category} · {property.location}</p>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">{property.name}</h1>
      <p className="max-w-3xl text-lg leading-relaxed">{property.summary}</p>
      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{property.connection}</p>
    </header>
    <div className="flex flex-wrap items-center gap-4 text-sm">{canViewHistory && <Link className="inline-flex min-h-11 items-center underline underline-offset-4" href={`/properties/${slug}/history`}>Edit history{version > 0 ? ` · Version ${version}` : ""}</Link>}{(canEditProperties || canViewProperties) && <Link className="inline-flex min-h-11 items-center rounded-lg border px-4" href={`/properties/${slug}/edit`}>{canEditProperties ? "Edit property" : "Suggest an amendment"}</Link>}</div>
    <PropertyGallery images={property.images} name={property.name} featured />
    <section className="border-y py-5" aria-labelledby="present-status">
      <h2 id="present-status" className="text-lg font-semibold">The place today</h2>
      <p className="mt-2 leading-relaxed">{property.status}</p>
      <p className="mt-2 text-xs text-muted-foreground">Sources checked {new Date(`${property.statusChecked}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}. Historical descriptions and older listings are dated evidence, not proof of present ownership.</p>
    </section>
    {canViewMap && <PropertyMap properties={[{ slug: property.slug, name: property.name, location: property.location, mapLocation: property.mapLocation }]} />}
    <div className="space-y-8">{property.paragraphs.map((paragraph, index) => <section key={index} className="space-y-3">
      <h2 className="text-2xl font-semibold">{paragraph.heading}</h2>
      <p className="whitespace-pre-line text-base leading-8">{paragraph.text}<References ids={paragraph.sourceIds} property={property} /></p>
      <PropertyGallery images={galleries.sections[index]} name={`${property.name}: ${paragraph.heading}`} title="Gallery" />
    </section>)}</div>
    <PropertyGallery images={galleries.remaining} name={property.name} title="More photographs and portraits" />
    {property.timeline.length > 0 && <section className="space-y-5 border-t pt-7">
      <h2 className="text-2xl font-semibold">Through the years</h2>
      <ol className="space-y-5 border-l pl-5">{property.timeline.map((event, index) => <li key={index} className="space-y-1"><p className="font-semibold text-primary">{event.date}</p><p className="text-sm leading-7">{event.text}<References ids={event.sourceIds} property={property} /></p></li>)}</ol>
    </section>}
    {!!property.archiveImages?.length && <section className="space-y-4 border-t pt-7" aria-labelledby="archive-images-heading">
      <h2 id="archive-images-heading" className="text-2xl font-semibold">From the archives</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">Photographs, drawings and portraits held in other collections. Some records offer a digital image; others describe material available from the archive. Reproduction rights may be restricted.</p>
      <ul className="grid gap-3 sm:grid-cols-2">{property.archiveImages.map((archiveRecord) => <li key={archiveRecord.url} className="min-w-0 rounded-lg border p-4">
        <p className="text-xs font-medium text-muted-foreground">{archiveRecord.institution}</p>
        <a href={archiveRecord.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 py-2 font-medium underline underline-offset-4">{archiveRecord.title}<ArrowUpRight className="size-4 shrink-0" aria-hidden="true" /></a>
        <p className="text-sm leading-relaxed text-muted-foreground">{archiveRecord.description}</p>
      </li>)}</ul>
    </section>}
    {canViewPeople && property.people.length > 0 && <section className="space-y-4 border-t pt-7">
      <h2 className="text-2xl font-semibold">In the family records</h2>
      <p className="text-sm text-muted-foreground">Profiles whose workbook entries mention this place; a mention alone does not establish residence or ownership.</p>
      <ul className="grid gap-2 sm:grid-cols-2">{property.people.map((person) => <li key={person.id}><Link href={`/people/${person.id}`} className="flex min-h-12 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted"><span>{person.name}<span className="ml-2 text-xs text-muted-foreground">{person.key}</span></span><ArrowUpRight className="size-4 shrink-0" /></Link></li>)}</ul>
    </section>}
    {property.uncertainties.length > 0 && <section className="space-y-3 rounded-xl bg-muted/60 p-5">
      <h2 className="text-lg font-semibold">What remains uncertain</h2>
      <ul className="list-disc space-y-2 pl-5 text-sm leading-7">{property.uncertainties.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>}
    <section className="space-y-5 border-t pt-7" aria-labelledby="sources-heading">
      <h2 id="sources-heading" className="text-2xl font-semibold">Sources &amp; further reading</h2>
      <ol className="list-decimal space-y-5 pl-5">{property.sources.map((source) => <li id={`source-${source.id}`} key={source.id} className="scroll-mt-20 pl-1 text-sm leading-7 break-words">
        {source.url ? <a href={source.url} target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-4">{source.title}</a> : <span className="font-medium">{source.title}</span>}
        {source.publisher && <p className="text-muted-foreground">{source.publisher}</p>}
        {source.note && <p className="text-muted-foreground">{source.note}</p>}
      </li>)}</ol>
    </section>
  </article>;
}
