/**
 * script/course/chXX.md 를 읽어 { 화면ID: { 스텝번호: 대본 } } 로 만든다.
 * 키는 화면 ID(toolpick-semantic). 폴더를 더 파도 되고, 챕터가 커지면
 * chXX-lNN.md 로 더 쪼개도 된다.
 *
 * 원고를 .tsx 안에 두지 않는 이유:
 * 장시간 강의는 대본이 10만 자를 넘을 수 있다. 그걸 JSX 문자열로 쓰는 건 불가능하고,
 * 맞춤법 검사도 git diff 도 안 먹는다. 원고는 마크다운, 코드는 코드.
 */

const files = import.meta.glob("../script/**/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export type SlideScript = Record<number, string>;
export type ScriptMap = Record<string, SlideScript>;

function parse(md: string, out: ScriptMap) {
  let slideKey: string | null = null;
  let step: number | null = null;
  let buf: string[] = [];

  const flush = () => {
    if (slideKey === null || step === null) return;
    const text = buf.join("\n").trim();
    if (text) {
      out[slideKey] ??= {};
      out[slideKey][step] = text;
    }
    buf = [];
  };

  for (const raw of md.split("\n")) {
    const slide = raw.match(/^##\s+([^\s#][^\n]*?)\s*$/);
    const stepM = raw.match(/^###\s+(\d+)\s*$/);

    if (stepM) {
      flush();
      step = Number(stepM[1]);
      continue;
    }
    if (slide && !stepM) {
      flush();
      slideKey = slide[1].trim();
      step = null;
      continue;
    }
    // `---` 구분선과 최상위 `#` 헤더는 본문에서 제외
    if (/^---+\s*$/.test(raw) || /^#\s/.test(raw)) continue;
    if (step !== null) buf.push(raw);
  }
  flush();
}

export const SCRIPT: ScriptMap = (() => {
  const out: ScriptMap = {};
  for (const md of Object.values(files)) parse(md, out);
  return out;
})();

export function getScript(
  key: string | undefined,
  step: number,
): string | null {
  if (!key) return null;
  return SCRIPT[key]?.[step] ?? null;
}

/** 대본이 있는 스텝 수 (진행률 표시용) */
export function scriptSteps(key: string | undefined): number[] {
  if (!key || !SCRIPT[key]) return [];
  return Object.keys(SCRIPT[key])
    .map(Number)
    .sort((a, b) => a - b);
}
