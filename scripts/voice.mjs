#!/usr/bin/env node
// Record a scene's narration with a local voice (Kokoro, open source, offline
// after a one-time model download). Writes <scene dir>/voice/<variant>.json:
// one AAC clip per step, and when each [linked phrase|ids] is spoken. The
// build embeds it, and the page offers "Listen".
//
//   node scripts/voice.mjs examples/lru [--voice af_heart] [--speed 0.95]
//
// The text never leaves the machine. Words are timed within each sentence by
// letters, which is close enough to light a part as it is named.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const dir = resolve(args.find((a) => !a.startsWith("--")) ?? "");
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const VOICE = opt("voice", "af_heart"), SPEED = Number(opt("speed", "0.95")), GAP = 0.22;

const mod = await import(pathToFileURL(join(dir, "scene.ts")).href);
const only = opt("only", null);
const files = Object.fromEntries(Object.entries(mod.variants ?? { [mod.default.id]: mod.default }).filter(([n]) => !only || n === only));
const { compile } = await import(pathToFileURL(join(ROOT, "src/core/scene.ts")).href);

let KokoroTTS;
try { ({ KokoroTTS } = await import("kokoro-js")); }
catch { console.error("voice: kokoro-js is not installed. Run `pnpm install` in the skill folder."); process.exit(1); }
const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "cpu" });

const parse = (say) => {
  const out = [], re = /\[([^\]|]+)\|([^\]]+)\]/g;
  let last = 0, m;
  while ((m = re.exec(say))) {
    if (m.index > last) out.push({ text: say.slice(last, m.index), ids: [] });
    out.push({ text: m[1], ids: m[2].trim().split(/\s+/) });
    last = m.index + m[0].length;
  }
  if (last < say.length) out.push({ text: say.slice(last), ids: [] });
  return out;
};

mkdirSync(join(dir, "voice"), { recursive: true });
for (const [name, scene] of Object.entries(files)) {
  const steps = compile(scene).steps;
  if (!steps.some((s) => s.voice)) { console.log(`${name}: no voice() in the scene, skipped`); continue; }
  const tracks = [];
  for (const [k, step] of steps.entries()) {
    let plain = "";
    const links = [];
    for (const seg of parse(step.voice ?? "")) {
      if (seg.ids.length) links.push({ from: plain.length, to: plain.length + seg.text.length, ids: seg.ids });
      plain += seg.text;
    }
    if (!plain.trim()) { tracks.push(null); continue; }
    const sentences = plain.match(/[^.!?:]+(?:\.\.\.|[.!?:])?\s*/g) ?? [plain];
    const pcm = [], marks = [];
    let rate = 24000, t = 0, cursor = 0;
    for (const sentence of sentences) {
      const text = sentence.trim();
      if (!text) { cursor += sentence.length; continue; }
      const audio = await tts.generate(text, { voice: VOICE, speed: SPEED });
      rate = audio.sampling_rate;
      const x = audio.audio;
      let a = 0, b = x.length - 1;
      // Trim only true silence, and keep a generous tail: a word's last sound is faint, and AAC
      // encoding adds a short lead-in, so a tight cut clips the end of the sentence.
      while (a < b && Math.abs(x[a]) < 0.0015) a++;
      while (b > a && Math.abs(x[b]) < 0.0015) b--;
      const clip = x.slice(Math.max(0, a - Math.round(0.12 * rate)), Math.min(x.length, b + Math.round(0.45 * rate)));
      const dur = clip.length / rate;
      const w = [...sentence].map((c) => (/[a-z0-9]/i.test(c) ? 1 : c === "," ? 2.5 : 0.3));
      const total = w.reduce((p, q) => p + q, 0);
      let acc = 0;
      [...sentence].forEach((_, i) => { marks[cursor + i] = t + (acc / total) * dur; acc += w[i]; });
      pcm.push(clip, new Float32Array(Math.round(GAP * rate)));
      t += dur + GAP;
      cursor += sentence.length;
    }
    marks[plain.length] = t;
    const all = new Float32Array(pcm.reduce((n, c) => n + c.length, 0));
    let o = 0;
    for (const c of pcm) { all.set(c, o); o += c.length; }
    const wav = Buffer.alloc(44 + all.length * 2);
    wav.write("RIFF", 0); wav.writeUInt32LE(36 + all.length * 2, 4); wav.write("WAVEfmt ", 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(rate, 24);
    wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(all.length * 2, 40);
    all.forEach((v, i) => wav.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), 44 + i * 2));
    const tmp = join(dir, "voice", `.${name}-${k}`);
    writeFileSync(`${tmp}.wav`, wav);
    // AAC through the system encoder where there is one (macOS); otherwise keep WAV.
    let audio, type;
    try { execFileSync("afconvert", ["-f", "m4af", "-d", "aac", "-b", "64000", `${tmp}.wav`, `${tmp}.m4a`], { stdio: "ignore" }); audio = readFileSync(`${tmp}.m4a`); type = "audio/mp4"; }
    catch { audio = wav; type = "audio/wav"; }
    rmSync(`${tmp}.wav`, { force: true }); rmSync(`${tmp}.m4a`, { force: true });
    tracks.push({ duration: t, type, audio: audio.toString("base64"), links: links.map((l) => ({ start: marks[l.from], end: marks[l.to] ?? t, ids: l.ids })), text: plain });
    process.stdout.write(`${name} step ${k}: ${t.toFixed(1)} s\n`);
  }
  writeFileSync(join(dir, "voice", `${name}.json`), JSON.stringify({ voice: VOICE, steps: tracks }));
  console.log(`${name}: wrote ${join(dir, "voice", `${name}.json`)}`);
}
