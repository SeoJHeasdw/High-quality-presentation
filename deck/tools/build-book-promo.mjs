#!/usr/bin/env node
// 15번 책 장면의 책 소개판: 덱의 머리말(TEL / JAVIS)·번호·앞 장과 잇는 말 없이 혼자 서는 영상(mp4)과 한 파일 HTML.
//   node tools/build-book-promo.mjs [내보낼 폴더] [--bgm 음악.wav --bgm-at 초]     (기본 폴더: ~/Desktop/백승헌)
// --bgm을 주면 그 음악의 --bgm-at초부터 영상 길이만큼 잘라 영상에 넣고(-16 LUFS, 끝 2.8초에 걸쳐 줄인다),
// HTML에는 같은 자리부터 곡 끝까지 넣는다(재생 단추로 시작해 한 번 흐른다).
// 재료: render/book/frames/f0000~f0680.png(tools/render-book.py, 꼬리 261~680 포함), tools/book-promo.html, public/fonts/PretendardVariable.woff2.
// pyftsubset(fonttools)이 있으면 글꼴에서 쓰는 글자만 남긴다(PYFTSUBSET로 경로를 줄 수 있다). 없으면 글꼴 전체를 넣는다.
//
// 영상(30fps)의 순서: 조각 0(책이 선다) → 책 소개의 질문 넷(6.5초) → 조각 1(책이 펼쳐져 문 앞의 사람으로) → 꼬리 동안 241쪽 문장 → 끝 화면.
// 글은 HTML의 ?record 모드에서 프레임마다 투명하게 찍어 Blender 프레임 위에 얹는다. 그래서 영상과 HTML의 글이 같다.
import { chromium } from "playwright";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FRAMES = join(ROOT, "render/book/frames");
const WORK = join(ROOT, "render/book/promo");
const args = process.argv.slice(2);
const option = (name) => { const i = args.indexOf(name); return i < 0 ? null : args.splice(i, 2)[1]; };
const BGM = option("--bgm"), BGM_AT = Number(option("--bgm-at") || 0);
const OUT = resolve(args[0] || join(homedir(), "Desktop", "백승헌"));
const NAME = "몫_인간의자리_책소개".normalize("NFC");
const FPS = 30;
const END0 = 120, LAST = 260, TAIL_END = 680;   // tools/render-book.py의 ANCHORS[1], LAST, LAST + TAIL

const frame = (f) => join(FRAMES, `f${String(f).padStart(4, "0")}.png`);
for (const f of [0, END0, LAST, TAIL_END]) if (!existsSync(frame(f))) throw new Error(`없는 프레임: ${frame(f)} (render-book.py를 먼저 돌린다)`);
rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true }); mkdirSync(OUT, { recursive: true });
const ff = (...args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
// Blender 프레임은 sRGB다. BT.709로 바꾸고 표시해 두어야 브라우저의 정지 화면(jpg)과 영상의 색이 같다.
// PNG의 sRGB 표시가 필터를 지나 그대로 남으므로(color_trc=iec61966-2-1) setparams로 덮어쓴다.
const TO709 = "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv";
const H264 = (crf) => ["-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-tune", "film", "-crf", String(crf), "-g", "30",
  "-vf", TO709, "-movflags", "+faststart", "-an"];

// ── 1. HTML에 넣을 조각과 정지 화면 ──────────────────────────────────────────────
// 조각 0은 0~120, 조각 1은 120~680(덱의 1단계 140프레임 + 꼬리). 첫 프레임이 앞 정지 화면과 같다.
const seq = (f0, f1) => ["-framerate", String(FPS), "-start_number", String(f0), "-i", join(FRAMES, "f%04d.png"), "-frames:v", String(f1 - f0 + 1)];
ff(...seq(0, END0), ...H264(19), join(WORK, "seg-0.mp4"));
ff(...seq(END0, TAIL_END), ...H264(21), join(WORK, "seg-1.mp4"));
[[0, "a-0"], [END0, "a-1"], [TAIL_END, "a-2"]].forEach(([f, n]) => ff("-i", frame(f), "-q:v", "2", join(WORK, `${n}.jpg`)));

// ── 2. 글꼴 ─────────────────────────────────────────────────────────────────
const template = readFileSync(join(ROOT, "tools/book-promo.html"), "utf8");
const FONT = join(ROOT, "public/fonts/PretendardVariable.woff2");
let font = FONT;
const subsetter = process.env.PYFTSUBSET || "pyftsubset";
try {
  const text = template.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->|<[^>]+>/g, " ") + "0123456789 ▶↗→←·「」『』—:,.?!%";
  writeFileSync(join(WORK, "glyphs.txt"), text);
  execFileSync(subsetter, [FONT, `--text-file=${join(WORK, "glyphs.txt")}`, "--flavor=woff2", "--layout-features=*", `--output-file=${join(WORK, "font.woff2")}`], { stdio: "inherit" });
  font = join(WORK, "font.woff2");
} catch { console.warn("pyftsubset이 없어 글꼴 전체(2MB)를 넣는다"); }

// ── 3. 음악(선택) ────────────────────────────────────────────────────────────
// 영상 구간의 음량을 재서 -16 LUFS가 되게 올리거나 내리고(true peak -1 dB 아래), HTML판도 같은 이득을 쓴다.
const N_FRAMES = END0 + 1 + Math.round(6.5 * FPS) + (TAIL_END - END0);   // 4번 시간표의 N과 같다
const DUR = N_FRAMES / FPS;
let bgmFilm = null, bgmPage = null;
if (BGM) {
  const { stderr } = spawnSync("ffmpeg", ["-hide_banner", "-ss", String(BGM_AT), "-t", String(DUR), "-i", resolve(BGM), "-af", "loudnorm=I=-16:TP=-1:print_format=json", "-f", "null", "-"], { encoding: "utf8" });
  const json = stderr.slice(stderr.lastIndexOf("{")); const m = JSON.parse(json.slice(0, json.indexOf("}") + 1));   // 뒤에 다른 기록 줄이 붙는다
  const gain = Math.min(-16 - Number(m.input_i), -1.5 - Number(m.input_tp));
  const shape = (fadeOutAt, fadeOut) => `afade=t=in:d=0.3,afade=t=out:st=${fadeOutAt.toFixed(3)}:d=${fadeOut},volume=${gain.toFixed(2)}dB,alimiter=limit=0.89:level=false`;
  bgmFilm = join(WORK, "bgm-film.wav"); bgmPage = join(WORK, "bgm-page.m4a");
  ff("-ss", String(BGM_AT), "-t", String(DUR), "-i", resolve(BGM), "-af", shape(DUR - 2.8, 2.8), "-ar", "48000", bgmFilm);
  const total = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", resolve(BGM)], { encoding: "utf8" }));
  ff("-ss", String(BGM_AT), "-i", resolve(BGM), "-af", shape(total - BGM_AT - 3, 3), "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", bgmPage);
  console.log(`음악 ${BGM} @${BGM_AT}s: ${Number(m.input_i).toFixed(1)} LUFS → ${gain >= 0 ? "+" : ""}${gain.toFixed(1)} dB`);
}

// ── 4. 한 파일 HTML ──────────────────────────────────────────────────────────
const b64 = (p) => readFileSync(p).toString("base64");
const html = template
  .replace("__FONT__", `data:font/woff2;base64,${b64(font)}`)
  .replace("__A0__", b64(join(WORK, "a-0.jpg"))).replace("__A1__", b64(join(WORK, "a-1.jpg"))).replace("__A2__", b64(join(WORK, "a-2.jpg")))
  .replace("__SEG0__", b64(join(WORK, "seg-0.mp4"))).replace("__SEG1__", b64(join(WORK, "seg-1.mp4")))
  .replace("__BGM__", bgmPage ? b64(bgmPage) : "");
const htmlPath = join(OUT, `${NAME}.html`);
writeFileSync(htmlPath, html);

// ── 5. 영상의 시간표 ─────────────────────────────────────────────────────────
// bg[i]: 출력 프레임 i에 깔 Blender 프레임. 글은 [나온 뒤 ms, 사라지기 시작한 뒤 ms|null].
const HOLD0 = Math.round(6.5 * FPS);                 // 책이 선 화면에서 질문을 읽는 시간
const S0 = END0 + 1, S1 = S0 + HOLD0, ST = S1 + (LAST - END0), N = ST + (TAIL_END - LAST);
if (N !== N_FRAMES) throw new Error("음악 길이와 영상 길이가 어긋난다");
const bg = Array.from({ length: N }, (_, i) => i < S0 ? i : i < S1 ? END0 : END0 + 1 + (i - S1));
const A_IN = S0 + 6, A_OUT = S1 - 12;               // 질문: 책이 선 뒤 0.2초에 뜨고, 조각 1 직전 0.4초에 사라진다
const B_IN = ST + 6, B_OUT = B_IN + 7 * FPS;        // 241쪽: 꼬리가 시작될 때 뜨고 7초 읽힌다
const C_IN = B_OUT + 12 + 6;                         // 끝 화면
const FADE = 24;                                     // 마지막 0.8초는 검게
const ms = (i, f) => Math.round((i - f) * 1000 / FPS);
const span = (i, fin, fout) => i < fin ? null : (fout == null || i < fout) ? [ms(i, fin), null] : i < fout + 12 ? [ms(i, fin), ms(i, fout)] : null;
const state = (i) => ({
  a: span(i, A_IN, A_OUT), b: span(i, B_IN, B_OUT), c: span(i, C_IN, null),
  shade: i >= A_IN && i < A_OUT + 12 ? (i < A_OUT ? [ms(i, A_IN), null] : [0, ms(i, A_OUT)]) : i >= B_IN ? [ms(i, B_IN), null] : null,
});
// 다 떠오른 뒤에는 같은 그림이라 한 번만 찍는다(질문 3.8초, 끝 화면 2.6초, 그늘 0.8초).
const settledKey = (st) => JSON.stringify(st, (k, v) => Array.isArray(v) && typeof v[0] === "number" ? [Math.min(v[0], 4000), v[1]] : v);

// ── 6. 글만 투명하게 찍기 ────────────────────────────────────────────────────
const OV = join(WORK, "ov"), BG = join(WORK, "bg");
mkdirSync(OV); mkdirSync(BG);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(`${pathToFileURL(htmlPath).href}?record`);
await page.evaluate(() => window.__ready);
let last = null, lastFile = null, shots = 0;
for (let i = 0; i < N; i++) {
  const st = state(i), key = settledKey(st), file = join(OV, `${String(i).padStart(5, "0")}.png`);
  if (key === last) copyFileSync(lastFile, file);
  else { await page.evaluate((s) => window.__seek(s), st); await page.screenshot({ path: file, omitBackground: true }); shots++; }
  last = key; lastFile = file;
  symlinkSync(frame(bg[i]), join(BG, `${String(i).padStart(5, "0")}.png`));
}
await browser.close();
console.log(`글 ${shots}장 찍음 / 프레임 ${N}개 (${(N / FPS).toFixed(1)}초)`);

// ── 7. 합치기 ────────────────────────────────────────────────────────────────
const mp4 = join(OUT, `${NAME}.mp4`);
ff("-framerate", String(FPS), "-i", join(BG, "%05d.png"), "-framerate", String(FPS), "-i", join(OV, "%05d.png"), ...(bgmFilm ? ["-i", bgmFilm] : []),
  "-filter_complex", `[0:v][1:v]overlay=0:0:format=auto,fade=t=out:st=${((N - FADE) / FPS).toFixed(3)}:d=${(FADE / FPS).toFixed(3)},${TO709}[v]`,
  "-map", "[v]", "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-tune", "film", "-crf", "18", "-g", "60",
  ...(bgmFilm ? ["-map", "2:a", "-c:a", "aac", "-b:a", "192k", "-shortest"] : ["-an"]), "-movflags", "+faststart", mp4);
console.log(`${htmlPath}\n${mp4}`);
