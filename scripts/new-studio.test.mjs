import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { extractStudioConfigFromHtml } from "./studio-voice.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const NEW_STUDIO = join(ROOT, "scripts", "new-studio.mjs");
const TMP_ROOT = mkdtempSync(join(tmpdir(), "viz-studio-test-"));

after(() => {
  rmSync(TMP_ROOT, { recursive: true, force: true });
});

describe("scripts/new-studio.mjs 2-Engine scaffolder", () => {
  const cases = [
    {
      engine: "A",
      slug: "perfume-atomizer-demo",
      topic: "Perfume Venturi atomizer",
      kit: "engine-a.ts",
      hint: "Drag to orbit · Scroll to zoom",
      primitives: ["createStudioStage", "cutawayCylinder", "baseMount"],
    },
    {
      engine: "A",
      slug: "planetary-gear-demo",
      topic: "Planetary gear transmission",
      kit: "engine-a.ts",
      hint: "Drag to orbit · Scroll to zoom",
      primitives: ["createStudioStage", "cutawayCylinder", "baseMount"],
    },
    {
      engine: "C",
      slug: "raft-demo",
      topic: "Raft consensus protocol",
      kit: "engine-c.ts",
      hint: "",
      primitives: ["createEditorialStage", "strip", "track", "arcLink"],
    },
  ];

  for (const tc of cases) {
    it(`scaffolds and builds a valid Engine ${tc.engine} project for "${tc.topic}"`, () => {
      const projDir = join(TMP_ROOT, tc.slug);
      const stdout = execFileSync(
        process.execPath,
        [NEW_STUDIO, tc.slug, "--topic", tc.topic, "--dir", projDir],
        { encoding: "utf8", cwd: ROOT },
      );

      assert.match(stdout, new RegExp(`Engine ${tc.engine}`), `Expected Engine ${tc.engine} in output:\n${stdout}`);
      assert.match(stdout, /Primitives:/);
      // Next steps must print exact resolved absolute paths to <skill>/scripts/...
      assert.ok(
        stdout.includes(join(ROOT, "scripts", "check-studio.mjs")),
        `Expected resolved check-studio.mjs path in Next steps:\n${stdout}`,
      );
      assert.ok(
        stdout.includes(join(ROOT, "scripts", "studio-review.mjs")),
        `Expected resolved studio-review.mjs path in Next steps:\n${stdout}`,
      );
      assert.ok(
        stdout.includes(join(ROOT, "scripts", "studio-voice.mjs")),
        `Expected resolved studio-voice.mjs path in Next steps:\n${stdout}`,
      );
      assert.match(stdout, /check-studio\.mjs .* --shots /);
      assert.match(stdout, /studio-review\.mjs brief /);
      assert.match(stdout, /studio-review\.mjs verify /);
      assert.match(stdout, /studio-voice\.mjs --from-html /);

      for (const file of ["model.mjs", "model.test.mjs", "scene.mjs", "build.mjs"]) {
        assert.ok(existsSync(join(projDir, file)), `Missing generated ${file}`);
      }

      // 1. Generated model.test.mjs must pass cleanly under node --test
      execFileSync(process.execPath, ["--test", join(projDir, "model.test.mjs")], {
        stdio: "pipe",
        cwd: ROOT,
      });

      // 2. Generated scene.mjs and build.mjs must pass syntax checks and satisfy Studio contract
      execFileSync(process.execPath, ["--check", join(projDir, "scene.mjs")], { stdio: "pipe" });
      execFileSync(process.execPath, ["--check", join(projDir, "build.mjs")], { stdio: "pipe" });

      const sceneSrc = readFileSync(join(projDir, "scene.mjs"), "utf8");
      assert.ok(sceneSrc.includes(tc.kit), `scene.mjs must import ${tc.kit}`);
      assert.ok(sceneSrc.includes("globalThis.STUDIO_SCENE = { mount }"), "scene.mjs must export STUDIO_SCENE");
      assert.ok(
        sceneSrc.includes(`engineKind: ${JSON.stringify(tc.engine)}`),
        `scene.mjs must expose engineKind: "${tc.engine}"`,
      );
      assert.ok(sceneSrc.includes("getRegisteredIds()"), "scene.mjs must expose getRegisteredIds()");
      assert.ok(sceneSrc.includes("getCameraPresets()"), "scene.mjs must expose getCameraPresets()");
      for (const prim of tc.primitives) {
        assert.ok(sceneSrc.includes(prim), `scene.mjs for Engine ${tc.engine} must use ${prim}`);
      }

      const buildSrc = readFileSync(join(projDir, "build.mjs"), "utf8");
      assert.ok(buildSrc.includes(`hint: ${JSON.stringify(tc.hint)}`), `build.mjs must set hint to ${JSON.stringify(tc.hint)}`);

      // 3. Running build.mjs WITHOUT --out for an external --dir must write into <dir>/dist/<slug>.html (never repo dist/)
      execFileSync(process.execPath, [join(projDir, "build.mjs")], {
        stdio: "pipe",
        cwd: TMP_ROOT,
      });
      const defaultExternalOut = join(projDir, "dist", `${tc.slug}.html`);
      assert.ok(existsSync(defaultExternalOut), `Expected default external HTML at ${defaultExternalOut}`);

      // 4. Also verify explicit --out works and inspect extracted STUDIO_CONFIG
      const outHtml = join(TMP_ROOT, `${tc.slug}.html`);
      execFileSync(process.execPath, [join(projDir, "build.mjs"), "--out", outHtml], {
        stdio: "pipe",
        cwd: ROOT,
      });
      assert.ok(existsSync(outHtml), `Expected built HTML at ${outHtml}`);

      const html = readFileSync(outHtml, "utf8");
      assert.ok(html.startsWith("<!doctype html>"));
      assert.ok(html.includes("STUDIO_CONFIG"));
      assert.ok(html.includes("STUDIO_SCENE"));
      assert.ok(html.includes("simModel"));
      if (tc.hint) {
        assert.ok(html.includes(tc.hint), `Expected HTML to include hint "${tc.hint}"`);
      } else {
        assert.ok(!html.includes("Drag to orbit"), "Engine C HTML must not include 3D orbit hint");
      }

      const cfg = extractStudioConfigFromHtml(html);
      assert.equal(cfg.sceneId, tc.slug);
      assert.equal(cfg.steps.length, 3);
      assert.equal(cfg.variants.length, 2);
      assert.ok(cfg.telemetry.length >= 2);
      assert.ok(cfg.controls.length >= 1);
      assert.ok(cfg.steps.some((s) => Boolean(s.tryOut)), "Expected at least one verified micro-challenge");

      if (tc.engine === "C") {
        for (const step of cfg.steps) {
          assert.ok(
            Array.isArray(step.callouts) && step.callouts.length <= 1,
            `Engine C starter step ${step.step} must use max 1 callout, got ${step.callouts?.length}`,
          );
          for (const c of step.callouts) {
            assert.ok(
              c.place === "top" || c.place === "bottom",
              `Engine C starter callout "${c.label}" must specify place: "top" or "bottom", got ${c.place}`,
            );
          }
        }
      }
    });
  }

  it("refuses silent low-confidence guessing without --engine and succeeds when --engine C is passed", () => {
    const dirFail = join(TMP_ROOT, "flib-fail");
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [NEW_STUDIO, "flib-fail", "--topic", "flibbertigibbet", "--dir", dirFail],
          { stdio: "pipe", cwd: ROOT },
        ),
      (err) =>
        err.status !== 0 &&
        /--engine A/i.test(String(err.stderr || "")) &&
        /--engine C/i.test(String(err.stderr || "")),
    );
    assert.equal(existsSync(dirFail), false, "Refused scaffold must not create target directory");

    const dirOk = join(TMP_ROOT, "flib-ok");
    const stdout = execFileSync(
      process.execPath,
      [NEW_STUDIO, "flib-ok", "--topic", "flibbertigibbet", "--engine", "C", "--dir", dirOk],
      { encoding: "utf8", cwd: ROOT },
    );
    assert.match(stdout, /Engine C/);
    assert.ok(existsSync(join(dirOk, "scene.mjs")));
    execFileSync(process.execPath, ["--test", join(dirOk, "model.test.mjs")], { stdio: "pipe", cwd: ROOT });
    execFileSync(process.execPath, [join(dirOk, "build.mjs")], { stdio: "pipe", cwd: TMP_ROOT });
    assert.ok(existsSync(join(dirOk, "dist", "flib-ok.html")));
  });

  it("honors explicit --engine overrides including 3d/2d aliases and rejects retired Engine B", () => {
    const dir3d = join(TMP_ROOT, "override-3d");
    const out3d = execFileSync(
      process.execPath,
      [NEW_STUDIO, "override-3d", "--topic", "LRU cache", "--engine", "3d", "--dir", dir3d],
      { encoding: "utf8", cwd: ROOT },
    );
    assert.match(out3d, /Engine A/);
    assert.ok(readFileSync(join(dir3d, "scene.mjs"), "utf8").includes("engine-a.ts"));

    const dir2d = join(TMP_ROOT, "override-2d");
    const out2d = execFileSync(
      process.execPath,
      [NEW_STUDIO, "override-2d", "--topic", "Turbofan jet engine", "--engine", "2d", "--dir", dir2d],
      { encoding: "utf8", cwd: ROOT },
    );
    assert.match(out2d, /Engine C/);
    assert.ok(readFileSync(join(dir2d, "scene.mjs"), "utf8").includes("engine-c.ts"));

    const dirB = join(TMP_ROOT, "override-b");
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [NEW_STUDIO, "override-b", "--topic", "Heat pump", "--engine", "B", "--dir", dirB],
          { stdio: "pipe", cwd: ROOT },
        ),
      (err) => err.status !== 0 && /2-Engine architecture/i.test(String(err.stderr || "")),
    );
  });
});
