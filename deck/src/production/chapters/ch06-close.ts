/**
 * CH06 · 파트너와 선언 (53-60분)
 *
 * 4장: 파트너 선언 → 쌓는 것들 → 30년 선언 → 1호 기록.
 * 마지막은 가운데 정렬 착지 2연타, 말의 여백을 둔다.
 */
import type { ChapterSpec } from "../course-types";

const CH06: ChapterSpec = {
  chapter: 6,
  title: "파트너와 선언",
  slides: [
    {
      id: "close-partner",
      layout: "statement",
      eyebrow: "5장 · 관계",
      title: "비서가 아니라 파트너다",
      accent: "파트너",
      subtitle: "비판하고 빈틈을 메우고 먼저 판단한다.",
    },
    {
      id: "close-save",
      layout: "checklist",
      eyebrow: "5장 · 쌓는 것들",
      title: "모델이 아니라 이것을 쌓는다",
      subtitle: "시간이 지날수록 남는 건 기록이다.",
      items: ["판단 이유를 남긴다", "데이터와 버전을 함께 둔다", "실패도 자산으로 쌓는다"],
      revealItems: true,
      steps: 3,
    },
    {
      id: "close-vow",
      layout: "statement",
      align: "center",
      eyebrow: "30년 선언",
      title: "지능은 임대하고, 생산은 소유한다",
      accent: "소유한다",
      subtitle: "결과와 기억은 축적한다.",
    },
    {
      id: "close-one",
      layout: "cover",
      eyebrow: "마지막",
      title: "이 강의안이 1호 기록이다",
      subtitle: "당장 TTS 파이프라인 1개부터.",
    },
  ],
};

export default CH06;
