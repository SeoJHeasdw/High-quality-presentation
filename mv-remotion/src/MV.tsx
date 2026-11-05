/**
 * 뮤비 본체: 컷들을 시간에 이어 붙이고(전환 포함), 곡을 깔고, 모든 컷 위에 마감(입자·비네트)을 얹는다.
 * 컷 목록은 shots/act1~5.tsx. 화면은 시각 t만 보고 그린다.
 */
import React from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from "remotion";
import { FPS, DURATION, beatAt, beatPulse, feature } from "./lib/song";
import { clamp, ease, smooth } from "./lib/math";
import { Grain, Vignette, Wash } from "./lib/post";
import type { Shot, ShotCtx } from "./shots/types";

function ctxFor(s: Shot, end: number, t: number): ShotCtx {
  const dur = end - s.start;
  const lt = t - s.start;
  return {
    t, lt, dur, p: clamp(lt / dur), beat: beatAt(t), beat0: Math.round(beatAt(s.start + .01)),
    pulse: beatPulse(t, .22), level: feature("level", t), low: feature("low", t), hit: feature("hit", t),
  };
}

const ShotView: React.FC<{ s: Shot; end: number; t: number; style?: React.CSSProperties }> = ({ s, end, t, style }) => (
  <AbsoluteFill style={style}>{s.render(ctxFor(s, end, t))}</AbsoluteFill>
);

export const MV: React.FC<{ shots: Shot[]; audio?: boolean; grain?: boolean }> = ({ shots, audio = true, grain = true }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const list = [...shots].sort((a, b) => a.start - b.start);
  const ends = list.map((s, i) => (i + 1 < list.length ? list[i + 1].start : DURATION));
  let i = list.findIndex((s, k) => t >= s.start && t < ends[k]);
  const before = list.length && t < list[0].start;
  if (i < 0 && !before) i = list.length - 1;

  const layers: React.ReactNode[] = [];
  let wash = 0, washColor = "#000";
  if (i >= 0) {
    const s = list[i], e = s.enter ?? { type: "cut" as const };
    const prev = i > 0 ? list[i - 1] : null;
    const next = i + 1 < list.length ? list[i + 1] : null;
    const lt = t - s.start;
    const toEnd = ends[i] - t;
    // 이 컷이 들어오는 전환
    const dur = "dur" in e && e.dur ? e.dur : e.type === "whip" ? .3 : e.type === "cross" ? .6 : e.type === "iris" ? .7 : e.type === "flash" ? .35 : .5;
    if ((e.type === "cross" || e.type === "whip") && prev && lt < dur / 2) {
      const k = (lt + dur / 2) / dur; // .5 → 1
      layers.push(transitionPair(e, prev, s.start, s, ends[i], t, k));
    } else if (e.type === "iris" && prev && lt < dur) {
      const k = ease("expoOut", lt / dur);
      const cx = e.cx ?? 960, cy = e.cy ?? 540;
      layers.push(<ShotView key="p" s={prev} end={s.start} t={t} />);
      layers.push(<ShotView key="c" s={s} end={ends[i]} t={t} style={{ clipPath: `circle(${(k * 2300).toFixed(1)}px at ${cx}px ${cy}px)` }} />);
    } else {
      layers.push(<ShotView key="c" s={s} end={ends[i]} t={t} />);
    }
    // 다음 컷이 cross/whip이면 이 컷 끝 dur/2부터 겹친다
    const ne = next?.enter;
    if (next && ne && (ne.type === "cross" || ne.type === "whip")) {
      const nd = ne.dur ?? (ne.type === "whip" ? .3 : .6);
      if (toEnd < nd / 2) {
        const k = (nd / 2 - toEnd) / nd; // 0 → .5
        layers.length = 0;
        layers.push(transitionPair(ne, s, ends[i], next, ends[i + 1], t, k));
      }
    }
    if (e.type === "flash" && lt < dur) { wash = Math.max(wash, (1 - ease("out", lt / dur)) * .85); washColor = e.color ?? "#fff3d6"; }
    if (e.type === "dip" && lt < dur / 2) { wash = Math.max(wash, 1 - smooth(0, dur / 2, lt)); washColor = "#000"; }
    if (e.type === "white" && lt < dur / 2) { wash = Math.max(wash, 1 - smooth(0, dur / 2, lt)); washColor = "#fffaf0"; }
    if (ne && (ne.type === "dip" || ne.type === "white")) {
      const nd = ne.dur ?? .5;
      if (toEnd < nd / 2) { wash = Math.max(wash, smooth(nd / 2, 0, toEnd)); washColor = ne.type === "dip" ? "#000" : "#fffaf0"; }
    }
  }
  // 처음과 끝
  const fade = Math.max(1 - smooth(0, 1.4, t), smooth(DURATION - 2.4, DURATION - .2, t));

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {layers}
      <Wash a={wash} color={washColor} />
      {grain ? <Grain frame={frame} /> : null}
      <Vignette amount={.5} />
      <Wash a={fade} color="#000" />
      {audio ? <Audio src={staticFile("song.wav")} /> : null}
    </AbsoluteFill>
  );
};

function transitionPair(e: NonNullable<Shot["enter"]>, a: Shot, aEnd: number, b: Shot, bEnd: number, t: number, k: number) {
  if (e.type === "whip") {
    const dir = e.dir ?? 1;
    const x = ease("expoIO", k);
    const blur = Math.sin(k * Math.PI) * 60;
    return (
      <AbsoluteFill key="w" style={{ filter: `blur(${blur.toFixed(1)}px)` }}>
        <ShotView s={a} end={aEnd} t={t} style={{ transform: `translateX(${(-dir * x * 1920).toFixed(1)}px)` }} />
        <ShotView s={b} end={bEnd} t={t} style={{ transform: `translateX(${(dir * (1 - x) * 1920).toFixed(1)}px)` }} />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill key="x">
      <ShotView s={a} end={aEnd} t={t} />
      <ShotView s={b} end={bEnd} t={t} style={{ opacity: ease("sineIO", k) }} />
    </AbsoluteFill>
  );
}
