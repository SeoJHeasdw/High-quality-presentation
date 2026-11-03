/*
 * 23-3 · Claude에 1년(직전 12개월) 10만 달러 넘게 쓰는 곳. Anthropic S-1/A(2026-11-02): 2025.09.30 950곳 이상 → 2026.09.30 11,900곳 이상.
 * 3D(world.ts)의 점과 숫자(OneUser.tsx)가 같은 값과 시간표를 쓴다. 이 파일은 three.js를 가져오지 않는다.
 */
export const ORGS_THEN = 950, ORGS_NOW = 11900;
/** 점이 켜지는 시간표(초): 950곳이 ORG_THEN_AT부터 ORG_THEN_DUR 동안, 나머지가 ORG_NOW_AT부터 ORG_NOW_DUR 동안 */
export const ORG_THEN_AT = 0.3, ORG_THEN_DUR = 0.7, ORG_NOW_AT = 1.5, ORG_NOW_DUR = 1.8;
