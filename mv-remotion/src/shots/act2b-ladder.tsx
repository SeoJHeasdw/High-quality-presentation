/**
 * 2막 뒤(0:55–1:19)의 주인공 재료: 나방 사다리.
 *   - 난간 두 줄 = 나방이 뽑아 올리는 빛의 실. 끝에 실을 끄는 나방(밝은 점)이 있다
 *   - 발판 하나 = 날개를 난간에서 난간까지 활짝 편 나방 한 마리. 박(8분음)에 날개를 '탁' 펴며 자리 잡는다
 *   - 모든 컷에서 같은 금빛(GOLD), 같은 간격(아이 크기 s 기준 RUNG·WIDTH)
 *
 * 사다리는 "발판 틀" 함수 frame(i)로만 정의한다(i = 발판 번호, 소수 가능). 2D 컷은 ladder2d로, 높은 곳 컷은 3D 투영으로 만든다.
 * 아이는 climbPose로 사다리에 붙인다: 손은 ikArm, 발은 ikLeg로 발판에 닿고, 한 박에 한 칸(climb(박)) 오른다.
 */
import React from "react";
import { useUid } from "../lib/camera";
import { K } from "../lib/palette";
import { beat, beatAt } from "../lib/song";
import { clamp, ease, mix, mixhex, n2, rnd } from "../lib/math";
import { toward } from "../lib/moths";
import { skeleton, ikArm } from "../kid/rig";
import { DEFAULT, climb, pose, type Pose, type Limb } from "../kid/pose";

/** 사다리의 금빛(모든 컷 공통). 조용한 구간에서도 색은 그대로, 밝기만 낮춘다 */
export const GOLD = K.hope.accent; // #ffc860
export const CORE = "#fff3c8";
export const WHITE = "#fffbe8";
export const AMBER = "#e07a2a";
/** 발판 간격·난간 반폭(아이 크기 s 대비). 키(≈0.9s)에 발판 6칸 */
export const RUNG = .15, HALF = .2;

export type V2 = { x: number; y: number };
/** 발판 틀: 가운데(x, y), 사다리 위쪽 단위 벡터(ux, uy), 먼 난간 쪽 반폭 벡터(sx, sy), k = 그 자리의 아이 크기(px), ul = 화면에서 한 칸의 길이(원근으로 줄어든 값, 없으면 RUNG·k) */
export type RF = { x: number; y: number; ux: number; uy: number; sx: number; sy: number; k: number; ul?: number };

const len = (x: number, y: number) => Math.hypot(x, y) || 1;

/** 2D 사다리: 바닥 발판 (x, y)에서 ang(수직에서 오른쪽으로 기운 각)으로 오른다. curve는 발판마다 더 기우는 각,
 *  persp는 발판마다 크기가 줄어드는 비(올려다보기 원근), side는 먼 난간 방향(화면, 길이 1 = 반폭) */
export function ladder2d(o: { x: number; y: number; s: number; ang: number; curve?: number; persp?: number; side: V2; i0?: number; i1?: number }) {
  const i0 = o.i0 ?? 0, i1 = o.i1 ?? 60;
  const pts: RF[] = [];
  let x = o.x, y = o.y, g = 1;
  for (let i = i0; i <= i1 + 1; i++) {
    const a = o.ang + (o.curve ?? 0) * (i - i0);
    const ux = Math.sin(a), uy = -Math.cos(a);
    const k = o.s * g;
    pts.push({ x, y, ux, uy, sx: o.side.x * HALF * k, sy: o.side.y * HALF * k, k });
    x += ux * RUNG * k; y += uy * RUNG * k;
    g *= o.persp ?? 1;
  }
  return framesFrom(pts, i0);
}

/** 정수 발판 배열 → 소수 i를 받는 frame 함수(사이를 보간, 범위 밖은 끝 방향으로 늘림) */
export function framesFrom(pts: RF[], i0: number) {
  const n = pts.length;
  return (i: number): RF => {
    const u = i - i0;
    if (u <= 0) { const a = pts[0]; return { ...a, x: a.x + a.ux * RUNG * a.k * u, y: a.y + a.uy * RUNG * a.k * u }; }
    if (u >= n - 1) { const a = pts[n - 1], d = u - (n - 1); return { ...a, x: a.x + a.ux * RUNG * a.k * d, y: a.y + a.uy * RUNG * a.k * d }; }
    const j = Math.floor(u), w = u - j, a = pts[j], b = pts[j + 1];
    const ux = mix(a.ux, b.ux, w), uy = mix(a.uy, b.uy, w), l = len(ux, uy);
    return { x: mix(a.x, b.x, w), y: mix(a.y, b.y, w), ux: ux / l, uy: uy / l, sx: mix(a.sx, b.sx, w), sy: mix(a.sy, b.sy, w), k: mix(a.k, b.k, w), ul: a.ul !== undefined && b.ul !== undefined ? mix(a.ul, b.ul, w) : undefined };
  };
}

/** 발판 i가 자리 잡는 곡 시각. 24번 컷 박 79부터 8분음마다 한 칸 */
export const landGather = (i: number) => beat(79 + i / 2);
/** 높은 곳 컷: 꼭대기(top0)가 t0에 막 붙었고, 그 위로 rate칸/초로 계속 붙는다. 그 아래는 모두 이미 붙어 있다 */
export const landFront = (top0: number, t0: number, rate = 2.9) => (i: number) => (i <= top0 ? t0 - 99 + i * 1e-3 : t0 + (i - top0) / rate);

/* ───────────────────────── 발판 나방 ───────────────────────── */

// 국소 좌표: x는 반폭 단위(±1 = 난간), y는 몸 길이 단위(- = 머리 = 사다리 위쪽)
const FORE = "M.03,-.2C.18,-.78 .56,-1.02 .86,-.78C1.02,-.62 1.08,-.3 1.06,-.04C.8,.06 .42,.1 .03,.1Z";
const HIND = "M.03,.04C.3,.02 .64,.12 .66,.4C.66,.7 .34,.8 .03,.46Z";
const VEIN = "M.06,-.06C.3,-.3 .58,-.5 .96,-.24M.08,-.02C.4,-.08 .7,-.1 1,-.06M.06,.12C.3,.22 .5,.34 .6,.5";

type Ids = { wing: string; glow: string; hot: string };

/** 나방 하나를 틀 f에 그린다. spread 0 = 날갯짓하며 날아오는 중, 1 = 날개를 난간까지 펴고 멈춤(발판). flash = 막 붙은 반짝임 */
function mothGlyph(key: string | number, f: RF, ids: Ids, o: { spread: number; t: number; seed: number; b: number; flash?: number; lod?: boolean; glow?: number }) {
  const sl = len(f.sx, f.sy);
  const body = (f.ul ?? RUNG * f.k) * .42; // 몸 길이 단위(px): 사다리 방향으로 원근이 줄인 길이
  const sp = clamp(o.spread);
  // 날 때: 날개가 접혔다 펴졌다(크게). 붙은 뒤: 숨 쉬듯 조금
  const fast = .22 + .78 * Math.abs(Math.sin(o.t * 17 + o.seed * 3.1));
  const slow = 1.06 + .05 * Math.sin(o.t * 3.2 + o.seed * 1.7);
  const span = mix(fast * .85, slow, sp);
  const lift = (1 - mix(fast, 1, sp)) * .45; // 접힐수록 날개 끝이 들린다
  const b = o.b;
  const g = o.glow ?? 1;
  const gr = Math.max(sl * 1.25, 5);
  const fl = o.flash ?? 0;
  if (o.lod || sl < 7) {
    // 멀리서: 빛 막대 + 점
    const w = Math.max(1.1, sl * .16);
    return (
      <g key={key} opacity={b}>
        <circle cx={f.x} cy={f.y} r={Math.max(4, gr * 1.6) * g} fill={`url(#${ids.glow})`} opacity={.6 + fl} />
        <line x1={f.x - f.sx * span} y1={f.y - f.sy * span} x2={f.x + f.sx * span} y2={f.y + f.sy * span} stroke={CORE} strokeWidth={w} strokeLinecap="round" />
        <circle cx={f.x} cy={f.y} r={w * .8} fill={WHITE} />
      </g>
    );
  }
  // 행렬: 국소 x → 반폭 벡터, 국소 y → -위쪽 × 몸 길이
  const m = (sx: number) => `matrix(${f.sx * span * sx} ${f.sy * span * sx} ${-f.ux * body} ${-f.uy * body} ${f.x} ${f.y})`;
  const wing = (sx: number) => (
    <g transform={m(sx)}>
      <g transform={`translate(0 ${-lift})`}>
        <path d={HIND} fill={`url(#${ids.wing})`} stroke={AMBER} strokeOpacity={.55} strokeWidth={1.1} vectorEffect="non-scaling-stroke" />
        <path d={FORE} fill={`url(#${ids.wing})`} stroke={AMBER} strokeOpacity={.6} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
        <path d={VEIN} fill="none" stroke={AMBER} strokeOpacity={.4} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <ellipse cx={.58} cy={-.42} rx={.12} ry={.16} fill="none" stroke={AMBER} strokeOpacity={.75} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
        <ellipse cx={.58} cy={-.42} rx={.05} ry={.07} fill={WHITE} />
        <circle cx={.38} cy={.42} r={.08} fill={AMBER} opacity={.55} />
      </g>
    </g>
  );
  // 몸: 화면에서 가늘게(옆 방향 고정 폭)
  const bw = Math.max(1.5, body * .2);
  const nx = f.sx / sl, ny = f.sy / sl;
  const bm = `matrix(${nx * bw} ${ny * bw} ${-f.ux * body} ${-f.uy * body} ${f.x} ${f.y})`;
  return (
    <g key={key} opacity={b}>
      <circle cx={f.x} cy={f.y} r={gr * 1.7 * g} fill={`url(#${ids.glow})`} opacity={.55 + fl * .8} />
      {fl > .02 ? <circle cx={f.x} cy={f.y} r={gr * (1.1 + fl * 1.6)} fill={`url(#${ids.hot})`} opacity={fl} /> : null}
      {wing(1)}
      {wing(-1)}
      <g transform={bm}>
        <ellipse cx={0} cy={.08} rx={1} ry={.5} fill={CORE} />
        <ellipse cx={0} cy={.02} rx={.5} ry={.36} fill={WHITE} />
        <circle cx={0} cy={-.48} r={.85} fill={CORE} />
        <path d="M-.3,-.7Q-1.6,-1.15 -2.8,-1.05M.3,-.7Q1.6,-1.15 2.8,-1.05" stroke={CORE} strokeWidth={1.3} fill="none" vectorEffect="non-scaling-stroke" />
      </g>
    </g>
  );
}

/** 날아오는 나방의 자리: 출발점(src)에서 발판 자리(tgt)로. toward()로 모으고, 옆으로 휘는 곡선을 더한다 */
function flight(tgt: RF, src: V2, w: number, seed: number, t: number): RF & { k01: number } {
  const from = [{ x: src.x, y: src.y, s: 1, a: 0, f: 0, b: 1 }];
  const m = toward(from, [{ x: tgt.x, y: tgt.y }], w, 0, "out")[0];
  const k01 = ease("out", w);
  const dx = tgt.x - src.x, dy = tgt.y - src.y, l = len(dx, dy);
  const side = rnd(seed, 3) > .5 ? 1 : -1;
  const bulge = Math.sin(Math.PI * k01) * l * .28 * side;
  const wob = (1 - k01) * l * .05;
  const x = m.x + (-dy / l) * bulge + n2(seed, t * 2.2) * wob;
  const y = m.y + (dx / l) * bulge + n2(seed + 5, t * 2.2) * wob;
  return { ...tgt, x, y, k01 };
}

export type LadderProps = {
  frame: (i: number) => RF;
  lo: number; hi: number;
  t: number;
  /** 발판 i가 붙는 시각(곡 시각) */
  land: (i: number) => number;
  /** 날아오는 나방 i의 출발점. 없으면 발판 둘레 아래쪽에서 */
  src?: (i: number) => V2;
  /** "back" = 먼 난간 + 발판, "front" = 가까운 난간(아이 앞), "all" */
  part?: "back" | "front" | "all";
  /** 발판별 추가 밝기(0..) */
  bright?: (i: number) => number;
  /** 전체 밝기(조용한 구간은 낮춘다) */
  dim?: number;
  /** 날아오는 시간(초) */
  fly?: number;
  /** 난간 위 반짝이 수(난간 하나당) */
  sparks?: number;
  /** 멀리 있는 발판은 막대로(성능) */
  lodBelow?: number;
  /** 난간이 발판보다 앞서 뻗는 칸 수 */
  lead?: number;
  glow?: number;
  /** 난간 아래 끝(지붕 위 발판 0보다 아래로) */
  railFrom?: number;
};

/** 지금 난간 꼭대기(발판 번호, 소수) */
export function railTopAt(land: (i: number) => number, t: number, lo: number, hi: number, lead = 1.3) {
  let top = lo - 1;
  for (let i = lo; i <= hi + 400; i++) { if (land(i) <= t) top = i; else break; }
  const a = land(top), b = land(top + 1);
  const fr = top < lo ? 0 : clamp((t - a) / Math.max(.01, b - a));
  return top + fr + lead;
}

export const Ladder: React.FC<LadderProps> = (P) => {
  const id = useUid("lad");
  const ids: Ids = { wing: id + "w", glow: id + "g", hot: id + "h" };
  const { frame, lo, hi, t, land } = P;
  const part = P.part ?? "all";
  const dim = P.dim ?? 1;
  const fly = P.fly ?? .55;
  const lead = P.lead ?? 1.3;
  const top = Math.min(hi + 2, railTopAt(land, t, lo, hi, lead));
  const from = P.railFrom ?? lo;
  // 난간: 붙은 발판 사이는 팽팽하고, 그 위로 뻗은 실은 바람에 살짝 흔들린다
  const built = top - lead;
  const railAt = (i: number, sgn: number) => {
    const f = frame(i);
    const loose = clamp(i - built, 0, 30);
    const sw = n2(17 + sgn, i * .12 - t * .6) * loose * RUNG * f.k * .09;
    const px = -f.uy, py = f.ux;
    return { x: f.x + f.sx * sgn + px * sw, y: f.y + f.sy * sgn + py * sw };
  };
  const railPts = (sgn: number) => {
    const pts: string[] = [];
    const n = Math.max(2, Math.min(240, Math.ceil((top - from) * 2)));
    for (let j = 0; j <= n; j++) {
      const q = railAt(mix(from, top, j / n), sgn);
      pts.push(`${q.x.toFixed(1)},${q.y.toFixed(1)}`);
    }
    return pts.join(" ");
  };
  const tipF = frame(top);
  const kTip = tipF.k;
  const rail = (sgn: number, key: string) => {
    if (top <= from) return null;
    const pts = railPts(sgn);
    const tip = railAt(top, sgn);
    const kMid = frame(mix(from, Math.max(from, built), .5)).k;
    const pl = (w: number, c: string, a: number) => <polyline points={pts} fill="none" stroke={c} strokeOpacity={a} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;
    return (
      <g key={key} opacity={dim}>
        {pl(Math.max(5, kMid * .05), GOLD, .05)}
        {pl(Math.max(3, kMid * .025), GOLD, .1)}
        {pl(Math.max(1.6, kMid * .011), GOLD, .45)}
        {pl(Math.max(.8, kMid * .004), WHITE, .95)}
        {/* 실을 끄는 나방(끝의 밝은 점) */}
        <circle cx={tip.x} cy={tip.y} r={Math.max(7, kTip * .08)} fill={`url(#${ids.hot})`} opacity={.95} />
        <circle cx={tip.x} cy={tip.y} r={Math.max(1.6, kTip * .01)} fill="#fff" />
      </g>
    );
  };
  // 난간 위를 타고 오르는 반짝이
  const sparks = (sgn: number, key: string) => {
    const n = P.sparks ?? 10;
    if (n <= 0 || top <= from) return null;
    return (
      <g key={key} opacity={dim}>
        {Array.from({ length: n }, (_, j) => {
          const u = (rnd(41 + sgn, j) + t * (.12 + rnd(43, j) * .1)) % 1;
          const i = mix(from, top, u);
          const f = frame(i), q = railAt(i, sgn);
          const r = Math.max(1.2, f.k * .009) * (.6 + rnd(47, j) * .8);
          const a = Math.min(1, u * 6, (1 - u) * 6) * (.5 + .5 * Math.sin(t * 7 + j));
          return (
            <g key={j} opacity={a}>
              <circle cx={q.x} cy={q.y} r={r * 4} fill={`url(#${ids.glow})`} />
              <circle cx={q.x} cy={q.y} r={r} fill="#fff" />
            </g>
          );
        })}
      </g>
    );
  };
  const rungs: React.ReactNode[] = [];
  if (part !== "front") {
    for (let i = Math.ceil(lo); i <= hi; i++) {
      const tl = land(i);
      if (t < tl - fly) continue;
      const f = frame(i);
      const seed = i * 13 + 5;
      const extra = P.bright ? P.bright(i) : 0;
      const shimmer = .86 + .14 * Math.sin(t * 2.4 - i * .55);
      if (t < tl) {
        // 날아오는 중
        const sl = len(f.sx, f.sy);
        const src = P.src ? P.src(i) : (() => {
          const side = i % 2 ? 1 : -1;
          const ang = Math.atan2(f.uy, f.ux) + Math.PI + side * (.9 + rnd(seed, 1) * .5);
          const R = sl * (5 + rnd(seed, 2) * 4);
          return { x: f.x + Math.cos(ang) * R, y: f.y + Math.sin(ang) * R };
        })();
        const w = clamp((t - (tl - fly)) / fly);
        const now = flight(f, src, w, seed, t);
        const prev = flight(f, src, clamp(w - .04), seed, t - .02);
        let hx = now.x - prev.x, hy = now.y - prev.y;
        const hl = len(hx, hy); hx /= hl; hy /= hl;
        // 머리 방향: 날아오는 쪽 → 도착할수록 사다리 위쪽
        const kk = now.k01 * now.k01;
        let ux = mix(hx, f.ux, kk), uy = mix(hy, f.uy, kk); const ul = len(ux, uy); ux /= ul; uy /= ul;
        const sgn = Math.sign(f.sx * -uy + f.sy * ux) || 1;
        const ff: RF = { x: now.x, y: now.y, ux, uy, sx: -uy * sl * sgn, sy: ux * sl * sgn, k: f.k };
        // 꼬리
        const trail = [0, 1, 2, 3].map((q) => flight(f, src, clamp(w - q * .05), seed, t - q * .025));
        rungs.push(
          <g key={"f" + i} opacity={Math.min(1, w * 4) * dim}>
            <polyline points={trail.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={GOLD} strokeOpacity={.3} strokeWidth={Math.max(1, sl * .07)} strokeLinecap="round" />
            {mothGlyph(i, ff, ids, { spread: 0, t, seed, b: 1, lod: (P.lodBelow ?? 0) > f.k })}
          </g>,
        );
      } else {
        const a = t - tl;
        const spread = ease("back", clamp(a / .2));
        const flash = Math.exp(-a * 5) * .9;
        const kick = (1 - clamp(a / .5)) * Math.sin(a * 38) * .05;
        const fr: RF = { ...f, x: f.x + f.ux * RUNG * f.k * kick, y: f.y + f.uy * RUNG * f.k * kick };
        rungs.push(mothGlyph(i, fr, ids, { spread, t, seed, b: clamp((shimmer + extra) * dim, 0, 1.6), flash: flash + extra * .5, lod: (P.lodBelow ?? 0) > f.k, glow: (P.glow ?? 1) * (1 + extra) }));
      }
    }
  }
  return (
    <g>
      <defs>
        <linearGradient id={ids.wing} x1="0" y1="0" x2="1" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={WHITE} />
          <stop offset="35%" stopColor={CORE} />
          <stop offset="80%" stopColor={GOLD} />
          <stop offset="100%" stopColor={AMBER} />
        </linearGradient>
        <radialGradient id={ids.glow}>
          <stop offset="0%" stopColor={GOLD} stopOpacity={.75} />
          <stop offset="40%" stopColor={GOLD} stopOpacity={.22} />
          <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={ids.hot}>
          <stop offset="0%" stopColor="#ffffff" stopOpacity={1} />
          <stop offset="25%" stopColor={CORE} stopOpacity={.6} />
          <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
        </radialGradient>
      </defs>
      {part !== "front" ? rail(1, "rf") : null}
      {part !== "front" ? sparks(1, "sf") : null}
      {rungs}
      {part !== "back" ? rail(-1, "rn") : null}
      {part !== "back" ? sparks(-1, "sn") : null}
    </g>
  );
};

/* ───────────────────────── 사다리 오르기 ───────────────────────── */

/** 다리 두 마디 IK(무릎은 앞으로). leg 0 가까운 다리, 1 먼 다리. (tx, ty)는 발목 자리 */
export function ikLeg(pin: Partial<Pose>, leg: 0 | 1, tx: number, ty: number): Partial<Pose> {
  const p = { ...DEFAULT, ...pin } as Pose;
  const sk = skeleton(p);
  const hip = leg === 0 ? sk.hipN : sk.hipF;
  let dx = (tx - hip.x) * p.facing, dy = ty - hip.y;
  const r = -p.rot;
  [dx, dy] = [dx * Math.cos(r) - dy * Math.sin(r), dx * Math.sin(r) + dy * Math.cos(r)];
  const a = .16 * p.s, b = .15 * p.s;
  const d = clamp(Math.hypot(dx, dy), Math.abs(a - b) + 1, a + b - .5);
  const base = Math.atan2(dx, dy);
  const A = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  const E = Math.PI - Math.acos(clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));
  const limb: Limb = [base + A, E];
  return leg === 0 ? { ...pin, legN: limb } : { ...pin, legF: limb };
}

/** 몸이 한 칸씩 오르는 양(박에 확 당기고 오래 멈춤) */
export function bodySteps(sig: number, pull = .5) {
  let L = 0;
  for (let j = 0; j <= Math.floor(sig) && j < 400; j++) L += ease("expoOut", clamp((sig - j) / pull));
  return L;
}
/** 팔다리 하나가 박마다 한 칸씩 옮겨 가는 칸 수. 박 j 기준 [j + a, j + b] 동안 옮긴다. arc = 옮기는 중 바깥으로 들리는 정도 */
function limbSteps(sig: number, a: number, b: number) {
  let r = 0, arc = 0;
  for (let j = 0; j < 400; j++) {
    if (j + a > sig) break;
    const w = clamp((sig - j - a) / (b - a));
    r += ease("io", w);
    if (w > 0 && w < 1) arc = Math.sin(Math.PI * w);
  }
  return { r, arc };
}

/**
 * 사다리 위의 아이. sig = 오른 박 수(소수, 한 박에 한 칸. 음수면 아직 출발 전). L0 = 처음 골반 높이(발판 번호 + .2).
 * 한 칸 = 박 앞에서 두 손이 차례로 한 칸 위를 잡고(예비동작) → 박에 몸을 확 당겨 올리고(다리가 펴진다) → 박 뒤에 두 발이 차례로 올라선다.
 * facing 1이면 사다리는 아이 오른쪽에 있다. 돌려주는 값: 자세, 골반 높이 L, 손·발 자리
 */
export function climbPose(o: { frame: (i: number) => RF; s: number; sig: number; L0: number; facing?: 1 | -1; out?: number; extra?: Partial<Pose>; grip?: number; noLegs?: boolean; hands?: [V2 | null, V2 | null]; feet?: [V2 | null, V2 | null] }) {
  const facing = o.facing ?? 1;
  const sig = o.sig;
  const L = o.L0 + bodySteps(Math.max(sig, -1));
  const F = o.frame(L);
  const s = o.s;
  // 사다리에서 아이 쪽으로 향하는 벡터(화면)
  const ox = facing === 1 ? F.uy : -F.uy, oy = facing === 1 ? -F.ux : F.ux;
  const off = (o.out ?? .13) * s;
  const ang = Math.atan2(F.ux, -F.uy);
  const vel = L - (o.L0 + bodySteps(Math.max(sig - .12, -1)));
  const base = climb(sig);
  let p: Partial<Pose> = pose({
    ...base, anchor: "center", x: F.x + ox * off, y: F.y + oy * off, s, facing,
    rot: facing * ang * .8, lean: .1, headTilt: -.28, swing: clamp(.3 - vel * 9, -1.2, 1), squash: -vel * .25,
    ...o.extra,
  });
  const nb = Math.round(o.L0 - .2);
  const hN = limbSteps(sig, -.56, -.3), hF = limbSteps(sig, -.42, -.14);
  const fN = limbSteps(sig, .1, .38), fF = limbSteps(sig, .24, .52);
  const g = o.grip ?? .45;
  const at = (rung: number, sgn: number, arc: number, outK: number, upK: number) => {
    const f = o.frame(rung);
    return { x: f.x + f.sx * sgn * g + ox * (arc * .08 + outK) * s + f.ux * (upK + arc * .03) * s, y: f.y + f.sy * sgn * g + oy * (arc * .08 + outK) * s + f.uy * (upK + arc * .03) * s };
  };
  const HN = o.hands?.[0] ?? at(nb + 2 + hN.r, -1, hN.arc, 0, 0), HF = o.hands?.[1] ?? at(nb + 2 + hF.r, 1, hF.arc, 0, 0);
  const AN = o.feet?.[0] ?? at(nb - 1 + fN.r, -1, fN.arc, .03, .035), AF = o.feet?.[1] ?? at(nb - 1 + fF.r, 1, fF.arc, .03, .035);
  p = ikArm(p, 0, HN.x, HN.y);
  p = ikArm(p, 1, HF.x, HF.y);
  if (!o.noLegs) {
    p = ikLeg(p, 0, AN.x, AN.y);
    p = ikLeg(p, 1, AF.x, AF.y);
  }
  return { pose: p, L, hands: [HN, HF], feet: [AN, AF], out: { x: ox, y: oy } };
}

/* ───────────────────────── 3D(높은 곳 컷) ───────────────────────── */

/** 3D 카메라: 위치, yaw(+ 오른쪽을 봄), pitch(- 아래를 봄), roll, 초점거리 f(px) */
export type Cam3 = { x: number; y: number; z: number; yaw: number; pitch: number; roll?: number; f: number; cx?: number; cy?: number };
export type P3 = { x: number; y: number; z: number; s: number };
export function p3(c: Cam3, X: number, Y: number, Z: number): P3 {
  let x = X - c.x, y = Y - c.y, z = Z - c.z;
  const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
  [x, z] = [x * cy - z * sy, x * sy + z * cy];
  const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
  [y, z] = [y * cp - z * sp, y * sp + z * cp];
  const zz = Math.max(z, .05);
  let sx = c.f * x / zz, sy2 = -c.f * y / zz;
  const r = c.roll ?? 0;
  if (r) [sx, sy2] = [sx * Math.cos(r) - sy2 * Math.sin(r), sx * Math.sin(r) + sy2 * Math.cos(r)];
  return { x: (c.cx ?? 960) + sx, y: (c.cy ?? 540) + sy2, z, s: c.f / zz };
}
/** 무한히 먼 방향(달)의 화면 자리 */
export function pDir(c: Cam3, dx: number, dy: number, dz: number) {
  return p3(c, c.x + dx * 1e6, c.y + dy * 1e6, c.z + dz * 1e6);
}

/** 세계(미터): 땅 y=0. 아이의 건물은 원점, 지붕 높이 ROOF. 아이 크기 S_M(미터) */
export const ROOF = 17, S_M = 1.45;
/** 3D 사다리: 지붕 앞쪽에서 +z(달 쪽)로 기울며 오른다 */
export const LAD3 = { x: 0, y: ROOF + .25, z: 3, lean: .2, curve: .0006, yaw: .1 };
export function rung3(i: number) {
  // 발판마다 lean이 조금씩 커진다(달 쪽으로 휜다)
  const a0 = LAD3.lean, c = LAD3.curve, st = RUNG * S_M;
  // ∫ (sin, cos)(a0 + c u) du
  const ii = Math.max(0, i);
  const sinI = c ? (Math.cos(a0) - Math.cos(a0 + c * ii)) / c : Math.sin(a0) * ii;
  const cosI = c ? (Math.sin(a0 + c * ii) - Math.sin(a0)) / c : Math.cos(a0) * ii;
  const fwd = sinI * st;
  const a = a0 + c * ii;
  return {
    x: LAD3.x + fwd * Math.sin(LAD3.yaw), y: LAD3.y + cosI * st, z: LAD3.z + fwd * Math.cos(LAD3.yaw),
    // 위쪽 방향, 반폭(먼 난간 = +x 쪽)
    ux: Math.sin(a) * Math.sin(LAD3.yaw), uy: Math.cos(a), uz: Math.sin(a) * Math.cos(LAD3.yaw),
    hx: Math.cos(LAD3.yaw) * HALF * S_M, hz: -Math.sin(LAD3.yaw) * HALF * S_M,
  };
}
/** 3D 사다리를 카메라로 투영한 발판 틀. sideSign으로 어느 난간이 '먼' 쪽인지 정한다 */
export function ladder3(c: Cam3, sideSign = 1) {
  return (i: number): RF => {
    const r = rung3(i);
    const a = p3(c, r.x, r.y, r.z);
    const st = RUNG * S_M;
    const b = p3(c, r.x + r.ux * st, r.y + r.uy * st, r.z + r.uz * st);
    const sd = p3(c, r.x + r.hx * sideSign, r.y, r.z + r.hz * sideSign);
    const ux = b.x - a.x, uy = b.y - a.y, l = len(ux, uy);
    return { x: a.x, y: a.y, ux: ux / l, uy: uy / l, sx: sd.x - a.x, sy: sd.y - a.y, k: a.s * S_M, ul: l };
  };
}
/** 달의 방향(+z 앞, 위) */
export const MOON_DIR = (() => { const x = .1, y = .62, z = 1, l = Math.hypot(x, y, z); return { x: x / l, y: y / l, z: z / l }; })();

/* ── 3D 도시: 격자 위 건물 상자(지붕 + 카메라를 향한 벽 + 창). 멀수록 안개색 ── */
type Bld3 = { x0: number; x1: number; z0: number; z1: number; h: number; seed: number };
const CELL = 36, STREET = 12;
export const CITY: Bld3[] = (() => {
  const out: Bld3[] = [];
  const N = 9;
  for (let gx = -N; gx <= N; gx++) for (let gz = -N; gz <= N; gz++) {
    const id = (gx + 50) * 131 + (gz + 50);
    const cx = gx * CELL, cz = gz * CELL, half = (CELL - STREET) / 2;
    if (gx === 0 && gz === 0) { out.push({ x0: -10, x1: 10, z0: -9, z1: 9, h: ROOF, seed: 1 }); continue; }
    const r = rnd(77, id);
    const H = () => 6 + Math.pow(rnd(78, id + out.length), 1.8) * 30;
    if (r < .4) out.push({ x0: cx - half, x1: cx + half, z0: cz - half, z1: cz + half, h: H(), seed: id });
    else if (r < .75) {
      const m = mix(-half * .4, half * .4, rnd(79, id));
      out.push({ x0: cx - half, x1: cx + m - 1, z0: cz - half, z1: cz + half, h: H(), seed: id });
      out.push({ x0: cx + m + 1, x1: cx + half, z0: cz - half, z1: cz + half, h: H(), seed: id + 7 });
    } else {
      const m = mix(-half * .4, half * .4, rnd(80, id));
      out.push({ x0: cx - half, x1: cx + half, z0: cz - half, z1: cz + m - 1, h: H(), seed: id });
      out.push({ x0: cx - half, x1: cx + half, z0: cz + m + 1, z1: cz + half, h: H(), seed: id + 9 });
    }
  }
  return out;
})();

type CityK = { sil: string; silFar: string; fog: string; win: string; cold: string; glow: string; sky: string[] };

/** 아이 방 창: 아이 건물의 +z 벽, 지붕에서 두 층 아래 */
export const MY_WIN = { x: -4, y: 11.22, z: 9.03, w: 2, h: 1.53 };


/** 3D 도시를 그린다. myWin: 아이 방 창의 차가운 빛(0..1). lights: 가로등·차 불빛 */
export const City3D: React.FC<{ c: Cam3; k: CityK; t: number; fogD?: number; myWin?: number; winScale?: number; lights?: number; radius?: number; carpet?: number }> = ({ c, k, t, fogD = 260, myWin = 0, winScale = 1, lights = 1, radius = 330, carpet = 1 }) => {
  const id = useUid("c3");
  const camP = { x: c.x, y: c.y, z: c.z };
  const items = CITY.map((b) => {
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    return { b, cx, cz, d: Math.hypot(cx - camP.x, b.h / 2 - camP.y, cz - camP.z) };
  }).filter((q) => Math.hypot(q.cx - camP.x, q.cz - camP.z) < radius).sort((a, b) => b.d - a.d);
  const nodes: React.ReactNode[] = [];
  const onScreen = (pts: P3[]) => pts.some((p) => p.x > -300 && p.x < 2220 && p.y > -300 && p.y < 1380) && pts.every((p) => p.z > .5);
  for (const { b, d } of items) {
    const fw = 1 - Math.exp(-d / fogD);
    const P = (x: number, y: number, z: number) => p3(c, x, y, z);
    const corners = [P(b.x0, 0, b.z0), P(b.x1, 0, b.z0), P(b.x1, 0, b.z1), P(b.x0, 0, b.z1), P(b.x0, b.h, b.z0), P(b.x1, b.h, b.z0), P(b.x1, b.h, b.z1), P(b.x0, b.h, b.z1)];
    if (!onScreen(corners)) continue;
    const g: React.ReactNode[] = [];
    // 벽: [아래 왼, 아래 오른, 위 오른, 위 왼], 바깥 법선
    const walls: [number[], number, number, number][] = [
      [[0, 1, 5, 4], 0, -1, b.x1 - b.x0], [[2, 3, 7, 6], 0, 1, b.x1 - b.x0], [[3, 0, 4, 7], -1, 0, b.z1 - b.z0], [[1, 2, 6, 5], 1, 0, b.z1 - b.z0],
    ];
    for (const [ix, nx, nz, wl] of walls) {
      const fx = nx ? (nx > 0 ? b.x1 : b.x0) : (b.x0 + b.x1) / 2, fz = nz ? (nz > 0 ? b.z1 : b.z0) : (b.z0 + b.z1) / 2;
      if (nx * (camP.x - fx) + nz * (camP.z - fz) <= 0) continue;
      const q = ix.map((i) => corners[i]);
      const lit = .5 + .5 * (nz * .8 + nx * .25); // 달(+z) 쪽 벽이 조금 밝다
      const wall = mixhex(mixhex(k.sil, k.silFar, .35 + lit * .45), k.fog, fw * .9);
      g.push(<path key={`w${nx}${nz}`} d={`M${q[0].x},${q[0].y}L${q[1].x},${q[1].y}L${q[2].x},${q[2].y}L${q[3].x},${q[3].y}Z`} fill={wall} />);
      // 창
      const hpx = Math.abs(q[3].y - q[0].y) + Math.abs(q[3].x - q[0].x);
      if (hpx > 18 * winScale) {
        const floors = Math.max(1, Math.floor(b.h / 3.3)), cols = Math.max(1, Math.floor(wl / 3.6));
        const bl = (u: number, v: number) => ({ x: mix(mix(q[0].x, q[1].x, u), mix(q[3].x, q[2].x, u), v), y: mix(mix(q[0].y, q[1].y, u), mix(q[3].y, q[2].y, u), v) });
        for (let r = 0; r < floors; r++) for (let cc = 0; cc < cols; cc++) {
          const rv = rnd(b.seed + nx * 3 + nz * 5, r * 40 + cc);
          if (rv > .27) continue;
          const cold = rnd(b.seed + 11, r * 40 + cc) < .22;
          const u0 = (cc + .25) / cols, u1 = (cc + .75) / cols, v0 = (r + .3) / floors, v1 = (r + .75) / floors;
          const a1 = bl(u0, v0), a2 = bl(u1, v0), a3 = bl(u1, v1), a4 = bl(u0, v1);
          const fl = cold ? .6 + .4 * Math.sin(t * (4 + rnd(b.seed, r + cc) * 6) + r * 3 + cc) : 1;
          g.push(<path key={`n${nx}${nz}${r}_${cc}`} d={`M${a1.x},${a1.y}L${a2.x},${a2.y}L${a3.x},${a3.y}L${a4.x},${a4.y}Z`} fill={cold ? k.cold : k.win} opacity={(.45 + rnd(b.seed + 3, r * 40 + cc) * .5) * fl * (1 - fw * .75)} />);
        }
      } else if (hpx > 4) {
        // 작은 벽: 불 켜진 점 몇 개
        for (let j = 0; j < 3; j++) {
          if (rnd(b.seed + nx * 7 + nz, j) > .45) continue;
          const u = rnd(b.seed + 21, j * 2 + nx), v = .2 + rnd(b.seed + 23, j + nz) * .7;
          const x = mix(mix(q[0].x, q[1].x, u), mix(q[3].x, q[2].x, u), v), y = mix(mix(q[0].y, q[1].y, u), mix(q[3].y, q[2].y, u), v);
          g.push(<rect key={`p${nx}${nz}${j}`} x={x - .8} y={y - .8} width={1.8} height={1.8} fill={rnd(b.seed, j + 9) < .2 ? k.cold : k.win} opacity={.7 * (1 - fw * .7)} />);
        }
      }
    }
    if (camP.y > b.h) {
      const q = [corners[4], corners[5], corners[6], corners[7]];
      const roof = mixhex(mixhex(k.silFar, k.fog, .3), k.fog, fw * .9);
      g.push(<path key="r" d={`M${q[0].x},${q[0].y}L${q[1].x},${q[1].y}L${q[2].x},${q[2].y}L${q[3].x},${q[3].y}Z`} fill={roof} />);
      // 지붕 위 작은 상자(물탱크·계단실)
      if (rnd(b.seed, 99) > .45 && b.x1 - b.x0 > 8) {
        const tx = mix(b.x0 + 2, b.x1 - 6, rnd(b.seed, 98)), tz = mix(b.z0 + 2, b.z1 - 6, rnd(b.seed, 97)), th = 2.5;
        const r1 = [P(tx, b.h + th, tz), P(tx + 4, b.h + th, tz), P(tx + 4, b.h + th, tz + 4), P(tx, b.h + th, tz + 4)];
        const r0 = [P(tx, b.h, tz + 4), P(tx + 4, b.h, tz + 4)];
        g.push(<path key="tw" d={`M${r0[0].x},${r0[0].y}L${r0[1].x},${r0[1].y}L${r1[2].x},${r1[2].y}L${r1[3].x},${r1[3].y}Z`} fill={mixhex(k.sil, k.fog, fw * .9)} />);
        g.push(<path key="tr" d={`M${r1[0].x},${r1[0].y}L${r1[1].x},${r1[1].y}L${r1[2].x},${r1[2].y}L${r1[3].x},${r1[3].y}Z`} fill={roof} opacity={.9} />);
      }
    }
    nodes.push(<g key={b.seed + "_" + b.x0}>{g}</g>);
    // 아이 방 창(아이 건물의 +z 벽)
    if (b.seed === 1 && myWin > 0) {
      const w = MY_WIN;
      const q = [P(w.x - w.w / 2, w.y, w.z), P(w.x + w.w / 2, w.y, w.z), P(w.x + w.w / 2, w.y + w.h, w.z), P(w.x - w.w / 2, w.y + w.h, w.z)];
      const ctr = P(w.x, w.y + w.h / 2, w.z + .05);
      const fl = .78 + .22 * Math.sin(t * 9.3) * Math.sin(t * 3.7 + 1) + .1 * n2(5, t * 6);
      const size = Math.abs(q[1].x - q[0].x);
      nodes.push(
        <g key="mywin">
          <circle cx={ctr.x} cy={ctr.y} r={size * 3.2} fill={`url(#${id}cw)`} opacity={myWin * .55 * fl} />
          <path d={`M${q[0].x},${q[0].y}L${q[1].x},${q[1].y}L${q[2].x},${q[2].y}L${q[3].x},${q[3].y}Z`} fill={k.cold} opacity={myWin * fl} />
          {/* 창살 */}
          <line x1={(q[0].x + q[1].x) / 2} y1={(q[0].y + q[1].y) / 2} x2={(q[2].x + q[3].x) / 2} y2={(q[2].y + q[3].y) / 2} stroke={k.sil} strokeWidth={Math.max(1, size * .06)} />
        </g>,
      );
    }
  }
  // 가로등·차 불빛(거리 가운데 선)
  const lamp: React.ReactNode[] = [];
  if (lights > 0) {
    const N = 7;
    for (let a = -N; a <= N; a++) for (let j = -N * 3; j <= N * 3; j++) {
      for (const dir of [0, 1]) {
        if ((j + a + dir) % 2) continue;
        const s0 = (a + .5) * CELL, s1 = j * CELL / 3 + (dir ? 4 : 0);
        const X = dir ? s1 : s0, Z = dir ? s0 : s1;
        if (Math.hypot(X - c.x, Z - c.z) > radius) continue;
        const p = p3(c, X, .3, Z);
        if (p.z < 1 || p.x < -20 || p.x > 1940 || p.y < -20 || p.y > 1100) continue;
        const r = Math.max(.7, .32 * p.s);
        const fw = 1 - Math.exp(-p.z / fogD);
        lamp.push(<circle key={`l${a}_${j}_${dir}`} cx={p.x} cy={p.y} r={r * 3} fill={`url(#${id}lg)`} opacity={(1 - fw * .6) * lights} />);
      }
    }
    // 차: 몇 줄의 길을 따라 움직이는 빛 점
    for (let q = 0; q < 26; q++) {
      const dir = q % 2, lane = Math.round((rnd(91, q) - .5) * 12);
      const L = CELL * 14;
      const u = ((rnd(92, q) * L + t * (9 + rnd(93, q) * 8) * (rnd(94, q) > .5 ? 1 : -1)) % L + L) % L - L / 2;
      const X = dir ? u : (lane + .5) * CELL + (rnd(95, q) > .5 ? 1.5 : -1.5), Z = dir ? (lane + .5) * CELL + (rnd(95, q) > .5 ? 1.5 : -1.5) : u;
      if (Math.hypot(X - c.x, Z - c.z) > radius) continue;
      const p = p3(c, X, .4, Z);
      if (p.z < 1 || p.x < -20 || p.x > 1940 || p.y < -20 || p.y > 1100) continue;
      lamp.push(<circle key={`car${q}`} cx={p.x} cy={p.y} r={Math.max(1, .7 * p.s)} fill={q % 3 ? "#fff1d0" : "#ff5a48"} opacity={.85 * lights} />);
    }
  }
  // 격자 밖 먼 도시: 불빛 점 카펫
  const far: React.ReactNode[] = [];
  if (carpet > 0) {
    for (let q = 0; q < 520; q++) {
      const ang = rnd(61, q) * Math.PI * 2, R = radius * .85 + Math.pow(rnd(62, q), .7) * 900;
      const X = Math.cos(ang) * R + c.x, Z = Math.sin(ang) * R + c.z;
      const p = p3(c, X, rnd(63, q) * 30, Z);
      if (p.z < 1 || p.x < -10 || p.x > 1930 || p.y < -10 || p.y > 1090) continue;
      const fw = 1 - Math.exp(-p.z / (fogD * 1.6));
      far.push(<circle key={`c${q}`} cx={p.x} cy={p.y} r={Math.max(.7, .6 * p.s * 1.5)} fill={rnd(64, q) < .18 ? k.cold : k.win} opacity={(1 - fw * .8) * .85 * carpet} />);
    }
  }
  return (
    <g>
      <defs>
        <radialGradient id={`${id}lg`}>
          <stop offset="0%" stopColor="#fff1c8" stopOpacity={1} />
          <stop offset="25%" stopColor={k.win} stopOpacity={.5} />
          <stop offset="100%" stopColor={k.win} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${id}cw`}>
          <stop offset="0%" stopColor={k.cold} stopOpacity={.9} />
          <stop offset="30%" stopColor={k.cold} stopOpacity={.3} />
          <stop offset="100%" stopColor={k.cold} stopOpacity={0} />
        </radialGradient>
      </defs>
      {far}
      {lamp}
      {nodes}
    </g>
  );
};

/** 3D 카메라에서 본 땅(지평선 아래)과 하늘(위). 하늘은 키의 4색, 땅은 어두운 색에서 지평선 쪽 안개색 */
export const Ground3D: React.FC<{ c: Cam3; k: CityK }> = ({ c, k }) => {
  const id = useUid("gr");
  // 지평선: 앞쪽 수평 방향의 화면 y
  const h1 = pDir(c, Math.sin(c.yaw), 0, Math.cos(c.yaw));
  const r = c.roll ?? 0;
  const hy = h1.y;
  const deg = (r * 180) / Math.PI;
  return (
    <g transform={`rotate(${deg} ${h1.x} ${hy})`}>
      <defs>
        <linearGradient id={id + "s"} x1="0" y1={hy - 900} x2="0" y2={hy} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={k.sky[0]} />
          <stop offset="45%" stopColor={k.sky[1]} />
          <stop offset="80%" stopColor={k.sky[2]} />
          <stop offset="100%" stopColor={k.sky[3]} />
        </linearGradient>
        <linearGradient id={id + "g"} x1="0" y1={hy} x2="0" y2={hy + 700} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={k.fog} />
          <stop offset="30%" stopColor={mixhex(k.fog, k.silFar, .6)} />
          <stop offset="100%" stopColor={k.sil} />
        </linearGradient>
      </defs>
      <rect x={-4000} y={hy - 6000} width={10000} height={6000} fill={`url(#${id}s)`} />
      <rect x={-4000} y={hy} width={10000} height={8000} fill={`url(#${id}g)`} />
    </g>
  );
};

/** 사다리 위 높이 L(골반)의 3D 기준: 발판 자리, 위쪽 u, 아이 쪽 n(사다리 면에 수직, -z·위), 옆 h(+x) */
export function kidFrame3(L: number) {
  const r = rung3(L);
  const ul = Math.hypot(r.ux, r.uy, r.uz);
  const u = { x: r.ux / ul, y: r.uy / ul, z: r.uz / ul };
  // n = u × h 방향을 아이 쪽(-z)으로
  const h = { x: Math.cos(LAD3.yaw), y: 0, z: -Math.sin(LAD3.yaw) };
  let n = { x: u.y * h.z - u.z * h.y, y: u.z * h.x - u.x * h.z, z: u.x * h.y - u.y * h.x };
  if (n.z > 0) n = { x: -n.x, y: -n.y, z: -n.z };
  return { p: { x: r.x, y: r.y, z: r.z }, u, n, h };
}
export const add3 = (a: { x: number; y: number; z: number }, ...bs: [{ x: number; y: number; z: number }, number][]) => {
  let x = a.x, y = a.y, z = a.z;
  for (const [b, k] of bs) { x += b.x * k; y += b.y * k; z += b.z * k; }
  return { x, y, z };
};
/** 3D 카메라가 점 p에서 점 q를 바라보는 yaw·pitch */
export function lookAt(p: { x: number; y: number; z: number }, q: { x: number; y: number; z: number }) {
  const dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z;
  return { yaw: Math.atan2(dx, dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}
