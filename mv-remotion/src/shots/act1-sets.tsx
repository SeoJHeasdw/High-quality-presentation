/**
 * 1막 전용 재료. 키트(src/lib)에 없는 것만 여기서 만든다.
 *   CityEstablish + cityCam   1번 도시 북엔드(65번이 같은 구도로 따뜻하게 다시 쓴다)
 *   NightView / RoomWall / Moonbeam / Motes   방(2·5·6·8번, 39번 거울 구도)
 *   BigMoth   클로즈업용 나방(앞·뒷날개, 더듬이, 빛)
 *   Ripple / Smear   유리를 두드릴 때 퍼지는 고리와 금빛 번짐(4번, 40번 거울)
 *   PhoneScreen / Rimmed / FingerHand   폰 화면, 테두리 빛 흉내, 손끝 클로즈업
 */
import React from "react";
import { Layer, useUid, type Cam } from "../lib/camera";
import type { Key } from "../lib/palette";
import { clamp, ease, handheld, mix, mixc, mixhex, n2, rnd, smooth } from "../lib/math";
import { Glow, Moon, SkyFill, Stars, Wisp } from "../lib/sky";
import { Skyline, WindowFrame, Curtain } from "../lib/city";
import { Moths, type M } from "../lib/moths";
import { Kid } from "../kid/rig";
import { P, pose } from "../kid/pose";

/* ───────────────────────── 공통 ───────────────────────── */

/** 위는 투명, 아래로 갈수록 color(안개). 줄지은 건물 아래를 공기 속에 녹인다 */
export const FogBand: React.FC<{ y0: number; y1: number; color: string; opacity?: number; x0?: number; x1?: number; fill?: boolean }> = ({ y0, y1, color, opacity = 1, x0 = -4000, x1 = 6000, fill = true }) => {
  const id = useUid("fog");
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1={y0} x2="0" y2={y1} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={color} stopOpacity={0} />
          <stop offset="1" stopColor={color} stopOpacity={opacity} />
        </linearGradient>
      </defs>
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill={`url(#${id})`} />
      {fill ? <rect x={x0} y={y1 - 1} width={x1 - x0} height={5000} fill={color} opacity={opacity} /> : null}
    </>
  );
};

/** 폰 빛의 깜빡임: 스크롤할 때마다 밝기가 계단처럼 바뀌고(빠르게 옮겨 감) 잔떨림이 있다. 0.6..1 */
export function phoneFlicker(t: number, seed = 7, rate = 2.3) {
  const i = Math.floor(t * rate), f = t * rate - i;
  const v = mix(rnd(seed, i), rnd(seed, i + 1), smooth(0, .14, f));
  return clamp(.6 + .4 * v + .035 * Math.sin(t * 37) * Math.sin(t * 13.3));
}

/** 직사각형 빛 테두리 흉내: 모양을 rim 색으로 그리고, 빛 반대쪽으로 w만큼 민 실루엣을 그 위에 덮는다 */
export const Rimmed: React.FC<{ dx: number; dy: number; w: number; rim: string; sil: string; glow?: number; children: (fill: string) => React.ReactNode }> = ({ dx, dy, w, rim, sil, glow = 0, children }) => {
  const id = useUid("rm");
  const l = Math.hypot(dx, dy) || 1;
  return (
    <g>
      {glow > 0 ? (
        <>
          <defs><filter id={id} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation={w * 1.4} /></filter></defs>
          <g filter={`url(#${id})`} opacity={glow}>{children(rim)}</g>
        </>
      ) : null}
      {children(rim)}
      <g transform={`translate(${(-dx / l) * w} ${(-dy / l) * w})`}>{children(sil)}</g>
    </g>
  );
};

/** 빛줄기 속 먼지. 영역 안을 잡음으로 천천히 떠다닌다 */
export const Motes: React.FC<{ t: number; x0: number; y0: number; x1: number; y1: number; n?: number; color: string; size?: number; seed?: number; opacity?: number; speed?: number }> = ({ t, x0, y0, x1, y1, n = 40, color, size = 2.2, seed = 3, opacity = .8, speed = .08 }) => (
  <g fill={color}>
    {Array.from({ length: n }, (_, i) => {
      const x = mix(x0, x1, (rnd(seed, i) + n2(seed + i, t * speed, 1) * .08 + 1) % 1);
      const y = mix(y0, y1, (rnd(seed, i + 99) + t * speed * .15 * (rnd(seed, i + 7) - .3) + n2(seed + i, t * speed, 5) * .06 + 2) % 1);
      const tw = .45 + .55 * Math.abs(Math.sin(t * (.8 + rnd(seed, i + 3) * 2) + i));
      return <circle key={i} cx={x} cy={y} r={size * (.5 + rnd(seed, i + 5))} opacity={opacity * tw} />;
    })}
  </g>
);

/* ───────────────────────── 1번 / 65번: 도시 북엔드 ───────────────────────── */

/** 목표 창(깊이 d 층의 세계 좌표, 창 크기) */
export const CITY_T = { d: 2.4, x: 1247, y: 676, w: 34, h: 44 };

/**
 * 1번 카메라: 거의 멈춘 듯 시작해 점점 빨라지며 목표 창으로 밀려 들어간다(로그 줌을 가속).
 * 화면 가운데가 목표 창으로 옮겨 가며 가까운 층이 시차로 빠져나간다. 65번은 반대로(뒤로 빠지며) 쓸 수 있다
 */
export function cityCam(lt: number, dur: number, t: number, zEnd = 6.2): Cam {
  const p = clamp(lt / dur);
  const u = .3 * p + .7 * Math.pow(p, 4.5);
  const z = Math.exp(Math.log(zEnd) * u);
  const c = ease("sineIO", clamp((p - .05) / .9));
  const T = CITY_T;
  const hh = handheld(t, 2, 3.5 * (1 - p * .6));
  return { x: mix(960, 960 + (T.x - 960) * T.d, c) + hh.x, y: mix(540, 540 + (T.y - 540) * T.d, c) + hh.y, zoom: z, rot: hh.r, focus: T.d, dof: 1.4 };
}

/**
 * 높은 곳에서 본 밤 도시(층 여섯 겹). 목표 창 하나만 따로 빛난다.
 *   target   목표 창의 빛(on 0..1, color). flicker면 폰처럼 깜빡인다
 *   ignite   (건물 순서 u, 창 번호 i) → 0..1: 창이 하나씩 켜진다(65번)
 *   winDim   다른 창들이 안개 쪽으로 죽는 정도(0 = 그대로, 1 = 안 보임)
 *   moth     0..1: 금빛 점 하나가 목표 창으로 다가간다(복선). 음수면 없음
 *   sky      d=40 층에 덧그리는 것(65번의 달·실 등)
 *   kid      목표 창 안 작은 실루엣(폰 빛)
 */
export const CityEstablish: React.FC<{
  k: Key; t: number;
  target?: { on: number; color: string; flicker?: boolean };
  ignite?: (u: number, i: number) => number;
  winDim?: number; moth?: number; stars?: number; sky?: React.ReactNode; kid?: boolean;
}> = ({ k, t, target = { on: 1, color: k.cold, flicker: true }, ignite, winDim = .35, moth = -1, stars = 1, sky, kid = true }) => {
  const T = CITY_T;
  const cid = useUid("tgt");
  const warm = mixhex(k.win, k.fog, winDim);
  const f = target.flicker ? phoneFlicker(t) : 1;
  const on = target.on * f;
  const wx = T.x - T.w / 2, wy = T.y - T.h / 2;
  const mothPath = (u: number) => ({ x: mix(990, T.x + 26, ease("out", u)) + Math.sin(u * 9) * 26 * (1 - u), y: mix(560, T.y - 8, ease("io", u)) + Math.cos(u * 11) * 18 * (1 - u) });
  const mothAt = (tt: number): M[] => {
    const u = clamp(moth + (tt - t) * .25);
    const q = mothPath(u);
    return [{ x: q.x + n2(5, tt * 3) * 4, y: q.y + n2(6, tt * 3) * 4, s: 2.4, a: 0, f: tt * 20, b: clamp(moth * 5) * (.7 + .3 * Math.sin(tt * 9)) }];
  };
  return (
    <>
      <Layer d={Infinity} blur={0}>
        <SkyFill k={k} y0={-520} y1={600} glowY={545} glowR={1150} glowOpacity={.62} />
        <Glow x={1750} y={-160} r={700} color={k.moon} opacity={.12} />
        {stars > 0 ? <Stars seed={3} t={t} count={120} y1={380} alpha={.75 * stars} /> : null}
      </Layer>
      <Layer d={40} blur={0}>
        <Wisp x={420} y={330} w={1500} h={26} color={k.cloudLit} opacity={.22} t={t} drift={4} />
        <Wisp x={1500} y={410} w={1800} h={22} color={k.cloudLit} opacity={.18} t={t} drift={-5} />
        <Wisp x={1000} y={210} w={1100} h={30} color={k.cloudLit} opacity={.1} t={t} drift={3} />
        {sky}
      </Layer>
      <Layer d={16} blur={.8}>
        <Skyline seed={11} base={575} minH={40} maxH={190} minW={40} maxW={110} x0={-2200} x1={4200} color={mixhex(k.fog, k.sky[3], .32)} t={t} details={false} win={{ density: .1, size: .4, warm, cold: k.cold, coldRatio: 0 }} ignite={ignite} />
        <FogBand y0={480} y1={590} color={mixhex(k.fog, k.sky[3], .45)} opacity={.9} />
      </Layer>
      <Layer d={9} blur={.5}>
        <Skyline seed={12} base={700} minH={70} maxH={300} minW={60} maxW={150} x0={-2000} x1={3900} color={mixhex(k.silFar, k.fog, .72)} t={t} win={{ density: .12, size: .55, warm, cold: k.cold, coldRatio: 0 }} ignite={ignite} />
        <FogBand y0={600} y1={712} color={mixhex(k.fog, k.sky[3], .25)} opacity={.85} />
      </Layer>
      <Layer d={5} blur={0}>
        <Skyline seed={13} base={880} minH={120} maxH={380} minW={80} maxW={190} x0={-1600} x1={3600} color={mixhex(k.silFar, k.fog, .42)} t={t} win={{ density: .13, size: .75, warm, cold: k.cold, coldRatio: 0 }} ignite={ignite} />
        <FogBand y0={760} y1={890} color={mixhex(k.fog, k.silFar, .3)} opacity={.85} />
      </Layer>
      <Layer d={T.d} blur={0}>
        <Skyline seed={14} base={1220} minH={300} maxH={640} minW={120} maxW={260} x0={-1200} x1={3300} color={mixhex(k.silFar, k.sil, .5)} t={t} win={{ density: .12, size: 1, warm, cold: k.cold, coldRatio: 0 }} ignite={ignite} />
        {/* 목표 건물: 창 격자 4×9, (열 1, 행 1)이 목표 창 */}
        <g>
          <rect x={1162} y={562} width={214} height={760} fill={mixhex(k.silFar, k.sil, .38)} />
          <rect x={1154} y={552} width={230} height={14} fill={mixhex(k.silFar, k.sil, .55)} />
          <rect x={1330} y={512} width={8} height={42} fill={mixhex(k.silFar, k.sil, .55)} />
          {Array.from({ length: 9 }, (_, r) => Array.from({ length: 4 }, (_, cI) => {
            const x = 1180 + cI * 50, y = 590 + r * 64;
            if (cI === 1 && r === 1) return null;
            const ig = ignite ? ignite(.55, r * 4 + cI) : rnd(77, r * 4 + cI) < .14 ? 1 : 0;
            return (
              <g key={`${r}-${cI}`}>
                <rect x={x} y={y} width={T.w} height={T.h} fill={mixhex(k.sil, k.silFar, .5)} />
                {ig > .01 ? <rect x={x} y={y} width={T.w} height={T.h} fill={warm} opacity={ig * .8} /> : null}
                <rect x={x - 3} y={y + T.h} width={T.w + 6} height={4} fill={mixhex(k.silFar, k.sil, .6)} />
              </g>
            );
          }))}
          {/* 목표 창: 유리 안에 폰 빛과 작은 실루엣 */}
          <defs><clipPath id={cid}><rect x={wx} y={wy} width={T.w} height={T.h} /></clipPath></defs>
          <rect x={wx} y={wy} width={T.w} height={T.h} fill={mixhex(k.sil, k.silFar, .5)} />
          <g clipPath={`url(#${cid})`}>
            <rect x={wx} y={wy} width={T.w} height={T.h} fill={target.color} opacity={on * .55} />
            <Glow x={T.x + 3} y={T.y + 9} r={24} color={target.color} opacity={on} />
            {kid ? <Kid pose={pose({ ...P.sitEdge, ...P.phone, anchor: "seat", x: T.x + 4, y: wy + T.h - 6, s: 30, facing: -1, phone: on, legN: [1.3, 1.4], legF: [1.1, 1.2] })} sil={k.sil} phoneColor={target.color} /> : null}
            <rect x={wx} y={wy} width={7} height={T.h} fill={mixhex(k.sil, k.silFar, .3)} />
          </g>
          <rect x={wx - 3} y={wy + T.h} width={T.w + 6} height={4} fill={mixhex(k.silFar, k.sil, .6)} />
        </g>
        <FogBand y0={1020} y1={1240} color={mixhex(k.fog, k.silFar, .55)} opacity={.75} />
      </Layer>
      <Layer d={T.d} blend="screen" blur={0}>
        <Glow x={T.x} y={T.y} r={95} color={target.color} opacity={on * .5} />
        <Glow x={T.x} y={T.y} r={300} color={target.color} opacity={on * .14} />
        <Glow x={T.x} y={T.y + 34} r={40} rx={46} ry={10} color={target.color} opacity={on * .4} />
        {moth >= 0 ? <Moths t={t} at={mothAt} color="#ffc45a" trail={3} /> : null}
      </Layer>
      <Layer d={1.3}>
        <Skyline seed={15} base={1560} minH={560} maxH={720} minW={220} maxW={420} x0={-1100} x1={3100} color={mixhex(k.sil, k.silFar, .2)} t={t} win={{ density: .05, size: 1.6, warm, cold: k.cold, coldRatio: 0 }} ignite={ignite} />
      </Layer>
      <Layer d={.62}>
        {/* 전경 전깃줄과 전봇대(카메라가 밀려 들어가면 화면 밖으로 빠진다) */}
        <g stroke={k.sil} fill="none" strokeLinecap="round">
          <path d="M-300,40 Q500,250 1500,-40" strokeWidth={4} />
          <path d="M-300,90 Q520,320 1600,10" strokeWidth={3.2} />
          <path d="M-300,150 Q420,330 1250,120 T2400,60" strokeWidth={2.4} />
        </g>
        <rect x={-120} y={-200} width={26} height={1600} fill={k.sil} />
        <rect x={-200} y={60} width={190} height={14} fill={k.sil} />
        <rect x={-190} y={120} width={170} height={12} fill={k.sil} />
      </Layer>
    </>
  );
};

/* ───────────────────────── 방 ───────────────────────── */

/** 창밖 밤 풍경(한 층 안에 그린다): 하늘·별·달·두 겹 도시. gold(0..1)면 나방 빛이 섞인다 */
export const NightView: React.FC<{ k: Key; t: number; moon?: { x: number; y: number; r: number } | null; base?: number; seed?: number; bright?: number; x0?: number; x1?: number }> = ({ k, t, moon, base = 760, seed = 21, bright = 1, x0 = -800, x1 = 2800 }) => (
  <g>
    <SkyFill k={k} y0={base - 900} y1={base + 40} glowY={base - 40} glowR={900} glowOpacity={.75 * bright} />
    <Stars seed={seed} t={t} count={70} y0={base - 900} y1={base - 280} x0={x0} x1={x1} alpha={.8} />
    {moon ? <Moon x={moon.x} y={moon.y} r={moon.r} color={k.moon} glow={1.1 * bright} /> : null}
    <Wisp x={(x0 + x1) / 2} y={base - 330} w={1400} h={26} color={k.cloudLit} opacity={.3} t={t} drift={5} />
    <Skyline seed={seed} base={base} minH={60} maxH={260} minW={50} maxW={130} x0={x0} x1={x1} color={mixhex(k.fog, k.sky[3], .35)} t={t} details={false} win={{ density: .12, size: .5, warm: mixhex(k.win, k.fog, .3), cold: k.cold, coldRatio: 0 }} />
    <FogBand y0={base - 120} y1={base + 10} color={mixhex(k.fog, k.sky[3], .4)} opacity={.6} />
    <Skyline seed={seed + 1} base={base + 120} minH={120} maxH={330} minW={80} maxW={190} x0={x0} x1={x1} color={mixhex(k.silFar, k.fog, .35)} t={t} win={{ density: .14, size: .8, warm: mixhex(k.win, k.fog, .2), cold: k.cold, coldRatio: 0 }} />
  </g>
);

/**
 * 방 뒷벽(한 층). 창 구멍(x, y, w, h)으로 뒤 층의 NightView가 보인다.
 * 벽에 창빛 번짐, 창턱, 양쪽 커튼(wind로 부푼다), 창짝(open 0..1).
 */
export const RoomWall: React.FC<{
  k: Key; t: number; x: number; y: number; w: number; h: number;
  open?: number; wind?: number; wall?: string; floorY?: number; spill?: string; spillA?: number; curtains?: boolean; frame?: string;
}> = ({ k, t, x, y, w, h, open = 0, wind = 0, wall, floorY = 1000, spill, spillA = .22, curtains = true, frame }) => {
  const wc = wall ?? mixhex(k.sil, k.fog, .28);
  const fc = frame ?? mixhex(k.sil, k.fog, .12);
  const cw = w * .2;
  return (
    <g>
      <path d={`M-3000,-3000H5000V${floorY}H-3000Z M${x},${y}V${y + h}H${x + w}V${y}Z`} fill={wc} fillRule="evenodd" />
      <rect x={-3000} y={floorY} width={8000} height={3000} fill={mixhex(k.sil, wc, .55)} />
      <rect x={-3000} y={floorY - 14} width={8000} height={14} fill={mixhex(k.sil, wc, .3)} />
      <Glow x={x + w / 2} y={y + h * .55} r={w * 1.1} rx={w * 1.25} ry={h * 1.1} color={spill ?? k.glow} opacity={spillA} />
      <WindowFrame x={x} y={y} w={w} h={h} frame={fc} thick={16} open={open} reflect={.06} />
      <rect x={x - 40} y={y + h + 14} width={w + 80} height={20} fill={fc} />
      <rect x={x - 40} y={y + h + 14} width={w + 80} height={3} fill={mixc(fc, spill ?? k.glow, .5)} />
      {curtains ? (
        <>
          <Curtain x={x - cw * .55} y={y - 40} w={cw} h={h + 120} color={mixhex(k.sil, wc, .35)} t={t} wind={wind} side={1} seed={3} />
          <g transform={`translate(${2 * x + w} 0) scale(-1 1)`}>
            <Curtain x={x - cw * .55} y={y - 40} w={cw} h={h + 120} color={mixhex(k.sil, wc, .35)} t={t} wind={wind} side={1} seed={8} />
          </g>
          <rect x={x - cw - 30} y={y - 52} width={w + cw * 2 + 60} height={10} rx={5} fill={fc} />
        </>
      ) : null}
    </g>
  );
};

/** 창에서 바닥으로 떨어지는 빛 기둥(사다리꼴) + 바닥의 빛 자리. screen 층에 넣는다 */
export const Moonbeam: React.FC<{ x: number; y: number; w: number; h: number; dx: number; floorY: number; color: string; opacity?: number }> = ({ x, y, w, h, dx, floorY, color, opacity = .2 }) => {
  const id = useUid("beam");
  const fy = floorY + 60;
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1={y} x2="0" y2={fy} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={color} stopOpacity={.75} />
          <stop offset="1" stopColor={color} stopOpacity={.12} />
        </linearGradient>
      </defs>
      <path d={`M${x},${y}L${x + w},${y}L${x + w + dx},${fy}L${x + dx},${fy}Z`} fill={`url(#${id})`} opacity={opacity} />
      <path d={`M${x + dx - 40},${fy}L${x + w + dx + 40},${fy}L${x + w + dx * 1.25 + 60},${fy + 160}L${x + dx * 1.25 - 60},${fy + 160}Z`} fill={color} opacity={opacity * .55} />
    </g>
  );
};

/* ───────────────────────── 나방·유리 ───────────────────────── */

/** 클로즈업용 나방. a = 머리 방향(rad), flap 0 접힘 … 1 활짝. 빛나는 몸 + 반투명 날개 + 깃털 더듬이 */
export const BigMoth: React.FC<{ x: number; y: number; s: number; a?: number; flap?: number; color?: string; core?: string; glow?: number; opacity?: number }> = ({ x, y, s, a = -Math.PI / 2, flap = 1, color = "#ffc45a", core = "#fff3c8", glow = 1, opacity = 1 }) => {
  const id = useUid("bm");
  const f = .1 + .9 * clamp(flap);
  const fw = (g: number) => `M${s * .2},${g * s * .05}C${s * .55},${g * s * .55 * f} ${s * .2},${g * s * 1.1 * f} ${-s * .28},${g * s * 1.02 * f}C${-s * .42},${g * s * .72 * f} ${-s * .22},${g * s * .26 * f} ${-s * .05},${g * s * .05}Z`;
  const hw = (g: number) => `M${-s * .02},${g * s * .05}C${-s * .02},${g * s * .6 * f} ${-s * .46},${g * s * .74 * f} ${-s * .66},${g * s * .46 * f}C${-s * .64},${g * s * .2 * f} ${-s * .38},${g * s * .08} ${-s * .14},${g * s * .03}Z`;
  const ant = (g: number) => `M${s * .36},${g * s * .04}Q${s * .62},${g * s * .1} ${s * .8},${g * s * .36}`;
  return (
    <g opacity={opacity}>
      <defs>
        <radialGradient id={id + "g"}>
          <stop offset="0%" stopColor={core} stopOpacity={.9} />
          <stop offset="15%" stopColor={color} stopOpacity={.55} />
          <stop offset="45%" stopColor={color} stopOpacity={.16} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={id + "w"} cx="20%" cy="50%" r="90%">
          <stop offset="0%" stopColor={core} stopOpacity={.95} />
          <stop offset="60%" stopColor={color} stopOpacity={.8} />
          <stop offset="100%" stopColor={color} stopOpacity={.35} />
        </radialGradient>
      </defs>
      {glow > 0 ? <circle cx={x} cy={y} r={s * 3.2 * glow} fill={`url(#${id}g)`} /> : null}
      <g transform={`translate(${x} ${y}) rotate(${(a * 180) / Math.PI})`}>
        <path d={hw(-1)} fill={`url(#${id}w)`} opacity={.8} />
        <path d={hw(1)} fill={`url(#${id}w)`} opacity={.8} />
        <path d={fw(-1)} fill={`url(#${id}w)`} />
        <path d={fw(1)} fill={`url(#${id}w)`} />
        <g stroke={mixc(color, "#ffffff", .3)} strokeOpacity={.45} strokeWidth={s * .012} fill="none">
          <path d={`M${s * .05},${-s * .05}Q${s * .05},${-s * .5 * f} ${-s * .2},${-s * .9 * f}`} />
          <path d={`M${s * .05},${s * .05}Q${s * .05},${s * .5 * f} ${-s * .2},${s * .9 * f}`} />
        </g>
        <ellipse cx={-s * .06} rx={s * .44} ry={s * .12} fill={core} />
        <circle cx={s * .32} r={s * .1} fill={core} />
        <g stroke={core} strokeWidth={s * .022} fill="none" strokeLinecap="round">
          <path d={ant(-1)} />
          <path d={ant(1)} />
        </g>
      </g>
    </g>
  );
};

/** 유리를 두드린 자리에서 퍼지는 고리(들) */
export const Ripple: React.FC<{ x: number; y: number; t: number; t0: number; dur?: number; r?: number; color: string; rings?: number; width?: number; squash?: number }> = ({ x, y, t, t0, dur = 1.1, r = 260, color, rings = 3, width = 5, squash = 1 }) => {
  const a = (t - t0) / dur;
  if (a < 0 || a > 1) return null;
  return (
    <g fill="none">
      {Array.from({ length: rings }, (_, i) => {
        const u = clamp(a * 1.15 - i * .12);
        if (u <= 0) return null;
        const rr = r * ease("expoOut", u) * (1 - i * .18);
        return <ellipse key={i} cx={x} cy={y} rx={rr} ry={rr * squash} stroke={color} strokeWidth={width * (1 - u) * (1 - i * .25)} opacity={(1 - u) * (1 - u) * (1 - i * .25)} />;
      })}
    </g>
  );
};

/** 유리에 남는 금빛 번짐: 탁 터졌다가 천천히 사라진다 */
export const Smear: React.FC<{ x: number; y: number; t: number; t0: number; r?: number; color: string; life?: number }> = ({ x, y, t, t0, r = 120, color, life = 1.6 }) => {
  const a = t - t0;
  if (a < 0 || a > life) return null;
  const pop = ease("expoOut", a / .25);
  const fade = 1 - smooth(.1, life, a);
  return (
    <g>
      <Glow x={x} y={y} r={r * (.6 + .5 * pop)} color={color} opacity={fade * .85} />
      <Glow x={x} y={y} r={r * .25 * (.6 + .5 * pop)} color="#fff6dc" opacity={fade * (1 - smooth(0, .5, a)) * .9} />
    </g>
  );
};

/* ───────────────────────── 폰 ───────────────────────── */

/** 폰 화면(가운데 0,0, w×h). scroll px만큼 위로 밀린 카드들. 글자는 없다(덩어리와 동그라미만) */
export const PhoneScreen: React.FC<{ w: number; h: number; scroll: number; color: string; bright?: number; seed?: number }> = ({ w, h, scroll, color, bright = 1, seed = 5 }) => {
  const id = useUid("ph");
  const r = w * .11;
  const pitch = h * .46;
  const i0 = Math.floor(scroll / pitch) - 1;
  const cards: React.ReactNode[] = [];
  for (let i = i0; i < i0 + 4; i++) {
    const y = -h / 2 + i * pitch - scroll + h * .05;
    const tone = rnd(seed, i + 9);
    cards.push(
      <g key={i}>
        <circle cx={-w * .31} cy={y + h * .035} r={w * .075} fill={color} opacity={.7} />
        <rect x={-w * .19} y={y + h * .02} width={w * (.3 + rnd(seed, i) * .25)} height={h * .026} rx={h * .013} fill={color} opacity={.55} />
        <rect x={-w * .42} y={y + h * .085} width={w * .84} height={pitch * .7} rx={w * .05} fill={mixc(color, "#ffffff", tone * .7)} opacity={.3 + .55 * rnd(seed, i + 20)} />
      </g>,
    );
  }
  return (
    <g>
      <defs>
        <clipPath id={id}><rect x={-w / 2} y={-h / 2} width={w} height={h} rx={r} /></clipPath>
        <linearGradient id={id + "g"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mixc(color, "#ffffff", .2)} />
          <stop offset="1" stopColor={mixc(color, "#1a3a5a", .35)} />
        </linearGradient>
      </defs>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={r} fill={`url(#${id}g)`} opacity={bright} />
      <g clipPath={`url(#${id})`} opacity={bright}>{cards}</g>
    </g>
  );
};

/* ───────────────────────── 손끝(9번) ───────────────────────── */

/** 세운 검지(끝이 (x, y)), 말린 손가락·엄지, 소매. fill 하나로 그린다(Rimmed 안에서 쓴다) */
export function fingerHand(x: number, y: number, s: number, fill: string, bend = 0) {
  const fx = x + bend * s * .05;
  return (
    <g fill={fill}>
      {/* 소매 */}
      <path d={`M${x - s * 1.1},${y + s * 3.6}C${x - s * .9},${y + s * 2.6} ${x - s * .55},${y + s * 1.85} ${x - s * .42},${y + s * 1.42}L${x + s * .42},${y + s * 1.5}C${x + s * .5},${y + s * 2.1} ${x + s * .6},${y + s * 2.8} ${x + s * .85},${y + s * 3.6}Z`} />
      <rect x={x - s * .5} y={y + s * 1.3} width={s * .98} height={s * .3} rx={s * .12} transform={`rotate(-6 ${x} ${y + s * 1.45})`} />
      {/* 손바닥 */}
      <path d={`M${x - s * .34},${y + s * 1.38}C${x - s * .46},${y + s * 1.0} ${x - s * .36},${y + s * .62} ${x - s * .12},${y + s * .56}L${x + s * .16},${y + s * .56}C${x + s * .4},${y + s * .62} ${x + s * .44},${y + s * 1.05} ${x + s * .34},${y + s * 1.38}Z`} />
      {/* 세운 검지 */}
      <path d={`M${x - s * .1},${y + s * .7}L${fx - s * .085},${y + s * .09}A${s * .085},${s * .085} 0 0 1 ${fx + s * .085},${y + s * .09}L${x + s * .1},${y + s * .7}Z`} />
      {/* 말린 손가락 셋 */}
      {[0, 1, 2].map((i) => <ellipse key={i} cx={x + s * (.2 + i * .045)} cy={y + s * (.72 + i * .19)} rx={s * .14} ry={s * .1} />)}
      {/* 엄지 */}
      <path d={`M${x - s * .3},${y + s * 1.1}C${x - s * .42},${y + s * .9} ${x - s * .32},${y + s * .74} ${x - s * .2},${y + s * .78}C${x - s * .1},${y + s * .84} ${x - s * .12},${y + s * 1.0} ${x - s * .14},${y + s * 1.1}Z`} />
    </g>
  );
}
