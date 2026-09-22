/** 편집기와 무관한 제작 전 검사. 화면·대본을 수정하지 않으며 리듬 후보로 제작을 막지 않는다. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DECK_ROOT, readCourse, runtimeRules } from "./source-model.mjs";
import { parseScript, normalizeSpoken } from "./script-model.mjs";
import { filmFor } from "./visual-model.mjs";

export function preflight({ root = DECK_ROOT, from = 1, to = Infinity, chapter = null } = {}) {
  const course = readCourse(root), { slideSteps } = runtimeRules(root);
  const selected = course.filter((s) => s.n >= from && s.n <= to && (!chapter || s.chapter === chapter));
  const errors = [], seen = new Set(), scripts = new Map();
  if (!selected.length || from < 1 || (Number.isFinite(to) && to > course.length)) errors.push("제작 범위가 현재 덱에 없습니다.");
  // ID 중복은 어떤 범위를 찍어도 주소를 모호하게 하므로 전역 오류다.
  for (const s of course) {
    if (seen.has(s.id)) errors.push(`${s.id}: 화면 ID 중복`);
    seen.add(s.id);
  }
  for (const c of new Set(selected.map((s) => s.chapter))) {
    try { scripts.set(c, parseScript(path.join(root, `script/course/${c}.md`))); }
    catch (error) { errors.push(error.message); }
  }
  const states = [];
  for (const s of selected) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.id)) errors.push(`${s.id}: 잘못된 화면 ID`);
    const steps = slideSteps(s), script = scripts.get(s.chapter)?.get(s.id);
    if (!Number.isInteger(steps) || steps < 0) errors.push(`${s.id}: 잘못된 steps`);
    if (!script || script.length !== steps + 1) errors.push(`${s.id}: 화면 ${steps + 1}상태 / 대본 ${script?.length ?? 0}스텝`);
    try {
      const film = filmFor(s, root);
      if (film && film.beats?.length !== steps + 1) errors.push(`${s.id}: 필름 BEATS ${film.beats?.length ?? 0}개 / 화면 ${steps + 1}상태`);
      if (film && !film.slides.includes(s.id)) errors.push(`${s.id}: 필름 SLIDES에 없는 화면`);
    } catch (error) { errors.push(error.message); }
    if (s.videoBeats && (s.videoBeats.cues?.length !== steps + 1
      || !Number.isFinite(s.videoBeats.duration) || s.videoBeats.duration <= 0
      || s.videoBeats.cues.some((cue, i, cues) => !Number.isFinite(cue) || cue < 0 || cue > s.videoBeats.duration || (i > 0 && cue < cues[i - 1])))) errors.push(`${s.id}: videoBeats가 화면 상태와 맞지 않습니다.`);
    const assets = [s.video, s.videoPoster, s.left?.image, s.right?.image,
      s.metric?.startsWith("/") ? s.metric : null, s.subtitle?.startsWith("/") ? s.subtitle : null];
    for (const asset of assets.filter((a) => typeof a === "string" && a.startsWith("/"))) {
      if (!fs.existsSync(path.join(root, "public", asset.split(/[?#]/)[0]))) errors.push(`${s.id}: 자료 파일 없음 ${asset}`);
    }
    for (let step = 0; step <= steps; step++) {
      const sourceText = normalizeSpoken(script?.[step] ?? "");
      if (!sourceText) errors.push(`${s.id}:${step}: 읽을 대본이 없습니다.`);
      states.push({ slideId: s.id, slideNumber: s.n, chapter: s.chapter, step, sourceText,
        layout: s.layout, videoBeats: s.videoBeats ?? null });
    }
  }
  return { ok: !errors.length, errors, totalSlides: course.length, selectedSlides: selected.length, states };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), value = (flag) => args[args.indexOf(flag) + 1];
  if (args.includes("--help")) console.log("node tools/preflight.mjs [--chapter ch03] [--from 1 --to 11] [--source-root /path/deck] [--json]");
  else try {
    const result = preflight({ root: args.includes("--source-root") ? path.resolve(value("--source-root")) : DECK_ROOT,
      chapter: args.includes("--chapter") ? value("--chapter") : null,
      from: args.includes("--from") ? Number(value("--from")) : 1, to: args.includes("--to") ? Number(value("--to")) : Infinity });
    console.log(args.includes("--json") ? JSON.stringify(result) : `제작 전 검사: ${result.selectedSlides}장 · ${result.states.length}스텝\n${result.ok ? "정합성 오류 0" : result.errors.join("\n")}`);
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
