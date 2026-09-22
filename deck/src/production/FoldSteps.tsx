/**
 * CH01 L01 · 여러 칸이 한 문장으로 접힌다 (promptify-check-1 · promptify-vs-2 · promptify-check-2)
 *
 * ── 왜 그렸는가 ─────────────────────────────────────────────
 * 목록 공개 · 카드 초점 · 큰 타이포로 두면 스텝을 눌러도 바뀌는 게 전부
 * 글이라 영상에서는 정지 화면 넉 장이 된다 (§11 · §13).
 *
 * 대본이 이미 그림을 말하고 있다 — "네 단계가 필요했습니다",
 * "그 네 단계가 한 문장이 됐습니다", "쓰던 도구마다 같은 일이 벌어졌습니다".
 * **여러 칸이 한 문장으로 접히는 것**, 그 한 동작이 세 장의 논지 전부다.
 * 그래서 그림 하나를 세 장이 나눠 쓴다 (§13 · 사막 하나에 그림 하나).
 *
 *   fold-many   네 칸이 하나씩 선다            (promptify-check-1 · 15장)
 *   fold-one    그 네 칸이 한 문장으로 접힌다   (promptify-vs-2 · 16장)
 *   fold-tools  도구가 바뀌어도 같은 접힘       (promptify-check-2 · 18장)
 *
 * ── 스텝 ────────────────────────────────────────────────────
 * scene "fold-many" — 대본의 네 스텝이 엑셀 네 단계 그대로다
 *   0 엑셀 파일을 연다    1 피벗 테이블을 만든다
 *   2 부서와 매출을 끌어다 놓는다    3 합계로 바꾸고 정렬한다
 *
 * scene "fold-one"
 *   0 앞 장의 네 칸이 그대로 서 있다
 *   1 접힌다 — 네 칸이 물러나고 문장 하나가 그 자리를 받는다
 *   2 네 칸이 흐리게 되돌아온다. **기능이 없어진 게 아니다** —
 *     피벗 테이블은 여전히 돌아가고, 내가 찾아가지 않게 됐을 뿐이다.
 *     대본이 그렇게 말하는데 화면에서 칸이 사라진 채면 반대로 읽힌다.
 *
 * scene "fold-tools" — 도구 하나가 한 스텝
 *   0 이미지 편집   1 검색   2 문서
 *
 * ── 색은 오프닝에서 이미 배웠다 ─────────────────────────────
 * 칸이 금색(사람이 손으로 찾아가던 것), 접힌 문장이 파랑(AI). CH00 handoff
 * 와 CH01 세 칸(StageLanes)이 쓰는 그 색 언어다. 그래서 9장 뒤에 세 칸
 * 그림이 나올 때 청중은 설명 없이 같은 축으로 읽는다.
 *
 * 칸 이름은 화면 데이터로 빼지 않았다. 15장과 16장이 **글자 하나까지 같은
 * 네 칸**이라는 게 이 그림의 전부라, 데이터로 빼면 한쪽만 고쳐져도 논지가
 * 조용히 무너진다 (WorkflowVsAgent.tsx 와 같은 이유).
 */

import { Reveal } from "../components/deck-kit";
import { AccentText } from "./copy-steps";
import type { CourseSlideSpec } from "./course-types";

/** 엑셀에서 부서별 매출을 뽑던 네 단계. 15·16장이 그대로 같이 쓴다. */
const PIVOT = [
  { where: "파일", name: "엑셀 파일을 연다" },
  { where: "삽입 탭", name: "피벗 테이블을 만든다" },
  { where: "행·값 영역", name: "부서와 매출을 끌어다 놓는다" },
  { where: "값 필드", name: "합계로 바꾸고 정렬한다" },
];

/** 그 네 칸이 접히고 남는 것. */
const PIVOT_SAID = "부서별 매출 합계로 정리해줘";

/**
 * 도구가 바뀌어도 같은 접힘이 일어난다 (fold-tools).
 * 왼쪽 칸들은 **메뉴 이름**이다 — 어디에 있는지 알아야 했다는 게 논지다.
 */
const TOOLS = [
  {
    tool: "이미지 편집",
    steps: ["마술봉 고르기", "허용치 조절", "선택 영역 다듬기"],
    said: "배경만 지워줘",
  },
  {
    tool: "검색",
    steps: ["키워드 고르기", "조합 바꾸기", "결과 훑기"],
    said: "이거 왜 안 되는지 알려줘",
  },
  {
    tool: "문서",
    steps: ["서식 메뉴 찾기", "스타일 고르기", "여백·글꼴 맞추기"],
    said: "보고서 형식으로 바꿔줘",
  },
];

export default function FoldSteps({
  spec,
  step,
}: {
  spec: CourseSlideSpec;
  step: number;
}) {
  const scene = spec.scene ?? "fold-many";
  const tools = scene === "fold-tools";
  /* 접힌 뒤의 상태. fold-many 는 끝까지 안 접히고, fold-one 은 스텝 1 에서
     접혀서 스텝 2 에 칸이 흐리게 되돌아온다. */
  const folded = scene === "fold-one" && step >= 1;
  const kept = scene === "fold-one" && step >= 2;

  return (
    <div className="course-fold" data-scene={scene} data-folded={folded || undefined}>
      <Reveal key={spec.id} delay={0.05} className="course-fold__copy">
        <h2>
          <AccentText text={spec.title} accent={spec.accent} />
        </h2>
        {spec.subtitle && (
          <p>
            <AccentText text={spec.subtitle} accent={spec.accent} />
          </p>
        )}
      </Reveal>

      <div className="course-fold__stage">
        {tools ? (
          TOOLS.map((t, i) => (
            <div className="course-fold__row" key={t.tool} data-on={step >= i}>
              <span className="course-fold__tool">{t.tool}</span>
              <div className="course-fold__cells" data-size="sm">
                {t.steps.map((name) => (
                  <span className="course-fold__cell" key={name}>
                    <b>{name}</b>
                  </span>
                ))}
              </div>
              <span className="course-fold__arrow" aria-hidden>
                →
              </span>
              <span className="course-fold__said" data-size="sm">
                “{t.said}”
              </span>
            </div>
          ))
        ) : (
          <>
            {/* 네 칸. fold-many 에서 하나씩 서고, fold-one 에서 물러났다가
                흐리게 되돌아온다. 자리는 세 상태에서 안 움직인다 —
                움직이면 "같은 네 칸"이라는 게 안 읽힌다. */}
            <div className="course-fold__cells" data-kept={kept || undefined}>
              {PIVOT.map((c, i) => (
                <span
                  className="course-fold__cell"
                  key={c.name}
                  data-on={scene === "fold-many" ? step >= i : true}
                  style={{ transitionDelay: `${i * 70}ms` }}
                >
                  <i className="mono">
                    {String(i + 1).padStart(2, "0")} · {c.where}
                  </i>
                  <b>{c.name}</b>
                </span>
              ))}
            </div>

            {/* 접히는 자리. 화살표가 먼저 내려가고 문장이 받는다. */}
            <span className="course-fold__fold" data-on={folded || undefined} aria-hidden>
              <i />
              <em>접힘</em>
              <i />
            </span>

            <span className="course-fold__said" data-on={folded || undefined}>
              “{PIVOT_SAID}”
            </span>

            {/* 대본의 착지 — "기능이 없어진 게 아닙니다". 칸이 흐리게
                남아 있는 그림이 그 문장이다. */}
            <span className="course-fold__kept" data-on={kept || undefined}>
              기능이 없어진 게 아닙니다 — <em>내가 찾아가지 않게 됐을 뿐입니다.</em>
            </span>
          </>
        )}
      </div>
    </div>
  );
}
