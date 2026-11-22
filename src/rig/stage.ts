// The rig's runtime in the page: every part has one <g>, made once. A frame sets transforms and
// opacity, redraws only the live parts whose drawing changed, and re-orders the groups only when
// the painter's order changes.

export interface Placed {
  id: string;
  key: number;
  /** an SVG transform, or null for a part drawn in place */
  transform?: string | null;
  opacity?: number;
  /** a live part's drawing; set only for parts redrawn when their state changes */
  svg?: string;
  /** for a part shown as a <use> of one of several drawings made ahead: which one */
  href?: string;
  part?: string;
  hidden?: boolean;
  /** data-* flags on the part's group, for the look to answer (a lit cog, a touched screw) */
  flags?: Record<string, boolean>;
  /**
   * For a thick part turned by its transform: the worst screen error this placement leaves
   * (thickness × the turn left after its nearest drawn angle, in px). Recorded per part in
   * `globalThis.__rig.turns` so check-drawing can hold every turning part under its budget.
   */
  turnErrPx?: number;
}

/** What the page's rig records for the checks: per part id, the worst turn error seen and how often it was placed. */
export interface RigRecord {
  turns: Map<string, { maxErrPx: number; n: number }>;
}
export function rigRecord(): RigRecord {
  const g = globalThis as { __rig?: RigRecord };
  return (g.__rig ??= { turns: new Map() });
}

interface Slot extends SVGGElement {
  _svg?: string;
  _t?: string;
  _op?: number;
  _key?: number;
  _href?: string;
  _use?: SVGUseElement;
  _hidden?: boolean;
}

const SVGNS = "http://www.w3.org/2000/svg";

/**
 * Given where each part now sits in the list (-1 for a part not in it yet), in the order they are
 * wanted, which entries can stay put: the longest increasing run of the positions. Everything else moves.
 */
export function keepInPlace(positions: readonly number[]): Set<number> {
  const tails: number[] = [], tailAt: number[] = [], prev = new Array<number>(positions.length).fill(-1);
  for (let j = 0; j < positions.length; j++) {
    const v = positions[j]!;
    if (v < 0) continue;
    let lo = 0, hi = tails.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (tails[m]! < v) lo = m + 1;
      else hi = m;
    }
    tails[lo] = v;
    tailAt[lo] = j;
    prev[j] = lo > 0 ? tailAt[lo - 1]! : -1;
  }
  const stay = new Set<number>();
  for (let j = tailAt.length ? tailAt[tailAt.length - 1]! : -1; j >= 0; j = prev[j]!) stay.add(j);
  return stay;
}

export class RigStage {
  readonly groups = new Map<string, Slot>();
  readonly host: SVGGElement;
  constructor(host: SVGGElement) {
    this.host = host;
  }

  /** A part drawn once. */
  add(id: string, part: string, svg: string): void {
    const g = document.createElementNS(SVGNS, "g") as Slot;
    g.setAttribute("class", "rig-part");
    g.dataset.item = id;
    g.dataset.part = part;
    g.innerHTML = svg;
    g._svg = svg;
    this.groups.set(id, g);
  }

  /** One frame. */
  apply(items: readonly Placed[]): void {
    const order: Slot[] = [];
    for (const it of items) {
      let g = this.groups.get(it.id);
      // a hidden part stays where it is in the DOM, out of sight, so the list keeps its length and
      // a part passing out of view costs nothing to re-order
      if (it.hidden) {
        if (g && g._key !== undefined) {
          if (!g._hidden) (g.style.display = "none"), (g._hidden = true);
          order.push(g);
        }
        continue;
      }
      if (!g) {
        g = document.createElementNS(SVGNS, "g") as Slot;
        g.setAttribute("class", "rig-part");
        g.dataset.item = it.id;
        this.groups.set(it.id, g);
      }
      if (g._hidden) (g.style.display = ""), (g._hidden = false);
      if (it.svg !== undefined && g._svg !== it.svg) {
        g.innerHTML = it.svg;
        g._svg = it.svg;
      }
      if (it.href !== undefined && g._href !== it.href) {
        if (!g._use) {
          g.replaceChildren((g._use = document.createElementNS(SVGNS, "use") as SVGUseElement));
          g._svg = undefined;
        }
        g._use.setAttribute("href", it.href);
        g._href = it.href;
      }
      if (it.part && g.dataset.part !== it.part) g.dataset.part = it.part;
      const t = it.transform ?? "";
      if (g._t !== t) {
        if (t) g.setAttribute("transform", t);
        else g.removeAttribute("transform");
        g._t = t;
      }
      const op = it.opacity ?? 1;
      if (g._op !== op) {
        if (op < 1) g.setAttribute("opacity", op.toFixed(2));
        else g.removeAttribute("opacity");
        g._op = op;
      }
      if (it.flags) for (const [k, on] of Object.entries(it.flags)) if (g.hasAttribute(`data-${k}`) !== on) g.toggleAttribute(`data-${k}`, on);
      if (it.turnErrPx !== undefined) {
        if (!g.hasAttribute("data-rig-turn")) g.setAttribute("data-rig-turn", "");
        const r = rigRecord().turns, was = r.get(it.id);
        if (!was) r.set(it.id, { maxErrPx: it.turnErrPx, n: 1 });
        else (was.n++, it.turnErrPx > was.maxErrPx && (was.maxErrPx = it.turnErrPx));
      }
      g._key = it.key;
      order.push(g);
    }
    order.sort((a, b) => a._key! - b._key!);
    // most frames change nothing: look before doing any work
    const kids = this.host.children;
    let i = 0;
    if (kids.length === order.length) while (i < order.length && kids[i] === order[i]) i++;
    if (i === order.length) return;
    this.reorder(order);
  }

  /**
   * Put the groups in `order`, moving as few as possible: those in the longest run already in the right
   * order stay where they are, so one part crossing to the far end of the list costs one move, not one
   * move for every part it passes.
   */
  private reorder(order: Slot[]): void {
    const host = this.host, keep = new Set<Element>(order);
    for (const g of Array.from(host.children)) if (!keep.has(g)) g.remove();
    const at = new Map<Element, number>();
    Array.from(host.children).forEach((g, j) => at.set(g, j));
    const stay = keepInPlace(order.map((g) => at.get(g) ?? -1));
    let next: Element | null = null;
    for (let j = order.length - 1; j >= 0; j--) {
      const g = order[j]!;
      if (!stay.has(j)) host.insertBefore(g, next);
      next = g;
    }
  }

  /** Mark parts that recede (out of focus) and parts the voice names. */
  focus(test: (part: string) => { recede: boolean; named: boolean }): void {
    for (const g of this.groups.values()) {
      const { recede, named } = test(g.dataset.part ?? "");
      g.toggleAttribute("data-recede", recede);
      g.toggleAttribute("data-named", named);
    }
  }
}
