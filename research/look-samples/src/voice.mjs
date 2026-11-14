// Render the spoken script with a local voice (Kokoro, offline) into one clip
// per step, with the time span of every linked phrase so the page can light
// the parts as they are named.
import { KokoroTTS } from "kokoro-js";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { run, parse } from "./src/story.ts";

const VOICE = process.env.VOICE ?? "af_heart";
const GAP = 0.22; // seconds between sentences
mkdirSync("voice", { recursive: true });
const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "cpu" });
const out = [];
for (const [k, step] of run().entries()) {
  // Plain text, and which character ranges name which parts.
  let plain = "";
  const links = [];
  for (const seg of parse(step.voice)) {
    if (seg.ids.length) links.push({ from: plain.length, to: plain.length + seg.text.length, ids: seg.ids });
    plain += seg.text;
  }
  const sentences = plain.match(/[^.!?:]+(?:\.\.\.|[.!?:])?\s*/g) ?? [plain];
  const pcm = [];
  let rate = 24000, t = 0, cursor = 0;
  const marks = []; // per character: time it is spoken
  for (const sentence of sentences) {
    const text = sentence.trim();
    if (!text) { cursor += sentence.length; continue; }
    const audio = await tts.generate(text, { voice: VOICE, speed: 0.95 });
    rate = audio.sampling_rate;
    const samples = audio.audio;
    // Trim leading and trailing silence, so gaps are ours.
    let a = 0, b = samples.length - 1;
    while (a < b && Math.abs(samples[a]) < 0.004) a++;
    while (b > a && Math.abs(samples[b]) < 0.004) b--;
    const clip = samples.slice(Math.max(0, a - 400), Math.min(samples.length, b + 1200));
    const dur = clip.length / rate;
    // Within a sentence, time is shared out by letters (a good proxy for syllables).
    const weights = [...sentence].map((c) => (/[a-z0-9]/i.test(c) ? 1 : c === "," ? 2.5 : 0.3));
    const total = weights.reduce((x, y) => x + y, 0);
    let acc = 0;
    [...sentence].forEach((_, i) => { marks[cursor + i] = t + (acc / total) * dur; acc += weights[i]; });
    pcm.push(clip, new Float32Array(Math.round(GAP * rate)));
    t += dur + GAP;
    cursor += sentence.length;
  }
  marks[plain.length] = t;
  const all = new Float32Array(pcm.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of pcm) { all.set(c, o); o += c.length; }
  // 16-bit WAV, then AAC with the system encoder for a small page.
  const wav = Buffer.alloc(44 + all.length * 2);
  wav.write("RIFF", 0); wav.writeUInt32LE(36 + all.length * 2, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(all.length * 2, 40);
  all.forEach((v, i) => wav.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), 44 + i * 2));
  writeFileSync(`voice/step-${k}.wav`, wav);
  execFileSync("afconvert", ["-f", "m4af", "-d", "aac", "-b", "64000", `voice/step-${k}.wav`, `voice/step-${k}.m4a`]);
  out.push({
    duration: t,
    audio: readFileSync(`voice/step-${k}.m4a`).toString("base64"),
    links: links.map((l) => ({ start: marks[l.from], end: marks[l.to] ?? t, ids: l.ids, text: plain.slice(l.from, l.to) })),
    text: plain,
  });
  console.log(`step ${k}: ${t.toFixed(1)} s, ${links.length} linked phrases`);
}
writeFileSync("voice/voice.json", JSON.stringify({ voice: VOICE, steps: out }));
