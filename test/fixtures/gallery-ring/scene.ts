// Kit gallery: the ring, its pucks and a marker, as a round-robin scheduler.
// It shows the parts in a story a reader gets at first glance, and keeps them
// passing every check (verify runs the galleries with the examples).
import { defineScene } from "../../../src/core/scene.ts";
import type { Mark } from "../../../src/core/types.ts";
import { strip } from "../../../src/render/components.ts";
import { marker, puck, ringAssembly } from "../../../src/parts/flow.ts";

const WORKERS = 6;
const REQUESTS = 7;
const worker = (i: number) => `W${i + 1}`;

interface State { serving: (number | null)[]; next: number; sent: number }
// The workers are the entities on the ring; a worker shows whether it has work.
type Event = { request: number; to: number; wrapped: boolean };

/** Round robin: request r goes to the worker the pointer is on, then the pointer moves one on. */
export function run(): { event: Event; state: State }[] {
  const serving: (number | null)[] = Array(WORKERS).fill(null);
  let next = 0;
  const out: { event: Event; state: State }[] = [];
  for (let r = 1; r <= REQUESTS; r++) {
    const to = next;
    serving[to] = r;
    next = (next + 1) % WORKERS;
    out.push({ event: { request: r, to, wrapped: r > WORKERS }, state: { serving: [...serving], next, sent: r } });
  }
  return out;
}

export default defineScene<State, Event>({
  id: "gallery-ring",
  title: "Round robin",
  question: "Which worker gets the next request?",
  presentation: "editorial",
  trust: "computed",
  setup: "Six workers sit in a ring. A pointer marks whose turn it is; each request goes there and the pointer moves one step clockwise.",
  assumptions: [
    "Every request takes the same time, so a worker is free again by its next turn.",
    "A worker shows only its latest request.",
  ],
  trace: () => ({
    initial: { serving: Array(WORKERS).fill(null), next: 0, sent: 0 },
    intro: "Six idle workers. The pointer starts at W1.",
    steps: run().map(({ event, state }) => ({
      event, state,
      caption: `R${event.request} goes to ${worker(event.to)}; the pointer moves on to ${worker(state.next)}.`,
    })),
  }),
  teaching: (s, e) => ({
    chapter: !e ? "Ring" : e.wrapped ? "Wrap" : e.request <= 3 ? "Turns" : "Round",
    heading: !e ? "Six workers. Next: W1." : e.wrapped ? `Past ${worker(WORKERS - 1)}, back to ${worker(e.to)}.` : `R${e.request} to ${worker(e.to)}. Next: ${worker(s.next)}.`,
    ...(e?.request === WORKERS ? { prediction: { question: `R${WORKERS + 1} arrives next. Which worker gets it?`, choices: [worker(0), worker(WORKERS - 1), "None"], answer: worker(0), explanation: `The ring wraps: after ${worker(WORKERS - 1)} comes ${worker(0)}.` } } : {}),
  }),
  view: (s, e) => {
    const ring = ringAssembly({ key: "ring", slots: WORKERS, slotLabel: null });
    const marks: Mark[] = [...ring.marks];
    s.serving.forEach((r, i) => {
      const now = e?.to === i;
      marks.push(puck({ key: `worker-${i}`, at: ring.slot(i), label: worker(i), tone: now ? "accent" : r === null ? "muted" : "subject", lit: now }));
    });
    marks.push(...marker("next", ring.outside(s.next), "next", { tone: "accent", side: ring.side(s.next), height: ring.markerHeight(s.next) }).marks);
    return marks;
  },
  readout: (s) => `next ${worker(s.next)} · ${s.sent} sent`,
  legend: [{ tone: "accent", label: "Worker just given a request, and the pointer" }, { tone: "subject", label: "Worker with work" }, { tone: "muted", label: "Idle worker" }],
  panels: (s) => [{
    key: "sent", title: "Requests",
    html: strip(Array.from({ length: REQUESTS }, (_, k) => {
      const r = k + 1;
      const to = (r - 1) % WORKERS;
      return r <= s.sent ? { label: `R${r}`, note: worker(to), status: r === s.sent ? "accent" as const : "good" as const, key: `chip-${r}` } : { label: `R${r}`, status: r === s.sent + 1 ? "next" as const : "waiting" as const, key: `chip-${r}` };
    })),
  }],
  observe: (s) => [
    ...s.serving.map((_, i) => ({ type: "text" as const, key: `worker-${i}`, equals: worker(i) })),
    { type: "visible", key: "next/cap", visible: true },
  ],
});
