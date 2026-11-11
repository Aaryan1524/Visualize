#!/usr/bin/env node
// Scaffold a new explanation that builds and verifies as generated.
//
//   node scripts/new-scene.mjs ring-buffer
//   node scripts/new-scene.mjs ring-buffer --dir examples
//
// Writes <dir>/<name>/model.ts, model.test.ts and scene.ts: a small FIFO
// queue on the kit's rail, in the editorial layout, with teaching beats,
// a prediction and observations. Replace the model first, then the view.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith("--"));
const dirArg = args[args.indexOf("--dir") + 1];
if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error("usage: node scripts/new-scene.mjs <name>   (lowercase letters, digits and hyphens)");
  process.exit(1);
}
const base = resolve(args.includes("--dir") ? dirArg : join(ROOT, "examples"));
const dir = join(base, name);
if (existsSync(dir)) {
  console.error(`${relative(process.cwd(), dir)} already exists`);
  process.exit(1);
}
const src = relative(dir, join(ROOT, "src")).split("\\").join("/");
const title = name.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

const model = `// The executable model: the truth every number, motion and caption comes from.
// Keep it pure; record the state after every event.

export interface QueueState {
  capacity: number;
  /** Items in the queue, oldest first. */
  items: string[];
  /** Every arrival in the run and how many have been handled. */
  arrivals: string[];
  handled: number;
  served: string[];
  rejected: string[];
}

export type QueueEvent =
  | { type: "enqueue"; item: string; index: number }
  | { type: "reject"; item: string; index: number }
  | { type: "dequeue"; item: string };

export function initial(capacity: number, arrivals: string[]): QueueState {
  if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError("capacity must be a positive integer");
  return { capacity, items: [], arrivals, handled: 0, served: [], rejected: [] };
}

/** Apply one operation: "+" takes the next arrival, "-" serves the oldest item. */
export function step(s: QueueState, op: "+" | "-"): { state: QueueState; event: QueueEvent } {
  if (op === "-") {
    const [item, ...rest] = s.items;
    if (item === undefined) throw new Error("nothing to serve");
    return { state: { ...s, items: rest, served: [...s.served, item] }, event: { type: "dequeue", item } };
  }
  const index = s.handled;
  const item = s.arrivals[index];
  if (item === undefined) throw new Error("no arrivals left");
  if (s.items.length === s.capacity) {
    return { state: { ...s, handled: index + 1, rejected: [...s.rejected, item] }, event: { type: "reject", item, index } };
  }
  return { state: { ...s, items: [...s.items, item], handled: index + 1 }, event: { type: "enqueue", item, index } };
}

export function run(capacity: number, arrivals: string[], ops: ("+" | "-")[]) {
  let state = initial(capacity, arrivals);
  return ops.map((op) => {
    const next = step(state, op);
    state = next.state;
    return next;
  });
}
`;

const test = `import assert from "node:assert/strict";
import test from "node:test";
import { run } from "./model.ts";
import { ARRIVALS, CAPACITY, OPS } from "./scene.ts";

/** A separately written reference: an array used as a bounded queue. */
function reference(capacity: number, arrivals: string[], ops: ("+" | "-")[]) {
  const q: string[] = [];
  let next = 0;
  return ops.map((op) => {
    if (op === "-") return { kind: "dequeue", item: q.shift()!, items: [...q] };
    const item = arrivals[next++]!;
    if (q.length === capacity) return { kind: "reject", item, items: [...q] };
    q.push(item);
    return { kind: "enqueue", item, items: [...q] };
  });
}

test("the scene's run matches the reference", () => {
  const ref = reference(CAPACITY, ARRIVALS, OPS);
  run(CAPACITY, ARRIVALS, OPS).forEach(({ state, event }, i) => {
    assert.equal(event.type, ref[i]!.kind, \`step \${i}\`);
    assert.equal(event.item, ref[i]!.item, \`step \${i}\`);
    assert.deepEqual(state.items, ref[i]!.items, \`step \${i}\`);
    assert.ok(state.items.length <= CAPACITY);
  });
});

test("the run shows an enqueue, a rejection and a dequeue", () => {
  const types = new Set(run(CAPACITY, ARRIVALS, OPS).map((s) => s.event.type));
  for (const t of ["enqueue", "reject", "dequeue"]) assert.ok(types.has(t as never), t);
});
`;

const scene = `import { defineScene } from "${src}/core/scene.ts";
import type { Mark, Observation, Teaching } from "${src}/core/types.ts";
import { cartridge, railAssembly, RAIL_CELL } from "${src}/parts/rail.ts";
import { strip, totals, type StripItem } from "${src}/render/components.ts";
import { initial, run, type QueueEvent, type QueueState } from "./model.ts";

export const CAPACITY = 3;
export const ARRIVALS = ["A", "B", "C", "D", "E"];
/** "+" takes the next arrival, "-" serves the oldest. Chosen to show a rejection. */
export const OPS: ("+" | "-")[] = ["+", "+", "+", "+", "-", "+"];

// The view maps a state to keyed marks. Keys are model entity ids: they are
// how motion, linking and the checks find things. Use kit parts, not raw boxes.
function view(s: QueueState, e: QueueEvent | null): Mark[] {
  const rail = railAssembly({ key: "", slots: s.capacity });
  const marks: Mark[] = [...rail.marks];
  s.items.forEach((item, i) => {
    const fresh = e?.type === "enqueue" && e.item === item;
    marks.push(cartridge({ key: \`item-\${item}\`, at: rail.slot(i), size: RAIL_CELL, label: item, tone: fresh ? "accent" : "subject", lit: fresh, enter: "drop" }));
  });
  if (e?.type === "dequeue") marks.push(cartridge({ key: \`item-\${e.item}\`, at: [-40, 0, 3], size: RAIL_CELL, label: e.item, tone: "good", leaving: true }));
  marks.push(
    { kind: "label", key: "head", at: [-12, 24, 13], text: "Served next", anchor: "end", size: "small", target: rail.anchor.first },
    { kind: "label", key: "tail", at: [rail.length + 20, 25, 3], text: "Newest", anchor: "start", size: "small", target: rail.anchor.last },
  );
  return marks;
}

function teaching(s: QueueState, e: QueueEvent | null, index: number): Teaching {
  if (index === 0) return { chapter: "Fill", heading: "An empty queue with three slots." };
  if (index === 3) {
    return {
      chapter: "Fill",
      heading: "The queue is full.",
      prediction: { question: "D arrives. What happens to it?", choices: ["Queued", "Rejected"], answer: "Rejected", explanation: "Rejected: a full queue has no slot for D." },
    };
  }
  if (e?.type === "reject") return { chapter: "Overflow", heading: \`\${e.item} is rejected.\` };
  if (e?.type === "dequeue") return { chapter: "Serve", heading: \`\${e.item} is served first.\` };
  return { chapter: index < 3 ? "Fill" : "Serve", heading: e ? \`\${e.item} joins the back.\` : "" };
}

function observe(s: QueueState, e: QueueEvent | null): Observation[] {
  const obs: Observation[] = [
    ...s.items.map((item) => ({ type: "text" as const, key: \`item-\${item}\`, equals: item })),
    ...s.items.map((item) => ({ type: "visible" as const, key: \`item-\${item}\`, visible: true })),
    ...s.items.map((item) => ({ type: "extent" as const, key: \`item-\${item}\`, size: RAIL_CELL, radius: 2 })),
    { type: "text", key: "served", equals: String(s.served.length) },
    { type: "text", key: "rejected", equals: String(s.rejected.length) },
  ];
  if (s.items.length > 1) obs.push({ type: "order", keys: s.items.map((i) => \`item-\${i}\`), axis: "x" });
  if (e?.type === "dequeue") obs.push({ type: "visible", key: \`item-\${e.item}\`, visible: false });
  return obs;
}

export default defineScene<QueueState, QueueEvent>({
  id: "${name}",
  title: "${title}",
  question: "What does a full queue do?",
  presentation: "editorial",
  setup: "Items join at the back and are served from the front.",
  trust: "computed",
  assumptions: ["Three slots; arrivals that find the queue full are rejected rather than waiting."],
  trace: () => {
    const steps = run(CAPACITY, ARRIVALS, OPS);
    return {
      initial: initial(CAPACITY, ARRIVALS),
      intro: \`An empty queue with room for \${CAPACITY} items.\`,
      steps: steps.map(({ state, event }) => ({
        event,
        state,
        caption: event.type === "enqueue" ? \`\${event.item} joins the back of the queue.\` : event.type === "reject" ? \`\${event.item} arrives at a full queue and is rejected.\` : \`\${event.item}, the oldest item, is served.\`,
      })),
    };
  },
  view,
  teaching,
  panels: (s) => {
    const items: StripItem[] = s.arrivals.map((a, i) => ({
      label: a,
      ...(s.rejected.includes(a) ? { note: "rejected", status: "bad" } : i < s.handled ? { note: "queued", status: "good" } : i === s.handled ? { note: "next", status: "next" } : { status: "waiting" }),
    }) as StripItem);
    return [{ key: "arrivals", title: "Arrivals", html: strip(items) + totals([{ value: String(s.served.length), label: "served", key: "served" }, { value: String(s.rejected.length), label: "rejected", key: "rejected" }]) }];
  },
  observe,
  readout: (s) => \`\${s.items.length} of \${s.capacity} slots\`,
  legend: [
    { tone: "subject", label: "Queued item" },
    { tone: "accent", label: "Just arrived" },
    { tone: "good", label: "Served" },
  ],
});
`;

mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "model.ts"), model);
writeFileSync(join(dir, "model.test.ts"), test);
writeFileSync(join(dir, "scene.ts"), scene);
const rel = relative(process.cwd(), dir);
console.log(`created ${rel}/model.ts, model.test.ts, scene.ts

next:
  node --test ${rel}/model.test.ts
  node scripts/build.mjs ${rel}
  node scripts/verify.mjs ${rel}`);
