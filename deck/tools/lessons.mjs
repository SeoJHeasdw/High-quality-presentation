/** 레슨 진단 CLI. 경고는 편집 지시가 아니다. 실제 시간은 --timeline으로 읽는다. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lessonReport } from "./lessons-core.mjs";
import { DECK_ROOT } from "./source-model.mjs";
export { LESSON_MIN, COMPOSITION_MAX, CV_MIN } from "./lessons-core.mjs";

export function main(argv = process.argv.slice(2)) {
  const value = (flag) => argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : null;
  const chapters = argv.filter((a) => /^ch\d\d$/.test(a));
  if (argv.includes("--help") || (!chapters.length && !argv.includes("--all") && !value("--timeline"))) {
    console.log("사용법: node tools/lessons.mjs ch03 --runs [--json]\n"
      + "        node tools/lessons.mjs --timeline /path/timeline.json [--source-root /path/deck] [--output report.json]\n"
      + "        node tools/lessons.mjs --all\n구도·회상은 후보이며 종료 코드 0은 영상 품질 승인이 아닙니다.");
    return argv.includes("--help") ? 0 : 2;
  }
  const root = value("--source-root") ? path.resolve(value("--source-root")) : DECK_ROOT;
  const timeline = value("--timeline") ? JSON.parse(fs.readFileSync(value("--timeline"), "utf8")) : null;
  const report = lessonReport({ root, chapters, timeline });
  if (!report.rows.length) throw new Error("그 범위에 대본이 붙은 레슨이 없습니다.");
  if (value("--output")) fs.writeFileSync(value("--output"), JSON.stringify(report, null, 2) + "\n");
  if (argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`\n레슨 진단 · 시간 ${report.timing === "actual" ? "실제 TTS 타임라인" : "대본 추정"} · 구도 근사값`);
    for (const chapter of [...new Set(report.rows.map((r) => r.chapter))]) {
      const rows = report.rows.filter((r) => r.chapter === chapter);
      console.log(`\n${chapter}  레슨 ${rows.length}편 · ${rows.reduce((n, r) => n + r.min, 0).toFixed(1)}분`);
      console.log("  레슨                                분   장 스텝 구도 최장구도  글판/도형/캡처·사진/영상(초)  CV");
      for (const r of rows) {
        const kinds = Object.values(r.kinds).map(Math.round).join("/");
        console.log(`  ${r.label}  ${r.min.toFixed(1)}분  ${r.slides}장 ${r.steps}스텝 ${r.runs.length}구도 ${Math.round(r.longest.sec)}s  ${kinds}  ${r.cv.toFixed(2)}${r.partial ? " (일부 범위)" : ""}`);
        if (r.flags.length) console.log(`    검토: ${r.flags.join(" · ")}`);
        if (r.declarations.length) console.log(`    sceneCut 선언 ${r.declarations.length}곳 — 렌더 확인 전에는 개선으로 판정하지 않음`);
        if (r.recall.status === "candidate") console.log(`    회상 후보: ${r.recall.prompt.id}:${r.recall.prompt.step} → ${r.recall.answer.id}:${r.recall.answer.step} (질문·정답 내용 확인)`);
        if (argv.includes("--runs")) {
          console.log(`    여는 문장 「${r.firstLine.slice(0, 100)}」`);
          for (const run of r.runs) console.log(`    ${Math.round(run.sec)}s ${run.ids.length}장 ${run.kind} ${run.key} [${run.basis}] (${run.from} → ${run.to})`);
          if (r.declarations.length) console.log(`    선언 위치: ${r.declarations.join(", ")}`);
          console.log(`    닫는 문장 「${r.lastLine.slice(-120)}」`);
        }
      }
    }
    for (const f of report.videoFindings) console.log(`영상 동기화 확인: ${f.id}:${f.step ?? "끝"} ${f.message}`);
    console.log(`\n${report.note}\n`);
  }
  return report.videoFindings.length ? 1 : 0;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
