#!/usr/bin/env node
/*
 * 사이트를 HTML 파일 하나로 묶는다 (file://로 열어도, 메신저로 보내도 동작).
 *
 *   node tools/make-single-html.mjs <출력.html> [--exclude public/아래/경로 ...] [--alias /원래/경로/=/대신/경로/ ...]
 *
 * 1) vite.single.config.ts로 빌드(번들 안의 글꼴·청크는 이미 인라인)
 * 2) CSS의 url(/…)을 data URI로 바꾸고, JS·CSS를 HTML에 인라인
 * 3) public/ 의 파일(영상 프레임, 이미지, 3D 모델)은 base64로 <script type="application/octet-stream"> 에 담고,
 *    fetch()와 이미지 경로(__asset)를 그 데이터로 연결하는 작은 스크립트를 head에 넣는다.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname, relative, sep } from "node:path";

const args = process.argv.slice(2);
const out = args[0];
if (!out) { console.error("usage: make-single-html.mjs <out.html> [--exclude dir]... [--alias from=to]..."); process.exit(1); }
const exclude = [], alias = [];
for (let i = 1; i < args.length; i++) {
  if (args[i] === "--exclude") exclude.push(args[++i]);
  else if (args[i] === "--alias") { const [f, t] = args[++i].split("="); alias.push([f, t]); }
}

const root = process.cwd();
const MIME = { ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml",
  ".glb": "model/gltf-binary", ".json": "application/json", ".bin": "application/octet-stream", ".woff2": "font/woff2" };

execSync("npx vite build --config vite.single.config.ts", { stdio: "inherit" });

const dist = join(root, "dist-single");
let html = readFileSync(join(dist, "index.html"), "utf8");
const jsPath = html.match(/<script[^>]+src="([^"]+\.js)"/)[1];
const cssPath = html.match(/<link[^>]+href="([^"]+\.css)"/)[1];
let js = readFileSync(join(dist, jsPath), "utf8");
let css = readFileSync(join(dist, cssPath), "utf8");

// public/ 의 모든 파일
const pub = join(root, "public");
const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    statSync(p).isDirectory() ? walk(p) : files.push(p);
  }
})(pub);
const rel = (p) => "/" + relative(pub, p).split(sep).join("/");
const dataUri = (p) => `data:${MIME[extname(p)] ?? "application/octet-stream"};base64,${readFileSync(p).toString("base64")}`;

// CSS의 url(/…) → data URI
const inCss = new Set();
css = css.replace(/url\(\s*["']?(\/[^)"']+)["']?\s*\)/g, (m, u) => {
  const f = files.find((p) => rel(p) === u);
  if (!f) { console.warn("CSS에서 못 찾음:", u); return m; }
  inCss.add(u);
  return `url(${dataUri(f)})`;
});

// JS의 이미지 경로 리터럴 → __asset("…")  (동적 템플릿 `/film/poster/a${i}.jpg` 포함)
let rewritten = 0;
js = js.replace(/(["'`])(\/(?:images|projects|film\/poster|film\/[^/"'`$]+\.\w+|mark\.svg|favicon\.svg)[^"'`]*)\1/g, (m, q, p) => {
  rewritten++;
  return `__asset(${q}${p}${q})`;
});

// 담을 파일: 글꼴(CSS에 이미 들어감)·제외 경로·라이선스 텍스트 빼고 전부. CSS로만 쓰인 것도 뺀다.
const embedded = files.filter((p) => {
  const r = rel(p);
  if (r.startsWith("/fonts/") || extname(p) === ".txt") return false;
  if (exclude.some((e) => r.startsWith("/" + e.replace(/^\/+/, "")))) return false;
  if (inCss.has(r) && !js.includes(r)) return false;
  return true;
});

const tags = embedded.map((p) => {
  const r = rel(p);
  return `<script type="application/octet-stream" data-p="${r}" data-t="${MIME[extname(p)] ?? "application/octet-stream"}">${readFileSync(p).toString("base64")}</script>`;
}).join("\n");

const shim = `<script>
(function () {
  var aliases = ${JSON.stringify(alias)};
  var reg = null, bytes = {}, urls = {};
  function index() {
    reg = {};
    var n = document.querySelectorAll('script[data-p]');
    for (var i = 0; i < n.length; i++) reg[n[i].getAttribute('data-p')] = n[i];
  }
  function norm(u) {
    try { u = new URL(u, location.href).pathname; } catch (e) {}
    try { u = decodeURIComponent(u); } catch (e) {}
    for (var i = 0; i < aliases.length; i++) if (u.indexOf(aliases[i][0]) === 0) u = aliases[i][1] + u.slice(aliases[i][0].length);
    return u;
  }
  function find(u) {
    if (!reg) index();
    var p = norm(u);
    if (reg[p]) return p;
    // 폴더 이름 앞에 붙은 file:// 경로 조각을 떼고 뒤에서부터 맞춰 본다
    for (var k in reg) if (p.length > k.length && p.slice(-k.length) === k) return k;
    return null;
  }
  function get(p) {
    if (bytes[p]) return bytes[p];
    var s = atob(reg[p].textContent.trim()), n = s.length, u = new Uint8Array(n);
    for (var i = 0; i < n; i++) u[i] = s.charCodeAt(i);
    reg[p].textContent = '';
    return (bytes[p] = u);
  }
  window.__asset = function (u) {
    var p = find(u);
    if (!p) return u;
    if (!urls[p]) urls[p] = URL.createObjectURL(new Blob([get(p)], { type: reg[p].getAttribute('data-t') }));
    return urls[p];
  };
  var orig = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : input && input.url ? input.url : String(input);
    if (!/^(blob|data):/.test(url)) {
      var p = find(url);
      if (p) {
        var u = get(p);
        return Promise.resolve(new Response(u, { status: 200, headers: { 'content-type': reg[p].getAttribute('data-t'), 'content-length': String(u.length) } }));
      }
    }
    return orig(input, init);
  };
})();
</script>`;

const favicon = files.find((p) => /\/(favicon|mark)\.svg$/.test(rel(p)));
html = html
  .replace(/\s*<link[^>]+rel="preload"[^>]*>/g, "")
  .replace(/<meta property="og:image"[^>]*>\s*/g, "")
  .replace(/<link rel="icon"[^>]*>/, favicon ? `<link rel="icon" type="image/svg+xml" href="${dataUri(favicon)}" />` : "")
  .replace(/\s*<script[^>]+src="[^"]+\.js"[^>]*><\/script>/, "")
  .replace(/\s*<link[^>]+href="[^"]+\.css"[^>]*>/, "")
  .replace("</head>", () => `${shim}\n<style>${css}</style>\n</head>`)
  .replace("</body>", () => `${tags}\n<script type="module">${js.replace(/<\/script/gi, "<\\/script")}</script>\n</body>`);

writeFileSync(out, html);
const mb = (statSync(out).size / 1048576).toFixed(1);
console.log(`\n${out}: ${mb} MB — 파일 ${embedded.length}개 포함, 이미지 경로 ${rewritten}곳 연결`);
const left = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1]);
if (left.length) console.warn("남은 절대경로:", left);
if (!existsSync(out)) process.exit(1);
