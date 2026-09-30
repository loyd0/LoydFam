"use client";

import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map } from "leaflet";
import "leaflet/dist/leaflet.css";

type Pin = { slug: string; name: string; location: string; point: { lat: number; lng: number; label: string; precision: string; explanation: string } };

export default function PropertyLeaflet({ properties, onSelect, selectedSlug }: { properties: Pin[]; onSelect: (slug: string) => void; selectedSlug: string | null }) {
  const element = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<LayerGroup | null>(null);
  const callback = useRef(onSelect);
  const propertiesRef = useRef(properties);
  const [ready, setReady] = useState(false);
  const [tileError, setTileError] = useState(false);
  const [zoomLevel, setZoom] = useState(2);
  callback.current = onSelect;
  propertiesRef.current = properties;

  useEffect(() => {
    let disposed = false;
    let map: Map | null = null;
    let observer: ResizeObserver | null = null;
    void import("leaflet").then((L) => {
      if (disposed || !element.current) return;
      map = L.map(element.current, { scrollWheelZoom: false, worldCopyJump: true, zoomControl: false }).setView([30, 0], 2);
      mapRef.current = map;
      const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        referrerPolicy: "strict-origin-when-cross-origin",
      });
      tiles.on("tileerror", ({ tile }) => {
        tile.style.visibility = "hidden";
        setTileError(true);
      });
      tiles.addTo(map);
      markersRef.current = L.layerGroup().addTo(map);
      map.on("zoomend", handleZoom);
      observer = new ResizeObserver(() => window.setTimeout(() => map?.invalidateSize(), 0));
      observer.observe(element.current);
      window.setTimeout(() => map?.invalidateSize(), 0);
      setReady(true);
    });
    function handleZoom() { setZoomFromMap(map); }
    return () => { disposed = true; observer?.disconnect(); map?.remove(); mapRef.current = null; markersRef.current = null; };
  }, []);

  function setZoomFromMap(map: Map | null) { setZoom(map?.getZoom() ?? 2); }

  useEffect(() => {
    let cancelled = false;
    if (!ready) return () => { cancelled = true; };
    void import("leaflet").then((L) => {
      const map = mapRef.current;
      const layer = markersRef.current;
      if (cancelled || !map || !layer) return;
      layer.clearLayers();
      const projected = properties.map((property) => ({ property, pixel: map.latLngToContainerPoint([property.point.lat, property.point.lng]) }));
      const groups: typeof projected[] = [];
      for (const item of projected) {
        const group = groups.find((items) => items.some((existing) => item.pixel.distanceTo(existing.pixel) < 34));
        if (group) group.push(item);
        else groups.push([item]);
      }

      for (const group of groups) {
        const lat = group.reduce((sum, item) => sum + item.property.point.lat, 0) / group.length;
        const lng = group.reduce((sum, item) => sum + item.property.point.lng, 0) / group.length;
        const active = group.some(({ property }) => property.slug === selectedSlug);
        const marker = L.circleMarker([lat, lng], {
          radius: active ? 10 : group.length > 1 ? 10 : 7,
          color: "#fff", weight: 2, fillColor: active ? "#a0472b" : "#315b46", fillOpacity: 0.96,
        }).bindTooltip(group.length > 1 ? `${group.length} nearby properties` : `${group[0].property.name} · ${precisionLabel(group[0].property.point.precision)}`);
        marker.on("click", () => {
          if (group.length === 1) {
            callback.current(group[0].property.slug);
            return;
          }
          const content = document.createElement("div");
          content.className = "property-map-popup";
          const heading = document.createElement("p");
          heading.className = "mb-2 font-semibold";
          heading.textContent = `${group.length} nearby properties`;
          content.append(heading);
          for (const { property } of group) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "block min-h-11 w-full rounded px-2 py-2 text-left text-sm hover:bg-muted";
            button.textContent = `${property.name} · ${precisionLabel(property.point.precision)}`;
            button.addEventListener("click", () => callback.current(property.slug));
            content.append(button);
          }
          marker.bindPopup(content, { maxWidth: 280, maxHeight: 300 }).openPopup();
        });
        marker.addTo(layer);
      }
    });
    return () => { cancelled = true; };
  }, [properties, selectedSlug, ready, zoomLevel]);

  // Viewport changes are separate from marker regrouping: a user zoom must not
  // trigger another fitBounds and undo their interaction.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void import("leaflet").then((L) => {
      const map = mapRef.current;
      if (!map || cancelled) return;
      const selected = properties.find(({ slug }) => slug === selectedSlug);
      if (selected) {
        const zoom = selected.point.precision === "building" ? 16 : selected.point.precision === "estate" ? 13 : 11;
        map.setView([selected.point.lat, selected.point.lng], zoom);
      } else {
        const bounds = L.latLngBounds(properties.map(({ point }) => [point.lat, point.lng] as [number, number]));
        const maxZoom = properties.length === 1 && properties[0].point.precision === "building" ? 16 : properties.length === 1 && properties[0].point.precision === "estate" ? 13 : 11;
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [42, 42], maxZoom });
      }
    });
    return () => { cancelled = true; };
  }, [properties, selectedSlug, ready]);

  function fitAll() {
    const map = mapRef.current;
    if (!map) return;
    void import("leaflet").then((leaflet) => {
      const bounds = leaflet.latLngBounds(propertiesRef.current.map(({ point }) => [point.lat, point.lng] as [number, number]));
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [42, 42], maxZoom: propertiesRef.current.length === 1 && propertiesRef.current[0].point.precision === "building" ? 16 : 11 });
    });
  }

  return <div className="absolute inset-0 z-0 h-full w-full" data-map-zoom={zoomLevel}>
    <div ref={element} className="absolute inset-0 h-full w-full [touch-action:pan-y]" role="img" aria-label={`Interactive map with ${properties.length} property markers. Use the property list for the accessible text alternative.`} />
    {tileError && <p role="status" aria-live="polite" className="absolute bottom-2 left-2 z-[1000] max-w-[calc(100%-1rem)] rounded-md border bg-background/95 px-3 py-2 text-sm shadow">Map tiles could not be loaded. Property markers remain available; use the property list for details.</p>}
    <div className="absolute right-2 top-2 z-[1000] flex flex-col gap-1 rounded-lg border bg-background/95 p-1 shadow" aria-label="Map controls">
      <button type="button" onClick={fitAll} aria-label="Fit all properties in map" title="Fit all properties" className="min-h-11 min-w-11 rounded px-2 text-xs font-medium hover:bg-muted">Fit</button>
      <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in" title="Zoom in" className="min-h-11 min-w-11 rounded text-lg hover:bg-muted">+</button>
      <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out" title="Zoom out" className="min-h-11 min-w-11 rounded text-lg hover:bg-muted">−</button>
    </div>
  </div>;
}

function precisionLabel(precision: string) {
  return precision === "building" ? "verified building" : precision === "estate" ? "approximate estate" : "approximate locality";
}
