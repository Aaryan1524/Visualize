#!/usr/bin/env node
// Record the rear derailleur narration with a local voice (Kokoro, offline after a one-time model
// download). Writes voice.json next to this file: for each cassette variant, one AAC clip per
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
// [text|part ...] lights those parts of the drawing while the words are spoken. Whole numbers are
// written in words; decimals stay as digits, which the voice reads as "two point six seven".
export function script(M) {
  const N = M.N, D = M.D;
  return [
    `A rear derailleur has to move a turning chain onto any one of ${words(M.n)} cogs, using nothing but one cable. The biggest cog wraps about ${words(Math.round(N.extraWrap))} millimetres more chain than the smallest, and the chain is a fixed length, so [the cage|cage] pays out chain as the chain climbs the cassette and takes it back as the chain drops.`,
    `It bolts to [the hanger|hanger] on the frame. Below that, [a parallelogram|links] of two links and four pins swings sideways: [the cable|cable] pulls it one way, and [a return spring|rspring] pulls it back. At the bottom, [the cage|cage] carries two small pulleys. [The guide pulley|guide] steers the chain onto a cog, and [the tension pulley|tension] keeps it tight.`,
    `One click of the shifter pulls [${M.clickPull.toFixed(2)} millimetres of cable|cable]. [The parallelogram|links] moves the pulley ${D.ratio} times as far, so the guide pulley moves exactly one cog: [${D.pitch} millimetres|guide]. The turning chain follows it onto [the next cog|cassette].`,
    `A cable can only pull. Click the other way, and the shifter lets the cable out, so the return spring pulls the parallelogram back out. [The return spring|rspring] does the work, and the chain drops to [the smaller cog|cassette].`,
    `But the chain only moves while it turns. Only forward pedalling drives the chain, so coasting and backpedalling do not shift. With the pedals still, the pulley moves at once and the chain just runs at an angle. Pedal, and [a ramp and pin|gates] on the next cog come round, catch the chain's plate and lift it across.`,
    `Now the chain climbs to the ${words(N.big)}. The bigger cog takes chain from the loop through the cage, about ${words(Math.round(N.takeUp))} millimetres of it, and most of the rest from the lower run to the chainring. [The cage spring|forces] only ever turns the cage back, taking up slack; so it is the chain's pull on [the tension pulley|tension] that turns the cage about ${words(Math.round(N.swing))} degrees forward, winding the spring tighter.`,
    `Three screws set the limits. [The H screw|hscrew] stops the parallelogram on the smallest cog's line, so a slack cable and the return spring can't throw the chain off outboard into the dropout. [The L screw|lscrew] does the same on the largest, so a tight cable or a knock can't throw the chain into the spokes. [The B screw|bscrew] turns the whole derailleur about its mounting bolt, which moves the guide pulley toward or away from every cog together. Set it with the chain on the largest cog, as close as it can run without touching. Too close, and the guide pulley's teeth reach the largest cog's; too far, and the chain crosses a longer unsupported run to the big cogs.`,
    `Cables stretch and housings settle. If the cable runs just one millimetre slack, every cog but the smallest lands ${(D.ratio).toFixed(1)} millimetres outboard of its cog. The smallest is held on its line by the H screw and the return spring. So if the chain hesitates or rubs going up to a larger cog, the cable is slack, so turn [the barrel adjuster|barrel] out, counter-clockwise, to take it up. If the downshift hesitates or the chain rubs the next larger cog, the cable is tight, so turn it in, clockwise. Make the final adjustment while pedalling, trying every gear.`,
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
