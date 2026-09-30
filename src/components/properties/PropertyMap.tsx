"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import locations from "@/content/property-locations.json";

import type { PropertyLocation } from "@/lib/properties";
type PropertyRecord = { slug: string; name: string; location: string; mapLocation?: PropertyLocation | null };
type LocationRecord = {
  slug: string; lat: number; lng: number; label: string;
  precision: "building" | "estate" | "locality";
  explanation: string; sourceUrl: string; mapSourceUrl: string;
};
const locationBySlug = new Map((locations as LocationRecord[]).map((entry) => [entry.slug, entry]));
const PropertyLeaflet = dynamic(() => import("./PropertyLeaflet"), {
  ssr: false,
  loading: () => <div className="flex h-full min-h-72 items-center justify-center text-sm text-muted-foreground">Loading map…</div>,
});

/** Shared property map. Pass the same shape for a full catalogue or a single property. */
export function PropertyMap({ properties }: { properties: PropertyRecord[] }) {
  const [query, setQuery] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<"map" | "places">("map");
  const mapped = useMemo(() => properties.flatMap((property) => {
    const point = property.mapLocation === undefined ? locationBySlug.get(property.slug) : property.mapLocation;
    return point ? [{ ...property, point }] : [];
  }), [properties]);
  const filtered = useMemo(() => mapped.filter(({ name, location, point }) =>
    `${name} ${location} ${point.label}`.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim())), [mapped, query]);
  const selected = filtered.find(({ slug }) => slug === selectedSlug) ?? null;
  const unresolvedCount = properties.length - mapped.length;
  const singleProperty = properties.length === 1 && mapped.length === 1 ? mapped[0] : null;

  function select(slug: string) {
    setSelectedSlug(slug);
    if (!singleProperty) setMobilePanel("places");
  }

  if (!mapped.length) return <section className="rounded-xl border p-4" aria-label="Property map">
    <h2 className="text-xl font-semibold">Location still uncertain</h2>
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">The available evidence does not establish a reliable location for {properties.length === 1 ? properties[0].name : "these properties"}. No map pin is shown.</p>
  </section>;

  return <section className="space-y-3" aria-label="Property map">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-xl font-semibold">Property map</h2><p className="text-sm text-muted-foreground">{singleProperty ? "Location and evidence" : `${filtered.length} of ${mapped.length} mapped properties. Select a pin or use the property list.`}</p>{unresolvedCount > 0 && <p className="mt-1 text-xs text-muted-foreground">{unresolvedCount} {unresolvedCount === 1 ? "property has" : "properties have"} no defensible map location and {unresolvedCount === 1 ? "is" : "are"} omitted.</p>}</div>
      {!singleProperty && <><label className="sr-only" htmlFor="property-map-search">Search properties</label>
      <input id="property-map-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search properties or locations" className="h-12 w-full rounded-md border border-input bg-background px-3 text-base sm:max-w-xs" /></>}
    </div>
    {!singleProperty && <div role="group" aria-label="Map and property list" className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/50 p-1 md:hidden">
      <button aria-pressed={mobilePanel === "map"} onClick={() => setMobilePanel("map")} className={`min-h-11 rounded-md text-sm font-medium ${mobilePanel === "map" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Map</button>
      <button aria-pressed={mobilePanel === "places"} onClick={() => setMobilePanel("places")} className={`min-h-11 rounded-md text-sm font-medium ${mobilePanel === "places" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Properties ({filtered.length})</button>
    </div>}
    <div className={`grid min-w-0 gap-3 ${singleProperty ? "grid-cols-1" : "lg:grid-cols-[minmax(0,1fr)_19rem]"}`}>
      <div className={`${mobilePanel === "map" ? "" : "hidden md:block"} relative h-[44svh] min-h-72 overflow-hidden rounded-xl border bg-muted sm:h-[55svh] lg:h-[600px]`}>
        <PropertyLeaflet properties={filtered} onSelect={select} selectedSlug={selectedSlug} />
      </div>
      {!singleProperty && <aside className={`${mobilePanel === "places" ? "" : "hidden md:block"} max-h-[min(65svh,600px)] overflow-y-auto rounded-xl border bg-card`} aria-label="Mapped properties">
        {selected ? <div className="border-b p-4">
          <h3 className="font-semibold">{selected.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{selected.location}</p>
          <p className="mt-3 text-sm"><span className="font-medium">{precisionLabel(selected.point.precision)}</span> · {selected.point.explanation}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <a className="text-primary underline underline-offset-4" href={selected.point.sourceUrl} target="_blank" rel="noreferrer">Research source</a>
            <a className="text-primary underline underline-offset-4" href={selected.point.mapSourceUrl} target="_blank" rel="noreferrer">Location source</a>
            <Link className="text-primary underline underline-offset-4" href={`/properties/${selected.slug}`}>Property details</Link>
          </div>
          <button className="mt-3 min-h-11 text-sm underline underline-offset-4 md:hidden" onClick={() => setMobilePanel("map")}>Back to map</button>
        </div> : <div className="border-b p-4"><h3 className="font-semibold">Properties</h3><p className="mt-1 text-sm text-muted-foreground">Select a pin or property for its location notes and sources.</p></div>}
        <ul className="divide-y">
          {filtered.map(({ slug, name, point }) => <li key={slug}>
            <button type="button" onClick={() => select(slug)} aria-current={selectedSlug === slug ? "true" : undefined} className="min-h-16 w-full px-4 py-3 text-left hover:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              <span className="block font-medium">{name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{point.label} · {precisionLabel(point.precision)}</span>
            </button>
          </li>)}
        </ul>
        {!filtered.length && <p className="p-4 text-sm text-muted-foreground">No mapped properties match that search.</p>}
      </aside>}
    </div>
    {singleProperty && <article className="rounded-xl border bg-card p-4" aria-label={`${singleProperty.name} map location details`}>
      <h3 className="font-semibold">{singleProperty.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{singleProperty.location}</p>
      <p className="mt-3 text-sm"><span className="font-medium">{precisionLabel(singleProperty.point.precision)}</span> · {singleProperty.point.explanation}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <a className="text-primary underline underline-offset-4" href={singleProperty.point.sourceUrl} target="_blank" rel="noreferrer">Research source</a>
        <a className="text-primary underline underline-offset-4" href={singleProperty.point.mapSourceUrl} target="_blank" rel="noreferrer">Location source</a>
        <Link className="text-primary underline underline-offset-4" href={`/properties/${singleProperty.slug}`}>Property details</Link>
      </div>
    </article>}
    <p className="text-xs text-muted-foreground">Map tiles © OpenStreetMap contributors. Building pins are used only where the address was verified; locality and estate pins show approximate areas.</p>
  </section>;
}

function precisionLabel(precision: LocationRecord["precision"]) {
  return precision === "building" ? "Verified building" : precision === "estate" ? "Approximate estate" : "Approximate locality";
}
