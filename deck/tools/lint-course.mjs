/**
 * 강의 덱 콘텐츠 린터.  `npm run lint:course`
 *
 * 화면이 깨지는 건 렌더해서 보면 되고, tsc 가 타입을 본다.
 * 이 린터가 보는 건 **말과 화면이 어긋나는 자리**다 — 타입도 렌더도 못 잡고,
 * 154 장을 눈으로 읽어야만 나오던 것들.
 *
 *   1 표기 갈림      같은 단어가 두 표기로 (Checkpoint / 체크포인트)      오류
 *   2 화면↔대본      장표는 영어, 대본은 한글인 자리                     후보
 *   3 대본에 없는 이름 장표에만 있고 그 챕터 대본엔 없는 말                후보
 *   4 레슨 번호      챕터 안에서 중복되거나 결번인 L 번호                 오류
 *   5 헤더 규모      헤더가 선언한 장표 수·시간 vs 실측                   오류
 *   6 문서 숫자      README·NARRATION-PIPELINE 의 장표 수 vs 실측         오류
 *   7 체류 시간      한 시각 상태가 몇 초나 정지해 있는가                  리듬
 *   7b 비트의 종류   글만 열리는 구간이 몇 분이나 이어지는가              리듬
 *   7c 체감 장면     그림이 안 바뀐 채 몇 초나 흐르는가                    리듬
 *   8 스텝 수       대본의 `###` 개수 vs 화면이 여는 상태 수              오류
 *   9 부제 문장 수   카피형 화면의 `steps` vs 부제 문장 수                 오류
 *  10 죽은 accent    화면 글 어디에도 없는 강조 단어                      오류
 *  11 떠 있는 대본   `## 키` 는 있는데 그 화면이 없는 절                   오류
 *  12 영상 편집점    영상의 확대·이동이 대본 스텝과 어긋난 자리            오류
 *  13 죽은 번호      주석의 `defaults-vendor-overview` 가 실제와 다름   오류
 *
 * 7·7b·7c 의 초는 **입으로 나가는 글자만** 센다. 단독 줄 `1.6s` 는 안 읽고
 * 그 초를 더하고, 통째 괄호 `(제작 지시문)` · `>` 인용 · `---` 는 뺀다.
 * 규칙의 정본은 TTS 엔진(`local-tts-engine/course_pilot.py` 의 `parse_script`)
 * 이고 여기는 따라간다 — 두 쪽이 갈리면 재는 초와 실제 음성 길이가 어긋난다.
 *
 * 8 은 녹화가 멈추는 자리다. capture.mjs 는 스텝마다 `→` 를 누르고
 * **그 화면이 그 스텝에 도달할 때까지 기다린다.** 대본이 화면보다 많이
 * 쪼개져 있으면 `→` 가 다음 장으로 넘어가 버려서 기다림이 안 풀린다.
 *
 * 7 은 오류도 후보도 아니다. **작업 목록**이다 — 영상용으로 어디를 쪼개야
 * 하는지를 대본 글자수로 재서 알려준다. 기준은 VIDEO-PACING-GUIDELINES.md 다.
 *
 * 1·4·5·6 은 판정이 필요 없다. 2·3 은 후보만 띄운다 —
 * "이 화면이 그 단어를 가르치는 화면인가"는 사람이 정한다.
 * 판정이 끝나면 course-terms.js 의 ALLOW 에 넣는다.
 *
 * 규칙은 전부 course-terms.js 에 있다. 이 파일은 기계만 들고 있다.
 *
 * 옵션
 *   --chapter ch03   한 챕터만 본다
 *   --fix            검사 6 의 문서 숫자를 실측으로 고쳐 쓴다
 *   --quiet          오류만 (후보는 숨김)
 *   --pacing         검사 7 의 긴 상태를 전부 나열한다 (기본은 요약 + 최악 12개)
 *   --brief          고칠 자리만 (검사 7 의 개별 목록을 통째로 뺀다)
 *   --offline        오프라인 강의 모드. 화자가 직접 말하므로 리듬 한도만
 *                    온라인 기준의 3배로 잰다. 오류 검사는 동일하다.
 *
 * ── --brief 는 왜 있나 (2026-08-23) ─────────────────────────
 * **이 플래그가 대신하는 건 기본 출력이 아니라 `--pacing` 이다.**
 *
 * 사막(7b)과 박제(7c)는 기본 출력에서 5곳씩만 잘려 나온다. 그래서 그 둘을
 * 다 보려면 --pacing 을 줘야 하는데, 그러면 검사 7 의 화면별 나열이 통째로
 * 딸려 온다 — ch01 한 챕터에 99줄, 전 챕터면 547줄이다.
 *
 * 그 목록은 한 번에 처리하는 작업이 아니다. 15초 초과는 상시 99곳이고 그중
 * 실제로 손대는 건 지금 작업 중인 화면 두셋뿐이다. 나머지는 배경 상태라
 * 매번 다시 읽혀도 아무 결정을 안 바꾼다.
 *
 * 세션 로그를 재 보니 이 출력이 한 세션에서 1.8M 토큰(누적 입력의 4%)을
 * 썼다. 컨텍스트는 한 번 들어오면 안 나가고 턴마다 다시 읽히기 때문에,
 * 안 쓰는 99줄은 그 세션이 끝날 때까지 계속 값을 문다.
 *
 *   남긴다  오류 · 문서 숫자 · 리듬 요약 세 줄 · **사막 전부 · 박제 전부**
 *   뺀다    후보 목록 · 검사 7 의 화면별 나열
 *
 * 사막과 박제를 안 자르는 게 이 플래그의 값이다. 목록이 짧고(챕터당 0~6곳)
 * 하나하나가 작업 단위라, 잘라 보여 주면 그게 곧 놓치는 자리가 된다.
 *
 *   ch01   --pacing 127줄  →  --brief 23줄   (사막·박제는 똑같이 다 나온다)
 *
 * 화면별로 어디가 긴지 볼 때만 --pacing 을 쓴다. 둘은 반대 방향이라 같이
 * 주면 --pacing 이 이긴다.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALWAYS_EN, PAIRS, SPELLINGS, SCRIPT_EXEMPT, ALLOW, CHARS_PER_MIN,
  CHARS_PER_SEC, DWELL, TIER_DWELL, BEAT_TIER_OVERRIDES,
  STEP_AWARE_LAYOUTS, REVEAL_LAYOUTS, STEPPED_IF_DECLARED,
  COPY_STEP_LAYOUTS, DIAGRAM_STEP_SCENES,
  MEANING_LAYOUTS, FOCUS_LAYOUTS, ANCHORED_SCENES, MEANING_GAP,
  PHOTO_LAYOUTS, FROZEN,
} from "./course-terms.js";
import { chapterEntries, chapterSource } from "./chapters.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(ROOT, "..");

const SCRIPT_DIR = path.join(ROOT, "script/course");

const argv = process.argv.slice(2);
const only = argv.includes("--chapter") ? argv[argv.indexOf("--chapter") + 1] : null;
const FIX = argv.includes("--fix");
const PACING = argv.includes("--pacing");
/* 고칠 자리만. 검사 7 의 화면별 나열(상시 99줄)을 통째로 뺀다.
   --pacing 과 반대 방향이라 같이 주면 --pacing 이 이긴다. */
const BRIEF = argv.includes("--brief") && !PACING;
/* 공통 판이 챕터마다 어떻게 쓰이는지만 본다. 오류가 아니라 **지도**다 —
   같은 일을 하는 판이 여럿 있는데 챕터마다 다른 걸 골라 쓰면, 같은 결함이
   챕터마다 따로 생긴다 (`definition` 38 장 중 23 장이 용어가 아니라 문장을
   담고 있던 게 그 자리였다). 그 드리프트는 눈으로는 안 보인다. */
const TEMPLATES = argv.includes("--templates");
const QUIET = argv.includes("--quiet") || BRIEF;
/* 오프라인 강의. 얼굴 없는 온라인과 달리 움직임의 주체가 화자이므로
   검사 7(리듬)의 시간 한도만 3배로 잰다. ID·대본·스텝·글자 등 오류
   검사는 온라인과 완전히 동일하다. */
const OFFLINE = argv.includes("--offline");
const RK = OFFLINE ? 3 : 1;
const DWELL_EFF = { warn: DWELL.warn * RK, bad: DWELL.bad * RK, fail: DWELL.fail * RK };
const TIER_EFF = { text: TIER_DWELL.text * RK, focus: TIER_DWELL.focus * RK, meaning: TIER_DWELL.meaning * RK };
const GAP_EFF = MEANING_GAP * RK;
const FROZEN_EFF = { photo: FROZEN.photo * RK, figure: FROZEN.figure * RK };
const allow = new Set(ALLOW.map((a) => a.split("·")[0].trim() + "·" + a.split("·")[1].trim()));

/* ── 파싱 ─────────────────────────────────────────────────── */

/**
 * `key: "..."` 하나를 읽는다. 이스케이프와 \n 을 푼다.
 *
 * 값이 다음 줄로 넘어간 경우(`subtitle:` 다음 줄에 문자열)도 읽는다.
 * prettier 가 긴 문자열을 그렇게 접어 놓기 때문인데, 예전에는 그런
 * 부제가 통째로 안 읽혀서 검사 2·3 이 조용히 건너뛰고 있었다.
 */
function field(block, key) {
  const m = block.match(
    new RegExp(`^\\s*${key}:[ \\t]*\\n?[ \\t]*"((?:[^"\\\\]|\\\\.)*)"`, "m"),
  );
  return m ? m[1].replace(/\\n/g, " ").replace(/\\"/g, '"') : null;
}

function arrayField(block, key) {
  const m = block.match(new RegExp(`^\\s*${key}: \\[([\\s\\S]*?)\\]`, "m"));
  if (!m) return [];
  return [...m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) =>
    x[1].replace(/\\n/g, " ").replace(/\\"/g, '"'));
}

/** 챕터 원본 하나를 화면 배열로. 전역 번호는 호출한 쪽이 이어 붙인다.
    원본을 모으는 일은 tools/chapters.mjs 가 한다 — 챕터가 여러 파일일 수 있다. */
function parseChapter(src) {
  const header = src.slice(0, src.indexOf("*/"));
  const slides = [];
  const lessons = [];
  let lesson = null;

  for (const line of src.split("\n")) {
    const lm = line.match(/^\s*\/\/ ── (.+?)\s*──+\s*$/);
    if (lm) {
      lesson = lm[1].trim();
      const num = lesson.match(/^L(\d+(?:\.\d+)?)\b/);
      if (num) lessons.push({ n: Number(num[1]), label: lesson });
    }
  }
  for (const block of src.split(/\n {2,4}\{\n/).slice(1)) {
    const id = field(block, "id");
    if (!id) continue;
    const layout = field(block, "layout") ?? "";
    const side = (k) => {
      const m = block.match(new RegExp(`^\\s*${k}: \\{([^}]*)\\}`, "m"));
      return m ? m[1] : "";
    };
    // 문장 자리만 모은다.
    //   eyebrow, left/right 의 label  → 이름표 자리. 항상 제외
    //   demo·cover·chapter 의 subtitle → 섹션 태그다 ("Stop · Budget · Recover")
    //   photo·quote·metric 의 items    → 출처 캡션이다 ("… · 2026.08.21 확인")
    //   "/" 로 시작하는 metric          → 사진 경로다
    const TAG_SUBTITLE = layout === "demo" || layout === "cover" || layout === "chapter";
    const CAPTION_ITEMS = layout === "photo" || layout === "quote" || layout === "metric";
    const metric = field(block, "metric");
    const sentences = [
      field(block, "title"),
      TAG_SUBTITLE ? null : field(block, "subtitle"),
      metric?.startsWith("/") ? null : metric,
      ...(CAPTION_ITEMS ? [] : arrayField(block, "items")),
      field(side("left"), "title"), field(side("left"), "body"),
      field(side("right"), "title"), field(side("right"), "body"),
    ].filter(Boolean);
    const stepsField = block.match(/^\s*steps: (\d+),/m);
    slides.push({
      id, layout, sentences, text: sentences.join(" "),
      steps: stepsField ? Number(stepsField[1]) : 0,
      stepsDeclared: Boolean(stepsField),
      subtitle: field(block, "subtitle"),
      scene: field(block, "scene"),
      // 지배 이미지의 경로 (검사 7c). photo·quote 는 metric 이 경로고,
      // comparison·split·case 는 칸 안에 사진이 들어간다.
      metric,
      image: field(side("left"), "image") ?? field(side("right"), "image"),
      accent: field(block, "accent"),
      // accent 는 title · subtitle · metric 안에서 찾는다 (AccentText).
      accentHaystack: [
        field(block, "title"), field(block, "subtitle"), metric,
      ].filter(Boolean).join(" "),
      itemCount: arrayField(block, "items").length,
      reveal: /^\s*revealItems: true,/m.test(block),
      // shotBands 의 띠 개수 (검사 7c). 띠가 있으면 사진이 스텝마다
      // 다른 자리를 밝히므로 더 이상 통째로 얼어 있는 앵커가 아니다.
      bands: (block.match(/^\s*shotBands: \[([\s\S]*?)\n\s*\],/m)?.[1].match(/note:/g) ?? []).length,
      // shotFrames 는 같은 캡처 위의 띠가 아니라 스텝마다 실제 이미지가
      // 바뀌는 경우다. 마지막 null 로 원본 전체에 돌아오는 것도 새 장면이다.
      frames: /^\s*shotFrames: \[/m.test(block),
      // 한 원본 안에서 카메라가 카드 사이를 이동하고 마지막에 전체로 복귀한다.
      camera: /^\s*shotCamera: true,/m.test(block),
      landingClear: /^\s*shotLandingClear: true,/m.test(block),
      // 영상 편집점 ↔ 대본 스텝 (검사 12). 없으면 편집점 없는 영상이다.
      videoBeats: (() => {
        const m = block.match(/^\s*videoBeats: \{\s*duration:\s*([\d.]+),\s*cues:\s*\[([^\]]*)\]/m);
        if (!m) return null;
        return {
          duration: Number(m[1]),
          cues: m[2].split(",").map((x) => Number(x.trim())).filter((x) => !Number.isNaN(x)),
        };
      })(),
      pacingExceptions: arrayField(block, "pacingExceptions"),
      pacingExceptionReason: field(block, "pacingExceptionReason"),
    });
  }
  return { header, slides, lessons };
}

function parseScript(file) {
  if (!fs.existsSync(file)) return new Map();
  const md = fs.readFileSync(file, "utf8");
  const out = new Map();
  for (const sec of md.split(/^## /m).slice(1)) {
    const id = sec.split("\n")[0].trim();
    const steps = sec.split(/^### /m).slice(1)
      .map((x) => x.split("\n").slice(1).join("\n").trim());
    out.set(id, { steps, text: steps.join("\n") });
  }
  return out;
}

/* ── 실제로 읽는 것만 초로 센다 ────────────────────────────
   대본에는 **입으로 안 나가는 줄**이 있다. 규칙은 TTS 엔진
   (`local-tts-engine/course_pilot.py` 의 `parse_script`)이 정본이고
   여기가 그걸 따라간다 — 두 쪽이 다르면 린터가 재는 초와 실제 음성 길이가
   갈린다.

     `1.6s` 단독 줄   안 읽는다. 대신 **그 초를 체류에 더한다**
     `(…)` 통째 괄호  제작 지시문이라 안 읽고, 대기도 안 만든다
     `>` 인용 줄      안 읽는다
     `---`            구분선

   안 걸러 두면 지시문 한 줄(38자)이 5초짜리 낭독으로 잡혀서 그 장표의
   체류가 있지도 않은 시간만큼 부풀고, 강제 무음은 4글자로 세어져서
   실제로 서 있는 2초가 안 잡힌다. 둘 다 리듬 판단을 반대로 돌린다. */
const PAUSE_LINE = /^\s*\[(\d+(?:\.\d+)?)s\]\s*$/i;
const isDirection = (line) => {
  const t = line.replace(/^[*_`~\s]+|[*_`~\s]+$/g, "");
  return (t.startsWith("(") && t.endsWith(")")) || (t.startsWith("（") && t.endsWith("）"));
};

/** 한 스텝이 실제로 몇 초인가 — 읽는 글자 ÷ 계수 + 강제 무음. */
function spokenSeconds(text) {
  let chars = 0;
  let pause = 0;
  for (const line of String(text).split("\n")) {
    const m = line.match(PAUSE_LINE);
    if (m) { pause += Number(m[1]); continue; }
    if (/^---+\s*$/.test(line) || line.startsWith(">") || isDirection(line)) continue;
    chars += line.replace(/\s+/g, "").length;
  }
  return chars / CHARS_PER_SEC + pause;
}

/* ── 수집 ─────────────────────────────────────────────────── */

const chapters = [];
let g = 0;
for (const entry of chapterEntries()) {
  const key = entry.key;                           // ch00 … ch07
  const parsed = parseChapter(chapterSource(entry));
  parsed.slides.forEach((s) => { s.n = ++g; s.chapter = key; });
  chapters.push({ key, file: path.basename(entry.index), ...parsed, script: parseScript(path.join(SCRIPT_DIR, `${key}.md`)) });
}
const TOTAL = g;
const targets = only ? chapters.filter((c) => c.key === only) : chapters;
if (only && !targets.length) { console.error(`챕터 ${only} 없음`); process.exit(2); }

const errors = [];
const candidates = [];
const err = (c, s, msg) => errors.push({ c, s, msg, key: msg });
/** key 가 같은 후보는 한 줄로 묶는다 — 같은 지적이 형제 장표에 그대로 반복되기 때문. */
const cand = (c, s, msg, key) => candidates.push({ c, s, msg, key: key ?? msg });

/** 단어가 문장 안에 실제로 있는가 (부분일치 방지). */
function has(text, word) {
  const esc = word.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
  const boundary = /^[A-Za-z]/.test(word) ? `(?<![A-Za-z])${esc}(?![A-Za-z])` : esc;
  return new RegExp(boundary).test(text);
}

/* ── 1 · 표기 갈림 ────────────────────────────────────────── */
for (const c of targets) {
  for (const [right, ...wrong] of SPELLINGS) {
    for (const bad of wrong) {
      for (const s of c.slides) {
        if (has(s.text, bad)) err(c, s, `표기 갈림 — "${bad}" 는 "${right}" 로`);
      }
      for (const [id, sc] of c.script) {
        if (has(sc.text, bad)) {
          const s = c.slides.find((x) => x.id === id) ?? { id, n: "?" };
          err(c, s, `표기 갈림(대본) — "${bad}" 는 "${right}" 로`);
        }
      }
    }
  }
}

/* ── 2 · 화면↔대본 불일치 ─────────────────────────────────── */
for (const c of targets) {
  for (const s of c.slides) {
    const sc = c.script.get(s.id);
    if (!sc) continue;
    for (const { en, ko } of PAIRS) {
      if (allow.has(`${s.id}·${en}`)) continue;
      const screenEn = has(s.text, en);
      if (!screenEn) continue;
      const scriptKo = has(sc.text, ko);
      const scriptEn = has(sc.text, en);
      if (scriptKo && !scriptEn) {
        cand(c, s, `화면은 "${en}", 대본은 "${ko}"`, `pair:${en}`);
      }
    }
  }
}

/* ── 3 · 대본에 없는 이름 ─────────────────────────────────── */
const exempt = new Set([...SCRIPT_EXEMPT, ...ALWAYS_EN]);
for (const c of targets) {
  const allScript = [...c.script.values()].map((x) => x.text).join("\n");
  for (const s of c.slides) {
    const words = new Set(s.text.match(/[A-Z][A-Za-z]{2,}(?:-[A-Z][A-Za-z]+)?/g) ?? []);
    for (const w of words) {
      if (exempt.has(w) || allow.has(`${s.id}·${w}`)) continue;
      if (/^[A-Z]+$/.test(w)) continue;            // 전부 대문자면 배지다
      if (!has(allScript, w)) cand(c, s, `장표에만 있는 이름 — "${w}" 가 ${c.key} 대본에 없다`, `orphan:${w}`);
    }
  }
}

/* ── 4 · 레슨 번호 ────────────────────────────────────────── */
for (const c of targets) {
  // Sub-lessons such as L01.1 have distinct identities; gap checks cover major lessons.
  const nums = c.lessons.map((l) => l.n).filter((n) => n !== 0 && Number.isInteger(n));
  const seen = new Map();
  for (const l of c.lessons) {
    if (l.n === 0) continue;
    seen.set(l.n, (seen.get(l.n) ?? 0) + 1);
  }
  for (const [n, k] of seen) {
    if (k > 1) {
      const which = c.lessons.filter((l) => l.n === n).map((l) => l.label).join("  /  ");
      err(c, { id: c.file, n: "" }, `레슨 번호 L${String(n).padStart(2, "0")} 이 ${k} 번 — ${which}`);
    }
  }
  if (nums.length) {
    const gaps = [];
    for (let i = Math.min(...nums); i <= Math.max(...nums); i++) if (!seen.has(i)) gaps.push(`L${String(i).padStart(2, "0")}`);
    if (gaps.length) err(c, { id: c.file, n: "" }, `레슨 번호 결번 — ${gaps.join(", ")}`);
  }
}

/* ── 5 · 헤더 규모 ────────────────────────────────────────── */
for (const c of targets) {
  const chars = [...c.script.values()].reduce((a, x) => a + x.text.replace(/\s+/g, " ").length, 0);
  const mins = Math.round(chars / CHARS_PER_MIN);
  const m = c.header.match(/규모:.*?(\d+)\s*장/);
  if (!m) continue;
  if (Number(m[1]) !== c.slides.length) {
    err(c, { id: c.file, n: "" }, `헤더 규모 — ${m[1]}장 선언 / 실제 ${c.slides.length}장`);
  }
  const mm = c.header.match(/규모:.*?약?\s*(\d+)\s*분/);
  if (mm && Math.abs(Number(mm[1]) - mins) > 5) {
    err(c, { id: c.file, n: "" }, `헤더 규모 — 약 ${mm[1]}분 선언 / 실측 약 ${mins}분`);
  }
}

/* ── 5b · 레슨 파일 규모 ──────────────────────────────────
   레슨 파일 머리의 `(N장)` 과 인덱스의 목록은 **손으로 유지한다.**
   검사 5 는 챕터 하나를 통째로만 보므로 레슨 한 파일이 틀어지면 조용히
   지나간다 — L15 가 하나 적게 선언된 채로 있었고, 그 파일에서 장표를
   지울 때 **틀린 숫자를 기준으로 -1 해서 또 틀렸다.** 손으로 유지하는
   숫자는 손으로 검증하면 안 된다. */
for (const entry of chapterEntries()) {
  if (only && entry.key !== only) continue;
  const c = chapters.find((x) => x.key === entry.key);
  for (const f of entry.parts) {
    const src = fs.readFileSync(f, "utf8");
    const declared = src.match(/^ \* CH\d\d · L\d\d[^\n]*?\((\d+)장\)/m);
    if (!declared) continue;
    const actual = (src.match(/^ {4}id: "/gm) ?? []).length;
    if (Number(declared[1]) !== actual) {
      err(c, { id: path.basename(f), n: "" },
        `레슨 규모 — ${declared[1]}장 선언 / 실제 ${actual}장`);
    }
  }
}

/* ── 6 · 문서 숫자 ────────────────────────────────────────── */
const DOCS = [
  { file: path.join(REPO, "README.md"), re: /현재 (\d+)개/g },
  { file: path.join(ROOT, "README.md"), re: /(\d+)장이라 `→`/g },
  { file: path.join(ROOT, "README.md"), re: /현재 (\d+)장이 들어 있습니다/g },
];
const docFixes = [];
for (const d of DOCS) {
  if (!fs.existsSync(d.file)) continue;
  let src = fs.readFileSync(d.file, "utf8");
  let touched = false;
  src = src.replace(d.re, (whole, num) => {
    if (Number(num) === TOTAL) return whole;
    docFixes.push({ file: path.relative(REPO, d.file), was: num, now: TOTAL });
    touched = true;
    return whole.replace(num, String(TOTAL));
  });
  if (touched && FIX) fs.writeFileSync(d.file, src);
}

/* ── 13 · 죽은 번호 ───────────────────────────────────────────
   주석과 문서가 장표를 **번호와 슬러그를 붙여서** 가리킨다
   (`defaults-vendor-overview` · `loop-real-life`). 그런데 장표를
   하나 끼우면 그 뒤 번호가 전부 하나씩 밀리고, **번호만 조용히 틀려진다.**
   슬러그는 맞으니 사람이 읽으면 통하는데, 번호로 화면을 찾으면 엉뚱한
   데가 나온다. 2026-09-03 에 `toolpick-maturity` 를 끼웠더니 14곳이 한 번에
   틀어졌고 그중 다섯은 그 전부터 밀려 있던 것이었다.

   슬러그가 **실제 화면 ID 일 때만** 센다. 그래서 오탐이 구조적으로 없다 —
   "160토큰" 같은 건 뒤 낱말이 화면 ID 가 아니라 아예 안 걸린다.

   두 가지는 뺀다.
     두 자리 수  `L02 toolpick-model` 의 레슨 번호가 걸린다
     `A → B`     `111 → 112  workflow-fixed-llm` 은 경계 표기이고
                 ID 는 앞 번호의 것이다 (shots --ghost 의 출력 예시) */
const ID_TO_N = new Map();
for (const c of chapters) for (const s of c.slides) ID_TO_N.set(s.id, s.n);

const REF_FILES = [];
function collectRefFiles(p) {
  if (!fs.existsSync(p)) return;
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    for (const f of fs.readdirSync(p)) collectRefFiles(path.join(p, f));
    return;
  }
  if (/\.(ts|tsx|mjs|js|md|css)$/.test(p)) REF_FILES.push(p);
}
for (const f of [
  path.join(ROOT, "src"),
  path.join(ROOT, "tools"),
  path.join(ROOT, "README.md"),
  path.join(REPO, "CLAUDE.md"),
  path.join(REPO, "docs"),
]) collectRefFiles(f);

const deadRefs = [];
for (const f of REF_FILES) {
  fs.readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    if (/\d\s*→\s*\d/.test(line)) return;              // 경계 표기
    for (const m of line.matchAll(/\b(\d{3})\s*[( ]\s*([a-z][a-z0-9-]{4,})/g)) {
      const real = ID_TO_N.get(m[2]);
      if (real && Number(m[1]) !== real) {
        deadRefs.push({ file: path.relative(REPO, f), line: i + 1, said: m[1], slug: m[2], real });
      }
    }
  });
}

/* ── 글자 크기 ─────────────────────────────────────────────
   촬영 뷰포트가 1920×1080 · deviceScaleFactor 1 이라 **CSS px 가 곧 영상 px** 다.
   그래서 원시 px 로 새 크기를 찍으면 그대로 화면에서 안 읽히는 글자가 된다.
   실제로 9~13px 짜리 라벨이 400곳 넘게 쌓여 있었다 (2026-09-06).

   정본은 course.css 의 `--course-font-*` 열한 값이다. 여기서 값을 다시 적지
   않고 **읽어 온다** — 스케일을 고치는 곳이 두 군데가 되면 다시 어긋난다.

     하한 미만     오류       1080p 에서 못 읽는다. 판정할 것이 없다
     스케일 이탈   검토 후보  `@type-scale` 을 선언한 파일에서만 본다

   이탈을 전 파일에서 보면 아직 안 옮긴 1500곳이 매번 뜬다. 그건 품질 신호가
   아니라 소음이다. 파일을 스케일로 옮긴 사람이 그 파일 첫머리에
   `@type-scale` 을 적어 스스로 걸어 잠근다. */
/* 화면에 찍히는 판만 본다. reactbits 는 벤더 원본이고 presenter 는 촬영에 안 들어간다. */
const CSS_FILES = REF_FILES.filter((f) => f.endsWith(".css") && f.includes(`${path.sep}src${path.sep}production${path.sep}`));
const FONT_SCALE = new Map();
for (const f of CSS_FILES) {
  if (path.basename(f) !== "course.css") continue;
  for (const m of fs.readFileSync(f, "utf8").matchAll(/--course-font-([a-z-]+):\s*(\d+(?:\.\d+)?)px/g)) {
    FONT_SCALE.set(Number(m[2]), m[1]);
  }
}
const FONT_FLOOR = FONT_SCALE.size ? Math.min(...FONT_SCALE.keys()) : 14;
const tinyText = [];
const offScale = [];
for (const f of CSS_FILES) {
  const src = fs.readFileSync(f, "utf8");
  const opted = src.includes("@type-scale");
  src.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) {
      const px = Number(m[1]);
      const at = { file: path.relative(REPO, f), line: i + 1, px };
      if (px < FONT_FLOOR) tinyText.push(at);
      else if (opted && !FONT_SCALE.has(px)) offScale.push(at);
    }
  });
}

/* ── 6b · 장표 단위 리듬 특수 규칙 ──────────────────────────── */
const PACING_EXCEPTION_KINDS = new Set(["dwell", "desert", "frozen"]);
for (const c of targets) {
  for (const s of c.slides) {
    const invalid = s.pacingExceptions.filter((k) => !PACING_EXCEPTION_KINDS.has(k));
    if (invalid.length) {
      err(c, s, `알 수 없는 리듬 예외 — ${invalid.join(", ")}`);
    }
    if (s.pacingExceptions.length && !s.pacingExceptionReason) {
      err(c, s, "리듬 예외에는 pacingExceptionReason 이 필요하다");
    }
    if (!s.pacingExceptions.length && s.pacingExceptionReason) {
      err(c, s, "pacingExceptionReason 은 있는데 pacingExceptions 가 없다");
    }
  }
}

/* ── 7 · 체류 시간 ────────────────────────────────────────────
   한 시각 상태가 몇 초나 정지해 있는가. 대본 글자수를 파일럿 실측
   계수(CHARS_PER_SEC)로 나눠서 재므로 TTS 를 돌리지 않아도 나온다.

   **스텝을 못 그리는 레이아웃은 대본 스텝을 합쳐서 잰다.** 거기서는
   `### 0 · ### 1` 로 쪼개도 화면이 그대로라 시각 상태가 하나뿐이다 —
   그게 이 검사가 잡으려는 바로 그 자리다. */

/**
 * 이 화면이 여는 상태의 수. `→` 를 누를 횟수 + 1 이다.
 *
 * 규칙의 정본은 course-types.ts 의 `slideSteps()` 다. 린터는 TS 를
 * 실행하지 않고 텍스트로 읽으므로 같은 규칙을 여기 한 번 더 적는다 —
 * **한쪽을 고치면 다른 쪽도 고친다.**
 */
function slideStates(s) {
  if (s.stepsDeclared) return s.steps + 1;
  if (s.reveal && s.itemCount) return Math.max(1, s.itemCount);
  return 1;
}

/** 이 화면이 대본 스텝마다 다른 상태를 그리는가. */
function drawsSteps(s) {
  if (STEP_AWARE_LAYOUTS.has(s.layout)) return true;
  if (REVEAL_LAYOUTS.has(s.layout)) return s.reveal;
  if (STEPPED_IF_DECLARED.has(s.layout)) return s.steps > 0;
  return false;
}

/** 이 화면의 시각 상태들이 각각 어떤 강도의 비트인가. */
function beatTiers(s, count) {
  if (s.camera) {
    return Array.from(
      { length: count },
      (_, i) => (i === 0 || i === count - 1 ? "meaning" : "focus"),
    );
  }

  /* 잘라 둔 카드가 지능 → 속도 → 비용으로 교체되고 마지막에는 세 카드
     전체로 돌아온다. 지배 이미지와 데이터가 실제로 달라지는 의미 비트다. */
  if (s.frames) return Array.from({ length: count }, () => "meaning");

  /* 띠를 단 캡처(shotBands). 스텝 0 은 캡처가 서는 자리라 의미 비트고,
     그 뒤 스텝은 같은 그림 위에서 밝은 자리가 옮겨 가는 초점 비트다.
     글 비트로 세면 사막 판정이 "화면에 그림이 없다"고 거짓말을 한다. */
  if (s.bands) {
    return Array.from({ length: count }, (_, i) => (i === 0 ? "meaning" : "focus"));
  }

  const override = BEAT_TIER_OVERRIDES[`${s.layout}:${s.scene ?? ""}`];
  if (override) {
    return Array.from(
      { length: count },
      (_, i) => override[i] ?? override.at(-1) ?? "text",
    );
  }

  const anchored = ANCHORED_SCENES[s.layout]?.(s.scene ?? "");
  if (MEANING_LAYOUTS.has(s.layout)) {
    if (anchored) {
      return Array.from({ length: count }, (_, i) =>
        i === 0 ? "meaning" : i === 1 ? "focus" : "text");
    }
    return Array.from({ length: count }, () => "meaning");
  }
  if (FOCUS_LAYOUTS.has(s.layout)) {
    return Array.from({ length: count }, () => (s.stepsDeclared ? "focus" : "text"));
  }
  return Array.from({ length: count }, () => "text");
}

/** 완성 영상을 사람이 직접 보고 이 장표의 특수 규칙으로 승인했는가. */
function pacingExcepted(s, kind) {
  return s.pacingExceptions.includes(kind);
}

const pacing = [];
let beats = 0;
let narrationSec = 0;
for (const c of targets) {
  for (const s of c.slides) {
    const sc = c.script.get(s.id);
    if (!sc || !sc.steps.length) continue;
    const secs = sc.steps.map(spokenSeconds);
    // 스텝을 못 그리면 통째로 한 상태다
    const states = drawsSteps(s) ? secs : [secs.reduce((a, b) => a + b, 0)];
    const tiers = beatTiers(s, states.length);
    beats += states.length;
    narrationSec += secs.reduce((a, b) => a + b, 0);
    states.forEach((sec, i) => {
      const tier = tiers[i] ?? "text";
      const limit = TIER_EFF[tier] ?? DWELL_EFF.warn;
      if (sec > limit && !pacingExcepted(s, "dwell")) {
        pacing.push({
          c, s, i, sec, tier, limit,
          split: states.length > 1,
          draws: drawsSteps(s),
        });
      }
    });
  }
}
pacing.sort((a, b) => b.sec - a.sec);

/* ── 7b · 비트의 종류 ────────────────────────────────────────
   검사 7 은 비트를 전부 똑같이 한 개로 센다. 그런데 글 한 줄이 열리는
   것과 도형이 바뀌는 것은 사람에게 같은 변화가 아니다. 분당 비트가 목표
   안에 들어와도 **의미 비트 없이 몇 분씩 글만 이어지면** 여전히 "강사가
   슬라이드를 읽는 장면"이다. 그 사막 구간을 찾아 준다.

   텍스트 비트를 줄이라는 뜻이 아니다. 사막 하나에 **공유 그림 하나**를
   넣으면 그 구간 전체가 살아난다 — 여섯 장이 한 그림을 나눠 쓰는
   stage-lanes 가 이미 그 방식이다. */

const tierCount = { meaning: 0, focus: 0, text: 0 };
const deserts = [];
for (const c of targets) {
  let run = [];
  let runSec = 0;
  const flush = () => {
    if (runSec > GAP_EFF) deserts.push({ c, sec: runSec, slides: [...new Set(run)] });
    run = [];
    runSec = 0;
  };
  for (const s of c.slides) {
    const sc = c.script.get(s.id);
    if (!sc || !sc.steps.length) continue;
    const secs = sc.steps.map(spokenSeconds);
    const excepted = pacingExcepted(s, "desert");
    beatTiers(s, secs.length).forEach((tier, i) => {
      tierCount[tier] += 1;
      if (tier === "meaning") flush();
      else if (!excepted) {
        run.push(s);
        runSec += secs[i] ?? 0;
      }
    });
  }
  flush();
}
deserts.sort((a, b) => b.sec - a.sec);

/* ── 7c · 체감 장면 시계 ─────────────────────────────────────
   7b 는 **그림이 있느냐**를 보고, 여기는 **그 그림이 변하느냐**를 본다.

   앵커 그림은 스텝을 눌러도 그대로 서 있다. 그러니 그림이 처음 서는
   스텝 0 만 시각 사건이고, 나머지 스텝은 전부 같은 그림 위에서 글자만
   흐르는 시간이다. 다음 장이 같은 그림(같은 경로 · 같은 scene)을 또
   쓰면 장을 넘어서도 계속 쌓인다 — 13~14장이 그렇게 64초였다.

   임계값은 이 도구가 들고 있는 진단값이다. 해석은 VIDEO-PACING-GUIDELINES.md §8. 사진은 15초,
   도형은 30초. */

/**
 * 이 화면에서 **얼어 있는 그림**. 없으면 null (그건 7b 의 사막 쪽 일이다).
 *
 * 사진은 레이아웃과 무관하게 앵커다. comparison 칸에 들어간 사진도
 * 마찬가지라, 앞 장의 사진을 옆 칸에 다시 쓰면 장이 넘어가도 같은
 * 그림이 서 있는 것이다.
 *
 * 예외는 `shotBands` 를 단 캡처다. 거기서는 스텝마다 밝은 자리가 옮겨
 * 가므로 그림이 실제로 변한다 — 아래 루프가 띠 단위로 끊어 잰다.
 */
function frozenFigure(s) {
  const img = s.image ?? (PHOTO_LAYOUTS.has(s.layout) ? s.metric : undefined);
  if (img) return { key: `img:${img}`, limit: FROZEN_EFF.photo, photo: true };
  if (!MEANING_LAYOUTS.has(s.layout)) return null;
  if (!ANCHORED_SCENES[s.layout]?.(s.scene ?? "")) return null;
  return { key: `scene:${s.layout}/${s.scene ?? ""}`, limit: FROZEN_EFF.figure, photo: false };
}

const frozen = [];
for (const c of targets) {
  let run = null;
  const flush = () => {
    if (run && run.sec > run.limit) frozen.push(run);
    run = null;
  };
  for (const s of c.slides) {
    const sc = c.script.get(s.id);
    if (!sc || !sc.steps.length) continue;
    const secs = sc.steps.map(spokenSeconds);
    const fig = frozenFigure(s);
    if (!fig) {
      flush();
      continue;
    }
    /* 스텝별 캡처는 지배 이미지 자체가 바뀐다. 첫·마지막이 전체 캡처여도
       사이에 다른 카드 셋이 끼므로 체감 장면 시계는 다시 시작한다. */
    const own = fig.photo && (s.frames || s.camera || s.landingClear)
      ? Math.max(...secs)
      /* 띠가 있는 캡처는 스텝마다 밝은 자리가 옮겨 간다. 그러니 이 장이
       한 그림 위에서 쉬지 않고 흐른 시간은 전체 합이 아니라 **한 띠가
       버틴 가장 긴 구간**이다. 스텝 0 은 캡처 전체를 보는 자리고,
       스텝 1..n 이 띠 하나씩, 그 뒤 착지 스텝은 마지막 띠에 붙는다. */
      : fig.photo && s.bands
        ? Math.max(
          secs[0] ?? 0,
          ...Array.from({ length: s.bands }, (_, i) =>
            secs
              .slice(i + 1, i + 1 === s.bands ? undefined : i + 2)
              .reduce((a, b) => a + b, 0)),
          )
        : secs.reduce((a, b) => a + b, 0);
    if (pacingExcepted(s, "frozen")) {
      flush();
      continue;
    }
    /* 그림이 서는 것은 **한 순간**이지 스텝 하나가 아니다. 그래서 첫
       스텝을 빼 주지 않는다 — §0 의 15초·30초는 그 그림 위에서 흐른
       시간 전체를 말한다. 다음 장이 같은 그림을 또 쓰면 장이 넘어가도
       시계가 안 돌아간다. */
    const carried = run && run.key === fig.key && !(fig.photo && s.bands);
    if (!carried) flush();
    if (carried) {
      run.sec += own;
      run.to = s;
      run.n += 1;
    } else {
      run = { c, ...fig, from: s, to: s, n: 1, sec: own };
    }
  }
  flush();
}
frozen.sort((a, b) => b.sec - a.sec);

/* ── 8 · 스텝 수 ──────────────────────────────────────────────
   화면이 여는 상태 수(= `steps` + 1)와 대본의 `###` 개수는 같아야 한다.

   이건 취향이 아니라 녹화가 되느냐 마느냐다. capture.mjs 는
   스텝이 끝날 때 `→` 를 누르고 `{index, step}` 이 될 때까지 기다리는데,
   대본이 더 잘게 쪼개져 있으면 `→` 가 다음 장으로 넘어가 그 기다림이
   영영 안 풀린다. 반대로 대본이 덜 쪼개져 있으면 화면의 뒷 스텝이 한
   번도 안 열린 채 녹화된다 — 만들어 둔 시각 비트가 통째로 없는 것이다. */
for (const c of targets) {
  for (const s of c.slides) {
    const sc = c.script.get(s.id);
    if (!sc) continue;
    const want = slideStates(s);
    const got = sc.steps.length;
    if (got !== want) {
      err(c, s, `화면은 ${want}상태인데 대본은 ${got}스텝 — ${
        got > want ? "대본을 합치거나 화면 steps 를 올린다" : "대본을 쪼개거나 화면 steps 를 내린다"
      }`);
    }
  }
}

/* ── 9 · 부제 문장 수 ─────────────────────────────────────────
   카피형 화면에서 스텝은 부제를 **문장 하나씩** 연다. 그러니 `steps` 는
   부제 문장 수와 같아야 한다. 적으면 마지막 문장이 한 번도 안 열린 채
   녹화되고, 많으면 아무것도 안 바뀌는 빈 스텝이 남는다. */

/** 부제를 문장으로 나눈다 — copy-steps.tsx 의 `sentences()` 와 같은 규칙. */
function subtitleSentences(text) {
  if (!text) return [];
  return text.split(/(?<=[.?!])\s+/).filter(Boolean);
}

for (const c of targets) {
  for (const s of c.slides) {
    if (!s.stepsDeclared) continue;
    const copyDriven =
      COPY_STEP_LAYOUTS.has(s.layout)
      || (s.layout === "stage-lanes" && !DIAGRAM_STEP_SCENES.has(s.scene))
      || (s.layout === "screen-count" && s.scene === "evidence");
    if (!copyDriven) continue;
    const want = subtitleSentences(s.subtitle).length
      + (s.layout === "metric" ? 1 : 0);
    if (s.steps !== want) {
      err(c, s, `steps: ${s.steps} 인데 부제는 ${
        subtitleSentences(s.subtitle).length
      }문장 — ${s.steps < want ? "뒷 문장이 안 열린다" : "빈 스텝이 남는다"}`);
    }
  }
}

/* ── 10 · 죽은 accent ────────────────────────────────────────
   `accent` 는 제목이나 부제 안의 그 문자열을 찾아 `<em>` 으로 감싼다.
   글을 고치다 그 문자열이 사라지면 강조가 조용히 없어진다 — 화면은
   멀쩡해 보이고 렌더해도 "원래 저런가 보다" 하고 지나간다. */
for (const c of targets) {
  for (const s of c.slides) {
    if (!s.accent) continue;
    if (!s.accentHaystack.includes(s.accent)) {
      err(c, s, `accent “${s.accent}” 가 제목·부제 어디에도 없다 — 강조가 안 걸린다`);
    }
  }
}

/* ── 11 · 떠 있는 대본 ───────────────────────────────────────
   `## 키` 를 썼는데 그 id 를 가진 화면이 없는 절. 화면을 지웠거나 이름을
   바꿨는데 대본이 남은 자리이고, 반대로 **대본만 먼저 써 두고 화면 편집이
   조용히 실패한 자리**이기도 하다. 어느 쪽이든 그 말은 녹화되지 않는다. */
for (const c of targets) {
  const ids = new Set(c.slides.map((s) => s.id));
  for (const key of c.script.keys()) {
    if (!ids.has(key)) {
      err(c, { id: key }, "이 키를 가진 화면이 없다 — 대본만 떠 있다");
    }
  }
}

/* ── 12 · 영상 편집점 ────────────────────────────────────────
   영상은 **스텝을 따라가지 않는다.** `→` 를 눌러도 재생 위치는 그대로고
   자기 시간표대로 혼자 흐른다. 그래서 확대·축소·이동 같은 편집점이 있는
   영상은 대본이 조금만 길어져도 조용히 어긋난다 — 확대가 엉뚱한 문장
   위에서 터지는데 화면도 빌드도 아무 말을 안 한다. 여기서 잡는다.

   `videoBeats` 를 적어 둔 화면만 본다 (course-types.ts). 대본 길이는
   글자 수 환산이라 정확할 수 없으므로 스텝마다 2 초까지 봐준다. */
const BEAT_SLACK = 2.0;
for (const c of targets) {
  for (const s of c.slides) {
    const vb = s.videoBeats;
    if (!vb) continue;
    const sc = c.script.get(s.id);
    if (!sc) continue;

    if (vb.cues.length !== sc.steps.length) {
      err(c, s, `videoBeats.cues ${vb.cues.length}개 / 대본 스텝 ${sc.steps.length}개 — 개수가 달라 맞출 수 없다`);
      continue;
    }
    const secs = sc.steps.map(spokenSeconds);
    let at = 0;
    secs.forEach((d, i) => {
      const gap = at - vb.cues[i];
      if (Math.abs(gap) > BEAT_SLACK) {
        err(c, s, `step ${i} 이 영상 편집점과 ${gap > 0 ? "+" : ""}${gap.toFixed(1)}초 어긋난다 `
          + `(대본 ${at.toFixed(1)}초 · 영상 ${vb.cues[i].toFixed(1)}초)`);
      }
      at += d;
    });
    // 대본이 영상보다 길면 루프가 돌면서 편집점이 통째로 밀린다.
    if (at > vb.duration + BEAT_SLACK) {
      err(c, s, `대본 ${at.toFixed(1)}초 > 영상 ${vb.duration.toFixed(1)}초 — 영상이 다시 돌면서 편집점이 밀린다`);
    }
  }
}

/* ── 리포트 ───────────────────────────────────────────────── */
const C = { r: "\x1b[31m", y: "\x1b[33m", d: "\x1b[2m", b: "\x1b[1m", x: "\x1b[0m" };
const where = (c, s) => `${C.d}${c.key}${C.x} ${s.n ? String(s.n).padStart(3) : "   "} ${s.id}`;

// 상위 작업 도구는 표시 문장을 파싱하지 않고 이 전체 결과를 읽는다.
// CLI 출력의 목록 제한과 무관하게 모든 오류·후보를 보존한다.
if (argv.includes("--report-file")) {
  const destination = argv[argv.indexOf("--report-file") + 1];
  if (!destination || destination.startsWith("--")) throw new Error("--report-file 경로가 필요합니다.");
  const at = (c, s) => ({ chapter: c.key, id: s.id, number: s.n || null });
  const report = {
    schemaVersion: 1, complete: true, total: TOTAL,
    errors: errors.map((e) => ({ ...at(e.c, e.s), message: e.msg })),
    documents: docFixes, references: deadRefs,
    typeScale: { floor: FONT_FLOOR, scale: [...FONT_SCALE].map(([px, name]) => ({ px, name })), tiny: tinyText, offScale },
    candidates: candidates.map((e) => ({ ...at(e.c, e.s), message: e.msg })),
    pacing: pacing.map((p) => ({ ...at(p.c, p.s), step: p.split ? p.i : null,
      seconds: p.sec, tier: p.tier, limit: p.limit, draws: p.draws })),
    deserts: deserts.map((d) => ({ chapter: d.c.key, seconds: d.sec, ids: d.slides.map((s) => s.id) })),
    frozen: frozen.map((f) => ({ chapter: f.c.key, seconds: f.sec, from: f.from.id, to: f.to.id })),
  };
  fs.mkdirSync(path.dirname(path.resolve(destination)), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify(report, null, 2) + "\n");
}

console.log(`\n${C.b}강의 덱 콘텐츠 검사${C.x}  ${TOTAL}장 · ${targets.length}개 챕터\n`);

if (errors.length) {
  console.log(`${C.r}${C.b}오류 ${errors.length}건${C.x}  ${C.d}— 판정 필요 없음, 고쳐야 한다${C.x}`);
  for (const e of errors) console.log(`  ${where(e.c, e.s)}  ${e.msg}`);
  console.log("");
}
if (docFixes.length) {
  console.log(`${C.r}${C.b}문서 숫자 ${docFixes.length}건${C.x}${FIX ? `  ${C.d}— 고쳤다${C.x}` : `  ${C.d}— --fix 로 고친다${C.x}`}`);
  for (const f of docFixes) console.log(`  ${f.file}  ${f.was} → ${f.now}장`);
  console.log("");
}
if (deadRefs.length) {
  console.log(`${C.r}${C.b}죽은 번호 ${deadRefs.length}건${C.x}  ${C.d}— 주석이 가리키는 장표 번호가 실제와 다르다${C.x}`);
  for (const d of deadRefs) {
    console.log(`  ${d.file}:${d.line}  ${d.said} → ${C.b}${d.real}${C.x}  ${C.d}${d.slug}${C.x}`);
  }
  console.log("");
}
if (tinyText.length) {
  console.log(`${C.r}${C.b}글자 하한 ${tinyText.length}건${C.x}  ${C.d}— ${FONT_FLOOR}px 미만은 1080p 에서 안 읽힌다. course.css 의 --course-font-* 로 올린다${C.x}`);
  for (const t of tinyText.slice(0, 12)) console.log(`  ${t.file}:${t.line}  ${t.px}px`);
  if (tinyText.length > 12) console.log(`  ${C.d}… 외 ${tinyText.length - 12}건${C.x}`);
  console.log("");
}
if (offScale.length && !QUIET) {
  const byFile = new Map();
  for (const o of offScale) byFile.set(o.file, [...(byFile.get(o.file) ?? []), o]);
  console.log(`${C.y}${C.b}스케일 이탈 ${byFile.size}파일 · ${offScale.length}곳${C.x}  ${C.d}— @type-scale 을 선언한 판인데 원시 px 를 썼다. 사람이 판정한다${C.x}`);
  for (const [file, list] of byFile) {
    console.log(`  ${file}  ${C.b}${[...new Set(list.map((l) => `${l.px}px`))].join(" · ")}${C.x}  ${C.d}${list[0].line}행부터 ${list.length}곳${C.x}`);
  }
  console.log("");
}
if (candidates.length && !QUIET) {
  const groups = new Map();
  for (const c of candidates) {
    const k = `${c.c.key}|${c.key}`;
    if (!groups.has(k)) groups.set(k, { c: c.c, msg: c.msg, slides: [] });
    groups.get(k).slides.push(c.s);
  }
  console.log(`${C.y}${C.b}후보 ${groups.size}종 · ${candidates.length}곳${C.x}  ${C.d}— 사람이 판정한다. 이대로가 맞으면 course-terms.js 의 ALLOW 로${C.x}`);
  for (const g of [...groups.values()].sort((a, b) => b.slides.length - a.slides.length)) {
    const head = g.slides[0];
    const more = g.slides.length > 1 ? ` ${C.d}외 ${g.slides.length - 1}장${C.x}` : "";
    console.log(`  ${where(g.c, head)}${more}  ${g.msg}`);
    if (g.slides.length > 1) {
      console.log(`      ${C.d}${g.slides.map((s) => s.n).join(", ")}${C.x}`);
    }
  }
  console.log("");
}
if (pacing.length) {
  const n = (t) => pacing.filter((p) => p.sec > t).length;
  const perMin = beats / (narrationSec / 60);
  console.log(`${C.y}${C.b}리듬 ${pacing.length}곳${C.x}  ${C.d}— 오류가 아니라 작업 목록. 기준은 VIDEO-PACING-GUIDELINES.md${OFFLINE ? " · 오프라인 모드(한도 3배)" : ""}${C.x}`);
  console.log(
    `  ${C.d}대본 ${(narrationSec / 60).toFixed(0)}분 · 시각 상태 ${beats}개 → `
    + `분당 ${perMin.toFixed(1)}비트 (개념 설명 초기 점검 5~7 · 품질 점수 아님)${C.x}`);
  console.log(
    `  ${C.d}강도별 한도 초과 ${pacing.length} · `
    + `${DWELL_EFF.warn}초 초과 ${n(DWELL_EFF.warn)} · `
    + `${DWELL_EFF.bad}초 초과 ${n(DWELL_EFF.bad)} · ${DWELL_EFF.fail}초 초과 ${n(DWELL_EFF.fail)}${C.x}`);
  const tierTotal = tierCount.meaning + tierCount.focus + tierCount.text;
  const pct = (n) => `${Math.round((n / tierTotal) * 100)}%`;
  console.log(
    `  ${C.d}의미 ${tierCount.meaning} (${pct(tierCount.meaning)}) · `
    + `초점 ${tierCount.focus} (${pct(tierCount.focus)}) · `
    + `글 ${tierCount.text} (${pct(tierCount.text)})${C.x}`);
  if (deserts.length) {
    console.log(
      `\n  ${C.y}도형 없이 글만 가는 구간 ${deserts.length}곳${C.x}  `
      + `${C.d}— 분당 비트가 맞아도 여기서는 "슬라이드를 읽는 장면"이 된다${C.x}`);
    for (const d of (PACING || BRIEF ? deserts : deserts.slice(0, 5))) {
      const head = d.slides[0];
      const tail = d.slides[d.slides.length - 1];
      console.log(
        `    ${C.d}${d.c.key}${C.x} ${String(Math.round(d.sec)).padStart(3)}초 · `
        + `${d.slides.length}장  ${head.n} ${head.id} → ${tail.n} ${tail.id}`);
    }
    console.log("");
  }
  if (frozen.length) {
    console.log(
      `  ${C.y}그림이 안 바뀐 채 흐르는 구간 ${frozen.length}곳${C.x}  `
      + `${C.d}— 사진 ${FROZEN_EFF.photo}초 · 도형 ${FROZEN_EFF.figure}초 (§0 체감 장면 시계)${C.x}`);
    for (const f of (PACING || BRIEF ? frozen : frozen.slice(0, 5))) {
      const span = f.n > 1
        ? `${f.from.n} ${f.from.id} → ${f.to.n} ${f.to.id}`
        : `${f.from.n} ${f.from.id}`;
      console.log(
        `    ${C.d}${f.c.key}${C.x} ${String(Math.round(f.sec)).padStart(3)}초 · `
        + `${f.n}장  ${span}  ${C.d}${f.photo ? "사진" : f.from.layout}${C.x}`);
    }
    if (!PACING && !BRIEF && frozen.length > 5) {
      console.log(`    ${C.d}… 외 ${frozen.length - 5}곳${C.x}`);
    }
    console.log("");
  }
  /* --brief 는 화면별 나열을 안 한다. 이 목록은 한 번에 처리하는 작업이
     아니라 상시 켜져 있는 배경 상태라, 매번 다시 읽혀도 결정을 안 바꾼다.
     스텝을 못 그리는 화면(레이아웃부터 고쳐야 하는 자리)만 개수로 남긴다. */
  if (BRIEF) {
    const stuck = pacing.filter((p) => !p.draws).length;
    console.log(
      `  ${C.d}화면별 나열 ${pacing.length}줄 생략 — 보려면 --pacing`
      + `${stuck ? ` · 그중 ${stuck}곳은 레이아웃이 스텝을 안 그린다` : ""}${C.x}`);
  } else {
    const show = PACING ? pacing : pacing.slice(0, 12);
    for (const p of show) {
      // 스텝을 못 그리는 화면은 대본을 쪼개기 전에 레이아웃부터 고쳐야 한다
      const tierKo = { meaning: "의미", focus: "초점", text: "글" }[p.tier] ?? p.tier;
      const why = p.draws
        ? `${tierKo} 비트 ${p.limit}초 기준 초과`
        : `${p.s.layout} 은 스텝을 안 그린다`;
      const at = p.split ? ` ${C.d}step ${p.i}${C.x}` : "";
      console.log(`  ${where(p.c, p.s)}${at}  ${p.sec.toFixed(0)}초  ${C.d}${why}${C.x}`);
    }
    if (!PACING && pacing.length > show.length) {
      console.log(`  ${C.d}… 외 ${pacing.length - show.length}곳. 전부 보려면 --pacing${C.x}`);
    }
  }
  console.log("");
}

/* ── 공통 판 지도 (--templates) ──────────────────────────────
   챕터 전용 판(한 챕터에만 있는 것)은 접어서 수만 적는다. 볼 것은
   **여러 챕터가 나눠 쓰는 판이 어디서 끊겼나**다. */
if (TEMPLATES) {
  const keys = chapters.map((c) => c.key);
  const use = new Map();
  for (const c of chapters) {
    for (const s of c.slides) {
      if (!s.layout) continue;
      const row = use.get(s.layout) ?? new Map();
      row.set(c.key, (row.get(c.key) ?? 0) + 1);
      use.set(s.layout, row);
    }
  }
  const rows = [...use].map(([L, row]) => ({
    L, row,
    sum: [...row.values()].reduce((a, b) => a + b, 0),
    chs: row.size,
  }));
  const shared = rows.filter((r) => r.chs > 1).sort((a, b) => b.sum - a.sum);
  const solo = rows.filter((r) => r.chs === 1).sort((a, b) => b.sum - a.sum);

  console.log(`${C.b}공통 판 지도${C.x}  ${C.d}— 오류가 아니라 지도다. 빈칸은 그 챕터가 그 판을 안 쓴다는 뜻${C.x}`);
  console.log(`  ${"레이아웃".padEnd(16)}${keys.map((k) => k.replace("ch", "").padStart(5)).join("")}${"합계".padStart(7)}`);
  for (const r of shared) {
    const cells = keys.map((k) => {
      const v = r.row.get(k);
      return (v ? String(v) : `${C.d}·${C.x}`).padStart(v ? 5 : 5 + C.d.length + C.x.length);
    }).join("");
    console.log(`  ${r.L.padEnd(16)}${cells}${String(r.sum).padStart(7)}`);
  }
  console.log(`\n  ${C.d}챕터 전용 판 ${solo.length}종 · ${solo.reduce((a, r) => a + r.sum, 0)}장${C.x}`);
  console.log(`  ${C.d}${solo.slice(0, 12).map((r) => `${r.L}(${[...r.row.keys()][0].replace("ch", "")})`).join(" · ")}${solo.length > 12 ? " …" : ""}${C.x}`);
  console.log("");
}

if (!errors.length && !docFixes.length && !deadRefs.length && !candidates.length && !pacing.length
  && !tinyText.length && !offScale.length) console.log("  깨끗합니다.\n");

/* 죽은 번호와 글자 하한은 챕터 하나만 볼 때도 전부 센다 — 판이 챕터를 넘나든다. */
const fatal = errors.length + deadRefs.length + tinyText.length + (FIX ? 0 : docFixes.length);
console.log(`${C.d}오류 ${errors.length} · 문서 ${docFixes.length} · 죽은 번호 ${deadRefs.length}`
  + ` · 글자 하한 ${tinyText.length} · 후보 ${candidates.length + offScale.length}${C.x}\n`);
process.exit(fatal ? 1 : 0);
