#!/usr/bin/env node
// Export one step of any built Drawing page as a 100% standalone, Figma-ready editable vector SVG.
//
//   node scripts/export-drawing-svg.mjs <built-page.html> [--out <file.svg>] [--step 0] [--variant <name>] [--theme light|dark] [--include-hud | --no-hud]
//
// Why a dedicated Figma exporter:
//   Visualize Drawing pages rely on CSS custom properties (var(--rig-lit)), CSS Color 5
//   color-mix(in oklab, ...), <use href="#..."> templates, and vector-effect="non-scaling-stroke".
//   Figma ignores custom properties, color-mix(), and non-scaling-stroke on SVG import.
//   This exporter renders the page in headless Chrome, expands every <use> in the live cascade,
//   bakes every resolved style into static hex presentation attributes via an offscreen 1x1 canvas,
//   scales non-scaling strokes into viewBox user units, and emits clean semantic Figma layers.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { drawingPageProblem, launch, openPage, settle } from "./lib/browser.mjs";

export const USAGE =
  "usage: node scripts/export-drawing-svg.mjs <built-page.html> [--out <file.svg>] [--step 0] [--variant <name>] [--theme light|dark] [--include-hud | --no-hud]";

/**
 * Convert an 8-bit RGBA tuple `[r, g, b, a]` (or four numeric args `r, g, b, a`)
 * into a lowercase hex string `#rrggbb` and normalized alpha in `[0, 1]`.
 */
export function rgbaToHex(rOrTuple, g, b, a = 255) {
  let r;
  if (Array.isArray(rOrTuple) || ArrayBuffer.isView(rOrTuple)) {
    [r, g, b, a = 255] = rOrTuple;
  } else {
    r = rOrTuple;
  }
  const clampByte = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new RangeError(`rgbaToHex received non-finite channel: ${v}`);
    return Math.max(0, Math.min(255, Math.round(n)));
  };
  const rc = clampByte(r);
  const gc = clampByte(g);
  const bc = clampByte(b);
  const ac = clampByte(a);
  const hex =
    "#" +
    rc.toString(16).padStart(2, "0") +
    gc.toString(16).padStart(2, "0") +
    bc.toString(16).padStart(2, "0");
  const alpha = ac === 255 ? 1 : ac === 0 ? 0 : Number((ac / 255).toFixed(4));
  return { hex, alpha };
}

/**
 * Turn an arbitrary part/layer name into a clean, valid XML/SVG/Figma layer ID.
 */
export function sanitizeLayerId(raw, fallback = "layer") {
  const safeFallback =
    String(fallback ?? "layer")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-]+|[-]+$/g, "") || "layer";
  const cleaned = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-]+|[-]+$/g, "");
  if (!cleaned) return safeFallback;
  if (/^[0-9]/.test(cleaned)) return `${safeFallback}-${cleaned}`;
  return cleaned;
}

/**
 * Parse CLI arguments for export-drawing-svg.mjs.
 * Throws an Error with a clear message on missing or invalid arguments.
 */
export function parseArgs(argv) {
  if (!Array.isArray(argv)) throw new Error("arguments must be an array");
  const opt = {
    file: null,
    out: null,
    step: 0,
    variant: null,
    theme: "light",
    includeHud: true,
  };

  const readVal = (flag, inlineVal, idx) => {
    if (inlineVal !== undefined) {
      if (inlineVal === "") throw new Error(`missing value for ${flag}`);
      return { val: inlineVal, nextIdx: idx };
    }
    const val = argv[idx + 1];
    if (val === undefined || val.startsWith("--")) {
      throw new Error(`missing value for ${flag}`);
    }
    return { val, nextIdx: idx + 1 };
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--include-hud") {
      opt.includeHud = true;
      continue;
    }
    if (arg === "--no-hud") {
      opt.includeHud = false;
      continue;
    }
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      const flag = eq >= 0 ? arg.slice(0, eq) : arg;
      const inlineVal = eq >= 0 ? arg.slice(eq + 1) : undefined;
      if (flag === "--out") {
        const { val, nextIdx } = readVal(flag, inlineVal, i);
        opt.out = val;
        i = nextIdx;
      } else if (flag === "--step") {
        const { val, nextIdx } = readVal(flag, inlineVal, i);
        if (!/^\d+$/.test(val)) throw new Error(`invalid --step "${val}" (expected a non-negative integer)`);
        opt.step = Number(val);
        i = nextIdx;
      } else if (flag === "--variant") {
        const { val, nextIdx } = readVal(flag, inlineVal, i);
        opt.variant = val;
        i = nextIdx;
      } else if (flag === "--theme") {
        const { val, nextIdx } = readVal(flag, inlineVal, i);
        if (val !== "light" && val !== "dark") {
          throw new Error(`invalid --theme "${val}" (expected "light" or "dark")`);
        }
        opt.theme = val;
        i = nextIdx;
      } else {
        throw new Error(`unknown option "${flag}"`);
      }
      continue;
    }
    if (opt.file !== null) {
      throw new Error(`unexpected extra argument "${arg}"`);
    }
    opt.file = arg;
  }

  if (!opt.file) {
    throw new Error("missing required <built-page.html> path");
  }
  if (!opt.out) {
    const stem = basename(opt.file, extname(opt.file));
    opt.out = join(dirname(opt.file), `${stem}-step${opt.step}-${opt.theme}.svg`);
  }
  return opt;
}

/**
 * Validate that an exported SVG string is clean, standalone, and Figma-ready:
 * no unresolved CSS variables, no color-mix(), no CSS Color 4 oklab/oklch/color(srgb),
 * no unexpanded <use> elements, and no NaN values.
 */
export function validateExportedSvg(svg) {
  const errors = [];
  if (typeof svg !== "string" || !svg.trim()) {
    return { ok: false, errors: ["SVG output is empty"] };
  }
  if (!/<svg\b[^>]*>/.test(svg) || !/<\/svg>\s*$/.test(svg.trim())) {
    errors.push("missing root <svg>...</svg> element");
  }
  if (/var\s*\(\s*--/i.test(svg)) {
    errors.push("contains unresolved CSS custom property (var(--...))");
  }
  if (/color-mix\s*\(/i.test(svg)) {
    errors.push("contains unsupported color-mix() expression");
  }
  if (/\b(?:oklab|oklch)\s*\(/i.test(svg) || /\bcolor\s*\(\s*srgb/i.test(svg)) {
    errors.push("contains unbaked CSS Color 4 color space (oklab/oklch/color(srgb))");
  }
  if (/\bNaN\b/.test(svg)) {
    errors.push("contains NaN value");
  }
  if (/<use\b/i.test(svg)) {
    errors.push("contains unexpanded <use> element");
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Export a built Drawing page at a specific step/variant/theme to a Figma-ready SVG.
 */
export async function exportDrawingSvg(options) {
  const filePath = resolve(options.file);
  if (!existsSync(filePath)) {
    throw new Error(`page file not found: ${filePath}`);
  }
  const outPath = resolve(options.out);

  const browser = await launch();
  try {
    const problem = await drawingPageProblem(browser, filePath);
    if (problem) {
      const err = new Error(problem);
      err.exitCode = 2;
      throw err;
    }

    const { page, errors: pageErrors } = await openPage(browser, filePath, {
      width: 1440,
      height: 900,
      theme: options.theme,
      scale: 2,
    });

    const info = await page.evaluate(() => ({
      steps: window.__viz.steps,
      variants: window.__viz.variants ?? [],
    }));

    if (options.variant !== null) {
      if (!info.variants.includes(options.variant)) {
        const list = info.variants.length ? info.variants.join(", ") : "(none)";
        const err = new Error(`unknown --variant "${options.variant}" (available: ${list})`);
        err.exitCode = 2;
        throw err;
      }
      await page.evaluate((v) => window.__viz.variant(v), options.variant);
      await settle(page);
    }

    if (options.step < 0 || options.step >= info.steps) {
      const err = new Error(`--step ${options.step} out of range (page has steps 0..${info.steps - 1})`);
      err.exitCode = 2;
      throw err;
    }

    await page.evaluate((th) => window.__viz.setTheme?.(th), options.theme);
    await page.evaluate((k) => window.__viz.seekStep(k), options.step);
    await settle(page);
    await page.waitForFunction(() => !window.__viz.camera?.().blending, { timeout: 4000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 120));
    await settle(page);

    const result = await page.evaluate((includeHud) => {
      const SVG_NS = "http://www.w3.org/2000/svg";
      const fig = document.getElementById("fig");
      if (!fig) throw new Error("page has no #fig SVG element");

      // --- Helpers inside browser context ---
      const sanitizeId = (raw, fallback = "layer") => {
        const fb =
          String(fallback || "layer")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^[-]+|[-]+$/g, "") || "layer";
        const c = String(raw || "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^[-]+|[-]+$/g, "");
        if (!c) return fb;
        return /^[0-9]/.test(c) ? `${fb}-${c}` : c;
      };

      const usedIds = new Set(["stage-background", "diagram", "callouts", "explainer"]);
      const allocId = (base, fallback = "layer") => {
        const clean = sanitizeId(base, fallback);
        if (!usedIds.has(clean)) {
          usedIds.add(clean);
          return clean;
        }
        let n = 2;
        while (usedIds.has(`${clean}-${n}`)) n++;
        const id = `${clean}-${n}`;
        usedIds.add(id);
        return id;
      };

      const fmt = (n, dp = 3) => {
        if (!Number.isFinite(n)) return null;
        const r = Number(n.toFixed(dp));
        return Object.is(r, -0) ? "0" : String(r);
      };

      // Offscreen 1x1 canvas resolves ANY CSS Color 4/5 expression (oklab, color-mix, srgb, rgba)
      // to exact 8-bit sRGB + alpha.
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const colorCache = new Map();

      const resolveColor = (raw) => {
        if (!raw) return { none: true };
        const s = String(raw).trim();
        if (!s || s === "none" || s === "initial") return { none: true };
        if (s === "transparent") return { hex: "#000000", alpha: 0 };
        const urlMatch = s.match(/^url\(\s*["']?#([^"')]+)["']?\s*\)/i);
        if (urlMatch) return { urlId: urlMatch[1] };
        if (colorCache.has(s)) return colorCache.get(s);

        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = "rgba(0,0,0,0)";
        ctx.fillStyle = s;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        const hex =
          "#" +
          r.toString(16).padStart(2, "0") +
          g.toString(16).padStart(2, "0") +
          b.toString(16).padStart(2, "0");
        const alpha = a === 255 ? 1 : a === 0 ? 0 : Number((a / 255).toFixed(4));
        const res = { hex, alpha };
        colorCache.set(s, res);
        return res;
      };

      // --- Step 1: Expand all <use> elements IN PLACE in the live DOM ---
      // Doing this in-place ensures CSS rules (.rig-part[data-recede], [data-named], [data-t-hot],
      // var(--rig-lit), color-mix(...)) cascade identically to the live shadow instance!
      const stripDescendantIds = (node) => {
        if (node.nodeType !== 1) return;
        node.removeAttribute("id");
        for (const ch of node.children) stripDescendantIds(ch);
      };

      for (let pass = 0; pass < 10; pass++) {
        const uses = [...fig.querySelectorAll("use")].filter((u) => !u.closest("defs"));
        if (!uses.length) break;
        let expandedAny = false;
        for (const u of uses) {
          const href = u.getAttribute("href") || u.getAttribute("xlink:href") || "";
          if (!href.startsWith("#")) {
            u.remove();
            continue;
          }
          const targetId = href.slice(1);
          const target = document.getElementById(targetId);
          if (!target) {
            u.remove();
            continue;
          }
          const wrap = document.createElementNS(SVG_NS, "g");
          // Combine <use> transform and x/y offset
          const tx = parseFloat(u.getAttribute("x") || "0") || 0;
          const ty = parseFloat(u.getAttribute("y") || "0") || 0;
          const origTf = (u.getAttribute("transform") || "").trim();
          const tfParts = [];
          if (origTf) tfParts.push(origTf);
          if (tx !== 0 || ty !== 0) tfParts.push(`translate(${fmt(tx)},${fmt(ty)})`);
          if (tfParts.length) wrap.setAttribute("transform", tfParts.join(" "));

          // Carry non-reference presentation / class / data attributes from <use>
          for (const attr of u.attributes) {
            const name = attr.name;
            if (
              name === "href" ||
              name === "xlink:href" ||
              name === "x" ||
              name === "y" ||
              name === "width" ||
              name === "height" ||
              name === "transform" ||
              name === "id"
            ) {
              continue;
            }
            wrap.setAttribute(name, attr.value);
          }

          if (target.tagName.toLowerCase() === "symbol") {
            for (const ch of target.childNodes) {
              const cloned = ch.cloneNode(true);
              stripDescendantIds(cloned);
              wrap.appendChild(cloned);
            }
          } else {
            const cloned = target.cloneNode(true);
            stripDescendantIds(cloned);
            wrap.appendChild(cloned);
          }
          u.replaceWith(wrap);
          expandedAny = true;
        }
        if (!expandedAny) break;
      }

      // Force synchronous style/layout flush after expanding <use>
      void fig.getBoundingClientRect();

      // --- Step 2: Measure viewBox and viewBox-to-CSS-pixel scale ---
      const vbAttr = (fig.getAttribute("viewBox") || "").trim();
      const vbNums = vbAttr.split(/[\s,]+/).map(Number);
      const vb =
        vbNums.length === 4 && vbNums.every(Number.isFinite)
          ? { x: vbNums[0], y: vbNums[1], w: vbNums[2], h: vbNums[3] }
          : (() => {
              const r = fig.getBoundingClientRect();
              return { x: 0, y: 0, w: r.width || 1440, h: r.height || 900 };
            })();

      const figCtm = fig.getScreenCTM();
      const figRect = fig.getBoundingClientRect();
      const fallbackScale = figRect.width > 0 && vb.w > 0 ? figRect.width / vb.w : 1;
      const figScale =
        figCtm && Number.isFinite(figCtm.a) && Math.hypot(figCtm.a, figCtm.b) > 0
          ? (Math.hypot(figCtm.a, figCtm.b) + Math.hypot(figCtm.c, figCtm.d)) / 2
          : fallbackScale;

      const outWidth = Math.max(1, Math.round(vb.w * figScale));
      const outHeight = Math.max(1, Math.round(vb.h * figScale));

      const scaleOf = (el) => {
        try {
          const m = el.getScreenCTM();
          if (m) {
            const s = (Math.hypot(m.a, m.b) + Math.hypot(m.c, m.d)) / 2;
            if (Number.isFinite(s) && s > 1e-9) return s;
          }
        } catch {
          // ignore
        }
        return figScale > 1e-9 ? figScale : 1;
      };

      const stageEl = document.getElementById("stage") || fig.closest(".vz-stage") || document.body;
      const stageBg = resolveColor(getComputedStyle(stageEl).backgroundColor);
      const stageHex = stageBg.hex || "#fdfdfc";

      const SHAPE_TAGS = new Set(["path", "circle", "rect", "line", "polyline", "polygon", "ellipse"]);
      const TEXT_TAGS = new Set(["text", "tspan"]);
      const GEOM_ATTRS = {
        path: ["d"],
        circle: ["cx", "cy", "r"],
        ellipse: ["cx", "cy", "rx", "ry"],
        rect: ["x", "y", "width", "height", "rx", "ry"],
        line: ["x1", "y1", "x2", "y2"],
        polyline: ["points"],
        polygon: ["points"],
        text: ["x", "y", "dx", "dy", "rotate", "textLength"],
        tspan: ["x", "y", "dx", "dy", "rotate", "textLength"],
      };

      const referencedDefIds = new Set();
      let shapeCount = 0;
      let textCount = 0;

      const extractRefId = (val) => {
        if (!val || val === "none") return null;
        const m = String(val).match(/url\(\s*["']?#([^"')]+)["']?\s*\)/i);
        return m ? m[1] : null;
      };

      const cleanFontFamily = (raw) => {
        if (!raw) return null;
        // Replace double quotes with single quotes for clean XML attributes
        const cleaned = raw.replace(/"/g, "'").trim();
        return cleaned || null;
      };

      const bakePresentation = (src, dst, tag, cs) => {
        const nonScaling = cs.vectorEffect === "non-scaling-stroke";
        const localScale = nonScaling ? scaleOf(src) : 1;

        // Fill
        const fillRes = resolveColor(cs.fill);
        const rawFillOp = parseFloat(cs.fillOpacity);
        const fillOp = Number.isFinite(rawFillOp) ? rawFillOp : 1;
        if (fillRes.none) {
          dst.setAttribute("fill", "none");
        } else if (fillRes.urlId) {
          referencedDefIds.add(fillRes.urlId);
          dst.setAttribute("fill", `url(#${fillRes.urlId})`);
          if (fillOp < 0.9999) {
            const fop = fmt(fillOp, 4);
            if (fop) dst.setAttribute("fill-opacity", fop);
          }
        } else if (fillRes.hex) {
          const eff = fillRes.alpha * fillOp;
          if (eff <= 0.0001) {
            dst.setAttribute("fill", "none");
          } else {
            dst.setAttribute("fill", fillRes.hex);
            if (eff < 0.9999) {
              const fop = fmt(eff, 4);
              if (fop) dst.setAttribute("fill-opacity", fop);
            }
          }
        }

        if (cs.fillRule === "evenodd") {
          dst.setAttribute("fill-rule", "evenodd");
        }

        // Stroke
        const strokeRes = resolveColor(cs.stroke);
        const rawStrokeW = parseFloat(cs.strokeWidth);
        const rawStrokeOp = parseFloat(cs.strokeOpacity);
        const strokeOp = Number.isFinite(rawStrokeOp) ? rawStrokeOp : 1;
        if (!strokeRes.none && Number.isFinite(rawStrokeW) && rawStrokeW > 0) {
          const effStrokeOp = strokeRes.urlId ? strokeOp : strokeRes.alpha * strokeOp;
          if (effStrokeOp > 0.0001) {
            if (strokeRes.urlId) {
              referencedDefIds.add(strokeRes.urlId);
              dst.setAttribute("stroke", `url(#${strokeRes.urlId})`);
            } else {
              dst.setAttribute("stroke", strokeRes.hex);
            }
            if (effStrokeOp < 0.9999) {
              const sop = fmt(effStrokeOp, 4);
              if (sop) dst.setAttribute("stroke-opacity", sop);
            }
            const userW = nonScaling ? rawStrokeW / localScale : rawStrokeW;
            const sw = fmt(userW, 3);
            if (sw) dst.setAttribute("stroke-width", sw);

            if (cs.strokeLinecap && cs.strokeLinecap !== "butt") {
              dst.setAttribute("stroke-linecap", cs.strokeLinecap);
            }
            if (cs.strokeLinejoin && cs.strokeLinejoin !== "miter") {
              dst.setAttribute("stroke-linejoin", cs.strokeLinejoin);
            }
            if (cs.strokeDasharray && cs.strokeDasharray !== "none") {
              const parts = cs.strokeDasharray
                .split(/[\s,]+/)
                .map((p) => parseFloat(p))
                .filter((n) => Number.isFinite(n) && n >= 0);
              if (parts.length) {
                const scaled = parts
                  .map((n) => fmt(nonScaling ? n / localScale : n, 2))
                  .filter(Boolean);
                if (scaled.length) dst.setAttribute("stroke-dasharray", scaled.join(" "));
              }
            }
            if (cs.paintOrder && cs.paintOrder.trim().startsWith("stroke")) {
              dst.setAttribute("paint-order", "stroke");
            }
          }
        }

        // Opacity
        const op = parseFloat(cs.opacity);
        if (Number.isFinite(op) && op < 0.9999) {
          const opStr = fmt(op, 4);
          if (opStr) dst.setAttribute("opacity", opStr);
        }

        // Typography
        if (TEXT_TAGS.has(tag)) {
          const ff = cleanFontFamily(cs.fontFamily);
          if (ff) dst.setAttribute("font-family", ff);
          const fsz = parseFloat(cs.fontSize);
          if (Number.isFinite(fsz) && fsz > 0) {
            const fsStr = fmt(fsz, 2);
            if (fsStr) dst.setAttribute("font-size", fsStr);
          }
          if (cs.fontWeight && cs.fontWeight !== "400" && cs.fontWeight !== "normal") {
            dst.setAttribute("font-weight", cs.fontWeight);
          }
          if (cs.fontStyle && cs.fontStyle !== "normal") {
            dst.setAttribute("font-style", cs.fontStyle);
          }
          if (cs.textAnchor && cs.textAnchor !== "start") {
            dst.setAttribute("text-anchor", cs.textAnchor);
          }
          if (cs.dominantBaseline && cs.dominantBaseline !== "auto") {
            dst.setAttribute("dominant-baseline", cs.dominantBaseline);
          }
          if (cs.letterSpacing && cs.letterSpacing !== "normal") {
            const ls = parseFloat(cs.letterSpacing);
            if (Number.isFinite(ls) && Math.abs(ls) > 1e-4) {
              const lsStr = fmt(ls, 3);
              if (lsStr) dst.setAttribute("letter-spacing", lsStr);
            }
          }
        }
      };

      const copyTransformAndClip = (src, dst, cs) => {
        const attrTf = (src.getAttribute("transform") || "").trim();
        if (attrTf && attrTf !== "none") {
          dst.setAttribute("transform", attrTf);
        } else if (cs.transform && cs.transform !== "none") {
          const m = cs.transform.match(/^matrix\(([^)]+)\)$/);
          if (m) {
            const nums = m[1].split(/[\s,]+/).map(Number);
            if (nums.length === 6 && nums.every(Number.isFinite)) {
              const isIdentity =
                Math.abs(nums[0] - 1) < 1e-6 &&
                Math.abs(nums[1]) < 1e-6 &&
                Math.abs(nums[2]) < 1e-6 &&
                Math.abs(nums[3] - 1) < 1e-6 &&
                Math.abs(nums[4]) < 1e-4 &&
                Math.abs(nums[5]) < 1e-4;
              if (!isIdentity) {
                dst.setAttribute("transform", `matrix(${nums.map((n) => fmt(n, 4)).join(" ")})`);
              }
            }
          }
        }
        const clipId = extractRefId(src.getAttribute("clip-path") || cs.clipPath);
        if (clipId) {
          referencedDefIds.add(clipId);
          dst.setAttribute("clip-path", `url(#${clipId})`);
        }
        const maskId = extractRefId(src.getAttribute("mask") || cs.mask);
        if (maskId) {
          referencedDefIds.add(maskId);
          dst.setAttribute("mask", `url(#${maskId})`);
        }
      };

      const isHiddenSubtree = (cs) => {
        if (cs.display === "none") return true;
        const op = parseFloat(cs.opacity);
        if (Number.isFinite(op) && op <= 0) return true;
        return false;
      };

      const isHiddenLeaf = (cs) => {
        if (isHiddenSubtree(cs)) return true;
        if (cs.visibility === "hidden" || cs.visibility === "collapse") return true;
        return false;
      };

      const cloneCleanNode = (src, { role = null, inSceneDirect = false, inLabelsDirect = false } = {}) => {
        const tag = src.tagName.toLowerCase();
        if (tag === "defs" || tag === "style" || tag === "script" || tag === "title" || tag === "desc" || tag === "metadata") {
          return null;
        }
        const cs = getComputedStyle(src);
        if (isHiddenSubtree(cs)) return null;

        if (SHAPE_TAGS.has(tag)) {
          if (isHiddenLeaf(cs)) return null;
          // Drop degenerate empty paths
          if (tag === "path" && !(src.getAttribute("d") || "").trim()) return null;
          const dst = document.createElementNS(SVG_NS, tag);
          for (const a of GEOM_ATTRS[tag] || []) {
            const v = src.getAttribute(a);
            if (v !== null && v !== "") dst.setAttribute(a, v);
          }
          copyTransformAndClip(src, dst, cs);
          bakePresentation(src, dst, tag, cs);
          shapeCount++;
          return dst;
        }

        if (TEXT_TAGS.has(tag)) {
          if (isHiddenLeaf(cs)) return null;
          if (!src.textContent || !src.textContent.trim()) return null;
          const dst = document.createElementNS(SVG_NS, tag);
          for (const a of GEOM_ATTRS[tag] || []) {
            const v = src.getAttribute(a);
            if (v !== null && v !== "") dst.setAttribute(a, v);
          }
          copyTransformAndClip(src, dst, cs);
          bakePresentation(src, dst, tag, cs);
          for (const ch of src.childNodes) {
            if (ch.nodeType === 3) {
              dst.appendChild(document.createTextNode(ch.nodeValue));
            } else if (ch.nodeType === 1 && ch.tagName.toLowerCase() === "tspan") {
              const ts = cloneCleanNode(ch);
              if (ts) dst.appendChild(ts);
            }
          }
          if (!dst.textContent || !dst.textContent.trim()) return null;
          if (tag === "text") textCount++;
          return dst;
        }

        if (tag === "g" || tag === "svg") {
          const dst = document.createElementNS(SVG_NS, "g");
          copyTransformAndClip(src, dst, cs);
          const op = parseFloat(cs.opacity);
          if (Number.isFinite(op) && op < 0.9999) {
            const opStr = fmt(op, 4);
            if (opStr) dst.setAttribute("opacity", opStr);
          }

          // Assign semantic Figma layer IDs
          if (role) {
            dst.setAttribute("id", role);
          } else if (inSceneDirect) {
            const part = src.getAttribute("data-part");
            const item = src.getAttribute("data-item");
            const elId = src.getAttribute("id");
            if (part) {
              const partBase = `part-${sanitizeId(part, "part")}`;
              if (!usedIds.has(partBase)) {
                usedIds.add(partBase);
                dst.setAttribute("id", partBase);
              } else if (item) {
                dst.setAttribute("id", allocId(`${partBase}-${item}`, "part"));
              } else {
                dst.setAttribute("id", allocId(partBase, "part"));
              }
            } else if (elId) {
              dst.setAttribute("id", allocId(elId, "part"));
            } else if (item) {
              dst.setAttribute("id", allocId(`part-${item}`, "part"));
            }
          } else if (inLabelsDirect) {
            const lbl = src.getAttribute("data-label") || src.getAttribute("id");
            if (lbl) dst.setAttribute("id", allocId(`callout-${lbl}`, "callout"));
          } else if (src.getAttribute("id")) {
            dst.setAttribute("id", allocId(src.getAttribute("id"), "layer"));
          }

          const isSceneRoot = role === "diagram";
          const isLabelsRoot = role === "callouts";
          for (const ch of src.children) {
            const built = cloneCleanNode(ch, {
              inSceneDirect: isSceneRoot,
              inLabelsDirect: isLabelsRoot,
            });
            if (built) dst.appendChild(built);
          }
          if (!dst.childNodes.length) return null;
          return dst;
        }

        return null;
      };

      // --- Step 3: Assemble clean output <svg> with semantic Figma top-level layers ---
      const out = document.createElementNS(SVG_NS, "svg");
      out.setAttribute("xmlns", SVG_NS);
      out.setAttribute("viewBox", `${fmt(vb.x, 2)} ${fmt(vb.y, 2)} ${fmt(vb.w, 2)} ${fmt(vb.h, 2)}`);
      out.setAttribute("width", String(outWidth));
      out.setAttribute("height", String(outHeight));

      // Background rect
      const bg = document.createElementNS(SVG_NS, "rect");
      bg.setAttribute("id", "stage-background");
      bg.setAttribute("x", fmt(vb.x, 2));
      bg.setAttribute("y", fmt(vb.y, 2));
      bg.setAttribute("width", fmt(vb.w, 2));
      bg.setAttribute("height", fmt(vb.h, 2));
      bg.setAttribute("fill", stageHex);
      out.appendChild(bg);

      const topLayers = ["stage-background"];

      for (const ch of fig.children) {
        const tag = ch.tagName.toLowerCase();
        if (tag === "defs" || tag === "style" || tag === "script") continue;
        const cid = ch.getAttribute("id") || "";
        const isHud =
          cid === "explainer" ||
          cid === "lensHost" ||
          ch.classList.contains("tblock") ||
          ch.classList.contains("inset");
        if (isHud && !includeHud) continue;

        let role = null;
        if (cid === "scene" || ch.hasAttribute("data-camera")) role = "diagram";
        else if (cid === "labels") role = "callouts";
        else if (cid === "explainer") role = "explainer";
        else if (ch.classList.contains("tblock")) role = allocId("title-block", "hud");
        else if (cid) role = allocId(cid, "layer");

        const built = cloneCleanNode(ch, { role });
        if (built) {
          out.appendChild(built);
          const lid = built.getAttribute("id");
          if (lid) topLayers.push(lid);
        }
      }

      // --- Step 4: Preserve ONLY referenced <clipPath>/<mask>/<gradient> defs (if any) ---
      if (referencedDefIds.size > 0) {
        const keptDefs = document.createElementNS(SVG_NS, "defs");
        const visited = new Set();
        const queue = [...referencedDefIds];
        while (queue.length) {
          const id = queue.shift();
          if (visited.has(id)) continue;
          visited.add(id);
          const defEl = document.getElementById(id);
          if (!defEl) continue;
          const dtag = defEl.tagName.toLowerCase();
          if (!["clippath", "mask", "lineargradient", "radialgradient"].includes(dtag)) continue;
          const clone = defEl.cloneNode(true);
          // Bake stop-color / fill on gradient stops and mask shapes, and collect chained url(#...) refs
          for (const sub of [clone, ...clone.querySelectorAll("*")]) {
            sub.removeAttribute("class");
            sub.removeAttribute("style");
            const stag = sub.tagName.toLowerCase();
            if (stag === "stop") {
              const sc = sub.getAttribute("stop-color");
              if (sc) {
                const r = resolveColor(sc);
                if (r.hex) sub.setAttribute("stop-color", r.hex);
              }
            }
            for (const a of ["fill", "stroke", "clip-path", "mask"]) {
              const ref = extractRefId(sub.getAttribute(a));
              if (ref && !visited.has(ref)) queue.push(ref);
            }
          }
          keptDefs.appendChild(clone);
        }
        if (keptDefs.childNodes.length) {
          out.insertBefore(keptDefs, out.firstChild);
        }
      }

      const xml = new XMLSerializer().serializeToString(out);
      const namedParts = [...out.querySelectorAll("#diagram > g[id]")].map((g) => g.getAttribute("id"));
      return {
        svg: xml,
        width: outWidth,
        height: outHeight,
        shapeCount,
        textCount,
        topLayers,
        namedParts,
      };
    }, options.includeHud);

    const svgDoc = `<?xml version="1.0" encoding="UTF-8"?>\n${result.svg}\n`;
    const check = validateExportedSvg(svgDoc);
    if (!check.ok) {
      throw new Error(`exported SVG failed validation: ${check.errors.join("; ")}`);
    }

    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, svgDoc, "utf8");

    return {
      outPath,
      bytes: Buffer.byteLength(svgDoc, "utf8"),
      pageErrors,
      ...result,
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  let opt;
  try {
    opt = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`export-drawing-svg: ${err.message}\n${USAGE}`);
    process.exit(2);
  }

  try {
    const res = await exportDrawingSvg(opt);
    const meta = [
      `step ${opt.step}`,
      opt.theme,
      ...(opt.variant ? [opt.variant] : []),
      ...(opt.includeHud ? [] : ["no-hud"]),
    ].join(", ");
    console.log(
      `wrote ${res.outPath} · ${(res.bytes / 1024).toFixed(1)} KB · ${res.shapeCount} shapes, ${res.textCount} labels, ${res.topLayers.length} layers (${meta})`,
    );
    if (res.pageErrors.length) {
      console.warn(`export-drawing-svg warnings: ${[...new Set(res.pageErrors)].join(" | ")}`);
    }
  } catch (err) {
    console.error(`export-drawing-svg: ${err.message}`);
    process.exit(err.exitCode ?? 1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
