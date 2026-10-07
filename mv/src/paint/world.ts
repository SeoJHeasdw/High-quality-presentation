/**
 * 컷에 쓰는 무대: 방, 도시, 지붕(점프대), 골목, 구름, 폭풍, 들판, 도시 위에서 본 모습, 창가.
 * 모두 "깨끗한 장면"(붓질 전)에 그린다. 평평한 색 면과 반듯한 직선은 붓질 뒤에도 컴퓨터 그림으로 남으므로,
 * 면마다 붓으로 쓸어 놓은 얼룩(mottle)과 빗물 자국·벽돌결·빛 가장자리를 얹어 손으로 칠한 벽처럼 만든다.
 */
import { W, H, hash, clamp, mix, P, HORIZON, roofSegs, cityBody, windowGlow, skyFill, starfield, cloudBands, moth, type Kit } from "./kit.ts";
import { pulse } from "../scenes.ts";
import { lighter, mixColor } from "./stage.ts";
import { phoneRect, type Pose } from "./hoodie.ts";

const TAU = Math.PI * 2;

/* ── 면에 붓결 얹기 ─────────────────────────────────── */

/** 사각 영역에 밝고 어두운 얼룩을 흩뿌린다. 평평한 면이 컴퓨터 그림처럼 보이지 않게 한다 */
export function mottle(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, n: number, seed: number, amt = .07, size = 28, tone = "120,130,230") {
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  for (let i = 0; i < n; i++) {
    const px = x + hash(i, seed) * w, py = y + hash(i, seed + 1) * h;
    const lw = size * (.5 + hash(i, seed + 2) * 1.6), lh = size * (.25 + hash(i, seed + 3) * .7);
    const light = hash(i, seed + 4) > .5;
    const a = amt * (.4 + hash(i, seed + 5));
    c.fillStyle = light ? `rgba(${tone},${a})` : `rgba(0,0,12,${a * 1.7})`;
    c.save(); c.translate(px, py); c.rotate((hash(i, seed + 6) - .5) * .6);
    c.beginPath(); c.ellipse(0, 0, lw, lh, 0, 0, TAU); c.fill(); c.restore();
  }
  c.restore();
}

/** 벽의 빗물 자국(위에서 아래로 번지는 어두운 줄) */
function stains(c: CanvasRenderingContext2D, x: number, y: number, w: number, n: number, seed: number, len = 260) {
  for (let i = 0; i < n; i++) {
    const sx = x + 14 + hash(i, seed) * (w - 28), l = len * (.3 + hash(i, seed + 1) * .9), sw = 6 + hash(i, seed + 2) * 14;
    const g = c.createLinearGradient(0, y, 0, y + l);
    g.addColorStop(0, "rgba(0,0,14,.32)"); g.addColorStop(1, "rgba(0,0,14,0)");
    c.fillStyle = g;
    c.fillRect(sx, y, sw, l);
  }
}

/* ── 지붕 ───────────────────────────────────────────── */

const BODY0 = "#161a52", BODY1 = "#080a26";
const PARAPET = "#242a70", PARAPET_HI = "#6671c8", PARAPET_SH = "#04051a";
const PROP = "#0d1038", PROP_HI = "#3d4994";

/** 창 줄. 켜진 창은 따뜻하게. 번호는 건물(조각) 번호로만 정해 스크롤해도 같은 창이 켜져 있다 */
function windowRows(c: CanvasRenderingContext2D, x: number, y0: number, w: number, seg: number, rows: number, lit = .16) {
  const colW = 86, rowH = 104;
  const cols = Math.max(1, Math.floor((w - 40) / colW));
  const ox = x + (w - cols * colW) / 2 + (colW - 38) / 2;
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    const wx = ox + q * colW, wy = y0 + r * rowH;
    const on = hash(seg * 37 + r * 11 + q, 123) < lit;
    c.fillStyle = "#04051a";
    c.fillRect(wx - 4, wy - 4, 46, 62);
    if (on) {
      const g = c.createLinearGradient(0, wy, 0, wy + 54);
      g.addColorStop(0, "#ffe3a8"); g.addColorStop(1, "#f2a85a");
      c.fillStyle = g;
    } else c.fillStyle = hash(seg * 37 + r * 11 + q, 124) < .3 ? "#1b2068" : "#0c0f3c";
    c.fillRect(wx, wy, 38, 54);
    c.fillStyle = "rgba(4,5,26,.7)";
    c.fillRect(wx + 18, wy, 3, 54);
    c.fillRect(wx, wy + 22, 38, 3);
    c.fillStyle = "#2c3380";
    c.fillRect(wx - 6, wy + 54, 50, 5);
  }
}

/** 지붕 위 물건(굴뚝·안테나·물탱크·빨랫줄·옥탑·환기구). 종류는 조각의 kind로 정한다 */
function roofProps(c: CanvasRenderingContext2D, t: number, x: number, w: number, top: number, kind: number, seg: number) {
  const hi = (px: number, py: number, pw: number, ph: number) => { c.fillStyle = PROP_HI; c.fillRect(px + pw - 4, py, 4, ph); };
  if (kind < .18) {
    const px = x + w * .3;
    c.fillStyle = PROP; c.fillRect(px, top - 112, 74, 114);
    hi(px, top - 112, 74, 114);
    c.fillStyle = "rgba(0,0,14,.4)";
    for (let by = top - 100; by < top; by += 18) c.fillRect(px, by, 74, 3);
    c.fillStyle = PARAPET; c.fillRect(px - 10, top - 128, 94, 18);
    c.fillStyle = PARAPET_HI; c.fillRect(px - 10, top - 128, 94, 3);
    for (let j = 0; j < 4; j++) {
      const age = ((t * .5 + j / 4) % 1);
      c.fillStyle = `rgba(130,130,200,${.2 * (1 - age)})`;
      c.beginPath(); c.ellipse(px + 37 + Math.sin(t * .8 + j * 2) * 12 * age, top - 150 - age * 190, 16 + age * 34, 12 + age * 24, 0, 0, TAU); c.fill();
    }
  } else if (kind < .36) {
    const px = x + w * .55;
    c.fillStyle = PROP;
    c.fillRect(px - 2.5, top - 196, 5, 198);
    for (const [dy, cw] of [[-170, 70], [-136, 54], [-104, 40]] as [number, number][]) c.fillRect(px - cw / 2, top + dy, cw, 4);
    c.fillStyle = PROP_HI; c.fillRect(px - 2.5, top - 196, 2, 120);
    c.strokeStyle = "#1c2060"; c.lineWidth = 2;
    c.beginPath(); c.moveTo(px, top - 190); c.lineTo(px - 90, top); c.moveTo(px, top - 190); c.lineTo(px + 90, top); c.stroke();
  } else if (kind < .52) {
    const px = x + w * .5;
    c.fillStyle = PROP;
    for (const lx of [-34, -12, 12, 34]) c.fillRect(px + lx - 3, top - 70, 6, 72);
    c.fillStyle = "#12164a";
    c.beginPath(); c.roundRect(px - 46, top - 142, 92, 76, 10); c.fill();
    c.fillStyle = PROP_HI; c.fillRect(px + 38, top - 142, 8, 76);
    c.fillStyle = "rgba(0,0,14,.45)"; c.fillRect(px - 46, top - 118, 92, 4); c.fillRect(px - 46, top - 92, 92, 4);
    c.fillStyle = PROP;
    c.beginPath(); c.moveTo(px - 52, top - 140); c.lineTo(px, top - 178); c.lineTo(px + 52, top - 140); c.closePath(); c.fill();
  } else if (kind < .66) {
    const p1 = x + w * .16, p2 = x + w * .84;
    c.fillStyle = PROP;
    c.fillRect(p1 - 3, top - 138, 6, 140); c.fillRect(p2 - 3, top - 138, 6, 140);
    c.strokeStyle = "#232868"; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(p1, top - 128); c.quadraticCurveTo((p1 + p2) / 2, top - 92, p2, top - 128); c.stroke();
    const tints = ["#2c3478", "#5c3060", "#6a5048", "#24485e", "#443a7a", "#80643e"];
    for (let i = 0; i < 6; i++) {
      const v = (i + .6) / 6.4, cx = mix(p1, p2, v), sag = 4 * 36 * v * (1 - v) * .9;
      const cw = 22 + hash(i, seg + 3) * 14, ch = 36 + hash(i, seg + 4) * 22;
      c.save(); c.translate(cx, top - 128 + sag);
      c.transform(1, 0, Math.sin(t * 1.5 + i * 1.3) * .14, 1, 0, 0);
      c.fillStyle = tints[Math.floor(hash(i, seg + 5) * tints.length)];
      c.fillRect(-cw / 2, 0, cw, ch);
      c.fillStyle = "rgba(0,0,14,.3)"; c.fillRect(-cw / 2, ch - 6, cw, 6);
      c.restore();
    }
  } else if (kind < .8) {
    const px = x + w * .34;
    c.fillStyle = PROP; c.fillRect(px, top - 100, 134, 102);
    hi(px, top - 100, 134, 102);
    c.fillStyle = PARAPET; c.fillRect(px - 8, top - 112, 150, 14);
    c.fillStyle = PARAPET_HI; c.fillRect(px - 8, top - 112, 150, 3);
    c.fillStyle = "#04051a"; c.fillRect(px + 20, top - 66, 34, 66);
    c.fillStyle = "#ffcf7a"; c.fillRect(px + 80, top - 82, 32, 34);
    c.fillStyle = "#04051a"; c.fillRect(px + 94, top - 82, 3, 34);
  } else {
    const px = x + w * .4;
    c.fillStyle = PROP;
    c.fillRect(px, top - 64, 14, 66); c.fillRect(px - 8, top - 74, 30, 12);
    c.fillRect(px + 60, top - 44, 14, 46); c.fillRect(px + 60, top - 52, 28, 10);
    c.beginPath(); c.arc(px + 150, top - 80, 40, Math.PI * .15, Math.PI * 1.15); c.lineTo(px + 150, top - 80); c.fill();
    c.fillRect(px + 148, top - 80, 5, 82);
    c.fillStyle = "#0f2a40";
    c.beginPath(); c.ellipse(px + 230, top - 52, 16, 36, .3, 0, TAU); c.ellipse(px + 246, top - 40, 14, 28, -.4, 0, TAU); c.fill();
    c.fillStyle = PROP; c.fillRect(px + 220, top - 20, 38, 22);
  }
}

/**
 * 지붕 줄(깨끗한 장면). scroll만큼 왼쪽으로 흐른다. gapAt(화면 x)이 있으면 거기서 건물이 끝나고 모서리 벽이 선다.
 * 지붕마다 파라펫(가장자리 단)·벽·창·물건이 있고 달빛이 오른쪽 모서리를 훑는다.
 */
export function roofsPainted(c: CanvasRenderingContext2D, t: number, y: number, scroll: number, seed: number, gapAt?: number, opt: { windows?: number } = {}) {
  const segs = roofSegs(seed);
  segs.forEach((r, i) => {
    const x = r.x - scroll;
    if (x > W + 400 || x + r.w < -400) return;
    if (gapAt !== undefined && x >= gapAt) return;
    const right = gapAt !== undefined ? Math.min(x + r.w, gapAt) : x + r.w;
    const w = right - x;
    if (w <= 10) return;
    const top = y + r.dy;
    const g = c.createLinearGradient(0, top, 0, top + 560);
    g.addColorStop(0, BODY0); g.addColorStop(1, BODY1);
    c.fillStyle = g;
    c.fillRect(x, top, w, H - top + 400);
    mottle(c, x, top, w, 640, 34 + seed * 100 + i, 26, .08, 34);
    stains(c, x, top + 8, w, Math.max(2, Math.round(w / 110)), 77 + i * 9);
    windowRows(c, x, top + 78, w, i + seed * 50, opt.windows ?? 7, .17);
    // 건물 사이 어두운 틈과 오른쪽 모서리의 달빛
    c.fillStyle = "#04051a"; c.fillRect(right - 6, top, 6, H - top + 400);
    c.fillStyle = "rgba(110,124,230,.35)"; c.fillRect(right - 10, top, 4, H - top + 400);
    roofProps(c, t, x, w, top, r.kind, i + seed * 50);
    // 파라펫
    c.fillStyle = PARAPET; c.fillRect(x - 3, top - 15, w + 3, 17);
    c.fillStyle = PARAPET_HI; c.fillRect(x - 3, top - 15, w + 3, 3);
    c.fillStyle = PARAPET_SH; c.fillRect(x - 3, top + 2, w + 3, 5);
    c.fillStyle = "rgba(4,5,26,.5)";
    for (let bx = x + 14; bx < right - 8; bx += 36) c.fillRect(bx, top - 12, 3, 12);
  });
  if (gapAt !== undefined) {
    // 모서리: 빗물받이 관과 모서리 기둥(달빛이 닿는 쪽)
    const top = roofTopAt(gapAt - 4, y, scroll, seed);
    c.fillStyle = "#1a1f60"; c.fillRect(gapAt - 30, top - 40, 30, 44);
    c.fillStyle = PARAPET_HI; c.fillRect(gapAt - 30, top - 40, 30, 3);
    c.fillStyle = "rgba(150,164,255,.28)"; c.fillRect(gapAt - 6, top - 38, 6, 42);
    c.fillStyle = "#0b0e36"; c.fillRect(gapAt - 46, top + 6, 11, H - top);
    c.fillStyle = PROP_HI; c.fillRect(gapAt - 38, top + 6, 3, H - top);
    c.fillStyle = "#04051a";
    for (let by = top + 70; by < H + 200; by += 120) c.fillRect(gapAt - 50, by, 19, 6);
  }
}

function roofTopAt(x: number, y: number, scroll: number, seed: number) {
  for (const r of roofSegs(seed)) if (x < r.x - scroll + r.w) return y + r.dy;
  return y;
}

/** 지붕 창의 따뜻한 빛(빛 층) */
export function roofsGlow(c: CanvasRenderingContext2D, k: Kit, y: number, scroll: number, seed: number, gapAt?: number, rows = 7) {
  const segs = roofSegs(seed);
  c.save();
  c.globalCompositeOperation = "lighter";
  segs.forEach((r, i) => {
    const x = r.x - scroll;
    if (x > W + 400 || x + r.w < -400) return;
    if (gapAt !== undefined && x >= gapAt) return;
    const right = gapAt !== undefined ? Math.min(x + r.w, gapAt) : x + r.w;
    const w = right - x;
    if (w <= 10) return;
    const top = y + r.dy;
    const colW = 86, rowH = 104;
    const cols = Math.max(1, Math.floor((w - 40) / colW));
    const ox = x + (w - cols * colW) / 2 + (colW - 38) / 2;
    const segId = i + seed * 50;
    for (let rr = 0; rr < rows; rr++) for (let q = 0; q < cols; q++) {
      if (hash(segId * 37 + rr * 11 + q, 123) >= .17) continue;
      c.globalAlpha = .5;
      c.drawImage(k.glowGold, ox + q * colW - 40, top + 78 + rr * rowH - 26, 120, 120);
    }
    if (r.kind >= .66 && r.kind < .8) { c.globalAlpha = .55; c.drawImage(k.glowGold, x + w * .34 + 96 - 60, top - 66 - 60, 120, 120); }
  });
  c.restore();
}

/**
 * 건물 사이의 틈(골목): 점프대 건너편. 깊은 어둠, 맞은편 건물의 창, 아래에서 올라오는 거리의 불빛,
 * 틈을 가로지르는 빨랫줄. gapAt에서 오른쪽으로 펼친다.
 */
export function alley(c: CanvasRenderingContext2D, t: number, gapAt: number, roofTop: number, seed = 3) {
  // 맞은편 건물: 낮고 멀다(공기 때문에 살짝 밝고 푸르다)
  const bx = gapAt + 360, btop = roofTop + 180;
  const bg = c.createLinearGradient(0, btop, 0, H + 200);
  bg.addColorStop(0, "#1c2166"); bg.addColorStop(1, "#0f1244");
  c.fillStyle = bg;
  c.fillRect(bx, btop, W + 800 - bx, H + 400);
  mottle(c, bx, btop, W - bx + 400, 700, 71 + seed, 26, .08, 34);
  windowRows(c, bx + 10, btop + 66, W - bx + 300, 900 + seed, 6, .3);
  c.fillStyle = "#3a4596"; c.fillRect(bx, btop - 12, W + 800 - bx, 14);
  c.fillStyle = PARAPET_HI; c.fillRect(bx, btop - 12, W + 800 - bx, 3);
  c.fillStyle = "#04051a"; c.fillRect(bx - 8, btop - 12, 8, H + 400);
  // 두 건물 사이의 깊이: 우리 건물 쪽 모서리에서 번지는 그늘(투명)과 아래에서 올라오는 어둠
  const gl = c.createLinearGradient(gapAt, 0, bx, 0);
  gl.addColorStop(0, "rgba(2,3,20,.7)"); gl.addColorStop(1, "rgba(2,3,20,0)");
  c.fillStyle = gl; c.fillRect(gapAt - 4, roofTop + 40, bx - gapAt + 8, H);
  const dg = c.createLinearGradient(0, roofTop + 120, 0, H);
  dg.addColorStop(0, "rgba(2,3,20,0)"); dg.addColorStop(1, "rgba(2,3,20,.55)");
  c.fillStyle = dg; c.fillRect(gapAt - 4, roofTop + 120, bx - gapAt + 8, H);
  c.strokeStyle = "#1e2468"; c.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const yy = roofTop + 130 + i * 150;
    c.beginPath(); c.moveTo(gapAt - 10, yy); c.quadraticCurveTo((gapAt + bx) / 2, yy + 40 + i * 8, bx + 20, yy + 6); c.stroke();
  }
  // 아래 거리의 불빛
  const sg = c.createRadialGradient(gapAt + 190, H + 160, 0, gapAt + 190, H + 160, 560);
  sg.addColorStop(0, "rgba(255,170,90,.36)"); sg.addColorStop(1, "rgba(255,170,90,0)");
  c.fillStyle = sg; c.fillRect(gapAt - 400, H - 460, 1100, 700);
  // 틈에 걸린 가로등(빛은 빛 층에서)
  c.fillStyle = "#06071c";
  c.fillRect(gapAt + 150, roofTop + 250, 3, 60);
  c.beginPath(); c.arc(gapAt + 151, roofTop + 312, 9, 0, TAU); c.fillStyle = "#ffe0a0"; c.fill();
  void t;
}

export function alleyGlow(c: CanvasRenderingContext2D, k: Kit, gapAt: number, roofTop: number, beat: number) {
  lighter(c, () => {
    c.globalAlpha = .55 + .15 * beat;
    c.drawImage(k.glowGold, gapAt + 151 - 90, roofTop + 312 - 90, 180, 180);
    c.globalAlpha = .3;
    c.drawImage(k.glowGold, gapAt + 160 - 380, H - 200, 760, 420);
    c.globalAlpha = 1;
  });
}

/* ── 방 ─────────────────────────────────────────────── */

export const WIN = { x0: 1170, y0: 50, x1: 1990, y1: 770 };
export const CITY_IN_WINDOW = { x: 1100, y: 640 - HORIZON * .56, s: .56 };

export function room(c: CanvasRenderingContext2D, k: Kit, tq: number, o: { lit: number; open?: number; dawn?: number; gold?: number }) {
  const dawn = o.dawn ?? 0;
  const wall = c.createLinearGradient(0, 0, 0, 830);
  wall.addColorStop(0, dawn ? "#1a1840" : P.wall0);
  wall.addColorStop(1, dawn ? "#2a2552" : P.wall1);
  c.fillStyle = wall;
  c.fillRect(-300, -300, W + 600, 1140);
  mottle(c, -300, -300, W + 600, 1140, 5, 140, .06, 60);
  // 창 밖
  c.save();
  c.beginPath(); c.rect(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0); c.clip();
  c.translate(CITY_IN_WINDOW.x, CITY_IN_WINDOW.y); c.scale(CITY_IN_WINDOW.s, CITY_IN_WINDOW.s);
  if (dawn) {
    const sky = c.createLinearGradient(0, -300, 0, HORIZON);
    sky.addColorStop(0, "#2c2b62");
    sky.addColorStop(.6, mixColor("#2c2b62", "#9a6390", dawn));
    sky.addColorStop(1, mixColor("#3a3570", "#f0a86a", dawn));
    c.fillStyle = sky;
    c.fillRect(-400, -600, W + 800, HORIZON + 600);
    cloudBands(c, tq, 31, 4, 80, 80, `rgba(240,170,170,${.35 * dawn})`);
  } else {
    skyFill(c, -300, HORIZON);
    starfield(c, k, HORIZON - 200, tq);
    cloudBands(c, tq, 31, 5, 60, 70);
  }
  cityBody(c, k, o.lit);
  c.restore();
  // 창틀(열리면 두 짝이 안쪽으로 돈다)
  const open = o.open ?? 0;
  c.fillStyle = "#080a22";
  c.strokeStyle = "#080a22";
  c.lineWidth = 26;
  c.strokeRect(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0);
  if (open <= 0) {
    c.fillRect(1572, WIN.y0, 20, WIN.y1 - WIN.y0);
    c.fillRect(WIN.x0, 400, WIN.x1 - WIN.x0, 18);
  } else {
    const sw = (1 - open * .8);
    c.lineWidth = 16;
    for (const [hx, dir] of [[WIN.x0, 1], [WIN.x1, -1]] as [number, number][]) {
      const w = 410 * sw * dir;
      c.beginPath();
      c.moveTo(hx, WIN.y0); c.lineTo(hx + w, WIN.y0 - open * 50); c.lineTo(hx + w, WIN.y1 + open * 50); c.lineTo(hx, WIN.y1);
      c.closePath(); c.stroke();
      c.fillStyle = "rgba(120,140,220,.12)";
      c.fill();
    }
  }
  c.fillStyle = "#262a66";
  c.fillRect(WIN.x0 - 30, WIN.y1, WIN.x1 - WIN.x0 + 60, 26);
  c.fillStyle = "#3e4290";
  c.fillRect(WIN.x0 - 30, WIN.y1, WIN.x1 - WIN.x0 + 60, 5);
  const floor = c.createLinearGradient(0, 830, 0, H);
  floor.addColorStop(0, dawn ? "#251f4c" : P.floor0);
  floor.addColorStop(1, dawn ? "#32295a" : P.floor1);
  c.fillStyle = floor;
  c.fillRect(-300, 830, W + 600, H);
  mottle(c, -300, 830, W + 600, 300, 9, 160, .06, 50);
  c.fillStyle = "#0b0d2c";
  c.fillRect(-300, 822, W + 600, 10);
  c.fillStyle = dawn ? `rgba(240,160,130,${.22 * dawn})` : "rgba(110,110,190,.22)";
  c.beginPath(); c.moveTo(1180, 832); c.lineTo(1960, 832); c.lineTo(1560, H + 40); c.lineTo(640, H + 40); c.closePath(); c.fill();
  if (o.gold) {
    const gl = c.createRadialGradient(720, 620, 0, 720, 620, 700);
    gl.addColorStop(0, `rgba(255,190,100,${.35 * o.gold})`);
    gl.addColorStop(1, "rgba(255,190,100,0)");
    c.fillStyle = gl;
    c.fillRect(-300, -300, W + 600, H + 600);
  }
}

export function roomCityGlow(c: CanvasRenderingContext2D, k: Kit, lit: number) {
  c.save();
  c.beginPath(); c.rect(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0); c.clip();
  c.translate(CITY_IN_WINDOW.x, CITY_IN_WINDOW.y); c.scale(CITY_IN_WINDOW.s, CITY_IN_WINDOW.s);
  lighter(c, () => windowGlow(c, k, lit, () => Infinity, pulse));
  c.restore();
}

export function phoneLight(c: CanvasRenderingContext2D, k: Kit, p: Pose) {
  const pr = phoneRect(p);
  const gl = p.glow ?? 0;
  lighter(c, () => {
    c.globalAlpha = .55 * gl;
    c.drawImage(k.glowCold, pr.x - 160, pr.y - 160, 320, 320);
    c.globalAlpha = .9 * gl;
    c.drawImage(k.glowWhite, pr.x - 40, pr.y - 40, 80, 80);
  });
}

/* ── 도시를 멀리 놓는 도우미 ─────────────────────────── */

export function farCity(c: CanvasRenderingContext2D, k: Kit, x: number, y: number, s: number, lit: number) {
  c.save(); c.translate(x, y); c.scale(s, s); cityBody(c, k, lit); c.restore();
}
export function farCityGlow(c: CanvasRenderingContext2D, k: Kit, x: number, y: number, s: number, lit: number) {
  c.save(); c.translate(x, y); c.scale(s, s);
  lighter(c, () => windowGlow(c, k, lit, () => Infinity, pulse));
  c.restore();
}

/* ── 나방이 놓은 빛의 다리 ──────────────────────────── */

type Pt = { x: number; y: number };

/** 길(점 줄)을 따라 걸어가며 일정한 간격마다 부르는 도우미. 간격마다 (점, 접선 각, 앞에서부터의 비율)을 준다 */
function along(pts: Pt[], gap: number, fn: (p: Pt, ang: number, v: number, i: number) => void) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  let acc = 0, run = 0, n = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], seg = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
    let s = gap - acc;
    while (s <= seg) {
      const q = s / seg;
      fn({ x: mix(a.x, b.x, q), y: mix(a.y, b.y, q) }, ang, (run + s) / total, n++);
      s += gap;
    }
    acc = seg - (s - gap);
    run += seg;
  }
}

/* ── 달로 올라가는 나방 사다리 ───────────────────────── */

/** 사다리 폭의 절반(px). 난간은 길의 법선 방향으로 ±HALF 떨어져, 길이 어느 쪽으로 휘어도 두 난간이 겹치지 않는다 */
const HALF = 27;

/** 길이 위·오른쪽으로 갈 때 위쪽(먼 난간 쪽)을 가리키는 단위 법선. ang는 진행 방향 각 */
const nrm = (ang: number) => ({ x: Math.sin(ang), y: -Math.cos(ang) });

/** 점 줄의 j번째 점에서의 진행 방향 각(이웃 두 점으로 구한다) */
function tangentAt(pts: Pt[], j: number) {
  const a = pts[Math.max(0, j - 1)], b = pts[Math.min(pts.length - 1, j + 1)];
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/**
 * 나방 사다리(깨끗한 장면): 점 줄은 아이가 밟는 가운데 줄이다. 난간은 가는 금빛 붓 두 줄뿐이고,
 * 발판은 빛 층의 나방이다(ladderGlow): 나방 한 마리가 날개를 활짝 펴 두 난간을 잇는다. 그래서 가볍고, 나방으로 짠 사다리로 읽힌다.
 * 가는 붓 줄도 붓질 패스가 점으로 끊어 칠하므로 매끈한 선이 되지 않는다. 발판 자리에는 아주 가는 가로 붓만 깔아
 * 나방이 날갯짓으로 접혀도 사다리 모양이 끊기지 않게 한다.
 * part "back"은 먼 난간과 가로 붓(아이 뒤), "front"는 가까운 난간(아이 앞)이다. 아이는 이 둘 사이에 그린다.
 * reveal(0~1)만큼 앞에서부터 놓이고, fadeEnd는 끝에서 옅어지는 비율(달 앞에서 끝난다).
 */
export function ladderPaint(c: CanvasRenderingContext2D, pts: Pt[], part: "back" | "front", o: { reveal?: number; t?: number; fadeEnd?: number; rung?: number } = {}) {
  const reveal = o.reveal ?? 1, fadeEnd = o.fadeEnd ?? 0, rung = o.rung ?? 57;
  const n = Math.max(2, Math.floor(pts.length * reveal));
  const used = pts.slice(0, n);
  if (used.length < 2) return;
  const fade = (v: number) => (fadeEnd > 0 ? clamp((1 - v) / fadeEnd) : 1);
  c.save();
  c.lineCap = "round"; c.lineJoin = "round";
  const rail = (side: 1 | -1) => {
    const w = side > 0 ? 6 : 8;
    const at = (j: number) => {
      const nv = nrm(tangentAt(used, j));
      return { x: used[j].x + nv.x * HALF * side + Math.sin(j * .9 + side) * 1.4, y: used[j].y + nv.y * HALF * side + Math.cos(j * .7 + side) * 1.4 };
    };
    for (const [dw, dy, col, a] of [[w + 4, 3, "#3e2610", .8], [w, 0, side > 0 ? "#d8a64e" : "#f6d27a", 1]] as [number, number, string, number][]) {
      for (let i = 1; i < used.length; i++) {
        const al = a * fade(i / used.length);
        if (al <= .01) continue;
        const p0 = at(i - 1), p1 = at(i);
        c.strokeStyle = col; c.globalAlpha = al; c.lineWidth = dw;
        c.beginPath(); c.moveTo(p0.x, p0.y + dy); c.lineTo(p1.x, p1.y + dy); c.stroke();
      }
    }
    c.globalAlpha = 1;
  };
  if (part === "front") rail(-1);
  else {
    rail(1);
    along(used, rung, (p, ang, v) => {
      const al = fade(v);
      if (al <= .02) return;
      const nv = nrm(ang);
      c.strokeStyle = "#e2b256"; c.globalAlpha = .75 * al; c.lineWidth = 4;
      c.beginPath(); c.moveTo(p.x + nv.x * HALF, p.y + nv.y * HALF); c.lineTo(p.x - nv.x * HALF, p.y - nv.y * HALF); c.stroke();
    });
  }
  c.globalAlpha = 1;
  c.restore();
}

/**
 * 사다리의 빛 층(나방이 주인공): 발판마다 나방 한 마리가 날개를 활짝 펴 두 난간을 잇고(머리는 달 쪽),
 * 난간에는 작은 나방이 줄지어 앉으며, 사다리를 따라 나방 몇 마리가 위로 날아오른다. foot은 방금 디딘 발판의 세기.
 */
export function ladderGlow(c: CanvasRenderingContext2D, k: Kit, pts: Pt[], tq: number, beat: number, o: { reveal?: number; fadeEnd?: number; rung?: number; foot?: { x: number; y: number; a: number } } = {}) {
  const reveal = o.reveal ?? 1, fadeEnd = o.fadeEnd ?? 0, rung = o.rung ?? 57;
  const n = Math.max(2, Math.floor(pts.length * reveal));
  const used = pts.slice(0, n);
  if (used.length < 2) return;
  const fade = (v: number) => (fadeEnd > 0 ? clamp((1 - v) / fadeEnd) : 1);
  c.save();
  c.globalCompositeOperation = "lighter";
  // 아주 옅은 번짐(두껍게 보이지 않도록 약하게)
  along(used, 110, (p, ang, v) => { c.globalAlpha = (.05 + .03 * beat) * fade(v); c.drawImage(k.glowGold, p.x - 80, p.y - 70, 160, 140); });
  c.globalAlpha = 1;
  // 발판 = 날개를 활짝 편 나방(몸은 길 방향, 날개는 난간에서 난간으로). 머리가 달 쪽을 향한다
  along(used, rung, (p, ang, v, i) => {
    moth(c, k, p.x + (hash(i, 6) - .5) * 5, p.y + (hash(i, 9) - .5) * 5, HALF * (.74 + hash(i, 7) * .1), tq * .55, hash(i, 8) * 6, fade(v), ang + Math.PI / 2, .4, .5);
  });
  // 난간에 앉은 작은 나방
  for (const side of [1, -1] as const) {
    along(used, 92, (p, ang, v, i) => {
      const id = i * 3 + (side > 0 ? 1 : 2), nv = nrm(ang);
      moth(c, k, p.x + nv.x * HALF * side, p.y + nv.y * HALF * side, 8 + hash(id, 3) * 2.5, tq * .7, hash(id, 4) * 6, .85 * fade(v), ang + Math.PI / 2, .5, .5);
    });
  }
  // 사다리를 따라 위로 날아오르는 나방들(달 쪽으로)
  const len = used.length;
  for (let j = 0; j < 9; j++) {
    const u = ((hash(j, 31) + tq * (.06 + .04 * hash(j, 32))) % 1) * (len - 1), i0 = Math.floor(u), i1 = Math.min(len - 1, i0 + 1), w = u - i0;
    const px = mix(used[i0].x, used[i1].x, w), py = mix(used[i0].y, used[i1].y, w), ang = tangentAt(used, i0), nv = nrm(ang);
    const off = Math.sin(tq * 2.2 + j * 1.9) * HALF * 1.1;
    moth(c, k, px + nv.x * off, py + nv.y * off - 18 - hash(j, 33) * 20, 11 + hash(j, 34) * 4, tq, hash(j, 35) * 6, .95 * fade(u / (len - 1)));
  }
  c.globalAlpha = 1;
  if (o.foot && o.foot.a > .02) {
    const r = 60 + (1 - o.foot.a) * 100;
    c.globalAlpha = o.foot.a * .7; c.drawImage(k.glowGold, o.foot.x - r, o.foot.y - r * .5, r * 2, r);
    c.globalAlpha = o.foot.a * .9; c.drawImage(k.glowWhite, o.foot.x - 34, o.foot.y - 26, 68, 52);
  }
  c.restore();
}
