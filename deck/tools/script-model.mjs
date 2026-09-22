import fs from "node:fs";
import { CHARS_PER_SEC } from "./course-terms.js";

export const PAUSE_LINE = /^\s*\[(\d+(?:\.\d+)?)s\]\s*$/i;
const direction = (line) => {
  const t = line.replace(/^[*_`~\s]+|[*_`~\s]+$/g, "");
  return (t.startsWith("(") && t.endsWith(")")) || (t.startsWith("（") && t.endsWith("）"));
};
export const spokenLines = (text) => String(text).split("\n").map((s) => s.trim())
  .filter((s) => s && !PAUSE_LINE.test(s) && !s.startsWith(">") && !/^---+\s*$/.test(s) && !direction(s));
export function normalizeSpoken(text) {
  return spokenLines(text).join("\n").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "").replace(/^\s*[-+]\s+/gm, "").replace(/\s+/g, " ").trim();
}
export function spokenSeconds(text) {
  const pause = [...String(text).matchAll(/^\s*\[(\d+(?:\.\d+)?)s\]\s*$/gmi)]
    .reduce((n, m) => n + Number(m[1]), 0);
  return normalizeSpoken(text).replace(/\s/g, "").length / CHARS_PER_SEC + pause;
}

/** 스텝 번호를 버리지 않는다. 중복·결번은 시간 추정이 아니라 제작 오류다. */
export function parseScript(file) {
  const result = new Map();
  let slide, step;
  for (const [i, line] of fs.readFileSync(file, "utf8").split("\n").entries()) {
    const head = line.match(/^##\s+(.+?)\s*$/);
    const beat = line.match(/^###\s+(\d+)\s*$/);
    if (head) {
      slide = head[1]; step = undefined;
      if (result.has(slide)) throw new Error(`${file}:${i + 1}: 대본 ID 중복 ${slide}`);
      result.set(slide, []);
    } else if (beat && slide) {
      step = Number(beat[1]);
      if (step !== result.get(slide).length) throw new Error(`${file}:${i + 1}: ${slide} 스텝은 0부터 순서대로 한 번씩 써야 합니다.`);
      result.get(slide).push("");
    } else if (step !== undefined) {
      const pause = line.match(PAUSE_LINE);
      if (pause && (Number(pause[1]) < 0.1 || Number(pause[1]) > 10)) throw new Error(`${file}:${i + 1}: 무음은 0.1~10초입니다.`);
      if (!pause && /\[\d+(?:\.\d+)?s\]/i.test(line)) throw new Error(`${file}:${i + 1}: 무음 마커는 단독 줄에 둡니다.`);
      result.get(slide)[step] += `${line}\n`;
    }
  }
  return result;
}

/** 질문/지시 후보와 뒤의 답변 상태를 함께 보여 준다. 교육 품질을 자동 승인하지 않는다. */
export function recallCandidate(slides, script) {
  const tail = slides.slice(-2);
  const beats = tail.flatMap((s) => (script.get(s.id) ?? []).map((text, step) => ({ id: s.id, step, text: normalizeSpoken(text) })));
  const invitation = /고르(?:세요|십시오)|(?:골라|선택해|답해|생각해|떠올려|적어|맞혀|맞춰|판단해|분류해|세어|짚어)\s*(?:보세요|보십시오|봅시다)|(?:영상을|잠깐|잠시)\s*멈추고\s*(?:.{0,40})(?:골라|선택|답|생각|판단|분류)/;
  const answer = /(?:정답|답은|답이|기준은|이유는)|(?:입니다|이죠|됩니다|였죠|이니까|으니까)/;
  for (const [i, beat] of beats.entries()) {
    if (!invitation.test(beat.text)) continue;
    const next = beats[i + 1];
    if (next && answer.test(next.text)) return { status: "candidate", prompt: { id: beat.id, step: beat.step },
      answer: { id: next.id, step: next.step }, text: beat.text };
    return { status: "answer-missing", prompt: { id: beat.id, step: beat.step }, text: beat.text };
  }
  return { status: "not-found" };
}
