/**
 * 유화 뮤비의 공용 재료. 깨끗한 장면용(하늘·도시·지붕·구름·달), 빛 층용(창 불빛·나방·별·빛의 실),
 * 붓질 뒤에 얹는 낙서(점선 궤적·느낌표·땀·어지러움·하트·반짝이·손글씨).
 * 색은 덱의 규칙을 잇는다: 남보라 밤(기계·세상), 금빛(사람·마음).
 */
import { W, H, hash, clamp, mix, smooth } from "../scenes.ts";
import { canvasWeave } from "./painter.ts";

export { W, H, hash, clamp, mix, smooth };

export const P = {
  sky0: "#080b26",
  sky1: "#191d4e",
  wall0: "#0a0d2a",
  wall1: "#11143c",
  floor0: "#151842",
  floor1: "#1d2050",
  cloud: "rgba(104,96,160,.42)",
  cloudLit: "rgba(150,138,196,.5)",
  gold: "#ffc864",
  goldCore: "#fff1c4",
  cold: "#cfdcff",
  ink: "#f4e7c6",
  heart: "#ff7d95",
  dotted: "#a9c0ff",
};

export type Key = [number, number];
export const easeIO = (x: number) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);

/** 키프레임 사이를 부드럽게 잇는다 */
export function key(t: number, ks: Key[]) {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 0; i < ks.length - 1; i++) {
    const [t0, v0] = ks[i], [t1, v1] = ks[i + 1];
    if (t < t1) return mix(v0, v1, easeIO((t - t0) / (t1 - t0)));
  }
  return ks[ks.length - 1][1];
}

export const blinkAt = (t: number, at: number[]) => (at.some((b) => Math.abs(t - b) < .07) ? 1 : 0);

/** 포물선 점프: 시작~끝 사이의 진행(0~1)과 높이 */
export function hop(t: number, t0: number, t1: number, h: number) {
  const p = clamp((t - t0) / (t1 - t0));
  return { p, y: -4 * h * p * (1 - p), air: t > t0 && t < t1 };
}

export function sprite(color: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, color);
  r.addColorStop(.25, color.replace(/[\d.]+\)$/, ".45)"));
  r.addColorStop(1, color.replace(/[\d.]+\)$/, "0)"));
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return c;
}

/* ── 미리 만들어 두는 것 ─────────────────────────────── */

export type Win = { x: number; y: number; w: number; h: number; r: number; warm: boolean };
export type Building = { x: number; y: number; w: number; h: number; color: string };
export type Moth = { win: number; rad: number; speed: number; phase: number; size: number };

export const HORIZON = 760;

function buildCity() {
  let seed = 4242;
  const rnd = () => hash(seed++, 77);
  const layers = [
    { color: "#141842", hMin: 120, hMax: 260, wMin: 90, wMax: 170, cw: 20, ch: 26, skip: .55 },
    { color: "#0d1034", hMin: 220, hMax: 440, wMin: 140, wMax: 240, cw: 30, ch: 38, skip: .5 },
    { color: "#070a22", hMin: 320, hMax: 640, wMin: 210, wMax: 330, cw: 44, ch: 54, skip: .45 },
  ];
  const buildings: Building[] = [];
  const wins: Win[] = [];
  layers.forEach((L, li) => {
    let x = -60 + rnd() * 40;
    while (x < W + 60) {
      const w = L.wMin + rnd() * (L.wMax - L.wMin);
      const h = L.hMin + Math.pow(rnd(), 1.3) * (L.hMax - L.hMin);
      buildings.push({ x, y: HORIZON - h, w, h: h + 400, color: L.color });
      const cols = Math.max(1, Math.floor(w / L.cw) - 1), rows = Math.max(1, Math.floor(h / L.ch) - 1);
      const ox = x + (w - cols * L.cw) / 2;
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
        if (rnd() < L.skip) continue;
        wins.push({ x: ox + k * L.cw + L.cw * .2, y: HORIZON - h + L.ch * .7 + r * L.ch, w: L.cw * .6, h: L.ch * .55, r: rnd() * (1.15 - li * .1), warm: rnd() < .82 });
      }
      x += w + rnd() * 14 - 4;
    }
  });
  const warm = wins.map((w, i) => (w.warm && w.w > 12 ? i : -1)).filter((i) => i >= 0);
  const moths: Moth[] = Array.from({ length: 34 }, (_, i) => ({
    win: warm[Math.floor(hash(i, 91) * warm.length)],
    rad: 18 + hash(i, 92) * 50,
    speed: 1.4 + hash(i, 93) * 2.2,
    phase: hash(i, 94) * Math.PI * 2,
    size: 9 + hash(i, 95) * 7,
  }));
  return { buildings, wins, moths };
}

export type Kit = ReturnType<typeof makeKit>;

export function makeKit() {
  const city = buildCity();
  const vignette = document.createElement("canvas");
  vignette.width = W; vignette.height = H;
  {
    const v = vignette.getContext("2d")!;
    const r = v.createRadialGradient(W / 2, H / 2, H * .28, W / 2, H / 2, H);
    r.addColorStop(0, "rgba(2,2,14,0)");
    r.addColorStop(1, "rgba(2,2,14,.72)");
    v.fillStyle = r;
    v.fillRect(0, 0, W, H);
  }
  return {
    city,
    weave: canvasWeave(256, 256),
    vignette,
    glowGold: sprite("rgba(255,200,100,1)"),
    glowCold: sprite("rgba(170,195,255,1)"),
    glowWhite: sprite("rgba(255,244,214,1)"),
    glowPink: sprite("rgba(255,150,170,1)"),
    stars: Array.from({ length: 220 }, (_, i) => ({ x: hash(i, 11) * (W + 400) - 200, y: hash(i, 12) * 1400 - 400, s: .8 + hash(i, 13) * 1.8, tw: hash(i, 14) })),
    blades: Array.from({ length: 2600 }, (_, i) => {
      const v = Math.pow(hash(i, 21), .8);
      return { x: hash(i, 22) * (W + 200) - 100, y: 340 + v * 760, h: 6 + v * 34, c: hash(i, 23) };
    }),
  };
}

/* ── 깨끗한 장면 ─────────────────────────────────────── */

export function skyFill(c: CanvasRenderingContext2D, y0: number, y1: number, top = P.sky0, bottom = P.sky1) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  c.fillStyle = g;
  c.fillRect(-1200, y0 - 2000, W + 2400, y1 - y0 + 2000);
}

export function starfield(c: CanvasRenderingContext2D, k: Kit, maxY: number, tq: number, a = 1) {
  for (const s of k.stars) {
    if (s.y > maxY) continue;
    const tw = .35 + .4 * (.5 + .5 * Math.sin(tq * (1 + s.tw * 2) + s.tw * 9));
    c.fillStyle = `rgba(230,228,255,${tw * a})`;
    c.fillRect(s.x, s.y, s.s * 1.6, s.s * 1.6);
  }
}

/** 납작한 구름 띠 */
export function cloudBands(c: CanvasRenderingContext2D, tq: number, seed: number, n: number, y0: number, dy: number, color = P.cloud, speed = 1) {
  c.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const x = ((hash(i, seed) * W + tq * (5 + i * 2) * speed) % (W + 800)) - 400;
    c.beginPath();
    c.ellipse(x, y0 + i * dy + hash(i, seed + 1) * 30, 240 + hash(i, seed + 2) * 260, 20 + hash(i, seed + 3) * 14, 0, 0, Math.PI * 2);
    c.fill();
  }
}

/** 몽글한 구름 바다(위가 밝다) */
export function cloudSea(c: CanvasRenderingContext2D, y: number, tq: number, seed: number, scroll = 0, tint = "#5a5596", shade = "#2a2a68") {
  for (let row = 0; row < 3; row++) {
    const yy = y + row * 70;
    const g = c.createLinearGradient(0, yy - 90, 0, yy + 120);
    g.addColorStop(0, tint);
    g.addColorStop(1, shade);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-200, H + 200);
    const step = 150 + row * 40;
    const off = ((scroll * (0.5 + row * .35) + tq * (4 + row * 3)) % step + step) % step;
    for (let x = -200 - off; x < W + 400; x += step) {
      const r = step * (.55 + .25 * hash(Math.floor((x + off) / step) + row * 50, seed));
      c.arc(x, yy, r, Math.PI, 0);
    }
    c.lineTo(W + 400, H + 200);
    c.closePath();
    c.fill();
    tint = mixHex(tint, shade, .35);
  }
}

function mixHex(a: string, b: string, w: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(mix((pa >> s) & 255, (pb >> s) & 255, w));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

export function moonDisc(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const g = c.createRadialGradient(x - r * .3, y - r * .3, r * .1, x, y, r);
  g.addColorStop(0, "#f6ecd2");
  g.addColorStop(1, "#c9bfa6");
  c.fillStyle = g;
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.fillStyle = "rgba(150,140,130,.35)";
  for (let i = 0; i < 7; i++) {
    c.beginPath();
    c.arc(x + (hash(i, 81) - .5) * r * 1.2, y + (hash(i, 82) - .5) * r * 1.2, r * (.08 + hash(i, 83) * .14), 0, Math.PI * 2);
    c.fill();
  }
}

/** 도시: 건물과 창. 켜진 비율 lit(0~1) */
export function cityBody(c: CanvasRenderingContext2D, k: Kit, lit: number) {
  for (const b of k.city.buildings) {
    c.fillStyle = b.color;
    c.fillRect(b.x, b.y, b.w, b.h);
    c.fillStyle = "rgba(60,70,150,.22)";
    c.fillRect(b.x, b.y, 3, b.h);
  }
  for (const w of k.city.wins) {
    const on = lit > w.r;
    c.fillStyle = on ? (w.warm ? P.gold : P.cold) : "rgba(50,58,115,.32)";
    c.fillRect(w.x, w.y, w.w, w.h);
  }
}

type Roof = { x: number; w: number; dy: number; kind: number };
const roofCache = new Map<number, Roof[]>();

/** 지붕 조각들(세계 좌표). 씨앗마다 한 번 만들어 둔다 */
function roofSegs(seed: number) {
  let segs = roofCache.get(seed);
  if (!segs) {
    segs = [];
    let x = -800;
    for (let i = 0; i < 80; i++) {
      const w = 380 + hash(i, seed) * 320;
      segs.push({ x, w, dy: (hash(i, seed + 1) - .5) * 60, kind: hash(i, seed + 2) });
      x += w;
    }
    roofCache.set(seed, segs);
  }
  return segs;
}

/** 지붕 줄. scroll만큼 왼쪽으로 흐른다. gapAt(화면 x)이 있으면 거기서 끊긴다 */
export function roofs(c: CanvasRenderingContext2D, y: number, scroll: number, seed: number, gapAt?: number) {
  for (const r of roofSegs(seed)) {
    const x = r.x - scroll;
    if (x > W + 400 || x + r.w < -400) continue;
    if (gapAt !== undefined && x >= gapAt) continue;
    const right = gapAt !== undefined ? Math.min(x + r.w, gapAt) : x + r.w;
    c.fillStyle = "#0b0d2a";
    c.fillRect(x, y + r.dy, right - x - 8, H - y + 400);
    c.fillStyle = "#2a2e6c";
    c.fillRect(x, y + r.dy, right - x - 8, 7);
    c.fillStyle = "#0f1234";
    if (r.kind < .3 && x + r.w * .3 + 86 < right) {
      c.fillRect(x + r.w * .3, y + r.dy - 90, 70, 90);
      c.fillRect(x + r.w * .3 - 8, y + r.dy - 100, 86, 14);
    } else if (r.kind < .55 && x + r.w * .6 < right) {
      c.fillRect(x + r.w * .6, y + r.dy - 160, 5, 160);
      c.fillRect(x + r.w * .6 - 30, y + r.dy - 140, 65, 4);
    }
  }
}

/** 지붕 높이(roofs와 같은 조각). 화면 x에서 발을 디딜 y */
export function roofY(x: number, y: number, scroll: number, seed: number) {
  for (const r of roofSegs(seed)) if (x < r.x - scroll + r.w) return y + r.dy;
  return y;
}

/* ── 빛 층 ───────────────────────────────────────────── */

export function windowGlow(c: CanvasRenderingContext2D, k: Kit, lit: number, sinceOn: (w: Win) => number, pulseFn: (age: number, d: number) => number) {
  for (const w of k.city.wins) {
    if (lit <= w.r) continue;
    const fresh = pulseFn(sinceOn(w), .35);
    const r = Math.max(w.w, w.h) * (1.5 + 1.8 * fresh);
    c.globalAlpha = .16 + .5 * fresh;
    c.drawImage(w.warm ? k.glowGold : k.glowCold, w.x + w.w / 2 - r, w.y + w.h / 2 - r, r * 2, r * 2);
  }
  c.globalAlpha = 1;
}

export function moth(c: CanvasRenderingContext2D, k: Kit, x: number, y: number, size: number, tq: number, ph: number, alpha = 1) {
  const flap = .25 + .75 * Math.abs(Math.sin(tq * 8 + ph));
  c.save();
  c.translate(x, y);
  c.globalAlpha = .55 * alpha;
  c.drawImage(k.glowGold, -size * 2.2, -size * 2.2, size * 4.4, size * 4.4);
  c.globalAlpha = alpha;
  for (const s of [-1, 1]) {
    c.save();
    c.scale(s, 1);
    c.fillStyle = "#ffd583";
    c.beginPath(); c.ellipse(size * .45, -size * .2, size * .5, size * .36 * flap + .4, -.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#f2b45c";
    c.beginPath(); c.ellipse(size * .32, size * .22, size * .3, size * .22 * flap + .4, .6, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  c.fillStyle = "#fff4d6";
  c.fillRect(-size * .07, -size * .4, size * .14, size * .8);
  c.restore();
}

export function starGlow(c: CanvasRenderingContext2D, k: Kit, x: number, y: number, r: number, a = 1) {
  c.globalAlpha = .7 * a;
  c.drawImage(k.glowGold, x - r * 3, y - r * 3, r * 6, r * 6);
  c.globalAlpha = a;
  c.drawImage(k.glowWhite, x - r, y - r, r * 2, r * 2);
  // 빛살 네 갈래
  c.strokeStyle = `rgba(255,240,205,${.55 * a})`;
  c.lineWidth = Math.max(1.5, r * .06);
  c.beginPath();
  c.moveTo(x - r * 2.4, y); c.lineTo(x + r * 2.4, y);
  c.moveTo(x, y - r * 2.4); c.lineTo(x, y + r * 2.4);
  c.stroke();
  c.globalAlpha = 1;
}

/** 빛나는 선(실). 넓고 옅은 빛 → 가늘고 밝은 심 */
export function glowLine(c: CanvasRenderingContext2D, pts: { x: number; y: number }[], w = 1.8, a = 1) {
  c.lineCap = "round";
  c.lineJoin = "round";
  for (const [wd, al, col] of [[w * 8, .05, "255,200,110"], [w * 3, .18, "255,214,140"], [w, .85, "255,243,210"]] as [number, number, string][]) {
    c.strokeStyle = `rgba(${col},${al * a})`;
    c.lineWidth = wd;
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.stroke();
  }
}

/* ── 붓질 뒤에 얹는 낙서 ─────────────────────────────── */

function wob(hold: number, i: number, amt: number) {
  return (hash(hold * 31 + i, 501) - .5) * amt;
}

/** 점선 궤적 + 끝의 X 표시(레퍼런스의 파란 점선) */
export function dotted(c: CanvasRenderingContext2D, pts: { x: number; y: number }[], hold: number, a = 1, cross = true) {
  c.save();
  c.globalAlpha = a;
  c.strokeStyle = P.dotted;
  c.lineWidth = 3;
  c.setLineDash([2, 12]);
  c.lineCap = "round";
  c.beginPath();
  pts.forEach((p, i) => (i ? c.lineTo(p.x + wob(hold, i, 2), p.y + wob(hold, i + 50, 2)) : c.moveTo(p.x, p.y)));
  c.stroke();
  c.setLineDash([]);
  if (cross && pts.length) {
    const e = pts[pts.length - 1];
    c.lineWidth = 3.5;
    c.beginPath();
    c.moveTo(e.x - 11, e.y - 11); c.lineTo(e.x + 11, e.y + 11);
    c.moveTo(e.x + 11, e.y - 11); c.lineTo(e.x - 11, e.y + 11);
    c.stroke();
  }
  c.restore();
}

export function bang(c: CanvasRenderingContext2D, x: number, y: number, s: number, hold: number, a = 1) {
  c.save();
  c.globalAlpha = a;
  c.strokeStyle = P.ink;
  c.fillStyle = P.ink;
  c.lineCap = "round";
  c.lineWidth = s * .14;
  c.beginPath();
  c.moveTo(x + wob(hold, 1, 3), y - s); c.lineTo(x + wob(hold, 2, 3), y - s * .25);
  c.stroke();
  c.beginPath(); c.arc(x, y + s * .02, s * .09, 0, Math.PI * 2); c.fill();
  // 놀람 선 세 줄
  for (const a2 of [-.6, 0, .6]) {
    c.beginPath();
    c.moveTo(x + Math.sin(a2) * s * 1.3, y - s * .5 - Math.cos(a2) * s * 1.1);
    c.lineTo(x + Math.sin(a2) * s * 1.7, y - s * .5 - Math.cos(a2) * s * 1.5);
    c.stroke();
  }
  c.restore();
}

export function sweat(c: CanvasRenderingContext2D, x: number, y: number, s: number, a = 1) {
  c.save();
  c.globalAlpha = a;
  c.fillStyle = "#9fc4ff";
  c.beginPath();
  c.moveTo(x, y - s);
  c.quadraticCurveTo(x + s * .7, y, x, y + s * .45);
  c.quadraticCurveTo(x - s * .7, y, x, y - s);
  c.fill();
  c.restore();
}

export function spiral(c: CanvasRenderingContext2D, x: number, y: number, s: number, tq: number, a = 1) {
  c.save();
  c.globalAlpha = a;
  c.strokeStyle = P.ink;
  c.lineWidth = s * .09;
  c.lineCap = "round";
  c.beginPath();
  for (let i = 0; i <= 40; i++) {
    const th = i / 40 * Math.PI * 4 + tq * 6;
    const r = s * i / 40;
    const px = x + Math.cos(th) * r, py = y + Math.sin(th) * r;
    if (i) c.lineTo(px, py); else c.moveTo(px, py);
  }
  c.stroke();
  c.restore();
}

export function heart(c: CanvasRenderingContext2D, x: number, y: number, s: number, a = 1, color = P.heart) {
  c.save();
  c.globalAlpha = a;
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x, y + s * .35);
  c.bezierCurveTo(x - s * .9, y - s * .2, x - s * .45, y - s * .9, x, y - s * .35);
  c.bezierCurveTo(x + s * .45, y - s * .9, x + s * .9, y - s * .2, x, y + s * .35);
  c.fill();
  c.restore();
}

export function sparkle(c: CanvasRenderingContext2D, x: number, y: number, s: number, a = 1, color = P.ink) {
  c.save();
  c.globalAlpha = a;
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x, y - s);
  c.quadraticCurveTo(x, y, x + s, y);
  c.quadraticCurveTo(x, y, x, y + s);
  c.quadraticCurveTo(x, y, x - s, y);
  c.quadraticCurveTo(x, y, x, y - s);
  c.fill();
  c.restore();
}

export function speedLines(c: CanvasRenderingContext2D, x: number, y: number, dir: number, len: number, hold: number, a = 1) {
  c.save();
  c.globalAlpha = a;
  c.strokeStyle = P.ink;
  c.lineCap = "round";
  c.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    const yy = y + (i - 1.5) * 26 + wob(hold, i, 8);
    const l = len * (.6 + .4 * hash(i + hold, 77));
    c.beginPath(); c.moveTo(x - dir * 20, yy); c.lineTo(x - dir * (20 + l), yy); c.stroke();
  }
  c.restore();
}

export function zzz(c: CanvasRenderingContext2D, x: number, y: number, s: number, tq: number) {
  c.save();
  c.fillStyle = P.ink;
  c.textAlign = "center";
  for (let i = 0; i < 3; i++) {
    const ph = ((tq * .5 + i / 3) % 1);
    c.globalAlpha = Math.sin(ph * Math.PI) * .85;
    c.font = `600 ${s * (.6 + ph * .6)}px "Pretendard Variable", Pretendard, sans-serif`;
    c.fillText("z", x + ph * s * 1.2, y - ph * s * 2);
  }
  c.restore();
}

/** 손글씨처럼 한 글자씩 써지는 제목. 써지는 자리에 펜 끝 빛이 있다 */
export function handwrite(c: CanvasRenderingContext2D, k: Kit, text: string, x: number, y: number, size: number, progress: number, hold: number) {
  c.save();
  c.font = `300 ${size}px "Pretendard Variable", Pretendard, sans-serif`;
  c.textBaseline = "alphabetic";
  c.fillStyle = P.ink;
  let xx = x;
  const n = text.length * clamp(progress);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const w = c.measureText(ch).width;
    const a = clamp(n - i);
    if (a > 0) {
      c.save();
      c.globalAlpha = a;
      c.translate(xx + w / 2, y);
      c.rotate((hash(i, 601) - .5) * .08 + wob(hold, i, .02));
      c.fillText(ch, -w / 2, (hash(i, 602) - .5) * size * .06);
      c.restore();
    }
    if (a > 0 && a < 1) {
      c.globalCompositeOperation = "lighter";
      c.drawImage(k.glowGold, xx + w * a - 30, y - size * .45 - 30, 60, 60);
      c.globalCompositeOperation = "source-over";
    }
    xx += w + size * .04;
  }
  c.restore();
}
