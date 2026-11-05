/**
 * 마감(후처리). 렌더 결과에 필름처럼 얹는다: 입자(grain)·비네트·번쩍임·검정 페이드.
 * 예전 뮤비에 없던 단계. 모든 컷 위에 공통으로 걸린다(MV.tsx).
 */
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { clamp, rnd } from "./math";

export const Grain: React.FC<{ frame: number; opacity?: number }> = ({ frame, opacity = .09 }) => {
  const i = frame % 4;
  const ox = Math.floor(rnd(31, frame) * 384), oy = Math.floor(rnd(47, frame) * 384);
  return (
    <AbsoluteFill style={{ mixBlendMode: "overlay", opacity, pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: -384, backgroundImage: `url(${staticFile(`grain/g${i}.png`)})`, backgroundSize: "384px 384px", transform: `translate(${ox}px, ${oy}px)` }} />
    </AbsoluteFill>
  );
};

export const Vignette: React.FC<{ amount?: number; color?: string }> = ({ amount = .55, color = "0,0,0" }) => (
  <AbsoluteFill style={{ pointerEvents: "none", background: `radial-gradient(ellipse 75% 70% at 50% 48%, rgba(${color},0) 55%, rgba(${color},${amount * .55}) 85%, rgba(${color},${amount}) 120%)` }} />
);

/** 색 덮개(번쩍임·검정·흰빛). a 0..1 */
export const Wash: React.FC<{ a: number; color?: string; blend?: React.CSSProperties["mixBlendMode"] }> = ({ a, color = "#000", blend }) =>
  a <= .001 ? null : <AbsoluteFill style={{ background: color, opacity: clamp(a), mixBlendMode: blend, pointerEvents: "none" }} />;

/** 빛 번짐(halation): 밝은 곳 둘레가 붉게 번지는 필름 느낌을 화면 가장자리 빛으로 흉내 낸다 */
export const Halation: React.FC<{ color?: string; opacity?: number }> = ({ color = "255,140,90", opacity = .12 }) => (
  <AbsoluteFill style={{ mixBlendMode: "screen", opacity, pointerEvents: "none", background: `radial-gradient(ellipse 120% 80% at 50% 120%, rgba(${color},.5), rgba(${color},0) 60%)` }} />
);

export { Img };
