import { createEditorialStage } from "../../src/studio/engine-c.ts";

/**
 * LRU Cache — Tactile Kinetic Instrument Scene (Engine C Golden Benchmark)
 *
 * Pure Braun / Dieter Rams / Teenage Engineering minimalism on warm drafting paper:
 *   1. Top: `stage.strip("hashmap")` — razor-thin 6-key mechanical switchboard (`A..F`)
 *   2. Middle: 146px open negative space with whisper-thin cubic Bézier threads
 *      and ONE illuminated active thread + gliding pulse dot
 *   3. Bottom: `stage.track("recency_rail")` — milled N-slot horizontal rail with
 *      etched slot numerals, pure matte-ivory ceramic tiles (`C` / `89`), parabolic
 *      lift-arc promotion physics, and a chamfered right `evict ↘` drop-off edge
 */

const LOGICAL_W = 1120;
const LOGICAL_H = 640;

const CAMERA_PRESETS = {
  hero: { x: 560, y: 312, zoom: 1.0 },
  overview: { x: 560, y: 312, zoom: 1.0 },
  strip_focus: { x: 560, y: 244, zoom: 1.08 },
  rail_focus: { x: 560, y: 344, zoom: 1.04 },
  evict_focus: { x: 604, y: 314, zoom: 1.0 },
};

const ALL_KEYS = ["A", "B", "C", "D", "E", "F"];

export function mount(canvas, ctx = {}) {
  const stage = createEditorialStage(canvas, {
    width: LOGICAL_W,
    height: LOGICAL_H,
    grid: 16,
    theme: ctx.theme === "dark" ? "dark" : "light",
    cameraPresets: CAMERA_PRESETS,
    initialCamera: "overview",
  });

  function syncScene(sim = {}) {
    const capacity = Math.max(2, Math.min(5, Math.round(Number(sim.capacity ?? 4))));
    const order = Array.isArray(sim.order) ? sim.order : [];
    const values = sim.values && typeof sim.values === "object" ? sim.values : {};
    const lastOp = sim.lastOp || {
      kind: "PUT",
      key: "C",
      value: 89,
      status: "MISS",
    };
    const lastEvicted = sim.lastEvicted || null;
    const lastEvictedValue = sim.lastEvictedValue ?? null;

    const activeKey = lastOp.key;
    const isHit = lastOp.status === "HIT";
    const isEvict = lastOp.status === "EVICT";
    const activeAccent = isHit ? "teal" : isEvict ? "orange" : "cobalt";

    const activeIds = new Set(["hashmap", "recency_rail"]);

    // 1. Top Instrument: Razor-thin 6-key Mechanical Switchboard (centered)
    const itemW = 72;
    const itemH = 46;
    const stripGap = 12;
    const stripW = ALL_KEYS.length * itemW + (ALL_KEYS.length - 1) * stripGap;
    const stripX = Math.round((LOGICAL_W - stripW) * 0.5);
    const stripY = 148;

    const stripItems = ALL_KEYS.map((key) => {
      const inCache = order.includes(key);
      const isTarget = key === activeKey;
      return {
        id: `slot_${key}`,
        key,
        occupied: inCache,
        active: isTarget,
        dimmed: false,
        accent: isTarget ? activeAccent : null,
      };
    });

    stage.strip("hashmap", {
      x: stripX,
      y: stripY,
      eyebrow: "HASH MAP",
      items: stripItems,
      itemW,
      itemH,
      gap: stripGap,
      group: "hashmap",
      visible: true,
    });

    // 2. Bottom Instrument: Physical Milled Recency Rail (dynamic N = capacity)
    const slotW = 114;
    const slotH = 82;
    const trackGap = 22;
    const railW = capacity * slotW + Math.max(0, capacity - 1) * trackGap;
    // Slight leftward optical balance to accommodate the right `evict ↘` drop-off edge
    const railX = Math.round((LOGICAL_W - railW) * 0.5 - 24);
    const railY = 340;

    const tiles = order.map((key) => {
      const isTarget = key === activeKey;
      const state = isTarget ? (isHit ? "promoted" : "active") : "idle";
      return {
        id: `tile_${key}`,
        key,
        sublabel: values[key] != null ? String(values[key]) : undefined,
        state,
        accent: isTarget ? activeAccent : null,
      };
    });

    const evictedTiles =
      isEvict && lastEvicted
        ? [
            {
              id: `tile_${lastEvicted}`,
              key: lastEvicted,
              sublabel: lastEvictedValue != null ? String(lastEvictedValue) : undefined,
              state: "evicting",
              accent: "ember",
            },
          ]
        : [];

    stage.track("recency_rail", {
      x: railX,
      y: railY,
      eyebrow: "RECENCY RAIL",
      slots: capacity,
      tiles,
      evictedTiles,
      slotW,
      slotH,
      gap: trackGap,
      evictEdge: true,
      leftTick: "|← MRU",
      rightTick: "LRU →|",
      evictLabel: "evict ↘",
      showLinks: true,
      group: "recency_rail",
      visible: true,
    });

    // 3. Middle Negative Space: Smooth Cubic Bézier Tension Threads
    //    Whisper-thin 14% idle curves + ONE illuminated active curve with gliding pulse dot
    for (const key of order) {
      const arcId = `thread_${key}`;
      activeIds.add(arcId);
      const isTarget = key === activeKey;

      stage.arcLink(arcId, {
        from: `slot_${key}`,
        to: `tile_${key}`,
        active: isTarget,
        pulse: isTarget,
        accent: isTarget ? activeAccent : null,
        pulseSpeed: 0.58,
        group: "threads",
        visible: true,
      });
    }

    stage.removeMissing(activeIds);
  }

  return {
    engineKind: "C",
    getRegisteredIds() {
      return stage.getRegisteredIds();
    },
    getCameraPresets() {
      return stage.getCameraPresets();
    },
    setFocus(ids, accents) {
      stage.setFocus(ids, accents);
    },
    setReveal(ids) {
      stage.setReveal(ids);
    },
    setCamera(preset, zoom) {
      stage.setCamera(preset || "overview", zoom);
    },
    resetCamera() {
      stage.resetCamera();
    },
    setTheme(theme) {
      stage.setTheme(theme === "dark" ? "dark" : "light");
    },
    resize() {
      stage.resize();
    },
    getCalloutPos(targetId) {
      return stage.projectAnchor(targetId);
    },
    update(dt, sim = {}) {
      const safeDt = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0.016;
      syncScene(sim);
      stage.render(safeDt);
    },
  };
}

globalThis.STUDIO_SCENE = { mount };
