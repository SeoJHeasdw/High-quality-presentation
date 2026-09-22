/**
 * CH04 · 궁극은 토큰이다 (27-42분) — 코어
 *
 * 6장: 티커 → 실물 그래프 → 수치 → 서울대 → 2~3%와 뒤집힘 → 착지.
 * metric 2장은 금색 숫자 하나가 결론이라 ShinyText가 돈다. 길게 세워둔다.
 */
import type { ChapterSpec } from "../course-types";

const CH04: ChapterSpec = {
  chapter: 4,
  title: "궁극은 토큰이다",
  slides: [
    {
      id: "token-chart",
      layout: "photo",
      eyebrow: "3장 · 실물",
      title: "이미 시작된 폭발",
      metric: "/token-usage.jpeg",
      items: ["사람이 24배 쓴 게 아니라 대리인이 쓰기 시작했다"],
    },
    {
      id: "token-ticker",
      layout: "javis-token",
      scene: "jd-token",
      eyebrow: "3장 · 증거벽",
      title: "세 숫자가 한 줄로 모인다",
      accent: "한 줄로",
      subtitle: "사람이 아니라 대리인이 쓰기 시작했다.",
      items: ["900×|토큰 상정", "31%|월 성장", "+2,434%|1년 새"],
      steps: 3,
      sceneCut: true,
    },
    {
      id: "token-rate",
      layout: "case",
      eyebrow: "3장 · 수치",
      title: "매달 31%씩, 1년 새 24배",
      left: {
        label: "WRONG READ",
        title: "성장 그래프",
        body: "사람이 24배 썼다.",
      },
      right: {
        label: "RIGHT READ",
        title: "사용자 교체",
        body: "대리인이 쓰기 시작했다.",
        role: "human",
      },
      steps: 2,
    },
    {
      id: "token-snu",
      layout: "statement",
      eyebrow: "3장 · 사례",
      title: "서울대 무제한은 1달 만에 고갈됐다",
      accent: "1달",
      subtitle: "수요 예측 실패가 아니라 수요의 본질을 봤다.",
    },
    {
      id: "token-few",
      layout: "metric",
      eyebrow: "3장 · 오늘과 미래",
      metric: "2~3%",
      title: "지금 토큰을 독식하는 비율",
      subtitle: "쓸 줄 알고 권한 있고 실험할 시간 있는 사람만 쓴다. 곧 모두가 많이 쓰는 세상이 온다.",
      items: ["당신 팀의 상위 3%는 누구인가"],
      steps: 3,
    },
    {
      id: "token-land",
      layout: "warning",
      eyebrow: "3장 · 착지",
      title: "아끼기가 아니라 버티기다",
      accent: "버티기",
      subtitle: "많이 써도 되는 몸을 미리 만드는 것, 그게 팩토리다.",
    },
  ],
};

export default CH04;
