// Deterministic 2-Engine Topic Router for Visualize Studio.
// Maps any user explanation prompt to:
//   - Engine A ("3D Physical CAD Studio") for every physical object, machine, fluid/thermal/optical
//     device, hardware, appliance, semiconductor/optoelectronic device, watch, battery, atomizer,
//     vehicle, or biological/molecular structure.
//   - Engine C ("2D Tactile Conceptual Studio") for every conceptual, algorithmic, software,
//     protocol, ML, circuit/logic, math, or finance topic.
// Engine B (flat 2D schematics for physical objects) has been retired.

export const ENGINES = Object.freeze({
  A: Object.freeze({
    engine: "A",
    name: "3D Physical CAD Studio",
    tagline:
      "Matte-clay orthographic 3D cutaway models with architectural edges for every physical object, machine, fluid/thermal/optical device, hardware, watch, battery, atomizer, vehicle, or biological organ.",
    kitPath: "src/studio/engine-a.ts",
    recommendedPrimitives: Object.freeze([
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
    ]),
  }),
  C: Object.freeze({
    engine: "C",
    name: "2D Tactile Conceptual Studio",
    tagline:
      "Braun/Rams tactile instrument diagrams (switchboard strips, milled sliding tracks, single-thread Bézier arcs, spring lift-reorder physics) for conceptual, algorithmic, software, protocol, ML, circuit/logic, math, and finance topics.",
    kitPath: "src/studio/engine-c.ts",
    recommendedPrimitives: Object.freeze([
      "createEditorialStage",
      "strip",
      "track",
      "arcLink",
      "stageNode",
      "flowPipe",
    ]),
  }),
});

/**
 * Weighted routing rules per engine in the 2-Engine Studio architecture.
 * Multi-word phrases carry higher weight to resolve cross-domain overlaps deterministically
 * (e.g., "pin tumbler lock" -> A vs "mutex lock" -> C;
 * "power grid transformer" / "how a transformer steps down voltage" -> A vs "transformer self-attention" -> C;
 * "DNA replication" -> A vs "log replication" -> C;
 * "suspension bridge" -> A vs "bridge rectifier" / "wheatstone bridge" -> C;
 * "car differential" -> A vs "differential equation" -> C).
 */
const SIGNAL_RULES = {
  A: [
    // Physical machines, fluid/thermal/optical devices, hardware, appliances, semiconductors, organs
    { label: "jet engine", re: /\bjet engines?\b/, weight: 6 },
    { label: "turbofan", re: /\bturbofans?\b/, weight: 6 },
    { label: "venturi atomizer", re: /\bventuri\b|\batomizers?\b|\bperfume (bottle|spray|atomizer)\b/, weight: 6 },
    { label: "bernoulli", re: /\bbernoulli\b/, weight: 5 },
    { label: "lithium-ion battery", re: /\b(lithium[- ]ion|li[- ]ion|solid[- ]state) batter(y|ies)\b/, weight: 6 },
    { label: "battery", re: /\bbatter(y|ies)\b|\bfuel cells?\b|\bgalvanic cells?\b|\belectrolysis\b/, weight: 5 },
    {
      label: "refrigeration & heat pump",
      re: /\bheat pumps?\b|\bheat exchangers?\b|\brefrigeration( cycle)?\b|\brefrigerators?\b|\bfridges?\b|\bfreezers?\b|\bair conditioners?\b/,
      weight: 6,
    },
    { label: "heat sink", re: /\bheat ?sinks?\b|\bcooling fins?\b|\bwater heaters?\b/, weight: 6 },
    {
      label: "nuclear reactor",
      re: /\b(nuclear|fission|fusion|pressurized water|boiling water|tokamak)\s+reactors?\b|\bnuclear (fission|fusion)\b/,
      weight: 6,
    },
    {
      label: "electrical transformer",
      re: /\b(electrical|power|power[- ]grid|step[- ]up|step[- ]down|high[- ]voltage|isolation|distribution)\s+transformers?\b|\btransformers?\s+(steps?\s+(up|down)|voltage|windings?|coils?|cores?)\b/,
      weight: 6,
    },
    {
      label: "acoustic transducer",
      re: /\bloudspeakers?\b|\bspeaker drivers?\b|\bmicrophones?\b|\bsubwoofers?\b|\btweeters?\b/,
      weight: 6,
    },
    {
      label: "hard drive",
      re: /\bhard (disk )?drives?\b|\bhdds?\b|\bmagnetic disks?\b|\bspinning disks?\b/,
      weight: 6,
    },
    {
      label: "optoelectronics",
      re: /\blasers?\b|\boleds?\b|\blcds?\b|\blight[- ]emitting diodes?\b|\bleds?\b(?!\s+(?:to|by|the|a|an|in|into|through)\b)/,
      weight: 6,
    },
    {
      label: "solar & semiconductor",
      re: /\bp-?n junctions?\b|\bsolar (cells?|panels?)\b|\bphotovoltaics?\b|\bsemiconductors?\b|\btransistors?\b|\bmosfets?\b/,
      weight: 6,
    },
    { label: "diode", re: /\bdiodes?\b/, weight: 5 },
    {
      label: "locomotive & lift",
      re: /\b(steam )?locomotives?\b|\belevators?\b|\bescalators?\b/,
      weight: 6,
    },
    {
      label: "instruments & sensors",
      re: /\bgyroscopes?\b|\baccelerometers?\b|\bcompass(es)?\b|\bbarometers?\b|\bthermometers?\b/,
      weight: 6,
    },
    {
      label: "thermal engines",
      re: /\bstirling( engines?)?\b|\bdiesel( engines?)?\b|\bwankel( engines?)?\b|\brotary engines?\b/,
      weight: 6,
    },
    {
      label: "automotive hardware",
      re: /\bbrake calipers?\b|\bdisc brakes?\b|\bcarburetors?\b|\bfuel injectors?\b|\bshock absorbers?\b/,
      weight: 6,
    },
    {
      label: "appliances",
      re: /\bmicrowaves?\b|\bespresso( machines?)?\b|\bcoffee (machines?|makers?)\b|\btoasters?\b|\bwashing machines?\b/,
      weight: 6,
    },
    {
      label: "molecular biology",
      re: /\bdna(\s+replication)?\b|\bcrispr\b|\bribosomes?\b|\benzymes?\b|\bcell membranes?\b|\bmitochondri(a|on)\b|\bsynapses?\b|\bneurons?\b/,
      weight: 6,
    },
    { label: "human heart", re: /\b(human )?heart( valves?| chambers?)?\b/, weight: 6 },
    { label: "automatic watch", re: /\b(automatic|mechanical|swiss) watch(es)?\b/, weight: 6 },
    { label: "car suspension", re: /\b(car |vehicle |double[- ]wishbone |macpherson )?suspension\b/, weight: 6 },
    { label: "airfoil lift", re: /\bairfoils?\b|\bwing lift\b|\baerodynamic lift\b/, weight: 6 },
    { label: "camera lens assembly", re: /\bcamera lens(es| assembly)?\b|\blens assembly\b|\bthin lens\b/, weight: 6 },
    { label: "syringe", re: /\bsyringes?\b|\bplungers?\b/, weight: 5 },
    { label: "gpu die", re: /\b(gpu|cpu|silicon) die\b/, weight: 6 },
    { label: "bicycle derailleur", re: /\b(bicycle |rear )?derailleurs?\b/, weight: 6 },
    { label: "car differential", re: /\b(car |open |limited[- ]slip )?differentials?\b(?! equations?)/, weight: 6 },
    { label: "pin tumbler", re: /\bpin[- ]tumbler\b/, weight: 6 },
    { label: "physical lock", re: /\b(door |pad)?(?<!mutex |spin |read |write |dead|rw)locks?\b(?!-free)/, weight: 3 },
    { label: "internal combustion", re: /\binternal combustion\b/, weight: 5 },
    { label: "four-stroke engine", re: /\b(four|two)[- ]stroke\b/, weight: 5 },
    { label: "planetary gear", re: /\bplanetary gears?\b/, weight: 6 },
    { label: "robotic arm", re: /\brobot(ic)? arms?\b/, weight: 5 },
    { label: "wind turbine", re: /\bwind turbines?\b/, weight: 5 },
    { label: "rocket engine", re: /\brocket engines?\b/, weight: 5 },
    { label: "steam engine", re: /\bsteam engines?\b/, weight: 5 },
    { label: "electric motor", re: /\belectric motors?\b|\bbrushless motors?\b/, weight: 5 },
    { label: "3d cutaway", re: /\b3d\b|\bcutaway\b|\bexploded view\b|\bcad\b/, weight: 4 },
    // Domain terms: machines, fluids, thermal, optics, hardware, anatomy, vehicles, architecture
    {
      label: "engine",
      re: /\b(?<!matching |search |query |inference |rendering |game |rule |workflow |policy )engines?\b/,
      weight: 3,
    },
    { label: "turbine", re: /\bturbines?\b/, weight: 3 },
    { label: "piston", re: /\bpistons?\b|\bnozzles?\b/, weight: 3 },
    { label: "gearbox", re: /\bgear(box|s|train)?\b/, weight: 3 },
    { label: "escapement", re: /\bescapements?\b|\btourbillons?\b|\bmainsprings?\b/, weight: 4 },
    { label: "crankshaft", re: /\b(crank|cam)shafts?\b|\bdrive ?shafts?\b/, weight: 3 },
    { label: "clutch", re: /\bclutch(es)?\b|\btransmissions?\b|\bbrakes?\b/, weight: 4 },
    { label: "bearing", re: /\bball bearings?\b|\bbearings?\b/, weight: 3 },
    { label: "compressor", re: /\bcompressors?\b|\bimpellers?\b|\brotors?\b/, weight: 3 },
    { label: "valve", re: /\bvalves?\b/, weight: 2 },
    { label: "mechanical", re: /\bmechanical\b|\bmachines?\b|\bmechanisms?\b/, weight: 2 },
    { label: "robotics", re: /\brobot(s|ics)?\b|\bactuators?\b|\bservos?\b|\bdrone\b/, weight: 3 },
    { label: "hardware", re: /\bhardware\b|\bgpu\b|\bmotherboard\b|\bmicrochip\b|\bwafer\b/, weight: 3 },
    {
      label: "optics device",
      re: /\bcamera\b|\bshutter\b|\baperture\b|\bmicroscopes?\b|\btelescopes?\b|\bprisms?\b|\bray optics\b/,
      weight: 5,
    },
    {
      label: "anatomy",
      re: /\banatomy\b|\borgans?\b|\blungs?\b|\bkidneys?\b|\bnephrons?\b|\bcochlea\b|\b(human )?eyes?\b|\b(human |inner )?ears?\b|\bmuscles?\b|\bsarcomeres?\b|\bjoints?\b|\bskeleton\b/,
      weight: 5,
    },
    {
      label: "architecture",
      re: /\b(?<!software |system |transformer |neural |network |microservice |microservices |model )architecture\b|\bcathedrals?\b|\b(?<!wheatstone |diode |h-)bridges?\b(?!\s*rectifiers?)|\bsuspension bridge\b|\bdomes?\b|\btruss\b/,
      weight: 3,
    },
    { label: "vehicle", re: /\bvehicles?\b|\baircraft\b|\bhelicopter\b|\bsubmarine\b|\bbicycle\b/, weight: 2 },
    { label: "watch", re: /\bwatch(es)?\b|\bclockwork\b/, weight: 3 },
    {
      label: "fluid device",
      re: /\bfluids?\b|\bstreamlines?\b|\bpressure drop\b|\bviscosity\b|\bbuoyancy\b|\baerodynamics?\b|\blaminar flow\b|\bturbulent flow\b|\bboundary layer\b/,
      weight: 3,
    },
    { label: "thermal", re: /\bthermodynamics?\b|\bconvection\b|\bconduction\b|\bthermal\b|\bradiators?\b/, weight: 3 },
    { label: "electrochemistry", re: /\belectrochemistry\b|\banode\b|\bcathode\b|\belectrolyte\b/, weight: 4 },
  ],
  C: [
    // CS, algorithms, data structures, protocols, distributed systems, ML, logic/circuits, math, finance
    { label: "lru cache", re: /\b(lru|lfu) caches?\b/, weight: 6 },
    { label: "bloom filter", re: /\bbloom filters?\b/, weight: 6 },
    { label: "b-tree", re: /\bb\+?-?trees?\b|\bred[- ]black trees?\b|\bavl trees?\b|\blsm[- ]trees?\b|\bmerkle trees?\b/, weight: 6 },
    { label: "hash table", re: /\bhash (tables?|maps?)\b|\bconsistent hashing\b/, weight: 6 },
    { label: "tcp handshake", re: /\btcp (handshake|congestion|flow|window)?\b|\bthree[- ]way handshake\b|\btls handshake\b/, weight: 6 },
    { label: "raft consensus", re: /\braft( consensus)?\b|\bpaxos\b|\bbyzantine fault\b|\btwo[- ]phase commit\b|\b2pc\b/, weight: 6 },
    {
      label: "self-attention",
      re: /\btransformer\s+(self[- ]?attention|architecture|model|block|layer|decoder|encoder)\b|\bself[- ]?attention\b|\bmulti[- ]?head attention\b/,
      weight: 6,
    },
    { label: "gradient descent", re: /\bgradient descent\b|\bbackpropagation\b|\bneural networks?\b|\bdiffusion models?\b/, weight: 6 },
    { label: "mapreduce", re: /\bmap[- ]?reduce\b|\bspark\b|\bdata pipeline\b/, weight: 6 },
    { label: "order book", re: /\border books?\b|\bmatching engines?\b|\bmarket makers?\b|\bclearing house\b/, weight: 6 },
    { label: "rc circuit", re: /\b(rc|rl|rlc|lc) circuits?\b|\bcircuit logic\b|\blogic gates?\b|\bflip[- ]flops?\b|\bboolean logic\b/, weight: 6 },
    {
      label: "rectifier & op-amp",
      re: /\bop[- ]amps?\b|\bvoltage dividers?\b|\bwheatstone bridge\b|\b(bridge|full[- ]wave|half[- ]wave)\s+rectifiers?\b|\brectifier circuits?\b/,
      weight: 6,
    },
    { label: "state machine", re: /\b(finite )?state machines?\b|\bautomata\b|\bturing machines?\b/, weight: 6 },
    { label: "supply and demand", re: /\bsupply[- ]and[- ]demand\b|\bsupply[- ]demand\b|\bprice elasticity\b|\bphillips curve\b/, weight: 6 },
    { label: "distributed systems", re: /\bdistributed systems?\b|\bvector clocks?\b|\bcrdts?\b|\bgossip protocol\b/, weight: 5 },
    { label: "networking protocol", re: /\b(dns|http\/?[23]?|quic|bgp|grpc|oauth|jwt|websocket)s?\b/, weight: 5 },
    { label: "database internals", re: /\b(mvcc|write[- ]ahead log|query planner|database index|sql joins?|sharding)\b/, weight: 5 },
    {
      label: "data replication",
      re: /\b(database|raft|paxos|leader|log|state[- ]machine|multi[- ]region|async|sync)\s+replication\b/,
      weight: 5,
    },
    { label: "concurrency", re: /\bmutex(es)?\b|\block[- ]free\b|\bdeadlocks?\b|\bevent loop\b|\bgarbage collection\b/, weight: 5 },
    { label: "rate limiter", re: /\brate limiters?\b|\btoken bucket\b|\bload balancers?\b|\bcircuit breakers?\b/, weight: 5 },
    { label: "llm internals", re: /\bllms?\b|\bkv cache\b|\bbeam search\b|\brag pipeline\b|\btokeniz(er|ation)\b|\bsoftmax\b/, weight: 5 },
    { label: "math", re: /\b(math(ematical)? )?proofs?\b|\btheorems?\b|\binduction\b|\bby contradiction\b|\bdifferential equations?\b|\blinear algebra\b|\bbayes'? theorem\b|\bfourier transform\b/, weight: 5 },
    { label: "sorting & graph algorithms", re: /\b(quicksort|mergesort|heapsort|dijkstra|a\*|dynamic programming|topological sort|binary search)\b/, weight: 5 },
    { label: "pid controller", re: /\bpid controller\b|\bfeedback loop\b/, weight: 5 },
    // Domain terms: CS, algorithms, protocols, ML, software, logic/circuits, economics, finance
    { label: "algorithm", re: /\balgorithms?\b|\bdata structures?\b|\bcomplexity\b|\bbig[- ]o\b/, weight: 4 },
    { label: "cache", re: /\bcach(e|es|ing)\b/, weight: 3 },
    { label: "protocol", re: /\bprotocols?\b|\bhandshakes?\b|\bpackets?\b|\brouting\b|\bnetworking\b/, weight: 3 },
    { label: "consensus", re: /\bconsensus\b|\bquorum\b|\bleader election\b|\bdistributed\b/, weight: 4 },
    { label: "database", re: /\bdatabases?\b|\btransactions?\b|\bindexes?\b|\bqueries?\b/, weight: 3 },
    { label: "machine learning", re: /\bmachine learning\b|\bml\b|\bembeddings?\b|\bbackprop\b|\bgradients?\b|\bweights?\b|\btraining\b/, weight: 3 },
    { label: "cryptography", re: /\bencryption\b|\bpublic[- ]key\b|\bdiffie[- ]hellman\b|\bzero[- ]knowledge\b|\bblockchain\b/, weight: 4 },
    { label: "software architecture", re: /\bmicroservices?\b|\bmessage queues?\b|\bevent sourcing\b|\bcompilers?\b|\bparsers?\b/, weight: 4 },
    { label: "circuit logic", re: /\bcircuits?\b|\bresistors?\b|\bcapacitors?\b|\binductors?\b|\bohm'?s law\b|\bkirchhoff\b/, weight: 4 },
    { label: "economics", re: /\beconomics?\b|\bmicroeconomics?\b|\bmacroeconomics?\b|\belasticity\b|\bequilibrium price\b|\bdemand curves?\b|\bsupply curves?\b/, weight: 4 },
    { label: "finance workflow", re: /\bfinance\b|\bsettlement\b|\bclearing\b|\bledgers?\b|\bdouble[- ]entry\b|\bliquidity pools?\b/, weight: 4 },
    { label: "retries", re: /\bretr(y|ies)\b|\bexponential backoff\b|\bmulti[- ]agent\b/, weight: 4 },
  ],
};

const OVERRIDE_ALIASES = Object.freeze({
  A: "A",
  "3D": "A",
  PHYSICAL: "A",
  C: "C",
  "2D": "C",
  CONCEPTUAL: "C",
});

function normalizeOverride(raw) {
  if (raw == null || raw === "") return null;
  const code = String(raw).trim().toUpperCase();
  if (code in OVERRIDE_ALIASES) return OVERRIDE_ALIASES[code];
  if (code === "B") {
    throw new RangeError(
      `Invalid engine override "${raw}". Engine B has been retired — Visualize Studio uses the 2-Engine architecture: "A" (or "3D", "physical") for 3D physical topics, and "C" (or "2D", "conceptual") for 2D conceptual topics.`,
    );
  }
  throw new RangeError(
    `Invalid engine override "${raw}". Visualize Studio uses the 2-Engine architecture: expected "A" (or "3D", "physical") for 3D physical topics, or "C" (or "2D", "conceptual") for 2D conceptual topics.`,
  );
}

function buildResult(code, { reason, confidence, matchedSignals }) {
  const meta = ENGINES[code];
  const conf = Number(confidence.toFixed(2));
  return {
    engine: meta.engine,
    name: meta.name,
    tagline: meta.tagline,
    kitPath: meta.kitPath,
    reason,
    confidence: conf,
    ambiguous: conf < 0.6,
    matchedSignals,
    recommendedPrimitives: [...meta.recommendedPrimitives],
  };
}

/**
 * Deterministically route a topic prompt to Engine A (3D Physical CAD Studio)
 * or Engine C (2D Tactile Conceptual Studio).
 *
 * @param {string} prompt
 * @param {{ engine?: "A"|"C"|"3D"|"2D"|"physical"|"conceptual"|string }} [opts]
 */
export function routeTopic(prompt, opts = {}) {
  const override = normalizeOverride(opts?.engine);
  if (override) {
    return buildResult(override, {
      reason: `Manual override (--engine ${opts.engine} -> ${override}) selected ${ENGINES[override].name}.`,
      confidence: 1,
      matchedSignals: [`override:${override}`],
    });
  }

  const text = String(prompt ?? "").trim().toLowerCase();
  const scores = { A: 0, C: 0 };
  const matches = { A: [], C: [] };

  if (text.length > 0) {
    for (const code of ["A", "C"]) {
      for (const rule of SIGNAL_RULES[code]) {
        if (rule.re.test(text)) {
          scores[code] += rule.weight;
          matches[code].push({ label: rule.label, weight: rule.weight });
        }
      }
    }
  }

  // Deterministic tie-break priority: C -> A when tied at 0; otherwise highest score,
  // breaking positive ties by max single-rule weight then C > A.
  const ranked = ["A", "C"]
    .map((code) => ({
      code,
      score: scores[code],
      maxWeight: matches[code].reduce((m, x) => Math.max(m, x.weight), 0),
      order: code === "C" ? 1 : 0,
    }))
    .sort((x, y) => y.score - x.score || y.maxWeight - x.maxWeight || y.order - x.order);

  const winner = ranked[0];
  const runnerUp = ranked[1];

  if (winner.score === 0) {
    return buildResult("C", {
      reason:
        "No domain-specific physical signals detected; defaulting to Engine C (2D Tactile Conceptual Studio) for clean conceptual diagrams.",
      confidence: 0.35,
      matchedSignals: [],
    });
  }

  const topSignals = matches[winner.code]
    .slice()
    .sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label))
    .map((m) => m.label);

  const uniqueSignals = [...new Set(topSignals)];
  const margin = winner.score - runnerUp.score;
  const total = winner.score + runnerUp.score;
  const rawConfidence =
    margin === 0
      ? Math.min(0.55, 0.45 + Math.min(0.1, (winner.score / 12) * 0.1))
      : 0.58 +
        Math.min(0.24, (winner.score / 12) * 0.24) +
        Math.min(0.17, (margin / Math.max(1, total)) * 0.17);
  const confidence = Math.max(0.45, Math.min(0.99, rawConfidence));

  const cited = uniqueSignals.slice(0, 3).join(", ");
  return buildResult(winner.code, {
    reason: `Matched ${ENGINES[winner.code].name} signals (${cited}) with score ${winner.score} vs runner-up ${runnerUp.code} (${runnerUp.score}).`,
    confidence,
    matchedSignals: uniqueSignals,
  });
}
