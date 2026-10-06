/**
 * 뮤비 시안을 mp4로 뽑는다. 브라우저에 프레임 시각을 하나씩 넘겨 그린 그림을 받고(실시간이 아니라
 * 프레임 단위라 느린 기계에서도 끊기지 않는다), ffmpeg로 묶어 원곡 WAV를 붙인다.
 *
 *   npm run mv:render                               # 전체 1080p → render/mv/hiphop-mv.mp4
 *   npm run mv:render -- --size 720 --crf 23        # 가벼운 확인용
 *   npm run mv:render -- --from 79 --to 100         # 일부만
 *   npm run mv:render -- --still 5,30,90            # 그 시각의 PNG만 render/mv/stills/
 *   npm run mv:render -- --to 16.5 --fade --out render/mv/look.mp4   # 유화 스타일 시험(기본). 첫 시안은 --look lines
 *
 * 필요한 것: playwright(devDependencies)의 Chromium 또는 설치된 Chrome(CHROME_PATH), ffmpeg.
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "./serve.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const FPS = +arg("fps", 30);
const SIZE = +arg("size", 1080);
const JOBS = Math.max(1, +arg("jobs", Math.min(4, os.cpus().length)));
const QUALITY = +arg("quality", .92);
const CRF = arg("crf", "20");
const OUT = path.resolve(ROOT, arg("out", "render/mv/hiphop-mv.mp4"));
const WAV = path.join(ROOT, "public/demos/emotional-hiphop-draft.wav");
const STILLS = arg("still", "");
const LOOK = arg("look", "");
const FADE = process.argv.includes("--fade");

function run(cmd, args, input) {
  return new Promise((ok, fail) => {
    const p = spawn(cmd, args, { stdio: [input ? "pipe" : "ignore", "inherit", "inherit"] });
    p.on("error", fail);
    p.on("close", (code) => (code === 0 ? ok() : fail(new Error(`${cmd} 종료 코드 ${code}`))));
    if (input) input(p.stdin);
  });
}

async function launch() {
  const opts = { args: ["--force-color-profile=srgb"] };
  if (process.env.CHROME_PATH) return chromium.launch({ ...opts, executablePath: process.env.CHROME_PATH });
  try { return await chromium.launch(opts); }
  catch { return chromium.launch({ ...opts, channel: "chrome" }); }
}

async function openPage(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on("pageerror", (e) => console.error("페이지 오류:", e.message));
  await page.goto(`${url}/?render${LOOK ? `&look=${LOOK}` : ""}`);
  return { page, info: await page.evaluate(() => window.__mv.ready) };
}

const { server, url } = await startServer(0);
const browser = await launch();
try {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  if (STILLS) {
    const dir = path.join(path.dirname(OUT), "stills");
    fs.mkdirSync(dir, { recursive: true });
    const { page } = await openPage(browser, url);
    for (const t of STILLS.split(",").map(Number)) {
      const png = await page.evaluate((t) => window.__mv.still(t), t);
      const file = path.join(dir, `t${String(t.toFixed(2)).padStart(7, "0")}.png`);
      fs.writeFileSync(file, Buffer.from(png.split(",")[1], "base64"));
      console.log(path.relative(ROOT, file));
    }
  } else {
    const { info } = await openPage(browser, url);
    const from = +arg("from", 0);
    const to = Math.min(+arg("to", info.duration), info.duration);
    const total = Math.round((to - from) * FPS);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mv-"));
    const chunk = Math.ceil(total / JOBS);
    const scale = SIZE === 1080 ? [] : ["-vf", `scale=-2:${SIZE}:flags=lanczos`];
    const started = Date.now();
    let done = 0;
    const segs = [];

    await Promise.all(Array.from({ length: JOBS }, async (_, k) => {
      const a = k * chunk, b = Math.min(total, a + chunk);
      if (a >= b) return;
      const seg = path.join(tmp, `seg${k}.mp4`);
      segs[k] = seg;
      const { page } = await openPage(browser, url);
      await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
        ...scale, "-c:v", "libx264", "-preset", "medium", "-crf", CRF, "-pix_fmt", "yuv420p", "-r", String(FPS), seg], async (stdin) => {
        for (let i = a; i < b; i++) {
          const jpg = await page.evaluate(([t, q]) => window.__mv.frame(t, q), [from + i / FPS, QUALITY]);
          if (!stdin.write(Buffer.from(jpg.slice(jpg.indexOf(",") + 1), "base64"))) await new Promise((r) => stdin.once("drain", r));
          if (++done % 150 === 0) {
            const s = (Date.now() - started) / 1000;
            console.log(`${done}/${total} 프레임  ${(done / s).toFixed(1)} fps  남은 시간 약 ${Math.round((total - done) / (done / s))}초`);
          }
        }
        stdin.end();
      });
      await page.close();
    }));

    const list = path.join(tmp, "list.txt");
    fs.writeFileSync(list, segs.filter(Boolean).map((s) => `file '${s}'`).join("\n"));
    await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list,
      "-ss", String(from), "-t", String(to - from), "-i", WAV,
      "-map", "0:v", "-map", "1:a",
      // 일부만 뽑을 때 --fade면 끝 0.8초를 검정·무음으로 닫는다(다시 인코딩)
      ...(FADE ? ["-vf", `fade=out:st=${(to - from - .8).toFixed(3)}:d=0.8`, "-af", `afade=out:st=${(to - from - .8).toFixed(3)}:d=0.8`, "-c:v", "libx264", "-crf", CRF, "-pix_fmt", "yuv420p"] : ["-c:v", "copy"]),
      "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", OUT]);
    fs.rmSync(tmp, { recursive: true, force: true });
    const mb = (fs.statSync(OUT).size / 1e6).toFixed(1);
    console.log(`${path.relative(ROOT, OUT)}  ${total}프레임 · ${mb}MB · ${Math.round((Date.now() - started) / 1000)}초`);
  }
} finally {
  await browser.close();
  server.close();
}
