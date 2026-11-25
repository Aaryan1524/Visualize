#!/usr/bin/env node
// LRU Cache (O(1) Hash Map + Recency Rail) — Tactile Kinetic Instrument Golden Benchmark
//
//   node examples/lru-studio/build.mjs [--out <page.html>]
//
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { studioPage } from "../../src/studio/director.mjs";

const { buildSync } = createRequire(new URL("../../package.json", import.meta.url))("esbuild");
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const outArg = process.argv.indexOf("--out");
const out = outArg > 0 ? process.argv[outArg + 1] : join(ROOT, "dist", "lru-studio.html");
const voicePath = join(HERE, "voice.json");
const VOICE = existsSync(voicePath) ? JSON.parse(readFileSync(voicePath, "utf8")) : null;

/**
 * Single Source of Truth deterministic LRU Cache simulation model.
 * Executes a real O(1) Hash Map + Doubly-Linked List trace over 8 operations
 * for any capacity in [2..5] and accessStep in [0..7].
 */
const modelSrc = `
const LRU_SEQUENCE = [
  { kind: "PUT", key: "A", value: 42 },
  { kind: "PUT", key: "B", value: 17 },
  { kind: "PUT", key: "C", value: 89 },
  { kind: "GET", key: "A" },
  { kind: "PUT", key: "D", value: 53 },
  { kind: "GET", key: "C" },
  { kind: "PUT", key: "E", value: 71 },
  { kind: "PUT", key: "F", value: 64 },
];

function simModel(params, variant) {
  const defaultCap = variant === "tight" ? 3 : 4;
  const rawCap = params && params.capacity != null ? Number(params.capacity) : defaultCap;
  const capacity = Math.max(2, Math.min(5, Math.round(Number.isFinite(rawCap) ? rawCap : defaultCap)));

  const rawStep = params && params.accessStep != null ? Number(params.accessStep) : 2;
  const accessStep = Math.max(0, Math.min(LRU_SEQUENCE.length - 1, Math.round(Number.isFinite(rawStep) ? rawStep : 2)));

  // Real LRU Cache state: order[0] = MRU head (slot 1), order[order.length - 1] = LRU tail
  const order = [];
  const values = {};
  let hits = 0;
  let misses = 0;
  let evictions = 0;
  let lastEvicted = null;
  let lastEvictedValue = null;
  let lastOp = null;

  for (let i = 0; i <= accessStep; i++) {
    const op = LRU_SEQUENCE[i];
    if (op.kind === "GET") {
      const idx = order.indexOf(op.key);
      if (idx >= 0) {
        hits += 1;
        order.splice(idx, 1);
        order.unshift(op.key);
        lastOp = {
          kind: "GET",
          key: op.key,
          value: values[op.key],
          status: "HIT",
          label: 'GET("' + op.key + '") → ' + values[op.key],
          shortLabel: "GET " + op.key + " · HIT",
        };
      } else {
        misses += 1;
        lastOp = {
          kind: "GET",
          key: op.key,
          value: null,
          status: "MISS",
          label: 'GET("' + op.key + '") → ∅',
          shortLabel: "GET " + op.key + " · MISS",
        };
      }
    } else {
      const idx = order.indexOf(op.key);
      if (idx >= 0) {
        hits += 1;
        values[op.key] = op.value;
        order.splice(idx, 1);
        order.unshift(op.key);
        lastOp = {
          kind: "PUT",
          key: op.key,
          value: op.value,
          status: "HIT",
          label: 'PUT("' + op.key + '", ' + op.value + ")",
          shortLabel: "PUT " + op.key + " · UPD",
        };
      } else {
        misses += 1;
        let evictedThisStep = null;
        if (order.length >= capacity) {
          evictedThisStep = order.pop();
          lastEvicted = evictedThisStep;
          lastEvictedValue = values[evictedThisStep];
          delete values[evictedThisStep];
          evictions += 1;
        }
        values[op.key] = op.value;
        order.unshift(op.key);
        lastOp = {
          kind: "PUT",
          key: op.key,
          value: op.value,
          status: evictedThisStep ? "EVICT" : "MISS",
          evicted: evictedThisStep,
          label: 'PUT("' + op.key + '", ' + op.value + ")",
          shortLabel: evictedThisStep
            ? "PUT " + op.key + " · EVICT " + evictedThisStep
            : "PUT " + op.key + " · ADD",
        };
      }
    }
  }

  const totalLookups = hits + misses;
  const hitRatePct = totalLookups > 0 ? Math.round((hits / totalLookups) * 100) : 0;

  return {
    capacity,
    size: order.length,
    accessStep,
    totalOps: LRU_SEQUENCE.length,
    order,
    values,
    hits,
    misses,
    hitRatePct,
    evictions,
    lastEvicted,
    lastEvictedValue,
    lastOp,
  };
}
`;

// Bundle Engine C + scene.mjs into one self-contained IIFE script
const bundleRes = buildSync({
  entryPoints: [join(HERE, "scene.mjs")],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  minify: true,
});
const engineBundle = bundleRes.outputFiles[0].text;

// Progressive reveal layer sets (strictly 2 calm instruments + 1 tension-thread layer)
const REVEAL_STRIP = ["hashmap"];
const REVEAL_RAIL = ["hashmap", "recency_rail"];
const REVEAL_ALL = ["hashmap", "recency_rail", "threads"];

const STEPS = [
  {
    step: 0,
    tab: "Switchboard",
    title: "Constant-time O(1) key switchboard",
    narration:
      "An LRU cache answers every lookup in O(1) time. Start with a Hash Map switchboard: each key maps straight to its slot without scanning through cached entries.",
    focus: ["hashmap"],
    reveal: REVEAL_STRIP,
    camera: { preset: "strip_focus", zoom: 1.08 },
    sim: { accessStep: 2 },
    callouts: [{ target: "slot_C_top", label: "O(1) direct index", place: "top" }],
    tryOut: null,
  },
  {
    step: 1,
    tab: "Recency Rail",
    title: "Ordered MRU to LRU sliding track",
    narration:
      "A Hash Map alone cannot tell which item is oldest. Beneath it sits a doubly-linked recency rail: the most recently used entry rests in slot 1 on the left, while colder entries slide right toward eviction.",
    focus: ["recency_rail"],
    reveal: REVEAL_RAIL,
    camera: { preset: "rail_focus", zoom: 1.04 },
    sim: { accessStep: 2 },
    callouts: [{ target: "tile_C_bottom", label: "Most recent sits left", place: "bottom" }],
    tryOut: null,
  },
  {
    step: 2,
    tab: "Direct Thread",
    title: "Zero-scan O(1) jump from key to tile",
    narration:
      "Each occupied switchboard key holds a direct memory reference to its tile on the rail. When key C is accessed, the cache follows that single thread straight to C in one constant-time jump.",
    focus: null,
    reveal: REVEAL_ALL,
    camera: { preset: "overview", zoom: 1.0 },
    sim: { accessStep: 2 },
    callouts: [{ target: "slot_C_top", label: "Single O(1) jump", place: "top" }],
    tryOut: null,
  },
  {
    step: 3,
    tab: "Cache Hit",
    title: 'GET("A") lifts and arcs straight to slot 1',
    narration:
      'Watch a live cache hit: GET("A") depresses key A on the switchboard, follows its direct thread straight to tile A, unlinks it in two pointer swaps, and lifts it cleanly over its neighbors into slot 1.',
    focus: null,
    reveal: REVEAL_ALL,
    camera: { preset: "overview", zoom: 1.0 },
    sim: { accessStep: 3 },
    callouts: [{ target: "tile_A_bottom", label: "Lifted to slot 1", place: "bottom" }],
    tryOut: null,
  },
  {
    step: 4,
    tab: "Tail Eviction",
    title: 'PUT("E", 71) slides the oldest tile off the edge',
    narration:
      'When PUT("E", 71) arrives and every cavity on the rail is full, there is no search for the coldest key. Tile B sitting at the LRU edge slides straight off the drop-off, freeing room for E at slot 1.',
    focus: null,
    reveal: REVEAL_ALL,
    camera: { preset: "evict_focus", zoom: 1.0 },
    sim: { accessStep: 6 },
    callouts: [{ target: "recency_rail_evict", label: "Oldest slides off", place: "bottom" }],
    tryOut: null,
  },
  {
    step: 5,
    tab: "Capacity Lab",
    title: "Test memory pressure across capacities",
    narration:
      "Every slot you remove from the rail tightens eviction pressure. Switch to Tight Memory (Cap 3) or open Tune to drag Capacity and scrub through each access step live.",
    focus: null,
    reveal: REVEAL_ALL,
    camera: { preset: "overview", zoom: 0.98 },
    sim: { accessStep: 4 },
    callouts: [{ target: "recency_rail_evict", label: "Eviction drop-off", place: "bottom" }],
    tryOut: {
      prompt:
        "Switch to Tight Memory (Cap 3) — or drag Capacity to 2 in Tune — and scrub Access step to 6 to trigger 2+ evictions.",
      checkSrc: "(sim) => sim.capacity <= 3 && sim.evictions >= 2",
      successText:
        "Verified! With tighter capacity at step 6, multiple cold tiles slide cleanly off the LRU drop-off in O(1) time.",
    },
  },
];

const html = studioPage({
  title: "How an LRU Cache Works",
  about: "O(1) Hash Map + Recency Rail · Tactile Instrument",
  hint: "",
  sceneId: "lru-studio",
  themeDefault: "light",
  variants: [
    { name: "balanced", label: "Balanced (Cap 4)", defaults: { capacity: 4, accessStep: 2 } },
    { name: "tight", label: "Tight Memory (Cap 3)", defaults: { capacity: 3, accessStep: 2 } },
  ],
  controls: [
    { id: "capacity", label: "Capacity", min: 2, max: 5, step: 1, unit: "" },
    { id: "accessStep", label: "Access step", min: 0, max: 7, step: 1, unit: "" },
  ],
  telemetry: [
    { id: "capacity", label: "CAPACITY", formatSrc: "(s) => `${s.size}/${s.capacity}`" },
    { id: "hitRatePct", label: "HIT RATE", formatSrc: "(s) => `${s.hitRatePct}%`" },
    {
      id: "lastOp",
      label: "LAST OP",
      formatSrc: "(s) => (s.lastOp && s.lastOp.shortLabel ? s.lastOp.shortLabel : '—')",
    },
    {
      id: "evictions",
      label: "EVICTED",
      formatSrc:
        "(s) => (s.evictions > 0 && s.lastEvicted ? `${s.evictions} (${s.lastEvicted})` : String(s.evictions ?? 0))",
    },
  ],
  steps: STEPS,
  voice: VOICE,
  modelSrc,
  engineBundle,
});

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`Built ${out} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
