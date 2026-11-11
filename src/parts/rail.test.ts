import test from "node:test";
import assert from "node:assert/strict";
import { railAssembly, cartridge, RAIL_CELL } from "./rail.ts";
import { boundsOf } from "../iso/solids.ts";
import { surfaceGeometry } from "../iso/surface.ts";
import { resolveFrame } from "../core/interpolate.ts";
import type { SolidMark } from "../core/types.ts";

for(const slots of [1,2,3,6,12]) test(`rail with ${slots} slots: supported cells, disjoint solids, attached endpoints`,()=>{
  const rail=railAssembly({key:"rack",slots,at:[17,-8,21]});
  assert.equal(new Set(rail.marks.map(m=>m.key)).size,rail.marks.length);
  const solids=rail.marks.filter((m):m is SolidMark=>m.kind==="box"||m.kind==="cylinder");
  for(let i=0;i<slots;i++) {
    const [x,y,z]=rail.slot(i);
    const tray=solids.find(m=>m.key===`rack/tray-${i}`)!;
    const b=boundsOf(tray);
    assert.equal(z,b.max[2]);
    assert.ok(x>=b.min[0]&&x+RAIL_CELL[0]<=b.max[0]);
    assert.ok(y>=b.min[1]&&y+RAIL_CELL[1]<=b.max[1]);
  }
  for(let i=0;i<solids.length;i++) for(let j=i+1;j<solids.length;j++) {
    const a=boundsOf(solids[i]!),b=boundsOf(solids[j]!);
    assert.ok(![0,1,2].every(axis=>Math.min(a.max[axis]!,b.max[axis]!)-Math.max(a.min[axis]!,b.min[axis]!)>1e-8),`${solids[i]!.key} intersects ${solids[j]!.key}`);
  }
  for(const anchor of Object.values(rail.anchor)) {
    const b=boundsOf(solids.find(m=>m.key===anchor.key)!);
    assert.equal(anchor.at[2],b.max[2]);
    assert.ok(anchor.at.every((v,i)=>v>=b.min[i]!&&v<=b.max[i]!));
  }
  assert.throws(()=>rail.slot(slots),RangeError);
});

test("rail rejects dimensions that cause overlapping slots",()=>{
  for(const slots of [0,1.5,13]) assert.throws(()=>railAssembly({key:"x",slots}),RangeError);
  assert.throws(()=>railAssembly({key:"x",slots:3,pitch:28}),RangeError);
});

test("cartridge surface remains attached during an out-of-order seek",()=>{
  const a=cartridge({key:"a",at:[0,0,3],size:RAIL_CELL,label:"A"});
  const b=cartridge({...a,at:[84,0,3],arc:39});
  const phases={exit:[0,.2],move:[.2,.8],enter:[.8,1]} as const;
  const frame=(t:number)=>resolveFrame([a],[b],t,phases)[0]!;
  const mid=frame(.5);
  assert.ok(mid.kind==="box");
  const shape=surfaceGeometry(mid,"iso");
  assert.ok(shape.length>0);
  frame(.9);frame(.1);
  assert.deepEqual(frame(.5),mid);
  const delta=[(mid.at[0]-a.at[0])*Math.cos(Math.PI/6), (mid.at[0]-a.at[0])/2-(mid.at[2]-a.at[2])];
  const before=surfaceGeometry(a,"iso")[0]!.points;
  shape[0]!.points.forEach((p,i)=>p.forEach((v,k)=>assert.ok(Math.abs(v-before[i]![k]!-delta[k]!)<1e-8)));
});
