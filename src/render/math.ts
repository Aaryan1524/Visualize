// Math for flat panels: KaTeX expressions whose terms carry entity links,
// and number grids whose cells do. Both produce trusted HTML for Panel.html.
import katex from "katex";

/**
 * Render TeX to HTML. Only \htmlData is trusted (for links); every other
 * HTML extension stays disabled. Throws on invalid TeX so a broken
 * equation fails the build instead of shipping red error text.
 */
export function tex(source: string, { display = false } = {}): string {
  return katex.renderToString(source, {
    displayMode: display,
    throwOnError: true,
    output: "htmlAndMathml",
    strict: (code: string) => (code === "htmlExtension" ? "ignore" : "warn"),
    trust: (ctx: { command: string }) => ctx.command === "\\htmlData",
  });
}

/** Wrap a TeX fragment so the rendered term links to one or more entities. */
export function linked(ids: string | readonly string[], body: string): string {
  const list = typeof ids === "string" ? [ids] : ids;
  for (const id of list) if (!/^[\w-]+$/.test(id)) throw new Error(`link id must be word characters or hyphens: ${id}`);
  return String.raw`\htmlData{link=${list.join(" ")}}{${body}}`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export interface GridOptions {
  rows?: string[];
  cols?: string[];
  /** Digits after the decimal point. */
  digits?: number;
  /** Entity link(s) for a cell, space-separated. */
  link?: (i: number, j: number) => string | undefined;
  /** data-key for a cell, so checks can read its value. */
  key?: (i: number, j: number) => string | undefined;
  /** Extra class for a cell: vz-hot, vz-good, vz-dim … */
  tone?: (i: number, j: number) => string | undefined;
  /** Shown in place of a value, e.g. a cell not computed yet. */
  blank?: (i: number, j: number) => boolean;
  caption?: string;
}

/** A matrix as an HTML table; row and column headers are optional. */
export function grid(values: readonly (readonly number[])[], o: GridOptions = {}): string {
  const digits = o.digits ?? 2;
  const head = o.cols ? `<tr>${o.rows ? "<th></th>" : ""}${o.cols.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr>` : "";
  const body = values
    .map((row, i) => {
      const th = o.rows ? `<th scope="row">${esc(o.rows[i] ?? "")}</th>` : "";
      const cells = row
        .map((v, j) => {
          const attrs = [
            o.link?.(i, j) ? `data-link="${esc(o.link(i, j)!)}"` : "",
            o.key?.(i, j) ? `data-key="${esc(o.key(i, j)!)}"` : "",
            o.tone?.(i, j) ? `class="${esc(o.tone(i, j)!)}"` : "",
          ]
            .filter(Boolean)
            .join(" ");
          const text = o.blank?.(i, j) ? "·" : formatNumber(v, digits);
          return `<td ${attrs}>${text}</td>`;
        })
        .join("");
      return `<tr>${th}${cells}</tr>`;
    })
    .join("");
  const caption = o.caption ? `<caption class="vz-dim">${esc(o.caption)}</caption>` : "";
  return `<table class="vz-grid">${caption}${head}${body}</table>`;
}

/** Fixed digits with a real minus sign, and no "-0.00". */
export function formatNumber(v: number, digits = 2): string {
  const s = v.toFixed(digits);
  const zero = Number(s) === 0;
  return zero ? s.replace("-", "") : s.replace("-", "−");
}
