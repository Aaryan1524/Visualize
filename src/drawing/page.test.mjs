import assert from "node:assert/strict";
import test from "node:test";
import { tabsOf } from "./page.mjs";

test("a short page gets one tab a step, the concept step none", () => {
  assert.deepEqual(tabsOf([{ tab: "concept" }, { tab: "Add" }, { tab: "Ask" }]), [
    { label: "Add", first: 1, last: 1 },
    { label: "Ask", first: 2, last: 2 },
  ]);
});

test("a deep page gets one tab a chapter, spanning its steps", () => {
  const steps = [{}, { tab: "a", chapter: "Core" }, { tab: "b", chapter: "Core" }, { tab: "c", chapter: "Failures" }, { tab: "d", chapter: "Failures" }, { tab: "e", chapter: "Trade-offs" }];
  assert.deepEqual(tabsOf(steps), [
    { label: "Core", first: 1, last: 2 },
    { label: "Failures", first: 3, last: 4 },
    { label: "Trade-offs", first: 5, last: 5 },
  ]);
});

test("a step with no chapter stays in the chapter before it", () => {
  assert.deepEqual(tabsOf([{}, { tab: "a", chapter: "Core" }, { tab: "b" }, { tab: "c", chapter: "Edge" }]), [
    { label: "Core", first: 1, last: 2 },
    { label: "Edge", first: 3, last: 3 },
  ]);
});
