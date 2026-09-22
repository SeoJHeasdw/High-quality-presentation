/**
 * 장표 번호가 실제로 어디인가.  `npm run where -- 100-110`  ·  `npm run where -- rag-pipeline`
 *
 * 사람은 **번호**로 말하고("100~110 비주얼 올려줘") 덱은 **ID 와 배열 순서**로
 * 주소를 매긴다. 그 사이를 매번 grep 으로 이어 붙이는 게 가장 흔한 요청의
 * 가장 틀리기 쉬운 단계였다 — 번호를 잘못 짚으면 수정 전체가 엉뚱한 장표에
 * 떨어지는데 빌드도 린터도 조용하다.
 *
 * 게다가 번호는 **밀린다.** 중간에 한 장을 끼우면 그 뒤가 전부 하나씩
 * 밀리고, 주석과 문서의 번호만 조용히 틀려진다 (린터 검사 11 「죽은 번호」가
 * 그래서 있다). 그러니 번호는 기억하지 말고 **그때그때 여기서 푼다.**
 *
 * ── 무엇을 돌려주나 ────────────────────────────────────────
 *   번호 · ID · 챕터 · 레슨 · 화면 파일:줄 · 대본 파일:줄 · steps ↔ ### 개수
 *
 * 마지막 칸이 어긋나면 그건 린터 검사 7 이 오류로 잡는 자리다. 여기서 먼저
 * 보이면 고치러 들어가기 전에 안다.
 *
 * ── 쓰는 법 ────────────────────────────────────────────────
 *   node tools/where.mjs 100-110         그 범위
 *   node tools/where.mjs 128             한 장
 *   node tools/where.mjs 100-110,205     섞어서
 *   node tools/where.mjs rag-pipeline    ID 로 (번호가 몇 번인지 되묻지 않게)
 *   node tools/where.mjs ch03            챕터 전체 범위
 *   node tools/where.mjs 100-110 --files 열어야 할 파일 목록만
 *   node tools/where.mjs rag-pipeline --deps 렌더러·BEATS·CSS와 영향 후보
 *   node tools/where.mjs rag-pipeline --deps --json 선택자별 줄 위치까지
 *
 * 번호는 **덱 전역 번호**다 — 린터가 찍고 `shots` 가 받는 그 번호.
 * 수집은 `chapters.mjs` 가 하므로 셋과 같은 순서를 본다. 읽기 전용이다.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chapterEntries, chapterFiles } from "./chapters.mjs";
import { readCourse } from "./source-model.mjs";
import { dependencyReport } from "./where-deps.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT_DIR = path.join(ROOT, "script/course");
const rel = (p) => path.relative(ROOT, p);

const argv = process.argv.slice(2);
const FILES_ONLY = argv.includes("--files");
const target = argv.find((a) => !a.startsWith("--"));

if (!target) {
  console.error(
    "사용법:\n"
    + "  node tools/where.mjs 100-110      그 범위가 어느 파일 몇 줄인지\n"
    + "  node tools/where.mjs 128          한 장\n"
    + "  node tools/where.mjs rag-pipeline ID 로\n"
    + "  node tools/where.mjs ch03         챕터 전체\n"
    + "  node tools/where.mjs 100-110 --files  열어야 할 파일 목록만",
  );
  process.exit(2);
}

/* ── 덱을 통째로 한 번 훑어 번호를 매긴다 ────────────────────
   `chapters.mjs` 가 주는 파일 순서가 곧 덱 순서다. 그 순서대로 파일을
   줄 단위로 읽으면서 `id:` 를 세면 전역 번호가 나온다 — chapterSource()
   는 이어 붙인 문자열이라 줄 번호가 사라지므로 여기서만 따로 읽는다.
   세는 규칙(`^\s+id:\s*"…"`)은 chapters.mjs 와 같아야 한다. */
function buildIndex() {
  const slides = [];
  let n = 0;

  for (const entry of chapterEntries()) {
    for (const file of chapterFiles(entry)) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      let lesson = null;

      for (let i = 0; i < lines.length; i++) {
        const marker = lines[i].match(/^\s*\/\/ ── (L\d+[^─]*?)\s*─+\s*$/);
        if (marker) { lesson = marker[1].trim(); continue; }

        const m = lines[i].match(/^\s+id:\s*"([a-z0-9-]+)"/);
        if (!m) continue;

        slides.push({
          n: ++n,
          id: m[1],
          chapter: entry.key,
          lesson,
          file,
          line: i + 1,
          steps: stepsOf(lines, i),
        });
      }
    }
  }
  return slides;
}

/* 그 화면 객체 안의 `steps:`. 객체는 `^  {$` 로 열린다 — id 앞뒤 어디에
   있어도 잡히도록 여는 `{` 부터 다음 `{` 직전까지를 본다.

   `steps` 를 선언하지 않은 화면은 `reveal`·항목 수로 상태가 정해져서
   (lint-course 의 `slideStates`) 여기서는 세지 않는다. 반쯤 아는 값으로
   ✗ 를 찍으면 그게 오탐이 되고, 오탐이 섞이면 이 표를 안 믿게 된다. */
function stepsOf(lines, idLine) {
  let from = idLine;
  while (from > 0 && !/^\s*\{\s*$/.test(lines[from])) from--;
  let to = idLine + 1;
  while (to < lines.length && !/^\s*\{\s*$/.test(lines[to])) to++;

  for (let i = from; i < to; i++) {
    const m = lines[i].match(/^\s*steps:\s*(\d+)/);
    if (m) return Number(m[1]);
  }
  return null;
}

/* ── 대본 쪽 ────────────────────────────────────────────────
   `## 화면ID` 절과 그 안의 `### ` 개수. 파싱 규칙은 lint-course 의
   parseScript 와 같은 것을 본다 (거긴 개수만 세고 줄 번호를 안 남긴다). */
function scriptIndex(chapter) {
  const file = path.join(SCRIPT_DIR, `${chapter}.md`);
  if (!fs.existsSync(file)) return new Map();

  const lines = fs.readFileSync(file, "utf8").split("\n");
  const out = new Map();
  let cur = null;

  for (let i = 0; i < lines.length; i++) {
    const head = lines[i].match(/^## (.+?)\s*$/);
    if (head) {
      cur = { line: i + 1, steps: 0, file };
      out.set(head[1].trim(), cur);
      continue;
    }
    if (cur && /^### /.test(lines[i])) cur.steps++;
  }
  return out;
}

/* ── 무엇을 물어봤나 ────────────────────────────────────────
   번호 · 번호 범위 · 쉼표로 이은 것 · 화면 ID · 챕터 키를 다 받는다. */
function resolve(slides, q) {
  if (/^ch\d\d$/.test(q)) return slides.filter((s) => s.chapter === q);

  if (/^\d+([-,]\d+)*$/.test(q)) {
    const want = new Set();
    for (const part of q.split(",")) {
      const [a, b] = part.split("-").map(Number);
      for (let i = a; i <= (b ?? a); i++) want.add(i);
    }
    return slides.filter((s) => want.has(s.n));
  }

  const hit = slides.filter((s) => s.id === q);
  if (hit.length) return hit;
  return slides.filter((s) => s.id.includes(q));
}

const slides = buildIndex();
const found = resolve(slides, target);

if (!found.length) {
  console.error(
    `찾지 못했다: ${target}\n`
    + `덱은 지금 1~${slides.length}번이다. ID 는 일부만 적어도 된다.`,
  );
  process.exit(1);
}

if (argv.includes("--deps")) {
  const course = readCourse();
  const reports = found.map((s) => dependencyReport(course.find((x) => x.id === s.id)));
  if (argv.includes("--json")) console.log(JSON.stringify(reports, null, 2));
  else for (const r of reports) {
    console.log(`\n${r.id} · 렌더러/스타일 탐색`);
    for (const file of r.files) console.log(`  렌더 ${file}`);
    if (r.beatFile) console.log(`  BEATS ${r.beatFile}`);
    console.log(`  CSS 접두어 ${r.css.prefixes.join(", ") || "직접 확인 필요"}`);
    for (const b of r.css.blocks) console.log(`  ${b.file}:${b.from}~${b.to} (${b.count}개 선택자)`);
    console.log(`  같은 레이아웃 영향 후보 ${r.sharedLayoutIds.length}장: ${r.sharedLayoutIds.join(", ")}`);
    console.log(`  ${r.note} 전체 선택자와 줄은 --deps --json`);
  }
  process.exit(0);
}

/* ── 열어야 할 파일 ─────────────────────────────────────────
   요청 하나가 건드리는 파일은 보통 한둘이다. 먼저 이걸 보여 준다 —
   표를 다 읽지 않고도 무엇을 열지 정할 수 있어야 한다. */
const scripts = new Map();
for (const s of found) if (!scripts.has(s.chapter)) scripts.set(s.chapter, scriptIndex(s.chapter));

const deckFiles = [...new Set(found.map((s) => s.file))];
const scriptFiles = [...new Set(found.map((s) => path.join(SCRIPT_DIR, `${s.chapter}.md`)))]
  .filter((f) => fs.existsSync(f));

const span = found.length === 1
  ? `${found[0].n}번`
  : `${found[0].n}~${found[found.length - 1].n}번 · ${found.length}장`;
const chapters = [...new Set(found.map((s) => s.chapter))].join(" · ");
const lessons = [...new Set(found.map((s) => s.lesson).filter(Boolean))];

console.log(`\n${span}  (${chapters})`);
if (lessons.length) console.log(`레슨   ${lessons.join(" · ")}`);
console.log(`\n열 파일`);
for (const f of deckFiles) console.log(`  ${rel(f)}`);
for (const f of scriptFiles) console.log(`  ${rel(f)}`);

if (FILES_ONLY) {
  console.log("");
  process.exit(0);
}

/* ── 장표별 ─────────────────────────────────────────────────
   상태 ↔ 대본이 어긋나면 표시한다. 그건 린터 검사 8 이 오류로 잡고
   녹화를 멈추는 자리라, 들어가기 전에 알아야 손이 두 번 안 간다.

   여는 상태 수는 **`steps` + 1** 이다 (lint-course 의 `slideStates`).
   0 스텝이 이미 첫 상태이므로 `steps: 2` 는 세 상태다. */
console.log(`\n번호  화면 ID                        화면            대본        상태/대본`);
console.log(`──────────────────────────────────────────────────────────────────────────`);

let mismatch = 0;
let unknown = 0;
for (const s of found) {
  const sc = scripts.get(s.chapter)?.get(s.id);
  const deckAt = `${path.basename(s.file)}:${s.line}`;
  const scriptAt = sc ? `${s.chapter}.md:${sc.line}` : "없음";

  const states = s.steps === null ? null : s.steps + 1;
  const written = sc ? sc.steps : null;

  let cell;
  if (states === null) { cell = `?  / ${written ?? "-"}`; unknown++; }
  else if (written === null) cell = `${states} / -`;
  else {
    cell = `${states} / ${written}`;
    if (states !== written) { cell += "  ✗"; mismatch++; }
  }

  console.log(
    `${String(s.n).padStart(4)}  ${s.id.padEnd(30)} ${deckAt.padEnd(15)} ${scriptAt.padEnd(11)} ${cell}`,
  );
}

console.log(`\n상태/대본 = 화면이 여는 상태 수(steps+1) / 대본의 ### 개수.`);
if (mismatch) {
  console.log(
    `✗ ${mismatch}곳이 어긋난다 — 린터 검사 8 이 오류로 잡고 녹화가 멈추는 자리다.`,
  );
}
if (unknown) {
  console.log(
    `?  ${unknown}곳은 steps 를 선언하지 않아 reveal·항목 수로 정해진다. 판정은 린터가 한다.`,
  );
}
console.log(
  `\n다음: npm run shots -- --audit ${found[0].chapter} --slides ${found[0].n}-${found[found.length - 1].n}\n`,
);
