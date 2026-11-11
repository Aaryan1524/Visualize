import assert from "node:assert/strict";
import test from "node:test";
import { resolveFrame } from "./interpolate.ts";
import { compile, defineScene } from "./scene.ts";
import { buildTimeline, DEFAULT_PHASES, frameIndexAt } from "./timeline.ts";
import type { BoxMark, Mark } from "./types.ts";

const box = (key: string, x: number, extra: Partial<BoxMark> = {}): BoxMark => ({
  kind: "box",
  key,
  at: [x, 0, 0],
  size: [10, 10, 10],
  ...extra,
});

test("timeline: holds, transitions and rest times line up", () => {
  const tl = buildTimeline([{ duration: 1000 }, { duration: 500 }], 200);
  assert.deepEqual(tl.start, [0, 200, 1400]);
  assert.deepEqual(tl.rest, [0, 1200, 1900]);
  assert.equal(tl.total, 1900);
  assert.deepEqual(frameIndexAt(tl, 0), { index: 0, progress: 1 });
  assert.deepEqual(frameIndexAt(tl, 100), { index: 0, progress: 1 });
  assert.deepEqual(frameIndexAt(tl, 700), { index: 1, progress: 0.5 });
  assert.deepEqual(frameIndexAt(tl, 1300), { index: 1, progress: 1 });
  assert.deepEqual(frameIndexAt(tl, 1900), { index: 2, progress: 1 });
  // Clamped outside the range.
  assert.deepEqual(frameIndexAt(tl, -5), { index: 0, progress: 1 });
  assert.deepEqual(frameIndexAt(tl, 99999), { index: 2, progress: 1 });
});

test("timeline: zero-duration steps jump without dividing by zero", () => {
  const tl = buildTimeline([{ duration: 0 }], 100);
  assert.deepEqual(frameIndexAt(tl, 100), { index: 1, progress: 1 });
});

test("interpolate: matched marks move, unmatched enter and exit", () => {
  const prev: Mark[] = [box("a", 0), box("gone", 50, { exit: "fade" })];
  const next: Mark[] = [box("a", 20), box("new", 80, { enter: "fade" })];

  const start = resolveFrame(prev, next, 0, DEFAULT_PHASES);
  const a0 = start.find((m) => m.key === "a") as BoxMark;
  assert.equal(a0.at[0], 0);
  assert.ok(start.some((m) => m.key === "gone"), "exiting mark still drawn at start");
  assert.ok(!start.some((m) => m.key === "new"), "entering mark not drawn before its phase");

  const mid = resolveFrame(prev, next, 0.5, DEFAULT_PHASES);
  const aMid = mid.find((m) => m.key === "a") as BoxMark;
  assert.ok(aMid.at[0] > 0 && aMid.at[0] < 20, "moving mark is between its two positions");

  const end = resolveFrame(prev, next, 1, DEFAULT_PHASES);
  assert.deepEqual(end.map((m) => m.key), ["a", "new"]);
  assert.equal((end[0] as BoxMark).at[0], 20);
  assert.ok(end.every((m) => m.opacity === 1));
});

test("interpolate: exits finish before entries begin by default", () => {
  const prev: Mark[] = [box("old", 0, { exit: "fade" })];
  const next: Mark[] = [box("new", 0, { enter: "fade" })];
  for (let p = 0; p <= 1; p += 0.01) {
    const keys = resolveFrame(prev, next, p, DEFAULT_PHASES).map((m) => m.key);
    assert.ok(!(keys.includes("old") && keys.includes("new")), `both drawn at p=${p.toFixed(2)}`);
  }
});

test("interpolate: transient marks only exist mid-transition and follow their path", () => {
  const msg: BoxMark = {
    ...box("msg", 0),
    transient: true,
    travel: { from: [0, 0, 0], to: [100, 0, 0] },
  };
  const next: Mark[] = [box("a", 0), msg];
  assert.ok(!resolveFrame([], next, 0, DEFAULT_PHASES).some((m) => m.key === "msg"));
  assert.ok(!resolveFrame([], next, 1, DEFAULT_PHASES).some((m) => m.key === "msg"));
  const mid = resolveFrame([], next, 0.5, DEFAULT_PHASES).find((m) => m.key === "msg") as BoxMark;
  assert.ok(mid && mid.at[0] > 0 && mid.at[0] < 100);
});

test("interpolate: effects cancel out at both ends of the move", () => {
  const prev: Mark[] = [box("a", 0)];
  const next: Mark[] = [box("a", 0, { effect: "shake" })];
  const end = resolveFrame(prev, next, DEFAULT_PHASES.move[1], DEFAULT_PHASES)[0] as BoxMark;
  assert.equal(end.at[0], 0);
});

const counter = defineScene<{ n: number }, { type: "inc" }>({
  id: "counter",
  title: "Counter",
  question: "What does inc do?",
  trust: "computed",
  trace: () => ({
    initial: { n: 0 },
    intro: "Start at zero.",
    steps: [1, 2, 3].map((n) => ({ event: { type: "inc" as const }, state: { n }, caption: `Now ${n}.` })),
  }),
  view: (s) => [box("n", s.n * 10, { label: String(s.n) })],
  readout: (s) => `n = ${s.n}`,
  observe: (s) => [{ type: "text", key: "n", equals: String(s.n) }],
});

test("scene: compile runs the model once and frames are pure", () => {
  const c = compile(counter, { hold: 100 });
  assert.equal(c.steps.length, 4);
  assert.equal(c.steps[3]!.readout, "n = 3");
  const t = (c.restTime(1) + c.restTime(2)) / 2;
  assert.deepEqual(c.frameAt(t), c.frameAt(t), "same time gives the same frame");
  // Seeking anywhere and back gives the same frame as seeking directly.
  const direct = JSON.stringify(c.frameAt(t));
  for (const other of [0, c.timeline.total, 333, t / 3]) c.frameAt(other);
  assert.equal(JSON.stringify(c.frameAt(t)), direct);
});

test("scene: caption switches halfway through a transition", () => {
  const c = compile(counter, { hold: 100 });
  const s = c.timeline.start[1]!;
  const d = c.timeline.duration[1]!;
  assert.equal(c.frameAt(s + d * 0.4).shown.caption, "Start at zero.");
  assert.equal(c.frameAt(s + d * 0.6).shown.caption, "Now 1.");
});

test("scene: duplicate keys are rejected", () => {
  const bad = defineScene({ ...counter, view: () => [box("x", 0), box("x", 1)] });
  assert.throws(() => compile(bad), /duplicate mark key "x"/);
});

test("leaving: the previous mark travels to its leaving target and is gone at rest", () => {
  const prev: Mark[] = [box("b", 0)];
  const next: Mark[] = [box("b", -40, { leaving: true, tone: "bad" })];
  const mid = resolveFrame(prev, next, 0.6, DEFAULT_PHASES).find((m) => m.key === "b") as BoxMark;
  assert.ok(mid && mid.at[0] < 0 && mid.at[0] > -40, "moving toward the target");
  assert.equal(mid.tone, "bad", "takes the leaving mark's look after the midpoint");
  assert.ok(!resolveFrame(prev, next, 1, DEFAULT_PHASES).some((m) => m.key === "b"), "not drawn at rest");
  assert.ok(!resolveFrame(prev, next, DEFAULT_PHASES.move[1], DEFAULT_PHASES).some((m) => m.key === "b"), "faded by the end of the move");
});

test("leaving: a leaving mark with no previous mark draws nothing", () => {
  const next: Mark[] = [box("ghost", 0, { leaving: true })];
  for (const p of [0, 0.5, 1]) assert.equal(resolveFrame([], next, p, DEFAULT_PHASES).length, 0);
});

test("arc: a hop lifts the mark mid-move and lands it exactly", () => {
  const prev: Mark[] = [box("a", 0)];
  const next: Mark[] = [box("a", 60, { arc: 20 })];
  const mid = resolveFrame(prev, next, 0.5, DEFAULT_PHASES)[0] as BoxMark;
  assert.ok(mid.at[2] > 15, `lifted, z=${mid.at[2]}`);
  const end = resolveFrame(prev, next, DEFAULT_PHASES.move[1], DEFAULT_PHASES)[0] as BoxMark;
  assert.equal(end.at[2], 0);
  assert.equal(end.at[0], 60);
});

test("arc: transient marks hop along their travel path too", () => {
  const msg: BoxMark = { ...box("m", 0), transient: true, arc: 30, travel: { from: [0, 0, 0], to: [100, 0, 0] } };
  const mid = resolveFrame([], [msg], 0.5, DEFAULT_PHASES).find((m) => m.key === "m") as BoxMark;
  assert.ok(mid.at[2] > 25, `lifted, z=${mid.at[2]}`);
});

test("pulse: a pulsing solid keeps its base where it rests", () => {
  const prev: Mark[] = [box("a", 0, { at: [0, 0, 6] })];
  const next: Mark[] = [box("a", 0, { at: [0, 0, 6], effect: "pulse" })];
  for (const p of [0.3, 0.5, 0.7]) {
    const r = resolveFrame(prev, next, p, DEFAULT_PHASES)[0] as BoxMark;
    assert.equal(r.at[2], 6, `base moved at p=${p}`);
  }
  const mid = resolveFrame(prev, next, 0.5, DEFAULT_PHASES)[0] as BoxMark;
  assert.ok(mid.size[2] > 10, "it does grow");
});
