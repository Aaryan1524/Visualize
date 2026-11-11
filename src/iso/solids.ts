import type { BoxMark, CylinderMark, Projection, SolidMark, Vec3 } from "../core/types.ts";
import { ellipseAxes, project, type Pt } from "./project.ts";

export interface Bounds {
  min: Vec3;
  max: Vec3;
}

export type Shade = "top" | "left" | "right" | "front";

export interface Face {
  shade: Shade;
  points: Pt[];
  light?: number;
}

export interface SolidGeometry {
  rim?: Pt[];
  inset?: Pt[];
  /** Visible faces, safe to paint in this order. */
  faces: Face[];
  /** Silhouette, for the outline stroke and hit testing. */
  outline: Pt[];
  /** Where an upright label sits: the centre of its face. */
  labelAt: Pt;
  /** Width available on that face on screen, for fitting label text. */
  labelWidth: number;
  /** The face the label sits on, as drawn. */
  labelShade: Shade;
  /** Elliptical top for cylinders, drawn as an ellipse instead of a polygon. */
  ellipse?: { cx: number; cy: number; rx: number; ry: number };
}

export function boundsOf(m: SolidMark): Bounds {
  if (m.kind === "box") {
    return { min: m.at, max: [m.at[0] + m.size[0], m.at[1] + m.size[1], m.at[2] + m.size[2]] };
  }
  const [cx, cy, z] = m.at;
  return { min: [cx - m.radius, cy - m.radius, z], max: [cx + m.radius, cy + m.radius, z + m.height] };
}

function boxGeometry(m: BoxMark, projection: Projection): SolidGeometry {
  const [x0, y0, z0] = m.at;
  const [x1, y1, z1] = [x0 + m.size[0], y0 + m.size[1], z0 + m.size[2]];
  const P = (x: number, y: number, z: number) => project([x, y, z], projection);

  if (projection === "front") {
    const face = [P(x0, y0, z1), P(x1, y0, z1), P(x1, y0, z0), P(x0, y0, z0)];
    const [a, b] = [face[0]!, face[1]!];
    return {
      faces: [{ shade: "front", points: face }],
      outline: face,
      labelAt: [(a[0] + b[0]) / 2, (a[1] + face[3]![1]) / 2],
      labelWidth: b[0] - a[0],
      labelShade: "front",
    };
  }

  // Visible from (+x, +y, +z): the top, the +y face (left on screen) and the +x face (right).
  const top = [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)];
  const left = [P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0)];
  const right = [P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0), P(x1, y0, z0)];
  const outline = [P(x0, y0, z1), P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0), P(x0, y1, z1)];
  const zm = (z0 + z1) / 2;
  const face = m.labelFace ?? "top";
  const C30 = Math.cos(Math.PI / 6);
  const label: { at: Pt; width: number } =
    face === "left"
      ? { at: P((x0 + x1) / 2, y1, zm), width: m.size[0] * C30 * 0.8 }
      : face === "right"
        ? { at: P(x1, (y0 + y1) / 2, zm), width: m.size[1] * C30 * 0.8 }
        : // The top face spans (w + d)·cos30° at its widest row; leave margin for the slanted edges.
          { at: P((x0 + x1) / 2, (y0 + y1) / 2, z1), width: (m.size[0] + m.size[1]) * C30 * 0.55 };
  const basic: SolidGeometry = {
    faces: [
      { shade: "left", points: left },
      { shade: "right", points: right },
      { shade: "top", points: top },
    ],
    outline,
    labelAt: label.at,
    labelWidth: label.width,
    labelShade: face,
  };
  const r = Math.min(Math.max(m.radius ?? 0, 0), m.size[0] / 2, m.size[1] / 2);
  if (!r) return basic;
  // Rounded rectangular extrusion. Side facets follow the surface normal;
  // the silhouette is the convex hull of the projected top and bottom.
  const plan: Pt[] = [];
  for (const [cx, cy, start] of [[x1-r, y0+r, -90], [x1-r, y1-r, 0], [x0+r, y1-r, 90], [x0+r, y0+r, 180]]) {
    for (let i = 0; i <= 12; i++) {
      const a = (start! + i * 90 / 12) * Math.PI / 180;
      plan.push([cx! + r * Math.cos(a), cy! + r * Math.sin(a)]);
    }
  }
  const roundedTop = plan.map(([x,y]) => P(x,y,z1));
  const bottom = plan.map(([x,y]) => P(x,y,z0));
  const sides: Face[] = [];
  const rim: Pt[] = [];
  for (let i = 0; i < plan.length; i++) {
    const j = (i+1) % plan.length;
    const dx = plan[j]![0] - plan[i]![0], dy = plan[j]![1] - plan[i]![1];
    if (dy - dx <= 1e-8) continue;
    const n = Math.hypot(dx, dy);
    sides.push({ shade: dy > -dx ? "right" : "left", light: 0.72 + 0.22 * dy / n - 0.10 * (-dx / n), points: [roundedTop[i]!, roundedTop[j]!, bottom[j]!, bottom[i]!] });
    if (!rim.length) rim.push(roundedTop[i]!);
    rim.push(roundedTop[j]!);
  }
  const points = [...roundedTop, ...bottom].sort((a,b) => a[0]-b[0] || a[1]-b[1]);
  const cross = (a: Pt,b: Pt,c: Pt) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const half = (points: Pt[]) => {
    const h: Pt[] = [];
    for (const p of points) {
      while (h.length > 1 && cross(h[h.length-2]!,h[h.length-1]!,p) <= 1e-9) h.pop();
      h.push(p);
    }
    return h.slice(0,-1);
  };
  const inset = plan.map(([x,y]) => P(x0 + 1.4 + (x-x0) * (m.size[0]-2.8)/m.size[0], y0 + 1.4 + (y-y0)*(m.size[1]-2.8)/m.size[1],z1));
  return { ...basic, faces: [...sides, {shade:"top", points: roundedTop}], outline: [...half(points),...half([...points].reverse())], rim, ...(m.inset ? {inset} : {}) };
}

function cylinderGeometry(m: CylinderMark, projection: Projection): SolidGeometry {
  const [cx, cy, z0] = m.at;
  const z1 = z0 + m.height;
  const [rx, ry] = ellipseAxes(m.radius, projection);
  const b = project([cx, cy, z0], projection);
  const t = project([cx, cy, z1], projection);

  if (projection === "front") {
    const face: Pt[] = [
      [t[0] - rx, t[1]],
      [t[0] + rx, t[1]],
      [b[0] + rx, b[1]],
      [b[0] - rx, b[1]],
    ];
    return { faces: [{ shade: "front", points: face }], outline: face, labelAt: [t[0], (t[1] + b[1]) / 2], labelWidth: 2 * rx, labelShade: "front" };
  }

  // Side: the near half of the bottom ellipse joined to the top ellipse's extremes.
  const steps = 24;
  const side: Pt[] = [[t[0] - rx, t[1]]];
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI - (Math.PI * i) / steps;
    side.push([b[0] + rx * Math.cos(a), b[1] + ry * Math.sin(a)]);
  }
  side.push([t[0] + rx, t[1]]);
  const topArc: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = -(Math.PI * i) / steps;
    topArc.push([t[0] + rx * Math.cos(a), t[1] + ry * Math.sin(a)]);
  }
  const outline: Pt[] = [...side, ...topArc.slice(1, -1)];
  const top: Pt[] = [];
  for (let i = 0; i < steps * 2; i++) {
    const a = (Math.PI * i) / steps;
    top.push([t[0] + rx * Math.cos(a), t[1] + ry * Math.sin(a)]);
  }
  return {
    faces: [
      { shade: "right", points: side },
      { shade: "top", points: top },
    ],
    outline,
    ...(m.labelFace && m.labelFace !== "top"
      ? { labelAt: [b[0], (b[1] + t[1]) / 2 + ry / 2] as Pt, labelWidth: rx * 1.6, labelShade: "right" as Shade }
      : { labelAt: t, labelWidth: rx * 1.6, labelShade: "top" as Shade }),
    ellipse: { cx: t[0], cy: t[1], rx, ry },
  };
}

export function geometryOf(m: SolidMark, projection: Projection = "iso"): SolidGeometry {
  return m.kind === "box" ? boxGeometry(m, projection) : cylinderGeometry(m, projection);
}

/** Screen-space bounding rectangle of a world box, for fitting the camera. */
export function screenExtent(b: Bounds, projection: Projection = "iso"): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const x of [b.min[0], b.max[0]])
    for (const y of [b.min[1], b.max[1]])
      for (const z of [b.min[2], b.max[2]]) {
        const [sx, sy] = project([x, y, z], projection);
        minX = Math.min(minX, sx);
        maxX = Math.max(maxX, sx);
        minY = Math.min(minY, sy);
        maxY = Math.max(maxY, sy);
      }
  return [minX, minY, maxX, maxY];
}
