/**
 * 5막 전용 재료(키트에 없는 것). 모두 시각의 순수 함수다.
 *   rescueStreams  어둠 속 사방에서 한 점으로 나선을 그리며 모여드는 나방 줄기들(58~60이 같은 시간표를 공유)
 *   cradlePts      두 아이 아래의 빛 요람(아래로 둥근 그릇 모양 자리들)
 *   Rings          박에 맞춰 퍼지는 빛 고리
 *   RushMasses     카메라를 지나 아래로 쏟아지는 폭풍 덩어리(lib/storm의 StormMass, 상승 시차)
 *   DawnView / Orb / paneQuads / SleepFace / SleepReveal   66번 새벽 방(창밖 새벽, 빛 구슬, 창 모양 햇살, 잠든 얼굴, 둥근 빛에서 열림)
 *   SkyLayer       흐림 없는 하늘 층(키트의 무한 깊이 층도 심도 흐림을 먹어서 blur 0으로 고정)
 *   PhoneLight     한 손에 든 폰의 차가운 빛(키트의 phone은 두 손 사이에 놓인다)
 *   Sparks         떨어지는 금빛 불티
 */
import React from "react";
import { Layer, Screen, useUid } from "../lib/camera";
import { TAU, clamp, ease, mix, mixhex, n2, rnd } from "../lib/math";
import type { Key } from "../lib/palette";
import { Glow, Moon, SkyFill, Stars, Wisp } from "../lib/sky";
import { Skyline } from "../lib/city";
import { StormMass } from "../lib/storm";
import type { M } from "../lib/moths";
import { skeleton } from "../kid/rig";
import type { Pose } from "../kid/pose";

export type StreamOpt = {
  /** 모이는 중심(그 층 좌표) */
  cx: number; cy: number;
  /** 출발 반지름, 도착(맴돌기) 반지름 */
  R0: number; R1: number;
  /** 세로 눌림(타원) */
  sy?: number;
  /** 줄기 수, 줄기당 나방 수 */
  K: number; per: number;
  /** 첫 출발(곡 시각), 줄기마다 출발이 퍼지는 폭(초) */
  launch: number; spread: number;
  /** 출발→도착 시간(초), 한 줄기 안 나방 사이 간격(초) */
  travel: number; gap: number;
  /** 오는 동안 도는 각(rad) */
  spin: number;
  size: number;
  wob?: number; ribbon?: number; a0?: number; arc?: number; orbit?: number;
};

/** 사방에서 나선으로 모여드는 나방 줄기. 출발 전에는 멀리서 희미하게 떠 있다가, 출발하면 밝아지며 빨라지고, 도착하면 둘레를 돈다 */
export function rescueStreams(seed: number, t: number, o: StreamOpt): M[] {
  const out: M[] = [];
  const sy = o.sy ?? 1, wob = o.wob ?? 60, rib = o.ribbon ?? 40, om = o.orbit ?? 1.4;
  for (let k = 0; k < o.K; k++) {
    const th = (o.a0 ?? 0) + ((k + rnd(seed, k) * .7) / o.K) * (o.arc ?? TAU);
    const R = o.R0 * (.75 + rnd(seed, k + 50) * .5);
    const dir = rnd(seed, k + 100) > .5 ? 1 : -1;
    const spin = o.spin * dir * (.6 + rnd(seed, k + 120) * .8);
    const s0 = o.launch + rnd(seed, k + 150) * o.spread;
    const tr = o.travel * (.8 + rnd(seed, k + 170) * .4);
    for (let j = 0; j < o.per; j++) {
      const r1 = o.R1 * (.7 + rnd(seed, k * 31 + j) * .6);
      const pos = (tt: number) => {
        const x = (tt - s0 - j * o.gap) / tr;
        const u = ease("io", x);
        const r = mix(R, r1, u);
        const after = Math.max(0, x - 1) * tr;
        const ang = th + spin * u + dir * om * after * clamp(after * 3);
        const lat = (n2(seed + k * 7 + j, tt * .7) * wob + (rnd(seed, k * 97 + j) - .5) * rib) * (1 - u * .85);
        const bob = n2(seed + k * 13 + j, tt * .9, 3) * (x < 0 ? 18 : 6);
        const px = Math.cos(ang), py = Math.sin(ang);
        return { x: o.cx + px * (r + bob) - py * lat, y: o.cy + (py * (r + bob) + px * lat) * sy, x01: x, u };
      };
      const p = pos(t), q = pos(t + .03);
      const lit = x01b(p.x01);
      out.push({ x: p.x, y: p.y, s: o.size * (.6 + rnd(seed, k * 53 + j) * .8) * (1 + p.u * .25), a: Math.atan2(q.y - p.y, q.x - p.x), f: t * 17 + j * 1.3 + k, b: lit * (.65 + .35 * rnd(seed, k * 71 + j)) });
    }
  }
  return out;
}
/** 출발 전에는 희미하게(0.3), 출발하면 0.25초에 걸쳐 환히 */
const x01b = (x: number) => x < 0 ? .32 + .12 * Math.sin(x * 9) : mix(.45, 1, clamp(x * 4));

/** 빛 요람: (cx, cy)가 그릇 테두리 가운데, rx·ry는 그릇 반지름. 아래로 둥글고 양끝이 살짝 말려 올라간다 */
export function cradlePts(seed: number, cx: number, cy: number, rx: number, ry: number, n: number, rows = 4, inset = 0) {
  const cols = Math.ceil(n / rows);
  return Array.from({ length: n }, (_, i) => {
    const row = i % rows, col = Math.floor(i / rows);
    const u = (col + .5 + (rnd(seed, i) - .5) * .5) / cols;
    const phi = mix(.03, .97, u) * Math.PI;
    const f = 1 - row * .085 - inset;
    const curl = Math.pow(Math.abs(u - .5) * 2, 4) * ry * .25;
    const x = cx + Math.cos(phi) * rx * f;
    const y = cy + Math.sin(phi) * ry * f - curl + row * 4;
    const tan = Math.atan2(Math.cos(phi) * ry, -Math.sin(phi) * rx);
    return { x, y, a: tan + (rnd(seed, i + 300) > .5 ? Math.PI : 0), s: undefined as number | undefined };
  });
}

/** 박에 맞춰 퍼지는 빛 고리들 */
export const Rings: React.FC<{ x: number; y: number; t: number; at: number[]; r: number; color: string; dur?: number; sy?: number; width?: number; core?: string }> = ({ x, y, t, at, r, color, dur = 1.2, sy = 1, width = 10, core = "#ffffff" }) => (
  <g>
    {at.map((t0, i) => {
      const k = (t - t0) / dur;
      if (k < 0 || k > 1) return null;
      const e = ease("expoOut", k);
      const rr = r * e;
      const a = Math.pow(1 - k, 1.5);
      return (
        <g key={i}>
          <ellipse cx={x} cy={y} rx={rr} ry={rr * sy} fill="none" stroke={color} strokeWidth={width * 4 * (1 - k * .5)} opacity={a * .18} />
          <ellipse cx={x} cy={y} rx={rr} ry={rr * sy} fill="none" stroke={color} strokeWidth={width * 1.6 * (1 - k * .5)} opacity={a * .5} />
          <ellipse cx={x} cy={y} rx={rr} ry={rr * sy} fill="none" stroke={core} strokeWidth={width * .45 * (1 - k * .6)} opacity={a} />
        </g>
      );
    })}
  </g>
);

/**
 * 아래로 지나가는 폭풍 덩어리(올라가는 카메라). 키트 StormMass(노이즈 윤곽, 뭉게 윗면, 평평한 밑면)로 그린다.
 * 흐림은 덩어리마다 SVG 필터를 걸지 말고 층(Layer blur) 하나로 준다(soft 0).
 * boltX: 번개가 친 자리(층 좌표). 가까운 덩어리일수록 flash가 안에서 비친다
 */
export const RushMasses: React.FC<{
  seed: number; t: number; n: number; speed: number; x0: number; x1: number; y0: number; span: number; size: number;
  top: string; body: string; base: string; dx?: number; aspect?: number;
  flash?: number; boltX?: number; boltR?: number; flashColor?: string; rim?: number; rimColor?: string; opacity?: number;
  /** 이 사각형(층 좌표) 밖의 덩어리는 그리지 않는다 */
  view?: [number, number, number, number];
}> = ({ seed, t, n, speed, x0, x1, y0, span, size, top, body, base, dx = 0, aspect = .34, flash = 0, boltX = 0, boltR = 900, flashColor = "#dff4ff", rim = 0, rimColor, opacity = 1, view = [-700, -500, 2620, 1650] }) => (
  <g opacity={opacity}>
    {Array.from({ length: n }, (_, i) => {
      const y = y0 + ((rnd(seed, i) * span + t * speed * (.85 + rnd(seed, i + 9) * .3)) % span);
      const w = size * (.6 + rnd(seed, i + 40) * .8);
      const x = mix(x0, x1, (i + rnd(seed, i + 20) * .8) / n) + dx * (y - y0) / span;
      const h = w * (aspect * (.8 + rnd(seed, i + 60) * .45));
      if (x + w * .6 < view[0] || x - w * .6 > view[2] || y + h * .3 < view[1] || y - h * 1.3 > view[3]) return null;
      const fl = flash * clamp(1 - Math.abs(x - boltX) / boltR) ** 1.5;
      return (
        <StormMass key={i} seed={seed * 17 + i} x={x} y={y} w={w} h={h} top={top} body={body} base={base} t={t} soft={0}
          flash={fl} flashX={clamp((boltX - (x - w / 2)) / w, .15, .85)} flashY={.5} flashColor={flashColor} rim={rim} rimColor={rimColor} />
      );
    })}
  </g>
);

/** 흐림 없는 하늘 층 */
export const SkyLayer: React.FC<{ k: Key; horizon?: number; glowX?: number; glowOpacity?: number; glowR?: number; stars?: number; t?: number; y0?: number; children?: React.ReactNode }> = ({ k, horizon = 980, glowX = 960, glowOpacity = .55, glowR = 1300, stars = 0, t = 0, y0 = -300, children }) => (
  <Layer d={Infinity} blur={0}>
    <SkyFill k={k} y0={y0} y1={horizon + 120} glowX={glowX} glowY={horizon} glowR={glowR} glowOpacity={glowOpacity} />
    {stars > 0 ? <Stars seed={5} t={t} alpha={stars} y1={horizon - 250} /> : null}
    {children}
  </Layer>
);

/** 한 손에 든 폰: 작은 화면 + 차가운 빛 번짐 */
export const PhoneLight: React.FC<{ x: number; y: number; s: number; color: string; on: number; ang?: number; glow?: number }> = ({ x, y, s, color, on, ang = 0, glow = 1 }) => {
  if (on <= .01) return null;
  const w = .06 * s, h = .1 * s;
  return (
    <g>
      <Glow x={x} y={y} r={s * .55 * glow} color={color} opacity={on * .45} />
      <Glow x={x} y={y} r={s * .16} color="#ffffff" opacity={on * .5} />
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={w * .2} fill={color} opacity={.4 + .6 * on} transform={`rotate(${(ang * 180) / Math.PI} ${x} ${y})`} />
    </g>
  );
};

/** 떨어지는 금빛 불티(날개 없는 나방 점). 화면 위에서 아래로, 바람에 흔들리며 */
export function sparks(seed: number, n: number, t: number, o: { x0: number; x1: number; y0: number; y1: number; speed: number; size: number; sway?: number }): M[] {
  const H = o.y1 - o.y0;
  return Array.from({ length: n }, (_, i) => {
    const sp = o.speed * (.6 + rnd(seed, i) * .8);
    const y = o.y0 + ((rnd(seed, i + 100) * H + t * sp) % H);
    const x = mix(o.x0, o.x1, rnd(seed, i + 200)) + n2(seed + i, t * .5) * (o.sway ?? 40);
    const fade = Math.min(1, (y - o.y0) / (H * .1), (o.y1 - y) / (H * .15));
    return { x, y, s: o.size * (.5 + rnd(seed, i + 300)), a: Math.PI / 2, f: 0, b: clamp(fade) * (.4 + .6 * (.5 + .5 * Math.sin(t * 7 + i))) };
  });
}

/* ───────────────────────── 66: 새벽 방(2번 방의 거울) ───────────────────────── */

/** 창밖 새벽(한 층 안에 그린다): 장밋빛→복숭앗빛 하늘, 도시 위로 막 오른 해, 분홍 구름 결, 안개에 녹은 두 겹 도시(따뜻한 창이 아직 켜져 있다) */
export const DawnView: React.FC<{ k: Key; t: number; sunX: number; base?: number; x0?: number; x1?: number }> = ({ k, t, sunX, base = 780, x0 = -800, x1 = 2800 }) => (
  <g>
    <SkyFill k={k} y0={base - 700} y1={base + 40} glowX={sunX} glowY={base - 130} glowR={760} glowOpacity={.95} stops={[0, .38, .72, 1]} />
    <Glow x={sunX} y={base - 140} r={640} color="#ffdcae" opacity={.7} />
    <Glow x={sunX} y={base - 140} r={190} color="#fff6e2" opacity={.95} />
    <circle cx={sunX} cy={base - 140} r={58} fill="#fffaf0" />
    <Wisp x={sunX - 420} y={base - 330} w={1500} h={34} color="#ffd6c0" opacity={.55} t={t} drift={6} />
    <Wisp x={sunX + 380} y={base - 470} w={1200} h={26} color="#f6b8c0" opacity={.45} t={t} drift={-5} />
    <Wisp x={sunX - 200} y={base - 210} w={1700} h={20} color="#fff0dc" opacity={.5} t={t} drift={8} />
    <Skyline seed={66} base={base} minH={60} maxH={250} minW={50} maxW={130} x0={x0} x1={x1} color={mixhex(k.fog, k.sky[3], .3)} t={t} details={false} win={{ density: .1, size: .5, warm: mixhex(k.win, k.sky[3], .4), coldRatio: 0 }} />
    <Skyline seed={67} base={base + 140} minH={130} maxH={340} minW={80} maxW={190} x0={x0} x1={x1} color={mixhex(k.silFar, k.fog, .3)} t={t} win={{ density: .16, size: .8, warm: k.win, coldRatio: 0 }} />
  </g>
);

/** 손에 안긴 작은 달(빛 구슬): 부드러운 속 + 후광, 숨 쉬듯 커졌다 작아진다 */
export const Orb: React.FC<{ x: number; y: number; r: number; breath: number; color?: string }> = ({ x, y, r, breath, color = "#ffd58a" }) => (
  <g>
    <Glow x={x} y={y} r={r * (11 + breath * .8)} color={color} opacity={.38} />
    <Glow x={x} y={y} r={r * (4.6 + breath * .5)} color="#ffe2a8" opacity={.8} />
    <Glow x={x} y={y} r={r * 2.1} color="#fff6e0" opacity={.95} />
    <Moon x={x} y={y} r={r * (1 + breath * .04)} color="#fff0cc" glow={0} texture={.9} />
  </g>
);

/** 창 하나가 비스듬히 떨어진 빛 조각(창살 그림자 십자 포함). 원점 o에서 u축(창 너비)·v축(창 높이) 방향으로 편다 */
export function paneQuads(o: { x: number; y: number }, U: { x: number; y: number }, V: { x: number; y: number }, gap = .035, bar = .42) {
  const at = (u: number, v: number) => `${(o.x + U.x * u + V.x * v).toFixed(1)},${(o.y + U.y * u + V.y * v).toFixed(1)}`;
  const q = (u0: number, u1: number, v0: number, v1: number) => `M${at(u0, v0)}L${at(u1, v0)}L${at(u1, v1)}L${at(u0, v1)}Z`;
  const g = gap / 2;
  return [q(0, .5 - g, 0, bar - g), q(.5 + g, 1, 0, bar - g), q(0, .5 - g, bar + g, 1), q(.5 + g, 1, bar + g, 1)].join("");
}

/** 잠든 얼굴: 감은 눈(아래로 휜 속눈썹)과 작은 미소. 키트 Kid의 얼굴 타원과 같은 자리·같은 회전으로 얹는다(facing 1 기준) */
export const SleepFace: React.FC<{ p: Pose; color?: string; smile?: number }> = ({ p, color = "#3a1c22", smile = 1 }) => {
  const sk = skeleton(p);
  const s = p.s;
  const ht = p.lean + p.bend + p.headTilt * .6;
  const fd = clamp(p.faceDir, -1, 1);
  const k1 = mix(.085, .01, Math.abs(fd)) * s;
  const lx = Math.cos(ht) * k1 - Math.sin(ht) * .012 * s, ly = Math.sin(ht) * k1 + Math.cos(ht) * .012 * s;
  const sx = lx * (1 + p.squash * .5), sy = ly * (1 - p.squash);
  const wx = (sx * Math.cos(p.rot) - sy * Math.sin(p.rot)) * p.facing, wy = sx * Math.sin(p.rot) + sy * Math.cos(p.rot);
  const cx = sk.head.x + wx, cy = sk.head.y + wy;
  const eyes = fd > .35 ? [-.04, .04] : [.035 * p.facing];
  const ey = -.005 * s;
  const mx = (eyes.length > 1 ? 0 : .03 * p.facing) * s, my = .047 * s;
  const w = .0075 * s;
  return (
    <g transform={`translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${((p.rot * 180) / Math.PI).toFixed(2)})`} stroke={color} strokeWidth={w} strokeLinecap="round" fill="none" opacity={clamp(p.face)}>
      {eyes.map((ex, i) => <path key={i} d={`M${ex * s - .02 * s},${ey}Q${ex * s},${ey + .015 * s} ${ex * s + .02 * s},${ey}`} />)}
      <path d={`M${mx - .016 * s},${my}Q${mx},${my + .011 * s * smile} ${mx + .016 * s},${my}`} strokeWidth={w * .85} />
    </g>
  );
};

/** 둥근 빛 하나에서 장면이 드러난다: (x, y) 둘레 반지름 r 밖을 어둠으로 덮는다(화면 좌표, 가장자리는 부드럽게) */
export const SleepReveal: React.FC<{ x: number; y: number; r: number; color?: string }> = ({ x, y, r, color = "#07040c" }) => {
  const id = useUid("rv");
  if (r > 5000) return null;
  return (
    <Screen defs={
      <radialGradient id={id} cx={x} cy={y} r={r} gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor={color} stopOpacity={0} />
        <stop offset=".3" stopColor={color} stopOpacity={0} />
        <stop offset=".75" stopColor={color} stopOpacity={.7} />
        <stop offset="1" stopColor={color} stopOpacity={1} />
      </radialGradient>
    }>
      <rect x={-10} y={-10} width={1940} height={1100} fill={`url(#${id})`} />
    </Screen>
  );
};
