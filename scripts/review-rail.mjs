#!/usr/bin/env node
// Rebuild and capture the shared-rail review without scene-specific styling.
import { execFileSync } from "node:child_process";
import { mkdirSync, copyFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, openPage, settle } from "./lib/browser.mjs";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const out=join(root,"shots/rail-review");
mkdirSync(out,{recursive:true});
execFileSync(process.execPath,[join(root,"scripts/build.mjs"),join(root,"examples/lru")],{stdio:"inherit"});
execFileSync(process.execPath,[join(root,"scripts/build.mjs"),join(root,"test/fixtures/rail"),"--out",join(root,"dist/rail")],{stdio:"inherit"});
const cases=[{name:"lru",step:4,file:join(root,"dist/lru.html")},...[1,3,6].map((n,i)=>({name:["rail-one","rail-three","rail-six"][i],step:n,file:join(root,"dist/rail",["rail-one","rail-three","rail-six"][i]+".html")}))];
const browser=await launch();
try {
  for(const c of cases) {
    copyFileSync(c.file,join(out,c.name+".html"));
    for(const theme of ["light","dark"]) {
      const {page,errors}=await openPage(browser,c.file,{width:1440,height:900,theme,scale:1});
      await page.evaluate(k=>window.__viz.seekStep(k),c.step);await settle(page);
      await page.screenshot({path:join(out,`${c.name}-${theme}.png`)});
      if(c.name==="lru") {
        await page.setViewport({width:1920,height:1080,deviceScaleFactor:1});await settle(page);
        await page.screenshot({path:join(out,`lru-1920-${theme}.png`)});
        await page.setViewport({width:1440,height:900,deviceScaleFactor:4});await settle(page);
        const clip=await page.evaluate(()=>{
          const rects=[...document.querySelectorAll('.vz-solid:not([data-key^="req-"]):not([data-key="belt"])')].map(e=>e.getBoundingClientRect());
          const x=Math.min(...rects.map(r=>r.x))-8,y=Math.min(...rects.map(r=>r.y))-8;
          return {x,y,width:Math.max(...rects.map(r=>r.right))-x+8,height:Math.max(...rects.map(r=>r.bottom))-y+8};
        });
        await page.screenshot({path:join(out,`closeup-${theme}.png`),clip});
      }
      if(errors.length) throw new Error(errors.join("\n"));
      await page.close();
    }
  }
  const {page}=await openPage(browser,cases[0].file,{width:1440,height:900,scale:1});
  const tiles=[];
  for(let k=0;k<10;k++) {
    await page.evaluate(k=>window.__viz.seekStep(k),k);await settle(page);
    tiles.push({label:`Step ${k}`,image:await page.screenshot({encoding:"base64"})});
  }
  for(const k of [4,5]) for(const progress of [.1,.3,.5,.7,.9]) {
    await page.evaluate(({k,progress})=>{const t=window.__viz.compiled.timeline;window.__viz.seek(t.start[k]+t.duration[k]*progress);},{k,progress});await settle(page);
    tiles.push({label:`Move ${k} · ${progress}`,image:await page.screenshot({encoding:"base64"})});
  }
  const sheet=await browser.newPage();await sheet.setViewport({width:1440,height:900,deviceScaleFactor:1});
  await sheet.setContent(`<style>body{margin:16px;background:#eeeee8;font:12px system-ui}main{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0}img{width:100%}</style><main>${tiles.map(t=>`<figure><img src="data:image/png;base64,${t.image}"><figcaption>${t.label}</figcaption></figure>`).join("")}</main>`);
  await sheet.screenshot({path:join(out,"steps-motion.png"),fullPage:true});
} finally {await browser.close();}
const items=[...cases.map(c=>({title:c.name==="lru"?"LRU":c.name.replace("rail-","")+" slots",url:c.name+".html#step="+c.step})),...(existsSync(join(out,"before.html"))?[{title:"Before",url:"before.html#step=4"}]:[])];
writeFileSync(join(out,"index.html"),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Shared rail review</title><style>body{margin:0;background:#f2f0e8;font:13px system-ui}nav{height:48px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:8px 24px}b{margin-right:auto}a{padding:6px 12px;color:#243d36;text-decoration:none;border:1px solid #cbcfc9;border-radius:6px}iframe{border:0;width:100%;height:calc(100dvh - 48px);display:block}</style><nav><b>Shared rail · review checkpoint</b>${items.map(i=>`<a href="${i.url}" target="preview">${i.title}</a>`).join("")}<a href="lru.html#step=4" target="_blank">Full window ↗</a></nav><iframe name="preview" title="Rail explanation preview" src="lru.html#step=4"></iframe></html>`);
console.log(`Review ready: ${out}/index.html`);
