// The model: binary search for one number in a sorted row. Every step, every
// number in the narration and every highlighted range comes from running it.

export const VALUES = [3, 8, 12, 17, 21, 26, 30, 34, 37, 41, 46, 52, 58, 63, 70, 77];
export const TARGET = 37;

export type Phase = "start" | "look" | "drop" | "found";

export interface Step {
  phase: Phase;
  /** The range still in play after this step. */
  lo: number;
  hi: number;
  /** The middle being looked at, if any. */
  mid: number | null;
  /** How many looks so far. */
  looks: number;
  /** Narration with linked spans: [words|ids] where ids are t3, t0-t7, target, looks. */
  say: string;
  /** Short label for the step dots. */
  chapter: string;
  /** What the voice says: written to be heard, same link markup, numbers in words. */
  voice: string;
}

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
/** 0–99 in words, as a voice would say them. */
export function say(n: number): string {
  if (n < 20) return ONES[n]!;
  const t = TENS[Math.floor(n / 10)]!, o = n % 10;
  return o ? `${t}-${ONES[o]}` : t;
}

const range = (a: number, b: number) => (a === b ? `t${a}` : `t${a}-t${b}`);
const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen"];

export function run(values = VALUES, target = TARGET): Step[] {
  const steps: Step[] = [];
  let lo = 0, hi = values.length - 1, looks = 0;
  const linear = values.indexOf(target) + 1;
  steps.push({ phase: "start", lo, hi, mid: null, looks, chapter: "Row",
    voice: `Okay. [${cap(say(values.length))} numbers|${range(0, values.length - 1)}], all in order, smallest to largest. We're hunting for [${say(target)}|target]. We could check them one by one... but there's a much faster way.`,
    say: `${cap(words[values.length]!)} [numbers|${range(0, values.length - 1)}], sorted smallest to largest. We want [${target}|target].` });
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const v = values[mid]!;
    looks++;
    const left = lo === 0 && hi === values.length - 1 ? "the middle" : "the middle of [what is left|" + range(lo, hi) + "]";
    if (v === target) {
      steps.push({ phase: "found", lo: mid, hi: mid, mid, looks, chapter: "Found",
        voice: `And there it is. Only [${say(v)}|t${mid}] is left. [${cap(say(looks))} looks|looks]. Checking one by one would have taken ${say(linear)}. That's binary search: every look throws away half of what's left.`,
        say: `Only [${v}|t${mid}] is left, and it is the one. Found in [${words[looks]} looks|looks], not ${words[linear] ?? linear}.` });
      break;
    }
    const voiceLook = looks === 1 ? `Let's peek right in [the middle|t${mid}]. It's [${say(v)}|t${mid}].`
      : hi - lo + 1 <= 3 ? `[${cap(say(hi - lo + 1))} numbers|${range(lo, hi)}] left. The middle one is [${say(v)}|t${mid}].`
      : `Same trick again. The middle of [what's left|${range(lo, hi)}] is [${say(v)}|t${mid}].`;
    steps.push({ phase: "look", lo, hi, mid, looks, chapter: `Look ${looks}`, voice: voiceLook, say: `Look at ${left}: [${v}|t${mid}].` });
    if (v < target) {
      const dropped = range(lo, mid);
      lo = mid + 1;
      steps.push({ phase: "drop", lo, hi, mid: null, looks, chapter: "Drop",
        voice: `${cap(say(v))} is smaller than ${say(target)}. And because the row is sorted, [everything to its left|${dropped}] is smaller too. So that whole part... gone.`,
        say: `[${v}|t${mid}] is smaller than ${target}, so [everything up to it|${dropped}] is too small. Drop it.` });
    } else {
      const dropped = range(mid, hi);
      hi = mid - 1;
      steps.push({ phase: "drop", lo, hi, mid: null, looks, chapter: "Drop",
        voice: steps.some((x) => x.phase === "drop" && x.voice.includes("too big"))
          ? `Still too big. So [it goes, and its neighbour|${dropped}] too.`
          : `${cap(say(v))} is too big. So [it, and everything after it|${dropped}], can go.`,
        say: `[${v}|t${mid}] is bigger than ${target}, so [it and everything after it|${dropped}] are too big. Drop them.` });
    }
  }
  return steps;
}

function cap(s: string) { return s[0]!.toUpperCase() + s.slice(1); }

/** Expand "t0-t7 target" into the ids it names. */
export function idsOf(spec: string): string[] {
  return spec.split(/\s+/).flatMap((p) => {
    const m = p.match(/^t(\d+)-t(\d+)$/);
    if (!m) return [p];
    const out: string[] = [];
    for (let i = Number(m[1]); i <= Number(m[2]); i++) out.push(`t${i}`);
    return out;
  });
}

export interface Segment { text: string; ids: string[] }

/** Split narration markup into plain text and linked segments. */
export function parse(say: string): Segment[] {
  const out: Segment[] = [];
  const re = /\[([^\]|]+)\|([^\]]+)\]/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(say))) {
    if (m.index > last) out.push({ text: say.slice(last, m.index), ids: [] });
    out.push({ text: m[1]!, ids: idsOf(m[2]!) });
    last = m.index + m[0].length;
  }
  if (last < say.length) out.push({ text: say.slice(last), ids: [] });
  return out;
}
