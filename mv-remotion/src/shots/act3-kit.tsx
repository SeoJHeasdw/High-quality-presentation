/**
 * 3막 전용 재료 — 공용 키트에 없는 것만 여기서 만든다.
 *   mixKey      두 컬러 키를 섞는다(후렴 → 은빛)
 *   Lit         아무 실루엣 도형에 테두리 빛(rim)과 번지는 빛(spill)을 얹는다(Kid의 rim과 같은 방식)
 *   handGeo     ECU용 큰 손(손목·손바닥·손가락 네 개·엄지). curl로 쥐고, flip으로 손바닥 방향을 뒤집는다
 *   ladder*     나방 사다리(난간 둘 + 발판마다 나방 한 마리)와 그것이 풀려 소용돌이치는 나방
 *   CityCarpet  아주 높은 곳에서 내려다본 도시 불빛(지평선으로 모이는 대로·골목의 점 불빛)
 *   Bokeh       초점 밖 불빛 원판(CSS 흐림 없이 원판으로 그린다)
 *   LonelyWin   폰 빛에 갇힌 실루엣이 있는 창 하나
 *   Speed       속도선(앞을 스치는 가는 빛줄기)
 */
import React from "react";
import { useUid } from "../lib/camera";
import type { Key } from "../lib/palette";
import { TAU, alpha, clamp, ease, mix, mixhex, n2, rnd, smooth } from "../lib/math";
import { Glow } from "../lib/sky";
import { WindowFrame } from "../lib/city";
import type { M } from "../lib/moths";
import { Kid } from "../kid/rig";
import { P, lerpPose, pose, type Pose } from "../kid/pose";

export const GOLD = "#ffc45a";
export const GOLD_CORE = "#fff3c8";
export const THREAD = "#ffd27a";
/** 얼굴에 떨어지는 금빛(나방·달) */
export const WARM = "#ffd690";

export function mixKey(a: Key, b: Key, w: number): Key {
  const out: Record<string, unknown> = {};
  for (const name of Object.keys(a) as (keyof Key)[]) {
    const va = a[name], vb = b[name];
    if (Array.isArray(va)) out[name] = (va as string[]).map((c, i) => mixhex(c, (vb as string[])[i], w));
    else out[name] = mixhex(va as string, vb as string, w);
  }
  return out as Key;
}

// ───────────────────────────── 테두리 빛 도형 ─────────────────────────────

export type RimL = { dx: number; dy: number; color: string; width: number; glow?: number; opacity?: number };
export type Spill = { x: number; y: number; r: number; color: string; a: number };

/** draw(색)으로 그린 실루엣 + 빛 쪽 가장자리 테두리 빛 + 도형 안에만 번지는 빛 */
export const Lit: React.FC<{ draw: (c: string) => React.ReactNode; fill: string; rims?: RimL[]; spill?: Spill[]; blurPx?: number }> = ({ draw, fill, rims = [], spill = [], blurPx = 5 }) => {
  const id = useUid("lit");
  const big = { x: -5000, y: -5000, width: 12000, height: 12000 };
  const sp = spill.filter((s) => s.a > .004);
  const rs = rims.filter((r) => (r.opacity ?? 1) > .004);
  return (
    <g>
      <defs>
        <filter id={id + "b"} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={blurPx} /></filter>
        {sp.length ? <mask id={id + "s"} maskUnits="userSpaceOnUse" {...big}>{draw("#fff")}</mask> : null}
        {sp.map((s, i) => (
          <radialGradient key={i} id={`${id}g${i}`} cx={s.x} cy={s.y} r={s.r} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={s.color} stopOpacity={1} />
            <stop offset="40%" stopColor={s.color} stopOpacity={.5} />
            <stop offset="100%" stopColor={s.color} stopOpacity={0} />
          </radialGradient>
        ))}
        {rs.map((r, i) => {
          const L = Math.hypot(r.dx, r.dy) || 1;
          return (
            <mask key={i} id={`${id}r${i}`} maskUnits="userSpaceOnUse" {...big}>
              {draw("#fff")}
              <g transform={`translate(${((-r.dx / L) * r.width).toFixed(2)} ${((-r.dy / L) * r.width).toFixed(2)})`}>{draw("#000")}</g>
            </mask>
          );
        })}
      </defs>
      {draw(fill)}
      {sp.map((s, i) => <rect key={"s" + i} x={s.x - s.r} y={s.y - s.r} width={s.r * 2} height={s.r * 2} fill={`url(#${id}g${i})`} opacity={clamp(s.a)} mask={`url(#${id}s)`} />)}
      {rs.map((r, i) => (
        <g key={"r" + i} opacity={r.opacity ?? 1}>
          {(r.glow ?? 0) > 0 ? <g filter={`url(#${id}b)`} opacity={r.glow}><g mask={`url(#${id}r${i})`}>{draw(r.color)}</g></g> : null}
          <g mask={`url(#${id}r${i})`}>{draw(r.color)}</g>
        </g>
      ))}
    </g>
  );
};

// ───────────────────────────── 큰 손 ─────────────────────────────
// 손 좌표: 손목 (0,0), 손끝 방향 +x, 손바닥 쪽 +y. 단위 = 손바닥 길이 s(px).
// 검지가 -y(손등 쪽 위), 새끼가 +y. curl은 손가락을 손바닥 쪽(+y)으로 감는다.

type Finger = { bx: number; by: number; a0: number; as: number; len: [number, number, number]; w: number; relax: [number, number, number] };
const FINGERS: Finger[] = [
  { bx: .9, by: -.28, a0: -.1, as: -.2, len: [.38, .24, .18], w: .25, relax: [.06, .12, .08] },
  { bx: .97, by: -.09, a0: -.02, as: -.06, len: [.42, .26, .19], w: .26, relax: [.1, .16, .1] },
  { bx: .94, by: .1, a0: .06, as: .09, len: [.39, .24, .18], w: .245, relax: [.13, .2, .12] },
  { bx: .86, by: .27, a0: .14, as: .22, len: [.3, .19, .15], w: .215, relax: [.16, .22, .14] },
];
const CURLK: [number, number, number] = [1.25, 1.55, 1.05];

export type HandSpec = {
  x: number; y: number; ang: number; s: number;
  /** 1: 손바닥 쪽이 손끝 방향의 오른쪽(시계 방향) / -1: 반대. 0 근처면 옆에서 본 손(얇아진다) */
  flip?: number;
  curl?: number | number[];
  spread?: number;
  thumb?: number;
  /** 소매 길이(손바닥 길이 단위) */
  sleeve?: number;
  sleeveW?: number;
};

type V = { x: number; y: number };
export function handGeo(h: HandSpec) {
  const fl = h.flip ?? 1, ca = Math.cos(h.ang), sa = Math.sin(h.ang), s = h.s;
  const W = (x: number, y: number): V => ({ x: h.x + (x * ca - y * fl * sa) * s, y: h.y + (x * sa + y * fl * ca) * s });
  const cu = h.curl ?? 0;
  const curls = typeof cu === "number" ? [cu, cu, cu, cu] : cu;
  const sp = h.spread ?? .3;
  const fingers = FINGERS.map((F, i) => {
    let a = F.a0 + F.as * sp, x = F.bx, y = F.by;
    const pts: V[] = [W(x, y)];
    for (let j = 0; j < 3; j++) {
      a += F.relax[j] + curls[i] * CURLK[j];
      x += Math.cos(a) * F.len[j]; y += Math.sin(a) * F.len[j];
      pts.push(W(x, y));
    }
    return { pts, w: F.w * s };
  });
  const tc = h.thumb ?? 0;
  let ta = .95 - .35 * sp, tx = .22, ty = .22;
  const tpts: V[] = [W(tx, ty)];
  const TL = [.28, .22, .18], TK = [.45, .6, .5];
  for (let j = 0; j < 3; j++) { ta += -.16 - tc * TK[j]; tx += Math.cos(ta) * TL[j]; ty += Math.sin(ta) * TL[j]; tpts.push(W(tx, ty)); }
  const sl = h.sleeve ?? 3, sw = h.sleeveW ?? .5;
  const palm = [W(-.04, -.3), W(.45, -.4), W(.9, -.38), W(1.0, -.12), W(.97, .14), W(.86, .34), W(.45, .4), W(-.04, .3)];
  const sleeve = [W(-sl, -sw * 1.05), W(-.02, -sw * .9), W(-.02, sw * .9), W(-sl, sw * 1.05)];
  const cuff = [W(-.22, -sw * 1.06), W(-.04, -sw * 1.03), W(-.04, sw * 1.03), W(-.22, sw * 1.06)];
  const poly = (pts: V[]) => "M" + pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("L") + "Z";
  const chain = (pts: V[], w: number, c: string, key: string) => (
    <g key={key} stroke={c} strokeLinecap="round" fill="none">
      {[0, 1, 2].map((j) => <line key={j} x1={pts[j].x} y1={pts[j].y} x2={pts[j + 1].x} y2={pts[j + 1].y} strokeWidth={w * [1, .93, .86][j]} />)}
    </g>
  );
  /** part: all | base(소매·손바닥·엄지) | fingers */
  const draw = (c: string, part: "all" | "base" | "fingers" = "all") => (
    <g>
      {part !== "fingers" ? (
        <>
          <path d={poly(sleeve)} fill={c} />
          <path d={poly(cuff)} fill={c} />
          <path d={poly(palm)} fill={c} stroke={c} strokeWidth={s * .14} strokeLinejoin="round" />
          {chain(tpts, s * .28, c, "th")}
        </>
      ) : null}
      {part !== "base" ? fingers.map((f, i) => chain(f.pts, f.w, c, "f" + i)).reverse() : null}
    </g>
  );
  return { draw, fingers, thumb: tpts, tip: (i: number) => fingers[i].pts[3], palm: W(.5, 0), knuckle: W(.95, 0), W };
}

// ───────────────────────────── 나방 사다리 ─────────────────────────────

export type Ladder = { x0: number; y0: number; x1: number; y1: number; w: number; n: number };
/** 사다리 위 비율 u(0 아래 … 1 꼭대기)의 가운데 점과 가로 방향 */
export function ladderAt(L: Ladder, u: number) {
  const x = mix(L.x0, L.x1, u), y = mix(L.y0, L.y1, u);
  const dx = L.x1 - L.x0, dy = L.y1 - L.y0, l = Math.hypot(dx, dy) || 1;
  return { x, y, nx: -dy / l, ny: dx / l, tx: dx / l, ty: dy / l };
}
/** 발판 i의 나방(제자리에서 날개만 떤다). 사다리는 원근으로 위로 갈수록 좁아질 수 있다(taper) */
export function rungMoth(L: Ladder, i: number, t: number, taper = 1): M {
  const u = (i + .5) / L.n;
  const p = ladderAt(L, u);
  const w = L.w * mix(1, taper, u);
  return { x: p.x, y: p.y, s: w * .3, a: Math.atan2(p.ny, p.nx) + Math.PI / 2, f: t * 5 + i * 1.7, b: .85 + .15 * Math.sin(t * 4 + i) };
}
export const LadderRails: React.FC<{ L: Ladder; opacity?: number; taper?: number; rungs?: (i: number) => number; width?: number }> = ({ L, opacity = 1, taper = 1, rungs, width = 3 }) => {
  const a = ladderAt(L, 0), b = ladderAt(L, 1);
  const wb = L.w / 2, wt = (L.w * taper) / 2;
  const rail = (side: number) => `M${a.x + a.nx * wb * side},${a.y + a.ny * wb * side}L${b.x + b.nx * wt * side},${b.y + b.ny * wt * side}`;
  return (
    <g opacity={opacity} fill="none" strokeLinecap="round">
      {[-1, 1].map((sd) => (
        <g key={sd}>
          <path d={rail(sd)} stroke={GOLD} strokeWidth={width * 7} strokeOpacity={.1} />
          <path d={rail(sd)} stroke={GOLD} strokeWidth={width * 2.6} strokeOpacity={.3} />
          <path d={rail(sd)} stroke={GOLD_CORE} strokeWidth={width} />
        </g>
      ))}
      {Array.from({ length: L.n }, (_, i) => {
        const o = rungs ? rungs(i) : 1;
        if (o <= .01) return null;
        const u = (i + .5) / L.n;
        const p = ladderAt(L, u);
        const w = (L.w * mix(1, taper, u)) / 2;
        return (
          <g key={i} opacity={o}>
            <line x1={p.x - p.nx * w} y1={p.y - p.ny * w} x2={p.x + p.nx * w} y2={p.y + p.ny * w} stroke={GOLD} strokeWidth={width * 3} strokeOpacity={.28} />
            <line x1={p.x - p.nx * w} y1={p.y - p.ny * w} x2={p.x + p.nx * w} y2={p.y + p.ny * w} stroke={GOLD_CORE} strokeWidth={width * .8} />
          </g>
        );
      })}
    </g>
  );
};

// ───────────────────────────── 높은 곳에서 본 도시 ─────────────────────────────

/** 지평선(horizon)으로 모이는 땅의 점 불빛. 대로(avenues)는 소실점으로 모이는 줄, 골목은 가로줄 */
export const CityCarpet: React.FC<{ k: Key; t: number; horizon: number; vx?: number; n?: number; seed?: number; h0?: number; width?: number; size?: number; opacity?: number; avenues?: number; ground?: boolean }> = ({ k, t, horizon, vx = 960, n = 520, seed = 11, h0 = 1500, width = 2600, size = 1, opacity = 1, avenues = 9, ground = false }) => {
  const gid = useUid("gr");
  const pts: React.ReactNode[] = [];
  const zMax = 46;
  const P = (X: number, Z: number) => ({ x: vx + (X / Z) * 1.0, y: horizon + h0 / Z });
  // 흩어진 창 불빛(덩어리지게: 잡음으로 밀도를 깎는다)
  for (let i = 0; i < n; i++) {
    const Z = 1.15 + Math.pow(rnd(seed, i), 1.7) * zMax;
    const sx = (rnd(seed, i + 3000) - .5) * width * 1.4;
    const X = sx * Z;
    const dens = n2(seed, X / 2600, Z / 5);
    if (dens < -.25) continue;
    const p = P(X, Z);
    const cold = rnd(seed, i + 6000) < .16;
    const r = (3.6 / Math.pow(Z, .62)) * size * (.6 + rnd(seed, i + 9000) * .8);
    const fade = clamp(1.25 - Z / zMax) * (cold ? .75 + .25 * Math.sin(t * (6 + rnd(seed, i) * 6) + i) : 1);
    pts.push(<circle key={i} cx={p.x} cy={p.y} r={Math.max(.7, r)} fill={cold ? k.cold : rnd(seed, i + 7000) < .2 ? k.glow : k.win} opacity={fade * (.45 + .5 * rnd(seed, i + 8000))} />);
  }
  // 대로: 소실점으로 모이는 가로등 줄
  const av: React.ReactNode[] = [];
  for (let a = 0; a < avenues; a++) {
    const X0 = (a - (avenues - 1) / 2) * 1150 + (rnd(seed, a + 400) - .5) * 400;
    for (let j = 0; j < 34; j++) {
      const Z = 1.2 + Math.pow(j / 33, 1.6) * zMax;
      const p = P(X0, Z);
      if (p.x < -400 || p.x > 2320) continue;
      const r = (2.6 / Math.pow(Z, .55)) * size;
      av.push(<circle key={`${a}-${j}`} cx={p.x} cy={p.y} r={Math.max(.6, r)} fill={k.win} opacity={clamp(1.2 - Z / zMax) * .8} />);
    }
  }
  // 골목: 깊이마다 가로로 늘어선 불빛 띠
  const rows: React.ReactNode[] = [];
  for (let j = 0; j < 9; j++) {
    const Z = 1.6 + Math.pow((j + .5) / 9, 1.5) * zMax * .8;
    const p = P(0, Z);
    rows.push(<rect key={j} x={-600} y={p.y - .6} width={3120} height={Math.max(.8, 2.4 / Math.pow(Z, .5))} fill={k.win} opacity={clamp(1.1 - Z / zMax) * .22} />);
  }
  return (
    <g opacity={opacity}>
      {ground ? (
        <>
          <defs>
            <linearGradient id={gid} x1="0" y1={horizon} x2="0" y2={horizon + 700} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={mixhex(k.fog, k.sky[3], .25)} />
              <stop offset="12%" stopColor={mixhex(k.silFar, k.fog, .4)} />
              <stop offset="100%" stopColor={mixhex(k.sil, k.silFar, .4)} />
            </linearGradient>
          </defs>
          <rect x={-3000} y={horizon} width={8000} height={3000} fill={`url(#${gid})`} />
        </>
      ) : null}
      <Glow x={vx} y={horizon + 60} r={900} rx={2000} ry={260} color={k.win} opacity={.16} />
      {rows}
      {av}
      {pts}
    </g>
  );
};

// ───────────────────────────── 보케·속도선 ─────────────────────────────

export const Bokeh: React.FC<{ seed: number; n: number; x0: number; x1: number; y0: number; y1: number; r0: number; r1: number; colors: string[]; t?: number; opacity?: number; drift?: number }> = ({ seed, n, x0, x1, y0, y1, r0, r1, colors, t = 0, opacity = 1, drift = 0 }) => (
  <g opacity={opacity}>
    {Array.from({ length: n }, (_, i) => {
      const x = mix(x0, x1, rnd(seed, i)) + drift * t * (.5 + rnd(seed, i + 50));
      const y = mix(y0, y1, rnd(seed, i + 100)) + n2(seed + i, t * .3) * 20;
      const r = mix(r0, r1, Math.pow(rnd(seed, i + 200), 1.6));
      const c = colors[Math.floor(rnd(seed, i + 300) * colors.length)];
      const a = .5 + .5 * rnd(seed, i + 400);
      return (
        <g key={i} opacity={a}>
          <circle cx={x} cy={y} r={r} fill={alpha(c, .16)} />
          <circle cx={x} cy={y} r={r * .94} fill="none" stroke={alpha(c, .32)} strokeWidth={r * .07} />
        </g>
      );
    })}
  </g>
);

/** 속도선: 방향(ux, uy)으로 스치는 가는 빛. phase는 시간×속도 */
export const Speed: React.FC<{ seed: number; n: number; phase: number; ux: number; uy: number; x0: number; x1: number; y0: number; y1: number; len: number; color: string; opacity?: number; width?: number }> = ({ seed, n, phase, ux, uy, x0, x1, y0, y1, len, color, opacity = .4, width = 2 }) => {
  const span = Math.abs(ux) > Math.abs(uy) ? x1 - x0 : y1 - y0;
  return (
    <g stroke={color} strokeLinecap="round" opacity={opacity}>
      {Array.from({ length: n }, (_, i) => {
        const along = ((rnd(seed, i) * span + phase * (.7 + rnd(seed, i + 9) * .6)) % span + span) % span;
        const across = rnd(seed, i + 30);
        const x = Math.abs(ux) > Math.abs(uy) ? x0 + along : mix(x0, x1, across);
        const y = Math.abs(ux) > Math.abs(uy) ? mix(y0, y1, across) : y0 + along;
        const l = len * (.4 + rnd(seed, i + 60));
        return <line key={i} x1={x} y1={y} x2={x - ux * l} y2={y - uy * l} strokeWidth={width * (.5 + rnd(seed, i + 90))} opacity={.3 + .7 * rnd(seed, i + 120)} />;
      })}
    </g>
  );
};

// ───────────────────────────── 외로운 창 ─────────────────────────────

const SIT: Partial<Pose> = { ...lerpPose(P.sitKnees, P.phone, .85), anchor: "feet", legN: [1.85, 2.4], legF: [1.7, 2.35] };
const DESK: Partial<Pose> = { ...P.phone, anchor: "feet", lean: .35, bend: .2, headTilt: .45, legN: [1.5, 1.55], legF: [1.4, 1.5] };
const STANDP: Partial<Pose> = { ...P.phone, anchor: "feet" };
const LIE: Partial<Pose> = { anchor: "feet", rot: -1.35, lean: .1, headTilt: -.2, armN: [2.4, .9], armF: [2.2, 1.0], legN: [.3, .5], legF: [.1, .3], phone: 1 };

export type WinWho = "kid" | "friend" | "tv" | "warm" | "dark";

/**
 * 창 하나. 방 안의 실루엣이 폰 빛(차가움)에 갇혀 있다. 폰 빛이 뒤 벽을 비춰 실루엣이 읽힌다.
 * who: kid(외로운 아무개) · friend(분홍 방울) · tv(빈 방, 푸른 깜빡임) · warm(커튼 친 따뜻한 창) · dark
 */
export const LonelyWin: React.FC<{
  x: number; y: number; w: number; h: number; k: Key; t: number; seed: number; who: WinWho; frame: string;
  facing?: 1 | -1; accent?: string; gold?: number; posev?: number; look?: number; open?: number; thick?: number;
}> = ({ x, y, w, h, k, t, seed, who, frame, facing, accent, gold = 0, posev, look = 0, open = 0, thick }) => {
  const room = mixhex(k.sil, k.silFar, .3);
  const fc: 1 | -1 = facing ?? (rnd(seed, 1) > .5 ? 1 : -1);
  const pv = posev ?? Math.floor(rnd(seed, 2) * 4);
  const flick = .75 + .25 * n2(seed, t * 2.2) + .1 * Math.sin(t * 13 + seed);
  const bedY = y + h * .93;
  const cx = x + w * (.5 + (rnd(seed, 3) - .5) * .25);
  const s = h * (who === "friend" ? .95 : .82);
  let body: React.ReactNode = null;
  let ph = { x: cx, y: y + h * .6 };
  if (who === "kid" || who === "friend") {
    const base = pv === 0 || who === "friend" ? SIT : pv === 1 ? STANDP : pv === 2 ? DESK : LIE;
    const p = pose({
      ...base, x: pv === 3 && who !== "friend" ? cx - fc * s * .3 : cx, y: bedY - h * .05, s, facing: fc,
      headTilt: mix((base.headTilt ?? .35) + .05 * n2(seed, t * .4), -.25, look),
      face: .95, faceColor: mixhex(k.cold, WARM, gold), eyes: .55 + look * .5, phone: 1,
    });
    const hp = (() => {
      // 폰 위치 근사: 두 손 사이
      const L = (p.s * .25);
      return { x: cx + fc * L * .55, y: bedY - h * .05 - p.s * .38 };
    })();
    ph = hp;
    body = (
      <Kid pose={p} variant={who === "friend" ? "friend" : "kid"} accent={who === "friend" ? accent : undefined} sil={k.sil} phoneColor={k.cold}
        rim={gold > .02 ? { dx: -fc, dy: -.3, color: GOLD, width: .012, glow: .5 } : undefined} />
    );
  }
  const lit = who === "kid" || who === "friend" || who === "tv";
  return (
    <WindowFrame x={x} y={y} w={w} h={h} frame={frame} thick={thick ?? Math.max(8, w * .05)} reflect={.1} open={open}>
      <rect x={x} y={y} width={w} height={h} fill={who === "warm" ? mixhex(k.win, k.glow, .3) : room} />
      {who === "warm" ? (
        <>
          <Glow x={x + w * .5} y={y + h * .55} r={w * .7} color="#fff0c8" opacity={.5} />
          <path d={`M${x},${y}L${x + w * .42},${y}Q${x + w * .3},${y + h * .5} ${x + w * .44},${y + h}L${x},${y + h}Z`} fill={mixhex(k.win, k.sil, .45)} opacity={.75} />
        </>
      ) : null}
      {lit ? (
        <>
          <Glow x={ph.x} y={ph.y} r={h * .9} color={k.cold} opacity={.58 * flick} />
          <Glow x={ph.x} y={ph.y - h * .2} r={h * .5} color={k.cold} opacity={.38 * flick} />
        </>
      ) : null}
      {who === "tv" ? <rect x={x + w * .55} y={y + h * .45} width={w * .3} height={h * .2} fill={k.cold} opacity={.8 * flick} /> : null}
      {gold > 0 ? <Glow x={x + w * (fc > 0 ? 1.05 : -.05)} y={y + h * .3} r={h * 1.1} color={GOLD} opacity={gold * .45} /> : null}
      {who === "kid" || who === "friend" ? <rect x={x - 10} y={bedY} width={w + 20} height={h} fill={mixhex(k.sil, room, .5)} /> : null}
      {body}
    </WindowFrame>
  );
};

/** 0..1의 부드러운 펄스(t0에서 솟았다 사그라든다) */
export const blip = (t: number, t0: number, up = .06, down = .5) => (t < t0 ? smooth(t0 - up, t0, t) : Math.exp(-(t - t0) / down));

/** 나선 비행: 중심(cx, cy) 둘레 반지름 r, 각 a. 앞(sin a > 0)일수록 크게 */
export const orbit = (cx: number, cy: number, rx: number, ry: number, a: number) => ({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, front: Math.sin(a) });

export { TAU, ease };
