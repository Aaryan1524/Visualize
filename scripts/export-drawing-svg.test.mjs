// node --test scripts/export-drawing-svg.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseArgs,
  rgbaToHex,
  sanitizeLayerId,
  validateExportedSvg,
} from "./export-drawing-svg.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(HERE, "export-drawing-svg.mjs");

test("rgbaToHex converts opaque and semi-transparent RGBA tuples accurately", () => {
  assert.deepEqual(rgbaToHex([255, 173, 134, 255]), { hex: "#ffad86", alpha: 1 });
  assert.deepEqual(rgbaToHex([0, 0, 0, 0]), { hex: "#000000", alpha: 0 });
  assert.deepEqual(rgbaToHex([22, 24, 28, 51]), { hex: "#16181c", alpha: 0.2 });
  assert.deepEqual(rgbaToHex(new Uint8ClampedArray([253, 253, 252, 128])), {
    hex: "#fdfdfc",
    alpha: 0.502,
  });
  // Also accepts four positional arguments
  assert.deepEqual(rgbaToHex(20, 20, 22, 255), { hex: "#141416", alpha: 1 });
  assert.deepEqual(rgbaToHex(255, 0, 15), { hex: "#ff000f", alpha: 1 });
  // Clamps out-of-range channel values cleanly
  assert.deepEqual(rgbaToHex([-5, 300, 16, 255]), { hex: "#00ff10", alpha: 1 });
  // Rejects NaN channels
  assert.throws(() => rgbaToHex([NaN, 0, 0, 255]), /non-finite/i);
});

test("parseArgs parses positional file, --out, --step, --variant, --theme, --include-hud, and --no-hud", () => {
  const defaults = parseArgs(["dist/watch-everyday.html"]);
  assert.deepEqual(defaults, {
    file: "dist/watch-everyday.html",
    out: join("dist", "watch-everyday-step0-light.svg"),
    step: 0,
    variant: null,
    theme: "light",
    includeHud: true,
  });

  const full = parseArgs([
    "dist/watch-everyday.html",
    "--out",
    "/tmp/out.svg",
    "--step",
    "3",
    "--variant",
    "weekend",
    "--theme",
    "dark",
    "--no-hud",
  ]);
  assert.deepEqual(full, {
    file: "dist/watch-everyday.html",
    out: "/tmp/out.svg",
    step: 3,
    variant: "weekend",
    theme: "dark",
    includeHud: false,
  });

  const inlineFlags = parseArgs([
    "dist/bloom.html",
    "--step=2",
    "--theme=dark",
    "--include-hud",
  ]);
  assert.deepEqual(inlineFlags, {
    file: "dist/bloom.html",
    out: join("dist", "bloom-step2-dark.svg"),
    step: 2,
    variant: null,
    theme: "dark",
    includeHud: true,
  });
});

test("parseArgs rejects missing or invalid arguments", () => {
  assert.throws(() => parseArgs([]), /missing required/i);
  assert.throws(() => parseArgs(["a.html", "b.html"]), /extra argument/i);
  assert.throws(() => parseArgs(["a.html", "--out"]), /missing value for --out/i);
  assert.throws(() => parseArgs(["a.html", "--step"]), /missing value for --step/i);
  assert.throws(() => parseArgs(["a.html", "--step", "-1"]), /invalid --step/i);
  assert.throws(() => parseArgs(["a.html", "--step", "1.5"]), /invalid --step/i);
  assert.throws(() => parseArgs(["a.html", "--step", "abc"]), /invalid --step/i);
  assert.throws(() => parseArgs(["a.html", "--theme", "sepia"]), /invalid --theme/i);
  assert.throws(() => parseArgs(["a.html", "--variant"]), /missing value for --variant/i);
  assert.throws(() => parseArgs(["a.html", "--unknown"]), /unknown option/i);
});

test("CLI exits with status 2 and prints usage on bad arguments", () => {
  assert.throws(
    () => execFileSync(process.execPath, [CLI], { encoding: "utf8", stdio: "pipe" }),
    (err) => err.status === 2 && /usage:/i.test(err.stderr),
  );
  assert.throws(
    () => execFileSync(process.execPath, [CLI, "dist/watch-everyday.html", "--theme", "neon"], { encoding: "utf8", stdio: "pipe" }),
    (err) => err.status === 2 && /invalid --theme/i.test(err.stderr),
  );
});

test("sanitizeLayerId produces clean, valid Figma/XML layer IDs", () => {
  assert.equal(sanitizeLayerId("part-balance"), "part-balance");
  assert.equal(sanitizeLayerId("  Balance Wheel (Top) "), "balance-wheel-top");
  assert.equal(sanitizeLayerId("gear/train:3rd"), "gear-train-3rd");
  assert.equal(sanitizeLayerId("123-gear"), "layer-123-gear");
  assert.equal(sanitizeLayerId("123-gear", "part"), "part-123-gear");
  assert.equal(sanitizeLayerId("   ---   "), "layer");
  assert.equal(sanitizeLayerId("", "callout"), "callout");
  assert.equal(sanitizeLayerId("main_plate"), "main_plate");
});

test("validateExportedSvg accepts clean baked SVGs and rejects CSS variables, color-mix, oklab, <use>, and NaN", () => {
  const cleanSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14200 6550" width="1340" height="618">
  <rect id="stage-background" x="0" y="0" width="14200" height="6550" fill="#fdfdfc"/>
  <g id="diagram">
    <g id="part-rotor">
      <path d="M100,100L200,200Z" fill="#ffad86" stroke="#1b1b19" stroke-width="15.2" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>
  <g id="callouts">
    <g id="callout-rotor">
      <text x="2780" y="2940" fill="#1d1e21" font-family="'Visualize Sans', sans-serif" font-size="152" font-weight="500" text-anchor="end">Weighted rotor</text>
    </g>
  </g>
</svg>`;
  assert.deepEqual(validateExportedSvg(cleanSvg), { ok: true, errors: [] });

  const withVar = cleanSvg.replace("#ffad86", "var(--rig-lit)");
  const rVar = validateExportedSvg(withVar);
  assert.equal(rVar.ok, false);
  assert.ok(rVar.errors.some((e) => /var\(--/.test(e)));

  const withMix = cleanSvg.replace("#ffad86", "color-mix(in oklab, #ffad86 70%, #a83a12)");
  const rMix = validateExportedSvg(withMix);
  assert.equal(rMix.ok, false);
  assert.ok(rMix.errors.some((e) => /color-mix/.test(e)));

  const withOklab = cleanSvg.replace("#ffad86", "oklab(0.75 0.1 0.05)");
  const rOklab = validateExportedSvg(withOklab);
  assert.equal(rOklab.ok, false);
  assert.ok(rOklab.errors.some((e) => /oklab/.test(e)));

  const withNaN = cleanSvg.replace("15.2", "NaN");
  const rNaN = validateExportedSvg(withNaN);
  assert.equal(rNaN.ok, false);
  assert.ok(rNaN.errors.some((e) => /NaN/.test(e)));

  const withUse = cleanSvg.replace("</g>\n  </g>", '<use href="#gear-0"/></g>\n  </g>');
  const rUse = validateExportedSvg(withUse);
  assert.equal(rUse.ok, false);
  assert.ok(rUse.errors.some((e) => /<use>/.test(e)));

  assert.equal(validateExportedSvg("").ok, false);
  assert.equal(validateExportedSvg("<div>not svg</div>").ok, false);
});
