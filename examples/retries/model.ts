// A deterministic discrete-event simulation of a client paying through a
// server that records charges in a ledger, over a network that can lose
// messages. Run it with and without idempotency keys on the same faults.

export interface Config {
  /** The server remembers each idempotency key and the response it sent. */
  idempotent: boolean;
  amount: number;
  /** One-way network latency, ms. */
  latency: number;
  /** Time for the server to write the ledger or read the key store, ms. */
  dbTime: number;
  /** Time for the server to send its reply once the database work is done, ms. */
  replyTime: number;
  /** Client gives up waiting for a response after this long, ms. */
  timeout: number;
  maxAttempts: number;
  /** Message ids the network drops, e.g. "response-1". */
  drop: readonly string[];
  /** The idempotency key the client makes once for this payment and sends on every attempt. */
  key: string;
}

export interface Message {
  id: string;
  kind: "request" | "response";
  attempt: number;
  from: "client" | "server";
  to: "client" | "server";
  sentAt: number;
  /** The idempotency key a request carries, when the server takes keys. */
  key?: string;
}

export interface Charge {
  id: number;
  amount: number;
  attempt: number;
  at: number;
}

export type Ev =
  | { type: "send"; t: number; message: Message }
  | { type: "arrive"; t: number; message: Message }
  | { type: "lost"; t: number; message: Message }
  | { type: "charge"; t: number; charge: Charge; attempt: number }
  | { type: "replay"; t: number; attempt: number; key: string }
  | { type: "timeout"; t: number; attempt: number }
  | { type: "paid"; t: number; attempt: number }
  | { type: "give-up"; t: number; attempt: number };

export interface Snapshot {
  t: number;
  ledger: Charge[];
  /** Idempotency key store: key -> attempt whose response is stored. */
  store: { key: string; attempt: number } | null;
  client: { status: "idle" | "waiting" | "retrying" | "paid" | "failed"; attempts: number };
  /** Messages on the wire. */
  inflight: Message[];
}

interface Pending {
  t: number;
  seq: number;
  run: () => void;
}

/** Run the scenario; returns every event with the state just after it. */
export function simulate(cfg: Config): { event: Ev; state: Snapshot }[] {
  const queue: Pending[] = [];
  let seq = 0;
  const at = (t: number, run: () => void) => {
    queue.push({ t, seq: seq++, run });
  };
  const out: { event: Ev; state: Snapshot }[] = [];
  let s: Snapshot = { t: 0, ledger: [], store: null, client: { status: "idle", attempts: 0 }, inflight: [] };
  const emit = (event: Ev, next: Partial<Snapshot>) => {
    s = { ...s, ...next, t: event.t };
    out.push({ event, state: s });
  };
  const dropped = new Set(cfg.drop);
  let paid = false;

  const send = (t: number, message: Message) => {
    emit({ type: "send", t, message }, { inflight: [...s.inflight, message] });
    const arrives = t + cfg.latency;
    if (dropped.has(message.id)) {
      at(arrives, () => emit({ type: "lost", t: arrives, message }, { inflight: s.inflight.filter((m) => m.id !== message.id) }));
      return;
    }
    at(arrives, () => {
      emit({ type: "arrive", t: arrives, message }, { inflight: s.inflight.filter((m) => m.id !== message.id) });
      if (message.to === "server") serverHandle(arrives, message.attempt, message.key);
      else clientHandle(arrives, message.attempt);
    });
  };

  const respond = (t: number, attempt: number) =>
    send(t, { id: `response-${attempt}`, kind: "response", attempt, from: "server", to: "client", sentAt: t });

  const serverHandle = (t: number, attempt: number, key: string | undefined) => {
    if (cfg.idempotent && key !== undefined && s.store?.key === key) {
      const done = t + cfg.dbTime;
      at(done, () => {
        emit({ type: "replay", t: done, attempt, key }, {});
        at(done + cfg.replyTime, () => respond(done + cfg.replyTime, attempt));
      });
      return;
    }
    // The first request's key lookup (which finds nothing) is folded into this write.
    const done = t + cfg.dbTime;
    at(done, () => {
      const charge: Charge = { id: s.ledger.length + 1, amount: cfg.amount, attempt, at: done };
      // With idempotency, the charge and the key are written in one transaction.
      emit(
        { type: "charge", t: done, charge, attempt },
        { ledger: [...s.ledger, charge], ...(cfg.idempotent && key !== undefined ? { store: { key, attempt } } : {}) },
      );
      at(done + cfg.replyTime, () => respond(done + cfg.replyTime, attempt));
    });
  };

  const clientHandle = (t: number, attempt: number) => {
    if (paid) return;
    paid = true;
    emit({ type: "paid", t, attempt }, { client: { status: "paid", attempts: s.client.attempts } });
  };

  const attempt = (t: number, n: number) => {
    s = { ...s, client: { status: n === 1 ? "waiting" : "retrying", attempts: n } };
    // The key was made once, before the first attempt; every retry carries the same one.
    send(t, { id: `request-${n}`, kind: "request", attempt: n, from: "client", to: "server", sentAt: t, ...(cfg.idempotent ? { key: cfg.key } : {}) });
    at(t + cfg.timeout, () => {
      if (paid || s.client.attempts !== n) return;
      if (n >= cfg.maxAttempts) {
        emit({ type: "give-up", t: t + cfg.timeout, attempt: n }, { client: { status: "failed", attempts: n } });
        return;
      }
      emit({ type: "timeout", t: t + cfg.timeout, attempt: n }, {});
      attempt(t + cfg.timeout, n + 1);
    });
  };

  attempt(0, 1);
  while (queue.length) {
    queue.sort((a, b) => a.t - b.t || a.seq - b.seq);
    queue.shift()!.run();
  }
  return out;
}

export const totalCharged = (s: Snapshot) => s.ledger.reduce((sum, c) => sum + c.amount, 0);
