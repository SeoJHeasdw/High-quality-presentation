/**
 * 나방 = 금빛 = 사람의 마음. 코드가 가장 잘하는 재료(입자)라서 이 뮤비의 움직임을 가장 많이 짊어진다.
 *
 * 나방 상태 M = {x, y, s(크기), a(머리 방향 rad), f(날갯짓 위상), b(밝기 0..1)}
 *   swarm(...)     한 점 둘레를 노이즈로 맴도는 떼
 *   stream(...)    경로 u(0..1)를 따라 흐르는 줄기(도시에서 모여드는 나방, 실을 따라 오르는 빛)
 *   toward(...)    떼 → 목표 자리(사다리 발판·요람·고리)로 모인다. 나방마다 늦게 출발하는 시차가 있다
 *   <Moths at={(t) => M[]} t={t} />   그리기. 꼬리(trail)는 과거 시각을 다시 계산해서 그린다(상태 없음)
 *   <Thread d=... progress=... />     빛의 실(@remotion/paths의 evolvePath로 그려 나간다)
 *   <Burst x y t0 t />                한 점에서 터지는 반짝임(손이 닿는 순간, 달에 닿는 순간)
 */
import React from "react";
import { evolvePath } from "@remotion/paths";
import { useUid } from "./camera";
import { TAU, clamp, ease, mix, n2, rnd } from "./math";

export type M = { x: number; y: number; s: number; a: number; f: number; b: number };

export function swarm(seed: number, n: number, t: number, o: { cx: number; cy: number; rx: number; ry: number; speed?: number; size?: number; flap?: number }): M[] {
  const sp = o.speed ?? .25, sz = o.size ?? 10;
  return Array.from({ length: n }, (_, i) => {
    const ph = rnd(seed, i) * 100;
    const x = o.cx + n2(seed + i * 3, t * sp + ph, 0) * o.rx;
    const y = o.cy + n2(seed + i * 3 + 1, t * sp + ph, 7) * o.ry;
    const x2 = o.cx + n2(seed + i * 3, (t + .05) * sp + ph, 0) * o.rx;
    const y2 = o.cy + n2(seed + i * 3 + 1, (t + .05) * sp + ph, 7) * o.ry;
    return { x, y, s: sz * (.6 + rnd(seed, i + 500) * .8), a: Math.atan2(y2 - y, x2 - x), f: t * (o.flap ?? 14) + ph, b: .6 + .4 * rnd(seed, i + 900) };
  });
}

export function stream(seed: number, n: number, t: number, path: (u: number) => { x: number; y: number }, o: { speed?: number; spread?: number; size?: number; from?: number; to?: number } = {}): M[] {
  const sp = o.speed ?? .15, spread = o.spread ?? 40, sz = o.size ?? 9, from = o.from ?? 0, to = o.to ?? 1;
  return Array.from({ length: n }, (_, i) => {
    const u0 = (rnd(seed, i) + t * sp * (.8 + rnd(seed, i + 77) * .4)) % 1;
    const u = mix(from, to, u0);
    const p = path(u), p2 = path(Math.min(1, u + .005));
    const nx = -(p2.y - p.y), ny = p2.x - p.x, l = Math.hypot(nx, ny) || 1;
    const off = n2(seed + i, t * .6 + i) * spread;
    const fade = Math.min(1, u0 * 8, (1 - u0) * 8);
    return { x: p.x + (nx / l) * off, y: p.y + (ny / l) * off, s: sz * (.6 + rnd(seed, i + 500) * .8), a: Math.atan2(p2.y - p.y, p2.x - p.x), f: t * 16 + i, b: fade * (.6 + .4 * rnd(seed, i + 900)) };
  });
}

/** from 떼가 targets 자리로 모인다. w 0→1. 나방 i는 stagger(0..1)만큼 늦게 출발 */
export function toward(from: M[], targets: { x: number; y: number; a?: number; s?: number }[], w: number, stagger = .5, e: Parameters<typeof ease>[0] = "expoOut"): M[] {
  return from.map((m, i) => {
    const T = targets[i % targets.length];
    const d = (i / Math.max(1, from.length - 1)) * stagger;
    const k = ease(e, clamp((w * (1 + stagger) - d)));
    return { ...m, x: mix(m.x, T.x, k), y: mix(m.y, T.y, k), a: T.a !== undefined && k > .9 ? T.a : m.a, s: T.s !== undefined ? mix(m.s, T.s, k) : m.s };
  });
}

export const Moths: React.FC<{
  at: (t: number) => M[]; t: number; color?: string; core?: string; glow?: number; trail?: number; trailDt?: number; wings?: boolean; opacity?: number;
}> = ({ at, t, color = "#ffc45a", core = "#fff3c8", glow = 1, trail = 0, trailDt = .035, wings = true, opacity = 1 }) => {
  const id = useUid("mo");
  const now = at(t);
  const past = trail > 0 ? Array.from({ length: trail }, (_, k) => at(t - (k + 1) * trailDt)) : [];
  return (
    <g opacity={opacity}>
      <defs>
        <radialGradient id={id}>
          <stop offset="0%" stopColor={core} stopOpacity={1} />
          <stop offset="18%" stopColor={color} stopOpacity={.85} />
          <stop offset="45%" stopColor={color} stopOpacity={.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      {trail > 0 ? now.map((m, i) => {
        const pts = [m, ...past.map((p) => p[i])].filter(Boolean);
        return <polyline key={"t" + i} points={pts.map((p) => `${p.x},${p.y}`).join(" ")} stroke={color} strokeOpacity={.35 * m.b} strokeWidth={m.s * .35} fill="none" strokeLinecap="round" />;
      }) : null}
      {now.map((m, i) => (
        <circle key={"g" + i} cx={m.x} cy={m.y} r={m.s * 3.2 * glow} fill={`url(#${id})`} opacity={m.b} />
      ))}
      {wings ? now.map((m, i) => {
        if (m.s < 4) return null;
        const flap = .25 + .75 * Math.abs(Math.sin(m.f));
        const deg = (m.a * 180) / Math.PI;
        return (
          <g key={"w" + i} transform={`translate(${m.x} ${m.y}) rotate(${deg})`} opacity={m.b}>
            <ellipse cx={-m.s * .1} cy={-m.s * .55 * flap} rx={m.s * .55} ry={m.s * .5 * flap} fill={core} opacity={.85} transform={`rotate(-25)`} />
            <ellipse cx={-m.s * .1} cy={m.s * .55 * flap} rx={m.s * .55} ry={m.s * .5 * flap} fill={core} opacity={.85} transform={`rotate(25)`} />
            <ellipse rx={m.s * .45} ry={m.s * .14} fill="#fffbe8" />
          </g>
        );
      }) : null}
    </g>
  );
};

/** 빛의 실. d는 SVG path, progress 0→1로 그려 나간다. 세 겹(넓은 번짐·중간·심)으로 빛나게 */
export const Thread: React.FC<{ d: string; progress?: number; color?: string; width?: number; glow?: number; opacity?: number }> = ({ d, progress = 1, color = "#ffd27a", width = 3, glow = 1, opacity = 1 }) => {
  const ev = evolvePath(clamp(progress), d);
  const dash = { strokeDasharray: ev.strokeDasharray, strokeDashoffset: ev.strokeDashoffset };
  return (
    <g opacity={opacity} fill="none" strokeLinecap="round">
      <path d={d} stroke={color} strokeWidth={width * 9} strokeOpacity={.08 * glow} {...dash} />
      <path d={d} stroke={color} strokeWidth={width * 3.5} strokeOpacity={.25 * glow} {...dash} />
      <path d={d} stroke="#fffbe8" strokeWidth={width} {...dash} />
    </g>
  );
};

/** 한 점에서 터지는 반짝임. t0에 터져 dur 동안 퍼진다 */
export const Burst: React.FC<{ x: number; y: number; t: number; t0: number; dur?: number; n?: number; r?: number; color?: string; seed?: number }> = ({ x, y, t, t0, dur = .9, n = 28, r = 220, color = "#ffe08a", seed = 9 }) => {
  const k = (t - t0) / dur;
  if (k < 0 || k > 1) return null;
  const e = ease("expoOut", k);
  return (
    <g style={{ mixBlendMode: "screen" }}>
      <circle cx={x} cy={y} r={r * .5 * e} fill="none" stroke={color} strokeWidth={6 * (1 - k)} opacity={1 - k} />
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * TAU + rnd(seed, i) * .3;
        const d = r * e * (.5 + rnd(seed, i + 40) * .8);
        const s = (2 + rnd(seed, i + 80) * 4) * (1 - k);
        return <circle key={i} cx={x + Math.cos(a) * d} cy={y + Math.sin(a) * d} r={s} fill={i % 3 ? color : "#ffffff"} opacity={1 - k * k} />;
      })}
    </g>
  );
};
