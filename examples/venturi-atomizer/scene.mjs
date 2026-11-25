import * as THREE from "three";
import {
  ACCENT_TOKENS,
  addArchitecturalEdges,
  baseMount,
  createClayMaterial,
  createStudioStage,
  cutawayCylinder,
  flowRibbon,
  glassVessel,
  liquidVolume,
  mistCone,
  pistonPlunger,
} from "../../src/studio/engine-a.ts";

/**
 * Architectural Cutaway Perfume Venturi Atomizer — 3D CAD Studio Scene
 * Built on Engine A (Three.js Orthographic Matte-Clay + Frosted Glass + EdgesGeometry).
 *
 * Coordinate convention:
 *   - Y-up; vertical bottle + dip tube + Venturi throat all centered on x = +0.25, z = 0.
 *   - Horizontal air pump barrel + Venturi nozzle centered on y = +0.58, spraying toward +X.
 *   - Cutaway openings face front-right/front (+Z/+X/+Y) toward the hero 3/4 camera.
 */

const AXIS_X = 0.25;
const BARREL_Y = 0.58;
const OPEN_HORIZ = 145;
const OPEN_VERT = 132;
// Align rotated vertical cutawayCylinders (rotation.z = +PI/2) to glassVessel's +15° opening
const VERT_START_DEG = -15 + OPEN_VERT / 2;

function verticalCutaway(opts) {
  const g = cutawayCylinder({
    ...opts,
    openDeg: opts.openDeg ?? OPEN_VERT,
    startDeg:
      opts.startDeg !== undefined
        ? opts.startDeg
        : -15 + (opts.openDeg ?? OPEN_VERT) / 2,
  });
  g.rotation.z = Math.PI / 2;
  return g;
}

function buildAirflowCurves() {
  // 5 sculpted 3D streamlines converging from wide air cylinder (x=-1.22, r~0.33)
  // tightly into the narrow Venturi throat (x=+0.25, r~0.095), then flaring out the nozzle (x=+1.66)
  const specs = [
    { dy: 0, dz: 0, rIn: 0.0, rMid: 0.0, rOut: 0.0 },
    { dy: 1, dz: 0, rIn: 0.33, rMid: 0.095, rOut: 0.22 },
    { dy: -1, dz: 0, rIn: 0.33, rMid: 0.095, rOut: 0.22 },
    { dy: 0, dz: 1, rIn: 0.31, rMid: 0.09, rOut: 0.21 },
    { dy: 0, dz: -1, rIn: 0.31, rMid: 0.09, rOut: 0.21 },
  ];

  return specs.map(({ dy, dz, rIn, rMid, rOut }) => [
    [-1.24, BARREL_Y + dy * rIn, dz * rIn],
    [-0.88, BARREL_Y + dy * (rIn * 0.92), dz * (rIn * 0.92)],
    [-0.36, BARREL_Y + dy * (rMid * 1.65), dz * (rMid * 1.65)],
    [0.02, BARREL_Y + dy * rMid, dz * rMid],
    [AXIS_X, BARREL_Y + dy * (rMid * 0.92), dz * (rMid * 0.92)],
    [0.54, BARREL_Y + dy * rMid, dz * rMid],
    [1.06, BARREL_Y + dy * (rOut * 0.78), dz * (rOut * 0.78)],
    [1.68, BARREL_Y + dy * rOut, dz * rOut],
  ]);
}

function buildPressurePocketMesh() {
  const group = new THREE.Group();
  group.name = "pressure_pocket_group";

  // Smooth translucent hourglass / capsule low-pressure core inside the Venturi throat
  const pts = [];
  const steps = 18;
  const len = 0.78;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = (t - 0.5) * len;
    const env = Math.sin(t * Math.PI);
    const pinch = 0.78 + 0.22 * Math.cos((t - 0.5) * Math.PI * 2);
    const rad = Math.max(0.004, 0.145 * Math.pow(env, 0.62) * pinch);
    pts.push(new THREE.Vector2(rad, x));
  }
  const coreGeo = new THREE.LatheGeometry(pts, 28);
  coreGeo.rotateZ(-Math.PI / 2);

  const coreMat = new THREE.MeshStandardMaterial({
    color: ACCENT_TOKENS.cobalt,
    emissive: ACCENT_TOKENS.cobalt,
    emissiveIntensity: 1.25,
    roughness: 0.25,
    metalness: 0.04,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  coreMat.userData.isFlame = true;
  coreMat.userData.baseOpacity = 0.42;
  coreMat.userData.baseTransparent = true;

  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  coreMesh.name = "pressure_pocket_core";
  coreMesh.position.set(AXIS_X, BARREL_Y, 0);
  coreMesh.renderOrder = 4;
  coreMesh.userData.isFlame = true;
  group.add(coreMesh);

  // Inner intense suction heart right over the dip-tube exit orifice
  const heartGeo = new THREE.SphereGeometry(0.115, 22, 16);
  heartGeo.scale(1.65, 0.92, 0.92);
  const heartMat = new THREE.MeshStandardMaterial({
    color: 0x60a5fa,
    emissive: ACCENT_TOKENS.cobalt,
    emissiveIntensity: 1.7,
    roughness: 0.2,
    metalness: 0.0,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });
  heartMat.userData.isFlame = true;
  heartMat.userData.baseOpacity = 0.52;
  heartMat.userData.baseTransparent = true;

  const heartMesh = new THREE.Mesh(heartGeo, heartMat);
  heartMesh.name = "pressure_pocket_heart";
  heartMesh.position.set(AXIS_X, BARREL_Y, 0);
  heartMesh.renderOrder = 4;
  heartMesh.userData.isFlame = true;
  group.add(heartMesh);

  // Crisp glowing suction contour rings around the throat axis
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x93c5fd,
    emissive: ACCENT_TOKENS.cobalt,
    emissiveIntensity: 1.4,
    roughness: 0.2,
    metalness: 0.0,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
  });
  ringMat.userData.isFlame = true;
  ringMat.userData.baseOpacity = 0.58;
  ringMat.userData.baseTransparent = true;

  const rings = [];
  for (const [idx, dx] of [
    [0, -0.18],
    [1, 0.0],
    [2, 0.18],
  ]) {
    const rGeo = new THREE.TorusGeometry(idx === 1 ? 0.145 : 0.125, 0.011, 10, 28);
    rGeo.rotateY(Math.PI / 2);
    const ring = new THREE.Mesh(rGeo, ringMat);
    ring.name = `pressure_pocket_ring_${idx}`;
    ring.position.set(AXIS_X + dx, BARREL_Y, 0);
    ring.renderOrder = 5;
    ring.userData.isFlame = true;
    group.add(ring);
    rings.push(ring);
  }

  group.userData.coreMesh = coreMesh;
  group.userData.heartMesh = heartMesh;
  group.userData.rings = rings;
  return group;
}

const CAMERA_PRESETS = {
  hero: { position: [-3.4, 2.2, 10.6], target: [0.35, -0.58, 0], zoom: 0.98 },
  pump_duct: { position: [-3.2, 2.1, 8.8], target: [-0.85, 0.35, 0], zoom: 1.32 },
  throat_macro: { position: [-1.4, 1.9, 7.6], target: [0.28, 0.45, 0], zoom: 1.72 },
  lift_focus: { position: [-2.8, 1.4, 9.2], target: [0.15, -0.92, 0], zoom: 1.18 },
  mist_focus: { position: [-1.2, 1.8, 8.8], target: [1.45, 0.38, 0], zoom: 1.28 },
  compare: { position: [-3.2, 2.1, 10.8], target: [-0.15, -0.62, 0], zoom: 0.92 },
};

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function mount(canvas, ctx = {}) {
  const stage = createStudioStage(canvas, {
    theme: ctx.theme === "dark" ? "dark" : "light",
    frustumSize: 6.4,
    cameraPresets: CAMERA_PRESETS,
    initialCamera: "hero",
    pixelRatioCap: 2,
  });

  // Museum studio floor shadow anchor
  const mountFloor = baseMount({ y: -2.42, radius: 3.6 });
  stage.root.add(mountFloor);

  // -------------------------------------------------------------------------
  // 1. CUTAWAY GLASS PERFUME BOTTLE, ANODIZED COLLAR & AMBER LIQUID (reservoir)
  // -------------------------------------------------------------------------
  const reservoirPart = new THREE.Group();
  reservoirPart.name = "part_reservoir";
  reservoirPart.position.x = AXIS_X;

  // Sleek anodized matte-graphite base pad anchoring bottle solidly to floor y = -2.42
  reservoirPart.add(
    verticalCutaway({
      x0: -2.42,
      length: 0.08,
      rOuter: 1.03,
      rInner: 0.84,
      openDeg: OPEN_VERT,
      startDeg: VERT_START_DEG,
      tone: "graphite",
      roughness: 0.54,
      metalness: 0.28,
      segments: 48,
    }),
  );

  // Translucent frosted-glass cutaway perfume bottle (y = -2.35 .. -0.38)
  const bottle = glassVessel({
    y0: -2.35,
    height: 1.55,
    rOuter: 1.08,
    rInner: 0.94,
    neckHeight: 0.42,
    neckROuter: 0.42,
    neckRInner: 0.3,
    baseThick: 0.14,
    openDeg: OPEN_VERT,
    opacity: 0.32,
    segments: 52,
  });
  reservoirPart.add(bottle);

  // Machined anodized crimp collar solidly clamping bottle neck to Venturi head
  reservoirPart.add(
    verticalCutaway({
      x0: -0.62,
      length: 0.34,
      rOuter: 0.5,
      rInner: 0.31,
      openDeg: OPEN_VERT,
      startDeg: VERT_START_DEG,
      tone: "graphite",
      roughness: 0.46,
      metalness: 0.34,
      segments: 48,
    }),
  );

  // Upper chamfered collar flange lip (y = -0.32 .. -0.24)
  reservoirPart.add(
    verticalCutaway({
      x0: -0.32,
      length: 0.09,
      rOuter: 0.45,
      rInner: 0.28,
      rOuterEnd: 0.38,
      rInnerEnd: 0.26,
      openDeg: OPEN_VERT,
      startDeg: VERT_START_DEG,
      tone: "clayDark",
      roughness: 0.54,
      metalness: 0.22,
      segments: 48,
    }),
  );

  // Warm amber perfume liquid column inside the bottle (y = -2.20 .. -1.24)
  const amberLiquid = liquidVolume({
    y0: -2.2,
    height: 0.96,
    radius: 0.91,
    openDeg: OPEN_VERT,
    color: "gold",
    opacity: 0.78,
    segments: 48,
  });
  reservoirPart.add(amberLiquid);

  stage.registerPart("reservoir", reservoirPart, {
    anchor: [AXIS_X - 0.62, -1.24, 0.52],
    accent: "gold",
  });

  // -------------------------------------------------------------------------
  // 2. VERTICAL DIP TUBE & STAINLESS CHECK BALL (dip_tube)
  // -------------------------------------------------------------------------
  const dipTubePart = new THREE.Group();
  dipTubePart.name = "part_dip_tube";
  dipTubePart.position.x = AXIS_X;

  // Vertical cutaway dip tube running from bottom of bottle (y=-2.14) up into Venturi throat (y=+0.54)
  dipTubePart.add(
    verticalCutaway({
      x0: -2.14,
      length: 2.68,
      rOuter: 0.13,
      rInner: 0.085,
      openDeg: 120,
      tone: "clayLight",
      roughness: 0.64,
      metalness: 0.12,
      segments: 36,
    }),
  );

  // Flared intake foot ring at bottom of dip tube
  dipTubePart.add(
    verticalCutaway({
      x0: -2.16,
      length: 0.1,
      rOuter: 0.165,
      rInner: 0.085,
      rOuterEnd: 0.132,
      rInnerEnd: 0.085,
      openDeg: 120,
      tone: "clayDark",
      roughness: 0.52,
      metalness: 0.26,
      segments: 32,
    }),
  );

  // Check-ball valve seat collar inside lower dip tube
  dipTubePart.add(
    verticalCutaway({
      x0: -1.52,
      length: 0.07,
      rOuter: 0.142,
      rInner: 0.068,
      openDeg: 120,
      tone: "graphite",
      roughness: 0.44,
      metalness: 0.34,
      segments: 28,
    }),
  );

  // Machined stainless steel check-ball inside the cutaway tube (lifts live with suction!)
  const checkBallGeo = new THREE.SphereGeometry(0.068, 20, 16);
  const checkBallMat = createClayMaterial("graphite", {
    roughness: 0.26,
    metalness: 0.52,
  });
  const checkBall = new THREE.Mesh(checkBallGeo, checkBallMat);
  checkBall.name = "dip_tube_checkBall";
  checkBall.position.set(0, -1.42, 0);
  checkBall.castShadow = true;
  checkBall.receiveShadow = true;
  addArchitecturalEdges(checkBall, 28);
  dipTubePart.add(checkBall);

  stage.registerPart("dip_tube", dipTubePart, {
    anchor: [AXIS_X, -0.82, 0.11],
    accent: "teal",
  });

  // -------------------------------------------------------------------------
  // 2b. LIVE RISING PERFUME LIQUID DROPLETS INSIDE DIP TUBE (liquid_rise)
  // -------------------------------------------------------------------------
  const liquidRisePart = new THREE.Group();
  liquidRisePart.name = "part_liquid_rise";
  // Pivot at bottom of dip tube (y = -2.06) so partial-lift stall scales cleanly from bottom!
  const liquidRisePivot = new THREE.Group();
  liquidRisePivot.name = "liquid_rise_pivot";
  liquidRisePivot.position.set(AXIS_X, -2.06, 0);
  liquidRisePart.add(liquidRisePivot);

  const liquidRise = flowRibbon({
    curves: [
      [
        [-0.022, 0.0, 0.01],
        [-0.022, 1.31, 0.012],
        [-0.022, 2.62, 0.01],
      ],
      [
        [0.022, 0.0, -0.01],
        [0.022, 1.31, -0.012],
        [0.022, 2.62, -0.01],
      ],
    ],
    radius: 0.021,
    color: "gold",
    speed: 0.54,
    particleCount: 24,
    opacity: 0.52,
    swirlAmp: 0.008,
    swirlFreq: 2.0,
  });
  liquidRisePivot.add(liquidRise.group);

  stage.registerPart("liquid_rise", liquidRisePart, {
    anchor: [AXIS_X + 0.04, -0.22, 0.18],
    accent: "gold",
  });

  // -------------------------------------------------------------------------
  // 3. HORIZONTAL CUTAWAY VENTURI BARREL, NOZZLE & MOUNTING NECK (venturi_throat)
  // -------------------------------------------------------------------------
  const venturiPart = new THREE.Group();
  venturiPart.name = "part_venturi_throat";

  const barrelGroup = new THREE.Group();
  barrelGroup.name = "venturi_barrel";
  barrelGroup.position.y = BARREL_Y;
  venturiPart.add(barrelGroup);

  // Rear machined air-cylinder cap ring (plunger rod passes cleanly through center bore)
  barrelGroup.add(
    cutawayCylinder({
      x0: -2.41,
      length: 0.08,
      rOuter: 0.65,
      rInner: 0.16,
      openDeg: OPEN_HORIZ,
      tone: "graphite",
      roughness: 0.46,
      metalness: 0.34,
      segments: 48,
    }),
  );

  // Left Air Pump Cylinder (x = -2.35 .. -0.95)
  barrelGroup.add(
    cutawayCylinder({
      x0: -2.35,
      length: 1.4,
      rOuter: 0.62,
      rInner: 0.48,
      openDeg: OPEN_HORIZ,
      tone: "clayLight",
      roughness: 0.72,
      metalness: 0.08,
      segments: 52,
    }),
  );

  // Converging Inlet Cone (x = -0.95 .. -0.05)
  barrelGroup.add(
    cutawayCylinder({
      x0: -0.95,
      length: 0.9,
      rOuter: 0.62,
      rInner: 0.48,
      rOuterEnd: 0.38,
      rInnerEnd: 0.19,
      openDeg: OPEN_HORIZ,
      tone: "clayLight",
      roughness: 0.7,
      metalness: 0.08,
      segments: 52,
    }),
  );

  // Pinched Venturi Throat (x = -0.05 .. +0.55) — outer housing + morphable throat bore!
  const throatMorph = new THREE.Group();
  throatMorph.name = "venturi_throat_morph";
  barrelGroup.add(throatMorph);

  throatMorph.add(
    cutawayCylinder({
      x0: -0.05,
      length: 0.6,
      rOuter: 0.38,
      rInner: 0.19,
      openDeg: OPEN_HORIZ,
      tone: "clayMid",
      roughness: 0.62,
      metalness: 0.16,
      segments: 48,
    }),
  );

  // Precision machined internal throat orifice liner ring (visibly pinches at 0.4 mm!)
  const throatInsert = new THREE.Group();
  throatInsert.name = "venturi_throat_insert";
  throatInsert.add(
    cutawayCylinder({
      x0: 0.04,
      length: 0.42,
      rOuter: 0.21,
      rInner: 0.145,
      openDeg: OPEN_HORIZ,
      tone: "clayDark",
      roughness: 0.5,
      metalness: 0.26,
      segments: 44,
    }),
  );
  barrelGroup.add(throatInsert);

  // Diverging Exit Diffuser / Spray Nozzle (x = +0.55 .. +1.55)
  barrelGroup.add(
    cutawayCylinder({
      x0: 0.55,
      length: 1.0,
      rOuter: 0.38,
      rInner: 0.19,
      rOuterEnd: 0.46,
      rInnerEnd: 0.3,
      openDeg: OPEN_HORIZ,
      tone: "graphite",
      roughness: 0.48,
      metalness: 0.3,
      segments: 52,
    }),
  );

  // Chamfered nozzle exit bezel ring (x = +1.52 .. +1.60)
  barrelGroup.add(
    cutawayCylinder({
      x0: 1.52,
      length: 0.08,
      rOuter: 0.49,
      rInner: 0.3,
      rOuterEnd: 0.45,
      rInnerEnd: 0.31,
      openDeg: OPEN_HORIZ,
      tone: "clayDark",
      roughness: 0.5,
      metalness: 0.26,
      segments: 48,
    }),
  );

  // Structural Mounting Collar Neck joining Venturi barrel underside cleanly into bottle collar (ZERO floating gaps!)
  const mountingNeck = verticalCutaway({
    x0: -0.34,
    length: 0.62, // spans y = -0.34 (inside collar) to y = +0.28 (inside throat wall y = 0.20..0.38)
    rOuter: 0.32,
    rInner: 0.145,
    rOuterEnd: 0.27,
    rInnerEnd: 0.138,
    openDeg: OPEN_VERT,
    startDeg: VERT_START_DEG,
    tone: "clayMid",
    roughness: 0.64,
    metalness: 0.16,
    segments: 44,
  });
  mountingNeck.position.x = AXIS_X;
  venturiPart.add(mountingNeck);

  stage.registerPart("venturi_throat", venturiPart, {
    anchor: [AXIS_X, BARREL_Y + 0.46, 0.24],
    accent: "orange",
  });

  // -------------------------------------------------------------------------
  // 4. MACHINED 3D AIR PLUNGER & HELICAL SPRING (air_pump)
  // -------------------------------------------------------------------------
  const airPumpPart = new THREE.Group();
  airPumpPart.name = "part_air_pump";
  airPumpPart.position.set(-1.42, BARREL_Y, 0);

  const plunger = pistonPlunger({
    r: 0.45,
    headLength: 0.28,
    rodLength: 0.85,
    springTurns: 6,
    axis: "x",
    tone: "clayDark",
    rodTone: "graphite",
  });
  airPumpPart.add(plunger.group);

  stage.registerPart("air_pump", airPumpPart, {
    anchor: [-1.52, BARREL_Y + 0.58, 0.32],
    accent: "orange",
  });

  // -------------------------------------------------------------------------
  // 5. LIVE 3D VENTURI AIRFLOW STREAMLINES & LOW-PRESSURE POCKET
  // -------------------------------------------------------------------------
  const airflowPart = new THREE.Group();
  airflowPart.name = "part_airflow_streamlines";
  const airflow = flowRibbon({
    curves: buildAirflowCurves(),
    radius: 0.02,
    color: "cobalt",
    speed: 0.72,
    particleCount: 40,
    opacity: 0.34,
    swirlAmp: 0.012,
    swirlFreq: 2.6,
  });
  airflowPart.add(airflow.group);

  stage.registerPart("airflow_streamlines", airflowPart, {
    anchor: [-0.62, BARREL_Y + 0.36, 0.24],
    accent: "cobalt",
  });

  const pressurePocket = buildPressurePocketMesh();
  stage.registerPart("pressure_pocket", pressurePocket, {
    anchor: [AXIS_X, BARREL_Y + 0.05, 0.22],
    accent: "cobalt",
  });

  // -------------------------------------------------------------------------
  // 6. LIVE 3D ATOMIZED MIST SPRAY CONE (mist_plume)
  // -------------------------------------------------------------------------
  const mistPlume = mistCone({
    origin: [1.54, BARREL_Y, 0],
    length: 2.35,
    startRadius: 0.08,
    endRadius: 0.92,
    count: 110,
    color: "orange",
    speed: 0.95,
    dropletRadius: 0.044,
    opacity: 0.78,
  });

  stage.registerPart("mist_plume", mistPlume.group, {
    anchor: [2.48, BARREL_Y + 0.04, 0.08],
    accent: "orange",
  });

  // Live animation state
  let currentNozzleMm = 0.4;
  let currentLiftScale = 1.0;
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
      const safeDt = Number.isFinite(dt) ? clamp(dt, 0, 0.1) : 0.016;
      elapsed += safeDt;

      const pumpSpeedPct = Number(sim.pumpSpeedPct ?? params.pumpSpeedPct ?? 72);
      const nozzleWidthMm = clamp(
        Number(sim.nozzleWidthMm ?? params.nozzleWidthMm ?? 0.4),
        0.3,
        1.2,
      );
      const airSpeedMs = Number(sim.airSpeedMs ?? 69);
      const pressureDropKpa = Number(sim.pressureDropKpa ?? 2.9);
      const liftRatio = Number(sim.liftRatio ?? 4.5);
      const dropletSizeUm = Number(sim.dropletSizeUm ?? 35);
      const isLifting = liftRatio >= 1.0;

      // 1. Smoothly morph Venturi throat aperture when nozzleWidthMm changes (0.4 mm ↔ 1.1 mm)
      const morphEase = safeDt > 0 ? 1 - Math.exp(-safeDt * 8.0) : 1;
      currentNozzleMm += (nozzleWidthMm - currentNozzleMm) * morphEase;
      const nozzleFrac = clamp((currentNozzleMm - 0.3) / 0.9, 0, 1);

      // Subtle outer throat morph + dramatic inner orifice sleeve pinch
      const outerThroatScale = 0.92 + nozzleFrac * 0.24;
      throatMorph.scale.set(1, outerThroatScale, outerThroatScale);
      const insertScale = 0.84 + nozzleFrac * 0.44;
      throatInsert.scale.set(1, insertScale, insertScale);

      // 2. Smooth oscillating air plunger stroke driven by pumpSpeedPct
      const pumpFreq = 1.6 + (pumpSpeedPct / 100) * 3.2;
      const strokeAmp = 0.12 + (pumpSpeedPct / 100) * 0.2;
      const strokePhase = Math.sin(elapsed * pumpFreq) * 0.5 + 0.5;
      plunger.setStroke(strokePhase * strokeAmp);

      // 3. Check-ball vertical lift + rising golden liquid column inside dip tube
      const targetLiftScale = isLifting ? 1.0 : clamp(liftRatio * 0.85, 0.16, 0.84);
      currentLiftScale += (targetLiftScale - currentLiftScale) * morphEase;
      liquidRisePivot.scale.set(1, currentLiftScale, 1);

      const ballLift = isLifting
        ? 0.1 + clamp(liftRatio * 0.025, 0, 0.14) + Math.sin(elapsed * 7.5) * 0.012
        : clamp(liftRatio * 0.05, 0, 0.045);
      checkBall.position.y = -1.42 + ballLift;

      liquidRise.update(safeDt, {
        speedScale: isLifting ? 0.55 + clamp(liftRatio * 0.2, 0, 1.35) : 0.14,
        opacityScale: isLifting ? 1.05 : 0.42,
        radiusScale: isLifting ? 1.05 : 0.78,
      });

      // Subtle breathing ripple on amber bottle meniscus
      const meniscus = amberLiquid.userData.meniscusMesh;
      if (meniscus) {
        meniscus.position.y =
          Math.sin(elapsed * 3.1) * (isLifting ? 0.01 : 0.003);
      }

      // 4. Venturi airflow streamlines accelerating through the throat
      const airNorm = clamp(airSpeedMs / 75, 0.25, 1.85);
      airflow.update(safeDt, {
        speedScale: 0.6 + airNorm * 1.05,
        opacityScale: 0.55 + clamp(airNorm * 0.45, 0, 0.7),
        radiusScale: 0.8 + (1 - nozzleFrac) * 0.28,
        colorHex: pressureDropKpa >= 2.6 ? ACCENT_TOKENS.cobalt : 0x3b82f6,
      });

      // 5. Glowing cobalt Bernoulli low-pressure suction pocket inside throat
      const pNorm = clamp(pressureDropKpa / 3.8, 0.12, 1.35);
      const pulse = 0.92 + 0.12 * Math.sin(elapsed * 6.5);
      const coreMesh = pressurePocket.userData.coreMesh;
      const heartMesh = pressurePocket.userData.heartMesh;
      const rings = pressurePocket.userData.rings || [];
      if (coreMesh && coreMesh.material) {
        coreMesh.scale.set(0.85 + 0.25 * pNorm, (0.78 + 0.34 * pNorm) * pulse, (0.78 + 0.34 * pNorm) * pulse);
        coreMesh.material.emissiveIntensity = (0.7 + 1.35 * pNorm) * pulse;
        coreMesh.material.userData.baseOpacity = clamp(0.18 + 0.32 * pNorm, 0.15, 0.58);
      }
      if (heartMesh && heartMesh.material) {
        const hs = (0.72 + 0.42 * pNorm) * pulse;
        heartMesh.scale.set(1.65 * hs, 0.92 * hs, 0.92 * hs);
        heartMesh.material.emissiveIntensity = (0.9 + 1.6 * pNorm) * pulse;
      }
      for (let i = 0; i < rings.length; i++) {
        const ring = rings[i];
        const rPulse = 0.9 + 0.18 * Math.sin(elapsed * 7.2 - i * 1.1);
        ring.scale.setScalar((0.82 + 0.26 * pNorm) * rPulse);
      }

      // 6. Live 3D Atomized Mist Spray Cone (weightless micro-mist vs heavy coarse droplets!)
      const fineNorm = clamp((95 - dropletSizeUm) / 68, 0, 1); // 1 = ultra-fine mist (<30 µm), 0 = coarse jet
      const mistColor = !isLifting
        ? ACCENT_TOKENS.cobalt
        : dropletSizeUm < 35
          ? ACCENT_TOKENS.teal
          : dropletSizeUm < 65
            ? ACCENT_TOKENS.orange
            : ACCENT_TOKENS.gold;

      mistPlume.update(safeDt, {
        speedScale: isLifting ? 0.58 + clamp(airSpeedMs / 82, 0.2, 1.35) : 0.38,
        dropletScale: isLifting
          ? clamp(0.56 + ((dropletSizeUm - 22) / 72) * 1.05, 0.52, 1.68)
          : 0.42,
        spreadScale: isLifting ? 0.5 + fineNorm * 0.74 : 0.38,
        opacityScale: isLifting ? 0.82 + fineNorm * 0.32 : 0.16,
        gravitySag: isLifting ? (1 - fineNorm) * 0.42 : 0.04,
        colorHex: mistColor,
      });

      stage.render(safeDt);
    },
  };
}

globalThis.STUDIO_SCENE = { mount };
