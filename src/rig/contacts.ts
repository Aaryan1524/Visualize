// Where a chain, belt, rack or gear drives a wheel, the two must move together at the contact: the
// same way and at the same speed. A sign slip anywhere (a pulley turned the wrong way, a mirrored
// camera, an angle that runs backward) breaks this, and nothing else catches it: every still frame
// still looks right. A machine's tests take two frames a short step apart, find each contact, and
// hand this the contact's screen point in both frames, carried by the driving part's transform and by
// the driven part's. The derailleur's two jockey pulleys turned backwards until this test existed.
//
//   const r = checkContacts(contacts);         // [{ where, chain: [p0, p1], wheel: [p0, p1] }]
//   assert.deepEqual(r.faults, []);
//   assert.ok(r.byWhere.cog >= 3);              // and say how many of each it checked: never pass empty

import type { Affine } from "./motion.ts";
import type { P2 } from "./vec.ts";

const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

/** An SVG transform attribute as a matrix: matrix(...), translate(...) or none. */
export function parseTransform(t: string | null | undefined): Affine {
  if (!t) return [...IDENTITY];
  const nums = (s: string) => s.trim().split(/[\s,]+/).map(Number);
  const m = t.match(/matrix\(([^)]*)\)/);
  if (m) return nums(m[1]!) as Affine;
  const tr = t.match(/translate\(([^)]*)\)/);
  if (tr) {
    const [x = 0, y = 0] = nums(tr[1]!);
    return [1, 0, 0, 1, x, y];
  }
  throw new Error(`parseTransform: cannot read "${t}"`);
}

const apply = (m: Affine, p: P2): P2 => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
function invert(m: Affine): Affine {
  const det = m[0] * m[3] - m[1] * m[2];
  const a = m[3] / det, b = -m[1] / det, c = -m[2] / det, d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}

/** Where the point `p` (on screen under transform `from`) goes when the part's transform becomes `to`. */
export function carry(from: string | null | undefined, to: string | null | undefined, p: P2): P2 {
  return apply(parseTransform(to), apply(invert(parseTransform(from)), p));
}

export interface Contact {
  /** a name for the contact, e.g. "cog" or "guide pulley": results are counted by it */
  where: string;
  /** the driving part's point at the contact, on screen, in the first frame and the second */
  chain: readonly [P2, P2];
  /** the driven part's point at the same place, on screen, in the first frame and the second */
  wheel: readonly [P2, P2];
}

export interface ContactCheck {
  checked: number;
  byWhere: Record<string, number>;
  faults: string[];
}

/**
 * Each contact: the wheel's point must move with the chain's, the same way (cosine above `minCos`)
 * and at the same speed (within `speedTol`), and both must move at all (more than `minMove`).
 */
export function checkContacts(contacts: readonly Contact[], { minCos = 0.9, speedTol = 0.2, minMove = 0.5 } = {}): ContactCheck {
  const faults: string[] = [], byWhere: Record<string, number> = {};
  for (const c of contacts) {
    const vc: P2 = [c.chain[1][0] - c.chain[0][0], c.chain[1][1] - c.chain[0][1]];
    const vw: P2 = [c.wheel[1][0] - c.wheel[0][0], c.wheel[1][1] - c.wheel[0][1]];
    const lc = Math.hypot(...vc), lw = Math.hypot(...vw);
    byWhere[c.where] = (byWhere[c.where] ?? 0) + 1;
    if (lc <= minMove || lw <= minMove) {
      faults.push(`${c.where}: ${lc <= minMove ? "the chain" : "the wheel"} does not move between the frames (${Math.min(lc, lw).toFixed(2)})`);
      continue;
    }
    const cos = (vc[0] * vw[0] + vc[1] * vw[1]) / (lc * lw);
    if (cos <= minCos) faults.push(`${c.where}: the wheel moves against the chain (cos ${cos.toFixed(2)})`);
    else if (Math.abs(lw / lc - 1) >= speedTol) faults.push(`${c.where}: the wheel moves at ${(lw / lc).toFixed(2)} of the chain's speed`);
  }
  return { checked: contacts.length, byWhere, faults };
}
