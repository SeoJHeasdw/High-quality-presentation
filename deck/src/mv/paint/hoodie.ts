/**
 * 후드 쓴 작은 아이. 몸은 깨끗한 장면에 그려 붓질 패스가 칠하고(drawHoodie),
 * 눈·볼은 붓질 뒤에 또렷하게 얹는다(drawHoodieFace). 연기는 눈에서 읽히기 때문이다.
 * 기준점은 발밑 가운데, s는 몸 전체 높이(px).
 *
 *   squash   + 납작하게 / - 길게 (발밑 기준). 예비동작과 반동에 쓴다
 *   turn     얼굴이 후드 안에서 돌아간 정도(-1 왼쪽 … 1 오른쪽)
 *   look     눈동자 방향(-1 … 1)
 *   phone    0 무릎 위 … 1 얼굴 앞
 *   back     뒷모습(후드만 보인다). rim은 앞에서 오는 빛의 테두리
 */
export type Pose = {
  x: number;
  y: number;
  s: number;
  squash?: number;
  lean?: number;
  turn?: number;
  lookX?: number;
  lookY?: number;
  blink?: number;
  phone?: number;
  /** 폰 화면 밝기 0~1. 얼굴을 아래에서 비춘다 */
  glow?: number;
  back?: boolean;
  seated?: boolean;
  rim?: string;
};

const HOOD = "#20255c";
const HOOD_DARK = "#141840";
const SKIN = "#f2a878";
const SKIN_DARK = "#a85f48";

function ellipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string) {
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, Math.PI * 2);
  g.fill();
}

function enter(g: CanvasRenderingContext2D, p: Pose) {
  const sq = p.squash ?? 0;
  g.translate(p.x, p.y);
  g.rotate(p.lean ?? 0);
  g.scale(1 + sq * .6, 1 - sq);
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

function phoneLocal(p: Pose) {
  const u = p.s, ph = p.phone ?? 0;
  return { lx: ((p.turn ?? 0) * .05 + .02 + ph * .02) * u, ly: -(.24 + ph * .3) * u, w: .1 * u, h: .15 * u, tilt: -.25 + ph * .2 };
}

/** 폰 화면의 장면 좌표. 빛 패스가 같은 자리에 빛을 얹는다 */
export function phoneRect(p: Pose) {
  const { lx, ly, w, h, tilt } = phoneLocal(p);
  const sq = p.squash ?? 0, a = p.lean ?? 0;
  const x = lx * (1 + sq * .6), y = ly * (1 - sq);
  return { x: p.x + x * Math.cos(a) - y * Math.sin(a), y: p.y + x * Math.sin(a) + y * Math.cos(a), w, h, tilt: tilt + a };
}

export function drawHoodie(g: CanvasRenderingContext2D, p: Pose) {
  const { u, by, hx, hy, fx, fy } = frame(p);
  const glow = p.glow ?? 0;
  g.save();
  enter(g, p);

  if (p.seated !== false) {
    ellipse(g, -.13 * u, -.05 * u, .13 * u, .06 * u, HOOD_DARK);
    ellipse(g, .13 * u, -.05 * u, .13 * u, .06 * u, HOOD_DARK);
    ellipse(g, -.25 * u, -.04 * u, .05 * u, .045 * u, "#cfc8e4");
    ellipse(g, .25 * u, -.04 * u, .05 * u, .045 * u, "#cfc8e4");
  }

  if (p.back) {
    // 테두리 빛: 빛 색으로 한 번 칠하고, 어두운 몸을 빛 반대쪽(아래)으로 살짝 밀어 덮는다
    if (p.rim) {
      g.fillStyle = p.rim;
      g.beginPath(); outline(g, p); g.fill();
    }
    g.save();
    g.translate(0, p.rim ? .02 * u : 0);
    g.fillStyle = HOOD;
    g.beginPath(); outline(g, p); g.fill();
    // 후드 솔기
    g.strokeStyle = HOOD_DARK;
    g.lineWidth = .02 * u;
    g.beginPath(); g.moveTo(hx, hy - .2 * u); g.quadraticCurveTo(hx + .02 * u, hy, hx, hy + .22 * u); g.stroke();
    g.restore();
    g.restore();
    return;
  }

  g.fillStyle = HOOD;
  g.beginPath(); outline(g, p); g.fill();
  if (glow > 0) {
    const lit = g.createRadialGradient(0, by - .25 * u, 0, 0, by - .25 * u, .35 * u);
    lit.addColorStop(0, `rgba(150,175,255,${.45 * glow})`);
    lit.addColorStop(1, "rgba(150,175,255,0)");
    g.fillStyle = lit;
    g.beginPath(); outline(g, p); g.fill();
  }

  // 얼굴: 후드 안에서 고개 돌린 쪽으로 밀린다. 폰 빛이 아래에서 비춘다
  const face = g.createLinearGradient(0, fy - .17 * u, 0, fy + .17 * u);
  face.addColorStop(0, SKIN_DARK);
  face.addColorStop(1, glow > .2 ? "#ffd0a6" : SKIN);
  g.fillStyle = face;
  g.beginPath(); g.ellipse(fx, fy, .18 * u, .165 * u, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = HOOD_DARK;
  g.lineWidth = .03 * u;
  g.stroke();

  const r = phoneLocal(p);
  g.save();
  g.translate(r.lx, r.ly);
  g.rotate(r.tilt);
  g.fillStyle = "#0d1030";
  g.fillRect(-r.w / 2 - .008 * u, -r.h / 2 - .008 * u, r.w + .016 * u, r.h + .016 * u);
  g.fillStyle = glow > 0 ? `rgb(${200 + 40 * glow | 0},${215 + 30 * glow | 0},255)` : "#2a3060";
  g.fillRect(-r.w / 2, -r.h / 2, r.w, r.h);
  g.restore();
  ellipse(g, r.lx - .06 * u, r.ly + .05 * u, .045 * u, .04 * u, SKIN);
  ellipse(g, r.lx + .06 * u, r.ly + .05 * u, .045 * u, .04 * u, SKIN);
  g.restore();
}

/** 붓질 뒤에 얹는 눈과 볼 */
export function drawHoodieFace(g: CanvasRenderingContext2D, p: Pose) {
  if (p.back) return;
  const { u, fx, fy } = frame(p);
  g.save();
  enter(g, p);
  const ex = fx + (p.lookX ?? 0) * .035 * u, ey = fy + (p.lookY ?? 0) * .03 * u - .005 * u;
  const open = 1 - (p.blink ?? 0);
  ellipse(g, fx - .11 * u, fy + .065 * u, .034 * u, .018 * u, "rgba(240,110,120,.45)");
  ellipse(g, fx + .11 * u, fy + .065 * u, .034 * u, .018 * u, "rgba(240,110,120,.45)");
  for (const side of [-1, 1]) {
    const x = ex + side * .065 * u;
    if (open < .3) {
      // 감은 눈: 아래로 휜 선
      g.strokeStyle = "#1b1230";
      g.lineWidth = .012 * u;
      g.lineCap = "round";
      g.beginPath(); g.arc(x, ey - .01 * u, .022 * u, .2 * Math.PI, .8 * Math.PI); g.stroke();
      continue;
    }
    ellipse(g, x, ey, .025 * u, .037 * u * open, "#1b1230");
    ellipse(g, x + .009 * u, ey - .013 * u, .008 * u, .008 * u, "#fff6e0");
  }
  g.restore();
}
