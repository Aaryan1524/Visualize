import { defineScene } from "../../src/core/scene.ts";
import type { Mark, Observation, Panel, Teaching, Tone, Vec3 } from "../../src/core/types.ts";
import { cable, COIN_BASE, COIN_HEIGHT, keyStore, ledger, message, plate, server, terminal } from "../../src/parts/network.ts";
import { strip, totals, type StripItem } from "../../src/render/components.ts";
import { simulate, totalCharged, type Config, type Ev, type Message, type Snapshot } from "./model.ts";

/** One payment, one lost response, one retry. */
export const SCENARIO: Config = {
  idempotent: false,
  amount: 20,
  latency: 40,
  dbTime: 20,
  timeout: 1000,
  maxAttempts: 3,
  drop: ["response-1"],
  key: "pay_7f3a",
};

type World = "unsafe" | "safe";
const WORLDS: World[] = ["unsafe", "safe"];
const NAME: Record<World, string> = { unsafe: "without a key", safe: "with an idempotency key" };
const LANE_TITLE: Record<World, string> = { unsafe: "No key", safe: "Idempotency key" };

export interface Joint {
  t: number;
  worlds: Record<World, Snapshot>;
}
export interface JointEvent {
  t: number;
  events: Record<World, Ev[]>;
}

/** Run both worlds on the same faults and merge their events by time. */
export function twin() {
  const runs = {
    unsafe: simulate({ ...SCENARIO, idempotent: false }),
    safe: simulate({ ...SCENARIO, idempotent: true }),
  };
  const times = [...new Set([...runs.unsafe, ...runs.safe].map((r) => r.event.t))].sort((a, b) => a - b);
  const empty: Snapshot = { t: 0, ledger: [], store: null, client: { status: "idle", attempts: 0 }, inflight: [] };
  const stateAt = (w: World, t: number) => runs[w].filter((r) => r.event.t <= t).at(-1)?.state ?? empty;
  return {
    initial: { t: 0, worlds: { unsafe: empty, safe: empty } } as Joint,
    steps: times.map((t) => ({
      event: { t, events: { unsafe: runs.unsafe.filter((r) => r.event.t === t).map((r) => r.event), safe: runs.safe.filter((r) => r.event.t === t).map((r) => r.event) } } as JointEvent,
      state: { t, worlds: { unsafe: stateAt("unsafe", t), safe: stateAt("safe", t) } } as Joint,
    })),
  };
}

// ---- Stage --------------------------------------------------------------------------
// ---- Stage --------------------------------------------------------------------------
// Two identical systems on two plates, one behind the other. Every position
// comes from a part's anchors; nothing below is placed by eye except the parts.
const LANE = 94;
const laneY = (w: World) => (w === "unsafe" ? 0 : LANE);
const TERMINAL_X = 0;
const SERVER_X = 80;
const STORE_X = 128;
const LEDGER_X = 182;

const STATUS: Record<Snapshot["client"]["status"], string> = {
  idle: "ready",
  waiting: "waiting",
  retrying: "retry",
  paid: "paid",
  failed: "failed",
};

/** The world's parts, built once per state so cables and messages use their anchors. */
function rig(w: World, snap: Snapshot, evs: Ev[]) {
  const y = laneY(w);
  const has = (type: Ev["type"]) => evs.some((x) => x.type === type);
  const term = terminal(`${w}/terminal`, [TERMINAL_X, y + 2, 0], { status: STATUS[snap.client.status], lit: has("paid") || has("timeout") });
  const lamp: Tone = has("charge") ? "accent" : has("replay") ? "cold" : "good";
  const srv = server(`${w}/server`, [SERVER_X, y - 2.5, 0], { lamp, lit: has("replay") });
  const coins = snap.ledger.map((c, k) => ({ id: String(c.id), tone: (k === 0 ? "good" : "bad") as Tone, lit: evs.some((x) => x.type === "charge" && x.charge.id === c.id) }));
  const led = ledger(`${w}/ledger`, [LEDGER_X, y + 14.5, 0], coins);
  const store = w === "safe" ? keyStore(`${w}/store`, [STORE_X, y - 14, 0], { stored: snap.store !== null, lit: has("replay"), pulse: has("replay") }) : null;
  return { y, term, srv, led, store };
}

function view(s: Joint, e: JointEvent | null): Mark[] {
  const marks: Mark[] = [];
  for (const w of WORLDS) {
    const snap = s.worlds[w];
    const evs = e?.events[w] ?? [];
    const { y, term, srv, led, store } = rig(w, snap, evs);
    marks.push(...plate(`${w}/plate`, [-18, y - 18, 0], [LEDGER_X + 40, 68]).marks);
    marks.push(cable(`${w}/wire`, term.anchor.port!, srv.anchor.inPort!));
    marks.push(cable(`${w}/db-wire`, srv.anchor.outPort!, led.anchor.inPort!));
    marks.push(...term.marks, ...srv.marks, ...led.marks, ...(store?.marks ?? []));

    // Messages wait at their sender, then ride the cable to where they arrive or are lost.
    const at = (m: Message) => (m.from === "client" ? term.anchor.outbox! : srv.anchor.inbox!);
    const dest = (m: Message) => (m.to === "server" ? srv.anchor.inbox! : term.anchor.outbox!);
    const middle: Vec3 = [(term.anchor.outbox![0] + srv.anchor.inbox![0]) / 2, term.anchor.outbox![1], 0.6];
    for (const m of snap.inflight) marks.push(message(`${w}/msg-${m.id}`, at(m), m.kind, { link: `${w}-${m.id}` }));
    for (const ev of evs) {
      if (ev.type === "arrive") marks.push(message(`${w}/msg-${ev.message.id}`, dest(ev.message), ev.message.kind, { leaving: true }));
      if (ev.type === "lost") marks.push(message(`${w}/msg-${ev.message.id}`, middle, ev.message.kind, { leaving: true, tone: "bad" }));
    }

    // Lane title just outside the plate's far-left corner, and the running total above each ledger.
    // Each lane is named beyond its plate's outer front-right corner, next to its outcome.
    marks.push({ kind: "label", key: `${w}/title`, at: [LEDGER_X + 30, y + 60, -5], text: LANE_TITLE[w], anchor: "start" });
    // The total floats at a fixed height that clears the tallest stack in the run.
    marks.push({ kind: "label", key: `${w}/total`, at: [LEDGER_X + 22, y + 14.5, COIN_BASE + 3 * COIN_HEIGHT + 24], text: `$${totalCharged(snap)}`, size: "large" });
  }
  // Part names once, in a row in front of the front plate, each pinned to its part.
  const front = rig("safe", s.worlds.safe, e?.events.safe ?? []);
  const rowY = LANE + 62;
  const name = (key: string, text: string, x: number, target: { key: string; at: Vec3 }): Mark => ({ kind: "label", key, at: [x, rowY, -5], text, size: "small", target });
  marks.push(
    name("name-terminal", "Terminal", 19, { key: "safe/terminal/base", at: [19, LANE + 28, 2.5] }),
    name("name-server", "Server", SERVER_X + 20, { key: "safe/server/plinth", at: [SERVER_X + 20, LANE + 31.5, 2] }),
    name("name-ledger", "Ledger", LEDGER_X, { key: "safe/ledger/base", at: front.led.anchor.front! }),
  );
  marks.push(name("name-store", "Key store", STORE_X + 16, { key: "safe/store/tray", at: [STORE_X + 14, LANE + 8, 2.5] }));
  return marks;
}

function describe(ev: Ev): string {
  switch (ev.type) {
    case "send":
      return ev.message.kind === "request" ? `client sends payment, attempt ${ev.message.attempt}` : `server sends success for attempt ${ev.message.attempt}`;
    case "arrive":
      return ev.message.kind === "request" ? `server receives attempt ${ev.message.attempt}` : `client receives success`;
    case "lost":
      return `${ev.message.kind} ${ev.message.attempt} lost`;
    case "charge":
      return `ledger charges $${ev.charge.amount} (charge ${ev.charge.id})`;
    case "replay":
      return `key seen: stored response replayed, no charge`;
    case "timeout":
      return `client times out`;
    case "paid":
      return `client marks the order paid`;
    case "give-up":
      return `client gives up`;
  }
}

function caption(s: Joint, e: JointEvent): string {
  const [u, k] = [e.events.unsafe, e.events.safe];
  const has = (list: Ev[], type: Ev["type"]) => list.some((x) => x.type === type);
  const same = JSON.stringify(u.map((x) => x.type)) === JSON.stringify(k.map((x) => x.type));
  const t = `${e.t} ms`;
  if (has(u, "charge") && has(k, "replay")) {
    return `${t}: here the worlds split. Without a key, the server cannot tell the retry from a new payment and charges again. With a key, it finds ${SCENARIO.key} already stored and returns the saved response instead.`;
  }
  if (!same) return `${t}: without a key, ${u.map(describe).join("; ") || "nothing"}. With a key, ${k.map(describe).join("; ") || "nothing"}.`;
  if (has(u, "timeout")) return `${t}: no response after ${SCENARIO.timeout} ms, so the client times out and sends the same payment again. It cannot know the first one succeeded.`;
  if (has(u, "lost")) return `${t}: the success response is lost on the network. The payment went through, but the client never hears about it.`;
  if (has(u, "charge")) {
    return k.length && s.worlds.safe.store
      ? `${t}: the ledger records the $${SCENARIO.amount} charge. The keyed server also stores ${SCENARIO.key} with its response, in the same transaction.`
      : `${t}: the ledger records the charge.`;
  }
  if (has(u, "paid")) {
    const [cu, ck] = [s.worlds.unsafe.ledger.length, s.worlds.safe.ledger.length];
    return `${t}: both clients see success and mark the order paid. The customer was charged ${cu} times without a key, and ${ck === 1 ? "once" : `${ck} times`} with one.`;
  }
  if (has(u, "send") && u[0]?.type === "send" && u[0].message.attempt === 1 && u[0].message.kind === "request") {
    return `${t}: the client sends a $${SCENARIO.amount} payment. In the front system the request carries the idempotency key ${SCENARIO.key}.`;
  }
  return `${t}: ${u.map(describe).join("; ")}.`;
}

// ---- Teaching ---------------------------------------------------------------------------
const STEP_HEADING: string[] = [
  "Two identical payment systems.",
  "Terminal sends $20.",
  "Server receives the payment.",
  "Ledger records $20.",
  "Server replies: paid.",
  "The reply is lost.",
  "No reply. The terminal retries.",
  "The retry reaches the server.",
  "No key: charged again. Key: replayed.",
  "Both servers reply: paid.",
  "Same faults. $40 versus $20.",
];
const CHAPTER = (i: number) => (i <= 4 ? "Pay" : i <= 6 ? "Lose" : i <= 8 ? "Retry" : "Settle");

function teaching(_s: Joint, _e: JointEvent | null, index: number): Teaching {
  const t: Teaching = { chapter: CHAPTER(index), heading: STEP_HEADING[index] ?? "" };
  if (index === 7) {
    t.prediction = {
      question: "Without a key, how many charges now?",
      choices: ["1", "2"],
      answer: "2",
      explanation: "2: without a key, the retry looks like a new payment.",
    };
  }
  return t;
}

function panels(s: Joint, e: JointEvent | null): Panel[] {
  // One chip per moment; where the worlds disagree the chip shows the keyless outcome.
  const steps = twin().steps;
  const note = (evs: Ev[]): string => {
    if (evs.some((x) => x.type === "lost")) return "lost";
    if (evs.some((x) => x.type === "charge")) return "charge";
    if (evs.some((x) => x.type === "replay")) return "replay";
    if (evs.some((x) => x.type === "timeout")) return "retry";
    if (evs.some((x) => x.type === "paid")) return "paid";
    if (evs.some((x) => x.type === "arrive")) return "arrive";
    return "send";
  };
  const items: StripItem[] = steps.map((x) => {
    const done = x.event.t < s.t || (e !== null && x.event.t === e.t);
    const split = note(x.event.events.unsafe) !== note(x.event.events.safe);
    const n = note(x.event.events.unsafe);
    const status = !done ? (x === steps.find((y) => y.event.t > s.t) ? "next" : "waiting") : split || n === "lost" ? "bad" : n === "charge" ? "accent" : "good";
    return { label: String(x.event.t), note: done ? (split ? "split" : n) : "", status } as StripItem;
  });
  const [u, k] = [s.worlds.unsafe, s.worlds.safe];
  return [
    {
      key: "timeline",
      title: "Events (ms)",
      html:
        strip(items) +
        totals([
          { value: `$${totalCharged(u)}`, label: "no key", key: "total-unsafe", status: u.ledger.length > 1 ? "bad" : "neutral" },
          { value: `$${totalCharged(k)}`, label: "with key", key: "total-safe", status: "neutral" },
        ]),
    },
  ];
}

function observe(s: Joint, e: JointEvent | null): Observation[] {
  const obs: Observation[] = [];
  for (const w of WORLDS) {
    const snap = s.worlds[w];
    obs.push({ type: "text", key: `total-${w}`, equals: `$${totalCharged(snap)}` });
    obs.push({ type: "text", key: `${w}/total`, equals: `$${totalCharged(snap)}` });
    obs.push({ type: "text", key: `${w}/terminal/body`, equals: STATUS[snap.client.status] });
    snap.ledger.forEach((c, k) => {
      obs.push({ type: "visible", key: `${w}/ledger/coin-${c.id}`, visible: true });
      obs.push({ type: "extent", key: `${w}/ledger/coin-${c.id}`, size: [24, 24, COIN_HEIGHT] });
      obs.push({ type: "tone", key: `${w}/ledger/coin-${c.id}`, equals: k === 0 ? "good" : "bad" });
    });
    for (const m of snap.inflight) obs.push({ type: "visible", key: `${w}/msg-${m.id}`, visible: true });
  }
  obs.push({ type: "visible", key: "safe/store/key", visible: s.worlds.safe.store !== null });
  obs.push({ type: "visible", key: "unsafe/ledger/coin-2", visible: s.worlds.unsafe.ledger.length >= 2 });
  obs.push({ type: "visible", key: "safe/ledger/coin-2", visible: false });
  if (e?.events.safe.some((x) => x.type === "replay")) obs.push({ type: "lit", key: "safe/store/key" });
  return obs;
}

export default defineScene<Joint, JointEvent>({
  id: "retries",
  title: "Retries and idempotency keys",
  question: "Why can a retry charge twice?",
  presentation: "editorial",
  setup: "Two identical payment systems run the same script. Only one stores idempotency keys.",
  teaching,
  trust: "model",
  assumptions: [
    "One network fault is scripted: the first success response is lost. Both worlds see exactly the same faults and timings.",
    `Latency ${SCENARIO.latency} ms each way, ${SCENARIO.dbTime} ms per database operation, ${SCENARIO.timeout} ms client timeout. Real values vary; the order of events is what matters.`,
    "The charge and the stored key are written in one transaction. Without that, a crash between them would reopen the problem.",
    "Requests with the same key never overlap here. A real server must also lock the key while the first request is still being processed.",
  ],
  trace: () => {
    const { initial, steps } = twin();
    return {
      initial,
      intro: `Two identical payment systems run the same script side by side. The back one has no idempotency keys; the front one stores each key with its response.`,
      steps: steps.map(({ event, state }) => ({ event, state, caption: caption(state, event) })),
    };
  },
  view,
  panels,
  observe,
  readout: (s) => `t = ${s.t} ms · without key: ${s.worlds.unsafe.ledger.length} charge${s.worlds.unsafe.ledger.length === 1 ? "" : "s"} · with key: ${s.worlds.safe.ledger.length}`,
  timing: (e) => {
    const moving = [...e.events.unsafe, ...e.events.safe].some((x) => x.type === "arrive" || x.type === "lost");
    return { duration: moving ? 1300 : 900 };
  },
  legend: [
    { tone: "cold", label: "Payment request / stored key" },
    { tone: "good", label: "Success response / first charge" },
    { tone: "bad", label: "Lost message / duplicate charge" },
    { tone: "accent", label: "Server writing to the ledger" },
  ],
});
