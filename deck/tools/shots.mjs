/**
 * 장표를 확인하는 도구.  `npm run shots -- 18:3`  ·  `npm run shots -- --audit ch01`
 *
 * 화면이 깨지는 건 린터도 `tsc` 도 못 잡는다. 특히 **스텝을 늘리는 작업**은
 * 없던 요소가 새로 뜨는 일이라, 자리가 모자라면 그때 겹친다.
 *
 * ── 세 가지 모드, 그리고 왜 그런가 ──────────────────────────
 * 이미지를 읽는 건 비싸다. 사람에게도 그렇지만 AI 에게는 특히 그렇다 —
 * 스크린샷 한 장이 텍스트 수십 줄 값이다. 그래서 **기계가 셀 수 있는 것은
 * 세서 글로 뱉고**, 눈이 필요한 것만 그림으로 본다.
 *
 *   --audit chNN   그 챕터의 모든 장표 × 모든 스텝을 훑어 **위반만 글로**
 *   --motion chNN  상태마다 **끝나지 않는 움직임이 몇 개 도는지**
 *   --ghost chNN   장을 넘길 때 **앞 장의 끝 상태가 새 장 위에서 사그라지나**
 *   66:1,66:4      그 장표 그 스텝을 PNG 로 (모양·색·구도처럼 판정이 필요한 것)
 *
 * audit 은 435개 상태를 한 번에 본다. 그림으로는 못 하는 일이다.
 * motion 은 그 뒤의 질문이다 — audit 의 `dead` 가 "눌렀는데 안 바뀌나"를
 * 보고, motion 은 "바뀌고 난 그 상태가 영상인가 정지 사진인가"를 본다
 * (VIDEO-PACING-GUIDELINES.md §11).
 *
 * ── audit 이 잡는 것 ────────────────────────────────────────
 *   frame     1920×1080 밖으로 나간 요소
 *   safe      자막 안전영역(Y 820 아래)을 침범한 글 — course.css 머리 규칙
 *   overflow  칸보다 글이 길어 잘린 자리
 *   overlap   글이 든 두 요소가 서로 겹침
 *   dead      앞 스텝과 화면이 **똑같은** 스텝 — 눌러도 아무것도 안 바뀐다
 *
 * ── 알려진 오탐 ────────────────────────────────────────────
 *   promptify-shot          사진 위에서 Q 가 A 로 **교체되는** 자리라 둘이
 *                           같은 층에 겹쳐 있다. overlap 으로 잡힌다
 *   workflow-say-1      frame 64건. `.course-close__tests` 가 이 장에서는
 *                           `width:0 · overflow:hidden · opacity:0` 인 접힌
 *                           통인데, 그 안의 카드가 각자 640px 이라 상자는
 *                           화면 밖(x 1501~2055)에 잡힌다. **렌더하면 그
 *                           자리에 아무것도 없다** (2026-08-24 확인)
 *   foundation-index    frame·overflow 각 3건. 띠가 켜지면 캡처를
 *                           2.7배로 확대하는 화면이라(`shotFull`) 이미지가
 *                           액자 밖으로 나가는 게 **의도**다. 액자는
 *                           `overflow: hidden` 이라 실제로 보이는 건 없다
 *                           (2026-09-02 확인)
 *   toolpick-camera-in   카메라가 노드 하나로 파고드는 두 장이다. 다이브
 *   toolpick-camera-out  중에는 그림이 액자보다 커지므로 frame·overflow·
 *                           safe 가 뜬다. `.course-diagram` 이
 *                           `overflow: hidden` 이라 화면에는 안 보인다
 *                           (2026-09-03 확인)
 *
 * ── ghost 가 잡는 것 ───────────────────────────────────────
 * `scene` 이름의 첫 마디가 같으면 sceneGroup() 이 DOM 을 유지한다. 그래서
 * **꺼짐 쪽에 전환이 걸려 있으면** 앞 장의 마지막 상태가 다음 장 0 스텝
 * 위에서 0.5초쯤 더 떠 있다가 사그라진다. 같은 요소에 다음 장의 글이
 * 이미 들어가 있으면 **다음 장의 마지막 스텝 문장이 0 스텝에서 잠깐
 * 보였다 사라진다** — 111 → 112 가 그 자리였다 (2026-09-03).
 *
 * 재는 법은 셋을 찍는 것이다. → 를 누른 **직후**·60ms 뒤·900ms 뒤.
 * 앞 둘 중 하나라도 보였는데 마지막에 안 보이면 그건 사그라진 것이다.
 *
 * 안 세는 것 셋:
 *   지워진 요소     삭제는 즉시라 화면에 안 남는다 (isConnected=false)
 *   교체되는 자리   나가는 자리에 **들어오는 것이 있으면** 그건 묶음이
 *                   일부러 하는 판 갈이다 (grokx · failure · close)
 *   SMIL 로 도는 것 흐르는 점은 opacity 가 `0;1;1;0` 으로 끝없이 돈다 —
 *                   두 번째 표본이 주기의 바닥에 걸린 것뿐이다
 *
 * 화면과 빌드가 다 조용한 결함이라 눈으로만 잡힌다. 그래서 도구가 있다.
 * 고치는 법은 `transition` 을 `[data-on="true"]` 안으로 옮기는 것이다 —
 * 켤 때만 전환이 걸리고 끌 때는 즉시 사라진다 (docs/authoring-rules.md 화면과 전환).
 *
 * frame·safe 는 **보이지 않는 요소도 잰다.** 등장 전에 밖에 세워 두는
 * 연출은 여기 걸리게 되어 있으니, 새로 뜨면 먼저 그 상태를 렌더해서
 * 화면에 실제로 보이는지부터 본다.
 *
 * overflow·overlap 은 그렇지 않다 — **지금 보이는 것만** 센다.
 * 등장 전 카드를 상자 밖에 세워 두는 연출(`translateY(10~18px)`)과, 같은
 * 자리에 쌓아 두고 하나씩 켜는 구도가 이 덱에 흔해서, 그걸 세면 화면에
 * 아무 일도 없는 위반이 수십 건씩 쌓이고 **진짜 결함이 그 사이에 묻힌다.**
 * ch02 에서 110건 중 66건이 그런 자리였다 (2026-09-02).
 * 조상까지 올라가며 `opacity`·`visibility`·`display` 를 보고 거른다 —
 * 자식 글의 opacity 는 조상이 꺼져 있어도 1 이라, 자기 것만 보면 안 된다.
 *
 * `dead` 가 이 도구의 값이다. 린터의 검사 9 는 카피형만 보는데, 이건
 * 레이아웃과 무관하게 "이 비트가 진짜 비트인가"를 DOM 으로 판정한다.
 *
 * 배경 앰비언트(Aurora·글로우)는 계속 움직이므로 픽셀로 비교하면 전부
 * 다르다고 나온다. 그래서 **DOM 지문**으로 비교한다 — 보이는 요소의
 * 클래스 · data 속성 · 글 · 자리.
 *
 *   node tools/shots.mjs --audit ch01
 *   node tools/shots.mjs --audit ch01 --slides 100-120
 *   node tools/shots.mjs --motion ch01
 *   node tools/shots.mjs --ghost ch01
 *   node tools/shots.mjs 66:1,66:4,67:3
 *
 * 번호는 **덱 전역 번호**다 (린터가 찍는 그 번호).
 * 5180 포트가 떠 있으면 그걸 쓰고, 없으면 띄웠다 끝나면 내린다.
 */

import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { chapterEntries, chapterIds as idsOf } from "./chapters.mjs";
import { readCourse, runtimeRules } from "./source-model.mjs";
import { settleStaticScene } from "./static-scene.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const option = (name) => argv.includes(name) ? argv[argv.indexOf(name) + 1] : null;
const OUT = option("--out-dir") || path.join(ROOT, "render/shots");
const PORT = Number(process.env.SHOTS_PORT ?? 5180);
const BASE = option("--base-url") || `http://127.0.0.1:${PORT}`;
const REPORT_FILE = option("--report-file");
let report = { schemaVersion: 1, complete: false, findings: [], images: [] };

/** 자막 전용 구간. 일반 화면은 Y 126~800 만 쓴다 (course.css 머리 주석). */
const SAFE_TOP = 820;
const W = 1920;
const H = 1080;

const auditAt = argv.indexOf("--audit");
const AUDIT = auditAt >= 0 ? argv[auditAt + 1] : null;
const motionAt = argv.indexOf("--motion");
const MOTION_CH = motionAt >= 0 ? argv[motionAt + 1] : null;
const ghostAt = argv.indexOf("--ghost");
const GHOST_CH = ghostAt >= 0 ? argv[ghostAt + 1] : null;
const rangeAt = argv.indexOf("--slides");
const RANGE = rangeAt >= 0 ? argv[rangeAt + 1] : null;
const shotList = argv.find((a) => /^\d+(:\d+)?(,\d+(:\d+)?)*$/.test(a));

if (!AUDIT && !MOTION_CH && !GHOST_CH && !shotList) {
  console.error(
    "사용법:\n"
    + "  node tools/shots.mjs 66:1,66:4        장표:스텝 을 PNG 로\n"
    + "  node tools/shots.mjs --audit ch01     그 챕터를 통째로 훑어 위반만 글로\n"
    + "  node tools/shots.mjs --motion ch01    상태마다 움직임이 몇 개 도는지\n"
    + "  node tools/shots.mjs --ghost ch01     장을 넘길 때 앞 장의 끝 상태가 남나",
  );
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── 챕터가 전역 몇 번부터 몇 번인가 ──────────────────────────
   덱은 챕터 순서대로 이어 붙는다. 화면을 세면 범위가 나온다.
   챕터 하나가 여러 파일일 수 있으므로 수집은 chapters.mjs 가 한다. */
function chapterRange(key) {
  let start = 1;
  for (const entry of chapterEntries()) {
    const n = idsOf(entry).length;
    if (entry.key === key) return { from: start, to: start + n - 1 };
    start += n;
  }
  return null;
}

/** 그 챕터의 화면 ID 를 순서대로. `--motion` 이 줄머리에 적는다. */
function chapterIds(key) {
  const entry = chapterEntries().find((e) => e.key === key);
  return entry ? idsOf(entry) : [];
}

let server = null;
let browser = null;
try {
const course = readCourse(ROOT);
const { slideSteps } = runtimeRules(ROOT);
const lastStep = (n) => slideSteps(course[n - 1]);
try {
  const r = await fetch(BASE);
  if (!r.ok) throw new Error("not ready");
} catch {
  if (option("--base-url")) throw new Error("지정한 검사 서버에 연결할 수 없습니다.");
  server = spawn("npm", ["run", "dev", "--", "--mode", "capture", "--host", "127.0.0.1", "--port", String(PORT)], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE);
      if (r.ok) break;
    } catch {}
    await sleep(500);
  }
}

browser = await chromium.launch({
  headless: true,
  args: ["--enable-gpu", "--use-gl=angle", "--use-angle=metal"],
});
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
/* Vite 의 HMR 연결은 네트워크를 계속 열어 둔다. `networkidle` 을 기다리면
   화면이 이미 준비됐는데도 30초 뒤 실패할 수 있으므로 DOM과 실제 stage를 본다. */
await page.goto(`${BASE}/#course`, { waitUntil: "domcontentloaded" });
await page.waitForSelector(".stage", { state: "visible" });

/* 덱은 두 창이 BroadcastChannel 로 상태를 나눈다. 발표자 창인 척 붙어서
   지금 몇 번 장표의 몇 번 스텝인지 읽는다 — 스텝이 실제로 도달했는지
   확인하지 않으면 전환 중간 프레임을 보게 된다. */
async function attachNav() {
  await page.waitForSelector(".stage", { state: "visible" });
  await page.evaluate(() => {
    window.__shotsNav = null;
    const ch = new BroadcastChannel("udemy-deck-sync");
    ch.onmessage = (e) => {
      if (e.data?.type === "nav" && e.data?.deck === "course") window.__shotsNav = e.data.nav;
    };
    ch.postMessage({ type: "hello", deck: "course", from: "shots" });
  });
  await page.waitForFunction(() => window.__shotsNav !== null);
  await page.keyboard.press("h"); // 하단 발표자 바 숨김
}
await attachNav();

async function goTo(n) {
  for (const d of String(n)) await page.keyboard.press(d);
  await page.keyboard.press("Enter");
  await page.waitForFunction((i) => window.__shotsNav?.index === i, n - 1);
}

/**
 * 스텝에서 이미지 경로가 바뀌면 레이아웃 전환은 끝났어도 새 파일의 decode 는
 * 아직 끝나지 않을 수 있다. 그 프레임을 찍으면 실제 영상에는 없는 빈 액자와
 * 0×0 상자를 검사하게 된다. 현재 장면의 미디어가 읽힐 때까지 기다린다.
 */
async function waitForCurrentMedia() {
  await page.waitForFunction(() => {
    const slide = document.querySelector(".slide.course-slide");
    if (!slide) return false;
    const imagesReady = [...slide.querySelectorAll("img")]
      .every((img) => img.complete && img.naturalWidth > 0);
    const videosReady = [...slide.querySelectorAll("video")]
      .every((video) => video.readyState >= 2);
    return imagesReady && videosReady;
  }, undefined, { timeout: 8000 });
}

/* ── 화면을 재는 코드 (브라우저 안에서 돈다) ──────────────────
   글이 든 **잎 요소**만 본다. 부모는 자식을 당연히 품으므로 겹침 판정에
   넣으면 전부 걸린다. */
const MEASURE = ({ safeTop, w, h }) => {
  const frame = document.querySelector(".slide.course-slide") ?? document.body;
  const all = [...frame.querySelectorAll("*")];
  const seen = [];
  const sig = [];

  /* 겹침을 "층"으로 본다. 절대배치된 조상이 다르면 서로 다른 층이고,
     그건 일부러 겹쳐 놓은 것이다 — 사진 위에서 Q 가 A 로 교체되는 자리,
     그림을 덮고 떠오르는 판(부록 카드 · Anthropic 팝업). 같은 층 안에서
     둘이 겹치는 것만 사고다. */
  const layerIds = new Map();
  const layerOf = (el) => {
    let p = el;
    while (p && p !== frame) {
      const pos = getComputedStyle(p).position;
      if (pos === "absolute" || pos === "fixed") break;
      p = p.parentElement;
    }
    const key = p ?? frame;
    if (!layerIds.has(key)) layerIds.set(key, layerIds.size);
    return layerIds.get(key);
  };

  /* 안 보이는 요소가 만든 scrollHeight 는 **아무것도 자르지 않는다.**
     이 덱은 등장 전 카드를 `translateY(10~18px)` 로 상자 밖에 세워 두고
     열 때 제자리로 넣는다 (context-checkpoint · grokx__panel ·
     close__landing). 그 자리를 잘림으로 세면 화면에 아무 일도 없는
     위반이 수십 건씩 쌓여서 **진짜 잘림이 그 사이에 묻힌다.**
     상자를 넘는 후손 중 실제로 보이는 게 하나라도 있을 때만 잘림이다. */
  const shown = (el, stopAt) => {
    let p = el;
    while (p && p !== stopAt) {
      const s = getComputedStyle(p);
      if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) < 0.06) return false;
      p = p.parentElement;
    }
    return true;
  };
  const effectiveOpacity = (el, stopAt) => {
    let p = el;
    let value = 1;
    while (p && p !== stopAt) {
      value *= Number(getComputedStyle(p).opacity);
      p = p.parentElement;
    }
    return value;
  };
  const clipsSomethingVisible = (box) => {
    const br = box.getBoundingClientRect();
    for (const c of box.querySelectorAll("*")) {
      const r = c.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const out =
        r.bottom > br.bottom + 4 || r.top < br.top - 4
        || r.right > br.right + 4 || r.left < br.left - 4;
      if (out && shown(c, box)) return true;
    }
    return false;
  };

  /** 배경·테두리 효과·SVG 는 화면 밖으로 나가는 게 정상이다. */
  const decorative = (el) =>
    el.closest('[aria-hidden="true"]') !== null
    || /^(svg|canvas|path|line|circle|rect|defs|filter|feGaussianBlur)$/i.test(el.tagName)
    || /course-bg|aurora|^eb-|__glow|__veil|__beam|__signal/.test(
      (el.className || "").toString(),
    );

  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const op = Number(cs.opacity);
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;

    // 지문은 보이든 안 보이든 상태를 담는다 — data 속성이 곧 스텝 상태다.
    /* 부모의 data-step 숫자만 바뀌고 실제 화면은 그대로인 죽은 스텝이
       있었다 (CH01 55·56·57·64장). 그 숫자를 지문에 넣으면 무조건 다른
       상태로 판정되어 검사가 스스로를 속인다. 실제 data-on/data-focus와
       계산된 스타일·가상 요소가 바뀌는지를 본다. */
    const data = [...el.attributes]
      .filter((a) => a.name.startsWith("data-") && a.name !== "data-step")
      .map((a) => `${a.name}=${a.value}`)
      .join(",");
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(" ")
      .slice(0, 80);
    const visual = [
      cs.color,
      cs.backgroundColor,
      cs.borderColor,
      cs.transform,
      cs.filter,
      cs.boxShadow,
      cs.outlineColor, cs.outlineStyle, cs.outlineWidth, cs.outlineOffset,
    ].join(";");
    const pseudo = ["::before", "::after"].map((which) => {
      const ps = getComputedStyle(el, which);
      return [
        which,
        ps.content,
        ps.opacity,
        ps.color,
        ps.backgroundColor,
        ps.transform,
        ps.filter,
        ps.boxShadow,
      ].join(":");
    }).join("|");
    sig.push(
      `${el.tagName}.${el.className}|${data}|${own}|`
      + `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}|`
      + `${op.toFixed(2)}|${visual}|${pseudo}`,
    );

    if (op < 0.06) continue;        // 아직 안 열린 자리
    if (decorative(el)) continue;

    const text = own.length > 0;
    // 잎: 글을 직접 들고 있고 자식에게는 글이 없는 요소
    const leaf = text && ![...el.children].some((c) => c.textContent.trim());
    // 인라인은 줄바꿈되면 bounding box 가 두 줄을 통째로 감싼다 —
    // 형제끼리 당연히 겹쳐 보이므로 겹침 판정에서 뺀다.
    const inline = cs.display.startsWith("inline");
    let cls = (el.className || "").toString().split(" ")[0];
    if (!cls) cls = `${el.tagName.toLowerCase()}<${(el.parentElement?.className || "").toString().split(" ")[0]}>`;

    /* 카메라 월드는 의도적으로 뷰포트 밖까지 크게 그린 뒤 확대·이동한다.
       그 안의 요소는 실제로 보이는 교집합만 검사해야 한다. 일반 overflow
       화면은 기존처럼 원본 rect를 써서 숨겨진 카드의 사고도 계속 잡는다. */
    const camera = el.closest("[data-audit-camera]");
    const cr = camera?.getBoundingClientRect();
    const visible = cr
      ? {
          x: Math.max(r.x, cr.x),
          y: Math.max(r.y, cr.y),
          right: Math.min(r.right, cr.right),
          bottom: Math.min(r.bottom, cr.bottom),
        }
      : { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
    if (visible.right - visible.x < 1 || visible.bottom - visible.y < 1) continue;

    seen.push({
      cls,
      x: visible.x,
      y: visible.y,
      w: visible.right - visible.x,
      h: visible.bottom - visible.y,
      text, leaf, inline, layer: leaf ? layerOf(el) : -1,
      // 자기 opacity 는 1 인데 조상이 꺼져 있는 글. frame·safe 는 이런
      // 것도 재야 하지만(등장 전 자리를 보려고) 겹침 판정에서는 뺀다.
      shownNow: shown(el, frame),
      captionRelaxed: el.closest("[data-audit-caption-relaxed]") !== null,
      effectiveOpacity: effectiveOpacity(el, frame),
      // 잘린 것만 결함이다. overflow: visible 은 넘쳐도 안 잘리고,
      // 화면 밖으로 나가면 frame 검사가 잡는다. 그리고 **넘치는 것이
      // 보여야** 잘린 것이다 (clipsSomethingVisible).
      clipped:
        !el.hasAttribute("data-audit-camera")
        && (cs.overflow === "hidden" || cs.overflowY === "hidden" || cs.overflowX === "hidden")
        && (el.scrollWidth - el.clientWidth > 4 || el.scrollHeight - el.clientHeight > 4)
        && clipsSomethingVisible(el),
      overX: el.scrollWidth - el.clientWidth,
      overY: el.scrollHeight - el.clientHeight,
    });
  }

  const hit = [];
  for (const e of seen) {
    if (e.x < -2 || e.y < -2 || e.x + e.w > w + 2 || e.y + e.h > h + 2) {
      hit.push(`frame ${e.cls} (${Math.round(e.x)},${Math.round(e.y)} ${Math.round(e.w)}×${Math.round(e.h)})`);
    }
    if (e.text && e.y + e.h > safeTop && (!e.captionRelaxed || e.effectiveOpacity >= 0.35)) {
      hit.push(`safe ${e.cls} 이 Y${Math.round(e.y + e.h)} 까지 내려옴`);
    }
    if (e.clipped) {
      hit.push(`overflow ${e.cls} 이 잘림 (+${e.overX}×${e.overY})`);
    }
  }

  /* 겹침은 **지금 화면에 같이 보이는 둘**만 사고다. 같은 자리에 쌓아 두고
     하나씩 켜는 구도(failure__decision-states 다섯)는 꺼진 넷이 조상의
     opacity 로만 숨어 있어서, 자식 글의 opacity 는 1 이다. */
  const leaves = seen.filter((e) => e.leaf && !e.inline && e.shownNow);
  for (let i = 0; i < leaves.length; i++) {
    for (let j = i + 1; j < leaves.length; j++) {
      const a = leaves[i], b = leaves[j];
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (a.layer !== b.layer) continue;   // 다른 층 — 일부러 겹쳐 둔 것
      if (ox > 6 && oy > 6 && ox * oy > Math.min(a.w * a.h, b.w * b.h) * 0.3) {
        hit.push(`overlap ${a.cls} × ${b.cls}`);
      }
    }
  }
  return { hits: [...new Set(hit)], sig: sig.join("\n") };
};

const hash = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);

/* ── 정지감을 재는 코드 (브라우저 안에서 돈다) ────────────────
   `dead` 는 **스텝이 눌렸는데 화면이 그대로인가**를 본다. 여기는 그
   다음 질문이다 — 스텝이 바뀌긴 했는데, 바뀌고 난 **그 상태가 영상인가
   정지 사진인가**.

   전이는 0.5초에 끝난다. 그런데 한 스텝의 대본은 보통 8~17초다. 그래서
   `끝나지 않는(infinite) 애니메이션이 지금 몇 개 도는가`를 센다.
   0 이면 그 상태는 진입 0.5초 뒤부터 완전한 정지 프레임이다
   (VIDEO-PACING-GUIDELINES.md §11).

   배경의 빛은 안 센다. 모든 화면에 깔려 있는 바닥이라 세면 전부 1이
   되어 아무것도 못 찾는다. */
/* ── 유령 전환을 재는 코드 (브라우저 안에서 돈다) ──────────────
   `→` 를 누른 직후에 이걸 부른다. 세 번 찍는다 — 지금 · 60ms · 900ms.

   앞 둘 중 하나라도 **보였는데** 마지막에 **안 보이면** 그건 새 장 위에서
   사그라진 것이다. 누른 직후에는 React 가 아직 갈아 끼우기 전이라 앞 장의
   끝 상태가 그대로 잡히고, 60ms 짜리가 전환 지연(0.15~0.2s)에 들어간 것을
   받는다.

   지워진 요소는 안 센다 — 삭제는 즉시라 화면에 남지 않는다. 조상이 같이
   사그라지면 조상만 적는다. 안 그러면 판 하나에 자식 스무 개가 딸려 온다. */
const GHOST = async ({ wait }) => {
  const slide = document.querySelector(".slide.course-slide") ?? document.body;
  const els = [...slide.querySelectorAll("*")];
  const nap = (ms) => new Promise((r) => setTimeout(r, ms));

  const snap = () =>
    els.map((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        on: el.isConnected,
        o: cs.visibility === "hidden" || cs.display === "none" ? 0 : Number(cs.opacity) || 0,
        w: r.width,
        h: r.height,
        x: r.x,
        y: r.y,
        t: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 64),
      };
    });

  const a0 = snap();
  await nap(60);
  const a1 = snap();
  await nap(wait);
  const b = snap();

  /* 나가는 자리에 **들어오는 것이 있으면** 그건 교체다. 판 하나가 물러나고
     다른 판이 그 자리에 서는 연출이 이 덱에 여럿 있다(grokx · failure ·
     close). 그건 묶음이 일부러 하는 일이라 유령이 아니다 — 앞 장의 끝
     상태가 **빈 자리 위에** 남는 것만 사고다. */
  const arriving = [];
  for (let i = 0; i < els.length; i++) {
    if (!b[i].on) continue;
    if (b[i].o < 0.5 || b[i].w < 2 || b[i].h < 2) continue;
    /* "원래 있던 것"을 opacity 0 으로만 가리면 놓친다 — 누른 직후에 React 가
       이미 갈아 끼운 뒤라, 들어오는 판이 두 번째 표본에서 벌써 0.1~0.3 쯤
       올라와 있다. **얼마나 올랐나**로 본다. */
    if (b[i].o - Math.max(a0[i].o, a1[i].o) < 0.4) continue;
    arriving.push(b[i]);
  }
  const replaced = (r) => {
    const area = r.w * r.h;
    if (area <= 0) return false;
    return arriving.some((q) => {
      const ox = Math.min(r.x + r.w, q.x + q.w) - Math.max(r.x, q.x);
      const oy = Math.min(r.y + r.h, q.y + q.h) - Math.max(r.y, q.y);
      return ox > 0 && oy > 0 && (ox * oy) / area > 0.4;
    });
  };

  /* 앞 장에서 보였고 · 지금은 안 보이고 · 지워지지도 않았다.
     너비만 접히는 통(width:0 · overflow:hidden)도 같은 사고라 같이 본다. */
  const gone = new Set();
  const out = [];
  for (let i = 0; i < els.length; i++) {
    if (!b[i].on) continue;                       // 지워졌다 — 즉시라 유령 아님
    const wasOn = Math.max(a0[i].o, a1[i].o) > 0.06
      && Math.max(a0[i].w, a1[i].w) > 2
      && Math.max(a0[i].h, a1[i].h) > 2;
    if (!wasOn) continue;
    const faded = b[i].o < 0.06;
    const collapsed = Math.max(a0[i].w, a1[i].w) > 8 && b[i].w < 2;
    if (!faded && !collapsed) continue;
    /* SMIL 로 도는 것은 유령이 아니다. 흐르는 점은 opacity 가
       `0;1;1;0` 으로 **끝없이 돈다** — 두 번째 표본이 그 주기의 바닥에
       걸리면 사그라진 것처럼 보인다. 전환이 아니라 애니메이션이라
       다음 장 위에 남지 않는다. */
    if (els[i].querySelector("animate, animateMotion, animateTransform, set")) continue;
    gone.add(els[i]);   // 교체여도 자식까지 다시 적지 않는다
    if (replaced(a0[i].o >= a1[i].o ? a0[i] : a1[i])) continue;
    // 조상이 이미 잡혔으면 그 조상 하나로 적는다
    let p = els[i].parentElement;
    let covered = false;
    while (p && p !== slide) {
      if (gone.has(p)) { covered = true; break; }
      p = p.parentElement;
    }
    if (covered) continue;
    /* `i` · `small` 만 적어 두면 CSS 에서 못 찾는다. 클래스가 붙은 제일
       가까운 조상까지 같이 적어 그 규칙을 바로 열 수 있게 한다. */
    const named = (el) => el.getAttribute("class") || el.tagName.toLowerCase();
    let up = els[i].parentElement;
    while (up && up !== slide && !up.getAttribute("class")) up = up.parentElement;
    const own = named(els[i]);
    const path = up && up !== slide ? `${named(up)} > ${own}` : own;
    out.push({
      cls: path,
      kind: faded ? "fade" : "collapse",
      before: a0[i].t,
      after: b[i].t,
      swapped: a0[i].t !== b[i].t && (a0[i].t || b[i].t) ? 1 : 0,
    });
  }
  return { hits: out, nav: window.__shotsNav };
};

const AMBIENT = ["course-breathe", "course-still-light"];

const MOTION = () => {
  const slide = document.querySelector(".slide.course-slide") ?? document.body;
  const names = [];
  // `animation: a 1s both, b 2s infinite` 의 iteration-count 는 "1, infinite"
  // 로 계산된다. trim 없이 split 하면 " infinite" 가 되어 안 잡힌다 —
  // 콤마로 이어 붙인 애니메이션이 통째로 미탐지되던 자리다.
  const running = (name, iter) =>
    name &&
    name !== "none" &&
    iter.split(",").some((n) => n.trim() === "infinite");

  for (const el of slide.querySelectorAll("*")) {
    const cs = getComputedStyle(el);
    if (running(cs.animationName, cs.animationIterationCount)) {
      const r = el.getBoundingClientRect();
      // 자리만 잡는 0×0 상자에 걸린 규칙은 화면에서 안 보인다
      if (r.width >= 1 && r.height >= 1 && cs.visibility !== "hidden") {
        names.push(cs.animationName);
      }
    }
    for (const ps of ["::before", "::after"]) {
      const p = getComputedStyle(el, ps);
      if (p.content !== "none" && running(p.animationName, p.animationIterationCount)) {
        names.push(p.animationName);
      }
    }
  }

  /* CSS 밖에서 도는 것들. SVG 난류 필터 · WebGL · JS 셰이더라
     getComputedStyle 로는 안 잡힌다. */
  const fx = [];
  if (slide.querySelector(".course-handoff__slot--live")) fx.push("electric");
  if (slide.querySelector(".course-bg__aurora canvas")) fx.push("aurora");
  if (slide.querySelector("[class*='shiny']")) fx.push("shiny");

  return {
    scene: [...new Set(names.filter((n) => !AMBIENT_NAMES.includes(n.split("::")[0])))],
    fx,
  };
};

if (MOTION_CH) {
  const range = chapterRange(MOTION_CH);
  if (!range) {
    throw new Error(`챕터 ${MOTION_CH} 없음`);
  }
  let [from, to] = [range.from, range.to];
  if (RANGE) {
    const [a, b] = RANGE.split("-").map(Number);
    from = Math.max(from, a);
    to = Math.min(to, b || a);
  }

  const ids = chapterIds(MOTION_CH);
  await page.evaluate((list) => { window.AMBIENT_NAMES = list; }, AMBIENT);
  console.log(`\n${MOTION_CH} · ${from}~${to}번 장표의 움직임\n`);
  console.log("  \x1b[2m숫자 = 그 상태에서 도는 씬 움직임의 종류. · 는 하나도 없음\x1b[0m");
  console.log("  \x1b[2m+n 은 CSS 밖 효과(electric · aurora · shiny)\x1b[0m\n");

  let states = 0;
  let dead = 0;
  const stillSlides = [];
  for (let n = from; n <= to; n++) {
    await goTo(n);
    const id = ids[n - range.from] ?? "";
    const cells = [];
    for (let step = 0; step <= lastStep(n); step++) {
      await sleep(420);
      const nav = await page.evaluate(() => window.__shotsNav);
      if (nav.index + 1 !== n || nav.step !== step) throw new Error(`__shotsNav: ${n}:${step}에 도달하지 못했습니다.`);
      await waitForCurrentMedia();
      states += 1;
      // 브라우저 쪽에 AMBIENT_NAMES 를 심어 두고 그걸 쓴다
      const { scene, fx } = await page.evaluate(MOTION);
      if (!scene.length) dead += 1;
      cells.push(
        `${step}:${scene.length || "·"}${fx.length ? `+${fx.length}` : ""}`,
      );
      if (step < lastStep(n)) await page.keyboard.press("ArrowRight");
    }
    if (cells.some((c) => c.includes(":·"))) stillSlides.push(n);
    console.log(
      `${String(n).padStart(3)}  ${id.padEnd(28)}${cells.join("  ")}`,
    );
  }

  console.log(
    `\n상태 ${states}개 · 씬 움직임이 없는 상태 ${dead}개`
    + ` (${Math.round((dead / Math.max(states, 1)) * 100)}%)\n`,
  );
  if (stillSlides.length) {
    console.log(
      "  \x1b[2m`·` 가 전부 나쁜 건 아니다 — 3초짜리 착지 스텝은 그대로 둬도 된다.\x1b[0m",
    );
    console.log(
      "  \x1b[2m`·`은 무한 모션이 없다는 뜻이다. 반복·흐름·대기를 설명하는 자리인지 먼저 확인한다.\x1b[0m\n",
    );
  }
  report = { ...report, mode: "motion", complete: true, states, withoutLoop: dead, stillSlides };
} else if (GHOST_CH) {
  const crossChapter = argv.includes("--cross-chapter");
  const range = crossChapter ? { from: 1, to: course.length } : chapterRange(GHOST_CH);
  if (!range) {
    throw new Error(`챕터 ${GHOST_CH} 없음`);
  }
  let [from, to] = [range.from, range.to];
  if (RANGE) {
    const [a, b] = RANGE.split("-").map(Number);
    from = Math.max(from, a);
    to = Math.min(to, b || a);
  }

  await page.keyboard.press("m"); // 앰비언트 모션 끔 — 배경이 유령으로 안 잡히게
  const ids = crossChapter ? course.map((s) => s.id) : chapterIds(GHOST_CH);
  console.log(`\n${GHOST_CH} · ${from}~${to}번 장표의 경계를 봅니다\n`);
  console.log("  \x1b[2m→ 를 누른 직후 남아 있다가 사그라지는 것만 적는다\x1b[0m\n");

  let edges = 0;
  let lost = 0;
  const findings = [];
  for (let n = from; n < to; n++) {
    /* 챕터 하나가 10분이 넘는다. 그 사이 Vite 가 한 번 다시 붙으면
       `page.evaluate` 가 "execution context was destroyed" 로 죽는데,
       그때까지 잰 100여 개 경계가 통째로 날아간다. 경계 하나를 포기하고
       다음으로 간다 — 놓친 개수는 끝에 적는다. */
    try {
      await goTo(n);
      /* 마지막 스텝까지 간 다음, 그 한 번의 → 가 경계다. 중간 스텝은
         잴 필요가 없어서 짧게 지나간다. */
      for (let step = 0; step < lastStep(n); step++) {
        await page.waitForFunction(({ index, step }) => window.__shotsNav?.index === index && window.__shotsNav?.step === step,
          { index: n - 1, step });
        await page.keyboard.press("ArrowRight");
      }
      await page.waitForFunction(({ index, step }) => window.__shotsNav?.index === index && window.__shotsNav?.step === step,
        { index: n - 1, step: lastStep(n) });
      // 앞 장의 끝 상태를 충분히 정착시킨다. 중간 스텝마다 960ms GHOST 측정을
      // 실행하던 비용을 없애되 실제 경계의 직후·60ms·이후 표본은 그대로 유지한다.
      await sleep(1200);
      await waitForCurrentMedia();
      await page.keyboard.press("ArrowRight");
      const { hits, nav } = await page.evaluate(GHOST, { wait: 900 });
      if (nav.index + 1 !== n + 1 || nav.step !== 0) throw new Error("경계에 도달하지 못했습니다.");
      edges += 1;
      for (const h of hits) findings.push({ n, id: ids[n - range.from] ?? "", ...h });
    } catch (e) {
      lost += 1;
      console.log(`   \x1b[2m${n} → ${n + 1} 못 쟀다 (${String(e.message).split("\n")[0]})\x1b[0m`);
      // 페이지가 다시 붙었을 수 있으므로 발표자 채널을 다시 연다
      try { await attachNav(); } catch {}
    }
  }

  console.log(
    `경계 ${edges}개 · 유령 ${findings.length}건`
    + (lost ? ` · 못 잰 경계 ${lost}개` : "") + "\n",
  );
  report = { ...report, mode: "ghost", complete: lost === 0 && edges === to - from, edges, lost, findings };
  const byEdge = new Map();
  for (const f of findings) {
    const key = `${f.n}`;
    if (!byEdge.has(key)) byEdge.set(key, []);
    byEdge.get(key).push(f);
  }
  for (const [key, list] of byEdge) {
    const n = Number(key);
    console.log(`── ${n} → ${n + 1}   ${list[0].id}`);
    for (const f of list) {
      /* 글이 바뀐 채로 사그라지면 **다음 장의 뒷 스텝 문장**이 0 스텝에서
         잠깐 보였다 사라진다는 뜻이다. 같은 유령이라도 이게 제일 나쁘다. */
      const mark = f.swapped ? " \x1b[33m← 글까지 바뀐 채로 사그라진다\x1b[0m" : "";
      console.log(`   ${f.kind === "fade" ? "사그라짐" : "접힘  "} ${f.cls}${mark}`);
      if (f.after) console.log(`      \x1b[2m남는 글: ${f.after}\x1b[0m`);
      else if (f.before) console.log(`      \x1b[2m남는 글: ${f.before}\x1b[0m`);
    }
  }
  if (!findings.length) console.log("  깨끗합니다.");
  else {
    console.log(
      "\n  \x1b[2m고치는 법: 그 요소의 `transition` 을 `[data-on=\"true\"]` 안으로 옮긴다.\x1b[0m",
    );
    console.log(
      "  \x1b[2m켤 때만 전환이 걸리고, 끌 때는 즉시 사라진다 (docs/authoring-rules.md 화면과 전환)\x1b[0m",
    );
  }
  console.log("");
} else if (AUDIT) {
  const range = chapterRange(AUDIT);
  if (!range) {
    throw new Error(`챕터 ${AUDIT} 없음`);
  }
  let [from, to] = [range.from, range.to];
  if (RANGE) {
    const [a, b] = RANGE.split("-").map(Number);
    from = Math.max(from, a);
    to = Math.min(to, b || a);
  }

  await page.keyboard.press("m"); // 앰비언트 모션 끔 — 지문이 흔들리지 않게
  await page.evaluate(() => document.querySelector(".deck-course")?.setAttribute("data-course-motion", "off"));
  console.log(`\n${AUDIT} · ${from}~${to}번 장표를 훑습니다\n`);

  const findings = [];
  let states = 0;
  for (let n = from; n <= to; n++) {
    await goTo(n);
    let prev = null;
    for (let step = 0; step <= lastStep(n); step++) {
      if (!["ch04", "ch05"].includes(AUDIT)) await sleep(420);
      const nav = await page.evaluate(() => window.__shotsNav);
      if (nav.index + 1 !== n || nav.step !== step) throw new Error(`__shotsNav: ${n}:${step}에 도달하지 못했습니다.`);
      await waitForCurrentMedia();
      if (["ch04", "ch05"].includes(AUDIT)) await page.evaluate(settleStaticScene);
      states += 1;
      const { hits, sig } = await page.evaluate(MEASURE, { safeTop: SAFE_TOP, w: W, h: H });
      const h = hash(sig);
      if (prev && prev === h) hits.push("dead 앞 스텝과 화면이 같다 — 눌러도 안 바뀐다");
      prev = h;
      for (const msg of hits) findings.push({ n, step, msg });
      if (step < lastStep(n)) await page.keyboard.press("ArrowRight");
    }
  }

  const byKind = new Map();
  for (const f of findings) {
    const kind = f.msg.split(" ")[0];
    if (!byKind.has(kind)) byKind.set(kind, []);
    byKind.get(kind).push(f);
  }
  console.log(`상태 ${states}개 · 위반 ${findings.length}건\n`);
  report = { ...report, mode: "audit", complete: true, states, findings };
  for (const [kind, list] of [...byKind].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`── ${kind} ${list.length}건`);
    for (const f of list.slice(0, 40)) {
      console.log(`   ${String(f.n).padStart(3)}:${f.step}  ${f.msg}`);
    }
    if (list.length > 40) console.log(`   … 외 ${list.length - 40}건`);
  }
  if (!findings.length) console.log("  깨끗합니다.");
  console.log("");
} else {
  fs.mkdirSync(OUT, { recursive: true });
  for (const t of shotList.split(",")) {
    const [ns, ss = "0"] = t.split(":");
    const n = Number(ns), s = Number(ss);
    await goTo(n);
    for (let k = 0; k < s; k++) {
      await page.keyboard.press("ArrowRight");
      await sleep(140);
    }
    const got = await page.evaluate(() => window.__shotsNav);
    // 애니메이션이 끝나고 나서 찍는다. 게이지·빔은 1.1초까지 간다.
    await sleep(1300);
    await waitForCurrentMedia();
    const file = path.join(OUT, `${String(n).padStart(3, "0")}-${s}.png`);
    await page.screenshot({ path: file });
    const warn = got.index + 1 !== n || got.step !== s ? "  ← 요청과 다름" : "";
    report.images.push({ file, number: n, step: s, actual: { number: got.index + 1, step: got.step }, matched: !warn });
    console.log(`${path.relative(ROOT, file)}   nav=${got.index + 1}:${got.step}${warn}`);
  }
  report.mode = "images";
  report.complete = report.images.every((item) => item.matched);
}
} catch (error) {
  report.complete = false;
  report.error = String(error.message);
  console.error(report.error);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  if (server) server.kill("SIGTERM");
  if (REPORT_FILE) {
    fs.mkdirSync(path.dirname(path.resolve(REPORT_FILE)), { recursive: true });
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2) + "\n");
  }
}
