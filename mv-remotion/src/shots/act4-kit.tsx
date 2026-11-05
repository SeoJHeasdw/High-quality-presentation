/**
 * 4막 전용 재료. 키트(src/lib)에 없는 것만 여기서 만든다.
 *   lerpKey      두 컬러 키 사이 보간(50번: 은빛 → 폭풍)
 *   CloudMass    올라앉을 수 있는 구름 섬(평평하고 울퉁불퉁한 윗면, 둥근 끝, 아래로 녹아드는 몸)
 *   CloudStone   징검다리 구름(작고 둥근 덩이, 밟으면 눌린다)
 *   StormMass    탑처럼 솟은 폭풍 구름. 속에서 번개가 번쩍이면 안쪽이 밝아진다
 *   Vapor        착지·충격 때 피어오르는 구름 김
 *   Hand         클로즈업 손(손목·손바닥·손가락 넷·엄지, 소매). 굽힘(curl)으로 갈고리 → 펼침
 *   AlleyView    높은 곳에서 내려다본 좁은 골목. 마주 보는 두 창(48번)
 *   Streaks      한 방향으로 흐르는 줄(빠른 낙하의 비·속도선)
 *   RadialRain   소실점으로 빨려 들어가는 비(위에서 내려다본 낙하, 54번)
 */
import React from "react";
import { useUid } from "../lib/camera";
import { TAU, clamp, ease, mix, mixc, mixhex, n2, rnd } from "../lib/math";
import type { Key } from "../lib/palette";
import { Glow } from "../lib/sky";

export function lerpKey(a: Key, b: Key, w: number): Key {
  const m = (p: string, q: string) => mixhex(p, q, clamp(w));
  return {
    sky: [m(a.sky[0], b.sky[0]), m(a.sky[1], b.sky[1]), m(a.sky[2], b.sky[2]), m(a.sky[3], b.sky[3])],
    glow: m(a.glow, b.glow), moon: m(a.moon, b.moon), fog: m(a.fog, b.fog), sil: m(a.sil, b.sil), silFar: m(a.silFar, b.silFar),
    rim: m(a.rim, b.rim), win: m(a.win, b.win), cold: m(a.cold, b.cold), accent: m(a.accent, b.accent), cloud: m(a.cloud, b.cloud), cloudLit: m(a.cloudLit, b.cloudLit),
  };
}

type Puff = { x: number; y: number; r: number };

/**
 * 구름 섬. 윗면 높이 y(앉는 자리), x0~x1, 몸 깊이 depth. ends: 둥글게 끝나는 쪽.
 * 위가 밝고(lit) 아래로 갈수록 어둡다가(dark) 바닥에서 투명하게 녹는다.
 */
export const CloudMass: React.FC<{
  seed: number; x0: number; x1: number; y: number; depth?: number; dark: string; lit: string; rim?: string;
  ends?: "L" | "R" | "LR" | ""; bump?: number; t?: number; sheen?: number; fade?: boolean;
}> = ({ seed, x0, x1, y, depth = 520, dark, lit, rim, ends = "L", bump = 1, t = 0, sheen = .35, fade = true }) => {
  const id = useUid("cm");
  const top: Puff[] = [];
  const n = Math.max(3, Math.round((x1 - x0) / 120));
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const r = (50 + rnd(seed, i) * 60) * bump;
    top.push({ x: mix(x0, x1, u) + (rnd(seed, i + 50) - .5) * 50, y: y + r * .78 + n2(seed, i * .7 + t * .12) * 3, r });
  }
  const side: Puff[] = [];
  const end = (x: number, dir: number) => {
    for (let j = 0; j < 6; j++) {
      const v = j / 5;
      const r = (80 + v * 120 + rnd(seed, 100 + j + (dir > 0 ? 20 : 0)) * 40) * bump;
      side.push({ x: x + dir * (r * .25 + Math.sin(v * 2.6) * 50 * bump) + (rnd(seed, 140 + j) - .5) * 30, y: y + r * .9 + v * depth * .55, r });
    }
  };
  if (ends.includes("L")) end(x0, -1);
  if (ends.includes("R")) end(x1, 1);
  const bodyX0 = ends.includes("L") ? x0 : x0 - 600, bodyX1 = ends.includes("R") ? x1 : x1 + 600;
  const all = [...side, ...top];
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1={y - 90} x2="0" y2={y + depth} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={lit} />
          <stop offset="20%" stopColor={mixc(lit, dark, .45)} />
          <stop offset="55%" stopColor={dark} />
          <stop offset="100%" stopColor={dark} stopOpacity={fade ? 0 : 1} />
        </linearGradient>
      </defs>
      {rim ? top.map((p, i) => <circle key={"r" + i} cx={p.x} cy={p.y - 4} r={p.r + 4} fill={rim} opacity={.6} />) : null}
      <rect x={bodyX0} y={y + 30} width={bodyX1 - bodyX0} height={depth - 30} rx={60} fill={`url(#${id})`} />
      {all.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={`url(#${id})`} />)}
      {sheen > 0 ? <Glow x={(x0 + x1) / 2} y={y + 10} r={60} rx={(x1 - x0) * .55} ry={70} color={lit} opacity={sheen} /> : null}
    </g>
  );
};

/** 징검다리 구름 하나. 윗면 가운데가 (x, y). press 0..1 밟혀 눌림 */
export const CloudStone: React.FC<{ seed: number; x: number; y: number; w: number; dark: string; lit: string; rim?: string; press?: number; opacity?: number }> = ({ seed, x, y, w, dark, lit, rim, press = 0, opacity = 1 }) => {
  const id = useUid("cs");
  const h = w * .55;
  const n = 6;
  const sq = 1 - press * .12;
  const puffs: Puff[] = Array.from({ length: n }, (_, i) => {
    const u = i / (n - 1);
    const bumpv = Math.sin(u * Math.PI);
    const r = w * (.16 + .14 * bumpv * (.7 + rnd(seed, i) * .5));
    return { x: x + (u - .5) * w * .82, y: y + r * .85 + press * w * .05, r };
  });
  const under: Puff[] = Array.from({ length: 4 }, (_, i) => ({ x: x + (rnd(seed, i + 10) - .5) * w * .5, y: y + h * (.45 + rnd(seed, i + 20) * .35), r: w * (.18 + rnd(seed, i + 30) * .1) }));
  return (
    <g opacity={opacity} transform={`translate(${x} ${y}) scale(${1 + press * .06} ${sq}) translate(${-x} ${-y})`}>
      <defs>
        <linearGradient id={id} x1="0" y1={y - w * .12} x2="0" y2={y + h} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={lit} />
          <stop offset="40%" stopColor={dark} />
          <stop offset="100%" stopColor={dark} stopOpacity={.0} />
        </linearGradient>
      </defs>
      {rim ? puffs.map((p, i) => <circle key={"r" + i} cx={p.x} cy={p.y - 3} r={p.r + 3} fill={rim} opacity={.55} />) : null}
      {under.map((p, i) => <circle key={"u" + i} cx={p.x} cy={p.y} r={p.r} fill={`url(#${id})`} />)}
      {puffs.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={`url(#${id})`} />)}
    </g>
  );
};

/**
 * 폭풍 구름 탑(적란운): 넓은 밑동, 좁아지는 몸, 퍼지는 모루. (x, y)는 밑동 가운데, w 너비, h 높이.
 * flash 0..1이면 속(fx, fy)에서 빛이 번진다. churn은 끓어오름 속도.
 */
export const StormMass: React.FC<{
  seed: number; x: number; y: number; w: number; h: number; dark: string; lit: string; t: number;
  flash?: number; flashColor?: string; fx?: number; fy?: number; churn?: number; rows?: number; edge?: string;
}> = ({ seed, x, y, w, h, dark, lit, t, flash = 0, flashColor = "#dff4ff", fx = .5, fy = .45, churn = 1, rows = 7, edge }) => {
  const id = useUid("sm");
  const prof = (v: number) => .62 + .38 * Math.pow(1 - v, 2) + .55 * Math.pow(clamp((v - .62) / .38), 1.5);
  const puffs: Puff[] = [];
  for (let j = 0; j < rows; j++) {
    const v = j / (rows - 1);
    const ww = w * prof(v) * .5;
    const m = 3 + Math.floor(rnd(seed, j) * 3);
    for (let i = 0; i < m; i++) {
      const u = m === 1 ? .5 : i / (m - 1);
      const r = h * (.13 + rnd(seed, j * 10 + i) * .09) * (v > .8 ? .8 : 1);
      const px = x + (u - .5) * 2 * ww * .78 + n2(seed + j * 7 + i, t * .2 * churn) * r * .12;
      const py = y - v * h * .86 + (rnd(seed, j * 10 + i + 5) - .5) * r * .4 + n2(seed + j * 5 + i, t * .25 * churn + 3) * r * .1;
      puffs.push({ x: px, y: py, r });
    }
  }
  const glowX = x + (fx - .5) * w * .6, glowY = y - fy * h;
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1={y - h} x2="0" y2={y} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={lit} />
          <stop offset="35%" stopColor={mixc(lit, dark, .6)} />
          <stop offset="100%" stopColor={dark} />
        </linearGradient>
      </defs>
      {edge ? puffs.map((p, i) => <circle key={"e" + i} cx={p.x} cy={p.y - 4} r={p.r + 4} fill={edge} opacity={.5} />) : null}
      {puffs.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={`url(#${id})`} />)}
      <rect x={x - w * .5} y={y - h * .12} width={w} height={h * .4} rx={h * .12} fill={dark} />
      {flash > .01 ? (
        <g style={{ mixBlendMode: "screen" }}>
          <Glow x={glowX} y={glowY} r={h * .55} rx={w * .45} ry={h * .5} color={flashColor} opacity={flash * .75} />
          <Glow x={glowX} y={glowY} r={h * .18} color="#ffffff" opacity={flash * .55} />
          {puffs.filter((_, i) => rnd(seed + 3, i) > .55).map((p, i) => {
            const dd = Math.hypot(p.x - glowX, p.y - glowY) / (w * .6);
            return <circle key={"f" + i} cx={p.x} cy={p.y} r={p.r * .9} fill={flashColor} opacity={flash * .22 * clamp(1 - dd)} />;
          })}
        </g>
      ) : null}
    </g>
  );
};

/** 구름 김: (x, y)에서 t0에 퍼진다(착지·충격) */
export const Vapor: React.FC<{ x: number; y: number; t: number; t0: number; n?: number; r?: number; color: string; seed?: number; dur?: number; up?: number }> = ({ x, y, t, t0, n = 12, r = 120, color, seed = 3, dur = 1.1, up = .35 }) => {
  const a = t - t0;
  if (a < 0 || a > dur) return null;
  const e = ease("expoOut", a / dur);
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const side = rnd(seed, i) > .5 ? 1 : -1;
        const dx = side * r * (.3 + rnd(seed, i + 10)) * e;
        const dy = -r * up * (.2 + rnd(seed, i + 20)) * e;
        const rr = r * (.2 + rnd(seed, i + 30) * .22) * (.5 + e);
        return <Glow key={i} x={x + dx} y={y + dy} r={rr} color={color} opacity={(1 - a / dur) * .75} />;
      })}
    </g>
  );
};

/* ───────────── 손 클로즈업 ───────────── */

export type HandSpec = {
  /** 손목 위치와 손이 뻗는 방향(rad, 화면 좌표) */
  x: number; y: number; a: number; s: number;
  /** 손가락 굽힘 0 펼침 … 1 갈고리 … 1.4 주먹 */
  curl?: number;
  /** 손가락 사이 벌림 */
  spread?: number;
  thumb?: number;
  /** 손바닥이 -y쪽(뒤집힘) */
  flip?: boolean;
  /** 소매 길이(s 배수). 0이면 소매 없음 */
  sleeve?: number;
  /** 손가락마다 굽힘을 조금씩 다르게(미끄러질 때) */
  stagger?: number;
};

function handShape(h: HandSpec, color: string, key: string) {
  const s = h.s, curl = h.curl ?? .4, spread = h.spread ?? .3, th = h.thumb ?? .3, sl = h.sleeve ?? 1.8, stg = h.stagger ?? 0;
  const fy = h.flip ? -1 : 1;
  const fingers = [0, 1, 2, 3].map((i) => {
    const len = [.27, .31, .3, .24][i] * s;
    const by = mix(-.12, .12, i / 3) * s * (.75 + spread);
    let px = .4 * s - Math.abs(i - 1.3) * .02 * s, py = by * fy;
    let ang = (i - 1.5) * spread * .12 * fy;
    const c = curl + (i - 1.5) * stg;
    const pts: string[] = [`${px.toFixed(1)},${py.toFixed(1)}`];
    [.42, .33, .25].forEach((seg, k) => {
      ang += c * [.6, .85, .7][k] * fy;
      px += Math.cos(ang) * len * seg;
      py += Math.sin(ang) * len * seg;
      pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    });
    return <polyline key={i} points={pts.join(" ")} fill="none" stroke={color} strokeWidth={.085 * s} strokeLinecap="round" strokeLinejoin="round" />;
  });
  // 엄지: 손바닥 -y쪽 가장자리에서 앞·바깥으로
  let tx = .1 * s, ty = -.13 * s * fy, ta = -.75 * fy;
  const tp: string[] = [`${tx},${ty}`];
  [.14, .11].forEach((seg) => { ta += th * .7 * fy; tx += Math.cos(ta) * seg * s; ty += Math.sin(ta) * seg * s; tp.push(`${tx.toFixed(1)},${ty.toFixed(1)}`); });
  const deg = (h.a * 180) / Math.PI;
  return (
    <g key={key} transform={`translate(${h.x} ${h.y}) rotate(${deg})`}>
      {sl > 0 ? (
        <>
          <path d={`M${-sl * s},${-.2 * s}L${-.1 * s},${-.19 * s}Q${-.02 * s},${0} ${-.1 * s},${.19 * s}L${-sl * s},${.2 * s}Z`} fill={color} />
        </>
      ) : null}
      <path d={`M${-.14 * s},${-.12 * s}Q${.18 * s},${-.2 * s} ${.43 * s},${-.15 * s}L${.45 * s},${.14 * s}Q${.18 * s},${.2 * s} ${-.14 * s},${.12 * s}Z`} fill={color} />
      {fingers}
      <polyline points={tp.join(" ")} fill="none" stroke={color} strokeWidth={.09 * s} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/** 손 하나(소매 포함). rim은 빛이 오는 쪽(화면 단위 벡터)으로 테두리를 밝힌다 */
export const Hand: React.FC<HandSpec & { color: string; rim?: { dx: number; dy: number; color: string; w?: number; opacity?: number } }> = ({ color, rim, ...h }) => {
  const w = (rim?.w ?? .018) * h.s;
  return (
    <g>
      {rim && (rim.opacity ?? 1) > .01 ? (
        <g opacity={rim.opacity ?? 1}>
          <g transform={`translate(${rim.dx * w} ${rim.dy * w})`}>{handShape(h, rim.color, "r")}</g>
        </g>
      ) : null}
      {handShape(h, color, "b")}
    </g>
  );
};

/* ───────────── 내려다본 골목(48번) ───────────── */

/**
 * 카메라가 골목 위에서 아래를 본다. 세계 단위: 골목 너비 1(X -0.5..0.5), 지붕 Z=1, 길바닥 Z=zs.
 * 투영: 화면 x = cx + X·F/Z, y = cy + Y·F/Z + (Z-1)·skew. 양쪽 벽에 창이 줄지어 있고, 같은 높이에 마주 보는 두 창이 켜져 있다.
 */
export const AlleyView: React.FC<{ cx: number; cy: number; F: number; zs?: number; skew?: number; k: Key; t: number; seed?: number; wind?: number; lit?: number }> = ({ cx, cy, F, zs = 2.9, skew = 120, k, t, seed = 48, wind = .5, lit = 1 }) => {
  const id = useUid("al");
  const P = (X: number, Y: number, Z: number) => [cx + (X * F) / Z, cy + (Y * F) / Z + (Z - 1) * skew] as const;
  const poly = (pts: (readonly [number, number])[]) => "M" + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("L") + "Z";
  const YM = 5;
  const wallL = poly([P(-.5, -YM, 1), P(-.5, YM, 1), P(-.5, YM, zs), P(-.5, -YM, zs)]);
  const wallR = poly([P(.5, -YM, 1), P(.5, YM, 1), P(.5, YM, zs), P(.5, -YM, zs)]);
  const street = poly([P(-.5, -YM, zs), P(.5, -YM, zs), P(.5, YM, zs), P(-.5, YM, zs)]);
  const roofL = poly([P(-6, -YM, 1), P(-.5, -YM, 1), P(-.5, YM, 1), P(-6, YM, 1)]);
  const roofR = poly([P(.5, -YM, 1), P(6, -YM, 1), P(6, YM, 1), P(.5, YM, 1)]);
  const wallDark = mixhex(k.sil, k.silFar, .55), wallLit = mixhex(k.silFar, k.fog, .45);
  const roofC = mixhex(k.silFar, k.fog, .25);
  // 창: 층(Z)과 칸(Y)
  const floors = [1.18, 1.46, 1.74, 2.02, 2.3, 2.58];
  const special = 1; // 마주 보는 두 창이 있는 층
  const wins: React.ReactNode[] = [];
  for (const side of [-1, 1]) {
    floors.forEach((z0, fi) => {
      const z1 = z0 + .16;
      for (let j = -9; j <= 9; j++) {
        const y0 = j * .62 - .14, y1 = y0 + .28;
        const isSp = fi === special && j === 0;
        const r = rnd(seed + (side > 0 ? 7 : 0), fi * 40 + j + 20);
        const pts = [P(side * .5, y0, z0), P(side * .5, y1, z0), P(side * .5, y1, z1), P(side * .5, y0, z1)];
        let fill = mixhex(k.sil, "#1a2140", .5), op = 1;
        if (isSp) { fill = k.win; }
        else if (r < .1) { fill = k.win; op = .55; }
        else if (r < .16) { fill = k.cold; op = .45 + .25 * Math.sin(t * 6 + j); }
        wins.push(<path key={`${side}-${fi}-${j}`} d={poly(pts)} fill={fill} opacity={op * (isSp ? lit : 1)} />);
      }
    });
  }
  // 두 창의 빛과 커튼(창에서 골목 쪽으로 부푼다)
  const zA = floors[special], zB = zA + .16;
  const sp = [-1, 1].map((side) => {
    const c = P(side * .5, 0, (zA + zB) / 2);
    const bul = .1 + .05 * Math.sin(t * 2.6 + side) * wind + .04 * wind;
    const cur = poly([P(side * .5, .02, zA), P(side * (.5 - bul), .05 + .03 * Math.sin(t * 3 + side), zA + .05), P(side * (.5 - bul * .8), .12, zB - .02), P(side * .5, .12, zB)]);
    const sill = poly([P(side * .5, -.18, zB + .005), P(side * (.5 - .04), -.18, zB + .005), P(side * (.5 - .04), .18, zB + .005), P(side * .5, .18, zB + .005)]);
    // 창에서 골목으로 쏟아지는 빛(바닥 쪽으로)
    const spill = poly([P(side * .5, -.16, zA), P(side * .5, .16, zA), P(side * .05, .45, zs), P(side * .05, -.45, zs)]);
    return (
      <g key={side}>
        <path d={spill} fill={k.win} opacity={.08 * lit} />
        <Glow x={c[0]} y={c[1]} r={F * .16} color={k.win} opacity={.55 * lit} />
        <path d={sill} fill={wallDark} />
        <path d={cur} fill={mixhex(k.win, "#fff2dc", .55)} opacity={.9 * lit} />
      </g>
    );
  });
  // 지붕 소품(물탱크·실외기): 지붕 위 조금 떠 있는 상자
  const props = Array.from({ length: 14 }, (_, i) => {
    const side = i % 2 ? 1 : -1;
    const X = side * (.75 + rnd(seed, i + 300) * 1.4), Y = (rnd(seed, i + 320) - .5) * 4;
    const w = .18 + rnd(seed, i + 340) * .28, hgt = .14 + rnd(seed, i + 360) * .2;
    const z = .985;
    const a = P(X, Y, z), b = P(X + w, Y + hgt, z);
    const a1 = P(X, Y, 1), b1 = P(X + w, Y + hgt, 1);
    return (
      <g key={"p" + i}>
        <rect x={Math.min(a1[0], b1[0])} y={Math.min(a1[1], b1[1])} width={Math.abs(b1[0] - a1[0])} height={Math.abs(b1[1] - a1[1])} fill={k.sil} opacity={.5} />
        <rect x={Math.min(a[0], b[0])} y={Math.min(a[1], b[1])} width={Math.abs(b[0] - a[0])} height={Math.abs(b[1] - a[1])} fill={mixhex(roofC, k.fog, .3)} />
      </g>
    );
  });
  const lamps = [-1.6, .9, 2.6].map((Y, i) => {
    const p = P(i % 2 ? .38 : -.38, Y, zs - .02);
    return <Glow key={"l" + i} x={p[0]} y={p[1]} r={F * .07} color={k.win} opacity={.7} />;
  });
  const e1 = P(-.5, 0, 1), e2 = P(-.5, 0, zs);
  return (
    <g>
      <defs>
        <linearGradient id={id + "l"} x1={e1[0]} y1="0" x2={e2[0]} y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={mixhex(wallDark, k.fog, .25)} />
          <stop offset="100%" stopColor={k.sil} />
        </linearGradient>
        <linearGradient id={id + "r"} x1={2 * cx - e1[0]} y1="0" x2={2 * cx - e2[0]} y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={wallLit} />
          <stop offset="100%" stopColor={mixhex(k.sil, wallDark, .5)} />
        </linearGradient>
      </defs>
      <path d={street} fill={k.sil} />
      {lamps}
      <path d={wallL} fill={`url(#${id}l)`} />
      <path d={wallR} fill={`url(#${id}r)`} />
      {wins}
      {sp}
      <path d={roofL} fill={roofC} />
      <path d={roofR} fill={mixhex(roofC, k.fog, .2)} />
      {props}
      {/* 지붕 끝 난간: 달빛이 닿는 얇은 선 */}
      <path d={`M${P(-.5, -YM, 1).join(",")}L${P(-.5, YM, 1).join(",")}`} stroke={mixhex(k.fog, k.moon, .3)} strokeWidth={F * .012} opacity={.6} />
      <path d={`M${P(.5, -YM, 1).join(",")}L${P(.5, YM, 1).join(",")}`} stroke={mixhex(k.fog, k.moon, .5)} strokeWidth={F * .014} opacity={.8} />
    </g>
  );
};

/* ───────────── 흐르는 줄·비 ───────────── */

/**
 * 한 방향으로 흐르는 줄(빠른 낙하 때의 비, 속도선). 화면 영역(x0..x1, y0..y1)을 감싸 돈다.
 * dir: 흐르는 방향(rad, 화면). speed px/s. len 줄 길이.
 */
export const Streaks: React.FC<{ seed?: number; t: number; count?: number; dir?: number; speed?: number; len?: number; width?: number; color?: string; opacity?: number; x0?: number; x1?: number; y0?: number; y1?: number }> = ({ seed = 7, t, count = 120, dir = -Math.PI / 2, speed = 3000, len = 160, width = 2, color = "#cfe6ee", opacity = .4, x0 = -200, x1 = 2120, y0 = -200, y1 = 1280 }) => {
  const W = x1 - x0, H = y1 - y0;
  const dx = Math.cos(dir), dy = Math.sin(dir);
  return (
    <g stroke={color} strokeLinecap="round" opacity={opacity}>
      {Array.from({ length: count }, (_, i) => {
        const sp = speed * (.75 + rnd(seed, i) * .5);
        const px = x0 + (((rnd(seed, i + 100) * W + dx * t * sp) % W) + W) % W;
        const py = y0 + (((rnd(seed, i + 200) * H + dy * t * sp) % H) + H) % H;
        const l = len * (.5 + rnd(seed, i + 300));
        return <line key={i} x1={px} y1={py} x2={px - dx * l} y2={py - dy * l} strokeWidth={width * (.5 + rnd(seed, i + 400))} opacity={.35 + rnd(seed, i + 500) * .65} />;
      })}
    </g>
  );
};

/** 소실점(vx, vy)으로 빨려 들어가는 비. 위에서 내려다볼 때 떨어지는 빗줄기 */
export const RadialRain: React.FC<{ seed?: number; t: number; vx: number; vy: number; count?: number; speed?: number; rmax?: number; color?: string; opacity?: number; width?: number }> = ({ seed = 11, t, vx, vy, count = 160, speed = .9, rmax = 1400, color = "#cfe6ee", opacity = .45, width = 2 }) => (
  <g stroke={color} strokeLinecap="round" opacity={opacity}>
    {Array.from({ length: count }, (_, i) => {
      const th = rnd(seed, i) * TAU;
      const u = ((rnd(seed, i + 50) + t * speed * (.7 + rnd(seed, i + 70) * .6)) % 1);
      const r = rmax * Math.pow(1 - u, 1.8) + 30;
      const l = r * .22;
      const cx = Math.cos(th), cy = Math.sin(th);
      const w = width * (.4 + r / rmax * 1.6);
      return <line key={i} x1={vx + cx * r} y1={vy + cy * r} x2={vx + cx * (r + l)} y2={vy + cy * (r + l)} strokeWidth={w} opacity={clamp(u * 4) * (.4 + rnd(seed, i + 90) * .6)} />;
    })}
  </g>
);
