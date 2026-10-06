/**
 * 후드 쓴 작은 아이. 몸은 깨끗한 장면에 그려 붓질 패스가 칠하고(drawHoodie),
 * 눈·볼·입은 붓질 뒤에 또렷하게 얹는다(drawHoodieFace). 연기는 얼굴에서 읽히기 때문이다.
 * 기준점은 발밑 가운데, s는 몸 전체 높이(px).
 *
 *   squash   + 납작하게 / - 길게 (발밑 기준). 예비동작과 반동에 쓴다
 *   facing   1 오른쪽 / -1 왼쪽. 옆으로 걸을 때 몸 전체를 뒤집는다
 *   turn     얼굴이 후드 안에서 돌아간 정도(-1 … 1). facing과 같이 쓰면 옆얼굴
 *   walk     걷는 위상(라디안). 있으면 다리가 번갈아 나가고 몸이 위아래로 흔들린다
 *   arms     phone · none · up · point · out · fly · hold(무릎 위에 두 손)
 *   back     뒷모습(후드만 보인다). rim은 앞에서 오는 빛의 테두리
 */
export type Arms = "phone" | "none" | "up" | "point" | "out" | "fly" | "hold";

export type Pose = {
  x: number;
  y: number;
  s: number;
  squash?: number;
  lean?: number;
  facing?: number;
  turn?: number;
  lookX?: number;
  lookY?: number;
  blink?: number;
  mouth?: "smile" | "o" | "flat";
  phone?: number;
  /** 폰 화면 밝기 0~1. 얼굴을 아래에서 비춘다 */
  glow?: number;
  arms?: Arms;
  walk?: number;
  /** 두 손에 든 빛 구슬의 밝기(0이면 없음) */
  orb?: number;
  back?: boolean;
  seated?: boolean;
  rim?: string;
};

// 밤하늘(#191d4e)보다 한 단 밝고 보랏빛이 돌게. 뒷모습은 하늘보다 어두운 실루엣
const HOOD = "#2c3378";
const HOOD_DARK = "#181c4c";
const SILHOUETTE = "#0a0c26";
/** 앞모습의 기본 테두리(달빛) */
const MOON_RIM = "rgba(132,148,232,.55)";
const SKIN = "#eea274";
const SKIN_DARK = "#9c5642";

function ellipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string) {
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, Math.PI * 2);
  g.fill();
}

function bob(p: Pose) {
  return p.walk === undefined ? 0 : -Math.abs(Math.sin(p.walk)) * .025 * p.s;
}

function enter(g: CanvasRenderingContext2D, p: Pose) {
  const sq = p.squash ?? 0;
  g.translate(p.x, p.y);
  g.rotate(p.lean ?? 0);
  g.scale((1 + sq * .6) * (p.facing ?? 1), 1 - sq);
  g.translate(0, bob(p));
}

/** 몸 좌표의 주요 자리 */
function frame(p: Pose) {
  const u = p.s, turn = p.turn ?? 0;
  const by = p.seated !== false ? -.06 * u : -.14 * u;
  const hx = turn * .05 * u, hy = by - (p.back ? .66 : .72) * u;
  return { u, by, hx, hy, fx: hx + turn * .07 * u, fy: hy + .03 * u };
}

/** 몸과 후드를 하나의 윤곽으로 (현재 경로에 더한다) */
function outline(g: CanvasRenderingContext2D, p: Pose) {
  const { u, by, hx, hy } = frame(p);
  const w = p.back ? .38 : .34;
  g.moveTo(-w * u, by);
  g.bezierCurveTo(-(w + .08) * u, by - .3 * u, -.26 * u, by - .56 * u, 0, by - .58 * u);
  g.bezierCurveTo(.26 * u, by - .56 * u, (w + .08) * u, by - .3 * u, w * u, by);
  g.closePath();
  g.moveTo(hx + .28 * u, hy);
  g.ellipse(hx, hy, .28 * u, (p.back ? .27 : .25) * u, 0, 0, Math.PI * 2);
}

/** 빛 패스에서 아이 뒤의 빛을 가릴 때 쓰는 윤곽(장면 좌표, 현재 경로에 더한다) */
export function hoodieMask(g: CanvasRenderingContext2D, p: Pose) {
  g.save();
  enter(g, p);
  outline(g, p);
  g.restore();
}

/** 몸 좌표의 손 자리 [왼손, 오른손] */
function hands(p: Pose): [number, number][] {
  const { u, by } = frame(p);
  const ph = p.phone ?? 0;
  switch (p.arms ?? (p.phone !== undefined ? "phone" : "none")) {
    case "phone": {
      const x = ((p.turn ?? 0) * .05 + .02 + ph * .02) * u, y = -(.24 + ph * .3) * u + .05 * u;
      return [[x - .06 * u, y], [x + .06 * u, y]];
    }
    case "up": return [[-.2 * u, by - 1.08 * u], [.2 * u, by - 1.1 * u]];
    case "point": return [[-.3 * u, by - .14 * u], [.4 * u, by - 1.0 * u]];
    case "out": return [[-.3 * u, by - .14 * u], [.5 * u, by - .5 * u]];
    case "fly": return [[.3 * u, by - .8 * u], [.42 * u, by - .9 * u]];
    case "hold": return [[-.07 * u, by - .22 * u], [.07 * u, by - .22 * u]];
    default: return [[-.31 * u, by - .12 * u], [.31 * u, by - .12 * u]];
  }
}

function toWorld(p: Pose, lx: number, ly: number) {
  const sq = p.squash ?? 0, a = p.lean ?? 0;
  const x = lx * (1 + sq * .6) * (p.facing ?? 1), y = (ly + bob(p)) * (1 - sq);
  return { x: p.x + x * Math.cos(a) - y * Math.sin(a), y: p.y + x * Math.sin(a) + y * Math.cos(a) };
}

function phoneLocal(p: Pose) {
  const u = p.s, ph = p.phone ?? 0;
  return { lx: ((p.turn ?? 0) * .05 + .02 + ph * .02) * u, ly: -(.24 + ph * .3) * u, w: .1 * u, h: .15 * u, tilt: -.25 + ph * .2 };
}

/** 폰 화면의 장면 좌표. 빛 패스가 같은 자리에 빛을 얹는다 */
export function phoneRect(p: Pose) {
  const { lx, ly, w, h, tilt } = phoneLocal(p);
  const at = toWorld(p, lx, ly);
  return { x: at.x, y: at.y, w, h, tilt: tilt + (p.lean ?? 0) };
}

/** 두 손 사이(빛 구슬 자리)의 장면 좌표 */
export function handsCenter(p: Pose) {
  const [[ax, ay], [bx, by]] = hands(p);
  return toWorld(p, (ax + bx) / 2, (ay + by) / 2 - .04 * p.s);
}

/** 한 손(0 왼손, 1 오른손)의 장면 좌표 */
export function handAt(p: Pose, i: 0 | 1) {
  const h = hands(p)[i];
  return toWorld(p, h[0], h[1]);
}

function drawArms(g: CanvasRenderingContext2D, p: Pose) {
  const { u, by } = frame(p);
  const hs = hands(p);
  g.strokeStyle = p.back ? SILHOUETTE : HOOD;
  g.lineCap = "round";
  g.lineWidth = .1 * u;
  hs.forEach(([x, y], i) => {
    const sx = (i ? .2 : -.2) * u, sy = by - .42 * u;
    g.beginPath();
    g.moveTo(sx, sy);
    g.quadraticCurveTo((sx + x) / 2 + (i ? .06 : -.06) * u, (sy + y) / 2, x, y);
    g.stroke();
  });
  if (!p.back) hs.forEach(([x, y]) => ellipse(g, x, y, .046 * u, .042 * u, SKIN));
}

function drawLegs(g: CanvasRenderingContext2D, p: Pose) {
  const u = p.s;
  if (p.seated !== false) {
    ellipse(g, -.13 * u, -.05 * u, .13 * u, .06 * u, HOOD_DARK);
    ellipse(g, .13 * u, -.05 * u, .13 * u, .06 * u, HOOD_DARK);
    ellipse(g, -.25 * u, -.04 * u, .05 * u, .045 * u, "#c6bfdc");
    ellipse(g, .25 * u, -.04 * u, .05 * u, .045 * u, "#c6bfdc");
    return;
  }
  for (const i of [0, 1]) {
    const swing = p.walk === undefined ? 0 : Math.sin(p.walk + i * Math.PI) * .55;
    const lift = p.walk === undefined ? 0 : Math.max(0, Math.cos(p.walk + i * Math.PI)) * .03 * u;
    g.save();
    g.translate((i ? .07 : -.07) * u, -.17 * u - lift);
    g.rotate(swing);
    g.fillStyle = HOOD_DARK;
    g.fillRect(-.045 * u, 0, .09 * u, .17 * u);
    ellipse(g, .02 * u, .17 * u, .065 * u, .035 * u, "#c6bfdc");
    g.restore();
  }
}

export function drawHoodie(g: CanvasRenderingContext2D, p: Pose) {
  const { u, by, hx, hy, fx, fy } = frame(p);
  const glow = p.glow ?? 0;
  g.save();
  enter(g, p);
  drawLegs(g, p);

  if (p.back) {
    // 테두리 빛: 빛 색으로 한 번 칠하고, 어두운 몸을 빛 반대쪽(아래)으로 살짝 밀어 덮는다
    if (p.rim) {
      g.fillStyle = p.rim;
      g.beginPath(); outline(g, p); g.fill();
    }
    g.save();
    g.translate(0, p.rim ? .035 * u : 0);
    g.fillStyle = SILHOUETTE;
    g.beginPath(); outline(g, p); g.fill();
    if (p.arms && p.arms !== "none") drawArms(g, p);
    g.strokeStyle = HOOD_DARK;
    g.lineWidth = .02 * u;
    g.beginPath(); g.moveTo(hx, hy - .2 * u); g.quadraticCurveTo(hx + .02 * u, hy, hx, hy + .22 * u); g.stroke();
    g.restore();
    g.restore();
    return;
  }

  g.fillStyle = HOOD;
  g.beginPath(); outline(g, p); g.fill();
  g.strokeStyle = p.rim ?? MOON_RIM;
  g.lineWidth = .022 * u;
  g.stroke();
  if (glow > 0) {
    const lit = g.createRadialGradient(0, by - .25 * u, 0, 0, by - .25 * u, .35 * u);
    lit.addColorStop(0, `rgba(150,175,255,${.45 * glow})`);
    lit.addColorStop(1, "rgba(150,175,255,0)");
    g.fillStyle = lit;
    g.beginPath(); outline(g, p); g.fill();
  }

  // 얼굴: 후드 안에서 고개 돌린 쪽으로 밀린다
  const face = g.createLinearGradient(0, fy - .17 * u, 0, fy + .17 * u);
  face.addColorStop(0, SKIN_DARK);
  face.addColorStop(1, glow > .2 || (p.orb ?? 0) > .2 ? "#ffd0a6" : SKIN);
  g.fillStyle = face;
  g.beginPath(); g.ellipse(fx, fy, .18 * u, .165 * u, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = HOOD_DARK;
  g.lineWidth = .03 * u;
  g.stroke();

  const arms = p.arms ?? (p.phone !== undefined ? "phone" : "none");
  if (arms === "phone") {
    const r = phoneLocal(p);
    g.save();
    g.translate(r.lx, r.ly);
    g.rotate(r.tilt);
    g.fillStyle = "#0d1030";
    g.fillRect(-r.w / 2 - .008 * u, -r.h / 2 - .008 * u, r.w + .016 * u, r.h + .016 * u);
    g.fillStyle = glow > 0 ? `rgb(${200 + 40 * glow | 0},${215 + 30 * glow | 0},255)` : "#2a3060";
    g.fillRect(-r.w / 2, -r.h / 2, r.w, r.h);
    g.restore();
    hands(p).forEach(([x, y]) => ellipse(g, x, y, .045 * u, .04 * u, SKIN));
  } else {
    drawArms(g, p);
  }
  if ((p.orb ?? 0) > 0) {
    const [[ax, ay], [bx, by2]] = hands(p);
    ellipse(g, (ax + bx) / 2, (ay + by2) / 2 - .04 * u, .07 * u, .07 * u, "#ffe7b0");
  }
  g.restore();
}

/** 붓질 뒤에 얹는 눈·볼·입 */
export function drawHoodieFace(g: CanvasRenderingContext2D, p: Pose) {
  if (p.back) return;
  const { u, fx, fy } = frame(p);
  g.save();
  enter(g, p);
  const ex = fx + (p.lookX ?? 0) * .035 * u, ey = fy + (p.lookY ?? 0) * .03 * u - .005 * u;
  const open = 1 - (p.blink ?? 0);
  ellipse(g, fx - .11 * u, fy + .065 * u, .034 * u, .018 * u, "rgba(240,110,120,.45)");
  ellipse(g, fx + .11 * u, fy + .065 * u, .034 * u, .018 * u, "rgba(240,110,120,.45)");
  g.strokeStyle = "#1b1230";
  g.lineCap = "round";
  for (const side of [-1, 1]) {
    const x = ex + side * .065 * u;
    if (open < .3) {
      g.lineWidth = .012 * u;
      g.beginPath(); g.arc(x, ey - .01 * u, .022 * u, .2 * Math.PI, .8 * Math.PI); g.stroke();
      continue;
    }
    ellipse(g, x, ey, .025 * u, .037 * u * open, "#1b1230");
    ellipse(g, x + .009 * u, ey - .013 * u, .008 * u, .008 * u, "#fff6e0");
  }
  const mx = fx + (p.lookX ?? 0) * .02 * u, my = fy + .085 * u;
  g.lineWidth = .012 * u;
  if (p.mouth === "smile") { g.beginPath(); g.arc(mx, my - .02 * u, .035 * u, .15 * Math.PI, .85 * Math.PI); g.stroke(); }
  else if (p.mouth === "o") ellipse(g, mx, my, .018 * u, .024 * u, "#1b1230");
  else if (p.mouth === "flat") { g.beginPath(); g.moveTo(mx - .025 * u, my); g.lineTo(mx + .025 * u, my); g.stroke(); }
  g.restore();
}
