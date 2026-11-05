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
import { Kid, skeleton } from "../kid/rig";
import { P, lerpPose, pose } from "../kid/pose";
import { CORE, GOLD, HALF, Ladder, RUNG, climbPose, ladder2d, landGather, type RF, type V2 } from "./act2b-ladder";
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
      const base = 770;
      const roofY = 880;
      // 사다리(깊이 1): 지붕 위, 아이 오른쪽에서 달 쪽으로 휘며 오른다
      const s = 112;
      const lad = ladder2d({ x: 690, y: roofY - 8, s, ang: .1, curve: .012, side: { x: -.78, y: -.16 }, i0: 0, i1: 70 });
      const shoot = ease("expoOut", lin(beat(80) - T24, beat(80) - T24 + 1.1, lt));
      const lead = 1.3 + shoot * 38;
      // 아이: 앉아 있다가 박 79에 일어선다. 사다리 꼭대기를 따라 고개가 든다
      const tUp = beat(79) - T24;
      const rise = ease("back", lin(tUp - .12, tUp + .3, lt));
      const look = smooth(tUp + .2, c.dur, lt);
      const kp = pose({
        ...lerpPose({ ...P.sitKnees, headTilt: -.55 }, { ...P.stand, armN: [.25, .5], armF: [-.15, .3], headTilt: mix(-.5, -.95, look), lean: -.06 }, rise),
        x: 575, y: roofY, s, facing: 1, swing: .2 - rise * .6 + Math.sin(lt * 3) * .1,
      });
      const ksk = skeleton(kp);
      // 창 → 사다리 밑동으로 오는 나방 줄기. 출발점은 각 층의 창(시차를 따라 화면 위치를 구해 깊이 1 좌표로)
      const wins = [
        { layer: "near" as const, bi: 2, r: 3, c: 1, t0: T24 - .3 },
        { layer: "mid" as const, bi: 17, r: 2, c: 2, t0: beat(79) },
        { layer: "near" as const, bi: 8, r: 2, c: 2, t0: beat(80) },
        { layer: "mid" as const, bi: 24, r: 1, c: 1, t0: beat(80.5) },
        { layer: "near" as const, bi: 11, r: 4, c: 0, t0: beat(81) },
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
        { P0: { x: 1250, y: 1250 }, t0: beat(79.5) },
        { P0: { x: -120, y: 1000 }, t0: beat(80) },
      ];
      const pathFor = (P0: V2, j: number) => (u: number, tt: number): V2 => {
        const F = front(tt);
        const ctl = { x: mix(P0.x, F.x, .5) + (j % 2 ? 160 : -140), y: Math.min(P0.y, F.y) - 260 - j * 30 };
        return bez(P0, ctl, { x: F.x, y: F.y }, u);
      };
      const mothsA = (tt: number) => streams.flatMap(({ j, w, P0 }) => flow(300 + j, 22, tt, pathFor(P0, j), { speed: .55, spread: 26, size: [2.4, 5.5], t0: w.t0 }));
      const mothsB = (tt: number) => street.flatMap((q, j) => flow(320 + j, 26, tt, pathFor(q.P0, j + 2), { speed: .5, spread: 40, size: [4, 6], t0: q.t0 }));
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
            <Parapet x0={-700} x1={1010} y={roofY} h={30} color={k.sil} />
            <WaterTank x={170} y={roofY - 30} s={120} color={k.sil} />
            <Antenna x={330} y={roofY - 30} h={230} color={k.sil} t={t} seed={5} light="#ff6a5a" />
            <Moths t={t} at={mothsB} color={GOLD} trail={3} />
            <Ladder frame={lad} lo={0} hi={40} t={t} land={landGather} src={src} lead={lead} sparks={14} part="back" />
            <Kid pose={kp} sil={k.sil} rim={RIM(.65, -.75, .022)} rim2={{ dx: 1, dy: -.1, color: GOLD, width: .012, glow: .6 }} />
            {/* 아직 손에 든 폰: 작은 차가운 점 */}
            <Glow x={ksk.haF.x} y={ksk.haF.y} r={16} color={k.cold} opacity={.7} />
            <circle cx={ksk.haF.x} cy={ksk.haF.y} r={2.4} fill="#eef4ff" />
            <Ladder frame={lad} lo={0} hi={40} t={t} land={landGather} lead={lead} sparks={14} part="front" />
          </Layer>
          <Layer d={1.15}>
            <Moths t={t} at={mothsA} color={GOLD} trail={4} />
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
      const s = 1650;
      const lad = ladder2d({ x: 900, y: 1700, s, ang: .06, curve: .004, side: { x: .93, y: -.1 }, i0: 0, i1: 40 });
      // 발판 6이 컷 시작(박 82)에 붙는다. 카메라는 막 붙은 발판보다 조금 위를 본다
      const bt = beatAt(t);
      const step = (b: number) => ease("expoOut", clamp((bt - b) / .9));
      let target = 6.4;
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
      const lad = ladder2d({ x: 820, y: 1015, s, ang: .14, curve: .01, persp: .988, side: { x: -.5, y: -.17 }, i0: 0, i1: 90 });
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
];

// 아직 쓰지 않은 키트(다음 컷에서 쓴다)
void [mixc, mixhex, springStep, GodRays, HALF, RUNG, T27, T28, T29, T30, T31, T32, sizeOf];
function sizeOf(f: RF) { return f.k; }
