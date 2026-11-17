// node --test src/claims/audit.test.mjs
// Each check is proven on the round-5 derailleur's real mistakes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { audit, numbersIn, textsOf, stampOf } from "./audit.mjs";

const model = { slack: 73.2, swingTotal: 60, swingNow: 37, cogPitch: 3.74, clickPull: 2.67, ratio: 1.4, cogs: 11, spring: { torque: -0.8 } };
const coverage = {
  source: "Shimano dealer manual, rear derailleur adjustment",
  topics: [
    { topic: "indexing", where: "step:2" },
    { topic: "cage spring and slack", where: "step:4" },
    { topic: "limit screws", where: "step:3" },
    { topic: "barrel adjuster", where: "lab" },
  ],
};
const base = (texts, extra = {}) => ({
  texts: texts.map((text, i) => ({ where: `t${i}`, text })),
  models: [model],
  claims: [{ text: "the cage spring pulls the cage back", test: (m) => m.spring.torque < 0 }],
  coverage,
  places: ["step:1", "step:2", "step:3", "step:4", "lab"],
  details: "",
  ...extra,
});
const only = (r, kind) => r.problems.filter((p) => p.startsWith(kind));

test("numbers: digits, thousands, decimals, words and tenths are all read", () => {
  const ns = numbersIn("One click pulls 2.67 mm; about seventy-five mm of chain; 1,200 bits; four tenths of a millimetre; k10 is a name");
  assert.deepEqual(ns.map((n) => n.value).sort((a, b) => a - b), [0.4, 2.67, 75, 1200]);
  assert.equal(ns.find((n) => n.value === 75).hedge, "approx");
});

test("numbers: a number the model has passes at the precision shown; one it lacks fails", () => {
  const r = audit(base(["the cage spring pulls the cage back. Slack is 73 mm, the swing 60°, and the cable 2.67 mm per click."]));
  assert.deepEqual(only(r, "numbers"), []);
  const typed = audit(base(["the cage spring pulls the cage back. The extra chain is seventy-five mm."]));
  assert.equal(only(typed, "numbers").length, 1, "75 mm with no hedge is not 73.2");
  const hedged = audit(base(["the cage spring pulls the cage back. About seventy-five mm of extra chain."]));
  assert.deepEqual(only(hedged, "numbers"), [], "'about 75' is within 5% of 73.2");
  const wrong = audit(base(["the cage spring pulls the cage back. The cage swings 45°."]));
  assert.equal(only(wrong, "numbers").length, 1);
});

test("claims: the round-5 spring sentence is caught by its test, and a paraphrase is not on the page", () => {
  const ok = audit(base(["Shifting up, the cage spring pulls the cage back while the chain pulls it forward."]));
  assert.deepEqual(only(ok, "claims"), []);
  const backwards = audit({ ...base(["the cage's own spring swings it forward."]), claims: [{ text: "the cage's own spring swings it forward", test: (m) => m.spring.torque > 0 }] });
  assert.equal(only(backwards, "claims").length, 1, "false by the model");
  const absent = audit(base(["The spring is involved somehow."]));
  assert.ok(only(absent, "claims").some((p) => p.includes("word for word")));
  assert.ok(only(audit({ ...base(["x"]), claims: [] }), "claims").length === 1);
});

test("coverage: a missing source, a topic on no step, and a silent deferral all fail", () => {
  assert.ok(only(audit({ ...base(["the cage spring pulls the cage back"]), coverage: { ...coverage, source: "" } }), "coverage").some((p) => p.includes("source")));
  const nowhere = { ...coverage, topics: [...coverage.topics, { topic: "shift ramps", where: "step:9" }] };
  assert.ok(only(audit({ ...base(["the cage spring pulls the cage back"]), coverage: nowhere }), "coverage").some((p) => p.includes("step:9")));
  const silent = { ...coverage, topics: [...coverage.topics, { topic: "B-tension screw", where: "deferred", why: "a fine adjustment" }] };
  assert.ok(only(audit({ ...base(["the cage spring pulls the cage back"]), coverage: silent }), "coverage").some((p) => p.includes("Details")));
  assert.deepEqual(only(audit({ ...base(["the cage spring pulls the cage back"]), coverage: silent, details: "Not covered: the B-tension screw." }), "coverage"), []);
});

test("review: missing, stale and open reviews fail; a current one passes", () => {
  const dir = mkdtempSync(join(tmpdir(), "vz-review-"));
  const file = join(dir, "review.json");
  const a = base(["the cage spring pulls the cage back"], { reviewFile: file });
  assert.equal(audit(a).review, "missing");
  writeFileSync(file, JSON.stringify({ stamp: "old", findings: [] }));
  assert.equal(audit(a).review, "stale");
  const stamp = stampOf(a.texts, a.claims);
  writeFileSync(file, JSON.stringify({ stamp, findings: [{ finding: "60° vs 37°", resolved: false }] }));
  assert.equal(audit(a).review, "open");
  writeFileSync(file, JSON.stringify({ stamp, findings: [{ finding: "60° vs 37°", resolved: true }] }));
  assert.equal(audit(a).review, "open", "closing a finding needs a response");
  writeFileSync(file, JSON.stringify({ stamp, findings: [{ finding: "60° vs 37°", resolved: true, response: "60° is the total swing; the readout is the current angle, now labelled so." }] }));
  const r = audit(a);
  assert.equal(r.review, "current");
  assert.equal(r.ok, true, r.problems.join("\n"));
});

test("textsOf skips audio, SVG and ids, and keeps every sentence a reader sees", () => {
  const t = textsOf({ steps: [{ heading: "One chain" }], variants: { a: { svg: "<g>9</g>", voice: [{ audio: "AAAA", text: "Thirty degrees", links: [{ ids: ["x"] }] }] } } });
  assert.deepEqual(t.map((x) => x.text), ["One chain", "Thirty degrees"]);
});
