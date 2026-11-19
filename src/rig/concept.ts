// Reusable sculpted 3D architectural instruments and synchronized View A inspector lenses for
// abstract concepts and systems theories, built directly on Visualize's rig (src/rig).
//
// Why this exists: basic box-on-slab scenes hid structure behind identical grey cubes. These
// instruments give abstract entities — orchestrators, worker agents, memory/context stacks,
// tool valves, artifact vaults, 3D routed conduits and live execution timelines — the exact
// continuous-shaded ink-monograph craft of the machine rigs (Rear Derailleur, Escalator, Lock).

import { axesOf, screenOf, type Camera } from "./camera.ts";
import { contactShadow, drawMesh, keyLight, linesOn } from "./draw.ts";
import { chamferPlate, circlePoints, planeOf, plate, regularPolygon, rod, roundedRect, turned, type Plane } from "./shapes.ts";
import { add, n1, pathThrough, scale, sub, type P2, type V3 } from "./vec.ts";

const Z_UP: V3 = [0, 0, 1];
const X_DIR: V3 = [1, 0, 0];

/** Horizontal plane at elevation z with u = +x, v = +y, n = +z. */
export const floorPlane = (z = 0, ox = 0, oy = 0): Plane => planeOf([ox, oy, z], Z_UP, X_DIR);

/** Escape XML special characters for inline SVG text. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Default contact shadow offset pushed away from the camera key light. */
export function shadowVector(cam: Camera, dist = 2.6): V3 {
  const ax = axesOf(cam.azimuth, cam.elevation);
  const L = keyLight(ax);
  return scale(L, -dist);
}

// ---------------------------------------------------------------- Architectural 3D Instruments

export interface DeckOptions {
  /** Centre [x, y] and top-surface elevation z. */
  center: V3;
  w: number;
  d: number;
  thickness?: number;
  bevel?: number;
  corner?: number;
  material?: string;
  gridStep?: number;
  standoffs?: boolean;
  standoffH?: number;
  shadow?: boolean;
}

/**
 * A chamfered architectural tier (Control Plane, Execution Plane, Tool/Memory Plane) with subtle
 * projected blueprint rules and optional corner standoffs.
 */
export function deckTier(cam: Camera, o: DeckOptions): string {
  const th = o.thickness ?? 3.6;
  const bev = o.bevel ?? 0.9;
  const r = o.corner ?? 4.5;
  const pl = floorPlane(o.center[2] - th, o.center[0], o.center[1]);
  const outer = roundedRect(o.w, o.d, r, 0, 0, 5);
  const slab = chamferPlate(pl, outer, 0, th, bev);
  let out = "";
  if (o.shadow !== false) out += contactShadow(slab, cam, shadowVector(cam, 3.2));
  if (o.standoffs) {
    const sh = o.standoffH ?? 16;
    const ox = o.w / 2 - 7, oy = o.d / 2 - 7;
    for (const [sx, sy] of [[-ox, -oy], [ox, -oy], [-ox, oy], [ox, oy]] as const) {
      const p0: V3 = [o.center[0] + sx, o.center[1] + sy, o.center[2] - th - sh];
      const p1: V3 = [o.center[0] + sx, o.center[1] + sy, o.center[2] - th];
      out += drawMesh(rod(p0, p1, 1.3, 12), cam, { material: "steel", shine: true });
    }
  }
  out += drawMesh(slab, cam, { material: o.material ?? "frame", shine: false, crease: 26 });
  if (o.gridStep && o.gridStep > 0) {
    const segs: [V3, V3][] = [];
    const zTop = o.center[2] + 0.05;
    const hw = o.w / 2 - bev - 3, hd = o.d / 2 - bev - 3;
    for (let x = -Math.floor(hw / o.gridStep) * o.gridStep; x <= hw; x += o.gridStep) {
      segs.push([[o.center[0] + x, o.center[1] - hd, zTop], [o.center[0] + x, o.center[1] + hd, zTop]]);
    }
    for (let y = -Math.floor(hd / o.gridStep) * o.gridStep; y <= hd; y += o.gridStep) {
      segs.push([[o.center[0] - hw, o.center[1] + y, zTop], [o.center[0] + hw, o.center[1] + y, zTop]]);
    }
    out += linesOn(cam, segs, "rig-deck-grid");
  }
  return out;
}

export interface HubOptions {
  r?: number;
  h?: number;
  material?: string;
  bezelMaterial?: string;
  coreMaterial?: string;
  /** Dial indicator angle in radians (rotates live while planning/routing). */
  phase?: number;
}

/**
 * A sculpted octagonal machined controller / orchestrator hub with chamfered housing, raised
 * metallic bezel ring, recessed telemetry dome and directional phase pointer.
 */
export function hubChassis(cam: Camera, base: V3, o: HubOptions = {}): string {
  const r = o.r ?? 17;
  const h = o.h ?? 11;
  const pl = floorPlane(base[2], base[0], base[1]);
  const body = chamferPlate(pl, regularPolygon(8, r, 0, 0, Math.PI / 8), 0, h, 1.8);
  const collar = turned(add(base, [0, 0, h]), Z_UP, [[0, r * 0.7], [1.4, r * 0.7], [2.4, r * 0.58], [2.4, r * 0.44]], 32);
  const dome = turned(add(base, [0, 0, h + 1.0]), Z_UP, [[0, r * 0.43], [1.8, r * 0.43], [2.8, r * 0.3], [3.0, 0.2]], 28);
  const ticks: [V3, V3][] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ticks.push([
      add(base, [Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72, h + 0.1]),
      add(base, [Math.cos(a) * r * 0.88, Math.sin(a) * r * 0.88, h + 0.1]),
    ]);
  }
  const ph = o.phase ?? 0;
  const needle: [V3, V3][] = [[
    add(base, [0, 0, h + 4.1]),
    add(base, [Math.cos(ph) * r * 0.52, Math.sin(ph) * r * 0.52, h + 4.1]),
  ]];
  return (
    contactShadow(body, cam, shadowVector(cam, 2.8))
    + drawMesh(body, cam, { material: o.material ?? "obsidian", shine: true })
    + linesOn(cam, ticks, "rig-crease")
    + drawMesh(collar, cam, { material: o.bezelMaterial ?? "alloy", shine: true })
    + drawMesh(dome, cam, { material: o.coreMaterial ?? "cobalt", shine: true })
    + linesOn(cam, needle, "rig-needle")
  );
}

export interface BladeOptions {
  w?: number;
  d?: number;
  h?: number;
  material?: string;
  hoodMaterial?: string;
  beaconMaterial?: string;
  fins?: number;
}

/**
 * A sculpted specialist compute / worker agent blade: chamfered plinth, machined upper hood with
 * ventilation fins, and a turned status beacon whose material reflects real-time state.
 */
export function agentBlade(cam: Camera, base: V3, o: BladeOptions = {}): string {
  const w = o.w ?? 26, d = o.d ?? 18, h = o.h ?? 9;
  const pl = floorPlane(base[2], base[0], base[1]);
  const plinth = chamferPlate(pl, roundedRect(w, d, 2.8), 0, 2.6, 0.6);
  const hood = chamferPlate(floorPlane(base[2] + 2.6, base[0], base[1]), roundedRect(w - 2.6, d - 2.6, 2.2), 0, h - 2.6, 1.3);
  const beacon = turned(add(base, [-w * 0.28, 0, h]), Z_UP, [[0, 3.1], [0.9, 3.1], [1.9, 2.5], [2.2, 0.2]], 24);
  const fins = o.fins ?? 4;
  const ribs: [V3, V3][] = [];
  for (let i = 0; i < fins; i++) {
    const u = (i / Math.max(1, fins - 1)) * 2 - 1;
    const x = base[0] + w * 0.04 + u * (w * 0.24);
    ribs.push([[x, base[1] - d * 0.28, base[2] + h + 0.05], [x, base[1] + d * 0.28, base[2] + h + 0.05]]);
  }
  return (
    contactShadow(plinth, cam, shadowVector(cam, 2.4))
    + drawMesh(plinth, cam, { material: o.material ?? "slate", shine: false })
    + drawMesh(hood, cam, { material: o.hoodMaterial ?? "ceramic", shine: true })
    + linesOn(cam, ribs, "rig-crease")
    + drawMesh(beacon, cam, { material: o.beaconMaterial ?? "cobalt", shine: true })
  );
}

export interface WaferStackOptions {
  /** Number of filled wafer slices currently in the stack. */
  count: number;
  /** Safe threshold slice count (draws a red collar on the capacity post here). */
  capCount: number;
  w?: number;
  d?: number;
  sliceH?: number;
  gap?: number;
  material?: string;
  overMaterial?: string;
  postSide?: -1 | 1;
}

/**
 * A counted vertical stack of chamfered memory / context-window wafers next to a calibrated
 * capacity gauge post. Slices beyond `capCount` shift to `overMaterial` (ruby), making overflow
 * or context rot immediately unmistakable in 3D.
 */
export function waferStack(cam: Camera, base: V3, o: WaferStackOptions): string {
  const w = o.w ?? 12, d = o.d ?? 12, sh = o.sliceH ?? 2.0, gap = o.gap ?? 0.7;
  const pitch = sh + gap;
  const side = o.postSide ?? -1;
  const tray = chamferPlate(floorPlane(base[2], base[0], base[1]), roundedRect(w + 2.4, d + 2.4, 1.8), 0, 1.8, 0.45);
  const capZ = base[2] + 1.8 + o.capCount * pitch;
  const postH = Math.max(capZ - base[2] + 2.5, 1.8 + o.count * pitch + 1.5);
  const postAt = add(base, [side * (w / 2 + 2.6), 0, 0]);
  const post = rod(postAt, add(postAt, [0, 0, postH]), 0.85, 12);
  const collar = turned(add(postAt, [0, 0, capZ - base[2] - 0.7]), Z_UP, [[0, 1.8], [1.4, 1.8]], 16);

  let out = contactShadow(tray, cam, shadowVector(cam, 1.8))
    + drawMesh(tray, cam, { material: "steel", shine: false })
    + drawMesh(post, cam, { material: "alloy", shine: true })
    + drawMesh(collar, cam, { material: "ruby", shine: true });

  for (let i = 0; i < o.count; i++) {
    const z = base[2] + 1.9 + i * pitch;
    const mat = i >= o.capCount ? (o.overMaterial ?? "ruby") : (o.material ?? "cobalt");
    const wafer = chamferPlate(floorPlane(z, base[0], base[1]), roundedRect(w, d, 1.4), 0, sh, 0.35);
    out += drawMesh(wafer, cam, { material: mat, shine: true, crease: 35 });
  }
  return out;
}

export interface ValveOptions {
  r?: number;
  h?: number;
  bodyMaterial?: string;
  collarMaterial?: string;
  capMaterial?: string;
}

/**
 * A turned flanged cylindrical gate / tool-port / external-API valve with specular metallic
 * collar and semantic status cap (idle slate, busy amber, pass teal, fault ruby).
 */
export function portValve(cam: Camera, base: V3, o: ValveOptions = {}): string {
  const r = o.r ?? 8.5, h = o.h ?? 9;
  const body = turned(base, Z_UP, [[0, r], [1.8, r], [2.4, r * 0.78], [h - 2.2, r * 0.78], [h - 1.5, r * 0.9], [h, r * 0.9]], 28);
  const cap = turned(add(base, [0, 0, h]), Z_UP, [[0, r * 0.62], [1.4, r * 0.62], [2.2, r * 0.45], [2.4, 0.2]], 24);
  const flange = plate(floorPlane(base[2] + 1.8, base[0], base[1]), { outer: circlePoints(r * 1.04, 28), holes: [circlePoints(r * 0.76, 24)] }, 0, 0.9);
  return (
    contactShadow(body, cam, shadowVector(cam, 2.0))
    + drawMesh(body, cam, { material: o.bodyMaterial ?? "steel", shine: true })
    + drawMesh(flange, cam, { material: o.collarMaterial ?? "brass", shine: true })
    + drawMesh(cap, cam, { material: o.capMaterial ?? "amber", shine: true })
  );
}

export interface VaultOptions {
  r?: number;
  h?: number;
  material?: string;
  ringMaterial?: string;
  capMaterial?: string;
}

/** A stepped cylindrical shared artifact / ledger / memory vault with recessed groove rings. */
export function vaultCore(cam: Camera, base: V3, o: VaultOptions = {}): string {
  const r = o.r ?? 13, h = o.h ?? 13;
  const prof: P2[] = [
    [0, r], [2.2, r], [2.6, r * 0.88], [5.4, r * 0.88], [5.8, r * 0.96],
    [8.6, r * 0.96], [9.0, r * 0.86], [h - 1.4, r * 0.86], [h, r * 0.76],
  ];
  const body = turned(base, Z_UP, prof, 32);
  const seal = turned(add(base, [0, 0, h]), Z_UP, [[0, r * 0.56], [1.6, r * 0.56], [2.2, r * 0.42]], 24);
  return (
    contactShadow(body, cam, shadowVector(cam, 2.4))
    + drawMesh(body, cam, { material: o.material ?? "alloy", shine: true })
    + drawMesh(seal, cam, { material: o.capMaterial ?? "teal", shine: true })
  );
}

// ---------------------------------------------------------------- 3D Conduits & Sliding Shuttles

/** Arc-length parameterized point and tangent along a 3D polyline at u in [0, 1]. */
export function samplePath(pts: readonly V3[], u: number): { point: V3; dir: V3 } {
  if (pts.length < 2) return { point: pts[0] ?? [0, 0, 0], dir: [1, 0, 0] };
  const segs: number[] = [];
  let total = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const d = sub(pts[i + 1]!, pts[i]!);
    const L = Math.hypot(d[0], d[1], d[2]);
    segs.push(L);
    total += L;
  }
  const target = Math.max(0, Math.min(1, u)) * total;
  let acc = 0;
  for (let i = 0; i < segs.length; i++) {
    const L = segs[i]!;
    if (acc + L >= target - 1e-9 || i === segs.length - 1) {
      const f = L > 1e-9 ? Math.max(0, Math.min(1, (target - acc) / L)) : 0;
      const a = pts[i]!, b = pts[i + 1]!;
      const d = sub(b, a);
      const inv = 1 / (L || 1);
      return {
        point: [a[0] + d[0] * f, a[1] + d[1] * f, a[2] + d[2] * f],
        dir: [d[0] * inv, d[1] * inv, d[2] * inv],
      };
    }
    acc += L;
  }
  return { point: pts[pts.length - 1]!, dir: [1, 0, 0] };
}

/** Crisp 3D routed architectural bus conduit (casing + live signal inner line). */
export function conduitSvg(cam: Camera, pts: readonly V3[], opts: { className?: string; active?: boolean; tone?: string } = {}): string {
  const ax = axesOf(cam.azimuth, cam.elevation);
  const spts = pts.map((p) => screenOf(cam, p, ax));
  const d = pathThrough(spts, false);
  const tone = opts.tone ?? "cobalt";
  const cls = `rig-conduit${opts.active ? ` is-active is-${tone}` : ""}${opts.className ? " " + opts.className : ""}`;
  return `<g class="${cls}"><path class="rig-conduit-outer" d="${d}"/><path class="rig-conduit-inner" d="${d}"/></g>`;
}

/** A 3D faceted shuttle capsule riding a conduit (task envelope, tool call, summary, or error). */
export function shuttleSvg(cam: Camera, at: V3, opts: { r?: number; h?: number; material?: string } = {}): string {
  const r = opts.r ?? 3.6, h = opts.h ?? 3.2;
  const pl = floorPlane(at[2] - h / 2, at[0], at[1]);
  const mesh = chamferPlate(pl, regularPolygon(6, r, 0, 0, 0), 0, h, 0.9);
  return contactShadow(mesh, cam, shadowVector(cam, 1.6)) + drawMesh(mesh, cam, { material: opts.material ?? "subject", shine: true });
}

// ---------------------------------------------------------------- Synchronized View A Inspector

export interface InspectorBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Editorial monograph frame for a synchronized View A concept lens (matches Derailleur's View A). */
export function inspectorFrame(box: InspectorBox, title: string, subtitle?: string): string {
  const { x, y, w, h } = box;
  const hdr = 320;
  return `<g class="lens-frame">`
    + `<rect class="lens-bg" x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="90"/>`
    + `<path class="lens-rule" d="M${n1(x)},${n1(y + hdr)}H${n1(x + w)}"/>`
    + `<text class="lens-title" x="${n1(x + 120)}" y="${n1(y + 215)}">${esc(title)}</text>`
    + (subtitle ? `<text class="lens-sub" x="${n1(x + w - 120)}" y="${n1(y + 215)}" text-anchor="end">${esc(subtitle)}</text>` : "")
    + `<rect class="lens-border" x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="90"/>`
    + `</g>`;
}

export interface GanttSegment {
  t0: number;
  t1: number;
  kind: "think" | "tool" | "retry" | "verify" | "synth";
  label?: string;
}

export interface GanttLane {
  name: string;
  segments: readonly GanttSegment[];
}

/**
 * Live synchronized Gantt execution timeline drawn inside View A.
 * Draws each lane's spans up to `tNow`, with ghosted upcoming spans, a crisp playhead needle at
 * `tNow`, and a wall-clock scale ruler at the bottom.
 */
export function ganttTraceSvg(box: InspectorBox, o: { lanes: readonly GanttLane[]; tNow: number; tMax: number; unit?: string; ticks?: readonly number[] }): string {
  const { x, y, w, h } = box;
  const labelW = Math.min(1080, w * 0.27);
  const padR = 140, padT = 90, padB = 260;
  const plotX = x + labelW, plotW = w - labelW - padR;
  const plotY = y + padT, plotH = h - padT - padB;
  const n = Math.max(1, o.lanes.length);
  const rowH = plotH / n;
  const barH = Math.min(180, rowH * 0.58);
  const sx = (t: number) => plotX + (Math.max(0, Math.min(o.tMax, t)) / Math.max(1e-6, o.tMax)) * plotW;

  let svg = `<g class="lens-gantt">`;
  // Vertical grid ticks
  const ticks = o.ticks ?? [0, o.tMax * 0.25, o.tMax * 0.5, o.tMax * 0.75, o.tMax];
  for (const tk of ticks) {
    const gx = sx(tk);
    svg += `<path class="lens-grid" d="M${n1(gx)},${n1(plotY)}V${n1(plotY + plotH)}"/>`;
    const txt = `${(tk / 1000).toFixed(tk % 1000 === 0 ? 0 : 1)}${o.unit ?? "s"}`;
    svg += `<text class="lens-tick" x="${n1(gx)}" y="${n1(plotY + plotH + 170)}" text-anchor="middle">${esc(txt)}</text>`;
  }
  // Lanes
  o.lanes.forEach((lane, i) => {
    const cy = plotY + (i + 0.5) * rowH;
    svg += `<path class="lens-lane-rule" d="M${n1(plotX)},${n1(cy)}H${n1(plotX + plotW)}"/>`;
    svg += `<text class="lens-lane-name" x="${n1(plotX - 90)}" y="${n1(cy + 45)}" text-anchor="end">${esc(lane.name)}</text>`;
    for (const seg of lane.segments) {
      const x0 = sx(seg.t0), x1 = sx(seg.t1), bw = Math.max(12, x1 - x0);
      // Ghost outline of full scheduled bar
      svg += `<rect class="lens-bar-ghost" x="${n1(x0)}" y="${n1(cy - barH / 2)}" width="${n1(bw)}" height="${n1(barH)}" rx="28"/>`;
      // Filled active progress up to tNow
      if (o.tNow > seg.t0) {
        const curX = sx(Math.min(o.tNow, seg.t1));
        const fw = Math.max(10, curX - x0);
        svg += `<rect class="lens-bar lens-k-${seg.kind}" x="${n1(x0)}" y="${n1(cy - barH / 2)}" width="${n1(fw)}" height="${n1(barH)}" rx="28"/>`;
      }
    }
  });
  // Live playhead cursor
  const px = sx(o.tNow);
  svg += `<path class="lens-playhead" d="M${n1(px)},${n1(plotY - 40)}V${n1(plotY + plotH + 30)}"/>`;
  svg += `<circle class="lens-playhead-dot" cx="${n1(px)}" cy="${n1(plotY - 40)}" r="34"/>`;
  svg += `</g>`;
  return svg;
}

export interface BudgetRow {
  label: string;
  value: number;
  tone?: "cobalt" | "teal" | "amber" | "ruby" | "subject";
}

/**
 * Live horizontal capacity / context-window budget gauge with dashed threshold cliff line.
 */
export function budgetMetersSvg(box: InspectorBox, o: { rows: readonly BudgetRow[]; cap: number; maxScale: number; unit?: string; capLabel?: string }): string {
  const { x, y, w, h } = box;
  const labelW = Math.min(1080, w * 0.27);
  const valW = 540;
  const plotX = x + labelW, plotW = w - labelW - valW;
  const padT = 170, padB = 80;
  const plotY = y + padT, plotH = h - padT - padB;
  const n = Math.max(1, o.rows.length);
  const rowH = plotH / n;
  const barH = Math.min(150, rowH * 0.56);
  const sx = (v: number) => plotX + (Math.max(0, Math.min(o.maxScale, v)) / Math.max(1e-6, o.maxScale)) * plotW;

  let svg = `<g class="lens-budget">`;
  const capX = sx(o.cap);
  svg += `<path class="lens-cap-line" d="M${n1(capX)},${n1(plotY - 50)}V${n1(plotY + plotH + 30)}"/>`;
  svg += `<text class="lens-cap-label" x="${n1(capX)}" y="${n1(plotY - 80)}" text-anchor="middle">${esc(o.capLabel ?? `${o.cap}${o.unit ?? ""} cliff`)}</text>`;
  o.rows.forEach((row, i) => {
    const cy = plotY + (i + 0.5) * rowH;
    const over = row.value > o.cap;
    const tone = over ? "ruby" : (row.tone ?? "cobalt");
    const fw = Math.max(0, sx(row.value) - plotX);
    svg += `<text class="lens-lane-name" x="${n1(plotX - 90)}" y="${n1(cy + 44)}" text-anchor="end">${esc(row.label)}</text>`;
    svg += `<rect class="lens-bar-ghost" x="${n1(plotX)}" y="${n1(cy - barH / 2)}" width="${n1(plotW)}" height="${n1(barH)}" rx="24"/>`;
    if (fw > 1) svg += `<rect class="lens-bar lens-k-${tone}" x="${n1(plotX)}" y="${n1(cy - barH / 2)}" width="${n1(fw)}" height="${n1(barH)}" rx="24"/>`;
    const valTxt = `${row.value.toFixed(1)}${o.unit ?? ""}`;
    svg += `<text class="lens-val${over ? " is-over" : ""}" x="${n1(plotX + plotW + 80)}" y="${n1(cy + 44)}">${esc(valTxt)}</text>`;
  });
  svg += `</g>`;
  return svg;
}
