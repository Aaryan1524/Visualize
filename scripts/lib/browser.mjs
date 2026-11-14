// Shared headless-Chrome helpers for shoot.mjs and verify.mjs.
import { existsSync } from "node:fs";
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
  const url = file.startsWith("http") || file.startsWith("file:") ? file : `file://${file}`;
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => Boolean(window.__viz), { timeout: 5000 });
  await page.evaluate(() => document.fonts.ready);
  return { page, errors };
}

export const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
