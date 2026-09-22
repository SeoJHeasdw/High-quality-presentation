/**
 * CH01 L01 · 출력이 단어 하나에서 일 자체로 커졌다 (promptify-shot · promptify-vs-1)
 *
 * ── 축은 질문이 아니라 출력이다 ─────────────────────────────
 * 사진 한 장을 `photo` 로 세우고 `comparison` 왼쪽 칸에 다시 쓰면, 분당
 * 비트도 사막 검사도 통과하는데 눈에는 정지 사진 하나에 자막이 흐르는
 * 장면이 된다 (§0 체감 장면 시계 · §11). 화면에 고양이가 이미 떠 있는데
 * 대본이 정답 공개를 기다리면 그 스텝은 정보가 0 이다.
 *
 * 그래서 그때 컴퓨터가 내놓은 것이 무엇이었는지를 그림이 말한다 — 상자
 * 하나, 단어 하나. 그 크기가 지금의 출력과 나란히 놓이는 순간이 두 장의
 * 논지 전부다. 이 "출력" 축은 30장 뒤 LLM(다음 토큰 하나씩)으로 이어진다.
 *
 *   classify-then  사진 → 상자 → 단어 하나          (promptify-shot · 13장)
 *   classify-now   그 단어 옆에 지금의 출력이 선다   (promptify-vs-1 · 14장)
 *
 * ── 스텝 ────────────────────────────────────────────────────
 * scene "classify-then"
 *   0 사진이 서고 그 위에 물음이 얹힌다 — "이게 뭘까요?"
 *   1 **사진 위에 상자가 그려지고** 태그가 붙는다. 같은 순간 오른쪽
 *     빈 출력 칸에 `cat` 이 떨어진다. 정답 공개가 처음으로 시각 사건이 된다.
 *   2 사진이 물러나고 출력 칸만 밝게 남는다. 캡션이 `1 word` 로 확정된다 —
 *     "출력은 이게 전부였습니다"가 말이 아니라 그림이다.
 *
 * scene "classify-now"
 *   0 앞 장의 끝 상태가 카드 하나로 접혀 있다 (물음 · 사진 · 출력 `cat`)
 *   1 오른쪽에 지금의 카드가 열리고 출력 세 줄이 쌓인다
 *   2 두 카드가 같은 무게로 서고 아래에 대비 한 줄이 붙는다
 *
 * ── 색 ──────────────────────────────────────────────────────
 * 파랑이 사람이 넘긴 요청(위쪽 물음), 금색이 기계가 내놓은 출력(아래쪽 칸)이다.
 * CH00 handoff · FoldSteps 와 같은 축이라 여기서 색을 새로 배우지 않는다.
 *
 * 출력 세 줄은 화면 데이터로 빼지 않았다. 대본이 그 셋을 그대로 부르고
 * (`보고서를 쓰라고 하고, 메일을 보내라고 하고, 자료를 찾아오라고 합니다`),
 * 한쪽만 고쳐지면 논지가 조용히 어긋난다 (FoldSteps.tsx 와 같은 이유).
 */

import { Reveal } from "../components/deck-kit";
import { AccentText } from "./copy-steps";
import type { CourseSlideSpec } from "./course-types";

/** 그때 컴퓨터가 내놓은 출력 전부. 한 단어다. */
const THEN_OUT = "cat";

/** 지금 우리가 넘기는 일. 대본이 이 순서 그대로 부른다. */
const NOW_OUT = ["보고서 초안을 쓴다", "메일을 보낸다", "자료를 찾아온다"];

const ASK_THEN = "이게 뭔지 맞혀봐";
const ASK_NOW = "이 일을 대신 해줘";

/** 사진 위 상자. cat1.png(550×378) 안에서 고양이가 차지하는 자리다. */
const BOX = { left: "16%", top: "9%", width: "68%", height: "82%" };

function Shot({ boxed }: { boxed: boolean }) {
  return (
    <figure className="course-classify__shot">
      <img src="/shots/cat1.png" alt="" />
      <span className="course-classify__box" data-on={boxed || undefined} style={BOX}>
        <b>{THEN_OUT}</b>
      </span>
    </figure>
  );
}

export default function ClassifyShot({
  spec,
  step,
}: {
  spec: CourseSlideSpec;
  step: number;
}) {
  const scene = spec.scene ?? "classify-then";
  const now = scene === "classify-now";

  /* classify-then 의 진행. 상자와 출력은 같은 스텝에서 같이 온다 —
     떨어뜨려 놓으면 "저 상자가 저 단어가 됐다"가 안 읽힌다. */
  const answered = !now && step >= 1;
  const settled = !now && step >= 2;

  /* classify-now 의 진행. 오른쪽 카드가 열리고, 마지막에 둘이 같아진다. */
  const opened = now && step >= 1;
  const paired = now && step >= 2;

  return (
    <div
      className="course-classify"
      data-scene={scene}
      data-answered={answered || undefined}
      data-settled={settled || undefined}
      data-paired={paired || undefined}
    >
      <Reveal key={spec.id} delay={0.05} className="course-classify__copy">
        <h2>
          <AccentText text={spec.title} accent={spec.accent} />
        </h2>
        {spec.subtitle && (
          <p>
            <AccentText text={spec.subtitle} accent={spec.accent} />
          </p>
        )}
      </Reveal>

      <div className="course-classify__stage">
        {/* ── 10년 전 ──
            classify-then 에서는 사진이 무대를 다 쓰고, classify-now 에서는
            같은 것이 카드 하나로 접힌다. 접히는 것이지 새로 나타나는 게
            아니라서 DOM 을 하나로 둔다 — 장이 넘어가도 상자가 안 풀린다. */}
        <div className="course-classify__card" data-era="then">
          <span className="course-classify__era mono">10년 전</span>

          <span className="course-classify__ask">
            <i className="mono">ASK</i>
            <b>{now ? ASK_THEN : "이게 뭘까요?"}</b>
          </span>

          <div className="course-classify__body">
            <Shot boxed={now || answered} />

            <span className="course-classify__to" data-on={now || answered || undefined} aria-hidden>
              →
            </span>

            <div className="course-classify__out" data-on={now || answered || undefined}>
              <i className="mono">OUTPUT</i>
              <b className="course-classify__word">{THEN_OUT}</b>
              <em className="mono" data-on={now || settled || undefined}>
                1 word
              </em>
            </div>
          </div>
        </div>

        {/* 두 카드 사이. classify-now 에서만 선다. */}
        <span className="course-classify__gap" data-on={opened || undefined} aria-hidden>
          <i />
          <em className="mono">10년</em>
          <i />
        </span>

        {/* ── 지금 ── */}
        <div className="course-classify__card" data-era="now" data-on={opened || undefined}>
          <span className="course-classify__era mono">지금</span>

          <span className="course-classify__ask">
            <i className="mono">ASK</i>
            <b>{ASK_NOW}</b>
          </span>

          <div className="course-classify__body">
            <div className="course-classify__out">
              <i className="mono">OUTPUT</i>
              <ul className="course-classify__jobs">
                {NOW_OUT.map((job, i) => (
                  <li key={job} style={{ transitionDelay: `${140 + i * 130}ms` }}>
                    {job}
                  </li>
                ))}
              </ul>
              <em data-on={paired || undefined}>그리고 계속 늘어납니다</em>
            </div>
          </div>
        </div>
      </div>

      {/* 착지. 두 카드가 같은 무게로 선 뒤에만 붙는다. */}
      <span className="course-classify__land" data-on={paired || undefined}>
        출력이 <em>단어 하나</em>에서 <em>일 자체</em>가 되는 데 10년 걸렸습니다.
      </span>
    </div>
  );
}
