import { defineScene } from "../../../src/core/scene.ts";
import type { Observation, Mark } from "../../../src/core/types.ts";
import { railAssembly, cartridge, RAIL_CELL } from "../../../src/parts/rail.ts";
import { initial, run, type LruState, type GetEvent } from "../../../examples/lru/model.ts";

/** Review fixtures: identical components and styles, different model dimensions. */
function specimen(capacity: number, name: string) {
  const requests = Array.from({length:capacity}, (_,i)=>String.fromCharCode(65+i)).concat("A","Z");
  return defineScene<LruState,GetEvent>({
    id: name,
    title: `${capacity} ${capacity === 1 ? "slot" : "slots"} · shared rail`,
    question: "Same parts. Different capacity.",
    trust: "computed",
    presentation: "editorial",
    trace: () => ({ initial:initial(capacity,requests), intro:"Fill the available slots.", steps:run(capacity,requests).steps.map(s=>({...s,caption:s.event.evicted ? `${s.event.evicted} leaves. ${s.event.key} enters.` : `${s.event.key} is most recent.`})) }),
    teaching: (s,e) => ({chapter:e?.evicted ? "Evict" : e?.result === "hit" ? "Refresh" : "Fill", heading:e ? e.evicted ? `${e.evicted} leaves. ${e.key} enters.` : `${e.key} is most recent.` : `Fill ${capacity === 1 ? "the slot" : `the ${capacity} slots`}.`}),
    view: (s,e) => {
      const rail=railAssembly({key:"specimen",slots:s.capacity});
      const marks:Mark[]=[...rail.marks];
      s.order.forEach((key,i)=>marks.push(cartridge({key:`entry-${key}`,at:rail.slot(i),size:RAIL_CELL,label:key,tone:e?.key===key ? e.result==="hit" ? "good" : "accent" : "subject",lit:e?.key===key,enter:"drop",...(e?.result==="hit"&&e.key===key ? {arc:39} : {})})));
      if(e?.evicted) marks.push(cartridge({key:`entry-${e.evicted}`,at:[-35,0,3],size:RAIL_CELL,label:e.evicted,tone:"bad",leaving:true}));
      return marks;
    },
    observe: s => s.order.flatMap(key => [{type:"text",key:`entry-${key}`,equals:key},{type:"visible",key:`entry-${key}`,visible:true},{type:"extent",key:`entry-${key}`,size:RAIL_CELL,radius:2}] as Observation[]),
    legend:[{tone:"subject",label:"Cached"},{tone:"good",label:"Hit"},{tone:"accent",label:"Miss"},{tone:"bad",label:"Evicted"}],
  });
}
export const variants={"rail-one":specimen(1,"rail-one"),"rail-three":specimen(3,"rail-three"),"rail-six":specimen(6,"rail-six")};
export default variants["rail-three"];
