import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/* -------------------------------------------------------------------------- */
/*  Color Lock & Material Tokens                                              */
/* -------------------------------------------------------------------------- */

export const MONOCHROME_TOKENS = {
  clayLight: 0xf1f0ea,
  clayMid: 0xd6d4cc,
  clayDark: 0x9b9991,
  graphite: 0x4b4e54,
} as const;

export const ACCENT_TOKENS = {
  orange: 0xe05a1e,
  cobalt: 0x2563eb,
  ember: 0xef4444,
  teal: 0x0d9488,
  gold: 0xd69624,
} as const;

export type MonochromeKey = keyof typeof MONOCHROME_TOKENS;
export type AccentKey = keyof typeof ACCENT_TOKENS;
export type StudioTheme = "light" | "dark";

export const ARCHITECTURAL_EDGE_COLOR = 0x2d3036;
export const ARCHITECTURAL_EDGE_OPACITY = 0.42;
export const ARCHITECTURAL_EDGE_DIM_OPACITY = 0.18;
export const ARCHITECTURAL_EDGE_FOCUS_OPACITY = 0.62;

const DEG2RAD = Math.PI / 180;

export interface ClayMaterialOptions {
  roughness?: number;
  metalness?: number;
  side?: THREE.Side;
}

/**
 * Create a matte-clay or satin-metal architectural PBR material locked to the
 * 4 strict monochrome structural tokens.
 */
export function createClayMaterial(
  tone: MonochromeKey = "clayLight",
  opts: ClayMaterialOptions = {},
): THREE.MeshStandardMaterial {
  const isGraphite = tone === "graphite";
  const roughness = opts.roughness ?? (isGraphite ? 0.56 : 0.78);
  const metalness = opts.metalness ?? (isGraphite ? 0.22 : 0.06);
  const hex = MONOCHROME_TOKENS[tone];

  const mat = new THREE.MeshStandardMaterial({
    color: hex,
    roughness,
    metalness,
    side: opts.side ?? THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });

  mat.userData.baseColorHex = hex;
  mat.userData.baseOpacity = 1;
  mat.userData.baseTransparent = false;
  mat.userData.tone = tone;
  return mat;
}

/**
 * Attach crisp thin architectural contour lines (`EdgesGeometry`) in muted
 * architectural charcoal to a structural mesh.
 */
export function addArchitecturalEdges(
  mesh: THREE.Mesh,
  thresholdDeg = 18,
  opts: { color?: number; opacity?: number } = {},
): THREE.LineSegments {
  const edgeGeo = new THREE.EdgesGeometry(mesh.geometry, thresholdDeg);
  const baseOpacity = opts.opacity ?? ARCHITECTURAL_EDGE_OPACITY;
  const lineMat = new THREE.LineBasicMaterial({
    color: opts.color ?? ARCHITECTURAL_EDGE_COLOR,
    transparent: true,
    opacity: baseOpacity,
    depthWrite: false,
  });
  lineMat.userData.isArchitecturalEdge = true;
  lineMat.userData.baseOpacity = baseOpacity;

  const lines = new THREE.LineSegments(edgeGeo, lineMat);
  lines.name = `${mesh.name || "solid"}_edges`;
  lines.userData.isArchitecturalEdge = true;
  lines.renderOrder = 2;
  mesh.add(lines);
  return lines;
}

function configureSolidMesh(
  mesh: THREE.Mesh,
  thresholdDeg = 18,
): THREE.Mesh {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addArchitecturalEdges(mesh, thresholdDeg);
  return mesh;
}

/* -------------------------------------------------------------------------- */
/*  Primitive 1: cutawayCylinder                                              */
/* -------------------------------------------------------------------------- */

export interface CutawayCylinderOptions {
  length: number;
  rOuter: number;
  rInner: number;
  rOuterEnd?: number;
  rInnerEnd?: number;
  openDeg?: number;
  startDeg?: number;
  x0?: number;
  axis?: "x" | "y" | "z";
  tone?: MonochromeKey;
  metalness?: number;
  roughness?: number;
  segments?: number;
  edgeThresholdDeg?: number;
}

/**
 * Build a watertight, thick-walled revolved cutaway cylinder or tapered cone
 * along the X-axis, with closed outer wall, inner wall, front/back annular end
 * rims, and closed longitudinal cut faces.
 */
export function buildCutawayCylinderGeometry(
  opts: CutawayCylinderOptions,
): THREE.BufferGeometry {
  const length = Math.max(1e-4, opts.length);
  const xA = opts.x0 ?? -length / 2;
  const xB = xA + length;

  const roA = Math.max(1e-4, opts.rOuter);
  const riA = Math.max(0, Math.min(roA - 1e-4, opts.rInner));
  const roB = Math.max(1e-4, opts.rOuterEnd ?? roA);
  const riB = Math.max(0, Math.min(roB - 1e-4, opts.rInnerEnd ?? riA));

  const openDeg = Math.max(0, Math.min(359, opts.openDeg ?? 135));
  const isCutaway = openDeg > 0.01;
  const sweepRad = (360 - openDeg) * DEG2RAD;
  const segs = Math.max(8, Math.round(opts.segments ?? 84));

  // Center the cutaway opening at +45° (front-top toward +Y, +Z camera).
  const thetaStart =
    opts.startDeg !== undefined
      ? opts.startDeg * DEG2RAD
      : isCutaway
        ? (45 + openDeg / 2) * DEG2RAD
        : 0;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const pushVertex = (
    px: number,
    py: number,
    pz: number,
    nx: number,
    ny: number,
    nz: number,
    u: number,
    v: number,
  ): number => {
    const idx = positions.length / 3;
    positions.push(px, py, pz);
    normals.push(nx, ny, nz);
    uvs.push(u, v);
    return idx;
  };

  const thetas: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const frac = i / segs;
    thetas.push(
      isCutaway
        ? thetaStart + frac * sweepRad
        : thetaStart + (i === segs ? 0 : frac * Math.PI * 2),
    );
  }

  // Helper: normalize tapered wall normal components
  const outerSlopeX = -(roB - roA);
  const outerNormLen = Math.hypot(outerSlopeX, length) || 1;
  const outerNx = outerSlopeX / outerNormLen;
  const outerNr = length / outerNormLen;

  const innerSlopeX = riB - riA;
  const innerNormLen = Math.hypot(innerSlopeX, length) || 1;
  const innerNx = innerSlopeX / innerNormLen;
  const innerNr = -length / innerNormLen;

  // 1. Outer curved wall (outward normal)
  const outerStartIdx = positions.length / 3;
  for (let i = 0; i <= segs; i++) {
    const t = thetas[i] ?? 0;
    const s = Math.sin(t);
    const c = Math.cos(t);
    const u = i / segs;
    pushVertex(xA, roA * s, roA * c, outerNx, outerNr * s, outerNr * c, u, 0);
    pushVertex(xB, roB * s, roB * c, outerNx, outerNr * s, outerNr * c, u, 1);
  }
  for (let i = 0; i < segs; i++) {
    const a = outerStartIdx + i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, d, a, d, c);
  }

  // 2. Inner curved wall (inward normal)
  const innerStartIdx = positions.length / 3;
  for (let i = 0; i <= segs; i++) {
    const t = thetas[i] ?? 0;
    const s = Math.sin(t);
    const c = Math.cos(t);
    const u = i / segs;
    pushVertex(xA, riA * s, riA * c, innerNx, innerNr * s, innerNr * c, u, 0);
    pushVertex(xB, riB * s, riB * c, innerNx, innerNr * s, innerNr * c, u, 1);
  }
  for (let i = 0; i < segs; i++) {
    const a = innerStartIdx + i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, d, b, a, c, d);
  }

  // 3. Start annular end rim at x = xA (normal = -X)
  const startRimIdx = positions.length / 3;
  for (let i = 0; i <= segs; i++) {
    const t = thetas[i] ?? 0;
    const s = Math.sin(t);
    const c = Math.cos(t);
    const u = i / segs;
    pushVertex(xA, riA * s, riA * c, -1, 0, 0, u, 0);
    pushVertex(xA, roA * s, roA * c, -1, 0, 0, u, 1);
  }
  for (let i = 0; i < segs; i++) {
    const in0 = startRimIdx + i * 2;
    const out0 = in0 + 1;
    const in1 = in0 + 2;
    const out1 = in0 + 3;
    indices.push(in0, out0, out1, in0, out1, in1);
  }

  // 4. End annular end rim at x = xB (normal = +X)
  const endRimIdx = positions.length / 3;
  for (let i = 0; i <= segs; i++) {
    const t = thetas[i] ?? 0;
    const s = Math.sin(t);
    const c = Math.cos(t);
    const u = i / segs;
    pushVertex(xB, riB * s, riB * c, 1, 0, 0, u, 0);
    pushVertex(xB, roB * s, roB * c, 1, 0, 0, u, 1);
  }
  for (let i = 0; i < segs; i++) {
    const in0 = endRimIdx + i * 2;
    const out0 = in0 + 1;
    const in1 = in0 + 2;
    const out1 = in0 + 3;
    indices.push(in0, out1, out0, in0, in1, out1);
  }

  // 5 & 6. Closed longitudinal cut faces if cutaway is open
  if (isCutaway) {
    // Cut face 1 at thetaStart: outward normal points in -theta = (0, -cos, sin)
    const t0 = thetas[0] ?? thetaStart;
    const s0 = Math.sin(t0);
    const c0 = Math.cos(t0);
    const f1aIn = pushVertex(xA, riA * s0, riA * c0, 0, -c0, s0, 0, 0);
    const f1bIn = pushVertex(xB, riB * s0, riB * c0, 0, -c0, s0, 1, 0);
    const f1bOut = pushVertex(xB, roB * s0, roB * c0, 0, -c0, s0, 1, 1);
    const f1aOut = pushVertex(xA, roA * s0, roA * c0, 0, -c0, s0, 0, 1);
    indices.push(f1aIn, f1bIn, f1bOut, f1aIn, f1bOut, f1aOut);

    // Cut face 2 at thetaEnd: outward normal points in +theta = (0, cos, -sin)
    const t1 = thetas[segs] ?? thetaStart + sweepRad;
    const s1 = Math.sin(t1);
    const c1 = Math.cos(t1);
    const f2aIn = pushVertex(xA, riA * s1, riA * c1, 0, c1, -s1, 0, 0);
    const f2bIn = pushVertex(xB, riB * s1, riB * c1, 0, c1, -s1, 1, 0);
    const f2bOut = pushVertex(xB, roB * s1, roB * c1, 0, c1, -s1, 1, 1);
    const f2aOut = pushVertex(xA, roA * s1, roA * c1, 0, c1, -s1, 0, 1);
    indices.push(f2aIn, f2bOut, f2bIn, f2aIn, f2aOut, f2bOut);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);

  const axis = opts.axis ?? "x";
  if (axis === "y") {
    // Rotate +X -> +Y and align cutaway opening to +15° in XZ (+Z/+X toward hero camera,
    // matching glassVessel, liquidVolume, and gasVolume cut planes).
    geo.rotateZ(Math.PI / 2);
    geo.rotateY(Math.PI / 3);
  } else if (axis === "z") {
    // Rotate +X -> +Z with cutaway opening facing +X/+Y toward the hero camera.
    geo.rotateY(-Math.PI / 2);
    geo.rotateZ(-Math.PI / 2);
  }

  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

export function cutawayCylinder(opts: CutawayCylinderOptions): THREE.Group {
  const group = new THREE.Group();
  group.name = "cutawayCylinder";

  const geo = buildCutawayCylinderGeometry(opts);
  const mat = createClayMaterial(opts.tone ?? "clayLight", {
    metalness: opts.metalness,
    roughness: opts.roughness,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "cutawayCylinder_shell";
  configureSolidMesh(mesh, opts.edgeThresholdDeg ?? 26);

  group.add(mesh);
  group.userData.shellMesh = mesh;
  return group;
}

/* -------------------------------------------------------------------------- */
/*  Primitive 2: bladeRing                                                    */
/* -------------------------------------------------------------------------- */

export interface BladeRingOptions {
  rHub: number;
  rTip: number;
  blades: number;
  chord?: number;
  thick?: number;
  twistDeg?: number;
  pitchDeg?: number;
  noseLen?: number;
  x?: number;
  hubLength?: number;
  tone?: MonochromeKey;
  hubTone?: MonochromeKey;
}

/**
 * Build a single 3D twisted airfoil blade geometry extending radially along +Y
 * from `rRoot` to `rTip`, with closed root and tip caps.
 */
function buildTwistedAirfoilBladeGeometry(
  rRoot: number,
  rTip: number,
  chord: number,
  thick: number,
  pitchDeg: number,
  twistDeg: number,
): THREE.BufferGeometry {
  const spanSteps = 8;
  const halfProfile = 7; // 14-point closed loop around airfoil
  const ringPts = halfProfile * 2;

  // Build normalized airfoil cross-section coordinates (u in [-0.5, 0.5], v thickness)
  const profU: number[] = [];
  const profV: number[] = [];

  const nacaHalfThickness = (tNorm: number): number => {
    const x = Math.max(0, Math.min(1, tNorm));
    return (
      5 *
      (0.2969 * Math.sqrt(x) -
        0.126 * x -
        0.3516 * x * x +
        0.2843 * x * x * x -
        0.1015 * x * x * x * x)
    );
  };
  const camberLine = (tNorm: number): number => {
    const x = Math.max(0, Math.min(1, tNorm));
    return 0.065 * 4 * x * (1 - x);
  };

  // Upper surface from leading edge (0) to trailing edge (1)
  for (let j = 0; j < halfProfile; j++) {
    const frac = j / halfProfile;
    const tNorm = 0.5 * (1 - Math.cos(Math.PI * frac)); // cosine spacing for crisp LE/TE
    const halfT = Math.max(0.08, nacaHalfThickness(tNorm));
    profU.push(tNorm - 0.5);
    profV.push(camberLine(tNorm) + halfT * 0.5);
  }
  // Lower surface from trailing edge (1) back to leading edge (0)
  for (let j = 0; j < halfProfile; j++) {
    const frac = j / halfProfile;
    const tNorm = 0.5 * (1 + Math.cos(Math.PI * frac));
    const halfT = Math.max(0.08, nacaHalfThickness(tNorm));
    profU.push(tNorm - 0.5);
    profV.push(camberLine(tNorm) - halfT * 0.5);
  }

  const positions: number[] = [];
  const indices: number[] = [];

  const sampleStation = (u: number): [number, number, number][] => {
    const r = rRoot + (rTip - rRoot) * u;
    const localChord = chord * (0.86 + 0.2 * Math.sin(u * Math.PI) - 0.06 * u);
    const localThick = thick * (1.15 - 0.5 * u);
    const angle = (pitchDeg + twistDeg * u) * DEG2RAD;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const pts: [number, number, number][] = [];

    for (let j = 0; j < ringPts; j++) {
      const lx = (profU[j] ?? 0) * localChord;
      const lz = (profV[j] ?? 0) * localThick;
      const wx = lx * cosA - lz * sinA;
      const wz = lx * sinA + lz * cosA;
      pts.push([wx, r, wz]);
    }
    return pts;
  };

  const rings: number[][] = [];
  for (let i = 0; i <= spanSteps; i++) {
    const u = i / spanSteps;
    const pts = sampleStation(u);
    const row: number[] = [];
    for (const pt of pts) {
      row.push(positions.length / 3);
      positions.push(pt[0], pt[1], pt[2]);
    }
    rings.push(row);
  }

  // Stitch side loft quads
  for (let i = 0; i < spanSteps; i++) {
    const rowA = rings[i];
    const rowB = rings[i + 1];
    if (!rowA || !rowB) continue;
    for (let j = 0; j < ringPts; j++) {
      const jNext = (j + 1) % ringPts;
      const a = rowA[j]!;
      const b = rowA[jNext]!;
      const c = rowB[j]!;
      const d = rowB[jNext]!;
      indices.push(a, c, d, a, d, b);
    }
  }

  // Cap root (normal -Y)
  const rootPts = sampleStation(0);
  const rootCenterIdx = positions.length / 3;
  let rcx = 0;
  let rcz = 0;
  for (const pt of rootPts) {
    rcx += pt[0];
    rcz += pt[2];
  }
  positions.push(rcx / ringPts, rRoot, rcz / ringPts);
  const rootRingStart = positions.length / 3;
  for (const pt of rootPts) {
    positions.push(pt[0], pt[1], pt[2]);
  }
  for (let j = 0; j < ringPts; j++) {
    const jNext = (j + 1) % ringPts;
    indices.push(rootCenterIdx, rootRingStart + j, rootRingStart + jNext);
  }

  // Cap tip (normal +Y)
  const tipPts = sampleStation(1);
  const tipCenterIdx = positions.length / 3;
  let tcx = 0;
  let tcz = 0;
  for (const pt of tipPts) {
    tcx += pt[0];
    tcz += pt[2];
  }
  positions.push(tcx / ringPts, rTip, tcz / ringPts);
  const tipRingStart = positions.length / 3;
  for (const pt of tipPts) {
    positions.push(pt[0], pt[1], pt[2]);
  }
  for (let j = 0; j < ringPts; j++) {
    const jNext = (j + 1) % ringPts;
    indices.push(tipCenterIdx, tipRingStart + jNext, tipRingStart + j);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Create a 3D pitched, twisted airfoil-profiled bladed rotor around the X-axis,
 * complete with turned hub and optional aerodynamic spinner nose cone.
 */
export function bladeRing(opts: BladeRingOptions): THREE.Group {
  const group = new THREE.Group();
  group.name = "bladeRing";
  group.position.x = opts.x ?? 0;

  const rHub = Math.max(0.04, opts.rHub);
  const rTip = Math.max(rHub + 0.05, opts.rTip);
  const bladeCount = Math.max(1, Math.round(opts.blades));
  const span = rTip - rHub;
  const chord = opts.chord ?? span * 0.42;
  const thick = opts.thick ?? chord * 0.14;
  const twistDeg = opts.twistDeg ?? 32;
  const pitchDeg = opts.pitchDeg ?? 22;
  const hubLength = opts.hubLength ?? chord * 1.15;

  // Turned hub along X-axis
  const hubGeo = new THREE.CylinderGeometry(rHub, rHub, hubLength, 32);
  hubGeo.rotateZ(Math.PI / 2);
  const hubMat = createClayMaterial(opts.hubTone ?? "clayDark", {
    roughness: 0.52,
    metalness: 0.26,
  });
  const hubMesh = new THREE.Mesh(hubGeo, hubMat);
  hubMesh.name = "bladeRing_hub";
  configureSolidMesh(hubMesh, 22);
  group.add(hubMesh);

  // Optional aerodynamic ogive spinner nose cone pointing toward -X
  let spinnerMesh: THREE.Mesh | null = null;
  if (opts.noseLen && opts.noseLen > 0) {
    const noseLen = opts.noseLen;
    const lathePts: THREE.Vector2[] = [];
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps; // 0 = tip, 1 = hub base
      const y = t * noseLen;
      // Smooth aerodynamic tangent-ogive / parabolic profile
      const radius = rHub * Math.pow(t, 0.62);
      lathePts.push(new THREE.Vector2(Math.max(0.001, radius), y));
    }
    const spinnerGeo = new THREE.LatheGeometry(lathePts, 32);
    // LatheGeometry revolves around +Y (tip at y=0, base at y=noseLen).
    // Rotate -90° around Z so tip is at x = -noseLen and base sits flush at x = 0.
    spinnerGeo.rotateZ(-Math.PI / 2);
    spinnerGeo.translate(-hubLength / 2 - noseLen, 0, 0);
    // Wait: let's verify coordinates!
    // Under rotateZ(-PI/2): (x, y, z) -> (y, -x, z).
    // So y=0 (tip) -> x=0, and y=noseLen (base) -> x=+noseLen!
    // Translating by x = -hubLength/2 - noseLen puts tip at -hubLength/2 - noseLen
    // and base at -hubLength/2 (flush with front of hub!).
    spinnerGeo.computeVertexNormals();
    const spinnerMat = createClayMaterial(opts.hubTone ?? "clayDark", {
      roughness: 0.44,
      metalness: 0.3,
    });
    spinnerMesh = new THREE.Mesh(spinnerGeo, spinnerMat);
    spinnerMesh.name = "bladeRing_spinner";
    configureSolidMesh(spinnerMesh, 24);
    group.add(spinnerMesh);
  }

  // Twisted airfoil blades
  const bladeGeo = buildTwistedAirfoilBladeGeometry(
    rHub * 0.94,
    rTip,
    chord,
    thick,
    pitchDeg,
    twistDeg,
  );
  const bladeMat = createClayMaterial(opts.tone ?? "clayLight", {
    roughness: 0.68,
    metalness: 0.14,
  });

  const bladeMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < bladeCount; i++) {
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.name = `bladeRing_blade_${i}`;
    blade.rotation.x = (i / bladeCount) * Math.PI * 2;
    configureSolidMesh(blade, 24);
    group.add(blade);
    bladeMeshes.push(blade);
  }

  group.userData.bladeMeshes = bladeMeshes;
  group.userData.hubMesh = hubMesh;
  group.userData.spinnerMesh = spinnerMesh;
  return group;
}

/* -------------------------------------------------------------------------- */
/*  Primitive 3: shaft & pipe                                                 */
/* -------------------------------------------------------------------------- */

export interface ShaftOptions {
  length: number;
  r: number;
  x0?: number;
  tone?: MonochromeKey;
  collars?: number;
  metalness?: number;
  roughness?: number;
}

/**
 * Sleek turned coaxial drive shaft along the X-axis with beveled collar rings.
 */
export function shaft(opts: ShaftOptions): THREE.Group {
  const group = new THREE.Group();
  group.name = "shaft";

  const length = Math.max(1e-3, opts.length);
  const r = Math.max(1e-3, opts.r);
  const x0 = opts.x0 ?? -length / 2;
  const xCenter = x0 + length / 2;

  const mat = createClayMaterial(opts.tone ?? "graphite", {
    roughness: opts.roughness ?? 0.42,
    metalness: opts.metalness ?? 0.35,
  });

  const barGeo = new THREE.CylinderGeometry(r, r, length, 28);
  barGeo.rotateZ(Math.PI / 2);
  barGeo.translate(xCenter, 0, 0);
  const barMesh = new THREE.Mesh(barGeo, mat);
  barMesh.name = "shaft_core";
  configureSolidMesh(barMesh, 20);
  group.add(barMesh);

  const collarCount = Math.max(0, Math.round(opts.collars ?? 2));
  if (collarCount > 0) {
    const collarR = r * 1.38;
    const collarW = Math.min(length * 0.08, r * 1.4);
    const bevel = collarW * 0.22;
    const profile = [
      new THREE.Vector2(r * 0.98, -collarW / 2),
      new THREE.Vector2(collarR - bevel, -collarW / 2),
      new THREE.Vector2(collarR, -collarW / 2 + bevel),
      new THREE.Vector2(collarR, collarW / 2 - bevel),
      new THREE.Vector2(collarR - bevel, collarW / 2),
      new THREE.Vector2(r * 0.98, collarW / 2),
    ];
    const collarGeo = new THREE.LatheGeometry(profile, 28);
    collarGeo.rotateZ(Math.PI / 2);
    const collarMat = createClayMaterial("clayDark", {
      roughness: 0.48,
      metalness: 0.32,
    });

    for (let i = 0; i < collarCount; i++) {
      const frac =
        collarCount === 1 ? 0.5 : 0.14 + (0.72 * i) / (collarCount - 1);
      const collar = new THREE.Mesh(collarGeo, collarMat);
      collar.name = `shaft_collar_${i}`;
      collar.position.x = x0 + length * frac;
      configureSolidMesh(collar, 20);
      group.add(collar);
    }
  }

  return group;
}

export interface PipeOptions {
  points: [number, number, number][];
  r: number;
  tone?: MonochromeKey;
  tubularSegments?: number;
  radialSegments?: number;
  metalness?: number;
  roughness?: number;
  flanges?: boolean;
}

/**
 * Smooth 3D TubeGeometry conduit along a Catmull-Rom curve with optional
 * machined end flanges.
 */
export function pipe(opts: PipeOptions): THREE.Group {
  const group = new THREE.Group();
  group.name = "pipe";

  if (opts.points.length < 2) {
    throw new Error("pipe() requires at least 2 control points.");
  }

  const r = Math.max(1e-3, opts.r);
  const vecs = opts.points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(vecs, false, "catmullrom", 0.35);

  const tubeGeo = new THREE.TubeGeometry(
    curve,
    Math.max(8, opts.tubularSegments ?? 48),
    r,
    Math.max(8, opts.radialSegments ?? 16),
    false,
  );
  const mat = createClayMaterial(opts.tone ?? "clayMid", {
    roughness: opts.roughness ?? 0.52,
    metalness: opts.metalness ?? 0.24,
  });

  const tubeMesh = new THREE.Mesh(tubeGeo, mat);
  tubeMesh.name = "pipe_tube";
  configureSolidMesh(tubeMesh, 28);
  group.add(tubeMesh);

  if (opts.flanges !== false) {
    const flangeGeo = new THREE.CylinderGeometry(r * 1.35, r * 1.35, r * 0.55, 16);
    const flangeMat = createClayMaterial("graphite", {
      roughness: 0.44,
      metalness: 0.34,
    });
    const up = new THREE.Vector3(0, 1, 0);

    for (const [idx, t] of [
      [0, 0],
      [1, 1],
    ] as const) {
      const pt = curve.getPoint(t);
      const tangent = curve.getTangent(t).normalize();
      const flange = new THREE.Mesh(flangeGeo, flangeMat);
      flange.name = `pipe_flange_${idx}`;
      flange.position.copy(pt);
      flange.quaternion.setFromUnitVectors(up, tangent);
      configureSolidMesh(flange, 22);
      group.add(flange);
    }
  }

  return group;
}

/* -------------------------------------------------------------------------- */
/*  Primitive 4: spring                                                       */
/* -------------------------------------------------------------------------- */

export interface SpringOptions {
  r: number;
  length: number;
  turns: number;
  wireR?: number;
  axis?: "x" | "y" | "z";
  tone?: MonochromeKey;
  tubularSegments?: number;
  radialSegments?: number;
}

class HelixCurve extends THREE.Curve<THREE.Vector3> {
  private readonly radius: number;
  private readonly length: number;
  private readonly turns: number;

  constructor(radius: number, length: number, turns: number) {
    super();
    this.radius = radius;
    this.length = length;
    this.turns = turns;
  }

  override getPoint(t: number, optionalTarget = new THREE.Vector3()): THREE.Vector3 {
    const angle = t * this.turns * Math.PI * 2;
    const y = (t - 0.5) * this.length;
    const x = Math.cos(angle) * this.radius;
    const z = Math.sin(angle) * this.radius;
    return optionalTarget.set(x, y, z);
  }
}

/**
 * True 3D helical spring constructed via TubeGeometry with spherical wire caps.
 */
export function spring(opts: SpringOptions): THREE.Group {
  const group = new THREE.Group();
  group.name = "spring";

  const r = Math.max(1e-3, opts.r);
  const length = Math.max(1e-3, opts.length);
  const turns = Math.max(1, opts.turns);
  const wireR =
    opts.wireR ?? Math.max(1e-3, Math.min(r * 0.16, length / (turns * 3.5)));

  const curve = new HelixCurve(r, length, turns);
  const tubularSegs = Math.max(32, opts.tubularSegments ?? Math.round(turns * 28));
  const radialSegs = Math.max(8, opts.radialSegments ?? 12);

  const geo = new THREE.TubeGeometry(curve, tubularSegs, wireR, radialSegs, false);
  const mat = createClayMaterial(opts.tone ?? "graphite", {
    roughness: 0.42,
    metalness: 0.35,
  });

  const springGroup = new THREE.Group();
  const coilMesh = new THREE.Mesh(geo, mat);
  coilMesh.name = "spring_coil";
  configureSolidMesh(coilMesh, 32);
  springGroup.add(coilMesh);

  // Clean hemispherical end caps
  const capGeo = new THREE.SphereGeometry(wireR, radialSegs, 8);
  for (const [idx, t] of [
    [0, 0],
    [1, 1],
  ] as const) {
    const cap = new THREE.Mesh(capGeo, mat);
    cap.name = `spring_cap_${idx}`;
    cap.position.copy(curve.getPoint(t));
    cap.castShadow = true;
    cap.receiveShadow = true;
    springGroup.add(cap);
  }

  const axis = opts.axis ?? "y";
  if (axis === "x") {
    springGroup.rotation.z = -Math.PI / 2;
  } else if (axis === "z") {
    springGroup.rotation.x = Math.PI / 2;
  }

  group.add(springGroup);
  return group;
}

/* -------------------------------------------------------------------------- */
/*  Primitive 5: gear                                                         */
/* -------------------------------------------------------------------------- */

export interface GearOptions {
  teeth: number;
  module: number;
  thickness: number;
  boreR?: number;
  axis?: "x" | "y" | "z";
  tone?: MonochromeKey;
  bevel?: number;
}

/**
 * Extruded 3D spur gear with involute-style tooth geometry, bevels, central
 * bore hole, and crisp architectural edges.
 */
export function gear(opts: GearOptions): THREE.Group {
  const group = new THREE.Group();
  group.name = "gear";

  const teeth = Math.max(6, Math.round(opts.teeth));
  const mod = Math.max(1e-3, opts.module);
  const thickness = Math.max(1e-3, opts.thickness);

  const rPitch = (teeth * mod) / 2;
  const rOut = rPitch + mod * 0.95;
  const rRoot = Math.max(mod * 0.8, rPitch - mod * 1.2);
  const boreR = opts.boreR ?? rRoot * 0.38;

  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;

  for (let i = 0; i < teeth; i++) {
    const a0 = i * step;
    // Involute-style symmetric tooth angular fractions
    const aRootStart = a0;
    const aFlankBotL = a0 + step * 0.16;
    const aPitchL = a0 + step * 0.24;
    const aTipL = a0 + step * 0.31;
    const aTipR = a0 + step * 0.49;
    const aPitchR = a0 + step * 0.56;
    const aFlankBotR = a0 + step * 0.64;
    const aRootEnd = a0 + step * 0.84;

    const pt = (r: number, a: number): [number, number] => [
      Math.cos(a) * r,
      Math.sin(a) * r,
    ];

    const p0 = pt(rRoot, aRootStart);
    if (i === 0) {
      shape.moveTo(p0[0], p0[1]);
    } else {
      shape.lineTo(p0[0], p0[1]);
    }
    const p1 = pt(rRoot, aFlankBotL);
    const p2 = pt(rPitch, aPitchL);
    const p3 = pt(rOut, aTipL);
    const p4 = pt(rOut, aTipR);
    const p5 = pt(rPitch, aPitchR);
    const p6 = pt(rRoot, aFlankBotR);
    const p7 = pt(rRoot, aRootEnd);

    shape.lineTo(p1[0], p1[1]);
    shape.lineTo(p2[0], p2[1]);
    shape.lineTo(p3[0], p3[1]);
    shape.lineTo(p4[0], p4[1]);
    shape.lineTo(p5[0], p5[1]);
    shape.lineTo(p6[0], p6[1]);
    shape.lineTo(p7[0], p7[1]);
  }
  shape.closePath();

  if (boreR > 1e-4 && boreR < rRoot * 0.9) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, boreR, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }

  const bevelSize = Math.min(
    opts.bevel ?? Math.min(thickness * 0.12, mod * 0.14),
    thickness * 0.25,
    mod * 0.22,
  );
  const depth = Math.max(1e-4, thickness - bevelSize * 2);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevelSize > 1e-5,
    bevelThickness: bevelSize,
    bevelSize,
    bevelSegments: 2,
    curveSegments: 16,
  });
  geo.translate(0, 0, -depth / 2);

  const axis = opts.axis ?? "z";
  if (axis === "x") {
    geo.rotateY(Math.PI / 2);
  } else if (axis === "y") {
    geo.rotateX(Math.PI / 2);
  }
  geo.computeVertexNormals();

  const mat = createClayMaterial(opts.tone ?? "clayMid", {
    roughness: 0.52,
    metalness: 0.28,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "gear_body";
  configureSolidMesh(mesh, 18);
  group.add(mesh);

  return group;
}

/* -------------------------------------------------------------------------- */
/*  Primitive 6: combustorRing                                                */
/* -------------------------------------------------------------------------- */

export interface CombustorRingOptions {
  rInner: number;
  rOuter: number;
  length: number;
  cans?: number;
  x?: number;
  tone?: MonochromeKey;
  openDeg?: number;
}

/**
 * Annular burner casing with individual fuel-injector nozzles and inner
 * emissive flame cores exposed via `group.userData.flameMeshes`.
 */
export function combustorRing(opts: CombustorRingOptions): THREE.Group {
  const group = new THREE.Group();
  group.name = "combustorRing";
  group.position.x = opts.x ?? 0;

  const rInner = Math.max(0.05, opts.rInner);
  const rOuter = Math.max(rInner + 0.08, opts.rOuter);
  const length = Math.max(0.1, opts.length);
  const cans = Math.max(1, Math.round(opts.cans ?? 8));
  const wallT = Math.max(0.02, (rOuter - rInner) * 0.14);
  const openDeg = opts.openDeg ?? 135;

  // Outer & inner annular combustor liner shells
  const outerLiner = cutawayCylinder({
    length,
    rOuter,
    rInner: Math.max(rInner + wallT, rOuter - wallT),
    openDeg,
    x0: -length / 2,
    tone: opts.tone ?? "clayDark",
    roughness: 0.62,
    metalness: 0.22,
    segments: 40,
  });
  outerLiner.name = "combustor_outerLiner";
  group.add(outerLiner);

  const innerLiner = cutawayCylinder({
    length: length * 0.94,
    rOuter: Math.min(rOuter - wallT, rInner + wallT),
    rInner,
    openDeg,
    x0: -(length * 0.94) / 2,
    tone: "graphite",
    roughness: 0.56,
    metalness: 0.28,
    segments: 36,
  });
  innerLiner.name = "combustor_innerLiner";
  group.add(innerLiner);

  // Fuel injector nozzles + inner glowing flame cores
  const rMid = (rInner + rOuter) * 0.5;
  const annulusH = rOuter - rInner - wallT * 2;
  const nozzleR = Math.max(0.025, annulusH * 0.26);
  const flameR = Math.max(0.03, annulusH * 0.34);
  const flameLen = length * 0.68;

  const nozzleGeo = new THREE.CylinderGeometry(
    nozzleR * 0.72,
    nozzleR,
    length * 0.24,
    14,
  );
  nozzleGeo.rotateZ(Math.PI / 2);
  const nozzleMat = createClayMaterial("graphite", {
    roughness: 0.42,
    metalness: 0.35,
  });

  // Sculpted volumetric flame plume geometry pointing +X (UV.y = 0 at injector -> 1 at tip)
  const flameProfile: THREE.Vector2[] = [];
  const fSteps = 18;
  for (let i = 0; i <= fSteps; i++) {
    const t = i / fSteps;
    const rad = Math.max(
      0.002,
      flameR * 1.28 * Math.sin(Math.pow(t, 0.52) * Math.PI),
    );
    flameProfile.push(new THREE.Vector2(rad, t * flameLen * 1.12));
  }
  const flameGeo = new THREE.LatheGeometry(flameProfile, 24);
  flameGeo.rotateZ(-Math.PI / 2); // +Y -> +X

  const flameVertexShader = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormalView;
    varying vec3 vViewPos;
    uniform float uTime;
    uniform float uPhase;
    uniform float uIntensity;
    void main() {
      vUv = uv;
      vec3 displaced = position;
      float tip = smoothstep(0.12, 0.95, uv.y);
      float wobble = sin(uv.y * 14.0 - uTime * 11.0 + uPhase) * 0.018 * tip * uIntensity;
      float wobble2 = cos(uv.y * 9.5 - uTime * 8.0 + uPhase * 1.7) * 0.014 * tip * uIntensity;
      displaced.y += wobble;
      displaced.z += wobble2;
      vec4 mvPos = modelViewMatrix * vec4(displaced, 1.0);
      vViewPos = -mvPos.xyz;
      vNormalView = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * mvPos;
    }
  `;

  const flameFragmentShader = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormalView;
    varying vec3 vViewPos;
    uniform float uTime;
    uniform float uPhase;
    uniform float uIntensity;
    uniform float uOpacity;
    void main() {
      float axial = clamp(vUv.y, 0.0, 1.0);
      vec3 n = normalize(vNormalView);
      // Orthographic Fresnel edge falloff: incandescent white-gold heart, fiery amber body, feathered ember tail
      float coreMask = pow(clamp(abs(n.z), 0.0, 1.0), 0.92);
      float wisp = 0.76 + 0.24 * sin(axial * 20.0 - uTime * 14.0 + uPhase + vUv.x * 12.566);
      float wisp2 = 0.85 + 0.15 * cos(axial * 11.0 - uTime * 9.0 + uPhase * 2.1);

      // Physical jet-fuel flame thermal gradient: incandescent gold-white -> vivid jet amber -> deep crimson-ember tail
      vec3 cWhiteGold = vec3(1.0, 0.94, 0.72);
      vec3 cAmber = vec3(1.0, 0.44, 0.06);
      vec3 cEmber = vec3(0.88, 0.16, 0.04);
      vec3 col = mix(cWhiteGold, cAmber, smoothstep(0.05, 0.36, axial));
      col = mix(col, cEmber, smoothstep(0.36, 0.88, axial));
      // Incandescent heart only right at injector core center
      col = mix(col, cWhiteGold, pow(coreMask, 2.6) * (1.0 - smoothstep(0.08, 0.48, axial)) * 0.68);

      float headFade = smoothstep(0.0, 0.10, axial);
      float tailFade = 1.0 - smoothstep(0.56, 1.0, axial);
      float alpha = coreMask * headFade * tailFade * wisp * wisp2 * uOpacity * clamp(0.56 + 0.50 * uIntensity, 0.32, 1.25);
      if (alpha < 0.01) discard;
      gl_FragColor = vec4(col * (0.96 + 0.28 * uIntensity), clamp(alpha, 0.0, 0.96));
    }
  `;

  const flameMeshes: THREE.Mesh[] = [];

  for (let i = 0; i < cans; i++) {
    const theta = (i / cans) * Math.PI * 2;
    const cy = Math.sin(theta) * rMid;
    const cz = Math.cos(theta) * rMid;

    const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzle.name = `combustor_nozzle_${i}`;
    nozzle.position.set(-length * 0.36, cy, cz);
    configureSolidMesh(nozzle, 24);
    group.add(nozzle);

    const flameMat = new THREE.ShaderMaterial({
      vertexShader: flameVertexShader,
      fragmentShader: flameFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uPhase: { value: i * 1.37 },
        uIntensity: { value: 1.0 },
        uOpacity: { value: 0.92 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    flameMat.userData.isFlame = true;
    flameMat.userData.isShaderFlame = true;
    flameMat.userData.baseOpacity = 0.92;
    flameMat.userData.baseTransparent = true;

    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.name = `combustor_flame_${i}`;
    flame.position.set(-length * 0.25, cy, cz);
    flame.renderOrder = 5;
    flame.userData.isFlame = true;
    group.add(flame);
    flameMeshes.push(flame);
  }

  group.userData.flameMeshes = flameMeshes;
  return group;
}

/* -------------------------------------------------------------------------- */
/*  Primitive 7: baseMount                                                    */
/* -------------------------------------------------------------------------- */

export interface BaseMountOptions {
  y: number;
  radius?: number;
}

/**
 * Invisible ShadowMaterial shadow-catching floor plane + subtle ultra-minimal
 * ground contact ring to anchor floating CAD models in the museum studio.
 */
export function baseMount(opts: BaseMountOptions): THREE.Group {
  const group = new THREE.Group();
  group.name = "baseMount";
  group.userData.isBaseMount = true;

  const radius = Math.max(0.5, opts.radius ?? 6);
  const planeSize = radius * 4.5;

  // Whisper-soft directional catch plane (avoids harsh jagged off-screen shadow)
  const shadowGeo = new THREE.PlaneGeometry(planeSize, planeSize);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.ShadowMaterial({
    color: 0x1a1c20,
    opacity: 0.04,
    depthWrite: false,
  });
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.name = "baseMount_shadowPlane";
  shadowPlane.position.y = opts.y;
  shadowPlane.receiveShadow = true;
  group.add(shadowPlane);

  // Soft studio Gaussian radial contact shadow directly beneath the model
  const contactGeo = new THREE.PlaneGeometry(radius * 2.25, radius * 1.45);
  contactGeo.rotateX(-Math.PI / 2);
  const contactMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0x181a1f) },
      uOpacity: { value: 0.2 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform vec3 uColor;
      uniform float uOpacity;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r2 = dot(p, p);
        float alpha = exp(-r2 * 3.8) * smoothstep(1.0, 0.15, sqrt(r2)) * uOpacity;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const contactShadow = new THREE.Mesh(contactGeo, contactMat);
  contactShadow.name = "baseMount_contactShadow";
  contactShadow.position.y = opts.y + 0.001;
  contactShadow.renderOrder = 1;
  group.add(contactShadow);

  // Subtle architectural ground contact ring
  const ringPts: THREE.Vector3[] = [];
  const ringSegs = 96;
  for (let i = 0; i < ringSegs; i++) {
    const a = (i / ringSegs) * Math.PI * 2;
    ringPts.push(
      new THREE.Vector3(
        Math.cos(a) * radius,
        opts.y + 0.002,
        Math.sin(a) * radius,
      ),
    );
  }
  const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
  const ringMat = new THREE.LineBasicMaterial({
    color: ARCHITECTURAL_EDGE_COLOR,
    transparent: true,
    opacity: 0.09,
    depthWrite: false,
  });
  const ring = new THREE.LineLoop(ringGeo, ringMat);
  ring.name = "baseMount_ring";
  group.add(ring);

  group.userData.shadowMaterial = shadowMat;
  group.userData.contactMaterial = contactMat;
  group.userData.ringMaterial = ringMat;
  return group;
}

/* -------------------------------------------------------------------------- */
/*  Primitive 8: flowRibbon                                                   */
/* -------------------------------------------------------------------------- */

export interface FlowRibbonColorStops {
  start: AccentKey | number;
  mid?: AccentKey | number;
  end?: AccentKey | number;
  midAt?: number;
}

export interface FlowRibbonOptions {
  curves: [number, number, number][][];
  radius?: number;
  color: AccentKey | number;
  colorStops?: FlowRibbonColorStops;
  speed?: number;
  particleCount?: number;
  opacity?: number;
  swirlAmp?: number;
  swirlFreq?: number;
}

export interface FlowRibbonUpdateOptions {
  speedScale?: number;
  opacityScale?: number;
  radiusScale?: number;
  colorHex?: number;
}

export interface FlowRibbonHandle {
  group: THREE.Group;
  update(dt: number, opts?: FlowRibbonUpdateOptions): void;
}

interface FlowParticleState {
  curveIndex: number;
  phase: number;
  swirlPhase: number;
  radialScale: number;
  sizeScale: number;
}

function resolveAccentHex(color: AccentKey | number): number {
  return typeof color === "number" ? color : ACCENT_TOKENS[color];
}

/**
 * Build crossed orthogonal feathered aerodynamic ribbon strips along a 3D spline
 * using parallel-transport frames (zero Frenet twists, soft tapered ends).
 */
function buildAirRibbonGeometry(
  curve: THREE.CatmullRomCurve3,
  segments: number,
  halfWidth: number,
  curvePhase: number,
): THREE.BufferGeometry {
  const segs = Math.max(12, Math.round(segments));
  const vertsPerStrip = (segs + 1) * 2;
  const totalVerts = vertsPerStrip * 2; // 2 orthogonal crossed strips
  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const phases = new Float32Array(totalVerts);
  const indices: number[] = [];

  const points: THREE.Vector3[] = [];
  const tangents: THREE.Vector3[] = [];
  const normA: THREE.Vector3[] = [];
  const normB: THREE.Vector3[] = [];

  const upRef = new THREE.Vector3(0, 1, 0);
  const altRef = new THREE.Vector3(1, 0, 0);
  const prevN = new THREE.Vector3();
  const curN = new THREE.Vector3();
  const curB = new THREE.Vector3();

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPoint(t);
    const tan = curve.getTangent(t).normalize();
    points.push(p);
    tangents.push(tan);

    if (i === 0) {
      const ref = Math.abs(tan.dot(upRef)) > 0.9 ? altRef : upRef;
      prevN.crossVectors(tan, ref).normalize();
    } else {
      // Parallel transport previous normal onto plane perpendicular to new tangent
      curN.copy(prevN).addScaledVector(tan, -prevN.dot(tan));
      if (curN.lengthSq() < 1e-8) {
        const ref = Math.abs(tan.dot(upRef)) > 0.9 ? altRef : upRef;
        curN.crossVectors(tan, ref);
      }
      curN.normalize();
      prevN.copy(curN);
    }
    curB.crossVectors(tan, prevN).normalize();
    normA.push(prevN.clone());
    normB.push(curB.clone());
  }

  for (let strip = 0; strip < 2; strip++) {
    const vOffset = strip * vertsPerStrip;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const p = points[i]!;
      const side = strip === 0 ? normA[i]! : normB[i]!;
      const nrm = strip === 0 ? normB[i]! : normA[i]!;
      // Subtle aerodynamic width taper at intake & exhaust tips
      const endTaper = 0.68 + 0.32 * Math.sin(t * Math.PI);
      const w = halfWidth * endTaper;

      const idx0 = vOffset + i * 2;
      const idx1 = idx0 + 1;

      positions[idx0 * 3] = p.x - side.x * w;
      positions[idx0 * 3 + 1] = p.y - side.y * w;
      positions[idx0 * 3 + 2] = p.z - side.z * w;
      positions[idx1 * 3] = p.x + side.x * w;
      positions[idx1 * 3 + 1] = p.y + side.y * w;
      positions[idx1 * 3 + 2] = p.z + side.z * w;

      normals[idx0 * 3] = nrm.x;
      normals[idx0 * 3 + 1] = nrm.y;
      normals[idx0 * 3 + 2] = nrm.z;
      normals[idx1 * 3] = nrm.x;
      normals[idx1 * 3 + 1] = nrm.y;
      normals[idx1 * 3 + 2] = nrm.z;

      uvs[idx0 * 2] = t;
      uvs[idx0 * 2 + 1] = 0;
      uvs[idx1 * 2] = t;
      uvs[idx1 * 2 + 1] = 1;

      phases[idx0] = curvePhase;
      phases[idx1] = curvePhase;

      if (i < segs) {
        const a = idx0;
        const b = idx1;
        const c = idx0 + 2;
        const d = idx1 + 2;
        indices.push(a, b, d, a, d, c);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geo.setIndex(indices);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Feathered 3D aerodynamic airflow ribbons (pure wispy wind-tunnel currents with
 * smooth axial thermal color gradients) + fine luminous wind-mote speed streaks.
 */
export function flowRibbon(opts: FlowRibbonOptions): FlowRibbonHandle {
  const group = new THREE.Group();
  group.name = "flowRibbon";
  group.userData.isFlowRibbon = true;

  if (opts.curves.length === 0) {
    throw new Error("flowRibbon() requires at least one 3D curve.");
  }

  const baseHex = resolveAccentHex(opts.color);
  const hasColorStops = Boolean(opts.colorStops);
  const stopStartHex = opts.colorStops
    ? resolveAccentHex(opts.colorStops.start)
    : baseHex;
  const stopMidHex = opts.colorStops?.mid !== undefined
    ? resolveAccentHex(opts.colorStops.mid)
    : opts.colorStops
      ? stopStartHex
      : baseHex;
  const stopEndHex = opts.colorStops?.end !== undefined
    ? resolveAccentHex(opts.colorStops.end)
    : baseHex;
  const midStop = Math.max(
    0.08,
    Math.min(0.92, opts.colorStops?.midAt ?? 0.5),
  );

  const baseRadius = Math.max(0.005, opts.radius ?? 0.035);
  const baseSpeed = opts.speed ?? 0.55;
  const baseOpacity = opts.opacity ?? 0.28;
  const swirlAmp = opts.swirlAmp ?? baseRadius * 0.75;
  const swirlFreq = opts.swirlFreq ?? 3.0;

  const splineCurves: THREE.CatmullRomCurve3[] = opts.curves.map((pts, i) => {
    if (pts.length < 2) {
      throw new Error(`flowRibbon() curve ${i} requires at least 2 points.`);
    }
    return new THREE.CatmullRomCurve3(
      pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      false,
      "catmullrom",
      0.4,
    );
  });

  const cStart = new THREE.Color(stopStartHex);
  const cMid = new THREE.Color(stopMidHex);
  const cEnd = new THREE.Color(stopEndHex);

  const ribbonVertexShader = /* glsl */ `
    attribute float aPhase;
    varying vec2 vUv;
    varying float vPhase;
    void main() {
      vUv = uv;
      vPhase = aPhase;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const ribbonFragmentShader = /* glsl */ `
    varying vec2 vUv;
    varying float vPhase;
    uniform float uTime;
    uniform float uOpacity;
    uniform vec3 uColorStart;
    uniform vec3 uColorMid;
    uniform vec3 uColorEnd;
    uniform float uMidStop;
    void main() {
      float t = clamp(vUv.x, 0.0, 1.0);
      // Soft Gaussian cross-section: crisp airy core fading smoothly to invisible edges
      float across = abs(vUv.y - 0.5) * 2.0;
      float radial = exp(-across * across * 4.4);
      // Graceful axial intake & exhaust feathering
      float endFade = smoothstep(0.0, 0.14, t) * (1.0 - smoothstep(0.84, 1.0, t));

      // Multi-harmonic animated aerodynamic wind wisps
      float wisp1 = 0.52 + 0.48 * sin(t * 15.0 - uTime * 6.8 + vPhase * 6.28318);
      float wisp2 = 0.62 + 0.38 * sin(t * 27.0 - uTime * 10.6 - vPhase * 4.1);
      float streak = pow(max(0.0, wisp1 * wisp2), 0.72);
      float flowPattern = 0.30 + 0.70 * streak;

      // Smooth 3-stop axial thermal gradient: holds pure start color through intake,
      // warms cleanly through midStop, then shifts decisively into hot end color.
      float s1 = smoothstep(uMidStop * 0.52, uMidStop, t);
      float s2 = smoothstep(uMidStop, min(0.96, uMidStop + 0.22), t);
      vec3 col = mix(uColorStart, uColorMid, s1);
      col = mix(col, uColorEnd, s2);
      // Subtle luminous filament highlight right down the center of the air wisp
      col = mix(col, vec3(1.0), pow(radial, 2.8) * 0.24 * streak);

      float alpha = radial * endFade * flowPattern * uOpacity;
      if (alpha < 0.008) discard;
      gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.88));
    }
  `;

  const ribbonBaseOpacity = Math.min(0.88, baseOpacity * 1.95 + 0.12);
  const ribbonMat = new THREE.ShaderMaterial({
    vertexShader: ribbonVertexShader,
    fragmentShader: ribbonFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: ribbonBaseOpacity },
      uColorStart: { value: cStart.clone() },
      uColorMid: { value: cMid.clone() },
      uColorEnd: { value: cEnd.clone() },
      uMidStop: { value: midStop },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  ribbonMat.userData.isFlowRibbon = true;
  ribbonMat.userData.baseOpacity = ribbonBaseOpacity;
  ribbonMat.userData.baseTransparent = true;

  const ribbonHalfWidth = baseRadius * 2.55;
  const tubeMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < splineCurves.length; i++) {
    const curve = splineCurves[i]!;
    const ribbonGeo = buildAirRibbonGeometry(
      curve,
      84,
      ribbonHalfWidth,
      (i * 0.6180339887) % 1,
    );
    const ribbonMesh = new THREE.Mesh(ribbonGeo, ribbonMat);
    ribbonMesh.name = `flowRibbon_tube_${i}`;
    ribbonMesh.renderOrder = 3;
    ribbonMesh.userData.isFlowRibbon = true;
    group.add(ribbonMesh);
    tubeMeshes.push(ribbonMesh);
  }

  // Delicate animated wind-mote speed needles riding inside the feathered air ribbons
  const totalParticles = Math.max(
    splineCurves.length,
    Math.round(opts.particleCount ?? splineCurves.length * 8),
  );

  // Ultra-sleek aerodynamic speed filament aligned with +Y local axis
  const streakGeo = new THREE.SphereGeometry(baseRadius * 0.44, 8, 6);
  streakGeo.scale(0.45, 5.2, 0.45);

  const particleBaseOpacity = Math.min(0.76, baseOpacity * 1.65 + 0.16);
  const particleMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: particleBaseOpacity,
    depthWrite: false,
  });
  particleMat.userData.isFlowRibbon = true;
  particleMat.userData.baseOpacity = particleBaseOpacity;
  particleMat.userData.baseTransparent = true;

  const instanced = new THREE.InstancedMesh(
    streakGeo,
    particleMat,
    totalParticles,
  );
  instanced.name = "flowRibbon_particles";
  instanced.renderOrder = 4;
  instanced.frustumCulled = false;
  instanced.userData.isFlowRibbon = true;
  group.add(instanced);

  // Deterministic particle distribution across all curves
  const particles: FlowParticleState[] = [];
  for (let i = 0; i < totalParticles; i++) {
    const curveIndex = i % splineCurves.length;
    const indexInCurve = Math.floor(i / splineCurves.length);
    const countInCurve = Math.ceil(
      (totalParticles - curveIndex) / splineCurves.length,
    );
    particles.push({
      curveIndex,
      phase: (indexInCurve + ((curveIndex * 0.37) % 1)) / Math.max(1, countInCurve) % 1,
      swirlPhase: (i * 2.399963229728653) % (Math.PI * 2), // golden angle
      radialScale: 0.45 + 0.55 * ((i * 0.6180339887) % 1),
      sizeScale: 0.78 + 0.42 * (((i + 3) * 0.381966) % 1),
    });
  }

  // Reusable scratch math objects (zero GC churn at 60 fps)
  const pos = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const upVec = new THREE.Vector3(0, 1, 0);
  const altUp = new THREE.Vector3(1, 0, 0);
  const sideA = new THREE.Vector3();
  const sideB = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scaleVec = new THREE.Vector3();
  const mat4 = new THREE.Matrix4();
  const instColor = new THREE.Color();
  let flowTime = 0;

  const smoothstep = (e0: number, e1: number, x: number): number => {
    const t = Math.max(0, Math.min(1, (x - e0) / Math.max(1e-6, e1 - e0)));
    return t * t * (3 - 2 * t);
  };

  const update = (dt: number, updateOpts: FlowRibbonUpdateOptions = {}): void => {
    const safeDt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.25)) : 0;
    const speedScale = updateOpts.speedScale ?? 1;
    const opacityScale = Math.max(0, Math.min(2, updateOpts.opacityScale ?? 1));
    const radiusScale = Math.max(0.15, updateOpts.radiusScale ?? 1);

    flowTime += safeDt * baseSpeed * speedScale;
    (ribbonMat.uniforms.uTime as { value: number }).value = flowTime;

    if (updateOpts.colorHex !== undefined) {
      if (hasColorStops) {
        cEnd.setHex(updateOpts.colorHex);
        (ribbonMat.uniforms.uColorEnd as { value: THREE.Color }).value.copy(cEnd);
      } else {
        cStart.setHex(updateOpts.colorHex);
        cMid.setHex(updateOpts.colorHex);
        cEnd.setHex(updateOpts.colorHex);
        (ribbonMat.uniforms.uColorStart as { value: THREE.Color }).value.copy(cStart);
        (ribbonMat.uniforms.uColorMid as { value: THREE.Color }).value.copy(cMid);
        (ribbonMat.uniforms.uColorEnd as { value: THREE.Color }).value.copy(cEnd);
      }
    }

    const focusOpacity =
      typeof group.userData.focusOpacityScale === "number"
        ? group.userData.focusOpacityScale
        : 1;
    const revealAlpha =
      typeof group.userData.revealAlpha === "number"
        ? group.userData.revealAlpha
        : 1;
    const effOpacity = opacityScale * focusOpacity * revealAlpha;

    (ribbonMat.uniforms.uOpacity as { value: number }).value = Math.min(
      0.92,
      ribbonBaseOpacity * effOpacity,
    );
    particleMat.opacity = Math.min(
      0.85,
      (particleMat.userData.baseOpacity as number) * effOpacity,
    );

    const stretchZ = 0.85 + 0.5 * Math.min(2.5, Math.abs(speedScale));

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]!;
      p.phase = (((p.phase + safeDt * baseSpeed * speedScale) % 1) + 1) % 1;

      const curve = splineCurves[p.curveIndex]!;
      curve.getPoint(p.phase, pos);
      curve.getTangent(p.phase, tan).normalize();

      // Orthonormal frame around curve tangent for helical swirl
      const refUp = Math.abs(tan.dot(upVec)) > 0.92 ? altUp : upVec;
      sideA.crossVectors(tan, refUp).normalize();
      sideB.crossVectors(tan, sideA).normalize();

      const swirlAngle = p.swirlPhase + p.phase * Math.PI * 2 * swirlFreq;
      const offsetR = swirlAmp * p.radialScale * radiusScale;
      pos.addScaledVector(sideA, Math.cos(swirlAngle) * offsetR);
      pos.addScaledVector(sideB, Math.sin(swirlAngle) * offsetR);

      // Smooth fade-in and fade-out at ends of streamline
      const edgeTaper = Math.sin(p.phase * Math.PI);
      const s = p.sizeScale * radiusScale * (0.25 + 0.75 * edgeTaper);

      quat.setFromUnitVectors(upVec, tan);
      scaleVec.set(s, s * stretchZ, s);
      mat4.compose(pos, quat, scaleVec);
      instanced.setMatrixAt(i, mat4);

      // Match each wind mote's color to the exact axial thermal stop
      const s1 = smoothstep(midStop * 0.52, midStop, p.phase);
      const s2 = smoothstep(midStop, Math.min(0.96, midStop + 0.22), p.phase);
      instColor.copy(cStart).lerp(cMid, s1).lerp(cEnd, s2);
      instanced.setColorAt(i, instColor);
    }

    instanced.instanceMatrix.needsUpdate = true;
    if (instanced.instanceColor) {
      instanced.instanceColor.needsUpdate = true;
    }
  };

  // Seed initial matrices cleanly before first frame
  update(0);

  group.userData.tubeMeshes = tubeMeshes;
  group.userData.instancedMesh = instanced;

  return { group, update };
}

/* -------------------------------------------------------------------------- */
/*  Primitive 9: glassVessel                                                  */
/* -------------------------------------------------------------------------- */

export interface GlassVesselOptions {
  height: number;
  rOuter: number;
  rInner: number;
  rOuterTop?: number;
  rInnerTop?: number;
  y0?: number;
  openDeg?: number;
  startDeg?: number;
  neckHeight?: number;
  neckROuter?: number;
  neckRInner?: number;
  shoulderHeight?: number;
  baseThick?: number;
  opacity?: number;
  segments?: number;
  axis?: "y" | "x";
  color?: number;
  edgeThresholdDeg?: number;
}

/**
 * Build a watertight, thick-walled cutaway vessel along the Y-axis with solid
 * base disc, cylindrical or tapered body wall, optional tapered shoulder + neck,
 * and closed longitudinal cut faces. Cutaway opening defaults to facing +Z/+X.
 */
export function buildGlassVesselGeometry(
  opts: GlassVesselOptions,
): THREE.BufferGeometry {
  const height = Math.max(0.05, opts.height);
  const y0 = opts.y0 ?? 0;
  const rOuter = Math.max(0.04, opts.rOuter);
  const rInner = Math.max(0.01, Math.min(rOuter - 0.005, opts.rInner));
  const rOuterTop = Math.max(0.04, opts.rOuterTop ?? rOuter);
  const rInnerTop = Math.max(0.01, Math.min(rOuterTop - 0.005, opts.rInnerTop ?? rInner));
  const baseThick = Math.max(0.01, Math.min(height * 0.45, opts.baseThick ?? 0.14));

  const hasNeck = typeof opts.neckHeight === "number" && opts.neckHeight > 1e-3;
  const neckHeight = hasNeck ? opts.neckHeight! : 0;
  const neckROuter = hasNeck
    ? Math.max(0.03, Math.min(rOuterTop, opts.neckROuter ?? rOuterTop * 0.42))
    : rOuterTop;
  const neckRInner = hasNeck
    ? Math.max(
        0.01,
        Math.min(neckROuter - 0.005, opts.neckRInner ?? neckROuter * 0.72),
      )
    : rInnerTop;

  const openDeg = Math.max(0, Math.min(359, opts.openDeg ?? 125));
  const isCutaway = openDeg > 0.01;
  const sweepRad = (360 - openDeg) * DEG2RAD;
  const segs = Math.max(12, Math.round(opts.segments ?? 48));

  // Center cutaway opening at +15° in XZ (+Z/+X toward hero 3/4 cameras)
  const thetaStart =
    opts.startDeg !== undefined
      ? opts.startDeg * DEG2RAD
      : isCutaway
        ? (15 + openDeg / 2) * DEG2RAD
        : 0;

  const thetas: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const frac = i / segs;
    thetas.push(
      isCutaway
        ? thetaStart + frac * sweepRad
        : thetaStart + (i === segs ? 0 : frac * Math.PI * 2),
    );
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const pushVertex = (
    px: number,
    py: number,
    pz: number,
    nx: number,
    ny: number,
    nz: number,
    u: number,
    v: number,
  ): number => {
    const idx = positions.length / 3;
    positions.push(px, py, pz);
    normals.push(nx, ny, nz);
    uvs.push(u, v);
    return idx;
  };

  // Helper: add a revolved conical/cylindrical wall strip around Y
  // Cross-section: x = r * sin(t), z = r * cos(t). Outward normal when outward=true.
  const addRevolvedStrip = (
    yA: number,
    rA: number,
    yB: number,
    rB: number,
    outward: boolean,
  ): void => {
    const dy = yB - yA;
    const dr = rB - rA;
    const len = Math.hypot(dy, dr) || 1;
    // Outward normal for ascending wall (yA -> yB): nr = dy/len, ny = -dr/len
    const sign = outward ? 1 : -1;
    const nr = (sign * dy) / len;
    const ny = (-sign * dr) / len;

    const startIdx = positions.length / 3;
    for (let i = 0; i <= segs; i++) {
      const t = thetas[i] ?? 0;
      const s = Math.sin(t);
      const c = Math.cos(t);
      const u = i / segs;
      pushVertex(rA * s, yA, rA * c, nr * s, ny, nr * c, u, 0);
      pushVertex(rB * s, yB, rB * c, nr * s, ny, nr * c, u, 1);
    }
    for (let i = 0; i < segs; i++) {
      const a = startIdx + i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      if (outward) {
        indices.push(a, c, d, a, d, b);
      } else {
        indices.push(a, d, c, a, b, d);
      }
    }
  };

  // Helper: add a flat horizontal sector disc around Y at height y (r = 0..rMax)
  const addSectorDisc = (y: number, rMax: number, normalY: 1 | -1): void => {
    const centerIdx = pushVertex(0, y, 0, 0, normalY, 0, 0.5, 0.5);
    const rimStart = positions.length / 3;
    for (let i = 0; i <= segs; i++) {
      const t = thetas[i] ?? 0;
      const s = Math.sin(t);
      const c = Math.cos(t);
      pushVertex(rMax * s, y, rMax * c, 0, normalY, 0, 0.5 + 0.5 * s, 0.5 + 0.5 * c);
    }
    for (let i = 0; i < segs; i++) {
      const r0 = rimStart + i;
      const r1 = rimStart + i + 1;
      if (normalY > 0) {
        indices.push(centerIdx, r0, r1);
      } else {
        indices.push(centerIdx, r1, r0);
      }
    }
  };

  // Helper: add a flat horizontal annular rim at height y (rIn..rOut)
  const addAnnularRim = (
    y: number,
    rIn: number,
    rOut: number,
    normalY: 1 | -1,
  ): void => {
    const rimStart = positions.length / 3;
    for (let i = 0; i <= segs; i++) {
      const t = thetas[i] ?? 0;
      const s = Math.sin(t);
      const c = Math.cos(t);
      const u = i / segs;
      pushVertex(rIn * s, y, rIn * c, 0, normalY, 0, u, 0);
      pushVertex(rOut * s, y, rOut * c, 0, normalY, 0, u, 1);
    }
    for (let i = 0; i < segs; i++) {
      const in0 = rimStart + i * 2;
      const out0 = in0 + 1;
      const in1 = in0 + 2;
      const out1 = in0 + 3;
      if (normalY > 0) {
        indices.push(in0, out0, out1, in0, out1, in1);
      } else {
        indices.push(in0, out1, out0, in0, in1, out1);
      }
    }
  };

  // Helper: add a longitudinal cut-face quad in the radial half-plane at angle t
  // Quad corners in (r, y): (rA0, yA), (rA1, yA), (rB1, yB), (rB0, yB) with rA1 > rA0
  const addCutQuad = (
    t: number,
    isStartFace: boolean,
    rA0: number,
    rA1: number,
    yA: number,
    rB0: number,
    rB1: number,
    yB: number,
  ): void => {
    const s = Math.sin(t);
    const c = Math.cos(t);
    // Tangent along +theta is (c, 0, -s).
    // At thetaStart, outward normal points in -theta = (-c, 0, s).
    // At thetaEnd, outward normal points in +theta = (c, 0, -s).
    const nx = isStartFace ? -c : c;
    const nz = isStartFace ? s : -s;
    const v0 = pushVertex(rA0 * s, yA, rA0 * c, nx, 0, nz, 0, 0);
    const v1 = pushVertex(rA1 * s, yA, rA1 * c, nx, 0, nz, 1, 0);
    const v2 = pushVertex(rB1 * s, yB, rB1 * c, nx, 0, nz, 1, 1);
    const v3 = pushVertex(rB0 * s, yB, rB0 * c, nx, 0, nz, 0, 1);
    if (isStartFace) {
      indices.push(v0, v1, v2, v0, v2, v3);
    } else {
      indices.push(v0, v2, v1, v0, v3, v2);
    }
  };

  // Helper: watertight 3-triangle base cut face avoiding T-junction at (rInner, yBase)
  const addBaseCutFace = (t: number, isStartFace: boolean): void => {
    const s = Math.sin(t);
    const c = Math.cos(t);
    const nx = isStartFace ? -c : c;
    const nz = isStartFace ? s : -s;
    const b0 = pushVertex(0, y0, 0, nx, 0, nz, 0, 0);
    const b1 = pushVertex(rOuter * s, y0, rOuter * c, nx, 0, nz, 1, 0);
    const tOut = pushVertex(rOuter * s, yBase, rOuter * c, nx, 0, nz, 1, 1);
    const tIn = pushVertex(rInner * s, yBase, rInner * c, nx, 0, nz, rInner / rOuter, 1);
    const t0 = pushVertex(0, yBase, 0, nx, 0, nz, 0, 1);
    if (isStartFace) {
      indices.push(b0, b1, tIn, b0, tIn, t0, b1, tOut, tIn);
    } else {
      indices.push(b0, tIn, b1, b0, t0, tIn, b1, tIn, tOut);
    }
  };

  // Build section ring stack: [y, rInner, rOuter] from yBase up to yTop
  const yBase = y0 + baseThick;
  const yBodyTop = y0 + height;

  interface WallSection {
    yA: number;
    yB: number;
    rInA: number;
    rInB: number;
    rOutA: number;
    rOutB: number;
  }
  const sections: WallSection[] = [];

  if (hasNeck) {
    const availH = Math.max(0.05, yBodyTop - yBase);
    const defaultShoulderH = Math.max(0.16, (rOuterTop - neckROuter) * 0.48);
    const shoulderH = Math.min(
      availH * 0.34,
      Math.max(0.04, opts.shoulderHeight ?? defaultShoulderH),
    );
    const yShoulderStart = yBodyTop - shoulderH;

    // Straight / gently tapered main body below shoulder
    sections.push({
      yA: yBase,
      yB: yShoulderStart,
      rInA: rInner,
      rInB: rInnerTop,
      rOutA: rOuter,
      rOutB: rOuterTop,
    });
    // Tapered shoulder into bottle neck
    sections.push({
      yA: yShoulderStart,
      yB: yBodyTop,
      rInA: rInnerTop,
      rInB: neckRInner,
      rOutA: rOuterTop,
      rOutB: neckROuter,
    });
    // Cylindrical neck
    sections.push({
      yA: yBodyTop,
      yB: yBodyTop + neckHeight,
      rInA: neckRInner,
      rInB: neckRInner,
      rOutA: neckROuter,
      rOutB: neckROuter,
    });
  } else {
    sections.push({
      yA: yBase,
      yB: yBodyTop,
      rInA: rInner,
      rInB: rInnerTop,
      rOutA: rOuter,
      rOutB: rOuterTop,
    });
  }

  // 1. Solid bottom base disc (y0 .. yBase)
  addSectorDisc(y0, rOuter, -1);
  addRevolvedStrip(y0, rOuter, yBase, rOuter, true);
  addSectorDisc(yBase, rInner, 1);

  // 2. Wall sections (outer wall + inner cavity wall)
  for (const sec of sections) {
    addRevolvedStrip(sec.yA, sec.rOutA, sec.yB, sec.rOutB, true);
    addRevolvedStrip(sec.yA, sec.rInA, sec.yB, sec.rInB, false);
  }

  // 3. Top annular rim
  const topSec = sections[sections.length - 1]!;
  addAnnularRim(topSec.yB, topSec.rInB, topSec.rOutB, 1);

  // 4. Longitudinal cutaway wall faces (base + every wall section)
  if (isCutaway) {
    const t0 = thetas[0] ?? thetaStart;
    const t1 = thetas[segs] ?? thetaStart + sweepRad;
    for (const [t, isStart] of [
      [t0, true],
      [t1, false],
    ] as const) {
      // Watertight base cross-section connecting (0..rOuter, y0) to (0..rInner..rOuter, yBase)
      addBaseCutFace(t, isStart);
      // Wall section cross-section quads from rInner to rOuter
      for (const sec of sections) {
        addCutQuad(
          t,
          isStart,
          sec.rInA,
          sec.rOutA,
          sec.yA,
          sec.rInB,
          sec.rOutB,
          sec.yB,
        );
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Translucent architectural frosted-glass cutaway bottle/vessel along the Y-axis
 * (or X-axis) with thick glass walls, solid bottom disc, optional shoulder & neck,
 * and crisp architectural contour lines.
 */
export function glassVessel(opts: GlassVesselOptions): THREE.Group {
  const group = new THREE.Group();
  group.name = "glassVessel";
  group.userData.isGlass = true;

  const opacity = opts.opacity ?? 0.34;
  const geo = buildGlassVesselGeometry(opts);

  const mat = new THREE.MeshStandardMaterial({
    color: opts.color ?? 0xeef3f6,
    roughness: 0.18,
    metalness: 0.08,
    transparent: true,
    opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  mat.userData.isGlass = true;
  mat.userData.baseColorHex = opts.color ?? 0xeef3f6;
  mat.userData.baseOpacity = opacity;
  mat.userData.baseTransparent = true;

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "glassVessel_shell";
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.renderOrder = 5;
  mesh.userData.isGlass = true;
  addArchitecturalEdges(mesh, opts.edgeThresholdDeg ?? 20, { opacity: 0.44 });

  if (opts.axis === "x") {
    const orient = new THREE.Group();
    orient.name = "glassVessel_axisX";
    orient.rotation.z = -Math.PI / 2;
    orient.add(mesh);
    group.add(orient);
  } else {
    group.add(mesh);
  }

  group.userData.shellMesh = mesh;
  return group;
}

/* -------------------------------------------------------------------------- */
/*  Primitive 10: liquidVolume                                                */
/* -------------------------------------------------------------------------- */

export interface LiquidVolumeOptions {
  height: number;
  radius: number;
  y0?: number;
  openDeg?: number;
  startDeg?: number;
  color?: AccentKey | number;
  opacity?: number;
  segments?: number;
}

/**
 * Build a watertight cutaway solid cylinder of liquid along the Y-axis with
 * flat cutaway faces and top meniscus surface.
 */
export function buildLiquidVolumeGeometry(
  opts: LiquidVolumeOptions,
): THREE.BufferGeometry {
  const height = Math.max(0.01, opts.height);
  const radius = Math.max(0.01, opts.radius);
  const y0 = opts.y0 ?? 0;
  const y1 = y0 + height;
  const openDeg = Math.max(0, Math.min(359, opts.openDeg ?? 125));
  const isCutaway = openDeg > 0.01;
  const sweepRad = (360 - openDeg) * DEG2RAD;
  const segs = Math.max(12, Math.round(opts.segments ?? 48));

  const thetaStart =
    opts.startDeg !== undefined
      ? opts.startDeg * DEG2RAD
      : isCutaway
        ? (15 + openDeg / 2) * DEG2RAD
        : 0;

  const thetas: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const frac = i / segs;
    thetas.push(
      isCutaway
        ? thetaStart + frac * sweepRad
        : thetaStart + (i === segs ? 0 : frac * Math.PI * 2),
    );
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const pushVertex = (
    px: number,
    py: number,
    pz: number,
    nx: number,
    ny: number,
    nz: number,
    u: number,
    v: number,
  ): number => {
    const idx = positions.length / 3;
    positions.push(px, py, pz);
    normals.push(nx, ny, nz);
    uvs.push(u, v);
    return idx;
  };

  // 1. Outer cylindrical wall
  const wallStart = positions.length / 3;
  for (let i = 0; i <= segs; i++) {
    const t = thetas[i] ?? 0;
    const s = Math.sin(t);
    const c = Math.cos(t);
    const u = i / segs;
    pushVertex(radius * s, y0, radius * c, s, 0, c, u, 0);
    pushVertex(radius * s, y1, radius * c, s, 0, c, u, 1);
  }
  for (let i = 0; i < segs; i++) {
    const a = wallStart + i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, d, a, d, b);
  }

  // 2. Bottom disc (-Y)
  const botCenter = pushVertex(0, y0, 0, 0, -1, 0, 0.5, 0.5);
  const botRim = positions.length / 3;
  for (let i = 0; i <= segs; i++) {
    const t = thetas[i] ?? 0;
    const s = Math.sin(t);
    const c = Math.cos(t);
    pushVertex(radius * s, y0, radius * c, 0, -1, 0, 0.5 + 0.5 * s, 0.5 + 0.5 * c);
  }
  for (let i = 0; i < segs; i++) {
    indices.push(botCenter, botRim + i + 1, botRim + i);
  }

  // 3. Top meniscus disc (+Y)
  const topCenter = pushVertex(0, y1, 0, 0, 1, 0, 0.5, 0.5);
  const topRim = positions.length / 3;
  for (let i = 0; i <= segs; i++) {
    const t = thetas[i] ?? 0;
    const s = Math.sin(t);
    const c = Math.cos(t);
    pushVertex(radius * s, y1, radius * c, 0, 1, 0, 0.5 + 0.5 * s, 0.5 + 0.5 * c);
  }
  for (let i = 0; i < segs; i++) {
    indices.push(topCenter, topRim + i, topRim + i + 1);
  }

  // 4. Flat radial cutaway faces
  if (isCutaway) {
    const t0 = thetas[0] ?? thetaStart;
    const s0 = Math.sin(t0);
    const c0 = Math.cos(t0);
    const f1a = pushVertex(0, y0, 0, -c0, 0, s0, 0, 0);
    const f1b = pushVertex(radius * s0, y0, radius * c0, -c0, 0, s0, 1, 0);
    const f1c = pushVertex(radius * s0, y1, radius * c0, -c0, 0, s0, 1, 1);
    const f1d = pushVertex(0, y1, 0, -c0, 0, s0, 0, 1);
    indices.push(f1a, f1b, f1c, f1a, f1c, f1d);

    const t1 = thetas[segs] ?? thetaStart + sweepRad;
    const s1 = Math.sin(t1);
    const c1 = Math.cos(t1);
    const f2a = pushVertex(0, y0, 0, c1, 0, -s1, 0, 0);
    const f2b = pushVertex(radius * s1, y0, radius * c1, c1, 0, -s1, 1, 0);
    const f2c = pushVertex(radius * s1, y1, radius * c1, c1, 0, -s1, 1, 1);
    const f2d = pushVertex(0, y1, 0, c1, 0, -s1, 0, 1);
    indices.push(f2a, f2c, f2b, f2a, f2d, f2c);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Sculpted cutaway liquid column along the Y-axis with warm/cool translucent
 * tinted material and a crisp top meniscus rim highlight.
 */
export function liquidVolume(opts: LiquidVolumeOptions): THREE.Group {
  const group = new THREE.Group();
  group.name = "liquidVolume";
  group.userData.isLiquid = true;

  const baseHex = resolveAccentHex(opts.color ?? "gold");
  const opacity = opts.opacity ?? 0.72;
  const geo = buildLiquidVolumeGeometry(opts);

  const mat = new THREE.MeshStandardMaterial({
    color: baseHex,
    emissive: baseHex,
    emissiveIntensity: 0.16,
    roughness: 0.16,
    metalness: 0.04,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  mat.userData.isLiquid = true;
  mat.userData.baseColorHex = baseHex;
  mat.userData.baseOpacity = opacity;
  mat.userData.baseTransparent = true;

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "liquidVolume_body";
  mesh.renderOrder = 3;
  mesh.userData.isLiquid = true;
  group.add(mesh);

  // Crisp top meniscus rim highlight catching studio key light
  const yTop = (opts.y0 ?? 0) + Math.max(0.01, opts.height);
  const radius = Math.max(0.01, opts.radius);
  const openDeg = Math.max(0, Math.min(359, opts.openDeg ?? 125));
  const isCutaway = openDeg > 0.01;
  const sweepRad = (360 - openDeg) * DEG2RAD;
  const segs = Math.max(12, Math.round(opts.segments ?? 48));
  const thetaStart =
    opts.startDeg !== undefined
      ? opts.startDeg * DEG2RAD
      : isCutaway
        ? (15 + openDeg / 2) * DEG2RAD
        : 0;

  const rimPts: THREE.Vector3[] = [];
  if (isCutaway) {
    rimPts.push(new THREE.Vector3(0, yTop + 0.004, 0));
  }
  for (let i = 0; i <= segs; i++) {
    const frac = i / segs;
    const t = isCutaway ? thetaStart + frac * sweepRad : thetaStart + frac * Math.PI * 2;
    rimPts.push(new THREE.Vector3(radius * Math.sin(t), yTop + 0.004, radius * Math.cos(t)));
  }
  if (isCutaway) {
    rimPts.push(new THREE.Vector3(0, yTop + 0.004, 0));
  }

  const meniscusGeo = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(rimPts, false, "centripetal", 0.05),
    Math.max(24, segs + 8),
    Math.max(0.008, radius * 0.015),
    8,
    false,
  );
  const meniscusColor = new THREE.Color(baseHex).lerp(new THREE.Color(0xffffff), 0.45);
  const meniscusMat = new THREE.MeshStandardMaterial({
    color: meniscusColor,
    emissive: meniscusColor,
    emissiveIntensity: 0.35,
    roughness: 0.14,
    metalness: 0.06,
    transparent: true,
    opacity: Math.min(0.95, opacity + 0.16),
    depthWrite: false,
  });
  meniscusMat.userData.isLiquid = true;
  meniscusMat.userData.baseColorHex = meniscusColor.getHex();
  meniscusMat.userData.baseOpacity = meniscusMat.opacity;
  meniscusMat.userData.baseTransparent = true;

  const meniscusMesh = new THREE.Mesh(meniscusGeo, meniscusMat);
  meniscusMesh.name = "liquidVolume_meniscus";
  meniscusMesh.renderOrder = 4;
  meniscusMesh.userData.isLiquid = true;
  group.add(meniscusMesh);

  group.userData.liquidMesh = mesh;
  group.userData.meniscusMesh = meniscusMesh;
  return group;
}

/* -------------------------------------------------------------------------- */
/*  Primitive 11: pistonPlunger                                               */
/* -------------------------------------------------------------------------- */

export interface PistonPlungerOptions {
  r: number;
  headLength?: number;
  rodLength?: number;
  springTurns?: number;
  withSpring?: boolean;
  axis?: "x" | "y";
  tone?: MonochromeKey;
  rodTone?: MonochromeKey;
}

export interface PistonPlungerHandle {
  group: THREE.Group;
  setStroke(offset: number): void;
}

/**
 * Machined 3D horizontal or vertical piston head + dual sealing O-rings +
 * connecting rod + optional rear push cap & coaxial helical return spring
 * (set `withSpring: false` for IC-engine / hydraulic pistons with wrist-pin rod).
 */
export function pistonPlunger(opts: PistonPlungerOptions): PistonPlungerHandle {
  const group = new THREE.Group();
  group.name = "pistonPlunger";

  const r = Math.max(0.04, opts.r);
  const headLength = Math.max(0.06, opts.headLength ?? r * 0.65);
  const rodLength = Math.max(0.25, opts.rodLength ?? r * 2.0);
  const springTurns = Math.max(2, Math.round(opts.springTurns ?? 6));
  const withSpring = opts.withSpring !== false;
  const tone = opts.tone ?? "clayDark";
  const rodTone = opts.rodTone ?? "graphite";

  const axisGroup = new THREE.Group();
  axisGroup.name = "pistonPlunger_axis";
  if (opts.axis === "y") {
    axisGroup.rotation.z = Math.PI / 2;
  }
  group.add(axisGroup);

  // Moving assembly: piston head + sealing rings + connecting rod (+ cap or wrist-pin boss)
  const movingGroup = new THREE.Group();
  movingGroup.name = "pistonPlunger_moving";
  axisGroup.add(movingGroup);

  // Machined piston head cylinder along X centered at x = 0
  const headGeo = new THREE.CylinderGeometry(r, r, headLength, 32);
  headGeo.rotateZ(Math.PI / 2);
  const headMat = createClayMaterial(tone, { roughness: 0.56, metalness: 0.2 });
  const headMesh = new THREE.Mesh(headGeo, headMat);
  headMesh.name = "pistonPlunger_head";
  configureSolidMesh(headMesh, 22);
  movingGroup.add(headMesh);

  // Dual machined sealing O-rings around piston head
  const sealGeo = new THREE.CylinderGeometry(r * 1.035, r * 1.035, headLength * 0.14, 32);
  sealGeo.rotateZ(Math.PI / 2);
  const sealMat = createClayMaterial(rodTone, { roughness: 0.42, metalness: 0.34 });
  for (const [idx, sign] of [
    [0, -1],
    [1, 1],
  ] as const) {
    const seal = new THREE.Mesh(sealGeo, sealMat);
    seal.name = `pistonPlunger_seal_${idx}`;
    seal.position.x = sign * headLength * 0.27;
    configureSolidMesh(seal, 24);
    movingGroup.add(seal);
  }

  // Front chamfered piston crown boss
  const crownGeo = new THREE.CylinderGeometry(r * 0.74, r * 0.88, headLength * 0.14, 28);
  crownGeo.rotateZ(Math.PI / 2);
  const crownMesh = new THREE.Mesh(crownGeo, headMat);
  crownMesh.name = "pistonPlunger_crown";
  crownMesh.position.x = headLength * 0.56;
  configureSolidMesh(crownMesh, 22);
  movingGroup.add(crownMesh);

  // Connecting rod extending toward -X from back of piston head
  const rodR = Math.max(0.02, r * 0.2);
  const rodGeo = new THREE.CylinderGeometry(rodR, rodR, rodLength, 24);
  rodGeo.rotateZ(Math.PI / 2);
  const rodMat = createClayMaterial(rodTone, { roughness: 0.42, metalness: 0.36 });
  const rodMesh = new THREE.Mesh(rodGeo, rodMat);
  rodMesh.name = "pistonPlunger_rod";
  rodMesh.position.x = -headLength / 2 - rodLength / 2;
  configureSolidMesh(rodMesh, 22);
  movingGroup.add(rodMesh);

  let springObj: THREE.Group | null = null;
  let springAnchorX = 0;
  let springRestLen = 1;

  if (withSpring) {
    // Rear tactile push-flange / thumb cap at x = -headLength/2 - rodLength
    const capThick = Math.max(0.05, r * 0.2);
    const capGeo = new THREE.CylinderGeometry(r * 0.64, r * 0.68, capThick, 28);
    capGeo.rotateZ(Math.PI / 2);
    const capMesh = new THREE.Mesh(capGeo, headMat);
    capMesh.name = "pistonPlunger_cap";
    capMesh.position.x = -headLength / 2 - rodLength - capThick * 0.4;
    configureSolidMesh(capMesh, 22);
    movingGroup.add(capMesh);

    // Fixed spring seat collar behind the piston head
    const seatX = -headLength / 2 - rodLength * 0.22;
    const seatThick = Math.max(0.035, rodR * 0.55);
    const seatGeo = new THREE.CylinderGeometry(r * 0.56, r * 0.56, seatThick, 24);
    seatGeo.rotateZ(Math.PI / 2);
    const seatMesh = new THREE.Mesh(seatGeo, rodMat);
    seatMesh.name = "pistonPlunger_springSeat";
    seatMesh.position.x = seatX;
    configureSolidMesh(seatMesh, 22);
    axisGroup.add(seatMesh);

    // Coaxial helical return spring spanning from moving rear push-cap to fixed seat
    springAnchorX = seatX - seatThick * 0.5;
    const capFaceX0 = -headLength / 2 - rodLength + capThick * 0.1;
    springRestLen = Math.max(0.14, springAnchorX - capFaceX0);

    springObj = spring({
      r: Math.max(rodR * 1.6, r * 0.44),
      length: springRestLen,
      turns: springTurns,
      wireR: Math.max(0.014, Math.min(r * 0.068, springRestLen / (springTurns * 3.8))),
      axis: "x",
      tone: rodTone,
    });
    springObj.name = "pistonPlunger_spring";
    springObj.position.x = springAnchorX - springRestLen * 0.5;
    axisGroup.add(springObj);
  } else {
    // Machined transverse wrist-pin / crank-pin boss at rear of connecting rod
    const pinR = Math.max(rodR * 1.4, r * 0.28);
    const pinLen = Math.max(rodR * 2.2, r * 0.58);
    const pinGeo = new THREE.CylinderGeometry(pinR, pinR, pinLen, 24);
    pinGeo.rotateX(Math.PI / 2);
    const pinMesh = new THREE.Mesh(pinGeo, rodMat);
    pinMesh.name = "pistonPlunger_wristPin";
    pinMesh.position.x = -headLength / 2 - rodLength;
    configureSolidMesh(pinMesh, 22);
    movingGroup.add(pinMesh);
  }

  const setStroke = (offset: number): void => {
    const safeOffset = Number.isFinite(offset) ? offset : 0;
    movingGroup.position.x = safeOffset;
    if (springObj) {
      // Pushing rightward (+offset) compresses spring cleanly between moving cap & fixed seat
      const nextLen = Math.max(springRestLen * 0.22, springRestLen - safeOffset);
      springObj.scale.x = nextLen / springRestLen;
      springObj.position.x = springAnchorX - nextLen * 0.5;
    }
  };

  setStroke(0);

  group.userData.movingGroup = movingGroup;
  group.userData.springGroup = springObj;
  group.userData.setStroke = setStroke;

  return { group, setStroke };
}

/* -------------------------------------------------------------------------- */
/*  Primitive 12: mistCone                                                    */
/* -------------------------------------------------------------------------- */

export interface MistConeOptions {
  origin: [number, number, number];
  length: number;
  startRadius?: number;
  endRadius?: number;
  count?: number;
  color?: AccentKey | number;
  speed?: number;
  dropletRadius?: number;
  opacity?: number;
  direction?: [number, number, number];
}

export interface MistConeUpdateOptions {
  speedScale?: number;
  dropletScale?: number;
  spreadScale?: number;
  opacityScale?: number;
  gravitySag?: number;
  colorHex?: number;
}

export interface MistConeHandle {
  group: THREE.Group;
  update(dt: number, opts?: MistConeUpdateOptions): void;
}

interface MistDropletState {
  phase: number;
  angle: number;
  radialFrac: number;
  speedJitter: number;
  sizeJitter: number;
  wobblePhase: number;
}

/**
 * Animated 3D instanced aerosol/spray dispersion cone bursting from an origin
 * along a direction (default +X) with zero per-frame allocations.
 */
export function mistCone(opts: MistConeOptions): MistConeHandle {
  const group = new THREE.Group();
  group.name = "mistCone";
  group.userData.isMistCone = true;

  const originVec = new THREE.Vector3(...opts.origin);
  const dirVec = new THREE.Vector3(...(opts.direction ?? [1, 0, 0]));
  if (dirVec.lengthSq() < 1e-8) {
    dirVec.set(1, 0, 0);
  } else {
    dirVec.normalize();
  }

  const length = Math.max(0.1, opts.length);
  const startRadius = Math.max(0.005, opts.startRadius ?? 0.04);
  const endRadius = Math.max(startRadius + 0.02, opts.endRadius ?? 0.95);
  const count = Math.max(4, Math.round(opts.count ?? 90));
  const baseHex = resolveAccentHex(opts.color ?? "gold");
  const baseSpeed = opts.speed ?? 0.9;
  const dropletRadius = Math.max(0.006, opts.dropletRadius ?? 0.042);
  const baseOpacity = opts.opacity ?? 0.72;

  // Orthonormal basis perpendicular to spray direction
  const refUp = Math.abs(dirVec.y) > 0.92 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const sideU = new THREE.Vector3().crossVectors(dirVec, refUp).normalize();
  const sideV = new THREE.Vector3().crossVectors(dirVec, sideU).normalize();

  // Subtle translucent atmospheric mist veil cone
  const veilGeo = new THREE.CylinderGeometry(endRadius, startRadius, length, 28, 1, true);
  veilGeo.translate(0, length * 0.5, 0);
  const veilQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirVec);
  const veilMat = new THREE.MeshStandardMaterial({
    color: baseHex,
    emissive: baseHex,
    emissiveIntensity: 0.35,
    roughness: 0.35,
    metalness: 0.0,
    transparent: true,
    opacity: 0.065,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  veilMat.userData.isMistCone = true;
  veilMat.userData.baseOpacity = 0.065;
  veilMat.userData.baseTransparent = true;

  const veilMesh = new THREE.Mesh(veilGeo, veilMat);
  veilMesh.name = "mistCone_veil";
  veilMesh.position.copy(originVec);
  veilMesh.quaternion.copy(veilQuat);
  veilMesh.renderOrder = 5;
  veilMesh.userData.isMistCone = true;
  group.add(veilMesh);

  // Instanced 3D droplets
  const dropletGeo = new THREE.SphereGeometry(dropletRadius, 10, 8);
  const dropletMat = new THREE.MeshStandardMaterial({
    color: baseHex,
    emissive: baseHex,
    emissiveIntensity: 0.55,
    roughness: 0.22,
    metalness: 0.05,
    transparent: true,
    opacity: baseOpacity,
    depthWrite: false,
  });
  dropletMat.userData.isMistCone = true;
  dropletMat.userData.baseOpacity = baseOpacity;
  dropletMat.userData.baseTransparent = true;

  const instanced = new THREE.InstancedMesh(dropletGeo, dropletMat, count);
  instanced.name = "mistCone_droplets";
  instanced.renderOrder = 6;
  instanced.frustumCulled = false;
  instanced.userData.isMistCone = true;
  group.add(instanced);

  // Deterministic quasi-random particle traits (golden-angle spiral distribution)
  const droplets: MistDropletState[] = [];
  for (let i = 0; i < count; i++) {
    const h1 = ((i + 0.5) * 0.61803398875) % 1;
    const h2 = ((i + 1) * 0.38196601125) % 1;
    const h3 = ((i + 7) * 0.75487766625) % 1;
    droplets.push({
      phase: (i / count + h1 * 0.15) % 1,
      angle: (i * 2.399963229728653) % (Math.PI * 2),
      radialFrac: 0.14 + 0.86 * Math.sqrt(h2),
      speedJitter: 0.8 + 0.42 * h3,
      sizeJitter: 0.64 + 0.72 * ((i * 0.56984029099) % 1),
      wobblePhase: (i * 1.913) % (Math.PI * 2),
    });
  }

  // Reusable scratch objects (zero per-frame allocations)
  const pos = new THREE.Vector3();
  const scaleVec = new THREE.Vector3();
  const mat4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(1, 0, 0),
    dirVec,
  );
  let simTime = 0;

  const update = (dt: number, updateOpts: MistConeUpdateOptions = {}): void => {
    const safeDt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.25)) : 0;
    simTime += safeDt;

    const speedScale = updateOpts.speedScale ?? 1;
    const dropletScale = Math.max(0.15, updateOpts.dropletScale ?? 1);
    const spreadScale = Math.max(0.15, updateOpts.spreadScale ?? 1);
    const opacityScale = Math.max(0, Math.min(2, updateOpts.opacityScale ?? 1));
    const gravitySag = updateOpts.gravitySag ?? 0;

    if (updateOpts.colorHex !== undefined) {
      dropletMat.color.setHex(updateOpts.colorHex);
      dropletMat.emissive.setHex(updateOpts.colorHex);
      veilMat.color.setHex(updateOpts.colorHex);
      veilMat.emissive.setHex(updateOpts.colorHex);
    }

    const focusOpacity =
      typeof group.userData.focusOpacityScale === "number"
        ? group.userData.focusOpacityScale
        : 1;
    const revealAlpha =
      typeof group.userData.revealAlpha === "number"
        ? group.userData.revealAlpha
        : 1;
    const effOpacity = opacityScale * focusOpacity * revealAlpha;

    dropletMat.opacity = Math.min(0.98, baseOpacity * effOpacity);
    veilMat.opacity = Math.min(0.22, 0.065 * effOpacity * Math.min(1.4, spreadScale));
    veilMesh.scale.set(spreadScale, 1, spreadScale);

    for (let i = 0; i < droplets.length; i++) {
      const p = droplets[i]!;
      p.phase =
        (((p.phase + safeDt * baseSpeed * speedScale * p.speedJitter) % 1) + 1) %
        1;
      const t = p.phase;

      // Fast burst near nozzle, slight aerodynamic drag expansion farther out
      const dist = length * Math.pow(t, 0.88);
      const coneR =
        startRadius +
        (endRadius * spreadScale - startRadius) * Math.pow(t, 0.86);
      const radial = coneR * p.radialFrac;

      const swirl = p.angle + t * 0.65 + Math.sin(simTime * 2.2 + p.wobblePhase) * 0.08;
      pos.copy(originVec).addScaledVector(dirVec, dist);
      pos.addScaledVector(sideU, Math.cos(swirl) * radial);
      pos.addScaledVector(sideV, Math.sin(swirl) * radial);
      if (gravitySag !== 0) {
        pos.y -= gravitySag * t * t;
      }

      // Smooth fade envelope at birth & far edge, strictly positive for clean matrices
      const birth = Math.min(1, t / 0.09);
      const fade = Math.pow(Math.max(0.001, 1 - t), 0.42);
      const s = Math.max(0.08, p.sizeJitter * dropletScale * (0.18 + 0.82 * birth * fade));
      const stretch = t < 0.25 ? 1 + (1 - t / 0.25) * 0.65 : 1;

      scaleVec.set(s * stretch, s, s);
      mat4.compose(pos, quat, scaleVec);
      instanced.setMatrixAt(i, mat4);
    }

    instanced.instanceMatrix.needsUpdate = true;
  };

  // Seed initial droplet matrices cleanly
  update(0);

  group.userData.instancedMesh = instanced;
  group.userData.veilMesh = veilMesh;
  return { group, update };
}

/* -------------------------------------------------------------------------- */
/*  Primitive 15: airVolume (Diffused Volumetric fBM Airflow Mist)            */
/* -------------------------------------------------------------------------- */

export interface AirVolumeOptions {
  x0: number;
  length: number;
  rInner: number;
  rOuter: number;
  rInnerEnd?: number;
  rOuterEnd?: number;
  intakeFlare?: number;
  color?: AccentKey | number;
  secondaryColor?: AccentKey | number;
  opacity?: number;
  speed?: number;
  puffCount?: number;
  swirl?: number;
}

export interface AirVolumeUpdateOptions {
  speedScale?: number;
  opacityScale?: number;
  colorHex?: number;
  darkMode?: boolean;
}

export interface AirVolumeHandle {
  group: THREE.Group;
  update(dt: number, opts?: AirVolumeUpdateOptions): void;
}

function buildAnnularMistShellGeometry(
  x0: number,
  length: number,
  rStart: number,
  rEnd: number,
  intakeFlare: number,
  axialSegs = 64,
  radialSegs = 56,
): THREE.BufferGeometry {
  const cols = radialSegs + 1;
  const rows = axialSegs + 1;
  const positions = new Float32Array(rows * cols * 3);
  const normals = new Float32Array(rows * cols * 3);
  const uvs = new Float32Array(rows * cols * 2);
  const angles = new Float32Array(rows * cols);
  const indices: number[] = [];

  for (let i = 0; i <= axialSegs; i++) {
    const t = i / axialSegs;
    const x = x0 + t * length;
    // Aerodynamic intake lip contraction + smooth duct taper + gentle wake expansion
    const intakeCurve = intakeFlare * Math.exp(-Math.pow(t / 0.14, 2.0));
    const midSwell = Math.sin(t * Math.PI) * 0.05 * rStart;
    const wakeSpread = Math.pow(Math.max(0, (t - 0.78) / 0.22), 1.6) * 0.14 * rEnd;
    const r = Math.max(0.02, rStart + (rEnd - rStart) * t + intakeCurve + midSwell + wakeSpread);

    for (let j = 0; j <= radialSegs; j++) {
      const u = j / radialSegs;
      const theta = u * Math.PI * 2;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);
      const idx = i * cols + j;

      positions[idx * 3] = x;
      positions[idx * 3 + 1] = sinT * r;
      positions[idx * 3 + 2] = cosT * r;

      normals[idx * 3] = 0;
      normals[idx * 3 + 1] = sinT;
      normals[idx * 3 + 2] = cosT;

      uvs[idx * 2] = t;
      uvs[idx * 2 + 1] = u;
      angles[idx] = theta;
    }
  }

  for (let i = 0; i < axialSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = (i + 1) * cols + j;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute("aTheta", new THREE.BufferAttribute(angles, 1));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Diffused volumetric aerodynamic air mist: nested seamless 360-degree GLSL fBM
 * wind-tunnel curtains with optical rim-depth weighting + soft billowing Gaussian
 * air-wisp sprites. Zero rigid tube/wire silhouettes; adapts cleanly to Light & Dark.
 */
export function airVolume(opts: AirVolumeOptions): AirVolumeHandle {
  const group = new THREE.Group();
  group.name = "airVolume";
  group.userData.isAirVolume = true;
  group.userData.isFlowRibbon = true; // Inherits Dim & Illuminate + Progressive Reveal

  const length = Math.max(0.2, opts.length);
  const rInner = Math.max(0.02, opts.rInner);
  const rOuter = Math.max(rInner + 0.04, opts.rOuter);
  const rInnerEnd = Math.max(0.02, opts.rInnerEnd ?? rInner);
  const rOuterEnd = Math.max(rInnerEnd + 0.04, opts.rOuterEnd ?? rOuter);
  const intakeFlare = opts.intakeFlare ?? (rOuter - rInner) * 0.28;
  const baseHex = resolveAccentHex(opts.color ?? "cobalt");
  const secHex = resolveAccentHex(opts.secondaryColor ?? 0x7dd3fc);
  const baseOpacity = opts.opacity ?? 0.34;
  const baseSpeed = opts.speed ?? 0.72;
  const swirlStrength = opts.swirl ?? 0.85;

  const shellVert = /* glsl */ `
    attribute float aTheta;
    varying vec2 vUv;
    varying float vTheta;
    varying vec3 vNormalView;
    void main() {
      vUv = uv;
      vTheta = aTheta;
      vNormalView = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const shellFrag = /* glsl */ `
    varying vec2 vUv;
    varying float vTheta;
    varying vec3 vNormalView;
    uniform float uTime;
    uniform float uOpacity;
    uniform float uLayerPhase;
    uniform float uDarkMode;
    uniform float uSwirl;
    uniform vec3 uColor;
    uniform vec3 uSecondary;

    float hash3(vec3 p) {
      p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.23));
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    float noise3(vec3 x) {
      vec3 i = floor(x);
      vec3 f = fract(x);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(
          mix(hash3(i + vec3(0,0,0)), hash3(i + vec3(1,0,0)), f.x),
          mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x),
          f.y
        ),
        mix(
          mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x),
          mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x),
          f.y
        ),
        f.z
      );
    }

    float fbm(vec3 p) {
      float v = 0.0;
      float a = 0.54;
      for (int i = 0; i < 4; i++) {
        v += a * noise3(p);
        p = p * 2.05 + vec3(1.7, 3.1, 2.3);
        a *= 0.5;
      }
      return v;
    }

    void main() {
      float t = clamp(vUv.x, 0.0, 1.0);
      float theta = vTheta + t * uSwirl;

      // Seamless 3D periodic cylindrical coordinates -> zero UV seam!
      vec3 coord = vec3(
        t * 3.4 - uTime * 1.15 + uLayerPhase * 2.1,
        sin(theta) * 1.65 + uLayerPhase,
        cos(theta) * 1.65 - uLayerPhase
      );
      // Domain warp for organic wind-tunnel smoke wisps
      float w1 = fbm(coord * 0.9);
      vec3 warped = coord + vec3(w1 * 0.65, (w1 - 0.5) * 0.75, (0.5 - w1) * 0.75);
      float mist = fbm(warped);
      // Elongated silk airflow streaks along flow axis
      float silk = fbm(vec3(t * 2.0 - uTime * 1.65, sin(theta) * 3.4, cos(theta) * 3.4));
      float density = smoothstep(0.24, 0.84, mist * 0.64 + silk * 0.44);

      // Optical volume thickness: thicker when grazing curved duct walls (top/bottom),
      // gossamer-clear looking straight through the front cutaway window!
      float nz = abs(normalize(vNormalView).z);
      float opticalDepth = mix(1.22, 0.28, pow(nz, 1.15));

      // Smooth axial feather at intake & trailing wake
      float endFade = smoothstep(0.0, 0.16, t) * (1.0 - smoothstep(0.74, 1.0, t));

      vec3 lightCol = mix(uColor, uSecondary, clamp(silk * 0.52, 0.0, 1.0));
      vec3 darkCol = mix(uColor, uSecondary, clamp(0.28 + silk * 0.68, 0.0, 1.0)) * 1.18;
      vec3 col = mix(lightCol, darkCol, uDarkMode);

      float alpha = density * opticalDepth * endFade * uOpacity * mix(1.0, 1.12, uDarkMode);
      if (alpha < 0.006) discard;
      gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.52));
    }
  `;

  const shellMaterials: THREE.ShaderMaterial[] = [];
  const shellFracs = [0.22, 0.56, 0.88];
  const shellWeights = [0.42, 0.58, 0.48];
  for (let i = 0; i < shellFracs.length; i++) {
    const f = shellFracs[i]!;
    const rS = rInner + (rOuter - rInner) * f;
    const rE = rInnerEnd + (rOuterEnd - rInnerEnd) * f;
    const geo = buildAnnularMistShellGeometry(
      opts.x0,
      length,
      rS,
      rE,
      intakeFlare * (0.45 + 0.55 * f),
    );
    const mat = new THREE.ShaderMaterial({
      vertexShader: shellVert,
      fragmentShader: shellFrag,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: baseOpacity * shellWeights[i]! },
        uLayerPhase: { value: i * 1.43 },
        uDarkMode: { value: 0 },
        uSwirl: { value: swirlStrength },
        uColor: { value: new THREE.Color(baseHex) },
        uSecondary: { value: new THREE.Color(secHex) },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    mat.userData.isAirVolume = true;
    mat.userData.layerWeight = shellWeights[i]!;
    shellMaterials.push(mat);

    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `airVolume_shell_${i}`;
    mesh.renderOrder = 3;
    mesh.userData.isAirVolume = true;
    group.add(mesh);
  }

  // Soft billowing Gaussian vapor puffs drifting helically through the duct
  const puffCount = Math.max(16, Math.round(opts.puffCount ?? 150));
  const puffPositions = new Float32Array(puffCount * 3);
  const puffSizes = new Float32Array(puffCount);
  const puffAlphas = new Float32Array(puffCount);

  interface AirPuffState {
    phase: number;
    angle: number;
    radialFrac: number;
    speedJitter: number;
    size: number;
    wobble: number;
  }

  const puffs: AirPuffState[] = [];
  for (let i = 0; i < puffCount; i++) {
    puffs.push({
      phase: (i * 0.6180339887) % 1,
      angle: (i * 2.399963229728653) % (Math.PI * 2),
      radialFrac: 0.14 + 0.78 * (((i * 7 + 3) * 0.381966) % 1),
      speedJitter: 0.78 + 0.44 * (((i * 11 + 5) * 0.271828) % 1),
      size: 46 + 44 * (((i * 13 + 2) * 0.414213) % 1),
      wobble: (i * 1.73) % (Math.PI * 2),
    });
  }

  const puffGeo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(puffPositions, 3);
  const sizeAttr = new THREE.BufferAttribute(puffSizes, 1);
  const alphaAttr = new THREE.BufferAttribute(puffAlphas, 1);
  puffGeo.setAttribute("position", posAttr);
  puffGeo.setAttribute("aSize", sizeAttr);
  puffGeo.setAttribute("aAlpha", alphaAttr);

  const puffVert = /* glsl */ `
    attribute float aSize;
    attribute float aAlpha;
    varying float vAlpha;
    uniform float uPixelRatio;
    void main() {
      vAlpha = aAlpha;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = clamp(aSize * uPixelRatio, 12.0, 150.0);
    }
  `;

  const puffFrag = /* glsl */ `
    varying float vAlpha;
    uniform float uOpacity;
    uniform float uDarkMode;
    uniform vec3 uColor;
    uniform vec3 uSecondary;
    void main() {
      // Wide, ultra-soft velocity-stretched Gaussian vapor wisp (zero blotchy dots)
      vec2 p = (gl_PointCoord - 0.5) * 2.0;
      p.x *= 0.62;
      p.y *= 1.18;
      float r2 = dot(p, p);
      if (r2 > 1.0) discard;
      float soft = exp(-r2 * 2.8) * pow(1.0 - r2, 1.5);
      vec3 col = mix(mix(uColor, uSecondary, 0.36), mix(uColor, uSecondary, 0.72) * 1.15, uDarkMode);
      float a = soft * vAlpha * uOpacity;
      if (a < 0.004) discard;
      gl_FragColor = vec4(col, clamp(a, 0.0, 0.16));
    }
  `;

  const puffMat = new THREE.ShaderMaterial({
    vertexShader: puffVert,
    fragmentShader: puffFrag,
    uniforms: {
      uPixelRatio: {
        value: typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1,
      },
      uOpacity: { value: baseOpacity * 0.52 },
      uDarkMode: { value: 0 },
      uColor: { value: new THREE.Color(baseHex) },
      uSecondary: { value: new THREE.Color(secHex) },
    },
    transparent: true,
    depthWrite: false,
  });
  puffMat.userData.isAirVolume = true;

  const points = new THREE.Points(puffGeo, puffMat);
  points.name = "airVolume_puffs";
  points.renderOrder = 4;
  points.frustumCulled = false;
  points.userData.isAirVolume = true;
  group.add(points);

  let simTime = 0;

  const update = (dt: number, updateOpts: AirVolumeUpdateOptions = {}): void => {
    const safeDt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.25)) : 0;
    const speedScale = updateOpts.speedScale ?? 1;
    const opacityScale = Math.max(0, Math.min(2, updateOpts.opacityScale ?? 1));

    simTime += safeDt * baseSpeed * speedScale;

    if (updateOpts.colorHex !== undefined) {
      for (const sm of shellMaterials) {
        (sm.uniforms.uColor as { value: THREE.Color }).value.setHex(updateOpts.colorHex);
      }
      (puffMat.uniforms.uColor as { value: THREE.Color }).value.setHex(updateOpts.colorHex);
    }

    const darkFlag =
      typeof updateOpts.darkMode === "boolean"
        ? updateOpts.darkMode
          ? 1
          : 0
        : typeof group.userData.darkMode === "number"
          ? (group.userData.darkMode as number)
          : 0;

    const focusOpacity =
      typeof group.userData.focusOpacityScale === "number"
        ? group.userData.focusOpacityScale
        : 1;
    const revealAlpha =
      typeof group.userData.revealAlpha === "number"
        ? group.userData.revealAlpha
        : 1;
    const effOpacity = baseOpacity * opacityScale * focusOpacity * revealAlpha;

    for (const sm of shellMaterials) {
      (sm.uniforms.uTime as { value: number }).value = simTime;
      (sm.uniforms.uDarkMode as { value: number }).value = darkFlag;
      const w = (sm.userData.layerWeight as number) ?? 0.5;
      (sm.uniforms.uOpacity as { value: number }).value = effOpacity * w;
    }

    (puffMat.uniforms.uDarkMode as { value: number }).value = darkFlag;
    (puffMat.uniforms.uOpacity as { value: number }).value = effOpacity * 0.28;

    for (let i = 0; i < puffs.length; i++) {
      const p = puffs[i]!;
      p.phase = (((p.phase + safeDt * baseSpeed * 0.58 * speedScale * p.speedJitter) % 1) + 1) % 1;
      const t = p.phase;
      const x = opts.x0 + t * length;

      const rIn = rInner + (rInnerEnd - rInner) * t;
      const rOut = rOuter + (rOuterEnd - rOuter) * t;
      const intakeC = intakeFlare * Math.exp(-Math.pow(t / 0.14, 2.0));
      const wakeS = Math.pow(Math.max(0, (t - 0.78) / 0.22), 1.6) * 0.18 * rOut;
      const r = rIn + (rOut - rIn) * p.radialFrac + intakeC * p.radialFrac + wakeS;

      const ang = p.angle + t * swirlStrength * 0.9 + Math.sin(simTime * 1.4 + p.wobble) * 0.08;
      puffPositions[i * 3] = x;
      puffPositions[i * 3 + 1] = Math.sin(ang) * r;
      puffPositions[i * 3 + 2] = Math.cos(ang) * r;

      const edgeFade = Math.sin(t * Math.PI);
      puffSizes[i] = p.size * (0.72 + 0.55 * t);
      puffAlphas[i] = Math.pow(Math.max(0, edgeFade), 0.75);
    }

    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    puffGeo.computeBoundingSphere();
  };

  update(0);

  group.userData.shellMaterials = shellMaterials;
  group.userData.puffMaterial = puffMat;
  group.userData.points = points;
  return { group, update };
}

/* -------------------------------------------------------------------------- */
/*  Primitive 16: jetPlume (High-Energy Volumetric Thermal Exhaust + Mach)    */
/* -------------------------------------------------------------------------- */

export interface JetPlumeOptions {
  x0: number;
  length: number;
  rStart: number;
  rEnd?: number;
  speed?: number;
  intensity?: number;
  opacity?: number;
  sparkCount?: number;
  machDiamonds?: number;
}

export interface JetPlumeUpdateOptions {
  speedScale?: number;
  intensity?: number;
  lengthScale?: number;
  opacityScale?: number;
  darkMode?: boolean;
}

export interface JetPlumeHandle {
  group: THREE.Group;
  update(dt: number, opts?: JetPlumeUpdateOptions): void;
}

function buildJetConeGeometry(
  length: number,
  rStart: number,
  rEnd: number,
  axialSegs = 56,
  radialSegs = 48,
): THREE.BufferGeometry {
  const cols = radialSegs + 1;
  const rows = axialSegs + 1;
  const positions = new Float32Array(rows * cols * 3);
  const normals = new Float32Array(rows * cols * 3);
  const uvs = new Float32Array(rows * cols * 2);
  const angles = new Float32Array(rows * cols);
  const indices: number[] = [];

  for (let i = 0; i <= axialSegs; i++) {
    const t = i / axialSegs;
    const x = t * length;
    // Slight barrel expansion just past nozzle then smooth lance taper
    const bulge = Math.sin(Math.pow(t, 0.7) * Math.PI) * rStart * 0.14;
    const r = Math.max(0.008, rStart + (rEnd - rStart) * Math.pow(t, 0.85) + bulge);
    for (let j = 0; j <= radialSegs; j++) {
      const u = j / radialSegs;
      const theta = u * Math.PI * 2;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);
      const idx = i * cols + j;
      positions[idx * 3] = x;
      positions[idx * 3 + 1] = sinT * r;
      positions[idx * 3 + 2] = cosT * r;
      normals[idx * 3] = 0;
      normals[idx * 3 + 1] = sinT;
      normals[idx * 3 + 2] = cosT;
      uvs[idx * 2] = t;
      uvs[idx * 2 + 1] = u;
      angles[idx] = theta;
    }
  }

  for (let i = 0; i < axialSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = (i + 1) * cols + j;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute("aTheta", new THREE.BufferAttribute(angles, 1));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * High-energy volumetric thermal exhaust jet plume: nested inner supersonic
 * incandescent core (with live Mach shock diamonds) + turbulent fiery crimson
 * shear sheath + fast racing ember streaks. Adapts cleanly to Light & Dark.
 */
export function jetPlume(opts: JetPlumeOptions): JetPlumeHandle {
  const group = new THREE.Group();
  group.name = "jetPlume";
  group.position.x = opts.x0;
  group.userData.isJetPlume = true;
  group.userData.isFlowRibbon = true; // Inherits Dim & Illuminate + Progressive Reveal

  const length = Math.max(0.4, opts.length);
  const rStart = Math.max(0.05, opts.rStart);
  const rEnd = Math.max(0.02, opts.rEnd ?? rStart * 0.45);
  const baseSpeed = opts.speed ?? 1.5;
  const baseIntensity = opts.intensity ?? 1.0;
  const baseOpacity = opts.opacity ?? 0.92;
  const machFreq = opts.machDiamonds ?? 4.5;

  const plumeContainer = new THREE.Group();
  plumeContainer.name = "jetPlume_shells";
  group.add(plumeContainer);

  const jetVert = /* glsl */ `
    attribute float aTheta;
    varying vec2 vUv;
    varying float vTheta;
    varying vec3 vNormalView;
    uniform float uTime;
    uniform float uIntensity;
    uniform float uFlutter;
    void main() {
      vUv = uv;
      vTheta = aTheta;
      vec3 pos = position;
      float t = uv.x;
      float turb = smoothstep(0.12, 0.95, t) * uFlutter * (0.65 + 0.55 * uIntensity);
      float w1 = sin(t * 16.0 - uTime * 15.0 + aTheta * 2.0);
      float w2 = cos(t * 24.0 - uTime * 21.0 - aTheta * 3.0);
      float radDisp = (w1 * 0.6 + w2 * 0.4) * turb;
      pos.y += sin(aTheta) * radDisp;
      pos.z += cos(aTheta) * radDisp;
      vNormalView = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const jetFrag = /* glsl */ `
    varying vec2 vUv;
    varying float vTheta;
    varying vec3 vNormalView;
    uniform float uTime;
    uniform float uIntensity;
    uniform float uOpacity;
    uniform float uIsCore;
    uniform float uMachFreq;
    uniform float uDarkMode;

    float hash3(vec3 p) {
      p = fract(p * 0.3183099 + vec3(0.13, 0.19, 0.29));
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    float noise3(vec3 x) {
      vec3 i = floor(x);
      vec3 f = fract(x);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(
          mix(hash3(i + vec3(0,0,0)), hash3(i + vec3(1,0,0)), f.x),
          mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x),
          f.y
        ),
        mix(
          mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x),
          mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x),
          f.y
        ),
        f.z
      );
    }

    float fbm(vec3 p) {
      float v = 0.0;
      float a = 0.55;
      for (int i = 0; i < 3; i++) {
        v += a * noise3(p);
        p = p * 2.15 + vec3(2.3, 1.1, 3.7);
        a *= 0.5;
      }
      return v;
    }

    void main() {
      float t = clamp(vUv.x, 0.0, 1.0);
      float nz = abs(normalize(vNormalView).z);
      // Center-dense volumetric cylinder falloff: razor-hot core, feathered wispy fire edges
      float coreVol = pow(nz, mix(1.15, 1.65, uIsCore));

      vec3 nCoord = vec3(
        t * 5.5 - uTime * 5.2,
        sin(vTheta) * 2.2,
        cos(vTheta) * 2.2
      );
      float fire = fbm(nCoord);
      float fine = fbm(nCoord * 1.9 + vec3(-uTime * 3.4, 1.2, 2.4));
      float turbMask = mix(0.68, 1.28, fire * 0.65 + fine * 0.35);

      // Supersonic Mach shock-diamond compression cells
      float diamondWave = pow(max(0.0, sin(t * uMachFreq * 3.14159 - uTime * 2.6)), 2.6);
      float diamondEnv = smoothstep(0.04, 0.16, t) * (1.0 - smoothstep(0.45, 0.88, t));
      float shock = diamondWave * diamondEnv * clamp(uIntensity * 0.72, 0.15, 1.35);

      // Vivid fiery thermal palette: incandescent white-gold -> scorching orange -> deep crimson red
      vec3 cWhite = vec3(1.0, 0.96, 0.80);
      vec3 cOrange = vec3(1.0, 0.42, 0.06);
      vec3 cCrimson = vec3(0.86, 0.12, 0.05);
      vec3 cDarkRed = vec3(0.58, 0.07, 0.04);

      vec3 outerCol = mix(cOrange, cCrimson, smoothstep(0.06, 0.52, t));
      outerCol = mix(outerCol, cDarkRed, smoothstep(0.55, 0.96, t));
      outerCol = mix(outerCol, cWhite, shock * 0.38 * coreVol);

      vec3 innerCol = mix(cWhite, cOrange, smoothstep(0.05, 0.58, t));
      innerCol = mix(innerCol, cCrimson, smoothstep(0.54, 0.95, t));
      innerCol = mix(innerCol, cWhite, shock * 0.78);

      vec3 col = mix(outerCol, innerCol, uIsCore);
      // Slight luminous boost on Dark Mode while preserving rich saturated crimson on Light Mode
      col *= mix(1.0, 1.24, uDarkMode);

      float headFade = smoothstep(0.0, 0.08, t);
      float tailFade = pow(max(0.0, 1.0 - smoothstep(0.28, 1.0, t)), mix(1.05, 1.35, uIsCore));
      float baseA = coreVol * headFade * tailFade * turbMask * uOpacity * clamp(0.45 + 0.55 * uIntensity, 0.25, 1.45);
      float alpha = baseA + shock * coreVol * 0.28 * uOpacity;
      if (alpha < 0.008) discard;
      gl_FragColor = vec4(col, clamp(alpha, 0.0, mix(0.88, 0.96, uIsCore)));
    }
  `;

  // Outer fiery crimson shear plume
  const outerGeo = buildJetConeGeometry(length, rStart, rEnd * 1.18, 56, 48);
  const outerMat = new THREE.ShaderMaterial({
    vertexShader: jetVert,
    fragmentShader: jetFrag,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: baseIntensity },
      uOpacity: { value: baseOpacity * 0.62 },
      uIsCore: { value: 0.0 },
      uMachFreq: { value: machFreq },
      uDarkMode: { value: 0 },
      uFlutter: { value: rStart * 0.14 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  outerMat.userData.isJetPlume = true;
  const outerMesh = new THREE.Mesh(outerGeo, outerMat);
  outerMesh.name = "jetPlume_outer";
  outerMesh.renderOrder = 5;
  outerMesh.userData.isJetPlume = true;
  plumeContainer.add(outerMesh);

  // Inner incandescent supersonic lance + Mach diamonds
  const innerGeo = buildJetConeGeometry(length * 0.86, rStart * 0.54, rEnd * 0.26, 48, 40);
  const innerMat = new THREE.ShaderMaterial({
    vertexShader: jetVert,
    fragmentShader: jetFrag,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: baseIntensity },
      uOpacity: { value: baseOpacity * 0.88 },
      uIsCore: { value: 1.0 },
      uMachFreq: { value: machFreq },
      uDarkMode: { value: 0 },
      uFlutter: { value: rStart * 0.06 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  innerMat.userData.isJetPlume = true;
  const innerMesh = new THREE.Mesh(innerGeo, innerMat);
  innerMesh.name = "jetPlume_inner";
  innerMesh.renderOrder = 6;
  innerMesh.userData.isJetPlume = true;
  plumeContainer.add(innerMesh);

  // Fast kinetic ember / plasma sparks racing strictly inside the exhaust plume
  const sparkCount = Math.max(12, Math.round(opts.sparkCount ?? 46));
  const sparkGeo = new THREE.SphereGeometry(Math.max(0.007, rStart * 0.032), 6, 6);
  sparkGeo.scale(3.8, 0.38, 0.38); // subtle kinetic velocity ember along +X

  const sparkMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  });
  sparkMat.userData.isJetPlume = true;

  const sparks = new THREE.InstancedMesh(sparkGeo, sparkMat, sparkCount);
  sparks.name = "jetPlume_sparks";
  sparks.renderOrder = 7;
  sparks.frustumCulled = false;
  sparks.userData.isJetPlume = true;
  plumeContainer.add(sparks);

  interface SparkState {
    phase: number;
    angle: number;
    radialFrac: number;
    speedJitter: number;
    sizeScale: number;
  }

  const sparkStates: SparkState[] = [];
  for (let i = 0; i < sparkCount; i++) {
    sparkStates.push({
      phase: (i * 0.6180339887) % 1,
      angle: (i * 2.399963229728653) % (Math.PI * 2),
      radialFrac: 0.1 + 0.72 * (((i * 7 + 1) * 0.381966) % 1),
      speedJitter: 0.8 + 0.55 * (((i * 11 + 3) * 0.271828) % 1),
      sizeScale: 0.65 + 0.7 * (((i * 5 + 2) * 0.414213) % 1),
    });
  }

  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scaleVec = new THREE.Vector3();
  const mat4 = new THREE.Matrix4();
  const sparkColor = new THREE.Color();
  const cHot = new THREE.Color(0xfff1c2);
  const cMid = new THREE.Color(0xff5e14);
  const cTail = new THREE.Color(0xdc2626);
  let simTime = 0;

  const update = (dt: number, updateOpts: JetPlumeUpdateOptions = {}): void => {
    const safeDt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.25)) : 0;
    const speedScale = updateOpts.speedScale ?? 1;
    const intensity = Math.max(0.15, updateOpts.intensity ?? baseIntensity);
    const lengthScale = Math.max(0.35, Math.min(2.2, updateOpts.lengthScale ?? 1));
    const opacityScale = Math.max(0, Math.min(2, updateOpts.opacityScale ?? 1));

    simTime += safeDt * baseSpeed * speedScale;
    plumeContainer.scale.set(lengthScale, 0.88 + 0.18 * Math.min(1.6, intensity), 0.88 + 0.18 * Math.min(1.6, intensity));

    const darkFlag =
      typeof updateOpts.darkMode === "boolean"
        ? updateOpts.darkMode
          ? 1
          : 0
        : typeof group.userData.darkMode === "number"
          ? (group.userData.darkMode as number)
          : 0;

    const focusOpacity =
      typeof group.userData.focusOpacityScale === "number"
        ? group.userData.focusOpacityScale
        : 1;
    const revealAlpha =
      typeof group.userData.revealAlpha === "number"
        ? group.userData.revealAlpha
        : 1;
    const effOpacity = baseOpacity * opacityScale * focusOpacity * revealAlpha;

    for (const [sm, mult] of [
      [outerMat, 0.64],
      [innerMat, 0.88],
    ] as const) {
      (sm.uniforms.uTime as { value: number }).value = simTime;
      (sm.uniforms.uIntensity as { value: number }).value = intensity;
      (sm.uniforms.uOpacity as { value: number }).value = effOpacity * mult;
      (sm.uniforms.uDarkMode as { value: number }).value = darkFlag;
    }

    sparkMat.opacity = Math.min(0.76, effOpacity * 0.68);
    const streakStretch = 0.72 + 0.42 * Math.min(2.0, speedScale);

    for (let i = 0; i < sparkStates.length; i++) {
      const s = sparkStates[i]!;
      s.phase = (((s.phase + safeDt * baseSpeed * 0.92 * speedScale * s.speedJitter) % 1) + 1) % 1;
      const t = s.phase;
      // Keep kinetic embers strictly inside the sculpted plume envelope (0..0.82)
      const x = t * length * 0.82;
      const coneR = (rStart + (rEnd - rStart) * t) * 0.78;
      const rad = coneR * s.radialFrac;
      const ang = s.angle + t * 1.4;
      pos.set(x, Math.sin(ang) * rad, Math.cos(ang) * rad);

      const env = Math.sin(t * Math.PI) * Math.pow(Math.max(0, 1 - t), 0.7);
      const sz = Math.max(0.12, s.sizeScale * (0.2 + 0.8 * env));
      scaleVec.set(sz * streakStretch, sz, sz);
      mat4.compose(pos, quat, scaleVec);
      sparks.setMatrixAt(i, mat4);

      if (t < 0.35) {
        sparkColor.copy(cHot).lerp(cMid, t / 0.35);
      } else {
        sparkColor.copy(cMid).lerp(cTail, (t - 0.35) / 0.65);
      }
      sparks.setColorAt(i, sparkColor);
    }

    sparks.instanceMatrix.needsUpdate = true;
    if (sparks.instanceColor) sparks.instanceColor.needsUpdate = true;
  };

  update(0);

  group.userData.outerMesh = outerMesh;
  group.userData.innerMesh = innerMesh;
  group.userData.sparksMesh = sparks;
  return { group, update };
}

/* -------------------------------------------------------------------------- */
/*  Primitive 13: boxPlate                                                    */
/* -------------------------------------------------------------------------- */

export interface BoxPlateOptions {
  w: number;
  h: number;
  d: number;
  tone?: MonochromeKey;
  roughness?: number;
  metalness?: number;
  edgeThresholdDeg?: number;
}

/**
 * Crisp architectural solid plate, block, wall, or cap with matte-clay PBR
 * material and architectural contour lines.
 */
export function boxPlate(opts: BoxPlateOptions): THREE.Group {
  const group = new THREE.Group();
  group.name = "boxPlate";

  const w = Math.max(1e-3, opts.w);
  const h = Math.max(1e-3, opts.h);
  const d = Math.max(1e-3, opts.d);

  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = createClayMaterial(opts.tone ?? "clayMid", {
    roughness: opts.roughness,
    metalness: opts.metalness,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "boxPlate_body";
  configureSolidMesh(mesh, opts.edgeThresholdDeg ?? 18);
  group.add(mesh);

  group.userData.plateMesh = mesh;
  return group;
}

/* -------------------------------------------------------------------------- */
/*  Primitive 14: gasVolume                                                   */
/* -------------------------------------------------------------------------- */

export interface GasVolumeOptions {
  height: number;
  radius: number;
  y0?: number;
  openDeg?: number;
  startDeg?: number;
  color?: AccentKey | number;
  opacity?: number;
  segments?: number;
}

export interface GasVolumeHandle {
  group: THREE.Group;
  setHeight(h: number): void;
  setColor(hexOrAccent: AccentKey | number): void;
  setOpacity(o: number): void;
}

/**
 * Live compressible combustion / pneumatic cutaway gas cylinder along the Y-axis
 * with smooth dynamic height, color (e.g. cool intake blue -> fiery combustion
 * red), and opacity control without geometry reallocation.
 */
export function gasVolume(opts: GasVolumeOptions): GasVolumeHandle {
  const group = new THREE.Group();
  group.name = "gasVolume";
  group.userData.isGas = true;

  const initHeight = Math.max(0.01, opts.height);
  const radius = Math.max(0.01, opts.radius);
  const y0 = opts.y0 ?? 0;
  const openDeg = opts.openDeg ?? 132;
  const baseHex = resolveAccentHex(opts.color ?? "cobalt");
  const initOpacity = opts.opacity ?? 0.55;

  const geo = buildLiquidVolumeGeometry({
    height: 1,
    radius,
    y0: 0,
    openDeg,
    startDeg: opts.startDeg,
    segments: opts.segments,
  });

  const mat = new THREE.MeshStandardMaterial({
    color: baseHex,
    emissive: baseHex,
    emissiveIntensity: 0.28,
    roughness: 0.28,
    metalness: 0.02,
    transparent: true,
    opacity: initOpacity,
    depthWrite: false,
  });
  mat.userData.isGas = true;
  mat.userData.baseColorHex = baseHex;
  mat.userData.baseOpacity = initOpacity;
  mat.userData.baseTransparent = true;

  const scaleGroup = new THREE.Group();
  scaleGroup.name = "gasVolume_scale";
  scaleGroup.position.y = y0;
  group.add(scaleGroup);

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "gasVolume_body";
  mesh.renderOrder = 3;
  mesh.userData.isGas = true;
  scaleGroup.add(mesh);

  const setHeight = (h: number): void => {
    const safeH = Number.isFinite(h) ? Math.max(0.01, h) : initHeight;
    scaleGroup.scale.y = safeH;
    group.userData.currentHeight = safeH;
  };

  const setColor = (hexOrAccent: AccentKey | number): void => {
    const hex = resolveAccentHex(hexOrAccent);
    mat.color.setHex(hex);
    mat.emissive.setHex(hex);
    mat.userData.baseColorHex = hex;
  };

  const setOpacity = (o: number): void => {
    const clamped = Number.isFinite(o) ? Math.max(0, Math.min(1, o)) : initOpacity;
    mat.userData.baseOpacity = clamped;
    mat.opacity = clamped;
  };

  setHeight(initHeight);

  group.userData.gasMesh = mesh;
  group.userData.scaleGroup = scaleGroup;
  group.userData.setHeight = setHeight;
  group.userData.setColor = setColor;
  group.userData.setOpacity = setOpacity;

  return { group, setHeight, setColor, setOpacity };
}

/* -------------------------------------------------------------------------- */
/*  createStudioStage — Orthographic Museum Studio & Director Bridge          */
/* -------------------------------------------------------------------------- */

export interface CameraPresetConfig {
  position: [number, number, number];
  target: [number, number, number];
  zoom?: number;
}

export interface StudioStageOptions {
  theme?: StudioTheme;
  frustumSize?: number;
  cameraPresets?: Record<string, CameraPresetConfig>;
  initialCamera?: string;
  pixelRatioCap?: number;
}

export interface RegisterPartOptions {
  anchor?: [number, number, number];
  accent?: AccentKey;
}

export interface ProjectedAnchor {
  x: number;
  y: number;
  visible: boolean;
}

const _anchorProjVec = new THREE.Vector3();
const _anchorTmpBox = new THREE.Box3();

/**
 * Project a registered part's local anchor (or bounding-box center) into screen
 * pixel coordinates using the part object's own world matrix so callouts track
 * moving/animated parts automatically.
 */
export function projectObjectAnchor(
  object: THREE.Object3D,
  anchor: THREE.Vector3 | undefined,
  camera: THREE.Camera,
  width: number,
  height: number,
  isRevealed = true,
): ProjectedAnchor {
  object.updateWorldMatrix(true, false);
  camera.updateMatrixWorld(true);

  if (anchor) {
    _anchorProjVec.copy(anchor).applyMatrix4(object.matrixWorld);
  } else {
    _anchorTmpBox.setFromObject(object);
    if (_anchorTmpBox.isEmpty()) {
      object.getWorldPosition(_anchorProjVec);
    } else {
      _anchorTmpBox.getCenter(_anchorProjVec);
    }
  }

  _anchorProjVec.project(camera);
  const x = (_anchorProjVec.x * 0.5 + 0.5) * width;
  const y = (-_anchorProjVec.y * 0.5 + 0.5) * height;
  const visible =
    object.visible &&
    isRevealed &&
    _anchorProjVec.z >= -1 &&
    _anchorProjVec.z <= 1 &&
    x >= -48 &&
    x <= width + 48 &&
    y >= -48 &&
    y <= height + 48;

  return { x, y, visible };
}

export interface StudioStage {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  root: THREE.Group;
  registerPart(
    id: string,
    obj: THREE.Object3D,
    opts?: RegisterPartOptions,
  ): void;
  setFocus(
    ids: string[] | null,
    accentOverrides?: Record<string, AccentKey>,
  ): void;
  setReveal(ids: string[] | null): void;
  goToCamera(preset: string, zoom?: number): void;
  resetCamera(): void;
  setCameraPreset(name: string, config: CameraPresetConfig): void;
  getRegisteredIds(): string[];
  getCameraPresets(): string[];
  projectAnchor(id: string): ProjectedAnchor | null;
  setTheme(theme: StudioTheme): void;
  render(dt: number): void;
  resize(): void;
  dispose(): void;
}

const DEFAULT_CAMERA_PRESETS: Record<string, CameraPresetConfig> = {
  hero: { position: [8.5, 4.8, 9.2], target: [0, 0, 0], zoom: 1.0 },
  iso: { position: [8.5, 4.8, 9.2], target: [0, 0, 0], zoom: 1.0 },
  side: { position: [0, 0.7, 12.5], target: [0, 0, 0], zoom: 1.05 },
  front: { position: [-11.0, 2.2, 5.5], target: [0, 0, 0], zoom: 1.05 },
  intake: { position: [-10.5, 2.6, 6.2], target: [-1.4, 0, 0], zoom: 1.25 },
  rear: { position: [11.0, 2.2, 5.5], target: [0, 0, 0], zoom: 1.05 },
  exhaust: { position: [10.5, 2.4, 6.0], target: [1.6, 0, 0], zoom: 1.25 },
  top: { position: [0, 12.5, 2.4], target: [0, 0, 0], zoom: 1.0 },
  closeup: { position: [2.4, 2.2, 7.2], target: [0, 0, 0], zoom: 1.45 },
};

interface MaterialEntry {
  material: THREE.MeshStandardMaterial;
  baseColor: THREE.Color;
  baseOpacity: number;
  baseTransparent: boolean;
  isFlame: boolean;
  isFlowRibbon: boolean;
  isGlass: boolean;
  isLiquid: boolean;
  isGas: boolean;
  isMistCone: boolean;
}

interface EdgeEntry {
  material: THREE.LineBasicMaterial;
  baseOpacity: number;
}

interface RegisteredPart {
  id: string;
  object: THREE.Object3D;
  anchor?: THREE.Vector3;
  accent: AccentKey;
  baseScale: THREE.Vector3;
  materials: MaterialEntry[];
  shaderFlames: THREE.ShaderMaterial[];
  edges: EdgeEntry[];
  dynamicSubgroups: THREE.Object3D[];
  revealTarget: number;
  revealAlpha: number;
  wasRevealing: boolean;
  focusWeight: number;
  dimWeight: number;
  targetAccentHex: number;
}

interface CameraTransition {
  targetPos: THREE.Vector3;
  targetLookAt: THREE.Vector3;
  targetZoom: number;
}

export function createStudioStage(
  canvas: HTMLCanvasElement,
  opts: StudioStageOptions = {},
): StudioStage {
  const frustumSize = opts.frustumSize ?? 7.5;
  const pixelRatioCap = opts.pixelRatioCap ?? 2;
  let currentTheme: StudioTheme = opts.theme ?? "light";

  const presets: Record<string, CameraPresetConfig> = {
    ...DEFAULT_CAMERA_PRESETS,
    ...(opts.cameraPresets ?? {}),
  };
  const initialCameraName = opts.initialCamera ?? "hero";

  // Scene & Root Group
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.name = "studio_root";
  scene.add(root);

  // Renderer
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // PMREM Studio Room Environment
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  const envTarget = pmrem.fromScene(roomEnv, 0.04);
  scene.environment = envTarget.texture;
  roomEnv.dispose();

  // Four-Point Architectural Museum Lighting Rig
  const keyLight = new THREE.DirectionalLight(0xfff6ea, 1.85);
  keyLight.position.set(7.5, 11.5, 8.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.bias = -0.0004;
  keyLight.shadow.normalBias = 0.02;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 36;
  keyLight.shadow.camera.left = -8.5;
  keyLight.shadow.camera.right = 8.5;
  keyLight.shadow.camera.top = 8.5;
  keyLight.shadow.camera.bottom = -8.5;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xdce8ff, 0.75);
  fillLight.position.set(-9, 5.5, 6);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xfff2e2, 0.55);
  rimLight.position.set(-4, 7.5, -10.5);
  scene.add(rimLight);

  const hemiLight = new THREE.HemisphereLight(0xf8f7f2, 0xc8c5bc, 0.68);
  scene.add(hemiLight);

  // Orthographic Studio Camera
  const getViewportSize = (): { width: number; height: number } => {
    const w = canvas.clientWidth || canvas.width || 800;
    const h = canvas.clientHeight || canvas.height || 600;
    return { width: Math.max(1, w), height: Math.max(1, h) };
  };

  const { width: initW, height: initH } = getViewportSize();
  const initAspect = initW / initH;
  const camera = new THREE.OrthographicCamera(
    (-frustumSize * initAspect) / 2,
    (frustumSize * initAspect) / 2,
    frustumSize / 2,
    -frustumSize / 2,
    -50,
    120,
  );

  // Smooth damped OrbitControls
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.minZoom = 0.45;
  controls.maxZoom = 4.2;
  controls.maxPolarAngle = Math.PI * 0.88;
  controls.minPolarAngle = Math.PI * 0.06;

  let cameraTransition: CameraTransition | null = null;
  const onControlStart = (): void => {
    // Immediately yield Director camera transition when the user drags/zooms.
    cameraTransition = null;
  };
  controls.addEventListener("start", onControlStart);

  // Position initial camera immediately (no initial swoop)
  const initPreset = presets[initialCameraName] ?? DEFAULT_CAMERA_PRESETS.hero!;
  camera.position.set(...initPreset.position);
  controls.target.set(...initPreset.target);
  camera.zoom = initPreset.zoom ?? 1.0;
  camera.updateProjectionMatrix();
  controls.update();

  // Registered parts & state
  const parts = new Map<string, RegisteredPart>();
  const claimedMaterials = new Set<THREE.Material>();
  let focusedIds: Set<string> | null = null;
  let focusAccentOverrides: Record<string, AccentKey> = {};

  // Scratch colors & vectors (avoid allocations per frame)
  const tmpColor = new THREE.Color();
  const accentColor = new THREE.Color();
  const dimTargetLight = new THREE.Color(0xe6e4dc);
  const dimTargetDark = new THREE.Color(0x6b6f78);
  const blackColor = new THREE.Color(0x000000);

  const applyThemeToScene = (theme: StudioTheme): void => {
    currentTheme = theme;
    if (theme === "dark") {
      scene.background = new THREE.Color(0x111317);
      scene.environmentIntensity = 0.55;
      keyLight.intensity = 2.15;
      fillLight.intensity = 0.62;
      rimLight.intensity = 1.05;
      hemiLight.color.setHex(0xd8dde8);
      hemiLight.groundColor.setHex(0x1e222b);
      hemiLight.intensity = 0.42;
    } else {
      scene.background = new THREE.Color(0xf6f5f0);
      scene.environmentIntensity = 0.72;
      keyLight.intensity = 1.85;
      fillLight.intensity = 0.75;
      rimLight.intensity = 0.52;
      hemiLight.color.setHex(0xf8f7f2);
      hemiLight.groundColor.setHex(0xc8c5bc);
      hemiLight.intensity = 0.68;
    }

    // Update baseMount & theme-adaptive volumetric airflow / jet plume materials
    scene.traverse((obj) => {
      if (obj.userData.isAirVolume || obj.userData.isJetPlume) {
        obj.userData.darkMode = theme === "dark" ? 1 : 0;
      }
      if (obj.userData.isBaseMount) {
        const shadowMat = obj.userData.shadowMaterial as
          | THREE.ShadowMaterial
          | undefined;
        const contactMat = obj.userData.contactMaterial as
          | THREE.ShaderMaterial
          | undefined;
        const ringMat = obj.userData.ringMaterial as
          | THREE.LineBasicMaterial
          | undefined;
        if (shadowMat) {
          shadowMat.opacity = theme === "dark" ? 0.12 : 0.04;
          shadowMat.color.setHex(theme === "dark" ? 0x050608 : 0x181a1f);
        }
        if (contactMat && contactMat.uniforms) {
          const uColor = contactMat.uniforms.uColor as { value: THREE.Color } | undefined;
          const uOpacity = contactMat.uniforms.uOpacity as { value: number } | undefined;
          if (uColor) uColor.value.setHex(theme === "dark" ? 0x040507 : 0x181a1f);
          if (uOpacity) uOpacity.value = theme === "dark" ? 0.44 : 0.2;
        }
        if (ringMat) {
          ringMat.color.setHex(
            theme === "dark" ? 0xffffff : ARCHITECTURAL_EDGE_COLOR,
          );
          ringMat.opacity = theme === "dark" ? 0.12 : 0.09;
        }
      }
    });
  };

  applyThemeToScene(currentTheme);

  const resize = (): void => {
    const { width, height } = getViewportSize();
    const aspect = width / height;
    camera.left = (-frustumSize * aspect) / 2;
    camera.right = (frustumSize * aspect) / 2;
    camera.top = frustumSize / 2;
    camera.bottom = -frustumSize / 2;
    camera.updateProjectionMatrix();

    const dpr =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    renderer.setPixelRatio(Math.min(dpr, pixelRatioCap));
    renderer.setSize(width, height, false);
  };

  resize();

  const registerPart = (
    id: string,
    obj: THREE.Object3D,
    partOpts: RegisterPartOptions = {},
  ): void => {
    if (!obj.parent) {
      root.add(obj);
    }

    const materialEntries: MaterialEntry[] = [];
    const shaderFlames: THREE.ShaderMaterial[] = [];
    const edgeEntries: EdgeEntry[] = [];
    const dynamicSubgroups: THREE.Object3D[] = [];
    const seenMat = new Set<THREE.Material>();

    obj.traverse((child) => {
      if (
        child.userData.isFlowRibbon ||
        child.userData.isMistCone ||
        child.userData.isAirVolume ||
        child.userData.isJetPlume
      ) {
        if (child.userData.isAirVolume || child.userData.isJetPlume) {
          child.userData.darkMode = currentTheme === "dark" ? 1 : 0;
        }
        dynamicSubgroups.push(child);
      }
      if (child instanceof THREE.Mesh) {
        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];
        const nextMats = mats.map((m) => {
          if (m instanceof THREE.ShaderMaterial && m.userData.isShaderFlame) {
            let targetShader = m;
            if (claimedMaterials.has(m)) {
              targetShader = m.clone();
              targetShader.userData = { ...m.userData };
            }
            claimedMaterials.add(targetShader);
            if (!seenMat.has(targetShader)) {
              seenMat.add(targetShader);
              shaderFlames.push(targetShader);
            }
            return targetShader;
          }
          if (!(m instanceof THREE.MeshStandardMaterial)) return m;
          let targetMat = m;
          if (claimedMaterials.has(m)) {
            targetMat = m.clone();
            targetMat.userData = { ...m.userData };
          }
          claimedMaterials.add(targetMat);
          if (!seenMat.has(targetMat)) {
            seenMat.add(targetMat);
            materialEntries.push({
              material: targetMat,
              baseColor: targetMat.color.clone(),
              baseOpacity:
                typeof targetMat.userData.baseOpacity === "number"
                  ? targetMat.userData.baseOpacity
                  : targetMat.opacity,
              baseTransparent:
                typeof targetMat.userData.baseTransparent === "boolean"
                  ? targetMat.userData.baseTransparent
                  : targetMat.transparent,
              isFlame: Boolean(
                child.userData.isFlame || targetMat.userData.isFlame,
              ),
              isFlowRibbon: Boolean(
                obj.userData.isFlowRibbon ||
                  child.userData.isFlowRibbon ||
                  targetMat.userData.isFlowRibbon,
              ),
              isGlass: Boolean(
                obj.userData.isGlass ||
                  child.userData.isGlass ||
                  targetMat.userData.isGlass,
              ),
              isLiquid: Boolean(
                obj.userData.isLiquid ||
                  child.userData.isLiquid ||
                  targetMat.userData.isLiquid,
              ),
              isGas: Boolean(
                obj.userData.isGas ||
                  child.userData.isGas ||
                  targetMat.userData.isGas,
              ),
              isMistCone: Boolean(
                obj.userData.isMistCone ||
                  child.userData.isMistCone ||
                  targetMat.userData.isMistCone,
              ),
            });
          }
          return targetMat;
        });

        child.material = Array.isArray(child.material)
          ? nextMats
          : (nextMats[0] ?? child.material);
      } else if (
        child instanceof THREE.LineSegments &&
        child.userData.isArchitecturalEdge &&
        child.material instanceof THREE.LineBasicMaterial
      ) {
        let edgeMat = child.material;
        if (claimedMaterials.has(edgeMat)) {
          edgeMat = edgeMat.clone();
          edgeMat.userData = { ...child.material.userData };
          child.material = edgeMat;
        }
        claimedMaterials.add(edgeMat);
        edgeEntries.push({
          material: edgeMat,
          baseOpacity:
            typeof edgeMat.userData.baseOpacity === "number"
              ? edgeMat.userData.baseOpacity
              : ARCHITECTURAL_EDGE_OPACITY,
        });
      }
    });

    const accent: AccentKey = partOpts.accent ?? "orange";
    const entry: RegisteredPart = {
      id,
      object: obj,
      anchor: partOpts.anchor
        ? new THREE.Vector3(...partOpts.anchor)
        : undefined,
      accent,
      baseScale: obj.scale.clone(),
      materials: materialEntries,
      shaderFlames,
      edges: edgeEntries,
      dynamicSubgroups,
      revealTarget: 1,
      revealAlpha: 1,
      wasRevealing: false,
      focusWeight: 0,
      dimWeight: 0,
      targetAccentHex: ACCENT_TOKENS[accent],
    };

    parts.set(id, entry);
  };

  const getRegisteredIds = (): string[] => Array.from(parts.keys());
  const getCameraPresets = (): string[] => Object.keys(presets);

  const setFocus = (
    ids: string[] | null,
    accentOverrides: Record<string, AccentKey> = {},
  ): void => {
    focusAccentOverrides = { ...accentOverrides };
    if (!ids || ids.length === 0) {
      focusedIds = null;
      return;
    }
    for (const id of ids) {
      if (!parts.has(id)) {
        console.error(`[engine-a] Unknown focus part id "${id}"`);
      }
    }
    focusedIds = new Set(ids);
    for (const part of parts.values()) {
      const override = focusAccentOverrides[part.id];
      const accentKey = override ?? part.accent;
      part.targetAccentHex = ACCENT_TOKENS[accentKey];
    }
  };

  const setReveal = (ids: string[] | null): void => {
    if (ids === null) {
      for (const part of parts.values()) {
        part.revealTarget = 1;
      }
      return;
    }
    for (const id of ids) {
      if (!parts.has(id)) {
        console.error(`[engine-a] Unknown reveal part id "${id}"`);
      }
    }
    const revealed = new Set(ids);
    for (const part of parts.values()) {
      part.revealTarget = revealed.has(part.id) ? 1 : 0;
    }
  };

  const setCameraPreset = (name: string, config: CameraPresetConfig): void => {
    presets[name] = config;
  };

  const goToCamera = (preset: string, zoom?: number): void => {
    if (!(preset in presets)) {
      console.error(`[engine-a] Unknown camera preset "${preset}"`);
    }
    const cfg = presets[preset] ?? presets.hero ?? DEFAULT_CAMERA_PRESETS.hero!;
    cameraTransition = {
      targetPos: new THREE.Vector3(...cfg.position),
      targetLookAt: new THREE.Vector3(...cfg.target),
      targetZoom: zoom ?? cfg.zoom ?? 1.0,
    };
  };

  const resetCamera = (): void => {
    goToCamera(initialCameraName);
  };

  const projectAnchor = (id: string): ProjectedAnchor | null => {
    const part = parts.get(id);
    if (!part) return null;

    root.updateMatrixWorld(true);
    const { width, height } = getViewportSize();
    return projectObjectAnchor(
      part.object,
      part.anchor,
      camera,
      width,
      height,
      part.revealAlpha > 0.05,
    );
  };

  const render = (dt: number): void => {
    const safeDt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0.016;
    const ease = 1 - Math.exp(-safeDt * 8.5);
    const camEase = 1 - Math.exp(-safeDt * 6.5);

    // Smooth Director camera lerp (automatically cancelled on user drag)
    if (cameraTransition) {
      camera.position.lerp(cameraTransition.targetPos, camEase);
      controls.target.lerp(cameraTransition.targetLookAt, camEase);
      camera.zoom += (cameraTransition.targetZoom - camera.zoom) * camEase;
      camera.updateProjectionMatrix();

      const posDone =
        camera.position.distanceToSquared(cameraTransition.targetPos) < 1e-4;
      const tgtDone =
        controls.target.distanceToSquared(cameraTransition.targetLookAt) < 1e-4;
      const zoomDone =
        Math.abs(camera.zoom - cameraTransition.targetZoom) < 2e-3;
      if (posDone && tgtDone && zoomDone) {
        camera.position.copy(cameraTransition.targetPos);
        controls.target.copy(cameraTransition.targetLookAt);
        camera.zoom = cameraTransition.targetZoom;
        camera.updateProjectionMatrix();
        cameraTransition = null;
      }
    }

    controls.update();

    // Update progressive reveal + dim & illuminate per registered part
    const dimTint = currentTheme === "dark" ? dimTargetDark : dimTargetLight;

    for (const part of parts.values()) {
      // Reveal glide
      part.revealAlpha += (part.revealTarget - part.revealAlpha) * ease;
      if (Math.abs(part.revealTarget - part.revealAlpha) < 0.004) {
        part.revealAlpha = part.revealTarget;
      }

      const isVisible = part.revealAlpha > 0.01;
      part.object.visible = isVisible;
      part.object.userData.revealAlpha = part.revealAlpha;

      if (part.revealAlpha < 0.999) {
        part.wasRevealing = true;
        const scaleMult = 0.88 + 0.12 * part.revealAlpha;
        part.object.scale.copy(part.baseScale).multiplyScalar(scaleMult);
      } else if (part.wasRevealing) {
        part.object.scale.copy(part.baseScale);
        part.wasRevealing = false;
      }

      // Focus / Dim targets
      const isFocusMode = focusedIds !== null && focusedIds.size > 0;
      const isFocused = isFocusMode && focusedIds!.has(part.id);
      const targetFocus = isFocused ? 1 : 0;
      const targetDim = isFocusMode && !isFocused ? 1 : 0;

      part.focusWeight += (targetFocus - part.focusWeight) * ease;
      part.dimWeight += (targetDim - part.dimWeight) * ease;

      // Propagate focus opacity scale & revealAlpha for animated flowRibbons / mistCones
      const focusOpacityScale = 1 - 0.72 * part.dimWeight;
      part.object.userData.focusOpacityScale = focusOpacityScale;
      for (const sub of part.dynamicSubgroups) {
        sub.userData.revealAlpha = part.revealAlpha;
        sub.userData.focusOpacityScale = focusOpacityScale;
      }

      // Update volumetric shader flames (time + reveal + dim modulation)
      for (const sm of part.shaderFlames) {
        const uTime = sm.uniforms.uTime as { value: number } | undefined;
        const uOpacity = sm.uniforms.uOpacity as { value: number } | undefined;
        if (uTime) uTime.value += safeDt;
        if (uOpacity) {
          const baseOp =
            typeof sm.userData.baseOpacity === "number"
              ? (sm.userData.baseOpacity as number)
              : 0.92;
          uOpacity.value = baseOp * part.revealAlpha * (1 - 0.65 * part.dimWeight);
        }
      }

      // Update structural clay & accent materials
      accentColor.setHex(part.targetAccentHex);
      for (const m of part.materials) {
        if (m.isFlame) {
          m.material.opacity =
            m.baseOpacity * part.revealAlpha * (1 - 0.65 * part.dimWeight);
          continue;
        }
        if (m.isFlowRibbon || m.isMistCone) {
          // FlowRibbon & MistCone's own update() multiplies by userData.focusOpacityScale & revealAlpha
          continue;
        }
        if (m.isGlass) {
          tmpColor.copy(m.baseColor);
          if (part.focusWeight > 0.001) {
            tmpColor.lerp(accentColor, part.focusWeight * 0.24);
          }
          m.material.color.copy(tmpColor);
          m.material.emissive.copy(part.focusWeight > 0.001 ? accentColor : blackColor);
          m.material.emissiveIntensity = part.focusWeight * 0.08;
          m.material.transparent = true;
          m.material.opacity = Math.min(
            0.85,
            m.baseOpacity *
              part.revealAlpha *
              (1 + 0.22 * part.focusWeight) *
              (1 - 0.45 * part.dimWeight),
          );
          continue;
        }
        if (m.isLiquid || m.isGas) {
          // Preserve dynamic liquid/gas colors (e.g. cool blue -> fiery red) set by scene updates;
          // only modulate opacity by revealAlpha * focusOpacityScale.
          const effBaseOpacity =
            typeof m.material.userData.baseOpacity === "number"
              ? (m.material.userData.baseOpacity as number)
              : m.baseOpacity;
          m.material.transparent = true;
          m.material.opacity = Math.min(
            0.96,
            effBaseOpacity * part.revealAlpha * focusOpacityScale,
          );
          continue;
        }

        tmpColor.copy(m.baseColor);
        if (part.dimWeight > 0.001) {
          tmpColor.lerp(dimTint, part.dimWeight * 0.56);
        }
        if (part.focusWeight > 0.001) {
          tmpColor.lerp(accentColor, part.focusWeight * 0.66);
        }
        m.material.color.copy(tmpColor);

        if (part.focusWeight > 0.001) {
          m.material.emissive.copy(accentColor);
          m.material.emissiveIntensity = part.focusWeight * 0.16;
        } else {
          m.material.emissive.copy(blackColor);
          m.material.emissiveIntensity = 0;
        }

        // Keep dimmed solid hardware strictly opaque (zero WebGL alpha-sorting shimmer);
        // only enable transparency during progressive reveal fade-in/out.
        const finalOpacity = m.baseOpacity * part.revealAlpha;
        const needsTransparent = m.baseTransparent || finalOpacity < 0.995;
        if (m.material.transparent !== needsTransparent) {
          m.material.transparent = needsTransparent;
          m.material.needsUpdate = true;
        }
        m.material.opacity = finalOpacity;
      }

      // Update architectural contour edges
      for (const e of part.edges) {
        let targetEdgeOpacity = e.baseOpacity;
        if (part.focusWeight > 0.001) {
          targetEdgeOpacity =
            e.baseOpacity +
            (ARCHITECTURAL_EDGE_FOCUS_OPACITY - e.baseOpacity) *
              part.focusWeight;
        }
        if (part.dimWeight > 0.001) {
          targetEdgeOpacity =
            targetEdgeOpacity +
            (ARCHITECTURAL_EDGE_DIM_OPACITY - targetEdgeOpacity) *
              part.dimWeight;
        }
        e.material.opacity = targetEdgeOpacity * part.revealAlpha;
      }
    }

    renderer.render(scene, camera);
  };

  const dispose = (): void => {
    controls.removeEventListener("start", onControlStart);
    controls.dispose();
    envTarget.dispose();
    pmrem.dispose();
    renderer.dispose();
  };

  return {
    scene,
    camera,
    renderer,
    controls,
    root,
    registerPart,
    setFocus,
    setReveal,
    goToCamera,
    resetCamera,
    setCameraPreset,
    getRegisteredIds,
    getCameraPresets,
    projectAnchor,
    setTheme: applyThemeToScene,
    render,
    resize,
    dispose,
  };
}
