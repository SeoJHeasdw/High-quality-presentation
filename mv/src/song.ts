/**
 * 곡 분석(tools/analyze.py가 만든 JSON)을 시각으로 묻는 창구.
 * 화면은 상태를 들고 있지 않는다. 모든 값은 t 하나에서 나오므로, 실시간 재생과
 * 프레임 단위 렌더가 같은 그림을 낸다.
 */

export type Section = { start: number; end: number; energy: number };

export type Analysis = {
  source: string;
  duration: number;
  fps: number;
  bpm: number;
  beatGrid: boolean;
  beats: number[];
  downbeats: number[];
  sections: Section[];
  frames: {
    count: number;
    level: number[];
    low: number[];
    mid: number[];
    high: number[];
    hit: number[];
    bands: number;
    spectrum: string;
  };
  peaks: number[];
};

/** 가사 한 줄. 파일이 없으면 가사 층을 그리지 않는다. */
export type Lyric = { start: number; end: number; text: string };

export type Feature = "level" | "low" | "mid" | "high" | "hit";

/** 정렬된 배열에서 v 이하인 마지막 위치. 없으면 -1 */
function lastAtOrBefore(list: number[], v: number) {
  let lo = 0, hi = list.length - 1, ans = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (list[m] <= v) { ans = m; lo = m + 1; } else hi = m - 1;
  }
  return ans;
}

export class Song {
  readonly a: Analysis;
  readonly duration: number;
  readonly bands: number;
  readonly beatLength: number;
  private spec: Uint8Array;

  constructor(a: Analysis) {
    this.a = a;
    this.duration = a.duration;
    this.bands = a.frames.bands;
    this.beatLength = 60 / a.bpm;
    const bin = atob(a.frames.spectrum);
    this.spec = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) this.spec[i] = bin.charCodeAt(i);
  }

  private frame(t: number) {
    const x = Math.min(Math.max(t * this.a.fps - .5, 0), this.a.frames.count - 1);
    const i = Math.floor(x);
    return { i, j: Math.min(i + 1, this.a.frames.count - 1), w: x - i };
  }

  /** 0~1. 분석에서 이미 미터처럼 다듬은 값이다 */
  feature(name: Feature, t: number) {
    const v = this.a.frames[name];
    const { i, j, w } = this.frame(t);
    return v[i] + (v[j] - v[i]) * w;
  }

  /** 32칸 스펙트럼(0~1). 낮은 칸이 저역 */
  spectrum(t: number, out: Float32Array) {
    const { i, j, w } = this.frame(t);
    const n = this.bands;
    for (let b = 0; b < n; b++) {
      const p = this.spec[i * n + b], q = this.spec[j * n + b];
      out[b] = (p + (q - p) * w) / 255;
    }
    return out;
  }

  /** 곡 전체 파형 개요에서 t 자리의 높이(0~1) */
  peak(t: number) {
    const p = this.a.peaks;
    const x = Math.min(Math.max(t / this.duration, 0), 1) * (p.length - 1);
    const i = Math.floor(x), j = Math.min(i + 1, p.length - 1);
    return p[i] + (p[j] - p[i]) * (x - i);
  }

  beatIndex(t: number) { return lastAtOrBefore(this.a.beats, t); }
  barIndex(t: number) { return lastAtOrBefore(this.a.downbeats, t); }
  sectionIndex(t: number) {
    const s = this.a.sections;
    for (let i = s.length - 1; i >= 0; i--) if (t >= s[i].start) return i;
    return 0;
  }

  /** 마지막 박 이후 흐른 시간. 박 전이면 무한대 */
  sinceBeat(t: number) {
    const i = this.beatIndex(t);
    return i < 0 ? Infinity : t - this.a.beats[i];
  }
  sinceDownbeat(t: number) {
    const i = this.barIndex(t);
    return i < 0 ? Infinity : t - this.a.downbeats[i];
  }
}
