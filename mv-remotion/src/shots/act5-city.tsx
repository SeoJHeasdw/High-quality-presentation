/**
 * 65번(북엔드) 도시: 1막이 만든 1번 컷 도시(act1-sets의 CityEstablish·cityCam)를 그대로 다시 쓴다 → 같은 구도, 같은 창.
 * 여기서는 그 위에 얹는 것만 만든다:
 *   igniteAt   (건물 순서 u, 창 번호 i) → 켜지는 시각. 실이 닿은 자리(u)에서 박마다 번져 나간다. 마지막엔 남은 창이 다 켜진다
 *   LandingThreads  각 층(1번 도시의 층과 같은 seed·크기)의 지붕에 내려앉는 빛의 실
 *   FallingThread / mixKey
 */
import React from "react";
import { getLength, getPointAtLength } from "@remotion/paths";
import { Layer } from "../lib/camera";
import { buildings } from "../lib/city";
import { clamp, mix, mixhex, rnd, smooth } from "../lib/math";
import type { Key } from "../lib/palette";
import { Glow } from "../lib/sky";
import { Burst, Thread } from "../lib/moths";

/**
 * 1번 도시의 층들(act1-sets CityEstablish의 Skyline 인자와 같아야 실이 지붕에 정확히 닿는다).
 * 목표 건물(1번의 그 창이 있는 건물)은 CityEstablish가 따로 그린다: d 2.4 층, x 1162~1376, 지붕 552
 */
export const A1ROWS = [
  { d: 16, seed: 11, base: 575, minH: 40, maxH: 190, minW: 40, maxW: 110, x0: -2200, x1: 4200 },
  { d: 9, seed: 12, base: 700, minH: 70, maxH: 300, minW: 60, maxW: 150, x0: -2000, x1: 3900 },
  { d: 5, seed: 13, base: 880, minH: 120, maxH: 380, minW: 80, maxW: 190, x0: -1600, x1: 3600 },
  { d: 2.4, seed: 14, base: 1220, minH: 300, maxH: 640, minW: 120, maxW: 260, x0: -1200, x1: 3300 },
];
const BS = A1ROWS.map((r) => buildings(r.seed, r.x0, r.x1, r.minH, r.maxH, r.minW, r.maxW));

/** 실이 닿는 곳: 층 번호와 건물 순서 u(0..1, 1번 도시의 ignite와 같은 좌표), 곡 시각. target이면 1번의 그 건물 */
export type Landing = { row: number; u: number; t: number; target?: boolean };

export function landingPoint(L: Landing) {
  if (L.target) return { x: 1269, y: 552 };
  const r = A1ROWS[L.row], bs = BS[L.row];
  const b = bs[Math.round(L.u * (bs.length - 1))];
  return { x: b.x + b.w / 2, y: r.base - b.h };
}

/** 창 하나가 켜지는 시각. 가장 가까운 착지(u)에서 번져 오고, 창마다 조금씩 늦다. sweep 뒤엔 남은 창이 모두 켜진다 */
export function igniteAt(u: number, i: number, lands: Landing[], sweep: number, spread = 5.5) {
  let tOn = 1e9;
  for (const L of lands) tOn = Math.min(tOn, L.t + Math.abs(u - L.u) * spread);
  const ui = Math.round(u * 997);
  tOn += rnd(i + 31, ui) * .28;
  return Math.min(tOn, sweep + rnd(i + 77, ui) * .8);
}
/**
 * 1번 컷에서 이미 켜져 있던 창. 키트 Skyline은 ignite를 받으면 원래 켜진 창(density)을 모두 끄므로,
 * Skyline과 같은 해시(rnd(seed*1000+건물, 100+창) < density)를 여기서 다시 계산해 돌려준다.
 * ignite 콜백은 층을 모르므로 u = 건물/(n-1)이 정수로 떨어지는 층을 찾는다. 목표 건물(u .55)은 1번처럼 창 하나만.
 */
const A1ALL = [...A1ROWS.map((r, i) => ({ ...r, density: [.1, .12, .13, .12][i] })), { d: 1.3, seed: 15, base: 1560, minH: 560, maxH: 720, minW: 220, maxW: 420, x0: -1100, x1: 3100, density: .05 }];
const NALL = A1ALL.map((r) => buildings(r.seed, r.x0, r.x1, r.minH, r.maxH, r.minW, r.maxW).length);
export function shot1Lit(u: number, i: number) {
  if (u === .55) return i === 27 ? .55 : 0;
  for (let L = 0; L < A1ALL.length; L++) {
    const x = u * (NALL[L] - 1), bi = Math.round(x);
    if (Math.abs(x - bi) < 1e-6) return rnd(A1ALL[L].seed * 1000 + bi, 100 + i) < A1ALL[L].density ? 1 : 0;
  }
  return 0;
}

/** 다 켜지지는 않는다(빽빽한 격자처럼 보이지 않게): 열에 여덟 */
export const litShare = (u: number, i: number) => rnd(i + 13, Math.round(u * 1013)) < .82;

export const mixKey = (a: Key, b: Key, w: number): Key => {
  const o: Record<string, unknown> = {};
  for (const key of Object.keys(a) as (keyof Key)[]) {
    const va = a[key], vb = b[key];
    o[key] = Array.isArray(va) ? (va as string[]).map((c, i) => mixhex(c, (vb as string[])[i], w)) : mixhex(va as string, vb as string, w);
  }
  return o as Key;
};

/** 위에서 내려와 지붕에 닿는 빛의 실(한 층 좌표). 끝에 반짝이는 머리, 닿으면 불씨와 반짝임 */
export const FallingThread: React.FC<{ x: number; y: number; t: number; tLand: number; fall?: number; sway?: number; seed: number; width?: number; color: string }> = ({ x, y, t, tLand, fall = .6, sway = 120, seed, width = 2.4, color }) => {
  const k = (t - (tLand - fall)) / fall;
  if (k <= 0) return null;
  const sx = x + (rnd(seed, 1) - .5) * sway * 2, sy = y - 1500;
  const d = `M${sx},${sy}C${sx + (rnd(seed, 2) - .5) * sway},${mix(sy, y, .45)} ${x + (rnd(seed, 3) - .5) * sway * .6},${mix(sy, y, .75)} ${x},${y}`;
  const p = clamp(k * k);
  const len = getLength(d);
  const head = getPointAtLength(d, len * p) ?? { x, y };
  const after = Math.max(0, t - tLand);
  return (
    <g>
      <Thread d={d} progress={p} color={color} width={width} opacity={mix(1, .45, smooth(0, 1.2, after))} />
      {k < 1 ? <Glow x={head.x} y={head.y} r={width * 14} color={color} opacity={.9} /> : null}
      {k < 1 ? <circle cx={head.x} cy={head.y} r={width * 1.6} fill="#fffbe8" /> : null}
      <Glow x={x} y={y} r={width * 40} color={color} opacity={after > 0 ? .7 * Math.exp(-after * 2.5) + .2 : 0} />
      <Burst x={x} y={y} t={t} t0={tLand} r={width * 70} n={18} color={color} dur={.8} seed={seed} />
    </g>
  );
};

/** 층마다 그 층 지붕에 닿는 실들(1번 도시의 각 층과 같은 깊이) */
export const LandingThreads: React.FC<{ t: number; lands: Landing[]; color: string }> = ({ t, lands, color }) => (
  <>
    {A1ROWS.map((r, ri) => (
      <Layer key={ri} d={r.d} blur={0}>
        {lands.map((L, j) => {
          if (L.row !== ri) return null;
          const p = landingPoint(L);
          return <FallingThread key={j} x={p.x} y={p.y} t={t} tLand={L.t} seed={ri * 100 + j} width={mix(1.1, 3.2, clamp(1.6 / r.d))} sway={mix(40, 140, clamp(1.6 / r.d))} color={color} />;
        })}
      </Layer>
    ))}
  </>
);
