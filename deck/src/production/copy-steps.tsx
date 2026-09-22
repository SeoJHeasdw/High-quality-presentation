/**
 * 카피를 스텝으로 여는 공통 규약.
 *
 * VIDEO-PACING-GUIDELINES.md §4 ①. 큰 타이포 한 문장이 24초씩 정지해
 * 있던 것이 파일럿에서 잡힌 문제다. 새 화면을 만드는 대신 이미 있는 글을
 * 순서대로 연다 — 제목 → accent 점등 → 부제 문장 하나씩.
 *
 * 이 셋을 CourseDeck.tsx 안에만 두고 그림 컴포넌트들이 각자 `Highlight` 를
 * 복사해 가면, `statement` 는 스텝으로 열리는데 같은 글이 `stage-lanes`
 * 위에 올라가면 통째로 서는 일이 벌어진다. **그림은 앵커로 두고 그 옆 글만
 * 순서대로 여는 것**이 이 덱의 기본 동작이라, 규약을 한 곳에 두고
 * 양쪽이 같이 쓴다.
 *
 * `steps` 를 안 준 화면은 전부 켠다. 700장이 아직 스텝 없이 있고, 스텝은
 * 대본을 `### 0 · ### 1` 로 쪼갠 화면에만 붙기 때문이다.
 */

import type { CourseSlideSpec } from "./course-types";

/** 부제를 문장으로 나눈다. 문장 하나가 한 비트다. */
export function sentences(text?: string): string[] {
  if (!text) return [];
  return text.split(/(?<=[.?!])\s+/).filter(Boolean);
}

/**
 * accent 를 `<em>` 으로 감싼다. `lit={false}` 면 강조색이 아직 안 켜진 상태다.
 *
 * 말이 그 단어에 닿는 순간 색이 켜지는 것 자체가 시각 비트다.
 * 스텝을 안 준 화면은 예전처럼 처음부터 켜져 있다.
 */
export function AccentText({
  text,
  accent,
  lit = true,
}: {
  text: string;
  accent?: string;
  lit?: boolean;
}) {
  if (!accent || !text.includes(accent)) return <>{text}</>;
  const at = text.indexOf(accent);
  return (
    <>
      {text.slice(0, at)}
      <em data-lit={lit}>{accent}</em>
      {text.slice(at + accent.length)}
    </>
  );
}

/**
 * 카피형 레이아웃의 공개 일정.
 *
 *   step 0        제목만. accent 는 아직 흰색
 *   step 1        accent 점등 + 부제 첫 문장
 *   step 2, 3 …   부제 다음 문장
 *
 * 그래서 이 화면들의 `steps` 는 **부제 문장 수**와 같게 준다.
 *
 * `offset` 은 그림이 먼저 스텝을 가져가는 화면용이다. 그림이 n 번 진행한
 * 뒤에 글이 열리기 시작하면 `offset: n` 을 준다.
 */
export function copyReveal(
  spec: CourseSlideSpec,
  step: number,
  offset = 0,
) {
  const parts = sentences(spec.subtitle);
  const stepped = spec.steps !== undefined;
  return {
    parts,
    stepped,
    lit: !stepped || step >= offset + 1,
    on: (i: number) => !stepped || step >= offset + i + 1,
  };
}

/**
 * 부제 문장을 하나씩 여는 `<p>`.
 *
 * 문장 사이를 `span` 으로 나누고 `data-on` 만 토글한다 — 자리를 미리 잡아
 * 두므로 문장이 열려도 앞 문장이 밀리지 않는다 (`.course-copy-lines`).
 */
export function CopyLines({
  spec,
  step,
  offset = 0,
  className = "course-copy-lines",
  accentInLines = false,
}: {
  spec: CourseSlideSpec;
  step: number;
  offset?: number;
  className?: string;
  accentInLines?: boolean;
}) {
  const r = copyReveal(spec, step, offset);
  if (!r.parts.length) return null;
  return (
    <p className={className}>
      {r.parts.map((line, i) => (
        <span key={line} data-on={r.on(i)}>
          {accentInLines ? (
            <AccentText text={line} accent={spec.accent} lit={r.lit} />
          ) : (
            line
          )}{" "}
        </span>
      ))}
    </p>
  );
}
