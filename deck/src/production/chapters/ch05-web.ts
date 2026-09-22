/**
 * CH05 · 그래서 인터넷도 바뀐다 (42-53분)
 *
 * 5장: 큰 질문 → 읽기에서 호출로 → CAPTCHA → 돈의 이동 → LLMO.
 * 11분 압축이라 한 장 한 결론, 설명은 말로.
 */
import type { ChapterSpec } from "../course-types";

const CH05: ChapterSpec = {
  chapter: 5,
  title: "그래서 인터넷도 바뀐다",
  slides: [
    {
      id: "web-who",
      layout: "statement",
      align: "center",
      eyebrow: "4장 · 질문",
      title: "웹사이트는 누구를 위해 만드는가",
      accent: "누구를 위해",
      subtitle: "사람인가, 에이전트인가.",
    },
    {
      id: "web-call",
      layout: "comparison",
      eyebrow: "4장 · 전환",
      title: "읽는 페이지에서 호출하는 기능으로",
      left: {
        label: "NOW",
        title: "긁어서 해석한다",
        body: "HTML 파싱, 깨지고 비싸다.",
      },
      right: {
        label: "NEXT",
        title: "불러서 받는다",
        body: "MCP와 구조화 데이터.",
        role: "human",
      },
      steps: 2,
    },
    {
      id: "web-captcha",
      layout: "statement",
      eyebrow: "4장 · CAPTCHA",
      title: "인간 증명은 흔들린다",
      accent: "흔들린다",
      subtitle: "좋은 에이전트는 들이고 나쁜 에이전트는 막는다.",
    },
    {
      id: "web-money",
      layout: "checklist",
      eyebrow: "4장 · 돈의 이동",
      title: "AI는 광고를 보지 않는다",
      subtitle: "안 읽히면 팔 수 없다.",
      items: [
        "읽힐 때 과금한다",
        "에이전트 전용 구독을 판다",
        "검증된 데이터를 판다",
      ],
      revealItems: true,
      steps: 3,
    },
    {
      id: "web-llmo",
      layout: "definition",
      eyebrow: "4장 · 새 상식",
      title: "LLMO",
      subtitle: "에이전트를 설득하는 시대.",
    },
  ],
};

export default CH05;
