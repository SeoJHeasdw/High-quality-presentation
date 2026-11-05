/**
 * mp4 렌더. 한 번 묶고 renderMedia로 뽑는다(곡 포함).
 *   node tools/render.mjs                                  # 전체 1080p → out/mv.mp4
 *   node tools/render.mjs --from 44 --to 55 --scale .5 --out out/part.mp4   # 일부(초), 절반 크기
 *   node tools/render.mjs --entry src/entries/act2.ts --from 44 --to 79.5
 *   --concurrency 4 --crf 18
 */
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const entry = path.resolve(ROOT, arg("entry", "src/index.ts"));
const out = path.resolve(ROOT, arg("out", "out/mv.mp4"));
const scale = +arg("scale", "1");
const crf = +arg("crf", "18");
const concurrency = +arg("concurrency", String(Math.max(1, os.cpus().length)));
const BROWSER = process.env.REMOTION_BROWSER ?? "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
execFileSync("node", [path.join(ROOT, "tools/prepare-assets.mjs")], { stdio: "inherit" });
fs.mkdirSync(path.dirname(out), { recursive: true });
const serveUrl = await bundle({ entryPoint: entry, publicDir: path.join(ROOT, "public") });
const browserExecutable = fs.existsSync(BROWSER) ? BROWSER : null;
const comp = await selectComposition({ serveUrl, id: "MV", inputProps: {}, browserExecutable });
const from = arg("from", null), to = arg("to", null);
const frameRange = from !== null || to !== null
  ? [Math.round(+(from ?? 0) * 30), Math.min(comp.durationInFrames - 1, Math.round(+(to ?? comp.durationInFrames / 30) * 30) - 1)]
  : null;
const t0 = Date.now();
let last = 0;
await renderMedia({
  serveUrl, composition: comp, codec: "h264", outputLocation: out, crf, scale, concurrency, frameRange,
  imageFormat: "jpeg", jpegQuality: 94, browserExecutable, chromiumOptions: { gl: "swiftshader" },
  inputProps: comp.props, x264Preset: "slow", pixelFormat: "yuv420p",
  onProgress: ({ progress, renderedFrames }) => {
    if (Date.now() - last > 15000) { last = Date.now(); console.log(`${(progress * 100).toFixed(0)}%  ${renderedFrames}프레임  ${((Date.now() - t0) / 1000).toFixed(0)}초`); }
  },
});
console.log(`${out}  ${((Date.now() - t0) / 1000).toFixed(0)}초`);
