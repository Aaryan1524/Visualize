// The rig: Visualize's engine for machine figures that read as 3D and move cheaply.
//   camera.ts   an orthographic camera at any angle, fitted to a figure, and an inset camera
//   shapes.ts   closed meshes: plates from any outline (holes allowed), turned parts, rods
//   draw.ts     a mesh as SVG: continuous shading from one key light, heavier silhouettes, creases,
//               specular edges, contact shadows
//   motion.ts   draw once, then move: the exact transform for motion within a plane; painter's slots
//   stage.ts    the page runtime: one <g> per part, transforms each frame, re-ordered only on change
//   contacts.ts the test that a chain and the wheel it drives move together where they touch
//   parts.ts    what concepts are made of: cells with printed values, rails, cards, rings, markers, arrows
//   rig.css     the look's tokens, in both themes
export * from "./vec.ts";
export * from "./camera.ts";
export * from "./shapes.ts";
export * from "./draw.ts";
export * from "./motion.ts";
export * from "./stage.ts";
export * from "./contacts.ts";
export * from "./parts.ts";
export * from "./concept.ts";
export * from "./mech.ts";
export * from "./objects.ts";
