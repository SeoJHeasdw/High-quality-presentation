/**
 * 4막 전용 재료. 키트(src/lib)에 없는 것만 여기서 만든다.
 *   lerpKey      두 컬러 키 사이 보간(50번: 은빛 → 폭풍)
 *   CloudMass    올라앉을 수 있는 구름 섬(평평하고 울퉁불퉁한 윗면, 둥근 끝, 아래로 녹아드는 몸)
 *   Heap         뭉게구름 더미(둥근 더미·적란운 탑·징검돌). 덩이마다 위가 밝고, 속에서 번개가 번쩍일 수 있다. HeapRow는 한 줄
 *   Vapor        착지·충격 때 피어오르는 구름 김
 *   Hand         클로즈업 손(손목·손바닥·손가락 넷·엄지, 소매). 굽힘(curl)으로 갈고리 → 펼침
 *   AlleyView    높은 곳에서 내려다본 좁은 골목. 마주 보는 두 창(48번)
 *   TopPuffs     위에서 내려다본 구름 윗면 덩이 · PovLegs 시점 컷에서 화면 아래로 늘어진 두 다리
 *   Streaks      한 방향으로 흐르는 줄(빠른 낙하의 비·속도선)
 *   RadialRain   소실점으로 빨려 들어가는 비(위에서 내려다본 낙하, 54번)
 */
import React from "react";
import { useUid } from "../lib/camera";
import { TAU, clamp, ease, mix, mixc, mixhex, n2, rnd } from "../lib/math";
import type { Key } from "../lib/palette";
import { Glow } from "../lib/sky";

/** hex든 rgb(...)든 받아 hex로 */
export const toHex = (c: string) => c.startsWith("#") ? c : "#" + (c.match(/\d+(\.\d+)?/g) ?? ["0", "0", "0"]).slice(0, 3).map((v) => Math.round(+v).toString(16).padStart(2, "0")).join("");
/** 색 섞기(hex·rgb 모두) */
export const mx = (a: string, b: string, w: number) => mixc(toHex(a), toHex(b), w);

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
  const L = ends.includes("L"), R = ends.includes("R");
  const top: Puff[] = [];
  const n = Math.max(3, Math.round((x1 - x0) / 120));
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const r = (50 + rnd(seed, i) * 60) * bump;
    top.push({ x: mix(x0, x1, u) + (rnd(seed, i + 50) - .5) * 50, y: y + r * .78 + n2(seed, i * .7 + t * .12) * 3, r });
  }
  // 둥근 끝: 윗면 끝에서 아래 안쪽으로 파고드는 곡선(걸터앉은 다리가 허공에 뜬다). 곡선을 따라 덩이를 붙인다
  const cut = 260 * bump;
  const endCurve = (x: number, dir: number) => (u: number) => {
    const a = { x, y: y + 15 }, c1 = { x: x + dir * 45, y: y + depth * .35 }, c2 = { x: x - dir * 110, y: y + depth * .8 }, b = { x: x - dir * cut, y: y + depth };
    const m = 1 - u;
    return { x: m * m * m * a.x + 3 * m * m * u * c1.x + 3 * m * u * u * c2.x + u * u * u * b.x, y: m * m * m * a.y + 3 * m * m * u * c1.y + 3 * m * u * u * c2.y + u * u * u * b.y };
  };
  const side: Puff[] = [];
  const lumps = (x: number, dir: number) => {
    const f = endCurve(x, dir);
    for (let j = 0; j < 6; j++) {
      const u = .06 + j * .14;
      const q = f(u);
      const r = (55 + u * 70 + rnd(seed, 100 + j + (dir > 0 ? 20 : 0)) * 30) * bump;
      side.push({ x: q.x - dir * r * .55, y: q.y + r * .2, r });
    }
  };
  if (L) lumps(x0, -1);
  if (R) lumps(x1, 1);
  const bx0 = L ? x0 : x0 - 800, bx1 = R ? x1 : x1 + 800;
  const curveD = (x: number, dir: number, rev: boolean) => {
    const f = endCurve(x, dir);
    const pts = Array.from({ length: 9 }, (_, i) => f(i / 8));
    return (rev ? pts.reverse() : pts).map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("");
  };
  const body = `M${bx0},${y + 15}L${bx1},${y + 15}` + (R ? curveD(x1, 1, false) : `L${bx1},${y + depth}`) + (L ? curveD(x0, -1, true) : `L${bx0},${y + depth}`) + "Z";
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1={y - 90} x2="0" y2={y + depth} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={lit} />
          <stop offset="20%" stopColor={mx(lit, dark, .45)} />
          <stop offset="55%" stopColor={dark} />
          <stop offset="100%" stopColor={dark} stopOpacity={fade ? 0 : 1} />
        </linearGradient>
      </defs>
      {rim ? top.map((p, i) => <circle key={"r" + i} cx={p.x} cy={p.y - 4} r={p.r + 4} fill={rim} opacity={.45} />) : null}
      <path d={body} fill={`url(#${id})`} />
      {side.map((p, i) => <circle key={"s" + i} cx={p.x} cy={p.y} r={p.r} fill={`url(#${id})`} />)}
      {top.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={`url(#${id})`} />)}
      {sheen > 0 ? <Glow x={(x0 + x1) / 2} y={y + 10} r={60} rx={(x1 - x0) * .55} ry={70} color={lit} opacity={sheen} /> : null}
    </g>
  );
};

/**
 * 뭉게구름 더미. 덩이마다 빛 쪽(왼쪽 위)이 밝고 아래가 어둡다. 위 덩이를 먼저, 아래 덩이를 나중에 그려
 * 아래 덩이의 밝은 머리가 위 덩이의 그늘을 덮는다(콜리플라워 결).
 *   shape "mound" 둥근 더미 / "tower" 적란운(넓은 밑동·좁은 몸·퍼지는 모루) / "stone" 납작한 징검돌
 *   (x, y)는 밑동 가운데. flash 0..1이면 속(fx, fy: 0..1)에서 빛이 번진다
 */
export const Heap: React.FC<{
  seed: number; x: number; y: number; w: number; h: number; lit: string; dark: string; mid?: string;
  shape?: "mound" | "tower" | "stone"; n?: number; t?: number; churn?: number; light?: number;
  flash?: number; flashColor?: string; fx?: number; fy?: number; edge?: string; opacity?: number; press?: number; base?: boolean; puff?: number;
}> = ({ seed, x, y, w, h, lit, dark, mid, shape = "mound", n, t = 0, churn = 1, light = .38, flash = 0, flashColor = "#dff4ff", fx = .5, fy = .45, edge, opacity = 1, press = 0, base, puff = 1 }) => {
  const id = useUid("hp");
  const N = n ?? (shape === "tower" ? 56 : shape === "stone" ? 9 : 20);
  const prof = (v: number) => shape === "tower" ? .5 + .5 * Math.pow(1 - v, 2) + .6 * Math.pow(clamp((v - .66) / .34), 1.4) : shape === "stone" ? Math.sqrt(clamp(1 - v * v * .6)) : Math.sqrt(clamp(1 - v * v));
  const sq = 1 - press * .14;
  const puffs = Array.from({ length: N }, (_, i) => {
    const v = shape === "stone" ? rnd(seed, i) * .6 : Math.pow(rnd(seed, i), shape === "tower" ? .9 : .75);
    const half = w * .5 * prof(v);
    const anvil = shape === "tower" && v > .72;
    const px = x + (rnd(seed, i + 300) * 2 - 1) * half * .82 + n2(seed + i, t * .15 * churn) * h * .015 + (anvil ? (v - .72) * w * .5 : 0);
    const rr = puff * (shape === "tower" ? h * (anvil ? .06 + rnd(seed, i + 600) * .05 : .1 + rnd(seed, i + 600) * .08) : h * (.28 + rnd(seed, i + 600) * .2)) * (1 - .35 * Math.abs(px - x) / (w * .5 + 1));
    const hv = shape === "tower" ? (v < .72 ? v : .72 + (v - .72) * .4) * .95 : v * .75;
    const py = y - hv * h * sq + rr * .5 + n2(seed + i * 3, t * .2 * churn + 5) * rr * .06;
    return { x: px, y: py, r: rr * (1 + press * .05) };
  }).sort((a, b) => a.y - a.r - (b.y - b.r));
  const gx = x + (fx - .5) * w * .7, gy = y - fy * h;
  // 높이 띠 넷: 위 덩이일수록 밝다. 덩이 안의 결은 약하게(공처럼 보이지 않게)
  const NB = 4;
  const md = mid ?? mx(lit, dark, .5);
  const band = (p: { y: number; r: number }) => Math.min(NB - 1, Math.max(0, Math.floor(clamp((y - (p.y - p.r)) / (h * .95)) * NB)));
  const cols = Array.from({ length: NB }, (_, j) => {
    const u = (j + 1) / NB;
    const top = u > .5 ? mx(md, lit, (u - .5) * 2) : mx(dark, md, u * 2);
    const v = j / NB;
    const bot = v > .5 ? mx(md, lit, (v - .5) * 1.2) : mx(dark, md, v * 1.6);
    return { top, bot };
  });
  return (
    <g opacity={opacity}>
      <defs>
        {cols.map((c, j) => (
          <radialGradient key={j} id={`${id}b${j}`} cx={light} cy=".12" r="1.05">
            <stop offset="0%" stopColor={c.top} />
            <stop offset="55%" stopColor={c.top} />
            <stop offset="100%" stopColor={c.bot} />
          </radialGradient>
        ))}
      </defs>
      {edge ? puffs.map((p, i) => <circle key={"e" + i} cx={p.x - 3} cy={p.y - 4} r={p.r + 3} fill={edge} opacity={.55} />) : null}
      {(base ?? shape !== "stone") ? <ellipse cx={x} cy={y - h * .12} rx={w * .4} ry={h * .16} fill={dark} /> : null}
      {puffs.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={`url(#${id}b${band(p)})`} />)}
      {flash > .01 ? (
        <g style={{ mixBlendMode: "screen" }}>
          <Glow x={gx} y={gy} r={h * .5} rx={w * .42} ry={h * .48} color={flashColor} opacity={flash * .7} />
          <Glow x={gx} y={gy} r={h * .16} color="#ffffff" opacity={flash * .5} />
          {puffs.filter((_, i) => rnd(seed + 3, i) > .5).map((p, i) => {
            const dd = Math.hypot(p.x - gx, p.y - gy) / (Math.max(w, h) * .55);
            return <circle key={"f" + i} cx={p.x} cy={p.y - p.r * .2} r={p.r * .8} fill={flashColor} opacity={flash * .3 * clamp(1 - dd)} />;
          })}
        </g>
      ) : null}
    </g>
  );
};

/** 더미 여러 개를 한 줄로(구름 바다). size는 더미 너비, y는 밑동 */
export const HeapRow: React.FC<{ seed: number; y: number; x0: number; x1: number; size: number; count: number; lit: string; dark: string; mid?: string; t?: number; drift?: number; edge?: string; flash?: number; flashColor?: string; light?: number; hk?: number; n?: number }> = ({ seed, y, x0, x1, size, count, lit, dark, mid, t = 0, drift = 0, edge, flash = 0, flashColor, light, hk = .5, n }) => (
  <g>
    {Array.from({ length: count }, (_, i) => {
      const u = (i + rnd(seed, i) * .7) / count;
      const w = size * (.7 + rnd(seed, i + 10) * .7);
      return <Heap key={i} seed={seed * 37 + i} x={mix(x0, x1, u) + drift * t * (.6 + rnd(seed, i + 30))} y={y + (rnd(seed, i + 20) - .5) * size * .15} w={w} h={w * hk * (.75 + rnd(seed, i + 40) * .5)} lit={lit} dark={dark} mid={mid} t={t} edge={edge} flash={flash * rnd(seed, i + 50)} flashColor={flashColor} light={light} n={n} />;
    })}
  </g>
);

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
  const roofC = mixhex(k.sil, k.silFar, .7);
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
    return (
      <g key={side}>
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

/** 위에서 내려다본 구름 윗면: 가운데가 밝고 가장자리가 어두운 덩이들(빛이 위에서). pts는 덩이 중심·반지름 */
export const TopPuffs: React.FC<{ pts: { x: number; y: number; r: number }[]; lit: string; dark: string; cx?: number; cy?: number; soft?: boolean; opacity?: number }> = ({ pts, lit, dark, cx = .45, cy = .4, soft = false, opacity = 1 }) => {
  const id = useUid("tp");
  return (
    <g>
      <defs>
        <radialGradient id={id} cx={cx} cy={cy} r=".7">
          <stop offset="0%" stopColor={lit} />
          <stop offset="65%" stopColor={mx(lit, dark, .45)} stopOpacity={soft ? .5 : 1} />
          <stop offset="100%" stopColor={dark} stopOpacity={soft ? 0 : 1} />
        </radialGradient>
      </defs>
      <g opacity={opacity}>{pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={`url(#${id})`} />)}</g>
    </g>
  );
};

/** 시점 컷의 다리 한 쌍: 화면 아래 가장자리(bx, by)에서 발끝(fx, fy) 쪽으로 뻗은 두 다리와 신발 */
export const PovLegs: React.FC<{ bx: number; by: number; fx: number; fy: number; w: number; color: string; rim: string; t: number; ph?: number; spread?: number }> = ({ bx, by, fx, fy, w, color, rim, t, ph = 0, spread = 1 }) => {
  const leg = (side: number, key: string, col: string, ox = 0, oy = 0) => {
    const sw = Math.sin(t * 3.2 + ph + (side > 0 ? 2.3 : 0));
    const x0 = bx + side * w * .75 * spread, y0 = by;
    const x1 = fx + side * w * .6 * spread + sw * 6, y1 = fy + sw * 34;
    const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a), ny = Math.cos(a);
    const w0 = w * .62, w1 = w * .4;
    const d = `M${x0 + nx * w0},${y0 + ny * w0}L${x1 + nx * w1},${y1 + ny * w1}L${x1 - nx * w1},${y1 - ny * w1}L${x0 - nx * w0},${y0 - ny * w0}Z`;
    const deg = (a * 180) / Math.PI;
    return (
      <g key={key} transform={`translate(${ox} ${oy})`}>
        <path d={d} fill={col} />
        <ellipse cx={x1 + Math.cos(a) * w * .35} cy={y1 + Math.sin(a) * w * .35} rx={w * .78} ry={w * .55} fill={col} transform={`rotate(${deg} ${x1 + Math.cos(a) * w * .35} ${y1 + Math.sin(a) * w * .35})`} />
      </g>
    );
  };
  return (
    <g>
      {leg(-1, "rl", rim, -5, -4)}{leg(1, "rr", rim, -5, -4)}
      {leg(-1, "l", color)}{leg(1, "r", color)}
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
