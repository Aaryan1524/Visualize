#!/usr/bin/env node
// Optional development probe. No upstream code is copied or bundled.
// node scripts/probe-anatomy.mjs /path/to/anatomy/kit/iso-kit.mjs
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { project } from "../src/iso/project.ts";
if (!process.argv[2]) throw new Error("Pass the local Anatomy kit/iso-kit.mjs path");
const source=resolve(process.argv[2]);
const { iso, slabOf }=await import(pathToFileURL(source).href);
const camera={origin:[0,0],scale:Math.sqrt(1.5/1.6),azimuth:45,elevation:Math.asin(1/Math.sqrt(3))*180/Math.PI};
let maxProjectionError=0;
for(let x=-40;x<=160;x+=10) for(let y=-20;y<=80;y+=10) for(let z=-10;z<=70;z+=10) {
  const a=iso([x,y,z],camera),b=project([x,y,z]);
  maxProjectionError=Math.max(maxProjectionError,Math.hypot(a[0]-b[0],a[1]-b[1]));
}
const slab=slabOf({x:0,y:0,w:28,d:24,r:2},3,17,camera,12,.6);
if(maxProjectionError>1e-9 || !slab.bevel || slab.shades.length!==4) throw new Error("Geometry compatibility probe failed");
console.log(JSON.stringify({sourceSha256:createHash("sha256").update(readFileSync(source)).digest("hex"),camera,maxProjectionError,outputs:Object.keys(slab),shadeLayers:slab.shades.length,hasBevel:!!slab.bevel},null,2));
