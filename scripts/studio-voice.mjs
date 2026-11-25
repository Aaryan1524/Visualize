#!/usr/bin/env node
// Offline Kokoro TTS narrator for Antigravity Studio pages.
//
//   node scripts/studio-voice.mjs <steps-or-config.json> --out <voice.json> [--voice af_heart] [--speed 0.95]
//   node scripts/studio-voice.mjs --from-html <dist/page.html> --out <folder>/voice.json [--voice af_heart] [--speed 0.95]
//
// Extracts STUDIO_CONFIG steps & variants (or reads a JSON file), synthesizes every step's
// narration offline with kokoro-js (applying spoken-text normalization for TTS while keeping
// original crisp subtitle text in voice.json), encodes to compact AAC m4a (with WAV fallback),
// and writes:
//   { voice, variants: { [name]: [{ duration, type, audio, text }] } }

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const LETTER = {
  A: "ay", B: "bee", C: "see", D: "dee", E: "ee", F: "eff", G: "jee",
  H: "aitch", I: "eye", J: "jay", K: "kay", L: "ell", M: "em", N: "en",
  O: "oh", P: "pee", Q: "cue", R: "ar", S: "ess", T: "tee", U: "you",
  V: "vee", W: "double you", X: "ex", Y: "why", Z: "zee",
};

function parseArgs(argv) {
  let inputJson = null;
  let fromHtml = null;
  let outPath = null;
  let voice = "af_heart";
  let speed = 0.95;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--from-html") fromHtml = argv[++i] ?? null;
    else if (arg === "--out") outPath = argv[++i] ?? null;
    else if (arg === "--voice") voice = argv[++i] ?? voice;
    else if (arg === "--speed") speed = Number(argv[++i] ?? speed);
    else if (arg === "-h" || arg === "--help") {
      console.log(
        [
          "Usage:",
          "  node scripts/studio-voice.mjs <steps-or-config.json> --out <voice.json> [--voice af_heart] [--speed 0.95]",
          "  node scripts/studio-voice.mjs --from-html <dist/page.html> --out <folder>/voice.json [--voice af_heart] [--speed 0.95]",
        ].join("\n"),
      );
      process.exit(0);
    } else if (!arg.startsWith("--") && !inputJson) {
      inputJson = arg;
    }
  }
  return { inputJson, fromHtml, outPath, voice, speed: Number.isFinite(speed) && speed > 0 ? speed : 0.95 };
}

/**
 * Extract the serialized STUDIO_CONFIG JSON literal from a built Studio HTML file.
 */
export function extractStudioConfigFromHtml(html) {
  const markerRe = /\bconst\s+STUDIO_CONFIG\s*=\s*/g;
  let lastMatch = null;
  let m;
  while ((m = markerRe.exec(html))) {
    lastMatch = m;
  }
  if (!lastMatch) {
    throw new Error("Could not find `const STUDIO_CONFIG = ...` in the provided HTML file.");
  }

  let idx = lastMatch.index + lastMatch[0].length;
  while (idx < html.length && /\s/.test(html[idx])) idx += 1;
  if (html[idx] !== "{") {
    throw new Error("STUDIO_CONFIG in HTML does not start with a JSON object `{`.");
  }

  let depth = 0;
  let inStr = false;
  let escaped = false;
  let end = -1;

  for (let i = idx; i < html.length; i++) {
    const ch = html[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  if (end < 0) {
    throw new Error("Unterminated STUDIO_CONFIG JSON object in HTML.");
  }
  return JSON.parse(html.slice(idx, end));
}

export function normalizeDisplayText(raw) {
  return String(raw ?? "")
    .replace(/\[([^\]|]+)\|[^\]]+\]/g, "$1")
    .replace(/\{([^}]+)\}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize technical/math/physics notation into natural spoken phrasing for Kokoro TTS,
 * without altering the crisp on-screen subtitle stored in `voice.json`.
 */
export function normalizeSpokenText(raw) {
  let out = String(raw ?? "")
    // Explicit phonetic markers from Studio narration scripts
    .replace(/\[([^\]|]+)\|[^\]]+\]/g, (_, phrase) =>
      /^[A-Z]$/.test(phrase.trim()) ? LETTER[phrase.trim()] : phrase,
    )
    .replace(/\{([A-Z])\}/g, (_, l) => LETTER[l])
    .replace(/\{([^}]+)\}/g, "$1");

  // Big-O complexity notation: O(1), O(n), O(log n), O(n log n), O(n^2), etc.
  out = out.replace(/\bO\(\s*([^)]+?)\s*\)/g, (_, inner) => {
    const expr = inner
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\^2\b|²/g, " squared")
      .replace(/\^3\b|³/g, " cubed")
      .replace(/\s*\+\s*/g, " plus ");
    return `big O of ${expr}`;
  });

  // Ratios such as 8:1, 1:1, 16:9 (skip timestamps like 12:30:45)
  out = out.replace(/(?<!\d:)\b(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)\b(?!:\d)/g, "$1 to $2");

  // Multipliers such as 26×, 30x, 2.5× (avoid hex like 0x1F or CSS units like 16px)
  out = out.replace(
    /(?<![A-Za-z0-9.])(\d+(?:\.\d+)?)\s*(?:×|(?<![A-Za-z])[xX](?![A-Za-z0-9]))/g,
    "$1 times",
  );

  // Units and physics/math symbols
  out = out
    .replace(/[\u0394\u2206]P\b/g, "pressure drop")
    .replace(/(\d+(?:\.\d+)?)\s*[\u00b5\u03bc]m\b/g, "$1 micrometers")
    .replace(/(?<![A-Za-z])[\u00b5\u03bc]m\b/g, "micrometers")
    .replace(/(\d+(?:\.\d+)?)\s*kPa\b/g, "$1 kilopascals")
    .replace(/\bkPa\b/g, "kilopascals")
    .replace(/(\d+(?:\.\d+)?)\s*m\/s\b/g, "$1 meters per second")
    .replace(/\bm\/s\b/g, "meters per second")
    .replace(/(\d+(?:\.\d+)?)\s*mm\b/g, "$1 millimeters")
    .replace(/\bmm\b/g, "millimeters")
    .replace(/≥\s*/g, "at least ")
    .replace(/≤\s*/g, "at most ")
    .replace(/↔/g, " and ")
    .replace(/→/g, " to ");

  return out.replace(/\s+/g, " ").trim();
}

function resolveVariantSteps(config) {
  if (Array.isArray(config)) {
    return { default: config };
  }
  if (config && typeof config === "object") {
    if (Array.isArray(config.steps)) {
      const variants =
        Array.isArray(config.variants) && config.variants.length > 0
          ? config.variants.map((v) => String(v?.name ?? "default"))
          : ["default"];
      const out = {};
      for (const name of variants) {
        out[name] = config.steps.map((step) => {
          const perVariant = step?.narrationByVariant?.[name];
          return {
            ...step,
            narration: perVariant != null ? String(perVariant) : String(step?.narration ?? step?.voice ?? ""),
          };
        });
      }
      return out;
    }
    if (config.variants && typeof config.variants === "object" && !Array.isArray(config.variants)) {
      const out = {};
      for (const [name, list] of Object.entries(config.variants)) {
        if (Array.isArray(list)) out[name] = list;
      }
      if (Object.keys(out).length > 0) return out;
    }
  }
  throw new Error("Input must contain `steps` array (or be a JSON array of step objects).");
}

function encodeFloatPcmToWav(samples, rate) {
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + samples.length * 2, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767)));
    wav.writeInt16LE(clamped, 44 + i * 2);
  }
  return wav;
}

function encodeWavCompact(wav, tag) {
  const base = join(tmpdir(), `studio-voice-${process.pid}-${Date.now()}-${tag}`);
  const wavPath = `${base}.wav`;
  const m4aPath = `${base}.m4a`;
  try {
    writeFileSync(wavPath, wav);
    try {
      execFileSync("afconvert", ["-f", "m4af", "-d", "aac", "-b", "64000", wavPath, m4aPath], {
        stdio: "ignore",
      });
      return { encoded: readFileSync(m4aPath), type: "audio/mp4" };
    } catch {
      try {
        execFileSync(
          "ffmpeg",
          ["-y", "-loglevel", "error", "-i", wavPath, "-c:a", "aac", "-b:a", "64k", m4aPath],
          { stdio: "ignore" },
        );
        return { encoded: readFileSync(m4aPath), type: "audio/mp4" };
      } catch {
        return { encoded: wav, type: "audio/wav" };
      }
    }
  } finally {
    rmSync(wavPath, { force: true });
    rmSync(m4aPath, { force: true });
  }
}

async function synthesizeClip(tts, rawNarration, { voice, speed, tag }) {
  const displayText = normalizeDisplayText(rawNarration);
  const spokenText = normalizeSpokenText(rawNarration);
  if (!spokenText) return null;

  const generated = await tts.generate(spokenText, { voice, speed });
  const rate = generated.sampling_rate;
  const x = generated.audio;

  const lead = Math.round(0.15 * rate);
  const tail = Math.round(0.35 * rate);
  const fade = Math.min(Math.round(0.02 * rate), Math.floor(x.length / 2));
  const all = new Float32Array(lead + x.length + tail);
  all.set(x, lead);
  for (let i = 0; i < fade; i++) {
    const gain = i / fade;
    all[lead + i] *= gain;
    all[lead + x.length - 1 - i] *= gain;
  }

  const duration = Number((all.length / rate).toFixed(3));
  const wav = encodeFloatPcmToWav(all, rate);
  const { encoded, type } = encodeWavCompact(wav, tag);

  return {
    duration,
    type,
    audio: encoded.toString("base64"),
    text: displayText,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if ((!opts.inputJson && !opts.fromHtml) || !opts.outPath) {
    console.error(
      "Usage: node scripts/studio-voice.mjs (<steps.json> | --from-html <page.html>) --out <voice.json> [--voice af_heart] [--speed 0.95]",
    );
    process.exit(1);
  }

  let config;
  if (opts.fromHtml) {
    const htmlPath = resolve(opts.fromHtml);
    if (!existsSync(htmlPath)) {
      console.error(`studio-voice: HTML file not found: ${htmlPath}`);
      process.exit(1);
    }
    config = extractStudioConfigFromHtml(readFileSync(htmlPath, "utf8"));
  } else {
    const jsonPath = resolve(opts.inputJson);
    if (!existsSync(jsonPath)) {
      console.error(`studio-voice: JSON file not found: ${jsonPath}`);
      process.exit(1);
    }
    config = JSON.parse(readFileSync(jsonPath, "utf8"));
  }

  const variantSteps = resolveVariantSteps(config);

  let KokoroTTS;
  try {
    ({ KokoroTTS } = await import("kokoro-js"));
  } catch {
    console.error("studio-voice: kokoro-js is not installed. Run `pnpm install` in the repo root.");
    process.exit(1);
  }

  const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
    dtype: "q8",
    device: "cpu",
  });

  const clipCache = new Map();
  const variantsOut = {};
  let synthCount = 0;

  for (const [variantName, steps] of Object.entries(variantSteps)) {
    const tracks = [];
    for (let k = 0; k < steps.length; k++) {
      const raw = steps[k]?.narration ?? steps[k]?.voice ?? steps[k]?.text ?? "";
      const key = `${opts.voice}|${opts.speed}|${normalizeSpokenText(raw)}`;
      let clip;
      if (clipCache.has(key)) {
        clip = clipCache.get(key);
      } else {
        clip = await synthesizeClip(tts, raw, {
          voice: opts.voice,
          speed: opts.speed,
          tag: `${variantName}-${k}`,
        });
        clipCache.set(key, clip);
        if (clip) {
          synthCount += 1;
          process.stdout.write(`studio-voice: ${variantName} step ${k} -> ${clip.duration.toFixed(1)}s (${clip.type})\n`);
        }
      }
      tracks.push(clip);
    }
    variantsOut[variantName] = tracks;
  }

  const absOut = resolve(opts.outPath);
  mkdirSync(dirname(absOut), { recursive: true });
  const payload = {
    voice: opts.voice,
    variants: variantsOut,
  };
  writeFileSync(absOut, JSON.stringify(payload));
  console.log(
    `studio-voice: wrote ${absOut} (${synthCount} unique clip${synthCount === 1 ? "" : "s"}, ${Object.keys(variantsOut).length} variant${Object.keys(variantsOut).length === 1 ? "" : "s"})`,
  );
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((err) => {
    console.error(`studio-voice: ${err?.message ?? err}`);
    process.exit(1);
  });
}
