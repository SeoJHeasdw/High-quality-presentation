/**
 * 5막(2:30–3:00) — 구조, 달, 새벽. 영화의 절정과 맺음.
 *   부름(아주 먼 와이드: 어둠 속 차가운 점 둘, 멀리 금빛 점들이 돈다) → 모여듦(소용돌이 와이드, 꼬리 긴 줄기)
 *   → 요람(미디엄: 박에 받아 낸다, 얼굴이 금빛) → 상승(아래에서, 구름이 쏟아져 지나감, 번개) → 돌파(흰빛, 거대한 달)
 *   → 닿음(손 클로즈업, 박에 빛 고리) → 터짐(달이 금빛 실로 쏟아짐) → 점화(1번 컷과 같은 구도, 창이 박마다 켜짐)
 *   → 새벽 방(빛 구슬을 안고 잠듦) → 마주 보는 두 창(손 흔들기, 뒤로 빠짐)
 */
import React from "react";
import { Layer, Scene, project, type Cam } from "../lib/camera";
import { K } from "../lib/palette";
import { B, beat } from "../lib/song";
import { clamp, ease, handheld, kf, lin, mix, mixc, mixhex, n2, rnd, smooth, springStep } from "../lib/math";
import { Cloud, CloudBank, Glow, GodRays, Lightning, Moon, Rain, Wisp } from "../lib/sky";
import { Skyline, buildings } from "../lib/city";
import { StormBank, StormMass } from "../lib/storm";
import { Moths, Burst, Thread, stream, swarm, toward, type M } from "../lib/moths";
import { getLength, getPointAtLength } from "@remotion/paths";
import { Kid, ikArm, skeleton } from "../kid/rig";
import { P, lerpPose, pose, type Pose } from "../kid/pose";
import { DawnView, Orb, PhoneLight, Rings, RushMasses, SkyLayer, SleepFace, SleepReveal, cradlePts, paneQuads, rescueStreams, sparks, type StreamOpt } from "./act5-kit";
import { LandingThreads, igniteAt, litShare, mixKey, shot1Lit, type Landing } from "./act5-city";
import { CityEstablish, RoomWall, cityCam } from "./act1-sets";
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

/**
 * 폭풍 덩어리(lib/storm의 StormMass) 색: 윗면(빛 받는 쪽)·몸통·밑면. fog는 공기 원근(멀수록 하늘색에 녹는다),
 * warm은 위에서 오는 금빛, dark는 가까운 덩어리를 더 검게
 */
const stormTone = (fog: number, warm = 0, dark = 0) => ({
  top: mixhex(mixhex(mixhex(mixhex(kR.cloud, "#8a7a80", .42), "#ffd9a0", warm), kR.sky[2], fog), kR.sky[0], dark * .6),
  body: mixhex(mixhex(mixhex(kR.cloud, kR.sky[1], .3), kR.sky[2], fog * .75), kR.sky[0], dark),
  base: mixhex(mixhex(kR.sky[0], kR.cloud, .3), kR.sky[1], fog * .5),
});
/** 머리 위 덩어리: 아래 지평선의 금빛을 밑면에 받는다(위가 어둡고 밑면이 밝다) */
const underTone = (fog: number, warm = 0) => ({
  top: mixhex(kR.sky[0], kR.cloud, .45),
  body: mixhex(mixhex(kR.cloud, kR.sky[1], .25), kR.sky[2], fog * .5),
  base: mixhex(mixhex(mixhex(kR.cloudLit, kR.cloud, .5), "#ffcf8a", warm), kR.sky[2], fog),
});
/** 덩어리 하나(층 좌표). 흐림은 층에 맡긴다(soft 0) */
const SM: React.FC<{ seed: number; x: number; y: number; w: number; h?: number; tone: ReturnType<typeof stormTone>; t: number; drift?: number; flash?: number; flashX?: number; flashY?: number; rim?: number; rimColor?: string }> = ({ tone, ...o }) => (
  <StormMass {...o} top={tone.top} body={tone.body} base={tone.base} soft={0} />
);
/** 번개 자리에서 가까운 덩어리일수록 세게 */
const flashNear = (flash: number, x: number, bx: number, r: number) => flash * clamp(1 - Math.abs(x - bx) / r) ** 1.5;


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

/** 65: 실이 내려앉는 자리(1번 도시의 층·건물 순서 u)와 박. 243에 바로 그 창(1번 컷의 창)이 있는 건물 */
const IGN = (() => {
  const lands: Landing[] = [
    { row: 2, u: .4, t: beat(242.5) },
    { row: 3, u: .55, t: beat(243), target: true },
    { row: 1, u: .6, t: beat(243.5) }, { row: 3, u: .33, t: beat(243.5) },
    { row: 2, u: .62, t: beat(244) }, { row: 0, u: .45, t: beat(244) },
    { row: 3, u: .44, t: beat(244.5) }, { row: 1, u: .37, t: beat(244.5) },
    { row: 2, u: .5, t: beat(245) }, { row: 3, u: .66, t: beat(245) }, { row: 0, u: .58, t: beat(245) },
    { row: 1, u: .47, t: beat(245.5) }, { row: 2, u: .34, t: beat(245.5) },
    // 8분음표마다 더 작은 실들(박 사이를 잇는 잔비)
    ...[3, 2, 1, 3, 0, 2, 3, 1, 2, 0, 1, 2].map((row, j) => ({ row, u: .3 + rnd(652, j) * .4, t: beat(243.25 + j * .25) })),
  ];
  return { lands };
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
      // 폭풍의 협곡: 먼 덩어리 두 줄(위는 평평한 밑면이 보이고 아래는 뭉게 윗면이 보인다), 가운데 덩어리 셋, 앞을 스치는 검은 덩어리
      const far = stormTone(.42, .08 + turn * .1), mid = stormTone(.16, .05 + turn * .1, .15), near = stormTone(0, 0, .65);
      const farU = underTone(.62, turn * .08), midU = underTone(.08, .15 + turn * .1);
      const BX = 450, rim = flash * .9;
      const top = [[-560, 200, 1000], [220, 330, 820], [900, 150, 1100], [1640, 310, 900], [2380, 210, 1050]] as const;
      const bot = [[-420, 1190, 1100], [420, 1230, 980], [1250, 1215, 1150], [2050, 1180, 1050], [2800, 1220, 1000]] as const;
      return (
        <Scene cam={cam}>
          <SkyLayer k={kR} horizon={1150} glowOpacity={.25} glowR={900} />
          <Layer d={12}>
            {top.map(([x, y, w], i) => <SM key={i} seed={581 + i} x={x} y={y} w={w} h={w * .3} tone={farU} t={lt} drift={-14} flash={flashNear(flash, x, BX, 900)} flashX={clamp((BX - x) / w + .5, .15, .85)} flashY={.7} rim={rim * .6} rimColor="#cfe8ff" />)}
            {bot.map(([x, y, w], i) => <SM key={i} seed={588 + i} x={x} y={y} w={w} h={w * .33} tone={far} t={lt} drift={10} rim={.25} rimColor={kR.cloudLit} />)}
          </Layer>
          <Layer d={4.5}>
            <Glow x={330} y={420} r={620} color="#9fc6d6" opacity={flash * .4} />
            <Lightning seed={58} x0={300} y0={250} x1={430} y1={700} flash={flash} width={3} branches={3} />
            <SM seed={583} x={60} y={330} w={1350} h={430} tone={midU} t={lt} drift={-20} flash={flash} flashX={.6} flashY={.62} rim={rim * .5} rimColor="#cfe8ff" />
            <SM seed={585} x={1780} y={250} w={1150} h={360} tone={midU} t={lt} drift={-12} />
            <SM seed={587} x={120} y={1080} w={1250} h={400} tone={mid} t={lt} drift={12} rim={.3} rimColor={kR.cloudLit} />
            <SM seed={584} x={1900} y={980} w={1450} h={470} tone={mid} t={lt} drift={16} rim={.3} rimColor={kR.cloudLit} />
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
          <Layer d={.5} blur={6}>
            <SM seed={586} x={mix(-160, -400, ease("out", c.p))} y={1180} w={1500} h={520} tone={near} t={lt} />
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
      const cTop = underTone(.4, warm * .35), cBot = stormTone(.3, .1 + warm * .35);
      return (
        <Scene cam={cam}>
          <SkyLayer k={kR} horizon={1100} glowOpacity={.2} />
          <Layer d={6}>
            <StormBank seed={591} y={50} x0={-1000} x1={3000} size={1000} count={6} {...cTop} t={lt} drift={-30} soft={0} />
            <StormBank seed={593} y={200} x0={-700} x1={2700} size={720} count={3} {...cTop} t={lt} drift={-40} soft={0} />
            <StormBank seed={592} y={1260} x0={-1000} x1={3000} size={1100} count={6} {...cBot} t={lt} drift={30} soft={0} rim={.3} rimColor={kR.cloudLit} />
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
      const sag = caught ? (1 - springStep(a, 11, .3)) * 46 : 0;
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
      const cTop = underTone(.35, .1 + warm * .4), cBot = stormTone(.25, .2 + warm * .4);
      return (
        <Scene cam={cam}>
          <SkyLayer k={kR} horizon={1200} glowOpacity={.3} />
          <Layer d={7}>
            <StormBank seed={601} y={90} x0={-1100} x1={3100} size={1100} count={6} {...cTop} t={lt} drift={-18} soft={0} />
            <StormBank seed={603} y={250} x0={-800} x1={2800} size={780} count={3} {...cTop} t={lt} drift={-26} soft={0} />
            <StormBank seed={602} y={1360} x0={-1100} x1={3100} size={1200} count={6} {...cBot} t={lt} drift={14} soft={0} rim={.35} rimColor={kR.cloudLit} />
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
    // 61. 아래에서 비스듬히 올려다본 상승(더치 앵글): 빛 요람을 탄 둘이 폭풍을 뚫고 솟는다. 요람에서 흘러내린 나방 꼬리가
    //     카메라 쪽으로 넓어지며 앞을 스쳐 지나가고, 구름이 겹겹이 아래로 쏟아진다(시차), 비가 긴 줄로 스친다.
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
      const cam: Cam = { x: 960 + hh.x + Math.sin(lt * 53) * bolt * 9, y: 560 + hh.y + launch * 30, zoom: kf(lt, [[0, 1.0], [c.dur, 1.1, "in"]]), rot: -.11 + hh.r, focus: 1, dof: 3.5 };
      const cx = 1000, cy = 330 + launch * 60 + Math.sin(lt * 3.1) * 8, rx = 290, ry = 120;
      const seatY = cy + ry * .48;
      const s = 250;
      const flinch = bolt * .6;
      const look = (seed: number) => mix(-.7, .05, flinch) + n2(seed, t) * .06;
      const ride: Partial<Pose> = { lean: .05, bend: 0, legN: [.25, 1.8], legF: [.12, 1.75], toe: .4, swing: -.7 - light * .3, squash: launch * .18 - flinch * .05, face: .85, faceColor: mixc(GOLD, "#e6f6ff", bolt), eyes: 1.1 };
      const pr = pair({ cx, cy: seatY, s, t, anchor: "seat", gap: .34, tumble: 0, handY: -.35,
        base: { ...ride, armF: [mix(2.95, 2.5, flinch), .1], headTilt: look(3), mouth: .3 },
        baseF: { ...ride, armF: [.7, .5], headTilt: look(7), smile: lt > .6 && bolt < .2 ? 1 : 0 } });
      const tg = cradlePts(5, cx, cy, rx, ry, 140, 4);
      const tg2 = cradlePts(6, cx, cy + 8, rx * 1.12, ry * 1.15, 110, 3);
      const sit = (seed: number, list: typeof tg, size: number) => (tt: number): M[] => list.map((p, i) => ({ x: p.x + n2(seed + i, tt * 1.5) * 6, y: p.y + n2(seed + i, tt * 1.5, 4) * 6, a: p.a, s: size * (.6 + rnd(seed, i) * .8), f: tt * 10 + i, b: .7 + .3 * rnd(seed, i + 9) }));
      // 폭풍 덩어리 세 겹(+ 먼 벽): 멀수록 작고 느리고 하늘색에 녹고, 가까울수록 크고 검고 빠르고 흐리다. 위의 빛이 커질수록 윗면이 데워진다
      const wall = stormTone(.5, .1 + light * .35), farT = stormTone(.22, .12 + light * .45, .1), midT = stormTone(.06, .1 + light * .4, .35), nearT = stormTone(0, light * .25, .7);
      const bx = 380, rimC = bolt > .25 ? "#d6eeff" : "#ffe2b0", rimA = Math.max(bolt * .9, .2 + light * .6);
      // 꼬리: 요람 밑에서 카메라 쪽으로(아래로) 흘러내리며 원근으로 커진다
      const near = (m: M) => ({ ...m, s: m.s * (1 + clamp((m.y - cy) / 1000) * 2.6) });
      const tail = (tt: number) => stream(613, 90, tt, (u) => ({ x: cx - u * 260 + Math.sin(u * 5 + tt * 3) * 60 * u, y: cy + ry * .8 + u * 1150 }), { speed: 1.5, spread: 40 + 0, size: 7 }).map(near);
      const fgTail = (tt: number) => stream(615, 16, tt, (u) => ({ x: mix(cx - 80, 640, u), y: mix(cy + 200, 1500, u) }), { speed: 1.9, spread: 160, size: 22 });
      return (
        <Scene cam={cam}>
          <SkyLayer k={kR} horizon={1300} glowOpacity={.2}>
            <Glow x={960} y={-120} r={mix(500, 1500, light)} color={K.clear.moon} opacity={.25 + light * .6} />
          </SkyLayer>
          <Layer d={3.2} blur={3}>
            {/* 먼 벽(층 하나를 아끼려고 같은 층에 그린다: 더 느리고 더 하늘색에 녹아 더 멀어 보인다) */}
            <RushMasses seed={610} t={t} n={7} speed={420} x0={-1200} x1={3100} y0={-900} span={2700} size={1150} aspect={.36} {...wall} flash={bolt * .7} boltX={bx} boltR={1400} rim={rimA * .5} rimColor={rimC} />
            <Glow x={bx - 120} y={300} r={760} color="#cfe8ff" opacity={bolt * .45} />
            <Lightning seed={611} x0={140} y0={-300} x1={620} y1={980} flash={bolt} width={4} branches={5} />
            <RushMasses seed={611} t={t} n={10} speed={950} x0={-900} x1={2800} y0={-1100} span={2900} size={780} {...farT} flash={bolt} boltX={bx} boltR={1100} rim={rimA * .8} rimColor={rimC} />
          </Layer>
          <Layer d={3.2} blend="screen">
            <GodRays x={960} y={-200} t={t} count={16} len={1700} color={K.clear.moon} opacity={light * .6} spin={.01} />
            <Glow x={960} y={-60} r={mix(200, 900, light)} color="#fff3d0" opacity={light * .8} />
          </Layer>
          <Layer d={1.7} blur={2.5}>
            <RushMasses seed={612} t={t} n={6} speed={2100} x0={-500} x1={2400} y0={-1100} span={2700} size={680} dx={-200} {...midT} flash={bolt * .85} boltX={bx + 100} boltR={900} rim={rimA * .7} rimColor={rimC} />
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
          <Layer d={.55} blur={9}>
            {[[-300, .1, 1500], [2200, .62, 1700], [-160, 1.3, 1600], [1900, 1.85, 1400]].map(([x, o, w], i) => <SM key={i} seed={614 + i} x={x} y={-1300 + ((lt + o) * 4300) % 4800} w={w} h={w * .36} tone={nearT} t={t} flash={flashNear(bolt, x, bx - 300, 1500) * .6} flashX={x < 960 ? .7 : .3} rim={rimA * .6} rimColor={rimC} />)}
            <Moths t={t} at={fgTail} color={kR.accent} trail={3} trailDt={.03} />
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
      const rise = ease("expoOut", lin(.28, la + .45, lt));
      const hh = handheld(t, 62, 5);
      const cam: Cam = { x: 960 + hh.x, y: mix(700, 520, ease("expoOut", lin(.2, la + .8, lt))) + hh.y, zoom: kf(lt, [[0, 1.0], [c.dur, 1.06, "io"]]), rot: hh.r, focus: 1, dof: 2.5 };
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
        const e = ease("expoOut", lin(.3, 1.9, lt));
        return { x: 880 + Math.cos(a) * v * e, y: 1060 + Math.sin(a) * v * e * .7 + lt * lt * 40, r: (50 + rnd(64, i) * 80) * (1 + lin(.3, 2.4, lt) * .5), o: smooth(.25, .35, lt) * (1 - smooth(.6, 2.0, lt)) };
      };
      return (
        <Scene cam={cam}>
          <SkyLayer k={k} horizon={1080} glowOpacity={.6} stars={.35} t={t} />
          <Layer d={60} blur={0}>
            <GodRays x={1230} y={300} t={t} color={k.moon} opacity={.18} len={2600} count={20} />
            <Moon x={1230} y={300} r={330} color={k.moon} glow={1.15} pulse={c.pulse * .3} texture={1} />
          </Layer>
          <Layer d={20} blur={0}>
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
          <Layer d={.9}>
            <CloudBank seed={626} y={1290} x0={-600} x1={2500} size={760} count={6} dark={mixhex(k.cloud, k.sil, .25)} lit={mixhex(k.cloudLit, k.cloud, .15)} t={t} drift={-12} />
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
                {/* 두 엄지가 끝을 맞대 뾰족한 하나(첨탑 모양)가 되어 달에 닿는다 */}
                <line x1={Kn.x + side * 36 * sc} y1={Kn.y - 2 * sc} x2={P0.x + side * 4 * sc} y2={P0.y + 4 * sc - g * .1} strokeWidth={22 * sc} />
                <path strokeWidth={0} d={`M${Kn.x + side * 40 * sc},${Kn.y + 4 * sc}L${P0.x},${P0.y + 10 * sc - g * .1}L${Kn.x},${Kn.y + 10 * sc}Z`} />
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
    // 65. 북엔드: 1번 컷과 똑같은 도시·카메라(1막의 CityEstablish·cityCam)로 같은 창을 향해 밀어 들어간다. 그 창은 아직 폰 빛으로 차갑게 깜빡인다.
    //     금빛 실이 박마다 지붕에 내려앉고(243에 바로 그 건물), 닿은 자리에서 창이 하나씩 번져 켜진다. 끝에서 도시 전체가 따뜻하다
    id: "a5-ignite", start: T65, key: "bloom", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt, t = c.t;
      const warmth = smooth(beat(242.6), beat(246), t);
      const k = mixKey(K.lonely, K.bloom, warmth);
      const tw = smooth(beat(243) - .02, beat(243) + .1, t);
      const ignite = (u: number, i: number) => {
        const base = shot1Lit(u, i);
        if (!litShare(u, i)) return base;
        const tOn = igniteAt(u, i, IGN.lands, beat(245.1));
        return Math.max(base, smooth(tOn, tOn + .12, t));
      };
      // 먼 하늘(d 40)에 내리는 실: 도시 너머로 떨어지는 금빛 비
      const far = Array.from({ length: 9 }, (_, i) => {
        const x = mix(-200, 2100, (i + rnd(653, i) * .7) / 9), t0 = T65 - .3 + rnd(654, i) * 1.8;
        const d = `M${x + (rnd(655, i) - .5) * 300},-500Q${x + (rnd(656, i) - .5) * 200},100 ${x},${520 + rnd(657, i) * 40}`;
        return <Thread key={i} d={d} progress={clamp((t - t0) / 1.1)} color={K.bloom.accent} width={1.4} opacity={.7} />;
      });
      return (
        <Scene cam={cityCam(lt, c.dur, t, 1.9)}>
          <CityEstablish k={k} t={t} target={{ on: 1, color: mixhex(K.lonely.cold, K.bloom.win, tw), flicker: tw < .5 }} ignite={ignite} winDim={mix(.45, .1, warmth)} stars={1 - warmth * .8} kid={false}
            sky={<g><Glow x={960} y={-240} r={900} color={K.bloom.glow} opacity={.15 + warmth * .3} />{far}</g>} />
          <LandingThreads t={t} lands={IGN.lands} color={K.bloom.accent} />
          <Layer d={4} blend="screen" blur={0}>
            <Glow x={960} y={860} rx={2400} ry={520} r={900} color={K.bloom.win} opacity={warmth * .28} />
          </Layer>
          <Layer d={.7} blend="screen">
            <Moths t={t} at={(tt) => sparks(651, 14, tt, { x0: -200, x1: 2200, y0: -300, y1: 1300, speed: 180, size: 7, sway: 50 })} color={K.bloom.accent} wings={false} opacity={.8} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 66. 새벽 방(dip). 2번 방의 거울: 같은 창(십자 창살·양쪽 커튼)과 그 앞의 침대, 왼쪽 앞의 스탠드를 옆에서 본다. 이제 창밖은 복숭앗빛 새벽.
    //     빛 구슬(작은 달)의 동그란 빛 하나에서 열린다(65번 끝 창 빛 ↔ 구슬, 원 → 원). 빛이 번져 방이 드러나고 카메라는 구슬로 천천히 밀려 든다.
    //     아이는 옆으로 웅크려 이불을 덮고 구슬을 꼭 안고 잠들었다. 구슬 빛이 감은 눈과 작은 미소를 비춘다.
    //     창에서 긴 평행사변형 햇살이 이불과 바닥으로 비스듬히 눕고 먼지가 떠다닌다. 커튼이 살짝 흔들린다. 머리맡 탁자의 폰은 꺼져 엎어져 있다
    id: "a5-sleep", start: T66, key: "dawn", enter: { type: "dip" },
    render: (c) => {
      const lt = c.lt, t = c.t;
      const k = K.dawn;
      const breath = Math.sin(t * 2.1);
      // 옆으로 누워 웅크림(facing 1, 머리 오른쪽 베개, 등은 위·창 쪽, 몸 앞·무릎·구슬은 카메라 쪽)
      const lean = .42;
      const kp = pose({
        anchor: "center", x: 1180, y: 664 - breath * 1.5, s: 520, facing: 1, rot: Math.PI / 2 - lean - .04, lean, bend: .2 + breath * .012, headTilt: .3, faceDir: .45,
        armN: [.55, 2.45], armF: [.45, 2.5], legN: [1.5, 2.15], legF: [1.3, 2.2], toe: .35, swing: 3.9 + breath * .03,
        face: .95, faceColor: "#ffdcaa", eyes: 0, smile: 0, mouth: 0,
      });
      const sk = skeleton(kp);
      // 몸의 팔은 몸통 안으로 접어 두고(덩어리가 생기지 않게), 구슬을 안은 팔은 따로 그린다
      const ha = skeleton({ ...kp, armN: [1.2, 1.85] }).haN;
      const orb = { x: ha.x - 44, y: ha.y - 40 + breath * .8, r: 33 };
      // 구슬을 안은 두 손: 가까운 아래팔이 구슬 밑을 둥글게 받치고(손은 구슬 오른쪽), 먼 손은 구슬 왼쪽 위를 감싼다
      const hug = { e: { x: orb.x - orb.r * 1.2, y: orb.y + orb.r * .9 }, c: { x: orb.x - 4, y: orb.y + orb.r * 1.45 }, h: { x: orb.x + orb.r * .95, y: orb.y + orb.r * .55 }, f: { x: orb.x - orb.r * .78, y: orb.y - orb.r * .62 } };
      const armD = `M${hug.e.x},${hug.e.y}Q${hug.c.x},${hug.c.y} ${hug.h.x},${hug.h.y}`;
      // 카메라: 구슬이 화면 가운데(65번 끝의 창 빛 자리)에서 시작해 천천히 밀려 든다
      const push = ease("sineIO", lin(0, c.dur, lt));
      const hh = handheld(t, 66, 2.2, .25);
      const cam: Cam = { x: orb.x + mix(0, -40, push) + hh.x, y: orb.y + mix(0, -60, push) + hh.y, zoom: mix(1.2, 1.4, push), rot: hh.r, focus: 1, dof: 4.5 };
      // 색
      const wall = mixhex(mixhex(k.sil, k.fog, .2), "#5a3040", .25);
      const bedC = mixhex(k.sil, wall, .25);
      const sheet = mixhex(k.fog, k.sil, .42);
      const blanket = mixhex(mixhex(k.accent, "#b0606e", .5), k.sil, .62);
      const floorY = 1012;
      const win = { x: 790, y: 150, w: 680, h: 600 };
      const bed = { x0: 590, x1: 1770, far: 692, near: 800, bottom: 966 };
      // 이불: 허리에서 접혀 엉덩이 둔덕을 넘어 발치로, 침대 앞으로 늘어진다
      const pv = sk.pelvis, s = kp.s;
      const A = { x: pv.x + .005 * s, y: pv.y - .16 * s }, Bk = { x: pv.x + .14 * s, y: bed.near + 4 };
      const H = { x: pv.x - .07 * s, y: pv.y - .19 * s }, Cb = { x: pv.x - .25 * s, y: pv.y - .08 * s }, D = { x: pv.x - .44 * s, y: bed.far + 8 };
      const hem = (x: number, i: number) => `${x.toFixed(1)},${(bed.near + 92 + Math.sin(i * 1.7 + t * .4) * 8 + (i % 2) * 10).toFixed(1)}`;
      const blanketD = `M${A.x},${A.y}C${A.x - .04 * s},${A.y - .07 * s} ${H.x + .1 * s},${H.y} ${H.x},${H.y}C${H.x - .1 * s},${H.y} ${Cb.x + .03 * s},${Cb.y - .08 * s} ${Cb.x},${Cb.y}`
        + `C${Cb.x - .05 * s},${Cb.y + .06 * s} ${D.x + .1 * s},${D.y - 4} ${D.x},${D.y}L${bed.x0 + 30},${bed.far + 12}Q${bed.x0 - 8},${bed.far + 16} ${bed.x0 - 10},${bed.near}`
        + `L${hem(bed.x0 - 14, 0)}` + Array.from({ length: 7 }, (_, i) => `L${hem(mix(bed.x0 - 14, Bk.x + 70, (i + 1) / 7), i + 1)}`).join("")
        + `L${Bk.x + 66},${bed.near + 2}Q${Bk.x + 20},${bed.near - 6} ${Bk.x},${Bk.y - 6}C${Bk.x - .02 * s},${Bk.y - .1 * s} ${A.x + .07 * s},${A.y + .12 * s} ${A.x},${A.y}Z`;
      // 햇살 조각: 창 아래 모서리가 이불 위(벽 가까이), 창 위 모서리가 바닥(카메라 가까이)에 떨어진다. 해가 오른쪽이라 왼쪽 아래로 길게 눕는다
      const po = { x: 770, y: bed.far + 8 }, PU = { x: 420, y: 0 }, PV = { x: -330, y: 560 };
      const panes = paneQuads(po, PU, PV, .04, .58);
      const shaft = `M${win.x + 40},${win.y + 30}L${win.x + win.w - 40},${win.y + 30}L${po.x + PU.x + PV.x},${po.y + PV.y}L${po.x + PV.x},${po.y + PV.y}Z`;
      const motes = (tt: number): M[] => Array.from({ length: 46 }, (_, i) => {
        const u = rnd(663, i), a = (rnd(664, i) + tt * .03 * (rnd(665, i) - .4)) % 1;
        const top = { x: win.x + 40 + (win.w - 80) * u, y: win.y + 30 }, bot = { x: po.x + PV.x + PU.x * u, y: po.y + PV.y };
        const x = mix(top.x, bot.x, a) + n2(666 + i, tt * .25) * 40, y = mix(top.y, bot.y, a) + n2(667 + i, tt * .25) * 30;
        return { x, y, s: 1.4 + rnd(668, i) * 2.6, a: 0, f: 0, b: (.3 + .7 * Math.sin(tt * 1.1 + i * 2.3) ** 2) * smooth(0, .12, a) * (1 - smooth(.85, 1, a)) };
      });
      // 열림: 구슬의 둥근 빛 하나에서 방이 번져 드러난다
      const os = project(cam, 1, orb.x, orb.y);
      const reveal = mix(150, 5200, ease("in", lin(.05, 1.75, lt)));
      const lamp = { x: 930, y: 1010 };
      return (
        <Scene cam={cam}>
          <Layer d={6}>
            <DawnView k={k} t={t} sunX={1250} base={560} />
          </Layer>
          <Layer d={1.3} blur={0} defs={
            <linearGradient id="a5sleepCeil" x1="0" y1={-500} x2="0" y2={win.y + 40} gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor={k.sil} stopOpacity={.85} />
              <stop offset="1" stopColor={k.sil} stopOpacity={0} />
            </linearGradient>
          }>
            <RoomWall k={k} t={t} {...win} floorY={floorY} wind={.14} wall={wall} spill="#ffb88a" spillA={.42} frame={mixhex(k.sil, wall, .3)} />
            <rect x={-2000} y={-500} width={6000} height={win.y + 540} fill="url(#a5sleepCeil)" />
            <rect x={1610} y={300} width={170} height={210} fill={mixhex(k.sil, wall, .45)} />
            <rect x={1626} y={316} width={138} height={178} fill={mixhex(wall, "#ffb88a", .18)} />
            <rect x={1610} y={300} width={170} height={4} fill={k.rim} opacity={.35} />
          </Layer>
          <Layer d={1.3} blend="screen" blur={3}>
            <Glow x={win.x + win.w * .6} y={win.y + win.h * .7} r={900} rx={1100} ry={700} color="#ff9a7a" opacity={.3} />
            <Glow x={win.x + win.w + 420} y={win.y + 260} r={700} color="#ffb070" opacity={.16} />
          </Layer>
          <Layer d={1}>
            <rect x={-2000} y={floorY} width={6000} height={1400} fill={mixhex(k.sil, wall, .4)} />
            <rect x={-2000} y={floorY} width={6000} height={10} fill={mixhex(k.sil, wall, .25)} />
            {/* 침대: 다리 · 앞면 · 매트리스 윗면 · 베개 */}
            <rect x={bed.x0 + 30} y={bed.bottom - 10} width={28} height={floorY - bed.bottom + 14} fill={bedC} />
            <rect x={bed.x1 - 58} y={bed.bottom - 10} width={28} height={floorY - bed.bottom + 14} fill={bedC} />
            <ellipse cx={(bed.x0 + bed.x1) / 2} cy={floorY + 8} rx={(bed.x1 - bed.x0) * .56} ry={26} fill={k.sil} opacity={.5} />
            <path d={`M${bed.x0},${bed.far}L${bed.x1},${bed.far}L${bed.x1 + 6},${bed.near}L${bed.x0 - 6},${bed.near}Z`} fill={sheet} />
            <rect x={bed.x0 - 8} y={bed.near - 4} width={bed.x1 - bed.x0 + 16} height={bed.bottom - bed.near + 4} rx={14} fill={bedC} />
            <rect x={bed.x0 - 8} y={bed.near - 4} width={bed.x1 - bed.x0 + 16} height={5} fill={mixhex(bedC, k.rim, .35)} />
            <ellipse cx={1530} cy={bed.far + 30} rx={170} ry={52} fill={mixhex(sheet, "#fff0e0", .18)} />
            <path d={`M1380,${bed.far + 34}Q1530,${bed.far - 4} 1690,${bed.far + 30}`} stroke={k.rim} strokeWidth={3} fill="none" opacity={.35} />
            {/* 머리맡 탁자와 꺼진 폰(엎어져 있다, 차가운 빛은 없다) */}
            <rect x={1810} y={770} width={190} height={floorY - 770} rx={8} fill={bedC} />
            <rect x={1810} y={770} width={190} height={4} fill={k.rim} opacity={.3} />
            <rect x={1828} y={812} width={154} height={6} fill={mixhex(bedC, k.sil, .5)} />
            <g transform="rotate(-4 1880 760)">
              <rect x={1836} y={750} width={98} height={16} rx={4} fill="#120c1a" />
              <rect x={1841} y={750} width={88} height={2.5} fill="#ffcfa0" opacity={.4} />
            </g>
          </Layer>
          <Layer d={1}>
            <Kid pose={kp} sil={k.sil} rim={{ dx: .35, dy: -1, color: k.rim, width: .01, glow: .7 }} rim2={{ dx: .1, dy: 1, color: "#ffd08a", width: .012, glow: 1 }} />
            <SleepFace p={kp} smile={1} />
            <path d={`M${sk.shN.x},${sk.shN.y}L${hug.e.x},${hug.e.y}`} stroke={k.sil} strokeWidth={.066 * s} strokeLinecap="round" />
            <circle cx={hug.f.x} cy={hug.f.y} r={.034 * s} fill={k.sil} />
            <path d={blanketD} fill={blanket} />
            <path d={`M${A.x},${A.y}C${A.x + .07 * s},${A.y + .12 * s} ${Bk.x - .02 * s},${Bk.y - .1 * s} ${Bk.x},${Bk.y - 6}`} stroke={mixhex(blanket, "#ffe0c0", .35)} strokeWidth={9} fill="none" strokeLinecap="round" />
            <path d={`M${H.x - 20},${H.y + 40}Q${Cb.x},${Cb.y + 40} ${D.x + 30},${D.y + 40}M${bed.x0 + 120},${bed.near + 20}Q${bed.x0 + 260},${bed.near + 60} ${bed.x0 + 300},${bed.near + 92}M${Bk.x - 140},${bed.near + 30}Q${Bk.x - 60},${bed.near + 50} ${Bk.x - 30},${bed.near + 96}`} stroke={mixhex(blanket, k.sil, .35)} strokeWidth={6} fill="none" strokeLinecap="round" />
          </Layer>
          <Layer d={1} blend="screen" blur={1.6} defs={
            <>
              <clipPath id="a5sleepPatch"><path d={blanketD} /><rect x={bed.x0} y={bed.far} width={bed.x1 - bed.x0} height={bed.near - bed.far} /><rect x={-2000} y={floorY + 34} width={6000} height={1400} /></clipPath>
              <linearGradient id="a5sleepShaft" x1="0" y1={win.y} x2="0" y2={po.y + PV.y} gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#ffd2a0" stopOpacity={.42} />
                <stop offset="1" stopColor="#ffb07a" stopOpacity={.04} />
              </linearGradient>
            </>
          }>
            <path d={shaft} fill="url(#a5sleepShaft)" opacity={.45} />
            <path d={panes} fill="#ffc690" opacity={.46} clipPath="url(#a5sleepPatch)" />
            <Moths t={t} at={motes} color="#ffe6c8" wings={false} glow={.6} />
          </Layer>
          <Layer d={1} blend="screen">
            <Glow x={orb.x} y={orb.y} r={460} color="#ffb766" opacity={.42 + breath * .04} />
            <Orb x={orb.x} y={orb.y} r={orb.r} breath={breath} />
          </Layer>
          <Layer d={1} defs={<clipPath id="a5sleepArm"><circle cx={orb.x} cy={orb.y} r={orb.r * 2.4} /></clipPath>}>
            {/* 가까운 아래팔을 구슬 앞으로 다시 그린다: 구슬 아래쪽을 받쳐 안고, 구슬 빛이 팔 윗가장자리를 비춘다 */}
            <g transform="translate(0 -3.5)" clipPath="url(#a5sleepArm)" opacity={.95}>
              <path d={armD} stroke="#ffd59a" strokeWidth={.05 * s + 6} strokeLinecap="round" fill="none" />
              <circle cx={hug.h.x} cy={hug.h.y} r={.036 * s + 3} fill="#ffd59a" />
            </g>
            <path d={armD} stroke={k.sil} strokeWidth={.05 * s} strokeLinecap="round" fill="none" />
            <circle cx={hug.h.x} cy={hug.h.y} r={.036 * s} fill={k.sil} />
          </Layer>
          <Layer d={.6} blur={5}>
            {/* 2번 방의 스탠드(흐린 전경 실루엣) */}
            <rect x={lamp.x - 600} y={lamp.y} width={760} height={600} fill={k.sil} />
            <rect x={lamp.x - 600} y={lamp.y - 14} width={780} height={20} fill={k.sil} />
            <path d={`M${lamp.x},${lamp.y - 10}L${lamp.x + 14},${lamp.y - 250}L${lamp.x + 130},${lamp.y - 330}`} stroke={k.sil} strokeWidth={16} fill="none" strokeLinecap="round" />
            <path d={`M${lamp.x + 80},${lamp.y - 340}L${lamp.x + 220},${lamp.y - 380}L${lamp.x + 202},${lamp.y - 250}Z`} fill={k.sil} />
            <ellipse cx={lamp.x} cy={lamp.y - 6} rx={70} ry={14} fill={k.sil} />
            <path d={`M${lamp.x + 220},${lamp.y - 380}L${lamp.x + 202},${lamp.y - 250}`} stroke={k.rim} strokeWidth={4} opacity={.45} />
          </Layer>
          <SleepReveal x={os.x} y={os.y} r={reveal} />
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
      // 손 흔들기는 서로를 향해 앞·위로(팔이 후드 실루엣 안으로 들어가면 안 읽힌다): 위팔 ≈ 수평보다 20°, 아래팔이 박마다 한 번 젖혀진다
      const waveArm = (o: number): [number, number] => [mix(1.3, 1.9, waveOn) + Math.sin(ph + o) * .05 * waveOn, mix(1.4, .1, waveOn) + Math.sin(ph + o) * .45 * waveOn];
      const faceL = .35 + look * .4;
      const kid = pose({
        x: kidP.x, y: kidP.y, s: sKid, facing: 1, lean: mix(mix(.42, .25, look), .06, waveOn), bend: .08 * (1 - waveOn), headTilt: mix(.45, -.08, look) - hop * .1, squash: -hop * .05,
        armN: waveArm(0), armF: [1.25, 1.45], legN: [.05, .05], legF: [-.05, .05], swing: .15 + Math.sin(t * 1.3) * .08,
        face: faceL, faceColor: "#ffd2a8", faceDir: .15, eyes: 1 + see * .25, mouth: see * .6, smile: waveOn > .5 ? 1 : 0,
      });
      const friY = mix(380, 0, rise);
      const fri = pose({
        x: friP.x, y: pj(A - 12, 70 + friY, ZK).y, s: sKid, facing: -1, lean: mix(.1, .06, waveOn), bend: .05, headTilt: mix(-.25, -.05, look) - hop * .1, squash: -hop * .05,
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
            {laundry(-420, -480, 684, 4)}
          </Layer>
        </Scene>
      );
    },
  },
];
