"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import Link from "next/link";
import Image from "next/image";
import { ExternalLink, Maximize2, RotateCcw, UserRound, X, Plus, Minus, Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { layoutFamilyTree, type TreePoint } from "@/components/family-tree-layout";
import type { TreeData, TreePerson } from "@/components/family-tree-canvas";
import { FamilyTreeCanvas } from "@/components/family-tree-canvas";
import { usePermissions } from "@/hooks/use-permissions";

function makeLabel(person: TreePerson) {
  const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 56;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(0.5, 0.5);
  ctx.fillStyle = "rgba(16, 24, 22, .88)"; ctx.roundRect(4, 4, 504, 104, 24); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "600 32px system-ui";
  const name = person.displayName.split("(")[0].trim(); ctx.fillText(name.length > 26 ? `${name.slice(0, 25)}…` : name, 24, 48);
  ctx.fillStyle = "#c6d2cd"; ctx.font = "24px system-ui";
  ctx.fillText(`${person.birthYear ?? "?"} – ${person.deathYear ?? "no death recorded"}`, 24, 84);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makePortrait(person: TreePerson) {
  const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(0.5, 0.5);
  const female = person.gender === "FEMALE";
  ctx.fillStyle = female ? "#526c5d" : person.gender === "MALE" ? "#4b6075" : "#65736e";
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.font = "600 100px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(person.displayName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase(), 128, 128);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  let disposed = false;
  if (person.photoUrl) {
    new THREE.TextureLoader().load(person.photoUrl, (photo) => {
      if (disposed) { photo.dispose(); return; }
      photo.colorSpace = THREE.SRGBColorSpace; material.map?.dispose(); material.map = photo; material.needsUpdate = true;
    }, undefined, () => {});
  }
  return { material, cancelLoad: () => { disposed = true; } };
}

export function FamilyTree3D({ data, focusPersonId }: { data: TreeData; focusPersonId?: string }) {
  const { can } = usePermissions();
  const hostRef = useRef<HTMLDivElement>(null);
  const panModeRef = useRef(false);
  const [panMode, setPanMode] = useState(false);
  const sceneRef = useRef<{ scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; controls: { target: THREE.Vector3; theta: number; phi: number; radius: number; maxRadius: number }; positions: Map<string, TreePoint> } | null>(null);
  const focusFrameRef = useRef<number | null>(null);
  const pendingStateFramesRef = useRef(new Set<number>());
  const focusPersonIdRef = useRef(focusPersonId);
  const [selected, setSelected] = useState<TreePerson | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const displayData = data;
  const positioned = useMemo(() => layoutFamilyTree(displayData), [displayData]);
  const personById = useMemo(() => new Map(data.nodes.map((p) => [p.id, p])), [data]);
  useEffect(() => { focusPersonIdRef.current = focusPersonId; }, [focusPersonId]);
  const scheduleState = useCallback((callback: () => void) => {
    const frame = window.requestAnimationFrame(() => { pendingStateFramesRef.current.delete(frame); callback(); });
    pendingStateFramesRef.current.add(frame);
  }, []);
  useEffect(() => () => { pendingStateFramesRef.current.forEach((frame) => cancelAnimationFrame(frame)); pendingStateFramesRef.current.clear(); }, []);

  const animateCamera = useCallback((target: THREE.Vector3, radius: number, duration = 500) => {
    const state = sceneRef.current; if (!state) return;
    if (focusFrameRef.current != null) cancelAnimationFrame(focusFrameRef.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || duration <= 0) {
      state.controls.target.copy(target); state.controls.radius = radius; focusFrameRef.current = null; return;
    }
    const from = state.controls.target.clone(), fromRadius = state.controls.radius;
    const start = performance.now();
    const animateFocus = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration)), eased = 1 - (1 - t) ** 3;
      state.controls.target.lerpVectors(from, target, eased);
      state.controls.radius = THREE.MathUtils.lerp(fromRadius, radius, eased);
      if (t < 1) focusFrameRef.current = requestAnimationFrame(animateFocus);
      else focusFrameRef.current = null;
    };
    focusFrameRef.current = requestAnimationFrame(animateFocus);
  }, []);
  const focus = useCallback((id: string, duration = 500) => {
    const p = sceneRef.current?.positions.get(id);
    if (p) animateCamera(new THREE.Vector3(p.x, p.y, p.z), 10, duration);
  }, [animateCamera]);
  const fitTree = useCallback(() => {
    if (!positioned.length) return;
    const xs = positioned.map((item) => item.position.x), ys = positioned.map((item) => item.position.y), zs = positioned.map((item) => item.position.z);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const target = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
    const camera = sceneRef.current?.camera; if (!camera) return;
    const heightRadius = (maxY - minY) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const horizontalFov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    const widthRadius = (maxX - minX) / (2 * Math.tan(horizontalFov / 2));
    animateCamera(target, Math.max(10, heightRadius, widthRadius) * 1.18);
  }, [positioned, animateCamera]);
  useEffect(() => {
    if (webglFailed) return;
    const host = hostRef.current; if (!host) return;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(document.documentElement.classList.contains("dark") ? "#202825" : "#f5f6f4");
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 10000);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      scheduleState(() => setWebglFailed(true));
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-label", "Interactive 3D family tree. Drag to orbit, scroll to zoom, click a person to open their profile.");
    host.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x718077, 2));
    const light = new THREE.DirectionalLight(0xffffff, 1.4); light.position.set(8, 12, 14); scene.add(light);
    const positions = new Map(positioned.map(({ person, position }) => [person.id, position]));
    const meshes = new Map<string, THREE.Sprite>();
    const cancelPortraitLoads: Array<() => void> = [];
    for (const { person, position } of positioned) {
      const portrait = makePortrait(person); cancelPortraitLoads.push(portrait.cancelLoad);
      const sprite = new THREE.Sprite(portrait.material); sprite.position.set(position.x, position.y + 0.5, position.z); sprite.scale.set(1.45, 1.45, 1);
      sprite.userData.personId = person.id; scene.add(sprite); meshes.set(person.id, sprite);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeLabel(person), transparent: true, depthWrite: false }));
      label.position.set(position.x, position.y - 0.62, position.z); label.scale.set(2.35, 0.52, 1); scene.add(label);
    }
    const seenEdges = new Set<string>();
    for (const edge of displayData.edges) {
      const a = positions.get(edge.parentId), b = positions.get(edge.childId); if (!a || !b) continue;
      const key = `${edge.parentId}:${edge.childId}`; if (seenEdges.has(key)) continue; seenEdges.add(key);
      const start = new THREE.Vector3(a.x, a.y + .25, a.z), end = new THREE.Vector3(b.x, b.y + .25, b.z);
      const points = [start, new THREE.Vector3(start.x, (start.y + end.y) / 2, start.z), new THREE.Vector3(end.x, (start.y + end.y) / 2, end.z), end];
      const curve = new THREE.CatmullRomCurve3(points); scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, .018, 5, false), new THREE.MeshBasicMaterial({ color: 0x91a49a })));
    }
    const extent = Math.max(1, ...Array.from(positions.values()).map((p) => Math.hypot(p.x, p.y, p.z)));
    const controls = { target: new THREE.Vector3(0, 0, 0), theta: 0, phi: 1.05, radius: 12, maxRadius: Math.max(55, extent * 2.5) };
    const updateCamera = () => { camera.position.set(controls.target.x + controls.radius * Math.sin(controls.phi) * Math.sin(controls.theta), controls.target.y + controls.radius * Math.cos(controls.phi), controls.target.z + controls.radius * Math.sin(controls.phi) * Math.cos(controls.theta)); camera.lookAt(controls.target); };
    sceneRef.current = { scene, camera, renderer, controls, positions };
    const wantedFocusId = focusPersonIdRef.current;
    if (wantedFocusId && positions.has(wantedFocusId)) focus(wantedFocusId);
    else if (displayData.rootId) focus(displayData.rootId, 0);
    const onContextLost = (event: Event) => { event.preventDefault(); setWebglFailed(true); };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    const resize = () => { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h); camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
    let dragging = false, moved = false, lastX = 0, lastY = 0;
    let panning = false;
    const down = (e: PointerEvent) => { dragging = true; panning = panModeRef.current || e.button === 2 || e.shiftKey; moved = false; lastX = e.clientX; lastY = e.clientY; renderer.domElement.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => { if (!dragging) return; const dx = e.clientX - lastX, dy = e.clientY - lastY; if (Math.abs(dx) + Math.abs(dy) > 2) moved = true; lastX = e.clientX; lastY = e.clientY; if (moved && panning) { camera.updateMatrixWorld(); const direction = new THREE.Vector3(); camera.getWorldDirection(direction); const right = direction.clone().cross(camera.up).normalize(); const scale = controls.radius * .002; controls.target.addScaledVector(right, -dx * scale).addScaledVector(camera.up, dy * scale); } else if (moved) { controls.theta -= dx * .006; controls.phi = THREE.MathUtils.clamp(controls.phi + dy * .006, .16, Math.PI - .16); } };
    const up = (e: PointerEvent) => { dragging = false; if (moved || panning) { panning = false; return; } const rect = renderer.domElement.getBoundingClientRect(); pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1); raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects([...meshes.values()])[0]?.object as THREE.Sprite | undefined; const id = hit?.userData.personId as string | undefined; if (id) setSelected(personById.get(id) ?? null); };
    const wheel = (e: WheelEvent) => { e.preventDefault(); controls.radius = THREE.MathUtils.clamp(controls.radius * (1 + e.deltaY * .001), 4, controls.maxRadius); };
    const context = (e: Event) => e.preventDefault();
    renderer.domElement.addEventListener("pointerdown", down); renderer.domElement.addEventListener("pointermove", move); renderer.domElement.addEventListener("pointerup", up); renderer.domElement.addEventListener("wheel", wheel, { passive: false }); renderer.domElement.addEventListener("contextmenu", context);
    let frame = 0; const draw = () => { frame = requestAnimationFrame(draw); updateCamera(); renderer.render(scene, camera); }; draw();
    return () => { cancelAnimationFrame(frame); if (focusFrameRef.current != null) { cancelAnimationFrame(focusFrameRef.current); focusFrameRef.current = null; } observer.disconnect(); renderer.domElement.removeEventListener("webglcontextlost", onContextLost); renderer.domElement.removeEventListener("pointerdown", down); renderer.domElement.removeEventListener("pointermove", move); renderer.domElement.removeEventListener("pointerup", up); renderer.domElement.removeEventListener("wheel", wheel); renderer.domElement.removeEventListener("contextmenu", context); cancelPortraitLoads.forEach((cancel) => cancel()); scene.traverse((obj) => { if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) { obj.geometry?.dispose(); const mats = Array.isArray(obj.material) ? obj.material : [obj.material]; mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); } }); renderer.dispose(); renderer.domElement.remove(); sceneRef.current = null; };
  }, [displayData, positioned, personById, focus, webglFailed, scheduleState]);

  useEffect(() => {
    if (!focusPersonId) return;
    if (!sceneRef.current?.positions.has(focusPersonId)) return;
    focus(focusPersonId);
  }, [focusPersonId, focus, scheduleState]);

  if (webglFailed) return <FamilyTreeCanvas data={data} />;

  return <div className="relative h-[min(70svh,600px)] min-h-[360px] w-full overflow-hidden bg-muted/20">
    <div ref={hostRef} tabIndex={0} role="application" aria-label="3D family tree. Use arrow keys to orbit, plus and minus to zoom, Home to recenter, and Enter to inspect the centered person." onKeyDown={(event) => {
      const state = sceneRef.current; if (!state) return;
      if (event.key === "ArrowLeft") state.controls.theta -= .12;
      else if (event.key === "ArrowRight") state.controls.theta += .12;
      else if (event.key === "ArrowUp") state.controls.phi = THREE.MathUtils.clamp(state.controls.phi - .1, .16, Math.PI - .16);
      else if (event.key === "ArrowDown") state.controls.phi = THREE.MathUtils.clamp(state.controls.phi + .1, .16, Math.PI - .16);
      else if (event.key === "+" || event.key === "=") state.controls.radius = Math.max(4, state.controls.radius - 1);
      else if (event.key === "-") state.controls.radius = Math.min(state.controls.maxRadius, state.controls.radius + 1);
      else if (event.key === "Home") { event.preventDefault(); if (data.rootId) focus(data.rootId); }
      else if (event.key.toLowerCase() === "f") { event.preventDefault(); fitTree(); }
      else if (event.key === "Enter") { const closest = positioned.reduce<{ id: string; distance: number } | null>((best, item) => { const dx = item.position.x - state.controls.target.x, dy = item.position.y - state.controls.target.y, d = dx * dx + dy * dy; return !best || d < best.distance ? { id: item.person.id, distance: d } : best; }, null); if (closest) setSelected(personById.get(closest.id) ?? null); }
      else return;
      event.preventDefault();
    }} className="absolute inset-0 touch-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" />
    <div className="absolute inset-x-2 bottom-2 flex flex-col items-center gap-1 rounded-lg bg-background/90 p-2 shadow-sm sm:inset-x-auto sm:left-3">
      <p className="text-xs text-muted-foreground">Drag to {panMode ? "pan" : "orbit"} · Tap a person to inspect</p>
      <div className="flex flex-wrap justify-center gap-1">
        <Button variant="outline" size="icon" aria-label="Zoom in" onClick={() => { const state = sceneRef.current; if (state) state.controls.radius = Math.max(4, state.controls.radius / 1.3); }}><Plus className="size-4" /></Button>
        <Button variant="outline" size="icon" aria-label="Zoom out" onClick={() => { const state = sceneRef.current; if (state) state.controls.radius = Math.min(state.controls.maxRadius, state.controls.radius * 1.3); }}><Minus className="size-4" /></Button>
        <Button variant={panMode ? "default" : "outline"} size="icon" aria-label="Pan instead of orbit" aria-pressed={panMode} onClick={() => { panModeRef.current = !panModeRef.current; setPanMode(panModeRef.current); }}><Hand className="size-4" /></Button>
        <Button variant="outline" size="icon" aria-label="Fit full tree" onClick={fitTree}><Maximize2 className="size-4" /></Button>
        <Button variant="outline" size="icon" aria-label="Recenter on starting person" onClick={() => { if (data.rootId) focus(data.rootId); }}><RotateCcw className="size-4" /></Button>
      </div>
    </div>
    {selected && <div className="absolute inset-x-3 top-3 z-10 max-h-[calc(100%-7rem)] overflow-y-auto sm:left-auto sm:w-80 rounded-xl border bg-card/95 p-4 shadow-xl backdrop-blur">
      <div className="flex items-start gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">{selected.photoUrl ? <Image src={selected.photoUrl} alt="" width={48} height={48} unoptimized className="h-full w-full object-cover" /> : <UserRound className="h-5 w-5 text-muted-foreground" />}</div><div className="min-w-0 flex-1"><p className="font-semibold leading-tight">{selected.displayName}</p><p className="mt-1 text-xs text-muted-foreground">{selected.birthYear ?? "?"} – {selected.deathYear ?? "no death recorded"}{selected.generation != null ? ` · Gen ${selected.generation}` : ""}</p></div><button className="flex size-11 shrink-0 items-center justify-center" aria-label="Close profile" onClick={() => setSelected(null)}><X className="h-4 w-4" /></button></div>
      {selected.spouseNames.length > 0 && <p className="mt-3 text-xs text-muted-foreground">Spouse: {selected.spouseNames.join(", ")}</p>}
      {can("people.view") && <Button asChild variant="outline" size="sm" className="mt-3 w-full"><Link href={`/people/${selected.id}`}>View Full Profile <ExternalLink className="ml-2 h-3 w-3" /></Link></Button>}
    </div>}
  </div>;
}
