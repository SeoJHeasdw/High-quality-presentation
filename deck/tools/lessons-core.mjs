import fs from "node:fs";
import path from "node:path";
import { readCourse, DECK_ROOT } from "./source-model.mjs";
import { parseScript, normalizeSpoken, spokenSeconds, recallCandidate } from "./script-model.mjs";
import { compositionAt } from "./visual-model.mjs";
import { MEANING_LAYOUTS } from "./course-terms.js";
import { stateKey, timelineStates, videoTimingFindings } from "./timeline-model.mjs";

export const LESSON_MIN = { short: 3, long: 12 };
export const COMPOSITION_MAX = 90;
export const CV_MIN = 0.3;

export function lessonGroups(slides) {
  const groups = [];
  for (const s of slides) {
    const split = /^\d+-L/.test(path.basename(s.file));
    // 단일 파일의 L00는 이웃 설명에 붙인다. TTS의 legacy preset과는 별도 후보 경계다.
    const marker = s.lesson && !/^L00\b/.test(s.lesson) ? s.lesson : null;
    const key = split ? s.file : `${s.file}:${marker ?? groups.at(-1)?.marker ?? "opening"}`;
    let last = groups.at(-1);
    if (!last || last.key !== key) {
      if (!split && last?.file === s.file && last.marker === null) {
        last.key = key; last.marker = marker; last.label = marker;
      } else {
        const header = fs.readFileSync(s.file, "utf8").split("\n").slice(0, 6).join("\n")
          .match(/CH\d\d\s*·\s*(L[\d.]+\s*·\s*[^\n(]+)/)?.[1]?.trim();
        last = { key, file: s.file, marker, label: header ?? marker ?? path.basename(s.file, ".ts"),
          chapter: s.chapter, boundary: split ? "file" : "marker", slides: [] };
        groups.push(last);
      }
    }
    last.slides.push(s);
  }
  return groups;
}

function kindOf(s) {
  if (s.video) return "영상";
  if (s.left?.image || s.right?.image || s.metric?.startsWith("/") || s.subtitle?.startsWith("/")) return "캡처/사진";
  return MEANING_LAYOUTS.has(s.layout) || s.scene ? "도형" : "글판";
}
const norm = (s) => normalizeSpoken(s).replace(/[\s"“”‘’.,·!?()\-—:…]/g, "").toLowerCase();
const openingBad = /^(?:(?:첫|두|세|네|다섯|여섯|일곱|여덟|아홉|열)\s*번째|이번 (?:레슨|챕터|편|장)|그럼|이제|이어서|자,|마지막으로|시작하겠습니다)/;
const forward = /(?:다음|뒤에|\d장|챕터|레슨|이제).*(?:보겠습니다|다루겠습니다|이어가겠습니다|넘어가겠습니다)[.!]?$/;

export function measureLesson(lesson, script, { root = DECK_ROOT, times = null } = {}) {
  const dwells = [], runs = [], declarations = [], titleReads = [];
  const kinds = { 글판: 0, 도형: 0, "캡처/사진": 0, 영상: 0 };
  const used = lesson.slides.filter((s) => !times || [...times.keys()].some((k) => k.startsWith(`${s.id}--`)));
  const segments = new Map();
  let firstLine = "", lastLine = "";
  for (const s of used) {
    const st = script.get(s.id);
    if (!st?.length) throw new Error(`${s.id}: 대본이 없습니다.`);
    const selected = st.map((text, step) => ({ text, step, time: times?.get(stateKey(s.id, step)) }))
      .filter((b) => !times || b.time);
    const spoken = selected.map((b) => normalizeSpoken(b.text));
    firstLine ||= spoken[0] ?? "";
    lastLine = spoken.at(-1) ?? lastLine;
    const title = norm(s.title);
    if (!["cover", "chapter", "quote"].includes(s.layout) && title.length >= 8 && norm(spoken.join(" ")).includes(title)) titleReads.push(s.id);
    if (s.sceneCut) declarations.push(s.id);
    for (const b of selected) {
      const sec = b.time ? b.time.sec : spokenSeconds(b.text);
      const composition = compositionAt(s, b.step, root);
      const originalKey = composition.key;
      if (s.sceneCut && b.step === 0 && composition.basis !== "renderer") segments.set(originalKey, (segments.get(originalKey) ?? 0) + 1);
      const segment = segments.get(originalKey) ?? 0;
      const key = `${originalKey}${segment ? `#declared-${segment}` : ""}`;
      const basis = segment ? "declared" : composition.basis;
      const previous = runs.at(-1);
      if (previous?.key === key) {
        previous.sec += sec; previous.steps++; previous.to = `${s.id}:${b.step}`;
        if (previous.ids.at(-1) !== s.id) previous.ids.push(s.id);
      } else runs.push({ key, sec, steps: 1, ids: [s.id], from: `${s.id}:${b.step}`, to: `${s.id}:${b.step}`, basis, kind: kindOf(s) });
      dwells.push(sec); kinds[kindOf(s)] += sec;
    }
  }
  const total = dwells.reduce((a, b) => a + b, 0), mean = total / (dwells.length || 1);
  const cv = mean ? Math.sqrt(dwells.reduce((a, b) => a + (b - mean) ** 2, 0) / dwells.length) / mean : 0;
  const longest = runs.reduce((a, b) => a.sec > b.sec ? a : b, { sec: 0 });
  const recall = recallCandidate(used, script);
  const flags = [];
  if (total / 60 < LESSON_MIN.short || total / 60 > LESSON_MIN.long) flags.push("길이 검토");
  if (longest.sec > COMPOSITION_MAX) flags.push(`구도 근사 ${Math.round(longest.sec)}s 확인`);
  if (runs.length < 3) flags.push("구도 다양성 검토");
  if (openingBad.test(firstLine)) flags.push("여는 말 검토");
  if (recall.status === "not-found") flags.push("회상 후보 없음");
  if (recall.status === "answer-missing") flags.push("회상 정답 상태 확인");
  if (forward.test(lastLine)) flags.push("예고로 끝남");
  if (dwells.length > 3 && cv < CV_MIN) flags.push(`CV ${cv.toFixed(2)} 검토`);
  if (titleReads.length > 1) flags.push(`제목 반복 후보 ${titleReads.length}`);
  return { label: lesson.label, chapter: lesson.chapter, file: lesson.file, boundary: lesson.boundary,
    partial: used.length !== lesson.slides.length || used.some((s) => times && script.get(s.id).some((_, step) => !times.has(stateKey(s.id, step)))),
    slides: used.length, steps: dwells.length, min: total / 60, runs, longest, kinds, cv, titleReads, declarations,
    recall, firstLine, lastLine, flags, timing: times ? "actual" : "estimated" };
}

export function lessonReport({ root = DECK_ROOT, chapters = [], timeline = null } = {}) {
  const slides = readCourse(root);
  const scripts = new Map([...new Set(slides.map((s) => s.chapter))].map((c) => [c, parseScript(path.join(root, `script/course/${c}.md`))]));
  const times = timeline ? timelineStates(timeline, slides, scripts) : null;
  const rows = lessonGroups(slides).filter((l) => !chapters.length || chapters.includes(l.chapter))
    .filter((l) => !times || l.slides.some((s) => [...times.keys()].some((k) => k.startsWith(`${s.id}--`))))
    .map((l) => measureLesson(l, scripts.get(l.chapter), { root, times }));
  return { schemaVersion: 1, timing: times ? "actual" : "estimated", rows,
    videoFindings: times ? videoTimingFindings(slides, times) : [],
    note: "구도는 근사값, 회상은 후보입니다. sceneCut은 선언이며 미디어 파일 존재는 실무 증거의 인증이 아닙니다." };
}
