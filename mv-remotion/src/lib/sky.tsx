/**
 * 하늘 재료. 모두 Layer(깊이 층) 안에 넣는 SVG 조각이다. 좌표는 그 층의 세계 좌표.
 *   SkyFill   4색 그라데이션 + 지평선 빛     Moon      달(후광·코로나·원판·옅은 무늬)
 *   Stars     반짝이는 별                     GodRays   한 점에서 퍼지는 빛줄기
 *   Cloud     위가 밝고 아래가 어두운 뭉게구름   CloudBank 구름 띠        Wisp  옆으로 긴 구름 결
 *   Lightning 갈래 번개                       Rain      비 줄기        Glow  둥근 빛 번짐
 */
import React from "react";
import { useUid } from "./camera";
import { TAU, clamp, hash, mix, n2, rnd } from "./math";
import type { Key } from "./palette";

export const Glow: React.FC<{ x: number; y: number; r: number; color: string; opacity?: number; rx?: number; ry?: number; core?: number }> = ({ x, y, r, color, opacity = 1, rx, ry, core = .0 }) => {
  const id = useUid("g");
  return (
    <>
      <defs>
        <radialGradient id={id}>
          <stop offset="0%" stopColor={color} stopOpacity={1} />
          <stop offset={`${Math.round(core * 100)}%`} stopColor={color} stopOpacity={core > 0 ? .9 : 1} />
          <stop offset="35%" stopColor={color} stopOpacity={.35} />
          <stop offset="70%" stopColor={color} stopOpacity={.08} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={x} cy={y} rx={rx ?? r} ry={ry ?? r} fill={`url(#${id})`} opacity={opacity} />
    </>
  );
};

export const SkyFill: React.FC<{ k: Key; y0?: number; y1?: number; glowX?: number; glowY?: number; glowR?: number; glowOpacity?: number; stops?: number[] }> = ({ k, y0 = -400, y1 = 1300, glowX = 960, glowY = 1000, glowR = 1300, glowOpacity = .55, stops = [0, .45, .78, 1] }) => {
  const id = useUid("sky");
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1={y0} x2="0" y2={y1} gradientUnits="userSpaceOnUse">
          {k.sky.map((c, i) => <stop key={i} offset={stops[i]} stopColor={c} />)}
        </linearGradient>
      </defs>
      <rect x={-6000} y={-6000} width={14000} height={14000} fill={k.sky[3]} />
      <rect x={-6000} y={y0 - 5600} width={14000} height={5600} fill={k.sky[0]} />
      <rect x={-6000} y={y0} width={14000} height={y1 - y0} fill={`url(#${id})`} />
      <Glow x={glowX} y={glowY} r={glowR} rx={glowR * 1.6} ry={glowR * .55} color={k.glow} opacity={glowOpacity} />
    </>
  );
};

/** 달. pulse(0..1)로 박자에 맞춰 후광이 숨 쉰다 */
export const Moon: React.FC<{ x: number; y: number; r: number; color: string; glow?: number; pulse?: number; halo?: string; texture?: number }> = ({ x, y, r, color, glow = 1, pulse = 0, halo, texture = 0 }) => {
  const id = useUid("moon");
  const h = halo ?? color;
  return (
    <g>
      <defs>
        <radialGradient id={id + "d"} cx="42%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor={color} />
          <stop offset="100%" stopColor={color} stopOpacity={.92} />
        </radialGradient>
      </defs>
      <Glow x={x} y={y} r={r * (7 + pulse * 1.5)} color={h} opacity={.22 * glow} />
      <Glow x={x} y={y} r={r * (3.2 + pulse * .6)} color={h} opacity={.45 * glow} />
      <Glow x={x} y={y} r={r * 1.6} color="#ffffff" opacity={.55 * glow} />
      <circle cx={x} cy={y} r={r} fill={`url(#${id}d)`} />
      {texture > 0 ? (
        <g opacity={.045 * texture} fill="#8a6a4a">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <circle key={i} cx={x + (rnd(17, i) - .5) * r * 1.2} cy={y + (rnd(23, i) - .5) * r * 1.2} r={r * (.08 + rnd(31, i) * .2)} />
          ))}
        </g>
      ) : null}
    </g>
  );
};

export const Stars: React.FC<{ seed?: number; count?: number; t: number; x0?: number; y0?: number; x1?: number; y1?: number; color?: string; size?: number; alpha?: number; glint?: number }> = ({ seed = 1, count = 140, t, x0 = -400, y0 = -300, x1 = 2320, y1 = 700, color = "#ffffff", size = 1, alpha = 1, glint = .08 }) => (
  <g>
    {Array.from({ length: count }, (_, i) => {
      const x = mix(x0, x1, rnd(seed, i * 3)), y = mix(y0, y1, Math.pow(rnd(seed, i * 3 + 1), 1.4));
      const big = rnd(seed, i * 3 + 2);
      const r = (big > .97 ? 2.6 : big > .85 ? 1.7 : 1.05) * size;
      const tw = .55 + .45 * Math.sin(t * (1.3 + big * 3) + i * 1.7);
      const a = clamp(alpha * tw * (.35 + big * .65));
      return (
        <g key={i} opacity={a}>
          <circle cx={x} cy={y} r={r} fill={color} />
          {big > 1 - glint ? <path d={`M${x - r * 5},${y}L${x + r * 5},${y}M${x},${y - r * 5}L${x},${y + r * 5}`} stroke={color} strokeWidth={r * .35} opacity={.6} /> : null}
        </g>
      );
    })}
  </g>
);

export const GodRays: React.FC<{ x: number; y: number; t: number; count?: number; len?: number; color: string; opacity?: number; seed?: number; spin?: number; width?: number }> = ({ x, y, t, count = 18, len = 1800, color, opacity = .25, seed = 3, spin = .02, width = .05 }) => {
  const id = useUid("ray");
  return (
    <g style={{ mixBlendMode: "screen" }}>
      <defs>
        <radialGradient id={id} cx={x} cy={y} r={len} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={color} stopOpacity={.9} />
          <stop offset="40%" stopColor={color} stopOpacity={.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * TAU + rnd(seed, i) * .4 + t * spin * (rnd(seed, i + 50) > .5 ? 1 : -1);
        const w = width * (.4 + rnd(seed, i + 9) * 1.2);
        const o = opacity * (.35 + .65 * (.5 + .5 * Math.sin(t * .7 + i * 2.1)));
        const p1 = `${x + Math.cos(a - w) * len},${y + Math.sin(a - w) * len}`, p2 = `${x + Math.cos(a + w) * len},${y + Math.sin(a + w) * len}`;
        return <path key={i} d={`M${x},${y}L${p1}L${p2}Z`} fill={`url(#${id})`} opacity={o} />;
      })}
    </g>
  );
};

/** 뭉게구름 하나. 위가 밝고(cloudLit) 아래가 어둡다(cloud). light: 빛이 위에서 오는 정도 */
export const Cloud: React.FC<{ seed: number; x: number; y: number; w: number; h?: number; dark: string; lit: string; t?: number; drift?: number; opacity?: number; rim?: string }> = ({ seed, x, y, w, h = w * .35, dark, lit, t = 0, drift = 0, opacity = 1, rim }) => {
  const id = useUid("cl");
  const n = 7 + Math.floor(rnd(seed, 0) * 5);
  const puffs = Array.from({ length: n }, (_, i) => {
    const u = i / (n - 1);
    const px = x + (u - .5) * w * .9 + (rnd(seed, i + 1) - .5) * w * .08 + drift * t;
    const bump = Math.sin(u * Math.PI);
    const r = h * (.35 + .55 * bump * (.6 + rnd(seed, i + 20) * .5));
    const py = y - r * .55 + (rnd(seed, i + 40) - .5) * h * .12;
    return { px, py, r };
  });
  return (
    <g opacity={opacity}>
      <defs>
        <linearGradient id={id} x1="0" y1={y - h * 1.1} x2="0" y2={y + h * .2} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={lit} />
          <stop offset="55%" stopColor={dark} />
          <stop offset="100%" stopColor={dark} />
        </linearGradient>
      </defs>
      {rim ? puffs.map((p, i) => <circle key={"r" + i} cx={p.px} cy={p.py - 3} r={p.r + 3} fill={rim} opacity={.55} />) : null}
      {puffs.map((p, i) => <circle key={i} cx={p.px} cy={p.py} r={p.r} fill={`url(#${id})`} />)}
      <rect x={x - w * .47 + drift * t} y={y - h * .25} width={w * .94} height={h * .25} rx={h * .12} fill={dark} />
    </g>
  );
};

export const CloudBank: React.FC<{ seed: number; y: number; x0?: number; x1?: number; size?: number; dark: string; lit: string; t?: number; drift?: number; count?: number; rim?: string; opacity?: number }> = ({ seed, y, x0 = -800, x1 = 2700, size = 520, dark, lit, t = 0, drift = 6, count = 9, rim, opacity }) => (
  <g opacity={opacity}>
    {Array.from({ length: count }, (_, i) => {
      const u = (i + rnd(seed, i) * .6) / count;
      const w = size * (.7 + rnd(seed, i + 10) * .7);
      return <Cloud key={i} seed={seed * 31 + i} x={mix(x0, x1, u)} y={y + (rnd(seed, i + 20) - .5) * size * .18} w={w} dark={dark} lit={lit} t={t} drift={drift * (.6 + rnd(seed, i + 30))} rim={rim} />;
    })}
  </g>
);

export const Wisp: React.FC<{ x: number; y: number; w: number; h?: number; color: string; opacity?: number; t?: number; drift?: number }> = ({ x, y, w, h = w * .04, color, opacity = .4, t = 0, drift = 8 }) => {
  const id = useUid("w");
  return (
    <>
      <defs>
        <radialGradient id={id}>
          <stop offset="0%" stopColor={color} stopOpacity={1} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={x + drift * t} cy={y} rx={w / 2} ry={h} fill={`url(#${id})`} opacity={opacity} />
    </>
  );
};

/** 번개. flash(0..1)가 밝기. 같은 seed는 같은 모양 */
export const Lightning: React.FC<{ seed: number; x0: number; y0: number; x1: number; y1: number; flash: number; color?: string; width?: number; branches?: number }> = ({ seed, x0, y0, x1, y1, flash, color = "#eaf8ff", width = 5, branches = 4 }) => {
  if (flash <= .01) return null;
  const seg = (sx: number, sy: number, ex: number, ey: number, sd: number, steps: number, jag: number) => {
    const pts: [number, number][] = [[sx, sy]];
    for (let i = 1; i < steps; i++) {
      const u = i / steps;
      const nx = -(ey - sy), ny = ex - sx, l = Math.hypot(nx, ny) || 1;
      const off = (rnd(sd, i) - .5) * jag * Math.hypot(ex - sx, ey - sy);
      pts.push([mix(sx, ex, u) + (nx / l) * off, mix(sy, ey, u) + (ny / l) * off]);
    }
    pts.push([ex, ey]);
    return pts;
  };
  const main = seg(x0, y0, x1, y1, seed, 14, .12);
  const br = Array.from({ length: branches }, (_, b) => {
    const k = 2 + Math.floor(rnd(seed, 100 + b) * 9);
    const [sx, sy] = main[k];
    const ang = Math.atan2(y1 - y0, x1 - x0) + (rnd(seed, 200 + b) - .5) * 1.6;
    const L = Math.hypot(x1 - x0, y1 - y0) * (.15 + rnd(seed, 300 + b) * .25);
    return seg(sx, sy, sx + Math.cos(ang) * L, sy + Math.sin(ang) * L, seed * 7 + b, 6, .2);
  });
  const d = (pts: [number, number][]) => "M" + pts.map((p) => p.join(",")).join("L");
  return (
    <g opacity={clamp(flash)} style={{ mixBlendMode: "screen" }}>
      {[main, ...br].map((pts, i) => (
        <g key={i}>
          <path d={d(pts)} stroke={color} strokeWidth={width * (i ? 6 : 10)} opacity={.12} fill="none" strokeLinejoin="round" />
          <path d={d(pts)} stroke={color} strokeWidth={width * (i ? 2 : 3.2)} opacity={.35} fill="none" strokeLinejoin="round" />
          <path d={d(pts)} stroke="#ffffff" strokeWidth={width * (i ? .5 : 1)} fill="none" strokeLinejoin="round" />
        </g>
      ))}
    </g>
  );
};

export const Rain: React.FC<{ seed?: number; t: number; count?: number; angle?: number; color?: string; opacity?: number; speed?: number; len?: number; x0?: number; x1?: number; y0?: number; y1?: number; width?: number }> = ({ seed = 5, t, count = 260, angle = .22, color = "#bcd8e0", opacity = .35, speed = 2400, len = 70, x0 = -300, x1 = 2220, y0 = -200, y1 = 1280, width = 1.6 }) => {
  const H = y1 - y0;
  return (
    <g opacity={opacity} stroke={color} strokeWidth={width} strokeLinecap="round">
      {Array.from({ length: count }, (_, i) => {
        const sp = speed * (.8 + rnd(seed, i) * .5);
        const y = y0 + ((rnd(seed, i + 1000) * H + t * sp) % H);
        const x = mix(x0, x1, rnd(seed, i + 2000)) + (y - y0) * Math.tan(angle);
        const l = len * (.6 + rnd(seed, i + 3000) * .8);
        return <line key={i} x1={x} y1={y} x2={x - Math.sin(angle) * l} y2={y - Math.cos(angle) * l} opacity={.4 + rnd(seed, i + 4000) * .6} />;
      })}
    </g>
  );
};

/** 노이즈로 흔들리는 값(바람·흔들림) */
export const sway = (seed: number, t: number, amp = 1, speed = .5) => n2(seed, t * speed) * amp;
export { hash };
