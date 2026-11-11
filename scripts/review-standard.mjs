#!/usr/bin/env node
// Capture the three visual-reference moments and a before/after review page.
import { mkdirSync, copyFileSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, openPage, settle } from "./lib/browser.mjs";
import { bundledStyles } from "./lib/styles.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const out=process.argv[2] ? resolve(process.argv[2]) : join(root,"shots/visual-standard");mkdirSync(out,{recursive:true});
copyFileSync(join(root,"dist/retries.html"),join(out,"retries.html"));
const moments=[{id:"lost",step:5,progress:.65,title:"Lost response"},{id:"lookup",step:8,title:"Key lookup"},{id:"compare",step:10,title:"Charge comparison"}];
const browser=await launch(),tiles=[];
try {
  for(const theme of ["light","dark"]) {
    const {page,errors}=await openPage(browser,join(out,"retries.html"),{width:1440,height:900,theme,scale:1});
    const fonts=await page.evaluate(()=>[...document.fonts].filter(f=>f.family.includes("Visualize")).map(f=>({family:f.family,status:f.status})));
    if(fonts.length!==2||fonts.some(f=>f.status!=="loaded")) throw new Error("Bundled fonts not loaded: "+JSON.stringify(fonts));
    for(const m of moments) {
      await page.evaluate(m=>{const v=window.__viz,t=v.compiled.timeline;m.progress ? v.seek(t.start[m.step]+t.duration[m.step]*m.progress) : v.seekStep(m.step);},m);await settle(page);
      await page.screenshot({path:join(out,`${m.id}-${theme}.png`)});
      tiles.push({title:`${m.title} · ${theme}`,image:await page.screenshot({encoding:"base64"})});
      if(m.id==="lookup") {
        await page.setViewport({width:1440,height:900,deviceScaleFactor:4});await settle(page);
        const clip=await page.evaluate(()=>{const rects=[...document.querySelectorAll('.vz-solid[data-key^="safe/"]')].map(e=>e.getBoundingClientRect());const x=Math.min(...rects.map(r=>r.left))-6,y=Math.min(...rects.map(r=>r.top))-6;return {x,y,width:Math.max(...rects.map(r=>r.right))-x+6,height:Math.max(...rects.map(r=>r.bottom))-y+6};});
        await page.screenshot({path:join(out,`closeup-${theme}.png`),clip});
        await page.setViewport({width:1440,height:900,deviceScaleFactor:1});
      }
    }
    await page.setViewport({width:1920,height:1080,deviceScaleFactor:1});await page.evaluate(()=>window.__viz.seekStep(10));await settle(page);
    await page.screenshot({path:join(out,`compare-1920-${theme}.png`)});
    if(errors.length) throw new Error(errors.join("\n"));await page.close();
  }
  const page=await browser.newPage();await page.setViewport({width:1500,height:900,deviceScaleFactor:1});
  await page.setContent(`<style>body{margin:16px;background:#e8ecf0;font:13px system-ui}main{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0}img{width:100%}</style><main>${tiles.map(t=>`<figure><img src="data:image/png;base64,${t.image}"><figcaption>${t.title}</figcaption></figure>`).join("")}</main>`);
  await page.screenshot({path:join(out,"moments.png"),fullPage:true});
}finally{await browser.close();}
const css=await bundledStyles();
writeFileSync(join(out,"style-guide.html"),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Visualize · visual standard 01</title><style>${css}body{margin:0;background:#eef0f3}.vz.guide{height:auto;max-width:1100px;margin:32px auto;padding:40px;display:grid;gap:32px;background:var(--card)}h1,h2,p{margin:0}h1{font-size:40px;letter-spacing:-.04em}h2{font-size:20px}p{max-width:68ch;line-height:1.6}.swatches{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}.swatch i{display:block;height:80px;border-radius:8px;background:var(--swatch);border:1px solid var(--hair)}.swatch p{margin-top:10px;font-size:13px}.scale{display:flex;gap:32px;align-items:baseline}.number{font:500 32px var(--mono)}button{justify-self:start;font:500 14px var(--sans);padding:8px 16px;background:var(--card);color:var(--ink);border:1px solid var(--hair);border-radius:6px}</style><main class="vz guide" data-presentation="editorial" data-theme="light"><p>Visualize · visual standard 01</p><h1>Clear mechanisms. Quiet surfaces.</h1><p>Neutral structure gives the changing evidence room to stand out. Shape, overlap, thickness and directional light carry depth. Detail explains construction; colour explains state.</p><button onclick="this.closest('main').dataset.theme=this.closest('main').dataset.theme==='light'?'dark':'light'">Switch theme</button><h2>Semantic colours</h2><div class="swatches">${[["signal-request","Request / stored input"],["signal-processing","Processing / cache miss"],["signal-success","Success / cache hit"],["signal-error","Loss / unwanted duplicate"]].map(([v,t])=>`<div class="swatch" style="--swatch:var(--${v})"><i></i><p>${t}</p></div>`).join("")}</div><h2>Material hierarchy</h2><div class="swatches">${["base","structure","subject","muted"].map(t=>`<div class="swatch" style="--swatch:var(--material-${t})"><i></i><p>${t}</p></div>`).join("")}</div><h2>Typography</h2><div class="scale"><span style="font-size:28px;font-weight:600;letter-spacing:-.04em">Why can a retry charge twice?</span><span class="number">$40</span></div><p>Manrope: titles, actions and names. IBM Plex Mono: values, time and counters. Names and statuses use consistent sans-serif labels. Both are bundled locally. The standalone page and SVG include their font data.</p><h2>Composition rules</h2><p>One desktop viewport. One short action. Readable essential values. Foundations fit their contents. Fixed camera and light, no idle decoration, meaningful colour, and model-driven counts. A review at normal size precedes the close-up review.</p></main></html>`);
const before=existsSync(join(out,"before.html"));
writeFileSync(join(out,"index.html"),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Visual standard review</title><style>body{margin:0;background:#eef0f3;color:#202b38;font:13px system-ui}nav{height:52px;display:flex;align-items:center;gap:8px;padding:0 20px}b{margin-right:auto}button,a{font:inherit;border:1px solid #ccd5df;background:white;padding:6px 10px;border-radius:6px;color:inherit;text-decoration:none;cursor:pointer}iframe{display:block;width:100%;height:calc(100dvh - 52px);border:0}</style><nav><b>Visual standard 01</b>${moments.map(m=>`<button onclick="moment='${m.id}';show()">${m.title}</button>`).join("")}<button onclick="dark=!dark;show()">Light / dark</button>${before?`<button onclick="old=!old;show()">Before / after</button>`:""}<a href="style-guide.html" target="_blank">Style guide ↗</a><a href="retries.html#step=8" target="_blank">Full window ↗</a></nav><iframe title="Visualize reference" id="preview"></iframe><script>const moments=${JSON.stringify(moments)};let moment='lookup',dark=false,old=false,revision=0;const frame=document.querySelector('iframe');function show(){const own=++revision;const m=moments.find(m=>m.id===moment);frame.onload=()=>{const w=frame.contentWindow;function ready(){if(own!==revision)return;if(!w.__viz)return setTimeout(ready,20);const v=w.__viz;v.root.dataset.theme=dark?'dark':'light';w.document.body.dataset.theme=v.root.dataset.theme;v.stage.refreshInk();const t=v.compiled.timeline;m.progress?v.seek(t.start[m.step]+t.duration[m.step]*m.progress):v.seekStep(m.step);}ready();};frame.src=(old?'before':'retries')+'.html?review='+moment+'&theme='+Number(dark)+'#step='+m.step;}show();</script></html>`);
console.log(`Visual-standard review ready: ${out}/index.html`);
