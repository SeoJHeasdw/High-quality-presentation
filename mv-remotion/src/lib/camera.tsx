/**
 * 카메라와 깊이 층. 한 장면(Scene)은 여러 층(Layer)을 겹친다. 층마다 깊이 d가 있다.
 *   d = 1     주인공이 서 있는 면. 카메라 이동·줌을 그대로 받는다
 *   d > 1     먼 층. 이동이 1/d로 줄어든다(시차). d = Infinity는 하늘처럼 움직이지 않는다
 *   d < 1     카메라 앞을 스치는 전경. 더 빨리 움직이고 흐려진다
 * 초점(focus)에서 멀수록 흐려진다(피사계 심도). 좌표는 깊이 1, 줌 1일 때의 화면 px(1920×1080)이다.
 */
import React, { createContext, useContext } from "react";

export const W = 1920, H = 1080;

export type Cam = {
  /** 화면 가운데가 보는 세계 좌표(깊이 1 기준). 기본 960, 540 */
  x: number; y: number;
  /** 줌(1 = 그대로) */
  zoom?: number;
  /** 카메라 기울기(rad) */
  rot?: number;
  /** 초점 깊이(기본 1) */
  focus?: number;
  /** 심도 세기(기본 5). 0이면 흐림 없음 */
  dof?: number;
};
export const CAM0: Cam = { x: 960, y: 540, zoom: 1 };

type Ctx = { cam: Cam };
const SceneCtx = createContext<Ctx>({ cam: CAM0 });
export const useCam = () => useContext(SceneCtx).cam;

/** 깊이 d 층의 SVG transform */
export function layerTransform(cam: Cam, d: number) {
  const z = cam.zoom ?? 1;
  if (!isFinite(d)) return `translate(960 540) rotate(${((cam.rot ?? 0) * 180) / Math.PI}) scale(${1 + (z - 1) * .04}) translate(-960 -540)`;
  const s = 1 + (z - 1) / d;
  const cx = 960 + (cam.x - 960) / d, cy = 540 + (cam.y - 540) / d;
  return `translate(960 540) rotate(${((cam.rot ?? 0) * 180) / Math.PI}) scale(${s}) translate(${-cx} ${-cy})`;
}

/** 깊이 d의 세계 점이 화면 어디에 찍히나 */
export function project(cam: Cam, d: number, x: number, y: number) {
  const z = cam.zoom ?? 1;
  const s = isFinite(d) ? 1 + (z - 1) / d : 1;
  const cx = isFinite(d) ? 960 + (cam.x - 960) / d : 960, cy = isFinite(d) ? 540 + (cam.y - 540) / d : 540;
  const r = cam.rot ?? 0;
  const dx = (x - cx) * s, dy = (y - cy) * s;
  return { x: 960 + dx * Math.cos(r) - dy * Math.sin(r), y: 540 + dx * Math.sin(r) + dy * Math.cos(r), s };
}

export function dofBlur(cam: Cam, d: number) {
  const f = cam.focus ?? 1, k = cam.dof ?? 5;
  const inv = isFinite(d) ? 1 / d : 0;
  return Math.abs(inv - 1 / f) * k;
}

export const Scene: React.FC<{ cam: Cam; bg?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ cam, bg = "#000", children, style }) => (
  <SceneCtx.Provider value={{ cam }}>
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: bg, ...style }}>{children}</div>
  </SceneCtx.Provider>
);

/**
 * 깊이 층 하나 = 화면 전체 크기 SVG 하나.
 *   blur: 심도 흐림을 직접 정한다(px). 안 주면 초점에서 떨어진 만큼 자동
 *   blend: mix-blend-mode(빛 층은 "screen" 또는 "plus-lighter")
 */
export const Layer: React.FC<{
  d?: number; blur?: number; blend?: React.CSSProperties["mixBlendMode"]; opacity?: number;
  children: React.ReactNode; defs?: React.ReactNode; style?: React.CSSProperties;
}> = ({ d = 1, blur, blend, opacity, children, defs, style }) => {
  const cam = useCam();
  const b = blur ?? dofBlur(cam, d);
  return (
    <svg
      width={W} height={H} viewBox={`0 0 ${W} ${H}`}
      style={{ position: "absolute", inset: 0, overflow: "visible", mixBlendMode: blend, opacity, filter: b > .35 ? `blur(${b.toFixed(2)}px)` : undefined, ...style }}
    >
      {defs ? <defs>{defs}</defs> : null}
      <g transform={layerTransform(cam, d)}>{children}</g>
    </svg>
  );
};

/** 카메라를 따르지 않는 화면 고정 층(전환·빛 번짐·글자 없는 오버레이) */
export const Screen: React.FC<{ children: React.ReactNode; blend?: React.CSSProperties["mixBlendMode"]; opacity?: number; blur?: number; defs?: React.ReactNode }> = ({ children, blend, opacity, blur, defs }) => (
  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, mixBlendMode: blend, opacity, filter: blur ? `blur(${blur}px)` : undefined }}>
    {defs ? <defs>{defs}</defs> : null}
    {children}
  </svg>
);

/** 고유 id(SVG url(#id)용). React useId에서 기호를 뺀다 */
export function useUid(prefix = "u") {
  return prefix + React.useId().replace(/[^a-zA-Z0-9]/g, "");
}

/** 화면 점(sx, sy)이 깊이 d 층의 어느 세계 점인가(project의 역) */
export function unproject(cam: Cam, d: number, sx: number, sy: number) {
  const z = cam.zoom ?? 1;
  const s = isFinite(d) ? 1 + (z - 1) / d : 1;
  const cx = isFinite(d) ? 960 + (cam.x - 960) / d : 960, cy = isFinite(d) ? 540 + (cam.y - 540) / d : 540;
  const r = -(cam.rot ?? 0);
  const dx = sx - 960, dy = sy - 540;
  const rx = dx * Math.cos(r) - dy * Math.sin(r), ry = dx * Math.sin(r) + dy * Math.cos(r);
  return { x: rx / s + cx, y: ry / s + cy };
}
