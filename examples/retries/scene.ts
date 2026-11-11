import { defineScene } from "../../src/core/scene.ts";
import type { Mark, Observation, Panel, Vec3 } from "../../src/core/types.ts";
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
const LANE = 136;
const laneY = (w: World) => (w === "unsafe" ? 0 : LANE);
const CLIENT_X = 0;
const SERVER_X = 100;
const LEDGER_X = 190;
const MSG: Vec3 = [12, 12, 8];

/** Messages travel along a network path in front of the actors, where nothing hides them. */
const WIRE_Y = 44;
function wire(w: World, end: "client" | "server" | "middle"): Vec3 {
  const y = laneY(w) + WIRE_Y;
  const x = end === "client" ? CLIENT_X + 24 : end === "server" ? SERVER_X + 4 : (CLIENT_X + 24 + SERVER_X + 4) / 2;
  return [x, y, 0];
}

function messageMark(w: World, m: Message, at: Vec3, extra: Partial<Mark> = {}): Mark {
  return {
    kind: "box",
    key: `msg-${w}-${m.id}`,
    at,
    size: MSG,
    tone: m.kind === "request" ? "cold" : "good",
    link: `${w}-${m.id}`,
    ...extra,
  } as Mark;
}

const STATUS: Record<Snapshot["client"]["status"], string> = {
  idle: "ready to pay",
  waiting: "waiting for a response",
  retrying: "retrying",
  paid: "paid",
  failed: "gave up",
};

function view(s: Joint, e: JointEvent | null): Mark[] {
  const marks: Mark[] = [];
  for (const w of WORLDS) {
    const y = laneY(w);
    const snap = s.worlds[w];
    const evs = e?.events[w] ?? [];
    const name = (key: string, x: number, text: string): Mark => ({ kind: "label", key: `${key}-name-${w}`, at: [x, y + 66, 0], text, size: "small" });
    marks.push({
      kind: "link",
      key: `wire-${w}`,
      from: [CLIENT_X + 18, y + WIRE_Y + 6, 0],
      to: [SERVER_X + 20, y + WIRE_Y + 6, 0],
      dashed: true,
      tone: "muted",
      width: 1.5,
      layer: "floor",
    });
    marks.push(
      { kind: "box", key: `plate-${w}`, at: [-26, y - 26, -4], size: [LEDGER_X + 72, 112, 4], tone: "base" },
      { kind: "box", key: `client-${w}`, at: [CLIENT_X, y, 0], size: [36, 36, 28], tone: "structure" },
      { kind: "box", key: `server-${w}`, at: [SERVER_X, y - 2, 0], size: [40, 40, 40], tone: "structure", lit: evs.some((x) => x.type === "replay") },
      { kind: "box", key: `ledger-${w}`, at: [LEDGER_X, y, 0], size: [40, 40, 12], tone: "structure" },
      name("client", CLIENT_X + 18, "client"),
      name("server", SERVER_X + 20, "server"),
      name("ledger", LEDGER_X + 20, "ledger"),
      // At the plate's back-right corner, which no other lane's labels rise into.
      { kind: "label", key: `title-${w}`, at: [LEDGER_X + 50, y - 22, 0], text: NAME[w], anchor: "start" },
      { kind: "label", key: `status-${w}`, at: [CLIENT_X + 18, y + 18, 54], text: STATUS[snap.client.status], size: "small" },
      { kind: "label", key: `ledger-total-${w}`, at: [LEDGER_X + 20, y + 20, 26 + snap.ledger.length * 9], text: `$${totalCharged(snap)}`, size: "large" },
    );

    // Charges recorded in the ledger, stacked.
    snap.ledger.forEach((c, k) => {
      marks.push({
        kind: "box",
        key: `charge-${w}-${c.id}`,
        at: [LEDGER_X + 5, y + 5, 12 + k * 9],
        size: [30, 30, 8],
        tone: k === 0 ? "good" : "bad",
        enter: "drop",
        lit: evs.some((x) => x.type === "charge" && x.charge.id === c.id),
      });
    });

    // The idempotency key store, only on the server that has one.
    if (w === "safe") {
      // Between the server and its ledger: the server's own storage, off the message path.
      marks.push({ kind: "box", key: "store", at: [SERVER_X + 48, y + 6, 0], size: [30, 28, 6], tone: "muted" });
      marks.push({ kind: "label", key: "store-label", at: [SERVER_X + 63, y + 50, 0], text: "key store", size: "small" });
      if (snap.store) {
        marks.push({
          kind: "box",
          key: "stored-key",
          at: [SERVER_X + 52, y + 10, 6],
          size: [22, 20, 6],
          tone: "cold",
          enter: "drop",
          lit: evs.some((x) => x.type === "replay"),
          effect: evs.some((x) => x.type === "replay") ? "pulse" : undefined,
          link: "key",
        } as Mark);
      }
    }

    // Messages on the wire wait at their sender until they arrive or are lost.
    for (const m of snap.inflight) marks.push(messageMark(w, m, wire(w, m.from)));
    for (const ev of evs) {
      if (ev.type === "arrive") marks.push(messageMark(w, ev.message, wire(w, ev.message.to), { leaving: true }));
      if (ev.type === "lost") marks.push(messageMark(w, ev.message, wire(w, "middle"), { leaving: true, tone: "bad" }));
    }
  }
  return marks;
}

// ---- Words --------------------------------------------------------------------------
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
    return `${t}: the client sends a $${SCENARIO.amount} payment. In the lower world the request carries the idempotency key ${SCENARIO.key}.`;
  }
  return `${t}: ${u.map(describe).join("; ")}.`;
}

function panels(s: Joint, e: JointEvent | null): Panel[] {
  const rows = WORLDS.map((w) => {
    const snap = s.worlds[w];
    const bad = snap.ledger.length > 1;
    return `<tr><th scope="row" style="text-align:left">${NAME[w]}</th><td data-key="charges-${w}" class="${bad ? "vz-bad" : ""}">${snap.ledger.length}</td><td data-key="total-${w}" class="${bad ? "vz-bad" : ""}">$${totalCharged(snap)}</td></tr>`;
  }).join("");

  // The event log so far, both worlds side by side, newest last.
  const all = twin().steps.filter((x) => x.event.t <= s.t && (e !== null || s.t > 0));
  const shown = all.slice(-6);
  const log = shown
    .map((x) => {
      const now = e !== null && x.event.t === e.t;
      const cell = (w: World) => x.event.events[w].map(describe).join("; ") || "·";
      return `<tr class="${now ? "vz-hot" : ""}"><td>${x.event.t}</td><td style="text-align:left">${cell("unsafe")}</td><td style="text-align:left">${cell("safe")}</td></tr>`;
    })
    .join("");

  return [
    {
      key: "rule",
      title: "The rule",
      html: `<p>A client that times out cannot tell a lost request from a lost response, so it must retry. The server makes retries safe by storing each <span data-link="key">idempotency key</span> with its response, and replaying that response when the key comes back.</p>`,
    },
    {
      key: "ledger",
      title: "What the customer was charged",
      html: `<table><tr><th></th><th>charges</th><th>total</th></tr>${rows}</table>`,
    },
    {
      key: "log",
      title: "Event log (ms)",
      html: shown.length
        ? `<table style="font-size:12px"><tr><th>t</th><th style="text-align:left">without a key</th><th style="text-align:left">with a key</th></tr>${log}</table>`
        : `<p class="vz-dim">Nothing has happened yet.</p>`,
    },
  ];
}

function observe(s: Joint): Observation[] {
  const obs: Observation[] = [];
  for (const w of WORLDS) {
    const snap = s.worlds[w];
    obs.push({ type: "text", key: `charges-${w}`, equals: String(snap.ledger.length) });
    obs.push({ type: "text", key: `total-${w}`, equals: `$${totalCharged(snap)}` });
    obs.push({ type: "text", key: `status-${w}`, equals: STATUS[snap.client.status] });
    obs.push({ type: "text", key: `ledger-total-${w}`, equals: `$${totalCharged(snap)}` });
    for (const c of snap.ledger) {
      obs.push({ type: "visible", key: `charge-${w}-${c.id}`, visible: true });
      obs.push({ type: "extent", key: `charge-${w}-${c.id}`, size: [30, 30, 8] });
    }
    for (const m of snap.inflight) obs.push({ type: "visible", key: `msg-${w}-${m.id}`, visible: true });
  }
  obs.push({ type: "visible", key: "stored-key", visible: s.worlds.safe.store !== null });
  // The two ledgers' stacks must look as different as the counts are.
  obs.push({ type: "visible", key: "charge-unsafe-2", visible: s.worlds.unsafe.ledger.length >= 2 });
  obs.push({ type: "visible", key: "charge-safe-2", visible: false });
  return obs;
}

export default defineScene<Joint, JointEvent>({
  id: "retries",
  title: "Retries and idempotency keys",
  question: "Why can retrying a payment charge the customer twice, and how does an idempotency key stop it?",
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
      intro: `Two identical payment systems run the same script side by side. The upper one has no idempotency keys; the lower one stores each key with its response. Watch the ledgers on the right.`,
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
    { tone: "structure", label: "Client, server, ledger" },
  ],
});
