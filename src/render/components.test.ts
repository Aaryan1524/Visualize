import assert from "node:assert/strict";
import test from "node:test";
import { sequence, strip } from "./components.ts";

const lanes = [{ id: "s", label: "Sender" }, { id: "r", label: "Receiver" }];
const messages = [
  { id: "seg-1", from: "s", to: "r", at: 0, arrive: 40, label: "seg 1", status: "accent" as const },
  { id: "seg-2", from: "s", to: "r", at: 10, arrive: 50, label: "seg 2", lost: true, status: "bad" as const },
  { id: "ack-1", from: "r", to: "s", at: 40, arrive: 80, label: "ACK 2", status: "good" as const },
];

test("a sequence diagram keeps one size at every moment", () => {
  const box = (now: number) => sequence({ lanes, messages, now, until: 120 }).match(/viewBox="([^"]+)"/)![1];
  assert.equal(box(0), box(120));
});

test("only what has happened by now is drawn, and what happens now is lit", () => {
  const at20 = sequence({ lanes, messages, now: 20, until: 120 });
  assert.ok(at20.includes('data-key="seg-1"') && at20.includes('data-key="seg-2"'));
  assert.ok(!at20.includes('data-key="ack-1"'), "the ACK is not sent yet");
  const at40 = sequence({ lanes, messages, now: 40, until: 120 });
  assert.match(at40, /data-key="ack-1"[^>]*data-lit/);
  assert.match(at40, /data-key="seg-1"[^>]*data-lit/, "seg 1 arrives now");
});

test("a lost message stops halfway with a cross", () => {
  const svg = sequence({ lanes, messages, now: 120, until: 120 });
  const lost = svg.match(/<g class="vz-seq-msg" data-key="seg-2"[\s\S]*?<\/g>/)![0];
  assert.ok(lost.includes("vz-seq-x") && lost.includes("stroke-dasharray"));
  const x2 = Number(lost.match(/x2="([\d.]+)"/)![1]);
  assert.ok(x2 > 40 && x2 < 284, "it ends between the lanes");
});

test("bad input is refused", () => {
  assert.throws(() => sequence({ lanes: [lanes[0]!], messages: [], now: 0, until: 10 }), RangeError);
  assert.throws(() => sequence({ lanes, messages: [{ ...messages[0]!, to: "nowhere" }], now: 0, until: 10 }), RangeError);
});

test("strip chips keep a note line even when empty", () => {
  assert.equal((strip([{ label: "A", status: "waiting" }]).match(/<span>/g) ?? []).length, 1);
});
