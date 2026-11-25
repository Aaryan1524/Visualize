import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  ACCENT_TOKENS,
  MONOCHROME_TOKENS,
  addArchitecturalEdges,
  airVolume,
  baseMount,
  bladeRing,
  boxPlate,
  buildCutawayCylinderGeometry,
  buildGlassVesselGeometry,
  buildLiquidVolumeGeometry,
  combustorRing,
  cutawayCylinder,
  flowRibbon,
  gasVolume,
  gear,
  glassVessel,
  jetPlume,
  liquidVolume,
  mistCone,
  pipe,
  pistonPlunger,
  projectObjectAnchor,
  shaft,
  spring,
} from "./engine-a.ts";

function assertGeometryClean(geo: THREE.BufferGeometry, label: string): void {
  const pos = geo.getAttribute("position");
  assert.ok(pos && pos.count > 0, `${label}: position attribute must be non-empty`);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    assert.ok(
      Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z),
      `${label}: vertex ${i} has non-finite position (${x}, ${y}, ${z})`,
    );
  }

  const norm = geo.getAttribute("normal");
  if (norm) {
    assert.equal(norm.count, pos.count, `${label}: normal count matches position count`);
    for (let i = 0; i < norm.count; i++) {
      const nx = norm.getX(i);
      const ny = norm.getY(i);
      const nz = norm.getZ(i);
      const len = Math.hypot(nx, ny, nz);
      assert.ok(
        Number.isFinite(len) && len > 0.5 && len < 1.5,
        `${label}: normal ${i} must be unit-length, got ${len}`,
      );
    }
  }
}

function assertGroupMeshesClean(group: THREE.Object3D, label: string): number {
  let meshCount = 0;
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      meshCount++;
      assertGeometryClean(child.geometry, `${label}/${child.name || meshCount}`);
    }
  });
  assert.ok(meshCount > 0, `${label}: expected at least one Mesh`);
  return meshCount;
}

function assertWatertightAndOutward(geo: THREE.BufferGeometry, label: string): void {
  const index = geo.getIndex();
  assert.ok(index && index.count > 0 && index.count % 3 === 0, `${label}: must be indexed triangles`);

  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const norm = geo.getAttribute("normal") as THREE.BufferAttribute;
  assert.ok(norm, `${label}: must have normals`);

  const quantize = (i: number): string => {
    const x = Math.round(pos.getX(i) * 1e4);
    const y = Math.round(pos.getY(i) * 1e4);
    const z = Math.round(pos.getZ(i) * 1e4);
    return `${x},${y},${z}`;
  };

  const edgeCounts = new Map<string, number>();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const triN = new THREE.Vector3();
  const avgVN = new THREE.Vector3();

  for (let t = 0; t < index.count; t += 3) {
    const i0 = index.getX(t);
    const i1 = index.getX(t + 1);
    const i2 = index.getX(t + 2);

    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    triN.crossVectors(ab, ac);
    assert.ok(triN.lengthSq() > 1e-12, `${label}: degenerate triangle at ${t / 3}`);
    triN.normalize();

    avgVN.set(
      norm.getX(i0) + norm.getX(i1) + norm.getX(i2),
      norm.getY(i0) + norm.getY(i1) + norm.getY(i2),
      norm.getZ(i0) + norm.getZ(i1) + norm.getZ(i2),
    ).normalize();

    assert.ok(
      triN.dot(avgVN) > 0.7,
      `${label}: triangle ${t / 3} winding disagrees with vertex normals (dot=${triN.dot(avgVN)})`,
    );

    const k0 = quantize(i0);
    const k1 = quantize(i1);
    const k2 = quantize(i2);
    const pairs: [string, string][] = [
      [k0, k1],
      [k1, k2],
      [k2, k0],
    ];
    for (const [u, v] of pairs) {
      const key = u < v ? `${u}|${v}` : `${v}|${u}`;
      edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
    }
  }

  for (const [edge, count] of edgeCounts.entries()) {
    assert.equal(
      count,
      2,
      `${label}: edge ${edge} shared by ${count} triangles (expected 2 for watertight manifold)`,
    );
  }
}

describe("Engine A — Color Lock Tokens", () => {
  it("enforces strictly 4 monochrome tokens and 5 semantic accents", () => {
    assert.deepEqual(Object.keys(MONOCHROME_TOKENS), [
      "clayLight",
      "clayMid",
      "clayDark",
      "graphite",
    ]);
    assert.equal(MONOCHROME_TOKENS.clayLight, 0xf1f0ea);
    assert.equal(MONOCHROME_TOKENS.clayMid, 0xd6d4cc);
    assert.equal(MONOCHROME_TOKENS.clayDark, 0x9b9991);
    assert.equal(MONOCHROME_TOKENS.graphite, 0x4b4e54);

    assert.deepEqual(Object.keys(ACCENT_TOKENS), [
      "orange",
      "cobalt",
      "ember",
      "teal",
      "gold",
    ]);
    assert.equal(ACCENT_TOKENS.orange, 0xe05a1e);
    assert.equal(ACCENT_TOKENS.cobalt, 0x2563eb);
    assert.equal(ACCENT_TOKENS.ember, 0xef4444);
    assert.equal(ACCENT_TOKENS.teal, 0x0d9488);
    assert.equal(ACCENT_TOKENS.gold, 0xd69624);
  });
});

describe("Engine A — cutawayCylinder", () => {
  it("builds watertight indexed BufferGeometry for straight cutaway cylinder", () => {
    const geo = buildCutawayCylinderGeometry({
      length: 3.2,
      rOuter: 1.4,
      rInner: 1.22,
      openDeg: 135,
      segments: 32,
    });
    assertGeometryClean(geo, "cutawayCylinder-straight");
    assertWatertightAndOutward(geo, "cutawayCylinder-straight");
  });

  it("builds watertight indexed BufferGeometry for tapered cutaway cone", () => {
    const geo = buildCutawayCylinderGeometry({
      length: 2.6,
      rOuter: 1.45,
      rInner: 1.25,
      rOuterEnd: 0.92,
      rInnerEnd: 0.74,
      openDeg: 120,
      x0: 0.4,
      segments: 36,
    });
    assertGeometryClean(geo, "cutawayCylinder-tapered");
    assertWatertightAndOutward(geo, "cutawayCylinder-tapered");
  });

  it("builds watertight indexed BufferGeometry for closed 360° hollow cylinder", () => {
    const geo = buildCutawayCylinderGeometry({
      length: 1.8,
      rOuter: 1.1,
      rInner: 0.85,
      openDeg: 0,
      segments: 24,
    });
    assertGeometryClean(geo, "cutawayCylinder-closed");
    assertWatertightAndOutward(geo, "cutawayCylinder-closed");
  });

  it("attaches crisp architectural EdgesGeometry contour lines", () => {
    const group = cutawayCylinder({
      length: 2.4,
      rOuter: 1.2,
      rInner: 1.0,
      openDeg: 135,
    });
    assertGroupMeshesClean(group, "cutawayCylinder");
    const shell = group.userData.shellMesh as THREE.Mesh;
    assert.ok(shell instanceof THREE.Mesh);
    const edgeChild = shell.children.find(
      (c) => c instanceof THREE.LineSegments && c.userData.isArchitecturalEdge,
    );
    assert.ok(edgeChild, "cutawayCylinder shell must have architectural edge lines");
  });

  it("supports axis: 'y' and axis: 'z' with watertight outward geometry oriented along the chosen axis", () => {
    const geoY = buildCutawayCylinderGeometry({
      length: 3.0,
      rOuter: 1.0,
      rInner: 0.82,
      openDeg: 132,
      axis: "y",
      segments: 32,
    });
    assertGeometryClean(geoY, "cutawayCylinder-axisY");
    assertWatertightAndOutward(geoY, "cutawayCylinder-axisY");
    const boxY = geoY.boundingBox!;
    const sizeY = new THREE.Vector3();
    boxY.getSize(sizeY);
    assert.ok(Math.abs(sizeY.y - 3.0) < 1e-3, `expected Y length ~3.0, got ${sizeY.y}`);
    assert.ok(sizeY.x <= 2.01 && sizeY.z <= 2.01);

    const cylY = cutawayCylinder({ length: 2.4, rOuter: 0.9, rInner: 0.72, axis: "y" });
    assertGroupMeshesClean(cylY, "cutawayCylinder-group-axisY");

    const geoZ = buildCutawayCylinderGeometry({
      length: 2.6,
      rOuter: 0.8,
      rInner: 0.64,
      openDeg: 120,
      axis: "z",
      segments: 28,
    });
    assertGeometryClean(geoZ, "cutawayCylinder-axisZ");
    assertWatertightAndOutward(geoZ, "cutawayCylinder-axisZ");
    const sizeZ = new THREE.Vector3();
    geoZ.boundingBox!.getSize(sizeZ);
    assert.ok(Math.abs(sizeZ.z - 2.6) < 1e-3, `expected Z length ~2.6, got ${sizeZ.z}`);
  });
});

describe("Engine A — bladeRing", () => {
  it("creates exact blade count + hub + optional spinner cone with zero NaN", () => {
    const fanWithSpinner = bladeRing({
      rHub: 0.36,
      rTip: 1.28,
      blades: 18,
      twistDeg: 34,
      noseLen: 0.55,
      x: -2.0,
    });

    assert.equal(fanWithSpinner.position.x, -2.0);
    const bladeMeshes = fanWithSpinner.userData.bladeMeshes as THREE.Mesh[];
    assert.equal(bladeMeshes.length, 18);
    assert.ok(fanWithSpinner.userData.hubMesh instanceof THREE.Mesh);
    assert.ok(fanWithSpinner.userData.spinnerMesh instanceof THREE.Mesh);
    assertGroupMeshesClean(fanWithSpinner, "bladeRing-with-spinner");

    const compressorStage = bladeRing({
      rHub: 0.32,
      rTip: 0.72,
      blades: 12,
      x: -0.4,
    });
    assert.equal((compressorStage.userData.bladeMeshes as THREE.Mesh[]).length, 12);
    assert.equal(compressorStage.userData.spinnerMesh, null);
    assertGroupMeshesClean(compressorStage, "bladeRing-no-spinner");
  });
});

describe("Engine A — Mechanical & Studio Primitives", () => {
  it("constructs combustorRing with liners, cans, and flameMeshes", () => {
    const combustor = combustorRing({
      rInner: 0.42,
      rOuter: 0.86,
      length: 1.1,
      cans: 8,
      x: 0.6,
    });
    assert.equal(combustor.position.x, 0.6);
    const flames = combustor.userData.flameMeshes as THREE.Mesh[];
    assert.equal(flames.length, 8);
    for (const flame of flames) {
      assert.ok(flame instanceof THREE.Mesh);
      assert.equal(flame.userData.isFlame, true);
    }
    assertGroupMeshesClean(combustor, "combustorRing");
  });

  it("constructs shaft, pipe, spring, gear, and baseMount cleanly", () => {
    const s = shaft({ length: 4.4, r: 0.14, x0: -2.1 });
    assertGroupMeshesClean(s, "shaft");

    const p = pipe({
      points: [
        [-1.2, 0.9, 0.2],
        [-0.2, 1.15, 0.4],
        [0.9, 0.85, 0.15],
      ],
      r: 0.055,
    });
    assertGroupMeshesClean(p, "pipe");

    const sp = spring({ r: 0.25, length: 1.4, turns: 6, axis: "x" });
    assertGroupMeshesClean(sp, "spring");

    const g = gear({ teeth: 16, module: 0.08, thickness: 0.22, boreR: 0.2, axis: "x" });
    assertGroupMeshesClean(g, "gear");

    const mount = baseMount({ y: -1.8, radius: 5.5 });
    assertGroupMeshesClean(mount, "baseMount");
    assert.ok(mount.userData.shadowMaterial instanceof THREE.ShadowMaterial);
    assert.ok(mount.userData.ringMaterial instanceof THREE.LineBasicMaterial);
  });

  it("attaches architectural edges to arbitrary custom meshes via addArchitecturalEdges", () => {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const edges = addArchitecturalEdges(box, 18);
    assert.ok(edges instanceof THREE.LineSegments);
    assert.equal(edges.parent, box);
    assert.equal(edges.userData.isArchitecturalEdge, true);
  });
});

describe("Engine A — flowRibbon", () => {
  it("constructs streamlines and advances instanced particle matrices cleanly on update", () => {
    const ribbon = flowRibbon({
      curves: [
        [
          [-2.8, 0.95, 0.1],
          [-1.0, 1.05, 0.15],
          [1.2, 0.95, 0.1],
          [3.0, 0.8, 0.05],
        ],
        [
          [-2.8, -0.95, 0.1],
          [-1.0, -1.05, 0.15],
          [1.2, -0.95, 0.1],
          [3.0, -0.8, 0.05],
        ],
      ],
      radius: 0.032,
      color: "cobalt",
      speed: 0.6,
      particleCount: 20,
      opacity: 0.3,
    });

    assertGroupMeshesClean(ribbon.group, "flowRibbon");
    const instanced = ribbon.group.userData.instancedMesh as THREE.InstancedMesh;
    assert.ok(instanced instanceof THREE.InstancedMesh);
    assert.equal(instanced.count, 20);

    const before = new THREE.Matrix4();
    const after = new THREE.Matrix4();
    instanced.getMatrixAt(0, before);

    ribbon.update(0.016, {
      speedScale: 2,
      opacityScale: 0.85,
      radiusScale: 1.15,
      colorHex: ACCENT_TOKENS.orange,
    });

    instanced.getMatrixAt(0, after);
    assert.notDeepEqual(
      Array.from(before.elements),
      Array.from(after.elements),
      "instanced particle matrix must advance after update(0.016)",
    );

    // Every instanced particle matrix must be finite and non-zero
    const m = new THREE.Matrix4();
    for (let i = 0; i < instanced.count; i++) {
      instanced.getMatrixAt(i, m);
      for (const v of m.elements) {
        assert.ok(Number.isFinite(v), `particle ${i} matrix has non-finite value`);
      }
      assert.ok(m.determinant() > 1e-12, `particle ${i} matrix must be non-degenerate`);
    }
  });
});

describe("Engine A — Fluid, Glass & Aerosol Primitives", () => {
  it("glassVessel constructs watertight cutaway geometry with architectural edges and zero NaN", () => {
    const geo = buildGlassVesselGeometry({
      y0: -2.35,
      height: 1.55,
      rOuter: 1.08,
      rInner: 0.94,
      neckHeight: 0.42,
      neckROuter: 0.42,
      neckRInner: 0.3,
      openDeg: 132,
      segments: 32,
    });
    assertGeometryClean(geo, "glassVessel-bottle");
    assertWatertightAndOutward(geo, "glassVessel-bottle");

    const vessel = glassVessel({
      y0: -2.35,
      height: 1.55,
      rOuter: 1.08,
      rInner: 0.94,
      neckHeight: 0.42,
      neckROuter: 0.42,
      neckRInner: 0.3,
      openDeg: 132,
      opacity: 0.32,
    });
    assertGroupMeshesClean(vessel, "glassVessel");
    const shell = vessel.userData.shellMesh as THREE.Mesh;
    assert.ok(shell instanceof THREE.Mesh);
    assert.equal(shell.userData.isGlass, true);
    const edgeChild = shell.children.find(
      (c) => c instanceof THREE.LineSegments && c.userData.isArchitecturalEdge,
    );
    assert.ok(edgeChild, "glassVessel shell must have architectural edge lines");

    const horiz = glassVessel({
      height: 1.2,
      rOuter: 0.6,
      rInner: 0.5,
      axis: "x",
    });
    assertGroupMeshesClean(horiz, "glassVessel-axisX");
  });

  it("liquidVolume constructs watertight cutaway liquid solid and meniscus with zero NaN", () => {
    const geo = buildLiquidVolumeGeometry({
      y0: -2.2,
      height: 0.96,
      radius: 0.91,
      openDeg: 132,
      segments: 32,
    });
    assertGeometryClean(geo, "liquidVolume-solid");
    assertWatertightAndOutward(geo, "liquidVolume-solid");

    const liq = liquidVolume({
      y0: -2.2,
      height: 0.96,
      radius: 0.91,
      openDeg: 132,
      color: "gold",
      opacity: 0.78,
    });
    assertGroupMeshesClean(liq, "liquidVolume");
    const liquidMesh = liq.userData.liquidMesh as THREE.Mesh;
    assert.ok(liquidMesh instanceof THREE.Mesh);
    assert.equal(liquidMesh.userData.isLiquid, true);
    assert.ok(liq.userData.meniscusMesh instanceof THREE.Mesh);
  });

  it("pistonPlunger slides head/rod cleanly via setStroke() and compresses spring", () => {
    const plunger = pistonPlunger({
      r: 0.45,
      headLength: 0.28,
      rodLength: 0.85,
      springTurns: 6,
      axis: "x",
      tone: "clayDark",
      rodTone: "graphite",
    });
    assertGroupMeshesClean(plunger.group, "pistonPlunger-x");

    const moving = plunger.group.userData.movingGroup as THREE.Group;
    const springObj = plunger.group.userData.springGroup as THREE.Group;
    assert.equal(moving.position.x, 0);
    assert.equal(springObj.scale.x, 1);

    plunger.setStroke(0.24);
    assert.equal(moving.position.x, 0.24);
    assert.ok(
      springObj.scale.x < 0.9 && springObj.scale.x > 0.2,
      `expected spring to compress cleanly, got scale.x=${springObj.scale.x}`,
    );

    plunger.setStroke(0);
    assert.equal(moving.position.x, 0);
    assert.ok(Math.abs(springObj.scale.x - 1) < 1e-6);

    const vertPlunger = pistonPlunger({ r: 0.32, axis: "y" });
    assertGroupMeshesClean(vertPlunger.group, "pistonPlunger-y");

    const icPiston = pistonPlunger({
      r: 0.42,
      headLength: 0.32,
      rodLength: 1.1,
      axis: "y",
      withSpring: false,
    });
    assertGroupMeshesClean(icPiston.group, "pistonPlunger-noSpring");
    assert.equal(icPiston.group.userData.springGroup, null);
    assert.equal(icPiston.group.getObjectByName("pistonPlunger_spring"), undefined);
    assert.ok(icPiston.group.getObjectByName("pistonPlunger_wristPin"));
    icPiston.setStroke(-0.4);
    assert.equal((icPiston.group.userData.movingGroup as THREE.Group).position.x, -0.4);
  });

  it("boxPlate constructs crisp architectural plate with edges and exact dimensions", () => {
    const plate = boxPlate({ w: 2.4, h: 0.3, d: 1.6, tone: "clayDark" });
    assertGroupMeshesClean(plate, "boxPlate");
    const mesh = plate.userData.plateMesh as THREE.Mesh;
    assert.ok(mesh instanceof THREE.Mesh);
    const edgeChild = mesh.children.find(
      (c) => c instanceof THREE.LineSegments && c.userData.isArchitecturalEdge,
    );
    assert.ok(edgeChild, "boxPlate must attach architectural edges");
    mesh.geometry.computeBoundingBox();
    const size = new THREE.Vector3();
    mesh.geometry.boundingBox!.getSize(size);
    assert.ok(Math.abs(size.x - 2.4) < 1e-4);
    assert.ok(Math.abs(size.y - 0.3) < 1e-4);
    assert.ok(Math.abs(size.z - 1.6) < 1e-4);
  });

  it("gasVolume dynamically updates height, color, and opacity with isGas flag", () => {
    const gas = gasVolume({
      height: 1.2,
      radius: 0.78,
      y0: 0.2,
      openDeg: 132,
      color: "cobalt",
      opacity: 0.55,
    });
    assertGroupMeshesClean(gas.group, "gasVolume");
    assert.equal(gas.group.userData.isGas, true);

    const mesh = gas.group.userData.gasMesh as THREE.Mesh;
    const scaleGroup = gas.group.userData.scaleGroup as THREE.Group;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    assert.equal(mat.userData.isGas, true);
    assert.equal(scaleGroup.position.y, 0.2);
    assert.equal(scaleGroup.scale.y, 1.2);
    assert.equal(mat.color.getHex(), ACCENT_TOKENS.cobalt);

    gas.setHeight(0.35);
    assert.equal(scaleGroup.scale.y, 0.35);

    gas.setColor("ember");
    assert.equal(mat.color.getHex(), ACCENT_TOKENS.ember);
    assert.equal(mat.emissive.getHex(), ACCENT_TOKENS.ember);

    gas.setColor(0xff5500);
    assert.equal(mat.color.getHex(), 0xff5500);

    gas.setOpacity(0.82);
    assert.equal(mat.opacity, 0.82);
    assert.equal(mat.userData.baseOpacity, 0.82);
  });

  it("projectObjectAnchor tracks moved part.object.position accurately", () => {
    const root = new THREE.Group();
    const piston = new THREE.Group();
    piston.position.set(0, 0, 0);
    root.add(piston);

    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, -50, 50);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    const anchor = new THREE.Vector3(0, 0.5, 0);
    const before = projectObjectAnchor(piston, anchor, camera, 1000, 1000);
    assert.equal(before.visible, true);
    assert.ok(Math.abs(before.x - 500) < 1e-3);
    assert.ok(Math.abs(before.y - 450) < 1e-3, `expected y=450, got ${before.y}`);

    // Move the part upward by +2.0 units -> projected screen Y must shift upward by 200px!
    piston.position.set(0, 2.0, 0);
    const after = projectObjectAnchor(piston, anchor, camera, 1000, 1000);
    assert.equal(after.visible, true);
    assert.ok(Math.abs(after.x - 500) < 1e-3);
    assert.ok(Math.abs(after.y - 250) < 1e-3, `expected y=250 after moving part +2Y, got ${after.y}`);
  });

  it("mistCone builds InstancedMesh with exact count and advances matrices cleanly with zero NaN", () => {
    const mist = mistCone({
      origin: [1.52, 0.58, 0],
      length: 2.35,
      startRadius: 0.08,
      endRadius: 0.92,
      count: 110,
      color: "orange",
      speed: 0.95,
      dropletRadius: 0.044,
    });
    assertGroupMeshesClean(mist.group, "mistCone");

    const instanced = mist.group.userData.instancedMesh as THREE.InstancedMesh;
    assert.ok(instanced instanceof THREE.InstancedMesh);
    assert.equal(instanced.count, 110);

    const before = new THREE.Matrix4();
    const after = new THREE.Matrix4();
    instanced.getMatrixAt(0, before);

    mist.update(0.016, {
      speedScale: 1.25,
      dropletScale: 0.65,
      spreadScale: 1.15,
      opacityScale: 0.92,
      gravitySag: 0.12,
      colorHex: ACCENT_TOKENS.teal,
    });

    instanced.getMatrixAt(0, after);
    assert.notDeepEqual(
      Array.from(before.elements),
      Array.from(after.elements),
      "mistCone droplet matrix must advance after update(0.016)",
    );

    const m = new THREE.Matrix4();
    for (let i = 0; i < instanced.count; i++) {
      instanced.getMatrixAt(i, m);
      for (const v of m.elements) {
        assert.ok(Number.isFinite(v), `mist droplet ${i} matrix has non-finite value`);
      }
      assert.ok(m.determinant() > 1e-12, `mist droplet ${i} matrix must be non-degenerate`);
    }
  });

  it("airVolume builds seamless fBM mist shells and advances Gaussian vapor puffs cleanly", () => {
    const air = airVolume({
      x0: -3.2,
      length: 6.4,
      rInner: 0.9,
      rOuter: 1.5,
      rInnerEnd: 0.75,
      rOuterEnd: 1.2,
      color: "cobalt",
      puffCount: 64,
    });
    assertGroupMeshesClean(air.group, "airVolume");
    assert.equal(air.group.userData.isAirVolume, true);

    const shells = air.group.userData.shellMaterials as THREE.ShaderMaterial[];
    assert.equal(shells.length, 3);
    const points = air.group.userData.points as THREE.Points;
    assert.ok(points instanceof THREE.Points);
    const posAttr = points.geometry.getAttribute("position") as THREE.BufferAttribute;
    assert.equal(posAttr.count, 64);

    const beforeX = posAttr.getX(0);
    air.update(0.05, { speedScale: 1.4, opacityScale: 0.9, darkMode: true });
    const afterX = posAttr.getX(0);
    assert.notEqual(beforeX, afterX, "airVolume vapor puff positions must advance on update");
    assert.equal((shells[0]!.uniforms.uDarkMode as { value: number }).value, 1);
    for (let i = 0; i < posAttr.count; i++) {
      assert.ok(Number.isFinite(posAttr.getX(i)) && Number.isFinite(posAttr.getY(i)) && Number.isFinite(posAttr.getZ(i)));
    }
  });

  it("jetPlume builds volumetric exhaust cones and advances kinetic ember streaks cleanly", () => {
    const jet = jetPlume({
      x0: 1.2,
      length: 2.8,
      rStart: 0.5,
      rEnd: 0.28,
      sparkCount: 32,
      machDiamonds: 4.5,
    });
    assertGroupMeshesClean(jet.group, "jetPlume");
    assert.equal(jet.group.userData.isJetPlume, true);

    const sparks = jet.group.userData.sparksMesh as THREE.InstancedMesh;
    assert.ok(sparks instanceof THREE.InstancedMesh);
    assert.equal(sparks.count, 32);

    const before = new THREE.Matrix4();
    const after = new THREE.Matrix4();
    sparks.getMatrixAt(0, before);

    jet.update(0.03, { speedScale: 1.6, intensity: 1.35, lengthScale: 1.15, darkMode: true });
    sparks.getMatrixAt(0, after);
    assert.notDeepEqual(Array.from(before.elements), Array.from(after.elements));

    const m = new THREE.Matrix4();
    for (let i = 0; i < sparks.count; i++) {
      sparks.getMatrixAt(i, m);
      for (const v of m.elements) {
        assert.ok(Number.isFinite(v), `jetPlume spark ${i} matrix has non-finite value`);
      }
      assert.ok(m.determinant() > 1e-12, `jetPlume spark ${i} matrix must be non-degenerate`);
    }
  });
});
