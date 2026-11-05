/**
 * 폭풍 구름 덩어리. 원을 겹친 뭉게구름(sky.tsx의 Cloud)은 가까이서 동그라미 윤곽이 보인다.
 * 여기서는 노이즈로 흔든 한 줄 윤곽(위는 부풀고 아래는 평평)을 매끈한 곡선으로 잇고,
 * 위가 밝고 아래가 어두운 그라데이션 + 안쪽 번개 빛 + 부드러운 가장자리로 칠한다.
 *
 *   <StormMass seed x y w h top body base t />    구름 한 덩어리(가장자리가 꿈틀거린다)
 *   <StormBank seed y x0 x1 ... />                 지평선을 따라 이어지는 덩어리 줄
 *   flash(0..1)와 flashX/flashY(0..1, 덩어리 안 위치)로 구름 속 번개가 안에서 비친다
 */
import React from "react";
import { useUid } from "./camera";
import { TAU, mix, n2, rnd } from "./math";

type Pt = [number, number];

/** 닫힌 점 목록 → 매끈한 닫힌 곡선(Catmull-Rom → 3차 베지어) */
export function smoothClosed(pts: Pt[], tension = 1) {
  const n = pts.length;
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1: Pt = [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension];
    const c2: Pt = [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + "Z";
}

/** 구름 윤곽 점: 위쪽 반은 뭉게뭉게 부풀고(billow), 아래는 거의 평평하다 */
export function stormOutline(seed: number, x: number, y: number, w: number, h: number, t = 0, rough = 1, n = 96): Pt[] {
  const bumps = 3 + Math.floor(rnd(seed, 1) * 4);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU;
    const c = Math.cos(a), s = Math.sin(a);
    const top = s < 0;
    const billow = top
      ? (Math.pow(Math.abs(Math.sin(a * bumps + rnd(seed, 2) * 6)), .6) * .16 + Math.pow(Math.abs(Math.sin(a * bumps * 2.7 + rnd(seed, 3) * 6)), .7) * .07 + Math.pow(Math.abs(Math.sin(a * bumps * 6.1 + rnd(seed, 4) * 6)), .8) * .025) * rough * Math.pow(-s, .5)
      : 0;
    const wob = n2(seed, c * 1.6 + t * .06, s * 1.6) * .1 * rough + n2(seed + 7, c * 4 + t * .1, s * 4) * .035 * rough;
    const rx = w / 2 * (1 + wob + billow * .4);
    const ry = (top ? h * (.8 + billow * 1.4 + wob) : h * .24 * (1 + wob * .5));
    return [x + c * rx, y + s * ry] as Pt;
  });
}

export const StormMass: React.FC<{
  seed: number; x: number; y: number; w: number; h?: number;
  /** 윗면(빛 받는 쪽) · 몸통 · 밑면 색 */
  top: string; body: string; base: string;
  t?: number; drift?: number; rough?: number;
  /** 가장자리 흐림(px). 먼 덩어리일수록 크게 */
  soft?: number;
  /** 구름 속 번개 0..1, 위치는 덩어리 안 비율 */
  flash?: number; flashX?: number; flashY?: number; flashColor?: string;
  /** 윗가장자리 빛(달빛·번개). 0이면 없음 */
  rim?: number; rimColor?: string;
  opacity?: number;
}> = ({ seed, x, y, w, h = w * .32, top, body, base, t = 0, drift = 0, rough = 1, soft = 3, flash = 0, flashX = .5, flashY = .4, flashColor = "#dff4ff", rim = 0, rimColor = "#ffffff", opacity = 1 }) => {
  const id = useUid("sm");
  const cx = x + drift * t;
  const pts = stormOutline(seed, cx, y, w, h, t, rough);
  const d = smoothClosed(pts);
  const ys = pts.map((p) => p[1]);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  return (
    <g opacity={opacity}>
      <defs>
        <linearGradient id={id + "f"} x1="0" y1={y0} x2="0" y2={y1} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={top} />
          <stop offset="45%" stopColor={body} />
          <stop offset="100%" stopColor={base} />
        </linearGradient>
        <radialGradient id={id + "l"} cx={cx - w / 2 + w * flashX} cy={mix(y0, y1, flashY)} r={w * .45} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={flashColor} stopOpacity={.95} />
          <stop offset="35%" stopColor={flashColor} stopOpacity={.45} />
          <stop offset="100%" stopColor={flashColor} stopOpacity={0} />
        </radialGradient>
        <linearGradient id={id + "r"} x1="0" y1={y0} x2="0" y2={y0 + h * .7} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={rimColor} stopOpacity={1} />
          <stop offset="100%" stopColor={rimColor} stopOpacity={0} />
        </linearGradient>
        {soft > .2 ? <filter id={id + "b"} x="-20%" y="-30%" width="140%" height="160%"><feGaussianBlur stdDeviation={soft} /></filter> : null}
        <clipPath id={id + "c"}><path d={d} /></clipPath>
      </defs>
      <g filter={soft > .2 ? `url(#${id}b)` : undefined}>
        {rim > 0 ? <path d={d} fill="none" stroke={`url(#${id}r)`} strokeWidth={Math.max(2, h * .05)} opacity={rim} /> : null}
        <path d={d} fill={`url(#${id}f)`} />
        {/* 안쪽 결: 덩어리 속 작은 부풂들이 밝고 어둡게 겹친다 */}
        <g clipPath={`url(#${id}c)`} opacity={.5}>
          {Array.from({ length: 5 }, (_, i) => {
            const u = (i + .5) / 5;
            const ix = cx - w / 2 + w * (u + (rnd(seed, 30 + i) - .5) * .15);
            const iy = mix(y0, y1, .35 + rnd(seed, 40 + i) * .3);
            const ip = smoothClosed(stormOutline(seed * 13 + i, ix, iy, w * (.25 + rnd(seed, 50 + i) * .15), h * .35, t, .8, 24));
            return <path key={i} d={ip} fill={i % 2 ? top : base} opacity={.35} />;
          })}
        </g>
        {flash > .01 ? <path d={d} fill={`url(#${id}l)`} opacity={flash} style={{ mixBlendMode: "screen" }} /> : null}
      </g>
    </g>
  );
};

/** 지평선 위로 이어지는 폭풍 구름 줄 */
export const StormBank: React.FC<{
  seed: number; y: number; x0?: number; x1?: number; size?: number; count?: number;
  top: string; body: string; base: string; t?: number; drift?: number; soft?: number; rim?: number; rimColor?: string;
  flash?: number; flashAt?: number; opacity?: number;
}> = ({ seed, y, x0 = -700, x1 = 2620, size = 700, count = 6, top, body, base, t = 0, drift = 4, soft = 4, rim = 0, rimColor, flash = 0, flashAt = -1, opacity }) => (
  <g opacity={opacity}>
    {Array.from({ length: count }, (_, i) => {
      const u = (i + .3 + rnd(seed, i) * .4) / count;
      const w = size * (.75 + rnd(seed, i + 10) * .6);
      return (
        <StormMass key={i} seed={seed * 37 + i} x={mix(x0, x1, u)} y={y + (rnd(seed, i + 20) - .5) * size * .12} w={w} h={w * (.28 + rnd(seed, i + 30) * .12)}
          top={top} body={body} base={base} t={t} drift={drift * (.6 + rnd(seed, i + 40) * .8)} soft={soft} rim={rim} rimColor={rimColor}
          flash={i === flashAt ? flash : 0} flashX={.3 + rnd(seed, i + 50) * .4} />
      );
    })}
  </g>
);
