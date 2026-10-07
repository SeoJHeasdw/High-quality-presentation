/**
 * 유화 뮤비의 공용 재료. 깨끗한 장면용(하늘·도시·지붕·구름·달), 빛 층용(창 불빛·나방·별·빛의 실),
 * 붓질 뒤에 얹는 낙서(점선 궤적·느낌표·땀·어지러움·하트·반짝이). 글자는 쓰지 않는다.
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

export type Roof = { x: number; w: number; dy: number; kind: number };
const roofCache = new Map<number, Roof[]>();

/** 지붕 조각들(세계 좌표). 씨앗마다 한 번 만들어 둔다 */
export function roofSegs(seed: number) {
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

export function moth(c: CanvasRenderingContext2D, k: Kit, x: number, y: number, size: number, tq: number, ph: number, alpha = 1, rot = 0, halo = 1, open = .25) {
  // open: 날개가 가장 접혔을 때의 벌어짐(0.25 = 힘차게 퍼덕, 높을수록 활짝 편 채 살랑인다)
  const flap = open + (1 - open) * Math.abs(Math.sin(tq * 8 + ph));
  c.save();
  c.translate(x, y);
  if (rot) c.rotate(rot);
  c.globalAlpha = .55 * alpha * halo;
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

/** 착지 먼지: 땅에서 양옆으로 퍼지며 사라지는 먼지 구름(age 0~1). 동그라미가 아니라 울퉁불퉁한 덩이, 바깥 윤곽만 그어 손으로 그린 듯 */
export function dust(c: CanvasRenderingContext2D, x: number, y: number, s: number, age: number, a = 1) {
  if (age <= 0 || age >= 1) return;
  c.save();
  c.lineJoin = "round";
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1, k = Math.floor(i / 2);
    const px = x + side * s * (.2 + k * .36) * (.5 + 1.1 * age), py = y - s * (.07 + k * .06) * (1 - age * .4) - age * s * .22 * (k + 1);
    const r = s * (.15 + k * .06) * (.6 + .9 * age);
    const al = a * (1 - age) * .9;
    // 덩이: 다섯 개의 둥근 혹이 겹친 모양. 먼저 채우고(안쪽 경계 없이), 한 번에 윤곽을 긋는다
    const blob = () => {
      c.beginPath();
      for (let j = 0; j < 5; j++) {
        const th = j / 5 * Math.PI * 2 + i, rr = r * (.55 + .2 * hash(i * 5 + j, 3));
        const cx = px + Math.cos(th) * r * .55, cy = py + Math.sin(th) * r * .45;
        c.moveTo(cx + rr, cy);
        c.arc(cx, cy, rr, 0, Math.PI * 2);
      }
    };
    c.globalAlpha = al;
    c.fillStyle = "rgba(196,202,250,.62)";
    blob(); c.fill();
    c.globalAlpha = al * .55;
    c.strokeStyle = "rgba(244,231,198,.9)";
    c.lineWidth = Math.max(2, s * .022);
    c.globalCompositeOperation = "source-over";
    blob(); c.stroke();
  }
  c.restore();
}

/** 별 모양 충격 표시(반짝) 여러 개가 머리 둘레를 도는 어지러움 */
export function dizzy(c: CanvasRenderingContext2D, x: number, y: number, s: number, tq: number, a = 1) {
  for (let i = 0; i < 3; i++) {
    const th = tq * 4 + i * Math.PI * 2 / 3;
    sparkle(c, x + Math.cos(th) * s, y + Math.sin(th) * s * .35, s * .22, a);
  }
}

/**
 * 붓 점으로 그린 궤적(깨끗한 장면용). 붓질 뒤에 얹는 가는 점선은 그림체와 따로 놀아서,
 * 장면 안에 굵은 붓 점으로 칠해 붓질 패스를 통과시킨다. 끝의 X도 굵은 붓 두 획.
 */
export function dabLine(c: CanvasRenderingContext2D, pts: { x: number; y: number }[], hold: number, a = 1, opt: { r?: number; gap?: number; cross?: boolean; color?: string } = {}) {
  if (a <= 0 || pts.length < 2) return;
  const r = opt.r ?? 13, gap = opt.gap ?? 54, color = opt.color ?? "196,214,255";
  c.save();
  c.lineCap = "round";
  let acc = gap * .5;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1], p1 = pts[i], seg = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    let s = 0;
    while (acc + (seg - s) >= gap) {
      s += gap - acc; acc = 0;
      const q = s / seg, k = i * 31 + Math.floor(s);
      const x = mix(p0.x, p1.x, q), y = mix(p0.y, p1.y, q);
      const rr = r * (.9 + .3 * hash(k, 13));
      c.fillStyle = `rgba(${color},${a * (.75 + .25 * hash(k, 14))})`;
      c.beginPath(); c.ellipse(x, y, rr * 1.15, rr * .9, hash(k, 15) * 3, 0, Math.PI * 2); c.fill();
    }
    acc += seg - s;
  }
  if (opt.cross !== false) {
    const e = pts[pts.length - 1], d = r * 1.9;
    c.strokeStyle = `rgba(${color},${a})`;
    c.lineWidth = r * 1.05;
    c.beginPath();
    c.moveTo(e.x - d, e.y - d); c.lineTo(e.x + d, e.y + d);
    c.moveTo(e.x + d, e.y - d); c.lineTo(e.x - d, e.y + d);
    c.stroke();
  }
  c.restore();
}

/**
 * 바람결(깨끗한 장면용): 옆으로 빨리 흐르는 굵고 옅은 붓 한 획들. 날아가는 속도감을 붓질 안에서 낸다.
 * (붓질 뒤에 얹는 가는 속도선은 그림체와 따로 논다)
 */
export function windStreaks(c: CanvasRenderingContext2D, t: number, seed: number, n: number, y0: number, y1: number, speed: number, dir = -1, color = "170,190,255", alpha = .2) {
  c.save();
  c.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const len = 260 + hash(i, seed + 1) * 520, wd = 6 + hash(i, seed + 2) * 12;
    const sp = speed * (.7 + .6 * hash(i, seed + 3));
    const span = W + len + 400;
    const x = (((hash(i, seed + 4) * span + dir * -1 * 0 + dir * t * sp) % span) + span) % span - len - 200;
    const y = y0 + hash(i, seed + 5) * (y1 - y0);
    c.strokeStyle = `rgba(${color},${alpha * (.5 + hash(i, seed + 6))})`;
    c.lineWidth = wd;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + len / 2, y + (hash(i, seed + 7) - .5) * 24, x + len, y); c.stroke();
  }
  c.restore();
}

/**
 * 달에서 내려온 한 가닥의 실: 가는 직선 하나는 도식처럼 보여서, 굽이치는 두 가닥이 서로 감기고
 * 굽이의 폭이 아래(아이 쪽)로 갈수록 커지게 하며 빛 알갱이가 타고 오르내린다. 빛 층에서 부른다.
 */
export function lightThread(c: CanvasRenderingContext2D, k: Kit, a: { x: number; y: number }, b: { x: number; y: number }, tq: number, o: { amp?: number; w?: number; ph?: number; a?: number; beads?: number } = {}) {
  const amp = o.amp ?? 44, w = o.w ?? 2.4, ph = o.ph ?? 0, al = o.a ?? 1, n = 40;
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
  const at = (v: number, off: number) => {
    // 아이 쪽(a)에서 멀어질수록 굽이가 가라앉는다
    const sway = Math.sin(v * 7 - tq * 3.2 + ph + off) * amp * Math.sin(Math.min(1, v * 1.4) * Math.PI * .5) * (1 - v * .55);
    return { x: mix(a.x, b.x, v) + nx * sway, y: mix(a.y, b.y, v) + ny * sway };
  };
  glowLine(c, Array.from({ length: n }, (_, i) => at(i / (n - 1), 0)), w, al);
  glowLine(c, Array.from({ length: n }, (_, i) => at(i / (n - 1), 1.7)), w * .55, al * .75);
  for (let j = 0; j < (o.beads ?? 4); j++) {
    const v = (hash(j, 17) + tq * .22) % 1, p = at(v, 0);
    c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = .9 * al;
    c.drawImage(k.glowGold, p.x - 13, p.y - 13, 26, 26); c.restore();
  }
}
