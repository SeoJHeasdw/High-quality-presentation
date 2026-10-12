/*
 * 6번 무대 배치(화면 px). 3D(world.ts)와 라벨(Bots.tsx)이 같은 값을 쓴다.
 * 이 파일은 three.js를 가져오지 않는다. 장표가 3D 모듈을 늦게 불러도 라벨은 바로 자리를 잡는다.
 */

/** Cloudflare 2025.12.02 HTML 요청(%): 그 밖의 봇(AI가 아닌 봇 44 + Googlebot 5) · AI 봇 등(나머지) · 사람. 합이 100이다. */
export const SHARES = [49, 4, 47] as const;
export const AUTO = SHARES[0] + SHARES[1];

const SLAB = { x0: 100, x1: 1820, y: 462, h: 150, gap: 8 };
const segments = (() => {
  const usable = SLAB.x1 - SLAB.x0 - SLAB.gap * (SHARES.length - 1);
  let x = SLAB.x0;
  return SHARES.map((s) => { const x0 = x, x1 = x + usable * s / 100; x = x1 + SLAB.gap; return { x0, x1 }; });
})();

export const LAYOUT = {
  page: { x: 1490, y: 612, w: 700, h: 438, rotY: -0.62 },
  /** 관측 지점: 흐름을 가로질러 비스듬히 선 얇은 막 */
  gate: { x: 790, y: 612, w: 420, h: 430, rotY: 1.18 },
  /** 숫자의 왼쪽 끝과 글자 바닥선 */
  num: { auto: { x: 100, base: 668 }, human: { x: segments[2].x0, base: 668 } },
  /** 0단계 막대: 봇 한 칸과 사람 한 칸. 1단계 두꺼운 막대의 칸 경계와 맞춘다. */
  bar: { y: 720, h: 28, auto: { x0: segments[0].x0, x1: segments[1].x1 }, human: segments[2] },
  /** 1단계 두꺼운 막대 */
  slab: { ...SLAB, segments },
};
