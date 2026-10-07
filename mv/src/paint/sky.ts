/**
 * 고흐풍 하늘과 달. 깨끗한 장면에 그려서 붓질 패스(painter.ts)가 다시 칠한다.
 *
 * 매끈한 그라데이션과 직선 십자 빛살은 붓질 뒤에도 "컴퓨터 그림"으로 남는다. 그래서
 *   · 하늘은 붓 방향(흐름장)을 따라 흐르는 밝고 어두운 빛줄기로 깔고,
 *   · 달과 별은 동심원 고리(헤일로)를 색 띠로 칠해 붓이 고리를 따라 돌게 한다(소용돌이 붓결은 swirlsOf).
 * 모든 값은 시각 t 하나에서 나온다.
 */
import { W, hash, clamp, mix } from "../scenes.ts";
import { flowAngle, type Swirl } from "./painter.ts";

const TAU = Math.PI * 2;

function mixHex(a: string, b: string, w: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(mix((pa >> s) & 255, (pb >> s) & 255, w));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

/** "#rrggbb" + 투명도 → rgba */
export function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ── 하늘 ───────────────────────────────────────────── */

export type SkyOpts = {
  seed: number;
  t: number;
  /** 하늘이 그려질 화면 y 범위(그 밖은 칠하지 않는다) */
  y0?: number;
  y1?: number;
  top?: string;
  bottom?: string;
  /** 빛줄기의 세기(0이면 매끈한 그라데이션만) */
  streak?: number;
  /** 빛줄기 색(어두운 쪽, 밝은 쪽) */
  deep?: string;
  lit?: string;
  /** 붓 흐름장의 폭(painter의 flowTurns와 같게 줘야 붓결과 빛줄기가 겹친다) */
  turns?: number;
};

/**
 * 하늘: 그라데이션 위에 흐름장을 따라가는 빛줄기를 겹친다. 붓이 같은 방향으로 칠하므로
 * 빛줄기가 붓자국의 결로 남아 고흐의 하늘처럼 소용돌이쳐 보인다. 화면 좌표(카메라 변환 전)에 그린다.
 */
export function skyPaint(c: CanvasRenderingContext2D, o: SkyOpts) {
  const y0 = o.y0 ?? -200, y1 = o.y1 ?? 1100;
  const top = o.top ?? "#080b26", bottom = o.bottom ?? "#191d4e";
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  c.fillStyle = g;
  c.fillRect(-1200, y0 - 2000, W + 2400, y1 - y0 + 2000);

  const amt = o.streak ?? 1;
  if (amt <= 0) return;
  const deep = o.deep ?? "#0c1038", lit = o.lit ?? "#2d3a8a";
  const turns = o.turns ?? 1.1, scale = .0022;
  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  const N = 120;
  for (let i = 0; i < N; i++) {
    // 씨앗 점은 격자에 흩뿌리고, 시간에 따라 흐름을 따라 천천히 흘러간다
    let x = hash(i, o.seed * 7 + 1) * (W + 300) - 150;
    let y = y0 + hash(i, o.seed * 7 + 2) * (y1 - y0);
    const drift = o.t * (3 + 4 * hash(i, o.seed * 7 + 3));
    for (let s = 0; s < drift; s += 6) {
      const a0 = flowAngle(x, y, o.seed, scale, turns);
      x += Math.cos(a0) * 6; y += Math.sin(a0) * 6;
    }
    const len = 14 + Math.floor(hash(i, o.seed * 7 + 4) * 22);
    const wid = 10 + hash(i, o.seed * 7 + 5) * 26;
    const bright = hash(i, o.seed * 7 + 6) > .45;
    // 아래(밝은 쪽)로 갈수록 밝은 줄기가 늘어난다
    const along = clamp((y - y0) / (y1 - y0));
    const isLit = bright && hash(i, o.seed * 7 + 8) < .25 + .6 * along;
    c.strokeStyle = rgba(isLit ? lit : deep, (isLit ? .22 : .3) * amt);
    c.lineWidth = wid;
    c.beginPath();
    c.moveTo(x, y);
    for (let s = 0; s < len; s++) {
      const a = flowAngle(x, y, o.seed, scale, turns);
      x += Math.cos(a) * 9; y += Math.sin(a) * 9;
      c.lineTo(x, y);
    }
    c.stroke();
  }
  c.restore();
}

/* ── 달 ─────────────────────────────────────────────── */

export type Moon = {
  x: number;
  y: number;
  r: number;
  /** 박에 맞춰 부푸는 정도(0~1). 고리가 살짝 숨 쉰다 */
  beat?: number;
  /** 밝기(0~1). 1이면 가장 밝다 */
  lit?: number;
  /** 시각(고리가 천천히 돈다) */
  t?: number;
};

/** 고리 색 띠: [반지름 배수, 색, 투명도]. 바깥에서 안으로 */
const MOON_RINGS: [number, string, number][] = [
  [2.9, "#27388f", .34],
  [2.45, "#3a54a8", .42],
  [2.05, "#5578c0", .5],
  [1.7, "#86a4d4", .55],
  [1.42, "#d6d49a", .7],
  [1.2, "#f0dc98", .85],
];

/**
 * 달: 고리 헤일로 + 면. 면은 붓이 돌아 칠하기 좋게 안쪽을 동심원 색 띠로 나눈다.
 * 달은 아이가 향하는 곳이다. 가까워질수록 r이 커진다.
 */
export function moonPaint(c: CanvasRenderingContext2D, m: Moon) {
  const { x, y, r } = m;
  const lit = m.lit ?? 1, breathe = 1 + .018 * (m.beat ?? 0), t = m.t ?? 0;
  c.save();
  c.translate(x, y);
  for (const [k, col, a] of MOON_RINGS) {
    // 고리는 완전한 원이 아니라 살짝 일그러진 원(손으로 돌려 칠한 느낌)
    const rr = r * k * breathe;
    c.fillStyle = rgba(col, a * lit);
    c.beginPath();
    for (let i = 0; i <= 48; i++) {
      const th = i / 48 * TAU;
      const wob = 1 + .018 * Math.sin(th * 3 + k * 5 + t * .3) + .012 * Math.sin(th * 5 - k * 3 - t * .2);
      const px = Math.cos(th) * rr * wob, py = Math.sin(th) * rr * wob;
      if (i) c.lineTo(px, py); else c.moveTo(px, py);
    }
    c.closePath();
    c.fill();
  }
  // 면: 바깥(황금빛) → 안(흰빛)으로 동심 띠
  const face: [number, string][] = [[1, "#f4cf72"], [.9, "#f8dc88"], [.78, "#fbe8a4"], [.64, "#fdf0bd"], [.48, "#fff6d2"], [.3, "#fffbe6"]];
  for (const [k, col] of face) {
    c.fillStyle = mixHex("#1b2266", col, lit);
    c.beginPath(); c.arc(0, 0, r * k * breathe, 0, TAU); c.fill();
  }
  // 바다(어두운 얼룩): 둥근 분화구 대신 붓으로 쓸어 놓은 듯한 덩어리
  c.save();
  c.beginPath(); c.arc(0, 0, r * .94 * breathe, 0, TAU); c.clip();
  c.fillStyle = rgba("#c9a860", .34 * lit);
  const maria: [number, number, number, number, number][] = [
    [-.34, -.28, .3, .2, .5], [.1, -.4, .26, .15, -.3], [.38, .0, .22, .3, .8], [-.18, .26, .34, .17, .1], [.2, .42, .2, .12, -.5],
  ];
  for (const [mx, my, rx, ry, rot] of maria) {
    c.beginPath(); c.ellipse(mx * r, my * r, rx * r, ry * r, rot, 0, TAU); c.fill();
  }
  c.restore();
  c.restore();
}

/** 달 둘레의 붓결 소용돌이: 고리를 따라 돈다 */
export function moonSwirls(m: Moon): Swirl[] {
  return [
    { x: m.x, y: m.y, r: m.r * 3.1, spin: 1, pitch: .12 },
  ];
}

/** 빛 층에 더하는 달무리. 고리는 이미 칠해 두었으므로 아주 옅게 번지기만 한다 */
export function moonBloom(c: CanvasRenderingContext2D, glow: HTMLCanvasElement, m: Moon, a = .22) {
  const lit = m.lit ?? 1;
  c.save();
  c.globalCompositeOperation = "lighter";
  c.globalAlpha = a * lit;
  const R = m.r * 3.2;
  c.drawImage(glow, m.x - R, m.y - R, R * 2, R * 2);
  c.restore();
}

/* ── 한 번에 ─────────────────────────────────────────── */

export type NightSky = {
  seed: number;
  /** 곡 위의 시각이 아니라 초당 15장으로 끊은 시각(f.tq) */
  t: number;
  moon?: Moon | null;
  /** 고리 별 개수와 그 별들이 놓일 가장 아래 y */
  stars?: number;
  starsY?: number;
  streak?: number;
  turns?: number;
  top?: string;
  bottom?: string;
  y1?: number;
  /** 소용돌이 구름 띠 개수 */
  clouds?: number;
  cloudY?: [number, number];
};

/** 하늘 한 벌: 빛줄기 하늘 + 고리 별 + (구름) + (달). 카메라 변환 전(화면 좌표)에 부른다 */
export function nightSky(c: CanvasRenderingContext2D, o: NightSky) {
  skyPaint(c, { seed: o.seed, t: o.t, y1: o.y1, top: o.top, bottom: o.bottom, streak: o.streak, turns: o.turns });
  if (o.stars !== 0) ringedStars(c, o.t, o.seed + 20, o.stars ?? 8, o.starsY ?? 600, 4, 10);
  if (o.clouds) cloudStreaks(c, o.t, o.seed + 3, o.clouds, o.cloudY?.[0] ?? 380, o.cloudY?.[1] ?? 760, "#6b63ae", .34, o.turns ?? 1.1);
  if (o.moon) moonPaint(c, o.moon);
}

/* ── 별 ─────────────────────────────────────────────── */

/** 고리 둘레의 작은 별(깨끗한 장면용). 별마다 고리 수·밝기가 다르다 */
export function ringedStar(c: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, ph = 0) {
  const tw = .75 + .25 * Math.sin(t * 2.2 + ph * 9);
  c.save();
  c.translate(x, y);
  const rings: [number, string, number][] = [[3.2, "#2c3f94", .22], [2.4, "#4a66b8", .3], [1.7, "#a8bfe0", .45], [1.25, "#f4e6a8", .8]];
  for (const [k, col, a] of rings) {
    c.fillStyle = rgba(col, a * tw);
    c.beginPath(); c.arc(0, 0, r * k, 0, TAU); c.fill();
  }
  c.fillStyle = mixHex("#fff1bb", "#ffffff", tw - .5);
  c.beginPath(); c.arc(0, 0, r * .8, 0, TAU); c.fill();
  c.restore();
}

/** 하늘에 흩뿌린 고리 별들. 화면 안에 일정하게 놓인다(카메라와 무관) */
export function ringedStars(c: CanvasRenderingContext2D, t: number, seed: number, n: number, maxY: number, minR = 5, maxR = 13) {
  for (let i = 0; i < n; i++) {
    const x = 90 + hash(i, seed + 11) * (W - 180);
    const y = 40 + hash(i, seed + 12) * (maxY - 40);
    ringedStar(c, x, y, minR + hash(i, seed + 13) * (maxR - minR), t, hash(i, seed + 14));
  }
}

/* ── 구름 ───────────────────────────────────────────── */

/**
 * 소용돌이치는 구름 띠. 흐름장을 따라 가며 굵기를 줄이는 밝은 붓 한 획씩.
 * (납작한 타원은 컴퓨터 도형처럼 보인다)
 */
export function cloudStreaks(c: CanvasRenderingContext2D, t: number, seed: number, n: number, y0: number, y1: number, color = "#6b63ae", alpha = .3, turns = 1.1) {
  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  for (let i = 0; i < n; i++) {
    let x = hash(i, seed * 13 + 1) * (W + 400) - 200;
    let y = y0 + hash(i, seed * 13 + 2) * (y1 - y0);
    const dx = (t * (6 + 5 * hash(i, seed * 13 + 3))) % (W + 900);
    x = ((x + dx + 450) % (W + 900)) - 450;
    const len = 46 + Math.floor(hash(i, seed * 13 + 4) * 30);
    const w0 = 10 + hash(i, seed * 13 + 5) * 16;
    const pts: { x: number; y: number }[] = [{ x, y }];
    for (let s = 0; s < len; s++) {
      // 구름은 옆으로 길게 흐르고 위아래로만 천천히 굽는다
      const a = Math.sin(flowAngle(x, y, seed, .0022, turns) * .5) * .5;
      x += Math.cos(a) * 15; y += Math.sin(a) * 15;
      pts.push({ x, y });
    }
    // 굵기를 나눠 그려 양 끝이 가늘어지게
    for (let s = 0; s + 1 < pts.length; s++) {
      const q = s / (pts.length - 1), e = Math.pow(Math.sin(q * Math.PI), .7);
      c.strokeStyle = rgba(color, alpha * e + .01);
      c.lineWidth = w0 * (.3 + .7 * e);
      c.beginPath(); c.moveTo(pts[s].x, pts[s].y); c.lineTo(pts[s + 1].x, pts[s + 1].y); c.stroke();
    }
  }
  c.restore();
}
