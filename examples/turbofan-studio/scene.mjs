import * as THREE from "three";
import {
  ACCENT_TOKENS,
  addArchitecturalEdges,
  baseMount,
  bladeRing,
  combustorRing,
  createClayMaterial,
  createStudioStage,
  cutawayCylinder,
  flowRibbon,
  shaft,
} from "../../src/studio/engine-a.ts";

/**
 * Rolls-Royce Trent / GE9X-inspired Architectural Cutaway Turbofan Scene
 * Built on Engine A (Three.js Orthographic Matte-Clay + EdgesGeometry CAD Kit).
 *
 * Coordinate convention:
 *   - Engine axis along X: intake at -X, exhaust at +X.
 *   - Cutaway opening centered at +45° (+Y, +Z) facing the hero camera.
 *   - Camera sits in (+Y, +Z) hemisphere so -X is screen-left (intake) and +X is screen-right (exhaust).
 */

function makeStruts(count, x, rInner, rOuter, chord, thick, startDeg, endDeg) {
  const group = new THREE.Group();
  group.name = "bypass_struts";
  const mat = createClayMaterial("clayMid", { roughness: 0.64, metalness: 0.16 });
  const len = Math.max(0.05, rOuter - rInner);
  const geo = new THREE.BoxGeometry(chord, len, thick);

  for (let i = 0; i < count; i++) {
    const frac = count === 1 ? 0.5 : i / (count - 1);
    const deg = startDeg + frac * (endDeg - startDeg);
    const rad = (deg * Math.PI) / 180;
    const rMid = (rInner + rOuter) * 0.5;
    const strut = new THREE.Mesh(geo, mat);
    strut.position.set(x, Math.sin(rad) * rMid, Math.cos(rad) * rMid);
    // Align local +Y along radial direction (0, sin(rad), cos(rad))
    strut.rotation.x = Math.PI / 2 - rad;
    strut.castShadow = true;
    strut.receiveShadow = true;
    addArchitecturalEdges(strut, 24);
    group.add(strut);
  }
  return group;
}

function makeTailconePlug(xStart, length, rBase) {
  const pts = [];
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 = base, 1 = sharp rear tip
    const r = Math.max(0.004, rBase * Math.pow(1 - t, 0.72));
    pts.push(new THREE.Vector2(r, t * length));
  }
  const geo = new THREE.LatheGeometry(pts, 32);
  // +Y -> +X via -90° around Z
  geo.rotateZ(-Math.PI / 2);
  geo.translate(xStart, 0, 0);
  geo.computeVertexNormals();

  const mat = createClayMaterial("graphite", { roughness: 0.44, metalness: 0.34 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "core_tailcone_plug";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addArchitecturalEdges(mesh, 24);
  return mesh;
}

function buildBypassCurves() {
  // 6 sculpted 3D streamlines through the wide outer bypass annulus (upper, cutaway rim, lower, back)
  // Angles in degrees around X axis where 0° = +Z, 90° = +Y:
  const specs = [
    { deg: 76, rIn: 1.18, rMid: 1.38, rOut: 1.06 },
    { deg: 48, rIn: 1.12, rMid: 1.32, rOut: 1.02 },
    { deg: 18, rIn: 1.15, rMid: 1.35, rOut: 1.04 },
    { deg: -16, rIn: 1.16, rMid: 1.36, rOut: 1.05 },
    { deg: -64, rIn: 1.18, rMid: 1.38, rOut: 1.06 },
    { deg: 122, rIn: 1.18, rMid: 1.36, rOut: 1.05 },
  ];

  return specs.map(({ deg, rIn, rMid, rOut }) => {
    const a0 = (deg * Math.PI) / 180;
    const a1 = ((deg + 9) * Math.PI) / 180;
    const a2 = ((deg + 16) * Math.PI) / 180;
    const a3 = ((deg + 20) * Math.PI) / 180;
    return [
      [-3.55, Math.sin(a0) * (rIn * 0.96), Math.cos(a0) * (rIn * 0.96)],
      [-2.35, Math.sin(a0) * rIn, Math.cos(a0) * rIn],
      [-1.15, Math.sin(a1) * rMid, Math.cos(a1) * rMid],
      [0.35, Math.sin(a2) * (rMid * 0.96), Math.cos(a2) * (rMid * 0.96)],
      [1.75, Math.sin(a3) * (rOut * 1.06), Math.cos(a3) * (rOut * 1.06)],
      [3.55, Math.sin(a3) * rOut, Math.cos(a3) * rOut],
    ];
  });
}

function buildCoreCurves() {
  // 4 sculpted 3D streamlines diving into the inner core, squeezing through the compressor,
  // igniting in the annular combustor, spinning the turbine, and blasting out the exhaust nozzle.
  const angles = [56, 22, -28, 128];
  return angles.map((deg) => {
    const a0 = (deg * Math.PI) / 180;
    const a1 = ((deg + 14) * Math.PI) / 180;
    const a2 = ((deg + 26) * Math.PI) / 180;
    const a3 = ((deg + 34) * Math.PI) / 180;
    return [
      [-3.15, Math.sin(a0) * 0.64, Math.cos(a0) * 0.64],
      [-1.75, Math.sin(a0) * 0.56, Math.cos(a0) * 0.56],
      [-0.45, Math.sin(a1) * 0.48, Math.cos(a1) * 0.48],
      [0.78, Math.sin(a2) * 0.49, Math.cos(a2) * 0.49],
      [1.82, Math.sin(a3) * 0.45, Math.cos(a3) * 0.45],
      [2.85, Math.sin(a3) * 0.36, Math.cos(a3) * 0.36],
      [4.25, Math.sin(a3) * 0.28, Math.cos(a3) * 0.28],
    ];
  });
}

const CAMERA_PRESETS = {
  hero: { position: [-4.2, 3.35, 10.6], target: [0.05, -0.28, 0], zoom: 1.02 },
  intake: { position: [-8.6, 2.65, 6.9], target: [-1.35, -0.24, 0], zoom: 1.24 },
  bypass_side: { position: [-0.35, 1.95, 11.8], target: [0.15, -0.26, 0], zoom: 1.06 },
  bypass_cutaway: { position: [-2.4, 4.35, 9.8], target: [0.0, -0.18, 0], zoom: 1.18 },
  core_burner: { position: [-1.15, 2.75, 9.1], target: [0.35, -0.16, 0], zoom: 1.52 },
  turbine_shaft: { position: [5.4, 3.15, 9.1], target: [0.22, -0.22, 0], zoom: 1.26 },
  compare: { position: [-4.0, 3.25, 10.8], target: [-0.42, -0.34, 0], zoom: 0.96 },
};

export function mount(canvas, ctx = {}) {
  const stage = createStudioStage(canvas, {
    theme: ctx.theme === "dark" ? "dark" : "light",
    frustumSize: 6.4,
    cameraPresets: CAMERA_PRESETS,
    initialCamera: "hero",
    pixelRatioCap: 2,
  });

  // Ground anchor & architectural contact shadow
  const mountFloor = baseMount({ y: -2.24, radius: 4.15 });
  stage.root.add(mountFloor);

  const OPEN = 148;

  // 1. OUTER BYPASS NACELLE (morphs radially with bypass ratio!)
  const nacellePart = new THREE.Group();
  nacellePart.name = "part_nacelle";
  const nacelleMorph = new THREE.Group();
  nacelleMorph.name = "nacelle_morph";
  nacellePart.add(nacelleMorph);

  // Rounded aerodynamic intake lip
  nacelleMorph.add(
    cutawayCylinder({
      x0: -2.88,
      length: 0.42,
      rOuter: 1.66,
      rInner: 1.54,
      rOuterEnd: 1.84,
      rInnerEnd: 1.66,
      openDeg: OPEN,
      tone: "clayLight",
      roughness: 0.62,
      metalness: 0.1,
      segments: 56,
    }),
  );
  // Main outer bypass barrel
  nacelleMorph.add(
    cutawayCylinder({
      x0: -2.46,
      length: 2.36,
      rOuter: 1.84,
      rInner: 1.66,
      rOuterEnd: 1.78,
      rInnerEnd: 1.6,
      openDeg: OPEN,
      tone: "clayLight",
      roughness: 0.72,
      metalness: 0.06,
      segments: 56,
    }),
  );
  // Rear tapered bypass exit cowling
  nacelleMorph.add(
    cutawayCylinder({
      x0: -0.1,
      length: 1.78,
      rOuter: 1.78,
      rInner: 1.6,
      rOuterEnd: 1.38,
      rInnerEnd: 1.24,
      openDeg: OPEN,
      tone: "clayMid",
      roughness: 0.72,
      metalness: 0.08,
      segments: 56,
    }),
  );
  // Internal bypass outlet guide struts connecting core to nacelle (in non-cutaway arc)
  nacelleMorph.add(makeStruts(5, -1.52, 0.88, 1.62, 0.22, 0.055, 145, 315));
  nacelleMorph.add(makeStruts(4, 0.65, 0.76, 1.48, 0.18, 0.05, 165, 305));

  stage.registerPart("nacelle", nacellePart, {
    anchor: [-0.4, 1.62, 0.72],
    accent: "cobalt",
  });

  // 2. GIANT FRONT FAN (morphs radially with bypass ratio, spins continuously)
  const fanPart = new THREE.Group();
  fanPart.name = "part_fan";
  const fanMorph = new THREE.Group();
  fanMorph.name = "fan_morph";
  fanPart.add(fanMorph);

  const frontFan = bladeRing({
    x: -2.14,
    rHub: 0.44,
    rTip: 1.56,
    blades: 18,
    chord: 0.46,
    thick: 0.052,
    twistDeg: 38,
    pitchDeg: 24,
    noseLen: 0.76,
    hubLength: 0.56,
    tone: "clayLight",
    hubTone: "graphite",
  });
  fanMorph.add(frontFan);

  stage.registerPart("fan", fanPart, {
    anchor: [-2.18, 1.46, 0.42],
    accent: "orange",
  });

  // 3. INNER CORE CASING + EXHAUST NOZZLE & PLUG
  const corePart = new THREE.Group();
  corePart.name = "part_core_casing";

  // Intake splitter fairing separating bypass air from core air
  corePart.add(
    cutawayCylinder({
      x0: -1.68,
      length: 0.58,
      rOuter: 0.94,
      rInner: 0.82,
      rOuterEnd: 0.88,
      rInnerEnd: 0.76,
      openDeg: OPEN,
      tone: "clayMid",
      roughness: 0.66,
      metalness: 0.14,
      segments: 48,
    }),
  );
  // Compressor casing (tapers inward as air is squeezed 30x tighter)
  corePart.add(
    cutawayCylinder({
      x0: -1.1,
      length: 1.48,
      rOuter: 0.88,
      rInner: 0.76,
      rOuterEnd: 0.76,
      rInnerEnd: 0.65,
      openDeg: OPEN,
      tone: "clayMid",
      roughness: 0.64,
      metalness: 0.18,
      segments: 48,
    }),
  );
  // Combustor & turbine outer case
  corePart.add(
    cutawayCylinder({
      x0: 0.38,
      length: 1.72,
      rOuter: 0.78,
      rInner: 0.67,
      rOuterEnd: 0.72,
      rInnerEnd: 0.6,
      openDeg: OPEN,
      tone: "clayDark",
      roughness: 0.58,
      metalness: 0.24,
      segments: 48,
    }),
  );
  // Convergent rear hot exhaust nozzle
  corePart.add(
    cutawayCylinder({
      x0: 2.1,
      length: 0.98,
      rOuter: 0.72,
      rInner: 0.6,
      rOuterEnd: 0.48,
      rInnerEnd: 0.39,
      openDeg: 118,
      tone: "graphite",
      roughness: 0.46,
      metalness: 0.32,
      segments: 48,
    }),
  );
  // Central aerodynamic exhaust plug cone
  corePart.add(makeTailconePlug(2.05, 1.24, 0.28));

  stage.registerPart("core_casing", corePart, {
    anchor: [2.42, 0.48, 0.42],
    accent: "ember",
  });

  // 4. 4-STAGE AXIAL COMPRESSOR (progressively tighter annular stages)
  const compressorPart = new THREE.Group();
  compressorPart.name = "part_compressor";
  const compStages = [
    bladeRing({ x: -1.02, rHub: 0.26, rTip: 0.74, blades: 24, chord: 0.18, thick: 0.025, twistDeg: 22, pitchDeg: 28, hubLength: 0.22, tone: "clayLight", hubTone: "clayDark" }),
    bladeRing({ x: -0.62, rHub: 0.3, rTip: 0.7, blades: 28, chord: 0.16, thick: 0.022, twistDeg: 20, pitchDeg: 30, hubLength: 0.2, tone: "clayMid", hubTone: "clayDark" }),
    bladeRing({ x: -0.24, rHub: 0.34, rTip: 0.66, blades: 32, chord: 0.145, thick: 0.02, twistDeg: 18, pitchDeg: 32, hubLength: 0.19, tone: "clayLight", hubTone: "graphite" }),
    bladeRing({ x: 0.12, rHub: 0.37, rTip: 0.63, blades: 34, chord: 0.13, thick: 0.018, twistDeg: 16, pitchDeg: 34, hubLength: 0.18, tone: "clayMid", hubTone: "graphite" }),
  ];
  for (const s of compStages) compressorPart.add(s);

  stage.registerPart("compressor", compressorPart, {
    anchor: [-0.45, 0.72, 0.45],
    accent: "gold",
  });

  // 5. ANNULAR COMBUSTOR / BURNER RING
  const combustorObj = combustorRing({
    x: 0.78,
    rInner: 0.33,
    rOuter: 0.64,
    length: 0.72,
    cans: 10,
    tone: "clayDark",
    openDeg: OPEN,
  });
  const flameMeshes = combustorObj.userData.flameMeshes || [];

  stage.registerPart("combustor", combustorObj, {
    anchor: [0.84, 0.72, 0.44],
    accent: "ember",
  });

  // 6. 2-STAGE REAR POWER TURBINE
  const turbinePart = new THREE.Group();
  turbinePart.name = "part_turbine";
  const turbineStages = [
    bladeRing({ x: 1.46, rHub: 0.27, rTip: 0.6, blades: 26, chord: 0.17, thick: 0.024, twistDeg: -24, pitchDeg: -28, hubLength: 0.22, tone: "clayMid", hubTone: "graphite" }),
    bladeRing({ x: 1.84, rHub: 0.25, rTip: 0.63, blades: 22, chord: 0.19, thick: 0.026, twistDeg: -26, pitchDeg: -26, hubLength: 0.24, tone: "clayLight", hubTone: "graphite" }),
  ];
  for (const s of turbineStages) turbinePart.add(s);

  stage.registerPart("turbine", turbinePart, {
    anchor: [1.66, 0.64, 0.46],
    accent: "gold",
  });

  // 7. SOLID COAXIAL CENTER DRIVE SHAFT
  const shaftObj = shaft({
    x0: -2.2,
    length: 4.24,
    r: 0.145,
    tone: "graphite",
    collars: 4,
  });
  stage.registerPart("shaft", shaftObj, {
    anchor: [0.15, -0.14, 0.26],
    accent: "orange",
  });

  // 8. LIVE 3D AIRFLOW RIBBONS (saturated accents strictly for invisible forces!)
  const bypassFlowPart = new THREE.Group();
  bypassFlowPart.name = "part_bypass_flow";
  const bypassMorph = new THREE.Group();
  bypassFlowPart.add(bypassMorph);
  const bypassFlow = flowRibbon({
    curves: buildBypassCurves(),
    radius: 0.031,
    color: "cobalt",
    speed: 0.56,
    particleCount: 36,
    opacity: 0.3,
    swirlAmp: 0.032,
    swirlFreq: 2.2,
  });
  bypassMorph.add(bypassFlow.group);
  stage.registerPart("bypass_flow", bypassFlowPart, {
    anchor: [-0.28, 1.42, 0.62],
    accent: "cobalt",
  });

  const coreFlow = flowRibbon({
    curves: buildCoreCurves(),
    radius: 0.025,
    color: "orange",
    speed: 0.78,
    particleCount: 28,
    opacity: 0.36,
    swirlAmp: 0.022,
    swirlFreq: 3.4,
  });
  stage.registerPart("core_flow", coreFlow.group, {
    anchor: [2.85, 0.32, 0.35],
    accent: "ember",
  });

  // Live animation state
  let currentRadialMorph = 1.0;
  let elapsed = 0;

  return {
    engineKind: "A",
    getRegisteredIds() {
      return stage.getRegisteredIds();
    },
    getCameraPresets() {
      return stage.getCameraPresets();
    },
    setFocus(ids, accents) {
      stage.setFocus(ids ?? null, accents || undefined);
    },
    setReveal(ids) {
      stage.setReveal(ids ?? null);
    },
    setCamera(preset, zoom) {
      stage.goToCamera(preset || "hero", zoom);
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
    update(dt, sim = {}, params = {}) {
      const safeDt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0.016;
      elapsed += safeDt;

      const throttlePct = Number(sim.throttlePct ?? params.throttlePct ?? 85);
      const bypassRatio = Number(sim.bypassRatio ?? params.bypassRatio ?? 8);
      const fanSpeed = Number(sim.fanSpeed ?? 0.9);
      const burnerGlow = Number(sim.burnerGlow ?? 0.88);
      const fanPushPct = Number(sim.fanPushPct ?? 80);
      const corePushPct = Number(sim.corePushPct ?? 20);

      // Smooth physical nacelle & fan radial morph between 1:1 Fighter (0.76) and 10:1 Ultra (1.05)
      const targetMorph = 0.74 + ((Math.max(1, Math.min(10, bypassRatio)) - 1) / 9) * 0.31;
      const morphEase = safeDt > 0 ? 1 - Math.exp(-safeDt * 7.5) : 1;
      currentRadialMorph += (targetMorph - currentRadialMorph) * morphEase;

      nacelleMorph.scale.set(1, currentRadialMorph, currentRadialMorph);
      fanMorph.scale.set(1, currentRadialMorph, currentRadialMorph);
      bypassMorph.scale.set(1, currentRadialMorph, currentRadialMorph);

      // Spin rotors & shaft continuously from throttle
      const omegaFan = (1.35 + 2.65 * fanSpeed) * safeDt;
      const omegaCore = omegaFan * 1.65;
      frontFan.rotation.x += omegaFan;
      shaftObj.rotation.x += omegaFan;
      for (const s of compStages) s.rotation.x += omegaCore;
      for (const s of turbineStages) s.rotation.x += omegaFan * 1.25;

      // Throttle-reactive combustor flame glow + lively flicker
      for (let i = 0; i < flameMeshes.length; i++) {
        const flame = flameMeshes[i];
        const flicker = 0.92 + 0.14 * Math.sin(elapsed * 11 + i * 1.7);
        const intensity = (0.7 + 1.9 * burnerGlow) * flicker;
        flame.scale.set(0.65 + 0.55 * burnerGlow * flicker, 0.8 + 0.3 * burnerGlow, 0.8 + 0.3 * burnerGlow);
        if (flame.material && "emissiveIntensity" in flame.material) {
          flame.material.emissiveIntensity = intensity;
        }
      }

      // Live bypass & core airflow ribbons synced directly to simModel!
      const bypassNorm = Math.max(0.28, Math.min(1.25, fanPushPct / 80));
      const coreNorm = Math.max(0.45, Math.min(1.65, (corePushPct / 20) * 0.45 + (throttlePct / 100) * 0.85));

      bypassFlow.update(safeDt, {
        speedScale: 0.65 + 0.85 * fanSpeed,
        opacityScale: 0.48 + 0.68 * bypassNorm,
        radiusScale: 0.62 + 0.48 * bypassNorm,
      });

      const isBlazingCore = corePushPct >= 50 || throttlePct >= 92;
      coreFlow.update(safeDt, {
        speedScale: 0.75 + 1.05 * coreNorm,
        opacityScale: 0.68 + 0.55 * Math.min(1.3, coreNorm),
        radiusScale: 0.78 + 0.42 * Math.min(1.3, coreNorm),
        colorHex: isBlazingCore ? ACCENT_TOKENS.ember : ACCENT_TOKENS.orange,
      });

      stage.render(safeDt);
    },
  };
}

globalThis.STUDIO_SCENE = { mount };
