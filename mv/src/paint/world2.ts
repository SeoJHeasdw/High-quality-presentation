/**
 * 하늘 위와 도시 안쪽의 무대: 구름 바다, 폭풍구름, 들판, 건물 정면의 창, 친구의 방.
 * 모두 깨끗한 장면에 그린다(붓질 전). 동그란 덩이는 겹겹의 동심원 색 띠로 나눠 칠해,
 * 붓이 덩이를 따라 돌며 고흐의 구름처럼 소용돌이로 보이게 한다.
 */
import { W, H, hash, clamp, mix } from "./kit.ts";
import type { Kit } from "./kit.ts";
import { mixColor } from "./stage.ts";
import { mottle } from "./world.ts";

const TAU = Math.PI * 2;

/* ── 구름 ───────────────────────────────────────────── */

/**
 * 구름 덩이 하나: 바깥에서 안으로 점점 밝아지는 동심원(빛 쪽으로 중심이 쏠린다)을 쌓는다.
 * 붓이 이 고리를 따라 돌아서 소용돌이 붓결이 된다.
 */
export function billow(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, tint: string, shade: string, lx = .6, ly = -.7, rings = 3, squash = .78, seed = 0) {
  c.save();
  c.translate(cx, cy);
  c.scale(1, squash);
  // 가장자리를 울퉁불퉁하게: 큰 덩이 둘레에 작은 혹을 붙인다(양배추 모양). 아래쪽은 덩이들이 겹쳐 가려진다
  const bumps = 7;
  for (let i = 0; i < rings; i++) {
    const q = i / (rings - 1);
    const rr = r * (1 - i * .24);
    c.fillStyle = mixColor(shade, tint, .25 + .75 * Math.pow(q, .8));
    c.beginPath();
    c.arc(lx * r * .1 * i, ly * r * .1 * i, rr, 0, TAU);
    for (let j = 0; j < bumps; j++) {
      const th = -Math.PI * (.05 + .9 * (j + hash(j, seed + 3) * .6) / bumps) ;     // 윗면 위주
      const br = rr * (.3 + .22 * hash(j, seed + 4));
      const bx = lx * r * .1 * i + Math.cos(th) * rr * .86, by = ly * r * .1 * i + Math.sin(th) * rr * .86;
      c.moveTo(bx + br, by);
      c.arc(bx, by, br, 0, TAU);
    }
    c.fill();
  }
  c.restore();
}

export type CloudSea = {
  y: number;
  t: number;
  seed: number;
  /** 옆으로 흘러간 거리(px) */
  scroll?: number;
  tint?: string;
  shade?: string;
  /** 줄 수와 덩이 크기 */
  rows?: number;
  size?: number;
  /** 빛이 오는 쪽(달) 방향 */
  light?: [number, number];
  /** 구름 윗면이 꿈틀대는 정도 */
  bob?: number;
};

/**
 * 구름 바다: 멀리 있는 줄부터 앞으로 큼직한 덩이를 겹쳐 놓는다. 위쪽이 달빛에 밝다.
 * 줄마다 덩이의 위치·크기·높이가 제각각이라 반듯한 물결무늬가 되지 않는다.
 */
export function cloudSeaPaint(c: CanvasRenderingContext2D, o: CloudSea) {
  const rows = o.rows ?? 4, size = o.size ?? 150;
  const tint = o.tint ?? "#9a92d2", shade = o.shade ?? "#363284";
  const [lx, ly] = o.light ?? [.5, -.8];
  const scroll = o.scroll ?? 0;
  // 바다 바닥(구름 밑이 비치지 않게 어둡게 채운다)
  const bg = c.createLinearGradient(0, o.y - 60, 0, o.y + 520);
  bg.addColorStop(0, shade); bg.addColorStop(1, "#0d0f3c");
  c.fillStyle = bg;
  c.fillRect(-300, o.y + 40, W + 600, H + 600);
  for (let row = 0; row < rows; row++) {
    const q = row / Math.max(1, rows - 1);
    const rowY = o.y + row * size * .46 + 18;
    const step = size * (.62 + q * .5);
    const par = .35 + q * .75;
    const off = ((scroll * par + o.t * (3 + q * 4)) % step + step) % step;
    const rowTint = mixColor(mixColor(tint, shade, .45 - q * .4), "#ffffff", q * .06);
    const rowShade = mixColor(shade, "#0d0f3c", .45 - q * .3);
    for (let x = -step * 2 - off; x < W + step * 2; x += step) {
      const id = Math.floor((x + off) / step) + row * 211 + o.seed * 31;
      const r = step * (.62 + .5 * hash(id, 1));
      const px = x + (hash(id, 2) - .5) * step * .6;
      const py = rowY + (hash(id, 3) - .5) * 26 + Math.sin(o.t * .7 + id) * (o.bob ?? 5);
      billow(c, px, py, r, rowTint, rowShade, lx, ly, 3, .72, id);
    }
  }
}

/* ── 폭풍구름 ───────────────────────────────────────── */

/** 하늘을 덮는 먹구름: 크고 어두운 보라 덩이들. dark(0~1)가 짙을수록 하늘을 많이 덮는다 */
export function stormClouds(c: CanvasRenderingContext2D, t: number, seed: number, o: { dark: number; y?: number; flash?: number }) {
  const y0 = o.y ?? 0;
  const tint = mixColor("#3a3470", "#5a4a96", o.flash ?? 0);
  const shade = "#0c0a2c";
  const n = Math.round(26 * clamp(o.dark));
  c.save();
  for (let i = 0; i < n; i++) {
    // 덩이마다 나타나는 때가 달라 하늘이 조금씩 덮인다
    const born = (i + 1) / (n + 1);
    c.globalAlpha = clamp((o.dark - born * .75) * 3);
    if (c.globalAlpha <= .01) continue;
    const x = hash(i, seed) * (W + 500) - 250 + Math.sin(t * .15 + i) * 30;
    const y = y0 + hash(i, seed + 1) * 380 * (.5 + o.dark * .8);
    const r = 150 + hash(i, seed + 2) * 230;
    billow(c, x, y, r, tint, shade, .2, -.9, 3, .6, i);
  }
  c.restore();
}

/** 번개(빛 층): 갈라지며 내려오는 차가운 흰 선. age 0이 번쩍하는 순간 */
export function lightning(c: CanvasRenderingContext2D, k: Kit, x0: number, y0: number, x1: number, y1: number, seed: number, a = 1) {
  const pts: { x: number; y: number }[] = [{ x: x0, y: y0 }];
  const n = 18;
  for (let i = 1; i <= n; i++) {
    const v = i / n;
    pts.push({ x: mix(x0, x1, v) + (hash(i, seed) - .5) * 120 * Math.sin(v * Math.PI * .9 + .2), y: mix(y0, y1, v) + (hash(i, seed + 1) - .5) * 26 });
  }
  const path = (pp: { x: number; y: number }[], w0: number, w1: number, col: string, al: number) => {
    // 위(굵음) → 아래(가늘어짐)로 굵기를 바꿔 이어 그린다
    c.strokeStyle = col;
    for (let i = 1; i < pp.length; i++) {
      c.globalAlpha = al * (1 - (i / pp.length) * .35);
      c.lineWidth = mix(w0, w1, i / pp.length);
      c.beginPath(); c.moveTo(pp[i - 1].x, pp[i - 1].y); c.lineTo(pp[i].x, pp[i].y); c.stroke();
    }
  };
  const branches: { x: number; y: number }[][] = [];
  for (let b = 4; b < n - 3; b += 4) {
    const p = pts[b], dir = hash(b, seed + 5) < .5 ? -1 : 1, br: { x: number; y: number }[] = [p];
    for (let j = 1; j <= 5; j++) br.push({ x: p.x + dir * j * 22 + (hash(j + b, seed + 8) - .5) * 26, y: p.y + j * 30 });
    branches.push(br);
  }
  c.save();
  c.lineCap = "round"; c.lineJoin = "round";
  for (const [w0, w1, col, al] of [[46, 14, "120,140,255", .1 * a], [18, 6, "190,208,255", .35 * a], [7, 2.5, "248,250,255", a]] as [number, number, string, number][]) {
    path(pts, w0, w1, `rgba(${col},1)`, al);
    branches.forEach((br) => path(br, w0 * .5, w1 * .4, `rgba(${col},1)`, al * .8));
  }
  // 번개가 지나간 자리의 번짐
  c.globalAlpha = .25 * a;
  c.drawImage(k.glowCold, x0 - 360, y0 - 100, 720, (y1 - y0) + 300);
  c.restore();
}

/* ── 들판 ───────────────────────────────────────────── */

/** 달 아래의 들판: 지평선에서 아래로 짙어지는 땅과 풀잎(붓결). horizon 위는 건드리지 않는다 */
export function fieldPaint(c: CanvasRenderingContext2D, k: Kit, horizon: number, tq: number, wind = 1) {
  const g = c.createLinearGradient(0, horizon, 0, H);
  g.addColorStop(0, "#1a1f60"); g.addColorStop(1, "#0d1038");
  c.fillStyle = g;
  c.fillRect(-300, horizon, W + 600, H - horizon + 400);
  mottle(c, -300, horizon, W + 600, H - horizon, 26, 301, .1, 60);
  c.lineCap = "round";
  for (const b of k.blades) {
    const y = horizon + (b.y - 340) * (H - horizon) / 760;
    const sway = Math.sin(tq * 1.6 * wind + b.x * .01 + b.c * 6) * b.h * .12;
    c.strokeStyle = b.c < .5 ? "#0f1238" : "#3a418e";
    c.lineWidth = 1.5 + b.h * .09;
    c.beginPath(); c.moveTo(b.x, y); c.lineTo(b.x + (b.c - .5) * b.h * .4 + sway, y - b.h * 1.4); c.stroke();
  }
}

/* ── 건물 정면과 창 ──────────────────────────────────── */

export type WinKind = "lamp" | "plant" | "cat" | "family" | "tv" | "dark" | "curtain" | "friend";

const SIL = "#1a0e2e";

/** 창 하나(깨끗한 장면). 내용에 따라 방 안 모습이 다르다: 불 켜진 저마다의 밤 */
export function windowCell(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, kind: WinKind, t: number, seed: number) {
  c.fillStyle = "#04051a";
  c.fillRect(x - 10, y - 10, w + 20, h + 20);
  const warm = kind !== "tv" && kind !== "dark" && kind !== "friend";
  const g = c.createLinearGradient(0, y, 0, y + h);
  if (kind === "dark") { g.addColorStop(0, "#0c0f3c"); g.addColorStop(1, "#090b2c"); }
  else if (kind === "tv") { g.addColorStop(0, "#2a4a9a"); g.addColorStop(1, "#16286a"); }
  else if (kind === "friend") { g.addColorStop(0, "#1c2c7a"); g.addColorStop(1, "#2a44a0"); }
  else { g.addColorStop(0, "#ffe3a8"); g.addColorStop(1, "#f0a050"); }
  c.fillStyle = g;
  c.fillRect(x, y, w, h);
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.fillStyle = SIL;
  switch (kind) {
    case "lamp": {
      c.fillRect(x + w * .62, y + h * .55, 4, h * .4);
      c.beginPath(); c.moveTo(x + w * .62 - 24, y + h * .55); c.lineTo(x + w * .62 + 28, y + h * .55); c.lineTo(x + w * .62 + 16, y + h * .36); c.lineTo(x + w * .62 - 12, y + h * .36); c.closePath(); c.fill();
      break;
    }
    case "plant": {
      c.fillRect(x + w * .2, y + h * .8, w * .26, h * .2);
      for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(x + w * (.24 + i * .06), y + h * (.62 - i % 2 * .1), w * .05, h * .16, (i - 1.5) * .35, 0, TAU); c.fill(); }
      break;
    }
    case "cat": {
      c.beginPath(); c.ellipse(x + w * .5, y + h * .9, w * .24, h * .2, 0, Math.PI, 0); c.fill();
      c.beginPath(); c.arc(x + w * .62, y + h * .68, w * .12, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(x + w * .54, y + h * .62); c.lineTo(x + w * .56, y + h * .5); c.lineTo(x + w * .62, y + h * .58); c.fill();
      c.beginPath(); c.moveTo(x + w * .66, y + h * .58); c.lineTo(x + w * .72, y + h * .5); c.lineTo(x + w * .72, y + h * .62); c.fill();
      break;
    }
    case "family": {
      c.beginPath(); c.arc(x + w * .34, y + h * .56, w * .1, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(x + w * .34, y + h * .9, w * .16, h * .26, 0, Math.PI, 0); c.fill();
      c.beginPath(); c.arc(x + w * .64, y + h * .68, w * .07, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(x + w * .64, y + h * .96, w * .11, h * .18, 0, Math.PI, 0); c.fill();
      c.fillRect(x, y + h * .84, w, h * .1);
      break;
    }
    case "tv": {
      const fl = .55 + .2 * Math.sin(t * 7 + seed);
      c.fillStyle = `rgba(190,215,255,${fl})`; c.fillRect(x + w * .55, y + h * .2, w * .36, h * .3);
      c.fillStyle = SIL;
      c.beginPath(); c.arc(x + w * .3, y + h * .62, w * .1, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(x + w * .3, y + h * .98, w * .17, h * .3, 0, Math.PI, 0); c.fill();
      break;
    }
    case "friend": {
      // 침대 모서리에 앉아 폰을 보는 작은 분홍 후드 아이
      c.fillStyle = "#14185a"; c.fillRect(x, y + h * .78, w, h * .3);
      c.fillStyle = "#b04a80";
      c.beginPath(); c.ellipse(x + w * .5, y + h * .8, w * .2, h * .26, 0, Math.PI, 0); c.fill();
      c.beginPath(); c.arc(x + w * .5, y + h * .55, w * .15, 0, TAU); c.fill();
      c.fillStyle = "#ffd9a0"; c.beginPath(); c.arc(x + w * .5, y + h * .4, w * .04, 0, TAU); c.fill();
      c.fillStyle = "#e9efff"; c.fillRect(x + w * .46, y + h * .64, w * .1, h * .1);
      break;
    }
    case "curtain": {
      c.fillStyle = "rgba(120,50,70,.55)";
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + w * .34, y); c.quadraticCurveTo(x + w * .2, y + h * .5, x + w * .3, y + h); c.lineTo(x, y + h); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(x + w, y); c.lineTo(x + w * .66, y); c.quadraticCurveTo(x + w * .8, y + h * .5, x + w * .7, y + h); c.lineTo(x + w, y + h); c.closePath(); c.fill();
      break;
    }
    default: break;
  }
  c.restore();
  // 창살과 문턱
  c.fillStyle = "rgba(4,5,26,.85)";
  c.fillRect(x + w / 2 - 3, y, 6, h);
  c.fillRect(x, y + h * .46, w, 5);
  c.fillStyle = "#3a4296";
  c.fillRect(x - 14, y + h + 8, w + 28, 9);
  c.fillStyle = "#5a66bc";
  c.fillRect(x - 14, y + h + 8, w + 28, 3);
  void warm;
}

export type FacadeOpts = {
  /** 옆으로 흐른 거리(px) */
  scroll: number;
  t: number;
  seed: number;
  /** 창 칸 크기와 간격 */
  cw?: number;
  ch?: number;
  gx?: number;
  gy?: number;
  /** 첫 줄의 y */
  y0?: number;
  rows?: number;
  /** 특별한 창(번호)과 그 종류 */
  special?: { col: number; row: number; kind: WinKind } | null;
};

const KINDS: WinKind[] = ["lamp", "plant", "cat", "family", "dark", "curtain", "lamp", "dark", "tv"];

/** 창 칸의 번호 → 내용(굴러가도 같은 창은 같다) */
export function winKind(col: number, row: number, seed: number): WinKind {
  const h = hash(col * 13 + row * 5, seed + 9);
  if (h < .22) return "dark";
  return KINDS[Math.floor(hash(col * 7 + row * 3, seed + 11) * KINDS.length)];
}

/**
 * 건물 정면: 벽(얼룩·빗물 자국), 층마다 가로 띠, 창 칸들. 옆으로 흘러가며 지나간다.
 * 반환값은 화면의 특별한 창의 위치(없으면 null)
 */
export function facadePaint(c: CanvasRenderingContext2D, o: FacadeOpts) {
  const cw = o.cw ?? 140, ch = o.ch ?? 190, gx = o.gx ?? 300, gy = o.gy ?? 330, y0 = o.y0 ?? 80, rows = o.rows ?? 3;
  const wall = c.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, "#161a52"); wall.addColorStop(1, "#0a0c2c");
  c.fillStyle = wall;
  c.fillRect(-100, -100, W + 200, H + 200);
  mottle(c, -100, -100, W + 200, H + 200, 55 + o.seed * 7, 40, .08, 46);
  let found: { x: number; y: number; w: number; h: number } | null = null;
  const first = Math.floor(o.scroll / gx) - 1;
  for (let col = first; col * gx - o.scroll < W + gx; col++) {
    const x = col * gx - o.scroll + 80;
    for (let row = 0; row < rows; row++) {
      const y = y0 + row * gy;
      const kind = o.special && o.special.col === col && o.special.row === row ? o.special.kind : winKind(col, row, o.seed);
      windowCell(c, x, y, cw, ch, kind, o.t, col * 9 + row);
      if (o.special && o.special.col === col && o.special.row === row) found = { x, y, w: cw, h: ch };
    }
    // 층 띠(몰딩)
    for (let row = 0; row <= rows; row++) {
      c.fillStyle = "rgba(60,70,150,.5)"; c.fillRect(x - 90, y0 + row * gy - 38, gx, 7);
      c.fillStyle = "rgba(2,3,18,.5)"; c.fillRect(x - 90, y0 + row * gy - 31, gx, 5);
    }
    // 건물 사이 홈
    if (hash(col, o.seed + 77) < .28) { c.fillStyle = "#04051a"; c.fillRect(x - 100, -100, 10, H + 200); }
  }
  return found;
}

/* ── 친구의 창(밖에서 본 모습)과 방(안에서 본 모습) ──────── */

export type BigWindow = { x: number; y: number; w: number; h: number };

/** 창틀 바깥 벽: 지금 컷의 배경. 옆 창들이 가장자리에 걸쳐 건물임을 알린다 */
export function wallWithWindow(c: CanvasRenderingContext2D, t: number, win: BigWindow, seed: number) {
  const wall = c.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, "#171b55"); wall.addColorStop(1, "#0a0c2c");
  c.fillStyle = wall;
  c.fillRect(-100, -100, W + 200, H + 200);
  mottle(c, -100, -100, W + 200, H + 200, 60 + seed, 50 + seed, .08, 52);
  // 이웃 창들(가장자리)
  windowCell(c, win.x - win.w - 220, win.y + 40, win.w * .7, win.h * .72, "lamp", t, seed);
  windowCell(c, win.x + win.w + 150, win.y + 20, win.w * .7, win.h * .72, "dark", t, seed + 1);
  // 층 띠
  c.fillStyle = "rgba(60,70,150,.5)"; c.fillRect(-100, win.y + win.h + 78, W + 200, 8);
  c.fillStyle = "rgba(2,3,18,.5)"; c.fillRect(-100, win.y + win.h + 86, W + 200, 6);
}

/**
 * 친구의 방 안(밖에서 창 너머로 보인다): 어두운 방, 줄 전구, 침대, 포스터. 폰의 차가운 빛이 방을 푸르게 비춘다.
 * open(0~1)만큼 창 두 짝이 안쪽으로 열린다. 친구 아이는 호출하는 쪽에서 그 위에 그린다.
 */
export function friendWindow(c: CanvasRenderingContext2D, t: number, win: BigWindow, open = 0, between?: () => void) {
  const { x, y, w, h } = win;
  // 돌 테두리
  c.fillStyle = "#04051a"; c.fillRect(x - 44, y - 44, w + 88, h + 88);
  c.fillStyle = "#2c3380"; c.fillRect(x - 38, y - 38, w + 76, h + 76);
  c.fillStyle = "#04051a"; c.fillRect(x - 14, y - 14, w + 28, h + 28);
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  // 방 안
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "#161e6c"); g.addColorStop(1, "#0f1658");
  c.fillStyle = g; c.fillRect(x, y, w, h);
  mottle(c, x, y, w, h, 7, 120, .07, 40, "90,110,230");
  // 벽 포스터와 줄 전구
  c.fillStyle = "#1e2a84"; c.fillRect(x + w * .08, y + h * .22, w * .2, h * .26);
  c.fillStyle = "#2a3aa0"; c.fillRect(x + w * .1, y + h * .25, w * .16, h * .14);
  c.strokeStyle = "#0a0c3a"; c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(x, y + h * .12); c.quadraticCurveTo(x + w * .5, y + h * .3, x + w, y + h * .1); c.stroke();
  for (let i = 0; i < 9; i++) {
    const v = (i + .5) / 9, px = mix(x, x + w, v), py = y + h * .12 + 4 * (h * .18) * v * (1 - v) * 1.0 + h * .0;
    c.fillStyle = i % 3 === 1 ? "#ffd9a0" : "#ffcf7a";
    c.beginPath(); c.arc(px, py + 8, 6, 0, TAU); c.fill();
  }
  // 침대(오른쪽)와 이불
  c.fillStyle = "#0b0f48"; c.fillRect(x + w * .52, y + h * .6, w * .5, h * .5);
  c.fillStyle = "#3a2a78"; c.beginPath(); c.roundRect(x + w * .5, y + h * .64, w * .52, h * .2, 18); c.fill();
  c.fillStyle = "#4a3a94"; c.beginPath(); c.roundRect(x + w * .54, y + h * .6, w * .22, h * .1, 14); c.fill();
  // 바닥
  c.fillStyle = "#0a0d40"; c.fillRect(x, y + h * .9, w, h * .2);
  // 방 안의 사람(창 안쪽에만 보인다)
  if (between) between();
  c.restore();
  void t;
  // 창살(닫혀 있으면 가운데 문설주와 가로살, 열리면 두 짝이 안쪽으로 꺾인다)
  c.fillStyle = "#04051a";
  if (open <= 0) {
    c.fillRect(x + w / 2 - 6, y, 12, h);
    c.fillRect(x, y + h * .34, w, 10);
    // 유리의 사선 반사
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.fillStyle = "rgba(190,210,255,.07)";
    c.beginPath(); c.moveTo(x + w * .12, y); c.lineTo(x + w * .3, y); c.lineTo(x + w * .05, y + h); c.lineTo(x - w * .13, y + h); c.fill();
    c.beginPath(); c.moveTo(x + w * .4, y); c.lineTo(x + w * .48, y); c.lineTo(x + w * .23, y + h); c.lineTo(x + w * .15, y + h); c.fill();
    c.restore();
  } else {
    const sw = 1 - open * .78;
    c.strokeStyle = "#04051a"; c.lineWidth = 12;
    for (const [hx, dir] of [[x, 1], [x + w, -1]] as [number, number][]) {
      const ww = (w / 2) * sw * dir;
      c.beginPath();
      c.moveTo(hx, y); c.lineTo(hx + ww, y - open * 30); c.lineTo(hx + ww, y + h + open * 30); c.lineTo(hx, y + h); c.closePath(); c.stroke();
      c.fillStyle = "rgba(160,190,255,.1)"; c.fill();
    }
  }
  // 문턱
  c.fillStyle = "#2c3380"; c.fillRect(x - 60, y + h + 14, w + 120, 26);
  c.fillStyle = "#5a66bc"; c.fillRect(x - 60, y + h + 14, w + 120, 5);
  c.fillStyle = "rgba(2,3,18,.55)"; c.fillRect(x - 60, y + h + 40, w + 120, 10);
}

/** 방 안에서 본 벽(창 구멍까지 일단 벽으로 채운다. 호출하는 쪽이 창 구멍을 하늘로 덮은 뒤 roomFrame을 부른다) */
export function roomWall(c: CanvasRenderingContext2D, t: number) {
  const wall = c.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, "#161b58"); wall.addColorStop(1, "#0d1048");
  c.fillStyle = wall;
  c.fillRect(-100, -100, W + 200, H + 200);
  mottle(c, -100, -100, W + 200, H + 200, 40, 77, .07, 56, "90,110,230");
  void t;
}

/** 방 안에서 본 창틀·열린 창 두 짝·커튼·문턱·방바닥(창 구멍 위에 얹는다) */
export function roomFrame(c: CanvasRenderingContext2D, t: number, win: BigWindow, open = 1) {
  const { x, y, w, h } = win;
  void t;
  c.save();
  c.strokeStyle = "#04051a"; c.lineWidth = 34;
  c.strokeRect(x - 14, y - 14, w + 28, h + 28);
  c.strokeStyle = "#2c3380"; c.lineWidth = 10;
  c.strokeRect(x - 34, y - 34, w + 68, h + 68);
  // 열린 창 두 짝(안쪽으로 꺾여 방 쪽으로 튀어나온다)
  const sw = 1 - open * .8;
  c.strokeStyle = "#04051a"; c.lineWidth = 14;
  for (const [hx, dir] of [[x, 1], [x + w, -1]] as [number, number][]) {
    const ww = (w / 2) * sw * dir;
    c.beginPath();
    c.moveTo(hx, y); c.lineTo(hx + ww, y - open * 40); c.lineTo(hx + ww, y + h + open * 40); c.lineTo(hx, y + h); c.closePath(); c.stroke();
    c.fillStyle = "rgba(150,180,255,.08)"; c.fill();
  }
  c.restore();
  // 커튼(왼쪽)과 문턱
  c.fillStyle = "rgba(130,60,110,.7)";
  c.beginPath(); c.moveTo(x - 150, y - 80); c.lineTo(x + 40, y - 80); c.quadraticCurveTo(x - 40, y + h * .45, x + 20, y + h + 40); c.lineTo(x - 170, y + h + 40); c.closePath(); c.fill();
  c.fillStyle = "#3a4296"; c.fillRect(x - 70, y + h + 18, w + 140, 30);
  c.fillStyle = "#6a76c8"; c.fillRect(x - 70, y + h + 18, w + 140, 5);
  // 방바닥
  const fl = c.createLinearGradient(0, y + h + 48, 0, H);
  fl.addColorStop(0, "#1a1e62"); fl.addColorStop(1, "#0b0e40");
  c.fillStyle = fl; c.fillRect(-100, y + h + 48, W + 200, H);
  mottle(c, -100, y + h + 48, W + 200, H, 12, 91, .08, 50);
}

/* ── 구름 섬 ───────────────────────────────────────── */

export type Island = { tint?: string; shade?: string; scatter?: number; light?: [number, number]; alpha?: number };

/**
 * 구름 섬(징검다리): 윗면이 비교적 평평한 구름 덩어리. 덩이 여섯쯤을 겹친다.
 * scatter(0~1)가 커지면 덩이들이 바람에 흩어져 안개처럼 사라진다.
 */
export function cloudIsland(c: CanvasRenderingContext2D, cx: number, topY: number, w: number, seed: number, o: Island = {}) {
  const sc = o.scatter ?? 0;
  const tint = o.tint ?? "#a39ad6", shade = o.shade ?? "#3a3590";
  const [lx, ly] = o.light ?? [.5, -.8];
  c.save();
  c.globalAlpha = (o.alpha ?? 1) * (1 - sc * .6);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const v = i / (n - 1) - .5;
    const r = (84 + hash(i, seed + 1) * 56) * (1 - sc * .5);
    const x = cx + v * w * .92 + (hash(i, seed + 2) - .5) * sc * 700;
    // 가운데가 조금 높고 양끝이 낮다(섬처럼)
    const y = topY + r * .5 + Math.abs(v) * 40 + hash(i, seed + 3) * 18 + sc * (hash(i, seed + 4) * 260 - 40);
    billow(c, x, y, r, tint, shade, lx, ly, 3, .62, seed + i);
  }
  c.restore();
}

/** 구름 틈으로 내려다보이는 아득한 도시. 두 창(친구와 아이)에 불이 켜져 마주 보고 있다. 가장자리는 구름 덩이로 두른다 */
export function cityHole(c: CanvasRenderingContext2D, k: Kit, tq: number, cx: number, cy: number, rx: number, ry: number, glow: number) {
  c.save();
  c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, TAU); c.clip();
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, rx);
  g.addColorStop(0, "#0c1040"); g.addColorStop(1, "#050722");
  c.fillStyle = g; c.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
  // 동네마다 모여 있는 불빛(멀리서 내려다본 도시)
  for (let n = 0; n < 16; n++) {
    const ccx = cx - rx * .85 + hash(n, 311) * rx * 1.7, ccy = cy - ry * .6 + hash(n, 312) * ry * 1.2;
    const cr = 30 + hash(n, 313) * 50;
    for (let i = 0; i < 16; i++) {
      const a = hash(i + n * 16, 314) * TAU, d = Math.sqrt(hash(i + n * 16, 315)) * cr;
      const px = ccx + Math.cos(a) * d, py = ccy + Math.sin(a) * d * .5;
      const tw = .55 + .45 * Math.sin(tq * 1.7 + i + n);
      c.fillStyle = hash(i + n * 16, 316) < .85 ? `rgba(255,205,125,${.45 + .4 * tw})` : `rgba(200,222,255,${.45 + .4 * tw})`;
      c.fillRect(px, py, 6 + hash(i + n * 16, 317) * 6, 5 + hash(i + n * 16, 318) * 5);
    }
  }
  // 마주 보는 두 창: 가운데 가까이 나란히(밝게)
  for (const [dx, col] of [[-30, "#ffe3a8"], [30, "#ffc2d8"]] as [number, string][]) {
    c.fillStyle = col;
    c.fillRect(cx + dx - 10, cy + 2, 20, 24);
  }
  c.restore();
  // 가장자리를 구름 덩이로 둘러 부드럽게 한다
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU + hash(i, 321) * .2;
    const px = cx + Math.cos(a) * rx * .96, py = cy + Math.sin(a) * ry * .98;
    billow(c, px, py + (Math.sin(a) > 0 ? 10 : -4), 54 + hash(i, 322) * 34, "#a39ad6", "#383488", .4, -.8, 3, .62, i + 400);
  }
  void k; void glow;
}
