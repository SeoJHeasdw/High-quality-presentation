/**
 * 5막(2:30–3:00) — 구조, 달, 새벽. 영화의 절정과 맺음.
 *   부름(아주 먼 와이드: 어둠 속 차가운 점 둘, 멀리 금빛 점들이 돈다) → 모여듦(소용돌이 와이드, 꼬리 긴 줄기)
 *   → 요람(미디엄: 박에 받아 낸다, 얼굴이 금빛) → 상승(아래에서, 구름이 쏟아져 지나감, 번개) → 돌파(흰빛, 거대한 달)
 *   → 닿음(손 클로즈업, 박에 빛 고리) → 터짐(달이 금빛 실로 쏟아짐) → 점화(1번 컷과 같은 구도, 창이 박마다 켜짐)
 *   → 새벽 방(빛 구슬을 안고 잠듦) → 마주 보는 두 창(손 흔들기, 뒤로 빠짐)
 */
import React from "react";
import { Layer, Scene, type Cam } from "../lib/camera";
import { K } from "../lib/palette";
import { B, beat } from "../lib/song";
import { clamp, ease, handheld, kf, lin, mix, mixc, mixhex, n2, rnd, smooth, springStep } from "../lib/math";
import { Cloud, CloudBank, Glow, GodRays, Lightning, Moon, Rain, Stars, Wisp } from "../lib/sky";
import { Bed, Curtain, Skyline, WindowFrame, buildings } from "../lib/city";
import { Moths, Burst, Thread, stream, swarm, toward, type M } from "../lib/moths";
import { getLength, getPointAtLength } from "@remotion/paths";
import { Kid, ikArm, skeleton } from "../kid/rig";
import { P, lerpPose, pose, type Pose } from "../kid/pose";
import { PhoneLight, Rings, RushClouds, SkyLayer, cradlePts, rescueStreams, sparks, type StreamOpt } from "./act5-kit";
import { BookendCity, ROWS, mixKey, windowsOf, type Landing } from "./act5-city";
import type { Shot } from "./types";

// 편집표의 59번 시작 beat(222)는 B(55)와 같은 시각이라 길이 0이 된다 → 마디 가운데 beat(220)에서 자른다
const T58 = B(54), T59 = beat(220), T60 = B(55), T61 = B(56), T62 = B(57), T63 = B(58), T64 = B(59), T65 = B(60), T66 = B(61), T67 = B(62);

const kR = K.rescue;
const GOLD = "#ffd27a";

/** 58~60이 같이 쓰는 나방 시간표(곡 시각). 박 219에 돌아서서 221 즈음 첫 줄기가 닿는다 */
const CALL = { launch: beat(219) - .25, spread: 1.0, travel: 1.75, gap: .045 };
const streams = (seed: number, t: number, o: Omit<StreamOpt, "launch" | "spread" | "travel" | "gap"> & Partial<StreamOpt>) =>
  rescueStreams(seed, t, { ...CALL, ...o });

/**
 * 손잡고 떨어지는 두 아이. 아이(왼쪽, 오른쪽을 봄)와 친구(오른쪽, 왼쪽을 봄)가 가운데서 손을 잡고, 바깥 손에 폰을 든다.
 * look: 고개(+ 숙임), phoneUp: 폰 든 팔 높이, faceC: 얼굴 빛 색
 */
function pair(o: { cx: number; cy: number; s: number; t: number; anchor?: "center" | "seat"; gap?: number; base?: Partial<Pose>; baseF?: Partial<Pose>; face?: number; faceC?: string; tumble?: number; handY?: number; phone?: number }) {
  const { cx, cy, s, t } = o;
  const gap = (o.gap ?? .36) * s;
  const tum = o.tumble ?? 1;
  const common = (seed: number): Partial<Pose> => ({
    anchor: o.anchor ?? "center", s, rot: (.12 + n2(seed, t * .6) * .12) * tum,
    legN: [.35 + n2(seed + 1, t * .9) * .2, .7], legF: [-.15, .9 + n2(seed + 2, t * .8) * .25], toe: .7,
    swing: 1.1 + n2(seed + 3, t * 1.4) * .4, armF: [2.45, .35], face: o.face ?? 0, faceColor: o.faceC ?? kR.cold, faceDir: .2,
  });
  let a: Partial<Pose> = { ...common(11), ...o.base, x: cx - gap, y: cy, facing: 1 };
  let b: Partial<Pose> = { ...common(23), ...o.baseF, x: cx + gap, y: cy, facing: -1 };
  const hy = cy + (o.handY ?? -.02) * s;
  a = ikArm(a, 0, cx - .01 * s, hy);
  b = ikArm(b, 0, cx + .01 * s, hy);
  return { a, b, ska: skeleton(a), skb: skeleton(b), hand: { x: cx, y: hy } };
}

/** 폭풍 속 어두운 구름 색(금빛이 들어올수록 밑면이 데워진다) */
const stormCloud = (warm: number) => ({ dark: mixhex(kR.sky[0], kR.cloud, .7), lit: mixhex(mixhex(kR.cloud, "#4a5a60", .5), kR.cloudLit, warm) });

/** 64: 달에서 쏟아지는 실들. 경로 길이는 한 번만 잰다 */
const BLOOM = (() => {
  const seed = 641, x0 = -900, x1 = 2900, base = 1180, minH = 200, maxH = 420, minW = 60, maxW = 150;
  const bs = buildings(seed, x0, x1, minH, maxH, minW, maxW);
  const moon = { x: 960, y: 290 };
  const N = 48;
  const threads = Array.from({ length: N }, (_, i) => {
    const lx = mix(-260, 2180, (i + rnd(644, i) * .8) / N);
    const b = bs.find((q) => lx >= q.x && lx < q.x + q.w) ?? bs[0];
    const L = { x: lx, y: base - b.h };
    const side = (L.x - moon.x) / 1000;
    const th = -Math.PI / 2 + clamp(side, -1.3, 1.3) * 1.15 + (rnd(645, i) - .5) * .35;
    const L1 = 230 + rnd(646, i) * 330;
    const c1 = { x: moon.x + Math.cos(th) * L1 * 1.5, y: moon.y + Math.sin(th) * L1 * 1.5 };
    const c2 = { x: L.x + (rnd(647, i) - .5) * 120, y: L.y - 380 - rnd(648, i) * 300 };
    const d = `M${moon.x},${moon.y}C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${L.x.toFixed(1)},${L.y.toFixed(1)}`;
    const wave = i % 3;
    const t0 = wave === 0 ? T64 - .05 + rnd(649, i) * .2 : wave === 1 ? beat(239) - .1 + rnd(649, i) * .25 : beat(240) - .1 + rnd(649, i) * .3;
    return { d, len: getLength(d), L, t0, D: 1.5 + rnd(650, i) * .7, w: 1.6 + rnd(651, i) * 1.8 };
  });
  return { seed, x0, x1, base, minH, maxH, minW, maxW, moon, threads };
})();

/** 솟았다가 정점에서 멈칫, 가속하며 떨어지는 실 하나(머리에 반짝임, 닿은 자리에 불씨) */
const BloomThread: React.FC<{ th: (typeof BLOOM.threads)[number]; t: number; color: string }> = ({ th, t, color }) => {
  const x = (t - th.t0) / th.D;
  if (x <= 0) return null;
  const p = x >= 1 ? 1 : x < .3 ? .42 * ease("quadOut", x / .3) : .42 + .58 * Math.pow((x - .3) / .7, 2);
  const head = getPointAtLength(th.d, th.len * p) ?? th.L;
  const land = t - th.t0 - th.D;
  return (
    <g>
      <Thread d={th.d} progress={p} color={color} width={th.w} />
      {x < 1 ? <Glow x={head.x} y={head.y} r={th.w * 13} color={color} opacity={.95} /> : null}
      {x < 1 ? <circle cx={head.x} cy={head.y} r={th.w * 1.5} fill="#fffbe8" /> : null}
      {land > 0 ? <Glow x={th.L.x} y={th.L.y} r={46} color={color} opacity={.9 * Math.exp(-land * 2) + .3} /> : null}
    </g>
  );
};

/** 65: 실이 내려앉는 자리와 박. 243에 바로 그 창(1번 컷의 창)이 있는 건물 */
const IGN = (() => {
  const near = (ri: number, x: number) => {
    const W = windowsOf(ROWS[ri]);
    let bi = 0, best = 1e9;
    W.forEach((w, i) => { const d = Math.abs(w.b.x + w.b.w / 2 - x); if (d < best) { best = d; bi = i; } });
    return bi;
  };
  const tb = near(3, 1180);
  const tw = windowsOf(ROWS[3])[tb];
  const kWin = tw.cols * 3 + 1;
  const lands: Landing[] = [
    { row: 2, bi: near(2, 560), t: beat(242.5) },
    { row: 3, bi: tb, t: beat(243) },
    { row: 1, bi: near(1, 1500), t: beat(243.5) }, { row: 4, bi: near(4, 250), t: beat(243.5) },
    { row: 2, bi: near(2, 1350), t: beat(244) }, { row: 0, bi: near(0, 760), t: beat(244) },
    { row: 3, bi: near(3, 380), t: beat(244.5) }, { row: 1, bi: near(1, 300), t: beat(244.5) },
    { row: 4, bi: near(4, 1600), t: beat(245) }, { row: 2, bi: near(2, 150), t: beat(245) }, { row: 0, bi: near(0, 1650), t: beat(245) },
    { row: 3, bi: near(3, 1750), t: beat(245.5) }, { row: 1, bi: near(1, 900), t: beat(245.5) },
    // 8분음표마다 더 작은 실들(박 사이를 잇는 잔비)
    ...[4, 2, 1, 3, 0, 2, 4, 1, 3, 2, 0, 1].map((row, j) => ({ row, bi: near(row, -100 + rnd(652, j) * 2100), t: beat(243.25 + j * .25) })),
  ];
  return { tb, kWin, lands, target: tw.at(kWin) };
})();

/** 67: 골목(한 점 원근). 단위는 세계 좌표, 카메라는 -Z에서 +Z를 본다 */
const AL = { F: 1000, A: 260, G: 950, TOP: -1050, ZF: 5600, ZK: 640, floors: [-800, -400, 0, 400, 800], bays: Array.from({ length: 13 }, (_, b) => 40 + b * 430) };

export const act5: Shot[] = [
  {
    // 58. 아주 먼 와이드: 폭풍 한가운데 차가운 점 둘(폰). 박 219에 멀리 흩어진 금빛 점들이 일제히 그쪽으로 돈다
    id: "a5-call", start: T58, key: "rescue", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt, t = c.t;
      const hh = handheld(t, 58, 5);
      const cam: Cam = { x: 960 + hh.x, y: 540 + hh.y, zoom: kf(lt, [[0, 1], [c.dur, 1.08, "out"]]), rot: hh.r, focus: 1, dof: 1.4 };
      const turn = smooth(beat(219) - .15, beat(219) + .4, t);
      const pr = pair({ cx: 960, cy: 520 + lt * 10, s: 48, t, face: .9, faceC: kR.cold });
      const flash = Math.exp(-Math.max(0, lt - .18) * 9) * (lt > .18 ? 1 : 0) * .8;
      const cl = stormCloud(.15 + turn * .15);
      return (
        <Scene cam={cam}>
          <SkyLayer k={kR} horizon={1150} glowOpacity={.25} glowR={900} />
          <Layer d={12}>
            <Glow x={420} y={330} r={420} color="#9fc6d6" opacity={flash * .5} />
            <Lightning seed={58} x0={380} y0={-60} x1={520} y1={420} flash={flash} width={2.4} branches={3} />
            <CloudBank seed={581} y={260} x0={-900} x1={2900} size={900} count={7} dark={cl.dark} lit={cl.lit} t={t} drift={-14} />
            <CloudBank seed={582} y={1180} x0={-900} x1={2900} size={1000} count={7} dark={cl.dark} lit={cl.lit} t={t} drift={10} />
          </Layer>
          <Layer d={4.5}>
            <Cloud seed={583} x={-120} y={420} w={1300} h={520} dark={cl.dark} lit={cl.lit} t={t} drift={-20} />
            <Cloud seed={584} x={2080} y={900} w={1400} h={560} dark={cl.dark} lit={cl.lit} t={t} drift={16} />
            <Cloud seed={585} x={1700} y={80} w={1100} h={380} dark={cl.dark} lit={cl.lit} t={t} drift={-12} />
          </Layer>
          <Layer d={2.6} blend="screen">
            <Moths t={t} at={(tt) => streams(77, tt, { cx: 960, cy: 530, R0: 820, R1: 70, sy: .62, K: 12, per: 11, spin: -1.1, size: 4.6, wob: 40 })} color={kR.accent} trail={3} trailDt={.04} wings={false} glow={1.3} />
          </Layer>
          <Layer d={1}>
            <Rain t={t} count={90} angle={.18} color="#8a9aa6" opacity={.22} speed={1900} len={50} width={1.1} />
            <Glow x={960} y={525 + lt * 10} r={160} color={kR.cold} opacity={.22} />
            <Kid pose={pr.a} sil={kR.sil} rim={{ dx: .6, dy: -.4, color: kR.cold, width: .03, glow: .8 }} />
            <Kid pose={pr.b} variant="friend" accent={K.chorus.accent} sil={kR.sil} rim={{ dx: -.6, dy: -.4, color: kR.cold, width: .03, glow: .8 }} />
            <PhoneLight x={pr.ska.haF.x} y={pr.ska.haF.y} s={48} color={kR.cold} on={1} glow={2.2} />
            <PhoneLight x={pr.skb.haF.x} y={pr.skb.haF.y} s={48} color={kR.cold} on={1} glow={2.2} />
          </Layer>
          <Layer d={1} blend="screen">
            <Moths t={t} at={(tt) => streams(91, tt, { cx: 960, cy: 530, R0: 1000, R1: 80, sy: .6, K: 12, per: 12, spin: 1.2, size: 6.2, wob: 50 })} color={kR.accent} trail={4} trailDt={.04} glow={1.2} />
            <Glow x={960} y={530} r={700} color={kR.glow} opacity={turn * .08} />
          </Layer>
          <Layer d={.5}>
            <Cloud seed={586} x={mix(-200, -420, ease("out", c.p))} y={1060} w={1400} h={460} dark={mixhex(kR.sky[0], "#000000", .3)} lit={cl.dark} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 59. 소용돌이 와이드: 사방에서 금빛 줄기가 꼬리를 끌며 나선으로 쏟아져 들어온다. 박 221에 첫 줄기가 닿아 빛 고리. 화면이 천천히 돈다
    id: "a5-converge", start: T59, key: "rescue", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt, t = c.t;
      const hh = handheld(t, 59, 7, .5);
      const tHit = beat(221);
      const kick = lt > tHit - T59 ? Math.exp(-(t - tHit) * 6) : 0;
      const cam: Cam = { x: 960 + hh.x, y: 550 + hh.y, zoom: kf(lt, [[0, 1.0], [c.dur, 1.1, "out"]]) + kick * .025, rot: kf(lt, [[0, -.07], [c.dur, .05, "out"]]) + hh.r, focus: 1, dof: 2 };
      const warm = smooth(tHit - .35, tHit + .45, t);
      const look = (seed: number) => -.15 + n2(seed, t * 1.6) * .35 - warm * .2;
      const pr = pair({ cx: 960, cy: 560, s: 190, t, face: .95, faceC: mixc(kR.cold, GOLD, warm), base: { headTilt: look(5), eyes: 1 + warm * .15 }, baseF: { headTilt: look(9), eyes: 1 + warm * .15 } });
      const cl = stormCloud(.25 + warm * .6);
      return (
        <Scene cam={cam}>
          <SkyLayer k={kR} horizon={1100} glowOpacity={.2} />
          <Layer d={6}>
            <CloudBank seed={591} y={180} x0={-1000} x1={3000} size={1000} count={7} dark={cl.dark} lit={cl.lit} t={t} drift={-30} />
            <CloudBank seed={592} y={1250} x0={-1000} x1={3000} size={1100} count={7} dark={cl.dark} lit={cl.lit} t={t} drift={30} />
          </Layer>
          <Layer d={6} blend="screen">
            <Glow x={960} y={550} r={mix(380, 900, warm)} color={kR.glow} opacity={.18 + warm * .3} />
          </Layer>
          <Layer d={2.2} blend="screen">
            <Moths t={t} at={(tt) => streams(93, tt, { cx: 960, cy: 555, R0: 1150, R1: 210, sy: .7, K: 12, per: 12, spin: -1.4, size: 5, wob: 60 })} color={kR.accent} trail={4} trailDt={.035} />
          </Layer>
          <Layer d={1}>
            <Rain t={t} count={110} angle={.25} color="#8a9aa6" opacity={.2 * (1 - warm * .5)} speed={2300} len={60} width={1.4} />
            <Kid pose={pr.a} sil={kR.sil} rim={{ dx: .5, dy: -.5, color: mixc(kR.cold, kR.rim, warm), width: .016, glow: .8 }} />
            <Kid pose={pr.b} variant="friend" accent={K.chorus.accent} sil={kR.sil} rim={{ dx: -.5, dy: -.5, color: mixc(kR.cold, kR.rim, warm), width: .016, glow: .8 }} />
            <PhoneLight x={pr.ska.haF.x} y={pr.ska.haF.y} s={190} color={kR.cold} on={1 - warm * .4} />
            <PhoneLight x={pr.skb.haF.x} y={pr.skb.haF.y} s={190} color={kR.cold} on={1 - warm * .4} />
          </Layer>
          <Layer d={1} blend="screen">
            <Moths t={t} at={(tt) => streams(91, tt, { cx: 960, cy: 555, R0: 1500, R1: 250, sy: .7, K: 12, per: 12, spin: 1.3, size: 8.5, wob: 80, ribbon: 60 })} color={kR.accent} trail={5} trailDt={.03} />
            <Glow x={960} y={555} r={260} color={kR.glow} opacity={warm * .45} />
            <Rings x={960} y={555} t={t} at={[tHit]} r={620} sy={.7} color={kR.accent} dur={1.1} width={7} />
            <Burst x={960} y={548} t={t} t0={tHit} r={300} n={30} color={kR.accent} />
          </Layer>
          <Layer d={.5}>
            <Moths t={t} at={(tt) => streams(95, tt, { cx: 960, cy: 560, R0: 1700, R1: 1000, sy: .6, K: 5, per: 5, spin: 1.6, size: 18, wob: 120, gap: .07 })} color={kR.accent} trail={3} trailDt={.03} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 60. 미디엄, 살짝 아래에서: 나방이 두 아이 밑으로 들어가 빛나는 요람이 된다. 박 224에 요람이 둘을 받는다(눌림·튕김·빛)
    //     폰의 차가운 빛이 금빛에 덮이고, 얼굴이 금빛으로 밝아진다. 끝에서 둘이 위를 본다(다음 컷의 상승 예비동작)
    id: "a5-cradle", start: T60, key: "rescue", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt, t = c.t;
      const tCatch = beat(224), lc = tCatch - T60;
      const a = t - tCatch;
      const caught = a >= 0;
      const hh = handheld(t, 60, 5);
      const bump = caught ? Math.exp(-a * 5) * Math.sin(a * 22) * 14 : 0;
      const lift = ease("expoIn", lin(beat(225.6), T61 + .05, t));
      const cam: Cam = { x: 960 + hh.x, y: mix(470, 540, ease("out", lin(0, lc, lt))) + hh.y + bump - lift * 30, zoom: kf(lt, [[0, 1.0], [lc, 1.06, "out"], [c.dur, 1.13, "io"]]), rot: hh.r, focus: 1, dof: 4 };
      // 요람: 박에 눌렸다가 튕긴다
      const dip = caught ? (1 - springStep(a, 13, .32)) * -1 + 1 : 0; // 0 → 1(되돌아옴)
      const sag = caught ? Math.sin(Math.min(1, a * 4) * Math.PI) * 0 + (1 - springStep(a, 11, .3)) * 46 : 0;
      void dip;
      const cy = 690 + sag - lift * 160;
      const rx = 540, ry = 235;
      const seatY = cy + ry * .5;
      // 두 아이: 떨어지다(가속) 박에 앉는다
      const fallW = ease("in", lin(0, lc, lt));
      const s = 390;
      const sitW = caught ? ease("back", clamp(a / .3)) : 0;
      const sq = caught ? (1 - springStep(a, 15, .35)) * .22 : -.04;
      const warm = smooth(lc - .5, lc + .25, lt);
      const up = smooth(beat(225) - T60, beat(225.6) - T60, lt);
      const sit: Partial<Pose> = { lean: .12, bend: .05, legN: [1.45, 1.75], legF: [1.25, 1.85], toe: .3, armF: [.55, .35], swing: .1 };
      const fall: Partial<Pose> = { legN: [.4, .8], legF: [-.2, 1.0], toe: .7, armF: [2.4, .35], swing: 1.2 };
      const look = (seed: number) => caught ? mix(mix(.35, -.05, smooth(.25, .7, a)), -.55, up) : -.2 + n2(seed, t * 1.4) * .25;
      const base = (seed: number): Partial<Pose> => ({ ...lerpPose(fall, sit, sitW), squash: sq, rot: caught ? 0 : .1 + n2(seed, t * .6) * .1, headTilt: look(seed), eyes: caught ? 1.15 : 1, smile: caught && a > .35 && up < .5 ? 1 : 0, mouth: caught && a < .35 ? .7 : up * .4 });
      const py = caught ? seatY : mix(seatY - 430, seatY, fallW);
      const pr = pair({ cx: 960, cy: py, s, t, anchor: "seat", gap: .36, tumble: caught ? 0 : 1, face: .95, faceC: mixc(kR.cold, GOLD, warm), base: { ...base(5) }, baseF: { ...base(9) }, handY: -.32 });
      // 나방: 줄기 → 요람 자리
      const w = lin(-.15, lc + .05, lt);
      const tgA = cradlePts(3, 960, cy, rx, ry, 144, 4);
      const tgB = cradlePts(4, 960, cy + 12, rx * 1.1, ry * 1.12, 120, 3, -.02);
      const live = (seed: number, tg: typeof tgA) => tg.map((p, i) => ({ ...p, x: p.x + n2(seed + i, t * 1.2) * 6, y: p.y + n2(seed + i, t * 1.2, 4) * 5 }));
      const formed = smooth(lc - .7, lc + .1, lt);
      const phoneOn = 1 - smooth(lc, lc + .6, lt) * .85;
      const cradlePath = `M${960 - rx * 1.02},${cy - 6}Q${960 - rx * .9},${cy + ry * 1.25} 960,${cy + ry * 1.12}Q${960 + rx * .9},${cy + ry * 1.25} ${960 + rx * 1.02},${cy - 6}Q${960 + rx * .5},${cy + ry * .55} 960,${cy + ry * .55}Q${960 - rx * .5},${cy + ry * .55} ${960 - rx * 1.02},${cy - 6}Z`;
      const cl = stormCloud(.45 + warm * .4);
      return (
        <Scene cam={cam}>
          <SkyLayer k={kR} horizon={1200} glowOpacity={.3} />
          <Layer d={7}>
            <CloudBank seed={601} y={300} x0={-1100} x1={3100} size={1100} count={7} dark={cl.dark} lit={cl.lit} t={t} drift={-18} />
            <CloudBank seed={602} y={1350} x0={-1100} x1={3100} size={1200} count={6} dark={cl.dark} lit={cl.lit} t={t} drift={14} />
          </Layer>
          <Layer d={7} blend="screen">
            <Glow x={960} y={760} r={mix(500, 1100, warm)} color={kR.glow} opacity={.15 + warm * .35} />
          </Layer>
          <Layer d={1.9} blend="screen">
            <Moths t={t} at={(tt) => swarm(605, 70, tt, { cx: 960, cy: 600, rx: 900, ry: 420, speed: .35, size: 5 })} color={kR.accent} />
          </Layer>
          <Layer d={1}>
            <Rain t={t} count={80} angle={.2} color="#8a9aa6" opacity={.16 * (1 - warm * .6)} speed={2200} len={60} width={1.4} />
          </Layer>
          <Layer d={1} blend="screen">
            <path d={cradlePath} fill={kR.glow} opacity={formed * .25} />
            <Glow x={960} y={cy + ry * .75} r={rx * 1.2} ry={ry * 1.4} rx={rx * 1.3} color={kR.glow} opacity={formed * .55 + (caught ? Math.exp(-a * 3) * .4 : 0)} />
            <Moths t={t} at={(tt) => toward(streams(97, tt, { cx: 960, cy: 520, R0: 1500, R1: 300, sy: .7, K: 12, per: 10, spin: 1.3, size: 7.5, wob: 60 }), live(7, tgB), w, .55)} color={kR.accent} trail={lt < lc ? 3 : 0} trailDt={.035} glow={.9} />
          </Layer>
          <Layer d={1}>
            <Kid pose={pr.a} sil={kR.sil} rim={{ dx: .2, dy: 1, color: kR.rim, width: .016 * (.3 + warm), glow: .9 }} rim2={{ dx: .7, dy: -.5, color: kR.cold, width: .008, glow: .4 * phoneOn }} />
            <Kid pose={pr.b} variant="friend" accent={K.chorus.accent} sil={kR.sil} rim={{ dx: -.2, dy: 1, color: kR.rim, width: .016 * (.3 + warm), glow: .9 }} rim2={{ dx: -.7, dy: -.5, color: kR.cold, width: .008, glow: .4 * phoneOn }} />
            <PhoneLight x={pr.ska.haF.x} y={pr.ska.haF.y} s={s} color={kR.cold} on={phoneOn} />
            <PhoneLight x={pr.skb.haF.x} y={pr.skb.haF.y} s={s} color={kR.cold} on={phoneOn} />
          </Layer>
          <Layer d={1} blend="screen">
            <Moths t={t} at={(tt) => toward(streams(91, tt, { cx: 960, cy: 520, R0: 1500, R1: 260, sy: .7, K: 12, per: 12, spin: -1.2, size: 9, wob: 70 }), live(3, tgA), w, .5)} color={kR.accent} trail={lt < lc ? 4 : 0} trailDt={.035} />
            <Burst x={960} y={seatY} t={t} t0={tCatch} r={420} n={36} color={kR.accent} dur={1.1} />
            <Rings x={960} y={seatY + 10} t={t} at={[tCatch]} r={700} sy={.32} color={kR.accent} width={8} />
          </Layer>
          <Layer d={.5}>
            <Moths t={t} at={(tt) => swarm(609, 9, tt, { cx: 960, cy: 300, rx: 1300, ry: 600, speed: .2, size: 16 }).map((m) => ({ ...m, y: m.y - (tt - T60) * 60 }))} color={kR.accent} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 61. 아래에서 올려다본 상승: 빛 요람을 탄 둘이 폭풍을 뚫고 솟는다. 구름이 겹겹이 아래로 쏟아져 지나가고(시차), 비가 긴 줄로 스친다.
    //     박 228에 번개(차가운 빛)가 내리친다. 위쪽 빛이 점점 커져 끝에서 화면이 하얗게 찬다(다음 컷 white)
    id: "a5-ascent", start: T61, key: "rescue", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt, t = c.t;
      const tBolt = beat(228), ab = t - tBolt;
      const bolt = ab >= 0 ? Math.exp(-ab * 4.5) * (.75 + .25 * Math.sin(ab * 70)) : 0;
      const light = ease("in", lin(.2, c.dur, lt));
      const white = smooth(c.dur - .8, c.dur, lt);
      const hh = handheld(t, 61, 8, .9);
      const launch = 1 - springStep(lt, 12, .4);
      const cam: Cam = { x: 960 + hh.x + Math.sin(lt * 53) * bolt * 9, y: 560 + hh.y + launch * 30, zoom: kf(lt, [[0, 1.0], [c.dur, 1.12, "in"]]), rot: -.05 + hh.r, focus: 1, dof: 3.5 };
      const cx = 960, cy = 560 + launch * 40, rx = 330, ry = 150;
      const seatY = cy + ry * .48;
      const s = 300;
      const flinch = bolt * .6;
      const look = (seed: number) => mix(-.55, .1, flinch) + n2(seed, t) * .06;
      const ride: Partial<Pose> = { lean: .05, bend: 0, legN: [.25, 1.8], legF: [.12, 1.75], toe: .4, swing: -.7 - light * .3, squash: launch * .18 - flinch * .05, face: .85, faceColor: mixc(GOLD, "#e6f6ff", bolt), eyes: 1.1 };
      const pr = pair({ cx, cy: seatY, s, t, anchor: "seat", gap: .34, tumble: 0, handY: -.35,
        base: { ...ride, armF: [mix(2.95, 2.5, flinch), .1], headTilt: look(3), mouth: .3 },
        baseF: { ...ride, armF: [.7, .5], headTilt: look(7), smile: lt > .6 && bolt < .2 ? 1 : 0 } });
      const tg = cradlePts(5, cx, cy, rx, ry, 140, 4);
      const tg2 = cradlePts(6, cx, cy + 8, rx * 1.12, ry * 1.15, 110, 3);
      const sit = (seed: number, list: typeof tg, size: number) => (tt: number): M[] => list.map((p, i) => ({ x: p.x + n2(seed + i, tt * 1.5) * 6, y: p.y + n2(seed + i, tt * 1.5, 4) * 6, a: p.a, s: size * (.6 + rnd(seed, i) * .8), f: tt * 10 + i, b: .7 + .3 * rnd(seed, i + 9) }));
      const cl = { dark: mixhex(kR.sky[0], kR.cloud, .5), lit: mixhex(mixhex(kR.cloud, kR.cloudLit, .3), "#ffe2a8", light * .3) };
      const tail = (tt: number) => stream(613, 70, tt, (u) => ({ x: cx + Math.sin(u * 5 + tt * 3) * 50 * u - u * 120, y: cy + ry * .9 + u * 1100 }), { speed: 1.4, spread: 50 + 0, size: 8 });
      return (
        <Scene cam={cam}>
          <SkyLayer k={kR} horizon={1300} glowOpacity={.2}>
            <Glow x={960} y={-120} r={mix(500, 1500, light)} color={K.clear.moon} opacity={.25 + light * .6} />
          </SkyLayer>
          <Layer d={3.2} blur={5}>
            <RushClouds seed={611} t={t} n={12} speed={950} x0={-900} x1={2800} y0={-1400} span={2900} size={720} dark={cl.dark} lit={cl.lit} />
            <Glow x={260} y={300} r={700} color="#cfe8ff" opacity={bolt * .5} />
            <Lightning seed={611} x0={140} y0={-300} x1={620} y1={980} flash={bolt} width={4} branches={5} />
          </Layer>
          <Layer d={3.2} blend="screen">
            <GodRays x={960} y={-200} t={t} count={16} len={1700} color={K.clear.moon} opacity={light * .6} spin={.01} />
            <Glow x={960} y={-60} r={mix(200, 900, light)} color="#fff3d0" opacity={light * .8} />
          </Layer>
          <Layer d={1.7} blur={2.5}>
            <RushClouds seed={612} t={t} n={6} speed={2100} x0={-500} x1={2400} y0={-1300} span={2700} size={600} dark={cl.dark} lit={cl.lit} dx={-200} />
          </Layer>
          <Layer d={1} blend="screen">
            <Rain t={t} count={120} angle={.06} color="#c9d6e0" opacity={.3 * (1 - light * .6)} speed={5200} len={240} width={1.6} />
            <Glow x={cx} y={cy + ry * .6} r={rx * 1.6} rx={rx * 1.7} ry={ry * 2.2} color={kR.glow} opacity={.55} />
            <Moths t={t} at={tail} color={kR.accent} trail={4} trailDt={.03} />
            <Moths t={t} at={sit(61, tg2, 6.5)} color={kR.accent} glow={.9} />
          </Layer>
          <Layer d={1}>
            <Kid pose={pr.a} sil={kR.sil} rim={{ dx: .1, dy: 1, color: kR.rim, width: .018, glow: .9 }} rim2={{ dx: 0, dy: -1, color: mixc(K.clear.moon, "#cfe8ff", bolt), width: .006 + bolt * .012 + light * .01, glow: .5 }} />
            <Kid pose={pr.b} variant="friend" accent={K.chorus.accent} sil={kR.sil} rim={{ dx: -.1, dy: 1, color: kR.rim, width: .018, glow: .9 }} rim2={{ dx: 0, dy: -1, color: mixc(K.clear.moon, "#cfe8ff", bolt), width: .006 + bolt * .012 + light * .01, glow: .5 }} />
          </Layer>
          <Layer d={1} blend="screen">
            <Moths t={t} at={sit(62, tg, 9)} color={kR.accent} />
          </Layer>
          <Layer d={.55}>
            {[[-260, .1], [2150, .62], [-120, 1.3]].map(([x, o], i) => <Cloud key={i} seed={614 + i} x={x} y={-1500 + ((lt + o) * 4300) % 4600} w={1300} h={520} dark={mixhex(cl.dark, "#000000", .3)} lit={cl.dark} />)}
          </Layer>
          <Layer d={Infinity} blur={0} blend="screen">
            <Glow x={960} y={-150} r={mix(300, 2600, ease("in", white))} color="#fff8ec" core={.4} opacity={white} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 62. 돌파: 흰빛에서 열린다. 폭풍 꼭대기를 뚫고 솟은 둘(구름이 튄다), 맑은 청색 하늘과 거대한 달.
    //     카메라가 따라 올려다보고, 박 232에 정점 — 요람 나방이 날개처럼 펼쳐진다
    id: "a5-break", start: T62, key: "clear", enter: { type: "white", dur: .9 },
    render: (c) => {
      const lt = c.lt, t = c.t;
      const k = K.clear;
      const tApex = beat(232), la = tApex - T62;
      const rise = ease("expoOut", lin(0, la + .5, lt));
      const hh = handheld(t, 62, 5);
      const cam: Cam = { x: 960 + hh.x, y: mix(700, 520, ease("expoOut", lin(0, la + .8, lt))) + hh.y, zoom: kf(lt, [[0, 1.0], [c.dur, 1.06, "io"]]), rot: hh.r, focus: 1, dof: 2.5 };
      const cx = mix(880, 900, rise), cy = mix(1250, 560, rise) + Math.sin(lt * 2.2) * 6 * rise;
      const spread = ease("back", lin(la - .1, la + .5, lt));
      const rx = mix(220, 330, spread), ry = mix(110, 120, spread);
      const s = 220;
      const seatY = cy + ry * .48;
      const reach = smooth(la - .3, la + .2, lt);
      const ride: Partial<Pose> = { lean: .05, legN: [.25, 1.8], legF: [.12, 1.75], toe: .4, swing: mix(-.8, .3, rise), face: .9, faceColor: k.moon, eyes: 1.15 };
      const pr = pair({ cx, cy: seatY, s, t, anchor: "seat", gap: .34, tumble: 0, handY: -.35,
        base: { ...ride, armF: [mix(2.3, 2.75, reach), .1], headTilt: mix(-.3, -.75, reach), mouth: reach * .8 },
        baseF: { ...ride, armF: [mix(.6, 2.5, reach), .2], headTilt: mix(-.3, -.7, reach), smile: reach > .5 ? 1 : 0 } });
      const tg = cradlePts(8, cx, cy, rx, ry, 130, 4);
      const wing = (seed: number, size: number) => (tt: number): M[] => tg.map((p, i) => ({ x: p.x + n2(seed + i, tt * 1.4) * 5, y: p.y + n2(seed + i, tt * 1.4, 4) * 5, a: p.a, s: size * (.6 + rnd(seed, i) * .8), f: tt * 9 + i, b: .75 + .25 * rnd(seed, i + 9) }));
      const tail = (tt: number) => stream(621, 60, tt, (u) => ({ x: mix(cx - 60, 760, u) + Math.sin(u * 4 + tt * 2) * 40 * u, y: mix(cy + ry, 1400, Math.pow(u, .8)) }), { speed: .9, spread: 50, size: 7 });
      const splash = (i: number) => {
        const a = -Math.PI / 2 + (rnd(62, i) - .5) * 2.6, v = 300 + rnd(63, i) * 600;
        const e = ease("expoOut", lin(0, 1.6, lt));
        return { x: 880 + Math.cos(a) * v * e, y: 1060 + Math.sin(a) * v * e * .7 + lt * lt * 40, r: (50 + rnd(64, i) * 80) * (1 + lin(0, 2.2, lt) * .5), o: 1 - smooth(.3, 1.8, lt) };
      };
      return (
        <Scene cam={cam}>
          <SkyLayer k={k} horizon={1080} glowOpacity={.6} stars={.35} t={t} />
          <Layer d={60}>
            <GodRays x={1230} y={300} t={t} color={k.moon} opacity={.18} len={2600} count={20} />
            <Moon x={1230} y={300} r={330} color={k.moon} glow={1.15} pulse={c.pulse * .3} texture={1} />
          </Layer>
          <Layer d={20}>
            <Wisp x={500} y={520} w={1800} color={k.cloudLit} opacity={.25} t={t} drift={10} />
            <Wisp x={1500} y={700} w={1600} color={k.cloudLit} opacity={.2} t={t} drift={-8} />
          </Layer>
          <Layer d={7}>
            <CloudBank seed={622} y={1080} x0={-1000} x1={3000} size={700} count={10} dark={k.cloud} lit={k.cloudLit} t={t} drift={-6} />
          </Layer>
          <Layer d={1.5}>
            <CloudBank seed={623} y={1230} x0={-900} x1={2900} size={900} count={8} dark={mixhex(k.cloud, k.sil, .35)} lit={mixhex(k.cloudLit, k.cloud, .2)} t={t} drift={-10} />
          </Layer>
          <Layer d={1}>
            {Array.from({ length: 16 }, (_, i) => { const q = splash(i); return <Glow key={i} x={q.x} y={q.y} r={q.r * 1.1} color={k.cloudLit} opacity={q.o * .7} />; })}
          </Layer>
          <Layer d={1} blend="screen">
            <Glow x={cx} y={cy + ry * .5} rx={rx * 1.6} ry={ry * 2} r={rx} color={k.accent} opacity={.5} />
            <Moths t={t} at={tail} color={k.accent} trail={4} trailDt={.04} />
          </Layer>
          <Layer d={1}>
            <Kid pose={pr.a} sil={k.sil} rim={{ dx: .55, dy: -.85, color: k.rim, width: .016, glow: .8 }} rim2={{ dx: 0, dy: 1, color: k.accent, width: .01, glow: .6 }} />
            <Kid pose={pr.b} variant="friend" accent={K.chorus.accent} sil={k.sil} rim={{ dx: .55, dy: -.85, color: k.rim, width: .016, glow: .8 }} rim2={{ dx: 0, dy: 1, color: k.accent, width: .01, glow: .6 }} />
          </Layer>
          <Layer d={1} blend="screen">
            <Moths t={t} at={wing(65, 8)} color={k.accent} />
            <Rings x={cx} y={cy} t={t} at={[tApex]} r={600} sy={.5} color={k.accent} width={6} />
          </Layer>
          <Layer d={.5}>
            {Array.from({ length: 3 }, (_, i) => <Cloud key={i} seed={625 + i} x={[-200, 1100, 2200][i]} y={1200 + lt * 520 * (1 + i * .3)} w={900} h={380} dark={mixhex(k.cloud, k.sil, .3)} lit={k.cloudLit} opacity={.85} />)}
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 63. 클로즈업: 화면을 거의 채운 달 표면. 아래 양 귀퉁이에서 두 팔이 V자로 모여 맞잡은 손(깍지)이 된다(원근: 다가갈수록 작아진다).
    //     천천히 다가와 멈칫(예비동작) 했다가 박 236에 손끝이 닿는다 → 빛 터짐 + 표면에 번지는 빛 고리(박마다 하나 더)
    id: "a5-touch", start: T63, key: "clear", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt, t = c.t;
      const k = K.clear;
      const tTouch = beat(236), lT = tTouch - T63, a = t - tTouch;
      const touched = a >= 0;
      const g = touched ? -6 * Math.exp(-a * 3) : kf(lt, [[0, 300], [lT - .42, 70, "expoOut"], [lT - .16, 100, "out"], [lT, 0, "in"]]);
      const kick = touched ? Math.exp(-a * 5) : 0;
      const hh = handheld(t, 63, 4);
      const P0 = { x: 960, y: 455 };
      const cam: Cam = { x: 960 + hh.x + Math.sin(a * 60) * kick * 6, y: 520 + hh.y, zoom: kf(lt, [[0, 1.0], [lT, 1.05, "io"], [c.dur, 1.14, "out"]]) + kick * .03, rot: hh.r, focus: 1, dof: 7 };
      const moon = { x: 960, y: 170, r: 930 };
      const glowR = touched ? mix(80, 1900, ease("expoOut", a / 1.8)) : 0;
      const bright = touched ? smooth(0, 1.3, a) : 0;
      const white = smooth(c.dur - .55, c.dur, lt);
      // 깍지 낀 손(매듭): 다가갈수록 위로, 작게
      const sc = 1 + g / 520;
      const Kn = { x: P0.x, y: P0.y + 64 * sc + g * .55 };
      const arms = [
        { S: { x: 250, y: 1330 }, side: -1, w0: 250 },
        { S: { x: 1670, y: 1330 }, side: 1, w0: 250 },
      ].map((h) => {
        const W = { x: Kn.x + h.side * 62 * sc, y: Kn.y + 58 * sc };
        const dx = W.x - h.S.x, dy = W.y - h.S.y, L = Math.hypot(dx, dy);
        const u = { x: dx / L, y: dy / L }, n = { x: -u.y, y: u.x };
        return { ...h, W, u, n };
      });
      const shape = (fill: string) => (
        <g fill={fill} stroke={fill} strokeLinecap="round">
          {arms.map((h, i) => {
            const { S, W, u, n, w0, side } = h;
            const w1 = 50 * sc;
            const bow = side * 34;
            const m = { x: mix(S.x, W.x, .5) + n.x * bow, y: mix(S.y, W.y, .5) + n.y * bow };
            const wm = (w0 + w1) * .55;
            const cuff = { x: W.x - u.x * 70 * sc, y: W.y - u.y * 70 * sc };
            const ang = (Math.atan2(u.y, u.x) * 180) / Math.PI;
            return (
              <g key={i}>
                <path strokeWidth={0} d={`M${S.x + n.x * w0},${S.y + n.y * w0}Q${m.x + n.x * wm},${m.y + n.y * wm} ${W.x + n.x * w1},${W.y + n.y * w1}L${W.x - n.x * w1},${W.y - n.y * w1}Q${m.x - n.x * wm},${m.y - n.y * wm} ${S.x - n.x * w0},${S.y - n.y * w0}Z`} />
                <ellipse strokeWidth={0} cx={cuff.x} cy={cuff.y} rx={26 * sc} ry={80 * sc} transform={`rotate(${ang} ${cuff.x} ${cuff.y})`} />
                {/* 손바닥(매듭 쪽으로) */}
                <ellipse strokeWidth={0} cx={W.x + u.x * 30 * sc} cy={W.y + u.y * 30 * sc} rx={62 * sc} ry={50 * sc} transform={`rotate(${ang} ${W.x + u.x * 30 * sc} ${W.y + u.y * 30 * sc})`} />
                {/* 깍지: 네 손가락이 매듭 위로 엇갈려 넘어간다 */}
                {[0, 1, 2, 3].map((f) => {
                  const bx = Kn.x + side * (26 - f * 4) * sc, by = Kn.y + (-6 + f * 22 - (i ? 11 : 0)) * sc;
                  return <line key={f} x1={bx} y1={by} x2={bx - side * 64 * sc} y2={by - 20 * sc + f * 4 * sc} strokeWidth={21 * sc} />;
                })}
                {/* 엄지: 위로 세워 달에 닿는다 */}
                <line x1={Kn.x + side * 30 * sc} y1={Kn.y - 6 * sc} x2={P0.x + side * 13 * sc} y2={P0.y + 2 * sc - g * .1} strokeWidth={22 * sc} />
              </g>
            );
          })}
        </g>
      );
      const ringT = [tTouch, tTouch + .14, beat(237), beat(237.5)];
      return (
        <Scene cam={cam}>
          <SkyLayer k={k} horizon={1300} glowOpacity={.3} stars={.7} t={t} />
          <Layer d={2.4} blend="screen">
            <Moths t={t} at={(tt) => swarm(631, 30, tt, { cx: 960, cy: 900, rx: 1100, ry: 300, speed: .3, size: 4 })} color={k.accent} />
          </Layer>
          <Layer d={1.15}>
            <Glow x={moon.x} y={moon.y} r={moon.r * 1.6} color={k.moon} opacity={.6} />
            <circle cx={moon.x} cy={moon.y} r={moon.r} fill={mixc(k.moon, "#ecd2a0", .55 - bright * .45)} />
            <Glow x={moon.x - 160} y={moon.y - 140} r={moon.r * .95} color="#ffffff" opacity={.7} />
            {Array.from({ length: 13 }, (_, i) => <Glow key={i} x={moon.x + (rnd(632, i) - .5) * moon.r * 1.6} y={moon.y + (rnd(633, i) - .25) * moon.r * 1.2} r={moon.r * (.07 + rnd(634, i) * .17)} color="#b08a52" opacity={.2 * (1 - bright * .75)} />)}
            <Glow x={P0.x} y={P0.y} r={glowR} color="#fffaf0" opacity={touched ? .85 : 0} />
            <Rings x={P0.x} y={P0.y} t={t} at={ringT} r={1500} sy={.86} color="#e09a3a" dur={1.6} width={9} />
          </Layer>
          <Layer d={1.4} blend="screen">
            <Moths t={t} at={(tt) => swarm(638, 22, tt, { cx: P0.x, cy: P0.y + 160, rx: 380, ry: 220, speed: .5, size: 6 })} color={k.accent} />
          </Layer>
          <Layer d={1} defs={<filter id="a5halo" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={14} /></filter>}>
            <g filter="url(#a5halo)" opacity={.9}>{shape(k.rim)}</g>
            <g transform="translate(0 -7)">{shape(mixc(k.rim, "#ffffff", .5))}</g>
            {shape(k.sil)}
          </Layer>
          <Layer d={1} blend="screen">
            <Glow x={P0.x} y={P0.y} r={130} color="#ffffff" opacity={touched ? .9 * Math.exp(-a * 1.2) + .3 : 0} />
            <Burst x={P0.x} y={P0.y} t={t} t0={tTouch} r={560} n={44} color={k.accent} dur={1.2} />
            <Burst x={P0.x} y={P0.y} t={t} t0={beat(237)} r={380} n={24} color={k.accent} dur={1} seed={21} />
          </Layer>
          <Layer d={.45}>
            <Moths t={t} at={(tt) => swarm(639, 7, tt, { cx: 960, cy: 700, rx: 1200, ry: 500, speed: .18, size: 20 })} color={k.accent} />
          </Layer>
          <Layer d={Infinity} blur={0} blend="screen">
            <rect x={-200} y={-200} width={2400} height={1500} fill="#fff6e0" opacity={white * .75} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 64. 아주 먼 와이드(flash): 달이 터진다. 껍질이 빛 고리로 퍼지고, 수십 가닥 금빛 실이 분수처럼 솟았다가(정점에서 멈칫) 도시 지붕으로 쏟아진다.
    //     박 239·240에 둘째·셋째 물결. 터진 빛 앞에 작은 두 실루엣. 카메라는 실을 따라 천천히 아래로
    id: "a5-bloom", start: T64, key: "bloom", enter: { type: "flash", dur: .5 },
    render: (c) => {
      const lt = c.lt, t = c.t;
      const k = K.bloom;
      const hh = handheld(t, 64, 4);
      const cam: Cam = { x: 960 + hh.x, y: kf(lt, [[0, 440], [c.dur, 640, "io"]]) + hh.y, zoom: kf(lt, [[0, 1.1], [c.dur, 1.0, "out"]]), rot: hh.r, focus: 6, dof: 3 };
      const M0 = BLOOM.moon;
      const disc = 1 - smooth(.05, .9, lt);
      const pulse = c.pulse;
      return (
        <Scene cam={cam}>
          <SkyLayer k={k} horizon={1000} glowOpacity={.7} glowR={1500} />
          <Layer d={6} blur={0}>
            <GodRays x={M0.x} y={M0.y} t={t} color={k.moon} opacity={.35 * (1 - lt / c.dur * .5)} len={2400} count={22} spin={.05} />
            <Glow x={M0.x} y={M0.y} r={mix(1500, 700, smooth(0, 1.2, lt))} color={k.glow} opacity={.75} />
            <Glow x={M0.x} y={M0.y} r={260 + pulse * 30} color="#ffffff" opacity={.65 + pulse * .2} />
            <Glow x={M0.x} y={M0.y} r={170 * (1 + .6 * ease("expoOut", lt / .6))} color="#ffffff" core={.45} opacity={disc} />
            <Rings x={M0.x} y={M0.y} t={t} at={[T64, T64 + .18, beat(240)]} r={1700} color={k.accent} dur={1.5} width={10} />
            <Burst x={M0.x} y={M0.y} t={t} t0={T64} r={900} n={60} color={k.accent} dur={1.4} />
          </Layer>
          <Layer d={6}>
            <Skyline seed={BLOOM.seed} x0={BLOOM.x0} x1={BLOOM.x1} base={BLOOM.base} minH={BLOOM.minH} maxH={BLOOM.maxH} minW={BLOOM.minW} maxW={BLOOM.maxW} color={mixhex(k.silFar, k.fog, .35)} t={t} win={{ density: .14, size: .7, warm: k.win, cold: K.lonely.cold, coldRatio: .6 }} />
            {BLOOM.threads.map((th, i) => <BloomThread key={i} th={th} t={t} color={k.accent} />)}
            <Kid pose={pose({ ...P.hang, x: 905, y: 410 + lt * 26, s: 40, facing: 1, rot: .15, armF: [2.2, .2], swing: .6 })} sil={k.sil} rim={{ dx: 0, dy: -1, color: "#ffffff", width: .05, glow: .8 }} />
            <Kid pose={pose({ ...P.hang, x: 945, y: 414 + lt * 26, s: 40, facing: -1, rot: .15, armF: [2.2, .2], swing: .6 })} variant="friend" accent={K.chorus.accent} sil={k.sil} rim={{ dx: 0, dy: -1, color: "#ffffff", width: .05, glow: .8 }} />
          </Layer>
          <Layer d={2.6}>
            <Skyline seed={642} x0={-900} x1={2900} base={1420} minH={300} maxH={460} minW={120} maxW={260} color={mixhex(k.sil, k.silFar, .3)} t={t} win={{ density: .12, size: 1, warm: k.win, cold: K.lonely.cold, coldRatio: .6 }} />
          </Layer>
          <Layer d={.6} blend="screen">
            <Moths t={t} at={(tt) => sparks(643, 26, tt, { x0: -200, x1: 2200, y0: -300, y1: 1300, speed: 260, size: 9, sway: 60 })} color={k.accent} wings={false} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 65. 북엔드: 1번 컷과 같은 높은 시점의 도시, 같은 창으로 천천히 밀어 들어간다. 그 창은 아직 폰 빛으로 차갑다.
    //     금빛 실이 박마다 지붕에 내려앉고(243에 바로 그 창), 닿은 자리에서 창이 하나씩 번져 켜진다. 끝에서 도시 전체가 따뜻하다
    id: "a5-ignite", start: T65, key: "bloom", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt, t = c.t;
      const warmth = smooth(beat(242.6), beat(246), t);
      const k = mixKey(K.lonely, K.bloom, warmth);
      const hh = handheld(t, 65, 3, .3);
      const f = ease("io", lin(0, c.dur + .3, lt)) * .5;
      const T = IGN.target, d = ROWS[3].d;
      const cam: Cam = { x: 960 + (T.x - 960) * d * f + hh.x, y: 540 + (T.y - 540) * d * f + hh.y, zoom: mix(1, 1.32, ease("io", lin(0, c.dur + .3, lt))), rot: hh.r, focus: 2.2, dof: 1.6 };
      const cold = 1 - smooth(beat(243) - .03, beat(243) + .06, t);
      return (
        <Scene cam={cam}>
          <SkyLayer k={k} horizon={330} glowOpacity={.5 + warmth * .3} glowR={1100} stars={1 - warmth * .7} t={t}>
            <Glow x={960} y={-200} r={900} color={K.bloom.glow} opacity={.25 + warmth * .2} />
          </SkyLayer>
          <BookendCity t={t} kCold={K.lonely} kWarm={K.bloom} warmth={warmth} lands={IGN.lands} sweep={beat(245.2)} threadColor={K.bloom.accent} target={{ row: 3, bi: IGN.tb, k: IGN.kWin, cold }} />
          <Layer d={3} blend="screen">
            <Glow x={960} y={760} rx={1900} ry={520} r={900} color={K.bloom.win} opacity={warmth * .3} />
          </Layer>
          <Layer d={.7} blend="screen">
            <Moths t={t} at={(tt) => sparks(651, 14, tt, { x0: -200, x1: 2200, y0: -300, y1: 1300, speed: 180, size: 7, sway: 50 })} color={K.bloom.accent} wings={false} opacity={.8} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 66. 새벽 방(dip), 바로 위에서 내려다봄: 빛 구슬 하나에서 시작해(달 ↔ 구슬 매치컷) 천천히 돌며 뒤로 빠지면,
    //     옆으로 웅크려 구슬을 꼭 안고 잠든 아이. 창 모양 햇살(네 칸)이 이불 위에 비스듬히 눕고, 먼지가 떠다닌다.
    //     머리맡 바닥의 폰은 꺼진 채 엎어져 있다
    id: "a5-sleep", start: T66, key: "dawn", enter: { type: "dip" },
    render: (c) => {
      const lt = c.lt, t = c.t;
      const k = K.dawn;
      const breath = Math.sin(t * 1.9);
      // 위에서 본 옆으로 누운 자세: rot +π/2, facing -1 → 머리는 왼쪽(베개), 몸 앞(얼굴·무릎)은 화면 아래
      const kp = pose({
        anchor: "center", x: 700, y: 440, s: 640, facing: -1, rot: 1.48 + breath * .006,
        lean: .32, bend: .22, headTilt: .3, armN: [1.25, 2.05], armF: [1.05, 2.15], legN: [1.35, 1.9], legF: [1.15, 2.05], toe: .2, swing: -.6,
        face: .9, faceColor: "#ffd9a0", smile: 1, eyes: 0, squash: breath * .012,
      });
      const sk = skeleton(kp);
      const orb = { x: mix(sk.haN.x, sk.haF.x, .5), y: mix(sk.haN.y, sk.haF.y, .5) + 18, r: 32 * (1 + .05 * breath) };
      const pull = ease("expoOut", lin(.12, 2.7, lt));
      const hh = handheld(t, 66, 2.5, .3);
      const cam: Cam = { x: mix(orb.x, 960, pull) + hh.x, y: mix(orb.y, 530, pull) + hh.y, zoom: mix(2.7, 1.02, pull), rot: mix(.22, 0, pull) + hh.r, focus: 1, dof: 5 };
      const floor = mixhex(k.sil, k.fog, .18);
      const sheet = mixhex(k.fog, k.glow, .18);
      const blanket = mixhex(k.accent, k.fog, .45);
      const bed = { x: 250, y: 150, w: 1420, h: 780 };
      // 창 모양 햇살: 2×2 칸, 오른쪽 위에서 비스듬히
      const pane = (i: number, j: number) => {
        const x0 = 1350 + i * 250, y0 = 120 + j * 300, w = 230, h = 280, sh = -.5;
        return `M${x0 + y0 * sh},${y0}L${x0 + w + y0 * sh},${y0}L${x0 + w + (y0 + h) * sh},${y0 + h}L${x0 + (y0 + h) * sh},${y0 + h}Z`;
      };
      const motes = (tt: number): M[] => Array.from({ length: 34 }, (_, i) => {
        const x = mix(500, 1700, rnd(661, i)) + n2(663 + i, tt * .12) * 70, y = mix(40, 1000, rnd(662, i)) + n2(664 + i, tt * .12) * 60;
        return { x, y, s: 1.6 + rnd(665, i) * 2.6, a: 0, f: 0, b: .25 + .45 * Math.sin(tt * 1.3 + i) ** 2 };
      });
      const hip = sk.pelvis;
      // 이불은 발치로 걷어차여 뭉쳐 있다(웅크린 실루엣이 밝은 시트 위에서 읽히도록)
      const bx = bed.x + bed.w;
      const blanketD = `M${bx - 330},${bed.y + 20}Q${bx - 420},${bed.y + 250} ${bx - 300},${bed.y + 420}Q${bx - 400},${bed.y + 600} ${bx - 260},${bed.y + bed.h - 10}L${bx - 10},${bed.y + bed.h - 10}L${bx - 10},${bed.y + 20}Z`;
      return (
        <Scene cam={cam}>
          <Layer d={1.08}>
            <rect x={-1500} y={-1200} width={5000} height={3600} fill={floor} />
            {Array.from({ length: 22 }, (_, i) => <rect key={i} x={-1500} y={-1100 + i * 120} width={5000} height={4} fill={mixhex(floor, k.sil, .45)} />)}
            {Array.from({ length: 30 }, (_, i) => <rect key={"v" + i} x={-1400 + rnd(667, i) * 4600} y={-1100 + Math.floor(rnd(668, i) * 22) * 120} width={4} height={120} fill={mixhex(floor, k.sil, .45)} />)}
            <rect x={1700} y={300} width={220} height={220} rx={14} fill={mixhex(floor, k.sil, .55)} />
            <rect x={1770} y={360} width={70} height={120} rx={10} fill="#0e0918" />
            <ellipse cx={420} cy={980} rx={58} ry={30} fill={mixhex(floor, k.accent, .25)} />
            <ellipse cx={520} cy={1000} rx={58} ry={30} fill={mixhex(floor, k.accent, .25)} />
          </Layer>
          <Layer d={1}>
            <rect x={bed.x - 26} y={bed.y - 26} width={bed.w + 52} height={bed.h + 52} rx={46} fill={mixhex(k.sil, floor, .35)} />
            <rect x={bed.x} y={bed.y} width={bed.w} height={bed.h} rx={34} fill={sheet} />
            <rect x={bed.x + 40} y={bed.y + 120} width={250} height={430} rx={70} fill={mixhex(sheet, "#ffffff", .12)} />
            <path d={`M${bed.x + 70},${bed.y + 200}Q${bed.x + 160},${bed.y + 230} ${bed.x + 250},${bed.y + 190}`} stroke={mixhex(sheet, k.sil, .3)} strokeWidth={5} fill="none" />
            <path d={blanketD} fill={blanket} />
            <path d={`M${bx - 300},${bed.y + 130}Q${bx - 160},${bed.y + 200} ${bx - 40},${bed.y + 150}M${bx - 320},${bed.y + 420}Q${bx - 180},${bed.y + 380} ${bx - 40},${bed.y + 460}M${bx - 240},${bed.y + 620}Q${bx - 140},${bed.y + 680} ${bx - 40},${bed.y + 640}`} stroke={mixhex(blanket, k.sil, .3)} strokeWidth={8} fill="none" strokeLinecap="round" />
            <ellipse cx={hip.x - 20} cy={hip.y + 60} rx={300} ry={170} fill={mixhex(sheet, k.sil, .2)} opacity={.35} />
            <Kid pose={kp} sil={k.sil} rim={{ dx: .5, dy: -.85, color: k.rim, width: .01, glow: .6 }} />
          </Layer>
          <Layer d={1} blend="screen">
            <g fill={k.glow} opacity={.11}>{[0, 1].map((i) => [0, 1].map((j) => <path key={`${i}${j}`} d={pane(i, j)} />))}</g>
            <Glow x={orb.x} y={orb.y} r={orb.r * 14 * (1 + c.pulse * .06)} color={K.bloom.accent} opacity={.55} />
            <Glow x={orb.x} y={orb.y} r={orb.r * 2.4} color="#fff6dc" opacity={.95} />
            <circle cx={orb.x} cy={orb.y} r={orb.r * .78} fill="#fffdf4" />
          </Layer>
          <Layer d={.7} blend="screen">
            <Moths t={t} at={motes} color="#fff0d0" wings={false} />
          </Layer>
          <Layer d={.45}>
            <Moths t={t} at={(tt) => [{ x: mix(1900, 1300, ease("out", lin(0, c.dur, tt - T66))), y: mix(1050, 820, lin(0, c.dur, tt - T66)) + Math.sin(tt * 3) * 20, s: 30, a: -2.6, f: tt * 9, b: .9 }]} color={k.accent} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 67. 마지막: 좁은 골목을 사이에 두고 마주 보는 두 창, 골목 끝에서 해가 뜬다(한 점 원근, 진짜 뒤로 빠지는 돌리).
    //     아이는 창턱에 기대 길을 내려다본다. 박 251에 건너편 덧창이 열리고 친구가 기지개. 252에 서로를 알아보고(움찔),
    //     253부터 웃으며 손을 흔든다(아래팔이 박마다 한 번). 카메라가 뒤로·위로 빠지며 앞의 빨랫줄이 카메라 앞을 지나 들어온다.
    //     끝 2.4초는 MV가 검게 닫는다
    id: "a5-wave", start: T67, key: "dawn", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt, t = c.t;
      const k = K.dawn;
      const hh = handheld(t, 67, 3, .3);
      const back = ease("io", lin(1.4, c.dur - .1, lt));
      const C3 = { x: hh.x * .5, y: mix(-60, -230, back) + hh.y * .5, z: mix(90, -950, back) };
      const pj = (X: number, Y: number, Z: number) => { const s = AL.F / Math.max(15, Z - C3.z); return { x: 960 + (X - C3.x) * s, y: 540 + (Y - C3.y) * s, s }; };
      const quad = (pts: { x: number; y: number }[]) => "M" + pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("L") + "Z";
      const zn = C3.z + 25;
      const A = AL.A;
      const wallC = (side: number, near: boolean) => near ? mixhex(k.sil, k.fog, side < 0 ? .16 : .26) : mixhex(k.fog, k.glow, .4);
      // 타이밍
      const tOpen = beat(251) - T67, tLook = beat(252) - T67, tSee = beat(252.5) - T67, tWave = beat(253) - T67;
      const open = ease("expoOut", lin(tOpen, tOpen + .55, lt));
      const rise = ease("back", lin(tOpen + .15, tOpen + .6, lt));
      const stretch = smooth(tOpen + .45, tOpen + .7, lt) * (1 - smooth(tSee - .1, tSee + .15, lt));
      const look = smooth(tLook, tLook + .2, lt);
      const see = lt > tSee ? 1 - springStep(lt - tSee, 16, .3) : 0;
      const hop = lt > tSee ? Math.sin(Math.min(1, (lt - tSee) / .3) * Math.PI) : 0;
      const waveOn = smooth(tWave - .12, tWave + .1, lt);
      const ph = (t - beat(253)) * Math.PI * 2 / .683;
      const ZK = AL.ZK;
      const kidP = pj(-A + 12, 70, ZK), friP = pj(A - 12, 70, ZK);
      const sKid = 270 * kidP.s;
      const waveArm = (o: number): [number, number] => [mix(1.3, 2.62, waveOn) + Math.sin(ph + o) * .1 * waveOn, mix(1.4, .5, waveOn) + Math.sin(ph + o) * .55 * waveOn];
      const faceL = .35 + look * .4;
      const kid = pose({
        x: kidP.x, y: kidP.y, s: sKid, facing: 1, lean: mix(.42, .25, look), bend: .08, headTilt: mix(.45, -.08, look) - hop * .1, squash: -hop * .05,
        armN: waveArm(0), armF: [1.25, 1.45], legN: [.05, .05], legF: [-.05, .05], swing: .15 + Math.sin(t * 1.3) * .08,
        face: faceL, faceColor: "#ffd2a8", faceDir: .15, eyes: 1 + see * .25, mouth: see * .6, smile: waveOn > .5 ? 1 : 0,
      });
      const friY = mix(380, 0, rise);
      const fri = pose({
        x: friP.x, y: pj(A - 12, 70 + friY, ZK).y, s: sKid, facing: -1, lean: mix(.1, .3, waveOn), bend: .05, headTilt: mix(-.25, -.05, look) - hop * .1, squash: -hop * .05,
        armN: stretch > .01 ? [mix(waveArm(1.3)[0], 2.9, stretch), mix(waveArm(1.3)[1], .15, stretch)] : waveArm(1.3), armF: [mix(1.25, 2.7, stretch), mix(1.45, .2, stretch)],
        face: rise * faceL, faceColor: "#ffd2a8", faceDir: .15, eyes: stretch > .5 ? .05 : 1 + see * .25, mouth: stretch * .8 + see * .6, smile: waveOn > .5 ? 1 : 0,
      });
      // 벽과 창
      const walls = [-1, 1].map((sd) => {
        const X = sd * A;
        const g = `a5al${sd < 0 ? "l" : "r"}`;
        const nearX = sd < 0 ? 0 : 1920;
        return { sd, X, g, nearX };
      });
      const winQ = (X: number, y0: number, y1: number, z0: number, z1: number) => quad([pj(X, y0, z0), pj(X, y0, z1), pj(X, y1, z1), pj(X, y1, z0)]);
      const zk0 = ZK - 150, zk1 = ZK + 150;
      const shutter = (sd: number, th: number) => {
        const X = sd * A, w = 150;
        const free0 = { X: X - sd * w * Math.sin(th), Z: zk0 + w * Math.cos(th) };
        const free1 = { X: X - sd * w * Math.sin(th), Z: zk1 - w * Math.cos(th) };
        const col = mixhex(k.sil, k.accent, .28);
        return (
          <g fill={col}>
            <path d={quad([pj(X, -270, zk0), pj(free0.X, -270, free0.Z), pj(free0.X, 0, free0.Z), pj(X, 0, zk0)])} />
            <path d={quad([pj(X, -270, zk1), pj(free1.X, -270, free1.Z), pj(free1.X, 0, free1.Z), pj(X, 0, zk1)])} />
          </g>
        );
      };
      const laundry = (Zl: number, Yl: number, seed: number, items: number) => {
        if (Zl - C3.z < 40) return null;
        const pts = Array.from({ length: 13 }, (_, i) => { const u = i / 12; return pj(mix(-A, A, u), Yl + Math.sin(u * Math.PI) * 60, Zl); });
        const s = pts[6].s;
        return (
          <g>
            <polyline points={pts.map((p) => `${p.x},${p.y}`).join(" ")} stroke={k.sil} strokeWidth={Math.max(1, 2.2 * s)} fill="none" />
            {Array.from({ length: items }, (_, i) => {
              const u = (i + .7) / (items + .4);
              const p = pj(mix(-A, A, u), Yl + Math.sin(u * Math.PI) * 60, Zl);
              const w = (60 + rnd(seed, i) * 50) * s, h = (70 + rnd(seed, i + 9) * 70) * s;
              const sw = n2(seed + i, t * .8) * 10 * s + 6 * s;
              const tint = [k.accent, k.sky[2], k.cloud, k.fog][i % 4];
              return <path key={i} d={`M${p.x - w / 2},${p.y}L${p.x + w / 2},${p.y}L${p.x + w / 2 + sw},${p.y + h}L${p.x - w / 2 + sw},${p.y + h}Z`} fill={mixhex(tint, k.sil, .45)} opacity={.95} />;
            })}
          </g>
        );
      };
      const moths = (tt: number): M[] => Array.from({ length: 14 }, (_, i) => {
        const Z = 700 + rnd(671, i) * 1400;
        const Y = 950 - ((rnd(672, i) * 2600 + (tt - T67) * (110 + rnd(673, i) * 90)) % 2600);
        const X = (rnd(674, i) - .5) * 380 + n2(675 + i, tt * .4) * 60;
        const p = pj(X, Y, Z);
        return { x: p.x, y: p.y, s: 10 * p.s, a: -1.4 + n2(676 + i, tt) * .5, f: tt * 14 + i, b: .9 };
      });
      // 창턱 아래(방 안)는 보이지 않게: 창턱 높이(Y=0)의 원근선 위쪽만 남긴다
      const sillClip = (sd: number) => {
        const L = pj(sd * (A - 12), 0, ZK - 300);
        const E1 = { x: 960 + (L.x - 960) * 30, y: 540 + (L.y - 540) * 30 }, E2 = { x: 960 - (L.x - 960) * 1.5, y: 540 - (L.y - 540) * 1.5 };
        return `M${E1.x},${E1.y}L${E2.x},${E2.y}L${E2.x},-9000L${E1.x},-9000Z`;
      };
      return (
        <Scene cam={{ x: 960, y: 540, zoom: 1 }}>
          <SkyLayer k={k} horizon={560} glowOpacity={.95} glowR={900}>
            <GodRays x={960} y={520} t={t} color={k.glow} opacity={.22} len={1500} count={18} spin={.015} />
            <Glow x={960} y={525 - lt * 3} r={420} color={k.glow} opacity={.7} />
            <Glow x={960} y={525 - lt * 3} r={70} color="#fffaf0" opacity={1} />
            <circle cx={960} cy={525 - lt * 3} r={34} fill="#fffaf2" />
          </SkyLayer>
          <Layer d={1} blur={1.3}>
            {Array.from({ length: 12 }, (_, i) => {
              const X0 = -2600 + i * 440, h = 500 + rnd(677, i) * 1300;
              return <path key={i} d={quad([pj(X0, AL.G - h, AL.ZF + 1400), pj(X0 + 420, AL.G - h, AL.ZF + 1400), pj(X0 + 420, AL.G, AL.ZF + 1400), pj(X0, AL.G, AL.ZF + 1400)])} fill={mixhex(k.silFar, k.fog, .55 + rnd(678, i) * .2)} />;
            })}
          </Layer>
          <Layer d={1} defs={<>{walls.map((w) => (
            <linearGradient key={w.g} id={w.g} x1={w.nearX} y1={0} x2={960} y2={0} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={wallC(w.sd, true)} /><stop offset="70%" stopColor={mixhex(wallC(w.sd, true), wallC(w.sd, false), .55)} /><stop offset="100%" stopColor={wallC(w.sd, false)} />
            </linearGradient>))}</>}>
            <path d={quad([pj(-A, AL.G, zn), pj(A, AL.G, zn), pj(A, AL.G, AL.ZF), pj(-A, AL.G, AL.ZF)])} fill={mixhex(k.sil, k.fog, .45)} />
            {walls.map((w) => (
              <g key={w.g}>
                <path d={quad([pj(w.X, AL.TOP, zn), pj(w.X, AL.TOP, AL.ZF), pj(w.X, AL.G, AL.ZF), pj(w.X, AL.G, zn)])} fill={`url(#${w.g})`} />
                <path d={quad([pj(w.X, AL.TOP - 30, zn), pj(w.X, AL.TOP - 30, AL.ZF), pj(w.X, AL.TOP, AL.ZF), pj(w.X, AL.TOP, zn)])} fill={k.rim} opacity={.5} />
                {AL.floors.map((fy) => AL.bays.map((z0, b) => {
                  if (fy === 0 && b === 1) return null;
                  const z1 = z0 + 230;
                  if (z0 < zn) return null;
                  const r = rnd(679 + w.sd * 7, b * 11 + fy);
                  const lit = r < .28;
                  const fog = clamp((z0 - 600) / 5000);
                  return (
                    <g key={`${fy}-${b}`}>
                      <path d={winQ(w.X, fy - 250, fy, z0, z1)} fill={lit ? mixhex(k.win, k.glow, fog * .5) : mixhex(mixhex(k.sil, k.sky[1], .35), k.fog, fog)} opacity={lit ? .85 : 1} stroke={mixhex(k.sil, k.fog, .2 + fog * .5)} strokeWidth={Math.max(1, 12 * pj(w.X, fy, z0).s)} />
                      <path d={quad([pj(w.X, fy, z0 - 12), pj(w.X, fy, z1 + 12), pj(w.X - w.sd * 24, fy + 14, z1 + 12), pj(w.X - w.sd * 24, fy + 14, z0 - 12)])} fill={mixhex(k.sil, k.fog, .25 + fog * .5)} />
                    </g>
                  );
                }))}
                {[340, 1540, 3100].map((Z, i) => Z > zn ? <line key={i} x1={pj(w.X - w.sd * 10, AL.TOP, Z).x} y1={pj(w.X - w.sd * 10, AL.TOP, Z).y} x2={pj(w.X - w.sd * 10, AL.G, Z).x} y2={pj(w.X - w.sd * 10, AL.G, Z).y} stroke={mixhex(k.sil, k.fog, .25)} strokeWidth={14 * pj(w.X, 0, Z).s} /> : null)}
                <path d={winQ(w.X, -270, 0, zk0, zk1)} fill={mixhex(k.sil, k.win, .12)} />
              </g>
            ))}
            {laundry(2600, -700, 681, 6)}
            {laundry(1500, -620, 682, 5)}
            {shutter(-1, 2.75)}
            {shutter(1, mix(0, 2.75, open))}
          </Layer>
          <Layer d={1} blend="screen">
            <Glow x={960} y={560} rx={500} ry={900} r={500} color={k.glow} opacity={.35} />
            <Moths t={t} at={moths} color={K.bloom.accent} trail={2} trailDt={.05} />
          </Layer>
          <Layer d={1} defs={<><clipPath id="a5sillL"><path d={sillClip(-1)} /></clipPath><clipPath id="a5sillR"><path d={sillClip(1)} /></clipPath></>}>
            <g clipPath="url(#a5sillR)"><Kid pose={fri} variant="friend" accent={K.chorus.accent} sil={k.sil} rim={{ dx: -1, dy: -.35, color: k.rim, width: .014, glow: .8 }} /></g>
            <g clipPath="url(#a5sillL)"><Kid pose={kid} sil={k.sil} rim={{ dx: 1, dy: -.35, color: k.rim, width: .014, glow: .8 }} /></g>
            {walls.map((w) => (
              <g key={w.g} fill={`url(#${w.g})`}>
                <path d={quad([pj(w.X, -2400, zn), pj(w.X, -2400, zk0), pj(w.X, AL.G, zk0), pj(w.X, AL.G, zn)])} />
                <path d={quad([pj(w.X, 0, zk0 - 20), pj(w.X, 0, zk1 + 20), pj(w.X - w.sd * 34, 0, zk1 + 20), pj(w.X - w.sd * 34, 0, zk0 - 20)])} fill={mixhex(k.sil, k.fog, .35)} />
                <path d={quad([pj(w.X - w.sd * 34, 0, zk0 - 20), pj(w.X - w.sd * 34, 0, zk1 + 20), pj(w.X - w.sd * 34, 22, zk1 + 20), pj(w.X - w.sd * 34, 22, zk0 - 20)])} fill={mixhex(k.sil, k.fog, .2)} />
              </g>
            ))}
            {laundry(300, -560, 683, 5)}
          </Layer>
          <Layer d={1} blur={7}>
            {laundry(-420, -390, 684, 4)}
          </Layer>
        </Scene>
      );
    },
  },
];
