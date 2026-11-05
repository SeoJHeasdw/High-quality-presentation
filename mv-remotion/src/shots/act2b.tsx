/**
 * 2막 뒤(0:55–1:19) — 나방 사다리와 브레이크.
 *   모여듦(아주 먼 와이드, 도시 창마다 나방 줄기) → 조립(클로즈업, 8분음마다 발판) → 오르기(낮은 각도, 한 박 한 칸)
 *   → 내려다봄(시점, 돌리 줌) → 휘청(미디엄, 나방이 밝아져 받쳐 줌) → 더 높이(와이드, 뒤로 빠짐)
 *   → 돌아봄(긴 테이크, 소리·색이 빠짐, 저 아래 자기 방 창 하나만 차갑다) → 폰을 끄고 넣음(클로즈업) → 위를 봄(달빛 화이트아웃)
 * 사다리(act2b-ladder.tsx)는 모든 컷에서 같은 금빛·같은 간격(아이 크기 대비)이다.
 */
import React from "react";
import { Layer, Scene, project, unproject, type Cam } from "../lib/camera";
import { K } from "../lib/palette";
import { B, beat, beatAt } from "../lib/song";
import { clamp, ease, handheld, kf, lin, mix, mixc, mixhex, n2, rnd, smooth, springStep } from "../lib/math";
import { CityLayers, SkyBackdrop } from "../lib/sets";
import { Glow, Moon, GodRays, Wisp, Stars, SkyFill } from "../lib/sky";
import { Antenna, Parapet, WaterTank, buildings } from "../lib/city";
import { Moths, type M } from "../lib/moths";
import { Kid, ikArm, skeleton } from "../kid/rig";
import { P, lerpPose, pose } from "../kid/pose";
import {
  CORE, GOLD, HALF, Ladder, MOON_DIR, MY_WIN, RUNG, S_M, WHITE, City3D, Ground3D, add3, bodySteps, climbPose, kidFrame3, ladder2d, ladder3, landFront, landGather, lookAt, p3, pDir, rayDir, rung3,
  type Cam3, type RF, type V2,
} from "./act2b-ladder";
import type { Shot } from "./types";

const k = K.hope;
const RIM = (dx: number, dy: number, w = .014, color: string = k.rim) => ({ dx, dy, color, width: w, glow: .7 });

/** 줄기: 경로 u(0..1)를 따라 흐르는 나방. 멀리서(작게) 가까이(크게). t0 이전에 태어난 나방은 없다(줄기가 '열린다') */
function flow(seed: number, n: number, t: number, path: (u: number, t: number) => V2, o: { speed?: number; spread?: number; size?: [number, number]; t0?: number; flap?: number }): M[] {
  const sp = o.speed ?? .35, spread = o.spread ?? 30, [s0, s1] = o.size ?? [3, 7];
  return Array.from({ length: n }, (_, i) => {
    const rate = sp * (.75 + rnd(seed, i + 77) * .5);
    const u = (((rnd(seed, i) + t * rate) % 1) + 1) % 1;
    const born = t - u / rate;
    const alive = o.t0 === undefined || born >= o.t0 ? 1 : 0;
    const p = path(u, t), p2 = path(Math.min(1, u + .01), t);
    const nx = -(p2.y - p.y), ny = p2.x - p.x, l = Math.hypot(nx, ny) || 1;
    const off = n2(seed + i, t * .7 + i) * spread * (1 - u * .7);
    const fade = Math.min(1, u * 10, (1 - u) * 6);
    return { x: p.x + (nx / l) * off, y: p.y + (ny / l) * off, s: mix(s0, s1, u) * (.7 + rnd(seed, i + 500) * .6), a: Math.atan2(p2.y - p.y, p2.x - p.x), f: t * (o.flap ?? 17) + i, b: alive * fade * (.6 + .4 * rnd(seed, i + 900)) };
  });
}
const bez = (a: V2, b: V2, c: V2, u: number): V2 => ({ x: mix(mix(a.x, b.x, u), mix(b.x, c.x, u), u), y: mix(mix(a.y, b.y, u), mix(b.y, c.y, u), u) });

/** CityLayers의 가운데(d=5)·가까운(d=2.2) 줄 건물에서 창 하나의 세계 좌표(그 층) */
function cityWindow(layer: "mid" | "near", base: number, seed: number, bi: number, r: number, c: number) {
  const L = layer === "mid"
    ? { seed: seed + 1, b: base + 330, minH: 180, maxH: 560, minW: 70, maxW: 170, x0: -1000, x1: 3000, size: .7 }
    : { seed: seed + 2, b: base + 420, minH: 200, maxH: 520, minW: 120, maxW: 260, x0: -800, x1: 2800, size: 1 };
  const bs = buildings(L.seed, L.x0, L.x1, L.minH, L.maxH, L.minW, L.maxW);
  const b = bs[Math.min(bs.length - 1, bi)];
  const top = L.b - b.h;
  const ws = 9 * L.size * clamp(b.w / 140, .6, 1.3);
  const cols = Math.max(2, Math.floor((b.w - ws) / (ws * 2.1)));
  const gx = (b.w - cols * ws) / (cols + 1), gy = ws * 1.6;
  const cc = Math.min(cols - 1, c);
  return { x: b.x + gx + cc * (ws + gx), y: top + ws * 1.2 + r * (ws + gy), w: ws, h: ws * 1.25, bx: b.x, bw: b.w, top };
}

/** 창 하나가 금빛으로 확 켜진다(나방 줄기가 쏟아지는 곳) */
const Flare: React.FC<{ x: number; y: number; w: number; h: number; t: number; t0: number }> = ({ x, y, w, h, t, t0 }) => {
  const a = t - t0;
  if (a < -.05) return null;
  const on = smooth(-.05, .06, a);
  const burst = Math.exp(-Math.max(0, a) * 4);
  return (
    <g>
      <Glow x={x + w / 2} y={y + h / 2} r={w * (5 + burst * 6)} color={GOLD} opacity={on * (.45 + burst * .5)} />
      <rect x={x} y={y} width={w} height={h} fill={CORE} opacity={on} />
    </g>
  );
};

// 박: B(19)=박 78
const T24 = B(19), T25 = B(20), T26 = B(21), T27 = B(22), T28 = beat(92), T29 = B(23), T30 = B(24), T31 = B(26), T32 = B(27);

export const act2b: Shot[] = [
  {
    // 24. 아주 먼 와이드: 지붕 위 작은 아이. 도시의 창과 거리에서 나방 줄기가 쏟아져 모여 사다리 밑동을 쌓기 시작한다.
    //     박 79에 아이가 일어서고 첫 발판이 붙는다. 박 80에 난간 실 두 가닥이 달 쪽으로 쭉 뻗는다. 창은 박마다 하나씩 열린다
    id: "a2-gather", start: T24, key: "hope", enter: { type: "flash" },
    render: (c) => {
      const lt = c.lt, t = c.t;
      const up = ease("expoOut", lin(.3, c.dur, lt));
      const hh = handheld(t, 24, 3);
      const cam: Cam = { x: 960 + hh.x, y: mix(560, 505, up) + hh.y, zoom: mix(1, 1.05, ease("sineIO", c.p)), rot: hh.r, focus: 1, dof: 1.4 };
      const base = 960;
      const roofY = 905;
      // 사다리(깊이 1): 지붕 위, 아이 오른쪽에서 달 쪽으로 휘며 오른다
      const s = 132;
      const lad = ladder2d({ x: 712, y: roofY - 10, s, ang: .08, curve: .011, side: { x: -.8, y: -.15 }, i0: 0, i1: 70 });
      const shoot = ease("expoOut", lin(beat(80) - T24, beat(80) - T24 + 1.1, lt));
      const lead = 1.3 + shoot * 38;
      // 아이: 앉아 있다가 박 79에 일어선다. 사다리 꼭대기를 따라 고개가 든다
      const tUp = beat(79) - T24;
      const rise = ease("back", lin(tUp - .12, tUp + .3, lt));
      const look = smooth(tUp + .2, c.dur, lt);
      const kp = pose({
        ...lerpPose({ ...P.sitKnees, headTilt: -.55 }, { ...P.stand, armN: [.25, .5], armF: [-.15, .3], headTilt: mix(-.5, -.95, look), lean: -.06 }, rise),
        x: 590, y: roofY, s, facing: 1, swing: .2 - rise * .6 + Math.sin(lt * 3) * .1,
      });
      const ksk = skeleton(kp);
      // 창 → 사다리 밑동으로 오는 나방 줄기. 출발점은 각 층의 창(시차를 따라 화면 위치를 구해 깊이 1 좌표로)
      const wins = [
        { layer: "near" as const, bi: 9, r: 2, c: 1, t0: T24 - .4 },
        { layer: "mid" as const, bi: 20, r: 1, c: 2, t0: beat(79) },
        { layer: "near" as const, bi: 12, r: 1, c: 1, t0: beat(80) },
        { layer: "mid" as const, bi: 26, r: 2, c: 1, t0: beat(80.5) },
        { layer: "mid" as const, bi: 15, r: 1, c: 0, t0: beat(81) },
      ].map((w) => ({ ...w, ...cityWindow(w.layer, base, 4, w.bi, w.r, w.c), d: w.layer === "mid" ? 5 : 2.2 }));
      const front = (tt: number) => {
        let top = -1;
        for (let i = 0; i < 40; i++) if (landGather(i) <= tt) top = i;
        return lad(top + 1.5);
      };
      const toD1 = (d: number, x: number, y: number) => { const sp = project(cam, d, x, y); return unproject(cam, 1, sp.x, sp.y); };
      const streams = wins.map((w, j) => {
        const P0 = toD1(w.d, w.x + w.w / 2, w.y + w.h / 2);
        return { j, w, P0 };
      });
      const street = [
        { P0: { x: 1150, y: 1300 }, t0: beat(79.5) },
        { P0: { x: -200, y: 1150 }, t0: beat(80) },
      ];
      const pathFor = (P0: V2, j: number) => (u: number, tt: number): V2 => {
        const F = front(tt);
        const ctl = { x: mix(P0.x, F.x, .35) + (j % 2 ? 120 : -100), y: Math.min(P0.y, F.y) - 330 - j * 40 };
        return bez(P0, ctl, { x: F.x, y: F.y }, u);
      };
      const mothsA = (tt: number) => streams.flatMap(({ j, w, P0 }) => flow(300 + j, 26, tt, pathFor(P0, j), { speed: .5, spread: 22, size: [3.5, 7.5], t0: w.t0 }));
      const mothsB = (tt: number) => street.flatMap((q, j) => flow(320 + j, 30, tt, pathFor(q.P0, j + 2), { speed: .45, spread: 36, size: [5, 8], t0: q.t0 }));
      // 발판 나방은 줄기 끝에서 날아온다
      const src = (i: number) => {
        const q = streams[i % streams.length];
        const F = lad(i);
        return { x: mix(q.P0.x, F.x, .75), y: mix(q.P0.y, F.y, .75) - 80 };
      };
      return (
        <Scene cam={cam}>
          <SkyBackdrop k={k} t={t} moon={{ x: 1380, y: 180, r: 46, rays: .7, glow: 1.1, pulse: c.pulse * .3 }} horizon={base + 40} />
          <CityLayers k={k} t={t} base={base} seed={4} />
          {/* 창 플레어: 그 창이 있는 층에 */}
          <Layer d={5}>{wins.filter((w) => w.d === 5).map((w, i) => <Flare key={i} {...w} t={t} t0={w.t0} />)}</Layer>
          <Layer d={2.2}>{wins.filter((w) => w.d === 2.2).map((w, i) => <Flare key={i} {...w} t={t} t0={w.t0} />)}</Layer>
          <Layer d={1}>
            <Parapet x0={-700} x1={1060} y={roofY} h={30} color={k.sil} />
            <WaterTank x={150} y={roofY - 30} s={140} color={k.sil} />
            <Antenna x={330} y={roofY - 30} h={260} color={k.sil} t={t} seed={5} light="#ff6a5a" />
            <Moths t={t} at={mothsB} color={GOLD} trail={5} trailDt={.05} />
            <Ladder frame={lad} lo={0} hi={40} t={t} land={landGather} src={src} lead={lead} sparks={14} part="back" />
            <Kid pose={kp} sil={k.sil} rim={RIM(.65, -.75, .022)} rim2={{ dx: 1, dy: -.1, color: GOLD, width: .012, glow: .6 }} />
            {/* 아직 손에 든 폰: 작은 차가운 점 */}
            <Glow x={ksk.haF.x} y={ksk.haF.y} r={16} color={k.cold} opacity={.7} />
            <circle cx={ksk.haF.x} cy={ksk.haF.y} r={2.4} fill="#eef4ff" />
            <Ladder frame={lad} lo={0} hi={40} t={t} land={landGather} lead={lead} sparks={14} part="front" />
          </Layer>
          <Layer d={1.15}>
            <Moths t={t} at={mothsA} color={GOLD} trail={5} trailDt={.05} />
          </Layer>
          {/* 전경: 카메라 앞을 지나는 큰 나방 보케 */}
          <Layer d={.42}>
            <Moths t={t} at={(tt) => flow(340, 3, tt, (u) => ({ x: mix(-300, 2300, u), y: mix(1100, 300, u) + Math.sin(u * 5) * 80 }), { speed: .28, spread: 60, size: [14, 18] })} color={GOLD} wings={false} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 25. 클로즈업: 사다리 조립. 난간 실이 먼저 위로 뻗어 있고, 나방이 좌우에서 번갈아 날아와 8분음마다 날개를 '탁' 편다.
    //     카메라는 박마다 두 칸씩 올라가며 따라가고(expoOut), 마지막 박에 크게 틸트 업해 달 쪽으로 끝없이 이어지는 난간을 보여 준다
    id: "a2-rungs", start: T25, key: "hope", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt, t = c.t;
      const s = 1400;
      const lad = ladder2d({ x: 900, y: 1700, s, ang: .06, curve: .004, side: { x: .93, y: -.1 }, i0: 0, i1: 40 });
      // 발판 6이 컷 시작(박 82)에 붙는다. 카메라는 막 붙은 발판보다 조금 위를 본다
      const bt = beatAt(t);
      const step = (b: number) => ease("expoOut", clamp((bt - b) / .9));
      let target = 5.6;
      for (let b = 82; b <= 85; b++) target += step(b) * (b === 85 ? 3.4 : 2);
      const F = lad(target);
      const hh = handheld(t, 25, 6, .5);
      const cam: Cam = { x: F.x + 40 + hh.x, y: F.y + hh.y, zoom: 1, rot: -.05 + hh.r + Math.sin(lt * .8) * .01, focus: 1, dof: 8 };
      const lead = 9 + ease("expoOut", lin(beat(85) - T25, c.dur, lt)) * 20;
      // 사방에서 모여드는 나방(배경, 흐림)
      const gather = (tt: number) => flow(400, 60, tt, (u) => {
        const side = u < .5 ? -1 : 1;
        const uu = (u * 2) % 1;
        return { x: F.x + side * mix(1500, 300, uu), y: F.y + mix(900, -200, uu) + Math.sin(uu * 4) * 120 };
      }, { speed: .45, spread: 200, size: [6, 12] });
      return (
        <Scene cam={cam}>
          <Layer d={Infinity}>
            <SkyFill k={k} y0={-500} y1={1500} glowY={1300} glowOpacity={.5} />
            <Stars seed={7} t={t} alpha={.7} y1={1100} />
          </Layer>
          <Layer d={9}>
            <Moon x={F.x / 9 * 8 + 520} y={F.y / 9 + 120 - 260} r={70} color={k.moon} glow={1.1} pulse={c.pulse * .3} />
          </Layer>
          <Layer d={14} opacity={.9}>
            <Wisp x={F.x / 14 + 400} y={F.y / 14 + 200} w={1600} color={k.cloudLit} opacity={.25} t={t} />
            <Wisp x={F.x / 14 - 500} y={F.y / 14 + 520} w={1900} color={k.cloudLit} opacity={.2} t={t} drift={-8} />
          </Layer>
          <CityLayers k={k} t={t} base={1150} seed={4} far={false} />
          <Layer d={2.6}>
            <Moths t={t} at={gather} color={GOLD} trail={0} />
          </Layer>
          <Layer d={1}>
            <Ladder frame={lad} lo={0} hi={30} t={t} land={landGather} lead={lead} sparks={16} fly={.5} />
          </Layer>
          {/* 전경: 카메라 바로 앞을 스치는 나방(박 84) */}
          <Layer d={.35}>
            <Moths t={t} at={(tt) => {
              const a = tt - beat(83.6);
              if (a < 0 || a > 1.2) return [];
              const u = ease("io", a / 1.2);
              return [{ x: mix(F.x * .35 + 1500, F.x * .35 - 500, u), y: F.y * .35 + mix(500, 100, u) + Math.sin(u * 7) * 40, s: 46, a: Math.PI * 1.1, f: tt * 14, b: 1 }];
            }} color={GOLD} wings={true} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 26. 낮은 각도 와이드: 지붕에서 올려다본다. 거대한 달을 향해 휘어 오르는 사다리, 아이가 한 박에 한 칸씩 오른다(박에 당겨 오름).
    //     위쪽에서는 나방이 계속 날아와 사다리 끝을 늘린다. 전경에 지붕 난간 모서리와 안테나가 흐리게
    id: "a2-climb", start: T26, key: "hope", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt, t = c.t;
      const s = 330;
      const lad = ladder2d({ x: 820, y: 1015, s, ang: .14, curve: .01, persp: .988, side: { x: -.72, y: -.2 }, i0: 0, i1: 90 });
      const sig = beatAt(t) - 86;
      const cl = climbPose({ frame: lad, s, sig, L0: 2.2, extra: { headTilt: -.32 } });
      const lagL = climbPose({ frame: lad, s, sig: sig - .25, L0: 2.2 }).L;
      const follow = lad(lagL);
      const hh = handheld(t, 26, 5);
      const cam: Cam = { x: 960 + hh.x + (follow.x - 900) * .25, y: mix(560, 470, smooth(0, c.dur, lt)) + (follow.y - 760) * .35 + hh.y, zoom: kf(lt, [[0, 1.02], [c.dur, 1.08, "out"]]), rot: .03 + hh.r, focus: 1, dof: 3 };
      const sk = skeleton(cl.pose);
      return (
        <Scene cam={cam}>
          <SkyBackdrop k={k} t={t} moon={{ x: 1430, y: 250, r: 165, rays: 1.2, glow: 1.15, pulse: c.pulse * .25 }} horizon={1180} stars={.6} />
          <CityLayers k={k} t={t} base={1080} seed={6} far={true} />
          <Layer d={1}>
            <Parapet x0={-900} x1={2900} y={1040} h={26} color={k.sil} />
            <Ladder frame={lad} lo={0} hi={70} t={t} land={landGather} lead={1.4} sparks={18} part="back" lodBelow={60} />
            <Kid pose={cl.pose} sil={k.sil} rim={RIM(.55, -.83, .014)} rim2={{ dx: .95, dy: .2, color: GOLD, width: .01, glow: .6 }} />
            <Ladder frame={lad} lo={0} hi={70} t={t} land={landGather} lead={1.4} sparks={18} part="front" lodBelow={60} />
            {/* 손이 발판을 잡는 순간 작은 빛 */}
            {[86, 87, 88, 89].map((b) => {
              const a = t - beat(b);
              if (a < -.02 || a > .5) return null;
              const h = (b - 86) % 2 ? sk.haF : sk.haN;
              return <Glow key={b} x={h.x} y={h.y} r={60 * (1 + a * 2)} color={CORE} opacity={(1 - a / .5) * .7} />;
            })}
          </Layer>
          <Layer d={.62}>
            <path d="M-400,1180L560,1120L620,1400L-400,1400Z" fill={k.sil} />
            <Antenna x={1980} y={1220} h={780} color={k.sil} t={t} seed={9} />
          </Layer>
          <Layer d={.4}>
            <Moths t={t} at={(tt) => flow(460, 4, tt, (u) => ({ x: mix(2300, -400, u), y: mix(900, 200, u) + Math.sin(u * 6) * 60 }), { speed: .3, spread: 80, size: [16, 22] })} color={GOLD} wings={false} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 27. 시점(POV): 사다리 위에서 발밑을 내려다본다. 발판 나방이 깊이로 줄어들며 저 아래 내 지붕까지 이어지고, 도시가 까마득하다.
    //     약한 돌리 줌: 카메라는 뒤로 빠지고 초점거리는 늘어나 발은 그대로인데 땅이 빨려 올라온다(현기증)
    id: "a2-vertigo", start: T27, key: "hope", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt, t = c.t;
      const Lk = 420.2;
      const F3 = kidFrame3(Lk);
      // 몸을 사다리 옆으로 내밀고 곧장 아래를 본다: 발은 화면 아래 오른쪽, 사다리는 그 발에서 저 아래 지붕(소실점)으로
      const eye0 = add3(F3.p, [F3.u, .5 * S_M], [F3.n, .32 * S_M], [F3.h, -.62]);
      const dz = ease("sineIO", lin(0, c.dur, lt));
      const back = .5 * dz;
      const hh = handheld(t, 27, 1, .9);
      const eye = add3(eye0, [{ x: 0, y: 1, z: 0 }, back]);
      const dF = 1.05;
      const f = 700 * (dF + back) / dF;
      const cam3: Cam3 = { ...eye, yaw: Math.PI + .06 + hh.x * .002, pitch: -Math.PI / 2 + .2 + hh.y * .002, roll: .3 + Math.sin(lt * 1.7) * .04 + hh.r * 4, f };
      const lad = ladder3(cam3, 1);
      const land = landFront(Lk + 40, T27 - 9);
      // 발(신발): 발판 Lk-1.2 위. 뒤꿈치는 아이 쪽(n), 발끝은 사다리 너머
      const foot = (sgn: number, ri: number) => {
        const R = rung3(ri);
        const base = { x: R.x + R.hx * sgn * .5, y: R.y + .03, z: R.z + R.hz * sgn * .5 };
        const heel = p3(cam3, ...xyz(add3(base, [F3.n, .13]))), toe = p3(cam3, ...xyz(add3(base, [F3.n, -.07])));
        const knee = p3(cam3, ...xyz(add3(base, [F3.n, .3], [F3.u, .36], [F3.h, sgn * -.05])));
        return { heel, toe, knee, w: .06 * S_M * heel.s };
      };
      const feet = [foot(-1, Math.round(Lk - 1.2)), foot(1, Math.round(Lk - 1.2))];
      const hip = p3(cam3, ...xyz(add3(F3.p, [F3.n, .05])));
      const camK = { ...k, sky: [...k.sky] };
      // 아래에서 사다리를 타고 올라오는 나방(작게 → 크게)
      const rising = (tt: number): M[] => Array.from({ length: 34 }, (_, i) => {
        const u = ((rnd(270, i) + tt * (.35 + rnd(271, i) * .25)) % 1);
        const ii = mix(4, Lk - 6, Math.pow(u, 2.2));
        const fr = lad(ii);
        const off = (rnd(272, i) - .5) * 2.6;
        const sw = n2(273 + i, tt * .8) * 1.2;
        return { x: fr.x + fr.sx * (off + sw), y: fr.y + fr.sy * (off + sw) + n2(274 + i, tt) * fr.k * .05, s: Math.max(1.5, fr.k * .03), a: Math.atan2(-fr.uy, -fr.ux), f: tt * 18 + i, b: Math.min(1, u * 8, (1 - u) * 5) };
      });
      return (
        <Scene cam={{ x: 960, y: 540, zoom: 1 }}>
          <Layer d={Infinity} blur={.9}>
            <Ground3D c={cam3} k={camK} />
            <City3D c={cam3} k={camK} t={t} radius={260} fogD={230} />
            <Glow x={lad(0).x} y={lad(0).y} r={40} color={GOLD} opacity={.8} />
          </Layer>
          <Layer d={Infinity}>
            <Ladder frame={lad} lo={0} hi={Math.floor(Lk - 1.3)} t={t} land={land} sparks={30} lodBelow={140} railFrom={-.6} />
            <Moths t={t} at={rising} color={GOLD} trail={3} />
          </Layer>
          {/* 내 발: 카메라 바로 앞(흐림), 발판 빛을 아래(사다리 쪽)에서 받는다 */}
          <Layer d={Infinity} blur={4}>
            {feet.map((q, i) => {
              const dx = q.toe.x - q.heel.x, dy = q.toe.y - q.heel.y, L = Math.hypot(dx, dy) || 1;
              const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
              const cx = (q.toe.x + q.heel.x) / 2, cy = (q.toe.y + q.heel.y) / 2;
              return (
                <g key={i}>
                  {/* 정강이: 뒤꿈치에서 무릎(화면 밖)으로 */}
                  <path d={`M${q.heel.x - q.w * .45},${q.heel.y}L${q.knee.x - q.w * .7},${q.knee.y}L${q.knee.x + q.w * .7},${q.knee.y}L${q.heel.x + q.w * .45},${q.heel.y}Z`} fill={k.sil} />
                  <g transform={`translate(${cx} ${cy}) rotate(${ang})`}>
                    <ellipse rx={L * .62 + q.w * .2} ry={q.w * .62} fill={GOLD} opacity={.45} transform={`translate(${q.w * .08} ${q.w * .12})`} />
                    <ellipse rx={L * .6} ry={q.w * .55} fill={k.sil} />
                  </g>
                </g>
              );
            })}
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 28. 미디엄: 휘청. 발이 미끄러지고 한 손이 떨어진다(사다리째 흔들림, 카메라도 흔들림) → 박 93에 난간을 꽉 끌어안는다.
    //     그 순간 둘레 발판 나방들이 확 밝아지며 받쳐 주고(빛의 물결), 금빛이 얼굴에 닿는다. 숨을 내쉬고 위를 본다
    id: "a2-wobble", start: T28, key: "hope", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt, t = c.t;
      const tC = beat(93) - T28;
      const s = 760;
      const slip = lt < tC ? ease("expoOut", lin(.03, .32, lt)) : 0;
      const hug = ease("expoOut", lin(tC - .04, tC + .25, lt));
      const relax = smooth(tC + .35, c.dur, lt);
      const swayA = lt < tC ? Math.sin(lt * 10.5) * .045 * smooth(0, .12, lt) : Math.sin(lt * 10.5) * .045 * Math.exp(-(lt - tC) * 7);
      const i0 = 228, lk = 240.2;
      const lad = ladder2d({ x: 930 - swayA * 900, y: 1830, s, ang: .1 + swayA, curve: .002, side: { x: -.72, y: -.2 }, i0, i1: 262 });
      const L0 = lk - .45 * slip + .15 * hug;
      // 휘청: 가까운 발이 미끄러져 허공, 먼 손이 떨어져 허우적
      const rest = climbPose({ frame: lad, s, sig: -1, L0 });
      const out = rest.out;
      const fr = lad(L0);
      const flailH = { x: rest.hands[1].x + out.x * s * .32 * slip + Math.sin(lt * 17) * 18 * slip, y: rest.hands[1].y + out.y * s * .32 * slip - s * .05 * slip };
      const slipF = { x: rest.feet[0].x + out.x * s * .16 * slip, y: rest.feet[0].y + s * .12 * slip + Math.sin(lt * 13) * 14 * slip };
      // 끌어안기: 두 손이 가까운 난간을 가슴 높이에서
      const railN = (i: number) => { const f = lad(i); return { x: f.x - f.sx * .95, y: f.y - f.sy * .95 }; };
      const hands: [V2, V2] = [
        lerpV(lerpV(rest.hands[0], railN(lk + 1.9), hug), rest.hands[0], relax * .0),
        lerpV(slip > 0 ? flailH : rest.hands[1], railN(lk + 1.1), hug),
      ];
      const cl = climbPose({
        frame: lad, s, sig: -1, L0, out: mix(.13, .06, hug),
        hands, feet: [lt < tC ? slipF : rest.feet[0], null],
        extra: {
          rot: (.1 + swayA) * .8 - .2 * slip,
          lean: mix(.1, .3, hug) - relax * .12, bend: mix(0, .18, hug) - relax * .1,
          headTilt: lt < tC ? mix(-.28, .25, slip) + Math.sin(lt * 15) * .1 * slip : mix(.42, -.32, ease("back", relax)),
          squash: hug * (1 - relax) * .06,
          swing: lt < tC ? 1 - slip * .3 + Math.sin(lt * 14) * .4 : .9 - springStep(lt - tC, 9, .3) * 1.2,
          face: hug * .85, faceDir: .3, faceColor: "#ffd890", eyes: lt < tC ? 1.15 : mix(.12, 1, smooth(tC + .45, tC + .65, lt)), mouth: lt < tC ? .7 * slip : .35 * (1 - relax),
        },
      });
      // 발판 빛의 물결: 박 93에 아이 둘레에서 위아래로 퍼진다
      const wave = (i: number) => {
        if (lt < tC) return 0;
        const a = lt - tC, d = Math.abs(i - lk);
        return Math.exp(-Math.pow(d - a * 26, 2) / 10) * .9 * Math.exp(-a * 1.5) + Math.exp(-d / 5) * .5 * hug;
      };
      const shake = lt < tC ? 14 * slip : 14 * Math.exp(-(lt - tC) * 8);
      const hh = handheld(t, 28, 4);
      const cam: Cam = { x: fr.x - 60 + hh.x + n2(281, t * 9) * shake, y: fr.y - s * .12 + hh.y + n2(282, t * 9) * shake, zoom: 1 + .05 * ease("expoOut", lin(tC, c.dur, lt)), rot: -.05 + swayA * .5 + hh.r, focus: 1, dof: 6 };
      const cam3: Cam3 = { x: 9, y: 82, z: 14, yaw: -Math.PI / 2 + .18, pitch: -.24, f: 1000 };
      const lit = .5 + .5 * hug;
      return (
        <Scene cam={cam}>
          <Layer d={Infinity} blur={3}>
            <Ground3D c={cam3} k={k} />
            <City3D c={cam3} k={k} t={t} radius={300} />
          </Layer>
          <Layer d={40}>
            <Moon x={fr.x / 40 + 1380} y={fr.y / 40 + 30} r={60} color={k.moon} glow={1} />
            <Wisp x={fr.x / 40 + 300} y={fr.y / 40 + 300} w={1500} color={k.cloudLit} opacity={.3} t={t} />
          </Layer>
          <Layer d={2.4}>
            <Moths t={t} at={(tt) => flow(285, 40, tt, (u) => ({ x: fr.x / 2.4 + 900 + mix(-1400, 1400, u), y: fr.y / 2.4 + 200 + Math.sin(u * 5 + tt) * 260 - u * 300 }), { speed: .25, spread: 140, size: [7, 12] })} color={GOLD} />
          </Layer>
          <Layer d={1}>
            <Ladder frame={lad} lo={i0} hi={262} t={t} land={landFront(275, T28 - 9)} bright={wave} part="back" sparks={20} glow={1 + hug * .3} />
            <Kid pose={cl.pose} sil={k.sil} rim={RIM(.6, -.8, .012)} rim2={{ dx: .95, dy: .25, color: GOLD, width: .012 + .008 * lit, glow: .5 + .4 * lit }} />
            <Ladder frame={lad} lo={i0} hi={262} t={t} land={landFront(275, T28 - 9)} part="front" sparks={20} />
            <Glow x={(hands[0].x + hands[1].x) / 2} y={(hands[0].y + hands[1].y) / 2} r={260} color={GOLD} opacity={hug * (1 - relax * .5) * .35} />
          </Layer>
          <Layer d={.45}>
            <Moths t={t} at={(tt) => flow(286, 3, tt, (u) => ({ x: fr.x * .45 + mix(1900, -500, u), y: fr.y * .45 + mix(700, 100, u) }), { speed: .45, spread: 120, size: [22, 28] })} color={GOLD} wings={false} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 29. 와이드: 훨씬 더 높이. 옆에서 본 아이가 한 박에 한 칸 오르고, 카메라가 천천히 뒤로 빠지면 사다리가 저 아래 지붕까지 아득하게
    //     이어진 것이 드러난다. 구름 결이 아이 높이에서 앞을 스친다
    id: "a2-higher", start: T29, key: "hope", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt, t = c.t;
      const sig = beatAt(t) - 94;
      const L0 = 560.2;
      const Lnow = L0 + bodySteps(Math.max(sig, -1));
      const F3 = kidFrame3(L0 + 2);
      const target = add3(F3.p, [F3.u, .3 * S_M]);
      const pull = ease("out", lin(0, c.dur + .3, lt));
      const dist = mix(12, 40, pull);
      const hh = handheld(t, 29, 2, .4);
      const base3: Cam3 = { x: 0, y: 0, z: 0, yaw: -Math.PI / 2 - .12 + hh.x * .0006, pitch: -.3 + hh.y * .0006, roll: .03 + hh.r, f: 1250 };
      const rd = rayDir(base3, mix(840, 900, pull), mix(430, 360, pull));
      const camP = add3(target, [rd, -dist]);
      const cam3: Cam3 = { ...base3, ...camP };
      const lad = ladder3(cam3, -1);
      const kd = p3(cam3, ...xyz(F3.p));
      const s = S_M * kd.s;
      const cl = climbPose({ frame: lad, s, sig, L0, extra: { headTilt: -.4 } });
      const land = landFront(L0 + 16, T29 - .4, 2.6);
      const moon = pDir(cam3, MOON_DIR.x, MOON_DIR.y, MOON_DIR.z);
      // 사다리를 타고 저 아래에서 올라오는 나방
      const rising = (tt: number): M[] => Array.from({ length: 70 }, (_, i) => {
        const u = ((rnd(290, i) + tt * (.05 + rnd(291, i) * .04)) % 1);
        const ii = mix(30, Lnow + 18, Math.pow(u, .5));
        const fr = lad(ii);
        const off = (rnd(292, i) - .5) * 5 + n2(293 + i, tt * .7) * 2;
        return { x: fr.x + fr.sx * off + n2(294 + i, tt) * 12, y: fr.y + fr.sy * off + n2(295 + i, tt) * 10, s: Math.max(1.6, fr.k * .03), a: Math.atan2(fr.uy, fr.ux), f: tt * 18 + i, b: Math.min(1, u * 10, (1 - u) * 10) };
      });
      return (
        <Scene cam={{ x: 960, y: 540, zoom: 1 }}>
          <Layer d={Infinity} blur={1.2}>
            <Ground3D c={cam3} k={k} />
            <Stars seed={29} t={t} alpha={.8} y1={300} />
            <City3D c={cam3} k={k} t={t} radius={380} fogD={260} />
          </Layer>
          <Layer d={Infinity} blend="screen">
            <Glow x={Math.min(moon.x, 2200)} y={Math.max(moon.y, -200)} r={900} color={k.moon} opacity={.35} />
          </Layer>
          <Layer d={Infinity}>
            <Ladder frame={lad} lo={0} hi={Math.floor(L0 + 40)} t={t} land={land} part="back" sparks={26} lodBelow={9e9} />
            <Moths t={t} at={rising} color={GOLD} trail={3} />
            <Kid pose={cl.pose} sil={k.sil} rim={RIM(.7, -.7, .03)} rim2={{ dx: .9, dy: .3, color: GOLD, width: .02, glow: .6 }} />
            <Ladder frame={lad} lo={0} hi={Math.floor(L0 + 40)} t={t} land={land} part="front" sparks={26} lodBelow={9e9} />
          </Layer>
          {/* 아이 높이의 구름 결이 카메라 앞을 스친다 */}
          <Layer d={Infinity} blur={14} opacity={.55}>
            <Wisp x={mix(2300, -500, ease("io", lin(0, c.dur, lt)))} y={kd.y + 260} w={1700} h={120} color={k.cloudLit} opacity={.5} />
            <Wisp x={mix(-600, 2500, ease("io", lin(.4, c.dur + 1.5, lt)))} y={kd.y - 360} w={1400} h={90} color={k.cloudLit} opacity={.35} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 30. 긴 테이크(5.5초), 소리가 빠진다. 사다리 위에서 돌아서서(등을 사다리에 기대고 한 손으로 난간을 쥔 채) 저 아래를 본다.
    //     어깨 너머 저 아래, 금빛 사다리가 내려가 닿은 내 건물 벽에 창 하나만 폰 빛으로 차갑다. 그 창으로 아주 천천히 밀어 들어간다
    //     (초점이 아이에서 도시로 옮겨 가고, 아이는 화면 밖으로 흘러 나간다). 끝은 차가운 사각형 하나 — 다음 컷 폰 화면과 매치컷
    id: "a2-lookback", start: T30, key: "quiet", enter: { type: "dip" },
    render: (c) => {
      const kq = K.quiet;
      const lt = c.lt, t = c.t;
      const Lk = 600.2;
      const F3 = kidFrame3(Lk);
      const head = add3(F3.p, [F3.n, .12 * S_M], [F3.u, .45 * S_M]);
      const win = { x: MY_WIN.x, y: MY_WIN.y + MY_WIN.h / 2, z: MY_WIN.z + .05 };
      const push = ease("sineIO", lin(1.0, c.dur + .3, lt));
      // 카메라: 아이 머리 바로 뒤·위. 창을 바라보되(시프트 렌즈) 창은 처음에 왼쪽 아래 → 끝에 가운데
      const camP0 = add3(head, [F3.u, .8], [F3.n, .25], [F3.h, .5]);
      const dW = norm3(win.x - camP0.x, win.y - camP0.y, win.z - camP0.z);
      const camP = add3(camP0, [dW, push * .9]);
      const look = lookAt(camP, win);
      const f = 640 * Math.pow(12, push);
      const cx = mix(700, 960, push), cy = mix(790, 560, push);
      const pre: Cam3 = { ...camP, yaw: look.yaw, pitch: look.pitch, roll: 0, f, cx, cy };
      const h0 = p3(pre, ...xyz(head));
      // 머리가 창의 오른쪽 위(-35°)에 오도록 화면을 돌린다
      const roll = -.6 - Math.atan2(h0.y - cy, h0.x - cx);
      const hh = handheld(t, 30, 1.4, .22);
      const cam3: Cam3 = { ...pre, yaw: look.yaw + hh.x / f, pitch: look.pitch + hh.y / f, roll: roll + hh.r * .4 };
      const lad = ladder3(cam3, -1);
      const H0 = p3(cam3, ...xyz(head));
      // 아이(2D): 머리는 투영한 자리, 몸은 창 반대쪽(화면 오른쪽 아래)으로 늘어진다. 창 쪽(왼쪽)을 본다
      const s = Math.min(6000, S_M * H0.s * .62);
      const D = norm2(H0.x - cx, H0.y - cy);
      const bodyDown = norm2(D.x * .55 + .2, D.y * .55 + 1);
      const th = Math.atan2(-bodyDown.x, bodyDown.y);
      const turn = ease("back", lin(.3, 1.6, lt));
      const breath = Math.sin(lt * 1.9) * .025;
      const base = pose({
        ...P.stand, anchor: "center", x: 0, y: 0, s, facing: -1, rot: -th,
        lean: -.04 + breath, bend: .08 + breath, headTilt: mix(-.35, .6, turn), swing: mix(.7, -.15, turn) + Math.sin(lt * 1.3) * .08,
        armN: [-1.1, .3], armF: [.25, .9], legN: [.08, .1], legF: [-.06, .08],
      });
      const sk0 = skeleton(base);
      const kp = { ...base, x: H0.x - sk0.head.x, y: H0.y - sk0.head.y };
      const ksk = skeleton(kp);
      const rackKid = mix(0, 10, smooth(1.0, 3.4, lt));
      const rackCity = mix(2.2, 0, smooth(1.0, 3.4, lt));
      const land = landFront(Lk + 30, T30 - 9);
      // 나방 하나가 아이 곁에서 창 쪽으로 천천히 내려간다(시선을 이끈다)
      const guide = (tt: number): M[] => {
        const a = (tt - T30 - .9) / 3.9;
        if (a < 0 || a > 1) return [];
        const u = ease("io", a);
        const from = add3(head, [F3.n, .5], [F3.h, -.4]);
        const q = { x: mix(from.x, win.x + .6, u) + Math.sin(u * 7) * 3 * (1 - u), y: mix(from.y, win.y + .9, Math.pow(u, .85)), z: mix(from.z, win.z + 1.4, u) };
        const pp = p3(cam3, q.x, q.y, q.z);
        return [{ x: pp.x, y: pp.y, s: clamp(.08 * pp.s, 3, 26), a: 1.6, f: tt * 12, b: Math.min(1, a * 6, (1 - a) * 4) }];
      };
      return (
        <Scene cam={{ x: 960, y: 540, zoom: 1 }}>
          <Layer d={Infinity} blur={rackCity}>
            <Ground3D c={cam3} k={kq} />
            <City3D c={cam3} k={kq} t={t} radius={300} fogD={220} myWin={1} lights={.7} />
          </Layer>
          <Layer d={Infinity} blur={rackCity * .5}>
            <Ladder frame={lad} lo={0} hi={Math.floor(Lk - 14)} t={t} land={land} sparks={20} lodBelow={9e9} dim={.75} />
            <Moths t={t} at={guide} color={GOLD} trail={4} trailDt={.06} />
          </Layer>
          {H0.z > .3 ? (
            <Layer d={Infinity} blur={rackKid}>
              <Ladder frame={lad} lo={Math.floor(Lk - 14)} hi={Math.floor(Lk + 6)} t={t} land={land} sparks={0} dim={.7} />
              <Kid pose={kp} sil={kq.sil} rim={{ dx: .5, dy: -.85, color: kq.rim, width: .006, glow: .5 }} rim2={{ dx: -.9, dy: .3, color: GOLD, width: .008, glow: .4 }} />
              <Glow x={ksk.haF.x} y={ksk.haF.y} r={s * .1} color={kq.cold} opacity={.5} />
            </Layer>
          ) : null}
        </Scene>
      );
    },
  },
];

const xyz = (p: { x: number; y: number; z: number }): [number, number, number] => [p.x, p.y, p.z];
const lerpV = (a: V2, b: V2, w: number): V2 => ({ x: mix(a.x, b.x, w), y: mix(a.y, b.y, w) });
const norm2 = (x: number, y: number) => { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; };
const norm3 = (x: number, y: number, z: number) => { const l = Math.hypot(x, y, z) || 1; return { x: x / l, y: y / l, z: z / l }; };
const ikArmTo = ikArm;

// 아직 쓰지 않은 키트(다음 컷에서 쓴다)
void [mixc, mixhex, GodRays, HALF, RUNG, WHITE, T31, T32, sizeOf];
function sizeOf(f: RF) { return f.k; }
