/**
 * 1막(0:00–0:44) — 외로운 밤 → 나방 → 지붕. 16컷.
 *   1–5  lonely  차갑고 고립됨. 창과 폰이 가장 밝다. 금빛은 창밖 나방 한 점뿐
 *   6–10 moths   창이 열리고 금빛이 처음으로 방을 채운다(곡이 터지는 B(4)에 flash)
 *   11–16 roof   블루아워 지평선이 밝고 실루엣은 어둡다. 끝은 달빛을 받은 얼굴 클로즈업
 * 재료는 ./act1-sets.tsx(1번 도시는 65번이, 2번 방은 39번이, 4번 유리는 40번이 거울로 다시 쓴다).
 */
import React from "react";
import { Layer, Scene, type Cam } from "../lib/camera";
import { K } from "../lib/palette";
import { B, beat } from "../lib/song";
import { clamp, ease, handheld, kf, lin, mix, mixc, mixhex, n2, rnd, smooth, springStep } from "../lib/math";
import { CloudBank, Glow, GodRays, Moon, SkyFill, Stars, Wisp } from "../lib/sky";
import { Antenna, Curtain, Laundry, Parapet, Skyline, WaterTank } from "../lib/city";
import { CityLayers, RoofSet, SkyBackdrop } from "../lib/sets";
import { Burst, Moths, stream, swarm, type M } from "../lib/moths";
import { Kid, ikArm, skeleton } from "../kid/rig";
import { P, STRIDE, climb, gait, lerpPose, pose, type Pose } from "../kid/pose";
import type { Key } from "../lib/palette";
import type { Shot } from "./types";
import {
  BigMoth, CityEstablish, FogBand, Moonbeam, Motes, NightView, PhoneScreen, Rimmed, Ripple, RoomWall, Smear, cityCam, fingerHand, phoneFlicker,
} from "./act1-sets";

// 컷 경계(초)
const T2 = B(1), T3 = B(2), T4 = beat(12), T5 = B(3), T6 = B(4), T7 = beat(20), T8 = beat(22), T9 = B(6), T10 = beat(30);
const T11 = B(8), T12 = B(10), T13 = B(11), T14 = B(12), T15 = B(13), T16 = B(14);

/** 한 번 튕기고 잦아드는 값(0에서 시작): 후드 꼬리·카메라 흔들림 */
const wob = (x: number, w = 12, z = 4) => (x <= 0 ? 0 : Math.sin(x * w) * Math.exp(-x * z));
/** 시각 열 [t, 부분 자세]를 차례로 옮겨 간다. 구간마다 이징·길이를 정한다 */
function seq(lt: number, keys: [number, Partial<Pose>, number?, Parameters<typeof ease>[0]?][]): Partial<Pose> {
  let cur = keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t0, p, dur = .3, e = "io"] = keys[i];
    if (lt < t0) break;
    cur = lerpPose(cur, { ...cur, ...p }, ease(e, (lt - t0) / dur));
  }
  return cur;
}


/** 머리(후드 중심)가 (hx, hy)에 오도록 골반 자리를 정한다(클로즈업 구도 잡기) */
function atHead(p: Partial<Pose>, hx: number, hy: number): Pose {
  const sk0 = skeleton({ ...p, anchor: "center", x: 0, y: 0 });
  return pose({ ...p, anchor: "center", x: hx - sk0.head.x, y: hy - sk0.head.y });
}
/** rig의 얼굴 타원 중심(세계 좌표). rot = 0일 때. 눈은 (±.04s, -.005s), 입은 (0, .045s) */
function faceAt(p: Pose) {
  const sk = skeleton(p);
  const ht = p.lean + p.bend + p.headTilt * .6;
  const k1 = mix(.085, .01, Math.abs(clamp(p.faceDir, -1, 1))) * p.s;
  const lx = Math.cos(ht) * k1 - Math.sin(ht) * .012 * p.s;
  const ly = Math.sin(ht) * k1 + Math.cos(ht) * .012 * p.s;
  return { x: sk.head.x + lx * p.facing, y: sk.head.y + ly };
}

/** 밖에서 본 열린 창: 틀, 안으로 젖혀진 창짝 둘(좁은 사다리꼴), 밖으로 펄럭이는 커튼(뒤에서 빛을 받아 반투명) */
const WindowFrameOpen: React.FC<{ x: number; y: number; w: number; h: number; color: string; t: number; k: Key }> = ({ x, y, w, h, color, t, k }) => (
  <g>
    <path d={`M${x - 18},${y - 18}H${x + w + 18}V${y + h + 6}H${x - 18}Z M${x},${y}V${y + h}H${x + w}V${y}Z`} fill={color} fillRule="evenodd" />
    <path d={`M${x + 4},${y}L${x + 70},${y + 34}L${x + 70},${y + h - 34}L${x + 4},${y + h}`} stroke={color} strokeWidth={11} fill={mixc(k.accent, "#ffffff", .3)} fillOpacity={.12} strokeLinejoin="round" />
    <path d={`M${x + w - 4},${y}L${x + w - 70},${y + 34}L${x + w - 70},${y + h - 34}L${x + w - 4},${y + h}`} stroke={color} strokeWidth={11} fill={mixc(k.accent, "#ffffff", .3)} fillOpacity={.12} strokeLinejoin="round" />
    <Curtain x={x - 4} y={y - 6} w={70} h={h * .92} color={mixhex(k.accent, "#b06a2a", .4)} t={t} wind={.9} side={1} seed={5} opacity={.55} />
    <g transform={`translate(${2 * x + w} 0) scale(-1 1)`}>
      <Curtain x={x - 4} y={y - 6} w={70} h={h * .92} color={mixhex(k.accent, "#b06a2a", .4)} t={t} wind={.9} side={1} seed={9} opacity={.55} />
    </g>
  </g>
);

const LK = K.lonely;
const GOLD = K.moths.accent;

/** 방 침대(정면에서 본 긴 쪽). 매트리스·이불 주름·베개·다리. 윗모서리에 창빛 */
const BedFront: React.FC<{ x0: number; x1: number; top: number; floor: number; color: string; blanket: string; edge: string; pillow?: "left" | "right" }> = ({ x0, x1, top, floor, color, blanket, edge, pillow = "right" }) => {
  const w = x1 - x0;
  const px = pillow === "right" ? x1 - 150 : x0 + 150;
  return (
    <g>
      <rect x={x0 + 30} y={floor - 50} width={26} height={50} fill={color} />
      <rect x={x1 - 56} y={floor - 50} width={26} height={50} fill={color} />
      <rect x={x0} y={top} width={w} height={floor - top - 44} rx={20} fill={color} />
      <ellipse cx={px} cy={top - 18} rx={130} ry={44} fill={blanket} />
      <path d={`M${x0 + w * .3},${top + 2}C${x0 + w * .45},${top - 34} ${x0 + w * .6},${top + 10} ${x0 + w * .75},${top - 22}S${x1 - 20},${top - 6} ${x1 + 6},${top + 8}L${x1 + 10},${top + 120}C${x0 + w * .8},${top + 140} ${x0 + w * .55},${top + 105} ${x0 + w * .38},${top + 150}Z`} fill={blanket} />
      <rect x={x0 + 14} y={top} width={w * .3} height={3} fill={edge} opacity={.5} />
      <path d={`M${x0 + w * .3},${top + 2}C${x0 + w * .45},${top - 34} ${x0 + w * .6},${top + 10} ${x0 + w * .75},${top - 22}S${x1 - 20},${top - 6} ${x1 + 6},${top + 8}`} stroke={edge} strokeWidth={3} fill="none" opacity={.45} />
    </g>
  );
};

export const act1: Shot[] = [
  {
    // 1. EWS 높은 곳에서 본 밤 도시. 수백 개 창 중 하나로 점점 빨라지며 밀려 들어간다. 그 창만 폰 빛으로 차갑게 깜빡인다.
    //    끝 2초에 금빛 점 하나가 그 창으로 다가간다(4번 나방의 복선)
    id: "a1-city", start: 0, key: "lonely", enter: { type: "cut" },
    render: (c) => (
      <Scene cam={cityCam(c.lt, c.dur, c.t)}>
        <CityEstablish k={LK} t={c.t} moth={c.lt < 2.6 ? -1 : lin(2.6, c.dur + .4, c.lt)} />
      </Scene>
    ),
  },
  {
    // 2. MS 방 안. 밝은 창(달빛 도시)을 등진 옆모습 실루엣이 침대에 앉아 폰을 본다. 폰 빛만 얼굴에. 천천히 밀어 들어감
    id: "a1-room", start: T2, key: "lonely", enter: { type: "cut" },
    render: (c) => {
      const k = LK, lt = c.lt;
      const hh = handheld(c.t, 4, 4);
      const push = ease("sineIO", c.p);
      const cam: Cam = { x: mix(960, 1050, push) + hh.x, y: mix(540, 505, push) + hh.y, zoom: mix(1, 1.14, push), rot: hh.r, focus: 1, dof: 4 };
      const win = { x: 790, y: 140, w: 680, h: 570 };
      const fl = phoneFlicker(c.t, 9);
      const blink = 1 - (smooth(1.5, 1.57, lt) - smooth(1.62, 1.72, lt));
      const top = 812, floor = 1000;
      const p = pose({
        ...P.sitEdge, ...P.phone, anchor: "seat", x: 1150, y: top + 4, s: 610, facing: -1, lean: .12, bend: .22,
        headTilt: .42 + Math.sin(lt * 1.4) * .02, legN: [1.3, 1.5], legF: [1.08, 1.35], armN: [.5, 1.45], armF: [.4, 1.55],
        face: .9 * fl, faceColor: k.cold, phone: fl, eyes: .6 * blink, swing: -.15,
      });
      return (
        <Scene cam={cam}>
          <Layer d={6} blur={1.2}>
            <NightView k={k} t={c.t} moon={{ x: 1330, y: 300, r: 34 }} base={760} />
          </Layer>
          <Layer d={1.35} blur={0}>
            <RoomWall k={k} t={c.t} {...win} floorY={floor} wind={.06} />
            {/* 벽의 액자(어둠 속 모서리만 빛을 받는다) */}
            <rect x={240} y={250} width={300} height={220} fill={mixhex(k.sil, k.fog, .2)} />
            <rect x={240} y={250} width={300} height={3} fill={k.rim} opacity={.15} />
            <rect x={1640} y={300} width={22} height={420} fill={mixhex(k.sil, k.fog, .16)} />
          </Layer>
          <Layer d={1.35} blend="screen" blur={0}>
            <Moonbeam x={win.x + 40} y={win.y + win.h} w={win.w - 80} h={0} dx={-300} floorY={floor} color={k.glow} opacity={.2} />
            <Motes t={c.t} x0={win.x - 260} y0={win.y + 200} x1={win.x + win.w} y1={floor} n={34} color={k.moon} size={2} opacity={.5} />
          </Layer>
          <Layer d={1}>
            <BedFront x0={660} x1={1720} top={top} floor={floor + 40} color={mixhex(k.sil, k.fog, .08)} blanket={mixhex(k.sil, k.fog, .16)} edge={k.rim} />
            <Kid pose={p} sil={k.sil} rim={{ dx: .55, dy: -.8, color: k.rim, width: .012, glow: .6 }} phoneColor={k.cold} />
          </Layer>
          <Layer d={1} blend="screen" blur={0}>
            <Glow x={skeleton(p).haN.x - 20} y={skeleton(p).haN.y - 10} r={260} color={k.cold} opacity={.13 * fl} />
          </Layer>
          <Layer d={.6}>
            {/* 전경: 책상 모서리와 꺼진 스탠드(흐리게) */}
            <rect x={-300} y={800} width={760} height={34} fill={k.sil} />
            <rect x={-300} y={834} width={700} height={400} fill={k.sil} />
            <path d="M250,800L262,560L380,480" stroke={k.sil} strokeWidth={16} fill="none" strokeLinecap="round" />
            <path d="M330,470L470,430L452,560Z" fill={k.sil} />
            <ellipse cx={250} cy={800} rx={70} ry={14} fill={k.sil} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 3. ECU 두 손의 폰과 차갑게 빛나는 얼굴. 엄지가 박(11)에 크게 쓸어 올린다. 화면 내용이 바뀔 때마다 얼굴 빛이 바뀐다.
    //    폰 화면 사각형은 4번 유리창 사각형과 같은 자리(매치컷)
    id: "a1-screen", start: T3, key: "lonely", enter: { type: "cut" },
    render: (c) => {
      const k = LK, lt = c.lt;
      const flicks: [number, number][] = [[.2, 230], [beat(11) - T3, 520], [beat(11.5) - T3 + .02, 260]];
      const scroll = flicks.reduce((s, [f, d]) => s + ease("expoOut", (lt - f) / .5) * d, 0);
      const thumbY = flicks.reduce((s, [f, d]) => s - Math.sin(clamp((lt - f + .1) / .32) * Math.PI) * d * .32, 0);
      const content = .82 + .18 * Math.sin(scroll * .013) * Math.cos(scroll * .007);
      const fl = content * (.94 + .06 * Math.sin(c.t * 31) * Math.sin(c.t * 7));
      const hh = handheld(c.t, 6, 3);
      const cam: Cam = { x: 960 + hh.x, y: 540 + hh.y, zoom: kf(lt, [[0, 1.0], [c.dur, 1.07, "sineIO"]]), rot: hh.r, focus: 1, dof: 8 };
      const ph = { x: 1220, y: 760, w: 340, h: 620, rot: 9 };
      const base = pose({ anchor: "center", x: 381, y: 1348, s: 2400, facing: 1, lean: .1, bend: .2, headTilt: .5, faceDir: .7, face: .95 * fl, faceColor: mixc(k.cold, "#ffffff", .15), eyes: .72, armF: [.3, 1.2], armN: [.3, 1.2] });
      const p = ikArm(base, 0, ph.x - ph.w * .5 + 30, ph.y + 120);
      const sk = skeleton(p);
      // 눈(rig의 얼굴 계산을 따라간다): 화면이 눈동자에 비친다
      const ht = p.lean! + p.bend! + p.headTilt! * .6;
      const fd = .7, s = 2400;
      const fcx = sk.head.x + Math.cos(ht) * mix(.085, .01, fd) * s + Math.sin(ht) * -.012 * s;
      const fcy = sk.head.y + Math.sin(ht) * mix(.085, .01, fd) * s - Math.cos(ht) * -.012 * s;
      const eyes = [-.04, .04].map((ex) => ({ x: fcx + ex * s, y: fcy - .005 * s }));
      return (
        <Scene cam={cam}>
          <Layer d={4}>
            <rect x={-500} y={-500} width={3000} height={2200} fill={mixhex(k.sil, k.fog, .2)} />
            {/* 등 뒤 창(흐린 차가운 사각형): 후드 윗선이 이 빛에 걸린다 */}
            <rect x={-120} y={-260} width={1050} height={620} rx={30} fill={k.glow} opacity={.45} />
            <rect x={340} y={-260} width={30} height={620} fill={mixhex(k.sil, k.fog, .2)} />
            <Glow x={420} y={60} r={700} color={k.glow} opacity={.35} />
          </Layer>
          <Layer d={1}>
            <Kid pose={p} sil={k.sil} rim={{ dx: -.5, dy: -.85, color: k.rim, width: .006, glow: .8 }} />
            {eyes.map((e, i) => (
              <g key={i} opacity={.85 * fl}>
                <rect x={e.x + 4} y={e.y - 22 + ((scroll * .05) % 10)} width={16} height={24} rx={3} fill={k.cold} opacity={.75} />
                <circle cx={e.x - 10} cy={e.y - 22} r={6} fill="#ffffff" />
              </g>
            ))}
          </Layer>
          <Layer d={1} blend="screen">
            <Glow x={ph.x - 120} y={ph.y - 200} r={700} color={k.cold} opacity={.22 * fl} />
          </Layer>
          <Layer d={.9}>
            <g transform={`translate(${ph.x} ${ph.y}) rotate(${ph.rot})`}>
              <rect x={-ph.w / 2 - 16} y={-ph.h / 2 - 16} width={ph.w + 32} height={ph.h + 32} rx={52} fill={k.sil} />
              <PhoneScreen w={ph.w} h={ph.h} scroll={scroll} color={k.cold} bright={.75 + .25 * fl} />
              {/* 엄지(아래에서 화면을 쓸어 올린다)와 오른손 손가락 */}
              <path d={`M${ph.w * .6},${ph.h * .62}C${ph.w * .38},${ph.h * .42 + thumbY} ${ph.w * .2},${ph.h * .2 + thumbY} ${ph.w * .12},${ph.h * .16 + thumbY}`} stroke={k.sil} strokeWidth={70} strokeLinecap="round" fill="none" />
              {[0, 1, 2].map((i) => <ellipse key={i} cx={ph.w * .56} cy={-ph.h * .05 + i * 92} rx={46} ry={40} fill={k.sil} />)}
              <path d={`M${-ph.w * .62},${ph.h * .7}C${-ph.w * .62},${ph.h * .3} ${-ph.w * .55},${ph.h * .1} ${-ph.w * .5},0L${-ph.w * .45},${ph.h * .7}Z`} fill={k.sil} />
            </g>
          </Layer>
          <Layer d={.5}>
            <Glow x={1700} y={1100} r={300} color={k.cold} opacity={.08} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 4. INS 유리창 가득. 창밖 나방이 박(12·13)과 반박(13.5)에 유리를 두드린다. 칠 때마다 고리가 퍼지고 금빛이 번져 남는다.
    //    유리에는 등 뒤 폰의 차가운 빛이 희미하게 비친다(금빛과 차가운 빛이 한 유리에)
    id: "a1-tap", start: T4, key: "lonely", enter: { type: "cut" },
    render: (c) => {
      const k = LK, lt = c.lt;
      const taps = [.04, beat(13) - T4, beat(13.5) - T4];
      const spots = [{ x: 1060, y: 540 }, { x: 1120, y: 470 }, { x: 1040, y: 500 }];
      // 유리에서 떨어진 거리 z(0 = 닿음): 두드림 사이를 포물선으로 튕긴다
      const zAt = (l: number) => {
        if (l < taps[0]) return (taps[0] - l) * 4;
        for (let i = 0; i < taps.length - 1; i++) if (l < taps[i + 1]) { const u = (l - taps[i]) / (taps[i + 1] - taps[i]); return 4 * u * (1 - u) * (i === 0 ? .75 : .4); }
        return ease("out", clamp((l - taps[2]) / .5)) * .55;
      };
      const posAt = (l: number) => {
        let i = 0;
        while (i < taps.length - 1 && l >= taps[i + 1]) i++;
        const a = spots[i], b = spots[Math.min(i + 1, spots.length - 1)];
        const u = i < taps.length - 1 ? smooth(taps[i], taps[i + 1], l) : 0;
        return { x: mix(a.x, b.x, u) + n2(3, l * 2) * 40 * zAt(l), y: mix(a.y, b.y, u) - zAt(l) * 120 + n2(4, l * 2) * 30 * zAt(l) };
      };
      const z = zAt(lt), q = posAt(lt);
      const shake = taps.reduce((s, tp, i) => s + wob(lt - tp, 55, 14) * (i === 1 ? 7 : 4), 0);
      const hh = handheld(c.t, 8, 2.5);
      const cam: Cam = { x: 960 + hh.x + shake, y: 540 + hh.y - shake * .6, zoom: kf(lt, [[0, 1.0], [c.dur, 1.05, "sineIO"]]), rot: hh.r, focus: 1, dof: 7 };
      const ms = 62 / (1 + z * 1.6);
      const flap = z < .04 ? .85 + .15 * Math.sin(c.t * 70) : .2 + .8 * Math.abs(Math.sin(c.t * 24));
      return (
        <Scene cam={cam}>
          <Layer d={7}>
            <SkyFill k={k} y0={-300} y1={900} glowY={800} glowR={900} glowOpacity={.6} />
            <Glow x={1500} y={150} r={260} color={k.moon} opacity={.55} />
            <Glow x={1500} y={150} r={70} color="#ffffff" opacity={.8} />
            {Array.from({ length: 46 }, (_, i) => (
              <circle key={i} cx={-200 + rnd(41, i) * 2400} cy={640 + rnd(42, i) * 600} r={8 + rnd(43, i) * 16} fill={rnd(44, i) > .85 ? k.cold : mixhex(k.win, k.fog, .3)} opacity={.25 + rnd(45, i) * .45} />
            ))}
            <rect x={-400} y={880} width={2800} height={600} fill={mixhex(k.silFar, k.fog, .4)} opacity={.6} />
          </Layer>
          <Layer d={1.04} blur={z * 9}>
            <BigMoth x={q.x} y={q.y} s={ms} a={-Math.PI / 2 + n2(9, c.t * 1.5) * .25} flap={flap} color={GOLD} glow={1.1} />
          </Layer>
          <Layer d={1} blur={0}>
            {/* 유리: 먼지·얼룩, 두드린 자리의 금빛 번짐과 고리 */}
            <g fill="#cfe4ff" opacity={.16}>
              {Array.from({ length: 70 }, (_, i) => <circle key={i} cx={300 + rnd(51, i) * 1650} cy={110 + rnd(52, i) * 980} r={.8 + rnd(53, i) * 2.6} />)}
            </g>
            <path d="M380,1080L1240,90L1420,90L560,1080Z" fill="#ffffff" opacity={.035} />
            {taps.map((tp, i) => <Smear key={"s" + i} x={spots[i].x} y={spots[i].y} t={lt} t0={tp} r={i === 1 ? 170 : 120} color={GOLD} life={2.4} />)}
            {taps.map((tp, i) => <Ripple key={"r" + i} x={spots[i].x} y={spots[i].y} t={lt} t0={tp} r={i === 1 ? 420 : 260} color={mixc(GOLD, "#ffffff", .4)} width={i === 1 ? 6 : 4} />)}
          </Layer>
          <Layer d={1} blend="screen" blur={3}>
            {/* 등 뒤 폰의 차가운 반사 */}
            <rect x={540} y={760} width={120} height={210} rx={18} fill={k.cold} opacity={.16 * phoneFlicker(c.t, 9)} transform="rotate(-8 600 860)" />
            <Glow x={600} y={860} r={330} color={k.cold} opacity={.12} />
          </Layer>
          <Layer d={1} blur={0}>
            {/* 창살(왼쪽 세로, 위 가로)과 걸쇠 */}
            <rect x={230} y={-100} width={70} height={1300} fill={mixhex(k.sil, k.fog, .12)} />
            <rect x={-100} y={40} width={2200} height={56} fill={mixhex(k.sil, k.fog, .12)} />
            <rect x={296} y={-100} width={4} height={1300} fill={k.rim} opacity={.25} />
            <rect x={300} y={94} width={1700} height={3} fill={k.rim} opacity={.2} />
            <rect x={205} y={560} width={50} height={90} rx={8} fill={mixhex(k.sil, k.fog, .2)} />
          </Layer>
          <Layer d={.45}>
            <path d="M-200,-100C-40,200 -100,600 40,1200L-300,1200Z" fill={k.sil} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 5. OTS 뒤에서. 폰을 보던 아이가 박(15) 나방의 두드림에 고개를 들고, 박(16)에 폰을 내려놓고, 웅크렸다가 박(17)에 일어선다.
    //    초점이 폰(가까운 어깨)에서 창 밖 나방으로 넘어간다(랙 포커스)
    id: "a1-lookup", start: T5, key: "lonely", enter: { type: "cut" },
    render: (c) => {
      const k = LK, lt = c.lt;
      const b15 = beat(15) - T5, b16 = beat(16) - T5, b17 = beat(17) - T5;
      const floor = 1250;
      const sitLegs = { legN: [1.25, 1.35] as [number, number], legF: [1.05, 1.2] as [number, number] };
      const fl = phoneFlicker(c.t, 9);
      const body = seq(lt, [
        [0, { ...P.phone, ...sitLegs, lean: .12, bend: .24, headTilt: .45, armN: [.5, 1.4], armF: [.4, 1.5] }],
        [b15 - .06, { headTilt: .52 }, .08],
        [b15 + .04, { headTilt: -.18, bend: .08, lean: .04, armN: [.35, 1.2], armF: [.3, 1.3] }, .38, "back"],
        [b16, { armN: [.45, .55], armF: [.3, .5], headTilt: -.12 }, .35, "out"],
        [b16 + .38, { lean: .52, bend: .12, headTilt: .02, squash: .07, armN: [-.45, .6], armF: [-.55, .5] }, .3, "io"],
        [b17, { ...P.stand, lean: .06, bend: .02, headTilt: -.22, squash: -.04, armN: [.25, .4], armF: [-.15, .3] }, .38, "expoOut"],
        [b17 + .32, { lean: .14, armN: [1.05, .35], legN: [.32, .15], legF: [-.12, .2], squash: 0 }, .4, "out"],
      ]);
      const step = ease("out", lin(b17 + .32, b17 + .72, lt)) * 50;
      const phoneIn = lt < b16 + .12;
      const lookUp = smooth(b15, b15 + .4, lt);
      const p = pose({
        ...body, anchor: "feet", x: 470 + step, y: floor, s: 1050, facing: 1,
        phone: phoneIn ? fl : 0, face: phoneIn ? .85 * fl * (1 - lookUp * .75) : 0, faceColor: k.cold,
        swing: -.1 + wob(lt - b17, 10, 3.2) * -1.2 + wob(lt - b15, 9, 5) * .4,
      });
      const rise = ease("expoOut", lin(b17, b17 + .7, lt));
      const rack = ease("expoOut", lin(b15, b15 + .8, lt));
      const hh = handheld(c.t, 12, 4);
      const cam: Cam = { x: mix(940, 1000, ease("sineIO", c.p)) + hh.x, y: 540 - rise * 55 + hh.y, zoom: mix(1.0, 1.07, ease("sineIO", c.p)), rot: hh.r, focus: mix(1, 2, rack), dof: 7 };
      // 창밖 나방(유리 바로 바깥, d=2.1): 박마다 유리를 친다
      const taps = [b15, b16, b17];
      const near = taps.reduce((s, tp) => s + Math.exp(-Math.abs(lt - tp) * 9), 0);
      const mx = 1300 + n2(21, c.t * .8) * 60, my = 420 + n2(22, c.t * .8) * 40;
      const win = { x: 1000, y: 170, w: 560, h: 560 };
      return (
        <Scene cam={cam}>
          <Layer d={6}>
            <NightView k={k} t={c.t} moon={{ x: 1180, y: 280, r: 30 }} base={780} />
          </Layer>
          <Layer d={2.1} blend="screen">
            <Glow x={mx} y={my} r={150 + near * 60} color={GOLD} opacity={.45 + near * .3} />
            <BigMoth x={mx} y={my} s={17 * (1 + near * .12)} a={-Math.PI / 2 + n2(23, c.t) * .4} flap={.3 + .7 * Math.abs(Math.sin(c.t * 22))} color={GOLD} />
          </Layer>
          <Layer d={2}>
            <RoomWall k={k} t={c.t} {...win} floorY={1000} wind={.05} spill={mixc(k.glow, GOLD, .15 * near)} />
            {taps.map((tp, i) => <Smear key={i} x={mx} y={my} t={lt} t0={tp} r={80} color={GOLD} life={1.2} />)}
            {taps.map((tp, i) => <Ripple key={"r" + i} x={mx} y={my} t={lt} t0={tp} r={120} color={GOLD} width={3} rings={2} />)}
          </Layer>
          <Layer d={1}>
            <rect x={-300} y={floor - 207} width={1500} height={400} rx={24} fill={mixhex(k.sil, k.fog, .1)} />
            <rect x={-300} y={floor - 207} width={1500} height={3} fill={k.rim} opacity={.25} />
            {!phoneIn ? (
              <g>
                <rect x={760} y={floor - 214} width={90} height={14} rx={4} fill={k.cold} opacity={.85 * fl} />
                <Glow x={805} y={floor - 230} r={160} color={k.cold} opacity={.3 * fl} />
              </g>
            ) : null}
            <Kid pose={p} sil={k.sil} rim={{ dx: .9, dy: -.4, color: mixc(k.rim, GOLD, .25 * rack), width: .01, glow: .7 }} phoneColor={k.cold} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 6. WS (flash, 곡이 터지는 B(4)). 창짝이 튕겨 열리고 커튼이 부풀며 나방이 쏟아져 들어온다. 아이는 움찔 팔로 가렸다가
    //    박(19)에 두 팔을 벌린다. 방이 금빛으로 찬다(침대 위 폰만 차갑게 남는다)
    id: "a1-open", start: T6, key: "moths", enter: { type: "flash", color: "#fff1cf" },
    render: (c) => {
      const k = K.moths, lt = c.lt;
      const b19 = beat(19) - T6;
      const open = clamp(springStep(lt + .05, 13, .32), 0, 1.06);
      const gold = ease("out", lin(0, 1.1, lt));
      const wind = mix(1.1, .6, smooth(.5, 1.3, lt));
      const hh = handheld(c.t, 14, 6);
      const cam: Cam = { x: 980 + hh.x + wob(lt, 40, 9) * 16, y: 560 + hh.y + wob(lt, 34, 9) * 10, zoom: 1.0 + .07 * Math.exp(-lt * 4) + .05 * ease("sineIO", c.p), rot: hh.r + wob(lt, 28, 6) * .012, focus: 1, dof: 3 };
      const win = { x: 1180, y: 160, w: 480, h: 530 };
      const floor = 960;
      const body = seq(lt, [
        [0, { ...P.stand, lean: .02, headTilt: -.1, armN: [.5, .5], armF: [.2, .3] }],
        [0, { lean: -.24, bend: -.05, headTilt: .2, armN: [2.1, 1.75], armF: [1.7, 1.6], squash: .06 }, .16, "out"],
        [b19 - .06, { ...P.cheer, lean: -.14, bend: -.05, headTilt: -.42, armN: [2.25, .12], armF: [1.95, .2], squash: -.04, smile: 0 }, .42, "back"],
      ]);
      const p = pose({ ...body, x: 820 - ease("expoOut", lin(0, .4, lt)) * 40, y: floor, s: 440, facing: 1, swing: .5 + wob(lt, 9, 2.5) * 1.5 + wob(lt - b19, 9, 3) * .9 });
      const sk = skeleton(p);
      const cx = sk.neck.x + 20, cy = sk.neck.y + 40;
      // 나방: 창(바깥)에서 곡선을 그리며 들어와 아이 둘레를 돈다
      const pour = (t: number): M[] => {
        const l = t - T6;
        return Array.from({ length: 96 }, (_, i) => {
          const u = (l - rnd(61, i) * .85) * (1 + rnd(62, i) * .9);
          const phi = rnd(63, i) * Math.PI * 2, r = 170 + rnd(64, i) * 330;
          const E = { x: cx + Math.cos(phi) * r, y: cy + Math.sin(phi) * r * .5 };
          const P0 = { x: win.x + win.w * (.3 + rnd(65, i) * .5), y: win.y + win.h * (.25 + rnd(66, i) * .5) };
          const C = { x: mix(P0.x, E.x, .5) + (rnd(67, i) - .5) * 300, y: Math.min(P0.y, E.y) - 150 - rnd(68, i) * 250 };
          let x: number, y: number, a: number;
          if (u < 1) {
            const v = ease("out", clamp(u));
            x = (1 - v) * (1 - v) * P0.x + 2 * v * (1 - v) * C.x + v * v * E.x;
            y = (1 - v) * (1 - v) * P0.y + 2 * v * (1 - v) * C.y + v * v * E.y;
            a = Math.atan2(E.y - P0.y, E.x - P0.x);
          } else {
            const ang = phi + (u - 1) * (2.4 * 300 / r);
            x = cx + Math.cos(ang) * r; y = cy + Math.sin(ang) * r * .5 + n2(69, t + i) * 20;
            a = ang + Math.PI / 2;
          }
          return { x, y, s: 6 + rnd(70, i) * 6, a, f: t * 18 + i, b: u < 0 ? 0 : (.6 + .4 * rnd(71, i)) * smooth(0, .05, u) };
        });
      };
      const wall = mixhex(mixhex(k.sil, k.fog, .3), "#4a3418", .45 * gold);
      return (
        <Scene cam={cam}>
          <Layer d={5}>
            <NightView k={k} t={c.t} moon={{ x: 1500, y: 260, r: 30 }} base={760} />
          </Layer>
          <Layer d={1.6}>
            <RoomWall k={k} t={c.t} {...win} floorY={floor} open={open} wind={wind} wall={wall} spill={k.glow} spillA={.25 + .45 * gold} />
          </Layer>
          <Layer d={1.6} blend="screen" blur={0}>
            <Moonbeam x={win.x + 30} y={win.y + win.h} w={win.w - 60} h={0} dx={-380} floorY={floor} color={k.accent} opacity={.15 + .25 * gold} />
          </Layer>
          <Layer d={1.15}>
            <BedFront x0={-420} x1={520} top={800} floor={floor + 30} color={mixhex(k.sil, wall, .25)} blanket={mixhex(k.sil, wall, .4)} edge={k.rim} pillow="left" />
            <rect x={300} y={790} width={80} height={12} rx={4} fill={k.cold} opacity={.9} />
            <Glow x={340} y={780} r={150} color={k.cold} opacity={.35} />
          </Layer>
          <Layer d={1}>
            <ellipse cx={p.x} cy={floor + 6} rx={150} ry={14} fill={k.sil} opacity={.6} />
            <Kid pose={p} sil={k.sil} rim={{ dx: 1, dy: -.25, color: k.rim, width: .016, glow: .9 }} />
          </Layer>
          <Layer d={1} blend="screen" blur={0}>
            <Glow x={win.x + win.w / 2} y={win.y + win.h / 2} r={400 + 900 * gold} color={k.accent} opacity={.18 + .3 * gold} />
            <Moths t={c.t} at={pour} color={k.accent} trail={3} />
          </Layer>
          <Layer d={.5}>
            <Moths t={c.t} at={(t) => stream(73, 7, t, (u) => ({ x: mix(2100, -300, u), y: mix(300, 900, u) + Math.sin(u * 5) * 80 }), { speed: .55, spread: 160, size: 22 })} color={k.accent} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 7. CU 처음으로 금빛을 받은 얼굴. 나방 고리가 머리 둘레를 돈다(뒤쪽 나방은 머리에 가린다). 박(21)에 눈이 커지고, 반 박 뒤 웃는다
    id: "a1-swirl", start: T7, key: "moths", enter: { type: "cut" },
    render: (c) => {
      const k = K.moths, lt = c.lt;
      const b21 = beat(21) - T7;
      const hh = handheld(c.t, 16, 4);
      const pp = ease("sineIO", c.p);
      const cam: Cam = { x: 960 + hh.x + mix(-40, 30, pp), y: 540 + hh.y, zoom: mix(1.0, 1.09, pp), rot: hh.r + mix(-.03, .02, pp), focus: 1, dof: 9 };
      const wide = springStep(lt - b21, 15, .32);
      const smileOn = smooth(b21 + .38, b21 + .48, lt);
      const hx = 1010, hy = 560;
      const flick = .9 + .1 * Math.sin(c.t * 9) * Math.sin(c.t * 5.3);
      const p = atHead({
        s: 1750, facing: -1, faceDir: .62, lean: -.06, headTilt: mix(-.15, -.32, smooth(b21 - .1, b21 + .3, lt)),
        armN: [.2, .3], armF: [.1, .3],
        face: smooth(0, .25, lt) * flick, faceColor: mixc(k.accent, "#fff3d0", .4),
        eyes: mix(.85, 1.25, wide) * (1 - smileOn), mouth: smooth(b21, b21 + .1, lt) * (1 - smileOn) * .8, smile: smileOn,
        swing: .3 + Math.sin(c.t * 2.2) * .25,
      }, hx, hy);
      const ring = (front: boolean) => (t: number): M[] => {
        const l = t - T7;
        return Array.from({ length: 30 }, (_, i) => {
          const th = (i / 30) * Math.PI * 2 + l * (1.7 + rnd(81, i) * .5) + rnd(82, i) * .3;
          const r = 1 + rnd(83, i) * .35;
          const z = Math.sin(th);
          const x0 = Math.cos(th) * 560 * r, y0 = z * 150 * r + n2(84, l + i) * 30 - 40;
          const tilt = -.16;
          const vis = front ? smooth(-.12, .12, z) : 1 - smooth(-.12, .12, z);
          return { x: hx + x0 * Math.cos(tilt) - y0 * Math.sin(tilt), y: hy + x0 * Math.sin(tilt) + y0 * Math.cos(tilt), s: 8 + z * 4 + rnd(85, i) * 4, a: th + Math.PI / 2, f: t * 20 + i, b: vis * (.65 + .35 * rnd(86, i)) };
        });
      };
      return (
        <Scene cam={cam}>
          <Layer d={4}>
            <rect x={-800} y={-600} width={3600} height={2400} fill={mixhex(mixhex(k.sil, k.fog, .3), "#4a3418", .45)} />
            <rect x={-600} y={-300} width={900} height={1100} rx={30} fill={mixc(k.glow, "#ffffff", .2)} opacity={.8} />
            <Glow x={-150} y={250} r={1100} color={k.accent} opacity={.45} />
            {Array.from({ length: 14 }, (_, i) => <circle key={i} cx={rnd(87, i) * 2000} cy={rnd(88, i) * 1100} r={24 + rnd(89, i) * 40} fill={k.accent} opacity={.25 + rnd(90, i) * .35} />)}
          </Layer>
          <Layer d={1} blend="screen" blur={0}>
            <Moths t={c.t} at={ring(false)} color={k.accent} trail={4} />
          </Layer>
          <Layer d={1}>
            <Kid pose={p} sil={k.sil} rim={{ dx: -.85, dy: -.4, color: k.rim, width: .007, glow: .9 }} />
          </Layer>
          <Layer d={1} blend="screen" blur={0}>
            <Glow x={hx - 150} y={hy + 40} r={520} color={k.accent} opacity={.16 * flick} />
            <Moths t={c.t} at={ring(true)} color={k.accent} trail={4} />
          </Layer>
          <Layer d={.45}>
            <Moths t={c.t} at={(t) => stream(91, 4, t, (u) => ({ x: mix(-300, 2200, u), y: mix(980, 200, u) }), { speed: .6, spread: 200, size: 26 })} color={k.accent} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 8. WS 팔을 벌리고 도는 아이(박마다 반 바퀴, 박에 옆모습으로 멈췄다 다시 돈다·작은 뜀)와 소용돌이치는 나방.
    //    오른쪽 앞 침대 위 폰은 홀로 차갑다(박 24에 알림으로 한 번 밝아지지만 아무도 보지 않는다)
    id: "a1-spin", start: T8, key: "moths", enter: { type: "cut" },
    render: (c) => {
      const k = K.moths, lt = c.lt;
      const b = c.beat - 22;
      const fb = Math.floor(b), fr = b - fb;
      const th = Math.PI * (fb + ease("io", fr));
      const hop = Math.sin(Math.PI * fr) * (fb >= 0 ? 1 : 0);
      const floor = 900, kx = 860;
      const p = pose({
        ...P.stand, x: kx, y: floor, s: 400, facing: 1, lean: -.06, headTilt: -.3, lift: hop * .07,
        armN: [1.65 - hop * .25, .1], armF: [-1.45 + hop * .2, .1], legN: [.1 + hop * .25, .3 + hop * .5], legF: [-.05, .1 + hop * .3],
        swing: 1.2 + Math.abs(Math.sin(th)) * .6, face: .8, faceColor: mixc(k.accent, "#fff3d0", .4), smile: 1, faceDir: .5,
      });
      const sx = Math.cos(th);
      const sxs = Math.sign(sx || 1) * Math.max(.18, Math.abs(sx));
      const hh = handheld(c.t, 18, 5);
      const pp = ease("sineIO", c.p);
      const cam: Cam = { x: mix(920, 1000, pp) + hh.x, y: mix(560, 530, pp) + hh.y, zoom: mix(1.0, 1.1, pp), rot: hh.r + mix(.015, -.01, pp), focus: 1, dof: 3.5 };
      const vortex = (front: boolean) => (t: number): M[] => {
        const l = t - T8;
        return Array.from({ length: 120 }, (_, i) => {
          const h = rnd(101, i);
          const r = 170 + rnd(102, i) * 330;
          const ang = rnd(103, i) * Math.PI * 2 + l * 3.4 * (260 / r);
          const z = Math.sin(ang);
          const vis = front ? smooth(-.1, .1, z) : 1 - smooth(-.1, .1, z);
          return { x: kx + Math.cos(ang) * r, y: floor - 60 - h * 420 + z * r * .16 + Math.sin(l * 2 + i) * 14, s: 6 + z * 2.5 + rnd(104, i) * 4, a: ang + Math.PI / 2, f: t * 20 + i, b: vis * (.55 + .45 * rnd(105, i)) };
        });
      };
      const tNote = beat(24) - T8;
      const note = Math.exp(-Math.max(0, lt - tNote) * 2.2) * (lt > tNote ? 1 : 0);
      const wall = mixhex(mixhex(k.sil, k.fog, .3), "#4a3418", .45);
      return (
        <Scene cam={cam}>
          <Layer d={5}>
            <NightView k={k} t={c.t} moon={{ x: 300, y: 300, r: 28 }} base={760} />
          </Layer>
          <Layer d={1.7}>
            <RoomWall k={k} t={c.t} x={150} y={150} w={460} h={520} floorY={floor} open={1} wind={.55} wall={wall} spill={k.accent} spillA={.55} />
            <rect x={1300} y={260} width={260} height={200} fill={mixhex(k.sil, wall, .5)} />
            <rect x={1300} y={260} width={260} height={3} fill={k.rim} opacity={.3} />
          </Layer>
          <Layer d={1} blend="screen" blur={0}>
            <Glow x={kx} y={floor - 230} r={900} color={k.accent} opacity={.3} />
            <Glow x={kx} y={floor + 10} r={420} rx={520} ry={70} color={k.accent} opacity={.35} />
            <Moths t={c.t} at={vortex(false)} color={k.accent} trail={3} />
          </Layer>
          <Layer d={1}>
            <ellipse cx={kx} cy={floor + 4} rx={140 * (1 - hop * .3)} ry={12} fill={k.sil} opacity={.55} />
            <g transform={`translate(${kx} 0) scale(${sxs} 1) translate(${-kx} 0)`}>
              <Kid pose={p} sil={k.sil} rim={{ dx: -.8 * Math.sign(sxs), dy: -.5, color: k.rim, width: .014, glow: .9 }} />
            </g>
          </Layer>
          <Layer d={1} blend="screen" blur={0}>
            <Moths t={c.t} at={vortex(true)} color={k.accent} trail={3} />
          </Layer>
          <Layer d={.72}>
            <BedFront x0={1350} x1={2500} top={930} floor={1200} color={k.sil} blanket={mixhex(k.sil, wall, .3)} edge={k.rim} pillow="right" />
            <g transform="rotate(-6 1560 922)">
              <rect x={1500} y={912} width={120} height={18} rx={5} fill={k.cold} opacity={.85 + note * .15} />
            </g>
          </Layer>
          <Layer d={.72} blend="screen" blur={0}>
            <Glow x={1560} y={900} r={210 + note * 120} color={k.cold} opacity={.42 + note * .4} />
            <Ripple x={1560} y={915} t={lt} t0={tNote} r={160} color={k.cold} rings={2} width={3} squash={.35} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 9. ECU 든 손끝. 초점이 뒤(금빛 얼굴)에서 손끝으로 넘어오고, 나방 한 마리가 박(28)에 손끝에 앉는다.
    //    앉는 순간 작은 금빛이 터지고 손끝이 살짝 눌린다. 날개는 천천히 접혔다 편다
    id: "a1-finger", start: T9, key: "moths", enter: { type: "cut" },
    render: (c) => {
      const k = K.moths, lt = c.lt;
      const tl = beat(28) - T9;
      const tip = { x: 1130, y: 470 };
      const hs = 330;
      const dip = wob(lt - tl, 14, 5) * 14;
      const approach = (l: number) => {
        const u = ease("expoOut", clamp(l / tl) * .995);
        const w = 1 - u;
        return { x: mix(260, tip.x, u) + Math.sin(l * 7) * 120 * w, y: mix(140, tip.y + dip - hs * .04, u) + Math.cos(l * 9) * 80 * w - Math.sin(u * Math.PI) * 120 };
      };
      const landed = lt >= tl;
      const m = landed ? { x: tip.x, y: tip.y + dip - hs * .04 } : approach(lt);
      const flap = landed ? .55 + .45 * (.5 + .5 * Math.cos((lt - tl) * 3.2)) : .25 + .75 * Math.abs(Math.sin(c.t * 26));
      const rack = ease("io", lin(.15, 1.15, lt));
      const hh = handheld(c.t, 22, 3);
      const cam: Cam = { x: 960 + hh.x, y: 540 + hh.y, zoom: kf(lt, [[0, 1.0], [c.dur, 1.08, "sineIO"]]), rot: hh.r, focus: mix(2.6, 1, rack), dof: 10 };
      const lit = .35 + .65 * smooth(tl - .5, tl, lt);
      const kp = atHead({ s: 2000, facing: 1, faceDir: .7, headTilt: -.1, face: .85, faceColor: mixc(k.accent, "#fff3d0", .4), eyes: 1.15, smile: landed && lt > tl + .5 ? 1 : 0, mouth: landed && lt < tl + .5 ? .5 : 0 }, 520, 520);
      return (
        <Scene cam={cam}>
          <Layer d={6}>
            <rect x={-1000} y={-800} width={4000} height={2600} fill={mixhex(mixhex(k.sil, k.fog, .35), "#4a3418", .5)} />
            <Glow x={1500} y={300} r={900} color={k.accent} opacity={.5} />
            {Array.from({ length: 18 }, (_, i) => <circle key={i} cx={-200 + rnd(111, i) * 2400} cy={-100 + rnd(112, i) * 1300} r={20 + rnd(113, i) * 46} fill={k.accent} opacity={.2 + rnd(114, i) * .35} />)}
          </Layer>
          <Layer d={2.6}>
            <Kid pose={kp} sil={k.sil} rim={{ dx: .8, dy: -.5, color: k.rim, width: .006, glow: .8 }} />
          </Layer>
          <Layer d={1}>
            <Rimmed dx={.25} dy={-1} w={7} rim={mixc(k.rim, "#ffffff", .2 * lit)} sil={k.sil} glow={.8 * lit}>
              {(f) => fingerHand(tip.x, tip.y + dip, hs, f)}
            </Rimmed>
          </Layer>
          <Layer d={1} blend="screen" blur={0}>
            <Glow x={m.x} y={m.y} r={260} color={k.accent} opacity={.25 + .25 * lit} />
            {landed ? <Burst x={tip.x} y={tip.y} t={lt} t0={tl} dur={.8} r={190} n={22} color={k.accent} /> : null}
          </Layer>
          <Layer d={1} blur={0}>
            <BigMoth x={m.x} y={m.y} s={58} a={landed ? -Math.PI / 2 + Math.sin(lt * 1.3) * .05 : Math.atan2(tip.y - m.y, tip.x - m.x) * .5 - Math.PI / 2 * .5} flap={flap} color={k.accent} glow={.7} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 10. MS 밖에서 본 창. 나방들이 창밖으로 빠져나와 위로 오르고, 아이가 반 박 웅크렸다가 박(32)에 창틀로 뛰어올라
    //     박(33)에 일어선다: 금빛 방을 등지고 창에 액자처럼 걸린 실루엣. 고개가 나방을 따라 위로
    id: "a1-sill", start: T10, key: "moths", enter: { type: "cut" },
    render: (c) => {
      const k = K.moths, lt = c.lt;
      const b31h = beat(31.5) - T10, b32 = beat(32) - T10, b33 = beat(33) - T10;
      const win = { x: 770, y: 290, w: 400, h: 470 };
      const sillY = win.y + win.h;
      const inFloor = sillY + 150;
      const hop = ease("expoOut", lin(b32, b32 + .35, lt));
      const arc = Math.sin(clamp((lt - b32) / .3) * Math.PI) * 60;
      const kx = mix(1010, 950, hop);
      const ky = mix(inFloor, sillY, hop) - arc;
      const body = seq(lt, [
        [0, { ...P.stand, lean: .08, headTilt: -.45, armN: [.95, .3], armF: [.8, .35] }],
        [b31h, { ...P.crouch, headTilt: -.2 }, .3, "out"],
        [b32, { ...P.leap, headTilt: -.3 }, .14, "out"],
        [b32 + .2, { ...P.crouch, lean: .35, headTilt: -.1, squash: .12 }, .16, "out"],
        [b33, { ...P.stand, lean: -.06, headTilt: -.62, squash: -.03, armN: [.2, .4], armF: [2.5, .25] }, .45, "back"],
      ]);
      const onSill = lt > b32 + .12;
      const p = pose({ ...body, x: kx, y: ky, s: 360, facing: 1, swing: .2 + wob(lt - b32, 10, 3) * 1.4 + wob(lt - b33, 9, 3) * .8 });
      const pp = ease("sineIO", c.p);
      const tilt = ease("io", lin(b33, c.dur + .3, lt));
      const hh = handheld(c.t, 24, 5);
      const cam: Cam = { x: 960 + hh.x, y: 560 - tilt * 70 + hh.y, zoom: mix(1.0, 1.07, pp), rot: hh.r, focus: 1, dof: 3 };
      const wall = mixhex(k.silFar, k.fog, .22);
      const fl = phoneFlicker(c.t, 31);
      const out = (t: number): M[] => stream(121, 60, t, (u) => ({ x: mix(win.x + 200, 1700, Math.pow(u, 1.3)) + Math.sin(u * 7 + t) * 50, y: mix(win.y + 260, -260, u) }), { speed: .5, spread: 110, size: 8 });
      const kid = <Kid pose={p} sil={k.sil} rim={{ dx: -.6, dy: -.75, color: k.rim, width: .014, glow: .9 }} />;
      return (
        <Scene cam={cam}>
          <Layer d={1.6}>
            {/* 방 안(뒤 벽이 금빛으로 찼다) */}
            <rect x={-200} y={-200} width={2400} height={1600} fill={mixhex(k.accent, "#8a4a20", .45)} />
            <Glow x={960} y={480} r={600} color="#fff1cf" opacity={.8} />
            <rect x={560} y={760} width={500} height={120} fill={mixhex("#8a4a20", k.sil, .55)} />
            <rect x={1180} y={360} width={140} height={110} fill={mixhex("#8a4a20", k.sil, .3)} />
          </Layer>
          {onSill ? null : <Layer d={1}>{kid}</Layer>}
          <Layer d={1}>
            <path d={`M-1000,-1000H3000V2200H-1000Z M${win.x},${win.y}V${win.y + win.h}H${win.x + win.w}V${win.y}Z`} fill={wall} fillRule="evenodd" />
            <Glow x={win.x + win.w / 2} y={win.y + win.h / 2} r={700} color={k.accent} opacity={.28} />
            {/* 이웃 창들: 어둡거나, 폰 빛으로 차갑다 */}
            {[[200, 290], [1560, 290], [200, -380], [770, -380], [1560, -380], [200, 960], [1560, 960]].map(([x, y], i) => (
              <g key={i}>
                <rect x={x - 12} y={y - 12} width={win.w + 24} height={win.h + 24} fill={mixhex(wall, k.sil, .4)} />
                <rect x={x} y={y} width={win.w} height={win.h} fill={mixhex(k.sil, k.silFar, .6)} />
                {i === 1 ? <><rect x={x} y={y} width={win.w} height={win.h} fill={k.cold} opacity={.22 * fl} /><Glow x={x + 260} y={y + 340} r={160} color={k.cold} opacity={.5 * fl} /></> : null}
                <rect x={x - 30} y={y + win.h + 10} width={win.w + 60} height={20} fill={mixhex(wall, k.sil, .5)} />
              </g>
            ))}
            <WindowFrameOpen x={win.x} y={win.y} w={win.w} h={win.h} color={mixhex(wall, k.sil, .55)} t={c.t} k={k} />
            <rect x={win.x - 40} y={sillY + 4} width={win.w + 80} height={24} fill={mixhex(wall, k.sil, .55)} />
            <rect x={win.x - 40} y={sillY + 4} width={win.w + 80} height={3} fill={k.accent} opacity={.5} />
            {/* 배수관(다음 컷에서 탄다) */}
            <rect x={1300} y={-1000} width={22} height={3200} fill={mixhex(wall, k.sil, .6)} />
            {[-300, 100, 500, 900].map((y) => <rect key={y} x={1292} y={y} width={38} height={12} fill={mixhex(wall, k.sil, .7)} />)}
          </Layer>
          {onSill ? <Layer d={1}>{kid}</Layer> : null}
          <Layer d={.95} blend="screen" blur={0}>
            <Moths t={c.t} at={out} color={k.accent} trail={3} />
          </Layer>
          <Layer d={.45}>
            <path d="M-400,120Q700,330 2400,60" stroke={k.sil} strokeWidth={9} fill="none" />
            <Moths t={c.t} at={(t) => stream(131, 4, t, (u) => ({ x: mix(600, 2400, u), y: mix(700, -200, u) }), { speed: .7, spread: 250, size: 24 })} color={k.accent} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 11. WS 긴 테이크(2마디). 배수관을 타고 지붕으로. 박마다 한 손이 위 고리를 잡고(손은 관에 붙어 있다) 몸을 끌어올린다.
    //     카메라가 한 템포 늦게 따라 오르고, 지나가는 창 몇 개는 폰 빛으로 차갑다. 오른쪽 골목 너머로 밝은 하늘이 열린다.
    //     박(41)에 난간을 넘고 박(42)에 지붕에 선다
    id: "a1-climb", start: T11, key: "roof", enter: { type: "cut" },
    render: (c) => {
      const k = K.roof, lt = c.lt;
      const s = 340, step = 94, pipeX = 1000, Y0 = 860;
      const bt = c.beat - 34;
      const nPull = 7;
      const j = Math.floor(clamp(bt, 0, nPull - .001)), fr = clamp(bt, 0, nPull) - j;
      const pullE = (f: number) => ease("expoOut", lin(.28, .8, f));
      const rise = bt >= nPull ? nPull : j + pullE(fr);
      const topY = Y0 - nPull * step - s * .52;
      // 난간 넘기(박 41 → 42)
      const over = ease("io", lin(nPull, nPull + .9, bt));
      const pelY = Y0 - rise * step - over * s * .55;
      const kx = pipeX - s * .16 + over * s * .5;
      const phase = rise;
      const base = lerpPose({ ...climb(phase), lean: .1 }, { ...P.crouch, lean: .4, headTilt: -.2 }, smooth(.0, .5, over));
      let p: Partial<Pose> = { ...base, anchor: "center", x: kx, y: pelY, s, facing: 1, swing: .1 + wob(fr - .28, 9, 3) * .6 };
      if (over < .01) {
        // 손: 관의 고리(grip)에 붙는다. 이번 박에 움직이는 손은 다음 고리로 뻗는다
        const grip = (n: number) => Y0 - s * .44 - n * step;
        const reach = ease("out", lin(0, .32, fr));
        const hMove = j % 2, hHold = 1 - hMove;
        const yMove = mix(grip(j - 1), grip(j + 1), reach) - Math.sin(reach * Math.PI) * 30;
        const yHold = grip(j);
        const hand = (h: number) => (h === hMove ? yMove : yHold);
        p = ikArm(ikArm(p, 0, pipeX - 4, hand(0)), 1, pipeX + 6, hand(1));
      } else {
        p = ikArm(ikArm(p, 0, pipeX + s * .35, topY + 4), 1, pipeX + s * .45, topY + 4);
      }
      const camRise = ease("sineIO", clamp(lt / (c.dur - .2)));
      const hh = handheld(c.t, 26, 5);
      const cam: Cam = { x: 900 + hh.x + camRise * 40, y: mix(560, topY + 140, camRise) + hh.y, zoom: 1, rot: hh.r, focus: 1, dof: 2.2 };
      const wall = mixhex(k.silFar, k.sil, .25);
      const fl = phoneFlicker(c.t, 41);
      const lonely = new Set(["1,0", "0,2", "1,3"]);
      return (
        <Scene cam={cam}>
          <Layer d={Infinity} blur={0}>
            <SkyFill k={k} y0={-300} y1={900} glowY={800} glowR={1200} glowOpacity={.7} />
            <Stars seed={7} t={c.t} count={80} y1={400} alpha={.5} />
          </Layer>
          <Layer d={8} blur={.8}>
            <Skyline seed={51} base={760} minH={120} maxH={420} minW={60} maxW={150} x0={900} x1={3400} color={mixhex(k.fog, k.sky[3], .3)} t={c.t} details={false} win={{ density: .14, size: .5, warm: k.win, cold: k.cold, coldRatio: .1 }} />
          </Layer>
          <Layer d={2.6}>
            <rect x={1500} y={-900} width={900} height={3000} fill={mixhex(k.silFar, k.fog, .25)} />
            {Array.from({ length: 9 }, (_, r) => Array.from({ length: 3 }, (_, cI) => (
              <rect key={`${r}-${cI}`} x={1580 + cI * 260} y={-820 + r * 280} width={130} height={160} fill={rnd(55, r * 3 + cI) > .7 ? mixhex(k.win, k.fog, .2) : mixhex(k.sil, k.silFar, .6)} opacity={.9} />
            )))}
          </Layer>
          <Layer d={1}>
            <rect x={-1400} y={topY} width={1420 + pipeX - 980 + 260} height={3000} fill={wall} />
            <FogBand y0={topY + 600} y1={topY - 100} color={mixhex(wall, k.fog, .35)} opacity={.0} fill={false} />
            <rect x={-1400} y={topY - 34} width={2700} height={36} fill={k.sil} />
            {/* 창 격자: 지나가는 몇 개는 폰 빛 */}
            {Array.from({ length: 5 }, (_, r) => Array.from({ length: 3 }, (_, cI) => {
              const x = -260 + cI * 360, y = topY + 140 + r * 330;
              const on = lonely.has(`${cI},${r}`);
              return (
                <g key={`${r}-${cI}`}>
                  <rect x={x - 12} y={y - 12} width={194} height={234} fill={mixhex(wall, k.sil, .45)} />
                  <rect x={x} y={y} width={170} height={210} fill={mixhex(k.sil, k.silFar, .55)} />
                  {on ? (
                    <g>
                      <rect x={x} y={y} width={170} height={210} fill={k.cold} opacity={.16 * fl} />
                      <Kid pose={pose({ ...P.sitEdge, ...P.phone, anchor: "seat", x: x + 85 + (r % 2 ? 20 : -20), y: y + 200, s: 120, facing: r % 2 ? -1 : 1, phone: fl, face: .8 * fl, faceColor: k.cold })} sil={k.sil} phoneColor={k.cold} />
                      <Glow x={x + 85} y={y + 150} r={110} color={k.cold} opacity={.35 * fl} />
                    </g>
                  ) : null}
                  <rect x={x - 24} y={y + 214} width={218} height={16} fill={mixhex(wall, k.sil, .5)} />
                </g>
              );
            }))}
            {/* 배수관과 고리 */}
            <rect x={pipeX - 11} y={topY - 20} width={22} height={2600} fill={mixhex(wall, k.sil, .7)} />
            {Array.from({ length: 12 }, (_, n) => <rect key={n} x={pipeX - 17} y={Y0 - s * .44 - n * step - 6} width={34} height={10} fill={mixhex(wall, k.sil, .85)} />)}
            <rect x={pipeX + 11} y={topY - 20} width={3} height={2600} fill={k.rim} opacity={.18} />
          </Layer>
          <Layer d={1} blur={0}>
            <Kid pose={p} sil={k.sil} rim={{ dx: .75, dy: -.65, color: k.rim, width: .016, glow: .8 }} />
          </Layer>
          <Layer d={1} blend="screen" blur={0}>
            <Moths t={c.t} at={(t) => stream(141, 18, t, (u) => ({ x: pipeX + 80 + Math.sin(u * 8 + t * 2) * 90, y: pelY - 120 - u * 700 }), { speed: .35, spread: 60, size: 7 })} color={k.accent} trail={4} />
            <Glow x={pipeX} y={pelY - 300} r={260} color={k.accent} opacity={.18} />
          </Layer>
          <Layer d={.5}>
            {/* 전경: 실외기와 전선(카메라가 오르면 빠르게 아래로 지나간다) */}
            <path d={`M-300,${topY + 1200}Q600,${topY + 1500} 2200,${topY + 1080}`} stroke={k.sil} strokeWidth={10} fill="none" />
            <rect x={-260} y={topY + 380} width={360} height={240} rx={10} fill={k.sil} />
            <rect x={1500} y={topY + 900} width={340} height={230} rx={10} fill={k.sil} />
            <path d={`M-300,${topY - 200}Q700,${topY + 40} 2300,${topY - 300}`} stroke={k.sil} strokeWidth={8} fill="none" />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 12. EWS 밝은 블루아워 지평선 앞 지붕 실루엣과 작은 아이(난간을 넘어 막 선 자리). 빨랫줄이 펄럭이고 안테나 불빛이 깜빡인다.
    //     카메라는 옆으로 천천히 미끄러지고, 아이가 박(44)부터 걷기 시작한다. 금빛 점들이 앞장선다
    id: "a1-roofwide", start: T12, key: "roof", enter: { type: "cut" },
    render: (c) => {
      const k = K.roof, lt = c.lt;
      const roofY = 860;
      const tw = beat(44) - T12;
      const s = 92;
      const wd = Math.max(0, lt - tw);
      const dist = wd < .4 ? .5 * (s * STRIDE.walk * 1.4 / .4) * wd * wd : s * STRIDE.walk * 1.4 * (.2 + (wd - .4));
      const g = gait(dist / (s * STRIDE.walk), smooth(tw, tw + .4, lt));
      const kx = 330 + dist;
      const p = pose({ ...P.stand, ...g, x: kx, y: roofY - 34, s, facing: 1, headTilt: lt < tw ? -.25 : -.05, swing: .3 });
      const pp = ease("sineIO", c.p);
      const hh = handheld(c.t, 31, 3);
      const cam: Cam = { x: mix(900, 1010, pp) + hh.x, y: 540 + hh.y, zoom: mix(1.0, 1.035, pp), rot: hh.r, focus: 1, dof: .3 };
      return (
        <Scene cam={cam}>
          <SkyBackdrop k={k} t={c.t} moon={null} stars={.6} horizon={roofY + 60} />
          <Layer d={Infinity} blur={0} blend="screen">
            <Glow x={1750} y={-250} r={700} color={k.moon} opacity={.22} />
          </Layer>
          <CityLayers k={k} t={c.t} base={roofY - 40} seed={9} />
          <Layer d={1}>
            <Parapet x0={-600} x1={2700} y={roofY} h={26} color={k.sil} />
            <rect x={1680} y={roofY - 175} width={250} height={150} fill={k.sil} />
            <rect x={1660} y={roofY - 190} width={290} height={18} fill={k.sil} />
            <WaterTank x={1240} y={roofY - 26} s={130} color={k.sil} />
            <Antenna x={720} y={roofY - 26} h={300} color={k.sil} t={c.t} seed={5} light="#ff6a5a" />
            <Laundry x0={820} y0={roofY - 170} x1={1170} y1={roofY - 150} sag={18} color={k.sil} t={c.t} wind={1.1} items={5} seed={6} />
            <Laundry x0={1300} y0={roofY - 200} x1={1660} y1={roofY - 165} sag={16} color={k.sil} t={c.t} wind={1.1} items={4} seed={8} />
            <Kid pose={p} sil={k.sil} rim={{ dx: .3, dy: -.95, color: k.rim, width: .03, glow: .6 }} />
          </Layer>
          <Layer d={1} blend="screen" blur={0}>
            <Moths t={c.t} at={(t) => swarm(151, 9, t, { cx: kx + 160 + (t - c.t) * 20, cy: roofY - 150, rx: 90, ry: 50, size: 3.2, speed: .5 })} color={k.accent} trail={3} />
          </Layer>
          <Layer d={.55} blur={4}>
            <Antenna x={-60} y={1240} h={760} color={k.sil} t={c.t} seed={11} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 13. MS 옆 트래킹 걸음(박마다 한 발). 전경의 빨래·안테나가 흐리게 휙 지나가고 나방 무리가 앞장선다. 아이는 나방을 올려다본다
    id: "a1-walk", start: T13, key: "roof", enter: { type: "cut" },
    render: (c) => {
      const k = K.roof, lt = c.lt;
      const roofY = 930, s = 520;
      const phase = (c.beat - 46) / 2 + .25;
      const dist = phase * s * STRIDE.walk;
      const kx = 260 + dist;
      const look = smooth(.6, 1.1, lt) - smooth(2.0, 2.4, lt) * .6;
      const p = pose({ ...P.stand, ...gait(phase, 1), x: kx, y: roofY, s, facing: 1, headTilt: -.05 - look * .35, swing: .35 + Math.sin(phase * Math.PI * 4) * .12, face: look * .35, faceColor: mixc(k.accent, k.moon, .5), faceDir: .2 });
      const hh = handheld(c.t, 33, 4);
      const cam: Cam = { x: kx + 140 + hh.x, y: 540 + hh.y, zoom: 1, rot: hh.r, focus: 1, dof: .3 };
      const lead = { x: kx + 420, y: roofY - s * .95 };
      return (
        <Scene cam={cam}>
          <RoofSet k={k} t={c.t} moon={null} roofY={roofY} x0={-2000} x1={4200} props={false} stars={.6} />
          <Layer d={1}>
            <WaterTank x={-200} y={roofY - 34} s={190} color={k.sil} />
            <rect x={1500} y={roofY - 110} width={170} height={78} rx={6} fill={k.sil} />
            <rect x={1560} y={roofY - 160} width={30} height={60} fill={k.sil} />
            <Antenna x={2300} y={roofY - 34} h={360} color={k.sil} t={c.t} seed={4} light="#ff6a5a" />
            <Kid pose={p} sil={k.sil} rim={{ dx: .55, dy: -.85, color: k.rim, width: .013, glow: .7 }} />
          </Layer>
          <Layer d={1.15} blend="screen" blur={0}>
            <Moths t={c.t} at={(t) => swarm(161, 14, t, { cx: lead.x + (t - c.t) * 95, cy: lead.y, rx: 150, ry: 90, size: 7, speed: .45 })} color={k.accent} trail={4} />
          </Layer>
          <Layer d={.42} blur={7}>
            {/* 전경 빨랫줄(큰 홑이불)과 안테나: 카메라보다 빨리 지나간다 */}
            <path d="M-200,40Q800,170 1800,60" stroke={k.sil} strokeWidth={6} fill="none" />
            {[[240, 300], [700, 380], [1250, 260]].map(([x, w], i) => {
              const sw = n2(170 + i, c.t * .9) * 40 + 30;
              return <path key={i} d={`M${x},${80 + i * 12}L${x + w},${92 + i * 10}L${x + w + sw},${560 + i * 40}Q${x + w / 2 + sw},${520 + i * 30} ${x + sw * .8},${590 + i * 40}Z`} fill={k.sil} />;
            })}
            <rect x={2300} y={-200} width={34} height={1500} fill={k.sil} />
            <rect x={2180} y={180} width={270} height={14} fill={k.sil} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 14. 낮은 각도, 뒤에서. 아이가 박(51)에 마지막 걸음을 딛고 멈춘다. 박(52)에 나방 무리가 위로 솟고 고개가 반 박 늦게 따라 든다
    //     (후드 꼬리가 튕긴다). 끝에서 카메라가 위로 들리며 다음 컷(달)으로 녹아든다
    id: "a1-stop", start: T14, key: "roof", enter: { type: "cut" },
    render: (c) => {
      const k = K.roof, lt = c.lt;
      const b51 = beat(51) - T14, b52 = beat(52) - T14;
      const s = 860, floor = 1060;
      const phase = Math.min(.25 + (c.beat - 50) / 2, .75) + ease("out", lin(b51, b51 + .4, lt)) * .08;
      const g = 1 - smooth(b51 - .05, b51 + .4, lt);
      const dist = phase * s * STRIDE.walk;
      const kx = 360 + dist;
      const look = ease("back", lin(b52 + .12, b52 + .62, lt));
      const p = pose({
        ...P.stand, ...gait(phase, g), x: kx, y: floor, s, facing: 1,
        headTilt: mix(-.08, -.95, look), lean: mix(.03, -.12, look), armN: [mix(.15, .35, look), .3], armF: [mix(-.1, -.3, look), .3],
        swing: .25 + wob(lt - b51, 9, 3) * .8 + wob(lt - b52 - .12, 10, 2.6) * 1.5,
      });
      const tilt = ease("io", lin(b52 + .5, c.dur + .4, lt));
      const hh = handheld(c.t, 35, 4);
      const cam: Cam = { x: 980 + hh.x + (1 - ease("expoOut", lin(0, b51 + .4, lt))) * -60, y: 560 - tilt * 200 + hh.y, zoom: 1, rot: hh.r - .012, focus: 1, dof: .3 };
      const lift = (t: number): M[] => {
        const l = t - T14;
        const u = ease("expoIn", lin(b52 - .05, b52 + 1.1, l));
        return Array.from({ length: 40 }, (_, i) => {
          const d = rnd(181, i) * .25;
          const uu = clamp(u * 1.25 - d);
          const ox = n2(182, l * .7 + i) * 170, oy = n2(183, l * .7 + i) * 90;
          return { x: 1350 + ox + uu * (rnd(184, i) - .3) * 500, y: 520 + oy - uu * 1500, s: 7 + rnd(185, i) * 6, a: -Math.PI / 2 + n2(186, l + i) * .5, f: t * 20 + i, b: .6 + .4 * rnd(187, i) };
        });
      };
      const glowUp = smooth(b52, c.dur, lt);
      return (
        <Scene cam={cam}>
          <SkyBackdrop k={k} t={c.t} moon={null} stars={.8} horizon={960} />
          <Layer d={Infinity} blur={0} blend="screen">
            <Glow x={1300} y={-300} r={900} color={k.moon} opacity={.15 + glowUp * .3} />
          </Layer>
          <CityLayers k={k} t={c.t} base={900} seed={12} />
          <Layer d={1}>
            <rect x={-600} y={floor - 4} width={3200} height={800} fill={k.sil} />
            <Parapet x0={1500} x1={2600} y={floor - 40} h={60} color={k.sil} />
            <Kid pose={p} sil={k.sil} rim={{ dx: .6, dy: -.8, color: k.rim, width: .011, glow: .8 }} />
          </Layer>
          <Layer d={1} blend="screen" blur={0}>
            <Moths t={c.t} at={lift} color={k.accent} trail={5} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 15. (cross) 카메라가 위로 틸트해 거대한 달을 드러낸다. 나방의 빛 꼬리가 지붕의 작은 아이에게서 달로 오른다.
    //     모든 층이 거의 같이 움직인다(틸트). 구름 띠가 조금 더 빨리 지나가 깊이를 준다. 박(56)에 달이 숨을 쉰다
    id: "a1-moon", start: T15, key: "roof", enter: { type: "cross", dur: .7 },
    render: (c) => {
      const k = K.roof, lt = c.lt;
      const b56 = beat(56) - T15, b57 = beat(57) - T15;
      const camY = kf(lt, [[0, 600], [.25, 590, "in"], [2.15, -620, "io"], [c.dur, -650, "out"]]);
      const hh = handheld(c.t, 37, 3);
      const cam: Cam = { x: 960 + hh.x, y: camY + hh.y, zoom: kf(lt, [[0, 1.0], [c.dur, 1.06, "sineIO"]]), rot: hh.r, focus: 1, dof: .2 };
      const moon = { x: 1080, y: -520, r: 330 };
      const breathe = Math.exp(-Math.max(0, lt - b56) * 2.5) * (lt > b56 ? 1 : 0) + Math.exp(-Math.max(0, lt - b57) * 3) * (lt > b57 ? .6 : 0);
      const roofY = 980;
      const kp = pose({ ...P.stand, x: 700, y: roofY - 30, s: 120, facing: 1, headTilt: -.9, lean: -.1, swing: .4 });
      const up = (t: number): M[] => stream(191, 46, t, (u) => ({ x: mix(760, moon.x - 40, u) + Math.sin(u * 6 + t * 1.5) * 140 * (1 - u), y: mix(roofY - 120, moon.y + 120, Math.pow(u, .85)) }), { speed: .42, spread: 70, size: 7 });
      return (
        <Scene cam={cam}>
          <Layer d={1.2} blur={0}>
            <SkyFill k={k} y0={-1500} y1={1080} glowY={1000} glowR={1300} glowOpacity={.75} stops={[0, .5, .8, 1]} />
            <Stars seed={9} t={c.t} count={160} x0={-500} x1={2400} y0={-1700} y1={500} alpha={.8} />
          </Layer>
          <Layer d={1.25} blur={0}>
            <GodRays x={moon.x} y={moon.y} t={c.t} color={k.moon} opacity={.12 + breathe * .08} len={moon.r * 5} count={16} />
            <Moon x={moon.x} y={moon.y} r={moon.r} color={k.moon} glow={1 + breathe * .4} pulse={breathe} texture={1} />
          </Layer>
          <Layer d={1.1} blur={0}>
            <CloudBank seed={3} y={-120} x0={-500} x1={2500} size={560} dark={k.cloud} lit={k.cloudLit} t={c.t} drift={10} count={7} opacity={.55} />
            <Wisp x={600} y={-760} w={1600} h={40} color={k.cloudLit} opacity={.35} t={c.t} drift={12} />
          </Layer>
          <Layer d={1.06} blur={0}>
            <Skyline seed={61} base={roofY + 120} minH={100} maxH={330} minW={60} maxW={170} x0={-600} x1={2600} color={mixhex(k.fog, k.silFar, .5)} t={c.t} win={{ density: .14, size: .6, warm: k.win, cold: k.cold, coldRatio: .1 }} />
          </Layer>
          <Layer d={1} blur={0}>
            <Parapet x0={-400} x1={1500} y={roofY} h={26} color={k.sil} />
            <Antenna x={1250} y={roofY - 26} h={230} color={k.sil} t={c.t} seed={3} light="#ff6a5a" />
            <Kid pose={kp} sil={k.sil} rim={{ dx: .3, dy: -.95, color: k.rim, width: .03, glow: .6 }} />
          </Layer>
          <Layer d={1.15} blend="screen" blur={0}>
            <Moths t={c.t} at={up} color={k.accent} trail={5} trailDt={.05} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 16. CU 달빛(금빛)을 받은 얼굴. 박(59)에 눈이 커지고 입이 "o", 박(61)에 작은 미소. 눈동자에 달이 비친다.
    //     다음 컷(2막 a2-measure, 어깨 너머로 달을 집는다)으로 이어진다
    id: "a1-wonder", start: T16, key: "roof", enter: { type: "cut" },
    render: (c) => {
      const k = K.roof, lt = c.lt;
      const b59 = beat(59) - T16, b60 = beat(60) - T16, b61 = beat(61) - T16;
      const wide = springStep(lt - b59, 14, .35);
      const o = smooth(b59 + .05, b59 + .2, lt) * (1 - smooth(b61 - .2, b61, lt));
      const sm = smooth(b61 - .1, b61 + .15, lt);
      const pp = ease("sineIO", c.p);
      const hh = handheld(c.t, 39, 3.5);
      const cam: Cam = { x: 960 + hh.x + pp * 30, y: 540 + hh.y - pp * 20, zoom: mix(1.0, 1.1, pp), rot: hh.r, focus: 1, dof: 8 };
      const faceC = mixc(k.moon, k.accent, .35);
      const p = atHead({
        s: 1900, facing: 1, faceDir: .74, headTilt: -.55, lean: -.08,
        armN: [.1, .2], armF: [-.1, .2],
        face: .95, faceColor: faceC, eyes: mix(.9, 1.25, wide) * (1 - .12 * smooth(b60, b61, lt)), mouth: o * .9,
        swing: .5 + Math.sin(c.t * 1.7) * .25 + n2(193, c.t) * .1,
      }, 780, 600);
      const f = faceAt(p);
      const eyes = [-.04, .04].map((ex) => ({ x: f.x + ex * p.s, y: f.y - .005 * p.s }));
      const mouth = { x: f.x, y: f.y + .045 * p.s };
      return (
        <Scene cam={cam}>
          <Layer d={6}>
            <SkyFill k={k} y0={-400} y1={1500} glowY={1300} glowR={1200} glowOpacity={.6} />
            <Glow x={1750} y={-80} r={950} color={k.moon} opacity={.55} />
            <circle cx={1820} cy={-60} r={330} fill={k.moon} opacity={.9} />
            {Array.from({ length: 12 }, (_, i) => <circle key={i} cx={900 + rnd(201, i) * 1100} cy={rnd(202, i) * 900} r={14 + rnd(203, i) * 30} fill={k.accent} opacity={.2 + rnd(204, i) * .3} />)}
          </Layer>
          <Layer d={1}>
            <Kid pose={p} sil={k.sil} rim={{ dx: .75, dy: -.65, color: k.rim, width: .008, glow: 1 }} />
            {eyes.map((e, i) => <circle key={i} cx={e.x + .007 * p.s} cy={e.y - .011 * p.s * p.eyes} r={.0045 * p.s} fill="#fffaf0" opacity={.95} />)}
            {sm > .01 ? <path d={`M${mouth.x - .028 * p.s},${mouth.y - .006 * p.s}Q${mouth.x},${mouth.y + .016 * p.s} ${mouth.x + .028 * p.s},${mouth.y - .006 * p.s}`} stroke="#2a1418" strokeWidth={.008 * p.s} strokeLinecap="round" fill="none" opacity={sm} /> : null}
          </Layer>
          <Layer d={1} blend="screen" blur={0}>
            <Glow x={f.x + 140} y={f.y - 120} r={620} color={k.moon} opacity={.14} />
          </Layer>
          <Layer d={.5}>
            <Moths t={c.t} at={(t) => stream(205, 5, t, (u) => ({ x: mix(-200, 2200, u), y: mix(1000, 300, u) }), { speed: .25, spread: 220, size: 24 })} color={k.accent} />
          </Layer>
        </Scene>
      );
    },
  },
];
