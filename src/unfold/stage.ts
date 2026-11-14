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
  look.setup(scene, renderer, { floor: all.min.y, span, centre });

  // ---- Camera: plan view at the ends, the focus of each step in between ---------
  const fit = (b: THREE.Box3, dir: THREE.Vector3, share: number): Shot => {
    const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
    const vfov = (camera.fov * Math.PI) / 180, hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    // Fit the box's footprint seen from this direction.
    const w = Math.max(s.x, 1) * Math.abs(Math.cos(Math.atan2(dir.z, dir.x))) + Math.max(s.z, 1) * Math.abs(Math.sin(Math.atan2(dir.z, dir.x)));
    const width = Math.max(w, Math.hypot(s.x, s.z) * 0.8);
    const height = Math.max(s.y + s.z * Math.abs(dir.y) * 0.6, 1);
    const d = Math.max(width / share / 2 / Math.tan(hfov / 2), height / share / 2 / Math.tan(vfov / 2));
    return { pos: c.clone().add(dir.clone().normalize().multiplyScalar(d)), look: c };
  };
  const plan = new THREE.Vector3(0, 1, 0.06);
  const angle = (k: number) => new THREE.Vector3(k % 4 < 2 ? 0.55 : 1.05, 1.1, 1.25);
  let shots: Shot[] = [];
  const planShot = (b: THREE.Box3) => fit(b, plan, 0.86);
  const computeShots = () => {
    shots = steps.map((s, k) => {
      const shot = s.teaching?.shot;
      if (shot === "plan" || k === 0 || (shot === undefined && k === steps.length - 1)) return planShot(all);
      // What the step is about: solids still at full strength, among those that recede.
      const focus = s.marks.filter((m) => solid(m) && m.role !== "foundation" && (m.emphasis ?? 1) >= 0.99);
      const anyReceded = s.marks.some((m) => solid(m) && (m.emphasis ?? 1) < 0.99);
      const fb = anyReceded && focus.length ? bounds(focus) : all.clone();
      // Keep some of the whole in frame, so what changed is seen in its place.
      const blend = fb.clone().union(new THREE.Box3(all.min.clone().lerp(fb.min, 0.6), all.max.clone().lerp(fb.max, 0.6)));
      return fit(blend, angle(k), 0.78);
    });
  };

  // ---- Meshes, kept by mark key ---------------------------------------------------
  interface Node { obj: THREE.Object3D; mat?: THREE.MeshStandardMaterial; edge?: THREE.LineBasicMaterial; label?: HTMLDivElement; leader?: SVGLineElement; geomKey?: string }
  const nodes = new Map<string, Node>();
  const geoms = new Map<string, THREE.BufferGeometry>();
  const geometry = (k: string, make: () => THREE.BufferGeometry) => { let g = geoms.get(k); if (!g) { g = make(); geoms.set(k, g); } return g; };
  const htmlLabel = (cls: string) => { const d = document.createElement("div"); d.className = cls; labels.append(d); return d; };

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
      edge = new THREE.LineBasicMaterial({ color: look.ink, transparent: true, opacity: 0.9 });
      group.add(new THREE.LineSegments(geometry(`e${key}`, () => new THREE.EdgesGeometry(g, 28)), edge));
    }
    return { obj: group, mat, edge, geomKey: key };
  }

  function updateSolid(n: Node, m: Resolved<SolidMark>) {
    const c = m.kind === "box" ? [m.at[0] + m.size[0] / 2, m.at[1] + m.size[1] / 2, m.at[2] + m.size[2] / 2] : [m.at[0], m.at[1], m.at[2] + m.height / 2];
    n.obj.position.copy(v3(c));
    look.paint(n.mat!, { tone: m.tone ?? "structure", role: m.role, lit: !!m.lit, emphasis: m.emphasis ?? 1, opacity: m.opacity }, n.edge);
    if (n.edge) n.edge.opacity = 0.85 * m.opacity;
    // Face text: an HTML label over the face it belongs to, always upright.
    if (m.label) {
      n.label ??= htmlLabel("vz-unfold-face");
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

  let lastMarks: readonly Resolved[] = [];
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
      if (solid(m)) {
        const key = m.kind === "box" ? `b${m.size.join(",")},${m.radius ?? 0}` : `c${m.radius},${m.height}`;
        if (key !== n.geomKey) { scene.remove(n.obj); n = solidNode(m); n.obj.userData.key = m.key; scene.add(n.obj); nodes.set(m.key, n); }
        updateSolid(n, m as Resolved<SolidMark>);
      } else if (m.kind === "link") updateLink(n, m as Resolved<LinkMark>);
      else updateLabel(n, m as Resolved<LabelMark>);
    }
    for (const [k, n] of nodes) if (!seen.has(k)) { scene.remove(n.obj); n.label?.remove(); n.leader?.remove(); nodes.delete(k); }
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
      for (const n of nodes.values()) if (!n.label || n.obj.children.length) meshes.push(n.obj);
      for (const m of lastMarks) {
        if (!solid(m) || m.opacity < 0.3) continue;
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
