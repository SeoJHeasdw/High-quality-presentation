/**
 * 시간·보간 도우미. 모든 값은 시각 t(초)의 순수 함수다. 어느 프레임을 먼저 그려도 같은 그림이 나온다.
 */
import { noise2D, noise3D } from "@remotion/noise";

export const TAU = Math.PI * 2;
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const mix = (a: number, b: number, w: number) => a + (b - a) * w;
/** a에서 b 사이를 0→1로 매끈하게(smoothstep) */
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** a에서 b 사이를 0→1로 선형 */
export const lin = (a: number, b: number, x: number) => clamp((x - a) / (b - a));

export type Ease = "lin" | "io" | "in" | "out" | "expoOut" | "expoIn" | "expoIO" | "back" | "backIn" | "elastic" | "snap" | "sineIO" | "quadOut";

const c1 = 1.70158, c3 = c1 + 1;
export function ease(e: Ease, x: number): number {
  x = clamp(x);
  switch (e) {
    case "lin": return x;
    case "in": return x * x * x;
    case "out": return 1 - Math.pow(1 - x, 3);
    case "quadOut": return 1 - (1 - x) * (1 - x);
    case "expoOut": return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
    case "expoIn": return x === 0 ? 0 : Math.pow(2, 10 * x - 10);
    case "expoIO": return x === 0 ? 0 : x === 1 ? 1 : x < .5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2;
    case "back": return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    case "backIn": return c3 * x * x * x - c1 * x * x;
    case "elastic": return x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * (TAU / 3)) + 1;
    case "snap": return x < 1 ? 0 : 1;
    case "sineIO": return -(Math.cos(Math.PI * x) - 1) / 2;
    default: return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }
}

/** 키프레임: [시각, 값, 도착 이징]. 구간의 이징은 도착하는 키에 적는다. */
export type KF = [number, number, Ease?];
export function kf(t: number, ks: KF[]): number {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 0; i < ks.length - 1; i++) {
    const [t0, v0] = ks[i], [t1, v1, e] = ks[i + 1];
    if (t < t1) return mix(v0, v1, ease(e ?? "io", (t - t0) / (t1 - t0)));
  }
  return ks[ks.length - 1][1];
}

/** 정수 해시 → 0..1 */
export function hash(a: number, b = 0): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 100000) / 100000;
}
/** 씨앗 하나에서 0..1 수열 */
export const rnd = (seed: number, i: number) => hash(seed * 7919 + i, seed);

/** -1..1 부드러운 잡음 */
export const n2 = (seed: number, x: number, y = 0) => noise2D(String(seed), x, y);
export const n3 = (seed: number, x: number, y: number, z: number) => noise3D(String(seed), x, y, z);

/** 핸드헬드 카메라 흔들림(px, rad). amp는 px */
export function handheld(t: number, seed = 1, amp = 6, speed = .35) {
  return {
    x: n2(seed, t * speed, 0) * amp + n2(seed + 9, t * speed * 3.1, 2) * amp * .25,
    y: n2(seed + 3, t * speed, 5) * amp * .7 + n2(seed + 11, t * speed * 2.7, 7) * amp * .2,
    r: n2(seed + 5, t * speed * .8, 9) * amp * .00045,
  };
}

/** 2차 스프링 응답(0→1). t<0이면 0. w 각진동수, z 감쇠비 */
export function springStep(t: number, w = 12, z = .45) {
  if (t <= 0) return 0;
  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
  }
  return 1 - Math.exp(-w * t) * (1 + w * t);
}

export type RGB = [number, number, number];
export function hex(c: string): RGB {
  const h = c.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export function rgb(c: RGB, a = 1) {
  return a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;
}
/** 두 색(hex)을 섞어 css 문자열 */
export function mixc(a: string, b: string, w: number, alpha = 1) {
  const A = hex(a), B = hex(b);
  return rgb([mix(A[0], B[0], w), mix(A[1], B[1], w), mix(A[2], B[2], w)], alpha);
}
/** 두 색(hex)을 섞어 hex */
export function mixhex(a: string, b: string, w: number) {
  const A = hex(a), B = hex(b);
  const to = (v: number) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0");
  return "#" + to(mix(A[0], B[0], w)) + to(mix(A[1], B[1], w)) + to(mix(A[2], B[2], w));
}
export const alpha = (c: string, a: number) => rgb(hex(c), a);
