/**
 * 65번(북엔드) 도시: 1번 컷처럼 높은 곳에서 지붕 너머로 내려다본 창의 바다.
 * 멀수록 지붕선이 높고(지평선 쪽), 가까울수록 낮다 → 층마다 창벽이 보인다.
 * 실이 지붕에 닿으면 그 둘레 창이 켜져 번져 나가고, 박마다 새 실이 떨어진다. 모든 값은 시각 t의 순수 함수.
 *
 * 키트의 Skyline은 ignite를 주면 원래 창(차가운 깜빡임)을 모두 끄고 따뜻한 색만 쓴다.
 * 그래서 같은 seed로 두 번 그린다: 바닥(실루엣 + 원래 창) 위에 창만 있는 덧층(color "none", ignite).
 */
import React from "react";
import { getLength, getPointAtLength } from "@remotion/paths";
import { Layer } from "../lib/camera";
import { buildings, Skyline } from "../lib/city";
import { clamp, mix, mixhex, rnd, smooth } from "../lib/math";
import type { Key } from "../lib/palette";
import { Glow } from "../lib/sky";
import { Burst, Thread } from "../lib/moths";

export type CityRow = { d: number; seed: number; base: number; minH: number; maxH: number; minW: number; maxW: number; size: number; x0: number; x1: number; tone: number };

/** 1번 컷과 같은 높은 시점의 다섯 겹 */
export const ROWS: CityRow[] = [
  { d: 16, seed: 71, base: 430, minH: 110, maxH: 175, minW: 40, maxW: 95, size: .42, x0: -700, x1: 2700, tone: .85 },
  { d: 8, seed: 72, base: 610, minH: 190, maxH: 280, minW: 60, maxW: 140, size: .55, x0: -500, x1: 2500, tone: .65 },
  { d: 4, seed: 73, base: 840, minH: 270, maxH: 400, minW: 90, maxW: 190, size: .78, x0: -400, x1: 2400, tone: .42 },
  { d: 2.2, seed: 74, base: 1140, minH: 380, maxH: 540, minW: 150, maxW: 270, size: 1.08, x0: -500, x1: 2500, tone: .2 },
  { d: 1.3, seed: 75, base: 1560, minH: 540, maxH: 700, minW: 230, maxW: 400, size: 1.5, x0: -700, x1: 2700, tone: 0 },
];

/** Skyline과 똑같이 창 자리를 계산한다(창 번호 → 위치) */
export function windowsOf(row: CityRow) {
  const bs = buildings(row.seed, row.x0, row.x1, row.minH, row.maxH, row.minW, row.maxW);
  return bs.map((b) => {
    const top = row.base - b.h;
    const ws = 9 * row.size * clamp(b.w / 140, .6, 1.3);
    const cols = Math.max(2, Math.floor((b.w - ws) / (ws * 2.1)));
    const gx = (b.w - cols * ws) / (cols + 1), gy = ws * 1.6;
    const at = (k: number) => {
      const r = Math.floor(k / cols), c = k % cols;
      return { x: b.x + gx + c * (ws + gx) + ws / 2, y: top + ws * 1.2 + r * (ws + gy) + ws * .6, ws };
    };
    return { b, top, at, cols };
  });
}

export type Landing = { row: number; bi: number; t: number; dx?: number };

/** 실이 내려앉는 자리(건물 번호)와 곡 시각 → 그 층의 착지 점 */
export function landingPoint(row: CityRow, bi: number) {
  const W = windowsOf(row)[bi];
  return { x: W.b.x + W.b.w * .5, y: W.top };
}

/** 창 하나가 켜지는 시각: 가장 가까운 착지에서 번져 오는 시간 + 흔들림. 마지막엔 남은 창이 모두 켜진다 */
export function igniteTime(rowI: number, x: number, y: number, k: number, lands: Landing[], sweep: number, speed = 700) {
  const row = ROWS[rowI];
  let best = 1e9;
  for (const L of lands) {
    if (L.row !== rowI) continue;
    const p = landingPoint(row, L.bi);
    const dist = Math.hypot(x - p.x, (y - p.y) * .6);
    best = Math.min(best, L.t + dist / speed);
  }
  const j = rnd(row.seed * 13 + Math.round(x), k) * .18;
  return Math.min(best + j, sweep + rnd(row.seed * 7 + Math.round(y), k) * .9);
}

export const mixKey = (a: Key, b: Key, w: number): Key => {
  const o: Record<string, unknown> = {};
  for (const key of Object.keys(a) as (keyof Key)[]) {
    const va = a[key], vb = b[key];
    o[key] = Array.isArray(va) ? (va as string[]).map((c, i) => mixhex(c, (vb as string[])[i], w)) : mixhex(va as string, vb as string, w);
  }
  return o as Key;
};

/** 위에서 내려와 지붕에 닿는 빛의 실(한 층 좌표). 끝에 반짝이는 머리 */
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

/** 다섯 겹 도시. 차가운 밤(cold) → 따뜻함(warm) 색은 warmth로 섞는다 */
export const BookendCity: React.FC<{ t: number; kCold: Key; kWarm: Key; warmth: number; lands: Landing[]; sweep: number; threadColor: string; target?: { row: number; bi: number; k: number; cold: number } }> = ({ t, kCold, kWarm, warmth, lands, sweep, threadColor, target }) => {
  const k = mixKey(kCold, kWarm, warmth);
  return (
    <>
      {ROWS.map((row, ri) => {
        const W = windowsOf(row);
        const n = W.length;
        const col = mixhex(mixhex(k.silFar, k.sil, .55), mixhex(k.fog, k.sky[3], .3), row.tone);
        const ign = (u: number, i: number) => {
          const bi = Math.round(u * (n - 1));
          const p = W[bi].at(i);
          const tOn = igniteTime(ri, p.x, p.y, i, lands, sweep);
          // 다 켜지지는 않는다(빽빽한 격자처럼 보이지 않게): 열에 여덟
          return rnd(row.seed * 3 + bi, i + 7) < .8 ? smooth(tOn, tOn + .12, t) : 0;
        };
        const tgt = target && target.row === ri ? W[target.bi].at(target.k) : null;
        return (
          <Layer key={ri} d={row.d}>
            {/* 층 사이 공기(멀수록 지평선 빛) */}
            <rect x={-3000} y={row.base - row.maxH - 40} width={9000} height={row.maxH + 60} fill={k.fog} opacity={row.tone * .12} />
            <Skyline seed={row.seed} x0={row.x0} x1={row.x1} base={row.base} minH={row.minH} maxH={row.maxH} minW={row.minW} maxW={row.maxW} color={col} t={t}
              win={{ density: .13, size: row.size, warm: mixhex(kCold.win, kWarm.win, warmth), cold: k.cold, coldRatio: .55 }} />
            <Skyline seed={row.seed} x0={row.x0} x1={row.x1} base={row.base} minH={row.minH} maxH={row.maxH} minW={row.minW} maxW={row.maxW} color="none" t={t} details={false}
              win={{ size: row.size, warm: kWarm.win }} ignite={ign} />
            {tgt ? (
              <g>
                <rect x={tgt.x - tgt.ws / 2} y={tgt.y - tgt.ws * .6} width={tgt.ws} height={tgt.ws * 1.25} fill={kCold.cold} opacity={target!.cold * (.7 + .3 * Math.sin(t * 13) * Math.sin(t * 5.3))} />
                <Glow x={tgt.x} y={tgt.y} r={tgt.ws * 3} color={kCold.cold} opacity={target!.cold * .5} />
              </g>
            ) : null}
            {lands.filter((L) => L.row === ri).map((L, j) => {
              const p = landingPoint(row, L.bi);
              return <FallingThread key={j} x={p.x + (L.dx ?? 0)} y={p.y} t={t} tLand={L.t} seed={row.seed * 10 + j} width={mix(1.2, 3.4, 1 / row.d * 1.3)} color={threadColor} />;
            })}
          </Layer>
        );
      })}
    </>
  );
};
