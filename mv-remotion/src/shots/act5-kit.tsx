/**
 * 5막 전용 재료(키트에 없는 것). 모두 시각의 순수 함수다.
 *   rescueStreams  어둠 속 사방에서 한 점으로 나선을 그리며 모여드는 나방 줄기들(58~60이 같은 시간표를 공유)
 *   cradlePts      두 아이 아래의 빛 요람(아래로 둥근 그릇 모양 자리들)
 *   Rings          박에 맞춰 퍼지는 빛 고리
 *   RushClouds     카메라를 지나 아래로 쏟아지는 구름(상승 시차)
 *   SkyLayer       흐림 없는 하늘 층(키트의 무한 깊이 층도 심도 흐림을 먹어서 blur 0으로 고정)
 *   PhoneLight     한 손에 든 폰의 차가운 빛(키트의 phone은 두 손 사이에 놓인다)
 *   Sparks         떨어지는 금빛 불티
 */
import React from "react";
import { Layer } from "../lib/camera";
import { TAU, clamp, ease, mix, n2, rnd } from "../lib/math";
import type { Key } from "../lib/palette";
import { Cloud, Glow, SkyFill, Stars } from "../lib/sky";
import type { M } from "../lib/moths";

export type StreamOpt = {
  /** 모이는 중심(그 층 좌표) */
  cx: number; cy: number;
  /** 출발 반지름, 도착(맴돌기) 반지름 */
  R0: number; R1: number;
  /** 세로 눌림(타원) */
  sy?: number;
  /** 줄기 수, 줄기당 나방 수 */
  K: number; per: number;
  /** 첫 출발(곡 시각), 줄기마다 출발이 퍼지는 폭(초) */
  launch: number; spread: number;
  /** 출발→도착 시간(초), 한 줄기 안 나방 사이 간격(초) */
  travel: number; gap: number;
  /** 오는 동안 도는 각(rad) */
  spin: number;
  size: number;
  wob?: number; ribbon?: number; a0?: number; arc?: number; orbit?: number;
};

/** 사방에서 나선으로 모여드는 나방 줄기. 출발 전에는 멀리서 희미하게 떠 있다가, 출발하면 밝아지며 빨라지고, 도착하면 둘레를 돈다 */
export function rescueStreams(seed: number, t: number, o: StreamOpt): M[] {
  const out: M[] = [];
  const sy = o.sy ?? 1, wob = o.wob ?? 60, rib = o.ribbon ?? 40, om = o.orbit ?? 1.4;
  for (let k = 0; k < o.K; k++) {
    const th = (o.a0 ?? 0) + ((k + rnd(seed, k) * .7) / o.K) * (o.arc ?? TAU);
    const R = o.R0 * (.75 + rnd(seed, k + 50) * .5);
    const dir = rnd(seed, k + 100) > .5 ? 1 : -1;
    const spin = o.spin * dir * (.6 + rnd(seed, k + 120) * .8);
    const s0 = o.launch + rnd(seed, k + 150) * o.spread;
    const tr = o.travel * (.8 + rnd(seed, k + 170) * .4);
    for (let j = 0; j < o.per; j++) {
      const r1 = o.R1 * (.7 + rnd(seed, k * 31 + j) * .6);
      const pos = (tt: number) => {
        const x = (tt - s0 - j * o.gap) / tr;
        const u = ease("io", x);
        const r = mix(R, r1, u);
        const after = Math.max(0, x - 1) * tr;
        const ang = th + spin * u + dir * om * after * clamp(after * 3);
        const lat = (n2(seed + k * 7 + j, tt * .7) * wob + (rnd(seed, k * 97 + j) - .5) * rib) * (1 - u * .85);
        const bob = n2(seed + k * 13 + j, tt * .9, 3) * (x < 0 ? 18 : 6);
        const px = Math.cos(ang), py = Math.sin(ang);
        return { x: o.cx + px * (r + bob) - py * lat, y: o.cy + (py * (r + bob) + px * lat) * sy, x01: x, u };
      };
      const p = pos(t), q = pos(t + .03);
      const lit = x01b(p.x01);
      out.push({ x: p.x, y: p.y, s: o.size * (.6 + rnd(seed, k * 53 + j) * .8) * (1 + p.u * .25), a: Math.atan2(q.y - p.y, q.x - p.x), f: t * 17 + j * 1.3 + k, b: lit * (.65 + .35 * rnd(seed, k * 71 + j)) });
    }
  }
  return out;
}
/** 출발 전에는 희미하게(0.3), 출발하면 0.25초에 걸쳐 환히 */
const x01b = (x: number) => x < 0 ? .32 + .12 * Math.sin(x * 9) : mix(.45, 1, clamp(x * 4));

/** 빛 요람: (cx, cy)가 그릇 테두리 가운데, rx·ry는 그릇 반지름. 아래로 둥글고 양끝이 살짝 말려 올라간다 */
export function cradlePts(seed: number, cx: number, cy: number, rx: number, ry: number, n: number, rows = 4, inset = 0) {
  const cols = Math.ceil(n / rows);
  return Array.from({ length: n }, (_, i) => {
    const row = i % rows, col = Math.floor(i / rows);
    const u = (col + .5 + (rnd(seed, i) - .5) * .5) / cols;
    const phi = mix(.03, .97, u) * Math.PI;
    const f = 1 - row * .085 - inset;
    const curl = Math.pow(Math.abs(u - .5) * 2, 4) * ry * .25;
    const x = cx + Math.cos(phi) * rx * f;
    const y = cy + Math.sin(phi) * ry * f - curl + row * 4;
    const tan = Math.atan2(Math.cos(phi) * ry, -Math.sin(phi) * rx);
    return { x, y, a: tan + (rnd(seed, i + 300) > .5 ? Math.PI : 0), s: undefined as number | undefined };
  });
}

/** 박에 맞춰 퍼지는 빛 고리들 */
export const Rings: React.FC<{ x: number; y: number; t: number; at: number[]; r: number; color: string; dur?: number; sy?: number; width?: number; core?: string }> = ({ x, y, t, at, r, color, dur = 1.2, sy = 1, width = 10, core = "#ffffff" }) => (
  <g>
    {at.map((t0, i) => {
      const k = (t - t0) / dur;
      if (k < 0 || k > 1) return null;
      const e = ease("expoOut", k);
      const rr = r * e;
      const a = Math.pow(1 - k, 1.5);
      return (
        <g key={i}>
          <ellipse cx={x} cy={y} rx={rr} ry={rr * sy} fill="none" stroke={color} strokeWidth={width * 4 * (1 - k * .5)} opacity={a * .18} />
          <ellipse cx={x} cy={y} rx={rr} ry={rr * sy} fill="none" stroke={color} strokeWidth={width * 1.6 * (1 - k * .5)} opacity={a * .5} />
          <ellipse cx={x} cy={y} rx={rr} ry={rr * sy} fill="none" stroke={core} strokeWidth={width * .45 * (1 - k * .6)} opacity={a} />
        </g>
      );
    })}
  </g>
);

/** 아래로 지나가는 구름(올라가는 카메라). speed는 px/초, span은 되풀이 높이 */
export const RushClouds: React.FC<{ seed: number; t: number; n: number; speed: number; x0: number; x1: number; y0: number; span: number; size: number; dark: string; lit: string; opacity?: number; dx?: number }> = ({ seed, t, n, speed, x0, x1, y0, span, size, dark, lit, opacity = 1, dx = 0 }) => (
  <g opacity={opacity}>
    {Array.from({ length: n }, (_, i) => {
      const y = y0 + ((rnd(seed, i) * span + t * speed * (.85 + rnd(seed, i + 9) * .3)) % span);
      const x = mix(x0, x1, (i + rnd(seed, i + 20) * .8) / n) + dx * (y - y0) / span;
      const w = size * (.6 + rnd(seed, i + 40) * .8);
      return <Cloud key={i} seed={seed * 17 + i} x={x} y={y} w={w} h={w * (.35 + rnd(seed, i + 60) * .25)} dark={dark} lit={lit} />;
    })}
  </g>
);

/** 흐림 없는 하늘 층 */
export const SkyLayer: React.FC<{ k: Key; horizon?: number; glowX?: number; glowOpacity?: number; glowR?: number; stars?: number; t?: number; y0?: number; children?: React.ReactNode }> = ({ k, horizon = 980, glowX = 960, glowOpacity = .55, glowR = 1300, stars = 0, t = 0, y0 = -300, children }) => (
  <Layer d={Infinity} blur={0}>
    <SkyFill k={k} y0={y0} y1={horizon + 120} glowX={glowX} glowY={horizon} glowR={glowR} glowOpacity={glowOpacity} />
    {stars > 0 ? <Stars seed={5} t={t} alpha={stars} y1={horizon - 250} /> : null}
    {children}
  </Layer>
);

/** 한 손에 든 폰: 작은 화면 + 차가운 빛 번짐 */
export const PhoneLight: React.FC<{ x: number; y: number; s: number; color: string; on: number; ang?: number; glow?: number }> = ({ x, y, s, color, on, ang = 0, glow = 1 }) => {
  if (on <= .01) return null;
  const w = .06 * s, h = .1 * s;
  return (
    <g>
      <Glow x={x} y={y} r={s * .55 * glow} color={color} opacity={on * .45} />
      <Glow x={x} y={y} r={s * .16} color="#ffffff" opacity={on * .5} />
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={w * .2} fill={color} opacity={.4 + .6 * on} transform={`rotate(${(ang * 180) / Math.PI} ${x} ${y})`} />
    </g>
  );
};

/** 떨어지는 금빛 불티(날개 없는 나방 점). 화면 위에서 아래로, 바람에 흔들리며 */
export function sparks(seed: number, n: number, t: number, o: { x0: number; x1: number; y0: number; y1: number; speed: number; size: number; sway?: number }): M[] {
  const H = o.y1 - o.y0;
  return Array.from({ length: n }, (_, i) => {
    const sp = o.speed * (.6 + rnd(seed, i) * .8);
    const y = o.y0 + ((rnd(seed, i + 100) * H + t * sp) % H);
    const x = mix(o.x0, o.x1, rnd(seed, i + 200)) + n2(seed + i, t * .5) * (o.sway ?? 40);
    const fade = Math.min(1, (y - o.y0) / (H * .1), (o.y1 - y) / (H * .15));
    return { x, y, s: o.size * (.5 + rnd(seed, i + 300)), a: Math.PI / 2, f: 0, b: clamp(fade) * (.4 + .6 * (.5 + .5 * Math.sin(t * 7 + i))) };
  });
}
