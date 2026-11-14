// Paper: the textbook page itself. Numbers are printed on cards lying on a
// sheet; the card being looked at folds up to face you, ruled-out cards fade
// to pencil grey, and the answer stands in red.
import * as THREE from "three";
import { mount, type Style, type TileState } from "./engine.ts";

const INK = new THREE.Color("#25304a");
const RED = new THREE.Color("#c63d2f");
const PENCIL = new THREE.Color("#b7b0a2");
const BLUE = new THREE.Color("#2f5fb3");

function sheetTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f6f1e6";
  g.fillRect(0, 0, 1024, 1024);
  // Paper grain.
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(120,100,70,${Math.random() * 0.05})`;
    g.fillRect(Math.random() * 1024, Math.random() * 1024, 1 + Math.random() * 2, 1);
  }
  // A faint printed grid, as on graph paper.
  g.strokeStyle = "rgba(70,110,170,0.13)";
  g.lineWidth = 1;
  for (let k = 0; k <= 1024; k += 32) {
    g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 1024); g.stroke();
    g.beginPath(); g.moveTo(0, k); g.lineTo(1024, k); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(12, 7);
  t.anisotropy = 8;
  return t;
}

/** The printed face of a card, drawn in white so its colour can be inked. */
function printTexture(value: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 280;
  const g = c.getContext("2d")!;
  g.strokeStyle = "#fff";
  g.lineWidth = 7;
  g.lineJoin = "round";
  // A slightly hand-drawn border.
  g.beginPath();
  const j = () => (Math.random() - 0.5) * 3;
  g.moveTo(20 + j(), 22 + j()); g.lineTo(236 + j(), 20 + j()); g.lineTo(238 + j(), 258 + j()); g.lineTo(18 + j(), 260 + j()); g.closePath();
  g.stroke();
  g.fillStyle = "#fff";
  g.font = "600 120px 'Iowan Old Style', 'Palatino', Georgia, serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(value), 128, 146);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const W = 1.1, D = 1.2, T = 0.035;

const style: Style = {
  id: "paper",
  title: "Paper",
  sound: "paper",
  htmlNumbers: false,
  setup(scene, renderer) {
    renderer.toneMappingExposure = 1.28;
    scene.add(new THREE.HemisphereLight("#ffffff", "#d9cfbd", 1.5));
    const sun = new THREE.DirectionalLight("#fffaf0", 1.6);
    sun.position.set(-6, 13, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.radius = 5;
    sun.shadow.bias = -0.0003;
    Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 8, bottom: -8, near: 1, far: 40 });
    scene.add(sun);
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(90, 50), new THREE.MeshStandardMaterial({ map: sheetTexture(), roughness: 1 }));
    sheet.rotation.x = -Math.PI / 2;
    sheet.receiveShadow = true;
    scene.add(sheet);
  },
  tile(_i, value, x) {
    const pivot = new THREE.Group();
    const card = new THREE.Mesh(new THREE.BoxGeometry(W, T, D), new THREE.MeshStandardMaterial({ color: "#fffdf7", roughness: 0.95 }));
    card.position.set(0, T / 2, -D / 2);
    card.castShadow = true;
    card.receiveShadow = true;
    const inkMat = new THREE.MeshBasicMaterial({ map: printTexture(value), transparent: true, color: INK.clone(), depthWrite: false });
    const print = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.98, D * 0.98), inkMat);
    print.rotation.x = -Math.PI / 2;
    print.position.set(0, T + 0.002, -D / 2);
    // The answer gets circled in red pencil, as on a worked page.
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.86, 48), new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0.9 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, T + 0.004, -D / 2);
    ring.scale.set(1, 1.08, 1);
    ring.visible = false;
    pivot.add(card, print, ring);
    // Cards fold up about their front edge, so the printed face turns toward the reader.
    const angle = (s: TileState) => (s.lift * 1.22 + s.lit * 0.16) * (1 - s.gone) * (1 - s.found);
    return {
      object: pivot,
      apply(s) {
        pivot.position.set(x, 0.002, D / 2);
        pivot.rotation.x = angle(s);
        inkMat.color.copy(INK).lerp(BLUE, s.lift).lerp(RED, Math.max(s.found, s.lit * 0.9)).lerp(PENCIL, s.gone * 0.9);
        ring.visible = s.found > 0.5;
      },
      labelAnchor: (s) => {
        const a = angle(s);
        return new THREE.Vector3(x, 0.002 + Math.sin(a) * D, D / 2 - Math.cos(a) * D);
      },
    };
  },
};

mount(style);
