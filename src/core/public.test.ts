import test from "node:test";
import assert from "node:assert/strict";

test("the public kit compiles a model in Node without a browser DOM", async () => {
  assert.equal(typeof document, "undefined");
  const { defineScene, compile } = await import("../index.ts");
  const scene = defineScene<number, number>({
    id: "server-side", title: "Count", question: "How many?", trust: "computed",
    trace: () => ({ initial: 0, intro: "Empty", steps: [{ state: 1, event: 1, caption: "One" }] }),
    view: n => [{ kind: "box", key: "count", at: [0,0,0], size: [20,20,10], label: String(n) }],
  });
  const compiled = compile(scene);
  const mark = compiled.frameAt(compiled.restTime(1)).marks[0];
  assert.ok(mark?.kind === "box");
  assert.equal(mark.label, "1");
});
