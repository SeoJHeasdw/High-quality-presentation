/**
 * CH02 · 왜 만드는가 (5-15분)
 *
 * 5장: 모델 교체 → 판 베팅 → 바뀌는 것/남는 것 → 자비스 정의 → 착지.
 */
import type { ChapterSpec } from "../course-types";

const CH02: ChapterSpec = {
  chapter: 2,
  title: "왜 자비스를 만드는가",
  slides: [
    {
      id: "why-bet",
      layout: "statement",
      align: "center",
      eyebrow: "1장 · 전제와 결론",
      title: "모델이 아니라 판에 베팅한다",
      accent: "판에 베팅한다",
      subtitle: "모델은 1~2년마다 바뀐다.",
    },
    {
      id: "why-stays",
      layout: "comparison",
      eyebrow: "가르는 기준",
      title: "바뀌는 것과 남는 것",
      left: {
        label: "CHANGING",
        title: "바뀌는 것",
        body: "모델과 하드웨어와 과금.",
      },
      right: {
        label: "OWNED",
        title: "남는 것",
        body: "코드와 데이터와 판단기록.",
        role: "human",
      },
      steps: 2,
    },
    {
      id: "why-name",
      layout: "definition",
      eyebrow: "1장 · 정의",
      title: "자비스",
      subtitle: "챗봇이 아니라 개인 운영체계.",
    },
    {
      id: "why-line",
      layout: "warning",
      eyebrow: "1장 · 착지",
      title: "논쟁이 아니라 생존이다",
      accent: "생존",
      subtitle: "자비스가 당연한 세상에서 도태되지 않으려는 것이다.",
    },
  ],
};

export default CH02;
