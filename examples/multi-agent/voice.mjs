#!/usr/bin/env node
// Record the multi-agent orchestration narration with Kokoro (local, offline after one download).
// Writes voice.json beside this file: one AAC clip per step for each What-if variant, plus
// [phrase|part] timestamps that light the corresponding 3D instruments while they are named.

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
const VOICE = opt("voice", "af_heart"), SPEED = Number(opt("speed", "0.96"));

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
export function words(n) {
  n = Math.round(n);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : "");
  return String(n);
}

export function script(M) {
  const N = M.N, orch = MODELS.orchestrated.N, mono = MODELS.monolith.N;
  const isMono = M.v.mode === "monolith";
  return [
    isMono
      ? `A single monolithic agent audits all ${words(N.subtasks)} independent modules one after another in ${mono.cleanTotalS.toFixed(1)} seconds. Worse, every raw tool output piles into [one shared context window|context], swelling to ${mono.orchContext.toFixed(1)} thousand tokens and breaking past the ${words(N.contextCliff)} thousand token attention cliff.`
      : `A single agent auditing ${words(N.subtasks)} independent code modules runs serially in ${mono.cleanTotalS.toFixed(1)} seconds and piles ${mono.orchContext.toFixed(1)} thousand tokens into one window, far past the ${words(N.contextCliff)} thousand token cliff. [Multi-agent orchestration|orchestrator] fans the modules out to isolated specialists, cutting wall time to ${orch.cleanTotalS.toFixed(1)} seconds while keeping the coordinator compact.`,
    isMono
      ? `In the single-agent baseline, [one active agent|orchestrator] plans on top with [one shared context stack|context]. Only [the center compute lane|workers] executes tasks, calling [the three external tool valves|tools] one by one before writing to [the artifact vault|vault], with no isolated worker trays and no separate verifier.`
      : `The architecture separates three planes. On top sits [the orchestrator hub|orchestrator] with its own [root context stack|context]. Below it sit [three specialist module blades|workers], each with an isolated context tray. On the base plane sit [external tool valves|tools], an independent [verifier gate|verifier], and [the shared artifact vault|vault].`,
    isMono
      ? `The single agent spends ${N.planS.toFixed(1)} seconds and ${M.D.planTokens.toFixed(1)} thousand tokens outlining the audit, then starts [the Auth module|workers] alone while the Billing and Search modules wait in queue.`
      : `[The orchestrator|orchestrator] spends ${N.planS.toFixed(1)} seconds decomposing the audit into ${words(N.subtasks)} independent module tasks, then dispatches [compact specifications|dispatch] down all three conduits at once.`,
    isMono
      ? `Each module runs its full think, tool call, and distill turn serially through [the single active lane|workers] and [tool valves|tools]. The three work branches add up to ${N.sumWorkS.toFixed(1)} seconds, stretching View A across the axis.`
      : `[All three module workers|workers] think, call [their tool valves|tools], and distill summaries concurrently. Because the branches overlap, the work phase finishes in ${orch.workCleanS.toFixed(1)} seconds instead of ${orch.sumWorkS.toFixed(1)} seconds, bounded by the slowest branch on View A.`,
    isMono
      ? `Without context isolation, all ${N.rawTotal.toFixed(1)} thousand tokens of raw module logs stack directly onto [the single shared window|context], hitting ${mono.fanInContext.toFixed(1)} thousand tokens before final synthesis and breaking past the red ${words(N.contextCliff)} thousand token collar.`
      : `Each worker absorbs its own raw tool output locally, peaking at ${orch.peakWorker.toFixed(1)} thousand tokens. Each distills a compact summary, ${orch.summaryTotal.toFixed(1)} thousand tokens in all, keeping [the orchestrator|context] at ${orch.fanInContext.toFixed(1)} thousand tokens at fan-in instead of ${orch.uncompressedFanIn.toFixed(1)} thousand, trading higher aggregate token spend for clean windows.`,
    isMono
      ? `When [the Search tool valve|retry] times out, a ${N.retryS.toFixed(1)} second retry adds the full delay straight onto the serial run, pushing total time to ${mono.faultTotalS.toFixed(1)} seconds and adding error trace noise to the shared window.`
      : `When [the Search tool valve|retry] times out on the third worker, only that lane retries. Because ${orch.retryOverlapS.toFixed(1)} seconds of the ${N.retryS.toFixed(1)} second retry overlap the Billing branch, wall time grows by just ${orch.faultDeltaS.toFixed(1)} seconds and [the orchestrator's context|context] stays untouched.`,
    isMono
      ? `With no independent verifier, [the single agent|orchestrator] self-checks and synthesizes its answer in ${N.synthS.toFixed(1)} seconds inside the same ${mono.orchContext.toFixed(1)} thousand token window before committing to [the artifact vault|vault].`
      : `Before synthesis, an independent [verifier gate|verifier] inspects the merged summaries in a clean ${M.D.verifyTokens.toFixed(1)} thousand token window for ${N.verifyS.toFixed(1)} seconds to catch cross-module conflicts, sending critique back on failure or committing to [the artifact vault|vault] before [the orchestrator|orchestrator] synthesizes in ${N.synthS.toFixed(1)} seconds.`,
  ];
}

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
