/**
 * 실루엣 아이. 몸은 한 가지 어두운 색으로만 칠하고(포즈가 실루엣으로 읽혀야 한다), 빛 쪽 가장자리에만
 * 테두리 빛(rim)을 얹는다. 얼굴은 빛(폰·나방·달)이 떨어질 때만 보인다.
 *
 *   variant "kid"     뾰족하게 늘어진 후드 꼬리(끝에 술). 꼬리가 몸을 한 박자 늦게 따라온다
 *   variant "friend"  둥근 후드 + 꼭대기 방울 + 뒤로 날리는 긴 목도리
 *
 * skeleton(pose)는 관절의 세계 좌표를 돌려준다(손에 폰·실·다른 아이의 손을 붙일 때). ikArm은 손을 한 점에 닿게 한다.
 */
import React from "react";
import { DEFAULT, type Pose, type Limb } from "./pose";
import { useUid } from "../lib/camera";
import { clamp, mix } from "../lib/math";

type V = { x: number; y: number };
const v = (x: number, y: number): V => ({ x, y });
const add = (a: V, b: V) => v(a.x + b.x, a.y + b.y);
const mul = (a: V, k: number) => v(a.x * k, a.y * k);
/** 화면 좌표(y 아래)에서 θ만큼 시계 방향 회전 */
const rotv = (a: V, t: number) => v(a.x * Math.cos(t) - a.y * Math.sin(t), a.x * Math.sin(t) + a.y * Math.cos(t));
/** 각 a(0 아래, + 앞)의 단위 벡터 */
const dirv = (a: number) => v(Math.sin(a), Math.cos(a));

export const PROP = {
  thigh: .16, shin: .15, foot: .085, legW: .088,
  torso: .28, hemW: .15, shW: .095,
  upper: .13, fore: .12, armW: .07, hand: .04,
  head: .145, hood: .168,
};

export type Skeleton = {
  pelvis: V; neck: V; head: V; hoodR: number;
  shN: V; shF: V; elN: V; elF: V; haN: V; haF: V;
  hipN: V; hipF: V; knN: V; knF: V; anN: V; anF: V; toeN: V; toeF: V;
  tail: V; tailBase: V;
  /** 세계 좌표로 옮기는 함수 */
  toWorld: (p: V) => V;
  /** 로컬 각도(몸 기준) → 세계 각도 보정용 */
  frame: { tilt: number; facing: number; rot: number };
};

/** 로컬(골반 원점, 오른쪽을 봄) 관절 */
function local(p: Pose) {
  const s = p.s;
  const tilt = p.lean + p.bend * .5;
  const u = rotv(v(0, -1), p.lean);
  const u2 = rotv(v(0, -1), p.lean + p.bend);
  const pelvis = v(0, 0);
  const mid = add(pelvis, mul(u, PROP.torso * s * .5));
  const neck = add(mid, mul(u2, PROP.torso * s * .5));
  const headTilt = p.lean + p.bend + p.headTilt * .6;
  const head = add(neck, mul(rotv(v(0, -1), headTilt), PROP.head * s * .95));
  const torsoTilt = p.lean + p.bend;
  const shoulderBase = add(neck, mul(u2, -.05 * s));
  const n2 = rotv(v(1, 0), torsoTilt);
  const shN = add(shoulderBase, mul(n2, .018 * s)), shF = add(shoulderBase, mul(n2, -.022 * s));
  const arm = (sh: V, l: Limb) => {
    const el = add(sh, mul(rotv(dirv(l[0]), torsoTilt), PROP.upper * s));
    const ha = add(el, mul(rotv(dirv(l[0] + l[1]), torsoTilt), PROP.fore * s));
    return [el, ha] as const;
  };
  const [elN, haN] = arm(shN, p.armN), [elF, haF] = arm(shF, p.armF);
  const hipN = add(pelvis, v(.02 * s, -.01 * s)), hipF = add(pelvis, v(-.02 * s, -.01 * s));
  const leg = (hip: V, l: Limb) => {
    const kn = add(hip, mul(dirv(l[0]), PROP.thigh * s));
    const sa = l[0] - l[1];
    const an = add(kn, mul(dirv(sa), PROP.shin * s));
    const fd = rotv(v(Math.cos(sa), -Math.sin(sa)), p.toe * .9);
    const toe = add(an, mul(fd, PROP.foot * s));
    return [kn, an, toe] as const;
  };
  const [knN, anN, toeN] = leg(hipN, p.legN), [knF, anF, toeF] = leg(hipF, p.legF);
  const back = rotv(v(-1, 0), headTilt);
  const tailBase = add(head, add(mul(back, PROP.hood * s * .78), mul(rotv(v(0, -1), headTilt), PROP.hood * s * .25)));
  const tailAng = headTilt + .95 - p.swing; // 0 = 뒤로 수평, + 아래로
  const tail = add(tailBase, mul(rotv(v(-1, 0), -tailAng + headTilt * 0), .3 * s));
  return { pelvis, neck, head, shN, shF, elN, elF, haN, haF, hipN, hipF, knN, knF, anN, anF, toeN, toeF, tail, tailBase, tilt, headTilt, torsoTilt, u, u2 };
}

export function skeleton(pin: Partial<Pose>): Skeleton {
  const p = { ...DEFAULT, ...pin } as Pose;
  const L = local(p);
  const s = p.s;
  const sx = p.facing * (1 + p.squash * .5), sy = 1 - p.squash;
  // 골반 기준 회전·축척
  const xf = (q: V) => {
    const r = rotv(v(q.x * (1 + p.squash * .5), q.y * sy), p.rot);
    return v(r.x * p.facing, r.y);
  };
  let off: V;
  const anchor = p.anchor ?? "feet";
  if (anchor === "center") off = v(p.x, p.y);
  else if (anchor === "seat") {
    const seat = xf(v(0, .05 * s));
    off = v(p.x - seat.x, p.y - seat.y);
  } else {
    const pts = [L.anN, L.anF, L.toeN, L.toeF, L.knN, L.knF, v(0, .06 * s), L.head, L.haN, L.haF].map(xf);
    const low = Math.max(...pts.map((q) => q.y)) + PROP.legW * s * .45;
    off = v(p.x, p.y - p.lift * s - low);
  }
  const toWorld = (q: V) => add(xf(q), off);
  const W = (q: V) => toWorld(q);
  void sx;
  return {
    pelvis: W(L.pelvis), neck: W(L.neck), head: W(L.head), hoodR: PROP.hood * s,
    shN: W(L.shN), shF: W(L.shF), elN: W(L.elN), elF: W(L.elF), haN: W(L.haN), haF: W(L.haF),
    hipN: W(L.hipN), hipF: W(L.hipF), knN: W(L.knN), knF: W(L.knF), anN: W(L.anN), anF: W(L.anF), toeN: W(L.toeN), toeF: W(L.toeF),
    tail: W(L.tail), tailBase: W(L.tailBase), toWorld,
    frame: { tilt: L.torsoTilt, facing: p.facing, rot: p.rot },
  };
}

/** 손(0 가까운 손, 1 먼 손)이 세계 점 (tx, ty)에 닿도록 팔 각도를 푼다(두 마디 IK). 닿지 않으면 그쪽으로 뻗는다 */
export function ikArm(pin: Partial<Pose>, hand: 0 | 1, tx: number, ty: number): Partial<Pose> {
  const p = { ...DEFAULT, ...pin } as Pose;
  const sk = skeleton(p);
  const sh = hand === 0 ? sk.shN : sk.shF;
  // 세계 → 로컬 방향(회전·뒤집기 되돌리기)
  let dx = (tx - sh.x) * p.facing, dy = ty - sh.y;
  const r = -p.rot * p.facing;
  [dx, dy] = [dx * Math.cos(r * p.facing) - dy * Math.sin(r * p.facing), dx * Math.sin(r * p.facing) + dy * Math.cos(r * p.facing)];
  const a = PROP.upper * p.s, b = PROP.fore * p.s;
  const d = clamp(Math.hypot(dx, dy), Math.abs(a - b) + 1, a + b - .5);
  const base = Math.atan2(dx, dy); // 0 아래, + 앞
  const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
  const A = Math.acos(cosA);
  const cosE = clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1);
  const E = Math.PI - Math.acos(cosE);
  const tilt = sk.frame.tilt;
  const shoulder = base - A - tilt;
  const limb: Limb = [shoulder, E];
  return hand === 0 ? { ...pin, armN: limb } : { ...pin, armF: limb };
}

const pathLine = (...pts: V[]) => "M" + pts.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join("L");

export type Rim = { dx: number; dy: number; color: string; width?: number; glow?: number };

type KidProps = {
  pose: Partial<Pose>;
  variant?: "kid" | "friend";
  /** 실루엣 색(장면의 가장 어두운 색보다 아주 조금 밝게/어둡게) */
  sil?: string;
  /** 먼 팔·다리 색(살짝 배경 쪽으로) */
  far?: string;
  /** 테두리 빛: 빛이 오는 쪽(화면 좌표 단위 벡터)과 색 */
  rim?: Rim;
  rim2?: Rim;
  /** 폰 화면 색 */
  phoneColor?: string;
  /** 친구의 방울·목도리 끝 색(실루엣 속 유일한 색 포인트) */
  accent?: string;
  opacity?: number;
};

function Body({ p, sk, color, far, variant }: { p: Pose; sk: Skeleton; color: string; far: string; variant: "kid" | "friend" }) {
  const s = p.s;
  const L = local(p);
  const W = sk.toWorld;
  const lw = PROP.legW * s, aw = PROP.armW * s;
  const torso = (() => {
    const hemC = add(L.pelvis, mul(L.u, -.045 * s));
    const n = rotv(v(1, 0), p.lean);
    const n2 = rotv(v(1, 0), p.lean + p.bend);
    const hemB = add(hemC, mul(n, -PROP.hemW * s)), hemF = add(hemC, mul(n, PROP.hemW * s * 1.05));
    const shB = add(add(L.neck, mul(n2, -PROP.shW * s)), mul(L.u2, -.035 * s));
    const shF = add(add(L.neck, mul(n2, PROP.shW * s * 1.05)), mul(L.u2, -.035 * s));
    const q = (a: V, b: V, bulge: number, nn: V) => add(mul(add(a, b), .5), mul(nn, bulge * s));
    const P = [hemB, q(hemB, hemF, .025, mul(L.u, -1)), hemF, q(hemF, shF, .035, n), shF, q(shF, shB, .05, L.u2), shB, q(shB, hemB, .03, mul(n, -1)), hemB].map(W);
    return `M${P[0].x},${P[0].y}Q${P[1].x},${P[1].y} ${P[2].x},${P[2].y}Q${P[3].x},${P[3].y} ${P[4].x},${P[4].y}Q${P[5].x},${P[5].y} ${P[6].x},${P[6].y}Q${P[7].x},${P[7].y} ${P[8].x},${P[8].y}Z`;
  })();
  const sc = Math.abs(1 + p.squash * .3);
  const limb = (pts: V[], w: number, c: string) => <path d={pathLine(...pts)} stroke={c} strokeWidth={w * sc} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
  const foot = (an: V, toe: V, c: string) => <path d={pathLine(an, toe)} stroke={c} strokeWidth={lw * .95 * sc} strokeLinecap="round" fill="none" />;
  const hood = (() => {
    const hc = sk.head;
    return <circle cx={hc.x} cy={hc.y} r={PROP.hood * s * sc} fill={color} />;
  })();
  const tail = (() => {
    if (variant !== "kid") return null;
    const b = sk.tailBase, t = sk.tail;
    const dx = t.x - b.x, dy = t.y - b.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const w = .085 * s;
    const c1 = v(b.x + dx * .5 + nx * w * .9 + (0) , b.y + dy * .5 + ny * w * .9 + .03 * s);
    const c2 = v(b.x + dx * .55 - nx * w * .5, b.y + dy * .55 - ny * w * .5 + .02 * s);
    const b1 = v(b.x + nx * w, b.y + ny * w), b2 = v(b.x - nx * w, b.y - ny * w);
    return (
      <g>
        <path d={`M${b1.x},${b1.y}Q${c1.x},${c1.y} ${t.x},${t.y}Q${c2.x},${c2.y} ${b2.x},${b2.y}Z`} fill={color} />
        <circle cx={t.x} cy={t.y} r={.034 * s} fill={color} />
      </g>
    );
  })();
  const friendBits = (() => {
    if (variant !== "friend") return null;
    const top = W(add(L.head, mul(rotv(v(0, -1), L.headTilt), PROP.hood * s * 1.02)));
    // 목도리: 목에서 뒤로 휘날리는 띠 두 가닥
    const nk = W(add(L.neck, mul(L.u2, .01 * s)));
    const back = sk.tailBase;
    const dir = v(sk.tail.x - back.x, sk.tail.y - back.y);
    const e1 = v(nk.x + dir.x * 1.05, nk.y + dir.y * 1.05 + .05 * s);
    const e2 = v(nk.x + dir.x * .8, nk.y + dir.y * .8 + .12 * s);
    const m1 = v(mix(nk.x, e1.x, .5) + .03 * s, mix(nk.y, e1.y, .5) - .05 * s);
    return (
      <g>
        <circle cx={top.x} cy={top.y} r={.055 * s} fill={color} />
        <path d={`M${nk.x},${nk.y}Q${m1.x},${m1.y} ${e1.x},${e1.y}`} stroke={color} strokeWidth={.055 * s} strokeLinecap="round" fill="none" />
        <path d={`M${nk.x},${nk.y}Q${m1.x},${m1.y + .04 * s} ${e2.x},${e2.y}`} stroke={color} strokeWidth={.045 * s} strokeLinecap="round" fill="none" />
        <circle cx={nk.x} cy={nk.y} r={.05 * s} fill={color} />
      </g>
    );
  })();
  return (
    <g>
      {/* 먼 쪽 팔다리 */}
      {limb([W(L.hipF), W(L.knF), W(L.anF)], lw, far)}
      {foot(W(L.anF), W(L.toeF), far)}
      {limb([W(L.shF), W(L.elF), W(L.haF)], aw, far)}
      <circle cx={sk.haF.x} cy={sk.haF.y} r={PROP.hand * s} fill={far} />
      {tail}
      {friendBits}
      {/* 몸 */}
      {limb([W(L.hipN), W(L.knN), W(L.anN)], lw, color)}
      {foot(W(L.anN), W(L.toeN), color)}
      <path d={torso} fill={color} />
      {hood}
      {limb([W(L.shN), W(L.elN), W(L.haN)], aw, color)}
      <circle cx={sk.haN.x} cy={sk.haN.y} r={PROP.hand * s} fill={color} />
    </g>
  );
}

export const Kid: React.FC<KidProps> = ({ pose: pin, variant = "kid", sil = "#05060d", far, rim, rim2, phoneColor = "#cfe6ff", accent, opacity }) => {
  const p = { ...DEFAULT, ...pin } as Pose;
  const sk = skeleton(p);
  const id = useUid("kid");
  const farC = far ?? sil;
  const s = p.s;
  const body = (c: string, f: string) => <Body p={p} sk={sk} color={c} far={f} variant={variant} />;
  const rimLayer = (r: Rim, key: string) => {
    const w = (r.width ?? .014) * s;
    const len = Math.hypot(r.dx, r.dy) || 1;
    const ox = (-r.dx / len) * w, oy = (-r.dy / len) * w;
    return (
      <g key={key}>
        <mask id={`${id}${key}m`} maskUnits="userSpaceOnUse" x={-5000} y={-5000} width={12000} height={12000}>
          {body("#fff", "#fff")}
          <g transform={`translate(${ox} ${oy})`}>{body("#000", "#000")}</g>
        </mask>
        {(r.glow ?? .6) > 0 ? (
          <g mask={`url(#${id}${key}m)`} filter={`url(#${id}blur)`} opacity={r.glow ?? .6}>{body(r.color, r.color)}</g>
        ) : null}
        <g mask={`url(#${id}${key}m)`}>{body(r.color, r.color)}</g>
      </g>
    );
  };
  // 얼굴: 후드 앞쪽의 타원. 빛이 있을 때만
  const face = (() => {
    if (p.face <= .01) return null;
    const L = local(p);
    const n = rotv(v(1, 0), L.headTilt);
    const up = rotv(v(0, -1), L.headTilt);
    const fd = clamp(p.faceDir, -1, 1);
    const fc = add(L.head, add(mul(n, mix(.085, .01, Math.abs(fd)) * s), mul(up, -.012 * s)));
    const c = sk.toWorld(fc);
    const rx = mix(.075, .118, Math.abs(fd)) * s, ry = .118 * s;
    const ang = (Math.atan2(n.y, n.x) * 180) / Math.PI * (p.facing) + (p.rot * 180) / Math.PI * p.facing;
    const eyeY = -.005 * s;
    const eyeO = clamp(p.eyes, 0, 1.3);
    const eyes = fd > .35 ? [-.04, .04] : [.035 * p.facing];
    const smile = p.smile;
    return (
      <g opacity={clamp(p.face)}>
        <defs>
          <radialGradient id={`${id}fg`} cx="50%" cy="88%" r="95%">
            <stop offset="0%" stopColor={p.faceColor} stopOpacity={.95} />
            <stop offset="45%" stopColor={p.faceColor} stopOpacity={.62} />
            <stop offset="85%" stopColor={p.faceColor} stopOpacity={.14} />
            <stop offset="100%" stopColor={p.faceColor} stopOpacity={0} />
          </radialGradient>
        </defs>
        <g transform={`translate(${c.x} ${c.y}) rotate(${ang * (p.facing === 1 ? 1 : -1) * 0 + (p.rot * 180) / Math.PI})`}>
          <ellipse rx={rx} ry={ry} fill={`url(#${id}fg)`} />
          {eyes.map((ex, i) => (
            smile > .5
              ? <path key={i} d={`M${ex * s - .018 * s},${eyeY + .004 * s}Q${ex * s},${eyeY - .016 * s} ${ex * s + .018 * s},${eyeY + .004 * s}`} stroke="#1a1020" strokeWidth={.009 * s} strokeLinecap="round" fill="none" />
              : <ellipse key={i} cx={ex * s} cy={eyeY} rx={.015 * s} ry={.023 * s * eyeO} fill="#0e0a14" />
          ))}
          {p.mouth > .05 ? <ellipse cx={(eyes.length > 1 ? 0 : .03 * p.facing) * s} cy={.045 * s} rx={.012 * s * p.mouth + .004 * s} ry={.016 * s * p.mouth + .003 * s} fill="#2a1418" /> : null}
        </g>
      </g>
    );
  })();
  const phone = (() => {
    if (p.phone <= .01) return null;
    const h = p.phoneHand === 0 ? sk.haN : sk.haF;
    const h2 = p.phoneHand === 0 ? sk.haF : sk.haN;
    const c = v(mix(h.x, h2.x, .35), mix(h.y, h2.y, .35) - .01 * s);
    const pw = .055 * s, ph = .095 * s;
    return (
      <g>
        <circle cx={c.x} cy={c.y} r={.26 * s} fill={`url(#${id}pg)`} opacity={p.phone * .5} style={{ mixBlendMode: "screen" }} />
        <rect x={c.x - pw / 2} y={c.y - ph / 2} width={pw} height={ph} rx={.012 * s} fill={phoneColor} opacity={.35 + .65 * p.phone} transform={`rotate(${-12 * p.facing} ${c.x} ${c.y})`} />
      </g>
    );
  })();
  return (
    <g opacity={opacity}>
      <defs>
        <filter id={`${id}blur`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={Math.max(1.5, s * .012)} /></filter>
        <radialGradient id={`${id}pg`}>
          <stop offset="0%" stopColor={phoneColor} stopOpacity={.9} />
          <stop offset="100%" stopColor={phoneColor} stopOpacity={0} />
        </radialGradient>
      </defs>
      {body(sil, farC)}
      {rim2 ? rimLayer(rim2, "r2") : null}
      {rim ? rimLayer(rim, "r1") : null}
      {face}
      {variant === "friend" && accent ? (() => {
        const L = local(p);
        const top = sk.toWorld(add(L.head, mul(rotv(v(0, -1), L.headTilt), PROP.hood * s * 1.02)));
        return <circle cx={top.x} cy={top.y} r={.04 * s} fill={accent} opacity={.85} />;
      })() : null}
      {phone}
    </g>
  );
};
