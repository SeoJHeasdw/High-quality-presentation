/**
 * 컷을 만드는 데 모두가 쓰는 틀: 타입, 카메라, 합성 도우미.
 * 컷 하나는 draw(깨끗한 장면) → glow(빛 층) → front(붓질 뒤에 또렷하게 얹는 것) 세 갈래다.
 */
import type { Song } from "../song.ts";
import { mix } from "./kit.ts";
import type { Kit } from "./kit.ts";
import type { Swirl } from "./painter.ts";
import type { Pose } from "./hoodie.ts";

export type Cam = { cx: number; cy: number; z: number; r?: number };

export type F = {
  /** 곡 위의 시각 */
  t: number;
  /** 초당 15장으로 끊은 시각(움직임은 이 시각으로 계산한다) */
  tq: number;
  /** 컷이 시작된 뒤 흐른 시간(끊은 값) */
  lt: number;
  dur: number;
  /** 붓이 흔들리는 번호(초당 7.5번) */
  hold: number;
  song: Song;
  k: Kit;
  beatAge: number;
  downAge: number;
  /** 박 직후 1에서 0으로 떨어지는 맥박 */
  beat: number;
  /** 컷이 시작된 뒤 지난 박 수(소수) */
  beatsF: number;
  level: number;
};

export type S = {
  cam: Cam;
  kids: Pose[];
  /** 빛 층에서 아이 뒤의 빛을 지울 아이들(기본은 kids 전부, 빈 배열이면 안 지운다) */
  mask?: Pose[];
  /** 붓결을 한 점 둘레로 돌리는 소용돌이(화면 좌표). 달 둘레에 쓴다 */
  swirls?: Swirl[];
  /** 붓 흐름장의 폭. 하늘이 큰 장면은 작게 주어 붓결을 길게 잇는다 */
  turns?: number;
  [key: string]: any;
};

export type Shot = {
  name: string;
  start: number;
  end: number;
  enter?: "cut" | "flash" | "dip";
  seed: number;
  draw: (c: CanvasRenderingContext2D, f: F) => S;
  glow?: (c: CanvasRenderingContext2D, f: F, s: S) => void;
  front?: (c: CanvasRenderingContext2D, f: F, s: S) => void;
};

export type FilmOptions = {
  /** "tel": 팀 시연용. 끝에 나방이 모여 Technology Expert Lab을 만든다(기본은 글자 없음) */
  ending?: "tel";
};

export type Ctx = {
  k: Kit;
  song: Song;
  opts: FilmOptions;
  /** n번째 마디 첫 박의 시각. 컷은 모두 여기서 바뀐다 */
  B: (n: number) => number;
  add: (name: string, at: number, seed: number, enter: Shot["enter"], body: Pick<Shot, "draw" | "glow" | "front">) => void;
};

export const CAM0: Cam = { cx: 960, cy: 540, z: 1 };
export const RIM = "rgba(255,214,140,.9)";

export function applyCam(c: CanvasRenderingContext2D, cam: Cam) {
  c.translate(960, 540);
  if (cam.r) c.rotate(cam.r);
  c.scale(cam.z, cam.z);
  c.translate(-cam.cx, -cam.cy);
}

export function lighter(c: CanvasRenderingContext2D, fn: () => void) {
  c.save();
  c.globalCompositeOperation = "lighter";
  fn();
  c.restore();
}

export function bez(a: { x: number; y: number }, b: { x: number; y: number }, ctl: { x: number; y: number }, v: number) {
  const u = 1 - v;
  return { x: u * u * a.x + 2 * u * v * ctl.x + v * v * b.x, y: u * u * a.y + 2 * u * v * ctl.y + v * v * b.y };
}

export function mixColor(a: string, b: string, w: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(mix((pa >> s) & 255, (pb >> s) & 255, w));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}
