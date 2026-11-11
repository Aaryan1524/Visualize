import { DROP } from "../core/interpolate.ts";
import type { LabelMark, LinkMark, Mark, Projection, Resolved, SolidMark, Vec3 } from "../core/types.ts";
import { project, type Pt } from "../iso/project.ts";
import { boundsOf, geometryOf, screenExtent } from "../iso/solids.ts";
import { depthSort } from "../iso/sort.ts";

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
  top?: SVGEllipseElement;
  edge?: SVGPolygonElement;
  crease?: SVGPolylineElement;
  text?: SVGTextElement;
  line?: SVGLineElement;
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

/** Relative luminance of the dark label ink, #15171b. */
const INK_LUM = 0.0069;

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
  if (m.title) {
    let t = r.querySelector(":scope > title");
    if (!t) r.prepend((t = el("title")));
    if (t.textContent !== m.title) t.textContent = m.title;
  }
}

function makeSolid(m: SolidMark): Node {
  const root = el("g", { class: "vz-solid", "data-key": m.key, "data-kind": m.kind });
  const node: Node = { root, kind: m.kind };
  if (m.kind === "box") {
    node.faces = ["left", "right", "top", "front"].map((s) => el("polygon", { class: "vz-face", "data-shade": s }));
    root.append(...node.faces);
    node.crease = el("polyline", { class: "vz-crease" });
    root.append(node.crease);
  } else {
    node.faces = [el("polygon", { class: "vz-face", "data-shade": "right" }), el("polygon", { class: "vz-face", "data-shade": "front" })];
    node.top = el("ellipse", { class: "vz-face", "data-shade": "top" });
    root.append(...node.faces, node.top);
  }
  node.edge = el("polygon", { class: "vz-edge" });
  root.append(node.edge);
  node.text = el("text", { class: "vz-solid-label", "text-anchor": "middle" });
  root.append(node.text);
  return node;
}

function updateSolid(node: Node, m: Resolved<SolidMark>, projection: Projection): void {
  common(node, m);
  const g = geometryOf(m, projection);
  const byShade = new Map(g.faces.map((face) => [face.shade, face.points]));
  for (const face of node.faces!) {
    const p = byShade.get(face.getAttribute("data-shade") as never);
    if (p) {
      setAttr(face, "points", pts(p));
      setAttr(face, "display", null);
    } else setAttr(face, "display", "none");
  }
  if (node.top && g.ellipse) {
    const e = g.ellipse;
    setAttr(node.top, "cx", f(e.cx));
    setAttr(node.top, "cy", f(e.cy));
    setAttr(node.top, "rx", f(e.rx));
    setAttr(node.top, "ry", f(Math.max(e.ry, 0.01)));
    setAttr(node.top, "display", projection === "front" ? "none" : null);
  }
  if (node.crease && m.kind === "box" && projection === "iso") {
    // The two top edges nearest the viewer, where the top meets the sides.
    const top = byShade.get("top")!;
    setAttr(node.crease, "points", pts([top[3]!, top[2]!, top[1]!]));
    setAttr(node.crease, "display", null);
  } else if (node.crease) setAttr(node.crease, "display", "none");
  setAttr(node.edge!, "points", pts(g.outline));
  const label = m.label ?? "";
  if (node.text!.textContent !== label) node.text!.textContent = label;
  setAttr(node.text!, "x", f(g.labelAt[0]));
  setAttr(node.text!, "y", f(g.labelAt[1]));
  setAttr(node.text!, "data-face", g.labelShade);
}

function makeLabel(m: LabelMark): Node {
  const root = el("g", { class: "vz-label-g", "data-key": m.key, "data-kind": "label" });
  const text = el("text", { class: "vz-label" });
  root.append(text);
  return { root, kind: "label", text };
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
}

function makeLink(m: LinkMark): Node {
  const root = el("g", { class: "vz-link-g", "data-key": m.key, "data-kind": "link" });
  const line = el("line", { class: "vz-link" });
  root.append(line);
  return { root, kind: "link", line };
}

function updateLink(node: Node, m: Resolved<LinkMark>, projection: Projection): void {
  common(node, m);
  const a = project(m.from, projection);
  const b = project(m.to, projection);
  const l = node.line!;
  setAttr(l, "x1", f(a[0]));
  setAttr(l, "y1", f(a[1]));
  setAttr(l, "x2", f(b[0]));
  setAttr(l, "y2", f(b[1]));
  setAttr(l, "stroke-width", f(m.width ?? 1.25));
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
    if (!t || !t.textContent || !n.root.isConnected) return;
    const id = `${n.root.getAttribute("data-tone") ?? ""}|${t.getAttribute("data-face") ?? ""}`;
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
        if (n.root.parentNode !== layers.labels) layers.labels.append(n.root);
      } else {
        updateLink(n, m, projection);
        const layer = m.layer === "overlay" ? layers.overlay : layers.floor;
        if (n.root.parentNode !== layer) layer.append(n.root);
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
