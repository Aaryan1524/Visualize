// Kit gallery: a reservoir refilled by a source, a gate, and a sequence panel,
// as a permit limiter. It shows the parts in a story a reader gets at first
// glance, and keeps them passing every check.
import { defineScene } from "../../../src/core/scene.ts";
import type { CylinderMark, Mark } from "../../../src/core/types.ts";
import { gate, reservoir, source } from "../../../src/parts/flow.ts";
import { message } from "../../../src/parts/network.ts";
import { sequence, strip, totals } from "../../../src/render/components.ts";

const CAPACITY = 3;
const REFILL_EVERY = 10;
type Call = { id: number; at: number };
const CALLS: Call[] = [{ id: 1, at: 1 }, { id: 2, at: 2 }, { id: 3, at: 3 }, { id: 4, at: 4 }, { id: 5, at: 12 }];

interface State { permits: string[]; t: number; passed: number[]; turned: number[] }
type Event = { kind: "call"; call: Call; ok: boolean; took?: string } | { kind: "refill"; added: string };

/** A permit is taken by each call that finds one; one is added back every REFILL_EVERY seconds, up to CAPACITY. */
export function run(): { event: Event; state: State }[] {
  let permits = Array.from({ length: CAPACITY }, (_, i) => `p${i}`);
  let made = CAPACITY, t = 0;
  const passed: number[] = [], turned: number[] = [];
  const out: { event: Event; state: State }[] = [];
  const snap = () => ({ permits: [...permits], t, passed: [...passed], turned: [...turned] });
  for (const call of CALLS) {
    while (Math.floor(call.at / REFILL_EVERY) > Math.floor(t / REFILL_EVERY)) {
      t = (Math.floor(t / REFILL_EVERY) + 1) * REFILL_EVERY;
      if (permits.length < CAPACITY) {
        const added = `p${made++}`;
        permits = [...permits, added];
        out.push({ event: { kind: "refill", added }, state: snap() });
      }
    }
    t = call.at;
    if (permits.length) {
      const took = permits[permits.length - 1]!;
      permits = permits.slice(0, -1);
      passed.push(call.id);
      out.push({ event: { kind: "call", call, ok: true, took }, state: snap() });
    } else {
      turned.push(call.id);
      out.push({ event: { kind: "call", call, ok: false }, state: snap() });
    }
  }
  return out;
}

const steps = run();

export default defineScene<State, Event>({
  id: "gallery-flow",
  title: "Permit limiter",
  question: "Why is the fourth call turned away?",
  presentation: "editorial",
  trust: "computed",
  setup: `A gate lets a call through only if it can take a permit. There are at most ${CAPACITY}; one comes back every ${REFILL_EVERY} s.`,
  assumptions: [`Permits are refilled one at a time every ${REFILL_EVERY} s, never beyond ${CAPACITY}.`, "A call that finds no permit is turned away, not queued."],
  trace: () => ({
    initial: { permits: Array.from({ length: CAPACITY }, (_, i) => `p${i}`), t: 0, passed: [], turned: [] },
    intro: `${CAPACITY} permits, no calls yet.`,
    steps: steps.map(({ event, state }) => ({
      event, state,
      caption: event.kind === "refill" ? `At ${state.t} s the refill adds a permit.` : event.ok ? `Call ${event.call.id} takes a permit and passes; ${state.permits.length} left.` : `Call ${event.call.id} finds no permit and is turned away.`,
    })),
  }),
  teaching: (s, e) => ({
    chapter: !e ? "Permits" : e.kind === "refill" || s.t >= REFILL_EVERY ? "Refill" : s.permits.length || (e.kind === "call" && e.ok) ? "Take" : "Empty",
    heading: !e ? `${CAPACITY} permits, gate idle.` : e.kind === "refill" ? "Refill: one permit back." : e.ok ? `Call ${e.call.id} takes one. ${s.permits.length} left.` : `Call ${e.call.id}: none left. Turned away.`,
    ...(e?.kind === "call" && e.call.id === 3 ? { prediction: { question: "Call 4 comes next. Does it pass?", choices: ["Passes", "Turned away"], answer: "Turned away", explanation: "Turned away: all three permits are gone until the 10 s refill." } } : {}),
  }),
  view: (s, e) => {
    const stock = reservoir("permits", [0, 0, 0], { capacity: CAPACITY, items: s.permits.map((id) => ({ id, tone: "hot" as const })), unit: "permit" });
    const refill = source("refill", [0, 0, 0], { rate: `+1 every ${REFILL_EVERY} s`, lit: e?.kind === "refill" });
    const g = gate("gate", [62, 4, 0], { open: e?.kind === "call" ? e.ok : null, lit: e?.kind === "call" });
    const marks: Mark[] = [...stock.marks, ...refill.marks, ...g.marks];
    // A taken permit goes to the gate, where the call spends it.
    if (e?.kind === "call" && e.took) marks.push({ kind: "cylinder", key: `permits/item-${e.took}`, at: [g.anchor.in[0], g.anchor.in[1], 0], radius: 6, height: 3.6, tone: "hot", leaving: true, arc: 34 } as CylinderMark);
    if (e?.kind === "call") marks.push(message(`call-${e.call.id}`, e.ok ? g.anchor.out : g.anchor.reject, "request", { tone: e.ok ? "good" : "bad", enter: "fade", exit: "fade" }));
    marks.push(
      { kind: "label", key: "name-permits", at: [-6, 34, 0], text: `Permits (${CAPACITY} max)`, size: "small", anchor: "end", target: stock.pin("front") },
      { kind: "label", key: "name-gate", at: [g.anchor.top[0] + 10, g.anchor.top[1] - 10, 40], text: "Gate", size: "small", anchor: "start", target: g.pin("top") },
    );
    return marks;
  },
  readout: (s) => `${s.permits.length} permits · ${s.passed.length} passed · ${s.turned.length} turned away · t = ${s.t} s`,
  legend: [{ tone: "hot", label: "Permit" }, { tone: "good", label: "Call passes" }, { tone: "bad", label: "Call turned away" }],
  panels: (s) => [
    {
      key: "calls", title: "Calls",
      html: strip(CALLS.map((c) => s.passed.includes(c.id) ? { label: `C${c.id}`, note: "passed", status: "good" as const, key: `chip-${c.id}` }
        : s.turned.includes(c.id) ? { label: `C${c.id}`, note: "refused", status: "bad" as const, key: `chip-${c.id}` }
        : { label: `C${c.id}`, status: "waiting" as const, key: `chip-${c.id}` }))
        + totals([{ value: String(s.permits.length), label: "permits left", key: "left" }, { value: String(s.turned.length), label: "turned away", key: "turned", status: s.turned.length ? "bad" : "neutral" }]),
    },
    {
      key: "seq", title: "Over time", place: "side",
      html: sequence({
        lanes: [{ id: "c", label: "Callers" }, { id: "g", label: "Gate" }],
        messages: CALLS.filter((c) => c.at <= s.t).map((c) => ({ id: `m${c.id}`, from: "c", to: "g", at: c.at, arrive: c.at, label: `C${c.id} ${s.turned.includes(c.id) ? "refused" : "passes"}`, status: s.turned.includes(c.id) ? "bad" as const : "good" as const })),
        marks: Array.from({ length: Math.floor(14 / REFILL_EVERY) }, (_, k) => ({ lane: "g", at: (k + 1) * REFILL_EVERY, label: "refill", status: "accent" as const, ghost: (k + 1) * REFILL_EVERY > s.t })),
        now: s.t, until: 14, unit: "s",
      }),
    },
  ],
  observe: (s) => [
    { type: "text", key: "left", equals: String(s.permits.length) },
    { type: "text", key: "turned", equals: String(s.turned.length) },
    ...s.permits.map((id) => ({ type: "visible" as const, key: `permits/item-${id}`, visible: true })),
  ],
});
