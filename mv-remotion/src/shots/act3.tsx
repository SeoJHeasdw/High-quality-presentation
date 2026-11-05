/**
 * 3막(1:19–2:03) — 후렴. 날아오름과 친구. 이 뮤비의 보상 구간이라 가장 빠르고 가장 밝다.
 *   실이 내려옴(EWS, 흰빛에서) → 잡기(ECU 손, 박) → 휙 끌려 오름(사다리가 나방 소용돌이로 풀림)
 *   → 도시 위 긴 비행(옆 트래킹, 다섯 겹 시차·창 불빛 보케) → 폰에 갇힌 창의 벽 → 휙 패닝 → 친구(2번 컷의 거울)
 *   → 나방이 유리를 두드림(4번의 거울) → 망설임(얼굴 반은 차갑고 반은 금빛) → 두 손(2마디, 감정의 정점, B(37)에 닿음)
 *   → 함께 솟음 → 올려다본 나선 → 구름을 뚫고 달 앞을 가로지름 → 달 둘레의 나방 고리, 구름 바다로(후렴 → 은빛)
 *
 * 편집표 정정(코디네이터): 38번 a3-whip은 B(33) → beat(136)(반 마디), 39번 a3-friend는 beat(136) → B(34).
 */
import React from "react";
import { Layer, Scene, Screen, project, unproject, type Cam } from "../lib/camera";
import { K, type Key } from "../lib/palette";
import { B, beat } from "../lib/song";
import { TAU, clamp, ease, handheld, kf, lin, mix, mixhex, n2, rnd, smooth, springStep } from "../lib/math";
import { Cloud, CloudBank, Glow, GodRays, Moon, SkyFill, Stars, Wisp } from "../lib/sky";
import { Curtain, Skyline, WindowFrame } from "../lib/city";
import { Burst, Moths, Thread, stream, swarm, type M } from "../lib/moths";
import { Kid, ikArm, skeleton } from "../kid/rig";
import { P, lerpPose, pose, type Pose } from "../kid/pose";
import type { Shot } from "./types";
import { Bokeh, CityCarpet, GOLD, GOLD_CORE, LadderRails, Lit, LonelyRoom, LonelyWin, Speed, THREAD, WARM, blip, handGeo, ladderAt, mixKey, rungMoth, type Ladder, type RoomPose } from "./act3-kit";

const k = K.chorus;
const PINK = K.chorus.accent;
const FAR = mixhex(k.sil, k.silFar, .28);
const RIM = (dx: number, dy: number, w = .014, color: string = k.rim, glow = .7) => ({ dx, dy, color, width: w, glow });

// 컷 시작(초)
const T33 = B(28), T34 = B(29), T35 = beat(120), T36 = B(30), T37 = B(32), T38 = B(33), T39 = beat(136), T40 = B(34), T41 = B(35), T42 = B(36), T43 = B(38), T44 = B(39), T45 = B(40), T46 = B(42);
/** 박 i의 컷 안 시각 */
const at = (i: number, t0: number) => beat(i) - t0;

type Pt = { x: number; y: number };
const lp = (a: Pt, b: Pt, u: number): Pt => ({ x: mix(a.x, b.x, u), y: mix(a.y, b.y, u) });
const bz = (a: Pt, b: Pt, c: Pt, d: Pt, u: number): Pt => lp(lp(lp(a, b, u), lp(b, c, u), u), lp(lp(b, c, u), lp(c, d, u), u), u);
/** 3차 베지어를 u에서 잘라 앞부분 */
const bzHead = (a: Pt, b: Pt, c: Pt, d: Pt, u: number): Pt[] => {
  const ab = lp(a, b, u), bc = lp(b, c, u), cd = lp(c, d, u), abc = lp(ab, bc, u), bcd = lp(bc, cd, u);
  return [a, ab, abc, lp(abc, bcd, u)];
};
const cD = (p: Pt[]) => `M${p[0].x.toFixed(1)},${p[0].y.toFixed(1)}C${p[1].x.toFixed(1)},${p[1].y.toFixed(1)} ${p[2].x.toFixed(1)},${p[2].y.toFixed(1)} ${p[3].x.toFixed(1)},${p[3].y.toFixed(1)}`;
const qD = (a: Pt, c: Pt, b: Pt) => `M${a.x.toFixed(1)},${a.y.toFixed(1)}Q${c.x.toFixed(1)},${c.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
/** smooth(a, b, x)의 적분(속도 → 거리) */
const ism = (a: number, b: number, x: number) => {
  if (x <= a) return 0;
  if (x >= b) return (b - a) / 2 + (x - b);
  const u = (x - a) / (b - a);
  return (b - a) * (u * u * u - (u * u * u * u) / 2);
};

/** 두 아이의 손을 가운데에서 맞잡게(두 마디 IK) */
function holdHands(a: Partial<Pose>, ha: 0 | 1, b: Partial<Pose>, hb: 0 | 1, w = .5, dy = 0) {
  const sa = skeleton(a), sb = skeleton(b);
  const A = ha === 0 ? sa.shN : sa.shF, Bq = hb === 0 ? sb.shN : sb.shF;
  const m = { x: mix(A.x, Bq.x, w), y: mix(A.y, Bq.y, w) + dy };
  return { a: ikArm(a, ha, m.x, m.y), b: ikArm(b, hb, m.x, m.y), m };
}

/** 흐림 없는 하늘(그라데이션은 흐려도 같으니 CSS 흐림을 쓰지 않는다) */
const SkyL: React.FC<{ k: Key; t: number; horizon: number; stars?: number; glow?: number; y0?: number; seed?: number }> = ({ k: kk, t, horizon, stars = 1, glow = .55, y0 = -300, seed = 3 }) => (
  <Layer d={Infinity} blur={0}>
    <SkyFill k={kk} y0={y0} y1={horizon + 120} glowY={horizon} glowOpacity={glow} />
    {stars > 0 ? <Stars seed={seed} t={t} alpha={stars} x0={-600} x1={2520} y0={y0 - 500} y1={horizon - 220} /> : null}
  </Layer>
);
const MoonL: React.FC<{ k: Key; t: number; x: number; y: number; r: number; rays?: number; glow?: number; pulse?: number; blur?: number; children?: React.ReactNode; d?: number }> = ({ k: kk, t, x, y, r, rays = 0, glow = 1, pulse = 0, blur = 0, children, d = 60 }) => (
  <Layer d={d} blur={blur}>
    {rays > 0 ? <GodRays x={x} y={y} t={t} color={kk.moon} opacity={.15 * rays} len={r * 9} count={22} /> : null}
    <Moon x={x} y={y} r={r} color={kk.moon} glow={glow} pulse={pulse} halo={mixhex(kk.moon, kk.glow, .55)} texture={1} />
    {children}
  </Layer>
);

// ───────────────────────────── 33 ─────────────────────────────
const L33: Ladder = { x0: 150, y0: 1560, x1: 862, y1: 600, w: 62, n: 21 };
const M33 = { x: 1330, y: 215, r: 235 };
function geo33(lt: number, t: number) {
  const hh = handheld(t, 33, 4);
  const down = ease("out", lin(0, 2.6, lt));
  const cam: Cam = { x: 960 + hh.x, y: mix(430, 548, down) + hh.y, zoom: mix(1, 1.05, ease("sineIO", lin(0, 2.73, lt))), rot: hh.r + mix(-.02, 0, down), focus: 1, dof: 1.4 };
  const top = ladderAt(L33, (L33.n - .5) / L33.n);
  const tReach = at(116, T33), tArrive = at(117, T33);
  const reach = ease("back", lin(tReach - .12, tReach + .3, lt));
  const look = smooth(.1, 1.1, lt);
  const base = { ...P.stand, x: top.x + 4, y: top.y + 2, s: 122, facing: 1 as const, lean: -.04, swing: .5 + .35 * n2(5, t * .8) };
  const kp = pose({ ...base, headTilt: mix(-.15, -.62, look), armN: [mix(.45, 2.7, reach), mix(.9, .12, reach)], armF: [mix(.35, .55, reach), .7], lift: reach * .02 });
  const fin = skeleton(pose({ ...base, armN: [2.7, .12], armF: [.55, .7] }));
  const ms = project(cam, 60, M33.x, M33.y);
  const E0 = { x: fin.haN.x + 5 + Math.sin(t * 2.1) * 6, y: fin.haN.y - 10 };
  const es = project(cam, 1, E0.x, E0.y);
  const dx = es.x - ms.x, dy = es.y - ms.y, dl = Math.hypot(dx, dy) || 1;
  const S = unproject(cam, 1, ms.x + (dx / dl) * M33.r * .92, ms.y + (dy / dl) * M33.r * .92);
  const vx = E0.x - S.x, vy = E0.y - S.y, vl = Math.hypot(vx, vy) || 1, px = -vy / vl, py = vx / vl;
  const sw1 = 150 + 40 * Math.sin(t * 1.3), sw2 = 110 + 30 * Math.sin(t * 1.1 + 1);
  const C1 = { x: S.x + vx * .3 + px * sw1, y: S.y + vy * .3 + py * sw1 };
  const C2 = { x: S.x + vx * .7 - px * sw2, y: S.y + vy * .7 - py * sw2 };
  const prog = ease("out", lin(.12, tArrive, lt));
  return { cam, kp, top, S, C1, C2, E: E0, prog, reach, tArrive, ms };
}

// ───────────────────────────── 35 ─────────────────────────────
const tB35 = at(121, T35);
const DUR35 = B(30) - T35;
/** 실이 끌어 올린 높이: 박(120)에 휙(.3초 안에 대부분) → 잠깐 매달림 → 박(121) 뒤 소용돌이와 함께 가속 */
const lift35 = (x: number) => (x <= 0 ? 0 : 300 * (1 - Math.exp(-x * 9)) + 60 * x + 1500 * Math.pow(Math.max(0, x - tB35 + .1), 2));
const L35: Ladder = { x0: 560, y0: 2300, x1: 915, y1: 815, w: 120, n: 18 };
function kid35(lt: number) {
  return { x: 905 + 70 * ease("out", lin(0, 1.38, lt)) + 16 * Math.sin(lt * 9) * Math.exp(-lt * 3), y: 640 - lift35(lt) };
}
/** 박(121)에 살짝 뒤로 빠져 넓어지는 소용돌이를 담는다 */
const zoom35 = (lt: number) => kf(lt, [[0, 1.04], [.3, 1], [tB35, 1], [DUR35, .93, "io"]]);
/** 아이 골반이 화면 sy에 오도록. 휙 끌려 오를 때 카메라가 늦어서 아이가 화면 위로 튀어 오른다(그래서 휙이 읽힌다) */
function camY35(lt: number) {
  const sy = kf(lt, [[0, 560], [.26, 300, "out"], [tB35, 320, "io"], [1.12, 470, "io"], [DUR35 + .1, 480, "io"]]);
  return kid35(lt).y - (sy - 540) / zoom35(lt);
}
/** 소용돌이: 아이 몸을 축으로 두 가닥 나선. 위쪽 발판 여섯 개가 나방 열둘씩으로 풀린다(맨 위 발판부터) */
const HX35 = { n: 72, mpr: 12, top: -330, bot: 290, flat: .3, turns: 1.3, w: 6.4, climb: .2, inV: 2.4, entry: .2 };
/** 나방 j(0 = 맨 위 발판의 첫 나방)가 풀리는 시각과 그 발판 */
const rel35 = (j: number) => tB35 + j * .004;
const rung35 = (j: number) => L35.n - 1 - Math.floor(j / HX35.mpr);
/** 나선 가닥 위 u(0 발밑 … 1 머리 위)의 원기둥 좌표: 반지름 R, 각 th(sin th > 0이 카메라 쪽), 골반 기준 높이 y. 아이와 함께 오르며 넓어진다 */
function coil35(u: number, lt: number, strand: number) {
  const grow = ease("io", lin(tB35, DUR35, lt));
  return { R: mix(140, 235, u) * (1 + .55 * grow), th: strand * Math.PI + HX35.turns * TAU * u + HX35.w * lt, y: mix(HX35.bot, HX35.top, u) };
}
/**
 * 나방 j의 세계 좌표와 깊이 z(-1 뒤 … 1 앞). 풀리기 전에는 발판에서 떨고, 풀리면 나선 아래 끝으로 들어가
 * 가닥을 따라 감겨 올라 제자리(먼저 풀린 나방일수록 위)에 선다. 그래서 움직임이 퍼지지 않고 아이 둘레로 모여 감긴다
 */
function helix35(j: number, lt: number) {
  const m = j % HX35.mpr, rel = rel35(j);
  const rm = rungMoth(L35, rung35(j), T35 + lt);
  const pre = smooth(tB35 - .32, tB35, lt);
  if (lt < rel) {
    const jit = 4 * pre, lead = m === 0;
    return { x: rm.x + Math.sin(lt * 47 + j) * jit, y: rm.y + Math.cos(lt * 39 + j * 2) * jit, z: 1, s: lead ? rm.s * (1 + .25 * pre) : 0, b: lead ? Math.min(1, rm.b + .3 * pre) : 0, a: rm.a, w: 0, on: 0 };
  }
  const side = (m / (HX35.mpr - 1) - .5) * L35.w * .75;
  const P0 = { x: rm.x + Math.cos(rm.a - Math.PI / 2) * side, y: rm.y + Math.sin(rm.a - Math.PI / 2) * side };
  const q = kid35(lt);
  const strand = j % 2;
  const uSlot = .9 * (1 - (j + .5) / HX35.n) + HX35.climb * Math.max(0, lt - tB35);
  const u = Math.min(uSlot, HX35.inV * Math.max(0, lt - rel - HX35.entry * .4));
  const C = coil35(u, lt, strand);
  const set = smooth(.75, 1, u / Math.max(.01, uSlot));
  const R = C.R * (1 + .07 * set * Math.sin(lt * 5 + j)), th = C.th + .22 * rnd(359, j) * set;
  const z = Math.sin(th);
  const hp = { x: q.x + R * Math.cos(th), y: q.y + C.y + 12 * set * Math.sin(lt * 7 + j * 1.3) - R * HX35.flat * z };
  const w = ease("out", lin(rel, rel + HX35.entry, lt));
  const dz = (z + 1) / 2;
  const sz = (8.5 + 3.5 * rnd(357, j)) * mix(.6, 1.4, dz);
  const b = (m === 0 ? 1 : smooth(rel, rel + .06, lt)) * mix(.3, 1, dz) * (.6 + .4 * w) * (1 - smooth(.97, 1.1, uSlot));
  return { x: mix(P0.x, hp.x, w), y: mix(P0.y, hp.y, w), z, s: mix(rm.s * (m === 0 ? .55 : .3), sz, w), b, a: Math.atan2(-HX35.flat * Math.cos(th) - .5, -Math.sin(th)), w, on: smooth(rel + .17, rel + .27, lt) };
}

// ───────────────────────────── 36 ─────────────────────────────
const camX36 = (lt: number) => 1450 * lt + 520 * (1 - Math.exp(-2.6 * lt)) + 1000 * ism(2.45, 3.05, lt) - 350 * ism(4.3, 5.3, lt);
const tB31 = at(126, T36);
function kid36(lt: number) {
  const x = camX36(lt) - 230 - 1150 * (1 - ease("expoOut", lin(0, 1.05, lt))) + 90 * Math.sin(lt * 1.4);
  const y = 470 + 34 * Math.sin(lt * 2.3) + kf(lt, [[0, 60], [.9, 0, "out"], [1.9, 20], [2.55, 250, "io"], [3.1, -170, "out"], [4.2, -40, "io"], [5.47, 30, "io"]]);
  return { x, y };
}

// ───────────────────────────── 37 ─────────────────────────────
// 큰 창 한 줄. 창틀(정면, DW37)과 방 안(조금 더 깊은 DR37)이 다른 층이라 창 안의 인물이 틀 안에서 미끄러진다(시차).
// 아이는 지붕선 위 하늘을 배경으로 날고, 그 금빛이 창마다 위에서 쏟아져 지나간다(XL37 = 빛이 떨어지는 화면 x).
const DW37 = 1.3, DR37 = 1.45;
const SP37 = 1150, OW37 = 660, OH37 = 560, OY37 = 400, ROOF37 = 285;
const XL37 = 860;
/** 창 1·2·3이 아이 빛 아래를 지나는 시각: 박 130.5 · 132 · 133.5(점 4분음 리듬) */
const TL37 = [at(130.5, T37), at(132, T37), at(133.5, T37)];
const PER37 = TL37[1] - TL37[0];
/** 정면 층의 화면 이동량: 창 i의 가운데는 화면 x = i·SP37 − F37. 빛 아래에서 조금 느려지고(읽히게) 사이에서 빨라진다. 끝은 휙(다음 컷 whip) */
const F37 = (lt: number) => SP37 - XL37 + (SP37 / PER37) * (lt - TL37[0]) - 75 * Math.sin((TAU * (lt - TL37[0])) / PER37) + 3000 * ism(2.45, 2.8, lt);
const camX37 = (lt: number) => 960 + DW37 * F37(lt);
/** 창 i의 방 가운데(방 층 세계 x): 그 창이 빛 아래에 있을 때 창틀과 정확히 겹친다 */
const roomX37 = (i: number) => XL37 + (DW37 / DR37) * (i * SP37 - XL37);
const WHO37: RoomPose[] = ["belly", "hunch", "lie", "floor", "chair", "hunch"];
const FC37: (1 | -1)[] = [1, -1, 1, 1, -1, 1];
const S37 = [430, 470, 450, 470, 450, 450];
/** 아이(화면 좌표). 지붕선 위 하늘에서 앞으로 기울어 난다 */
const kidS37 = (lt: number) => ({ x: 790 + 40 * Math.sin(lt * 1.6), y: 205 + 16 * Math.sin(lt * 2.4) });
/** 37번 창틀 하나(정면 층): 틀 · 위 가로살 · 창 위 돌 · 창턱. 인물 앞을 가로지르는 살은 두지 않는다. warm = 아이 빛이 위에서 닿는 정도 */
const Win37: React.FC<{ x: number; k: Key; frame: string; wall: string; seed: number; warm: number }> = ({ x, k: kk, frame, wall, seed, warm }) => {
  const T = 22, y = OY37, w = OW37, h = OH37;
  const tr = y + h * .15;
  const curtain = rnd(376, seed) < .65;
  const cw = w * .12;
  const cur = rnd(376, seed + 40) < .5
    ? `M${x},${y}H${x + cw}Q${x + cw * .45},${y + h * .55} ${x + cw * 1.1},${y + h}H${x}Z`
    : `M${x + w},${y}H${x + w - cw}Q${x + w - cw * .45},${y + h * .55} ${x + w - cw * 1.1},${y + h}H${x + w}Z`;
  return (
    <g>
      {curtain ? <path d={cur} fill={mixhex(kk.sil, kk.silFar, .5)} opacity={.93} /> : null}
      <path d={`M${x + w * .58},${y}L${x + w * .74},${y}L${x + w * .36},${y + h}L${x + w * .2},${y + h}Z`} fill="#ffffff" opacity={.035} />
      <path d={`M${x - T},${y - T}H${x + w + T}V${y + h + T}H${x - T}Z M${x},${y}V${y + h}H${x + w}V${y}Z`} fill={frame} fillRule="evenodd" />
      <rect x={x} y={tr} width={w} height={14} fill={frame} />
      <rect x={x + w / 2 - 7} y={y} width={14} height={tr - y} fill={frame} />
      <rect x={x} y={tr + 14} width={w} height={3} fill={GOLD} opacity={.6 * warm} />
      <rect x={x - T - 18} y={y - T - 34} width={w + 2 * T + 36} height={34} fill={mixhex(frame, wall, .35)} />
      <rect x={x - T - 18} y={y - T - 37} width={w + 2 * T + 36} height={3} fill={mixhex(kk.glow, GOLD, warm)} opacity={.25 + .55 * warm} />
      <rect x={x - T - 28} y={y + h + T - 4} width={w + 2 * T + 56} height={30} fill={mixhex(wall, kk.silFar, .45)} />
      <rect x={x - T - 28} y={y + h + T - 6} width={w + 2 * T + 56} height={3} fill={mixhex(kk.cold, GOLD, warm)} opacity={.35 + .4 * warm} />
    </g>
  );
};

// ───────────────────────────── 38 ─────────────────────────────
const D38 = 1.25, XF38 = 3000, Z38 = 1.38;
const camX38 = (lt: number) => 960 + (XF38 - 960) * D38 - 2300 * (1 - kf(lt, [[0, 0], [.44, 1, "back"]]));

// ───────────────────────────── 42 ─────────────────────────────
const tT42 = at(150, T42); // B(37)
const C42 = { x: 960, y: 560 };
const KH0 = { ang: -.07, s: 300, flip: -1 };
const FH0 = { ang: Math.PI + .1, s: 285, flip: -1 };
const KCURL0 = [.03, .06, .1, .16], FCURL0 = [.04, .2, .3, .4];
const KCURL1 = [.62, .66, .7, .74], FCURL1 = [.42, .48, .54, .6];
// 닿는 순간의 손끝이 C42에서 만나도록 손목 자리를 미리 푼다
const kTip0 = handGeo({ x: 0, y: 0, ...KH0, curl: KCURL0, spread: .45 }).tip(1);
const fTip0 = handGeo({ x: 0, y: 0, ...FH0, curl: FCURL0, spread: .5 }).tip(0);
const KW42 = { x: C42.x - kTip0.x - 3, y: C42.y - kTip0.y };
const FW42 = { x: C42.x - fTip0.x + 3, y: C42.y - fTip0.y };
// 맞잡은 자리: 친구 손바닥이 아이 손바닥 위로 손가락 길이만큼 겹친다
const KC42 = { x: KW42.x + 150, y: KW42.y + 20 };
const FC42 = { x: KC42.x + .95 * 300 + .95 * 285 - .38 * 300, y: KC42.y - .33 * 300 };
const CL42 = { x: KC42.x + 1.05 * 300, y: KC42.y - .22 * 300 };

// ───────────────────────────── 44 ─────────────────────────────
const V44 = { x: 960, y: -420 };
const UpWall: React.FC<{ x0: number; x1: number; y0: number; roof: number; color: string; k: Key; t: number; seed: number; rows?: number; cols?: number; win?: string }> = ({ x0, x1, y0, roof, color, k: kk, t, seed, rows = 9, cols = 4 }) => {
  const X = (x: number, y: number) => V44.x + (x - V44.x) * (y - V44.y) / (y0 - V44.y);
  const yr = (r: number) => V44.y + (y0 - V44.y) * Math.pow(.84, r);
  const quad = (a: number, b: number, ya: number, yb: number) => {
    const xa0 = mix(X(x0, ya), X(x1, ya), a), xa1 = mix(X(x0, ya), X(x1, ya), b);
    const xb0 = mix(X(x0, yb), X(x1, yb), a), xb1 = mix(X(x0, yb), X(x1, yb), b);
    return `M${xa0},${ya}L${xa1},${ya}L${xb1},${yb}L${xb0},${yb}Z`;
  };
  const wins: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    const ya = yr(r + .25), yb = yr(r + .75);
    if (yb < roof) continue;
    for (let c2 = 0; c2 < cols; c2++) {
      const v = rnd(seed, r * 17 + c2);
      if (v > .55) continue;
      const cold = v < .3;
      const fl = cold ? .7 + .3 * Math.sin(t * (5 + rnd(seed, r + c2 * 9) * 5) + r) : 1;
      wins.push(<path key={`${r}-${c2}`} d={quad((c2 + .22) / cols, (c2 + .78) / cols, ya, yb)} fill={cold ? kk.cold : kk.win} opacity={.75 * fl} />);
    }
  }
  return (
    <g>
      <path d={`M${X(x0, y0)},${y0}L${X(x1, y0)},${y0}L${X(x1, roof)},${roof}L${X(x0, roof)},${roof}Z`} fill={color} />
      {wins}
      <path d={`M${X(x0, roof) - 6},${roof + 4}L${X(x1, roof) + 6},${roof + 4}L${X(x1, roof) + 6},${roof - 16}L${X(x0, roof) - 6},${roof - 16}Z`} fill={color} />
    </g>
  );
};
function pair44(lt: number) {
  const a = 1.2 + 14.2 * ease("sineIO", lin(-.5, 3.1, lt)) - 3.1;
  const cy = mix(800, 230, ease("io", lin(-.3, 2.9, lt)));
  const r = mix(420, 110, ease("io", lin(-.3, 2.9, lt)));
  return { x: 960 + Math.cos(a) * r, y: cy + Math.sin(a) * r * .72, a, r, s: mix(235, 95, ease("out", lin(0, 2.72, lt))) };
}

// ───────────────────────────── 45 ─────────────────────────────
const M45 = { x: 960, y: 455, r: 385 };
const tB41 = at(166, T45);
function pair45(lt: number) {
  const u = (lt - tB41) / tB41;
  return { x: 900 + 1380 * (.33 * u + .67 * u * u * u), y: 430 + 150 * u * u - 30 * Math.sin(lt * 1.7) };
}

// ───────────────────────────── 46 ─────────────────────────────
const tB43 = at(174, T46);
function moon46(lt: number) {
  const g = ease("io", lin(1.6, 5.43, lt));
  return { x: mix(960, 700, g), y: mix(430, 250, g), r: mix(300, 210, g) };
}
function pair46(lt: number) {
  const m = moon46(lt);
  const th = mix(.25, TAU + .15, ease("sineIO", lin(0, tB43 + .2, lt)));
  const ox = Math.cos(th) * m.r * 1.75, oy = Math.sin(th) * m.r * .62 - m.r * .1;
  const orbitP = { x: m.x + ox, y: m.y + oy };
  const g = ease("out", lin(tB43 - .1, 5.43, lt));
  const end = { x: 1420, y: 820 };
  const p = lt < tB43 - .1 ? orbitP : { x: mix(orbitP.x, end.x, g), y: mix(orbitP.y, end.y, g) + Math.sin(g * Math.PI) * -60 };
  return { ...p, th, front: lt > tB43 ? 1 : Math.sin(th), g };
}

export const act3: Shot[] = [
  {
    // 33. EWS 흰빛에서 열린다. 달이 금빛 실을 사다리 꼭대기의 작은 아이에게 내려 준다. 실 끝이 박(117)에 손 위에 닿는다
    id: "a3-thread", start: T33, key: "chorus", enter: { type: "white" },
    render: (c) => {
      const lt = c.lt;
      const g = geo33(lt, c.t);
      const { cam, kp } = g;
      const head = bzHead(g.S, g.C1, g.C2, g.E, Math.max(.001, g.prog));
      const tip = head[3];
      const white = 1 - ease("out", lin(0, 1.15, lt));
      const arrive = blip(lt, g.tArrive, .05, .5);
      const escort = (tt: number): M[] => {
        const G = geo33(tt - T33, tt);
        return Array.from({ length: 16 }, (_, i) => {
          const u = Math.min(G.prog, Math.pow(rnd(331, i), .6) * G.prog);
          const p = bz(G.S, G.C1, G.C2, G.E, u);
          const a = tt * (4 + rnd(332, i) * 3) + i;
          return { x: p.x + Math.cos(a) * 26, y: p.y + Math.sin(a) * 15, s: 3.2 + rnd(333, i) * 2.2, a: a + 1.57, f: tt * 18 + i, b: .5 + .5 * rnd(334, i) };
        });
      };
      return (
        <Scene cam={cam}>
          <SkyL k={k} t={c.t} horizon={790} glow={.7} />
          <MoonL k={k} t={c.t} x={M33.x} y={M33.y} r={M33.r} rays={1.1} glow={1.1 + arrive * .3} pulse={c.pulse * .25}>
            <Moths t={c.t} at={(t) => swarm(336, 46, t, { cx: M33.x - 60, cy: M33.y + 80, rx: 520, ry: 260, size: 2.6, speed: .3 })} color={GOLD} wings={false} />
          </MoonL>
          <Layer d={30} blur={0}>
            <Wisp x={420} y={520} w={1500} color={k.cloudLit} opacity={.2} t={c.t} />
            <Wisp x={1600} y={640} w={1700} color={k.cloudLit} opacity={.16} t={c.t} drift={-7} />
          </Layer>
          <Layer d={14} blur={.8}>
            <Skyline seed={331} base={800} minH={12} maxH={60} minW={30} maxW={90} color={mixhex(k.fog, k.sky[3], .35)} t={c.t} win={{ density: .1, size: .3, warm: k.win, cold: k.cold }} details={false} x0={-1200} x1={3200} />
            <CityCarpet k={k} t={c.t} horizon={800} h0={900} n={760} seed={333} size={1.8} ground />
          </Layer>
          <Layer d={1}>
            <Glow x={g.top.x} y={g.top.y - 30} r={240} color={GOLD} opacity={.35 + arrive * .3} />
            <LadderRails L={L33} taper={.7} width={2.2} />
            <Moths t={c.t} at={(t) => Array.from({ length: L33.n }, (_, i) => rungMoth(L33, i, t, .7))} color={GOLD} core={GOLD_CORE} />
            <Thread d={cD(head)} progress={1} color={THREAD} width={2.6} glow={1.3} />
            <Glow x={tip.x} y={tip.y} r={46 + arrive * 30} color={GOLD} opacity={g.prog > .01 ? .95 : 0} />
            <circle cx={tip.x} cy={tip.y} r={5} fill="#fffbe8" opacity={g.prog > .01 ? 1 : 0} />
            <Moths t={c.t} at={escort} color={GOLD} trail={4} />
            <Kid pose={kp} sil={k.sil} rim={RIM(.6, -.8, .035, k.rim, .9)} />
          </Layer>
          <Layer d={.5} blur={9}>
            <Cloud seed={337} x={260} y={1110} w={1100} dark={k.cloud} lit={mixhex(k.cloudLit, k.cloud, .35)} t={c.t} drift={30} opacity={.7} />
            <Cloud seed={338} x={1750} y={1190} w={900} dark={k.cloud} lit={k.cloudLit} t={c.t} drift={-25} opacity={.75} />
          </Layer>
          <Screen>
            <Glow x={g.ms.x} y={g.ms.y} r={1500 * (.6 + white)} color="#fffaf0" opacity={white} />
            <rect width={1920} height={1080} fill="#fffaf0" opacity={white * white * .9} />
          </Screen>
        </Scene>
      );
    },
  },
  {
    // 34. ECU 손. 손이 올라와 펴졌다가 박(119)에 실을 쥔다. 금빛이 터지고, 빛이 실을 타고 위로 달려 올라간다
    id: "a3-grab", start: T34, key: "chorus", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt, tg = at(119, T34);
      const hh = handheld(c.t, 34, 5);
      const hit = lt >= tg ? Math.exp(-(lt - tg) * 5) : 0;
      const shake = hit * 11;
      const punch = lt > tg ? .06 * Math.exp(-(lt - tg) * 3.2) * springStep(lt - tg, 22, .5) : 0;
      const cam: Cam = { x: 960 + hh.x + Math.sin(lt * 71) * shake, y: 540 + hh.y + Math.cos(lt * 63) * shake, zoom: 1 + .03 * ease("sineIO", lin(0, c.dur, lt)) + punch, rot: hh.r, focus: 1, dof: 9 };
      const X = 1030;
      const close = ease("back", lin(tg - .08, tg + .12, lt));
      const rise = ease("expoOut", lin(0, tg + .05, lt));
      const pull = lt > tg ? springStep(lt - tg, 9, .45) : 0;
      const s = 300;
      const wrist = { x: X - .62 * s + close * 10, y: mix(1330, 905, rise) - pull * 46 };
      const hand = handGeo({ x: wrist.x, y: wrist.y, ang: -Math.PI / 2 + .09, s, flip: 1, curl: [0, 1, 2, 3].map((i) => mix(.02 + i * .03, .9 + i * .02, close)), spread: mix(1.15, .1, close), thumb: mix(-.1, 1, close), sleeve: 4, sleeveW: .5 });
      const grip = { x: X, y: hand.W(1.15, .3).y };
      // 실: 잡기 전에는 흔들리고, 잡은 뒤에는 팽팽하게 떤다
      const yTop = -300, yEnd = lt < tg ? 600 + 25 * Math.sin(lt * 3) : grip.y + 150;
      const sway = lt < tg ? 20 : 0;
      const vib = lt >= tg ? 12 * Math.exp(-(lt - tg) * 6) * Math.sin((lt - tg) * 62) : 0;
      const tx = (y: number) => X + sway * Math.sin(y / 260 + c.t * 2.3) * (1 - smooth(tg - .2, tg, lt)) + vib * Math.sin(clamp((y - yTop) / (grip.y - yTop)) * Math.PI);
      const thr = Array.from({ length: 13 }, (_, i) => { const y = mix(yTop, yEnd, i / 12); return `${tx(y).toFixed(1)},${y.toFixed(1)}`; }).join(" ");
      const runner = lt > tg ? grip.y - 2200 * ease("in", lin(tg + .05, tg + .75, lt)) : grip.y;
      const near = smooth(900, 300, Math.abs(wrist.y - 900));
      return (
        <Scene cam={cam}>
          <SkyL k={k} t={c.t} horizon={1500} y0={-700} stars={.6} glow={.4} />
          <MoonL k={k} t={c.t} x={1580} y={30} r={330} glow={.75 + hit * .5} blur={14} />
          <Layer d={3.2}>
            <LadderRails L={{ x0: 420, y0: 1500, x1: 1250, y1: 380, w: 260, n: 8 }} width={5} opacity={.45} />
            <Moths t={c.t} at={(t) => Array.from({ length: 8 }, (_, i) => rungMoth({ x0: 420, y0: 1500, x1: 1250, y1: 380, w: 260, n: 8 }, i, t))} color={GOLD} />
          </Layer>
          <Layer d={3.5} blur={0}>
            <Bokeh seed={341} n={26} x0={-200} x1={2100} y0={-100} y1={1150} r0={18} r1={70} colors={[GOLD, PINK, k.glow, GOLD]} t={c.t} />
          </Layer>
          <Layer d={1}>
            <polyline points={thr} fill="none" stroke={GOLD} strokeWidth={30} strokeOpacity={.08 + hit * .1} strokeLinecap="round" />
            <polyline points={thr} fill="none" stroke={GOLD} strokeWidth={11} strokeOpacity={.3 + hit * .3} strokeLinecap="round" />
            <polyline points={thr} fill="none" stroke="#fffbe8" strokeWidth={3.5} strokeLinecap="round" />
            {lt < tg ? <Glow x={tx(yEnd)} y={yEnd} r={60} color={GOLD} /> : null}
            <Lit draw={(cc) => hand.draw(cc)} fill={k.sil}
              rims={[{ dx: .15, dy: -1, color: k.rim, width: 5, glow: .6 }, { dx: 1, dy: -.1, color: GOLD, width: 4 + hit * 4, glow: 1, opacity: .5 + near * .5 }]}
              spill={[{ x: X, y: grip.y, r: 330 + hit * 260, color: GOLD, a: lt < tg ? near * .3 : .45 + hit * .5 }]} />
            {lt > tg ? <Glow x={X} y={runner} r={70} color="#fff3c8" opacity={1 - lin(tg + .5, tg + .8, lt)} /> : null}
          </Layer>
          <Layer d={1} blend="screen">
            <Glow x={X} y={grip.y} r={520} color={GOLD} opacity={hit * .7} />
            <Burst x={X} y={grip.y} t={lt} t0={tg} dur={1} n={40} r={460} color={GOLD} />
          </Layer>
          <Layer d={.42}>
            <Moths t={c.t} at={(t) => swarm(345, 5, t, { cx: 900, cy: 600, rx: 1100, ry: 500, size: 26, speed: .35 })} color={GOLD} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 35. 실이 박(120)에 아이를 휙 끌어 올린다(늘어남. 카메라가 늦게 따라가 아이가 화면 위로 튄다).
    //     박(121)에 위 발판부터 발판 나방이 네 마리씩 풀려 나와, 아이 몸을 축으로 감기는 두 가닥 나선이 된다.
    //     나선은 아이와 함께 오르며 넓어진다. 카메라 쪽 반 바퀴의 나방은 크고 밝게 아이 앞에, 먼 반 바퀴는 작고 흐리게 아이 뒤에 그린다
    id: "a3-liftoff", start: T35, key: "chorus", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt, tB = tB35;
      const hh = handheld(c.t, 35, 6);
      const kq = kid35(lt);
      const jolt = Math.exp(-lt * 9);
      const zoom = zoom35(lt);
      const cam: Cam = { x: 960 + hh.x + Math.sin(lt * 80) * 14 * jolt, y: camY35(lt) + hh.y, zoom, rot: hh.r - .03 * ease("out", lin(0, DUR35, lt)), focus: 1, dof: 3 };
      const stretch = lt < .02 ? .12 : -.3 * Math.exp(-lt * 4.5) * (1 + .3 * Math.sin(lt * 26) * Math.exp(-lt * 3));
      const fold = smooth(.3, 1.0, lt);
      const form = smooth(tB + .05, tB + .5, lt);
      const hit = blip(lt, tB, .05, .35);
      const kp = pose({
        ...P.hang, anchor: "center", x: kq.x, y: kq.y, s: 400, facing: 1, squash: stretch, rot: .08 * Math.sin(lt * 5),
        armN: [3.08, .04], armF: [mix(1.6, 2.15, fold) + .25 * Math.sin(lt * 7), mix(.9, .35, fold)],
        legN: [mix(.1, 1.0, fold), mix(.15, 1.5, fold)], legF: [mix(-.15, .45, fold), mix(.3, 1.1, fold)], toe: 1,
        swing: mix(-1.5, -.5, fold) + .3 * Math.sin(lt * 11), headTilt: mix(-.2, .12, form), faceDir: mix(.3, .5, form),
        face: .5 + .45 * Math.max(form, hit), faceColor: WARM, eyes: 1.2, mouth: .8 * (1 - form), smile: form > .5 ? 1 : 0,
      });
      const sk = skeleton(kp);
      // 꼬리는 화면 기준 움직임으로 그린다(카메라가 함께 오른 만큼 되돌린다): 궤도의 호가 보이고 세로 줄(분수)이 되지 않는다
      const cy0 = camY35(lt);
      // 무리: 0 먼 반 바퀴(아이 뒤) · 1 카메라 쪽 반 바퀴(아이 앞) · 2 아직 발판에서 날아드는 중(꼬리를 짧게)
      const moths = (grp: 0 | 1 | 2) => (tt: number): M[] => {
        const l = tt - T35;
        const dy = cy0 - camY35(l), zr = zoom35(l) / zoom;
        return Array.from({ length: HX35.n }, (_, j) => {
          const h = helix35(j, l);
          const on = h.on, wz = smooth(-.14, .14, h.z);
          const vis = grp === 2 ? 1 - on : on * (grp === 1 ? wz : 1 - wz);
          return { x: h.x, y: cy0 + (h.y + dy - cy0) * zr, s: h.s, a: h.a, f: tt * 22 + j * 1.3, b: h.b * vis };
        });
      };
      // 나선 가닥(나방이 지나간 빛의 길): 카메라 쪽 반 바퀴와 먼 반 바퀴로 나눠 아이 앞·뒤에 그린다
      const strands = (front: boolean) => {
        const ub = Math.min(.97, HX35.inV * (lt - tB) - .05);
        const ua = HX35.climb * Math.max(0, lt - tB) + .03;
        if (form <= .01 || ub <= ua + .05) return null;
        const segs: string[] = [];
        for (let st = 0; st < 2; st++) {
          let cur: string[] = [];
          for (let i = 0; i <= 64; i++) {
            const C = coil35(mix(ua, ub, i / 64), lt, st);
            const z = Math.sin(C.th);
            if ((z >= 0) === front) cur.push(`${(kq.x + C.R * Math.cos(C.th)).toFixed(1)},${(kq.y + C.y - C.R * HX35.flat * z).toFixed(1)}`);
            else { if (cur.length > 1) segs.push(cur.join(" ")); cur = []; }
          }
          if (cur.length > 1) segs.push(cur.join(" "));
        }
        return (
          <g fill="none" strokeLinecap="round" opacity={form * (front ? .6 : .3)}>
            {segs.map((pts, i) => <polyline key={"w" + i} points={pts} stroke={GOLD} strokeWidth={front ? 18 : 10} strokeOpacity={.12} />)}
            {segs.map((pts, i) => <polyline key={"c" + i} points={pts} stroke={front ? GOLD_CORE : GOLD} strokeWidth={front ? 2.4 : 1.5} strokeOpacity={.55} />)}
          </g>
        );
      };
      const relRung = (i: number) => (i >= L35.n - HX35.n / HX35.mpr ? rel35((L35.n - 1 - i) * HX35.mpr) : 99);
      const nRel = Array.from({ length: L35.n }, (_, i) => (lt >= relRung(i) ? 1 : 0) as number).reduce((a, b) => a + b, 0);
      const topU = clamp(1 - nRel / L35.n);
      const rails = 1 - smooth(tB, tB + .45, lt);
      const topRung = rungMoth(L35, L35.n - 1, c.t);
      const speed = Math.max(.6 * (1 - smooth(.15, .45, lt)) * smooth(.02, .08, lt), smooth(tB, tB + .4, lt));
      return (
        <Scene cam={cam}>
          <SkyL k={k} t={c.t} horizon={1250} glow={.6} />
          <MoonL k={k} t={c.t} x={1660} y={140} r={130} rays={.8} pulse={hit * .6} />
          <Layer d={14} blur={1}>
            <CityCarpet k={k} t={c.t} horizon={980} h0={1200} n={520} seed={355} />
          </Layer>
          <Layer d={6} blur={0}>
            <Wisp x={300} y={-200} w={1400} color={k.cloudLit} opacity={.25} t={c.t} />
            <Wisp x={1500} y={-600} w={1600} color={k.cloudLit} opacity={.22} t={c.t} />
          </Layer>
          <Layer d={1}>
            {rails > .01 && topU > 0 ? <LadderRails L={{ ...L35, x1: mix(L35.x0, L35.x1, topU), y1: mix(L35.y0, L35.y1, topU) }} width={4} opacity={.9 * rails} rungs={(i) => (lt < relRung(i) ? 1 : 0)} /> : null}
            <Thread d={`M${sk.haN.x},${sk.haN.y}L${sk.haN.x + 30 + Math.sin(lt * 50) * 8 * jolt},${cam.y - 1100}`} color={THREAD} width={3.4} glow={1.4} />
            <Glow x={sk.pelvis.x} y={sk.pelvis.y - 20} r={460} color={GOLD} opacity={.1 + .22 * form + hit * .3} />
            {strands(false)}
            <Moths t={c.t} at={moths(2)} color={GOLD} core={GOLD_CORE} trail={1} trailDt={.02} />
            <Moths t={c.t} at={moths(0)} color={mixhex(GOLD, k.glow, .35)} core={mixhex(GOLD_CORE, GOLD, .45)} glow={.8} trail={4} />
            {[3, 2, 1].map((i) => { const g = kid35(lt - i * .035); return <Kid key={i} pose={{ ...kp, x: g.x, y: g.y }} sil={mixhex(k.sil, k.sky[2], .3)} opacity={.22 * (1 - i / 4) * (1 - smooth(.15, .45, lt))} />; })}
            <Kid pose={kp} sil={k.sil} far={FAR} rim={RIM(.6, -.8, .014)} rim2={{ dx: -.15, dy: 1, color: GOLD, width: .01 + .012 * form, glow: .9 }} />
            {strands(true)}
            <Moths t={c.t} at={moths(1)} color={GOLD} core={GOLD_CORE} glow={1.15} trail={4} />
            <Burst x={topRung.x} y={topRung.y} t={lt} t0={tB} dur={.7} n={26} r={300} color={GOLD} />
          </Layer>
          <Layer d={.5} blur={4}>
            <Speed seed={357} n={36} phase={lift35(lt) * 2} ux={0} uy={1} x0={-600} x1={2600} y0={cam.y * 2 - 2400} y1={cam.y * 2 + 1200} len={380} color={k.cloudLit} opacity={.45 * speed} width={3} />
            {[0, 1, 2].map((i) => <Wisp key={i} x={400 + i * 700} y={-300 - i * 1700} w={1300} h={110} color={k.cloudLit} opacity={.35} />)}
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 36. 긴 비행(2마디). 옆에서 따라가는 카메라. 다섯 겹의 도시가 서로 다른 빠르기로 지나가고 가까운 전선·기둥이 휙휙 스친다.
    //     처음엔 아래에서 화면으로 뛰어들고, 마디(31)에 지붕 사이로 내려갔다가 박에 솟구친다(나방 터짐)
    id: "a3-flyover", start: T36, key: "chorus", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt;
      const hh = handheld(c.t, 36, 7, .5);
      const kq = kid36(lt);
      const vy = (kid36(lt + .04).y - kid36(lt - .04).y) / .08;
      const camX = camX36(lt);
      const cam: Cam = { x: camX + hh.x, y: 540 + (kq.y - 470) * .55 + hh.y, zoom: 1 + .04 * Math.sin(lt * .9), rot: hh.r + clamp(vy / 40000, -.035, .035), focus: 1, dof: 2.6 };
      const pitch = clamp(vy / 1600, -.45, .45);
      const burst = blip(lt, tB31, .05, .5);
      const kp = pose({
        ...P.hang, anchor: "center", x: kq.x, y: kq.y, s: 240, facing: 1, rot: .62 + pitch * .7 + .06 * n2(361, c.t * 1.3),
        armN: [2.8, .06], armF: [mix(1.25, 2.3, burst) + .15 * n2(362, c.t * 2), .45],
        legN: [-.2 + .25 * n2(363, c.t * 2.5) - pitch * .5, .6 + .2 * n2(364, c.t * 3)], legF: [-.55 + .25 * n2(365, c.t * 2.5), .95], toe: 1,
        swing: 1.25 + .45 * n2(366, c.t * 4), headTilt: -.5 - pitch * .3, faceDir: .2,
        face: .55 + burst * .35, faceColor: WARM, smile: 1, eyes: 1,
      });
      const sk = skeleton(kp);
      const tEnd = { x: sk.haN.x + 760, y: sk.haN.y - 1600 };
      const tCtl = { x: sk.haN.x + 260, y: sk.haN.y - 700 };
      const trailAt = (tt: number) => stream(367, 46, tt, (u) => {
        const q = kid36(tt - T36 - (1 - u) * .85);
        return { x: q.x - 40, y: q.y + 60 };
      }, { speed: .75, spread: 75, size: 7 });
      const poles = Array.from({ length: 9 }, (_, i) => 2400 + i * 2700);
      return (
        <Scene cam={cam}>
          <SkyL k={k} t={c.t} horizon={980} stars={.9} glow={.65} />
          <MoonL k={k} t={c.t} x={1480} y={235} r={185} rays={.9} pulse={burst * .5} />
          <Layer d={30} blur={0}>
            <Wisp x={500} y={330} w={1500} color={k.cloudLit} opacity={.22} t={c.t} drift={-30} />
            <Wisp x={1700} y={460} w={1700} color={k.cloudLit} opacity={.18} t={c.t} drift={-40} />
            <Wisp x={2600} y={250} w={1200} color={k.cloudLit} opacity={.15} t={c.t} drift={-30} />
          </Layer>
          <Layer d={14} blur={0}>
            <Skyline seed={371} base={1010} minH={140} maxH={360} minW={40} maxW={120} color={mixhex(k.fog, k.sky[3], .3)} t={c.t} win={{ density: .14, size: .45, warm: k.win, cold: k.cold }} details={false} x0={-800} x1={3400} />
          </Layer>
          <Layer d={5}>
            <Skyline seed={372} base={1130} minH={260} maxH={600} minW={70} maxW={170} color={mixhex(k.silFar, k.fog, .5)} t={c.t} win={{ density: .2, size: .7, warm: k.win, cold: k.cold }} x0={-800} x1={4600} />
          </Layer>
          <Layer d={2.2}>
            <Skyline seed={373} base={1260} minH={250} maxH={520} minW={120} maxW={260} color={mixhex(k.silFar, k.sil, .5)} t={c.t} win={{ density: .18, size: 1, warm: k.win, cold: k.cold, coldRatio: .4 }} x0={-600} x1={7600} />
          </Layer>
          <Layer d={1.35} blur={0}>
            <Skyline seed={374} base={1420} minH={200} maxH={430} minW={150} maxW={300} color={k.sil} t={c.t} win={{ density: .12, size: 1.4, warm: k.win, cold: k.cold, coldRatio: .45 }} x0={-400} x1={10400} />
          </Layer>
          <Layer d={1}>
            <Moths t={c.t} at={trailAt} color={GOLD} trail={4} />
            <Thread d={qD(sk.haN, tCtl, tEnd)} color={THREAD} width={3} glow={1.2} />
            <Glow x={sk.head.x} y={sk.head.y} r={210} color={GOLD} opacity={.18 + burst * .3} />
            <Kid pose={kp} sil={k.sil} far={FAR} rim={RIM(.7, -.7)} rim2={{ dx: -.6, dy: .6, color: GOLD, width: .009, glow: .5 }} />
            <Burst x={sk.pelvis.x - 60} y={sk.pelvis.y + 40} t={lt} t0={tB31} dur={.9} n={34} r={380} color={GOLD} />
          </Layer>
          <Layer d={.62} blur={0}>
            <Bokeh seed={375} n={80} x0={0} x1={17000} y0={620} y1={1250} r0={22} r1={80} colors={[k.win, k.win, PINK, k.cold, GOLD]} t={c.t} opacity={.9} />
          </Layer>
          <Layer d={.42} blur={10}>
            {poles.map((x, i) => <rect key={i} x={x} y={-400} width={70} height={2000} fill={k.sil} />)}
            {poles.slice(0, -1).map((x, i) => (
              <g key={"w" + i} stroke={k.sil} strokeWidth={9} fill="none">
                <path d={`M${x + 35},${-60}Q${x + 1385},${170} ${x + 2735},${-60}`} />
                <path d={`M${x + 35},${10}Q${x + 1385},${250} ${x + 2735},${10}`} />
              </g>
            ))}
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 37. 큰 창 한 줄이 스쳐 간다(다섯 개). 창마다 폰 빛에 갇힌 실루엣 하나: 엎드림 · 침대 끝에 웅크림 · 누움 · 바닥에 앉음 · 의자.
    //     창틀(정면 층)·기둥·전선만 빠르게 흐리고 방 안의 인물은 또렷하다(방은 조금 더 깊은 층이라 틀 안에서 미끄러진다).
    //     지붕선 위 하늘을 나는 아이의 금빛이 창마다 위에서 쏟아져 지나가며 얼굴을 잠깐 금빛으로 바꾸고, 인물은 고개를 살짝 든다
    id: "a3-windows", start: T37, key: "chorus", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt;
      const hh = handheld(c.t, 37, 5, .6);
      const camX = camX37(lt);
      const cam: Cam = { x: camX + hh.x, y: 540 + hh.y, zoom: 1, rot: hh.r, focus: 1.4, dof: 2 };
      const F = F37(lt);
      const vF = (F37(lt + .02) - F37(lt - .02)) / .04;
      const blurX = clamp((vF / 30) * .3, 2, 40);
      const ks = kidS37(lt);
      const kx = camX - 960 + ks.x, ky = ks.y;
      const kp = pose({
        ...P.hang, anchor: "center", x: kx, y: ky, s: 330, facing: 1, rot: .78 + .05 * n2(371, c.t), armN: [2.75, .06], armF: [1.2 + .12 * n2(372, c.t * 2), .45],
        legN: [-.3 + .2 * n2(373, c.t * 3), .55], legF: [-.65, .85], toe: 1, swing: 1.45 + .3 * n2(374, c.t * 4), headTilt: .3, faceDir: .2,
        face: .45, faceColor: WARM, eyes: .9,
      });
      const sk = skeleton(kp);
      // 화면에 걸리는 창만(창 가장자리 + 여유 50px)
      const i0 = Math.ceil((F - OW37 / 2 - 50) / SP37), i1 = Math.floor((F + 1920 + OW37 / 2 + 50) / SP37);
      const idx = Array.from({ length: i1 - i0 + 1 }, (_, n) => i0 + n);
      const wi = (i: number) => ((i % WHO37.length) + WHO37.length) % WHO37.length;
      /** 창 i가 아이 빛 아래에 얼마나 가까운가(0..1) */
      const warmAt = (i: number, l: number) => Math.exp(-Math.pow((i * SP37 - F37(l) - XL37) / 380, 2));
      const fx0 = 960 + F; // 정면 층 좌표에서 화면 가운데
      const wallD = (() => {
        let d = `M${fx0 - 1060},${ROOF37}H${fx0 + 1060}V1180H${fx0 - 1060}Z`;
        for (const i of idx) { const x = i * SP37 - OW37 / 2; d += `M${x},${OY37}V${OY37 + OH37}H${x + OW37}V${OY37}Z`; }
        return d;
      })();
      const lightX = XL37 + F;
      const wall = mixhex(k.silFar, k.sil, .42), wallTop = mixhex(k.silFar, k.fog, .35), frameC = mixhex(k.sil, k.silFar, .3);
      const poleX = (lp: number) => 960 + (camX37(lp) - 960) / .5;
      const poles = [poleX(.86), poleX(1.9)];
      return (
        <Scene cam={cam}>
          <SkyL k={k} t={c.t} horizon={330} glow={.8} stars={.6} y0={-500} />
          <Layer d={5} blur={1}>
            <Skyline seed={379} base={345} minH={70} maxH={230} minW={60} maxW={160} color={mixhex(k.fog, k.sky[2], .35)} t={c.t} win={{ density: .12, size: .6, warm: k.win, cold: k.cold }} details={false} x0={-900} x1={2600 + (camX - 960) / 5} />
          </Layer>
          {/* 방 안(깊은 층, 흐림 없음): 인물이 또렷하게 */}
          <Layer d={DR37} blur={0}>
            {idx.map((i) => (
              <LonelyRoom key={i} cx={roomX37(i)} y0={OY37} w={OW37} h={OH37} k={k} t={c.t} seed={377 + i * 13} who={WHO37[wi(i)]} facing={FC37[wi(i)]} s={S37[wi(i)]}
                warm={warmAt(i, lt)} look={smooth(.2, .85, warmAt(i, lt - .1))} lx={XL37 + (camX - 960) / DR37} />
            ))}
          </Layer>
          {/* 정면(창틀·벽): 빠르게 지나가니 가로로만 흐린다 */}
          <Layer d={DW37} blur={0} defs={
            <>
              <filter id="a3mb37" x="-3%" y="-3%" width="106%" height="106%"><feGaussianBlur stdDeviation={`${blurX.toFixed(1)} 0`} /></filter>
              <clipPath id="a3wall37"><path d={wallD} clipRule="evenodd" /></clipPath>
              <linearGradient id="a3wg37" x1="0" y1={ROOF37} x2="0" y2={1100} gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={wallTop} /><stop offset="30%" stopColor={wall} /><stop offset="100%" stopColor={mixhex(wall, k.sil, .55)} />
              </linearGradient>
            </>
          }>
            <g filter="url(#a3mb37)">
              <path d={wallD} fill="url(#a3wg37)" fillRule="evenodd" />
              <g clipPath="url(#a3wall37)">
                {[i0 - 1, ...idx].map((i) => <rect key={"p" + i} x={(i + .5) * SP37 - 75} y={ROOF37} width={150} height={900} fill={mixhex(wall, k.silFar, .3)} />)}
                {[i0 - 1, ...idx].map((i) => <rect key={"q" + i} x={(i + .5) * SP37 + 66} y={ROOF37} width={12} height={900} fill={mixhex(wall, k.sil, .6)} />)}
                {idx.map((i) => <Glow key={"c" + i} x={i * SP37} y={OY37 + OH37 + 60} r={420} rx={520} ry={220} color={k.cold} opacity={.12} />)}
                <Glow x={lightX} y={ROOF37 + 30} r={760} rx={860} ry={560} color={GOLD} opacity={.36} />
              </g>
              {idx.map((i) => <Win37 key={"w" + i} x={i * SP37 - OW37 / 2} k={k} frame={frameC} wall={wall} seed={i} warm={warmAt(i, lt)} />)}
              {/* 처마: 하늘 빛을 받은 윗변 */}
              <rect x={fx0 - 1060} y={ROOF37 - 36} width={2120} height={50} fill={frameC} />
              <rect x={fx0 - 1060} y={ROOF37 - 38} width={2120} height={5} fill={mixhex(k.glow, k.sky[2], .35)} opacity={.8} />
              <rect x={fx0 - 1060} y={ROOF37 + 14} width={2120} height={18} fill={mixhex(frameC, k.sil, .5)} />
              <Glow x={lightX} y={ROOF37 - 30} r={380} rx={560} ry={70} color={GOLD} opacity={.55} />
            </g>
          </Layer>
          <Layer d={1}>
            <Glow x={sk.pelvis.x + 40} y={sk.pelvis.y} r={330} color={GOLD} opacity={.3} />
            <Moths t={c.t} at={(tt) => stream(378, 34, tt, (u) => { const l = tt - T37 - (1 - u) * .55; const s2 = kidS37(l); return { x: camX37(l) - 960 + s2.x - 60, y: s2.y + 15 }; }, { speed: .9, spread: 40, size: 6.5 })} color={GOLD} trail={4} />
            <Thread d={qD(sk.haN, { x: sk.haN.x + 110, y: sk.haN.y - 260 }, { x: sk.haN.x + 380, y: sk.haN.y - 900 })} color={THREAD} width={3} glow={1.2} />
            <Kid pose={kp} sil={k.sil} far={FAR} rim={{ dx: -.2, dy: -1, color: k.rim, width: .012, glow: .6 }} rim2={{ dx: .4, dy: .9, color: GOLD, width: .012, glow: .7 }} />
          </Layer>
          {/* 전경: 카메라 앞을 휙 지나는 기둥과 처진 전선(흐림) */}
          <Layer d={.5} blur={13}>
            {poles.map((x, i) => <rect key={i} x={x - 55} y={-400} width={110} height={2000} fill={k.sil} />)}
            {poles.map((x, i) => (
              <g key={"w" + i} stroke={k.sil} strokeWidth={8} fill="none">
                <path d={`M${x - 3400},${960}Q${x - 1700},${1150} ${x},${960}Q${x + 1700},${1150} ${x + 3400},${960}`} />
                <path d={`M${x - 3400},${1010}Q${x - 1700},${1190} ${x},${1010}Q${x + 1700},${1190} ${x + 3400},${1010}`} />
              </g>
            ))}
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 38. 휙 패닝(반 마디)이 한 창에서 멈춘다: 분홍 방울의 친구. 금빛 나방 몇 마리가 패닝을 따라 그 창으로 간다
    id: "a3-whip", start: T38, key: "chorus", enter: { type: "whip", dir: 1 },
    render: (c) => {
      const lt = c.lt;
      const hh = handheld(c.t, 38, 3);
      const camX = camX38(lt);
      const v = (camX38(lt + .015) - camX38(lt - .015)) / .03;
      const cam: Cam = { x: camX + hh.x, y: 540 + hh.y, zoom: Z38 + .08 * ease("sineIO", lin(.35, c.dur, lt)), rot: hh.r, focus: 1.25, dof: 3 };
      const blurX = Math.abs(v / D38 / 30) * .5;
      const cells: React.ReactNode[] = [];
      for (let i = -6; i <= 2; i++) {
        for (let r = -1; r < 2; r++) {
          const x = XF38 - 220 + i * 620, y = 290 + r * 640;
          const isF = i === 0 && r === 0;
          const v2 = rnd(381, i * 3 + r + 50);
          cells.push(
            <g key={`${i}-${r}`}>
              <Glow x={x + 220} y={y + 250} r={420} color={isF ? PINK : k.cold} opacity={isF ? .14 : .1} />
              <LonelyWin x={x} y={y} w={440} h={500} k={k} t={c.t} seed={i * 5 + r * 11 + 300} who={isF ? "friend" : Math.abs(i) <= 1 && r === 0 ? (v2 < .5 ? "dark" : "tv") : v2 < .6 ? "kid" : v2 < .75 ? "tv" : v2 < .85 ? "warm" : "dark"} frame={mixhex(k.silFar, k.sil, .5)} facing={isF ? -1 : undefined} accent={PINK} gold={isF ? .25 * smooth(.2, .69, lt) : 0} />
            </g>,
          );
        }
      }
      const cxw = 960 + (camX - 960) / D38;
      return (
        <Scene cam={cam}>
          <Layer d={D38} defs={<filter id="a3mb38" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation={`${blurX.toFixed(1)} 0`} /></filter>}>
            <g filter="url(#a3mb38)">
              <rect x={cxw - 2000} y={-800} width={4000} height={2800} fill={mixhex(k.silFar, k.sil, .4)} />
              {[-1, 0, 1, 2].map((r) => <rect key={r} x={cxw - 2000} y={170 + r * 640} width={4000} height={40} fill={mixhex(k.silFar, k.sil, .7)} />)}
              {cells}
            </g>
          </Layer>
          <Layer d={1}>
            <Moths t={c.t} at={(tt) => {
              const l = tt - T38;
              return Array.from({ length: 6 }, (_, i) => {
                const w = ease("out", lin(-.2 + i * .05, .6 + i * .05, l));
                const tx = camX38(.69) + 330 + (i % 3) * 70, ty = 340 + Math.floor(i / 3) * 130;
                return { x: mix(camX38(l) - 1100 - i * 90, tx, w) + Math.sin(tt * 9 + i) * 18, y: mix(700 + i * 40, ty, w) + Math.cos(tt * 8 + i) * 14, s: 7, a: .3, f: tt * 18 + i, b: 1 };
              });
            }} color={GOLD} trail={4} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 39. CU 창 안의 친구. 2번 컷의 거울: 밝은 창(달빛 도시)을 등진 옆모습(왼쪽을 본다), 폰 빛만 얼굴에. 천천히 밀어 들어감.
    //     끝 박(137)에 창밖 멀리 금빛 점 하나(나방)가 다가온다. 친구는 아직 모른다
    id: "a3-friend", start: T39, key: "chorus", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt;
      const hh = handheld(c.t, 39, 2.5, .25);
      const cam: Cam = { x: 950 + hh.x - 20 * ease("sineIO", lin(0, c.dur, lt)), y: 520 + hh.y, zoom: kf(lt, [[0, 1], [c.dur, 1.08, "sineIO"]]), rot: hh.r, focus: 1, dof: 6 };
      const tMoth = at(137, T39);
      const scroll = Math.max(0, Math.sin(lt * 4.2)) * .12;
      const fp = pose({
        ...lerpPose(P.sitKnees, P.phone, .9), anchor: "center", x: 1190, y: 990, s: 1050, facing: -1, phone: 1, phoneHand: 0,
        headTilt: .36 + .03 * Math.sin(lt * 1.3), faceDir: .12, face: .95, faceColor: k.cold, eyes: .5 + .05 * Math.sin(lt * 2) - (Math.abs(lt - .42) < .06 ? .5 : 0), swing: .2,
        armN: [.6, 1.4], armF: [.5, 1.5],
      });
      const sk = skeleton(fp);
      const ph = { x: mix(sk.haN.x, sk.haF.x, .35), y: mix(sk.haN.y, sk.haF.y, .35) };
      const win = { x: 1090, y: 70, w: 830, h: 780 };
      const wall = mixhex(k.sil, k.silFar, .22);
      const mothOn = smooth(tMoth - .3, tMoth + .2, lt);
      return (
        <Scene cam={cam}>
          <SkyL k={k} t={c.t} horizon={760} glow={.8} />
          <MoonL k={k} t={c.t} x={1660} y={210} r={74} glow={1.2} blur={3} />
          <Layer d={7}>
            <Skyline seed={391} base={1000} minH={140} maxH={420} minW={60} maxW={150} color={mixhex(k.silFar, k.fog, .45)} t={c.t} win={{ density: .26, size: .8, warm: k.win, cold: k.cold }} x0={300} x1={2600} />
          </Layer>
          <Layer d={3} blur={0}>
            <g opacity={mothOn}>
              <Moths t={c.t} at={(tt) => { const l = tt - T39; const w = ease("out", lin(tMoth - .3, c.dur + .4, l)); return [{ x: mix(1950, 1560, w) + Math.sin(tt * 7) * 30, y: mix(150, 360, w) + Math.cos(tt * 9) * 20, s: 6, a: 2.6, f: tt * 18, b: 1 }]; }} color={GOLD} trail={4} />
            </g>
          </Layer>
          <Layer d={1.25}>
            <path d={`M-1000,-1000H3000V2200H-1000Z M${win.x},${win.y}V${win.y + win.h}H${win.x + win.w}V${win.y}Z`} fill={wall} fillRule="evenodd" />
            <Glow x={ph.x - 300} y={ph.y - 120} r={700} color={k.cold} opacity={.22 * (.85 + scroll)} />
            <WindowFrame x={win.x} y={win.y} w={win.w} h={win.h} frame={mixhex(wall, k.silFar, .3)} thick={28} reflect={.06} />
            <Curtain x={win.x + win.w - 30} y={win.y - 40} w={-140} h={win.h + 120} color={mixhex(wall, k.silFar, .2)} t={c.t} wind={.08} side={-1} />
            <rect x={-1000} y={win.y + win.h + 28} width={4000} height={40} fill={mixhex(wall, k.silFar, .4)} />
          </Layer>
          <Layer d={1}>
            <path d={`M${sk.head.x},${sk.head.y}L${sk.shN.x},${sk.shN.y}L${sk.elN.x},${sk.elN.y}L${sk.haN.x},${sk.haN.y}L${sk.haF.x},${sk.haF.y}L${sk.neck.x},${sk.neck.y}Z`} fill={k.sil} stroke={k.sil} strokeWidth={fp.s * .06} strokeLinejoin="round" />
            <ellipse cx={mix(sk.head.x, mix(sk.haN.x, sk.haF.x, .5), .5)} cy={mix(sk.head.y, mix(sk.haN.y, sk.haF.y, .5), .55)} rx={fp.s * .1} ry={fp.s * .14} fill={k.sil} />
            <Kid pose={fp} variant="friend" accent={PINK} sil={k.sil} far={k.sil} phoneColor={k.cold} rim={{ dx: 1, dy: -.25, color: mixhex(k.glow, "#ffffff", .35), width: .007, glow: .8 }} />
          </Layer>
          <Layer d={1} blend="screen">
            <Glow x={ph.x} y={ph.y} r={520} color={k.cold} opacity={.28 + scroll} />
            <Glow x={sk.head.x - 60} y={sk.head.y + 40} r={260} color={k.cold} opacity={.12} />
          </Layer>
          <Layer d={.6}>
            <path d={`M-200,1300L-200,920Q120,860 420,930Q700,990 860,1300Z`} fill={mixhex(k.sil, k.silFar, .15)} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 40. INS 유리(4번의 거울). 나방이 박(138·139·140)마다 유리를 톡 — 금빛 번짐. 둘째 톡에 친구가 고개를 든다.
    //     셋째 톡에 실을 잡은 아이가 창밖 아래에서 떠오르고(초점이 유리 → 아이로), 박(141)에 손을 흔든다
    id: "a3-tap", start: T40, key: "chorus", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt;
      const taps = [0, at(139, T40), at(140, T40)];
      const tWave = at(141, T40);
      const hh = handheld(c.t, 40, 3);
      const rise = ease("expoOut", lin(taps[2] - .25, taps[2] + .55, lt));
      const cam: Cam = { x: mix(1180, 960, rise) + hh.x + 40 * rise, y: mix(470, 540, rise) + hh.y, zoom: kf(lt, [[0, 1.42], [taps[2] - .2, 1.36], [taps[2] + .7, 1.0, "expoOut"]]), rot: hh.r, focus: kf(lt, [[0, 1], [taps[2] - .1, 1], [taps[2] + .45, 1.8, "io"]]), dof: 7 };
      const T0 = { x: 1270, y: 420 };
      const near = Math.min(...taps.map((t0) => Math.abs(lt - t0)));
      const z = clamp(near / .28);
      const leave = ease("in", lin(taps[2] + .15, taps[2] + .9, lt));
      const moth: M = { x: T0.x + (1 - z) * 6 + n2(401, c.t * 2) * 40 * z + leave * -40, y: T0.y + n2(402, c.t * 2) * 25 * z + leave * 120, s: mix(58, 36, z) * (1 - leave * .4), a: -.4, f: lt * (z < .3 ? 6 : 20), b: 1 };
      const look = ease("out", lin(taps[1] + .08, taps[1] + .5, lt));
      const fh = pose({ ...P.stand, anchor: "center", x: 260, y: 1660, s: 1500, facing: 1, lean: .05, headTilt: mix(.55, -.3, look), faceDir: mix(.0, .25, look), face: mix(.45, .85, look), faceColor: mixhex(k.cold, WARM, look), eyes: mix(.5, 1.15, look), swing: .2 });
      const kq = { x: 1250 + 20 * Math.sin(lt * 1.3), y: mix(1500, 560, rise) + 10 * Math.sin(lt * 2.4) };
      const wave = lt > tWave - .1 ? Math.sin((lt - tWave + .1) * 13) : 0;
      const kp = pose({
        ...P.hang, anchor: "center", x: kq.x, y: kq.y, s: 340, facing: -1, rot: -.05, armN: [3.05, .05],
        armF: lt > tWave - .25 ? [mix(.4, 2.55, smooth(tWave - .25, tWave, lt)), .5 + .45 * wave] : [.35, .5],
        legN: [.5, .9], legF: [.1, 1.1], headTilt: -.05, faceDir: .75, face: .95, faceColor: WARM, smile: lt > tWave - .2 ? 1 : 0, eyes: 1.05, swing: .2,
      });
      const ksk = skeleton(kp);
      const win = { x: 160, y: -200, w: 1760, h: 1150 };
      const wall = mixhex(k.sil, k.silFar, .2);
      return (
        <Scene cam={cam}>
          <SkyL k={k} t={c.t} horizon={1050} glow={.7} />
          <MoonL k={k} t={c.t} x={1720} y={150} r={120} rays={.6} glow={1.1} blur={4} />
          <Layer d={6}>
            <Skyline seed={401} base={1220} minH={200} maxH={520} minW={70} maxW={170} color={mixhex(k.silFar, k.fog, .45)} t={c.t} win={{ density: .24, size: .9, warm: k.win, cold: k.cold }} x0={-400} x1={2600} />
          </Layer>
          <Layer d={1.8}>
            <Thread d={`M${ksk.haN.x},${ksk.haN.y}L${ksk.haN.x + 40},${ksk.haN.y - 1800}`} color={THREAD} width={3} glow={1.2} opacity={mix(.35, 1, rise)} />
            <Glow x={ksk.head.x} y={ksk.head.y} r={300} color={GOLD} opacity={.3 * rise} />
            <Kid pose={kp} sil={k.sil} far={FAR} rim={RIM(-.6, -.6, .012, GOLD)} />
            <Moths t={c.t} at={(tt) => swarm(403, 14, tt, { cx: kq.x, cy: kq.y - 40, rx: 260, ry: 200, size: 5, speed: .5 }).map((m) => ({ ...m, b: m.b * rise }))} color={GOLD} />
          </Layer>
          <Layer d={1}>
            {/* 유리: 방 안 폰 빛이 비친 자국 + 톡 할 때마다 금빛 번짐과 물결 */}
            <Glow x={420} y={900} r={420} color={k.cold} opacity={.12 * (1 - look)} />
            {taps.map((t0, i) => {
              const a = lt - t0;
              if (a < -.02) return null;
              const fade = Math.exp(-Math.max(0, a) * 2.6);
              return (
                <g key={i}>
                  <Glow x={T0.x + i * 6} y={T0.y + 4} r={150 + 90 * ease("expoOut", a / .4)} color={GOLD} opacity={.8 * fade} />
                  <circle cx={T0.x + i * 6} cy={T0.y + 4} r={30 + 300 * ease("expoOut", clamp(a / .8))} fill="none" stroke={GOLD_CORE} strokeWidth={4} opacity={.6 * (1 - clamp(a / .8))} />
                </g>
              );
            })}
            <Moths t={c.t} at={() => [moth]} color={GOLD} />
            <WindowFrame x={win.x} y={win.y} w={win.w} h={win.h} frame={wall} thick={70} cross={false} reflect={.08} />
            <rect x={1000} y={win.y} width={46} height={win.h} fill={wall} />
            <rect x={-500} y={win.y + win.h} width={3000} height={600} fill={mixhex(wall, k.silFar, .25)} />
          </Layer>
          <Layer d={.55}>
            <Kid pose={fh} variant="friend" accent={PINK} sil={k.sil} rim={{ dx: .8, dy: -.6, color: mixhex(k.glow, GOLD, look), width: .006, glow: 0 }} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 41. 어깨 너머(밖에서). 창이 열리고, 아이가 손바닥을 위로 내민다. 친구는 박마다 폰(차가움)과 손(금빛)을 번갈아 본다.
    //     얼굴 반은 차갑고 반은 금빛. 마지막 박(145)에 폰이 내려가고 손이 올라온다
    id: "a3-hesitate", start: T41, key: "chorus", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt;
      const b1 = at(143, T41), b2 = at(144, T41), b3 = at(145, T41);
      const hh = handheld(c.t, 41, 3);
      const cam: Cam = { x: 990 + hh.x + 30 * ease("sineIO", lin(0, c.dur, lt)), y: 540 + hh.y, zoom: kf(lt, [[0, 1.0], [c.dur, 1.07, "sineIO"]]), rot: hh.r, focus: 1.22, dof: 5 };
      const open = ease("back", lin(0, .55, lt));
      const look = kf(lt, [[0, 0], [b1, 0], [b1 + .16, 1, "out"], [b2, 1], [b2 + .16, 0, "out"], [b3, 0], [b3 + .2, 1, "out"]]);
      const decide = ease("io", lin(b3, c.dur + .3, lt));
      const handK = { x: 690 + 18 * Math.sin(lt * 1.6), y: 735 + 8 * Math.sin(lt * 2.1) };
      const base: Partial<Pose> = {
        ...lerpPose(P.sitKnees, P.phone, .85), anchor: "center", x: 1190, y: 850, s: 760, facing: -1, phone: mix(1, .35, decide), phoneHand: 0,
        headTilt: mix(.42, -.1, look), faceDir: mix(.4, .78, look), face: 1, eyes: mix(.6, 1.15, look) - (Math.abs(lt - b2 - .1) < .06 ? .8 : 0), swing: .25,
        armN: [.6, 1.4], armF: [.5, 1.5],
      };
      const reachF = ikArm(base, 1, handK.x + 120, handK.y - 10);
      const fbase = { ...base, armF: [mix(.5, reachF.armF![0], decide * .6), mix(1.5, reachF.armF![1], decide * .6)] as [number, number] };
      const fsk = skeleton(fbase);
      const ph = { x: mix(fsk.haN.x, fsk.haF.x, .3), y: mix(fsk.haN.y, fsk.haF.y, .3) };
      const win = { x: 380, y: 130, w: 1100, h: 820 };
      const wallC = mixhex(k.silFar, k.sil, .55);
      const kidP = pose({ ...P.stand, anchor: "center", x: -60, y: 1180, s: 1600, facing: 1, headTilt: .12, lean: .1, faceDir: 0, swing: .4 });
      const ksk = skeleton(kidP);
      const hand = handGeo({ x: handK.x, y: handK.y, ang: -.12, s: 175, flip: -1, curl: [.12, .16, .22, .28], spread: .55, thumb: .1, sleeve: 0, sleeveW: .4 });
      const sh = { x: ksk.shN.x + 40, y: ksk.shN.y + 30 };
      const ax = handK.x - sh.x, ay = handK.y - sh.y, al = Math.hypot(ax, ay), nx = -ay / al, ny = ax / al;
      const armD = `M${sh.x + nx * 110},${sh.y + ny * 110}Q${sh.x + ax * .5 + nx * 70},${sh.y + ay * .5 + ny * 70} ${handK.x + nx * 62},${handK.y + ny * 62}L${handK.x - nx * 62},${handK.y - ny * 62}Q${sh.x + ax * .5 - nx * 60},${sh.y + ay * .5 - ny * 60} ${sh.x - nx * 110},${sh.y - ny * 110}Z`;
      const pulse = Math.max(blip(lt, b1, .05, .3), blip(lt, b3, .05, .4));
      return (
        <Scene cam={cam}>
          <Layer d={1.4}>
            <rect x={-600} y={-400} width={3200} height={1900} fill={mixhex(k.sil, k.silFar, .18)} />
            <Glow x={1100} y={650} r={700} color={k.cold} opacity={.25 * (1 - decide * .5)} />
            <Glow x={700} y={500} r={600} color={GOLD} opacity={.12 + .1 * pulse + .15 * decide} />
            <rect x={1400} y={250} width={260} height={360} fill={mixhex(k.sil, k.silFar, .3)} />
            <path d={`M-200,1010L2000,1010L2000,1600L-200,1600Z`} fill={mixhex(k.sil, k.silFar, .1)} />
          </Layer>
          <Layer d={1.22}>
            <path d={`M${fsk.head.x},${fsk.head.y}L${fsk.shN.x},${fsk.shN.y}L${fsk.elN.x},${fsk.elN.y}L${fsk.haN.x},${fsk.haN.y}L${fsk.neck.x},${fsk.neck.y}Z`} fill={k.sil} stroke={k.sil} strokeWidth={50} strokeLinejoin="round" />
            <Kid pose={pose({ ...fbase, faceColor: "#8fb4ff" })} variant="friend" accent={PINK} sil={k.sil} far={k.sil} phoneColor={k.cold} rim={{ dx: -1, dy: -.2, color: GOLD, width: .01, glow: .9 }} rim2={{ dx: .6, dy: .8, color: k.cold, width: .008, glow: .5 }} />
            <defs>
              <linearGradient id="a3half41" gradientUnits="userSpaceOnUse" x1={fsk.head.x - 95} y1={0} x2={fsk.head.x + 5} y2={0}>
                <stop offset="0%" stopColor="#fff" />
                <stop offset="100%" stopColor="#000" />
              </linearGradient>
              <mask id="a3halfm41" maskUnits="userSpaceOnUse" x={-2000} y={-2000} width={6000} height={6000}>
                <rect x={-2000} y={-2000} width={6000} height={6000} fill="url(#a3half41)" />
              </mask>
            </defs>
            <g mask="url(#a3halfm41)">
              <Kid pose={pose({ ...fbase, faceColor: "#ffaa3c", phone: 0 })} variant="friend" accent={PINK} sil={k.sil} far={k.sil} />
            </g>
          </Layer>
          <Layer d={1.22} blend="screen">
            <Glow x={ph.x} y={ph.y} r={300} color={k.cold} opacity={.35 * (1 - decide * .6)} />
          </Layer>
          <Layer d={1}>
            <path d={`M-1000,-1000H3000V2200H-1000Z M${win.x},${win.y}V${win.y + win.h}H${win.x + win.w}V${win.y}Z`} fill={wallC} fillRule="evenodd" />
            <WindowFrame x={win.x} y={win.y} w={win.w} h={win.h} frame={mixhex(wallC, k.sil, .3)} thick={34} open={open} glassTint={`rgba(255,176,200,.08)`} reflect={.1} />
            <Curtain x={win.x + win.w - 10} y={win.y - 10} w={-120} h={win.h + 10} color={mixhex(k.sil, k.silFar, .3)} t={c.t} wind={.55 * open} side={-1} seed={4} opacity={.9} />
            <rect x={win.x - 60} y={win.y + win.h + 20} width={win.w + 120} height={40} fill={mixhex(wallC, k.sil, .4)} />
          </Layer>
          <Layer d={.62}>
            <Thread d={`M${-80},${-200}L${ksk.head.x + 60},${ksk.head.y - 40}`} color={THREAD} width={4} glow={1.2} />
            <Kid pose={kidP} sil={k.sil} rim={RIM(1, -.1, .006, GOLD, 0)} />
            <Lit draw={(cc) => <g><path d={armD} fill={cc} />{hand.draw(cc)}</g>} fill={k.sil}
              rims={[{ dx: .5, dy: -1, color: GOLD, width: 4, glow: .8 }]}
              spill={[{ x: handK.x + 160, y: handK.y - 60, r: 280, color: GOLD, a: .5 + pulse * .3 }]} />
            <Moths t={c.t} at={(tt) => swarm(411, 26, tt, { cx: handK.x + 120, cy: handK.y - 70, rx: 190, ry: 130, size: 6, speed: .45 })} color={GOLD} trail={2} />
          </Layer>
          <Layer d={.62} blend="screen">
            <Glow x={handK.x + 130} y={handK.y - 70} r={320} color={GOLD} opacity={.3 + pulse * .35} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 42. ECU 두 손(2마디, 감정의 정점). 왼쪽(밖, 금빛) 아이의 손바닥이 기다리고, 오른쪽(안, 차가운 빛) 친구의 손이 망설이며 다가온다.
    //     B(37)에 손끝이 닿고 금빛이 터진다. 금빛이 친구 손과 방 안으로 번지고, 두 손이 천천히 맞잡힌다
    id: "a3-hands", start: T42, key: "chorus", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt, tT = tT42;
      const hh = handheld(c.t, 42, 2.2, .22);
      const touched = lt >= tT;
      const after = Math.max(0, lt - tT);
      const warm = touched ? ease("out", clamp(after / 1.6)) : 0;
      const breath = touched ? .015 * Math.exp(-after * 2) * Math.sin(after * 9) : 0;
      const slide = ease("io", lin(tT + .12, tT + 1.75, lt));
      const grab = ease("io", lin(tT + .45, tT + 2.1, lt));
      const cam: Cam = { x: mix(C42.x, CL42.x + 40, slide) + hh.x, y: mix(C42.y + 10, CL42.y + 30, slide) + hh.y, zoom: kf(lt, [[0, 1.0], [tT, 1.08, "sineIO"], [c.dur, 1.18, "sineIO"]]) + breath, rot: hh.r, focus: 1, dof: 9 };
      // 다가옴: 아이 손은 꾸준히, 친구 손은 멈칫(뒤로)했다가 다시
      const dK = 150 * (1 - ease("sineIO", lin(0, tT, lt)));
      const dF = kf(lt, [[0, 560], [1.25, 250, "io"], [1.75, 330, "io"], [2.3, 120, "io"], [tT, 0, "out"]]) + (touched ? 0 : 3 * n2(421, c.t * 9));
      const kw = { x: mix(KW42.x - dK, KC42.x, slide), y: mix(KW42.y, KC42.y, slide) + 6 * Math.sin(lt * 1.2) };
      const fw = { x: mix(FW42.x + dF, FC42.x, slide), y: mix(FW42.y, FC42.y, slide) - 4 * Math.sin(lt * 1.1) };
      const kh = handGeo({ x: kw.x, y: kw.y, ...KH0, ang: mix(KH0.ang, -.12, slide), curl: KCURL0.map((v, i) => mix(v, KCURL1[i], grab)), spread: mix(.4, .15, grab), thumb: mix(.1, .8, grab), sleeve: 4 });
      const fh = handGeo({ x: fw.x, y: fw.y, ...FH0, ang: mix(FH0.ang, Math.PI - .02, slide), curl: FCURL0.map((v, i) => mix(v, FCURL1[i], grab)), spread: mix(.5, .15, grab), thumb: mix(.2, .6, grab), sleeve: 4 });
      const cl = { x: mix(C42.x, CL42.x, slide), y: mix(C42.y, CL42.y, slide) };
      const gap = Math.hypot(kh.tip(1).x - fh.tip(0).x, kh.tip(1).y - fh.tip(0).y);
      const spark = touched ? 0 : smooth(160, 0, gap);
      const flash = blip(lt, tT, .04, .45);
      const coldRim = mixhex(k.cold, GOLD, warm);
      const warmR = mix(60, 1100, ease("out", clamp(after / 2.2)));
      const kRims = [{ dx: -.4, dy: -1, color: GOLD, width: 5, glow: .7 }, { dx: 1, dy: 0, color: GOLD_CORE, width: 3, glow: 1, opacity: spark + flash }];
      const fRims = [{ dx: .5, dy: .9, color: coldRim, width: 4, glow: .6 }, { dx: -.3, dy: -1, color: mixhex(k.rim, GOLD, warm), width: 3.5, glow: .5, opacity: .35 + warm * .65 }];
      const wr = Math.min(warmR * .7, 520) * (1 - grab * .45);
      const spillK = [{ x: cl.x, y: cl.y, r: wr, color: GOLD, a: (.22 + warm * .3) * (1 - grab * .45) }];
      const spillF = [{ x: fw.x + 160, y: fw.y + 260, r: 520, color: k.cold, a: .32 * (1 - warm) }, { x: cl.x, y: cl.y, r: wr, color: GOLD, a: warm * .38 * (1 - grab * .45) }];
      const kFingerRims = [...kRims, { dx: .2, dy: 1, color: GOLD_CORE, width: 3, glow: .6, opacity: grab }];
      const room = mixhex(mixhex(k.sil, k.silFar, .25), "#5a2448", warm * .75);
      return (
        <Scene cam={cam}>
          <Layer d={8} blur={0}>
            <SkyFill k={k} y0={-500} y1={1400} glowX={500} glowY={300} glowR={900} glowOpacity={.45} />
            <Glow x={260} y={140} r={520} color={k.moon} opacity={.55} />
            <Bokeh seed={421} n={22} x0={-400} x1={1050} y0={-300} y1={1300} r0={30} r1={110} colors={[k.win, PINK, GOLD, k.glow]} t={c.t} drift={-6} />
            <rect x={1080} y={-800} width={2000} height={2800} fill={room} />
            <Glow x={1700} y={900} r={700} color={k.cold} opacity={.28 * (1 - warm)} />
            <Glow x={C42.x + 200} y={C42.y} r={warmR * 1.3} color={GOLD} opacity={.35 * warm} />
            <Bokeh seed={422} n={12} x0={1150} x1={2300} y0={-200} y1={1300} r0={40} r1={120} colors={warm > .5 ? [GOLD, k.win, PINK] : [k.cold, k.cold, "#7f8fd0"]} t={c.t} opacity={.6 + .3 * warm} />
          </Layer>
          <Layer d={2.2} blur={16}>
            <rect x={1040} y={-800} width={130} height={2800} fill={mixhex(k.sil, k.silFar, .35)} />
          </Layer>
          <Layer d={3.2} blur={7}>
            <Moths t={c.t} at={(tt) => swarm(423, 14, tt, { cx: 640, cy: 420, rx: 700, ry: 420, size: 9, speed: .18 })} color={GOLD} wings={false} glow={1.4} />
          </Layer>
          <Layer d={1}>
            <Lit draw={(cc) => kh.draw(cc, "base")} fill={k.sil} rims={kRims} spill={spillK} />
            <Lit draw={(cc) => fh.draw(cc)} fill={k.sil} rims={fRims} spill={spillF} />
            <Lit draw={(cc) => kh.draw(cc, "fingers")} fill={k.sil} rims={kFingerRims} spill={spillK} />
          </Layer>
          <Layer d={1} blend="screen">
            {spark > .01 ? <Glow x={(kh.tip(1).x + fh.tip(0).x) / 2} y={(kh.tip(1).y + fh.tip(0).y) / 2} r={40 + 50 * spark} color={GOLD_CORE} opacity={spark * .9} /> : null}
            <Glow x={cl.x} y={cl.y} r={420} color={GOLD} opacity={flash * .9 + warm * (.18 + c.pulse * .08)} />
            <Glow x={cl.x - 20} y={cl.y + 30} r={150} color={GOLD} opacity={grab * (.35 + c.pulse * .15)} />
            <Burst x={C42.x} y={C42.y} t={lt} t0={tT} dur={1.6} n={44} r={560} color={GOLD} />
            <Burst x={C42.x} y={C42.y} t={lt} t0={tT + .08} dur={1.1} n={18} r={260} color="#ffffff" seed={4} />
            <Moths t={c.t} at={(tt) => {
              const l = tt - T42;
              const w = smooth(tT, tT + .8, l);
              const sl = ease("io", lin(tT + .12, tT + 1.75, l));
              return swarm(424, 22, tt, { cx: mix(C42.x, CL42.x, sl) - 30, cy: mix(C42.y, CL42.y, sl) - 10, rx: mix(60, 380, w), ry: mix(40, 200, w), size: 5, speed: .4 }).map((m) => ({ ...m, b: m.b * w }));
            }} color={GOLD} trail={3} />
          </Layer>
          <Layer d={.45} blur={18}>
            <Moths t={c.t} at={(tt) => swarm(425, 3, tt, { cx: 900, cy: 600, rx: 1100, ry: 600, size: 30, speed: .12 })} color={GOLD} wings={false} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 43. WS 길 위. 손잡은 둘이 친구의 창에서 튀어나와 길 위로 솟는다. 박(156)에 실이 한 번 더 당겨 둘이 함께 솟구친다. 나방이 창에서 따라 나온다
    id: "a3-together", start: T43, key: "chorus", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt, tS = at(156, T43);
      const hh = handheld(c.t, 43, 5);
      const pathX = (l: number) => kf(l, [[0, 1420], [tS, 1000, "out"], [2.73, 560, "io"]]);
      const pathY = (l: number) => kf(l, [[0, 700], [.55, 600, "out"], [tS, 420, "io"], [2.73, -60, "expoIn"]]);
      const surge = blip(lt, tS, .06, .45);
      const cam: Cam = { x: kf(lt, [[0, 1080], [2.73, 860, "io"]]) + hh.x, y: kf(lt, [[0, 560], [1.0, 520, "io"], [2.73, 250, "io"]]) + hh.y, zoom: kf(lt, [[0, 1.04], [2.73, .98, "io"]]), rot: hh.r + .02 * Math.sin(lt * 1.3), focus: 1, dof: 2.4 };
      const px = pathX(lt), py = pathY(lt);
      const vx = (pathX(lt + .03) - pathX(lt - .03)) / .06, vy = (pathY(lt + .03) - pathY(lt - .03)) / .06;
      const tilt = clamp(Math.atan2(-vx, -vy), -1.2, 1.2);
      const swingF = ease("out", lin(tS - .1, tS + .6, lt));
      const kidP = pose({ ...P.hang, anchor: "center", x: px, y: py, s: 290, facing: -1, rot: .25 + Math.abs(tilt) * .3, armN: [3.05, .05], armF: [-.6, .4], legN: [-.2 + .2 * n2(431, c.t * 3), .7], legF: [-.55, .9], toe: 1, swing: 1.3 + .3 * n2(432, c.t * 4), headTilt: -.3, faceDir: .45, face: .6, faceColor: WARM, smile: 1 });
      const fx = px + mix(150, 80, swingF), fy = py + mix(190, 70, swingF);
      const friP = pose({ ...P.fly, anchor: "center", x: fx, y: fy, s: 280, facing: -1, rot: mix(.3, .95, swingF), armN: [2.5, .1], armF: [mix(1.0, 2.6, swingF), .4], legN: [mix(.4, -.1, swingF) + .2 * n2(433, c.t * 3), .7], legF: [mix(.1, -.4, swingF), .9], swing: 1.4 + .3 * n2(434, c.t * 4), headTilt: -.4, faceDir: .5, face: .55, faceColor: WARM, mouth: lt < tS ? .7 : 0, smile: lt > tS ? 1 : 0, eyes: 1.15 });
      const hold = holdHands(kidP, 1, friP, 0, .5, 10);
      const ksk = skeleton(hold.a);
      const mv = { x: 260, y: -40 };
      const mw = unproject(cam, 1, project(cam, 60, mv.x, mv.y).x, project(cam, 60, mv.x, mv.y).y);
      const winF = { x: 1390, y: 520, w: 380, h: 420 };
      return (
        <Scene cam={cam}>
          <SkyL k={k} t={c.t} horizon={1000} glow={.7} />
          <MoonL k={k} t={c.t} x={mv.x} y={mv.y} r={140} rays={1} pulse={surge * .5} />
          <Layer d={9}>
            <Skyline seed={435} base={1150} minH={200} maxH={520} minW={60} maxW={150} color={mixhex(k.fog, k.sky[3], .25)} t={c.t} win={{ density: .2, size: .6, warm: k.win, cold: k.cold }} x0={-800} x1={2600} details={false} />
          </Layer>
          <Layer d={2}>
            <rect x={-900} y={-1600} width={1180} height={3400} fill={mixhex(k.silFar, k.sil, .45)} />
            {Array.from({ length: 12 }, (_, r) => [0, 1].map((cc) => {
              const v2 = rnd(436, r * 2 + cc);
              const x = -520 + cc * 360, y = -1400 + r * 250;
              return <rect key={`${r}-${cc}`} x={x} y={y} width={200} height={150} fill={v2 < .25 ? k.cold : v2 < .5 ? k.win : mixhex(k.sil, k.silFar, .3)} opacity={v2 < .5 ? .7 : 1} />;
            }))}
          </Layer>
          <Layer d={1}>
            <rect x={1240} y={-1800} width={1800} height={3800} fill={mixhex(k.silFar, k.sil, .6)} />
            {Array.from({ length: 4 }, (_, r) => [0, 1].map((cc) => {
              const x = 1390 + cc * 520, y = -900 + r * 600 + 20;
              if (cc === 0 && r === 2) return null;
              const v2 = rnd(437, r * 3 + cc);
              return <LonelyWin key={`${r}-${cc}`} x={x} y={y} w={380} h={420} k={k} t={c.t} seed={r * 13 + cc + 700} who={v2 < .45 ? "kid" : v2 < .6 ? "tv" : v2 < .8 ? "warm" : "dark"} frame={mixhex(k.silFar, k.sil, .4)} />;
            }))}
            <WindowFrame x={winF.x} y={winF.y} w={winF.w} h={winF.h} frame={mixhex(k.silFar, k.sil, .4)} thick={20} open={1}>
              <rect x={winF.x} y={winF.y} width={winF.w} height={winF.h} fill={mixhex(GOLD, k.win, .5)} />
              <Glow x={winF.x + winF.w / 2} y={winF.y + winF.h / 2} r={300} color="#fff3c8" opacity={.8} />
            </WindowFrame>
            <Curtain x={winF.x + 10} y={winF.y} w={-60} h={winF.h} color={mixhex(k.sil, k.silFar, .3)} t={c.t} wind={1} side={-1} seed={6} opacity={.92} />
          </Layer>
          <Layer d={1} blend="screen">
            <Glow x={winF.x + winF.w / 2} y={winF.y + winF.h / 2} r={600} color={GOLD} opacity={.3} />
          </Layer>
          <Layer d={1}>
            <Moths t={c.t} at={(tt) => stream(438, 50, tt, (u) => {
              const l = tt - T43;
              const q = { x: pathX(l), y: pathY(l) };
              const w = { x: winF.x + winF.w / 2, y: winF.y + winF.h / 2 };
              const cx = mix(w.x, q.x, .5) + 120, cy = mix(w.y, q.y, .5) + 160;
              return { x: (1 - u) * (1 - u) * w.x + 2 * (1 - u) * u * cx + u * u * (q.x + 90), y: (1 - u) * (1 - u) * w.y + 2 * (1 - u) * u * cy + u * u * (q.y + 110) };
            }, { speed: .8, spread: 60, size: 7 })} color={GOLD} trail={4} />
            <Thread d={qD(ksk.haN, { x: mix(ksk.haN.x, mw.x, .5) + 80, y: mix(ksk.haN.y, mw.y, .5) + 60 }, mw)} color={THREAD} width={3} glow={1.3} />
            <Kid pose={hold.b} variant="friend" accent={PINK} sil={k.sil} far={FAR} rim={RIM(-.7, -.7, .014)} rim2={{ dx: .7, dy: .3, color: GOLD, width: .01, glow: .6 }} />
            <Kid pose={hold.a} sil={k.sil} far={FAR} rim={RIM(-.7, -.7, .014)} rim2={{ dx: .7, dy: .3, color: GOLD, width: .01, glow: .6 }} />
            <Glow x={hold.m.x} y={hold.m.y} r={70 + surge * 50} color={GOLD} opacity={.8} />
            <Burst x={hold.m.x} y={hold.m.y} t={lt} t0={tS} dur={.8} n={26} r={300} color={GOLD} />
          </Layer>
          <Layer d={.5} blur={8}>
            <path d={`M-600,${80}Q500,${300} 2600,${-60}`} stroke={k.sil} strokeWidth={10} fill="none" />
            <path d={`M-600,${150}Q500,${370} 2600,${10}`} stroke={k.sil} strokeWidth={8} fill="none" />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 44. 올려다보는 각도. 길 양쪽 건물이 하늘 한 점으로 모이고, 둘이 실을 축으로 나선을 그리며 구름 틈(달빛)으로 오른다. 카메라가 천천히 돈다
    id: "a3-spiral", start: T44, key: "chorus", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt;
      const hh = handheld(c.t, 44, 4);
      const cam: Cam = { x: 960 + hh.x, y: 540 + hh.y, zoom: kf(lt, [[0, 1.0], [c.dur, 1.1, "io"]]), rot: hh.r + kf(lt, [[0, -.1], [c.dur, .2, "io"]]), focus: 1, dof: 3 };
      const q = pair44(lt);
      const q2 = pair44(lt - .09);
      const vx = q.x - q2.x, vy = q.y - q2.y;
      const fc: 1 | -1 = vx >= 0 ? 1 : -1;
      const heading = Math.atan2(Math.abs(vx), -vy);
      const kidP = pose({ ...P.hang, anchor: "center", x: q.x, y: q.y, s: q.s, facing: fc, rot: heading * .55, armN: [3.05, .05], armF: [-.7, .5], legN: [-.1, .6], legF: [-.45, .9], swing: 1.3 + .3 * n2(441, c.t * 4), headTilt: -.4 });
      const friP = pose({ ...P.fly, anchor: "center", x: q.x - fc * .42 * q.s, y: q.y + .32 * q.s, s: q.s * .97, facing: fc, rot: .5 + heading * .4, armN: [2.4, .1], armF: [2.2, .2], legN: [-.1, .7], legF: [-.4, .9], swing: 1.4 });
      const hold = holdHands(kidP, 1, friP, 0, .5, 0);
      const ksk = skeleton(hold.a);
      const gapP = { x: 960, y: 60 };
      return (
        <Scene cam={cam}>
          <Layer d={Infinity} blur={0}>
            <rect x={-1000} y={-1000} width={4000} height={3200} fill={k.sky[1]} />
            <Glow x={960} y={300} r={1400} color={k.sky[2]} opacity={.9} />
            <Glow x={960} y={120} r={800} color={k.sky[3]} opacity={.75} />
            <Glow x={gapP.x} y={gapP.y} r={420} color={k.moon} opacity={.9} />
            <GodRays x={gapP.x} y={gapP.y - 60} t={c.t} color={k.moon} opacity={.22} len={1500} count={20} />
          </Layer>
          <Layer d={6} blur={0}>
            {Array.from({ length: 16 }, (_, i) => {
              const a = (i / 16) * TAU + rnd(442, i) * .3;
              const R = 380 + rnd(443, i) * 260;
              return <circle key={i} cx={gapP.x + Math.cos(a) * R * 1.4} cy={gapP.y + Math.sin(a) * R * .55 - 40} r={200 + rnd(444, i) * 160} fill={mixhex(k.cloud, k.cloudLit, .35 + .3 * rnd(445, i))} opacity={.95} />;
            })}
            <Glow x={gapP.x} y={gapP.y} r={300} color={k.cloudLit} opacity={.6} />
          </Layer>
          <Layer d={1.6}>
            <UpWall x0={260} x1={560} y0={1400} roof={240} color={mixhex(k.silFar, k.fog, .25)} k={k} t={c.t} seed={446} cols={2} />
            <UpWall x0={1360} x1={1660} y0={1400} roof={200} color={mixhex(k.silFar, k.fog, .25)} k={k} t={c.t} seed={447} cols={2} />
          </Layer>
          <Layer d={1.15}>
            <UpWall x0={-900} x1={300} y0={1400} roof={90} color={mixhex(k.silFar, k.sil, .45)} k={k} t={c.t} seed={448} cols={4} />
            <UpWall x0={1620} x1={2820} y0={1400} roof={60} color={mixhex(k.silFar, k.sil, .45)} k={k} t={c.t} seed={449} cols={4} />
          </Layer>
          <Layer d={1}>
            <Thread d={qD(ksk.haN, { x: mix(ksk.haN.x, gapP.x, .5), y: mix(ksk.haN.y, gapP.y, .5) + 40 }, gapP)} color={THREAD} width={2.6} glow={1.3} />
            <Moths t={c.t} at={(tt) => stream(450, 60, tt, (u) => { const p = pair44(tt - T44 - (1 - u) * 1.1); return { x: p.x, y: p.y + p.s * .5 }; }, { speed: .7, spread: 40, size: 6 })} color={GOLD} trail={4} />
            <Kid pose={hold.b} variant="friend" accent={PINK} sil={k.sil} rim={RIM(0, -1, .02, k.rim, .8)} />
            <Kid pose={hold.a} sil={k.sil} rim={RIM(0, -1, .02, k.rim, .8)} />
            <Glow x={hold.m.x} y={hold.m.y} r={30 + 60 * blip(lt, at(160, T44), .05, .4)} color={GOLD} opacity={.9} />
            <Burst x={hold.m.x} y={hold.m.y} t={lt} t0={at(160, T44)} dur={.8} n={24} r={260} color={GOLD} />
          </Layer>
          <Layer d={.45} blur={12}>
            <Moths t={c.t} at={(tt) => Array.from({ length: 7 }, (_, i) => {
              const l = tt - T44;
              const y = 1500 - (((l * 900 * (.8 + rnd(451, i) * .5) + rnd(452, i) * 2400) % 2400));
              return { x: -200 + rnd(453, i) * 2300, y, s: 22 + rnd(454, i) * 14, a: -1.57, f: tt * 14 + i, b: .9 };
            })} color={GOLD} wings={false} />
            <path d={`M-800,1180Q900,1000 2800,1260`} stroke={k.sil} strokeWidth={14} fill="none" />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 45. 구름을 뚫는다(번쩍). 거대한 달 앞을 손잡은 두 실루엣이 가로지른다. 한가운데에서 느려지고, 마디(41)에 실이 풀려 나방으로 터진다(이제 스스로 난다)
    id: "a3-moonpass", start: T45, key: "chorus", enter: { type: "flash" },
    render: (c) => {
      const lt = c.lt;
      const hh = handheld(c.t, 45, 4);
      const emerge = ease("expoOut", lin(0, 1.3, lt));
      const cam: Cam = { x: 960 + hh.x, y: mix(860, 540, emerge) + hh.y, zoom: kf(lt, [[0, 1.08], [c.dur, 1.0, "sineIO"]]), rot: hh.r, focus: 1.4, dof: 2.5 };
      const q = pair45(lt);
      const q2 = pair45(lt - .05);
      const hit = blip(lt, tB41, .05, .6);
      const free = smooth(tB41 - .05, tB41 + .25, lt);
      const cheer = smooth(tB41 - .5, tB41 - .05, lt) * (1 - smooth(tB41 + .7, tB41 + 1.4, lt));
      const pitch = clamp(Math.atan2(q.y - q2.y, q.x - q2.x), -.4, .4);
      const kidP = pose({ ...P.fly, anchor: "center", x: q.x + 105, y: q.y - 30, s: 250, facing: 1, rot: 1.2 + pitch - cheer * .35, armN: free > .5 ? [mix(2.9, 2.6, cheer), .1] : [2.95, .05], armF: [-.4, .4], legN: [-.15 + .2 * n2(451, c.t * 3), .5], legF: [-.4, .8], swing: 1.3 + .2 * n2(452, c.t * 4), headTilt: -.8 + cheer * .3 });
      const friP = pose({ ...P.fly, anchor: "center", x: q.x - 125, y: q.y + 55, s: 240, facing: 1, rot: 1.15 + pitch - cheer * .35, armN: [2.2, .2], armF: [mix(2.2, 2.8, cheer), .1], legN: [-.1, .6], legF: [-.5, .9], swing: 1.4 + .2 * n2(453, c.t * 4), headTilt: -.7 + cheer * .3 });
      const hold = holdHands(kidP, 1, friP, 0, .5, 0);
      const ksk = skeleton(hold.a);
      const ms = project(cam, 60, M45.x, M45.y - M45.r * .55);
      const mw = unproject(cam, 1.4, ms.x, ms.y);
      const thrO = 1 - free;
      const freed = (tt: number): M[] => {
        const l = tt - T45;
        const w = lin(tB41, tB41 + 1.6, l);
        if (w <= 0) return [];
        return Array.from({ length: 40 }, (_, i) => {
          const u = rnd(454, i);
          const sx = mix(ksk.haN.x, mw.x, u), sy = mix(ksk.haN.y, mw.y, u);
          const a = rnd(455, i) * TAU, sp = 120 + rnd(456, i) * 380;
          const e = ease("expoOut", w);
          return { x: sx + Math.cos(a) * sp * e, y: sy + Math.sin(a) * sp * e - 60 * w, s: 6 + rnd(457, i) * 4, a, f: tt * 18 + i, b: 1 - w * .6 };
        });
      };
      const fg = ease("expoOut", lin(0, 1.25, lt));
      return (
        <Scene cam={cam}>
          <SkyL k={k} t={c.t} horizon={1060} glow={.75} />
          <MoonL k={k} t={c.t} x={M45.x} y={M45.y} r={M45.r} rays={1.3} glow={1.05 + hit * .35} pulse={hit + c.pulse * .2} />
          <Layer d={14} blur={0}>
            <CloudBank seed={458} y={1010} x0={-1200} x1={3200} size={360} count={16} dark={k.cloud} lit={k.cloudLit} t={c.t} drift={-10} />
          </Layer>
          <Layer d={4}>
            <CloudBank seed={459} y={1190} x0={-1200} x1={3200} size={680} count={9} dark={mixhex(k.cloud, k.sil, .3)} lit={k.cloudLit} t={c.t} drift={-25} rim={k.moon} />
          </Layer>
          <Layer d={1.4}>
            <Moths t={c.t} at={(tt) => stream(460, 50, tt, (u) => { const p = pair45(tt - T45 - (1 - u) * 1.0); return { x: p.x - 40, y: p.y + 30 }; }, { speed: .6, spread: 55, size: 7 })} color={GOLD} trail={4} />
            {thrO > .01 ? <Thread d={qD(ksk.haN, { x: mix(ksk.haN.x, mw.x, .5) - 60, y: mix(ksk.haN.y, mw.y, .5) + 40 }, mw)} color={THREAD} width={3} glow={1.2} opacity={thrO} /> : null}
            <Kid pose={hold.b} variant="friend" accent={PINK} sil={k.sil} far={FAR} rim={RIM(0, -1, .016, "#ffffff", .9)} rim2={{ dx: .9, dy: .4, color: k.moon, width: .01, glow: .6 }} />
            <Kid pose={hold.a} sil={k.sil} far={FAR} rim={RIM(0, -1, .016, "#ffffff", .9)} rim2={{ dx: .9, dy: .4, color: k.moon, width: .01, glow: .6 }} />
            <Moths t={c.t} at={freed} color={GOLD} trail={3} />
            <Burst x={ksk.haN.x} y={ksk.haN.y} t={lt} t0={tB41} dur={1.1} n={36} r={420} color={GOLD} />
          </Layer>
          <Layer d={.6} blur={10}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Cloud key={i} seed={461 + i} x={-200 + i * 560 + (i % 2 ? 120 : -80) * fg} y={500 + (i % 2) * 260 + 1500 * fg} w={1300} h={700} dark={mixhex(k.cloud, k.cloudLit, .25)} lit={k.cloudLit} opacity={1 - fg * .3} />
            ))}
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 46. 달 둘레를 돈다. 풀린 실의 나방이 후광 고리를 이룬다. 마디(43)에 궤도를 벗어나 구름 바다로 미끄러진다. 색이 후렴 → 은빛으로
    id: "a3-halo", start: T46, key: "chorus", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt;
      const w = smooth(1.2, 5.0, lt);
      const kk = mixKey(K.chorus, K.silver, w);
      const hh = handheld(c.t, 46, 4);
      const tilt = ease("io", lin(1.8, 5.43, lt));
      const cam: Cam = { x: 960 + hh.x + 60 * tilt, y: 540 + hh.y + 470 * tilt, zoom: 1, rot: hh.r + .02 * Math.sin(lt * .8), focus: 1, dof: 2 };
      const m = moon46(lt);
      const q = pair46(lt);
      const q2 = pair46(lt - .05);
      const vx = q.x - q2.x, vy = q.y - q2.y;
      const fc: 1 | -1 = vx >= -2 ? 1 : -1;
      const glide = smooth(tB43 - .2, tB43 + .6, lt);
      const s = mix(150, 108, q.g);
      const pitch = clamp(Math.atan2(vy, Math.abs(vx) + 1), -.6, .6);
      const kidP = pose({ ...P.fly, anchor: "center", x: q.x + fc * s * .3, y: q.y - s * .05, s, facing: fc, rot: mix(1.15, 1.3, glide) + pitch * .8, armN: [mix(2.9, 1.9, glide), .1], armF: [-.4, .4], legN: [-.1 + .15 * n2(461, c.t * 2), .4], legF: [-.3, .6], swing: 1.2 + .2 * n2(462, c.t * 3), headTilt: -.7 });
      const friP = pose({ ...P.fly, anchor: "center", x: q.x - fc * s * .35, y: q.y + s * .2, s: s * .96, facing: fc, rot: mix(1.1, 1.3, glide) + pitch * .8, armN: [2.0, .2], armF: [mix(2.4, 1.6, glide), .2], legN: [-.1, .5], legF: [-.35, .7], swing: 1.3 + .2 * n2(463, c.t * 3), headTilt: -.7 });
      const hold = holdHands(kidP, 1, friP, 0, .5, 0);
      const behind = lt < tB43 && q.front < -.15;
      const ring = (tt: number): M[] => {
        const l = tt - T46;
        const mm = moon46(l);
        const fw = ease("expoOut", lin(0, 1.6, l));
        return Array.from({ length: 110 }, (_, i) => {
          const a = (i / 110) * TAU + l * .55;
          const rx = mm.r * (1.5 + .05 * Math.sin(i * 3.1)), ry = mm.r * .42;
          const tx = mm.x + Math.cos(a) * rx * Math.cos(-.12) - Math.sin(a) * ry * Math.sin(-.12);
          const ty = mm.y + Math.cos(a) * rx * Math.sin(-.12) + Math.sin(a) * ry * Math.cos(-.12);
          const sx = mix(1500, 900, rnd(464, i)) + n2(465 + i, l) * 60, sy = mix(200, 500, rnd(466, i));
          return { x: mix(sx, tx, fw), y: mix(sy, ty, fw), s: (3.5 + rnd(467, i) * 2.5) * (Math.sin(a) > 0 ? 1.25 : .8), a: a + 1.57, f: tt * 14 + i, b: (Math.sin(a) > 0 ? 1 : .55) * (.7 + .3 * rnd(468, i)) };
        });
      };
      const now = ring(c.t);
      const backSet = new Set(now.map((mm, i) => [mm, i] as const).filter(([, i]) => Math.sin((i / 110) * TAU + lt * .55) < 0).map(([, i]) => i));
      const backAt = (tt: number) => ring(tt).filter((_, i) => backSet.has(i));
      const frontAt = (tt: number) => ring(tt).filter((_, i) => !backSet.has(i));
      const mothC = mixhex(GOLD, "#fff0c8", w * .6);
      const pair = (
        <g>
          <Kid pose={hold.b} variant="friend" accent={PINK} sil={kk.sil} rim={RIM(-.2, -1, .018, kk.rim, .8)} />
          <Kid pose={hold.a} sil={kk.sil} rim={RIM(-.2, -1, .018, kk.rim, .8)} />
          <Glow x={hold.m.x} y={hold.m.y} r={26} color={mothC} opacity={.9} />
        </g>
      );
      return (
        <Scene cam={cam}>
          <SkyL k={kk} t={c.t} horizon={1250} glow={.6} />
          <Layer d={60} blur={0}>
            <GodRays x={m.x} y={m.y} t={c.t} color={kk.moon} opacity={.14} len={m.r * 8} count={20} />
            <Moths t={c.t} at={backAt} color={mothC} trail={2} />
            {behind ? pair : null}
            <Moon x={m.x} y={m.y} r={m.r} color={kk.moon} glow={1.05} halo={mixhex(kk.moon, kk.glow, .5)} texture={1} pulse={c.pulse * .15} />
            <Moths t={c.t} at={frontAt} color={mothC} trail={2} />
            <Moths t={c.t} at={(tt) => stream(469, 26, tt, (u) => { const p = pair46(tt - T46 - (1 - u) * .7); return { x: p.x - 30, y: p.y + 20 }; }, { speed: .6, spread: 30, size: 5 })} color={mothC} trail={3} />
            {behind ? null : pair}
          </Layer>
          <Layer d={9}>
            <CloudBank seed={470} y={1180} x0={-1400} x1={3400} size={380} count={18} dark={kk.cloud} lit={kk.cloudLit} t={c.t} drift={-6} />
          </Layer>
          <Layer d={3.2}>
            <CloudBank seed={471} y={1420} x0={-1400} x1={3600} size={760} count={10} dark={mixhex(kk.cloud, kk.sil, .2)} lit={kk.cloudLit} t={c.t} drift={-12} rim={kk.moon} />
          </Layer>
          <Layer d={.55} blur={10}>
            <Wisp x={2400 - lt * 260} y={1250} w={1800} h={120} color={kk.cloudLit} opacity={.5 * smooth(2.5, 4, lt)} />
            <Wisp x={-300 + lt * 120} y={1500} w={2000} h={160} color={kk.cloudLit} opacity={.45 * smooth(3, 4.5, lt)} />
          </Layer>
        </Scene>
      );
    },
  },
];
