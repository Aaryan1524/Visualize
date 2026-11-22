#!/usr/bin/env node
// Record the automatic watch narration with Kokoro (local, offline after one model download).
// Writes voice.json beside this file for both beat-rate variants (28,800 vph and 18,000 vph).

import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MODELS } from "./model.mjs";
import { script, words } from "./story.mjs";

export { script, words };

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const VOICE = opt("voice", "af_heart"), SPEED = Number(opt("speed", "0.96"));

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

if (import.meta.url === `file://${process.argv[1]}`) {
  let KokoroTTS;
  try {
    ({ KokoroTTS } = await import("kokoro-js"));
  } catch {
    console.error("voice: kokoro-js is not installed. Run `pnpm install` in the skill folder.");
    process.exit(1);
  }
  const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "cpu" });
  const out = { voice: VOICE, variants: {} };
  for (const [name, M] of Object.entries(MODELS)) {
    const tracks = [];
    for (const [k, say] of script(M).entries()) {
      let plain = "";
      const links = [];
      for (const seg of parse(say)) {
        if (seg.ids.length) links.push({ from: plain.length, to: plain.length + seg.text.length, ids: seg.ids });
        plain += seg.text;
      }
      const audio = await tts.generate(plain, { voice: VOICE, speed: SPEED });
      const rate = audio.sampling_rate, x = audio.audio;
      const lead = Math.round(0.15 * rate), tail = Math.round(0.35 * rate), fade = Math.round(0.02 * rate);
      const all = new Float32Array(lead + x.length + tail);
      all.set(x, lead);
      for (let i = 0; i < fade; i++) {
        all[lead + i] *= i / fade;
        all[lead + x.length - 1 - i] *= i / fade;
      }
      const t = all.length / rate;
      const weight = (c) => (/[a-z0-9]/i.test(c) ? 1 : c === "," ? 3 : /[.!?:]/.test(c) ? 7 : 0.4);
      const w = [...plain].map(weight), total = w.reduce((a, b) => a + b, 0), speech = x.length / rate;
      const at = [];
      let acc = 0;
      [...plain].forEach((_, i) => {
        at[i] = 0.15 + (acc / total) * speech;
        acc += w[i];
      });
      at[plain.length] = 0.15 + speech;
      const wav = Buffer.alloc(44 + all.length * 2);
      wav.write("RIFF", 0);
      wav.writeUInt32LE(36 + all.length * 2, 4);
      wav.write("WAVEfmt ", 8);
      wav.writeUInt32LE(16, 16);
      wav.writeUInt16LE(1, 20);
      wav.writeUInt16LE(1, 22);
      wav.writeUInt32LE(rate, 24);
      wav.writeUInt32LE(rate * 2, 28);
      wav.writeUInt16LE(2, 32);
      wav.writeUInt16LE(16, 34);
      wav.write("data", 36);
      wav.writeUInt32LE(all.length * 2, 40);
      all.forEach((v, i) => wav.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), 44 + i * 2));
      const tmp = join(HERE, `.voice-${name}-${k}`);
      writeFileSync(`${tmp}.wav`, wav);
      let encoded, type;
      try {
        execFileSync("afconvert", ["-f", "m4af", "-d", "aac", "-b", "64000", `${tmp}.wav`, `${tmp}.m4a`], { stdio: "ignore" });
        encoded = readFileSync(`${tmp}.m4a`);
        type = "audio/mp4";
      } catch {
        encoded = wav;
        type = "audio/wav";
      }
      rmSync(`${tmp}.wav`, { force: true });
      rmSync(`${tmp}.m4a`, { force: true });
      tracks.push({ duration: t, type, audio: encoded.toString("base64"), links: links.map((l) => ({ start: at[l.from], end: at[l.to] ?? t, ids: l.ids })), text: plain });
      process.stdout.write(`${name} step ${k}: ${t.toFixed(1)} s\n`);
    }
    out.variants[name] = tracks;
  }
  writeFileSync(join(HERE, "voice.json"), JSON.stringify(out));
  console.log(`wrote ${join(HERE, "voice.json")}`);
}
