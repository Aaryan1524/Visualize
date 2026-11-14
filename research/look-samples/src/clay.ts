// Clay: soft matte solids on a warm table, real soft shadows, colour for meaning only.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mount, type Style, type TileState } from "./engine.ts";

const C = {
  tile: new THREE.Color("#f7eee3"),
  mid: new THREE.Color("#e0714c"),
  found: new THREE.Color("#5fa883"),
  gone: new THREE.Color("#d9cbb9"),
  glow: new THREE.Color("#ffb38a"),
};

const style: Style = {
  id: "clay",
  title: "Clay",
  sound: "clay",
  htmlNumbers: true,
  setup(scene, renderer) {
    renderer.toneMappingExposure = 1.05;
    scene.add(new THREE.HemisphereLight("#fff7ec", "#b8a28a", 1.25));
    const sun = new THREE.DirectionalLight("#fff1e0", 2.1);
    sun.position.set(-7, 14, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.radius = 6;
    sun.shadow.bias = -0.0004;
    Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 8, bottom: -8, near: 1, far: 40 });
    scene.add(sun);
    // The table the row stands on: a thick rounded slab of the same clay.
    const slab = new THREE.Mesh(new RoundedBoxGeometry(23.4, 0.7, 3.4, 6, 0.32), new THREE.MeshStandardMaterial({ color: "#ead9c4", roughness: 0.95 }));
    slab.position.y = -0.35;
    slab.receiveShadow = true;
    scene.add(slab);
    // A groove along the front edge, like a pressed line in the clay.
    const groove = new THREE.Mesh(new RoundedBoxGeometry(22.6, 0.06, 0.12, 2, 0.03), new THREE.MeshStandardMaterial({ color: "#d8c3a8", roughness: 1 }));
    groove.position.set(0, 0.0, 1.45);
    scene.add(groove);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.16 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.7;
    floor.receiveShadow = true;
    scene.add(floor);
  },
  tile(_i, _v, x) {
    const mat = new THREE.MeshStandardMaterial({ color: C.tile.clone(), roughness: 0.78, metalness: 0, emissive: new THREE.Color("#000") });
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(1.08, 0.46, 1.12, 5, 0.18), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const y = (s: TileState) => 0.23 + s.lift * 0.62 - s.gone * 0.38;
    return {
      object: mesh,
      apply(s) {
        mesh.position.set(x, y(s), 0);
        mat.color.copy(C.tile).lerp(C.mid, s.lift).lerp(C.found, s.found).lerp(C.gone, s.gone * 0.85);
        mat.emissive.copy(C.glow).multiplyScalar(s.lit * 0.22);
        mesh.scale.setScalar(1 + s.lit * 0.04);
      },
      labelAnchor: (s) => new THREE.Vector3(x, y(s) + 0.24, 0),
    };
  },
};

mount(style);
