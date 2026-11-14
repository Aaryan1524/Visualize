// The two looks of the Unfold stage. Each is a closed set: a ground, a light,
// one material system and a palette in which every tone has one meaning.
//
//   paper  the textbook page: white paper solids drawn in ink on graph paper
//   clay   soft matte solids on a warm table with real soft shadows

import * as THREE from "three";
import type { Tone } from "../core/types.ts";

export type LookName = "paper" | "clay";

export interface PaintState { tone: Tone; role?: "foundation" | "subject"; lit: boolean; emphasis: number; opacity: number }

export interface Look {
  setup(scene: THREE.Scene, renderer: THREE.WebGLRenderer, figure: { floor: number; span: number; centre: THREE.Vector3 }): void;
  material(tone: Tone, role?: "foundation" | "subject"): THREE.MeshStandardMaterial;
  paint(mat: THREE.MeshStandardMaterial, s: PaintState, edge?: THREE.LineBasicMaterial): void;
  /** Ink outlines on every solid (paper) or none (clay). */
  edges: boolean;
  ink: THREE.ColorRepresentation;
  lit: THREE.ColorRepresentation;
  theme?(scene: THREE.Scene, root: HTMLElement): void;
}

function sheetTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f6f1e6";
  g.fillRect(0, 0, 512, 512);
  // Deterministic grain, so every render of a step is the same.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = `rgba(120,100,70,${rand() * 0.05})`;
    g.fillRect(rand() * 512, rand() * 512, 1 + rand() * 2, 1);
  }
  g.strokeStyle = "rgba(70,110,170,0.14)";
  for (let k = 0; k <= 512; k += 32) {
    g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 512); g.stroke();
    g.beginPath(); g.moveTo(0, k); g.lineTo(512, k); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function sun(scene: THREE.Scene, span: number, centre: THREE.Vector3, colour: string, strength: number) {
  const s = new THREE.DirectionalLight(colour, strength);
  s.position.set(centre.x - span * 0.45, centre.y + span * 0.9, centre.z + span * 0.6);
  s.target.position.copy(centre);
  s.castShadow = true;
  s.shadow.mapSize.set(2048, 2048);
  s.shadow.radius = 6;
  s.shadow.bias = -0.0005;
  const h = span * 0.8;
  Object.assign(s.shadow.camera, { left: -h, right: h, top: h, bottom: -h, near: 1, far: span * 4 });
  scene.add(s, s.target);
}

// ---- Paper ----------------------------------------------------------------------
const PAPER = new THREE.Color("#fffdf7");
const INK = new THREE.Color("#25304a");
const PAPER_TONE: Record<Tone, { fill: string; ink: string }> = {
  base: { fill: "#f7f2e7", ink: "#8a8577" },
  structure: { fill: "#f3eee3", ink: "#5d6475" },
  subject: { fill: "#fffdf7", ink: "#25304a" },
  muted: { fill: "#ebe5d8", ink: "#b0a998" },
  accent: { fill: "#e3ebfa", ink: "#2f5fb3" },
  cold: { fill: "#e6eef7", ink: "#4a6f9e" },
  hot: { fill: "#fbe9d6", ink: "#b5652a" },
  good: { fill: "#e4f1e7", ink: "#2f7a4c" },
  bad: { fill: "#f8e2dd", ink: "#c63d2f" },
};

const paper: Look = {
  edges: true,
  ink: INK,
  lit: "#c63d2f",
  setup(scene, renderer, { floor, span, centre }) {
    renderer.toneMappingExposure = 1.25;
    scene.add(new THREE.HemisphereLight("#ffffff", "#d9cfbd", 1.5));
    sun(scene, span, centre, "#fffaf0", 1.5);
    const tex = sheetTexture();
    tex.repeat.set(span / 20, span / 20);
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(span * 8, span * 8), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    sheet.rotation.x = -Math.PI / 2;
    sheet.position.set(centre.x, floor - 0.05, centre.z);
    sheet.receiveShadow = true;
    scene.add(sheet);
  },
  material: () => new THREE.MeshStandardMaterial({ color: PAPER.clone(), roughness: 0.95, metalness: 0 }),
  paint(mat, s, edge) {
    const t = PAPER_TONE[s.tone];
    // Receding parts fade toward the page; nothing goes grey-black.
    mat.color.set(t.fill).lerp(new THREE.Color("#f6f1e6"), 1 - s.emphasis);
    mat.emissive.set(s.lit ? "#3a0f08" : "#000000");
    mat.transparent = s.opacity < 1;
    mat.opacity = s.opacity;
    if (edge) edge.color.set(s.lit ? "#c63d2f" : t.ink).lerp(new THREE.Color("#c9c2b2"), 1 - s.emphasis);
  },
};

// ---- Clay -------------------------------------------------------------------------
const CLAY_TONE: Record<Tone, string> = {
  base: "#ead9c4",
  structure: "#e4d5c2",
  subject: "#f7eee3",
  muted: "#d9cbb9",
  accent: "#e0714c",
  cold: "#7fa6c7",
  hot: "#e3a05a",
  good: "#5fa883",
  bad: "#cf5a49",
};
const clay: Look = {
  edges: false,
  ink: "#3b3027",
  lit: "#e0714c",
  setup(scene, renderer, { floor, span, centre }) {
    renderer.toneMappingExposure = 1.05;
    scene.add(new THREE.HemisphereLight("#fff7ec", "#b8a28a", 1.25));
    sun(scene, span, centre, "#fff1e0", 2.1);
    const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(span * 8, span * 8), new THREE.ShadowMaterial({ opacity: 0.16 }));
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(centre.x, floor - 0.05, centre.z);
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);
  },
  material: () => new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 }),
  paint(mat, s) {
    mat.color.set(CLAY_TONE[s.tone]).lerp(new THREE.Color("#efe4d6"), (1 - s.emphasis) * 0.75);
    mat.emissive.set("#ffb38a").multiplyScalar(s.lit ? 0.18 : 0);
    mat.transparent = s.opacity < 1;
    mat.opacity = s.opacity;
  },
};

export const LOOKS: Record<LookName, Look> = { paper, clay };
