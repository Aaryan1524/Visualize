import type { BoxMark, CylinderMark, LinkMark, Mark, Tone, Vec3 } from "../core/types.ts";

// Finished parts for request/response systems: a terminal, a server, a
// ledger, a key store, the plate they stand on, cables and messages. Each
// part owns its detail and returns named anchors in world coordinates, so
// scenes attach cables, messages and labels without hand-placing them.

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const finite = (v: Vec3, what: string) => {
  if (v.some((n) => !Number.isFinite(n))) throw new RangeError(`${what} must be finite`);
};

export interface Part {
  marks: Mark[];
  anchor: Record<string, Vec3>;
}

/** The plate a system stands on. `size` is its floor footprint. */
export function plate(key: string, at: Vec3, size: [number, number]): Part {
  finite(at, "Plate position");
  const [w, d] = size;
  if (w < 40 || d < 30) throw new RangeError("A plate needs at least 40×30 units");
  return {
    marks: [
      {
        kind: "box", key, at: add(at, [0, 0, -5]), size: [w, d, 5], radius: 6, tone: "base", role: "foundation",
        surface: { seam: 0.4, fasteners: { inset: 4, radius: 0.8 } },
      },
    ],
    anchor: { frontLeft: add(at, [0, d, 0]), backRight: add(at, [w, 0, 0]) },
  };
}

export const TERMINAL_FOOTPRINT: [number, number] = [42, 26];

/**
 * A payment terminal: a base, a body with a screen showing `status`, and a
 * card slot. The cable leaves from the port on its +x side.
 */
export function terminal(key: string, at: Vec3, { status = "", lit = false }: { status?: string; lit?: boolean } = {}): Part {
  finite(at, "Terminal position");
  const marks: Mark[] = [
    { kind: "box", key: `${key}/base`, at, size: [42, 26, 5], radius: 3, tone: "structure", surface: { seam: 0.5 } },
    {
      kind: "box", key: `${key}/body`, at: add(at, [3, 3, 5]), size: [36, 17, 22], radius: 3, tone: "subject", role: "subject",
      label: status, labelFace: "left", lit,
      surface: { seam: 0.1, panel: { face: "left", from: 0.34, to: 0.88, inset: 3.5 } },
    },
    { kind: "box", key: `${key}/slot`, at: add(at, [9, 7, 27]), size: [24, 4, 1.2], radius: 0.6, tone: "structure" },
    { kind: "box", key: `${key}/port`, at: add(at, [42, 9, 0]), size: [3, 7, 4], radius: 0.6, tone: "structure" },
  ];
  return {
    marks,
    anchor: {
      port: add(at, [45, 12.5, 0]),
      outbox: add(at, [48, 9.5, 0.6]),
      top: add(at, [21, 11.5, 27]),
      screen: add(at, [21, 20, 18]),
    },
  };
}

export const SERVER_FOOTPRINT: [number, number] = [40, 34];

/**
 * A server: a plinth and a rack tower with rack-unit seams, vents and a
 * status lamp. Requests arrive through the port on its −x side.
 */
export function server(key: string, at: Vec3, { lamp = "muted" as Tone, lit = false } = {}): Part {
  finite(at, "Server position");
  const marks: Mark[] = [
    { kind: "box", key: `${key}/plinth`, at, size: [40, 34, 4], radius: 3, tone: "structure", surface: { seam: 0.5 } },
    {
      kind: "box", key: `${key}/tower`, at: add(at, [3, 3, 4]), size: [34, 28, 38], radius: 3, tone: "subject", role: "subject", lit,
      surface: {
        seams: [0.25, 0.5, 0.75],
        vents: { face: "left", from: 0.03, to: 0.47, count: 6, length: 18 },
        lamp: { face: "left", u: 27, at: 0.88, radius: 1.7, tone: lamp },
      },
    },
  ];
  return {
    marks,
    anchor: {
      inPort: add(at, [0, 17, 0]),
      inbox: add(at, [-14, 14, 0.6]),
      outPort: add(at, [40, 17, 0]),
      top: add(at, [20, 17, 42]),
      // On the tower's front face, not in the air in front of it.
      front: add(at, [20, 31, 24]),
    },
  };
}

/** Coins stack face to face: the pitch equals a coin's height. */
export const COIN_HEIGHT = 3.8;
export const COIN_BASE = 8;

export interface Coin {
  id: string;
  tone: Tone;
  lit?: boolean;
}

/** A ledger: a turned base with one coin stacked per recorded charge. */
export function ledger(key: string, centre: Vec3, coins: readonly Coin[]): Part {
  finite(centre, "Ledger position");
  const marks: Mark[] = [
    { kind: "cylinder", key: `${key}/base`, at: centre, radius: 19, height: 7, tone: "structure" },
    { kind: "cylinder", key: `${key}/well`, at: add(centre, [0, 0, 7]), radius: 15, height: 1, tone: "muted" },
  ];
  coins.forEach((c, i) => {
    marks.push({
      kind: "cylinder", key: `${key}/coin-${c.id}`, at: add(centre, [0, 0, COIN_BASE + i * COIN_HEIGHT]), radius: 12, height: COIN_HEIGHT,
      tone: c.tone, lit: c.lit ?? false, enter: "drop",
    } as CylinderMark);
  });
  return {
    marks,
    anchor: {
      inPort: add(centre, [-19, 0, 0]),
      top: add(centre, [0, 0, COIN_BASE + coins.length * COIN_HEIGHT]),
      front: add(centre, [0, 19, 4]),
    },
  };
}

/** A recessed tray that holds stored idempotency keys. */
export function keyStore(key: string, at: Vec3, { stored = false, lit = false, pulse = false } = {}): Part {
  finite(at, "Key store position");
  const marks: Mark[] = [
    { kind: "box", key: `${key}/tray`, at, size: [28, 22, 5], radius: 2.5, tone: "structure", surface: { well: 2 } },
  ];
  if (stored) {
    marks.push({
      kind: "box", key: `${key}/key`, at: add(at, [6, 6, 5]), size: [16, 10, 4], radius: 2, tone: "cold", role: "subject",
      enter: "drop", lit, ...(pulse ? { effect: "pulse" as const } : {}),
    } as BoxMark);
  }
  return { marks, anchor: { top: add(at, [14, 11, 9]), front: add(at, [14, 22, 2]) } };
}

/** A cased cable lying on the plate, from one anchor to another. */
export function cable(key: string, from: Vec3, to: Vec3, via: readonly Vec3[] = []): LinkMark {
  return { kind: "link", key, from: [from[0], from[1], 0.4], to: [to[0], to[1], 0.4], via: via.map((p) => [p[0], p[1], 0.4] as Vec3), cable: true, width: 2.2, layer: "floor" };
}

export const MESSAGE_SIZE: Vec3 = [11, 7, 6];

/** A message capsule riding on a cable. Requests are cold, responses good. */
export function message(key: string, at: Vec3, kind: "request" | "response", extra: Partial<BoxMark> = {}): BoxMark {
  return { kind: "box", key, at, size: MESSAGE_SIZE, radius: 2.5, tone: kind === "request" ? "cold" : "good", role: "subject", ...extra };
}
