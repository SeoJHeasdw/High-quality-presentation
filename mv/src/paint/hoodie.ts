/**
 * 후드 쓴 작은 아이(와 친구). 몸은 깨끗한 장면에 그려 붓질 패스가 칠하고(drawHoodie),
 * 눈·볼·입·눈썹은 붓질 뒤에 또렷하게 얹는다(drawHoodieFace). 연기는 얼굴에서 읽히기 때문이다.
 * 기준점은 발밑 가운데, s는 몸 크기(px).
 *
 * 모든 값이 이어지는 숫자다. 앉기/서기, 팔 자세, 돌아보기를 문자열로 켜고 끄지 않으므로
 * 키프레임 사이를 보간하면 팔이 튀거나 몸이 갑자기 바뀌는 일이 없다(anim.ts의 armsSeq 등).
 *
 *   squash  + 납작하게 / - 길게 (발밑 기준). 예비동작·착지·늘어남
 *   lean    발밑을 축으로 기운 각(rad). rot은 몸 한가운데를 축으로 한 회전(날기·떨어지기)
 *   dir     몸이 향한 쪽(+1 오른쪽, -1 왼쪽). turn은 얼굴이 후드 안에서 돌아간 정도(화면 기준, -1…1)
 *   sit     0 서 있다 … 1 앉아 있다
 *   walk    걸음 위상(걸음 주기 수). 거리 ÷ stride로 얻으면 발이 땅에서 미끄러지지 않는다. gait는 걸음의 세기(0이면 선다)
 *   arms    이름이나 [왼손, 오른손] 목표(ARMS). handL/handR(화면 좌표)에 reachL/reachR만큼 끌려가 물건·손을 잡는다
 *   drag    몸의 움직임을 한 박자 늦게 따라오는 후드·옷자락의 끌림(px, anim.ts의 drag)
 *   brow, joy, eyes, mouth  표정
 */
export type Hand = { x: number; y: number };
/** [왼손, 오른손]. x는 몸 너비(u) 단위(오른쪽 +), y는 옷자락 위로 얼마나 높은가(u) */
export type ArmsT = [Hand, Hand];

export const ARMS = {
  none: [{ x: -.31, y: .12 }, { x: .31, y: .12 }],
  /** 손은 폰을 쥐는 자리가 되도록 rig에서 따로 계산한다 */
  phone: [{ x: -.06, y: .2 }, { x: .06, y: .2 }],
  up: [{ x: -.32, y: 1.04 }, { x: .32, y: 1.06 }],
  point: [{ x: -.3, y: .14 }, { x: .56, y: .92 }],
  out: [{ x: -.3, y: .14 }, { x: .5, y: .5 }],
  fly: [{ x: .3, y: .8 }, { x: .42, y: .9 }],
  hold: [{ x: -.07, y: .22 }, { x: .07, y: .22 }],
  cheer: [{ x: -.46, y: .96 }, { x: .46, y: .96 }],
  wide: [{ x: -.52, y: .55 }, { x: .52, y: .55 }],
  wave: [{ x: -.3, y: .14 }, { x: .44, y: .78 }],
  pocket: [{ x: -.12, y: .16 }, { x: .12, y: .16 }],
  hug: [{ x: -.13, y: .3 }, { x: .13, y: .3 }],
  reach: [{ x: .34, y: .6 }, { x: .5, y: .72 }],
  guard: [{ x: -.18, y: .62 }, { x: .18, y: .62 }],
  flail: [{ x: -.46, y: .9 }, { x: .46, y: .86 }],
} satisfies Record<string, ArmsT>;
export type Arms = keyof typeof ARMS;

export type Tint = {
  hood: string; hoodDark: string; sil: string; rim: string; skin: string; skinDark: string; shoe: string; pants: string;
  /** 후드 꼭대기의 방울 */
  pom?: string;
  lit: string;
};

// 밤하늘(#191d4e)보다 한 단 밝고 보랏빛이 돌게. 뒷모습은 하늘보다 어두운 실루엣
export const HERO: Tint = {
  hood: "#2c3378", hoodDark: "#181c4c", sil: "#0a0c26", rim: "rgba(132,148,232,.55)",
  skin: "#eea274", skinDark: "#9c5642", shoe: "#c6bfdc", pants: "#181c4c", lit: "rgba(150,175,255,",
};
/** 친구: 남보라 밤에서 따뜻하게 눈에 띄는 분홍 후드와 방울 */
export const FRIEND: Tint = {
  hood: "#9a3f72", hoodDark: "#4e1d4a", sil: "#1c0c22", rim: "rgba(255,170,190,.6)",
  skin: "#f2b088", skinDark: "#a65d4a", shoe: "#efe0c8", pants: "#4a2250", pom: "#ffd9a0", lit: "rgba(255,190,210,",
};

/** 옷 색을 어둡게(0~1): 달을 등진 실루엣처럼 보이게 할 때 쓴다. 얼굴·방울·테두리 색은 그대로 둔다(표정이 읽혀야 한다) */
export function shade(t: Tint, k: number): Tint {
  const mixHex = (a: string, w: number) => {
    const n = parseInt(a.slice(1), 16);
    const ch = (sft: number) => Math.round(((n >> sft) & 255) * (1 - w));
    return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
  };
  return { ...t, hood: mixHex(t.hood, k), hoodDark: mixHex(t.hoodDark, k), shoe: mixHex(t.shoe, k), pants: mixHex(t.pants, k) };
}

export type Pose = {
  x: number;
  y: number;
  s: number;
  tint?: Tint;
  squash?: number;
  lean?: number;
  rot?: number;
  dir?: number;
  turn?: number;
  tilt?: number;
  nod?: number;
  sit?: number;
  lookX?: number;
  lookY?: number;
  blink?: number;
  joy?: number;
  eyes?: number;
  brow?: number;
  browY?: number;
  mouth?: "smile" | "grin" | "o" | "flat" | "sad" | "awe" | "yell";
  blush?: number;
  phone?: number;
  phoneOn?: number;
  /** 폰 화면 밝기 0~1. 얼굴을 아래에서 비춘다 */
  glow?: number;
  arms?: Arms | ArmsT;
  handL?: { x: number; y: number };
  handR?: { x: number; y: number };
  reachL?: number;
  reachR?: number;
  /** 손 흔들기 위상(rad) */
  wave?: number;
  walk?: number;
  /** 오르막(앞쪽이 높을수록 +). 발이 비탈에 맞춰 올라간다 */
  slope?: number;
  gait?: number;
  stride?: number;
  run?: number;
  /** 발을 몸쪽으로 당긴 정도 0~1(점프 정점·날기) */
  tuck?: number;
  /** 다리가 대롱대롱 흔들리는 위상(rad)과 세기. 날 때 쓴다 */
  flutter?: number;
  dangle?: number;
  /** 두 손에 든 빛 구슬의 밝기(0이면 없음) */
  orb?: number;
  back?: boolean;
  rim?: string;
  drag?: { x: number; y: number };
};

const TAU = Math.PI * 2;
const mix = (a: number, b: number, w: number) => a + (b - a) * w;
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const tintOf = (p: Pose) => p.tint ?? HERO;

function ellipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, rot = 0) {
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU);
  g.fill();
}

/* ── 몸의 자리 계산 ─────────────────────────────────── */

function bob(p: Pose) {
  const g = p.gait ?? 0;
  if (!g || p.walk === undefined) return 0;
  // 접지(가장 낮음) → 지나가는 자세(가장 높음)가 한 걸음마다
  return -(1 - Math.cos(p.walk * TAU * 2)) / 2 * (.04 + .04 * (p.run ?? 0)) * p.s * g;
}

/** 몸 좌표 → 화면 좌표 행렬 */
function matrix(p: Pose) {
  const u = p.s, sq = p.squash ?? 0;
  const m = new DOMMatrix();
  m.translateSelf(p.x, p.y);
  if (p.rot) { m.translateSelf(0, -.45 * u); m.rotateSelf(p.rot * 180 / Math.PI); m.translateSelf(0, .45 * u); }
  const g = p.walk !== undefined ? (p.gait ?? 0) : 0, run = p.run ?? 0;
  const walkLean = g * (.04 + .09 * run) * (p.dir ?? 1);
  // 걸음마다 좌우로 뒤뚱(롤)하고, 발이 닿는 순간 살짝 눌린다
  const ph = (p.walk ?? 0) * TAU;
  const rock = g * Math.sin(ph) * (.055 - .03 * run);
  const lean = (p.lean ?? 0) + walkLean + rock;
  if (g) m.translateSelf(Math.sin(ph) * .016 * u * g, 0);
  if (lean) m.rotateSelf(lean * 180 / Math.PI);
  const contact = g * .02 * (1 + Math.cos(ph * 2)) / 2;
  m.scaleSelf(1 + (sq + contact) * .6, 1 - (sq + contact));
  m.translateSelf(0, bob(p));
  return m;
}

function applyXf(g: CanvasRenderingContext2D, p: Pose) {
  const m = matrix(p);
  g.transform(m.a, m.b, m.c, m.d, m.e, m.f);
}

function toWorld(p: Pose, lx: number, ly: number) {
  const q = matrix(p).transformPoint(new DOMPoint(lx, ly));
  return { x: q.x, y: q.y };
}
function toLocal(p: Pose, wx: number, wy: number) {
  const q = matrix(p).inverse().transformPoint(new DOMPoint(wx, wy));
  return { x: q.x, y: q.y };
}

function armsOf(p: Pose): ArmsT {
  const a = p.arms ?? (p.phone !== undefined ? "phone" : "none");
  return typeof a === "string" ? ARMS[a] : a;
}

/** 몸 좌표의 주요 자리 */
function frame(p: Pose) {
  const u = p.s, turn = p.turn ?? 0, dir = p.dir ?? 1, sit = p.sit ?? 0;
  const dx = p.drag?.x ?? 0, dy = p.drag?.y ?? 0;
  const by = -mix(.14, .06, sit) * u;
  // 후드는 몸보다 한 박자 늦게 따라온다
  const lagX = clamp(dx * .3, -.09 * u, .09 * u), lagY = clamp(dy * .22, -.07 * u, .07 * u);
  const nod = (p.nod ?? 0) * .03 * u;
  // 걸을 때 머리는 몸보다 한 박자 늦게 오르내리고 흔들린다(겹침 동작)
  const wg = p.walk !== undefined ? (p.gait ?? 0) : 0, wph = (p.walk ?? 0) * TAU;
  const headBob = wg * -.014 * u * Math.sin(wph * 2 - .9), headSway = wg * .012 * u * Math.sin(wph - .8);
  const hx = turn * .05 * u + lagX + headSway, hy = by - (p.back ? .66 : .72) * u + lagY + nod + headBob;
  // 한쪽으로 돌릴수록 얼굴이 후드 안에서 그쪽으로 밀리고 좁아진다
  const t = clamp(turn, -1.6, 1.6);
  const fx = hx + t * .07 * u, fy = hy + .03 * u;
  const squeeze = 1 - .3 * Math.min(1, Math.abs(turn));
  const hem = clamp(dx * .5, -.12 * u, .12 * u);
  return { u, by, hx, hy, fx, fy, dir, sit, squeeze, hem, hemY: clamp(dy * .3, -.05 * u, .05 * u), top: by - .58 * u, tilt: p.tilt ?? 0 };
}
type Fr = ReturnType<typeof frame>;

/** 손 목표(몸 좌표). 폰·구슬은 손 사이에 놓이고, handL/R은 화면 좌표의 목표로 끌어당긴다 */
function hands(p: Pose, f: Fr): [Hand, Hand] {
  const { u, by, dir } = f;
  const a = armsOf(p);
  const ph = p.phone ?? 0;
  const turn = Math.min(1, Math.abs(p.turn ?? 0));
  const phoneMode = (p.arms ?? (p.phone !== undefined ? "phone" : "none")) === "phone";
  const g = p.gait ?? 0, run = p.run ?? 0;
  const swing = Math.cos((p.walk ?? 0) * TAU);
  const out: [Hand, Hand] = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
  for (const i of [0, 1] as const) {
    if (phoneMode) {
      // 폰을 쥔 두 손: 폰 높이만 따라 올라간다
      const x = ((p.turn ?? 0) * .05 + .02 + ph * .02) * u;
      out[i] = { x: x + (i ? .06 : -.06) * u, y: -(.24 + ph * .3) * u + .05 * u };
      continue;
    }
    // 왼쪽을 볼 때는 거울상: 앞서는 손(오른손 쪽 목표)이 화면 왼쪽 팔을 맡는다
    const k = dir < 0 ? 1 - i : i;
    // 옆으로 늘어진 손일수록(hang) 옆모습에서는 몸 가까이 모이고, 걸을 때 앞뒤로 흔들린다
    const rest = ARMS.none[k];
    const hang = 1 - clamp(Math.hypot(a[k].x - rest.x, a[k].y - rest.y) / .3);
    let hx = a[k].x * u * dir * (1 - .35 * turn * hang);
    let hy = by - a[k].y * u;
    if (g && p.walk !== undefined && hang > 0) {
      const fwd = swing * (k ? 1 : -1);      // 오른팔은 왼발이 앞일 때 앞으로
      hx += dir * fwd * (.13 + .08 * run) * u * g * hang;
      hy -= Math.max(0, fwd) * (.03 + .06 * run) * u * g * hang;
    }
    out[i] = { x: hx, y: hy };
  }
  if (p.wave !== undefined) {
    // 오른손을 흔든다(팔꿈치가 중심, 손이 좌우로 호를 그린다)
    const w = dir < 0 ? 0 : 1;
    out[w].x += Math.sin(p.wave) * .07 * u;
    out[w].y -= Math.abs(Math.cos(p.wave)) * .02 * u;
  }
  const wl = [p.handL, p.handR];
  const rw = [p.reachL ?? (p.handL ? 1 : 0), p.reachR ?? (p.handR ? 1 : 0)];
  for (const i of [0, 1] as const) {
    if (!wl[i] || rw[i] <= 0) continue;
    const l = toLocal(p, wl[i]!.x, wl[i]!.y);
    // 어깨에서 너무 멀면 팔이 늘어나는 한도(.78u)에서 멈춘다
    const sx = (i ? .2 : -.2) * u * f.squeeze, sy = by - .42 * u;
    const dx = l.x - sx, dy = l.y - sy, d = Math.hypot(dx, dy), lim = .78 * u;
    const tx = d > lim ? sx + dx / d * lim : l.x, ty = d > lim ? sy + dy / d * lim : l.y;
    out[i] = { x: mix(out[i].x, tx, rw[i]), y: mix(out[i].y, ty, rw[i]) };
  }
  return out;
}

/** 폰이 놓이는 자리와 크기(몸 좌표). 두 손 가운데 */
function phoneLocal(p: Pose) {
  const u = p.s, ph = p.phone ?? 0;
  return { lx: ((p.turn ?? 0) * .05 + .02 + ph * .02) * u, ly: -(.24 + ph * .3) * u, w: .1 * u, h: .15 * u, tilt: -.25 + ph * .2 };
}

/** 발: 서기·앉기·걷기·점프를 한 식으로. x는 앞(+dir)으로, y는 위로 */
function feet(p: Pose, f: Fr): { x: number; y: number; r: number }[] {
  const { u, dir, sit, squeeze } = f;
  const g = p.gait ?? 0, run = p.run ?? 0;
  const tuck = p.tuck ?? 0;
  const out: { x: number; y: number; r: number }[] = [];
  for (const i of [0, 1]) {
    const side = i ? 1 : -1;
    // 서 있는 자리와 앉은 자리 사이를 잇는다
    let x = side * mix(.07 * squeeze, .25, sit) * u;
    let y = mix(0, -.04, sit) * u;
    let r = 0;
    if (g && p.walk !== undefined && sit < .5) {
      const stride = (p.stride ?? .42) * u;
      const sf = mix(.58, .38, run);
      const c0 = ((p.walk + i * .5) % 1 + 1) % 1;
      const half = stride * sf / 2;
      let fx: number, fy = 0;
      if (c0 < sf) fx = half - 2 * half * (c0 / sf);
      else {
        const q = (c0 - sf) / (1 - sf), e = q * q * (3 - 2 * q);
        fx = -half + 2 * half * e;
        fy = -Math.sin(q * Math.PI) * (.05 + .06 * run) * u;
        r = -dir * Math.sin(q * Math.PI) * .35;
      }
      x = mix(x, side * .035 * u + dir * fx, g);
      y = mix(y, fy - bob(p), g);
    }
    if (tuck > 0) {
      x = mix(x, side * .06 * u, tuck * .7);
      y = mix(y, -.16 * u, tuck);
    }
    if (p.slope) y -= p.slope * x * dir;
    if (p.dangle) {
      const sway = Math.sin((p.flutter ?? 0) + i * 1.9) * p.dangle;
      x += sway * .06 * u * dir;
      y -= Math.max(0, Math.cos((p.flutter ?? 0) + i * 1.9)) * p.dangle * .035 * u;
      r += sway * .5;
    }
    out.push({ x, y, r });
  }
  return out;
}

/* ── 윤곽 ───────────────────────────────────────────── */

/** 몸(옷자락)과 후드를 하나의 윤곽으로 (현재 경로에 더한다) */
function outline(g: CanvasRenderingContext2D, p: Pose, f: Fr) {
  const { u, by, hx, hy, hem, hemY } = f;
  const w = p.back ? .38 : .34;
  const top = by - .58 * u;
  g.moveTo(-w * u + hem, by + hemY);
  g.bezierCurveTo(-(w + .08) * u + hem * .5, by - .3 * u, -.26 * u, top + .02 * u, 0, top);
  g.bezierCurveTo(.26 * u, top + .02 * u, (w + .08) * u + hem * .3, by - .3 * u, w * u + hem * .6, by + hemY * .6);
  // 옷자락 아랫단은 살짝 처진다(움직임을 따라 일렁인다)
  g.quadraticCurveTo(hem * .4, by + .02 * u + hemY * .5, -w * u + hem, by + hemY);
  g.closePath();
  g.moveTo(hx + .28 * u, hy);
  g.ellipse(hx, hy, .28 * u, (p.back ? .27 : .25) * u, f.tilt, 0, TAU);
}

/** 빛 패스에서 아이 뒤의 빛을 가릴 때 쓰는 윤곽. destination-out으로 채우는 곳에서 부른다 */
export function maskKid(g: CanvasRenderingContext2D, p: Pose) {
  const f = frame(p);
  g.save();
  applyXf(g, p);
  g.fillStyle = "#000";
  g.strokeStyle = "#000";
  g.beginPath(); outline(g, p, f); g.fill();
  g.lineCap = "round";
  g.lineWidth = .1 * f.u;
  const hs = hands(p, f);
  hs.forEach((h, i) => {
    const s = { x: (i ? .2 : -.2) * f.u * f.squeeze, y: f.by - .42 * f.u };
    g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(h.x, h.y); g.stroke();
  });
  // 다리와 신발도 가린다(발밑의 빛이 신발을 덮지 않게)
  g.lineWidth = .12 * f.u;
  feet(p, f).forEach((ft, i) => {
    g.beginPath(); g.moveTo((i ? .07 : -.07) * f.u * f.squeeze, f.by); g.lineTo(ft.x, ft.y); g.stroke();
    g.beginPath(); g.ellipse(ft.x + f.dir * .025 * f.u, ft.y - .004 * f.u, .07 * f.u, .04 * f.u, ft.r, 0, TAU); g.fill();
  });
  g.restore();
}

/** 한 손(0 왼손, 1 오른손)의 화면 좌표 */
export function handAt(p: Pose, i: 0 | 1) {
  const f = frame(p);
  const h = hands(p, f)[i];
  return toWorld(p, h.x, h.y);
}

/** 두 손 사이(빛 구슬 자리)의 화면 좌표 */
export function handsCenter(p: Pose) {
  const f = frame(p);
  const [a, b] = hands(p, f);
  return toWorld(p, (a.x + b.x) / 2, (a.y + b.y) / 2 - .04 * p.s);
}

/** 머리(후드 가운데)의 화면 좌표 */
export function headAt(p: Pose) {
  const f = frame(p);
  return toWorld(p, f.hx, f.hy);
}

/** 폰 화면의 화면 좌표. 빛 패스가 같은 자리에 빛을 얹는다 */
export function phoneRect(p: Pose) {
  const { lx, ly, w, h, tilt } = phoneLocal(p);
  const at = toWorld(p, lx, ly);
  return { x: at.x, y: at.y, w, h, tilt: tilt + (p.lean ?? 0) };
}

/* ── 그리기 ─────────────────────────────────────────── */

/** 어깨에서 손까지: 팔꿈치가 바깥·아래로 꺾이는 두 마디 팔(고무호스처럼 조금 늘어난다) */
function armPath(g: CanvasRenderingContext2D, s: Hand, h: Hand, side: number, L: number) {
  const dx = h.x - s.x, dy = h.y - s.y, d = Math.hypot(dx, dy) || 1;
  if (d >= L) {
    g.moveTo(s.x, s.y); g.lineTo(h.x, h.y);
    return;
  }
  const bend = Math.sqrt(Math.max(0, L * L - d * d)) / 2;
  // 법선 중 바깥(side)·아래쪽을 고른다
  let nx = -dy / d, ny = dx / d;
  if (nx * side + ny * .5 < 0) { nx = -nx; ny = -ny; }
  const ex = (s.x + h.x) / 2 + nx * bend, ey = (s.y + h.y) / 2 + ny * bend;
  g.moveTo(s.x, s.y);
  g.quadraticCurveTo(2 * ex - (s.x + h.x) / 2, 2 * ey - (s.y + h.y) / 2, h.x, h.y);
}

function drawArms(g: CanvasRenderingContext2D, p: Pose, f: Fr, T: Tint) {
  const { u, by, squeeze } = f;
  const hs = hands(p, f);
  g.lineCap = "round";
  g.lineJoin = "round";
  const L = .36 * u;
  const shoulder = (i: number) => ({ x: (i ? .2 : -.2) * u * squeeze, y: by - .42 * u });
  if (!p.back) {
    // 소매 테두리(살짝 어둡게)
    g.strokeStyle = T.hoodDark;
    g.lineWidth = .118 * u;
    hs.forEach((h, i) => { g.beginPath(); armPath(g, shoulder(i), h, i ? 1 : -1, L); g.stroke(); });
  }
  g.strokeStyle = p.back ? T.sil : T.hood;
  g.lineWidth = .1 * u;
  hs.forEach((h, i) => { g.beginPath(); armPath(g, shoulder(i), h, i ? 1 : -1, L); g.stroke(); });
  if (!p.back) hs.forEach((h) => ellipse(g, h.x, h.y, .05 * u, .046 * u, T.skin));
}

function drawLegs(g: CanvasRenderingContext2D, p: Pose, f: Fr, T: Tint) {
  const { u, by, sit, squeeze } = f;
  const fs = feet(p, f);
  g.lineCap = "round";
  fs.forEach((ft, i) => {
    const side = i ? 1 : -1;
    const hip = { x: side * .07 * u * squeeze, y: by + .0 * u };
    g.strokeStyle = T.pants;
    g.lineWidth = mix(.095, .12, sit) * u;
    g.beginPath(); g.moveTo(hip.x, hip.y); g.lineTo(ft.x, ft.y); g.stroke();
    // 신발: 앞(dir)쪽으로 코가 나온다
    ellipse(g, ft.x + f.dir * .025 * u, ft.y - .004 * u, .065 * u, .035 * u, T.shoe, ft.r);
  });
}

/** 후드 꼭대기의 방울과 몸 주름(움직임이 읽히게 몸에 얹는 어두운 선) */
function drawDetails(g: CanvasRenderingContext2D, p: Pose, f: Fr, T: Tint) {
  const { u, by, hx, hy, hem } = f;
  g.save();
  g.strokeStyle = T.hoodDark;
  g.lineCap = "round";
  g.lineWidth = .016 * u;
  g.globalAlpha = .75;
  // 옷자락 주름 둘: 몸이 한쪽으로 쏠리면 따라 휜다
  const sway = hem * .5;
  g.beginPath(); g.moveTo(-.16 * u, by - .06 * u); g.quadraticCurveTo(-.2 * u + sway, by - .2 * u, -.12 * u, by - .34 * u); g.stroke();
  g.beginPath(); g.moveTo(.17 * u, by - .05 * u); g.quadraticCurveTo(.21 * u + sway, by - .19 * u, .13 * u, by - .33 * u); g.stroke();
  g.restore();
  if (T.pom) {
    g.save();
    g.translate(hx, hy);
    g.rotate(f.tilt);
    ellipse(g, 0, -.255 * u, .06 * u, .055 * u, T.pom);
    g.restore();
  }
}

export function drawHoodie(g: CanvasRenderingContext2D, p: Pose) {
  const f = frame(p);
  const T = tintOf(p);
  const { u, by, hx, hy, fx, fy } = f;
  const glow = p.glow ?? 0;
  g.save();
  applyXf(g, p);
  drawLegs(g, p, f, T);

  if (p.back) {
    // 테두리 빛: 빛 색으로 한 번 칠하고, 어두운 몸을 빛 반대쪽(아래)으로 살짝 밀어 덮는다
    if (p.rim) {
      g.fillStyle = p.rim;
      g.beginPath(); outline(g, p, f); g.fill();
    }
    g.save();
    g.translate(0, p.rim ? .035 * u : 0);
    g.fillStyle = T.sil;
    g.beginPath(); outline(g, p, f); g.fill();
    if (T.pom) ellipse(g, hx, hy - .255 * u, .06 * u, .055 * u, T.sil);
    if (p.arms !== undefined && p.arms !== "none") drawArms(g, p, f, T);
    // 뒷모습의 후드 윤곽만 아주 옅게(가운데 선을 그으면 실루엣이 둘로 갈라져 보인다)
    g.strokeStyle = "rgba(60,70,150,.35)";
    g.lineWidth = .014 * u;
    g.beginPath(); g.ellipse(hx, hy, .245 * u, .225 * u, f.tilt, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    g.restore();
    g.restore();
    return;
  }

  // 몸 + 후드
  const grad = g.createLinearGradient(0, by - .6 * u, 0, by);
  grad.addColorStop(0, T.hood);
  grad.addColorStop(1, T.hood);
  g.fillStyle = grad;
  g.beginPath(); outline(g, p, f); g.fill();
  g.strokeStyle = p.rim ?? T.rim;
  g.lineWidth = .022 * u;
  g.stroke();
  if (glow > 0) {
    const lit = g.createRadialGradient(0, by - .25 * u, 0, 0, by - .25 * u, .35 * u);
    lit.addColorStop(0, `${T.lit}${.45 * glow})`);
    lit.addColorStop(1, `${T.lit}0)`);
    g.fillStyle = lit;
    g.beginPath(); outline(g, p, f); g.fill();
  }
  drawDetails(g, p, f, T);

  // 얼굴: 후드 안에서 고개 돌린 쪽으로 밀린다
  g.save();
  g.translate(hx, hy); g.rotate(f.tilt); g.translate(-hx, -hy);
  const turnAbs = Math.min(1, Math.abs(p.turn ?? 0));
  const fw = .18 * u * (1 - .1 * turnAbs), fh = .165 * u;
  const face = g.createLinearGradient(0, fy - .17 * u, 0, fy + .17 * u);
  face.addColorStop(0, T.skinDark);
  face.addColorStop(1, glow > .2 || (p.orb ?? 0) > .2 ? "#ffd0a6" : T.skin);
  g.fillStyle = face;
  g.beginPath(); g.ellipse(fx, fy, fw, fh, 0, 0, TAU); g.fill();
  g.strokeStyle = T.hoodDark;
  g.lineWidth = .03 * u;
  g.stroke();
  g.restore();

  const phoneMode = (p.arms ?? (p.phone !== undefined ? "phone" : "none")) === "phone";
  if (phoneMode && (p.phoneOn ?? 1) > .01) {
    const r = phoneLocal(p);
    g.save();
    g.globalAlpha = clamp(p.phoneOn ?? 1);
    g.translate(r.lx, r.ly);
    g.rotate(r.tilt);
    g.fillStyle = "#0d1030";
    g.fillRect(-r.w / 2 - .008 * u, -r.h / 2 - .008 * u, r.w + .016 * u, r.h + .016 * u);
    g.fillStyle = glow > 0 ? `rgb(${200 + 40 * glow | 0},${215 + 30 * glow | 0},255)` : "#2a3060";
    g.fillRect(-r.w / 2, -r.h / 2, r.w, r.h);
    g.restore();
    hands(p, f).forEach((h) => ellipse(g, h.x, h.y, .045 * u, .04 * u, T.skin));
  } else {
    drawArms(g, p, f, T);
  }
  if ((p.orb ?? 0) > 0) {
    const [a, b] = hands(p, f);
    ellipse(g, (a.x + b.x) / 2, (a.y + b.y) / 2 - .04 * u, .07 * u, .07 * u, "#ffe7b0");
  }
  g.restore();
}

/** 붓질 뒤에 얹는 눈·눈썹·볼·입 */
export function drawHoodieFace(g: CanvasRenderingContext2D, p: Pose) {
  if (p.back) return;
  const f = frame(p);
  const { u, fx, fy, hx, hy } = f;
  g.save();
  applyXf(g, p);
  g.translate(hx, hy); g.rotate(f.tilt); g.translate(-hx, -hy);
  const turn = p.turn ?? 0;
  // 많이 돌리면 얼굴이 옆으로 밀려 눈이 후드 가장자리에 걸린다(너무 돌면 감춘다)
  const edge = clamp((Math.abs(turn) - 1.15) / .4);
  if (edge >= 1) { g.restore(); return; }
  g.globalAlpha = 1 - edge;
  const ex = fx + (p.lookX ?? 0) * .035 * u, ey = fy + (p.lookY ?? 0) * .03 * u - .005 * u;
  const open = 1 - (p.blink ?? 0);
  const joy = p.joy ?? 0;
  const sz = p.eyes ?? 1;
  const blush = .45 + (p.blush ?? 0) * .4 + joy * .2;
  ellipse(g, fx - .11 * u, fy + .065 * u, .034 * u, .018 * u, `rgba(240,110,120,${blush})`);
  ellipse(g, fx + .11 * u, fy + .065 * u, .034 * u, .018 * u, `rgba(240,110,120,${blush})`);
  g.strokeStyle = "#1b1230";
  g.lineCap = "round";
  const spread = .065 * u * (1 - .15 * Math.min(1, Math.abs(turn)));
  for (const side of [-1, 1]) {
    const x = ex + side * spread;
    if (open < .3 || joy > .6) {
      g.lineWidth = .012 * u;
      g.beginPath();
      if (joy > .6) g.arc(x, ey + .012 * u, .022 * u, 1.18 * Math.PI, 1.82 * Math.PI);
      else g.arc(x, ey - .01 * u, .022 * u, .2 * Math.PI, .8 * Math.PI);
      g.stroke();
      continue;
    }
    ellipse(g, x, ey, .025 * u * (.9 + .1 * sz), .037 * u * open * sz, "#1b1230");
    ellipse(g, x + .009 * u, ey - .013 * u * sz, .008 * u, .008 * u, "#fff6e0");
  }
  // 눈썹: brow>0 찌푸림(안쪽이 낮다), <0 걱정(안쪽이 높다). browY는 눈썹 높이
  const brow = p.brow ?? 0, browY = p.browY ?? 0;
  if (Math.abs(brow) > .05 || Math.abs(browY) > .05) {
    g.strokeStyle = "#2a1626";
    g.lineWidth = .011 * u;
    for (const side of [-1, 1]) {
      const x = ex + side * spread, y = ey - .062 * u * sz - browY * .028 * u;
      g.beginPath();
      g.moveTo(x - side * .03 * u, y + brow * .025 * u);
      g.lineTo(x + side * .03 * u, y - brow * .025 * u);
      g.stroke();
    }
  }
  const mx = fx + (p.lookX ?? 0) * .02 * u, my = fy + .085 * u;
  g.strokeStyle = "#1b1230";
  g.lineWidth = .012 * u;
  switch (p.mouth) {
    case "smile": g.beginPath(); g.arc(mx, my - .02 * u, .035 * u, .15 * Math.PI, .85 * Math.PI); g.stroke(); break;
    case "grin": {
      g.fillStyle = "#4a1626";
      g.beginPath(); g.ellipse(mx, my - .012 * u, .042 * u, .03 * u, 0, 0, Math.PI); g.fill();
      g.fillStyle = "#ff8fa0"; g.beginPath(); g.ellipse(mx, my + .004 * u, .022 * u, .01 * u, 0, 0, Math.PI); g.fill();
      break;
    }
    case "o": ellipse(g, mx, my, .018 * u, .024 * u, "#1b1230"); break;
    case "awe": ellipse(g, mx, my + .004 * u, .026 * u, .03 * u, "#1b1230"); break;
    case "yell": {
      g.fillStyle = "#3a0f22";
      g.beginPath(); g.ellipse(mx, my + .006 * u, .036 * u, .042 * u, 0, 0, TAU); g.fill();
      break;
    }
    case "sad": g.beginPath(); g.arc(mx, my + .028 * u, .03 * u, 1.2 * Math.PI, 1.8 * Math.PI); g.stroke(); break;
    case "flat": g.beginPath(); g.moveTo(mx - .025 * u, my); g.lineTo(mx + .025 * u, my); g.stroke(); break;
  }
  g.restore();
}
