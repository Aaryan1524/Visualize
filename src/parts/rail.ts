import type { BoxMark, Mark, Vec3 } from "../core/types.ts";

/** Finished parts share dimensions, attachment points and surface treatment. */
export const RAIL_CELL: Vec3 = [28, 24, 17];
export const RAIL_PITCH = 42;

export interface RailOptions {
  key: string;
  slots: number;
  at?: Vec3;
  cell?: Vec3;
  pitch?: number;
  flat?: boolean;
  /**
   * A cable port behind every slot, standing on the floor 10 units below the
   * rail (`at[2] - 10`, where the feet stand). `port(i)` is its back face at
   * floor level, for a cable that belongs to that slot (a pooled connection).
   */
  ports?: boolean;
  /** Text of the optional number under each slot; `null` draws none. Default "01", "02"… */
  slotLabel?: ((i: number) => string) | null;
}

/** A rail of real slots, with anchors derived from the same dimensions. */
export function railAssembly({ key, slots, at = [0, 0, 0], cell = RAIL_CELL, pitch = RAIL_PITCH, flat = false, ports = false, slotLabel = (i) => String(i + 1).padStart(2, "0") }: RailOptions) {
  if (!Number.isInteger(slots) || slots < 1 || slots > 16) throw new RangeError("A rail needs 1–16 slots");
  if (cell.some((n, i) => !Number.isFinite(n) || n < [16, 12, 6][i]!) || !Number.isFinite(pitch) || pitch < cell[0] + 6) throw new RangeError("Rail cells need dimensions of at least 16×12×6 and 6 units of spacing");
  if (at.some(n => !Number.isFinite(n))) throw new RangeError("Rail position must be finite");
  const [w, d] = cell;
  const length = (slots - 1) * pitch + w;
  const id = (name: string) => key ? `${key}/${name}` : name;
  const point = (x: number, y: number, z: number): Vec3 => [at[0] + x, at[1] + y, at[2] + z];
  const marks: Mark[] = [];
  const box = (name: string, pos: Vec3, size: Vec3, extra: Partial<BoxMark> = {}) => {
    marks.push({ kind: "box", key: id(name), at: point(...pos), size, radius: .8, tone: "structure", ...extra });
  };
  // A layered chassis, supported on four pads. All contacts are face-to-face.
  for (const [i, x, y] of [[0, -5, -5], [1, length - 3, -5], [2, -5, d + 1], [3, length - 3, d + 1]]) {
    box(`foot-${i}`, [x!, y!, -10], [8, 8, 3], { radius: 2, tone: "structure" });
  }
  box("base", [-10, -9, -7], [length + 20, d + 18, 5], {
    radius: 4, tone: "base", role: "foundation", surface: { seam: .36, fasteners: { inset: 3.5, radius: .75 } },
  });
  box("rail", [-6, -5, -2], [length + 12, d + 10, 2], { radius: 2, tone: "structure", inset: true });
  box("guide-back", [-4, -4, 0], [length + 8, 2, 3], { surface: { seam: .45 } });
  box("guide-front", [-4, d + 2, 0], [length + 8, 2, 3], { surface: { seam: .45, ticks: { step: 4, majorEvery: 5 } } });
  for (const [name, x] of [["left", -6], ["right", length + 4]] as const) {
    box(`stop-${name}`, [x, -4, 0], [2, d + 8, 3], { radius: .6, tone: "structure" });
  }
  for (let i = 0; i < slots; i++) {
    const x = i * pitch;
    box(`tray-${i}`, [x - 2, -1, 0], [w + 4, d + 2, 3], { radius: 1.5, tone: "muted", surface: { well: 1.4 } });
    // Open-ended trays let entries slide along recency; lips only border the sides.
    box(`tray-${i}-back`, [x - 1, -1, 3], [w + 2, 1, 1.3], { radius: .4 });
    box(`tray-${i}-front`, [x - 1, d, 3], [w + 2, 1, 1.3], { radius: .4 });
    // Slot numbers are optional: shown where there is room, dropped where they would sit on a part.
    if (slotLabel) marks.push({ kind: "label", key: id(`slot-${i}`), at: flat ? point(x + w/2, 0, -13) : point(x + w/2, d + 7, -2), text: slotLabel(i), size: "small", optional: true });
    // A port block against the back of the base, from the floor up to the base top.
    if (ports) box(`port-${i}`, [x + w/2 - 3.5, -13, -10], [7, 4, 8], { radius: .6, tone: "structure" });
  }
  const port = (i: number): Vec3 => {
    if (!ports) throw new RangeError("This rail was built without ports");
    if (!Number.isInteger(i) || i < 0 || i >= slots) throw new RangeError("Port index outside the rail");
    return point(i * pitch + w/2, -13, -10);
  };
  const slot = (i: number): Vec3 => {
    if (!Number.isInteger(i) || i < 0 || i >= slots) throw new RangeError("Slot index outside the rail");
    return point(i * pitch, 0, 3);
  };
  return { marks, slot, port, length, cell, id, anchor: {
    first: { key: id("tray-0"), at: point(0, d, 3) },
    last: { key: id(`tray-${slots - 1}`), at: point(length, d, 3) },
  } };
}

/** A keyed subject with its finish attached, including during hops and exits. */
export function cartridge(mark: Omit<BoxMark, "kind" | "radius" | "inset" | "surface" | "role">): BoxMark {
  return { ...mark, kind: "box", radius: 2, inset: true, role: "subject", textRole: mark.textRole ?? "symbol", surface: { seam: .22 } };
}
