/**
 * 도시 재료. 실루엣 건물 + 창 불빛. 먼 층일수록 색을 fog 쪽으로 섞어(공기 원근) 깊이를 만든다.
 *   Skyline     건물 줄(옥상 물탱크·안테나·계단식 지붕). ignite로 창이 하나씩 켜진다
 *   Facade      카메라 가까이 있는 건물 벽(창 격자·실외기·배수관)
 *   WindowFrame 창틀. children은 유리 너머 풍경(창 안에 잘린다). open은 창이 열린 정도
 *   Parapet·Antenna·WaterTank·Laundry·Bed·Curtain  지붕·방 소품
 */
import React from "react";
import { useUid } from "./camera";
import { clamp, mix, n2, rnd } from "./math";
import { Glow } from "./sky";

export type WinStyle = { density?: number; warm?: string; cold?: string; coldRatio?: number; size?: number; glow?: number };

type Bld = { x: number; w: number; h: number; roof: number; seed: number };
export function buildings(seed: number, x0: number, x1: number, minH: number, maxH: number, minW = 70, maxW = 210): Bld[] {
  const out: Bld[] = [];
  let x = x0, i = 0;
  while (x < x1) {
    const w = mix(minW, maxW, rnd(seed, i * 5));
    const h = mix(minH, maxH, Math.pow(rnd(seed, i * 5 + 1), 1.3));
    out.push({ x, w, h, roof: rnd(seed, i * 5 + 2), seed: seed * 1000 + i });
    x += w + (rnd(seed, i * 5 + 3) > .7 ? mix(4, 30, rnd(seed, i * 5 + 4)) : 0);
    i++;
  }
  return out;
}

export const Skyline: React.FC<{
  seed: number; x0?: number; x1?: number; base: number; minH: number; maxH: number; minW?: number; maxW?: number;
  color: string; win?: WinStyle; t?: number;
  /** 건물 순서(0..1)와 창 번호로 0..1 켜짐. 없으면 density대로 켜져 있다 */
  ignite?: (u: number, i: number) => number;
  details?: boolean;
}> = ({ seed, x0 = -600, x1 = 2520, base, minH, maxH, minW, maxW, color, win, t = 0, ignite, details = true }) => {
  const bs = buildings(seed, x0, x1, minH, maxH, minW, maxW);
  const W = { density: .22, warm: "#ffbe6a", cold: "#a8d4ff", coldRatio: .25, size: 1, glow: 0, ...win };
  return (
    <g>
      {bs.map((b, bi) => {
        const top = base - b.h;
        const parts: React.ReactNode[] = [];
        // 몸통 + 지붕
        let d = `M${b.x},${base}L${b.x},${top}`;
        if (b.roof > .82) {
          const sw = b.w * .55;
          d += `L${b.x + (b.w - sw) / 2},${top}L${b.x + (b.w - sw) / 2},${top - b.h * .12}L${b.x + (b.w + sw) / 2},${top - b.h * .12}L${b.x + (b.w + sw) / 2},${top}`;
        } else if (b.roof > .7) {
          d += `L${b.x + b.w / 2},${top - b.w * .28}`;
        }
        d += `L${b.x + b.w},${top}L${b.x + b.w},${base}Z`;
        parts.push(<path key="b" d={d} fill={color} />);
        if (details) {
          if (b.roof > .45 && b.roof <= .62) {
            const tx = b.x + b.w * (.2 + rnd(b.seed, 1) * .5), tw = Math.min(46, b.w * .3);
            parts.push(
              <g key="t" fill={color}>
                <rect x={tx} y={top - tw * 1.1} width={tw} height={tw * .9} rx={tw * .12} />
                <path d={`M${tx + tw * .5},${top - tw * 1.1}L${tx - tw * .08},${top - tw * 1.35}L${tx + tw * 1.08},${top - tw * 1.35}Z`} />
                <rect x={tx + tw * .1} y={top - tw * .25} width={tw * .08} height={tw * .3} />
                <rect x={tx + tw * .82} y={top - tw * .25} width={tw * .08} height={tw * .3} />
              </g>,
            );
          }
          if (b.roof > .62 && b.roof <= .7 || b.roof > .9) {
            const ax = b.x + b.w * (.3 + rnd(b.seed, 2) * .4), ah = 40 + rnd(b.seed, 3) * 90;
            parts.push(<g key="a" stroke={color} strokeWidth={3}><line x1={ax} y1={top} x2={ax} y2={top - ah - (b.roof > .82 ? b.h * .12 : 0)} /><line x1={ax - 12} y1={top - ah * .6} x2={ax + 12} y2={top - ah * .6} /></g>);
            if (rnd(b.seed, 4) > .5) parts.push(<Glow key="ab" x={ax} y={top - ah - (b.roof > .82 ? b.h * .12 : 0)} r={10} color="#ff5a4a" opacity={.5 + .5 * Math.sin(t * 3 + bi)} />);
          }
          if (b.roof < .25) parts.push(<rect key="ac" x={b.x + b.w * .15} y={top - 14} width={b.w * .22} height={14} fill={color} />);
        }
        // 창
        const ws = 9 * W.size * clamp(b.w / 140, .6, 1.3);
        const cols = Math.max(2, Math.floor((b.w - ws) / (ws * 2.1)));
        const rows = Math.max(2, Math.floor((b.h - ws * 2) / (ws * 2.6)));
        const gx = (b.w - cols * ws) / (cols + 1), gy = ws * 1.6;
        const wins: React.ReactNode[] = [];
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const k = r * cols + c;
          const rv = rnd(b.seed, 100 + k);
          let on = rv < W.density ? 1 : 0;
          if (ignite) on = Math.max(on * 0, ignite(bi / Math.max(1, bs.length - 1), k));
          if (on <= .01) continue;
          const cold = rnd(b.seed, 300 + k) < W.coldRatio && !ignite;
          const flick = cold ? .65 + .35 * Math.sin(t * (5 + rnd(b.seed, 400 + k) * 7) + k) : 1;
          const x = b.x + gx + c * (ws + gx), y = top + ws * 1.2 + r * (ws + gy);
          if (y > base - ws) continue;
          wins.push(<rect key={k} x={x} y={y} width={ws} height={ws * 1.25} fill={cold ? W.cold : W.warm} opacity={on * flick * (.55 + rnd(b.seed, 500 + k) * .45)} />);
        }
        return <g key={bi}>{parts}{wins}</g>;
      })}
    </g>
  );
};

/** 가까운 건물 벽. lit(c, r) → [밝기 0..1, 색] */
export const Facade: React.FC<{
  x: number; y: number; w: number; h: number; cols: number; rows: number;
  wall: string; frame?: string; glass?: string;
  lit?: (c: number, r: number) => [number, string] | null;
  seed?: number; pipe?: boolean; ac?: boolean;
}> = ({ x, y, w, h, cols, rows, wall, frame, glass = "#0a0d1a", lit, seed = 7, pipe = true, ac = true }) => {
  const cw = w / cols, rh = h / rows;
  const ww = cw * .5, wh = rh * .55;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={wall} />
      {Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => {
        const wx = x + c * cw + (cw - ww) / 2, wy = y + r * rh + (rh - wh) * .4;
        const L = lit ? lit(c, r) : null;
        return (
          <g key={`${r}-${c}`}>
            <rect x={wx - 5} y={wy - 5} width={ww + 10} height={wh + 10} fill={frame ?? wall} />
            <rect x={wx} y={wy} width={ww} height={wh} fill={glass} />
            {L && L[0] > 0 ? <rect x={wx} y={wy} width={ww} height={wh} fill={L[1]} opacity={L[0]} /> : null}
            {L && L[0] > .3 ? <Glow x={wx + ww / 2} y={wy + wh / 2} r={ww * 1.1} color={L[1]} opacity={L[0] * .35} /> : null}
            <rect x={wx - 8} y={wy + wh + 3} width={ww + 16} height={7} fill={frame ?? wall} />
            {ac && rnd(seed, r * 31 + c) > .78 ? <rect x={wx + ww + 12} y={wy + wh * .55} width={ww * .35} height={wh * .4} fill={frame ?? wall} /> : null}
          </g>
        );
      }))}
      {pipe ? <rect x={x + w * (.08 + rnd(seed, 999) * .1)} y={y} width={10} height={h} fill={frame ?? wall} /> : null}
    </g>
  );
};

/** 창틀. children = 유리 너머(창 크기에 잘린다). open 0..1이면 오른쪽 창짝이 안으로 열린다 */
export const WindowFrame: React.FC<{
  x: number; y: number; w: number; h: number; frame: string; thick?: number; cross?: boolean; open?: number;
  children?: React.ReactNode; glassTint?: string; reflect?: number;
}> = ({ x, y, w, h, frame, thick = 18, cross = true, open = 0, children, glassTint, reflect = .12 }) => {
  const id = useUid("win");
  const sash = w / 2;
  const ow = sash * Math.cos(open * 1.35);
  return (
    <g>
      <defs>
        <clipPath id={id}><rect x={x} y={y} width={w} height={h} /></clipPath>
        <linearGradient id={id + "r"} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="45%" stopColor="#ffffff" stopOpacity={reflect} />
          <stop offset="55%" stopColor="#ffffff" stopOpacity={0} />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${id})`}>
        {children}
        {glassTint ? <rect x={x} y={y} width={w - (open > 0 ? sash : 0)} height={h} fill={glassTint} /> : null}
        <rect x={x} y={y} width={w - (open > 0 ? sash : 0)} height={h} fill={`url(#${id}r)`} />
      </g>
      {/* 바깥 틀 */}
      <path d={`M${x - thick},${y - thick}H${x + w + thick}V${y + h + thick}H${x - thick}Z M${x},${y}V${y + h}H${x + w}V${y}Z`} fill={frame} fillRule="evenodd" />
      {/* 가운데 세로살(닫힌 쪽) */}
      <rect x={x + sash - thick * .4} y={y} width={thick * .8} height={h} fill={frame} />
      {cross ? <rect x={x} y={y + h * .42} width={sash} height={thick * .6} fill={frame} /> : null}
      {/* 열리는 창짝(오른쪽): 안쪽으로 열리며 가로로 좁아진다 */}
      {open > 0 ? (
        <g>
          <rect x={x + w - 2} y={y} width={-ow} height={h} fill="none" />
          <path d={`M${x + w},${y}L${x + w + ow * .0 - (sash - ow) * .0 - ow},${y - h * .03 * open}L${x + w - ow},${y + h * (1 + .03 * open)}L${x + w},${y + h}Z`} fill={glassTint ?? "#0a0d1a"} opacity={.35} />
          <path d={`M${x + w},${y}L${x + w - ow},${y - h * .03 * open}L${x + w - ow},${y + h * (1 + .03 * open)}L${x + w},${y + h}`} stroke={frame} strokeWidth={thick * .7} fill="none" strokeLinejoin="round" />
        </g>
      ) : (
        cross ? <rect x={x + sash} y={y + h * .42} width={sash} height={thick * .6} fill={frame} /> : null
      )}
    </g>
  );
};

export const Parapet: React.FC<{ x0: number; x1: number; y: number; h?: number; color: string; depth?: number }> = ({ x0, x1, y, h = 40, color, depth = 2200 }) => (
  <g fill={color}>
    <rect x={x0} y={y} width={x1 - x0} height={depth} />
    <rect x={x0 - 8} y={y - h} width={x1 - x0 + 16} height={h} />
    <rect x={x0 - 16} y={y - h - 10} width={x1 - x0 + 32} height={12} />
  </g>
);

export const Antenna: React.FC<{ x: number; y: number; h: number; color: string; t?: number; seed?: number; light?: string }> = ({ x, y, h, color, t = 0, seed = 1, light }) => {
  const sw = n2(seed, t * .6) * h * .01;
  return (
    <g stroke={color} strokeLinecap="round" fill="none">
      <line x1={x} y1={y} x2={x + sw} y2={y - h} strokeWidth={Math.max(3, h * .025)} />
      {[.55, .72, .86].map((u, i) => <line key={i} x1={x + sw * u - h * (.18 - i * .04)} y1={y - h * u} x2={x + sw * u + h * (.18 - i * .04)} y2={y - h * u} strokeWidth={Math.max(2, h * .014)} />)}
      <line x1={x} y1={y} x2={x - h * .25} y2={y - h * .02} strokeWidth={2} />
      {light ? <Glow x={x + sw} y={y - h} r={h * .08} color={light} opacity={.6 + .4 * Math.sin(t * 2.5 + seed)} /> : null}
    </g>
  );
};

export const WaterTank: React.FC<{ x: number; y: number; s: number; color: string }> = ({ x, y, s, color }) => (
  <g fill={color}>
    <rect x={x - s * .5} y={y - s * 1.35} width={s} height={s * .95} rx={s * .1} />
    <path d={`M${x - s * .58},${y - s * 1.35}L${x},${y - s * 1.7}L${x + s * .58},${y - s * 1.35}Z`} />
    <rect x={x - s * .42} y={y - s * .42} width={s * .07} height={s * .42} />
    <rect x={x + s * .35} y={y - s * .42} width={s * .07} height={s * .42} />
    <rect x={x - s * .45} y={y - s * .3} width={s * .9} height={s * .05} />
  </g>
);

/** 빨랫줄: 두 점 사이 늘어진 줄 + 바람에 흔들리는 옷 */
export const Laundry: React.FC<{ x0: number; y0: number; x1: number; y1: number; sag?: number; color: string; t: number; wind?: number; items?: number; seed?: number; tints?: string[] }> = ({ x0, y0, x1, y1, sag = 40, color, t, wind = 1, items = 6, seed = 3, tints }) => {
  const at = (u: number) => ({ x: mix(x0, x1, u), y: mix(y0, y1, u) + Math.sin(u * Math.PI) * sag });
  return (
    <g>
      <path d={`M${x0},${y0}Q${(x0 + x1) / 2},${(y0 + y1) / 2 + sag * 2} ${x1},${y1}`} stroke={color} strokeWidth={2.5} fill="none" />
      {Array.from({ length: items }, (_, i) => {
        const u = (i + .6) / (items + .2);
        const p = at(u);
        const w = 34 + rnd(seed, i) * 30, h = 40 + rnd(seed, i + 9) * 40;
        const sw = n2(seed + i, t * .9 * wind) * 14 * wind + wind * 6;
        const kind = rnd(seed, i + 20);
        const fill = tints ? tints[i % tints.length] : color;
        const d = kind > .5
          ? `M${p.x - w / 2},${p.y}L${p.x + w / 2},${p.y}L${p.x + w / 2 + sw * .4},${p.y + h * .35}L${p.x + w * .35 + sw},${p.y + h}L${p.x - w * .35 + sw},${p.y + h}L${p.x - w / 2 + sw * .4},${p.y + h * .35}Z`
          : `M${p.x - w / 2},${p.y}L${p.x + w / 2},${p.y}L${p.x + w / 2 + sw},${p.y + h}L${p.x - w / 2 + sw},${p.y + h}Z`;
        return <path key={i} d={d} fill={fill} />;
      })}
    </g>
  );
};

export const Bed: React.FC<{ x: number; y: number; w: number; color: string; blanket?: string }> = ({ x, y, w, color, blanket }) => (
  <g>
    <rect x={x} y={y - w * .18} width={w} height={w * .18} fill={color} />
    <rect x={x - 10} y={y - w * .42} width={26} height={w * .42} rx={6} fill={color} />
    <rect x={x + w - 16} y={y - w * .3} width={22} height={w * .3} rx={6} fill={color} />
    <path d={`M${x + 20},${y - w * .18}Q${x + w * .4},${y - w * .3} ${x + w * .7},${y - w * .2}T${x + w},${y - w * .2}L${x + w},${y - w * .1}L${x + 20},${y - w * .1}Z`} fill={blanket ?? color} />
    <ellipse cx={x + w * .14} cy={y - w * .21} rx={w * .1} ry={w * .045} fill={blanket ?? color} />
  </g>
);

/** 커튼: 창 옆에서 바람(wind 0..1)에 부푼다 */
export const Curtain: React.FC<{ x: number; y: number; w: number; h: number; color: string; t: number; wind?: number; side?: 1 | -1; seed?: number; opacity?: number }> = ({ x, y, w, h, color, t, wind = 0, side = 1, seed = 2, opacity = 1 }) => {
  const k = 6;
  const pts: string[] = [];
  for (let i = 0; i <= k; i++) {
    const u = i / k;
    const bulge = wind * (90 + 60 * n2(seed, t * 1.6 + u * 2)) * Math.sin(u * Math.PI * .9) * side;
    const wave = Math.sin(u * 7 + t * (2 + wind * 6)) * 8 * (.3 + wind);
    pts.push(`${x + w + bulge + wave},${y + u * h}`);
  }
  return <path d={`M${x},${y}L${pts.join("L")}L${x},${y + h}Z`} fill={color} opacity={opacity} />;
};
