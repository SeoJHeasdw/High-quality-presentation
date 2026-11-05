/**
 * 곡과 분석은 원본을 한 곳에만 둔다. Remotion은 public/만 서빙하므로 렌더 직전에 복사해 온다(gitignore).
 *   ../deck/public/demos/emotional-hiphop-draft.wav → public/song.wav
 *   ../mv/public/hiphop-analysis.json             → public/analysis.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pairs = [
  ["../deck/public/demos/emotional-hiphop-draft.wav", "public/song.wav"],
  ["../mv/public/hiphop-analysis.json", "public/analysis.json"],
];
for (const [from, to] of pairs) {
  const src = path.resolve(ROOT, from), dst = path.resolve(ROOT, to);
  const s = fs.statSync(src);
  if (fs.existsSync(dst) && fs.statSync(dst).size === s.size && fs.statSync(dst).mtimeMs >= s.mtimeMs) continue;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log("복사", to);
}
