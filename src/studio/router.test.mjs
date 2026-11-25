import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENGINES, routeTopic } from "./router.mjs";

describe("Studio 2-Engine Topic Router", () => {
  const engineACases = [
    "How a high-bypass turbofan jet engine works",
    "Perfume Venturi atomizer pressure drop",
    "Inside a lithium-ion battery during charge and discharge",
    "How a residential heat pump moves thermal energy",
    "How the human heart pumps blood through four chambers",
    "Mechanical automatic watch escapement and mainspring",
    "Double-wishbone car suspension geometry",
    "Airfoil lift and Bernoulli streamlines around a wing",
    "Multi-element camera lens assembly and shutter",
    "How a medical syringe draws and dispenses fluid",
    "Inside a modern GPU die and tensor cores",
    "How a bicycle rear derailleur shifts gears",
    "Open car differential gear train",
    "Pin tumbler lock cutaway mechanism",
    "Four-stroke internal combustion engine with pistons and valves",
  ];

  const engineCCases = [
    "LRU cache with hash map and doubly linked list",
    "How a Bloom filter tests membership with bit arrays",
    "B-tree database index node splits",
    "TCP three-way handshake and congestion window",
    "Raft consensus leader election and log replication",
    "Transformer self-attention mechanism in LLMs",
    "Gradient descent and backpropagation in neural networks",
    "MapReduce shuffle and reduce pipeline",
    "Limit order book matching engine in finance",
    "Hash table collision resolution and consistent hashing",
    "RC circuit logic and charging curve",
    "Finite state machine transitions and acceptor states",
    "Supply and demand equilibrium curves in microeconomics",
  ];

  it("exposes strictly the 2-Engine architecture (A and C; Engine B retired)", () => {
    assert.deepEqual(Object.keys(ENGINES).sort(), ["A", "C"]);
    assert.equal(ENGINES.A.name, "3D Physical CAD Studio");
    assert.equal(ENGINES.A.kitPath, "src/studio/engine-a.ts");
    assert.equal(ENGINES.C.name, "2D Tactile Conceptual Studio");
    assert.equal(ENGINES.C.kitPath, "src/studio/engine-c.ts");

    for (const prim of [
      "createStudioStage",
      "cutawayCylinder",
      "bladeRing",
      "combustorRing",
      "shaft",
      "pipe",
      "spring",
      "gear",
      "glassVessel",
      "liquidVolume",
      "pistonPlunger",
      "mistCone",
      "baseMount",
      "flowRibbon",
    ]) {
      assert.ok(ENGINES.A.recommendedPrimitives.includes(prim), `Missing Engine A primitive: ${prim}`);
    }

    for (const prim of ["createEditorialStage", "strip", "track", "arcLink", "stageNode", "flowPipe"]) {
      assert.ok(ENGINES.C.recommendedPrimitives.includes(prim), `Missing Engine C primitive: ${prim}`);
    }
  });

  it("routes 15 physical, fluid, thermal, optical, hardware, and organ prompts to Engine A (3D CAD)", () => {
    for (const prompt of engineACases) {
      const res = routeTopic(prompt);
      assert.equal(res.engine, "A", `Expected Engine A for "${prompt}", got ${res.engine} (${res.reason})`);
      assert.equal(res.kitPath, "src/studio/engine-a.ts");
      assert.equal(res.name, ENGINES.A.name);
      assert.ok(res.confidence >= 0.6 && res.confidence <= 1);
      assert.equal(res.ambiguous, false);
      assert.ok(res.matchedSignals.length >= 1);
      assert.ok(res.recommendedPrimitives.includes("createStudioStage"));
      assert.ok(res.recommendedPrimitives.includes("glassVessel"));
    }
  });

  it("routes 13 CS, protocol, ML, circuit/logic, math, and finance prompts to Engine C (2D Tactile)", () => {
    for (const prompt of engineCCases) {
      const res = routeTopic(prompt);
      assert.equal(res.engine, "C", `Expected Engine C for "${prompt}", got ${res.engine} (${res.reason})`);
      assert.equal(res.kitPath, "src/studio/engine-c.ts");
      assert.equal(res.name, ENGINES.C.name);
      assert.ok(res.confidence >= 0.6 && res.confidence <= 1);
      assert.equal(res.ambiguous, false);
      assert.ok(res.matchedSignals.length >= 1);
      assert.ok(res.recommendedPrimitives.includes("createEditorialStage"));
      assert.ok(res.recommendedPrimitives.includes("strip"));
    }
  });

  it("fixes all 16 previously misrouted 60-prompt regression cases", () => {
    const regressions = [
      { prompt: "How a refrigerator cools food", expected: "A" },
      { prompt: "How a nuclear reactor generates steam", expected: "A" },
      { prompt: "How a microwave oven heats food", expected: "A" },
      { prompt: "How a loudspeaker converts electricity into sound", expected: "A" },
      { prompt: "Inside a spinning hard drive and read-write head", expected: "A" },
      { prompt: "How a laser emits coherent light", expected: "A" },
      { prompt: "How an LED emits light", expected: "A" },
      { prompt: "How an OLED display pixel works", expected: "A" },
      { prompt: "How a solar panel converts sunlight into current", expected: "A" },
      { prompt: "How a transistor switches current", expected: "A" },
      { prompt: "How a MOSFET gate controls channel conductivity", expected: "A" },
      { prompt: "How a steam locomotive drives its wheels", expected: "A" },
      { prompt: "How a heat sink dissipates CPU heat", expected: "A" },
      { prompt: "How a power grid transformer steps down voltage", expected: "A" },
      { prompt: "How DNA replication copies a double helix", expected: "A" },
      { prompt: "How a bridge rectifier converts AC to DC", expected: "C" },
    ];

    for (const { prompt, expected } of regressions) {
      const res = routeTopic(prompt);
      assert.equal(
        res.engine,
        expected,
        `Regression failed for "${prompt}": expected Engine ${expected}, got Engine ${res.engine} (${res.reason})`,
      );
      assert.equal(res.ambiguous, false, `Expected confident route for "${prompt}", got confidence=${res.confidence}`);
      assert.ok(res.confidence >= 0.6, `Expected confidence >= 0.6 for "${prompt}", got ${res.confidence}`);
    }
  });

  it("resolves cross-domain keyword collisions cleanly (transformers, replication, bridges, led)", () => {
    // Electrical transformer -> A; ML transformer -> C
    for (const p of [
      "how a transformer steps down voltage",
      "power grid transformer",
      "electrical transformer",
    ]) {
      const res = routeTopic(p);
      assert.equal(res.engine, "A", `Expected Engine A for "${p}", got ${res.engine} (${res.reason})`);
      assert.equal(res.ambiguous, false);
    }
    for (const p of [
      "Transformer architecture and encoder-decoder blocks",
      "Transformer model self-attention",
      "Multi-head attention in a transformer layer",
    ]) {
      const res = routeTopic(p);
      assert.equal(res.engine, "C", `Expected Engine C for "${p}", got ${res.engine} (${res.reason})`);
      assert.equal(res.ambiguous, false);
    }

    // Biology molecular/cellular -> A; DB/distributed replication -> C
    for (const p of [
      "DNA replication",
      "CRISPR gene editing mechanism",
      "How a ribosome translates mRNA",
      "Cell membrane ion channel",
      "Inside mitochondria ATP synthesis",
      "How a synapse transmits signals",
      "How a neuron firing action potential propagates",
    ]) {
      const res = routeTopic(p);
      assert.equal(res.engine, "A", `Expected Engine A for "${p}", got ${res.engine} (${res.reason})`);
      assert.equal(res.ambiguous, false);
    }
    for (const p of [
      "Database replication and failover",
      "Raft log replication across followers",
      "Multi-region async replication",
    ]) {
      const res = routeTopic(p);
      assert.equal(res.engine, "C", `Expected Engine C for "${p}", got ${res.engine} (${res.reason})`);
      assert.equal(res.ambiguous, false);
    }

    // Bridge rectifier & Wheatstone bridge -> C; suspension bridge -> A
    for (const p of ["bridge rectifier", "bridge rectifier with four diodes", "wheatstone bridge", "full-wave rectifier"]) {
      const res = routeTopic(p);
      assert.equal(res.engine, "C", `Expected Engine C for "${p}", got ${res.engine} (${res.reason})`);
      assert.equal(res.ambiguous, false);
    }
    assert.equal(routeTopic("How a suspension bridge carries load").engine, "A");

    // Past-tense English "led" must not hijack CS prompts
    const quorum = routeTopic("How a quorum led by a Raft leader commits entries");
    assert.equal(quorum.engine, "C");
    assert.equal(quorum.ambiguous, false);
  });

  it("covers expanded physical appliances, instruments, vehicles, and anatomy for Engine A", () => {
    const physicalPrompts = [
      "How a fridge compressor works",
      "How an air conditioner removes indoor heat",
      "How a fusion reactor confines plasma",
      "How a microphone diaphragm senses sound",
      "How an LCD shutter controls backlight",
      "How an elevator counterweight lifts a cabin",
      "How a telescope mirrors focus starlight",
      "How a gyroscope resists tilting",
      "How a Stirling engine converts heat to motion",
      "How a Wankel rotary engine spins",
      "How a disc brake caliper stops a wheel",
      "How a carburetor mixes fuel and air",
      "How a shock absorber damps bumps",
      "How an espresso maker extracts crema",
      "How a washing machine drum spins",
      "How the human eye focuses light",
      "How a kidney nephron filters blood",
      "How a muscle sarcomere contracts",
    ];
    for (const prompt of physicalPrompts) {
      const res = routeTopic(prompt);
      assert.equal(res.engine, "A", `Expected Engine A for "${prompt}", got ${res.engine} (${res.reason})`);
      assert.equal(res.ambiguous, false);
    }
  });

  it("supports explicit overrides and friendly aliases for A (3D/physical) and C (2D/conceptual)", () => {
    for (const raw of ["A", "a", "3D", "3d", "physical", "PHYSICAL"]) {
      const res = routeTopic("LRU cache eviction", { engine: raw });
      assert.equal(res.engine, "A", `Expected override "${raw}" -> A`);
      assert.equal(res.kitPath, "src/studio/engine-a.ts");
      assert.equal(res.confidence, 1);
      assert.equal(res.ambiguous, false);
      assert.deepEqual(res.matchedSignals, ["override:A"]);
    }

    for (const raw of ["C", "c", "2D", "2d", "conceptual", "CONCEPTUAL"]) {
      const res = routeTopic("Perfume Venturi atomizer", { engine: raw });
      assert.equal(res.engine, "C", `Expected override "${raw}" -> C`);
      assert.equal(res.kitPath, "src/studio/engine-c.ts");
      assert.equal(res.confidence, 1);
      assert.equal(res.ambiguous, false);
      assert.deepEqual(res.matchedSignals, ["override:C"]);
    }
  });

  it("rejects retired Engine B and unknown overrides with a clear RangeError", () => {
    assert.throws(
      () => routeTopic("Turbofan", { engine: "B" }),
      (err) => err instanceof RangeError && /2-Engine architecture/i.test(err.message) && /retired/i.test(err.message),
    );
    assert.throws(
      () => routeTopic("Turbofan", { engine: "b" }),
      (err) => err instanceof RangeError && /2-Engine architecture/i.test(err.message),
    );
    assert.throws(
      () => routeTopic("Turbofan", { engine: "Z" }),
      (err) => err instanceof RangeError && /2-Engine architecture/i.test(err.message),
    );
  });

  it("flags unknown, empty, or tied prompts as ambiguous (confidence < 0.6)", () => {
    const unknown = routeTopic("xyzzy frobnicate glorb");
    assert.equal(unknown.engine, "C");
    assert.equal(unknown.kitPath, "src/studio/engine-c.ts");
    assert.ok(unknown.confidence < 0.6);
    assert.equal(unknown.ambiguous, true);
    assert.deepEqual(unknown.matchedSignals, []);
    assert.match(unknown.reason, /defaulting to Engine C/i);

    const empty = routeTopic("");
    assert.equal(empty.engine, "C");
    assert.ok(empty.confidence < 0.6);
    assert.equal(empty.ambiguous, true);

    const flib = routeTopic("flibbertigibbet");
    assert.ok(flib.confidence < 0.6);
    assert.equal(flib.ambiguous, true);

    // Exact score tie (turbine=3 vs cache=3) must also be marked ambiguous
    const tie = routeTopic("turbine cache");
    assert.ok(tie.confidence < 0.6);
    assert.equal(tie.ambiguous, true);
  });

  it("returns complete contract shape and is strictly deterministic", () => {
    const first = routeTopic("How a lithium-ion battery works");
    const second = routeTopic("How a lithium-ion battery works");
    assert.deepEqual(first, second);
    assert.equal(first.engine, "A");
    assert.equal(first.ambiguous, false);
    for (const key of [
      "engine",
      "name",
      "tagline",
      "kitPath",
      "reason",
      "confidence",
      "ambiguous",
      "matchedSignals",
      "recommendedPrimitives",
    ]) {
      assert.ok(key in first, `Missing key "${key}"`);
    }
  });
});
