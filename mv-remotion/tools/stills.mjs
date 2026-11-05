/**
 * 미리보기 정지 화면. 한 번 묶고(bundle) 여러 시각을 찍는다. 막 진입점을 주면 그 막만 묶는다.
 *   node tools/stills.mjs --entry src/entries/act1.ts --times 3,8.5,14 [--scale .5] [--out out/stills] [--sheet out/a1.jpg]
 *   --times는 초. 30fps 프레임으로 바꿔 찍는다.
 */
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const entry = path.resolve(ROOT, arg("entry", "src/index.ts"));
const times = arg("times", "1").split(",").map(Number);
const scale = +arg("scale", ".5");
const out = path.resolve(ROOT, arg("out", "out/stills"));
const sheet = arg("sheet", "");
const BROWSER = process.env.REMOTION_BROWSER ?? "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
execFileSync("node", [path.join(ROOT, "tools/prepare-assets.mjs")], { stdio: "inherit" });
fs.mkdirSync(out, { recursive: true });
const serveUrl = await bundle({ entryPoint: entry, publicDir: path.join(ROOT, "public") });
const browserExecutable = fs.existsSync(BROWSER) ? BROWSER : null;
const comp = await selectComposition({ serveUrl, id: "MV", inputProps: {}, browserExecutable });
const tag = path.basename(entry).replace(/\.[jt]sx?$/, "");
const files = [];
for (const t of times) {
  const frame = Math.min(comp.durationInFrames - 1, Math.round(t * 30));
  const file = path.join(out, `${tag}-t${t.toFixed(2)}.jpg`);
  const t0 = Date.now();
  await renderStill({ serveUrl, composition: comp, frame, output: file, imageFormat: "jpeg", jpegQuality: 88, scale, browserExecutable, inputProps: { ...comp.props, audio: false }, chromiumOptions: { gl: "swiftshader" } });
  console.log(`${file}  (${Date.now() - t0}ms)`);
  files.push(file);
}
if (sheet) {
  execFileSync("python3", [path.join(ROOT, "tools/sheet.py"), path.resolve(ROOT, sheet), ...files], { stdio: "inherit" });
}
