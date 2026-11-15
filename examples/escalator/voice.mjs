#!/usr/bin/env node
// Record the escalator narration with a local voice (Kokoro, offline after a one-time model
// download). Writes voice.json next to this file: for each escalator variant, one AAC clip per
// step (the concept first, then each chapter), and when each [linked phrase|part] is spoken.
// build.mjs embeds voice.json when it is present.
//
//   node examples/escalator/voice.mjs [--voice af_heart] [--speed 0.95]
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
export function script(M) {
  const P = M.P;
  const metres = P.rise % 1000 ? `${words(P.rise)} millimetres` : `${words(P.rise / 1000)} metres`;
  const rise = M.stepRise, riseSaid = Math.abs(rise - Math.round(rise / 10) * 10) < 0.5 ? words(rise) : `about ${words(Math.round(rise / 10) * 10)}`;
  return [
    `An escalator is a staircase that never stops. Every step rides an endless loop: up the slope, round the top, and back underneath. This one rises ${metres} at ${words(P.incline)} degrees, and every tread stays level all the way up. So how does a step stay flat on a slope?`,
    `[The step chain|chain] is one endless loop of links. It wraps round [a sprocket at each end|sprockets], and [a motor and gearbox|drive] turn the top one, so the chain moves at half a metre per second. ${cap(words(M.PATH.N))} [steps|steps] are pinned to it, four hundred millimetres apart.`,
    `Each step rolls on two wheels. [The chain wheel|cwheels] at the front runs on [the chain-wheel track|chaintrack]. [The trailer wheel|twheels] at the back runs on [a second track of its own|trailertrack]. On the slope that second track sits higher, so it holds up the back of the step, and [the tread stays level|followed]. Each step stands ${riseSaid} millimetres above the one below.`,
    `Near the top, [the two tracks|chaintrack trailertrack] come together. With both wheels at the same height, each step sits level with its neighbours, and the stairs flatten into a walkway. Then [the steps|followed] slide under [the comb plate|landing], whose teeth run in the grooves of the treads.`,
    `Under the floor, [the chain|chain] wraps round [the drive sprocket|sprockets]. [The trailer wheel|trailertrack] follows a curved guide of its own, so [each step|followed] turns over and travels back underneath, upside down, until it turns again at the bottom.`,
    `[The handrail|handrail] is a separate loop. It wraps round [a sheave in each newel|sheaves], and [a chain from the main shaft|hrdrive] turns it, so the rail in your hand moves at the same half a metre per second as the step under your feet.`,
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
