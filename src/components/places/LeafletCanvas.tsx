"use client";

import { useEffect, useRef, useState } from "react";
import type { PlacePoint, DatedJourney } from "@/lib/places";
import "leaflet/dist/leaflet.css";

export default function LeafletCanvas({ points, onSelect, journeys }: { points: PlacePoint[]; onSelect: (id: string) => void; journeys: DatedJourney[] }) {
  const element = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const callbackRef = useRef(onSelect);
  const [zoom, setZoom] = useState(2);
  const [ready, setReady] = useState(false);
  const [tileError, setTileError] = useState(false);
  callbackRef.current = onSelect;

  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | null = null;
    import("leaflet").then((L) => {
      if (disposed || !element.current) return;
      map = L.map(element.current, { worldCopyJump: true, zoomControl: true, scrollWheelZoom: true }).setView([25, 12], 2);
      mapRef.current = map;
      const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
        referrerPolicy: "strict-origin-when-cross-origin",
      });
      tiles.on("tileerror", ({ tile }) => {
        tile.style.visibility = "hidden";
        setTileError(true);
      });
      tiles.addTo(map);
      const layer = L.layerGroup().addTo(map);
      layerRef.current = layer;
      setReady(true);
      map.on("zoomend", () => setZoom(map?.getZoom() ?? 2));
      setTimeout(() => map?.invalidateSize(), 0);
    });
    return () => {
      disposed = true;
      map?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !mapRef.current || !layerRef.current) return;
      const map = mapRef.current;
      const layer = layerRef.current;
      layer.clearLayers();
      for (const journey of journeys) {
        const label = document.createElement("span");
        label.textContent = `${journey.personName}: ${journey.stops.map(s => `${s.place} (${s.year})`).join(" → ")}. Connections between records, not a proven route.`;
        L.polyline(journey.stops.map(s => [s.lat, s.lng] as [number, number]), { color: "#8b6944", weight: 2, dashArray: "6 5" }).bindTooltip(label).addTo(layer);
      }
      // Nearby centroids combine into a single count marker at the current zoom.
      const precision = Math.max(0.15, 14 / Math.pow(2, map.getZoom() - 1));
      const clusters = new Map<string, PlacePoint[]>();
      for (const point of points) {
        const key = `${Math.round(point.lat / precision)}:${Math.round(point.lng / precision)}`;
        clusters.set(key, [...(clusters.get(key) ?? []), point]);
      }
      for (const group of clusters.values()) {
        const lat = group.reduce((sum, p) => sum + p.lat, 0) / group.length;
        const lng = group.reduce((sum, p) => sum + p.lng, 0) / group.length;
        const evidenceCount = group.reduce((sum, p) => sum + p.evidence.length, 0);
        const circle = L.circleMarker([lat, lng], {
          radius: Math.min(23, 8 + Math.log2(evidenceCount + group.length) * 2),
          color: "#f4f1e8", weight: 2, fillColor: "#315b46", fillOpacity: 0.88,
        }).bindTooltip(group.length > 1 ? `${group.length} places · ${evidenceCount} records` : `${group[0].canonical} · ${evidenceCount} records`, { direction: "top" });
        circle.on("click", () => {
          if (group.length > 1) map.setView([lat, lng], Math.min(8, map.getZoom() + 2));
          callbackRef.current(group[0].id);
        });
        circle.addTo(layer);
      }
    });
    return () => { cancelled = true; };
  }, [points, journeys, zoom, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const refresh = () => map.invalidateSize();
    map.on("resize", refresh);
    return () => { map.off("resize", refresh); };
  }, []);

  return <>
    <div ref={element} className="absolute inset-0 z-0 h-full min-h-[520px] w-full" aria-label="Map of historical family locations" />
    {tileError && <p role="status" aria-live="polite" className="absolute bottom-2 left-2 z-[1000] max-w-[calc(100%-1rem)] rounded-md border bg-background/95 px-3 py-2 text-sm shadow">Map tiles could not be loaded. Location markers and journey connections remain available.</p>}
  </>;
}
