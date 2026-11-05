/**
 * 4막(2:03–2:30) — 구름 위, 폭풍, 떨어짐.
 *   걸터앉기(은빛 와이드) → 구름 틈 아래 마주 보는 두 창(내려다본 시점) → 서로를 본다(미디엄, 달빛 얼굴)
 *   → 먼 번개(아주 먼 와이드, 은빛이 빠진다) → 구름 징검다리(옆 트래킹, 착지마다 박) → 낙뢰(하얀 번쩍임, 나방이 흩어짐)
 *   → 미끄러지는 손가락(클로즈업, 느리게) → 떨어지는 친구(위에서 내려다봄) → 다이빙(빠른 카메라)
 *   → 박에 잡는 손(클로즈업 → 함께 굴러떨어짐) → 어둠 속 두 폰(차가운 빛 둘만)
 *
 * 편집표 손질: 52번(B(50) → beat(202))과 55번(B(52) → beat(210))은 B(50)=beat(202), B(52)=beat(210)이라 길이가 0이다.
 *   52 낙뢰 = B(50) → beat(203.5), 53 미끄러짐 = beat(203.5) → B(51)
 *   54 떨어짐 = B(51) → beat(208.5), 55 다이빙 = beat(208.5) → beat(210) ("beat(210) 직전"), 56은 그대로 beat(210)에 잡는다.
 */
import React from "react";
import { Layer, Scene, Screen, unproject, type Cam } from "../lib/camera";
import { K, type Key } from "../lib/palette";
import { B, beat } from "../lib/song";
import { TAU, clamp, ease, handheld, kf, lin, mix, mixc, mixhex, n2, rnd, smooth, springStep } from "../lib/math";
import { CloudBank, Glow, GodRays, Lightning, Moon, Rain, SkyFill, Stars, Wisp } from "../lib/sky";
import { Moths, Burst, swarm, type M } from "../lib/moths";
import { Kid, ikArm, skeleton } from "../kid/rig";
import { P, lerpPose, pose, type Pose } from "../kid/pose";
import { AlleyView, CloudMass, CloudStone, Hand, RadialRain, StormMass, Streaks, Vapor, lerpKey, type HandSpec } from "./act4-kit";
import type { Shot } from "./types";

const SIL = K.silver, ST = K.storm;
const PINK = K.chorus.accent;
const GOLD = "#ffd27a";
const MOTH = "#ffcf7a";

const T47 = B(44), T48 = beat(182), T49 = B(46), T50 = beat(190), T51 = B(48), T52 = B(50), T53 = beat(203.5), T54 = B(51), T55 = beat(208.5), T56 = beat(210), T57 = B(53);

const RIM = (k: Key, dx: number, dy: number, w = .014, glow = .7, color?: string) => ({ dx, dy, color: color ?? k.rim, width: w, glow });

/** 하늘 층(움직이지 않고 흐리지 않는다) */
const Sky: React.FC<{ k: Key; t: number; horizon: number; glowX?: number; glowR?: number; glowOpacity?: number; stars?: number; children?: React.ReactNode }> = ({ k, t, horizon, glowX = 960, glowR = 1300, glowOpacity = .55, stars = 0, children }) => (
  <Layer d={Infinity} blur={0}>
    <SkyFill k={k} y0={-300} y1={horizon + 120} glowX={glowX} glowY={horizon} glowR={glowR} glowOpacity={glowOpacity} />
    {stars > 0 ? <Stars seed={4} t={t} alpha={stars} y1={horizon - 300} /> : null}
    {children}
  </Layer>
);

/** 앉았다 일어서기: 엉덩이 자리 → 발 자리로 골반을 이어 옮긴다(anchor가 바뀌어도 튀지 않게) */
function sitToStand(o: Partial<Pose>, x: number, ground: number, w: number, standX?: number): Partial<Pose> {
  const sit = pose({ ...P.sitEdge, ...o, anchor: "seat", x, y: ground });
  const stand = pose({ ...P.stand, ...o, anchor: "feet", x: standX ?? x, y: ground });
  const ps = skeleton(sit).pelvis, pt = skeleton(stand).pelvis;
  const L = lerpPose(sit, stand, w);
  return { ...L, anchor: "center", x: mix(ps.x, pt.x, w), y: mix(ps.y, pt.y, w) - Math.sin(w * Math.PI) * .05 * (o.s ?? 300) };
}

/** 손(가까운 손)이 점 h에 오도록 자세 전체를 옮긴다(anchor center). 몸은 h에서 ang 방향(화면)으로 뻗는다 */
function hangFrom(h: { x: number; y: number }, ang: number, extra: Partial<Pose>): Partial<Pose> {
  const base = pose({ anchor: "center", x: 0, y: 0, facing: 1, lean: 0, bend: 0, armN: [3.08, 0], ...extra, rot: ang - Math.PI / 2 + (extra.rot ?? 0) });
  const sk = skeleton(base);
  return { ...base, x: h.x - sk.haN.x, y: h.y - sk.haN.y };
}

/** 번개 한 번의 밝기(두 번 깜빡임). x = 번개 친 뒤 지난 초 */
const strike = (x: number, a = 1) => (x < 0 ? 0 : a * clamp(Math.exp(-x * 9) * .85 + Math.exp(-Math.abs(x - .11) * 40) * .6));

/* ───────────── 51번 징검다리 시간표(곡 시각) ───────────── */
const HOP = (() => {
  const L = [beat(195), beat(196), beat(197), beat(198), beat(200), beat(201)];
  const off = [T51 + .24, L[0] + .1, L[1] + .1, L[2] + .1, L[3] + .17, L[4] + .1];
  const xs = [1150, 790, 430, 60, -300, -1100, -1460];
  const tops = [800, 788, 806, 784, 798, 786, 800];
  const hs = [140, 110, 125, 110, 270, 105];
  return { L, off, xs, tops, hs };
})();
type HopState = { x: number; y: number; air: boolean; u: number; i: number; since: number; until: number };
function hopAt(t: number): HopState {
  const { L, off, xs, tops, hs } = HOP;
  for (let i = 0; i < 6; i++) {
    if (t < off[i]) return { x: xs[i], y: tops[i], air: false, u: 0, i, since: i === 0 ? 9 : t - L[i - 1], until: off[i] - t };
    if (t < L[i]) {
      const u = (t - off[i]) / (L[i] - off[i]);
      return { x: mix(xs[i], xs[i + 1], u), y: mix(tops[i], tops[i + 1], u) - hs[i] * 4 * u * (1 - u), air: true, u, i, since: 0, until: 0 };
    }
  }
  return { x: xs[6], y: tops[6], air: false, u: 0, i: 6, since: t - L[5], until: 9 };
}
const LANDP: Partial<Pose> = { lean: .22, headTilt: -.05, armN: [1.7, .3], armF: [1.3, .4], legN: [1.05, 1.3], legF: [.65, 1.0], squash: 0 };
/** 징검다리 위 한 아이의 자세(손잡기 전) */
function hopPose(t: number, s: number, dx: number, facing: 1 | -1, seed: number): Partial<Pose> {
  const h = hopAt(t);
  let base: Partial<Pose>;
  if (h.air) {
    base = h.u < .45 ? lerpPose(P.leap, P.apex, ease("out", h.u / .45)) : lerpPose(P.apex, LANDP, ease("io", (h.u - .45) / .55));
  } else if (h.i === 0) {
    base = lerpPose(P.stand, P.crouch, smooth(T51 + .02, T51 + .22, t));
  } else {
    const land = Math.exp(-h.since * 11);
    base = lerpPose(LANDP, P.crouch, smooth(0, .08, h.since));
    base.squash = (base.squash ?? 0) + land * .12;
    if (h.i === 6) base = lerpPose(base, { ...P.stand, headTilt: -.15 }, smooth(.12, .45, h.since));
  }
  return { ...base, anchor: "feet", x: h.x + dx, y: h.y, s, facing, swing: (h.air ? 1.3 : .5) + n2(seed, t * 1.8) * .35 };
}

export const act4: Shot[] = [
  {
    // 47. 와이드: 구름 끝에 나란히 걸터앉아 다리를 흔든다. 은빛, 고요. 3막의 활공을 받아 카메라가 내려앉는다
    id: "a4-sit", start: T47, key: "silver", enter: { type: "cross" },
    render: (c) => {
      const k = SIL, lt = c.lt, t = c.t;
      const hh = handheld(t, 47, 4, .3);
      const st = ease("out", lin(-.3, c.dur, lt));
      const cam: Cam = { x: 960 + hh.x + mix(-40, 0, st), y: 540 + hh.y + mix(-130, 0, st), zoom: mix(1.13, 1, st), rot: hh.r + mix(-.03, 0, st), focus: 1, dof: 2 };
      const moon = { x: 430, y: 250, r: 96 };
      const a1 = Math.sin(t * 3.3), b1 = Math.sin(t * 3.3 + 2.4);
      const lean = smooth(beat(180) - T47 - .15, beat(180) - T47 + .6, lt);
      let kp: Partial<Pose> = {
        ...P.sitEdge, x: 990, y: 774, s: 236, facing: -1, headTilt: -.22 + n2(471, t * .5) * .05, lean: .03, swing: .2 + n2(472, t * .6) * .2,
        legN: [1.1 + .25 * a1, 1.1 + .45 * a1], legF: [.95 + .25 * b1, 1.05 + .4 * b1], armN: [.35, .35],
      };
      let fp: Partial<Pose> = { ...P.sitEdge, x: 1092, y: 750, s: 222, facing: -1, headTilt: mix(-.18, .14, lean), lean: mix(.03, .12, lean), bend: .08, swing: .25 + n2(473, t * .6) * .2, armF: [.3, .3] };
      const ksk = skeleton(kp), fsk = skeleton(fp);
      const hand = { x: (ksk.shF.x + fsk.shN.x) / 2 + 4, y: Math.max(ksk.shF.y, fsk.shN.y) + 52 };
      kp = ikArm(kp, 1, hand.x, hand.y);
      fp = ikArm(fp, 0, hand.x, hand.y);
      return (
        <Scene cam={cam}>
          <Sky k={k} t={t} horizon={740} glowX={moon.x + 200} glowOpacity={.55} stars={.7} />
          <Layer d={60} blur={0}>
            <GodRays x={moon.x} y={moon.y} t={t} color={k.moon} opacity={.13} len={moon.r * 14} />
            <Moon x={moon.x} y={moon.y} r={moon.r} color={k.moon} glow={1.15} pulse={c.pulse * .15} texture={1} />
          </Layer>
          <Layer d={30} blur={0}>
            <Wisp x={700} y={600} w={2200} h={40} color={k.cloudLit} opacity={.3} t={t} drift={5} />
            <Wisp x={1500} y={470} w={1600} h={26} color={k.cloudLit} opacity={.2} t={t} drift={-4} />
          </Layer>
          <Layer d={14} blur={0}>
            <CloudBank seed={471} y={735} x0={-1700} x1={3600} size={300} count={18} dark={mixhex(k.cloud, k.fog, .45)} lit={k.cloudLit} t={t} drift={3} />
          </Layer>
          <Layer d={6} blur={.8}>
            <CloudBank seed={472} y={880} x0={-1600} x1={3700} size={560} count={11} dark={k.cloud} lit={k.cloudLit} t={t} drift={5} rim={mixhex(k.cloudLit, "#ffffff", .6)} />
          </Layer>
          <Layer d={2.5} blur={1.6}>
            <CloudBank seed={473} y={1180} x0={-1400} x1={3400} size={900} count={6} dark={mixhex(k.cloud, k.sil, .25)} lit={k.cloudLit} t={t} drift={8} />
          </Layer>
          <Layer d={1.5} blur={0}>
            <Moths t={t} at={(tt) => swarm(4701, 14, tt, { cx: 720, cy: 520, rx: 460, ry: 220, speed: .1, size: 5.5 })} color={MOTH} trail={2} trailDt={.06} />
          </Layer>
          <Layer d={1}>
            <CloudMass seed={2} x0={1040} x1={2700} y={752} depth={420} dark={k.cloud} lit={k.cloudLit} rim="#ffffff" ends="L" />
            <Kid variant="friend" accent={PINK} pose={pose(fp)} sil={mixhex(k.sil, k.silFar, .3)} rim={RIM(k, -.75, -.66, .016)} />
            <CloudMass seed={1} x0={955} x1={2800} y={776} depth={600} dark={k.cloud} lit={k.cloudLit} rim="#ffffff" ends="L" />
            <Kid pose={pose(kp)} sil={k.sil} rim={RIM(k, -.75, -.66, .016)} />
          </Layer>
          <Layer d={.5} blur={9}>
            <Wisp x={420 + lt * 60} y={1030} w={1700} h={110} color={k.cloudLit} opacity={.55} />
            <Wisp x={1900 - lt * 40} y={60} w={1300} h={80} color={k.cloudLit} opacity={.3} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 48. 시점(내려다봄): 구름 틈 아래 좁은 골목, 같은 높이에서 마주 보는 두 창. 박(184)에 구름결이 갈라지며 두 창이 드러난다
    id: "a4-peek", start: T48, key: "silver", enter: { type: "cut" },
    render: (c) => {
      const k = SIL, lt = c.lt, t = c.t;
      const tPart = beat(184) - T48;
      const hh = handheld(t, 48, 5, .35);
      const push = ease("out", lin(0, c.dur, lt));
      const cam: Cam = { x: 960 + hh.x, y: 540 + hh.y, zoom: mix(1, 1.3, push), rot: hh.r + mix(.035, -.01, push), focus: 1, dof: 3 };
      const part = ease("expoOut", lin(tPart - .05, tPart + 1.3, lt));
      const holePts = (sc: number, seed: number) => Array.from({ length: 56 }, (_, i) => {
        const th = (i / 56) * TAU;
        const r = 1 + .13 * n2(seed, Math.cos(th) * 1.4, Math.sin(th) * 1.4 + t * .03) + .05 * n2(seed + 1, Math.cos(th) * 4, Math.sin(th) * 4);
        return { x: 960 + Math.cos(th) * 560 * r * sc, y: 520 + Math.sin(th) * 380 * r * sc };
      });
      const ring = (pts: { x: number; y: number }[]) => "M" + pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("L") + "Z";
      const outer = "M-3000,-3000H5000V5000H-3000Z";
      const h1 = holePts(1, 481), h2 = holePts(.8, 482);
      const gid = "a4holeg";
      // 금빛 나방 두 마리가 창 쪽으로 내려간다(시선 안내)
      const guide = (tt: number): M[] => [0, 1].map((i) => {
        const l = tt - T48;
        const u = ease("out", lin(.1 + i * .25, 2.6 + i * .2, l));
        const tx = i ? 1150 : 790, ty = 545;
        return { x: mix(i ? 1300 : 600, tx, u) + Math.sin(l * 3 + i) * 30 * (1 - u), y: mix(i ? 120 : 200, ty, u), s: mix(8, 4, u), a: 1.2, f: l * 16 + i, b: 1 - u * .3 };
      });
      return (
        <Scene cam={cam} bg={k.sil}>
          <Layer d={7} blur={1}>
            <AlleyView cx={960} cy={420} F={600} zs={6} skew={60} k={k} t={t} wind={.4 + part * .6} />
          </Layer>
          <Layer d={3} blur={2.5}>
            <Glow x={760 - part * 420} y={560} r={260} rx={360} ry={190} color={k.cloudLit} opacity={.55 * (1 - part * .6)} />
            <Glow x={1200 + part * 440} y={500} r={260} rx={340} ry={170} color={k.cloudLit} opacity={.5 * (1 - part * .6)} />
            <Glow x={980} y={300 - part * 260} r={220} rx={420} ry={120} color={k.fog} opacity={.4 * (1 - part * .5)} />
          </Layer>
          <Layer d={2.4} blur={0}>
            <Moths t={t} at={guide} color={MOTH} trail={4} trailDt={.05} />
          </Layer>
          <Layer d={1.6} blur={1.2}>
            <path d={outer + ring(h1.map((p) => ({ x: 960 + (p.x - 960) * 1.04, y: 520 + (p.y - 520) * 1.04 }))) + ring(h2)} fill={mixhex(k.cloud, k.silFar, .45)} fillRule="evenodd" />
          </Layer>
          <Layer d={1}>
            <defs>
              <radialGradient id={gid} cx={960} cy={520} r={1250} gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={k.cloud} />
                <stop offset="42%" stopColor={k.cloud} />
                <stop offset="58%" stopColor={mixhex(k.cloud, k.cloudLit, .75)} />
                <stop offset="100%" stopColor={k.cloudLit} />
              </radialGradient>
            </defs>
            <path d={outer + ring(h1)} fill={`url(#${gid})`} fillRule="evenodd" />
            {h1.filter((_, i) => i % 2 === 0).map((p, i) => (
              <circle key={i} cx={p.x + (p.x - 960) * .04} cy={p.y + (p.y - 520) * .04} r={50 + rnd(483, i) * 60} fill={`url(#${gid})`} />
            ))}
            <Glow x={960} y={150} r={300} rx={900} ry={200} color="#ffffff" opacity={.35} />
          </Layer>
          <Layer d={.55} blur={10}>
            <Wisp x={180 - push * 300} y={940} w={1100} h={160} color={k.cloudLit} opacity={.7} />
            <Wisp x={1800 + push * 300} y={160} w={1000} h={150} color={k.cloudLit} opacity={.6} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 49. 미디엄(정면): 구름 끝에 앉아 틈을 내려다보다 서로를 본다. 이웃이었다. 달빛이 얼굴에 들고 박(188)에 몸이 튄다
    id: "a4-realize", start: T49, key: "silver", enter: { type: "cut" },
    render: (c) => {
      const k = SIL, lt = c.lt, t = c.t;
      const tU1 = beat(187) - T49, tU2 = beat(187.5) - T49, tR = beat(188) - T49, tB = beat(189) - T49;
      const hh = handheld(t, 49, 4, .4);
      const bump = lt > tR ? Math.exp(-(lt - tR) * 7) * Math.sin((lt - tR) * 24) * 7 : 0;
      const cam: Cam = { x: 960 + hh.x, y: 520 + hh.y + bump, zoom: kf(lt, [[0, 1], [c.dur, 1.08, "io"]]), rot: hh.r, focus: 1, dof: 7 };
      const hop = (t0: number, h: number) => { const a = lt - t0; return a > 0 && a < .4 ? Math.sin((a / .4) * Math.PI) * h : 0; };
      const sq = (t0: number) => { const a = lt - t0; return (a > -.07 && a < 0 ? .07 : 0) + (a > .4 ? Math.exp(-(a - .4) * 10) * .08 : 0); };
      const joy = smooth(tR - .05, tR + .12, lt);
      const who = (isKid: boolean): Partial<Pose> => {
        const tu = isKid ? tU1 : tU2;
        const up = ease("back", lin(tu, tu + .3, lt));
        const s = isKid ? 560 : 545;
        const ph = isKid ? 0 : 1.7;
        const sw = Math.sin(t * 3.4 + ph);
        const h = hop(tR, .075) + hop(tB, .05);
        const arms: Partial<Pose> = isKid
          ? (lt < tU1 ? { armN: [mix(.3, .75, smooth(.05, .3, lt)), .08], armF: [.2, .3] } : lt < tR ? { armN: [.3, .4], armF: [.2, .3] } : lt < tB ? { armN: [mix(.3, 1.6, ease("back", lin(tR, tR + .2, lt))), .06], armF: [.4, .5] } : { armN: [2.3, .35], armF: [2.0, .4] })
          : (lt < tR ? { armN: [.28, .35], armF: [.2, .3] } : lt < tB ? { armN: [mix(.3, 1.25, ease("back", lin(tR, tR + .2, lt))), mix(.3, 2.2, ease("back", lin(tR, tR + .2, lt)))], armF: [1.1, 2.3] } : { armN: [1.55, .05], armF: [.6, .6] });
        return {
          anchor: "seat", x: isKid ? 742 : 1178, y: 640 - h * s, s, facing: isKid ? 1 : -1,
          lean: mix(.14, -.03, up) - (lt > tB ? .1 * smooth(tB, tB + .2, lt) : 0), bend: mix(.16, .02, up), headTilt: mix(.6, -.06, up) - joy * .06, faceDir: .4,
          legN: [.3 + .12 * sw, .25 + .35 * sw], legF: [.18 - .12 * sw, .3 - .3 * sw], ...arms,
          squash: sq(tR) + sq(tB), swing: .3 + h * 6 + n2(isKid ? 491 : 492, t) * .15,
          face: .9 * smooth(tu - .05, tu + .25, lt), faceColor: "#eef0ff", eyes: 1.1, mouth: up * (1 - joy) * .8, smile: joy,
        };
      };
      const kp = who(true), fp = who(false);
      return (
        <Scene cam={cam}>
          <Sky k={k} t={t} horizon={720} glowOpacity={.6} stars={.4}>
            <GodRays x={960} y={-520} t={t} color={k.moon} opacity={.12} len={2400} count={14} />
          </Sky>
          <Layer d={12}>
            <CloudBank seed={491} y={770} x0={-1400} x1={3400} size={420} count={13} dark={mixhex(k.cloud, k.fog, .3)} lit={k.cloudLit} t={t} drift={4} />
          </Layer>
          <Layer d={4}>
            <CloudBank seed={492} y={960} x0={-1400} x1={3400} size={760} count={8} dark={k.cloud} lit={k.cloudLit} t={t} drift={6} rim="#ffffff" />
          </Layer>
          <Layer d={1}>
            <CloudMass seed={493} x0={-300} x1={2200} y={642} depth={620} dark={mixhex(k.cloud, k.sil, .2)} lit={k.cloudLit} rim="#ffffff" ends="" />
            <Moths t={t} at={(tt) => {
              const l = tt - T49;
              const rise = ease("expoOut", lin(tR, tR + 1.2, l));
              return swarm(4901, 9, tt, { cx: 960, cy: 470 - rise * 140, rx: 70 + rise * 160, ry: 50 + rise * 70, speed: .35 + rise * .3, size: 6 });
            }} color={MOTH} trail={3} />
            <Kid pose={pose(kp)} sil={k.sil} rim={RIM(k, .1, -1, .012)} />
            <Kid variant="friend" accent={PINK} pose={pose(fp)} sil={k.sil} rim={RIM(k, -.1, -1, .012)} />
          </Layer>
          <Layer d={.5} blur={12}>
            <Wisp x={-100 + lt * 90} y={980} w={1300} h={140} color={k.cloudLit} opacity={.55} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 50. 아주 먼 와이드: 먼 지평선 폭풍 속에서 번개가 깜빡인다. 바람이 일고 색이 빠진다. 박(193)에 일어선다
    id: "a4-hint", start: T50, key: "storm", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt, t = c.t;
      const kw = smooth(.05, 1, c.p);
      const k = lerpKey(SIL, ST, kw);
      const tF1 = beat(191) - T50, tF2 = beat(192.5) - T50, tF3 = beat(193.25) - T50, tSt = beat(193) - T50;
      const flash = clamp(strike(lt - tF1, .55) + strike(lt - tF2, 1) + strike(lt - tF3, .6));
      const hh = handheld(t, 50, mix(3, 8, kw), .4);
      const cam: Cam = { x: 960 + hh.x, y: 540 + hh.y, zoom: kf(lt, [[0, 1], [c.dur, 1.1, "in"]]), rot: hh.r, focus: 1, dof: 1.2 };
      const wind = 140 * lt + 170 * lt * lt;
      const gust = .2 + kw * 1.3 + n2(501, t * 1.3) * .35;
      const look = ease("back", lin(tF1 + .08, tF1 + .4, lt));
      const kidO: Partial<Pose> = { s: 128, facing: 1, headTilt: mix(-.02, -.28, look), swing: gust, legN: [1.15 + .2 * Math.sin(t * 3.3) * (1 - kw), 1.2], legF: [1.0, 1.1] };
      const friO: Partial<Pose> = { s: 122, facing: 1, headTilt: mix(.05, -.25, ease("back", lin(tF1 + .2, tF1 + .5, lt))), swing: gust + .2 };
      const wK = ease("back", lin(tSt, tSt + .4, lt)), wF = ease("back", lin(tSt + .22, tSt + .62, lt));
      let kp = sitToStand(kidO, 590, 906, clamp(wK), 560);
      let fp = sitToStand(friO, 470, 902, clamp(wF), 455);
      const ksk = skeleton(kp), fsk = skeleton(fp);
      const hj = smooth(tF2, tF2 + .3, lt);
      if (hj > 0) {
        const hx = (ksk.shF.x + fsk.shN.x) / 2, hy = Math.max(ksk.shF.y, fsk.shN.y) + 26;
        kp = ikArm(kp, 1, mix(ksk.haF.x, hx, hj), mix(ksk.haF.y, hy, hj));
        fp = ikArm(fp, 0, mix(fsk.haN.x, hx, hj), mix(fsk.haN.y, hy, hj));
      }
      const moonG = mix(1.1, .35, kw);
      return (
        <Scene cam={cam}>
          <Sky k={k} t={t} horizon={800} glowX={1300} glowOpacity={.5 + flash * .25} stars={.5 * (1 - kw)} />
          <Layer d={60} blur={0}>
            <Moon x={360} y={210} r={56} color={k.moon} glow={moonG} pulse={0} texture={1} />
            <Wisp x={200 + wind * .25} y={230} w={900} h={70} color={mixhex(k.cloud, k.sil, .3)} opacity={kw * .85} />
          </Layer>
          <Layer d={18} blur={0}>
            <StormMass seed={50} x={1480} y={820} w={1500} h={mix(430, 640, kw)} dark={mixhex(k.cloud, k.sil, .45)} lit={mixhex(k.cloudLit, k.fog, .3)} t={t * 2} flash={flash} fx={.4 + (lt > tF2 ? .2 : 0)} fy={.45} />
            <Lightning seed={501} x0={1400} y0={420} x1={1290} y1={800} flash={strike(lt - tF2)} width={2.2} branches={3} />
            <CloudBank seed={502} y={815} x0={600} x1={3200} size={360} count={9} dark={mixhex(k.cloud, k.sil, .5)} lit={k.cloudLit} t={t} drift={-6} />
          </Layer>
          <Layer d={8} blur={0}>
            <CloudBank seed={503} y={860} x0={-1600} x1={3500} size={460} count={12} dark={k.cloud} lit={k.cloudLit} t={t} drift={-8} rim={flash > .05 ? mixc(k.cloudLit, "#ffffff", flash) : undefined} />
          </Layer>
          <Layer d={4} blur={.6}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Wisp key={i} x={-200 + i * 520 - wind * (.7 + rnd(504, i) * .6)} y={380 + rnd(505, i) * 420} w={700 + rnd(506, i) * 600} h={14 + rnd(507, i) * 16} color={k.cloudLit} opacity={.18 + kw * .2} />
            ))}
          </Layer>
          <Layer d={3} blur={1.2}>
            <CloudBank seed={508} y={1060} x0={-1400} x1={3400} size={760} count={7} dark={mixhex(k.cloud, k.sil, .2)} lit={k.cloudLit} t={t} drift={-10} />
          </Layer>
          <Layer d={1}>
            <CloudMass seed={509} x0={-900} x1={640} y={908} depth={360} dark={mixhex(k.cloud, k.sil, .2)} lit={k.cloudLit} rim={mixc(k.cloudLit, "#ffffff", .5 + flash * .5)} ends="R" />
            <Kid variant="friend" accent={PINK} pose={pose(fp)} sil={k.sil} rim={RIM(k, .8, -.6, .02 + flash * .02)} />
            <Kid pose={pose(kp)} sil={k.sil} rim={RIM(k, .8, -.6, .02 + flash * .02)} />
            <Moths t={t} at={(tt) => swarm(5001, 10, tt, { cx: 520, cy: 760, rx: 160, ry: 70, speed: .25 + kw * .2, size: 3.5 })} color={MOTH} trail={2} />
          </Layer>
          <Layer d={.6} blur={6}>
            {[0, 1, 2].map((i) => (
              <Wisp key={i} x={600 + i * 900 - wind * 2.2} y={200 + i * 330} w={1400} h={40} color={k.cloudLit} opacity={.12 + kw * .18} />
            ))}
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 51. 옆 트래킹(2마디): 손잡고 구름 징검다리를 왼쪽으로 뛴다. 착지마다 박. 오른쪽에서 검은 폭풍 벽이 따라붙는다
    id: "a4-hop", start: T51, key: "storm", enter: { type: "flash", color: "#eaf6ff" },
    render: (c) => {
      const k = ST, lt = c.lt, t = c.t;
      const tL1 = beat(196.5) - T51, tL2 = beat(199.5) - T51, tL3 = beat(200.75) - T51, tTurn = beat(201.5) - T51;
      const flash = clamp(strike(lt - tL1, .6) + strike(lt - tL2, 1) + strike(lt - tL3, .7));
      const s = 270;
      const camX = Array.from({ length: 8 }, (_, i) => hopAt(t - i * .08).x).reduce((a, b) => a + b, 0) / 8 + 170;
      const shake = HOP.L.reduce((acc, L) => acc + (t > L ? Math.exp(-(t - L) * 12) * Math.sin((t - L) * 55) * 6 : 0), 0);
      const hh = handheld(t, 51, 6, .5);
      const cam: Cam = { x: camX + hh.x, y: 560 + hh.y + shake, zoom: 1.02, rot: hh.r + .015, focus: 1, dof: 3 };
      const turned = lt > tTurn;
      const turnW = ease("back", lin(tTurn, tTurn + .25, lt));
      let kp = hopPose(t, s, 0, turned ? 1 : -1, 511);
      let fp = hopPose(t - .05, s * .97, 112, turned ? 1 : -1, 512);
      if (turned) { kp = { ...kp, headTilt: mix(0, -.15, turnW), lean: -.05 }; fp = { ...fp, headTilt: mix(0, -.2, turnW), lean: -.08 }; }
      const ksk = skeleton(kp), fsk = skeleton(fp);
      const ka = turned ? ksk.shN : ksk.shF, fa = turned ? fsk.shF : fsk.shN;
      const J = { x: (ka.x + fa.x) / 2, y: (ka.y + fa.y) / 2 + .1 * s };
      kp = ikArm(kp, turned ? 0 : 1, J.x, J.y);
      fp = ikArm(fp, turned ? 1 : 0, J.x, J.y);
      const h = hopAt(t);
      // 폭풍 벽: 화면 오른쪽에서 안쪽으로 밀려온다(깊이 5 층의 세계 좌표로 바꿔 그린다)
      const wallSx = mix(2050, 1350, ease("io", c.p));
      const wall = unproject(cam, 5, wallSx, 0);
      const rainAmt = smooth(0, .75, c.p);
      const stonePress = (i: number) => {
        if (i === 0) return lt < .24 ? .3 * smooth(0, .2, lt) : 0;
        const L = HOP.L[i - 1];
        if (t < L) return 0;
        const off = i < 6 ? HOP.off[i] : 99;
        return t < off + .05 ? springStep(t - L, 18, .4) * .6 : Math.max(0, .6 - (t - off) * 3) * 0 + Math.exp(-(t - off) * 6) * .3;
      };
      const stoneRim = mixc(k.cloudLit, "#ffffff", .2 + flash * .8);
      return (
        <Scene cam={cam}>
          <Sky k={k} t={t} horizon={760} glowX={600} glowOpacity={.35 + flash * .3} />
          <Layer d={60} blur={0}>
            <Moon x={330} y={170} r={42} color={k.moon} glow={.7 * (1 - c.p * .8)} />
            <CloudBank seed={510} y={260} x0={-300} x1={2400} size={420} count={8} dark={mixhex(k.cloud, k.sil, .3)} lit={k.cloudLit} t={t} drift={-25} opacity={.85} />
          </Layer>
          <Layer d={14} blur={0}>
            <CloudBank seed={513} y={760} x0={-2600} x1={3800} size={420} count={16} dark={mixhex(k.cloud, k.sil, .3)} lit={mixhex(k.cloudLit, k.fog, .3)} t={t} drift={-6} />
          </Layer>
          <Layer d={5}>
            <StormMass seed={514} x={wall.x + 700} y={1050} w={2000} h={1500} dark={mixhex(k.cloud, k.sil, .55)} lit={k.cloudLit} t={t * 2.5} flash={flash} fx={.3} fy={.55} edge={flash > .05 ? mixc(k.cloudLit, "#ffffff", flash) : undefined} />
            <Lightning seed={515} x0={wall.x + 300} y0={-250} x1={wall.x + 60} y1={760} flash={strike(lt - tL2)} width={4} branches={5} />
            <Lightning seed={516} x0={wall.x + 600} y0={-100} x1={wall.x + 420} y1={600} flash={strike(lt - tL3, .8)} width={3} branches={3} />
          </Layer>
          <Layer d={3.2} blur={1.4}>
            <CloudBank seed={517} y={1080} x0={-3000} x1={3200} size={700} count={14} dark={mixhex(k.cloud, k.sil, .35)} lit={k.cloudLit} t={t} drift={-12} />
          </Layer>
          <Layer d={1.8} blur={1}>
            {Array.from({ length: 9 }, (_, i) => (
              <CloudStone key={i} seed={5180 + i} x={1900 - i * 520 + rnd(518, i) * 200} y={700 + rnd(519, i) * 90} w={200 + rnd(520, i) * 90} dark={mixhex(k.cloud, k.sil, .3)} lit={mixhex(k.cloudLit, k.cloud, .3)} />
            ))}
          </Layer>
          <Layer d={Infinity} blur={0}>
            <Rain seed={51} t={t} count={Math.round(mix(40, 200, rainAmt))} angle={-.3} color={k.glow} opacity={.18 + rainAmt * .2} speed={2200} len={60} x0={mix(1100, -400, rainAmt)} x1={2400} />
          </Layer>
          <Layer d={1}>
            {HOP.xs.map((x, i) => (
              <CloudStone key={i} seed={5200 + i} x={x} y={HOP.tops[i] + Math.sin(t * 1.4 + i) * 5} w={i === 0 ? 330 : 300} dark={mixhex(k.cloud, k.sil, .2)} lit={k.cloudLit} rim={stoneRim} press={stonePress(i)} />
            ))}
            {HOP.L.map((L, i) => <Vapor key={i} x={HOP.xs[i + 1] + 50} y={HOP.tops[i + 1] - 4} t={t} t0={L} r={150} color={mixc(k.cloudLit, k.fog, .3)} seed={530 + i} n={10} dur={.9} />)}
            <Kid variant="friend" accent={PINK} pose={pose(fp)} sil={k.sil} rim={RIM(k, .85, -.5, .014 + flash * .02, .9)} />
            <Kid pose={pose(kp)} sil={k.sil} rim={RIM(k, .85, -.5, .014 + flash * .02, .9)} />
          </Layer>
          <Layer d={1.15} blur={0}>
            <Moths t={t} at={(tt) => { const q = hopAt(tt - .22); return swarm(5101, 30, tt, { cx: q.x + 80, cy: q.y - 230, rx: 280, ry: 150, speed: .6, size: 6 }); }} color={MOTH} trail={3} />
          </Layer>
          <Layer d={.45} blur={8}>
            {Array.from({ length: 6 }, (_, i) => (
              <Wisp key={i} x={1800 - i * 1100 + rnd(521, i) * 300} y={i % 2 ? 1000 : 120} w={900} h={110} color={k.cloudLit} opacity={.35} />
            ))}
            <CloudStone seed={522} x={-200} y={1060} w={520} dark={k.sil} lit={k.cloud} />
            <CloudStone seed={523} x={-1700} y={1040} w={600} dark={k.sil} lit={k.cloud} />
          </Layer>
          {void h}
        </Scene>
      );
    },
  },
  {
    // 52. 낙뢰(박 202): 하얀 번쩍임. 바로 뒤 구름에 번개가 꽂히고, 나방이 사방으로 흩어진다. 친구 발밑 구름이 터져 떨어지고 아이가 손을 붙든다
    id: "a4-strike", start: T52, key: "storm", enter: { type: "cut" },
    render: (c) => {
      const k = ST, lt = c.lt, t = c.t;
      const bolt = lt < .07 ? 1 : kf(lt, [[.07, 1], [.11, .25], [.15, 1], [.22, .45], [.3, .8], [.6, 0, "out"]]);
      const white = 1 - ease("out", lin(0, .3, lt));
      const shake = Math.exp(-lt * 5.5) * 30;
      const cam: Cam = { x: 960 + Math.sin(lt * 61) * shake, y: 470 + Math.cos(lt * 53) * shake, zoom: mix(1, 1.08, ease("expoOut", lin(0, .6, lt))), rot: Math.sin(lt * 37) * .012 * Math.exp(-lt * 4), focus: 1, dof: 3 };
      const drop = ease("in", lin(.12, .55, lt));
      const kneel = ease("back", lin(.18, .45, lt));
      const flinch = ease("expoOut", lin(0, .1, lt));
      const s = 380;
      const edge = { x: 1010, y: 832 };
      // 아이: 움찔(팔로 얼굴 가림) → 무릎 꿇고 엎드려 손을 뻗는다
      let kp: Partial<Pose> = lerpPose(
        lerpPose({ ...P.stand, headTilt: -.15 }, { lean: -.22, bend: .1, headTilt: .35, squash: .1, armN: [2.3, 1.9], armF: [1.8, 1.4], legN: [.3, .5], legF: [-.2, .4] }, flinch),
        { lean: 1.0, bend: .35, headTilt: .55, squash: 0, legN: [1.65, 2.6], legF: [1.45, 2.55], armF: [1.2, .8] }, kneel);
      kp = { ...kp, anchor: "feet", x: mix(880, 860, kneel), y: 830, s, facing: 1, swing: 1.4 };
      // 손 맞잡은 점: 처음엔 둘 사이, 구름이 터지면 모서리 아래로
      const J0 = { x: 950, y: 690 };
      const J = { x: mix(J0.x, edge.x + 20, drop), y: mix(J0.y, edge.y + 40, drop) + Math.sin(Math.max(0, lt - .55) * 9) * 10 * smooth(.55, .7, lt) };
      kp = ikArm(kp, 0, J.x, J.y);
      // 친구: 서 있다가 발밑이 꺼지며 매달린다
      const fStand = pose({ ...lerpPose({ ...P.stand, headTilt: -.2 }, { lean: -.3, headTilt: .3, armF: [2.2, 1.6], squash: .08 }, flinch), anchor: "feet", x: 1060, y: 832, s: s * .97, facing: 1, swing: 1.4 });
      const fHang = hangFrom(J, Math.PI / 2 + .25 * Math.sin(lt * 4), { s: s * .97, armF: [2.6, .5], legN: [.6, .9], legF: [-.2, .6], headTilt: -.5, swing: 1.8, mouth: .8 });
      const fp = drop < .5 ? ikArm(fStand, 0, J.x, J.y) : fHang;
      const fpose = drop < .5 ? fp : lerpPose(ikArm(fStand, 0, J.x, J.y), fHang, smooth(.5, .8, drop));
      const fPos = drop < .5 ? fp : { ...fpose, anchor: "center" as const, x: fHang.x, y: mix(fHang.y! - 120, fHang.y!, smooth(.5, 1, drop)) };
      const C = { x: 960, y: 620 };
      const scatter = (tt: number): M[] => {
        const l = tt - T52;
        const base = swarm(5201, 60, tt, { cx: C.x, cy: C.y, rx: 300, ry: 170, speed: .6, size: 7 });
        if (l < 0) return base;
        const e = 1 - Math.exp(-l * 4);
        return base.map((m, i) => {
          const a = Math.atan2(m.y - C.y, m.x - C.x) + (rnd(52, i) - .5) * .5;
          const v = 900 + rnd(53, i) * 1500;
          return { ...m, x: m.x + Math.cos(a) * v * e * .6, y: m.y + Math.sin(a) * v * e * .6 + l * l * 120, a, b: m.b * (1 - smooth(.5, 1.05, l) * .5), f: m.f * 1.6 };
        });
      };
      const boltX0 = 1420, boltX1 = 1230, boltY1 = 840;
      return (
        <Scene cam={cam}>
          <Sky k={k} t={t} horizon={900} glowX={boltX1} glowOpacity={.3 + bolt * .5} />
          <Layer d={10} blur={0}>
            <CloudBank seed={521} y={930} x0={-1400} x1={3400} size={520} count={10} dark={mixhex(k.cloud, k.sil, .3)} lit={mixc(k.cloudLit, "#ffffff", bolt * .6)} t={t} drift={-8} />
            <CloudBank seed={522} y={180} x0={-1400} x1={3400} size={700} count={7} dark={mixhex(k.cloud, k.sil, .5)} lit={mixc(k.cloud, "#dff4ff", bolt * .5)} t={t} drift={-14} />
          </Layer>
          <Layer d={2.2} blur={1}>
            <Glow x={boltX1} y={boltY1} r={700} color="#e8f8ff" opacity={bolt * .55} />
            <Lightning seed={523} x0={boltX0} y0={-300} x1={boltX1} y1={boltY1} flash={bolt} width={9} branches={6} />
            <Vapor x={boltX1} y={boltY1 - 20} t={lt} t0={0} r={420} n={14} color={mixc(k.cloudLit, "#ffffff", .5)} dur={1.1} seed={524} />
          </Layer>
          <Layer d={1}>
            <CloudStone seed={525} x={870} y={834} w={360} dark={mixhex(k.cloud, k.sil, .2)} lit={mixc(k.cloudLit, "#ffffff", bolt * .7)} rim={mixc(k.cloudLit, "#ffffff", .3 + bolt * .7)} />
            <CloudStone seed={526} x={1120} y={836 + drop * 120} w={260} dark={mixhex(k.cloud, k.sil, .2)} lit={mixc(k.cloudLit, "#ffffff", bolt * .7)} opacity={1 - smooth(.08, .35, lt)} />
            <Vapor x={1110} y={840} t={lt} t0={.1} r={260} n={12} color={mixc(k.cloudLit, k.fog, .3)} dur={.9} seed={527} />
            <Kid variant="friend" accent={PINK} pose={pose(fPos)} sil={k.sil} rim={RIM(k, .7, -.7, .02 + bolt * .03, 1, "#ffffff")} />
            <Kid pose={pose(kp)} sil={k.sil} rim={RIM(k, .7, -.7, .02 + bolt * .03, 1, "#ffffff")} />
          </Layer>
          <Layer d={.85} blur={0}>
            <Moths t={t} at={scatter} color={MOTH} trail={4} trailDt={.03} />
          </Layer>
          <Screen>
            <rect x={0} y={0} width={1920} height={1080} fill="#f4fbff" opacity={white * .92} />
          </Screen>
        </Scene>
      );
    },
  },
  {
    // 53. 클로즈업(느리게): 맞잡은 손가락이 조금씩 미끄러져 박(205)에 끝이 떨어진다. 번개가 뒤에서 손을 비춘다
    id: "a4-slip", start: T53, key: "storm", enter: { type: "cut" },
    render: (c) => {
      const k = ST, lt = c.lt, t = c.t;
      const tSep = beat(205) - T53;
      const slip = ease("in", lin(0, tSep, lt));
      const away = ease("in", lin(tSep - .02, c.dur + .1, lt));
      const fl = strike(lt - tSep + .03, .9) + .35 + .12 * Math.sin(t * 2.3);
      const hh = handheld(t, 53, 3, .25);
      const cam: Cam = { x: 960 + hh.x, y: 540 + hh.y, zoom: kf(lt, [[0, 1], [c.dur, 1.1, "io"]]), rot: hh.r, focus: 1, dof: 9 };
      const a = .9;
      const C = { x: 960, y: 520 };
      const dirx = Math.cos(a), diry = Math.sin(a);
      const kidH: HandSpec = { x: C.x - dirx * 260 - diry * 34, y: C.y - diry * 260 + dirx * 34, a, s: 430, curl: mix(1.05, 1.35, slip) + away * .2, stagger: .12 * slip, spread: .25, thumb: .5, sleeve: 2.4 };
      const d = slip * 110 + away * 1100;
      const fs = 430 * (1 - away * .5);
      const fH: HandSpec = { x: C.x + dirx * 260 + diry * 34 + dirx * d, y: C.y + diry * 260 - dirx * 34 + diry * d + away * 200, a: a + Math.PI + away * .6, s: fs, curl: mix(1.05, .35, slip) - away * .2, stagger: -.18 * slip, spread: .25 + slip * .2, thumb: .4, sleeve: 2.4 };
      const rim = { dx: .55, dy: -.85, color: "#e8f8ff", w: .022, opacity: clamp(fl) };
      const drops = (seed: number) => Array.from({ length: 14 }, (_, i) => {
        const l = lt - tSep;
        if (l < 0) return null;
        const ang = -1.2 + rnd(seed, i) * 2.6;
        const v = 120 + rnd(seed, i + 9) * 260;
        const x = C.x + 60 + Math.cos(ang) * v * l, y = C.y + 40 + Math.sin(ang) * v * l + 60 * l * l;
        return <circle key={i} cx={x} cy={y} r={2 + rnd(seed, i + 20) * 4} fill="#eaf8ff" opacity={clamp(1 - l * .8) * .9} />;
      });
      return (
        <Scene cam={cam}>
          <Sky k={k} t={t} horizon={1100} glowX={1150} glowR={900} glowOpacity={.4}>
            <Glow x={1180} y={360} r={900} color={k.glow} opacity={clamp(fl) * .7} />
            <Glow x={1180} y={360} r={260} color="#ffffff" opacity={clamp(fl - .3) * .6} />
          </Sky>
          <Layer d={6} blur={6}>
            <CloudBank seed={531} y={1000} x0={-1200} x1={3200} size={700} count={8} dark={mixhex(k.cloud, k.sil, .4)} lit={mixc(k.cloudLit, "#ffffff", clamp(fl) * .5)} t={t} drift={-4} />
            <CloudBank seed={532} y={240} x0={-1200} x1={3200} size={600} count={7} dark={mixhex(k.cloud, k.sil, .5)} lit={k.cloudLit} t={t} drift={3} />
          </Layer>
          <Layer d={2} blur={3}>
            <Rain seed={532} t={t * .12} count={90} angle={.15} color="#d6eef6" opacity={.5} speed={2200} len={22} width={2.2} />
          </Layer>
          <Layer d={1}>
            <Hand {...fH} color={mixhex(k.sil, k.silFar, .55)} rim={rim} />
            <Hand {...kidH} color={k.sil} rim={rim} />
            {drops(533)}
          </Layer>
          <Layer d={.6} blur={7}>
            <Rain seed={534} t={t * .12} count={30} angle={.15} color="#d6eef6" opacity={.55} speed={2600} len={40} width={5} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 54. 위에서 내려다봄: 친구가 검은 구름 속으로 작아지며 떨어진다. 박(208)에 구름 속 번개가 실루엣을 비추고 삼킨다. 위에서 손을 뻗는 아이
    id: "a4-fall", start: T54, key: "storm", enter: { type: "cut" },
    render: (c) => {
      const k = ST, lt = c.lt, t = c.t;
      const tGone = beat(208) - T54;
      const VP = { x: 1010, y: 660 };
      const z = 1 + 1.1 * lt + 2.6 * lt * lt;
      const f0 = { x: 930, y: 300 };
      const fx = VP.x + (f0.x - VP.x) / z + n2(541, t) * 20 / z, fy = VP.y + (f0.y - VP.y) / z;
      const fs = 300 / z;
      const fl = strike(lt - tGone, 1) + strike(lt - .25, .35);
      const hh = handheld(t, 54, 6, .55);
      const cam: Cam = { x: 960 + hh.x, y: 540 + hh.y, zoom: kf(lt, [[0, 1], [c.dur, 1.12, "in"]]), rot: hh.r + .03, focus: 1, dof: 3 };
      const close = ease("io", lin(tGone - .5, tGone + .25, lt));
      const fp = pose({ ...P.flail, anchor: "center", x: fx, y: fy, s: fs, facing: -1, rot: .3 * Math.sin(lt * 2.2) + lt * .5, armN: [2.85, .2], armF: [2.5, .4], swing: 2.2, legN: [.9 + .3 * Math.sin(lt * 9), .6], legF: [-.3, 1.0 + .3 * Math.sin(lt * 8)] });
      const ready = smooth(tGone + .05, c.dur, lt);
      let kp: Partial<Pose> = pose({ anchor: "center", x: 870 - ready * 20, y: -70 - ready * 40, s: 560, facing: 1, rot: Math.PI - .28, lean: .1, headTilt: mix(-.35, .2, ready), armF: [1.3, 1.3], legN: [.1, .2], legF: [-.1, .25], swing: 1.2 + n2(542, t * 2) * .3 });
      kp = ikArm(kp, 0, mix(fx, 960, ready * .6), mix(fy, 300, ready * .6));
      const puffs = Array.from({ length: 9 }, (_, i) => {
        const th = (i / 9) * TAU + rnd(543, i);
        const r0 = 520 + rnd(544, i) * 260;
        const r = mix(r0, r0 * .18, close) + n2(545 + i, t * .5) * 30;
        return { x: VP.x + Math.cos(th) * r, y: VP.y + Math.sin(th) * r * .8, rr: 230 + rnd(546, i) * 140 };
      });
      return (
        <Scene cam={cam} bg={k.sky[0]}>
          <Layer d={Infinity} blur={0}>
            <rect x={-200} y={-200} width={2400} height={1500} fill={k.sky[1]} />
            <Glow x={VP.x} y={VP.y} r={900} color={k.cloud} opacity={.9} />
          </Layer>
          <Layer d={9} blur={2}>
            {Array.from({ length: 14 }, (_, i) => {
              const th = (i / 14) * TAU;
              const r = 300 + rnd(547, i) * 340;
              return <circle key={i} cx={VP.x + Math.cos(th) * r} cy={VP.y + Math.sin(th) * r * .8} r={170 + rnd(548, i) * 120} fill={mixhex(k.cloud, k.sil, .35)} />;
            })}
            <Glow x={VP.x - 40} y={VP.y + 20} r={520} color={k.glow} opacity={clamp(fl) * .9} />
            <Glow x={VP.x - 40} y={VP.y + 20} r={160} color="#ffffff" opacity={clamp(fl) * .7} />
            <Lightning seed={549} x0={VP.x - 300} y0={VP.y - 120} x1={VP.x + 120} y1={VP.y + 200} flash={strike(lt - tGone, .9)} width={2.5} branches={3} />
          </Layer>
          <Layer d={1} blur={0}>
            <Kid variant="friend" accent={PINK} pose={fp} sil={k.sil} rim={RIM(k, 0, 1, .03, 1, "#ffffff")} opacity={1 - smooth(tGone + .1, tGone + .35, lt)} />
          </Layer>
          <Layer d={4} blur={2}>
            {puffs.map((p, i) => <Glow key={i} x={p.x} y={p.y} r={p.rr} color={mixhex(k.cloud, k.cloudLit, .25 + clamp(fl) * .5)} opacity={.85 * (.4 + close * .6)} />)}
          </Layer>
          <Layer d={Infinity} blur={0}>
            <RadialRain t={t} vx={VP.x} vy={VP.y} count={170} speed={1.1} color="#cfe6ee" opacity={.45} />
          </Layer>
          <Layer d={1}>
            <path d={`M-400,-400H2400V${150}${Array.from({ length: 12 }, (_, i) => { const x = 2400 - (i + 1) * 233; return `Q${x + 116},${230 + rnd(550, i) * 80} ${x},${150 + rnd(551, i) * 40}`; }).join("")}L-400,150Z`} fill={mixhex(k.cloud, k.cloudLit, .55)} />
            <Glow x={960} y={60} r={300} rx={1100} ry={150} color={mixc(k.cloudLit, "#ffffff", .3)} opacity={.5} />
            <Kid pose={kp} sil={k.sil} rim={RIM(k, 0, 1, .012 + clamp(fl) * .02, 1, "#e8f8ff")} />
          </Layer>
          <Layer d={.55} blur={8}>
            <Streaks t={t} count={14} dir={Math.PI / 2 + .1} speed={900} len={260} width={5} opacity={.25} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 55. 다이빙(1.5박): 구름 끝을 박차고 머리부터 내리꽂힌다. 카메라가 같이 떨어진다: 구름·비·속도선이 위로 쏟아져 지나간다. 아래에서 친구가 다가온다
    id: "a4-dive", start: T55, key: "storm", enter: { type: "cut" },
    render: (c) => {
      const k = ST, lt = c.lt, t = c.t;
      const tL = beat(209) - T55;
      const push = .13;
      const crouch = pose({ ...P.crouch, anchor: "feet", x: 860, y: 330, s: 330, facing: 1, rot: 0 });
      const pc = skeleton(crouch).pelvis;
      const fall = (x: number) => (x < push ? 0 : 1900 * (x - push) + 2600 * (x - push) * (x - push));
      const ky = pc.y + fall(lt), kx = pc.x + ease("out", lin(push, .5, lt)) * 110;
      const camY = 540 + fall(lt - .05) + 120 * ease("out", lin(push, .4, lt));
      const fl = strike(lt - tL, 1);
      const hh = handheld(t, 55, 8, 1.2);
      const cam: Cam = { x: 980 + hh.x, y: camY + hh.y, zoom: 1.04, rot: -.05 + hh.r, focus: 1, dof: 4 };
      const dive = ease("expoOut", lin(push - .03, .42, lt));
      const kp = lt < push
        ? pose({ ...lerpPose(P.crouch, { ...P.crouch, squash: .25, lean: .7, headTilt: .3 }, smooth(0, push, lt)), anchor: "feet", x: 860, y: 330, s: 330, facing: 1 })
        : pose({ ...lerpPose({ ...P.leap, rot: .8 }, P.dive, dive), anchor: "center", x: kx, y: ky, s: 330, facing: 1, rot: mix(.8, 2.85, dive) + n2(551, t * 3) * .05, swing: mix(.5, 2.6, dive), armN: [mix(2.5, 2.95, dive), 0], armF: [mix(2.2, 2.8, dive), .05] });
      // 친구: 아래에서 화면으로 올라온다(우리가 더 빨리 떨어진다)
      const fyS = kf(lt, [[.5, 1350], [c.dur, 820, "out"]]);
      const fw = unproject(cam, 1, 1040, fyS);
      const fp = pose({ ...P.hang, anchor: "center", x: fw.x, y: fw.y, s: 300, facing: -1, rot: .25 + n2(552, t * 2) * .1, swing: 2.4, armN: [2.95, .1], armF: [2.4, .5], headTilt: -.6, legN: [.4, .9], legF: [-.3, .7] });
      const colY = (i: number) => i * 700;
      return (
        <Scene cam={cam} bg={k.sky[0]}>
          <Layer d={Infinity} blur={0}>
            <rect x={-300} y={-300} width={2520} height={1680} fill={k.sky[1]} />
            <Glow x={300} y={300} r={900} color={k.glow} opacity={.15 + fl * .6} />
            <Streaks seed={55} t={t} count={150} dir={-Math.PI / 2 - .04} speed={3600} len={240} width={1.8} color="#cfe6ee" opacity={.4} />
          </Layer>
          <Layer d={7} blur={0}>
            {Array.from({ length: 16 }, (_, i) => (
              <ellipse key={i} cx={(i % 2 ? 1700 : 200) + rnd(553, i) * 300 - 150} cy={colY(i)} rx={260 + rnd(554, i) * 160} ry={700} fill={mixhex(k.cloud, k.sil, .25)} opacity={.9} />
            ))}
            <Lightning seed={555} x0={250} y0={camY / 7 - 300} x1={420} y1={camY / 7 + 500} flash={fl} width={3} branches={4} />
          </Layer>
          <Layer d={2.6} blur={2}>
            {Array.from({ length: 14 }, (_, i) => (
              <ellipse key={i} cx={(i % 2 ? 1900 : 40) + rnd(556, i) * 260 - 130} cy={colY(i) * 1.4 + 300} rx={300 + rnd(557, i) * 160} ry={900} fill={mixhex(k.cloud, k.cloudLit, .2 + fl * .4)} opacity={.85} />
            ))}
          </Layer>
          <Layer d={1}>
            <CloudMass seed={558} x0={-900} x1={930} y={330} depth={500} dark={mixhex(k.cloud, k.sil, .2)} lit={k.cloudLit} rim={mixc(k.cloudLit, "#ffffff", .4)} ends="R" />
            <Kid variant="friend" accent={PINK} pose={fp} sil={k.sil} rim={RIM(k, -.6, -.8, .016 + fl * .02, .9, "#e8f8ff")} />
            <Kid pose={kp} sil={k.sil} rim={RIM(k, -.6, -.8, .016 + fl * .03, .9, "#e8f8ff")} />
          </Layer>
          <Layer d={.4} blur={7}>
            <Streaks seed={559} t={t} count={22} dir={-Math.PI / 2} speed={7000} len={520} width={7} color="#e8f6ff" opacity={.3} x0={-600} x1={2520} y0={-600} y1={1700} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 56. 클로즈업 → 미디엄: 박(210)에 손을 잡는다(금빛 터짐). 다이빙의 힘으로 둘이 함께 돌며 굴러떨어지고, 박(212)의 번개가 둘을 비춘다. 끝은 검은 구름 속으로
    id: "a4-catch", start: T56, key: "storm", enter: { type: "cut" },
    render: (c) => {
      const k = ST, lt = c.lt, t = c.t;
      const tL = beat(212) - T56;
      const spin = 2.3 * (1 - Math.exp(-lt * 1.4)) + .1 * lt;
      const phi = -Math.PI / 2 - .2 + spin;
      const Pc = { x: 960, y: 540 };
      const s = 400;
      const fl = strike(lt - tL, 1);
      const shake = Math.exp(-lt * 7) * 22;
      const zoom = kf(lt, [[0, 3.6], [.5, 3.25, "out"], [2.05, 1.0, "sineIO"]]);
      const cam: Cam = { x: Pc.x + Math.sin(lt * 57) * shake, y: Pc.y + Math.cos(lt * 49) * shake, zoom, rot: spin * .32 + Math.sin(lt * 33) * .01 * shake / 22, focus: 1, dof: 4 };
      const kp = hangFrom(Pc, phi, { s, armF: [2.0, .6], legN: [.1, .3 + .2 * Math.sin(lt * 5)], legF: [-.2, .5], toe: 1, headTilt: -.3, swing: 2.0 + n2(561, t * 2) * .4, rot: .05 });
      const fp = hangFrom(Pc, phi + Math.PI, { s: s * .97, armF: [1.6, .9], legN: [.6, .9 + .3 * Math.sin(lt * 6)], legF: [-.2, .7], headTilt: -.4, swing: 2.2 + n2(562, t * 2) * .4, rot: -.05 });
      const dk = { x: Math.cos(phi), y: Math.sin(phi) };
      const L = .12 * s, hs = .2 * s, off = .025 * s;
      const grip = mix(.7, 1.3, ease("back", lin(0, .25, lt)));
      const ecu = 1 - smooth(1.2, 1.8, lt);
      const gold = Math.exp(-lt * 2.2);
      const rimGold = { dx: -dk.y, dy: dk.x, color: mixc("#e8f8ff", GOLD, gold), w: .03, opacity: clamp(gold + fl) };
      const kidH: HandSpec = { x: Pc.x + dk.x * L - dk.y * off, y: Pc.y + dk.y * L + dk.x * off, a: phi + Math.PI, s: hs, curl: grip, spread: .2, thumb: .9, sleeve: .9 };
      const friH: HandSpec = { x: Pc.x - dk.x * L + dk.y * off, y: Pc.y - dk.y * L - dk.x * off, a: phi, s: hs, curl: grip, spread: .2, thumb: .9, sleeve: .9 };
      const swallow = ease("in", lin(2.0, c.dur, lt));
      return (
        <Scene cam={cam} bg={k.sky[0]}>
          <Layer d={Infinity} blur={0}>
            <rect x={-600} y={-600} width={3120} height={2280} fill={k.sky[1]} />
            <Glow x={1500} y={200} r={1100} color={k.glow} opacity={.12 + fl * .7} />
            <Streaks seed={56} t={t} count={120} dir={-Math.PI / 2 - .1} speed={1500} len={110} width={1.6} opacity={.35} x0={-500} x1={2420} y0={-500} y1={1580} />
          </Layer>
          <Layer d={4} blur={2.5}>
            {Array.from({ length: 10 }, (_, i) => (
              <Glow key={i} x={-300 + rnd(563, i) * 2500} y={((rnd(564, i) * 2600 - lt * 900) % 2600 + 2600) % 2600 - 800} r={300 + rnd(565, i) * 200} ry={600} rx={340} color={mixhex(k.cloud, k.cloudLit, .25 + fl * .5)} opacity={.75} />
            ))}
          </Layer>
          <Layer d={1}>
            <Kid variant="friend" accent={PINK} pose={fp} sil={mixhex(k.sil, k.silFar, .35)} rim={RIM(k, -.5, -.85, .016 + fl * .02, .9, mixc("#e8f8ff", GOLD, gold * .7))} />
            <Kid pose={kp} sil={k.sil} rim={RIM(k, -.5, -.85, .016 + fl * .02, .9, mixc("#e8f8ff", GOLD, gold * .7))} />
            <g opacity={ecu}>
              <Hand {...friH} color={mixhex(k.sil, k.silFar, .35)} rim={rimGold} />
              <Hand {...kidH} color={k.sil} rim={rimGold} />
            </g>
          </Layer>
          <Layer d={1} blend="screen">
            <Glow x={Pc.x} y={Pc.y} r={140} color={GOLD} opacity={gold * .9} />
            <Burst x={Pc.x} y={Pc.y} t={t} t0={T56} dur={1.1} n={36} r={170} color={GOLD} />
            <Burst x={Pc.x} y={Pc.y} t={t} t0={T56 + .04} dur={.7} n={18} r={90} color="#fff3c8" seed={14} />
          </Layer>
          <Layer d={.7} blur={9}>
            <Glow x={960} y={mix(2300, 520, swallow)} r={900} rx={1600} ry={900} color={k.sky[0]} opacity={swallow} />
            <Streaks seed={566} t={t} count={10} dir={-Math.PI / 2} speed={2400} len={300} width={6} opacity={.18} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 57. 어둠(dip): 폭풍 속 거의 검정. 박(215) 아이의 폰, 박(216) 친구의 폰이 켜진다. 차가운 빛 둘만 얼굴을 비춘다. 비는 빛 안에서만 보인다.
    //     박(217)에 서로를 보고, 끝에서 카메라가 물러나 빛 두 점이 화면 가운데 남는다(5막 첫 컷으로)
    id: "a4-dark", start: T57, key: "storm", enter: { type: "dip" },
    render: (c) => {
      const k = ST, lt = c.lt, t = c.t;
      const t1 = beat(215) - T57, t2 = beat(216) - T57, tLook = beat(217) - T57;
      const onAt = (x: number) => (x < 0 ? 0 : clamp(ease("expoOut", x / .3)) * (1 + .5 * Math.exp(-x * 10)));
      const on1 = onAt(lt - t1), on2 = onAt(lt - t2);
      const look = ease("back", lin(tLook - .1, tLook + .3, lt));
      const hh = handheld(t, 57, 4, .3);
      const zoom = kf(lt, [[0, 1.2], [1.9, 1.08, "out"], [c.dur, .62, "in"]]);
      const cam: Cam = { x: 960 + hh.x, y: 520 + hh.y, zoom, rot: hh.r, focus: 1, dof: 4 };
      const s = 520, cx = 960, cy = 560;
      const gap = .36 * s;
      const com = (seed: number): Partial<Pose> => ({
        anchor: "center", s, rot: .08 + n2(seed, t * .6) * .07, toe: .7,
        legN: [.35 + n2(seed + 1, t * .9) * .2, .7], legF: [-.15, .9 + n2(seed + 2, t * .8) * .25],
        swing: 1.2 + n2(seed + 3, t * 1.4) * .4, faceDir: .25, faceColor: k.cold, armF: [1.25, 1.55], phone: 0,
      });
      let a: Partial<Pose> = { ...com(571), x: cx - gap, y: cy, facing: 1, headTilt: mix(.32, -.02, look), face: clamp(on1) * .95, eyes: 1, mouth: look * .25 };
      let b: Partial<Pose> = { ...com(572), x: cx + gap, y: cy, facing: -1, headTilt: mix(.3, 0, look), face: clamp(on2) * .95, eyes: 1, smile: look > .6 ? 1 : 0 };
      const hy = cy + .02 * s;
      a = ikArm(a, 0, cx - .01 * s, hy);
      b = ikArm(b, 0, cx + .01 * s, hy);
      const sa = skeleton(a), sb = skeleton(b);
      const ph = (sk: ReturnType<typeof skeleton>, f: number) => ({ x: sk.haF.x + f * .02 * s, y: sk.haF.y - .03 * s });
      const p1 = ph(sa, 1), p2 = ph(sb, -1);
      const mid = "a4dm", rg = "a4dg";
      const phone = (p: { x: number; y: number }, on: number, f: number) => (
        <g>
          <rect x={p.x - .018 * s} y={p.y - .05 * s} width={.036 * s} height={.1 * s} rx={.008 * s} fill={mixc("#1a2a30", k.cold, clamp(on))} transform={`rotate(${f * 14} ${p.x} ${p.y})`} />
          <rect x={p.x - .018 * s + f * .02 * s} y={p.y - .05 * s} width={.006 * s} height={.1 * s} fill="#ffffff" opacity={clamp(on)} transform={`rotate(${f * 14} ${p.x} ${p.y})`} />
        </g>
      );
      const faint = strike(lt - .2, .25);
      return (
        <Scene cam={cam} bg="#000">
          <Layer d={Infinity} blur={0}>
            <rect x={-500} y={-500} width={2920} height={2080} fill={mixhex("#000000", k.sky[0], .8)} />
            <Glow x={1600} y={180} r={700} color={k.glow} opacity={faint * .5} />
          </Layer>
          <Layer d={1}>
            <defs>
              <radialGradient id={rg}>
                <stop offset="0%" stopColor="#fff" stopOpacity={1} />
                <stop offset="45%" stopColor="#fff" stopOpacity={.45} />
                <stop offset="100%" stopColor="#fff" stopOpacity={0} />
              </radialGradient>
              <mask id={mid} maskUnits="userSpaceOnUse" x={-2000} y={-2000} width={6000} height={5000}>
                <rect x={-2000} y={-2000} width={6000} height={5000} fill="#000" />
                <circle cx={p1.x} cy={p1.y} r={s * .75} fill={`url(#${rg})`} opacity={clamp(on1)} />
                <circle cx={p2.x} cy={p2.y} r={s * .75} fill={`url(#${rg})`} opacity={clamp(on2)} />
              </mask>
            </defs>
            <g mask={`url(#${mid})`}>
              <Rain seed={57} t={t} count={260} angle={.12} color={k.cold} opacity={.85} speed={1300} len={46} width={2.2} x0={300} x1={1700} y0={-300} y1={1400} />
            </g>
          </Layer>
          <Layer d={1} blend="screen">
            <Glow x={p1.x} y={p1.y} r={s * .55} color={k.cold} opacity={clamp(on1) * .5} />
            <Glow x={p2.x} y={p2.y} r={s * .55} color={k.cold} opacity={clamp(on2) * .5} />
          </Layer>
          <Layer d={1}>
            <Kid variant="friend" accent={mixc("#000000", PINK, clamp(on2) * .8)} pose={b} sil={k.sil} rim={on2 > .05 ? RIM(k, -1, .25, .012 * clamp(on2), .9, k.cold) : undefined} />
            <Kid pose={a} sil={k.sil} rim={on1 > .05 ? RIM(k, 1, .25, .012 * clamp(on1), .9, k.cold) : undefined} />
            {phone(p1, on1, 1)}
            {phone(p2, on2, -1)}
          </Layer>
          <Layer d={1} blend="screen">
            <Glow x={p1.x} y={p1.y} r={s * .12} color="#ffffff" opacity={clamp(on1) * .55} />
            <Glow x={p2.x} y={p2.y} r={s * .12} color="#ffffff" opacity={clamp(on2) * .55} />
          </Layer>
        </Scene>
      );
    },
  },
];
