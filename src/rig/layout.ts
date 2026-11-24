// Model-agnostic spatial layout solvers and deterministic geometric verifiers.
// Eliminates raw (x, y, z) coordinate guesswork for gear trains, vertical/horizontal flow spines,
// exploded layer stacks, collision clearance, and cavity fill proportion checks.

import type { V3 } from "./vec.ts";

const DEG2RAD = Math.PI / 180;

const need = (ok: boolean, msg: string): void => {
  if (!ok) throw new RangeError(msg);
};

const finite = (v: number, name: string): void =>
  need(Number.isFinite(v), `${name} must be a finite number, got ${v}`);

const positive = (v: number, name: string): void =>
  need(Number.isFinite(v) && v > 0, `${name} must be a positive number, got ${v}`);

const nonNeg = (v: number, name: string): void =>
  need(Number.isFinite(v) && v >= 0, `${name} must be a non-negative number, got ${v}`);

const pairKey = (a: string, b: string): string => (a < b ? `${a}\0${b}` : `${b}\0${a}`);

// ---------------------------------------------------------------- collision checking

export interface CollisionItem {
  name: string;
  x: number;
  y: number;
  r: number;
  layer?: number;
}

export interface CollisionOptions {
  minGap?: number;
  ignorePairs?: readonly [string, string][];
}

/**
 * Deterministic 2D/layered clearance verifier.
 * Throws a detailed Error naming the colliding pair and exact overlap if
 * `dist < rA + rB + minGap` for any non-ignored pair sharing the same `layer`.
 */
export function assertNoCollisions(
  items: readonly CollisionItem[],
  opts: CollisionOptions = {},
): void {
  const minGap = opts.minGap ?? 0;
  finite(minGap, "minGap");

  const ignored = new Set<string>();
  for (const [a, b] of opts.ignorePairs ?? []) {
    ignored.add(pairKey(a, b));
  }

  for (let i = 0; i < items.length; i++) {
    const a = items[i]!;
    finite(a.x, `${a.name}.x`);
    finite(a.y, `${a.name}.y`);
    nonNeg(a.r, `${a.name}.r`);
  }

  for (let i = 0; i < items.length; i++) {
    const a = items[i]!;
    const layerA = a.layer ?? 0;
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j]!;
      const layerB = b.layer ?? 0;
      if (layerA !== layerB) continue;
      if (ignored.has(pairKey(a.name, b.name))) continue;

      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const req = a.r + b.r + minGap;
      if (dist < req - 1e-9) {
        const overlap = req - dist;
        throw new Error(
          `Collision on layer ${layerA} between "${a.name}" and "${b.name}": ` +
            `center distance ${dist.toFixed(3)} < required ${req.toFixed(3)} ` +
            `(overlap ${overlap.toFixed(3)})`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------- gear train solver

export interface GearNodeSpec {
  name: string;
  teeth: number;
  module: number; // pitch radius R = (teeth * module) / 2
  outerR?: number; // defaults to R + module (addendum)
  driver?: string; // name of the gear it meshes with (omit for first/root gear)
  coaxialWith?: string; // share (x, y) arbor with an existing gear (compound pinion on a wheel)
  angleDeg?: number; // direction from driver's center to this gear's center (degrees)
  layer?: number; // integer layer index for collision grouping (default 0)
  z?: number; // world z elevation (default 0)
}

export interface SolvedGear {
  name: string;
  x: number;
  y: number;
  z: number;
  layer: number;
  teeth: number;
  module: number;
  pitchR: number;
  outerR: number;
  ratioToRoot: number;
  omegaSign: 1 | -1;
  driver?: string;
  coaxialWith?: string;
}

export interface GearTrainBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  rBound: number;
}

export interface SolvedGearTrain {
  byName: Record<string, SolvedGear>;
  list: SolvedGear[];
  bounds: GearTrainBounds;
}

export interface SolveGearTrainOptions {
  origin?: V3;
  minGap?: number;
}

/**
 * Solves exact 2D/3D positions, pitch tangencies, gear ratios, and spin signs for a gear train
 * (including compound coaxial pinions/wheels) and verifies zero non-meshed collisions per layer.
 */
export function solveGearTrain(
  specs: readonly GearNodeSpec[],
  opts: SolveGearTrainOptions = {},
): SolvedGearTrain {
  need(specs.length >= 1, "solveGearTrain requires at least one gear node");
  const origin: V3 = opts.origin ?? [0, 0, 0];
  finite(origin[0], "origin[0]");
  finite(origin[1], "origin[1]");
  finite(origin[2], "origin[2]");

  const byName: Record<string, SolvedGear> = {};
  const list: SolvedGear[] = [];
  const ignorePairs: [string, string][] = [];
  // Track coaxial arbor groups so coaxial wheels/pinions sharing an arbor never self-collide
  const arborOf = new Map<string, string>();
  const arborMembers = new Map<string, string[]>();

  const registerArbor = (name: string, rootArbor: string) => {
    arborOf.set(name, rootArbor);
    const members = arborMembers.get(rootArbor) ?? [];
    for (const m of members) ignorePairs.push([m, name]);
    members.push(name);
    arborMembers.set(rootArbor, members);
  };

  for (const spec of specs) {
    need(typeof spec.name === "string" && spec.name.trim().length > 0, "gear name must be a non-empty string");
    need(!(spec.name in byName), `duplicate gear name "${spec.name}"`);
    need(Number.isInteger(spec.teeth) && spec.teeth >= 3, `${spec.name}: teeth must be an integer >= 3, got ${spec.teeth}`);
    positive(spec.module, `${spec.name}.module`);
    need(
      !(spec.driver !== undefined && spec.coaxialWith !== undefined),
      `${spec.name}: cannot specify both driver and coaxialWith`,
    );

    const pitchR = (spec.teeth * spec.module) / 2;
    const outerR = spec.outerR ?? pitchR + spec.module;
    positive(outerR, `${spec.name}.outerR`);

    const layer = spec.layer ?? 0;
    need(Number.isInteger(layer), `${spec.name}.layer must be an integer, got ${layer}`);
    const z = spec.z ?? origin[2];
    finite(z, `${spec.name}.z`);

    let x: number;
    let y: number;
    let ratioToRoot: number;
    let omegaSign: 1 | -1;

    if (spec.coaxialWith !== undefined) {
      const host = byName[spec.coaxialWith];
      need(host !== undefined, `${spec.name}: unknown coaxialWith gear "${spec.coaxialWith}"`);
      x = host!.x;
      y = host!.y;
      ratioToRoot = host!.ratioToRoot;
      omegaSign = host!.omegaSign;
      registerArbor(spec.name, arborOf.get(host!.name)!);
    } else if (spec.driver !== undefined) {
      const drv = byName[spec.driver];
      need(drv !== undefined, `${spec.name}: unknown driver gear "${spec.driver}"`);
      const maxMod = Math.max(drv!.module, spec.module);
      need(
        Math.abs(drv!.module - spec.module) <= 1e-9 * maxMod,
        `Module mismatch: "${spec.name}" (module ${spec.module}) cannot mesh with driver "${drv!.name}" (module ${drv!.module})`,
      );
      const angleDeg = spec.angleDeg ?? 0;
      finite(angleDeg, `${spec.name}.angleDeg`);
      const rad = angleDeg * DEG2RAD;
      const dist = drv!.pitchR + pitchR;
      x = drv!.x + dist * Math.cos(rad);
      y = drv!.y + dist * Math.sin(rad);
      ratioToRoot = drv!.ratioToRoot * (drv!.teeth / spec.teeth);
      omegaSign = drv!.omegaSign === 1 ? -1 : 1;
      ignorePairs.push([drv!.name, spec.name]);
      registerArbor(spec.name, spec.name);
    } else {
      need(
        list.length === 0,
        `${spec.name}: non-root gear must specify either driver or coaxialWith`,
      );
      x = origin[0];
      y = origin[1];
      ratioToRoot = 1;
      omegaSign = 1;
      registerArbor(spec.name, spec.name);
    }

    const solved: SolvedGear = {
      name: spec.name,
      x,
      y,
      z,
      layer,
      teeth: spec.teeth,
      module: spec.module,
      pitchR,
      outerR,
      ratioToRoot,
      omegaSign,
      ...(spec.driver !== undefined ? { driver: spec.driver } : {}),
      ...(spec.coaxialWith !== undefined ? { coaxialWith: spec.coaxialWith } : {}),
    };
    byName[spec.name] = solved;
    list.push(solved);
  }

  assertNoCollisions(
    list.map((g) => ({ name: g.name, x: g.x, y: g.y, r: g.outerR, layer: g.layer })),
    { minGap: opts.minGap ?? 0, ignorePairs },
  );

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let rBound = 0;
  for (const g of list) {
    minX = Math.min(minX, g.x - g.outerR);
    maxX = Math.max(maxX, g.x + g.outerR);
    minY = Math.min(minY, g.y - g.outerR);
    maxY = Math.max(maxY, g.y + g.outerR);
    rBound = Math.max(rBound, Math.hypot(g.x - origin[0], g.y - origin[1]) + g.outerR);
  }

  return { byName, list, bounds: { minX, maxX, minY, maxY, rBound } };
}

// ---------------------------------------------------------------- cavity fill check

export interface CavityFillResult {
  ratio: number;
  ok: boolean;
  outside: number;
}

/**
 * Checks whether circular parts adequately fill a circular cavity of radius `cavityR`
 * without poking outside its perimeter. Prevents sparse "empty ashtray" layouts.
 */
export function checkCavityFill(
  cavityR: number,
  items: readonly { x: number; y: number; r: number }[],
  minRatio = 0.25,
): CavityFillResult {
  positive(cavityR, "cavityR");
  need(Number.isFinite(minRatio) && minRatio >= 0 && minRatio <= 1, `minRatio must be in [0, 1], got ${minRatio}`);

  let outside = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    finite(it.x, `items[${i}].x`);
    finite(it.y, `items[${i}].y`);
    nonNeg(it.r, `items[${i}].r`);
    if (Math.hypot(it.x, it.y) + it.r > cavityR + 1e-6) {
      outside++;
    }
  }

  if (items.length === 0) {
    return { ratio: 0, ok: 0 >= minRatio, outside: 0 };
  }

  // Exact analytical ratio when all items lie fully inside the cavity and are pairwise disjoint
  let disjoint = outside === 0;
  if (disjoint) {
    outer: for (let i = 0; i < items.length; i++) {
      const a = items[i]!;
      for (let j = i + 1; j < items.length; j++) {
        const b = items[j]!;
        if (Math.hypot(b.x - a.x, b.y - a.y) < a.r + b.r - 1e-9) {
          disjoint = false;
          break outer;
        }
      }
    }
  }

  let ratio: number;
  if (disjoint) {
    const sumR2 = items.reduce((acc, it) => acc + it.r * it.r, 0);
    ratio = Math.min(1, sumR2 / (cavityR * cavityR));
  } else {
    // Deterministic fine grid union area inside the cavity circle (handles coaxial & overlapping parts accurately)
    const N = 100;
    const step = (2 * cavityR) / N;
    const r2 = cavityR * cavityR;
    const itemR2 = items.map((it) => it.r * it.r);
    let insideCavity = 0;
    let covered = 0;
    for (let ix = 0; ix < N; ix++) {
      const x = -cavityR + (ix + 0.5) * step;
      const x2 = x * x;
      for (let iy = 0; iy < N; iy++) {
        const y = -cavityR + (iy + 0.5) * step;
        if (x2 + y * y > r2) continue;
        insideCavity++;
        for (let k = 0; k < items.length; k++) {
          const it = items[k]!;
          const dx = x - it.x;
          const dy = y - it.y;
          if (dx * dx + dy * dy <= itemR2[k]!) {
            covered++;
            break;
          }
        }
      }
    }
    ratio = insideCavity > 0 ? covered / insideCavity : 0;
  }

  return { ratio, ok: ratio >= minRatio && outside === 0, outside };
}

// ---------------------------------------------------------------- flow spine layout

export interface FlowSpineNodeSpec {
  name: string;
  length: number;
  r: number;
  gap?: number;
}

export interface FlowSpineNode {
  name: string;
  z0: number;
  z1: number;
  mid: V3;
  anchorLeft: V3;
  anchorRight: V3;
  r: number;
}

/**
 * Snaps sequential fluid/energy stages cleanly along a vertical (`z`) or horizontal (`x`) spine
 * with zero overlaps and ready-made left/right callout anchors at exact radius `r`.
 */
export function layoutFlowSpine(
  nodes: readonly FlowSpineNodeSpec[],
  opts: { axis?: "z" | "x"; origin?: V3 } = {},
): Record<string, FlowSpineNode> {
  const axis = opts.axis ?? "z";
  const origin: V3 = opts.origin ?? [0, 0, 0];
  finite(origin[0], "origin[0]");
  finite(origin[1], "origin[1]");
  finite(origin[2], "origin[2]");

  const out: Record<string, FlowSpineNode> = {};
  let cursor = axis === "z" ? origin[2] : origin[0];

  for (const node of nodes) {
    need(typeof node.name === "string" && node.name.trim().length > 0, "flow spine node name must be non-empty");
    need(!(node.name in out), `duplicate flow spine node name "${node.name}"`);
    nonNeg(node.length, `${node.name}.length`);
    nonNeg(node.r, `${node.name}.r`);
    const gap = node.gap ?? 0;
    nonNeg(gap, `${node.name}.gap`);

    const z0 = cursor;
    const z1 = cursor + node.length;
    const midCoord = (z0 + z1) / 2;

    const mid: V3 =
      axis === "z" ? [origin[0], origin[1], midCoord] : [midCoord, origin[1], origin[2]];
    const anchorLeft: V3 =
      axis === "z"
        ? [origin[0] - node.r, origin[1], midCoord]
        : [midCoord, origin[1] - node.r, origin[2]];
    const anchorRight: V3 =
      axis === "z"
        ? [origin[0] + node.r, origin[1], midCoord]
        : [midCoord, origin[1] + node.r, origin[2]];

    out[node.name] = {
      name: node.name,
      z0,
      z1,
      mid,
      anchorLeft,
      anchorRight,
      r: node.r,
    };
    cursor = z1 + gap;
  }

  return out;
}

// ---------------------------------------------------------------- exploded vertical layers

export interface ExplodedLayerSpec {
  name: string;
  thickness: number;
  gap?: number;
}

export interface ComposedLayer {
  name: string;
  z0: number;
  z1: number;
  midZ: number;
}

/**
 * Computes ascending vertical layer elevations for `explode` in `0..1`
 * (tightly assembled at `0`, crisp breathing gaps at `1`) with guaranteed monotonic ordering.
 */
export function composeExplodedLayers(
  layers: readonly ExplodedLayerSpec[],
  opts: { baseZ?: number; explode?: number } = {},
): { byName: Record<string, ComposedLayer>; totalHeight: number } {
  const baseZ = opts.baseZ ?? 0;
  const explode = opts.explode ?? 0;
  finite(baseZ, "baseZ");
  need(Number.isFinite(explode) && explode >= 0 && explode <= 1, `explode must be in [0, 1], got ${explode}`);

  const byName: Record<string, ComposedLayer> = {};
  if (layers.length === 0) {
    return { byName, totalHeight: 0 };
  }

  let tallest = 0;
  for (const l of layers) {
    need(typeof l.name === "string" && l.name.trim().length > 0, "layer name must be non-empty");
    need(!(l.name in byName), `duplicate layer name "${l.name}"`);
    nonNeg(l.thickness, `${l.name}.thickness`);
    if (l.gap !== undefined) nonNeg(l.gap, `${l.name}.gap`);
    tallest = Math.max(tallest, l.thickness);
    // Reserve name to detect duplicates even before computing elevations
    byName[l.name] = { name: l.name, z0: baseZ, z1: baseZ, midZ: baseZ };
  }

  const defaultGap = Math.max(tallest * 1.25, 1);
  let cursor = baseZ;

  for (let i = 0; i < layers.length; i++) {
    const l = layers[i]!;
    if (i > 0) {
      const prevGap = layers[i - 1]!.gap ?? defaultGap;
      cursor += explode * prevGap;
    }
    const z0 = cursor;
    const z1 = z0 + l.thickness;
    byName[l.name] = {
      name: l.name,
      z0,
      z1,
      midZ: (z0 + z1) / 2,
    };
    cursor = z1;
  }

  return { byName, totalHeight: cursor - baseZ };
}
