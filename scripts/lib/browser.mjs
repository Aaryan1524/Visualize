// Shared headless-Chrome helpers for shoot.mjs and verify.mjs.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
];

export function chromePath() {
  const found = CANDIDATES.find((p) => p && existsSync(p));
  if (!found) {
    throw new Error("Chrome or Chromium not found. Set CHROME_PATH to its executable.");
  }
  return found;
}

export async function launch() {
  try {
    return await puppeteer.launch({
      executablePath: chromePath(),
      headless: true,
      args: ["--allow-file-access-from-files", "--font-render-hinting=none"],
    });
  } catch (e) {
    // Agent sandboxes (Codex's, for one) stop Chrome from starting; the error alone does not say so.
    const hint = "Chrome could not start. If this runs inside an agent's sandbox, run this command outside it " +
      "(approve it when the agent asks), or run it yourself in a normal terminal. The page itself is built; only the checks need Chrome.";
    throw new Error(`${e?.message ?? e}\n${hint}`, { cause: e });
  }
}

/**
 * Open a built page with a given viewport, theme and motion preference.
 * Collects console errors and uncaught exceptions into `errors`.
 */
export async function openPage(browser, file, { width = 1280, height = 1000, theme = "light", reduced = false, scale = 2 } = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`exception: ${e.message ?? e}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  await page.setViewport({ width, height, deviceScaleFactor: scale });
  await page.emulateMediaFeatures([
    { name: "prefers-color-scheme", value: theme },
    { name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" },
  ]);
  // Pages open light whatever the system uses; the theme under test is set the way a link sets it.
  await page.evaluateOnNewDocument((t) => { if (!/theme=/.test(location.hash)) history.replaceState(null, "", `${location.pathname}${location.search}${location.hash ? `${location.hash}&` : "#"}theme=${t}`); }, theme);
  const url = file.startsWith("http") || file.startsWith("file:") ? file : pathToFileURL(resolve(file)).href;
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => Boolean(window.__viz), { timeout: 5000 });
  await page.evaluate(() => document.fonts.ready);
  return { page, errors };
}

export const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

/**
 * Is this a Drawing page (src/drawing/page.mjs, the one route for machines and concepts)? Returns null
 * when it is, or a sentence saying what is missing, so the checks that read only Drawing pages print it
 * instead of crashing.
 */
export async function drawingPageProblem(browser, file) {
  const p = await browser.newPage();
  try {
    await p.goto(pathToFileURL(resolve(file)).href, { waitUntil: "load" });
    const missing = await p.evaluate(() => {
      const v = window.__viz, out = [];
      if (!v) out.push("window.__viz");
      else for (const f of ["seekStep", "seek", "state", "labInputs", "question"]) if (typeof v[f] !== "function") out.push(`__viz.${f}`);
      for (const id of ["fig", "scrub", "stage"]) if (!document.getElementById(id)) out.push(`#${id}`);
      return out;
    });
    return missing.length
      ? `${file} is not a Drawing page: it has no ${missing.join(", ")}. These checks read pages built with drawingPage (src/drawing/page.mjs), the route for machines and concepts alike (references/figures.md). A page from the legacy concept path (scene.ts, the Unfold stage) is checked by scripts/verify.mjs.`
      : null;
  } finally {
    await p.close();
  }
}
