/**
 * 뮤비 시안 미리보기 서버.  `npm run mv`  →  http://localhost:5185
 *
 * vite 없이 돈다. src/*.ts는 타입만 벗겨서(node:module stripTypeScriptTypes,
 * 없으면 typescript) 그대로 보내고, 나머지는 public/에서 준다. 곡(/demos)과 글꼴(/fonts)은
 * 덱과 같은 파일을 쓰므로 ../deck/public에서 준다. 오디오를 앞뒤로 옮길 수 있게 Range
 * 요청을 받는다. render.mjs도 이 서버를 띄워 프레임을 받는다.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DECK_PUBLIC = path.resolve(ROOT, "../deck/public");
const PAGE = path.join(ROOT, "tools/index.html");
const SHARED = ["/demos/", "/fonts/"];
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".ts": "text/javascript",
  ".json": "application/json", ".wav": "audio/wav", ".m4a": "audio/mp4", ".mp3": "audio/mpeg",
  ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
};

async function stripper() {
  const m = await import("node:module");
  if (typeof m.stripTypeScriptTypes === "function") {
    return (code) => m.stripTypeScriptTypes(code, { mode: "strip" });
  }
  const ts = (await import("typescript")).default;
  return (code) => ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, verbatimModuleSyntax: true },
  }).outputText;
}

function inside(base, rel) {
  const file = path.resolve(base, "." + rel);
  return file.startsWith(base + path.sep) ? file : null;
}

export async function startServer(port = 5185) {
  const strip = await stripper();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    const rel = decodeURIComponent(url.pathname);
    const file = rel === "/" ? PAGE
      : rel.startsWith("/src/") ? inside(path.join(ROOT, "src"), rel.slice(4))
      : SHARED.some((d) => rel.startsWith(d)) ? inside(DECK_PUBLIC, rel)
      : inside(path.join(ROOT, "public"), rel);
    if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    const type = TYPES[path.extname(file)] ?? "application/octet-stream";
    if (file.endsWith(".ts")) {
      try {
        res.writeHead(200, { "content-type": type, "cache-control": "no-store" }).end(strip(fs.readFileSync(file, "utf8")));
      } catch (e) {
        res.writeHead(500, { "content-type": "text/plain" }).end(String(e));
      }
      return;
    }
    const size = fs.statSync(file).size;
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
    if (range) {
      const start = range[1] ? +range[1] : 0;
      const end = range[2] ? Math.min(+range[2], size - 1) : size - 1;
      res.writeHead(206, { "content-type": type, "accept-ranges": "bytes", "content-range": `bytes ${start}-${end}/${size}`, "content-length": end - start + 1 });
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { "content-type": type, "accept-ranges": "bytes", "content-length": size, "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((ok, fail) => server.once("error", fail).listen(port, "127.0.0.1", ok));
  return { server, url: `http://localhost:${server.address().port}` };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = +(process.env.PORT ?? 5185);
  const { url } = await startServer(port);
  console.log(`뮤비 시안  ${url}   (Space 재생 · ←/→ 5초 · ↑/↓ 구간 · H HUD · D 편집표)`);
}
