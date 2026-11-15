#!/usr/bin/env node
// Record the pin tumbler narration with a local voice (Kokoro, offline after a one-time model
// download). Writes voice.json next to this file: for each lock variant, one AAC clip per
// step (the concept first, then each chapter), and when each [linked phrase|part] is spoken.
// build.mjs embeds voice.json when it is present.
//
//   node voice.mjs [--voice af_heart] [--speed 0.95]
//
// The numbers spoken come from model.mjs, written out in words. Words are timed within each
// clip by letters (pauses weigh more), the same way scripts/voice.mjs does it.

import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MODELS } from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const VOICE = opt("voice", "af_heart"), SPEED = Number(opt("speed", "0.95"));

// ---------- numbers in words ----------
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
export function words(n) {
  n = Math.round(n);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : "");
  if (n < 1000) return ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " and " + words(n % 100) : "");
  return words(Math.floor(n / 1000)) + " thousand" + (n % 1000 ? (n % 1000 < 100 ? " and " : " ") + words(n % 1000) : "");
}

// ---------- the narration, written from the model ----------
// [text|part ...] lights those parts of the drawing while the words are spoken.
const tenths = (mm) => {
  const t = Math.round(mm * 10);
  return t === 10 ? "a millimetre" : t === 1 ? "a tenth of a millimetre" : t === 5 ? "half a millimetre" : `${words(t)} tenths of a millimetre`;
};
const ORD = ["first", "second", "third", "fourth", "fifth", "sixth"];
export function script(M) {
  const L = M.L, n = M.pinning.length;
  const s = M.stackAt("wrong", L.Ltip), bad = s.findIndex((x, i) => M.keys.wrong[i] !== M.pinning[i]);
  const miss = s[bad].miss, ord = ORD[bad];
  const turns = M.turns("wrong");
  const last = turns
    ? `This key's ${ord} cut is [one depth too shallow|key]. It lifts [the ${ord} key pin|block] about ${tenths(miss)} too high. But this is a loose lock: its pins may miss the line by up to about ${tenths(M.tol)}, so [the plug turns anyway|plug]. A precise lock keeps that allowance well under one depth step.`
    : `This key's ${ord} cut is [one depth too shallow|key]. It lifts [the ${ord} key pin|block] about ${tenths(miss)} too high, so now the key pin itself crosses [the shear line|shear], and the plug cannot turn. A cut that is too deep fails the other way: it leaves the driver pin across the line.`;
  return [
    `A lock has one job: turn for one key, and refuse more than ${words(Math.floor(M.keyCount / 10000) * 10)} thousand others cut for the same keyway. Inside, a cylinder called the plug has to turn in a fixed housing. ${cap(words(n))} stacks of spring-loaded pins cross the joint between them and hold it still, until the right key lifts every stack by just the right amount.`,
    `Each stack has [a key pin|keypins] at the bottom, [a driver pin|drivers] above it, and [a spring|springs] on top. With no key, the springs push the stacks down, so every driver pin sits across [the shear line|shear], the joint between [the plug|plug] and [the housing|housing]. The plug cannot turn.`,
    `As [the key|key] slides in, its sloped tip lifts each stack, and the pins ride up and down over its cuts. Every cut is one of ${words(L.depths)} depths, each about ${tenths(L.step)} deeper than the last.`,
    `Pushed all the way in, each cut holds its key pin at exactly the height that puts the gap above it [on the shear line|shear]. A deep cut matches a long key pin, and a shallow cut a short one. Now nothing crosses the joint.`,
    `So [the plug turns|plug]. The key pins ride round with it. [The driver pins|drivers] stay up in the housing, held there by the plug's surface, and [the cam|cam] at the back turns to throw the bolt.`,
    last,
    `No lock is machined perfectly, and that is how a lock is picked. Turn [the plug|plug] lightly with [a tension wrench|pick], and the chamber bored furthest off line pinches its driver pin first. [A pick|pick] lifts that [binding stack|binding] until its gap reaches [the shear line|shear]. The plug turns a hair, and [the driver pin|drivers] is left resting on its edge. Then the next chamber binds. ${cap(words(n))} times over, and the plug turns with no key at all.`,
  ];
}
const cap = (s) => s[0].toUpperCase() + s.slice(1);

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
      // One pass for the whole step, so the voice keeps its own rhythm and sentence melody.
      const audio = await tts.generate(plain, { voice: VOICE, speed: SPEED });
      const rate = audio.sampling_rate, x = audio.audio;
      // A little silence at each end keeps the encoder's lead-in off the speech; a short fade
      // keeps the edges free of clicks.
      const lead = Math.round(0.15 * rate), tail = Math.round(0.35 * rate), fade = Math.round(0.02 * rate);
      const all = new Float32Array(lead + x.length + tail);
      all.set(x, lead);
      for (let i = 0; i < fade; i++) {
        all[lead + i] *= i / fade;
        all[lead + x.length - 1 - i] *= i / fade;
      }
      const t = all.length / rate;
      // When each phrase is spoken: letters share the speech time, pauses weigh more than letters.
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
        // 96 kb/s is not a valid AAC rate for 24 kHz mono, so afconvert refuses it and the clip
        // would fall back to WAV (five times larger). 64 kb/s is clean for speech.
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
