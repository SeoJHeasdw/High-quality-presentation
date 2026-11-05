/**
 * 아이(와 친구)의 뼈대. 모든 값이 이어지는 숫자라서 두 자세 사이를 보간하면 팔다리가 튀지 않는다.
 *
 * 좌표: 캐릭터는 오른쪽(+x)을 보고 서 있는 것을 기준으로 정의하고, facing = -1이면 좌우를 뒤집는다.
 * 각도(rad): 팔·다리는 0이 곧장 아래, +가 앞(보는 쪽)으로 든다. π/2 = 앞으로 수평, π = 머리 위.
 *   팔꿈치 bend +  → 아래팔이 앞·위로 접힌다(자연스러운 팔꿈치)
 *   무릎 bend +    → 정강이가 뒤로 접힌다(자연스러운 무릎)
 *   lean +         → 몸통이 앞으로 기운다(골반 축). bend는 윗몸만 더 숙인다(움츠림)
 *   headTilt +     → 고개를 숙인다 / - 올려다본다
 *   rot            → 몸 전체 회전(날기·다이빙·넘어짐). anchor 기준
 *   squash +       → 납작하게(예비동작·착지) / - 길게(도약)
 *
 * 놓는 법(anchor):
 *   "feet"   x는 골반 x, y는 땅. 가장 낮은 점(발·엉덩이)이 y - lift에 닿는다 (기본)
 *   "seat"   엉덩이 바닥이 (x, y)에 앉는다(난간·침대·구름 끝에 걸터앉기)
 *   "center" 골반이 (x, y). 공중에서 rot을 줄 때
 */
import { clamp, mix } from "../lib/math";

export type Limb = [number, number];

export type Pose = {
  x: number; y: number; s: number;
  facing: 1 | -1;
  anchor?: "feet" | "seat" | "center";
  lift: number;
  rot: number;
  squash: number;
  lean: number;
  bend: number;
  headTilt: number;
  /** 얼굴이 카메라 쪽으로 돈 정도. 0 옆얼굴 … 1 정면 */
  faceDir: number;
  armN: Limb; armF: Limb;
  legN: Limb; legF: Limb;
  /** 발끝을 펴는 정도(+ 발끝이 아래로) */
  toe: number;
  /** 후드 꼬리(아이)·목도리(친구)가 휘날리는 각. 0 뒤로 축 처짐, + 위로 날림 */
  swing: number;
  /** 얼굴에 떨어지는 빛 0..1(폰·나방·달). 실루엣 안에서 얼굴이 보이는 유일한 순간 */
  face: number;
  faceColor: string;
  /** 눈 뜬 정도 0..1 (깜빡임) */
  eyes: number;
  /** 입 "o" 크기 0..1 */
  mouth: number;
  /** 웃음(눈이 반달) 0..1 */
  smile: number;
  /** 폰 화면 밝기 0..1. 0이면 폰을 그리지 않는다 */
  phone: number;
  /** 폰을 든 손: 0 가까운 손, 1 먼 손 */
  phoneHand: 0 | 1;
};

export const DEFAULT: Pose = {
  x: 960, y: 900, s: 300, facing: 1, anchor: "feet", lift: 0, rot: 0, squash: 0,
  lean: 0, bend: 0, headTilt: 0, faceDir: 0,
  armN: [.12, .2], armF: [-.1, .15],
  legN: [.05, .05], legF: [-.05, .05], toe: 0,
  swing: 0, face: 0, faceColor: "#ffd890", eyes: 1, mouth: 0, smile: 0, phone: 0, phoneHand: 0,
};

/** 자주 쓰는 자세(부분). pose({...P.stand, x, y}) 처럼 펼쳐 쓴다 */
export const P = {
  stand: { lean: .02, armN: [.1, .25], armF: [-.08, .2], legN: [.04, .04], legF: [-.04, .04] },
  /** 폰을 두 손으로 가슴 앞에 든다. 고개를 숙인다 */
  phone: { lean: .1, bend: .12, headTilt: .35, armN: [.55, 1.35], armF: [.45, 1.45], phone: 1 },
  /** 웅크린 예비동작 */
  crouch: { lean: .45, bend: .1, squash: .18, headTilt: -.1, armN: [-.9, .4], armF: [-1.0, .35], legN: [1.1, 2.0], legF: [.8, 1.8] },
  /** 도약: 길게 늘어나 팔을 앞·위로 */
  leap: { lean: .3, squash: -.1, headTilt: -.5, armN: [2.55, .05], armF: [2.3, .15], legN: [1.35, 1.7], legF: [-.75, .35], toe: .8 },
  /** 정점: 무릎을 당기고 팔을 높이 */
  apex: { lean: .05, headTilt: -.5, armN: [2.8, .1], armF: [2.5, .2], legN: [1.2, 1.8], legF: [.7, 1.5], toe: .3 },
  /** 허우적거리며 떨어짐 */
  flail: { lean: -.25, headTilt: .2, armN: [2.4, -.6], armF: [1.6, .9], legN: [.9, .4], legF: [-.3, 1.0], mouth: .8, eyes: 1.15 },
  /** 엉덩방아: 다리를 앞으로 뻗고 앉는다 */
  plop: { lean: -.1, bend: .05, squash: .06, headTilt: .05, armN: [-.5, .3], armF: [-.7, .2], legN: [1.45, .15], legF: [1.3, .35] },
  /** 걸터앉기(다리를 늘어뜨림) */
  sitEdge: { anchor: "seat" as const, lean: .05, bend: .1, armN: [.35, .3], armF: [.2, .3], legN: [1.25, 1.35], legF: [1.05, 1.15] },
  /** 바닥에 무릎 세우고 앉기 */
  sitKnees: { lean: .15, bend: .15, headTilt: .1, armN: [.9, 1.1], armF: [.8, 1.2], legN: [1.9, 2.5], legF: [1.75, 2.45] },
  /** 한 손으로 위를 가리킴 */
  point: { lean: -.05, headTilt: -.45, armN: [2.3, .05], armF: [-.1, .2] },
  /** 엄지·검지로 달을 잰다(손을 눈앞에) */
  pinch: { lean: -.05, headTilt: -.3, armN: [2.0, .55], armF: [-.15, .25] },
  /** 두 팔 벌려 환호 */
  cheer: { lean: -.08, headTilt: -.35, armN: [2.65, .15], armF: [2.45, .2], smile: 1 },
  /** 손 흔들기(가까운 손). 흔듦은 armN[1]을 시간으로 흔든다 */
  wave: { lean: 0, headTilt: -.05, armN: [2.4, .5], armF: [-.05, .2], smile: .8 },
  /** 날기(슈퍼맨): anchor center, rot ≈ 1.2 */
  fly: { anchor: "center" as const, rot: 1.15, lean: 0, headTilt: -.9, armN: [2.9, .05], armF: [.3, .4], legN: [-.15, .4], legF: [-.35, .7], toe: 1 },
  /** 위로 실을 잡고 끌려 오름: 한 팔을 머리 위로 */
  hang: { anchor: "center" as const, lean: .05, headTilt: -.35, armN: [3.05, .05], armF: [2.85, .1], legN: [.25, .5], legF: [-.15, .7], toe: .8 },
  /** 머리부터 다이빙 */
  dive: { anchor: "center" as const, rot: 2.6, headTilt: -.4, armN: [2.95, 0], armF: [2.8, .05], legN: [.05, .2], legF: [-.15, .35], toe: 1 },
  /** 웅크려 잠든 자세(누움) */
  sleep: { anchor: "feet" as const, rot: -1.45, lean: .5, bend: .3, headTilt: .4, armN: [1.2, 1.6], armF: [1.0, 1.7], legN: [1.6, 2.0], legF: [1.4, 2.2], eyes: 0 },
  /** 뒤돌아봄(옷 방향 그대로 고개만): faceDir로 돌린다 */
  lookBack: { lean: -.05, headTilt: -.05, faceDir: .7 },
  /** 주머니에 손 */
  pocket: { lean: .05, headTilt: .15, armN: [.05, .45], armF: [-.1, .4] },
  /** 사다리 오르기: phase로 climbPose를 쓰는 편이 낫다 */
} satisfies Record<string, Partial<Pose>>;

const NUM: (keyof Pose)[] = ["x", "y", "s", "lift", "rot", "squash", "lean", "bend", "headTilt", "faceDir", "toe", "swing", "face", "eyes", "mouth", "smile", "phone"];
const LIMBS: (keyof Pose)[] = ["armN", "armF", "legN", "legF"];

export function pose(p: Partial<Pose>): Pose {
  return { ...DEFAULT, ...p } as Pose;
}

/** 두 자세 사이 보간(w 0→1). 부분 자세도 받는다 */
export function lerpPose(a: Partial<Pose>, b: Partial<Pose>, w: number): Partial<Pose> {
  const A = { ...DEFAULT, ...a } as Pose, Bp = { ...DEFAULT, ...b } as Pose;
  const out: Partial<Pose> = { ...A };
  for (const k of NUM) (out as Record<string, number>)[k] = mix(A[k] as number, Bp[k] as number, w);
  for (const k of LIMBS) {
    const la = A[k] as Limb, lb = Bp[k] as Limb;
    (out as Record<string, Limb>)[k] = [mix(la[0], lb[0], w), mix(la[1], lb[1], w)];
  }
  if (w >= .5) { out.facing = Bp.facing; out.anchor = Bp.anchor; out.faceColor = Bp.faceColor; out.phoneHand = Bp.phoneHand; }
  return out;
}

/** 자세 열: [시각, 부분 자세, 걸리는 시간(기본 .3)]. 시각이 되면 직전 자세에서 그 자세로 옮겨 간다(io 이징) */
export function poseSeq(t: number, keys: [number, Partial<Pose>, number?][], ease: (x: number) => number = (x) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2): Partial<Pose> {
  let cur: Partial<Pose> = keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t0, p, dur = .3] = keys[i];
    if (t < t0) break;
    const w = clamp((t - t0) / dur);
    cur = lerpPose(cur, { ...cur, ...p }, ease(w));
  }
  return cur;
}

/**
 * 걸음/달리기. phase는 걸음 주기 수(걸은 거리 ÷ 보폭). gait 0 서기 … 1 걷기 … 2 달리기.
 * 다리·팔·몸 들썩임(lift)·기울기를 돌려준다. 발이 미끄러지지 않으려면 phase = 거리 / (s * 보폭계수)
 */
export function gait(phase: number, g = 1): Partial<Pose> {
  const a = phase * Math.PI * 2;
  const run = clamp(g - 1);
  const walk = clamp(g);
  const amp = mix(.42, .85, run) * walk;
  const kneeAmp = mix(.75, 1.7, run) * walk;
  const thighN = Math.sin(a) * amp, thighF = Math.sin(a + Math.PI) * amp;
  const kneeN = Math.max(0, Math.sin(a - 1.1)) * kneeAmp + .08, kneeF = Math.max(0, Math.sin(a + Math.PI - 1.1)) * kneeAmp + .08;
  const arm = mix(.35, .9, run) * walk;
  return {
    legN: [thighN + run * .15, kneeN], legF: [thighF + run * .15, kneeF],
    armN: [-Math.sin(a) * arm + run * .2, .3 + run * 1.2], armF: [-Math.sin(a + Math.PI) * arm + run * .2, .3 + run * 1.2],
    lift: Math.abs(Math.cos(a)) * mix(.012, .06, run) * walk,
    lean: mix(.04, .32, run) * walk,
    headTilt: mix(0, -.1, run),
    toe: run * .4 * Math.max(0, Math.sin(a)),
  };
}
/** 보폭: 한 걸음 주기(두 발)에 나아가는 거리 = s × STRIDE */
export const STRIDE = { walk: .62, run: 1.25 };

/** 사다리 오르기 주기(phase 1 = 한 칸) */
export function climb(phase: number): Partial<Pose> {
  const a = phase * Math.PI * 2;
  return {
    lean: .12, headTilt: -.25,
    armN: [2.6 + Math.sin(a) * .35, .35 - Math.sin(a) * .3], armF: [2.4 - Math.sin(a) * .35, .45 + Math.sin(a) * .3],
    legN: [.8 + Math.sin(a + Math.PI) * .45, 1.3 + Math.sin(a + Math.PI) * .4], legF: [.6 - Math.sin(a + Math.PI) * .45, 1.1 - Math.sin(a + Math.PI) * .4],
    lift: Math.max(0, Math.sin(a)) * .03,
  };
}
