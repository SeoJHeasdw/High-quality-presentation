/**
 * CH01 · 오프닝 (0-5분)
 *
 * 오프라인이라 첫 30초는 사람이 말한다. 화면은 문제와 보상만.
 * 4장: 선언 → 대비 → 질문 전환 → 지도. 스텝은 착지 한 번씩만.
 */
import type { ChapterSpec } from "../course-types";

const CH01: ChapterSpec = {
  chapter: 1,
  title: "오프닝",
  slides: [
    {
      id: "open-who",
      layout: "chapter",
      eyebrow: "서울 · 32세 서제호 · 발표 60분",
      title: "나는 자비스를 만들고 있다",
      subtitle: "직함 얘기가 아니라, 30년 생존 얘기다.",
      metric: "00",
    },
    {
      id: "promptify-shot",
      layout: "classify",
      scene: "classify-then",
      eyebrow: "10년 전 이야기부터",
      title: "이 사진을 맞히면\n다 같이 박수를 쳤습니다.",
      accent: "박수를 쳤습니다",
      subtitle:
        "그때 기계가 내놓은 출력은 보시는 것처럼 단어 하나였습니다.",
      steps: 2,
    },
    {
      id: "promptify-vs-1",
      layout: "classify",
      scene: "classify-now",
      eyebrow: "10년 만에 출력이 바뀌었습니다",
      title: "맞혀보라던 것이 대신 해달라는 것이 됐습니다",
      accent: "대신 해달라는 것",
      subtitle:
        "같은 자리에 놓고 보면 넘긴 요청도, 돌아온 출력도 크기가 다릅니다.",
      steps: 2,
    },
    {
      id: "promptify-check-1",
      layout: "fold-steps",
      scene: "fold-many",
      eyebrow: "예전에 이 일을 하려면",
      title: "부서별 매출을 뽑는 데 네 단계가 필요했습니다",
      steps: 3,
    },
    {
      id: "open-split",
      layout: "javis-handoff",
      scene: "jd-handoff",
      eyebrow: "2008 vs 2026",
      title: "같은 다섯 가지 일, 주인이 다르다",
      accent: "주인이 다르다",
      items: ["음성 대화", "정보 검색", "코드 작성", "시스템 제어", "비서 역할"],
      steps: 1,
      sceneCut: true,
    },
    {
      id: "open-take",
      layout: "javis-handoff",
      scene: "jd-handoff",
      eyebrow: "2008 vs 2026",
      title: "칸이 하나씩 넘어간다",
      accent: "넘어간다",
      subtitle: "전부 넘어가면 AGENT다.",
      items: ["음성 대화", "정보 검색", "코드 작성", "시스템 제어", "비서 역할"],
      steps: 3,
    },
    {
      id: "open-map",
      layout: "checklist",
      eyebrow: "오늘의 지도",
      title: "셋만 들고 간다",
      subtitle: "만들 수 있는가가 아니라, 어떻게 사는가.",
      items: ["목적 · 30년", "수단 · 팩토리", "궁극 · 토큰"],
      revealItems: true,
      steps: 3,
    },
  ],
};

export default CH01;
