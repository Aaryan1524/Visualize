// The machine-parts gallery: every part in src/rig/mech.ts, plus a composed exploded assembly
// (a two-stage train between a plate and a bridge), in the light and the dark theme, drawn with
// the rig's own CSS so the parts look the way they will on a page.
//
//   node test/fixtures/mech-gallery/build.mjs --build [out.html]           write the page
//   node test/fixtures/mech-gallery/build.mjs --build out.html --shoot dir  and screenshot it (1× and a 3× close-up)
//
// It sits under test/, so `node --test` runs it too; without --build it does nothing.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fitCamera } from "../../../src/rig/camera.ts";
import { roundedHull } from "../../../src/rig/shapes.ts";
import {
  arbor, bridge, centreLines, cutawayShell, drawAssembly, explodedStack, facingCamera, helicalSpring, jewelSetting,
  meshCentres, partPoints, pinion, readableTeeth, screw, shifted, spokedWheel,
} from "../../../src/rig/mech.ts";

const args = process.argv.slice(2);
if (!args.includes("--build")) process.exit(0);

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");
const outArg = args[args.indexOf("--build") + 1];
const OUT = resolve(outArg && !outArg.startsWith("--") ? outArg : join(process.env.TMPDIR ?? "/tmp", "mech-gallery.html"));
const shootDir = args.includes("--shoot") ? resolve(args[args.indexOf("--shoot") + 1]) : null;

const VIEW = { azimuth: 232, elevation: 30 };

// ---------------------------------------------------------------- the composed train
const M = 0.4; // one module for the whole train
const STAGES = [
  { driver: { teeth: 60, pitchR: 30 * M }, driven: { teeth: 10, pitchR: 5 * M }, angle: (-20 * Math.PI) / 180 },
  { driver: { teeth: 48, pitchR: 24 * M }, driven: { teeth: 8, pitchR: 4 * M }, angle: (-95 * Math.PI) / 180 },
];
const AT = meshCentres([0, 0], STAGES, 0.05);
const ARBOR_L = 5.6, ARBOR_R = 0.42;
// heights along each arbor, from its lower pivot
const Z = { wheelA: [1.2, 0.7], pinionB: [0.9, 1.4], wheelB: [2.9, 0.7], pinionC: [2.6, 1.4] };

function trainParts(z0) {
  const at = (p, s) => [p.at[0], p.at[1], z0 + s];
  const wA = spokedWheel(60, 30 * M, Z.wheelA[1], { at: at(AT[0], Z.wheelA[0]), rot: AT[0].rot });
  const colTop = (w, s, th) => w.anchors.top[2] - z0; // the collet's top, along the arbor
  const pB = pinion(10, 5 * M, Z.pinionB[1], { at: at(AT[1], Z.pinionB[0]), rot: AT[1].rot, material: "steel" });
  const wB = spokedWheel(48, 24 * M, Z.wheelB[1], { at: at(AT[1], Z.wheelB[0]), rot: AT[1].rot, spokes: 4 });
  const pC = pinion(8, 4 * M, Z.pinionC[1], { at: at(AT[2], Z.pinionC[0]), rot: AT[2].rot });
  const aA = arbor(ARBOR_R, ARBOR_L, { at: at(AT[0], 0), inside: [[Z.wheelA[0], colTop(wA)]] });
  const aB = arbor(ARBOR_R, ARBOR_L, { at: at(AT[1], 0), inside: [[Z.pinionB[0], Z.pinionB[0] + Z.pinionB[1]], [Z.wheelB[0], colTop(wB)]] });
  const aC = arbor(ARBOR_R, ARBOR_L, { at: at(AT[2], 0), inside: [[Z.pinionC[0], Z.pinionC[0] + Z.pinionC[1]]] });
  return [aA, aB, aC, wA, pB, wB, pC];
}

const PLATE_T = 2, BRIDGE_T = 1.5;
const pivots = AT.map((p) => p.at);
const screwsAt = [[(pivots[0][0] + pivots[1][0]) / 2, (pivots[0][1] + pivots[1][1]) / 2], [pivots[2][0] + 0.2, pivots[2][1] - 4.6]];

function exploded(explode) {
  const stack = explodedStack(
    [
      { thickness: PLATE_T },
      { thickness: ARBOR_L, axes: pivots },
      { thickness: BRIDGE_T, axes: [...pivots, ...screwsAt] },
      { thickness: 1, axes: screwsAt },
    ],
    explode,
    { spread: 9 },
  );
  const [b0, b1, b2, b3] = stack.bases;
  const plateOutline = roundedHull([...pivots.map(([x, y]) => [x, y, 13.8]), [-4, -16, 11.5]], 40);
  const plate = bridge({ outline: plateOutline }, PLATE_T, { at: [0, 0, b0], jewelHoles: pivots, jewelR: 1.15, material: "frame", chamfer: 0.5 });
  const train = trainParts(b1);
  const br = bridge({ points: [pivots[0], pivots[1], pivots[2], [pivots[2][0] + 0.2, pivots[2][1] - 4.6]], width: 4.6 }, BRIDGE_T, {
    at: [0, 0, b2], jewelHoles: pivots, jewelR: 1.05, screwHoles: screwsAt, screwR: 1.2, fill: "jewels", material: "alloy",
  });
  const screws = screwsAt.map(([x, y], i) => screw(1.2, { at: [x, y, b3], shank: explode > 0 ? 2.6 : 0, slotAngle: 0.4 + i }));
  return { stack, layers: [[plate], train, [br], screws] };
}

function drawExploded(cam, ex) {
  let svg = "";
  ex.layers.forEach((parts, i) => {
    svg += centreLines(cam, ex.stack.guides[i]);
    svg += drawAssembly(parts, cam, { shadow: i === 0 });
  });
  return svg;
}

// ---------------------------------------------------------------- the cells
const cells = [];
function cell(title, note, parts, opts = {}) {
  const w = opts.w ?? 300, h = opts.h ?? 260;
  const pts = opts.points ?? partPoints(...parts);
  const cam = fitCamera(pts, { x: 18, y: 14, w: w - 36, h: h - 50 }, VIEW.azimuth, VIEW.elevation);
  const body = opts.draw ? opts.draw(cam) : drawAssembly(parts, cam, { shadow: opts.shadow ?? true });
  cells.push({ title, note: typeof note === "function" ? note(cam) : note, w, h, svg: body, span: opts.span ?? 1 });
}

const pxNote = (R, teeth) => (cam) => `${teeth} teeth · ${(2 * Math.PI * R * cam.scale / teeth).toFixed(1)} px pitch (readable ≤ ${readableTeeth(R, cam.scale)})`;

cell("spokedWheel · clock", pxNote(12, 60), [spokedWheel(60, 12, 0.8)]);
cell("spokedWheel · involute, solid web", pxNote(6, 24), [spokedWheel(24, 6, 1.0, { form: "involute", spokes: 0, material: "steel" })]);
{
  // the readability rule, tested by eye: a small wheel at the limit, and one at 1.5× the limit
  const R = 4, probe = spokedWheel(24, R, 0.4);
  const both = [shifted(probe, [0, -5.5, 0]), shifted(probe, [0, 5.5, 0])];
  cell("readableTeeth · at the limit, and 1.5× over", (cam) => `left ${readableTeeth(R, cam.scale)} teeth (8 px pitch) · right ${Math.round(1.5 * readableTeeth(R, cam.scale))}`, [], {
    points: partPoints(...both),
    draw: (cam) => {
      const n = readableTeeth(R, cam.scale);
      return drawAssembly([
        spokedWheel(n, R, 0.4, { at: [0, -5.5, 0], pxPerUnit: cam.scale }),
        spokedWheel(Math.round(1.5 * n), R, 0.4, { at: [0, 5.5, 0] }),
      ], cam, { shadow: true });
    },
  });
}
cell("pinion on its arbor", "10 leaves, clock form", [pinion(10, 2, 1.8, { at: [0, 0, 1.6] }), arbor(0.42, 6, { inside: [[1.6, 3.4]] })]);
{
  const s = [{ driver: { teeth: 40, pitchR: 8 }, driven: { teeth: 10, pitchR: 2 }, angle: 0.3 }];
  const [a, b] = meshCentres([0, 0], s, 0.1);
  cell("meshCentres · a meshed pair", "pitch circles exactly tangent; 4:1", [
    spokedWheel(40, 8, 0.8, { rot: a.rot, spokes: 4 }),
    pinion(10, 2, 1.4, { at: [b.at[0], b.at[1], -0.3], rot: b.rot }),
  ]);
}
cell("bridge · arms through points", "screws and jewels set in it", [
  bridge({ points: [[0, 0], [9, 4], [17, 1]], width: 5 }, 1.5, { jewelHoles: [[0, 0], [17, 1]], screwHoles: [[9, 4]] }),
]);
cell("jewelSetting", "chaton, jewel, pivot hole", [jewelSetting(1.5)], { shadow: false });
cell("screw · slotted, with shank", "cheese head, real slot", [screw(1.5, { shank: 3.2, slotAngle: 0.35 })], { shadow: false });
{
  const shell = (cam) => cutawayShell({ r: 18, h: 7, wall: 1.6, facing: facingCamera(cam) });
  const probe = cutawayShell({ r: 18, h: 7, wall: 1.6 });
  cell("cutawayShell · case cut open", "back drawn behind, cut faces hatched", [], {
    points: partPoints(probe),
    draw: (cam) => drawAssembly([shell(cam), spokedWheel(40, 10, 0.8, { at: [0, 0, 1.4] }), arbor(0.5, 5, { inside: [[1.4, 1.4 + 0.8 + 0.72]] })], cam, { shadow: true }),
  });
}
cell("helicalSpring", "half a turn per solid, closed ends", [helicalSpring(3, 0.45, 12, 6)], { shadow: false });
{
  const ex = exploded(0.6);
  const all = ex.layers.flat();
  cell("explodedStack · two-stage train between plate and bridge, explode 0.6", "centre lines run along each arbor and screw across the gaps", [], {
    span: 3, w: 920, h: 620, points: partPoints(...all), draw: (cam) => drawExploded(cam, ex),
  });
}
{
  const ex = exploded(0);
  cell("…the same, assembled", "explode 0: every guide line closes up", [], { points: partPoints(...ex.layers.flat()), draw: (cam) => drawExploded(cam, ex) });
}

// ---------------------------------------------------------------- the page
const rigCss = readFileSync(join(ROOT, "src/rig/rig.css"), "utf8");
const chrome = readFileSync(join(ROOT, "src/drawing/chrome.css"), "utf8").split("\n").filter((l) => /^\.vz|^@media|^\s+--/.test(l)).join("\n");

const panel = (theme) => `<section class="vz" data-theme="${theme}"><h1>Machine parts · ${theme}</h1><div class="grid">${cells.map((c) => `<figure style="grid-column:span ${c.span}"><svg viewBox="0 0 ${c.w} ${c.h}" width="${c.w}" height="${c.h}">${c.svg}<text x="18" y="${c.h - 26}" class="t">${c.title}</text><text x="18" y="${c.h - 10}" class="n">${c.note}</text></svg></figure>`).join("")}</div></section>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Machine parts</title><style>
${chrome}
${rigCss}
html,body{margin:0;background:#888}
.vz{background:var(--stage);color:var(--ink);padding:20px 24px 28px;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif}
.vz h1{font-size:15px;font-weight:600;margin:0 0 12px;letter-spacing:.02em}
.grid{display:grid;grid-template-columns:repeat(3,300px);gap:10px;align-items:start}
section.vz{width:max-content}
figure{margin:0;border:1px solid var(--hair)}
svg{display:block;width:100%;height:auto}
.t{font:600 12px ui-sans-serif,system-ui,sans-serif;fill:var(--ink)}
.n{font:500 10.5px ui-monospace,Menlo,monospace;fill:var(--ink-2)}
</style></head><body>${panel("light")}${panel("dark")}</body></html>`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log(`wrote ${OUT} (${(html.length / 1024).toFixed(0)} KB)`);

if (shootDir) {
  const { launch } = await import(pathToFileURL(join(ROOT, "scripts/lib/browser.mjs")).href);
  mkdirSync(shootDir, { recursive: true });
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 980, height: 1200, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(OUT).href, { waitUntil: "load" });
    const fullH = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewport({ width: 980, height: fullH, deviceScaleFactor: 1 });
    for (const theme of ["light", "dark"]) {
      // clip to the panel's own content: its title down to the last cell
      const clip = await page.evaluate((t) => {
        const sec = document.querySelector(`section[data-theme="${t}"]`).getBoundingClientRect();
        const grid = document.querySelector(`section[data-theme="${t}"] .grid`).getBoundingClientRect();
        return { x: sec.left, y: sec.top + window.scrollY, width: sec.width, height: grid.bottom - sec.top + 24 };
      }, theme);
      await page.screenshot({ path: join(shootDir, `mech-${theme}-1x.png`), clip });
    }
    await page.setViewport({ width: 980, height: fullH, deviceScaleFactor: 3 });
    for (const theme of ["light", "dark"]) {
      const figs = await page.$$(`section[data-theme="${theme}"] figure`);
      const pick = { wheel: 0, involute: 1, readable: 2, pinion: 3, pair: 4, bridge: 5, jewel: 6, screw: 7, shell: 8, spring: 9, exploded: 10, assembled: 11 };
      for (const [name, i] of Object.entries(pick)) {
        if (theme === "dark" && !["exploded", "wheel", "shell", "readable"].includes(name)) continue;
        await figs[i].screenshot({ path: join(shootDir, `mech-${theme}-3x-${name}.png`) });
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`shot into ${shootDir}`);
}
