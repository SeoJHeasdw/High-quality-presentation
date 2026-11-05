/**
 * 곡 분석(../mv/tools/analyze.py가 만든 JSON)을 시각으로 묻는 창구. 87.5 BPM, 4/4, 65마디, 180초.
 *   beat(i)   i번째 박의 시각. 박 0은 1.173초, 한 박 ≈ 0.683초
 *   B(n)      n번째 마디 첫 박(= beat(2 + 4n)). B(0)=2.507, 한 마디 ≈ 2.74초
 *   feature   프레임별 음량(level)·저음(low)·중음(mid)·고음(high)·타격(hit), 0..1
 */
import analysis from "../../../mv/public/hiphop-analysis.json";
import { clamp } from "./math";

type A = {
  duration: number; bpm: number; beats: number[]; downbeats: number[];
  sections: { start: number; end: number; energy: number }[];
  frames: { count: number; level: number[]; low: number[]; mid: number[]; high: number[]; hit: number[] };
};
const a = analysis as unknown as A;

export const FPS = 30;
export const DURATION = a.duration; // 180
export const BEATS = a.beats;
export const DOWNBEATS = a.downbeats;
export const SECTIONS = a.sections;
export const BEAT = 60 / a.bpm;

export const beat = (i: number) => {
  if (i < 0) return BEATS[0] + i * BEAT;
  if (i >= BEATS.length) return BEATS[BEATS.length - 1] + (i - BEATS.length + 1) * BEAT;
  const fi = Math.floor(i), fr = i - fi;
  if (fr === 0) return BEATS[fi];
  return BEATS[fi] + fr * ((BEATS[fi + 1] ?? BEATS[fi] + BEAT) - BEATS[fi]);
};
/** n번째 마디 첫 박. 소수도 된다: B(16.5) = 16마디 셋째 박 */
export const B = (n: number) => beat(2 + 4 * n);

/** t 시각의 박 번호(소수) */
export function beatAt(t: number) {
  if (t <= BEATS[0]) return (t - BEATS[0]) / BEAT;
  let lo = 0, hi = BEATS.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (BEATS[m] <= t) lo = m; else hi = m - 1; }
  const next = BEATS[lo + 1] ?? BEATS[lo] + BEAT;
  return lo + (t - BEATS[lo]) / (next - BEATS[lo]);
}
/** 마지막 박에서 지난 초 */
export const sinceBeat = (t: number) => t - beat(Math.floor(beatAt(t)));
/** 박에 맞춰 튀었다 사그라드는 값(0..1). decay 초 */
export const beatPulse = (t: number, decay = .25) => Math.exp(-sinceBeat(t) / decay);

export type Feature = "level" | "low" | "mid" | "high" | "hit";
export function feature(f: Feature, t: number) {
  const arr = a.frames[f];
  const x = clamp(t * FPS, 0, arr.length - 1);
  const i = Math.floor(x), w = x - i;
  return arr[i] * (1 - w) + (arr[Math.min(arr.length - 1, i + 1)] ?? 0) * w;
}
/** 구간 에너지(0..1) */
export function energy(t: number) {
  const s = SECTIONS.find((s) => t >= s.start && t < s.end);
  return s ? s.energy : 0;
}
