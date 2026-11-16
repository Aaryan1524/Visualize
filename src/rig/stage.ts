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
      g._key = it.key;
      order.push(g);
    }
    order.sort((a, b) => a._key! - b._key!);
    // move only the groups that are out of place; most frames move none
    const keep = new Set<Element>(order);
    for (const g of [...this.host.children]) if (!keep.has(g)) g.remove();
    const kids = this.host.children;
    for (let i = 0; i < order.length; i++) if (kids[i] !== order[i]) this.host.insertBefore(order[i]!, kids[i] ?? null);
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
