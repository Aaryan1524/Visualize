/**
 * Engine C — Editorial System & Algorithm Kit
 *
 * Stripe / Linear-grade 2D editorial diagram renderer built for computer science
 * structures, algorithms, protocols, math proofs, and distributed systems.
 *
 * Dual-layer architecture:
 *   - 2D Canvas backdrop: warm studio paper / obsidian mat, camera-locked 24px
 *     architectural dot-grid, and subtle motion trails for animated packets.
 *   - Crisp aligned `<svg class="ec-svg">` overlay: retina typography, rounded
 *     editorial cards, contiguous array rows, dashed architectural zones,
 *     zero-overlap orthogonal rounded connectors, and glowing data packets.
 */

/* -------------------------------------------------------------------------- */
/*  Color Lock & Theme Palettes                                               */
/* -------------------------------------------------------------------------- */

export const MONOCHROME_TOKENS = {
  clayLight: "#f7f6f2",
  clayMid: "#ebe9e2",
  clayDark: "#d4d1c7",
  graphite: "#2d3036",
} as const;

export const ACCENT_TOKENS = {
  orange: "#e05a1e",
  cobalt: "#2563eb",
  ember: "#ef4444",
  teal: "#0d9488",
  gold: "#d69624",
} as const;

export type MonochromeKey = keyof typeof MONOCHROME_TOKENS;
export type AccentKey = keyof typeof ACCENT_TOKENS;
export type StudioTheme = "light" | "dark";

export interface TactilePalette {
  plateFill: string;
  plateStroke: string;
  wellFill: string;
  wellStroke: string;
  wellInsetLine: string;
  wellNumeral: string;
  tileFill: string;
  tileStroke: string;
  tileTopHighlight: string;
  tileInk: string;
  tileSubInk: string;
  emptyKeyInk: string;
  eyebrowInk: string;
  tickInk: string;
  linkTickInk: string;
  threadInactive: string;
  evictEdgeLine: string;
  pipeTrack: string;
}

export interface ThemePalette {
  bg: string;
  bgInner: string;
  bgOuter: string;
  dot: string;
  dotMajor: string;
  cardFill: Record<MonochromeKey, string>;
  cardStroke: string;
  cardStrokeStrong: string;
  ink: string;
  inkSecondary: string;
  inkMuted: string;
  inkOnGraphite: string;
  zoneFill: string;
  zoneStroke: string;
  connectorStroke: string;
  connectorHalo: string;
  pillBg: string;
  pillStroke: string;
  arrayHeaderBg: string;
  arrayCellBg: string;
  arrayDivider: string;
  shadowColor: string;
  shadowOpacity: number;
  accents: Record<AccentKey, string>;
  accentTints: Record<AccentKey, string>;
  tactile: TactilePalette;
}

export const THEME_PALETTES: Record<StudioTheme, ThemePalette> = {
  light: {
    bg: "#f6f5f0",
    bgInner: "#faf9f5",
    bgOuter: "#ecebe4",
    dot: "rgba(27, 27, 25, 0.095)",
    dotMajor: "rgba(27, 27, 25, 0.175)",
    cardFill: {
      clayLight: MONOCHROME_TOKENS.clayLight,
      clayMid: MONOCHROME_TOKENS.clayMid,
      clayDark: MONOCHROME_TOKENS.clayDark,
      graphite: MONOCHROME_TOKENS.graphite,
    },
    cardStroke: "rgba(45, 48, 54, 0.16)",
    cardStrokeStrong: "rgba(45, 48, 54, 0.30)",
    ink: "#16171a",
    inkSecondary: "#5b5e66",
    inkMuted: "#81858f",
    inkOnGraphite: "#f7f6f2",
    zoneFill: "rgba(235, 233, 226, 0.38)",
    zoneStroke: "rgba(45, 48, 54, 0.22)",
    connectorStroke: "rgba(45, 48, 54, 0.44)",
    connectorHalo: "rgba(246, 245, 240, 0.88)",
    pillBg: "#f7f6f2",
    pillStroke: "rgba(45, 48, 54, 0.18)",
    arrayHeaderBg: "#ebe9e2",
    arrayCellBg: "#f7f6f2",
    arrayDivider: "rgba(45, 48, 54, 0.14)",
    shadowColor: "#121418",
    shadowOpacity: 0.08,
    accents: {
      orange: ACCENT_TOKENS.orange,
      cobalt: ACCENT_TOKENS.cobalt,
      ember: ACCENT_TOKENS.ember,
      teal: ACCENT_TOKENS.teal,
      gold: ACCENT_TOKENS.gold,
    },
    accentTints: {
      orange: "rgba(224, 90, 30, 0.11)",
      cobalt: "rgba(37, 99, 235, 0.10)",
      ember: "rgba(239, 68, 68, 0.11)",
      teal: "rgba(13, 148, 136, 0.11)",
      gold: "rgba(214, 150, 36, 0.12)",
    },
    tactile: {
      plateFill: "#f0eee6",
      plateStroke: "rgba(27, 27, 25, 0.11)",
      wellFill: "#eae7de",
      wellStroke: "rgba(27, 27, 25, 0.11)",
      wellInsetLine: "rgba(27, 27, 25, 0.12)",
      wellNumeral: "rgba(27, 27, 25, 0.28)",
      tileFill: "#fbfaf6",
      tileStroke: "#d1cec3",
      tileTopHighlight: "rgba(255, 255, 255, 0.88)",
      tileInk: "#1b1b19",
      tileSubInk: "rgba(27, 27, 25, 0.50)",
      emptyKeyInk: "rgba(27, 27, 25, 0.34)",
      eyebrowInk: "rgba(27, 27, 25, 0.45)",
      tickInk: "rgba(27, 27, 25, 0.40)",
      linkTickInk: "rgba(27, 27, 25, 0.32)",
      threadInactive: "rgba(27, 27, 25, 0.14)",
      evictEdgeLine: "rgba(27, 27, 25, 0.24)",
      pipeTrack: "rgba(27, 27, 25, 0.10)",
    },
  },
  dark: {
    bg: "#111317",
    bgInner: "#181c23",
    bgOuter: "#0b0d10",
    dot: "rgba(255, 255, 255, 0.06)",
    dotMajor: "rgba(255, 255, 255, 0.125)",
    cardFill: {
      clayLight: "#1a1d24",
      clayMid: "#21252f",
      clayDark: "#2a2f3b",
      graphite: "#333947",
    },
    cardStroke: "rgba(255, 255, 255, 0.12)",
    cardStrokeStrong: "rgba(255, 255, 255, 0.24)",
    ink: "#f2f2ef",
    inkSecondary: "#a3a7b2",
    inkMuted: "#747986",
    inkOnGraphite: "#f7f6f2",
    zoneFill: "rgba(26, 29, 36, 0.44)",
    zoneStroke: "rgba(255, 255, 255, 0.15)",
    connectorStroke: "rgba(226, 230, 240, 0.44)",
    connectorHalo: "rgba(17, 19, 23, 0.88)",
    pillBg: "#1a1d24",
    pillStroke: "rgba(255, 255, 255, 0.16)",
    arrayHeaderBg: "#222631",
    arrayCellBg: "#1a1d24",
    arrayDivider: "rgba(255, 255, 255, 0.11)",
    shadowColor: "#000000",
    shadowOpacity: 0.42,
    accents: {
      orange: "#f2733b",
      cobalt: "#60a5fa",
      ember: "#f87171",
      teal: "#2dd4bf",
      gold: "#eab308",
    },
    accentTints: {
      orange: "rgba(242, 115, 59, 0.16)",
      cobalt: "rgba(96, 165, 250, 0.15)",
      ember: "rgba(248, 113, 113, 0.16)",
      teal: "rgba(45, 212, 191, 0.15)",
      gold: "rgba(234, 179, 8, 0.16)",
    },
    tactile: {
      plateFill: "#161a21",
      plateStroke: "rgba(255, 255, 255, 0.08)",
      wellFill: "#191d24",
      wellStroke: "rgba(255, 255, 255, 0.09)",
      wellInsetLine: "rgba(0, 0, 0, 0.45)",
      wellNumeral: "rgba(236, 234, 226, 0.24)",
      tileFill: "#eceae2",
      tileStroke: "rgba(255, 255, 255, 0.24)",
      tileTopHighlight: "rgba(255, 255, 255, 0.70)",
      tileInk: "#1b1b19",
      tileSubInk: "rgba(27, 27, 25, 0.56)",
      emptyKeyInk: "rgba(236, 234, 226, 0.34)",
      eyebrowInk: "rgba(236, 234, 226, 0.48)",
      tickInk: "rgba(236, 234, 226, 0.44)",
      linkTickInk: "rgba(236, 234, 226, 0.34)",
      threadInactive: "rgba(236, 234, 226, 0.15)",
      evictEdgeLine: "rgba(236, 234, 226, 0.28)",
      pipeTrack: "rgba(255, 255, 255, 0.09)",
    },
  },
};

/* -------------------------------------------------------------------------- */
/*  Pure Math, Grid Snapping & Spring Physics                                 */
/* -------------------------------------------------------------------------- */

export interface Point2D {
  x: number;
  y: number;
}

export interface Rect2D {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SpringState {
  value: number;
  velocity: number;
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface Size2D {
  width: number;
  height: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
  scale: number;
  visible: boolean;
}

/**
 * Deterministically snap a coordinate value to the nearest grid increment.
 */
export function snapToGrid(value: number, grid = 16): number {
  if (!Number.isFinite(value)) return 0;
  if (!Number.isFinite(grid) || grid <= 0) return value;
  const snapped = Math.round(value / grid) * grid;
  return snapped === 0 ? 0 : snapped;
}

/**
 * Exact closed-form damped harmonic spring integrator.
 * Defaults to critical damping (`damping = 2 * sqrt(stiffness)`), guaranteeing
 * monotonic convergence without overshoot, oscillation blowup, or NaN for any `dt >= 0`.
 */
export function stepSpring(
  state: SpringState,
  target: number,
  dt: number,
  stiffness = 220,
  damping?: number,
): SpringState {
  const safeTarget = Number.isFinite(target) ? target : 0;
  const val0 = Number.isFinite(state.value) ? state.value : safeTarget;
  const vel0 = Number.isFinite(state.velocity) ? state.velocity : 0;
  const safeDt = Number.isFinite(dt) ? Math.max(0, dt) : 0;

  if (safeDt === 0) {
    return { value: val0, velocity: vel0 };
  }

  const k = Number.isFinite(stiffness) && stiffness > 0 ? stiffness : 220;
  const omega = Math.sqrt(k);
  const c =
    damping != null && Number.isFinite(damping) && damping >= 0
      ? damping
      : 2 * omega;
  const zeta = c / (2 * omega);

  const x0 = val0 - safeTarget;
  const v0 = vel0;

  let x: number;
  let v: number;

  if (Math.abs(zeta - 1) < 1e-4) {
    // Critically damped closed form
    const exp = Math.exp(-omega * safeDt);
    const b = v0 + omega * x0;
    x = (x0 + b * safeDt) * exp;
    v = (v0 - omega * b * safeDt) * exp;
  } else if (zeta < 1) {
    // Underdamped closed form
    const wd = omega * Math.sqrt(Math.max(1e-9, 1 - zeta * zeta));
    const exp = Math.exp(-zeta * omega * safeDt);
    const cos = Math.cos(wd * safeDt);
    const sin = Math.sin(wd * safeDt);
    const A = x0;
    const B = (v0 + zeta * omega * x0) / wd;
    x = exp * (A * cos + B * sin);
    v =
      exp *
      ((-zeta * omega * A + wd * B) * cos + (-zeta * omega * B - wd * A) * sin);
  } else {
    // Overdamped closed form
    const s = omega * Math.sqrt(Math.max(1e-9, zeta * zeta - 1));
    const r1 = -zeta * omega + s;
    const r2 = -zeta * omega - s;
    const denom = r1 - r2;
    const c1 = (v0 - r2 * x0) / denom;
    const c2 = x0 - c1;
    const e1 = Math.exp(r1 * safeDt);
    const e2 = Math.exp(r2 * safeDt);
    x = c1 * e1 + c2 * e2;
    v = c1 * r1 * e1 + c2 * r2 * e2;
  }

  if (!Number.isFinite(x) || !Number.isFinite(v)) {
    return { value: safeTarget, velocity: 0 };
  }

  if (Math.abs(x) < 1e-4 && Math.abs(v) < 1e-4) {
    return { value: safeTarget, velocity: 0 };
  }

  return { value: safeTarget + x, velocity: v };
}

/**
 * Project a logical diagram point into viewport pixel coordinates.
 */
export function logicalToViewport(
  point: Point2D,
  camera: CameraState,
  viewport: Size2D,
  logicalSize: Size2D = { width: 1120, height: 640 },
): ProjectedPoint {
  const vw = Math.max(1, viewport.width);
  const vh = Math.max(1, viewport.height);
  const lw = Math.max(1, logicalSize.width);
  const lh = Math.max(1, logicalSize.height);
  const zoom = Number.isFinite(camera.zoom) && camera.zoom > 0.05 ? camera.zoom : 1;

  const baseScale = Math.min(vw / lw, vh / lh);
  const scale = baseScale * zoom;
  const x = vw * 0.5 + (point.x - camera.x) * scale;
  const y = vh * 0.5 + (point.y - camera.y) * scale;
  const visible = x >= -40 && x <= vw + 40 && y >= -40 && y <= vh + 40;
  return { x, y, scale, visible };
}

/**
 * Inverse projection from viewport pixel coordinates back to logical diagram coordinates.
 */
export function viewportToLogical(
  point: Point2D,
  camera: CameraState,
  viewport: Size2D,
  logicalSize: Size2D = { width: 1120, height: 640 },
): Point2D {
  const vw = Math.max(1, viewport.width);
  const vh = Math.max(1, viewport.height);
  const lw = Math.max(1, logicalSize.width);
  const lh = Math.max(1, logicalSize.height);
  const zoom = Number.isFinite(camera.zoom) && camera.zoom > 0.05 ? camera.zoom : 1;

  const baseScale = Math.min(vw / lw, vh / lh);
  const scale = Math.max(1e-6, baseScale * zoom);
  return {
    x: camera.x + (point.x - vw * 0.5) / scale,
    y: camera.y + (point.y - vh * 0.5) / scale,
  };
}

/* -------------------------------------------------------------------------- */
/*  Zero-Overlap Orthogonal Router & Polyline Sampling                        */
/* -------------------------------------------------------------------------- */

export type PortSide = "left" | "right" | "top" | "bottom" | "auto";
export type ResolvedPortSide = "left" | "right" | "top" | "bottom";

export interface RouteOrthogonalOptions {
  fromSide?: PortSide;
  toSide?: PortSide;
  radius?: number;
  padding?: number;
  stub?: number;
  bendOffset?: number;
}

export interface RoutedOrthogonalPath {
  points: Point2D[];
  path: string;
  length: number;
  midpoint: Point2D;
  fromSide: ResolvedPortSide;
  toSide: ResolvedPortSide;
}

function toRect(input: Rect2D | Point2D): Rect2D {
  if ("w" in input && "h" in input) {
    return { x: input.x, y: input.y, w: Math.max(0, input.w), h: Math.max(0, input.h) };
  }
  return { x: input.x, y: input.y, w: 0, h: 0 };
}

function rectCenter(r: Rect2D): Point2D {
  return { x: r.x + r.w * 0.5, y: r.y + r.h * 0.5 };
}

function inflateRect(r: Rect2D, pad: number): Rect2D {
  return {
    x: r.x - pad,
    y: r.y - pad,
    w: r.w + pad * 2,
    h: r.h + pad * 2,
  };
}

function rectsNearlyEqual(a: Rect2D, b: Rect2D): boolean {
  return (
    Math.abs(a.x - b.x) < 1 &&
    Math.abs(a.y - b.y) < 1 &&
    Math.abs(a.w - b.w) < 1 &&
    Math.abs(a.h - b.h) < 1
  );
}

function pointInsideRect(p: Point2D, r: Rect2D, eps = 1e-4): boolean {
  return p.x > r.x + eps && p.x < r.x + r.w - eps && p.y > r.y + eps && p.y < r.y + r.h - eps;
}

/**
 * Exact intersection check between an orthogonal (or axis-aligned) segment [a, b]
 * and an axis-aligned rectangle `r` (open interior to permit touching perimeter lanes).
 */
export function segmentIntersectsRect(a: Point2D, b: Point2D, r: Rect2D): boolean {
  const eps = 1e-3;
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);

  // Quick AABB reject
  if (maxX <= r.x + eps || minX >= r.x + r.w - eps) return false;
  if (maxY <= r.y + eps || minY >= r.y + r.h - eps) return false;

  // Horizontal segment
  if (Math.abs(a.y - b.y) <= eps) {
    return a.y > r.y + eps && a.y < r.y + r.h - eps && maxX > r.x + eps && minX < r.x + r.w - eps;
  }
  // Vertical segment
  if (Math.abs(a.x - b.x) <= eps) {
    return a.x > r.x + eps && a.x < r.x + r.w - eps && maxY > r.y + eps && minY < r.y + r.h - eps;
  }

  // Fallback Liang-Barsky for general segments
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const checks: [number, number][] = [
    [-dx, a.x - (r.x + eps)],
    [dx, r.x + r.w - eps - a.x],
    [-dy, a.y - (r.y + eps)],
    [dy, r.y + r.h - eps - a.y],
  ];
  for (const [p, q] of checks) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return t0 <= t1;
}

function resolvePortSide(
  from: Rect2D,
  to: Rect2D,
  side: PortSide | undefined,
  isTarget: boolean,
): ResolvedPortSide {
  if (side && side !== "auto") return side;
  const fc = rectCenter(from);
  const tc = rectCenter(to);
  const dx = tc.x - fc.x;
  const dy = tc.y - fc.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    if (!isTarget) return dx >= 0 ? "right" : "left";
    return dx >= 0 ? "left" : "right";
  }
  if (!isTarget) return dy >= 0 ? "bottom" : "top";
  return dy >= 0 ? "top" : "bottom";
}

function portAnchor(rect: Rect2D, side: ResolvedPortSide): Point2D {
  switch (side) {
    case "left":
      return { x: rect.x, y: rect.y + rect.h * 0.5 };
    case "right":
      return { x: rect.x + rect.w, y: rect.y + rect.h * 0.5 };
    case "top":
      return { x: rect.x + rect.w * 0.5, y: rect.y };
    case "bottom":
      return { x: rect.x + rect.w * 0.5, y: rect.y + rect.h };
  }
}

function sideNormal(side: ResolvedPortSide): Point2D {
  switch (side) {
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
    case "top":
      return { x: 0, y: -1 };
    case "bottom":
      return { x: 0, y: 1 };
  }
}

function simplifyOrthogonalPoints(raw: Point2D[]): Point2D[] {
  const dedup: Point2D[] = [];
  for (const pt of raw) {
    const prev = dedup[dedup.length - 1];
    if (!prev || Math.hypot(pt.x - prev.x, pt.y - prev.y) > 0.5) {
      dedup.push({ x: pt.x, y: pt.y });
    }
  }
  if (dedup.length <= 2) return dedup;

  const out: Point2D[] = [dedup[0]!];
  for (let i = 1; i < dedup.length - 1; i++) {
    const a = out[out.length - 1]!;
    const b = dedup[i]!;
    const c = dedup[i + 1]!;
    const sameX = Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - c.x) < 0.5;
    const sameY = Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - c.y) < 0.5;
    if (!sameX && !sameY) {
      out.push(b);
    }
  }
  out.push(dedup[dedup.length - 1]!);
  return out;
}

function pathHitsAnyRect(pts: Point2D[], rects: Rect2D[]): boolean {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    for (const r of rects) {
      if (segmentIntersectsRect(a, b, r)) return true;
    }
  }
  return false;
}

function polylineLength(pts: Point2D[]): number {
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

function countBends(pts: Point2D[]): number {
  return Math.max(0, pts.length - 2);
}

/**
 * Build a crisp rounded-corner SVG path string `d` from an orthogonal polyline.
 */
export function buildRoundedOrthogonalPath(points: Point2D[], radius = 10): string {
  if (points.length === 0) return "";
  const p0 = points[0]!;
  if (points.length === 1) return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)}`;

  const rMax = Math.max(0, radius);
  const parts: string[] = [`M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)}`];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const next = points[i + 1]!;

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const len1 = Math.hypot(dx1, dy1);
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    const len2 = Math.hypot(dx2, dy2);

    if (len1 < 1e-4 || len2 < 1e-4 || rMax <= 0.1) {
      parts.push(`L ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`);
      continue;
    }

    const r = Math.min(rMax, len1 * 0.45, len2 * 0.45);
    const inX = curr.x - (dx1 / len1) * r;
    const inY = curr.y - (dy1 / len1) * r;
    const outX = curr.x + (dx2 / len2) * r;
    const outY = curr.y + (dy2 / len2) * r;

    parts.push(`L ${inX.toFixed(2)} ${inY.toFixed(2)}`);
    parts.push(
      `Q ${curr.x.toFixed(2)} ${curr.y.toFixed(2)} ${outX.toFixed(2)} ${outY.toFixed(2)}`,
    );
  }

  const last = points[points.length - 1]!;
  parts.push(`L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`);
  return parts.join(" ");
}

/**
 * Sample an exact position and heading angle along a polyline at normalized `t ∈ [0..1]`.
 */
export function samplePolyline(
  points: Point2D[],
  t: number,
): { x: number; y: number; angle: number } {
  if (points.length === 0) return { x: 0, y: 0, angle: 0 };
  if (points.length === 1) return { x: points[0]!.x, y: points[0]!.y, angle: 0 };

  const clamped = Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 0;
  const lengths: number[] = [];
  let total = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    lengths.push(len);
    total += len;
  }

  if (total <= 1e-6) {
    const first = points[0]!;
    return { x: first.x, y: first.y, angle: 0 };
  }

  const targetDist = clamped * total;
  let accum = 0;

  for (let i = 0; i < lengths.length; i++) {
    const segLen = lengths[i]!;
    const a = points[i]!;
    const b = points[i + 1]!;
    if (accum + segLen >= targetDist || i === lengths.length - 1) {
      const localT = segLen > 1e-6 ? Math.max(0, Math.min(1, (targetDist - accum) / segLen)) : 0;
      return {
        x: a.x + (b.x - a.x) * localT,
        y: a.y + (b.y - a.y) * localT,
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      };
    }
    accum += segLen;
  }

  const last = points[points.length - 1]!;
  const prev = points[points.length - 2]!;
  return {
    x: last.x,
    y: last.y,
    angle: Math.atan2(last.y - prev.y, last.x - prev.x),
  };
}

/* -------------------------------------------------------------------------- */
/*  Smooth Cubic Bézier Threads & Kinetic Lift-Arc Pure Math                  */
/* -------------------------------------------------------------------------- */

export interface CubicBezierCurve {
  p0: Point2D;
  p1: Point2D;
  p2: Point2D;
  p3: Point2D;
  d: string;
  midpoint: Point2D;
}

/**
 * Sample an exact position and tangent heading angle along a cubic Bézier curve
 * at normalized `t ∈ [0..1]`.
 */
export function sampleCubicBezier(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  t: number,
): { x: number; y: number; angle: number } {
  const u = Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 0;
  const inv = 1 - u;
  const inv2 = inv * inv;
  const inv3 = inv2 * inv;
  const u2 = u * u;
  const u3 = u2 * u;

  const x = inv3 * p0.x + 3 * inv2 * u * p1.x + 3 * inv * u2 * p2.x + u3 * p3.x;
  const y = inv3 * p0.y + 3 * inv2 * u * p1.y + 3 * inv * u2 * p2.y + u3 * p3.y;

  const dx =
    3 * inv2 * (p1.x - p0.x) +
    6 * inv * u * (p2.x - p1.x) +
    3 * u2 * (p3.x - p2.x);
  const dy =
    3 * inv2 * (p1.y - p0.y) +
    6 * inv * u * (p2.y - p1.y) +
    3 * u2 * (p3.y - p2.y);

  const angle = Math.abs(dx) < 1e-7 && Math.abs(dy) < 1e-7 ? 0 : Math.atan2(dy, dx);
  return { x, y, angle };
}

/**
 * Build a vertical-tangent S-curve cubic Bézier arc between two points.
 * Zero right-angle zigzags, crisp vertical arrival and departure tangents.
 */
export function buildArcBezier(
  from: Point2D,
  to: Point2D,
  curveDip?: number,
): CubicBezierCurve {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const sign = dy >= 0 ? 1 : -1;
  const handle =
    curveDip != null && Number.isFinite(curveDip) && curveDip > 0
      ? curveDip
      : Math.max(38, Math.min(132, Math.abs(dy) * 0.52 + Math.abs(dx) * 0.08));

  const p0: Point2D = { x: from.x, y: from.y };
  const p1: Point2D = { x: from.x, y: from.y + sign * handle };
  const p2: Point2D = { x: to.x, y: to.y - sign * handle };
  const p3: Point2D = { x: to.x, y: to.y };

  const d = `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} C ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}, ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`;
  const mid = sampleCubicBezier(p0, p1, p2, p3, 0.5);
  return { p0, p1, p2, p3, d, midpoint: { x: mid.x, y: mid.y } };
}

/**
 * Parabolic/sinusoidal vertical lift offset for a tile arcing over neighbors.
 * Returns `0` at travel endpoints (`0` and `1`) and `-peakHeight` at midpoint (`0.5`).
 */
export function computeLiftArcOffset(travelProgress: number, peakHeight = 32): number {
  if (!Number.isFinite(travelProgress) || !Number.isFinite(peakHeight) || peakHeight <= 0) {
    return 0;
  }
  const u = Math.max(0, Math.min(1, travelProgress));
  const lift = -peakHeight * Math.sin(Math.PI * u);
  return Math.abs(lift) < 1e-6 ? 0 : lift;
}

export interface FlowPipeGeometry {
  start: Point2D;
  p1: Point2D;
  p2: Point2D;
  end: Point2D;
  d: string;
  midpoint: Point2D;
  normal: Point2D;
  labelPos: Point2D;
  endAngle: number;
  arrowPath: string;
}

/**
 * Preserves the caller's exact casing for FlowPipe labels (e.g. "SYN", "ACK 2", "seq=1").
 */
export function formatFlowPipeLabel(label: string | undefined): string {
  return label ?? "";
}

/**
 * Computes cubic Bézier curve, canonical perpendicular lane offset (so bidirectional
 * pipes between the same two endpoints using +offset / -offset run in parallel lanes
 * separated by 2*|offset| and never overlap), outward label placement, and directional
 * arrival chevron path for a FlowPipe.
 */
export function computeFlowPipeGeometry(
  from: Point2D,
  to: Point2D,
  laneOffset = 0,
): FlowPipeGeometry {
  const rawDx = to.x - from.x;
  const rawDy = to.y - from.y;
  const dist = Math.hypot(rawDx, rawDy);
  const safeOffset = Number.isFinite(laneOffset) ? laneOffset : 0;

  // Canonical undirected axis so (A->B, -14) and (B->A, +14) map to opposite sides
  let cdx = rawDx;
  let cdy = rawDy;
  if (cdx < -1e-6 || (Math.abs(cdx) <= 1e-6 && cdy < 0)) {
    cdx = -cdx;
    cdy = -cdy;
  }
  const normal: Point2D =
    dist > 1e-6 ? { x: -cdy / dist, y: cdx / dist } : { x: 0, y: 1 };

  const start: Point2D = {
    x: from.x + normal.x * safeOffset,
    y: from.y + normal.y * safeOffset,
  };
  const end: Point2D = {
    x: to.x + normal.x * safeOffset,
    y: to.y + normal.y * safeOffset,
  };

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let p1: Point2D;
  let p2: Point2D;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const h = Math.max(30, Math.abs(dx) * 0.42);
    const s = dx >= 0 ? 1 : -1;
    p1 = { x: start.x + s * h, y: start.y };
    p2 = { x: end.x - s * h, y: end.y };
  } else {
    const h = Math.max(30, Math.abs(dy) * 0.42);
    const s = dy >= 0 ? 1 : -1;
    p1 = { x: start.x, y: start.y + s * h };
    p2 = { x: end.x, y: end.y - s * h };
  }

  const d = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} C ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}, ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  const midSample = sampleCubicBezier(start, p1, p2, end, 0.5);
  const midpoint: Point2D = { x: midSample.x, y: midSample.y };

  let labelPos: Point2D;
  if (Math.abs(safeOffset) < 1e-6) {
    labelPos = { x: midpoint.x, y: midpoint.y - 10 };
  } else {
    const dir = safeOffset > 0 ? 1 : -1;
    const ox = normal.x * dir;
    const oy = normal.y * dir;
    if (Math.abs(oy) >= Math.abs(ox)) {
      labelPos = { x: midpoint.x, y: midpoint.y + (oy > 0 ? 15 : -10) };
    } else {
      labelPos = { x: midpoint.x + ox * 16, y: midpoint.y + 3 };
    }
  }

  const nearEnd = sampleCubicBezier(start, p1, p2, end, 0.995);
  const endAngle =
    dist > 1e-6
      ? Math.hypot(end.x - nearEnd.x, end.y - nearEnd.y) > 1e-6
        ? nearEnd.angle
        : Math.atan2(dy, dx)
      : 0;
  const arrowLen = 7.5;
  const arrowWing = 4.2;
  const cos = Math.cos(endAngle);
  const sin = Math.sin(endAngle);
  const lx = end.x - cos * arrowLen - sin * arrowWing;
  const ly = end.y - sin * arrowLen + cos * arrowWing;
  const rx = end.x - cos * arrowLen + sin * arrowWing;
  const ry = end.y - sin * arrowLen - cos * arrowWing;
  const arrowPath = `M ${lx.toFixed(2)} ${ly.toFixed(2)} L ${end.x.toFixed(2)} ${end.y.toFixed(2)} L ${rx.toFixed(2)} ${ry.toFixed(2)}`;

  return { start, p1, p2, end, d, midpoint, normal, labelPos, endAngle, arrowPath };
}

function dedupeSorted(values: number[], tol = 1.5): number[] {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) {
    const prev = out[out.length - 1];
    if (prev === undefined || Math.abs(v - prev) > tol) {
      out.push(v);
    }
  }
  return out;
}

/**
 * Deterministic A* shortest-bend Manhattan pathfinder on the obstacle visibility grid.
 */
function routeOrthogonalVisibilityAStar(
  start: Point2D,
  end: Point2D,
  inflatedObstacles: Rect2D[],
  fromRect: Rect2D,
  toRect: Rect2D,
  margin: number,
): Point2D[] | null {
  const rawXs: number[] = [start.x, end.x, (start.x + end.x) * 0.5];
  const rawYs: number[] = [start.y, end.y, (start.y + end.y) * 0.5];

  let minX = Math.min(start.x, end.x, fromRect.x, toRect.x);
  let maxX = Math.max(start.x, end.x, fromRect.x + fromRect.w, toRect.x + toRect.w);
  let minY = Math.min(start.y, end.y, fromRect.y, toRect.y);
  let maxY = Math.max(start.y, end.y, fromRect.y + fromRect.h, toRect.y + toRect.h);

  for (const r of inflatedObstacles) {
    rawXs.push(r.x, r.x + r.w);
    rawYs.push(r.y, r.y + r.h);
    minX = Math.min(minX, r.x);
    maxX = Math.max(maxX, r.x + r.w);
    minY = Math.min(minY, r.y);
    maxY = Math.max(maxY, r.y + r.h);
  }

  rawXs.push(minX - margin, maxX + margin);
  rawYs.push(minY - margin, maxY + margin);

  const xs = dedupeSorted(rawXs);
  const ys = dedupeSorted(rawYs);

  const findNearest = (arr: number[], v: number): number => {
    let bestIdx = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < arr.length; i++) {
      const d = Math.abs(arr[i]! - v);
      if (d < bestDiff) {
        bestDiff = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  };

  const sx = findNearest(xs, start.x);
  const sy = findNearest(ys, start.y);
  const gx = findNearest(xs, end.x);
  const gy = findNearest(ys, end.y);

  // State key: (ix, iy, dir) where dir = 0 (none), 1 (horiz), 2 (vert)
  const strideY = xs.length;
  const strideD = xs.length * ys.length;
  const encode = (ix: number, iy: number, d: number): number => d * strideD + iy * strideY + ix;

  const gScore = new Map<number, number>();
  const fScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  const openSet: number[] = [];
  const inOpen = new Set<number>();
  const closed = new Set<number>();

  const startKey = encode(sx, sy, 0);
  gScore.set(startKey, 0);
  const h0 = Math.abs(xs[gx]! - xs[sx]!) + Math.abs(ys[gy]! - ys[sy]!);
  fScore.set(startKey, h0);
  openSet.push(startKey);
  inOpen.add(startKey);

  const BEND_PENALTY = 28;
  const dirs: [number, number, number][] = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 2],
    [0, -1, 2],
  ];

  let foundKey = -1;
  let iter = 0;
  const maxIter = Math.min(12000, strideD * 6 + 200);

  while (openSet.length > 0 && iter++ < maxIter) {
    // Pick lowest fScore deterministically
    let bestPos = 0;
    let bestF = fScore.get(openSet[0]!) ?? Infinity;
    for (let i = 1; i < openSet.length; i++) {
      const f = fScore.get(openSet[i]!) ?? Infinity;
      if (f < bestF) {
        bestF = f;
        bestPos = i;
      }
    }
    const currKey = openSet.splice(bestPos, 1)[0]!;
    inOpen.delete(currKey);
    if (closed.has(currKey)) continue;
    closed.add(currKey);

    const d = Math.floor(currKey / strideD);
    const rem = currKey % strideD;
    const iy = Math.floor(rem / strideY);
    const ix = rem % strideY;

    if (ix === gx && iy === gy) {
      foundKey = currKey;
      break;
    }

    const currPt: Point2D = { x: xs[ix]!, y: ys[iy]! };
    const currG = gScore.get(currKey) ?? Infinity;

    for (const [dx, dy, nextDir] of dirs) {
      const nx = ix + dx;
      const ny = iy + dy;
      if (nx < 0 || nx >= xs.length || ny < 0 || ny >= ys.length) continue;

      const nextPt: Point2D = { x: xs[nx]!, y: ys[ny]! };

      // Ensure segment stays strictly outside every inflated obstacle
      let blocked = false;
      for (const obs of inflatedObstacles) {
        if (segmentIntersectsRect(currPt, nextPt, obs)) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      const nextKey = encode(nx, ny, nextDir);
      if (closed.has(nextKey)) continue;

      const dist = Math.abs(nextPt.x - currPt.x) + Math.abs(nextPt.y - currPt.y);
      const bendCost = d !== 0 && d !== nextDir ? BEND_PENALTY : 0;
      const tentativeG = currG + dist + bendCost;

      if (tentativeG < (gScore.get(nextKey) ?? Infinity)) {
        cameFrom.set(nextKey, currKey);
        gScore.set(nextKey, tentativeG);
        const h = Math.abs(xs[gx]! - nextPt.x) + Math.abs(ys[gy]! - nextPt.y);
        fScore.set(nextKey, tentativeG + h);
        if (!inOpen.has(nextKey)) {
          openSet.push(nextKey);
          inOpen.add(nextKey);
        }
      }
    }
  }

  if (foundKey < 0) return null;

  const rev: Point2D[] = [];
  let k: number | undefined = foundKey;
  while (k !== undefined) {
    const rem = k % strideD;
    const iy = Math.floor(rem / strideY);
    const ix = rem % strideY;
    rev.push({ x: xs[ix]!, y: ys[iy]! });
    k = cameFrom.get(k);
  }
  rev.reverse();
  return rev;
}

/**
 * Pure deterministic zero-overlap orthogonal router.
 * Computes a clean Manhattan path with rounded corners (`radius = 10`) that
 * routes around all obstacle bounding boxes with `padding`.
 */
export function routeOrthogonal(
  fromBox: Rect2D | Point2D,
  toBox: Rect2D | Point2D,
  obstacles: Rect2D[] = [],
  opts: RouteOrthogonalOptions = {},
): RoutedOrthogonalPath {
  const fromRect = toRect(fromBox);
  const toRectBox = toRect(toBox);

  const radius = opts.radius ?? 10;
  const padding = opts.padding ?? 12;
  const stub = opts.stub ?? 18;
  const bendOffset = opts.bendOffset ?? 0;

  const fromSide = resolvePortSide(fromRect, toRectBox, opts.fromSide, false);
  const toSide = resolvePortSide(fromRect, toRectBox, opts.toSide, true);

  const pStart = portAnchor(fromRect, fromSide);
  const pEnd = portAnchor(toRectBox, toSide);
  const nStart = sideNormal(fromSide);
  const nEnd = sideNormal(toSide);

  // Filter out source/target boxes themselves from obstacle list, then inflate
  const rawObstacles = obstacles.filter(
    (o) =>
      o.w > 0 &&
      o.h > 0 &&
      !rectsNearlyEqual(o, fromRect) &&
      !rectsNearlyEqual(o, toRectBox) &&
      !pointInsideRect(pStart, o) &&
      !pointInsideRect(pEnd, o),
  );
  const inflated = rawObstacles.map((o) => inflateRect(o, padding));

  // Choose stub distance carefully so stubs stay clear when boxes are very close
  const rawGap = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);
  const effStub = Math.min(stub, Math.max(6, rawGap * 0.35));

  const sStart: Point2D = {
    x: pStart.x + nStart.x * effStub,
    y: pStart.y + nStart.y * effStub,
  };
  const sEnd: Point2D = {
    x: pEnd.x + nEnd.x * effStub,
    y: pEnd.y + nEnd.y * effStub,
  };

  // Build clean candidate orthogonal paths first (fast path for unobstructed diagrams)
  const midX = (sStart.x + sEnd.x) * 0.5 + bendOffset;
  const midY = (sStart.y + sEnd.y) * 0.5 + bendOffset;

  const candidates: Point2D[][] = [];

  // Straight alignment if collinear and facing each other cleanly
  if (Math.abs(pStart.x - pEnd.x) < 1 && (fromSide === "bottom" || fromSide === "top")) {
    candidates.push([pStart, pEnd]);
  }
  if (Math.abs(pStart.y - pEnd.y) < 1 && (fromSide === "left" || fromSide === "right")) {
    candidates.push([pStart, pEnd]);
  }

  // Standard 2-bend Z/S routes (preferred for Stripe/Linear orthogonal symmetry)
  if (fromSide === "top" || fromSide === "bottom") {
    candidates.push([pStart, sStart, { x: sStart.x, y: midY }, { x: sEnd.x, y: midY }, sEnd, pEnd]);
    candidates.push([pStart, sStart, { x: sEnd.x, y: sStart.y }, sEnd, pEnd]);
    candidates.push([pStart, sStart, { x: sStart.x, y: sEnd.y }, sEnd, pEnd]);
    candidates.push([pStart, sStart, { x: midX, y: sStart.y }, { x: midX, y: sEnd.y }, sEnd, pEnd]);
  } else {
    candidates.push([pStart, sStart, { x: midX, y: sStart.y }, { x: midX, y: sEnd.y }, sEnd, pEnd]);
    candidates.push([pStart, sStart, { x: sStart.x, y: sEnd.y }, sEnd, pEnd]);
    candidates.push([pStart, sStart, { x: sEnd.x, y: sStart.y }, sEnd, pEnd]);
    candidates.push([pStart, sStart, { x: sStart.x, y: midY }, { x: sEnd.x, y: midY }, sEnd, pEnd]);
  }

  // Evaluate unobstructed candidates by weighted length + bend count
  let bestPoints: Point2D[] | null = null;
  let bestScore = Infinity;

  for (const cand of candidates) {
    const simplified = simplifyOrthogonalPoints(cand);
    if (pathHitsAnyRect(simplified, inflated)) continue;
    const score = polylineLength(simplified) + countBends(simplified) * 26;
    if (score < bestScore) {
      bestScore = score;
      bestPoints = simplified;
    }
  }

  // If all direct candidates intersect an obstacle, invoke deterministic visibility A*!
  if (!bestPoints) {
    // Ensure A* endpoints are outside inflated obstacles if a stub landed inside one
    const aStar = routeOrthogonalVisibilityAStar(
      sStart,
      sEnd,
      inflated,
      fromRect,
      toRectBox,
      Math.max(padding + 12, 24),
    );
    if (aStar && aStar.length >= 2) {
      const full = simplifyOrthogonalPoints([pStart, ...aStar, pEnd]);
      if (!pathHitsAnyRect(full, inflated)) {
        bestPoints = full;
      }
    }
  }

  // Perimeter detour fallback if stubs themselves sit tight against an obstacle
  if (!bestPoints) {
    let minX = Math.min(pStart.x, pEnd.x, fromRect.x, toRectBox.x);
    let maxX = Math.max(pStart.x, pEnd.x, fromRect.x + fromRect.w, toRectBox.x + toRectBox.w);
    let minY = Math.min(pStart.y, pEnd.y, fromRect.y, toRectBox.y);
    let maxY = Math.max(pStart.y, pEnd.y, fromRect.y + fromRect.h, toRectBox.y + toRectBox.h);
    for (const r of inflated) {
      minX = Math.min(minX, r.x);
      maxX = Math.max(maxX, r.x + r.w);
      minY = Math.min(minY, r.y);
      maxY = Math.max(maxY, r.y + r.h);
    }
    const padOut = Math.max(20, padding + 10);
    const detours: Point2D[][] = [
      [pStart, sStart, { x: sStart.x, y: minY - padOut }, { x: sEnd.x, y: minY - padOut }, sEnd, pEnd],
      [pStart, sStart, { x: sStart.x, y: maxY + padOut }, { x: sEnd.x, y: maxY + padOut }, sEnd, pEnd],
      [pStart, sStart, { x: minX - padOut, y: sStart.y }, { x: minX - padOut, y: sEnd.y }, sEnd, pEnd],
      [pStart, sStart, { x: maxX + padOut, y: sStart.y }, { x: maxX + padOut, y: sEnd.y }, sEnd, pEnd],
    ];
    for (const d of detours) {
      const sim = simplifyOrthogonalPoints(d);
      if (!pathHitsAnyRect(sim, inflated)) {
        const score = polylineLength(sim) + countBends(sim) * 26;
        if (score < bestScore) {
          bestScore = score;
          bestPoints = sim;
        }
      }
    }
  }

  // Absolute fallback if no obstacle-free corridor exists (e.g. completely enclosed)
  if (!bestPoints) {
    bestPoints = simplifyOrthogonalPoints([
      pStart,
      sStart,
      { x: sStart.x, y: midY },
      { x: sEnd.x, y: midY },
      sEnd,
      pEnd,
    ]);
  }

  const length = polylineLength(bestPoints);
  const mid = samplePolyline(bestPoints, 0.5);

  return {
    points: bestPoints,
    path: buildRoundedOrthogonalPath(bestPoints, radius),
    length,
    midpoint: { x: mid.x, y: mid.y },
    fromSide,
    toSide,
  };
}

/* -------------------------------------------------------------------------- */
/*  Editorial Stage Specification Types                                       */
/* -------------------------------------------------------------------------- */

export interface CameraPreset {
  x: number;
  y: number;
  zoom?: number;
}

export interface EditorialStageOptions {
  width?: number;
  height?: number;
  grid?: number;
  theme?: StudioTheme;
  cameraPresets?: Record<string, CameraPreset>;
  initialCamera?: string;
}

export interface ZoneSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  subtitle?: string;
  accent?: AccentKey | null;
  group?: string;
  visible?: boolean;
}

export interface NodeSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  subtitle?: string;
  badge?: string;
  value?: string;
  tone?: MonochromeKey;
  accent?: AccentKey | null;
  group?: string;
  anchorOffset?: Point2D;
  visible?: boolean;
  dimmed?: boolean;
}

export interface ArrayCellSpec {
  id: string;
  key?: string;
  value: string;
  header?: string;
  badge?: string;
  accent?: AccentKey | null;
  active?: boolean;
  dimmed?: boolean;
}

export interface ArrayRowSpec {
  x: number;
  y: number;
  cellW: number;
  cellH: number;
  gap?: number;
  label?: string;
  subtitle?: string;
  cells: ArrayCellSpec[];
  group?: string;
  visible?: boolean;
}

export interface ConnectorSpec {
  from: string | [number, number];
  to: string | [number, number];
  fromSide?: PortSide;
  toSide?: PortSide;
  label?: string;
  bidirectional?: boolean;
  dashed?: boolean;
  accent?: AccentKey | null;
  active?: boolean;
  bendOffset?: number;
  stub?: number;
  padding?: number;
  avoidObstacles?: boolean;
  group?: string;
  visible?: boolean;
}

export interface PacketSpec {
  connectorId: string;
  progress: number;
  label?: string;
  accent?: AccentKey;
  group?: string;
  visible?: boolean;
}

/* --- Locked Tactile Kinetic Instrument Kit (5 Primitives) --- */

export interface StripItemSpec {
  id: string;
  key: string;
  active?: boolean;
  occupied?: boolean;
  dimmed?: boolean;
  accent?: AccentKey | null;
}

export interface StripSpec {
  x: number;
  y: number;
  eyebrow?: string;
  items: StripItemSpec[];
  itemW?: number;
  itemH?: number;
  gap?: number;
  group?: string;
  visible?: boolean;
}

export interface TrackTileSpec {
  id: string;
  key: string;
  sublabel?: string;
  state?: "idle" | "active" | "promoted" | "evicting";
  accent?: AccentKey | null;
}

export interface TrackSpec {
  x: number;
  y: number;
  eyebrow?: string;
  slots: number;
  tiles: TrackTileSpec[];
  evictedTiles?: TrackTileSpec[];
  slotW?: number;
  slotH?: number;
  gap?: number;
  evictEdge?: boolean;
  leftTick?: string;
  rightTick?: string;
  evictLabel?: string;
  showLinks?: boolean;
  group?: string;
  visible?: boolean;
}

export interface ArcLinkSpec {
  from: string | [number, number];
  to: string | [number, number];
  active?: boolean;
  pulse?: boolean;
  accent?: AccentKey | null;
  curveDip?: number;
  pulseSpeed?: number;
  group?: string;
  visible?: boolean;
}

export interface StageNodeSpec {
  x: number;
  y: number;
  w?: number;
  h?: number;
  r?: number;
  shape?: "tile" | "circle";
  value: string;
  sublabel?: string;
  state?: "idle" | "active" | "muted";
  accent?: AccentKey | null;
  group?: string;
  visible?: boolean;
}

export interface FlowPipeSpec {
  from: string | [number, number];
  to: string | [number, number];
  rate?: number;
  active?: boolean;
  accent?: AccentKey | null;
  label?: string;
  /** Perpendicular pixel offset from the line between `from` and `to` (e.g. +14 / -14) for clean parallel bidirectional lanes. */
  laneOffset?: number;
  /** Render a crisp directional chevron/arrowhead at the `to` end of the pipe (default: `true`). */
  arrowhead?: boolean;
  group?: string;
  visible?: boolean;
}

export interface EditorialStage {
  readonly logicalSize: Size2D;
  readonly grid: number;
  readonly svg: SVGSVGElement;
  /* Locked Tactile Kinetic Primitives */
  strip(id: string, spec: StripSpec): void;
  track(id: string, spec: TrackSpec): void;
  arcLink(id: string, spec: ArcLinkSpec): void;
  stageNode(id: string, spec: StageNodeSpec): void;
  flowPipe(id: string, spec: FlowPipeSpec): void;
  /* Legacy Editorial Primitives */
  upsertZone(id: string, spec: ZoneSpec): void;
  upsertNode(id: string, spec: NodeSpec): void;
  upsertArrayRow(id: string, spec: ArrayRowSpec): void;
  upsertConnector(id: string, spec: ConnectorSpec): void;
  upsertPacket(id: string, spec: PacketSpec): void;
  removeMissing(activeIds: Set<string> | string[]): void;
  setFocus(ids: string[] | null, accentOverrides?: Record<string, AccentKey> | null): void;
  setReveal(ids: string[] | null): void;
  setCamera(preset: string | CameraPreset, zoom?: number): void;
  goToCamera(preset: string | CameraPreset, zoom?: number): void;
  resetCamera(): void;
  setTheme(theme: StudioTheme): void;
  resize(): void;
  projectAnchor(id: string): ProjectedPoint;
  getRegisteredIds(): string[];
  getCameraPresets(): string[];
  render(dt?: number): void;
  destroy(): void;
}

/* -------------------------------------------------------------------------- */
/*  SVG Helpers                                                               */
/* -------------------------------------------------------------------------- */

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, String(v));
    }
  }
  return el;
}

function setAttrs(el: Element, attrs: Record<string, string | number>): void {
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
}

/* -------------------------------------------------------------------------- */
/*  Internal Entity Records                                                   */
/* -------------------------------------------------------------------------- */

interface ZoneEntity {
  id: string;
  spec: ZoneSpec;
  x: SpringState;
  y: SpringState;
  opacity: SpringState;
  scale: SpringState;
  el: SVGGElement;
  bgRect: SVGRectElement;
  titleText: SVGTextElement;
  subtitleText: SVGTextElement;
}

interface NodeEntity {
  id: string;
  spec: NodeSpec;
  x: SpringState;
  y: SpringState;
  opacity: SpringState;
  scale: SpringState;
  el: SVGGElement;
  haloRect: SVGRectElement;
  cardRect: SVGRectElement;
  accentBar: SVGRectElement;
  titleText: SVGTextElement;
  subtitleText: SVGTextElement;
  valuePillBg: SVGRectElement;
  valueText: SVGTextElement;
  badgeBg: SVGRectElement;
  badgeText: SVGTextElement;
}

interface ArrayCellDom {
  g: SVGGElement;
  rect: SVGRectElement;
  headerBg: SVGRectElement;
  headerText: SVGTextElement;
  valueText: SVGTextElement;
  badgeText: SVGTextElement;
  accentRing: SVGRectElement;
}

interface ArrayRowEntity {
  id: string;
  spec: ArrayRowSpec;
  x: SpringState;
  y: SpringState;
  opacity: SpringState;
  scale: SpringState;
  el: SVGGElement;
  labelText: SVGTextElement;
  subtitleText: SVGTextElement;
  frameRect: SVGRectElement;
  cellsLayer: SVGGElement;
  cellDoms: Map<string, ArrayCellDom>;
  cellRects: Map<string, Rect2D>;
}

interface ConnectorEntity {
  id: string;
  spec: ConnectorSpec;
  opacity: SpringState;
  points: Point2D[];
  midpoint: Point2D;
  el: SVGGElement;
  haloPath: SVGPathElement;
  strokePath: SVGPathElement;
  pillGroup: SVGGElement;
  pillRect: SVGRectElement;
  pillText: SVGTextElement;
}

interface PacketTrailPoint {
  x: number;
  y: number;
  age: number;
  accent: AccentKey;
}

interface PacketEntity {
  id: string;
  spec: PacketSpec;
  progress: SpringState;
  opacity: SpringState;
  pos: Point2D;
  trails: PacketTrailPoint[];
  el: SVGGElement;
  glowCircle: SVGCircleElement;
  coreCircle: SVGCircleElement;
  labelBg: SVGRectElement;
  labelText: SVGTextElement;
}

/* --- Tactile Kinetic Internal Entity Records --- */

interface StripItemDom {
  g: SVGGElement;
  wellRect: SVGRectElement;
  wellInset: SVGLineElement;
  capGroup: SVGGElement;
  capRect: SVGRectElement;
  capHighlight: SVGLineElement;
  keyText: SVGTextElement;
  dotHalo: SVGCircleElement;
  dotCore: SVGCircleElement;
  press: SpringState;
}

interface StripEntity {
  id: string;
  spec: StripSpec;
  x: SpringState;
  y: SpringState;
  opacity: SpringState;
  scale: SpringState;
  el: SVGGElement;
  eyebrowText: SVGTextElement;
  plateRect: SVGRectElement;
  itemsLayer: SVGGElement;
  itemDoms: Map<string, StripItemDom>;
  anchors: Map<string, Point2D>;
  itemRects: Map<string, Rect2D>;
}

interface TrackSlotDom {
  g: SVGGElement;
  wellRect: SVGRectElement;
  wellInset: SVGLineElement;
  numeralText: SVGTextElement;
}

interface TrackTileDom {
  id: string;
  g: SVGGElement;
  cardRect: SVGRectElement;
  topHighlight: SVGLineElement;
  accentPip: SVGRectElement;
  keyText: SVGTextElement;
  subText: SVGTextElement;
  x: SpringState;
  y: SpringState;
  rot: SpringState;
  opacity: SpringState;
  scale: SpringState;
  prevSlot: number | null;
  arcFromX: number;
  arcToX: number;
  arcPeak: number;
  arcActive: boolean;
  liveLiftY: number;
  wasEvicted: boolean;
}

interface TrackEntity {
  id: string;
  spec: TrackSpec;
  x: SpringState;
  y: SpringState;
  opacity: SpringState;
  scale: SpringState;
  el: SVGGElement;
  eyebrowText: SVGTextElement;
  platePath: SVGPathElement;
  evictLine: SVGLineElement;
  leftTickText: SVGTextElement;
  rightTickText: SVGTextElement;
  evictTickText: SVGTextElement;
  slotsLayer: SVGGElement;
  linksLayer: SVGGElement;
  tilesLayer: SVGGElement;
  slotDoms: TrackSlotDom[];
  linkPaths: SVGPathElement[];
  tileDoms: Map<string, TrackTileDom>;
  anchors: Map<string, Point2D>;
  tileRects: Map<string, Rect2D>;
}

interface ArcLinkEntity {
  id: string;
  spec: ArcLinkSpec;
  opacity: SpringState;
  pulsePhase: number;
  midpoint: Point2D;
  el: SVGGElement;
  glowPath: SVGPathElement;
  strokePath: SVGPathElement;
  startRing: SVGCircleElement;
  endRing: SVGCircleElement;
  pulseHalo: SVGCircleElement;
  pulseCore: SVGCircleElement;
}

interface StageNodeEntity {
  id: string;
  spec: StageNodeSpec;
  x: SpringState;
  y: SpringState;
  opacity: SpringState;
  scale: SpringState;
  el: SVGGElement;
  tileRect: SVGRectElement;
  tileHighlight: SVGLineElement;
  circleShape: SVGCircleElement;
  valueText: SVGTextElement;
  subText: SVGTextElement;
}

interface FlowPipeEntity {
  id: string;
  spec: FlowPipeSpec;
  opacity: SpringState;
  phase: number;
  midpoint: Point2D;
  el: SVGGElement;
  trackPath: SVGPathElement;
  strokePath: SVGPathElement;
  arrowPath: SVGPathElement;
  beads: SVGCircleElement[];
  labelText: SVGTextElement;
}

/* -------------------------------------------------------------------------- */
/*  createEditorialStage                                                      */
/* -------------------------------------------------------------------------- */

export function createEditorialStage(
  canvas: HTMLCanvasElement,
  opts: EditorialStageOptions = {},
): EditorialStage {
  const logicalSize: Size2D = {
    width: opts.width ?? 1120,
    height: opts.height ?? 640,
  };
  const grid = opts.grid ?? 16;
  let theme: StudioTheme = opts.theme === "dark" ? "dark" : "light";

  const presets: Record<string, CameraPreset> = {
    hero: { x: logicalSize.width * 0.5, y: logicalSize.height * 0.5, zoom: 1 },
    overview: { x: logicalSize.width * 0.5, y: logicalSize.height * 0.5, zoom: 1 },
    ...(opts.cameraPresets ?? {}),
  };

  const initialPresetName = opts.initialCamera ?? "overview";
  const initialPreset = presets[initialPresetName] ??
    presets.hero ?? { x: logicalSize.width * 0.5, y: logicalSize.height * 0.5, zoom: 1 };

  let activePresetName = initialPresetName;
  let activePresetZoom: number | undefined = initialPreset.zoom;

  let camTarget: CameraState = {
    x: initialPreset.x,
    y: initialPreset.y,
    zoom: initialPreset.zoom ?? 1,
  };
  let camX: SpringState = { value: camTarget.x, velocity: 0 };
  let camY: SpringState = { value: camTarget.y, velocity: 0 };
  let camZoom: SpringState = { value: camTarget.zoom, velocity: 0 };

  let viewport: Size2D = {
    width: canvas.clientWidth || window.innerWidth || logicalSize.width,
    height: canvas.clientHeight || window.innerHeight || logicalSize.height,
  };
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Focus & Reveal state
  let focusSet: Set<string> | null = null;
  let accentOverrides: Record<string, AccentKey> = {};
  let revealSet: Set<string> | null = null;

  // Entity stores
  const zones = new Map<string, ZoneEntity>();
  const nodes = new Map<string, NodeEntity>();
  const arrayRows = new Map<string, ArrayRowEntity>();
  const connectors = new Map<string, ConnectorEntity>();
  const packets = new Map<string, PacketEntity>();

  // Tactile Kinetic Instrument stores
  const strips = new Map<string, StripEntity>();
  const tracks = new Map<string, TrackEntity>();
  const arcLinks = new Map<string, ArcLinkEntity>();
  const stageNodes = new Map<string, StageNodeEntity>();
  const flowPipes = new Map<string, FlowPipeEntity>();

  // Inject aligned crisp SVG layer over canvas inside canvas.parentElement
  const parent = canvas.parentElement ?? document.body;
  const existingSvg = parent.querySelector("svg.ec-svg");
  if (existingSvg) existingSvg.remove();

  const svg = svgEl("svg", {
    class: "ec-svg",
    "aria-hidden": "true",
  });
  svg.style.position = "absolute";
  svg.style.inset = "0";
  svg.style.width = "100%";
  svg.style.height = "100%";
  svg.style.pointerEvents = "none";
  svg.style.overflow = "hidden";
  svg.style.zIndex = "2";
  parent.appendChild(svg);

  // Build SVG defs (shadows, tactile contact/elevation shadows, glows, crisp arrowheads)
  const defs = svgEl("defs");
  svg.appendChild(defs);

  const shadowFilter = svgEl("filter", {
    id: "ec-card-shadow",
    x: "-16%",
    y: "-16%",
    width: "132%",
    height: "145%",
  });
  const feDropShadow = svgEl("feDropShadow", {
    dx: "0",
    dy: "4",
    stdDeviation: "6",
    "flood-color": "#121418",
    "flood-opacity": "0.08",
  });
  shadowFilter.appendChild(feDropShadow);
  defs.appendChild(shadowFilter);

  const tactileShadowFilter = svgEl("filter", {
    id: "ec-tactile-shadow",
    x: "-18%",
    y: "-18%",
    width: "136%",
    height: "152%",
  });
  const feTactileShadow = svgEl("feDropShadow", {
    dx: "0",
    dy: "2.4",
    stdDeviation: "2.8",
    "flood-color": "#141412",
    "flood-opacity": "0.10",
  });
  tactileShadowFilter.appendChild(feTactileShadow);
  defs.appendChild(tactileShadowFilter);

  const tactileLiftedFilter = svgEl("filter", {
    id: "ec-tactile-lifted-shadow",
    x: "-30%",
    y: "-25%",
    width: "160%",
    height: "185%",
  });
  const feTactileLifted = svgEl("feDropShadow", {
    dx: "0",
    dy: "13",
    stdDeviation: "9.5",
    "flood-color": "#101216",
    "flood-opacity": "0.22",
  });
  tactileLiftedFilter.appendChild(feTactileLifted);
  defs.appendChild(tactileLiftedFilter);

  const dotGlowFilter = svgEl("filter", {
    id: "ec-dot-glow",
    x: "-120%",
    y: "-120%",
    width: "340%",
    height: "340%",
  });
  const feDotBlur = svgEl("feGaussianBlur", { stdDeviation: "2.8", result: "blur" });
  const feDotMerge = svgEl("feMerge");
  feDotMerge.appendChild(svgEl("feMergeNode", { in: "blur" }));
  feDotMerge.appendChild(svgEl("feMergeNode", { in: "SourceGraphic" }));
  dotGlowFilter.appendChild(feDotBlur);
  dotGlowFilter.appendChild(feDotMerge);
  defs.appendChild(dotGlowFilter);

  const glowFilter = svgEl("filter", {
    id: "ec-packet-glow",
    x: "-80%",
    y: "-80%",
    width: "260%",
    height: "260%",
  });
  const feBlur = svgEl("feGaussianBlur", { stdDeviation: "4", result: "blur" });
  const feMerge = svgEl("feMerge");
  feMerge.appendChild(svgEl("feMergeNode", { in: "blur" }));
  feMerge.appendChild(svgEl("feMergeNode", { in: "SourceGraphic" }));
  glowFilter.appendChild(feBlur);
  glowFilter.appendChild(feMerge);
  defs.appendChild(glowFilter);

  const markerPaths = new Map<string, SVGPathElement>();
  const markerKeys: Array<"default" | AccentKey> = [
    "default",
    "orange",
    "cobalt",
    "ember",
    "teal",
    "gold",
  ];

  for (const key of markerKeys) {
    // End arrow
    const mEnd = svgEl("marker", {
      id: `ec-arrow-${key}`,
      viewBox: "0 0 10 10",
      refX: "8.2",
      refY: "5",
      markerWidth: "6.5",
      markerHeight: "6.5",
      orient: "auto",
      markerUnits: "strokeWidth",
    });
    const pEnd = svgEl("path", { d: "M 1 1.5 L 8.5 5 L 1 8.5 z" });
    mEnd.appendChild(pEnd);
    defs.appendChild(mEnd);
    markerPaths.set(`end-${key}`, pEnd);

    // Start arrow (for bidirectional links)
    const mStart = svgEl("marker", {
      id: `ec-arrow-start-${key}`,
      viewBox: "0 0 10 10",
      refX: "1.8",
      refY: "5",
      markerWidth: "6.5",
      markerHeight: "6.5",
      orient: "auto",
      markerUnits: "strokeWidth",
    });
    const pStart = svgEl("path", { d: "M 9 1.5 L 1.5 5 L 9 8.5 z" });
    mStart.appendChild(pStart);
    defs.appendChild(mStart);
    markerPaths.set(`start-${key}`, pStart);
  }

  // Ordered world layers
  const worldGroup = svgEl("g", { class: "ec-world" });
  const zonesLayer = svgEl("g", { class: "ec-zones" });
  const connectorsLayer = svgEl("g", { class: "ec-connectors" });
  const flowPipesLayer = svgEl("g", { class: "ec-flow-pipes" });
  const arraysLayer = svgEl("g", { class: "ec-arrays" });
  const stripsLayer = svgEl("g", { class: "ec-strips" });
  const tracksLayer = svgEl("g", { class: "ec-tracks" });
  const arcLinksLayer = svgEl("g", { class: "ec-arc-links" });
  const stageNodesLayer = svgEl("g", { class: "ec-stage-nodes" });
  const nodesLayer = svgEl("g", { class: "ec-nodes" });
  const packetsLayer = svgEl("g", { class: "ec-packets" });

  worldGroup.appendChild(zonesLayer);
  worldGroup.appendChild(connectorsLayer);
  worldGroup.appendChild(flowPipesLayer);
  worldGroup.appendChild(arraysLayer);
  worldGroup.appendChild(stripsLayer);
  worldGroup.appendChild(tracksLayer);
  worldGroup.appendChild(arcLinksLayer);
  worldGroup.appendChild(stageNodesLayer);
  worldGroup.appendChild(nodesLayer);
  worldGroup.appendChild(packetsLayer);
  svg.appendChild(worldGroup);

  function syncThemeDefs(): void {
    const pal = THEME_PALETTES[theme];
    setAttrs(feDropShadow, {
      "flood-color": pal.shadowColor,
      "flood-opacity": pal.shadowOpacity,
    });
    setAttrs(feTactileShadow, {
      "flood-color": theme === "dark" ? "#000000" : "#141412",
      "flood-opacity": theme === "dark" ? "0.42" : "0.10",
    });
    setAttrs(feTactileLifted, {
      "flood-color": theme === "dark" ? "#000000" : "#101216",
      "flood-opacity": theme === "dark" ? "0.56" : "0.20",
    });
    for (const key of markerKeys) {
      const color = key === "default" ? pal.connectorStroke : pal.accents[key];
      markerPaths.get(`end-${key}`)?.setAttribute("fill", color);
      markerPaths.get(`start-${key}`)?.setAttribute("fill", color);
    }
  }
  syncThemeDefs();

  // ---- Interactive Camera Pan & Zoom on Canvas ----
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragCamStartX = 0;
  let dragCamStartY = 0;

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragCamStartX = camX.value;
    dragCamStartY = camY.value;
    // Yield Director camera transition immediately on user drag
    camTarget = { x: camX.value, y: camY.value, zoom: camZoom.value };
    camX.velocity = 0;
    camY.velocity = 0;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic events without active pointer capture
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!isDragging) return;
    const baseScale = Math.min(
      Math.max(1, viewport.width) / logicalSize.width,
      Math.max(1, viewport.height) / logicalSize.height,
    );
    const scale = Math.max(1e-4, baseScale * camZoom.value);
    const dx = (e.clientX - dragStartX) / scale;
    const dy = (e.clientY - dragStartY) / scale;
    camTarget.x = dragCamStartX - dx;
    camTarget.y = dragCamStartY - dy;
    camX.value = camTarget.x;
    camY.value = camTarget.y;
    camX.velocity = 0;
    camY.velocity = 0;
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!isDragging) return;
    isDragging = false;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0014);
    const nextZoom = Math.max(0.55, Math.min(2.4, camTarget.zoom * factor));

    // Zoom smoothly toward cursor point
    const rect = canvas.getBoundingClientRect();
    const pointerPx = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const before = viewportToLogical(
      pointerPx,
      { x: camX.value, y: camY.value, zoom: camZoom.value },
      viewport,
      logicalSize,
    );
    camTarget.zoom = nextZoom;
    const after = viewportToLogical(
      pointerPx,
      { x: camTarget.x, y: camTarget.y, zoom: nextZoom },
      viewport,
      logicalSize,
    );
    camTarget.x += before.x - after.x;
    camTarget.y += before.y - after.y;
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  // ---- Helper Predicates for Reveal / Focus / Accent ----
  function isRevealed(id: string, group?: string): boolean {
    if (!revealSet) return true;
    return revealSet.has(id) || (group != null && revealSet.has(group));
  }

  function isFocused(id: string, group?: string): boolean {
    if (!focusSet || focusSet.size === 0) return true;
    return focusSet.has(id) || (group != null && focusSet.has(group));
  }

  function resolveAccent(
    id: string,
    group: string | undefined,
    fallback: AccentKey | null | undefined,
  ): AccentKey | null {
    if (accentOverrides[id]) return accentOverrides[id]!;
    if (group && accentOverrides[group]) return accentOverrides[group]!;
    return fallback ?? null;
  }

  // ---- Upsert Primitives ----
  function upsertZone(id: string, spec: ZoneSpec): void {
    const snappedX = snapToGrid(spec.x, grid);
    const snappedY = snapToGrid(spec.y, grid);
    const norm: ZoneSpec = { ...spec, x: snappedX, y: snappedY };

    let ent = zones.get(id);
    if (!ent) {
      const el = svgEl("g", { class: "ec-zone", "data-id": id });
      const bgRect = svgEl("rect", { rx: "14", ry: "14", "stroke-dasharray": "5 5" });
      const titleText = svgEl("text", {
        x: "16",
        y: "22",
        "font-family": "var(--mono, ui-monospace, monospace)",
        "font-size": "10.5",
        "font-weight": "600",
        "letter-spacing": "0.08em",
      });
      const subtitleText = svgEl("text", {
        x: "16",
        y: "22",
        "text-anchor": "end",
        "font-family": "var(--sans, ui-sans-serif, system-ui, sans-serif)",
        "font-size": "11",
        "font-weight": "500",
      });

      el.appendChild(bgRect);
      el.appendChild(titleText);
      el.appendChild(subtitleText);
      zonesLayer.appendChild(el);

      const initVis = norm.visible !== false && isRevealed(id, norm.group);
      ent = {
        id,
        spec: norm,
        x: { value: snappedX, velocity: 0 },
        y: { value: snappedY, velocity: 0 },
        opacity: { value: initVis ? 1 : 0, velocity: 0 },
        scale: { value: initVis ? 1 : 0.94, velocity: 0 },
        el,
        bgRect,
        titleText,
        subtitleText,
      };
      zones.set(id, ent);
    } else {
      ent.spec = norm;
    }
  }

  function upsertNode(id: string, spec: NodeSpec): void {
    const snappedX = snapToGrid(spec.x, grid);
    const snappedY = snapToGrid(spec.y, grid);
    const norm: NodeSpec = { ...spec, x: snappedX, y: snappedY };

    let ent = nodes.get(id);
    if (!ent) {
      const el = svgEl("g", { class: "ec-node", "data-id": id });
      const haloRect = svgEl("rect", { rx: "14", ry: "14", fill: "none" });
      const cardRect = svgEl("rect", {
        rx: "11",
        ry: "11",
        filter: "url(#ec-card-shadow)",
      });
      const accentBar = svgEl("rect", { rx: "2", ry: "2" });
      const titleText = svgEl("text", {
        "font-family": "var(--sans, ui-sans-serif, system-ui, sans-serif)",
        "font-size": "14",
        "font-weight": "650",
        "letter-spacing": "-0.015em",
      });
      const subtitleText = svgEl("text", {
        "font-family": "var(--mono, ui-monospace, monospace)",
        "font-size": "11",
        "font-weight": "500",
      });
      const valuePillBg = svgEl("rect", { rx: "6", ry: "6" });
      const valueText = svgEl("text", {
        "font-family": "var(--mono, ui-monospace, monospace)",
        "font-size": "12",
        "font-weight": "600",
        "text-anchor": "middle",
      });
      const badgeBg = svgEl("rect", { rx: "999", ry: "999" });
      const badgeText = svgEl("text", {
        "font-family": "var(--mono, ui-monospace, monospace)",
        "font-size": "9.5",
        "font-weight": "600",
        "letter-spacing": "0.06em",
        "text-anchor": "middle",
      });

      el.appendChild(haloRect);
      el.appendChild(cardRect);
      el.appendChild(accentBar);
      el.appendChild(titleText);
      el.appendChild(subtitleText);
      el.appendChild(valuePillBg);
      el.appendChild(valueText);
      el.appendChild(badgeBg);
      el.appendChild(badgeText);
      nodesLayer.appendChild(el);

      const initVis = norm.visible !== false && isRevealed(id, norm.group);
      ent = {
        id,
        spec: norm,
        x: { value: snappedX, velocity: 0 },
        y: { value: snappedY, velocity: 0 },
        opacity: { value: initVis ? 1 : 0, velocity: 0 },
        scale: { value: initVis ? 1 : 0.92, velocity: 0 },
        el,
        haloRect,
        cardRect,
        accentBar,
        titleText,
        subtitleText,
        valuePillBg,
        valueText,
        badgeBg,
        badgeText,
      };
      nodes.set(id, ent);
    } else {
      ent.spec = norm;
    }
  }

  function upsertArrayRow(id: string, spec: ArrayRowSpec): void {
    const snappedX = snapToGrid(spec.x, grid);
    const snappedY = snapToGrid(spec.y, grid);
    const norm: ArrayRowSpec = { ...spec, x: snappedX, y: snappedY };

    let ent = arrayRows.get(id);
    if (!ent) {
      const el = svgEl("g", { class: "ec-array", "data-id": id });
      const labelText = svgEl("text", {
        "font-family": "var(--mono, ui-monospace, monospace)",
        "font-size": "10.5",
        "font-weight": "600",
        "letter-spacing": "0.06em",
      });
      const subtitleText = svgEl("text", {
        "font-family": "var(--sans, ui-sans-serif, system-ui, sans-serif)",
        "font-size": "11",
        "font-weight": "500",
        "text-anchor": "end",
      });
      const frameRect = svgEl("rect", {
        rx: "10",
        ry: "10",
        filter: "url(#ec-card-shadow)",
      });
      const cellsLayer = svgEl("g", { class: "ec-array-cells" });

      el.appendChild(labelText);
      el.appendChild(subtitleText);
      el.appendChild(frameRect);
      el.appendChild(cellsLayer);
      arraysLayer.appendChild(el);

      const initVis = norm.visible !== false && isRevealed(id, norm.group);
      ent = {
        id,
        spec: norm,
        x: { value: snappedX, velocity: 0 },
        y: { value: snappedY, velocity: 0 },
        opacity: { value: initVis ? 1 : 0, velocity: 0 },
        scale: { value: initVis ? 1 : 0.92, velocity: 0 },
        el,
        labelText,
        subtitleText,
        frameRect,
        cellsLayer,
        cellDoms: new Map(),
        cellRects: new Map(),
      };
      arrayRows.set(id, ent);
    } else {
      ent.spec = norm;
    }
  }

  function upsertConnector(id: string, spec: ConnectorSpec): void {
    let ent = connectors.get(id);
    if (!ent) {
      const el = svgEl("g", { class: "ec-connector", "data-id": id });
      const haloPath = svgEl("path", {
        fill: "none",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      });
      const strokePath = svgEl("path", {
        fill: "none",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      });
      const pillGroup = svgEl("g", { class: "ec-connector-pill" });
      const pillRect = svgEl("rect", { rx: "999", ry: "999" });
      const pillText = svgEl("text", {
        "font-family": "var(--mono, ui-monospace, monospace)",
        "font-size": "10",
        "font-weight": "600",
        "text-anchor": "middle",
        "dominant-baseline": "central",
      });
      pillGroup.appendChild(pillRect);
      pillGroup.appendChild(pillText);

      el.appendChild(haloPath);
      el.appendChild(strokePath);
      el.appendChild(pillGroup);
      connectorsLayer.appendChild(el);

      const initVis = spec.visible !== false && isRevealed(id, spec.group);
      ent = {
        id,
        spec,
        opacity: { value: initVis ? 1 : 0, velocity: 0 },
        points: [],
        midpoint: { x: 0, y: 0 },
        el,
        haloPath,
        strokePath,
        pillGroup,
        pillRect,
        pillText,
      };
      connectors.set(id, ent);
    } else {
      ent.spec = spec;
    }
  }

  function upsertPacket(id: string, spec: PacketSpec): void {
    let ent = packets.get(id);
    const pClamped = Math.max(0, Math.min(1, spec.progress));
    if (!ent) {
      const el = svgEl("g", { class: "ec-packet", "data-id": id });
      const glowCircle = svgEl("circle", { r: "11", filter: "url(#ec-packet-glow)" });
      const coreCircle = svgEl("circle", { r: "5.2" });
      const labelBg = svgEl("rect", { rx: "999", ry: "999" });
      const labelText = svgEl("text", {
        "font-family": "var(--mono, ui-monospace, monospace)",
        "font-size": "9.5",
        "font-weight": "600",
        "text-anchor": "middle",
        "dominant-baseline": "central",
      });

      el.appendChild(glowCircle);
      el.appendChild(coreCircle);
      el.appendChild(labelBg);
      el.appendChild(labelText);
      packetsLayer.appendChild(el);

      const initVis = spec.visible !== false && isRevealed(id, spec.group);
      ent = {
        id,
        spec: { ...spec, progress: pClamped },
        progress: { value: pClamped, velocity: 0 },
        opacity: { value: initVis ? 1 : 0, velocity: 0 },
        pos: { x: 0, y: 0 },
        trails: [],
        el,
        glowCircle,
        coreCircle,
        labelBg,
        labelText,
      };
      packets.set(id, ent);
    } else {
      // Detect wrap-around (e.g. looping packet resetting from 0.98 -> 0.02)
      if (pClamped + 0.4 < ent.progress.value) {
        ent.progress = { value: pClamped, velocity: 0 };
        ent.trails.length = 0;
      }
      ent.spec = { ...spec, progress: pClamped };
    }
  }

  // ---- Tactile Kinetic Instrument Primitives (5 Locked Primitives) ----

  function strip(id: string, spec: StripSpec): void {
    const safeX = Number.isFinite(spec.x) ? spec.x : 0;
    const safeY = Number.isFinite(spec.y) ? spec.y : 0;
    const norm: StripSpec = { ...spec, x: safeX, y: safeY };

    let ent = strips.get(id);
    if (!ent) {
      const el = svgEl("g", { class: "ec-strip", "data-id": id });
      const eyebrowText = svgEl("text", {
        "font-family": "var(--mono, ui-monospace, monospace)",
        "font-size": "10.5",
        "font-weight": "600",
        "letter-spacing": "0.14em",
      });
      const plateRect = svgEl("rect", { rx: "12", ry: "12" });
      const itemsLayer = svgEl("g", { class: "ec-strip-items" });

      el.appendChild(eyebrowText);
      el.appendChild(plateRect);
      el.appendChild(itemsLayer);
      stripsLayer.appendChild(el);

      const initVis = norm.visible !== false && isRevealed(id, norm.group);
      ent = {
        id,
        spec: norm,
        x: { value: safeX, velocity: 0 },
        y: { value: safeY, velocity: 0 },
        opacity: { value: initVis ? 1 : 0, velocity: 0 },
        scale: { value: initVis ? 1 : 0.96, velocity: 0 },
        el,
        eyebrowText,
        plateRect,
        itemsLayer,
        itemDoms: new Map(),
        anchors: new Map(),
        itemRects: new Map(),
      };
      strips.set(id, ent);
    } else {
      ent.spec = norm;
    }
  }

  function track(id: string, spec: TrackSpec): void {
    const safeX = Number.isFinite(spec.x) ? spec.x : 0;
    const safeY = Number.isFinite(spec.y) ? spec.y : 0;
    const norm: TrackSpec = { ...spec, x: safeX, y: safeY };

    let ent = tracks.get(id);
    if (!ent) {
      const el = svgEl("g", { class: "ec-track", "data-id": id });
      const eyebrowText = svgEl("text", {
        "font-family": "var(--mono, ui-monospace, monospace)",
        "font-size": "10.5",
        "font-weight": "600",
        "letter-spacing": "0.14em",
      });
      const platePath = svgEl("path");
      const evictLine = svgEl("line", { "stroke-dasharray": "3 4" });
      const leftTickText = svgEl("text", {
        "font-family": "var(--mono, ui-monospace, monospace)",
        "font-size": "10",
        "font-weight": "500",
        "letter-spacing": "0.08em",
        "text-anchor": "end",
        "dominant-baseline": "central",
      });
      const rightTickText = svgEl("text", {
        "font-family": "var(--mono, ui-monospace, monospace)",
        "font-size": "10",
        "font-weight": "500",
        "letter-spacing": "0.08em",
      });
      const evictTickText = svgEl("text", {
        "font-family": "var(--mono, ui-monospace, monospace)",
        "font-size": "10",
        "font-weight": "500",
        "letter-spacing": "0.06em",
      });
      const slotsLayer = svgEl("g", { class: "ec-track-slots" });
      const linksLayer = svgEl("g", { class: "ec-track-links" });
      const tilesLayer = svgEl("g", { class: "ec-track-tiles" });

      el.appendChild(eyebrowText);
      el.appendChild(platePath);
      el.appendChild(evictLine);
      el.appendChild(leftTickText);
      el.appendChild(rightTickText);
      el.appendChild(evictTickText);
      el.appendChild(slotsLayer);
      el.appendChild(linksLayer);
      el.appendChild(tilesLayer);
      tracksLayer.appendChild(el);

      const initVis = norm.visible !== false && isRevealed(id, norm.group);
      ent = {
        id,
        spec: norm,
        x: { value: safeX, velocity: 0 },
        y: { value: safeY, velocity: 0 },
        opacity: { value: initVis ? 1 : 0, velocity: 0 },
        scale: { value: initVis ? 1 : 0.96, velocity: 0 },
        el,
        eyebrowText,
        platePath,
        evictLine,
        leftTickText,
        rightTickText,
        evictTickText,
        slotsLayer,
        linksLayer,
        tilesLayer,
        slotDoms: [],
        linkPaths: [],
        tileDoms: new Map(),
        anchors: new Map(),
        tileRects: new Map(),
      };
      tracks.set(id, ent);
    } else {
      ent.spec = norm;
    }
  }

  function arcLink(id: string, spec: ArcLinkSpec): void {
    let ent = arcLinks.get(id);
    if (!ent) {
      const el = svgEl("g", { class: "ec-arc-link", "data-id": id });
      const glowPath = svgEl("path", { fill: "none", "stroke-linecap": "round" });
      const strokePath = svgEl("path", { fill: "none", "stroke-linecap": "round" });
      const startRing = svgEl("circle", { r: "3.2" });
      const endRing = svgEl("circle", { r: "3.2" });
      const pulseHalo = svgEl("circle", { r: "7.5", filter: "url(#ec-dot-glow)" });
      const pulseCore = svgEl("circle", { r: "3.6" });

      el.appendChild(glowPath);
      el.appendChild(strokePath);
      el.appendChild(startRing);
      el.appendChild(endRing);
      el.appendChild(pulseHalo);
      el.appendChild(pulseCore);
      arcLinksLayer.appendChild(el);

      const initVis = spec.visible !== false && isRevealed(id, spec.group);
      ent = {
        id,
        spec,
        opacity: { value: initVis ? 1 : 0, velocity: 0 },
        pulsePhase: 0,
        midpoint: { x: 0, y: 0 },
        el,
        glowPath,
        strokePath,
        startRing,
        endRing,
        pulseHalo,
        pulseCore,
      };
      arcLinks.set(id, ent);
    } else {
      if (spec.active && !ent.spec.active) {
        ent.pulsePhase = 0;
      }
      ent.spec = spec;
    }
  }

  function stageNode(id: string, spec: StageNodeSpec): void {
    const safeX = Number.isFinite(spec.x) ? spec.x : 0;
    const safeY = Number.isFinite(spec.y) ? spec.y : 0;
    const norm: StageNodeSpec = { ...spec, x: safeX, y: safeY };

    let ent = stageNodes.get(id);
    if (!ent) {
      const el = svgEl("g", { class: "ec-stage-node", "data-id": id });
      const tileRect = svgEl("rect", { rx: "9", ry: "9", filter: "url(#ec-tactile-shadow)" });
      const tileHighlight = svgEl("line", { "stroke-linecap": "round" });
      const circleShape = svgEl("circle", { filter: "url(#ec-tactile-shadow)" });
      const valueText = svgEl("text", {
        "font-family": "var(--sans, ui-sans-serif, system-ui, sans-serif)",
        "font-size": "18",
        "font-weight": "700",
        "text-anchor": "middle",
        "dominant-baseline": "central",
      });
      const subText = svgEl("text", {
        "font-family": "var(--mono, ui-monospace, monospace)",
        "font-size": "11",
        "font-weight": "500",
        "text-anchor": "middle",
        "dominant-baseline": "central",
      });

      el.appendChild(tileRect);
      el.appendChild(tileHighlight);
      el.appendChild(circleShape);
      el.appendChild(valueText);
      el.appendChild(subText);
      stageNodesLayer.appendChild(el);

      const initVis = norm.visible !== false && isRevealed(id, norm.group);
      ent = {
        id,
        spec: norm,
        x: { value: safeX, velocity: 0 },
        y: { value: safeY, velocity: 0 },
        opacity: { value: initVis ? 1 : 0, velocity: 0 },
        scale: { value: initVis ? 1 : 0.94, velocity: 0 },
        el,
        tileRect,
        tileHighlight,
        circleShape,
        valueText,
        subText,
      };
      stageNodes.set(id, ent);
    } else {
      ent.spec = norm;
    }
  }

  function flowPipe(id: string, spec: FlowPipeSpec): void {
    let ent = flowPipes.get(id);
    if (!ent) {
      const el = svgEl("g", { class: "ec-flow-pipe", "data-id": id });
      const trackPath = svgEl("path", { fill: "none", "stroke-linecap": "round" });
      const strokePath = svgEl("path", { fill: "none", "stroke-linecap": "round" });
      const arrowPath = svgEl("path", {
        fill: "none",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      });
      const beads: SVGCircleElement[] = [
        svgEl("circle", { r: "3.2", filter: "url(#ec-dot-glow)" }),
        svgEl("circle", { r: "3.2", filter: "url(#ec-dot-glow)" }),
        svgEl("circle", { r: "3.2", filter: "url(#ec-dot-glow)" }),
      ];
      const labelText = svgEl("text", {
        "font-family": "var(--mono, ui-monospace, monospace)",
        "font-size": "10",
        "font-weight": "500",
        "letter-spacing": "0.06em",
        "text-anchor": "middle",
      });

      el.appendChild(trackPath);
      el.appendChild(strokePath);
      el.appendChild(arrowPath);
      for (const b of beads) el.appendChild(b);
      el.appendChild(labelText);
      flowPipesLayer.appendChild(el);

      const initVis = spec.visible !== false && isRevealed(id, spec.group);
      ent = {
        id,
        spec,
        opacity: { value: initVis ? 1 : 0, velocity: 0 },
        phase: 0,
        midpoint: { x: 0, y: 0 },
        el,
        trackPath,
        strokePath,
        arrowPath,
        beads,
        labelText,
      };
      flowPipes.set(id, ent);
    } else {
      ent.spec = spec;
    }
  }

  function removeMissing(activeIds: Set<string> | string[]): void {
    const keep = activeIds instanceof Set ? activeIds : new Set(activeIds);
    for (const [id, ent] of zones) {
      if (!keep.has(id)) ent.spec = { ...ent.spec, visible: false };
    }
    for (const [id, ent] of nodes) {
      if (!keep.has(id)) ent.spec = { ...ent.spec, visible: false };
    }
    for (const [id, ent] of arrayRows) {
      if (!keep.has(id)) ent.spec = { ...ent.spec, visible: false };
    }
    for (const [id, ent] of connectors) {
      if (!keep.has(id)) ent.spec = { ...ent.spec, visible: false };
    }
    for (const [id, ent] of packets) {
      if (!keep.has(id)) ent.spec = { ...ent.spec, visible: false };
    }
    for (const [id, ent] of strips) {
      if (!keep.has(id)) ent.spec = { ...ent.spec, visible: false };
    }
    for (const [id, ent] of tracks) {
      if (!keep.has(id)) ent.spec = { ...ent.spec, visible: false };
    }
    for (const [id, ent] of arcLinks) {
      if (!keep.has(id)) ent.spec = { ...ent.spec, visible: false };
    }
    for (const [id, ent] of stageNodes) {
      if (!keep.has(id)) ent.spec = { ...ent.spec, visible: false };
    }
    for (const [id, ent] of flowPipes) {
      if (!keep.has(id)) ent.spec = { ...ent.spec, visible: false };
    }
  }

  // ---- Endpoint Resolution for Connectors, ArcLinks & Callout Anchors ----
  function resolveTactileAnchor(ref: string): { pt: Point2D; visible: boolean } | null {
    for (const st of strips.values()) {
      const hit = st.anchors.get(ref);
      if (hit) return { pt: hit, visible: st.opacity.value >= 0.08 };
    }
    for (const tr of tracks.values()) {
      const hit = tr.anchors.get(ref);
      if (hit) return { pt: hit, visible: tr.opacity.value >= 0.08 };
    }
    for (const sn of stageNodes.values()) {
      const shape = sn.spec.shape ?? "tile";
      const w = shape === "circle" ? (sn.spec.r ?? 32) * 2 : (sn.spec.w ?? 96);
      const h = shape === "circle" ? (sn.spec.r ?? 32) * 2 : (sn.spec.h ?? 64);
      const cx = sn.x.value + w * 0.5;
      const cy = sn.y.value + h * 0.5;
      if (ref === sn.id) return { pt: { x: cx, y: cy }, visible: sn.opacity.value >= 0.08 };
      if (ref === `${sn.id}_top`) return { pt: { x: cx, y: sn.y.value - 2 }, visible: sn.opacity.value >= 0.08 };
      if (ref === `${sn.id}_bottom`) return { pt: { x: cx, y: sn.y.value + h + 4 }, visible: sn.opacity.value >= 0.08 };
    }
    const fp = flowPipes.get(ref);
    if (fp) return { pt: fp.midpoint, visible: fp.opacity.value >= 0.08 };
    const al = arcLinks.get(ref);
    if (al) return { pt: al.midpoint, visible: al.opacity.value >= 0.08 };
    return null;
  }

  function resolveArcEndpoint(ref: string | [number, number], preferSuffix: "_bottom" | "_top"): Point2D | null {
    if (Array.isArray(ref)) {
      return { x: Number(ref[0]) || 0, y: Number(ref[1]) || 0 };
    }
    // Prefer explicit rim anchor when linking strip item -> track tile
    const preferred = resolveTactileAnchor(`${ref}${preferSuffix}`);
    if (preferred) return preferred.pt;
    const exact = resolveTactileAnchor(ref);
    if (exact) return exact.pt;

    const rectOrPt = resolveEntityRect(ref);
    if (!rectOrPt) return null;
    if ("w" in rectOrPt) {
      return preferSuffix === "_bottom"
        ? { x: rectOrPt.x + rectOrPt.w * 0.5, y: rectOrPt.y + rectOrPt.h }
        : { x: rectOrPt.x + rectOrPt.w * 0.5, y: rectOrPt.y };
    }
    return rectOrPt;
  }

  function resolveEntityRect(ref: string | [number, number]): Rect2D | Point2D | null {
    if (Array.isArray(ref)) {
      return { x: Number(ref[0]) || 0, y: Number(ref[1]) || 0 };
    }

    const node = nodes.get(ref);
    if (node) {
      return { x: node.x.value, y: node.y.value, w: node.spec.w, h: node.spec.h };
    }

    for (const st of strips.values()) {
      const r = st.itemRects.get(ref);
      if (r) return r;
    }

    for (const tr of tracks.values()) {
      const r = tr.tileRects.get(ref);
      if (r) return r;
    }

    const sn = stageNodes.get(ref);
    if (sn) {
      const shape = sn.spec.shape ?? "tile";
      const w = shape === "circle" ? (sn.spec.r ?? 32) * 2 : (sn.spec.w ?? 96);
      const h = shape === "circle" ? (sn.spec.r ?? 32) * 2 : (sn.spec.h ?? 64);
      return { x: sn.x.value, y: sn.y.value, w, h };
    }

    // Check array cell IDs (both bare cell.id and "arrayId:cellId")
    for (const arr of arrayRows.values()) {
      const direct = arr.cellRects.get(ref);
      if (direct) return direct;
      if (ref.startsWith(`${arr.id}:`)) {
        const sub = arr.cellRects.get(ref.slice(arr.id.length + 1));
        if (sub) return sub;
      }
    }

    const arr = arrayRows.get(ref);
    if (arr) {
      const gap = arr.spec.gap ?? 0;
      const count = Math.max(1, arr.spec.cells.length);
      const totalW = count * arr.spec.cellW + Math.max(0, count - 1) * gap;
      return { x: arr.x.value, y: arr.y.value, w: totalW, h: arr.spec.cellH };
    }

    const zone = zones.get(ref);
    if (zone) {
      return { x: zone.x.value, y: zone.y.value, w: zone.spec.w, h: zone.spec.h };
    }

    const conn = connectors.get(ref);
    if (conn) {
      return { x: conn.midpoint.x, y: conn.midpoint.y };
    }

    const tactile = resolveTactileAnchor(ref);
    if (tactile) return tactile.pt;

    return null;
  }

  // ---- Focus, Reveal, Camera, Theme, Resize ----
  function setFocus(
    ids: string[] | null,
    overrides?: Record<string, AccentKey> | null,
  ): void {
    focusSet = ids && ids.length > 0 ? new Set(ids) : null;
    accentOverrides = overrides ? { ...overrides } : {};
  }

  function setReveal(ids: string[] | null): void {
    revealSet = ids ? new Set(ids) : null;
  }

  function setCamera(preset: string | CameraPreset, zoom?: number): void {
    if (typeof preset === "string") {
      if (!(preset in presets)) {
        console.error(`[engine-c] Unknown camera preset "${preset}"`);
      }
      const p = presets[preset] ?? presets.overview ?? presets.hero;
      if (!p) return;
      activePresetName = preset in presets ? preset : activePresetName;
      activePresetZoom = zoom ?? p.zoom ?? 1;
      camTarget = { x: p.x, y: p.y, zoom: activePresetZoom };
    } else if (preset && typeof preset === "object") {
      camTarget = {
        x: Number.isFinite(preset.x) ? preset.x : logicalSize.width * 0.5,
        y: Number.isFinite(preset.y) ? preset.y : logicalSize.height * 0.5,
        zoom: zoom ?? preset.zoom ?? 1,
      };
    }
  }

  function resetCamera(): void {
    setCamera(activePresetName, activePresetZoom);
  }

  function setTheme(nextTheme: StudioTheme): void {
    theme = nextTheme === "dark" ? "dark" : "light";
    syncThemeDefs();
  }

  function resize(): void {
    const w = canvas.clientWidth || window.innerWidth || logicalSize.width;
    const h = canvas.clientHeight || window.innerHeight || logicalSize.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    viewport = { width: Math.max(1, w), height: Math.max(1, h) };
    const targetW = Math.round(viewport.width * dpr);
    const targetH = Math.round(viewport.height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
  }

  function projectAnchor(id: string): ProjectedPoint {
    const cam: CameraState = { x: camX.value, y: camY.value, zoom: camZoom.value };

    // 1. Check Tactile Kinetic anchors first (strips, tracks, tiles, rim anchors, evict drop-off)
    const tactile = resolveTactileAnchor(id);
    if (tactile) {
      if (!tactile.visible) {
        return { x: -9999, y: -9999, scale: 1, visible: false };
      }
      return logicalToViewport(tactile.pt, cam, viewport, logicalSize);
    }

    const node = nodes.get(id);
    if (node) {
      if (node.opacity.value < 0.08) {
        return { x: -9999, y: -9999, scale: 1, visible: false };
      }
      const ox = node.spec.anchorOffset?.x ?? node.spec.w * 0.5;
      const oy = node.spec.anchorOffset?.y ?? node.spec.h * 0.5;
      return logicalToViewport(
        { x: node.x.value + ox, y: node.y.value + oy },
        cam,
        viewport,
        logicalSize,
      );
    }

    const rectOrPt = resolveEntityRect(id);
    if (!rectOrPt) return { x: -9999, y: -9999, scale: 1, visible: false };

    // Check visibility for array rows or zones
    const arr = arrayRows.get(id);
    if (arr && arr.opacity.value < 0.08) {
      return { x: -9999, y: -9999, scale: 1, visible: false };
    }
    const zone = zones.get(id);
    if (zone && zone.opacity.value < 0.08) {
      return { x: -9999, y: -9999, scale: 1, visible: false };
    }

    const pt: Point2D =
      "w" in rectOrPt
        ? { x: rectOrPt.x + rectOrPt.w * 0.5, y: rectOrPt.y + rectOrPt.h * 0.5 }
        : rectOrPt;
    return logicalToViewport(pt, cam, viewport, logicalSize);
  }

  function getRegisteredIds(): string[] {
    const ids = new Set<string>();
    const addGroup = (group?: string) => {
      if (group) ids.add(group);
    };

    for (const st of strips.values()) {
      ids.add(st.id);
      ids.add(`${st.id}_top`);
      ids.add(`${st.id}_bottom`);
      addGroup(st.spec.group);
      for (const item of st.spec.items) {
        ids.add(item.id);
        ids.add(`${item.id}_top`);
        ids.add(`${item.id}_bottom`);
      }
      for (const key of st.anchors.keys()) ids.add(key);
    }

    for (const tr of tracks.values()) {
      ids.add(tr.id);
      ids.add(`${tr.id}_top`);
      ids.add(`${tr.id}_bottom`);
      ids.add(`${tr.id}_evict`);
      addGroup(tr.spec.group);
      for (let i = 0; i < tr.spec.slots; i++) {
        ids.add(`${tr.id}_slot_${i}`);
      }
      for (const tile of tr.spec.tiles) {
        ids.add(tile.id);
        ids.add(`${tile.id}_top`);
        ids.add(`${tile.id}_bottom`);
      }
      for (const tile of tr.spec.evictedTiles ?? []) {
        ids.add(tile.id);
        ids.add(`${tile.id}_top`);
        ids.add(`${tile.id}_bottom`);
      }
      for (const key of tr.anchors.keys()) ids.add(key);
    }

    for (const al of arcLinks.values()) {
      ids.add(al.id);
      addGroup(al.spec.group);
    }

    for (const sn of stageNodes.values()) {
      ids.add(sn.id);
      ids.add(`${sn.id}_top`);
      ids.add(`${sn.id}_bottom`);
      addGroup(sn.spec.group);
    }

    for (const fp of flowPipes.values()) {
      ids.add(fp.id);
      addGroup(fp.spec.group);
    }

    for (const z of zones.values()) {
      ids.add(z.id);
      addGroup(z.spec.group);
    }

    for (const n of nodes.values()) {
      ids.add(n.id);
      addGroup(n.spec.group);
    }

    for (const arr of arrayRows.values()) {
      ids.add(arr.id);
      addGroup(arr.spec.group);
      for (const cell of arr.spec.cells) {
        ids.add(cell.id);
        ids.add(`${arr.id}:${cell.id}`);
      }
    }

    for (const c of connectors.values()) {
      ids.add(c.id);
      addGroup(c.spec.group);
    }

    for (const p of packets.values()) {
      ids.add(p.id);
      addGroup(p.spec.group);
    }

    return Array.from(ids);
  }

  function getCameraPresets(): string[] {
    return Object.keys(presets);
  }

  // ---- 2D Canvas Backdrop: Studio Paper / Obsidian Mat + 24px Dot Grid + Packet Trails ----
  const ctx2d = canvas.getContext("2d");

  function drawCanvasBackdrop(cam: CameraState, scale: number): void {
    if (!ctx2d) return;
    const pal = THEME_PALETTES[theme];
    const vw = viewport.width;
    const vh = viewport.height;

    ctx2d.save();
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Warm studio paper or obsidian mat radial gradient
    const grad = ctx2d.createRadialGradient(
      vw * 0.5,
      vh * 0.45,
      Math.min(vw, vh) * 0.05,
      vw * 0.5,
      vh * 0.45,
      Math.max(vw, vh) * 0.72,
    );
    grad.addColorStop(0, pal.bgInner);
    grad.addColorStop(0.6, pal.bg);
    grad.addColorStop(1, pal.bgOuter);
    ctx2d.fillStyle = grad;
    ctx2d.fillRect(0, 0, vw, vh);

    // Crisp camera-locked 24px architectural dot-grid in logical world coordinates
    const dotStep = 24;
    const topLeft = viewportToLogical({ x: 0, y: 0 }, cam, viewport, logicalSize);
    const botRight = viewportToLogical({ x: vw, y: vh }, cam, viewport, logicalSize);

    const startX = Math.floor(topLeft.x / dotStep) * dotStep;
    const endX = Math.ceil(botRight.x / dotStep) * dotStep;
    const startY = Math.floor(topLeft.y / dotStep) * dotStep;
    const endY = Math.ceil(botRight.y / dotStep) * dotStep;

    const dotR = Math.max(0.75, Math.min(1.5, 1.05 * scale));
    const majorR = Math.max(1.1, Math.min(2.1, 1.45 * scale));
    const majorEvery = dotStep * 4;

    ctx2d.fillStyle = pal.dot;
    ctx2d.beginPath();
    for (let lx = startX; lx <= endX; lx += dotStep) {
      const isMajorX = Math.abs(lx % majorEvery) < 1e-3;
      const sx = vw * 0.5 + (lx - cam.x) * scale;
      for (let ly = startY; ly <= endY; ly += dotStep) {
        if (isMajorX && Math.abs(ly % majorEvery) < 1e-3) continue;
        const sy = vh * 0.5 + (ly - cam.y) * scale;
        ctx2d.moveTo(sx + dotR, sy);
        ctx2d.arc(sx, sy, dotR, 0, Math.PI * 2);
      }
    }
    ctx2d.fill();

    // Major architectural intersection dots every 96px
    ctx2d.fillStyle = pal.dotMajor;
    ctx2d.beginPath();
    for (let lx = startX; lx <= endX; lx += dotStep) {
      if (Math.abs(lx % majorEvery) >= 1e-3) continue;
      const sx = vw * 0.5 + (lx - cam.x) * scale;
      for (let ly = startY; ly <= endY; ly += dotStep) {
        if (Math.abs(ly % majorEvery) >= 1e-3) continue;
        const sy = vh * 0.5 + (ly - cam.y) * scale;
        ctx2d.moveTo(sx + majorR, sy);
        ctx2d.arc(sx, sy, majorR, 0, Math.PI * 2);
      }
    }
    ctx2d.fill();

    // Soft motion trails behind active packets
    for (const pkt of packets.values()) {
      if (pkt.opacity.value < 0.05 || pkt.trails.length === 0) continue;
      for (const tr of pkt.trails) {
        const life = Math.max(0, 1 - tr.age / 0.42);
        if (life <= 0) continue;
        const px = vw * 0.5 + (tr.x - cam.x) * scale;
        const py = vh * 0.5 + (tr.y - cam.y) * scale;
        ctx2d.globalAlpha = life * life * 0.28 * pkt.opacity.value;
        ctx2d.fillStyle = pal.accents[tr.accent];
        ctx2d.beginPath();
        ctx2d.arc(px, py, Math.max(2, (3.2 + life * 3.8) * scale), 0, Math.PI * 2);
        ctx2d.fill();
      }
    }

    ctx2d.restore();
  }

  // ---- Main Render & Spring Step Loop ----
  function render(dt = 0.016): void {
    const safeDt = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0.016;
    const pal = THEME_PALETTES[theme];

    // 1. Step camera springs
    if (!isDragging) {
      camX = stepSpring(camX, camTarget.x, safeDt, 145);
      camY = stepSpring(camY, camTarget.y, safeDt, 145);
    }
    camZoom = stepSpring(camZoom, camTarget.zoom, safeDt, 145);

    const cam: CameraState = { x: camX.value, y: camY.value, zoom: camZoom.value };
    const baseScale = Math.min(
      Math.max(1, viewport.width) / logicalSize.width,
      Math.max(1, viewport.height) / logicalSize.height,
    );
    const scale = baseScale * cam.zoom;
    const tx = viewport.width * 0.5 - cam.x * scale;
    const ty = viewport.height * 0.5 - cam.y * scale;

    worldGroup.setAttribute(
      "transform",
      `translate(${tx.toFixed(2)}, ${ty.toFixed(2)}) scale(${scale.toFixed(5)})`,
    );

    // 2. Step & sync architectural zones
    for (const ent of zones.values()) {
      const revealed = ent.spec.visible !== false && isRevealed(ent.id, ent.spec.group);
      const focused = isFocused(ent.id, ent.spec.group);
      const targetOp = revealed ? (focused ? 1 : 0.34) : 0;
      const targetScale = revealed ? 1 : 0.94;

      ent.x = stepSpring(ent.x, ent.spec.x, safeDt, 200);
      ent.y = stepSpring(ent.y, ent.spec.y, safeDt, 200);
      ent.opacity = stepSpring(ent.opacity, targetOp, safeDt, 190);
      ent.scale = stepSpring(ent.scale, targetScale, safeDt, 190);

      const op = Math.max(0, Math.min(1, ent.opacity.value));
      ent.el.style.display = op < 0.01 ? "none" : "";
      if (op < 0.01) continue;

      const cx = ent.spec.w * 0.5;
      const cy = ent.spec.h * 0.5;
      const sc = ent.scale.value;
      ent.el.setAttribute(
        "transform",
        `translate(${(ent.x.value + cx).toFixed(2)}, ${(ent.y.value + cy).toFixed(2)}) scale(${sc.toFixed(4)}) translate(${(-cx).toFixed(2)}, ${(-cy).toFixed(2)})`,
      );
      ent.el.setAttribute("opacity", op.toFixed(3));

      const accent = resolveAccent(ent.id, ent.spec.group, ent.spec.accent);
      const stroke = accent && focusSet && focused ? pal.accents[accent] : pal.zoneStroke;
      setAttrs(ent.bgRect, {
        x: 0,
        y: 0,
        width: ent.spec.w,
        height: ent.spec.h,
        fill: pal.zoneFill,
        stroke,
        "stroke-width": accent && focusSet && focused ? 1.5 : 1,
      });

      ent.titleText.textContent = ent.spec.title.toUpperCase();
      ent.titleText.setAttribute("fill", pal.inkSecondary);

      if (ent.spec.subtitle) {
        ent.subtitleText.textContent = ent.spec.subtitle;
        ent.subtitleText.setAttribute("x", String(ent.spec.w - 16));
        ent.subtitleText.setAttribute("fill", pal.inkMuted);
        ent.subtitleText.style.display = "";
      } else {
        ent.subtitleText.style.display = "none";
      }
    }

    // 3. Step & sync array rows (also compute live cell bounding boxes for connectors!)
    for (const ent of arrayRows.values()) {
      const revealed = ent.spec.visible !== false && isRevealed(ent.id, ent.spec.group);
      const focused = isFocused(ent.id, ent.spec.group);
      const targetOp = revealed ? (focused ? 1 : 0.28) : 0;
      const targetScale = revealed ? 1 : 0.92;

      ent.x = stepSpring(ent.x, ent.spec.x, safeDt, 220);
      ent.y = stepSpring(ent.y, ent.spec.y, safeDt, 220);
      ent.opacity = stepSpring(ent.opacity, targetOp, safeDt, 200);
      ent.scale = stepSpring(ent.scale, targetScale, safeDt, 200);

      const op = Math.max(0, Math.min(1, ent.opacity.value));
      ent.el.style.display = op < 0.01 ? "none" : "";

      const gap = ent.spec.gap ?? 0;
      const count = ent.spec.cells.length;
      const totalW = Math.max(
        ent.spec.cellW,
        count * ent.spec.cellW + Math.max(0, count - 1) * gap,
      );
      const totalH = ent.spec.cellH;

      // Update live cell rects in logical space even while fading in
      ent.cellRects.clear();
      for (let i = 0; i < count; i++) {
        const cell = ent.spec.cells[i]!;
        const cx = ent.x.value + i * (ent.spec.cellW + gap);
        const cy = ent.y.value;
        ent.cellRects.set(cell.id, { x: cx, y: cy, w: ent.spec.cellW, h: ent.spec.cellH });
      }

      if (op < 0.01) continue;

      const midX = totalW * 0.5;
      const midY = totalH * 0.5;
      ent.el.setAttribute(
        "transform",
        `translate(${(ent.x.value + midX).toFixed(2)}, ${(ent.y.value + midY).toFixed(2)}) scale(${ent.scale.value.toFixed(4)}) translate(${(-midX).toFixed(2)}, ${(-midY).toFixed(2)})`,
      );
      ent.el.setAttribute("opacity", op.toFixed(3));

      if (ent.spec.label) {
        ent.labelText.textContent = ent.spec.label.toUpperCase();
        setAttrs(ent.labelText, { x: 2, y: -10, fill: pal.inkSecondary });
        ent.labelText.style.display = "";
      } else {
        ent.labelText.style.display = "none";
      }

      if (ent.spec.subtitle) {
        ent.subtitleText.textContent = ent.spec.subtitle;
        setAttrs(ent.subtitleText, { x: totalW - 2, y: -10, fill: pal.inkMuted });
        ent.subtitleText.style.display = "";
      } else {
        ent.subtitleText.style.display = "none";
      }

      const rowAccent = resolveAccent(ent.id, ent.spec.group, null);
      const frameStroke =
        rowAccent && focusSet && focused ? pal.accents[rowAccent] : pal.cardStroke;
      setAttrs(ent.frameRect, {
        x: 0,
        y: 0,
        width: totalW,
        height: totalH,
        fill: pal.arrayCellBg,
        stroke: frameStroke,
        "stroke-width": rowAccent && focusSet && focused ? 1.5 : 1,
      });

      const activeCellIds = new Set<string>();
      const headerH = Math.min(24, Math.round(totalH * 0.34));

      for (let i = 0; i < count; i++) {
        const cell = ent.spec.cells[i]!;
        activeCellIds.add(cell.id);

        let cDom = ent.cellDoms.get(cell.id);
        if (!cDom) {
          const g = svgEl("g", { class: "ec-array-cell", "data-cell": cell.id });
          const rect = svgEl("rect", { rx: gap > 0 ? "8" : "0", ry: gap > 0 ? "8" : "0" });
          const headerBg = svgEl("rect");
          const headerText = svgEl("text", {
            "font-family": "var(--mono, ui-monospace, monospace)",
            "font-size": "11",
            "font-weight": "600",
            "text-anchor": "middle",
            "dominant-baseline": "central",
          });
          const valueText = svgEl("text", {
            "font-family": "var(--mono, ui-monospace, monospace)",
            "font-size": "12",
            "font-weight": "600",
            "text-anchor": "middle",
            "dominant-baseline": "central",
          });
          const badgeText = svgEl("text", {
            "font-family": "var(--mono, ui-monospace, monospace)",
            "font-size": "9",
            "font-weight": "600",
            "text-anchor": "middle",
            "dominant-baseline": "central",
            "letter-spacing": "0.05em",
          });
          const accentRing = svgEl("rect", {
            rx: "7",
            ry: "7",
            fill: "none",
          });

          g.appendChild(rect);
          g.appendChild(headerBg);
          g.appendChild(headerText);
          g.appendChild(valueText);
          g.appendChild(badgeText);
          g.appendChild(accentRing);
          ent.cellsLayer.appendChild(g);

          cDom = { g, rect, headerBg, headerText, valueText, badgeText, accentRing };
          ent.cellDoms.set(cell.id, cDom);
        }

        const localX = i * (ent.spec.cellW + gap);
        cDom.g.setAttribute("transform", `translate(${localX.toFixed(1)}, 0)`);
        cDom.g.setAttribute("opacity", cell.dimmed ? "0.42" : "1");

        const cAccent = resolveAccent(cell.id, undefined, cell.accent);
        const isCellActive = Boolean(cell.active);
        const cellFill = isCellActive && cAccent ? pal.accentTints[cAccent] : pal.arrayCellBg;

        setAttrs(cDom.rect, {
          x: 0.5,
          y: 0.5,
          width: ent.spec.cellW - 1,
          height: totalH - 1,
          fill: cellFill,
          stroke: pal.arrayDivider,
          "stroke-width": 1,
          rx: gap > 0 ? 8 : i === 0 || i === count - 1 ? 8 : 0,
        });

        setAttrs(cDom.headerBg, {
          x: 1,
          y: 1,
          width: ent.spec.cellW - 2,
          height: headerH,
          fill: isCellActive && cAccent ? pal.accentTints[cAccent] : pal.arrayHeaderBg,
          rx: gap > 0 ? 7 : 0,
        });

        cDom.headerText.textContent = cell.header ?? cell.key ?? String(i);
        setAttrs(cDom.headerText, {
          x: ent.spec.cellW * 0.5,
          y: headerH * 0.5 + 1,
          fill: isCellActive && cAccent ? pal.accents[cAccent] : pal.inkSecondary,
        });

        cDom.valueText.textContent = cell.value;
        const valY = headerH + (totalH - headerH) * (cell.badge ? 0.38 : 0.52);
        setAttrs(cDom.valueText, {
          x: ent.spec.cellW * 0.5,
          y: valY,
          fill: cell.value === "∅" || cell.value === "—" ? pal.inkMuted : pal.ink,
        });

        if (cell.badge) {
          cDom.badgeText.textContent = cell.badge.toUpperCase();
          setAttrs(cDom.badgeText, {
            x: ent.spec.cellW * 0.5,
            y: totalH - 11,
            fill: cAccent ? pal.accents[cAccent] : pal.inkMuted,
          });
          cDom.badgeText.style.display = "";
        } else {
          cDom.badgeText.style.display = "none";
        }

        if (isCellActive && cAccent) {
          setAttrs(cDom.accentRing, {
            x: 1.5,
            y: 1.5,
            width: ent.spec.cellW - 3,
            height: totalH - 3,
            stroke: pal.accents[cAccent],
            "stroke-width": 2,
          });
          cDom.accentRing.style.display = "";
        } else {
          cDom.accentRing.style.display = "none";
        }
      }

      // Prune removed cells
      for (const [cid, cDom] of ent.cellDoms) {
        if (!activeCellIds.has(cid)) {
          cDom.g.remove();
          ent.cellDoms.delete(cid);
        }
      }
    }

    // 4. Step & sync editorial nodes (and collect visible obstacle boxes for orthogonal routing!)
    const obstacleRects: Rect2D[] = [];

    for (const ent of nodes.values()) {
      const revealed = ent.spec.visible !== false && isRevealed(ent.id, ent.spec.group);
      const focused = isFocused(ent.id, ent.spec.group);
      const dimmedBySpec = Boolean(ent.spec.dimmed);
      const targetOp = revealed ? (focused && !dimmedBySpec ? 1 : 0.28) : 0;
      const targetScale = revealed ? 1 : 0.92;

      ent.x = stepSpring(ent.x, ent.spec.x, safeDt, 210);
      ent.y = stepSpring(ent.y, ent.spec.y, safeDt, 210);
      ent.opacity = stepSpring(ent.opacity, targetOp, safeDt, 200);
      ent.scale = stepSpring(ent.scale, targetScale, safeDt, 210);

      const op = Math.max(0, Math.min(1, ent.opacity.value));
      ent.el.style.display = op < 0.01 ? "none" : "";
      if (op < 0.01) continue;

      obstacleRects.push({
        x: ent.x.value,
        y: ent.y.value,
        w: ent.spec.w,
        h: ent.spec.h,
      });

      const w = ent.spec.w;
      const h = ent.spec.h;
      const cx = w * 0.5;
      const cy = h * 0.5;
      ent.el.setAttribute(
        "transform",
        `translate(${(ent.x.value + cx).toFixed(2)}, ${(ent.y.value + cy).toFixed(2)}) scale(${ent.scale.value.toFixed(4)}) translate(${(-cx).toFixed(2)}, ${(-cy).toFixed(2)})`,
      );
      ent.el.setAttribute("opacity", op.toFixed(3));

      const tone: MonochromeKey = ent.spec.tone ?? "clayLight";
      const isGraphite = tone === "graphite";
      const accent = resolveAccent(ent.id, ent.spec.group, ent.spec.accent);
      const highlight = Boolean(accent && (!focusSet || focused));

      const cardFill = pal.cardFill[tone];
      const strokeColor = highlight && accent ? pal.accents[accent] : pal.cardStroke;
      const strokeW = highlight && accent ? 1.8 : 1;

      if (highlight && accent) {
        setAttrs(ent.haloRect, {
          x: -4,
          y: -4,
          width: w + 8,
          height: h + 8,
          stroke: pal.accents[accent],
          "stroke-opacity": theme === "dark" ? 0.34 : 0.22,
          "stroke-width": 4,
        });
        ent.haloRect.style.display = "";
      } else {
        ent.haloRect.style.display = "none";
      }

      setAttrs(ent.cardRect, {
        x: 0,
        y: 0,
        width: w,
        height: h,
        fill: cardFill,
        stroke: strokeColor,
        "stroke-width": strokeW,
      });

      // Subtle vertical accent bar on left interior edge
      if (accent) {
        setAttrs(ent.accentBar, {
          x: 6,
          y: 10,
          width: 3.5,
          height: Math.max(12, h - 20),
          fill: pal.accents[accent],
          opacity: highlight ? 1 : 0.45,
        });
        ent.accentBar.style.display = "";
      } else {
        ent.accentBar.style.display = "none";
      }

      const textLeft = accent ? 18 : 14;
      const titleColor = isGraphite ? pal.inkOnGraphite : pal.ink;
      const subColor = isGraphite ? "rgba(247, 246, 242, 0.72)" : pal.inkSecondary;

      const hasSub = Boolean(ent.spec.subtitle);
      const hasVal = Boolean(ent.spec.value);
      const titleY = hasSub ? Math.round(h * 0.41) : Math.round(h * 0.55);

      ent.titleText.textContent = ent.spec.title;
      setAttrs(ent.titleText, {
        x: textLeft,
        y: titleY,
        fill: titleColor,
      });

      if (hasSub) {
        ent.subtitleText.textContent = ent.spec.subtitle!;
        setAttrs(ent.subtitleText, {
          x: textLeft,
          y: Math.round(h * 0.72),
          fill: subColor,
        });
        ent.subtitleText.style.display = "";
      } else {
        ent.subtitleText.style.display = "none";
      }

      if (hasVal) {
        const valStr = ent.spec.value!;
        const pillW = Math.max(34, valStr.length * 8 + 14);
        const pillH = 22;
        const pillX = w - pillW - 10;
        const pillY = hasSub
          ? Math.max(11, titleY - 16)
          : Math.round((h - pillH) * 0.5);
        setAttrs(ent.valuePillBg, {
          x: pillX,
          y: pillY,
          width: pillW,
          height: pillH,
          fill: accent ? pal.accentTints[accent] : pal.arrayHeaderBg,
          stroke: accent ? pal.accents[accent] : pal.cardStroke,
          "stroke-opacity": accent ? 0.45 : 1,
          "stroke-width": 1,
        });
        ent.valueText.textContent = valStr;
        setAttrs(ent.valueText, {
          x: pillX + pillW * 0.5,
          y: pillY + pillH * 0.5 + 4,
          fill: accent ? pal.accents[accent] : titleColor,
        });
        ent.valuePillBg.style.display = "";
        ent.valueText.style.display = "";
      } else {
        ent.valuePillBg.style.display = "none";
        ent.valueText.style.display = "none";
      }

      if (ent.spec.badge) {
        const badgeStr = ent.spec.badge.toUpperCase();
        const bw = Math.max(38, badgeStr.length * 6.4 + 14);
        const bh = 16;
        const bx = w - bw - 8;
        const by = -8;
        setAttrs(ent.badgeBg, {
          x: bx,
          y: by,
          width: bw,
          height: bh,
          fill: accent ? pal.accents[accent] : pal.cardFill.graphite,
        });
        ent.badgeText.textContent = badgeStr;
        setAttrs(ent.badgeText, {
          x: bx + bw * 0.5,
          y: by + bh * 0.5 + 3.2,
          fill: "#ffffff",
        });
        ent.badgeBg.style.display = "";
        ent.badgeText.style.display = "";
      } else {
        ent.badgeBg.style.display = "none";
        ent.badgeText.style.display = "none";
      }
    }

    // 5. Step & route orthogonal connectors
    for (const ent of connectors.values()) {
      const revealed = ent.spec.visible !== false && isRevealed(ent.id, ent.spec.group);
      const focused = isFocused(ent.id, ent.spec.group);
      const targetOp = revealed ? (focused ? 1 : 0.22) : 0;

      ent.opacity = stepSpring(ent.opacity, targetOp, safeDt, 200);
      const op = Math.max(0, Math.min(1, ent.opacity.value));
      ent.el.style.display = op < 0.01 ? "none" : "";

      const fromRef = resolveEntityRect(ent.spec.from);
      const toRef = resolveEntityRect(ent.spec.to);
      if (!fromRef || !toRef) {
        ent.el.style.display = "none";
        continue;
      }

      const obstacles = ent.spec.avoidObstacles === false ? [] : obstacleRects;
      const routed = routeOrthogonal(fromRef, toRef, obstacles, {
        fromSide: ent.spec.fromSide,
        toSide: ent.spec.toSide,
        radius: 10,
        padding: ent.spec.padding ?? 12,
        stub: ent.spec.stub ?? 16,
        bendOffset: ent.spec.bendOffset ?? 0,
      });

      ent.points = routed.points;
      ent.midpoint = routed.midpoint;

      if (op < 0.01) continue;

      const accent = resolveAccent(ent.id, ent.spec.group, ent.spec.accent);
      const isActive = Boolean(ent.spec.active) || Boolean(accent && focusSet && focused);
      const strokeColor = accent && (isActive || !focusSet) ? pal.accents[accent] : pal.connectorStroke;
      const markerKey: "default" | AccentKey =
        accent && (isActive || !focusSet) ? accent : "default";
      const strokeW = isActive ? 2.2 : 1.5;

      ent.el.setAttribute("opacity", op.toFixed(3));
      setAttrs(ent.haloPath, {
        d: routed.path,
        stroke: pal.connectorHalo,
        "stroke-width": strokeW + 3.5,
      });
      setAttrs(ent.strokePath, {
        d: routed.path,
        stroke: strokeColor,
        "stroke-width": strokeW,
        "stroke-dasharray": ent.spec.dashed ? "5 4" : "",
        "marker-end": `url(#ec-arrow-${markerKey})`,
        "marker-start": ent.spec.bidirectional ? `url(#ec-arrow-start-${markerKey})` : "",
      });

      if (ent.spec.label) {
        const lbl = ent.spec.label;
        const pw = Math.max(36, lbl.length * 6.4 + 14);
        const ph = 18;
        ent.pillGroup.setAttribute(
          "transform",
          `translate(${routed.midpoint.x.toFixed(1)}, ${routed.midpoint.y.toFixed(1)})`,
        );
        setAttrs(ent.pillRect, {
          x: -pw * 0.5,
          y: -ph * 0.5,
          width: pw,
          height: ph,
          fill: pal.pillBg,
          stroke: accent && isActive ? pal.accents[accent] : pal.pillStroke,
          "stroke-width": 1,
        });
        ent.pillText.textContent = lbl;
        ent.pillText.setAttribute(
          "fill",
          accent && isActive ? pal.accents[accent] : pal.inkSecondary,
        );
        ent.pillGroup.style.display = "";
      } else {
        ent.pillGroup.style.display = "none";
      }
    }

    // 6. Step & render glowing animated packets along connectors
    for (const ent of packets.values()) {
      const conn = connectors.get(ent.spec.connectorId);
      const revealed =
        ent.spec.visible !== false &&
        Boolean(conn && conn.points.length >= 2) &&
        isRevealed(ent.id, ent.spec.group);
      const focused = isFocused(ent.id, ent.spec.group);
      const targetOp = revealed ? (focused ? 1 : 0.25) : 0;

      ent.progress = stepSpring(ent.progress, ent.spec.progress, safeDt, 260);
      ent.opacity = stepSpring(ent.opacity, targetOp, safeDt, 220);

      // Age existing motion trail dots
      for (let i = ent.trails.length - 1; i >= 0; i--) {
        ent.trails[i]!.age += safeDt;
        if (ent.trails[i]!.age > 0.42) {
          ent.trails.splice(i, 1);
        }
      }

      const op = Math.max(0, Math.min(1, ent.opacity.value));
      if (op < 0.01 || !conn || conn.points.length < 2) {
        ent.el.style.display = "none";
        continue;
      }

      const pt = samplePolyline(conn.points, ent.progress.value);
      ent.pos = { x: pt.x, y: pt.y };

      const accent: AccentKey =
        resolveAccent(ent.id, ent.spec.group, ent.spec.accent) ?? "orange";
      const color = pal.accents[accent];

      // Append trail sample when moving
      const lastTrail = ent.trails[ent.trails.length - 1];
      if (!lastTrail || Math.hypot(pt.x - lastTrail.x, pt.y - lastTrail.y) > 7) {
        ent.trails.push({ x: pt.x, y: pt.y, age: 0, accent });
        if (ent.trails.length > 18) ent.trails.shift();
      }

      ent.el.style.display = "";
      ent.el.setAttribute("opacity", op.toFixed(3));
      ent.el.setAttribute("transform", `translate(${pt.x.toFixed(2)}, ${pt.y.toFixed(2)})`);

      setAttrs(ent.glowCircle, { fill: color, opacity: theme === "dark" ? 0.52 : 0.36 });
      setAttrs(ent.coreCircle, { fill: color, stroke: "#ffffff", "stroke-width": 1.6 });

      if (ent.spec.label) {
        const lbl = ent.spec.label;
        const lw = Math.max(32, lbl.length * 6.2 + 12);
        const lh = 17;
        setAttrs(ent.labelBg, {
          x: -lw * 0.5,
          y: -24,
          width: lw,
          height: lh,
          fill: color,
        });
        ent.labelText.textContent = lbl;
        setAttrs(ent.labelText, {
          x: 0,
          y: -24 + lh * 0.5,
          fill: "#ffffff",
        });
        ent.labelBg.style.display = "";
        ent.labelText.style.display = "";
      } else {
        ent.labelBg.style.display = "none";
        ent.labelText.style.display = "none";
      }
    }

    // 6b. Step & render Tactile Kinetic Strips (mechanical switchboards)
    const tp = pal.tactile;
    for (const ent of strips.values()) {
      const revealed = ent.spec.visible !== false && isRevealed(ent.id, ent.spec.group);
      const focused = isFocused(ent.id, ent.spec.group);
      const targetOp = revealed ? (focused ? 1 : 0.34) : 0;
      const targetScale = revealed ? 1 : 0.96;

      ent.x = stepSpring(ent.x, ent.spec.x, safeDt, 220);
      ent.y = stepSpring(ent.y, ent.spec.y, safeDt, 220);
      ent.opacity = stepSpring(ent.opacity, targetOp, safeDt, 200);
      ent.scale = stepSpring(ent.scale, targetScale, safeDt, 210);

      const itemW = ent.spec.itemW ?? 72;
      const itemH = ent.spec.itemH ?? 46;
      const gap = ent.spec.gap ?? 10;
      const count = ent.spec.items.length;
      const totalW = Math.max(itemW, count * itemW + Math.max(0, count - 1) * gap);
      const padX = 8;
      const padY = 7;

      // Keep live anchors updated even while fading
      ent.anchors.clear();
      ent.itemRects.clear();
      ent.anchors.set(ent.id, { x: ent.x.value + totalW * 0.5, y: ent.y.value + itemH * 0.5 });
      ent.anchors.set(`${ent.id}_top`, { x: ent.x.value + totalW * 0.5, y: ent.y.value - 2 });
      ent.anchors.set(`${ent.id}_bottom`, { x: ent.x.value + totalW * 0.5, y: ent.y.value + itemH + 8 });

      const activeItemIds = new Set<string>();
      for (let i = 0; i < count; i++) {
        const item = ent.spec.items[i]!;
        activeItemIds.add(item.id);
        let dom = ent.itemDoms.get(item.id);
        if (!dom) {
          const g = svgEl("g", { class: "ec-strip-key", "data-key-id": item.id });
          const wellRect = svgEl("rect", { rx: "8", ry: "8" });
          const wellInset = svgEl("line", { "stroke-linecap": "round" });
          const capGroup = svgEl("g", { class: "ec-strip-cap" });
          const capRect = svgEl("rect", {
            rx: "7.5",
            ry: "7.5",
            filter: "url(#ec-tactile-shadow)",
          });
          const capHighlight = svgEl("line", { "stroke-linecap": "round" });
          const keyText = svgEl("text", {
            "font-family": "var(--sans, ui-sans-serif, system-ui, sans-serif)",
            "text-anchor": "middle",
            "dominant-baseline": "central",
          });
          const dotHalo = svgEl("circle", { r: "7", filter: "url(#ec-dot-glow)" });
          const dotCore = svgEl("circle", { r: "3.5" });

          capGroup.appendChild(capRect);
          capGroup.appendChild(capHighlight);
          capGroup.appendChild(keyText);
          g.appendChild(wellRect);
          g.appendChild(wellInset);
          g.appendChild(capGroup);
          g.appendChild(dotHalo);
          g.appendChild(dotCore);
          ent.itemsLayer.appendChild(g);

          dom = {
            g,
            wellRect,
            wellInset,
            capGroup,
            capRect,
            capHighlight,
            keyText,
            dotHalo,
            dotCore,
            press: { value: item.active ? 2.5 : 0, velocity: 0 },
          };
          ent.itemDoms.set(item.id, dom);
        }

        const isActive = Boolean(item.active);
        const isOccupied = item.occupied !== undefined ? Boolean(item.occupied) : isActive;
        dom.press = stepSpring(dom.press, isActive ? 2.5 : 0, safeDt, 320);

        const localX = i * (itemW + gap);
        const worldX = ent.x.value + localX;
        const worldY = ent.y.value;
        ent.itemRects.set(item.id, { x: worldX, y: worldY, w: itemW, h: itemH });
        ent.anchors.set(item.id, { x: worldX + itemW * 0.5, y: worldY + itemH * 0.5 });
        ent.anchors.set(`${item.id}_top`, { x: worldX + itemW * 0.5, y: worldY - 2 });
        ent.anchors.set(`${item.id}_bottom`, {
          x: worldX + itemW * 0.5,
          y: worldY + itemH + 8 + dom.press.value * 0.5,
        });

        dom.g.setAttribute("transform", `translate(${localX.toFixed(1)}, 0)`);
        dom.g.setAttribute("opacity", item.dimmed ? "0.42" : "1");

        const itemAccent = resolveAccent(item.id, ent.spec.group, item.accent);
        const accentColor = itemAccent ? pal.accents[itemAccent] : pal.accents.cobalt;

        // Milled well
        setAttrs(dom.wellRect, {
          x: 0,
          y: 0,
          width: itemW,
          height: itemH,
          fill: tp.wellFill,
          stroke: !isOccupied && isActive ? accentColor : tp.wellStroke,
          "stroke-width": !isOccupied && isActive ? 1.4 : 1,
        });
        setAttrs(dom.wellInset, {
          x1: 5,
          y1: 1.5,
          x2: itemW - 5,
          y2: 1.5,
          stroke: tp.wellInsetLine,
          "stroke-width": 1,
        });

        // Mechanical keycap depression spring
        dom.capGroup.setAttribute("transform", `translate(0, ${dom.press.value.toFixed(2)})`);

        if (isOccupied) {
          setAttrs(dom.capRect, {
            x: 1,
            y: 1,
            width: itemW - 2,
            height: itemH - 2,
            fill: tp.tileFill,
            stroke: isActive ? accentColor : tp.tileStroke,
            "stroke-width": isActive ? 1.65 : 1,
          });
          dom.capRect.style.display = "";
          setAttrs(dom.capHighlight, {
            x1: 8,
            y1: 2.3,
            x2: itemW - 8,
            y2: 2.3,
            stroke: tp.tileTopHighlight,
            "stroke-width": 1,
          });
          dom.capHighlight.style.display = "";
          dom.keyText.textContent = item.key;
          setAttrs(dom.keyText, {
            x: itemW * 0.5,
            y: itemH * 0.5 + 0.5,
            "font-size": 16,
            "font-weight": 680,
            fill: tp.tileInk,
          });
        } else {
          dom.capRect.style.display = "none";
          dom.capHighlight.style.display = "none";
          dom.keyText.textContent = item.key;
          setAttrs(dom.keyText, {
            x: itemW * 0.5,
            y: itemH * 0.5 + 0.5,
            "font-size": 14.5,
            "font-weight": 550,
            fill: isActive ? accentColor : tp.emptyKeyInk,
          });
        }

        // Single glowing anchor dot beneath the active keycap rim
        if (isActive) {
          const dotY = itemH + 8 + dom.press.value * 0.5;
          setAttrs(dom.dotHalo, {
            cx: itemW * 0.5,
            cy: dotY,
            fill: accentColor,
            opacity: theme === "dark" ? 0.34 : 0.22,
          });
          setAttrs(dom.dotCore, {
            cx: itemW * 0.5,
            cy: dotY,
            fill: accentColor,
          });
          dom.dotHalo.style.display = "";
          dom.dotCore.style.display = "";
        } else {
          dom.dotHalo.style.display = "none";
          dom.dotCore.style.display = "none";
        }
      }

      for (const [kid, dom] of ent.itemDoms) {
        if (!activeItemIds.has(kid)) {
          dom.g.remove();
          ent.itemDoms.delete(kid);
        }
      }

      const op = Math.max(0, Math.min(1, ent.opacity.value));
      ent.el.style.display = op < 0.01 ? "none" : "";
      if (op < 0.01) continue;

      const midX = totalW * 0.5;
      const midY = itemH * 0.5;
      ent.el.setAttribute(
        "transform",
        `translate(${(ent.x.value + midX).toFixed(2)}, ${(ent.y.value + midY).toFixed(2)}) scale(${ent.scale.value.toFixed(4)}) translate(${(-midX).toFixed(2)}, ${(-midY).toFixed(2)})`,
      );
      ent.el.setAttribute("opacity", op.toFixed(3));

      if (ent.spec.eyebrow) {
        ent.eyebrowText.textContent = ent.spec.eyebrow.toUpperCase();
        setAttrs(ent.eyebrowText, {
          x: -padX + 2,
          y: -padY - 11,
          fill: tp.eyebrowInk,
        });
        ent.eyebrowText.style.display = "";
      } else {
        ent.eyebrowText.style.display = "none";
      }

      setAttrs(ent.plateRect, {
        x: -padX,
        y: -padY,
        width: totalW + padX * 2,
        height: itemH + padY * 2,
        fill: tp.plateFill,
        stroke: tp.plateStroke,
        "stroke-width": 1,
      });
    }

    // 6c. Step & render Tactile Kinetic Tracks (milled recency rail + lift-arc & evict drop-off physics)
    for (const ent of tracks.values()) {
      const revealed = ent.spec.visible !== false && isRevealed(ent.id, ent.spec.group);
      const focused = isFocused(ent.id, ent.spec.group);
      const targetOp = revealed ? (focused ? 1 : 0.34) : 0;
      const targetScale = revealed ? 1 : 0.96;

      ent.x = stepSpring(ent.x, ent.spec.x, safeDt, 210);
      ent.y = stepSpring(ent.y, ent.spec.y, safeDt, 210);
      ent.opacity = stepSpring(ent.opacity, targetOp, safeDt, 200);
      ent.scale = stepSpring(ent.scale, targetScale, safeDt, 210);

      const slots = Math.max(1, Math.round(ent.spec.slots));
      const slotW = ent.spec.slotW ?? 118;
      const slotH = ent.spec.slotH ?? 84;
      const gap = ent.spec.gap ?? 24;
      const railW = slots * slotW + Math.max(0, slots - 1) * gap;
      const padX = 14;
      const padY = 12;
      const evictEdge = Boolean(ent.spec.evictEdge);

      // Rebuild recessed slot cavities if count changed
      while (ent.slotDoms.length < slots) {
        const g = svgEl("g", { class: "ec-track-slot" });
        const wellRect = svgEl("rect", { rx: "10", ry: "10" });
        const wellInset = svgEl("line", { "stroke-linecap": "round" });
        const numeralText = svgEl("text", {
          "font-family": "var(--mono, ui-monospace, monospace)",
          "font-size": "11",
          "font-weight": "500",
          "letter-spacing": "0.10em",
          "text-anchor": "middle",
          "dominant-baseline": "central",
        });
        g.appendChild(wellRect);
        g.appendChild(wellInset);
        g.appendChild(numeralText);
        ent.slotsLayer.appendChild(g);
        ent.slotDoms.push({ g, wellRect, wellInset, numeralText });
      }
      while (ent.slotDoms.length > slots) {
        ent.slotDoms.pop()?.g.remove();
      }

      // Reset dynamic anchors
      ent.anchors.clear();
      ent.tileRects.clear();
      ent.anchors.set(ent.id, { x: ent.x.value + railW * 0.5, y: ent.y.value + slotH * 0.5 });
      ent.anchors.set(`${ent.id}_top`, { x: ent.x.value + railW * 0.5, y: ent.y.value - padY });
      ent.anchors.set(`${ent.id}_bottom`, {
        x: ent.x.value + railW * 0.5,
        y: ent.y.value + slotH + padY + 2,
      });

      for (let i = 0; i < slots; i++) {
        const sx = i * (slotW + gap);
        const sDom = ent.slotDoms[i]!;
        sDom.g.setAttribute("transform", `translate(${sx.toFixed(1)}, 0)`);
        setAttrs(sDom.wellRect, {
          x: 0,
          y: 0,
          width: slotW,
          height: slotH,
          fill: tp.wellFill,
          stroke: tp.wellStroke,
          "stroke-width": 1,
        });
        setAttrs(sDom.wellInset, {
          x1: 8,
          y1: 1.5,
          x2: slotW - 8,
          y2: 1.5,
          stroke: tp.wellInsetLine,
          "stroke-width": 1,
        });
        sDom.numeralText.textContent = String(i + 1).padStart(2, "0");
        setAttrs(sDom.numeralText, {
          x: slotW * 0.5,
          y: slotH * 0.52,
          fill: tp.wellNumeral,
        });

        ent.anchors.set(`${ent.id}_slot_${i}`, {
          x: ent.x.value + sx + slotW * 0.5,
          y: ent.y.value + slotH * 0.5,
        });
      }

      // Whisper-thin double-headed hairline ticks between adjacent occupied tiles
      const showLinks = ent.spec.showLinks !== false;
      const occupiedCount = Math.min(slots, ent.spec.tiles.length);
      const linkCount = showLinks ? Math.max(0, occupiedCount - 1) : 0;
      while (ent.linkPaths.length < linkCount) {
        const p = svgEl("path", { fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" });
        ent.linksLayer.appendChild(p);
        ent.linkPaths.push(p);
      }
      while (ent.linkPaths.length > linkCount) {
        ent.linkPaths.pop()?.remove();
      }
      for (let i = 0; i < linkCount; i++) {
        const leftTile = ent.spec.tiles[i];
        const rightTile = ent.spec.tiles[i + 1];
        const midX = i * (slotW + gap) + slotW + gap * 0.5;
        const midY = slotH * 0.5;
        const half = Math.max(4, Math.min(7.5, gap * 0.34));
        const chev = 2.6;
        const d = `M ${(midX - half).toFixed(1)} ${midY.toFixed(1)} H ${(midX + half).toFixed(1)} M ${(midX - half + chev).toFixed(1)} ${(midY - chev).toFixed(1)} L ${(midX - half).toFixed(1)} ${midY.toFixed(1)} L ${(midX - half + chev).toFixed(1)} ${(midY + chev).toFixed(1)} M ${(midX + half - chev).toFixed(1)} ${(midY - chev).toFixed(1)} L ${(midX + half).toFixed(1)} ${midY.toFixed(1)} L ${(midX + half - chev).toFixed(1)} ${(midY + chev).toFixed(1)}`;
        const activeNeighbor =
          leftTile?.state === "active" ||
          leftTile?.state === "promoted" ||
          rightTile?.state === "active" ||
          rightTile?.state === "promoted";
        const activeAcc = leftTile?.accent ?? rightTile?.accent ?? null;
        setAttrs(ent.linkPaths[i]!, {
          d,
          stroke: activeNeighbor && activeAcc ? pal.accents[activeAcc] : tp.linkTickInk,
          "stroke-width": activeNeighbor ? 1.35 : 1.05,
          opacity: activeNeighbor ? 0.78 : 0.85,
        });
      }

      // Prepare target tile specs: active rail tiles + evicted drop-off tiles
      const isInitialMount = ent.tileDoms.size === 0;
      const presentIds = new Set<string>();
      const liftedDoms: TrackTileDom[] = [];
      let hasVisibleEvicted = false;

      const ensureTileDom = (
        tileSpec: TrackTileSpec,
        spawnX: number,
        spawnY: number,
        spawnOp: number,
        spawnScale: number,
        initSlot: number | null,
      ): TrackTileDom => {
        let dom = ent.tileDoms.get(tileSpec.id);
        if (!dom) {
          const g = svgEl("g", { class: "ec-track-tile", "data-tile-id": tileSpec.id });
          const cardRect = svgEl("rect", {
            rx: "9",
            ry: "9",
            filter: "url(#ec-tactile-shadow)",
          });
          const topHighlight = svgEl("line", { "stroke-linecap": "round" });
          const accentPip = svgEl("rect", { rx: "1.25", ry: "1.25" });
          const keyText = svgEl("text", {
            "font-family": "var(--sans, ui-sans-serif, system-ui, sans-serif)",
            "font-size": "22",
            "font-weight": "700",
            "letter-spacing": "-0.02em",
            "text-anchor": "middle",
            "dominant-baseline": "central",
          });
          const subText = svgEl("text", {
            "font-family": "var(--mono, ui-monospace, monospace)",
            "font-size": "11.5",
            "font-weight": "500",
            "text-anchor": "middle",
            "dominant-baseline": "central",
          });

          g.appendChild(cardRect);
          g.appendChild(topHighlight);
          g.appendChild(accentPip);
          g.appendChild(keyText);
          g.appendChild(subText);
          ent.tilesLayer.appendChild(g);

          dom = {
            id: tileSpec.id,
            g,
            cardRect,
            topHighlight,
            accentPip,
            keyText,
            subText,
            x: { value: spawnX, velocity: 0 },
            y: { value: spawnY, velocity: 0 },
            rot: { value: 0, velocity: 0 },
            opacity: { value: spawnOp, velocity: 0 },
            scale: { value: spawnScale, velocity: 0 },
            prevSlot: initSlot,
            arcFromX: spawnX,
            arcToX: spawnX,
            arcPeak: 0,
            arcActive: false,
            liveLiftY: 0,
            wasEvicted: false,
          };
          ent.tileDoms.set(tileSpec.id, dom);
        }
        return dom;
      };

      const styleTileDom = (
        dom: TrackTileDom,
        tileSpec: TrackTileSpec,
        liveX: number,
        liveY: number,
        isEvicted: boolean,
      ) => {
        const isHighlighted =
          !isEvicted && (tileSpec.state === "active" || tileSpec.state === "promoted");
        const tileAcc = resolveAccent(tileSpec.id, ent.spec.group, tileSpec.accent);
        const accentColor = tileAcc ? pal.accents[tileAcc] : pal.accents.cobalt;
        const isLifted = Math.abs(dom.liveLiftY) > 2;

        const cx = slotW * 0.5;
        const cy = slotH * 0.5;
        dom.g.setAttribute(
          "transform",
          `translate(${(liveX + cx).toFixed(2)}, ${(liveY + cy).toFixed(2)}) rotate(${dom.rot.value.toFixed(2)}) scale(${dom.scale.value.toFixed(4)}) translate(${(-cx).toFixed(2)}, ${(-cy).toFixed(2)})`,
        );
        dom.g.setAttribute("opacity", Math.max(0, Math.min(1, dom.opacity.value)).toFixed(3));

        setAttrs(dom.cardRect, {
          x: 1,
          y: 1,
          width: slotW - 2,
          height: slotH - 2,
          fill: tp.tileFill,
          stroke: isEvicted
            ? tileAcc
              ? pal.accents[tileAcc]
              : pal.accents.ember
            : isHighlighted
              ? accentColor
              : tp.tileStroke,
          "stroke-width": isHighlighted || isEvicted ? 1.65 : 1,
          filter: isLifted ? "url(#ec-tactile-lifted-shadow)" : "url(#ec-tactile-shadow)",
        });

        setAttrs(dom.topHighlight, {
          x1: 10,
          y1: 2.4,
          x2: slotW - 10,
          y2: 2.4,
          stroke: tp.tileTopHighlight,
          "stroke-width": 1,
        });

        if (isHighlighted) {
          setAttrs(dom.accentPip, {
            x: slotW * 0.5 - 9,
            y: 7,
            width: 18,
            height: 2.5,
            fill: accentColor,
          });
          dom.accentPip.style.display = "";
        } else {
          dom.accentPip.style.display = "none";
        }

        const hasSub = tileSpec.sublabel != null && tileSpec.sublabel !== "";
        dom.keyText.textContent = tileSpec.key;
        setAttrs(dom.keyText, {
          x: slotW * 0.5,
          y: hasSub ? slotH * 0.43 : slotH * 0.52,
          fill: tp.tileInk,
        });

        if (hasSub) {
          dom.subText.textContent = tileSpec.sublabel!;
          setAttrs(dom.subText, {
            x: slotW * 0.5,
            y: slotH * 0.72,
            fill: tp.tileSubInk,
          });
          dom.subText.style.display = "";
        } else {
          dom.subText.style.display = "none";
        }

        const worldX = ent.x.value + liveX;
        const worldY = ent.y.value + liveY;
        ent.tileRects.set(tileSpec.id, { x: worldX, y: worldY, w: slotW, h: slotH });
        ent.anchors.set(tileSpec.id, { x: worldX + slotW * 0.5, y: worldY + slotH * 0.5 });
        ent.anchors.set(`${tileSpec.id}_top`, { x: worldX + slotW * 0.5, y: worldY - 1 });
        ent.anchors.set(`${tileSpec.id}_bottom`, {
          x: worldX + slotW * 0.5,
          y: worldY + slotH + 6,
        });
      };

      // 1) Active rail tiles
      for (let i = 0; i < Math.min(slots, ent.spec.tiles.length); i++) {
        const tile = ent.spec.tiles[i]!;
        presentIds.add(tile.id);
        const targetX = i * (slotW + gap);
        const spawnX = isInitialMount ? targetX : Math.max(-24, targetX - 24);
        const spawnY = isInitialMount ? 0 : -12;
        const dom = ensureTileDom(
          tile,
          spawnX,
          spawnY,
          isInitialMount ? 1 : 0.05,
          isInitialMount ? 1 : 0.94,
          i,
        );

        // Trigger physical parabolic lift-arc when promoted leftward across neighbors!
        if (dom.prevSlot !== null && dom.prevSlot !== i) {
          if (i < dom.prevSlot && !dom.wasEvicted) {
            dom.arcFromX = dom.x.value;
            dom.arcToX = targetX;
            dom.arcPeak = Math.min(42, 26 + (dom.prevSlot - i) * 7);
            dom.arcActive = true;
          } else {
            dom.arcActive = false;
          }
          dom.prevSlot = i;
        }
        dom.wasEvicted = false;

        // Slightly softer spring during lift-arc so the user clearly enjoys the arc motion
        const xStiff = dom.arcActive ? 145 : 205;
        dom.x = stepSpring(dom.x, targetX, safeDt, xStiff);
        dom.y = stepSpring(dom.y, 0, safeDt, 210);
        dom.rot = stepSpring(dom.rot, 0, safeDt, 210);
        dom.opacity = stepSpring(dom.opacity, 1, safeDt, 220);
        dom.scale = stepSpring(dom.scale, 1, safeDt, 220);

        let liftY = 0;
        if (dom.arcActive) {
          const span = dom.arcToX - dom.arcFromX;
          const progress =
            Math.abs(span) > 1
              ? Math.max(0, Math.min(1, (dom.x.value - dom.arcFromX) / span))
              : 1;
          liftY = computeLiftArcOffset(progress, dom.arcPeak);
          if (Math.abs(dom.x.value - dom.arcToX) < 1.2 && Math.abs(dom.x.velocity) < 8) {
            dom.arcActive = false;
            liftY = 0;
          }
        }
        dom.liveLiftY = liftY;
        const liveX = dom.x.value;
        const liveY = dom.y.value + liftY;
        if (Math.abs(liftY) > 1.5) liftedDoms.push(dom);

        dom.g.style.display = "";
        styleTileDom(dom, tile, liveX, liveY, false);
      }

      // 2) Evicted drop-off tiles (slide smoothly off the chamfered right edge!)
      const evList = ent.spec.evictedTiles ?? [];
      for (let i = 0; i < evList.length; i++) {
        const tile = evList[i]!;
        if (presentIds.has(tile.id)) continue;
        presentIds.add(tile.id);
        hasVisibleEvicted = true;

        const lastSlotX = (slots - 1) * (slotW + gap);
        const dropX = railW + 40;
        const dropY = 20;
        const dom = ensureTileDom(tile, lastSlotX, 0, 0.96, 1, slots - 1);
        dom.arcActive = false;
        dom.liveLiftY = 0;
        dom.wasEvicted = true;

        dom.x = stepSpring(dom.x, dropX, safeDt, 150);
        dom.y = stepSpring(dom.y, dropY, safeDt, 150);
        dom.rot = stepSpring(dom.rot, 7.5, safeDt, 150);
        dom.opacity = stepSpring(dom.opacity, 0.56, safeDt, 170);
        dom.scale = stepSpring(dom.scale, 0.96, safeDt, 170);

        dom.g.style.display = "";
        styleTileDom(dom, tile, dom.x.value, dom.y.value, true);
      }

      // Fade out & clean up removed tiles
      for (const [tid, dom] of ent.tileDoms) {
        if (presentIds.has(tid)) continue;
        dom.opacity = stepSpring(dom.opacity, 0, safeDt, 240);
        if (dom.opacity.value < 0.02) {
          dom.g.remove();
          ent.tileDoms.delete(tid);
        } else {
          dom.g.setAttribute("opacity", dom.opacity.value.toFixed(3));
        }
      }

      // Ensure lifted arcing tiles paint ABOVE sliding neighbors!
      for (const lDom of liftedDoms) {
        if (ent.tilesLayer.lastChild !== lDom.g) {
          ent.tilesLayer.appendChild(lDom.g);
        }
      }

      // Register eviction drop-off edge anchor cleanly at bottom of drop zone
      ent.anchors.set(`${ent.id}_evict`, {
        x: ent.x.value + (hasVisibleEvicted ? railW + 40 + slotW * 0.5 : railW + 48),
        y: ent.y.value + (hasVisibleEvicted ? 20 + slotH + 6 : slotH + padY + 2),
      });

      const op = Math.max(0, Math.min(1, ent.opacity.value));
      ent.el.style.display = op < 0.01 ? "none" : "";
      if (op < 0.01) continue;

      const midX = railW * 0.5;
      const midY = slotH * 0.5;
      ent.el.setAttribute(
        "transform",
        `translate(${(ent.x.value + midX).toFixed(2)}, ${(ent.y.value + midY).toFixed(2)}) scale(${ent.scale.value.toFixed(4)}) translate(${(-midX).toFixed(2)}, ${(-midY).toFixed(2)})`,
      );
      ent.el.setAttribute("opacity", op.toFixed(3));

      // Eyebrow & end-cap ticks — silk-screened cleanly in the left margin so overhead arcLinks never cross text
      const leftTick = ent.spec.leftTick ?? "|← MRU";
      const rightTick = ent.spec.rightTick ?? "LRU →|";
      const evictLabel = ent.spec.evictLabel ?? "evict ↘";

      if (ent.spec.eyebrow) {
        ent.eyebrowText.textContent = ent.spec.eyebrow.toUpperCase();
        setAttrs(ent.eyebrowText, {
          x: -padX - 16,
          y: leftTick ? slotH * 0.5 - 9 : slotH * 0.5 + 3,
          "text-anchor": "end",
          fill: tp.eyebrowInk,
        });
        ent.eyebrowText.style.display = "";
      } else {
        ent.eyebrowText.style.display = "none";
      }

      if (leftTick) {
        ent.leftTickText.textContent = leftTick;
        setAttrs(ent.leftTickText, {
          x: -padX - 16,
          y: ent.spec.eyebrow ? slotH * 0.5 + 9 : slotH * 0.5,
          fill: tp.tickInk,
        });
        ent.leftTickText.style.display = "";
      } else {
        ent.leftTickText.style.display = "none";
      }

      if (evictEdge) {
        // Align LRU →| and evict ↘ cleanly on the top baseline flanking the dashed drop-off line
        if (rightTick) {
          ent.rightTickText.textContent = rightTick;
          setAttrs(ent.rightTickText, {
            x: railW + 4,
            y: -padY - 12,
            "text-anchor": "end",
            "dominant-baseline": "auto",
            fill: tp.tickInk,
          });
          ent.rightTickText.style.display = "";
        } else {
          ent.rightTickText.style.display = "none";
        }
        ent.evictTickText.textContent = evictLabel;
        setAttrs(ent.evictTickText, {
          x: railW + 26,
          y: -padY - 12,
          "text-anchor": "start",
          "dominant-baseline": "auto",
          fill: hasVisibleEvicted ? pal.accents.ember : tp.tickInk,
        });
        ent.evictTickText.style.display = "";
        setAttrs(ent.evictLine, {
          x1: railW + 19,
          y1: -padY - 4,
          x2: railW + 19,
          y2: slotH + padY + 4,
          stroke: hasVisibleEvicted ? pal.accents.ember : tp.evictEdgeLine,
          "stroke-opacity": hasVisibleEvicted ? 0.65 : 1,
          "stroke-width": 1.15,
        });
        ent.evictLine.style.display = "";
      } else {
        ent.evictLine.style.display = "none";
        ent.evictTickText.style.display = "none";
        if (rightTick) {
          ent.rightTickText.textContent = rightTick;
          setAttrs(ent.rightTickText, {
            x: railW + padX + 14,
            y: slotH * 0.5,
            "text-anchor": "start",
            "dominant-baseline": "central",
            fill: tp.tickInk,
          });
          ent.rightTickText.style.display = "";
        } else {
          ent.rightTickText.style.display = "none";
        }
      }

      // Milled plate path (chamfered right exit lip when evictEdge is true)
      const x0 = -padX;
      const y0 = -padY;
      const y1 = slotH + padY;
      const r = 14;
      let plateD: string;
      if (evictEdge) {
        const xr = railW + 8;
        const ch = 7;
        plateD = `M ${(x0 + r).toFixed(1)} ${y0.toFixed(1)} H ${xr.toFixed(1)} L ${(xr + ch).toFixed(1)} ${(y0 + ch).toFixed(1)} V ${(y1 - ch).toFixed(1)} L ${xr.toFixed(1)} ${y1.toFixed(1)} H ${(x0 + r).toFixed(1)} Q ${x0.toFixed(1)} ${y1.toFixed(1)} ${x0.toFixed(1)} ${(y1 - r).toFixed(1)} V ${(y0 + r).toFixed(1)} Q ${x0.toFixed(1)} ${y0.toFixed(1)} ${(x0 + r).toFixed(1)} ${y0.toFixed(1)} Z`;
      } else {
        const x1 = railW + padX;
        plateD = `M ${(x0 + r).toFixed(1)} ${y0.toFixed(1)} H ${(x1 - r).toFixed(1)} Q ${x1.toFixed(1)} ${y0.toFixed(1)} ${x1.toFixed(1)} ${(y0 + r).toFixed(1)} V ${(y1 - r).toFixed(1)} Q ${x1.toFixed(1)} ${y1.toFixed(1)} ${(x1 - r).toFixed(1)} ${y1.toFixed(1)} H ${(x0 + r).toFixed(1)} Q ${x0.toFixed(1)} ${y1.toFixed(1)} ${x0.toFixed(1)} ${(y1 - r).toFixed(1)} V ${(y0 + r).toFixed(1)} Q ${x0.toFixed(1)} ${y0.toFixed(1)} ${(x0 + r).toFixed(1)} ${y0.toFixed(1)} Z`;
      }
      setAttrs(ent.platePath, {
        d: plateD,
        fill: tp.plateFill,
        stroke: tp.plateStroke,
        "stroke-width": 1,
      });
    }

    // 6d. Step & render Tactile Stage Nodes (minimal ceramic token / instrument dial)
    for (const ent of stageNodes.values()) {
      const revealed = ent.spec.visible !== false && isRevealed(ent.id, ent.spec.group);
      const focused = isFocused(ent.id, ent.spec.group);
      const isMuted = ent.spec.state === "muted";
      const targetOp = revealed ? (focused && !isMuted ? 1 : 0.36) : 0;
      const targetScale = revealed ? 1 : 0.94;

      ent.x = stepSpring(ent.x, ent.spec.x, safeDt, 210);
      ent.y = stepSpring(ent.y, ent.spec.y, safeDt, 210);
      ent.opacity = stepSpring(ent.opacity, targetOp, safeDt, 200);
      ent.scale = stepSpring(ent.scale, targetScale, safeDt, 210);

      const op = Math.max(0, Math.min(1, ent.opacity.value));
      ent.el.style.display = op < 0.01 ? "none" : "";
      if (op < 0.01) continue;

      const shape = ent.spec.shape ?? "tile";
      const w = shape === "circle" ? (ent.spec.r ?? 32) * 2 : (ent.spec.w ?? 96);
      const h = shape === "circle" ? (ent.spec.r ?? 32) * 2 : (ent.spec.h ?? 64);
      const cx = w * 0.5;
      const cy = h * 0.5;

      ent.el.setAttribute(
        "transform",
        `translate(${(ent.x.value + cx).toFixed(2)}, ${(ent.y.value + cy).toFixed(2)}) scale(${ent.scale.value.toFixed(4)}) translate(${(-cx).toFixed(2)}, ${(-cy).toFixed(2)})`,
      );
      ent.el.setAttribute("opacity", op.toFixed(3));

      const isActive = ent.spec.state === "active";
      const acc = resolveAccent(ent.id, ent.spec.group, ent.spec.accent);
      const stroke = isActive && acc ? pal.accents[acc] : tp.tileStroke;
      const strokeW = isActive ? 1.75 : 1;

      if (shape === "circle") {
        ent.tileRect.style.display = "none";
        ent.tileHighlight.style.display = "none";
        setAttrs(ent.circleShape, {
          cx,
          cy,
          r: Math.max(8, (ent.spec.r ?? 32) - 1),
          fill: tp.tileFill,
          stroke,
          "stroke-width": strokeW,
        });
        ent.circleShape.style.display = "";
      } else {
        ent.circleShape.style.display = "none";
        setAttrs(ent.tileRect, {
          x: 1,
          y: 1,
          width: w - 2,
          height: h - 2,
          fill: tp.tileFill,
          stroke,
          "stroke-width": strokeW,
        });
        ent.tileRect.style.display = "";
        setAttrs(ent.tileHighlight, {
          x1: 9,
          y1: 2.3,
          x2: w - 9,
          y2: 2.3,
          stroke: tp.tileTopHighlight,
          "stroke-width": 1,
        });
        ent.tileHighlight.style.display = "";
      }

      const hasSub = Boolean(ent.spec.sublabel);
      ent.valueText.textContent = ent.spec.value;
      setAttrs(ent.valueText, {
        x: cx,
        y: hasSub ? h * 0.41 : cy,
        fill: tp.tileInk,
      });

      if (hasSub) {
        ent.subText.textContent = ent.spec.sublabel!;
        setAttrs(ent.subText, {
          x: cx,
          y: h * 0.72,
          fill: tp.tileSubInk,
        });
        ent.subText.style.display = "";
      } else {
        ent.subText.style.display = "none";
      }
    }

    // 6e. Step & render Smooth Cubic Bézier ArcLinks (Single Active Thread!)
    const activeArcEls: SVGGElement[] = [];
    for (const ent of arcLinks.values()) {
      const revealed = ent.spec.visible !== false && isRevealed(ent.id, ent.spec.group);
      const focused = isFocused(ent.id, ent.spec.group);
      const targetOp = revealed ? (focused ? 1 : 0.25) : 0;

      ent.opacity = stepSpring(ent.opacity, targetOp, safeDt, 210);
      const op = Math.max(0, Math.min(1, ent.opacity.value));

      const pFrom = resolveArcEndpoint(ent.spec.from, "_bottom");
      const pTo = resolveArcEndpoint(ent.spec.to, "_top");
      if (op < 0.01 || !pFrom || !pTo) {
        ent.el.style.display = "none";
        continue;
      }

      const bez = buildArcBezier(pFrom, pTo, ent.spec.curveDip);
      ent.midpoint = bez.midpoint;
      ent.el.style.display = "";
      ent.el.setAttribute("opacity", op.toFixed(3));

      const isActive = Boolean(ent.spec.active);
      const acc = resolveAccent(ent.id, ent.spec.group, ent.spec.accent) ?? "cobalt";
      const accentColor = pal.accents[acc];

      if (isActive) {
        activeArcEls.push(ent.el);
        const speed = ent.spec.pulseSpeed ?? 0.56;
        ent.pulsePhase = (ent.pulsePhase + safeDt * speed) % 1;

        setAttrs(ent.glowPath, {
          d: bez.d,
          stroke: accentColor,
          "stroke-width": 6,
          opacity: theme === "dark" ? 0.22 : 0.14,
        });
        ent.glowPath.style.display = "";

        setAttrs(ent.strokePath, {
          d: bez.d,
          stroke: accentColor,
          "stroke-width": 2.2,
          opacity: 1,
        });

        setAttrs(ent.startRing, {
          cx: pFrom.x,
          cy: pFrom.y,
          r: 3.2,
          fill: pal.bg,
          stroke: accentColor,
          "stroke-width": 1.6,
        });
        setAttrs(ent.endRing, {
          cx: pTo.x,
          cy: pTo.y,
          r: 3.4,
          fill: pal.bg,
          stroke: accentColor,
          "stroke-width": 1.6,
        });
        ent.startRing.style.display = "";
        ent.endRing.style.display = "";

        if (ent.spec.pulse !== false) {
          const pt = sampleCubicBezier(bez.p0, bez.p1, bez.p2, bez.p3, ent.pulsePhase);
          setAttrs(ent.pulseHalo, {
            cx: pt.x,
            cy: pt.y,
            fill: accentColor,
            opacity: theme === "dark" ? 0.42 : 0.28,
          });
          setAttrs(ent.pulseCore, {
            cx: pt.x,
            cy: pt.y,
            fill: accentColor,
            stroke: "#ffffff",
            "stroke-width": 1.35,
          });
          ent.pulseHalo.style.display = "";
          ent.pulseCore.style.display = "";
        } else {
          ent.pulseHalo.style.display = "none";
          ent.pulseCore.style.display = "none";
        }
      } else {
        ent.glowPath.style.display = "none";
        ent.pulseHalo.style.display = "none";
        ent.pulseCore.style.display = "none";

        setAttrs(ent.strokePath, {
          d: bez.d,
          stroke: tp.threadInactive,
          "stroke-width": 1.05,
          opacity: 1,
        });

        setAttrs(ent.startRing, {
          cx: pFrom.x,
          cy: pFrom.y,
          r: 1.8,
          fill: tp.threadInactive,
          stroke: "none",
        });
        setAttrs(ent.endRing, {
          cx: pTo.x,
          cy: pTo.y,
          r: 1.8,
          fill: tp.threadInactive,
          stroke: "none",
        });
        ent.startRing.style.display = "";
        ent.endRing.style.display = "";
      }
    }
    for (const el of activeArcEls) {
      if (arcLinksLayer.lastChild !== el) arcLinksLayer.appendChild(el);
    }

    // 6f. Step & render Tactile Flow Pipes (clean animated packet conduits)
    for (const ent of flowPipes.values()) {
      const revealed = ent.spec.visible !== false && isRevealed(ent.id, ent.spec.group);
      const focused = isFocused(ent.id, ent.spec.group);
      const targetOp = revealed ? (focused ? 1 : 0.25) : 0;

      ent.opacity = stepSpring(ent.opacity, targetOp, safeDt, 200);
      const op = Math.max(0, Math.min(1, ent.opacity.value));
      const pFrom = resolveArcEndpoint(ent.spec.from, "_bottom");
      const pTo = resolveArcEndpoint(ent.spec.to, "_top");
      if (op < 0.01 || !pFrom || !pTo) {
        ent.el.style.display = "none";
        continue;
      }

      const geom = computeFlowPipeGeometry(pFrom, pTo, ent.spec.laneOffset ?? 0);
      ent.midpoint = geom.midpoint;

      const isActive = Boolean(ent.spec.active);
      const acc = resolveAccent(ent.id, ent.spec.group, ent.spec.accent) ?? "teal";
      const color = isActive ? pal.accents[acc] : tp.threadInactive;
      const rate = ent.spec.rate ?? 0.55;
      ent.phase = (ent.phase + safeDt * rate) % 1;

      ent.el.style.display = "";
      ent.el.setAttribute("opacity", op.toFixed(3));
      setAttrs(ent.trackPath, { d: geom.d, stroke: tp.pipeTrack, "stroke-width": 4.5 });
      setAttrs(ent.strokePath, { d: geom.d, stroke: color, "stroke-width": isActive ? 1.8 : 1.1 });

      if (ent.spec.arrowhead !== false) {
        setAttrs(ent.arrowPath, {
          d: geom.arrowPath,
          stroke: color,
          "stroke-width": isActive ? 1.9 : 1.25,
        });
        ent.arrowPath.style.display = "";
      } else {
        ent.arrowPath.style.display = "none";
      }

      for (let i = 0; i < ent.beads.length; i++) {
        const bead = ent.beads[i]!;
        if (isActive && rate > 0) {
          const u = (ent.phase + i / ent.beads.length) % 1;
          const pt = sampleCubicBezier(geom.start, geom.p1, geom.p2, geom.end, u);
          setAttrs(bead, { cx: pt.x, cy: pt.y, fill: pal.accents[acc], opacity: 0.92 });
          bead.style.display = "";
        } else {
          bead.style.display = "none";
        }
      }

      const labelStr = formatFlowPipeLabel(ent.spec.label);
      if (labelStr) {
        ent.labelText.textContent = labelStr;
        setAttrs(ent.labelText, {
          x: geom.labelPos.x,
          y: geom.labelPos.y,
          fill: isActive ? pal.accents[acc] : tp.eyebrowInk,
        });
        ent.labelText.style.display = "";
      } else {
        ent.labelText.style.display = "none";
      }
    }

    // 7. Draw 2D canvas backdrop, dot-grid, and packet trails
    drawCanvasBackdrop(cam, scale);
  }

  function destroy(): void {
    canvas.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("wheel", onWheel);
    svg.remove();
  }

  resize();

  return {
    logicalSize,
    grid,
    svg,
    strip,
    track,
    arcLink,
    stageNode,
    flowPipe,
    upsertZone,
    upsertNode,
    upsertArrayRow,
    upsertConnector,
    upsertPacket,
    removeMissing,
    setFocus,
    setReveal,
    setCamera,
    goToCamera: setCamera,
    resetCamera,
    setTheme,
    resize,
    projectAnchor,
    getRegisteredIds,
    getCameraPresets,
    render,
    destroy,
  };
}
