// The Unfold stage: the same keyed marks the SVG stage draws, rendered in
// real 3D with a directed camera. A figure opens on the plan view (the flat
// diagram a reader already knows), moves to what each step is about, and
// ends flat again. Labels are HTML, so they stay crisp and face the reader.
//
// Everything here is a function of the step and its progress: seeking and
// step links stay exact, as on the SVG stage.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { StepInfo } from "../core/scene.ts";
import type { BoxMark, CylinderMark, LabelMark, LinkMark, Mark, Resolved, SolidMark, Tone, Vec3 } from "../core/types.ts";
import type { StageRenderer } from "../render/svg.ts";
import { LOOKS, type Look, type LookName } from "./looks.ts";

/** Kit coordinates are x, y on the floor and z up; three.js has y up. */
const v3 = (p: readonly number[]) => new THREE.Vector3(p[0]!, p[2]!, p[1]!);
const solid = (m: Mark): m is SolidMark => m.kind === "box" || m.kind === "cylinder";
const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

interface Shot { pos: THREE.Vector3; look: THREE.Vector3 }

export interface UnfoldStage extends StageRenderer {
  /** The element to place in the stage box: canvas, label layer and the sizing overlay. */
  host: HTMLElement;
  /** Set the camera for a moment of the timeline. */
  frame(index: number, progress: number): void;
  /** Light the marks these ids name (key, owner or link id), as a narration speaks them. */
  highlight(ids: readonly string[]): void;
  /** Screen positions of what is drawn, for checks. */
  inspect(): { key: string; x: number; y: number; w: number; h: number; facing: boolean; occluded: boolean }[];
  destroy(): void;
}

function bounds(marks: readonly Mark[]): THREE.Box3 {
  const b = new THREE.Box3();
  for (const m of marks) {
    if (m.kind === "box") { b.expandByPoint(v3(m.at)); b.expandByPoint(v3([m.at[0] + m.size[0], m.at[1] + m.size[1], m.at[2] + m.size[2]])); }
    else if (m.kind === "cylinder") { b.expandByPoint(v3([m.at[0] - m.radius, m.at[1] - m.radius, m.at[2]])); b.expandByPoint(v3([m.at[0] + m.radius, m.at[1] + m.radius, m.at[2] + m.height])); }
    else if (m.kind === "link") { b.expandByPoint(v3(m.from)); b.expandByPoint(v3(m.to)); }
    // A label's point, with room for its text either side.
    else if (m.kind === "label") { const p = v3(m.at); const w = m.text.length * 2.2; b.expandByPoint(p.clone().add(new THREE.Vector3(w, 4, 7))); b.expandByPoint(p.clone().add(new THREE.Vector3(-w, -4, -7))); }
  }
  return b;
}

export function createUnfoldStage(steps: readonly StepInfo[], lookName: LookName, label: string): UnfoldStage {
  const look: Look = LOOKS[lookName];
  const host = document.createElement("div");
  host.className = "vz-unfold";
  host.dataset.look = lookName;
  const canvas = document.createElement("canvas");
  const labels = document.createElement("div");
  labels.className = "vz-unfold-labels";
  // The overlay keeps the SVG stage's size and role, and draws label leaders.
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "vz-svg");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", label);
  host.append(canvas, svg, labels);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 1, 8000);

  // The whole figure, every step: sets the light, the ground and the plan view.
  const all = bounds(steps.flatMap((s) => s.marks));
  const size = all.getSize(new THREE.Vector3()), centre = all.getCenter(new THREE.Vector3());
  const span = Math.max(size.x, size.z, 40);
  // The solids alone, without the room left for labels: what the plan view must never crop.
  const solidBox = bounds(steps.flatMap((s) => s.marks.filter(solid)));
  look.setup(scene, renderer, { floor: all.min.y, span, centre });

  // ---- Camera: plan view at the ends, the focus of each step in between ---------
  const fit = (b: THREE.Box3, dir: THREE.Vector3, shareIn: number, exactBox: THREE.Box3 = b, margin = 0): Shot => {
    // Labels are a fixed pixel size, so on a narrow stage they take more of it: leave more room.
    const share = shareIn * (host.clientWidth && host.clientWidth < 600 ? 0.8 : 1);
    const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
    const vfov = (camera.fov * Math.PI) / 180, hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    // Fit the box's footprint seen from this direction.
    const w = Math.max(s.x, 1) * Math.abs(Math.cos(Math.atan2(dir.z, dir.x))) + Math.max(s.z, 1) * Math.abs(Math.sin(Math.atan2(dir.z, dir.x)));
    const width = Math.max(w, Math.hypot(s.x, s.z) * 0.8);
    const height = Math.max(s.y + s.z * Math.abs(dir.y) * 0.6, 1);
    const heuristic = Math.max(width / share / 2 / Math.tan(hfov / 2), height / share / 2 / Math.tan(vfov / 2));
    // A floor under the estimate: never so close that an exact perspective fit
    // of `exactBox` would leave the frame (with `margin` to spare). The estimate, whose shares were
    // tuned with it, decides everywhere else; it undercounts a figure that is
    // deep rather than wide (a tree over an array) and cropped its front.
    const n = dir.clone().normalize(), f = n.clone().negate();
    const edge = (1 - margin) * (host.clientWidth && host.clientWidth < 600 ? 0.8 : 1);
    const right = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0));
    if (right.lengthSq() < 1e-9) right.set(1, 0, 0);
    right.normalize();
    const up = new THREE.Vector3().crossVectors(right, f).normalize();
    let exact = 0;
    for (const x of [exactBox.min.x, exactBox.max.x]) for (const y of [exactBox.min.y, exactBox.max.y]) for (const z of [exactBox.min.z, exactBox.max.z]) {
      const o = new THREE.Vector3(x, y, z).sub(c);
      exact = Math.max(exact, Math.abs(o.dot(right)) / edge / Math.tan(hfov / 2) + o.dot(n), Math.abs(o.dot(up)) / edge / Math.tan(vfov / 2) + o.dot(n));
    }
    const d = Math.max(heuristic, exact);
    return { pos: c.clone().add(n.multiplyScalar(d)), look: c };
  };
  const plan = new THREE.Vector3(0, 1, 0.06);
  const angle = (k: number) => new THREE.Vector3(k % 4 < 2 ? 0.55 : 1.05, 1.1, 1.25);
  let shots: Shot[] = [];
  // The plan view sits a little lower, so the title block at the stage's top left stays clear of the parts.
  const planShot = (b: THREE.Box3) => {
    const shot = fit(b, plan, 0.86, solidBox, 0.05), drop = b.getSize(new THREE.Vector3()).z * 0.045;
    shot.pos.z -= drop; shot.look.z -= drop;
    return shot;
  };
  // On the opening step the concept is written over the stage's bottom-left
  // (.vz-concept, styles.css: left 26, bottom 22, width min(400px, 38%), 14px/1.55
  // text). Its size is estimated from the text, not measured, so every step's
  // framing stays a function of the stage size alone.
  const conceptText = (steps[0]?.voice ?? "").replace(/\[([^\]|]+)\|[^\]]+\]/g, "$1").replace(/\{([^}]+)\}/g, "$1");
  const conceptBox = (W: number, H: number) => {
    if (!conceptText || typeof matchMedia === "undefined" || matchMedia("(max-width: 760px)").matches) return null;
    const width = Math.min(400, 0.38 * W);
    // 14px text sets at about 6 px a character; 6.4 errs toward a taller box.
    const lines = Math.ceil((conceptText.length * 6.4) / (width - 32));
    return { right: 26 + width + 12, top: H - 22 - (lines * 14 * 1.55 + 30) - 12 };
  };
  const screenRect = (b: THREE.Box3, shot: Shot, W: number, H: number) => {
    const cam = camera.clone();
    cam.position.copy(shot.pos); cam.lookAt(shot.look); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
      const p = new THREE.Vector3(x, y, z).project(cam);
      const sx = ((p.x + 1) / 2) * W, sy = ((1 - p.y) / 2) * H;
      left = Math.min(left, sx); right = Math.max(right, sx); top = Math.min(top, sy); bottom = Math.max(bottom, sy);
    }
    return { left, right, top, bottom };
  };
  /** The opening plan view, lifted (and if need be drawn smaller) so the written concept covers none of it. */
  const openingShot = (b: THREE.Box3): Shot => {
    const shot = planShot(b);
    const { width: W, height: H } = host.getBoundingClientRect();
    const box = W && H ? conceptBox(W, H) : null;
    if (!box) return shot;
    let rect = screenRect(solidBox, shot, W, H);
    if (rect.left >= box.right || rect.bottom <= box.top) return shot;
    const ceiling = 0.05 * H;
    const room = box.top - ceiling;
    if (rect.bottom - rect.top > room) {
      // Too tall to clear by lifting alone: step back until it fits the room above the concept.
      const dir = shot.pos.clone().sub(shot.look);
      shot.pos.copy(shot.look).add(dir.multiplyScalar((rect.bottom - rect.top) / room));
      rect = screenRect(solidBox, shot, W, H);
    }
    const lift = Math.max(0, rect.bottom - box.top);
    const perPx = (2 * shot.pos.distanceTo(shot.look) * Math.tan((camera.fov * Math.PI) / 360)) / H;
    const cam = camera.clone(); cam.position.copy(shot.pos); cam.lookAt(shot.look);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    // Moving the camera down the screen moves the picture up it.
    const move = up.multiplyScalar(-lift * perPx);
    return { pos: shot.pos.clone().add(move), look: shot.look.clone().add(move) };
  };
  const computeShots = () => {
    shots = steps.map((s, k) => {
      const shot = s.teaching?.shot;
      if (k === 0) return openingShot(all);
      if (shot === "plan" || (shot === undefined && k === steps.length - 1)) return planShot(all);
      // What the step is about: solids still at full strength, among those that recede.
      const focus = s.marks.filter((m) => solid(m) && m.role !== "foundation" && (m.emphasis ?? 1) >= 0.99);
      const anyReceded = s.marks.some((m) => solid(m) && (m.emphasis ?? 1) < 0.99);
      const fb = anyReceded && focus.length ? bounds(focus) : all.clone();
      // Keep some of the whole in frame, so what changed is seen in its place.
      const blend = fb.clone().union(new THREE.Box3(all.min.clone().lerp(fb.min, 0.6), all.max.clone().lerp(fb.max, 0.6)));
      return fit(blend, angle(k), 0.7);
    });
  };

  // ---- Meshes, kept by mark key ---------------------------------------------------
  interface Node { decal?: THREE.Mesh; decalText?: string; obj: THREE.Object3D; mat?: THREE.MeshStandardMaterial; edge?: THREE.LineBasicMaterial; label?: HTMLDivElement; leader?: SVGLineElement; geomKey?: string }
  const nodes = new Map<string, Node>();
  const geoms = new Map<string, THREE.BufferGeometry>();
  const geometry = (k: string, make: () => THREE.BufferGeometry) => { let g = geoms.get(k); if (!g) { g = make(); geoms.set(k, g); } return g; };
  const htmlLabel = (cls: string) => { const d = document.createElement("div"); d.className = cls; labels.append(d); return d; };

  /** Lettering as a flat textured plane lying on a top face (kept sharp with a large canvas). */
  function decalFor(text: string, size: number, role?: string): THREE.Mesh {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    const px = text.length > 3 ? 70 : text.length > 1 ? 110 : 150;
    g.font = `${role === "value" ? 600 : 700} ${px}px ${look.font}`;
    g.fillText(text, 128, 138);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  function solidNode(m: SolidMark): Node {
    const mat = look.material(m.tone ?? "structure", m.role);
    const key = m.kind === "box" ? `b${m.size.join(",")},${m.radius ?? 0}` : `c${m.radius},${m.height}`;
    const g = geometry(key, () => m.kind === "box"
      ? new RoundedBoxGeometry(m.size[0], m.size[2], m.size[1], 3, Math.min((m as BoxMark).radius ?? 0.4, Math.min(...m.size) / 2 - 0.01))
      : new THREE.CylinderGeometry(m.radius, m.radius, m.height, 48));
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = m.role !== "foundation";
    mesh.receiveShadow = true;
    const group = new THREE.Group();
    group.add(mesh);
    let edge: THREE.LineBasicMaterial | undefined;
    if (look.edges) {
      // The ink line is the part's own silhouette: a slightly larger back-facing shell in ink,
      // so it follows rounded corners exactly, as a pen outline would.
      edge = new THREE.MeshBasicMaterial({ color: look.ink, side: THREE.BackSide, transparent: true }) as unknown as THREE.LineBasicMaterial;
      const hull = new THREE.Mesh(g, edge as unknown as THREE.Material);
      const t = 0.55;
      const [sx, sy, sz] = m.kind === "box" ? [m.size[0], m.size[2], m.size[1]] : [m.radius * 2, m.height, m.radius * 2];
      hull.scale.set((sx + 2 * t) / sx, (sy + 2 * t) / sy, (sz + 2 * t) / sz);
      group.add(hull);
    }
    return { obj: group, mat, edge, geomKey: key };
  }

  function updateSolid(n: Node, m: Resolved<SolidMark>) {
    const c = m.kind === "box" ? [m.at[0] + m.size[0] / 2, m.at[1] + m.size[1] / 2, m.at[2] + m.size[2] / 2] : [m.at[0], m.at[1], m.at[2] + m.height / 2];
    // Depth carries meaning, as in a hand-made model: the part to watch rises,
    // a subject that falls out of the step sinks back into its place.
    const h = m.kind === "box" ? m.size[2] : m.height;
    const e = m.emphasis ?? 1;
    let lift = 0;
    if (m.role === "subject") { lift = (m.lit || named(m) ? h * 0.35 : 0) - (1 - e) / (1 - 0.42) * h * 0.3; c[2] = c[2]! + lift; }
    n.obj.position.copy(v3(c));
    look.paint(n.mat!, { tone: m.tone ?? "structure", role: m.role, lit: !!m.lit || named(m), emphasis: m.emphasis ?? 1, opacity: m.opacity }, n.edge);
    if (n.edge) n.edge.opacity = 0.85 * m.opacity;
    // Face text on a top face is printed on it, like lettering on a key: a decal lying on
    // the surface, so it can never float. Side-face text stays an upright HTML label.
    const onTop = !!m.label && (m.labelFace ?? "top") === "top";
    if (onTop) {
      const top = (m.kind === "box" ? m.at[2] + m.size[2] : m.at[2] + m.height) + lift;
      const [w, d] = m.kind === "box" ? [m.size[0], m.size[1]] : [m.radius * 2, m.radius * 2];
      if (!n.decal || n.decalText !== m.label) {
        if (n.decal) { n.obj.parent?.remove(n.decal); }
        n.decal = decalFor(m.label!, Math.min(w, d) * 0.78, m.textRole);
        n.decalText = m.label;
        scene.add(n.decal);
      }
      n.decal.position.copy(v3([c[0]!, c[1]!, top + 0.06]));
      look.paintDecal?.(n.decal.material as THREE.MeshBasicMaterial, m.tone ?? "structure", m.emphasis ?? 1, !!m.lit || named(m), m.opacity);
      n.decal.visible = n.obj.visible;
    } else if (n.decal) { scene.remove(n.decal); n.decal = undefined; }
    if (m.label) {
      n.label ??= htmlLabel("vz-unfold-face");
      n.label.hidden = false;
      n.label.classList.toggle("is-decal", onTop);
      n.label.textContent = m.label;
      n.label.dataset.key = m.key;
      n.label.dataset.role = m.textRole ?? "name";
      const top = m.kind === "box" ? m.at[2] + m.size[2] : m.at[2] + m.height;
      const face = (m.labelFace ?? "top") === "top" ? [c[0]!, c[1]!, top] : m.kind === "box" ? [c[0]!, m.at[1] + m.size[1], c[2]!] : [c[0]!, c[1]! + m.radius, c[2]!];
      n.label.dataset.at = face.join(",");
      n.label.style.opacity = String(m.opacity * (0.45 + 0.55 * (m.emphasis ?? 1)));
    } else if (n.label) { n.label.remove(); n.label = undefined; }
  }

  function linkNode(m: LinkMark): Node {
    const mat = look.material(m.tone ?? "structure", undefined);
    return { obj: new THREE.Mesh(new THREE.BufferGeometry(), mat), mat };
  }
  function updateLink(n: Node, m: Resolved<LinkMark>) {
    const pts = [m.from, ...(m.via ?? []), m.to].map((p) => v3([p[0], p[1], p[2] + (m.cable ? (m.width ?? 1.25) / 2 : 0)]));
    const key = pts.map((p) => p.toArray().map((x) => x.toFixed(2)).join(",")).join(";");
    if (n.geomKey !== key) {
      const path = new THREE.CurvePath<THREE.Vector3>();
      for (let i = 1; i < pts.length; i++) path.add(new THREE.LineCurve3(pts[i - 1]!, pts[i]!));
      (n.obj as THREE.Mesh).geometry.dispose();
      (n.obj as THREE.Mesh).geometry = new THREE.TubeGeometry(path, Math.max(8, pts.length * 8), Math.max(0.4, (m.width ?? 1.25) / 2), 8, false);
      n.geomKey = key;
    }
    look.paint(n.mat!, { tone: m.tone ?? "structure", role: undefined, lit: !!m.lit, emphasis: m.emphasis ?? 1, opacity: m.opacity });
  }

  function updateLabel(n: Node, m: Resolved<LabelMark>) {
    n.label ??= htmlLabel("vz-unfold-label");
    n.label.textContent = m.text;
    n.label.dataset.key = m.key;
    n.label.dataset.size = m.size ?? "normal";
    n.label.dataset.anchor = m.anchor ?? "middle";
    n.label.dataset.at = m.at.join(",");
    n.label.style.opacity = String(m.opacity);
    if (m.target) {
      n.leader ??= svg.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "line")) as SVGLineElement;
      n.leader.setAttribute("class", "vz-unfold-leader");
      n.leader.dataset.to = m.target.at.join(",");
    } else if (n.leader) { n.leader.remove(); n.leader = undefined; }
  }

  // Lips, guides and stops gave the flat isometric drawing its finish; in real 3D
  // with shadows they read as clutter. Thin structural pieces are left out.
  const fineDetail = (m: SolidMark) => m.role !== "subject" && m.role !== "foundation" && !m.label
    && (m.kind === "box" ? Math.min(...m.size) < 2.5 : m.height < 1.2 && m.radius < 4);
  let lastMarks: readonly Resolved[] = [];
  let spoken = new Set<string>();
  const named = (m: Mark) => spoken.size > 0 && (spoken.has(m.key) || (!!m.owner && spoken.has(m.owner)) || (m.link ?? "").split(/\s+/).some((id) => spoken.has(id)));
  function render(marks: readonly Resolved[]) {
    lastMarks = marks;
    const seen = new Set<string>();
    for (const m of marks) {
      seen.add(m.key);
      let n = nodes.get(m.key);
      if (!n) {
        n = m.kind === "label" ? { obj: new THREE.Group() } : m.kind === "link" ? linkNode(m) : solidNode(m);
        n.obj.userData.key = m.key;
        scene.add(n.obj);
        nodes.set(m.key, n);
      }
      if (solid(m) && fineDetail(m)) { n.obj.visible = false; continue; }
      if (solid(m)) {
        const key = m.kind === "box" ? `b${m.size.join(",")},${m.radius ?? 0}` : `c${m.radius},${m.height}`;
        if (key !== n.geomKey) { scene.remove(n.obj); n = solidNode(m); n.obj.userData.key = m.key; scene.add(n.obj); nodes.set(m.key, n); }
        updateSolid(n, m as Resolved<SolidMark>);
      } else if (m.kind === "link") updateLink(n, m as Resolved<LinkMark>);
      else updateLabel(n, m as Resolved<LabelMark>);
    }
    for (const [k, n] of nodes) if (!seen.has(k)) { scene.remove(n.obj); if (n.decal) scene.remove(n.decal); n.label?.remove(); n.leader?.remove(); nodes.delete(k); }
    draw();
  }

  // ---- Frame ------------------------------------------------------------------
  let shot: Shot = { pos: new THREE.Vector3(0, 100, 0), look: new THREE.Vector3() };
  const tmp = new THREE.Vector3();
  const toScreen = (p: THREE.Vector3, r: DOMRect) => { tmp.copy(p).project(camera); return { x: ((tmp.x + 1) / 2) * r.width, y: ((1 - tmp.y) / 2) * r.height, behind: tmp.z > 1 }; };
  function draw() {
    camera.position.copy(shot.pos);
    camera.lookAt(shot.look);
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    const r = host.getBoundingClientRect();
    for (const n of nodes.values()) {
      if (!n.label) continue;
      const p = toScreen(v3(n.label.dataset.at!.split(",").map(Number)), r);
      const a = n.label.dataset.anchor;
      n.label.style.transform = `translate(${p.x}px, ${p.y}px) translate(${a === "start" ? "0" : a === "end" ? "-100%" : "-50%"}, -50%)`;
      n.label.hidden = p.behind;
      if (n.leader) {
        const q = toScreen(v3(n.leader.dataset.to!.split(",").map(Number)), r);
        n.leader.setAttribute("x1", String(p.x)); n.leader.setAttribute("y1", String(p.y + 8));
        n.leader.setAttribute("x2", String(q.x)); n.leader.setAttribute("y2", String(q.y));
      }
    }
  }

  function resize() {
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    svg.setAttribute("viewBox", `0 0 ${r.width} ${r.height}`);
    camera.aspect = r.width / r.height;
    // The step heading sits over the stage's top-left: move the picture right and down to clear it.
    if (r.width > 700) camera.setViewOffset(r.width, r.height, -r.width * 0.045, 0, r.width, r.height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    computeShots();
    draw();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  computeShots();

  return {
    svg,
    host,
    render,
    setViewBox() {},
    highlight(ids) {
      const next = new Set(ids);
      if (next.size === spoken.size && [...next].every((i) => spoken.has(i))) return;
      spoken = next;
      for (const n of nodes.values()) n.label?.classList.toggle("is-spoken", false);
      render(lastMarks);
    },
    measureLabels: () => null,
    refreshInk() { look.theme?.(scene, document.documentElement); draw(); },
    solidOrder: () => [],
    conflicts: () => [],
    frame(index, progress) {
      const to = shots[index] ?? shots[0]!;
      const from = shots[Math.max(0, index - 1)] ?? to;
      const u = progress >= 1 || index === 0 ? 1 : ease(Math.max(0, progress));
      shot = { pos: from.pos.clone().lerp(to.pos, u), look: from.look.clone().lerp(to.look, u) };
      draw();
    },
    inspect() {
      const r = host.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      const out: ReturnType<UnfoldStage["inspect"]> = [];
      const meshes: THREE.Object3D[] = [];
      for (const n of nodes.values()) if (n.obj.visible && (!n.label || n.obj.children.length)) meshes.push(n.obj);
      for (const m of lastMarks) {
        if (!solid(m) || m.opacity < 0.3 || fineDetail(m)) continue;
        const n = nodes.get(m.key)!;
        const box = new THREE.Box3().setFromObject(n.obj);
        const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => toScreen(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z), r));
        const xs = corners.map((c) => c.x), ys = corners.map((c) => c.y);
        const centre = box.getCenter(new THREE.Vector3());
        ray.setFromCamera(new THREE.Vector2(((Math.min(...xs) + Math.max(...xs)) / r.width) - 1, 1 - ((Math.min(...ys) + Math.max(...ys)) / r.height)), camera);
        const hit = ray.intersectObjects(meshes, true)[0];
        let o: THREE.Object3D | null = hit?.object ?? null;
        while (o && o.userData.key === undefined) o = o.parent;
        const toCam = camera.position.clone().sub(centre).normalize();
        out.push({ key: m.key, x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), facing: toCam.y > 0.05, occluded: !!o && o.userData.key !== m.key });
      }
      return out;
    },
    destroy() { ro.disconnect(); renderer.dispose(); geoms.forEach((g) => g.dispose()); },
  };
}

export type { Tone, Vec3, CylinderMark };
