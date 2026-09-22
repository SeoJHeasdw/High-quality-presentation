/**
 * CH03 · 수단 = AI 팩토리 (15-27분)
 *
 * 6장: 선언 → 한 바퀴 → 실물 2개(TTS·투자) → 규칙 3개 → 비용 고백.
 * 실물은 오프라인 시연 자리다. 화면은 결과 한 줄만, 과정은 말과 시연으로.
 */
import type { ChapterSpec } from "../course-types";

const CH03: ChapterSpec = {
  chapter: 3,
  title: "수단은 AI 팩토리다",
  slides: [
    {
      id: "factory-idea",
      layout: "statement",
      eyebrow: "2장 · 선언",
      title: "챗봇이 아니라 공장이다",
      accent: "공장",
      subtitle: "판단과 실행과 생산과 검증이 한 몸으로 돈다.",
    },
    {
      id: "factory-loop",
      layout: "javis-loop",
      scene: "jd-loop",
      eyebrow: "2장 · 한 바퀴",
      title: "지능은 임대하고, 생산은 소유한다",
      accent: "소유한다",
      items: [
        "의도 · 내가 정한다",
        "판단 · 클라우드에 빌린다",
        "생산 · 로컬이 맡는다",
        "검증과 저장 · 다음 자산이 된다",
      ],
      steps: 4,
      sceneCut: true,
    },
    {
      id: "factory-voice",
      layout: "demo",
      eyebrow: "2장 · 실물 1",
      subtitle: "LIVE",
      title: "내 목소리로 강의 한 편",
      accent: "내 목소리",
      items: ["생성하고, 다시 전사한다", "틀린 구간만 고친다"],
    },
    {
      id: "factory-rules",
      layout: "checklist",
      eyebrow: "2장 · 규칙",
      title: "세 가지 규칙",
      items: [
        "프레임워크에 종속되지 않는다",
        "모델 이름을 로직에 박지 않는다",
        "추가 1건의 외부 과금을 0에 수렴시킨다",
      ],
      revealItems: true,
    },
    {
      id: "factory-cost",
      layout: "statement",
      eyebrow: "2장 · 고백",
      title: "로컬도 공짜가 아니다",
      accent: "공짜가 아니다",
      subtitle: "목표는 무료가 아니라 예측 가능성이다.",
    },
  ],
};

export default CH03;
