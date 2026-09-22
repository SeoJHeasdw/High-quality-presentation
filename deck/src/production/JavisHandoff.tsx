/**
 * JD-B · 오프닝 연속씬 (2008 → 2026, 칸 주인이 바뀌는 공유 그림)
 *
 * 같은 scene("jd-handoff")이라 두 장이 같은 DOM을 공유한다. 끊어 다시
 * 그리지 않고 칩의 색만 바뀐다 — sceneGroup()의 연속 장면 규칙.
 *
 * 규약:
 * - items: 5개 칩 ["음성 대화", ...]. 두 장이 동일해야 갈아끼워지지 않는다.
 * - open-split (steps 1): s0 2008행만, s1 2026행이 dim으로 등장.
 * - open-take (steps 3): s1에서 둘, s2에서 둘, s3에서 하나가 넘어간다.
 *   s3에서 AGENT 스탬프 + subtitle 착지.
 */
import type { CourseSlideSpec } from "./course-types";
import { AccentText } from "./copy-steps";
import "./javis-scenes.css";

const ROWS = [
  { year: "2008", tag: "SF · 사람" },
  { year: "2026", tag: "일상 · 기계" },
];

export default function JavisHandoff({
  spec,
  step,
}: {
  spec: CourseSlideSpec;
  step: number;
}) {
  const chips = spec.items ?? [];
  const isTake = spec.id === "open-take";
  // take는 3스텝 압축: 둘씩 넘어가고 마지막에 하나. 오프라인이라 한 스텝에
  // 두 문장을 말한다.
  const flipped = !isTake
    ? 0
    : step <= 0
      ? 0
      : step === 1
        ? 2
        : step === 2
          ? 4
          : chips.length;
  const showSecond = !isTake ? step >= 1 : true;
  const landed = isTake && step >= 3;

  return (
    <div className="javis-handoff">
      <h2 className="javis-h-title">
        <AccentText text={spec.title} accent={spec.accent} />
      </h2>
      <div className="javis-handoff__rows">
        {ROWS.map((row, r) => {
          const active = r === 0 || showSecond;
          return (
            <div
              key={row.year}
              className="javis-handoff__row"
              data-on={active || undefined}
            >
              <div className="javis-handoff__year mono">
                <b>{row.year}</b>
                <span>{row.tag}</span>
              </div>
              <div className="javis-handoff__chips">
                {chips.map((chip, i) => {
                  const blue = r === 1 && i < flipped;
                  const fresh = r === 1 && i === flipped - 1;
                  return (
                    <span
                      key={r === 1 && fresh ? `${chip}-fresh` : `${r}-${chip}`}
                      className="javis-chip"
                      data-tone={r === 0 ? "human" : blue ? "ai" : "dim"}
                    >
                      {chip}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="javis-handoff__stamp mono" data-on={landed || undefined}>
        AGENT
      </div>
      {isTake && (
        <p className="javis-ticker__landing" data-on={landed || undefined}>
          {spec.subtitle}
        </p>
      )}
    </div>
  );
}
