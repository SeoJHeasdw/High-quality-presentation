import { normalizeSpoken } from "./script-model.mjs";

const finite = (x) => typeof x === "number" && Number.isFinite(x);
export const stateKey = (id, step) => `${id}--${step}`;

/** 실제 시각과 현재 입력의 동일성을 확인한다. 다른 판본의 시간을 조용히 섞지 않는다. */
export function timelineStates(timeline, slides, scripts) {
  if (!finite(timeline.totalMs) || timeline.totalMs <= 0 || !timeline.entries?.length) throw new Error("빈 타임라인 또는 잘못된 totalMs");
  const specs = new Map(slides.map((s) => [s.id, s]));
  const times = new Map();
  const sequence = new Map(slides.flatMap((s) => (scripts.get(s.chapter)?.get(s.id) ?? [])
    .map((_, step) => stateKey(s.id, step))).map((key, i) => [key, i]));
  let previousOrder = -1;
  let previousEnd = 0;
  for (const [i, e] of timeline.entries.entries()) {
    const spec = specs.get(e.slideId);
    const key = stateKey(e.slideId, e.step);
    if (!spec || spec.chapter !== e.chapter || spec.n !== e.slideNumber) throw new Error(`${key}: 타임라인 화면 ID/챕터/번호가 입력과 다릅니다. 같은 소스 판본으로 다시 검사하세요.`);
    const script = scripts.get(spec.chapter)?.get(spec.id);
    if (!Number.isInteger(e.step) || !script?.[e.step]) throw new Error(`${key}: 대본에 없는 스텝`);
    if (normalizeSpoken(script[e.step]) !== normalizeSpoken(e.sourceText)) throw new Error(`${key}: 타임라인과 현재 대본이 다릅니다. 이전 음성 시간을 새 대본에 적용할 수 없습니다.`);
    const order = sequence.get(key);
    if (times.has(key) || order <= previousOrder) throw new Error(`${key}: 타임라인 스텝 중복/역순`);
    if (i > 0 && order !== previousOrder + 1) throw new Error(`${key}: 타임라인에서 중간 화면/스텝이 빠졌습니다.`);
    const start = i === 0 ? 0 : previousEnd;
    const end = i === timeline.entries.length - 1 ? timeline.totalMs : (e.transitionAtMs ?? e.endMs);
    if (![e.startMs, e.endMs, end].every(finite) || e.startMs < 0 || e.endMs < e.startMs
      || end <= start || end > timeline.totalMs || e.endMs > timeline.totalMs
      || (i > 0 && Math.abs(e.startMs - start) > 1000)) throw new Error(`${key}: 타임라인 시간이 올바르지 않습니다.`);
    times.set(key, { startMs: start, endMs: end, sec: (end - start) / 1000 });
    previousOrder = order; previousEnd = end;
  }
  return times;
}

/** 자동 영상은 스텝과 독립적으로 흐른다. 실제 화면 진입 시각을 기준으로 편집점을 비교한다. */
export function videoTimingFindings(slides, times, slack = 2) {
  const findings = [];
  for (const s of slides) {
    if (!s.videoBeats) continue;
    const entries = [...times].filter(([key]) => key.startsWith(`${s.id}--`));
    if (!entries.length) continue;
    const start = times.get(stateKey(s.id, 0));
    if (!start) throw new Error(`${s.id}: 영상 편집점 검사는 첫 스텝부터 필요합니다.`);
    for (const [key, t] of entries) {
      const step = Number(key.split("--").at(-1));
      const cue = s.videoBeats.cues[step];
      if (!finite(cue)) throw new Error(`${key}: videoBeats.cues가 없습니다.`);
      const at = (t.startMs - start.startMs) / 1000;
      if (Math.abs(at - cue) > slack) findings.push({ id: s.id, step, actual: at, expected: cue, delta: at - cue,
        message: `영상 편집점 ${cue.toFixed(1)}초 / 실제 전환 ${at.toFixed(1)}초` });
    }
    const duration = (entries.at(-1)[1].endMs - start.startMs) / 1000;
    if (duration > s.videoBeats.duration + slack) findings.push({ id: s.id, actual: duration, expected: s.videoBeats.duration,
      message: `영상 ${s.videoBeats.duration}초보다 화면 체류가 ${duration.toFixed(1)}초로 깁니다 — 루프 편집점 확인` });
  }
  return findings;
}
