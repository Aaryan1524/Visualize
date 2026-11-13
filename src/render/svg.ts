import { DROP } from "../core/interpolate.ts";
import type { LabelMark, LinkMark, Mark, Projection, Resolved, SolidMark, Vec3 } from "../core/types.ts";
import { project, type Pt } from "../iso/project.ts";
import { boundsOf, geometryOf, screenExtent } from "../iso/solids.ts";
import { depthSort } from "../iso/sort.ts";
import { textRole } from "./typography.ts";
import { surfaceGeometry } from "../iso/surface.ts";

const NS = "http://www.w3.org/2000/svg";

const f = (n: number) => (Math.round(n * 100) / 100).toString();
const pts = (p: readonly Pt[]) => p.map(([x, y]) => `${f(x)},${f(y)}`).join(" ");

function el<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function setAttr(e: Element, name: string, value: string | null): void {
  if (value === null) {
    if (e.hasAttribute(name)) e.removeAttribute(name);
  } else if (e.getAttribute(name) !== value) e.setAttribute(name, value);
}

function isSolid(m: Mark): m is SolidMark {
  return m.kind === "box" || m.kind === "cylinder";
}

/** Fit one camera over every state, so the view never jumps between steps. */
export function fitViewBox(allMarks: readonly (readonly Mark[])[], projection: Projection, pad = 18): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const add = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  const addPoint = (p: Vec3) => {
    const [x, y] = project(p, projection);
    add(x, y);
  };
  for (const marks of allMarks) {
    for (const m of marks) {
      if (isSolid(m)) {
        const b = boundsOf(m);
        const [x0, y0, x1, y1] = screenExtent(b, projection);
        add(x0, y0);
        add(x1, y1);
        // Room for solids dropping in from above or lifting away. They are
        // mostly transparent over the top half of the move, so half is enough.
        if (m.enter === "drop" || m.exit === "lift") {
          const up = DROP / 2;
          const raised = screenExtent({ min: [b.min[0], b.min[1], b.min[2] + up], max: [b.max[0], b.max[1], b.max[2] + up] }, projection);
          add(raised[0], raised[1]);
        }
        if (m.transient && m.travel) {
          for (const p of [m.travel.from, m.travel.to]) {
            const moved = screenExtent(boundsOf({ ...m, at: p } as SolidMark), projection);
            add(moved[0], moved[1]);
            add(moved[2], moved[3]);
          }
        }
      } else if (m.kind === "label") {
        const [x, y] = project(m.at, projection);
        // Approximate text box in screen units; refined by the overlap check, not here.
        const w = m.text.length * 3.6;
        const a = m.anchor ?? "middle";
        add(a === "start" ? x : a === "end" ? x - w : x - w / 2, y - 5);
        add(a === "start" ? x + w : a === "end" ? x : x + w / 2, y + 5);
      } else {
        addPoint(m.from);
        addPoint(m.to);
      }
    }
  }
  if (!Number.isFinite(minX)) return [0, 0, 100, 100];
  return [minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2];
}

interface Node {
  root: SVGGElement;
  kind: Mark["kind"];
  faces?: SVGPolygonElement[];
  edge?: SVGPolygonElement;
  crease?: SVGPolylineElement;
  text?: SVGTextElement;
  line?: SVGLineElement;
  route?: SVGPolylineElement;
  casing?: SVGPolylineElement;
  inset?: SVGPolygonElement;
  terminal?: SVGCircleElement;
  surface?: SVGGElement;
}

/** Relative luminance of a CSS colour, resolved through a 1×1 canvas. */
let probe: CanvasRenderingContext2D | null = null;
function luminanceOf(css: string): number {
  probe ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!probe) return 0.5;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#000";
  probe.fillStyle = css;
  probe.fillRect(0, 0, 1, 1);
  const d = probe.getImageData(0, 0, 1, 1).data;
  const lin = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(d[0]!) + 0.7152 * lin(d[1]!) + 0.0722 * lin(d[2]!);
}

/** Relative luminance of #10141a; constant so Node imports need no DOM. */
const INK_LUM = 0.00685052103958841;

/** "light" when white text contrasts more with this fill than dark ink does. */
function inkFor(fill: string): "light" | "dark" {
  const l = luminanceOf(fill);
  const onWhite = 1.05 / (l + 0.05);
  const onInk = (l + 0.05) / (INK_LUM + 0.05);
  return onWhite > onInk ? "light" : "dark";
}

export interface StageRenderer {
  svg: SVGSVGElement;
  render(marks: readonly Resolved[]): void;
  setViewBox(vb: readonly [number, number, number, number]): void;
  /** Union of these labels' boxes in viewBox units, at the current label size. */
  measureLabels(labels: readonly LabelMark[]): [number, number, number, number] | null;
  /** Re-pick label colours after a theme change. */
  refreshInk(): void;
  /** Current painter's order of solids, for checks. */
  solidOrder(): string[];
  conflicts(): [string, string][];
}

function common(node: Node, m: Resolved): void {
  const r = node.root;
  setAttr(r, "data-tone", m.tone ?? null);
  setAttr(r, "data-lit", m.lit ? "" : null);
  setAttr(r, "data-link", m.link ?? null);
  setAttr(r, "opacity", m.opacity < 1 ? f(m.opacity) : null);
  // Receding marks mix their tone toward the stage; they stay opaque, so painter's order holds.
  const emph = m.emphasis ?? 1;
  setAttr(r, "data-emphasis", emph < 1 ? f(emph) : null);
  if (emph < 1) r.style.setProperty("--emph", f(emph));
  else {
    r.style.removeProperty("--emph");
    // An emptied style attribute would make a revisited step differ from a fresh one.
    if (!r.getAttribute("style")) r.removeAttribute("style");
  }
  if (m.title) {
    let t = r.querySelector(":scope > title");
    if (!t) r.prepend((t = el("title")));
    if (t.textContent !== m.title) t.textContent = m.title;
  } else r.querySelector(":scope > title")?.remove();
}

function makeSolid(m: SolidMark): Node {
  const root = el("g", { class: "vz-solid", "data-key": m.key, "data-kind": m.kind });
  const node: Node = { root, kind: m.kind };
  // Faces are created to match the geometry on each update (rounded boxes and
  // turned cylinders have many facets).
  node.faces = [];
  node.crease = el("polyline", { class: "vz-crease" });
  root.append(node.crease);
  node.inset = el("polygon", { class: "vz-inset" });
  root.append(node.inset);
  node.edge = el("polygon", { class: "vz-edge" });
  node.surface = el("g", { class: "vz-surface", "aria-hidden": "true" });
  root.append(node.surface);
  root.append(node.edge);
  node.text = el("text", { class: "vz-solid-label", "text-anchor": "middle" });
  root.append(node.text);
  return node;
}

function updateSolid(node: Node, m: Resolved<SolidMark>, projection: Projection): void {
  common(node, m);
  const g = geometryOf(m, projection);
  const byShade = new Map(g.faces.map((face) => [face.shade, face.points]));
  while (node.faces!.length > g.faces.length) node.faces!.pop()!.remove();
  while (node.faces!.length < g.faces.length) {
    const face = el("polygon", { class: "vz-face" });
    node.root.insertBefore(face, node.crease!);
    node.faces!.push(face);
  }
  for (const [i, face] of node.faces!.entries()) {
    const surface = g.faces[i]!;
    setAttr(face, "data-shade", surface.shade);
    setAttr(face, "points", pts(surface.points));
    // Facets of curved bodies carry their own light; the hairline stroke in the same
    // colour closes the seams between neighbouring facets.
    setAttr(face, "style", surface.light === undefined ? null : `fill:color-mix(in oklab,var(--tone) ${f(surface.light * 100)}%,var(--shade-side));stroke:color-mix(in oklab,var(--tone) ${f(surface.light * 100)}%,var(--shade-side));stroke-width:0.15`);
  }
  if (node.crease && projection === "iso" && (m.kind === "box" || g.rim)) {
    // The two top edges nearest the viewer, where the top meets the sides.
    const top = byShade.get("top")!;
    setAttr(node.crease, "points", pts(g.rim ?? [top[3]!, top[2]!, top[1]!]));
    setAttr(node.crease, "display", null);
  } else if (node.crease) setAttr(node.crease, "display", "none");
  setAttr(node.edge!, "points", pts(g.outline));
  if (node.inset) {
    setAttr(node.inset,"points",g.inset ? pts(g.inset) : "");
    setAttr(node.inset,"display",g.inset ? null : "none");
  }
  setAttr(node.root,"data-rounded",m.kind === "box" && m.radius ? "" : null);
  setAttr(node.root,"data-role",m.kind === "box" ? m.role ?? null : null);
  const details = m.kind === "box" ? surfaceGeometry(m, projection) : [];
  setAttr(node.root, "data-turned", m.kind === "cylinder" ? "" : null);
  while (node.surface!.children.length > details.length) node.surface!.lastElementChild!.remove();
  details.forEach((detail, i) => {
    let path = node.surface!.children[i];
    if (!path) { path = el("path"); node.surface!.append(path); }
    setAttr(path,"data-detail",detail.kind);
    setAttr(path,"data-tone",detail.tone ?? null);
    setAttr(path,"d",detail.points.map(([x,y],j)=>`${j ? "L" : "M"}${f(x)} ${f(y)}`).join("") + (detail.closed ? "Z" : ""));
  });
  const label = m.label ?? "";
  setAttr(node.text!, "data-text-role", textRole(label, m.textRole, m.kind === "box" && m.surface?.panel ? "status" : "symbol"));
  if (node.text!.textContent !== label) node.text!.textContent = label;
  const onPanel = m.kind === "box" && m.surface?.panel?.face === g.labelShade && Boolean(label) && projection === "iso";
  // Screen text belongs to its side plane. Local x runs along the face and
  // local y points down the face; external annotations remain upright.
  const faceX = Math.cos(Math.PI / 6);
  setAttr(node.text!, "x", onPanel ? "0" : f(g.labelAt[0]));
  setAttr(node.text!, "y", onPanel ? "0" : f(g.labelAt[1]));
  setAttr(node.text!, "transform", onPanel ? `matrix(${faceX} ${g.labelShade === "left" ? .5 : -.5} 0 1 ${f(g.labelAt[0])} ${f(g.labelAt[1])})` : null);
  setAttr(node.text!, "data-face", g.labelShade);
  setAttr(node.text!, "data-on-panel", onPanel ? "" : null);
  setAttr(node.text!, "data-room", f(onPanel ? g.labelWidth / faceX : g.labelWidth));
  setAttr(node.text!, "data-optional", m.kind === "box" && m.labelOptional ? "" : null);
  setAttr(node.text!, "data-room-height", onPanel && m.kind === "box" && m.surface?.panel ? f(m.size[2] * (m.surface.panel.to - m.surface.panel.from) * .8) : projection === "iso" ? faceHeight(m, g.labelShade) : null);
}

/**
 * The screen height (in user units) of the face a plain face label sits on, so
 * a label taller than its face is hidden like one that is too wide. It matches
 * the labels check, which measures the face's bounding box with 5% tolerance.
 */
function faceHeight(m: SolidMark, shade: string | undefined): string | null {
  if (m.kind !== "box" || !m.label) return null;
  const [w, d, h] = m.size;
  const room = shade === "top" ? (w + d) / 2 : shade === "left" ? h + w / 2 : shade === "right" ? h + d / 2 : 0;
  return room > 0 ? f(room * 1.05) : null;
}

function makeLabel(m: LabelMark): Node {
  const root = el("g", { class: "vz-label-g", "data-key": m.key, "data-kind": "label" });
  const text = el("text", { class: "vz-label" });
  const line = el("line", {class:"vz-leader"});
  const terminal = el("circle",{class:"vz-terminal",r:"0.9"});
  root.append(line,terminal,text);
  return { root, kind: "label", text, line, terminal };
}

function updateLabel(node: Node, m: Resolved<LabelMark>, projection: Projection): void {
  common(node, m);
  const [x, y] = project(m.at, projection);
  const t = node.text!;
  if (t.textContent !== m.text) t.textContent = m.text;
  setAttr(t, "x", f(x));
  setAttr(t, "y", f(y));
  setAttr(t, "text-anchor", m.anchor ?? "middle");
  setAttr(t, "data-size", m.size ?? null);
  setAttr(t, "data-text-role", textRole(m.text, m.textRole, "name"));
  setAttr(node.root,"data-target",m.target?.key ?? null);
  node.line!.style.display = node.terminal!.style.display = m.target ? "" : "none";
  if (m.target) {
    // The end sits on the model anchor; the start is placed after labels are
    // separated (attachLeaders), so it leaves from the text's nearest edge.
    const [tx,ty] = project(m.target.at,projection);
    setAttr(node.line!,"x2",f(tx));
    setAttr(node.line!,"y2",f(ty));
    setAttr(node.terminal!,"cx",f(tx));
    setAttr(node.terminal!,"cy",f(ty));
  }
}

function makeLink(m: LinkMark): Node {
  const root = el("g", { class: "vz-link-g", "data-key": m.key, "data-kind": "link" });
  // A cable is a casing under a core, so it reads as a round conductor lying on the plate.
  const casing = el("polyline", { class: "vz-cable-casing" });
  const line = el("polyline", { class: "vz-link" });
  root.append(casing, line);
  return { root, kind: "link", route: line, casing };
}

function updateLink(node: Node, m: Resolved<LinkMark>, projection: Projection): void {
  common(node, m);
  const route = [m.from, ...(m.via ?? []), m.to].map((p) => project(p, projection));
  const l = node.route!;
  const d = pts(route);
  setAttr(l, "points", d);
  setAttr(l, "stroke-width", f(m.width ?? 1.25));
  setAttr(node.root, "data-cable", m.cable ? "" : null);
  setAttr(node.casing!, "points", m.cable ? d : "");
  setAttr(node.casing!, "stroke-width", m.cable ? f((m.width ?? 1.25) + 1.4) : "0");
  setAttr(node.casing!, "display", m.cable ? null : "none");
  setAttr(l, "data-tone", m.tone ?? null);
  setAttr(l, "data-dashed", m.dashed ? "" : null);
}

/**
 * Keyed SVG reconciler. Elements are created once per key and updated in
 * place; solids are re-appended only when the painter's order changes.
 */
export function createStage(viewBox: [number, number, number, number], projection: Projection, label: string): StageRenderer {
  const svg = el("svg", {
    class: "vz-svg",
    viewBox: viewBox.map(f).join(" "),
    role: "img",
    "aria-label": label,
    "data-projection": projection,
  });
  // ground: solids lying at or below z = 0 (base plates). floor: links drawn on
  // the ground, so they sit on the plates but under everything standing on them.
  const layers = {
    ground: el("g", { class: "vz-layer", "data-layer": "ground" }),
    floor: el("g", { class: "vz-layer", "data-layer": "floor" }),
    solids: el("g", { class: "vz-layer", "data-layer": "solids" }),
    overlay: el("g", { class: "vz-layer", "data-layer": "overlay" }),
    labels: el("g", { class: "vz-layer", "data-layer": "labels" }),
  };
  svg.append(layers.ground, layers.floor, layers.solids, layers.overlay, layers.labels);

  const nodes = new Map<string, Node>();
  const inkCache = new Map<string, "light" | "dark">();
  let order: string[] = [];

  function pickInk(n: Node): void {
    const t = n.text;
    // A detached element has no computed fill yet; measuring it would cache a wrong answer.
    if (!t || !t.textContent || !n.root.isConnected || t.hasAttribute("data-on-panel")) return;
    const id = `${n.root.getAttribute("data-tone") ?? ""}|${t.getAttribute("data-face") ?? ""}|${n.root.getAttribute("data-emphasis") ?? "1"}`;
    let ink = inkCache.get(id);
    if (!ink) {
      const face = n.root.querySelector<SVGElement>(`.vz-face[data-shade="${t.getAttribute("data-face")}"]`);
      if (!face) return;
      ink = inkFor(getComputedStyle(face).fill);
      inkCache.set(id, ink);
    }
    setAttr(t, "data-ink", ink);
  }
  let lastConflicts: [string, string][] = [];

  function nodeFor(m: Mark): Node {
    let n = nodes.get(m.key);
    if (n && n.kind !== m.kind) {
      n.root.remove();
      nodes.delete(m.key);
      n = undefined;
    }
    if (!n) {
      n = isSolid(m) ? makeSolid(m) : m.kind === "label" ? makeLabel(m) : makeLink(m);
      nodes.set(m.key, n);
    }
    return n;
  }

  function render(marks: readonly Resolved[]): void {
    const live = new Set<string>();
    const solids: Resolved<SolidMark>[] = [];
    for (const m of marks) {
      live.add(m.key);
      const n = nodeFor(m);
      if (isSolid(m)) {
        updateSolid(n, m, projection);
        solids.push(m);
      } else if (m.kind === "label") {
        updateLabel(n, m, projection);
        layers.labels.append(n.root); // declared order, including re-entering labels
      } else {
        updateLink(n, m, projection);
        const layer = m.layer === "overlay" ? layers.overlay : layers.floor;
        layer.append(n.root);
      }
    }
    for (const [key, n] of nodes) {
      if (!live.has(key)) {
        n.root.remove();
        nodes.delete(key);
      }
    }
    const sorted = depthSort(solids, projection);
    lastConflicts = sorted.conflicts;
    const next = sorted.order.map((m) => m.key);
    if (next.length !== order.length || next.some((k, i) => k !== order[i])) {
      const ground = document.createDocumentFragment();
      const standing = document.createDocumentFragment();
      for (const m of sorted.order) (boundsOf(m).max[2] <= 1e-6 ? ground : standing).append(nodes.get(m.key)!.root);
      layers.ground.append(ground);
      layers.solids.append(standing);
      order = next;
    }
    for (const m of solids) pickInk(nodes.get(m.key)!);
    for (const m of solids) fitLabel(nodes.get(m.key)!);
    dropOptionalLabels(marks, solids);
    separateLabels(marks);
    attachLeaders(marks);
  }

  /** Drop optional labels whose text box would lie on a standing part or a required label. */
  function dropOptionalLabels(marks: readonly Resolved[], solids: readonly Resolved<SolidMark>[]): void {
    const labels = marks.filter((m): m is Resolved<LabelMark> => m.kind === "label");
    if (!labels.some((m) => m.optional)) return;
    const standing = solids
      .filter((m) => boundsOf(m).max[2] > 1e-6)
      .map((m) => nodes.get(m.key)!.edge!.getAttribute("points")!.trim().split(/\s+/).map((p) => p.split(",").map(Number) as [number, number]));
    const inside = (poly: [number, number][], x: number, y: number) => {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i]!, [xj, yj] = poly[j]!;
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    const required = labels.filter((m) => !m.optional).map((m) => nodes.get(m.key)!.text!.getBBox());
    for (const m of labels) {
      if (!m.optional) continue;
      const t = nodes.get(m.key)!.text!;
      setAttr(t, "display", null);
      const b = t.getBBox();
      if (!b.width) continue;
      let blocked = required.some((r) => b.x < r.x + r.width && r.x < b.x + b.width && b.y < r.y + r.height && r.y < b.y + b.height);
      for (let i = 0; i < 5 && !blocked; i++)
        for (let j = 0; j < 3 && !blocked; j++) {
          const x = b.x + ((i + 0.5) / 5) * b.width, y = b.y + ((j + 0.5) / 3) * b.height;
          if (standing.some((poly) => inside(poly, x, y))) blocked = true;
        }
      if (blocked) setAttr(t, "display", "none");
    }
  }

  /**
   * A label that does not fit the room on its face at the current size is not
   * drawn, rather than spilling off the part. The transcript keeps the words.
   */
  function fitLabel(n: Node): void {
    const t = n.text;
    if (!t || !t.textContent || !t.isConnected) return;
    setAttr(t, "display", null);
    const room = Number(t.getAttribute("data-room"));
    const height = Number(t.getAttribute("data-room-height"));
    if ((room > 0 && t.getComputedTextLength() > room) || (height > 0 && t.getBBox().height > height)) setAttr(t, "display", "none");
  }

  /** Start each leader at the point of its text box nearest the target, outside the text. */
  function attachLeaders(marks: readonly Resolved[]): void {
    for (const m of marks) {
      if (m.kind !== "label" || !m.target) continue;
      const n = nodes.get(m.key)!;
      const b = n.text!.getBBox();
      if (!b.width) continue;
      const dy = Number(/translate\(0 (-?[\d.]+)\)/.exec(n.text!.getAttribute("transform") ?? "")?.[1] ?? 0);
      const tx = Number(n.line!.getAttribute("x2")), ty = Number(n.line!.getAttribute("y2"));
      const gap = 1.5;
      const [x0, x1, y0, y1] = [b.x - gap, b.x + b.width + gap, b.y + dy - gap, b.y + dy + b.height + gap];
      const x = Math.min(Math.max(tx, x0), x1), y = Math.min(Math.max(ty, y0), y1);
      setAttr(n.line!, "x1", f(x));
      setAttr(n.line!, "y1", f(y));
    }
  }

  /**
   * Nudge colliding labels apart, vertically. Larger labels, then earlier
   * ones, keep their place; each later label moves away from what it hits.
   * Depends only on the frame and the drawn size, so replay stays exact.
   */
  function separateLabels(marks: readonly Resolved[]): void {
    const rank = { large: 0, normal: 1, small: 2 } as const;
    const labels = marks
      .filter((m): m is Resolved<LabelMark> => m.kind === "label")
      .map((m, i) => ({ m, i, text: nodes.get(m.key)!.text! }))
      .sort((a, b) => rank[a.m.size ?? "normal"] - rank[b.m.size ?? "normal"] || a.i - b.i);
    const placed: DOMRect[] = [];
    const gap = 1.5;
    for (const { text, m } of labels) {
      setAttr(text, "transform", null);
      // Hidden labels (unfit or dropped optional ones) take no part in separation.
      if (!text.textContent || text.getAttribute("display") === "none") continue;
      const b = text.getBBox();
      if (!b.width) continue;
      let dy = 0;
      // The direction is set by the first collision and kept, so moves are monotone.
      let down: boolean | null = null;
      for (let pass = 0; pass < 8; pass++) {
        const hit = placed.find((p) => b.x < p.x + p.width && p.x < b.x + b.width && b.y + dy < p.y + p.height && p.y < b.y + dy + b.height);
        if (!hit) break;
        down ??= b.y + b.height / 2 >= hit.y + hit.height / 2;
        dy = down ? hit.y + hit.height + gap - b.y : hit.y - gap - b.height - b.y;
      }
      if (dy) setAttr(text, "transform", `translate(0 ${f(dy)})`);
      if (m.target) setAttr(nodes.get(m.key)!.line!,"y1",f(Number(text.getAttribute("y"))+dy+4));
      placed.push(new DOMRect(b.x, b.y + dy, b.width, b.height));
    }
  }

  const ruler = el("g", { class: "vz-layer", "data-layer": "ruler", visibility: "hidden", "aria-hidden": "true" });
  svg.append(ruler);

  function measureLabels(labels: readonly LabelMark[]): [number, number, number, number] | null {
    if (!labels.length) return null;
    ruler.replaceChildren();
    const texts = labels.map((m) => {
      const n = makeLabel(m);
      updateLabel(n, { ...m, opacity: 1 }, projection);
      n.root.removeAttribute("data-key");
      ruler.append(n.root);
      return n.text!;
    });
    let box: [number, number, number, number] | null = null;
    for (const t of texts) {
      const b = t.getBBox();
      if (!b.width) continue;
      box = box
        ? [Math.min(box[0], b.x), Math.min(box[1], b.y), Math.max(box[2], b.x + b.width), Math.max(box[3], b.y + b.height)]
        : [b.x, b.y, b.x + b.width, b.y + b.height];
    }
    ruler.replaceChildren();
    return box;
  }

  function setViewBox(vb: readonly [number, number, number, number]): void {
    setAttr(svg, "viewBox", vb.map(f).join(" "));
  }

  function refreshInk(): void {
    inkCache.clear();
    for (const n of nodes.values()) if (n.text && n.kind !== "label" && n.kind !== "link") pickInk(n);
  }

  return { svg, render, setViewBox, measureLabels, refreshInk, solidOrder: () => [...order], conflicts: () => lastConflicts };
}

export { DROP };
