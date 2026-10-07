/**
 * 연기를 위한 도우미. 모두 시각 t의 순수 함수라서 어느 프레임을 먼저 그려도 같은 그림이 나온다.
 *
 *   kf         키프레임 보간(구간마다 이징: 되튕김·오버슈트)
 *   spring     움직임을 한 박자 늦게 따라오는 스프링. drag는 "얼마나 뒤처졌나" → 후드·옷자락의 끌림
 *   armsSeq    팔 자세를 이름으로 이어 붙이되 사이를 보간(팔이 튀지 않는다)
 *   jump       예비동작(웅크림) → 도약(늘어남) → 정점(발을 당김) → 착지(눌림과 되튕김)
 *   walker     발이 땅에서 미끄러지지 않는 걸음: 걸은 거리 ÷ 보폭 = 걸음 위상
 */
import { clamp, mix } from "../scenes.ts";
import { ARMS, type Arms, type ArmsT } from "./hoodie.ts";

export type Ease = "io" | "in" | "out" | "back" | "lin" | "snap";

const c1 = 1.70158, c3 = c1 + 1;
export function ease(e: Ease, x: number) {
  x = clamp(x);
  switch (e) {
    case "lin": return x;
    case "in": return x * x * x;
    case "out": return 1 - Math.pow(1 - x, 3);
    case "back": return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    case "snap": return x < .5 ? 0 : 1;
    default: return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }
}

export type KF = [number, number, Ease?];

/** 키프레임 보간. 구간의 이징은 도착하는 키에 적는다: [[0, 0], [.3, 1, "back"]] → 0에서 1로 되튕기며 */
export function kf(t: number, ks: KF[]) {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 0; i < ks.length - 1; i++) {
    const [t0, v0] = ks[i], [t1, v1, e] = ks[i + 1];
    if (t < t1) return mix(v0, v1, ease(e ?? "io", (t - t0) / (t1 - t0)));
  }
  return ks[ks.length - 1][1];
}

/**
 * 2차 스프링으로 fn을 따라가는 값. 따라가는 값은 앞선 시각부터 적분해 오므로 어느 t에서도 같다.
 * w: 각진동수(클수록 빠르다), z: 감쇠비(1 미만이면 출렁인다)
 */
export function spring(fn: (t: number) => number, t: number, o: { w?: number; z?: number; span?: number } = {}) {
  const w = o.w ?? 14, z = o.z ?? .55, span = o.span ?? 1.6, dt = 1 / 120;
  const t0 = t - span;
  let x = fn(t0), v = 0;
  for (let s = t0; s < t - 1e-9; s += dt) {
    const a = w * w * (fn(s + dt) - x) - 2 * z * w * v;
    v += a * dt;
    x += v * dt;
  }
  return x;
}

/** 따라오는 값이 실제보다 얼마나 뒤처졌나(px). 움직이는 쪽의 반대로 나온다 */
export function drag(fx: (t: number) => number, fy: (t: number) => number, t: number, o: { w?: number; z?: number } = {}) {
  const w = o.w ?? 9, z = o.z ?? .45;
  return { x: spring(fx, t, { w, z }) - fx(t), y: spring(fy, t, { w, z }) - fy(t) };
}

/* ── 팔 ─────────────────────────────────────────────── */

export function lerpArms(a: ArmsT, b: ArmsT, w: number): ArmsT {
  return [
    { x: mix(a[0].x, b[0].x, w), y: mix(a[0].y, b[0].y, w) },
    { x: mix(a[1].x, b[1].x, w), y: mix(a[1].y, b[1].y, w) },
  ];
}

export type ArmKey = [number, Arms, number?, Ease?];

/**
 * 팔 자세 이어 붙이기: [시각, 이름, 걸리는 시간(기본 .25), 이징(기본 io)].
 * 시각이 되면 직전 자세에서 그 자세로 보간한다. 이름이 없는 중간 자세는 필요 없다.
 */
export function armsSeq(t: number, ks: ArmKey[]): ArmsT {
  let cur: ArmsT = ARMS[ks[0][1]];
  for (let i = 1; i < ks.length; i++) {
    const [t0, name, dur = .25, e = "io"] = ks[i];
    if (t < t0) break;
    const next = ARMS[name];
    const w = dur <= 0 ? 1 : ease(e, (t - t0) / dur);
    cur = w >= 1 ? next : lerpArms(cur, next, w);
    if (w < 1) break;
  }
  return cur;
}

/* ── 점프 ───────────────────────────────────────────── */

/**
 * 포물선 점프. t0에서 떠서 t1에 내려앉는다(h: 높이 px).
 *   squash  예비동작에서 웅크리고(+), 도약 순간 길게 늘어났다(-), 착지에서 눌리고(+) 되튕긴다
 *   tuck    정점에서 발을 당긴다
 *   rise    팔이 올라간 정도(0~1): 도약에서 휘둘러 올라가고 내려오며 내려간다
 *   y       화면에서 올라간 높이(음수)
 */
export function jump(t: number, t0: number, t1: number, h: number, o: { crouch?: number; anticip?: number; land?: number } = {}) {
  const A = o.anticip ?? .3, crouch = o.crouch ?? .2, land = o.land ?? .24;
  const p = clamp((t - t0) / (t1 - t0));
  const air = t > t0 && t < t1;
  let squash = 0;
  if (t < t0) squash = crouch * ease("io", (t - (t0 - A)) / A);
  else if (t < t0 + .14) squash = mix(crouch, -.16, ease("out", (t - t0) / .14));
  else if (t < t1) squash = mix(-.16, -.02, ease("io", (t - t0 - .14) / Math.max(.01, t1 - t0 - .14)));
  else {
    const q = t - t1;
    // 착지: 눌렸다가(감쇠하는 되튕김) 제자리로
    squash = land * Math.exp(-q * 7) * Math.cos(q * 15) - (q < .08 ? 0 : 0);
  }
  const tuck = air ? Math.pow(Math.sin(p * Math.PI), 1.6) * .85 : 0;
  const rise = kf(t, [[t0 - A, 0], [t0 - .02, -.35, "io"], [t0 + .12, 1, "back"], [t1 - .05, 1], [t1 + .25, 0, "io"]]);
  return { p, air, y: air ? -4 * h * p * (1 - p) : 0, squash, tuck, rise };
}

/* ── 걸음 ───────────────────────────────────────────── */

/** 걸을 때 쓰는 값: 발이 땅에서 미끄러지지 않게 걸은 거리에서 걸음 위상을 얻는다 */
export function walker(u: number, beat: number, o: { beatsPerCycle?: number; stride?: number } = {}) {
  const stride = o.stride ?? .42;
  const cycle = beat * (o.beatsPerCycle ?? 2);
  const world = stride * u;
  return {
    /** 박에 맞춘 속도(px/s) */
    speed: world / cycle,
    stride,
    /** 걸은 거리(px) → 걸음 위상(주기) */
    phase: (dist: number) => dist / world,
  };
}

/** t0에 걷기 시작해 speed(px/s)에 이르기까지 ramp초 걸리는 걸음의 누적 거리. 걸음 위상은 이 거리 ÷ 보폭 */
export function walkDist(t: number, t0: number, speed: number, ramp = .35) {
  const q = Math.max(0, t - t0);
  return q < ramp ? speed * q * q / (2 * ramp) : speed * (q - ramp / 2);
}

/** 서 있다가 걷기 시작하고 멈추는 세기(0~1) */
export function gait(t: number, t0: number, t1: number, ramp = .35) {
  return clamp((t - t0) / ramp) * clamp((t1 - t) / ramp);
}

/** 숨쉬기: 아주 작은 눌림 */
export const breathe = (t: number, amp = .012, rate = 1.7) => amp * Math.sin(t * rate);

/** 속도 fn(t)의 누적 거리(0부터 t까지). 속도가 바뀌는 배경 흐름을 어느 프레임에서도 같게 얻는다 */
export function integ(fn: (t: number) => number, t: number, dt = 1 / 60) {
  let sum = 0;
  for (let s = 0; s < t; s += dt) sum += fn(s) * Math.min(dt, t - s);
  return sum;
}
