/**
 * 뮤비 시안의 장면 다섯. 모두 (g, f, kit) → 한 프레임이다. f에 든 시각과 곡 값만 쓰고,
 * 무작위는 번호를 해시해서 얻는다. 그래서 어느 프레임을 먼저 그려도 결과가 같다.
 *
 *   record  레코드판. 홈 하나가 곡의 한 구간이고, 홈의 요철이 그 자리의 실제 파형이다.
 *           바늘은 지금 재생 중인 홈에 놓인다(지나온 홈은 금색).
 *   city    비 오는 밤의 도시. 창문은 박마다(창마다 다른 주기로) 켜지고 꺼진다. 고역이 세면 비가 굵어진다
 *   ridge   스펙트럼 능선. 앞줄이 지금, 뒤로 갈수록 과거. 가운데가 저역이다
 *   tunnel  박마다 링이 하나 태어나 다가온다. 링의 모양은 그 박의 스펙트럼, 마디 첫 박은 금색
 *   type    브레이크. 마디마다 제목 글자 하나
 *
 * 색은 덱의 규칙을 따른다: 파랑 = 기계, 금색 = 사람.
 */
import type { Song } from "./song.ts";

export const W = 1920;
export const H = 1080;
export const FONT = '"Pretendard Variable", Pretendard, -apple-system, system-ui, sans-serif';

export const C = {
  bg: "#05070c",
  night: "#0b1626",
  blue: "#2f516b",
  steel: "#466b86",
  blueHi: "#7fa8c9",
  gold: "#dcb97c",
  goldHi: "#f3dcae",
  ink: "#d9dee2",
  mute: "#7b95a9",
};

export type Role = "intro" | "outro" | "body";

export type Frame = {
  t: number;
  /** 컷이 시작된 뒤 흐른 시간 */
  lt: number;
  shotStart: number;
  shotLen: number;
  variant: number;
  role: Role;
  energy: number;
  song: Song;
  level: number;
  low: number;
  mid: number;
  high: number;
  hit: number;
  beatAge: number;
  downAge: number;
  beatIdx: number;
  barIdx: number;
  spec: Float32Array;
};

/* ── 공통 ─────────────────────────────────────────────── */

export function hash(a: number, b = 0) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12; h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function mulberry(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const smooth = (a: number, b: number, v: number) => { const x = clamp((v - a) / (b - a)); return x * x * (3 - 2 * x); };
export const mix = (a: number, b: number, w: number) => a + (b - a) * w;
/** 박 직후 1에서 0으로 떨어지는 맥박 */
export const pulse = (age: number, decay = .16) => (age === Infinity ? 0 : Math.exp(-age / decay));

function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

/** 스펙트럼 배열을 0~1 위치로 읽는다(칸 사이는 보간) */
function specAt(spec: Float32Array, u: number) {
  const x = clamp(u) * (spec.length - 1);
  const i = Math.floor(x), j = Math.min(i + 1, spec.length - 1);
  return spec[i] + (spec[j] - spec[i]) * (x - i);
}

/** 이웃 칸과 섞어 뾰족한 칸 하나가 벽처럼 서지 않게 한다 */
function blur(spec: Float32Array, out: Float32Array) {
  const n = spec.length;
  for (let i = 0; i < n; i++) {
    const a = spec[Math.max(0, i - 2)], b = spec[Math.max(0, i - 1)], c = spec[i];
    const d = spec[Math.min(n - 1, i + 1)], e = spec[Math.min(n - 1, i + 2)];
    out[i] = (a + 4 * b + 6 * c + 4 * d + e) / 16;
  }
  return out;
}

/* ── 미리 구워 두는 것 ────────────────────────────────── */

type Win = { x: number; y: number; w: number; h: number; id: number; warm: boolean; period: number; phase: number };
type CityLayer = { img: HTMLCanvasElement; wins: Win[]; span: number; speed: number; depth: number };

export type Kit = {
  city: CityLayer[];
  tmp: Float32Array;
  tmp2: Float32Array;
  pts: Float32Array;
  /** beats 배열에서 첫 마디 첫 박의 위치(링 색을 정할 때) */
  downPhase: number;
};

const HORIZON = 760;

function buildCity(): CityLayer[] {
  const rnd = mulberry(20260925);
  const specs = [
    { span: 3400, speed: 9, depth: 0, hMin: 140, hMax: 360, wMin: 50, wMax: 150, cell: [9, 13], color: "#0b1522" },
    { span: 3600, speed: 22, depth: 1, hMin: 200, hMax: 520, wMin: 80, wMax: 210, cell: [13, 19], color: "#08101a" },
    { span: 3800, speed: 48, depth: 2, hMin: 260, hMax: 680, wMin: 120, wMax: 280, cell: [18, 26], color: "#05090f" },
  ];
  let id = 0;
  return specs.map((s) => {
    const img = canvas(s.span, HORIZON);
    const c = img.getContext("2d")!;
    const wins: Win[] = [];
    let x = -20;
    while (x < s.span) {
      const w = s.wMin + rnd() * (s.wMax - s.wMin);
      const h = s.hMin + Math.pow(rnd(), 1.4) * (s.hMax - s.hMin);
      const top = HORIZON - h;
      c.fillStyle = s.color;
      c.fillRect(x, top, w, h);
      // 지붕: 평평 / 계단 / 안테나
      const roof = rnd();
      if (roof < .25) c.fillRect(x + w * .2, top - h * .06, w * .6, h * .06);
      else if (roof < .4) c.fillRect(x + w * .48, top - h * .18, 3, h * .18);
      // 가장자리 빛(먼 건물일수록 푸르게)
      c.fillStyle = rgba(C.steel, .08 + s.depth * .02);
      c.fillRect(x, top, 1.5, h);
      // 창문 격자
      const [cw, ch] = s.cell;
      const cols = Math.max(1, Math.floor((w - cw) / cw));
      const rows = Math.max(1, Math.floor((h - ch * 1.5) / ch));
      const ox = x + (w - cols * cw) / 2;
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
        if (rnd() < .3) continue; // 창 없는 칸
        const wx = ox + k * cw + cw * .22, wy = top + ch * .8 + r * ch;
        const ww = cw * .56, wh = ch * .5;
        c.fillStyle = "rgba(120,150,175,.05)";
        c.fillRect(wx, wy, ww, wh);
        const periods = [4, 8, 8, 16, 32];
        wins.push({ x: wx, y: wy, w: ww, h: wh, id: id++, warm: rnd() < .8, period: periods[Math.floor(rnd() * periods.length)], phase: Math.floor(rnd() * 32) });
      }
      x += w + rnd() * 18;
    }
    return { img, wins, span: s.span, speed: s.speed, depth: s.depth };
  });
}

export function createKit(song: Song): Kit {
  const first = song.a.downbeats[0];
  let downPhase = 0;
  for (let i = 0; i < 4; i++) if (Math.abs(song.a.beats[i] - first) < 1e-6) downPhase = i;
  return { city: buildCity(), tmp: new Float32Array(song.bands), tmp2: new Float32Array(song.bands), pts: new Float32Array(512), downPhase };
}

/* ── record ───────────────────────────────────────────── */

export function record(g: CanvasRenderingContext2D, f: Frame, kit: Kit) {
  const { t, song } = f;
  const v = f.role === "body" ? f.variant % 3 : -1;
  let cx = 960, cy = 540, R = 430, tilt = 1;
  if (f.role !== "body") { cx = 1300; cy = 545; R = 395 * (1 + f.lt * .004); }
  else if (v === 1) { cx = 520; cy = 1240; R = 1180; }
  else if (v === 2) { cx = 960; cy = 640; R = 640; tilt = .42; }
  else R = 430 * (1 + f.lt * .006);

  g.fillStyle = C.bg;
  g.fillRect(0, 0, W, H);
  const halo = g.createRadialGradient(cx, cy, R * .2, cx, cy, R * 1.6);
  halo.addColorStop(0, rgba(C.blue, .28 + .12 * f.low));
  halo.addColorStop(1, rgba(C.blue, 0));
  g.fillStyle = halo;
  g.fillRect(0, 0, W, H);

  // 빛줄기와 먼지
  g.save();
  g.globalCompositeOperation = "lighter";
  const beam = g.createLinearGradient(260, 0, 900, H);
  beam.addColorStop(0, rgba(C.gold, .07));
  beam.addColorStop(1, rgba(C.gold, 0));
  g.fillStyle = beam;
  g.beginPath(); g.moveTo(180, 0); g.lineTo(560, 0); g.lineTo(1300, H); g.lineTo(520, H); g.closePath(); g.fill();
  for (let i = 0; i < 70; i++) {
    const x = (hash(i, 1) * W + Math.sin(t * .13 + i) * 40 + W) % W;
    const y = ((hash(i, 2) * H - t * (6 + 10 * hash(i, 3))) % H + H) % H;
    const a = .12 + .25 * Math.max(0, Math.sin(t * (.7 + hash(i, 4)) + i));
    g.fillStyle = rgba(C.goldHi, a);
    g.fillRect(x, y, 1.2 + hash(i, 5) * 1.8, 1.2 + hash(i, 5) * 1.8);
  }
  g.restore();

  g.save();
  g.translate(cx, cy);
  g.scale(1, tilt);

  // 판
  const body = g.createRadialGradient(0, 0, R * .3, 0, 0, R);
  body.addColorStop(0, "#0c0f14");
  body.addColorStop(.97, "#07090c");
  body.addColorStop(1, "#1a2129");
  g.fillStyle = body;
  g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
  if (tilt < 1) {
    // 판의 두께
    g.fillStyle = "#020305";
    g.beginPath(); g.ellipse(0, R * .05, R, R, 0, 0, Math.PI); g.fill();
    g.fillStyle = body;
    g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
  }

  // 홈: 바깥이 곡의 처음. 홈 하나가 곡의 1/G
  const theta = t * Math.PI * 2 * (33.333 / 60);
  const G = 56, N = 120, rin = R * .36, rout = R * .96;
  const relief = R * .0065;
  const playing = t / song.duration;
  g.lineWidth = Math.max(1, R / 430);
  for (let k = 0; k < G; k++) {
    const rk = rout - (k + .5) / G * (rout - rin);
    const t0 = k / G * song.duration;
    const played = (k + 1) / G <= playing;
    const current = !played && k / G <= playing;
    g.strokeStyle = current ? rgba(C.goldHi, .32) : played ? rgba(C.gold, .14) : rgba("#aac0d4", .075);
    g.beginPath();
    for (let j = 0; j <= N; j++) {
      const a = theta + j / N * Math.PI * 2;
      const r = rk + relief * song.peak(t0 + (j / N) * song.duration / G);
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (j) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.stroke();
  }

  // 판 위의 반사(빛은 고정, 판만 돈다)
  g.save();
  g.globalCompositeOperation = "lighter";
  const sheen = g.createConicGradient(-.6, 0, 0);
  const s = .09 + .07 * f.low;
  sheen.addColorStop(0, rgba("#ffffff", 0));
  sheen.addColorStop(.06, rgba("#ffffff", s));
  sheen.addColorStop(.13, rgba("#ffffff", 0));
  sheen.addColorStop(.5, rgba("#ffffff", 0));
  sheen.addColorStop(.56, rgba(C.goldHi, s * .8));
  sheen.addColorStop(.63, rgba("#ffffff", 0));
  sheen.addColorStop(1, rgba("#ffffff", 0));
  g.fillStyle = sheen;
  g.beginPath(); g.arc(0, 0, rout, 0, Math.PI * 2); g.arc(0, 0, rin, 0, Math.PI * 2, true); g.fill();
  g.restore();

  // 라벨
  const Rl = R * .3;
  const lab = g.createRadialGradient(-Rl * .3, -Rl * .3, Rl * .1, 0, 0, Rl);
  lab.addColorStop(0, "#e9cf9c");
  lab.addColorStop(1, "#b48d55");
  g.fillStyle = lab;
  g.beginPath(); g.arc(0, 0, Rl, 0, Math.PI * 2); g.fill();
  g.save();
  g.rotate(theta);
  g.fillStyle = "#2a1f10";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `800 ${Rl * .2}px ${FONT}`;
  g.fillText("감성 힙합 초안", 0, -Rl * .38);
  g.font = `600 ${Rl * .085}px ${FONT}`;
  g.fillText("SIDE A", 0, Rl * .3);
  g.fillText(`${song.a.bpm.toFixed(1)} BPM · ${Math.floor(song.duration / 60)}:${String(Math.round(song.duration % 60)).padStart(2, "0")}`, 0, Rl * .48);
  g.strokeStyle = "rgba(42,31,16,.35)";
  g.lineWidth = Math.max(1, Rl * .008);
  g.beginPath(); g.arc(0, 0, Rl * .82, 0, Math.PI * 2); g.stroke();
  g.restore();
  g.fillStyle = C.bg;
  g.beginPath(); g.arc(0, 0, Rl * .06, 0, Math.PI * 2); g.fill();

  // 마디 첫 박마다 라벨에서 번지는 고리
  if (f.downAge < 1.2) {
    const p = f.downAge / 1.2;
    g.strokeStyle = rgba(C.gold, (1 - p) * .35);
    g.lineWidth = Math.max(1, R / 300) * (1 - p) * 2;
    g.beginPath(); g.arc(0, 0, Rl + (rout - Rl) * p, 0, Math.PI * 2); g.stroke();
  }

  // 톤암: 받침에서 일정한 길이로, 지금 홈에 바늘이 닿는다. 처음에는 판 밖에서 들어온다
  const P = { x: R * 1.12, y: -R * .92 };
  const L = R * 1.2;
  const drop = f.role === "intro" ? smooth(.3, 1.8, t) : 1;
  const rs = mix(R * 1.12, rout - playing * (rout - rin), drop);
  const d = Math.hypot(P.x, P.y);
  const aa = (rs * rs - L * L + d * d) / (2 * d);
  const hh = Math.sqrt(Math.max(0, rs * rs - aa * aa));
  const ux = P.x / d, uy = P.y / d;
  const S1 = { x: aa * ux - hh * uy, y: aa * uy + hh * ux };
  const S2 = { x: aa * ux + hh * uy, y: aa * uy - hh * ux };
  const S = S1.y > S2.y ? S1 : S2;
  const ang = Math.atan2(S.y - P.y, S.x - P.x);
  g.save();
  g.translate(0, (1 - drop) * -R * .02);
  g.fillStyle = "#11161d";
  g.beginPath(); g.arc(P.x, P.y, R * .1, 0, Math.PI * 2); g.fill();
  g.strokeStyle = rgba(C.steel, .5);
  g.lineWidth = Math.max(1, R * .004);
  g.stroke();
  // 평형추
  g.fillStyle = "#1c242e";
  g.beginPath(); g.arc(P.x - Math.cos(ang) * R * .17, P.y - Math.sin(ang) * R * .17, R * .055, 0, Math.PI * 2); g.fill();
  const arm = g.createLinearGradient(P.x, P.y - R * .02, P.x, P.y + R * .02);
  arm.addColorStop(0, "#8d99a5");
  arm.addColorStop(.5, "#e3e8ec");
  arm.addColorStop(1, "#5c6670");
  g.strokeStyle = arm;
  g.lineCap = "round";
  g.lineWidth = R * .02;
  g.beginPath(); g.moveTo(P.x, P.y); g.lineTo(S.x - Math.cos(ang) * R * .1, S.y - Math.sin(ang) * R * .1); g.stroke();
  // 헤드셸
  g.translate(S.x, S.y);
  g.rotate(ang + .35);
  g.fillStyle = "#c9d1d8";
  g.fillRect(-R * .13, -R * .03, R * .15, R * .06);
  g.fillStyle = C.gold;
  g.fillRect(-R * .015, -R * .012, R * .03, R * .024);
  g.restore();
  g.restore();
}

/* ── city ─────────────────────────────────────────────── */

export function city(g: CanvasRenderingContext2D, f: Frame, kit: Kit) {
  const { t } = f;
  const v = f.variant % 3;
  g.save();
  if (v === 1) { const s = 1 + f.lt * .012; g.translate(960, 700); g.scale(s, s); g.translate(-960, -700); }
  if (v === 2) { g.translate(960, H); g.scale(1.22, 1.22); g.translate(-960, -H); }

  const sky = g.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, "#03050a");
  sky.addColorStop(1, "#0f1c2c");
  g.fillStyle = sky;
  g.fillRect(-200, -200, W + 400, HORIZON + 200);
  const mx = v === 2 ? 560 : 1460, my = v === 2 ? 250 : 270;
  const haze = g.createRadialGradient(mx, my, 20, mx, my, 560);
  haze.addColorStop(0, rgba(C.gold, .16 + .06 * pulse(f.downAge, .4)));
  haze.addColorStop(1, rgba(C.gold, 0));
  g.fillStyle = haze;
  g.fillRect(-200, -200, W + 400, HORIZON + 200);
  g.fillStyle = rgba("#f3e6c8", .85);
  g.beginPath(); g.arc(mx, my, 44, 0, Math.PI * 2); g.fill();

  // 건물 + 창문
  const dir = v === 2 ? -1 : 1;
  const p = .2 + .2 * f.level;
  const layerX: number[] = [];
  for (const L of kit.city) {
    const off = ((t * L.speed * dir + f.variant * 700 * (L.depth + 1)) % L.span + L.span) % L.span;
    layerX.push(off);
    for (const k of [0, 1]) {
      const x0 = -off + k * L.span;
      if (x0 > W + 200 || x0 + L.span < -200) continue;
      g.drawImage(L.img, x0, 0);
    }
    const fogA = .16 - L.depth * .06;
    if (fogA > 0) {
      const fog = g.createLinearGradient(0, HORIZON - 380, 0, HORIZON);
      fog.addColorStop(0, rgba(C.steel, 0));
      fog.addColorStop(1, rgba(C.steel, fogA));
      g.fillStyle = fog;
      g.fillRect(-200, HORIZON - 380, W + 400, 380);
    }
    for (const w of L.wins) {
      let x = w.x - off;
      if (x < -60) x += L.span;
      if (x < -60 || x > W + 60) continue;
      const epoch = Math.floor((f.beatIdx + w.phase) / w.period);
      if (hash(w.id, epoch) > p) continue;
      const bright = .45 + .4 * hash(w.id, epoch + 7) + (L.depth === 2 ? .15 * pulse(f.beatAge) : 0);
      g.fillStyle = rgba(w.warm ? C.gold : C.blueHi, bright * (.55 + L.depth * .2));
      g.fillRect(x, w.y, w.w, w.h);
    }
  }

  // 젖은 길: 도시를 뒤집어 비춘다
  g.save();
  g.globalAlpha = .3;
  g.translate(0, HORIZON * 2);
  g.scale(1, -1);
  kit.city.forEach((L, i) => {
    for (const k of [0, 1]) {
      const x0 = -layerX[i] + k * L.span;
      if (x0 > W + 200 || x0 + L.span < -200) continue;
      g.drawImage(L.img, x0, 0);
    }
  });
  g.restore();
  const wet = g.createLinearGradient(0, HORIZON, 0, H);
  wet.addColorStop(0, "rgba(5,7,12,.35)");
  wet.addColorStop(1, "rgba(5,7,12,.96)");
  g.fillStyle = wet;
  g.fillRect(-200, HORIZON, W + 400, H - HORIZON + 200);
  g.strokeStyle = rgba(C.gold, .07);
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 0; i < 46; i++) {
    const y = HORIZON + 6 + Math.pow(i / 46, 1.6) * (H - HORIZON);
    const x = (hash(i, 11) * W + Math.sin(t * .9 + i) * 30);
    const w = 60 + hash(i, 12) * 260;
    g.moveTo(x, y); g.lineTo(x + w, y);
  }
  g.stroke();
  g.restore();

  // 비: 고역(하이햇)이 세면 굵어진다
  const n = Math.round(110 + 260 * f.high + 80 * f.energy);
  for (const pass of [0, 1]) {
    g.strokeStyle = rgba("#b8cbe0", pass ? .28 : .13);
    g.lineWidth = pass ? 1.4 : 1;
    g.beginPath();
    for (let i = pass; i < n; i += 2) {
      const sp = 1500 + 900 * hash(i, 1);
      const len = 24 + 46 * hash(i, 2);
      const y = ((hash(i, 3) * (H + 200) + t * sp) % (H + 200)) - 100;
      const x = hash(i, 4) * (W + 500) - 250 + y * .26;
      g.moveTo(x, y); g.lineTo(x - len * .26, y - len);
    }
    g.stroke();
  }

  // 앞쪽의 흐린 빛망울
  g.save();
  g.globalCompositeOperation = "lighter";
  for (let i = 0; i < 18; i++) {
    const span = W * 1.3;
    const x = ((hash(i, 21) * span + t * (8 + 22 * hash(i, 22)) * dir) % span + span) % span - W * .15;
    const y = 180 + hash(i, 23) * 760;
    const r = (34 + 96 * hash(i, 24)) * (.9 + .25 * f.mid);
    const a = (.05 + .07 * hash(i, 25)) * (1 + .7 * pulse(f.beatAge, .2));
    const b = g.createRadialGradient(x, y, 0, x, y, r);
    const col = hash(i, 26) < .65 ? C.gold : C.blueHi;
    b.addColorStop(0, rgba(col, a));
    b.addColorStop(.7, rgba(col, a * .6));
    b.addColorStop(1, rgba(col, 0));
    g.fillStyle = b;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

/* ── ridge ────────────────────────────────────────────── */

export function ridge(g: CanvasRenderingContext2D, f: Frame, kit: Kit) {
  const { t, song } = f;
  const v = f.variant % 3;
  const horizon = v === 1 ? 170 : v === 2 ? 360 : 330;
  const base = v === 1 ? 1100 : 1010;
  g.fillStyle = C.bg;
  g.fillRect(0, 0, W, H);
  g.save();
  if (v === 2) { g.translate(960, 540); g.rotate(-.07); g.scale(1.08, 1.08); g.translate(-960, -540); }
  const glow = g.createLinearGradient(0, horizon - 220, 0, horizon + 60);
  glow.addColorStop(0, rgba(C.blue, 0));
  glow.addColorStop(.8, rgba(C.blue, .22 + .1 * f.level));
  glow.addColorStop(1, rgba(C.blue, 0));
  g.fillStyle = glow;
  g.fillRect(-200, horizon - 220, W + 400, 280);

  const N = 46, M = 84;
  const dt = song.beatLength / 4;
  const q = t / dt, i0 = Math.floor(q), frac = q - i0;
  const pts = kit.pts;
  for (let k = N - 1; k >= 0; k--) {
    const tk = Math.max(0, (i0 - k) * dt);
    const d = k + frac;
    const z = 1 + d * .17;
    const y0 = horizon + (base - horizon) / z;
    const half = 1250 / z;
    const amp = 330 / z * (.5 + .7 * song.feature("level", tk));
    const spec = blur(song.spectrum(tk, kit.tmp), kit.tmp2);
    const lowK = song.feature("low", tk);
    for (let j = 0; j <= M; j++) {
      const x = j / M * 2 - 1;
      const u = Math.abs(x);
      // 가운데 봉우리는 그 순간의 저역(킥·베이스), 바깥으로 갈수록 높은 칸
      const hump = .45 * lowK * Math.pow(1 - u, 3);
      const val = Math.max(hump, Math.pow(specAt(spec, .22 + u * .6), 1.5) * Math.pow(1 - u * u, .6));
      const n = .022 * Math.sin(x * 13 + k * 1.7) + .015 * Math.sin(x * 29 - k);
      pts[j * 2] = 960 + x * half;
      pts[j * 2 + 1] = y0 - amp * Math.max(0, val + n * (1 - u));
    }
    // 앞줄이 뒷줄을 가린다
    g.beginPath();
    g.moveTo(960 - half, y0 + 4);
    for (let j = 0; j <= M; j++) g.lineTo(pts[j * 2], pts[j * 2 + 1]);
    g.lineTo(960 + half, y0 + 4);
    g.closePath();
    g.fillStyle = C.bg;
    g.fill();
    // 윗선만 긋는다
    g.beginPath();
    for (let j = 0; j <= M; j++) j ? g.lineTo(pts[j * 2], pts[j * 2 + 1]) : g.moveTo(pts[0], pts[1]);
    const fade = Math.pow(1 - d / N, 1.3);
    const warm = clamp(1 - d / 10);
    const accent = k <= 1 ? pulse(f.downAge, .22) : 0;
    g.strokeStyle = warm > 0
      ? rgba(accent > .1 ? C.goldHi : C.gold, clamp(fade * (.55 + .45 * warm) + accent * .4))
      : rgba(C.blueHi, fade * .85);
    g.lineWidth = Math.max(.9, 2.6 / z) + accent * 2;
    g.stroke();
  }
  g.restore();
}

/* ── tunnel ───────────────────────────────────────────── */

export function tunnel(g: CanvasRenderingContext2D, f: Frame, kit: Kit) {
  const { t, song } = f;
  const v = f.variant % 3;
  const vx = v === 1 ? 760 : v === 2 ? 1160 : 960;
  const vy = v === 1 ? 500 : v === 2 ? 590 : 540;
  const dir = v === 1 ? -1 : 1;
  const bg = g.createRadialGradient(vx, vy, 0, vx, vy, 1200);
  bg.addColorStop(0, C.night);
  bg.addColorStop(1, C.bg);
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  g.save();
  g.globalCompositeOperation = "lighter";
  // 날아가는 별
  const speed = .35 + .9 * f.level;
  g.lineWidth = 1;
  for (const pass of [0, 1]) {
    g.strokeStyle = rgba(pass ? C.ink : C.blueHi, pass ? .55 : .25);
    g.beginPath();
    for (let i = pass; i < 480; i += 2) {
      const a = hash(i, 31) * Math.PI * 2;
      const s = .25 + .5 * hash(i, 32);
      const z = (hash(i, 33) + t * s * speed * .4) % 1;
      if (z < .2) continue;
      const r1 = 40 / (1.04 - z), r0 = 40 / (1.04 - Math.max(0, z - .018 * (.6 + f.level)));
      if (r0 > 1300) continue;
      g.moveTo(vx + Math.cos(a) * r0, vy + Math.sin(a) * r0);
      g.lineTo(vx + Math.cos(a) * r1, vy + Math.sin(a) * r1);
    }
    g.stroke();
  }

  // 박마다 태어나는 링
  const life = song.beatLength * 4;
  const beats = song.a.beats;
  const M = 144;
  const folds = [4, 3, 6][v];
  for (let j = f.beatIdx; j >= 0 && t - beats[j] < life; j--) {
    const b = beats[j];
    const p = (t - b) / life;
    const z = 1 - p * .94;
    const r = 70 / z;
    const down = (j - kit.downPhase) % 4 === 0;
    const alpha = smooth(0, .1, p) * (1 - smooth(.72, 1, p));
    if (alpha <= 0) continue;
    const spec = blur(song.spectrum(b, kit.tmp), kit.tmp2);
    const rot = dir * (b * .12 + (t - b) * .18) - Math.PI / 2;
    const col = down ? C.gold : v === 2 ? C.blueHi : C.steel;
    g.beginPath();
    for (let k = 0; k <= M; k++) {
      const u = k / M;
      // 꽃잎 하나가 저역 → 고역 → 저역. 꽃잎 끝이 저역
      const sym = .5 + .5 * Math.cos(u * Math.PI * 2 * folds);
      const val = Math.pow(specAt(spec, .08 + (1 - sym) * .7), 1.4);
      const rr = r * (.9 + .32 * val);
      const a = rot + u * Math.PI * 2;
      const x = vx + Math.cos(a) * rr, y = vy + Math.sin(a) * rr;
      if (k) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.strokeStyle = rgba(col, alpha * .18);
    g.lineWidth = Math.min(28, 6 / z);
    g.stroke();
    g.strokeStyle = rgba(down ? C.goldHi : C.blueHi, alpha * .8);
    g.lineWidth = Math.min(6, 1.2 / z);
    g.stroke();
  }

  const core = g.createRadialGradient(vx, vy, 0, vx, vy, 380);
  core.addColorStop(0, rgba(C.gold, .05 + .2 * pulse(f.beatAge, .18)));
  core.addColorStop(1, rgba(C.gold, 0));
  g.fillStyle = core;
  g.fillRect(0, 0, W, H);
  g.restore();
}

/* ── type ─────────────────────────────────────────────── */

export function typeBreak(g: CanvasRenderingContext2D, f: Frame, kit: Kit) {
  const { t, song } = f;
  g.fillStyle = C.bg;
  g.fillRect(0, 0, W, H);
  // 설계도 격자
  g.strokeStyle = rgba(C.steel, .07);
  g.lineWidth = 1;
  g.beginPath();
  const ox = (t * 6) % 60;
  for (let x = -ox; x < W; x += 60) { g.moveTo(x, 0); g.lineTo(x, H); }
  for (let y = 0; y < H; y += 60) { g.moveTo(0, y); g.lineTo(W, y); }
  g.stroke();

  const firstBar = song.barIndex(f.shotStart + .05);
  const k = Math.max(0, f.barIdx - firstBar);
  const words = ["감성", "힙합", "초안"];
  const full = k % 4 === 3;
  const word = full ? "감성 힙합 초안" : words[k % 3];
  const barLen = song.beatLength * 4;
  const age = Math.min(f.downAge, f.lt);
  const a = smooth(0, .35, age) * (1 - smooth(barLen - .35, barLen, age));
  const size = full ? 190 : 330;
  const spacing = mix(.0, .1, smooth(0, barLen, age)) * size;

  g.save();
  g.textAlign = "center";
  g.textBaseline = "middle";
  (g as any).letterSpacing = `${spacing}px`;
  g.font = `900 ${size}px ${FONT}`;
  // 앞 마디의 글자가 윤곽으로 남는다
  if (k > 0) {
    const prev = (k - 1) % 4 === 3 ? "감성 힙합 초안" : words[(k - 1) % 3];
    g.strokeStyle = rgba(C.steel, .18 * (1 - smooth(0, barLen, age)));
    g.lineWidth = 1.5;
    g.font = `900 ${(k - 1) % 4 === 3 ? 190 : 330}px ${FONT}`;
    g.strokeText(prev, 960, 500 - 30);
    g.font = `900 ${size}px ${FONT}`;
  }
  const lift = (1 - smooth(0, .5, age)) * 26;
  if (k % 2 === 0 || full) {
    g.fillStyle = rgba(C.gold, a);
    g.fillText(word, 960, 500 + lift);
  } else {
    g.strokeStyle = rgba(C.ink, a);
    g.lineWidth = 2.5;
    g.strokeText(word, 960, 500 + lift);
  }
  g.restore();

  // 박 표시: 마디 안의 네 박
  const inBar = Math.min(3, Math.floor(age / song.beatLength + .02));
  for (let i = 0; i < 4; i++) {
    const on = i <= inBar;
    g.fillStyle = on ? rgba(i === 0 ? C.gold : C.ink, (i === inBar ? .9 : .45) * a + .08) : rgba(C.steel, .25);
    g.fillRect(960 - 66 + i * 36, 720, 24, 6);
  }
  g.fillStyle = rgba(C.mute, .75 * a);
  g.textAlign = "center";
  g.font = `500 30px ${FONT}`;
  g.fillText("가사와 음악 지시로 만든 곡", 960, 800);
}

export const SCENES = { record, city, ridge, tunnel, type: typeBreak };
