/**
 * 컷 하나의 정의. 컷은 시각 start(초)에 시작해 다음 컷의 start에 끝난다(MV.tsx가 이어 붙인다).
 * render(c)는 그 시각의 그림(<Scene>…</Scene>)을 돌려준다. 순수 함수여야 한다: 같은 c면 같은 그림.
 *
 * 전환(enter: 이 컷이 들어올 때)
 *   cut     그냥 자름(기본)
 *   flash   자른 뒤 color(기본 금빛 흰색)가 0.3초 사그라든다. 큰 박자
 *   dip     앞 컷 끝 dur/2 동안 검정으로, 이 컷 처음 dur/2 동안 검정에서
 *   white   dip과 같되 흰빛(달빛 화이트아웃)
 *   cross   앞 컷과 겹쳐 녹아든다
 *   whip    휙 돌리는 패닝: 앞 컷이 dir 반대쪽으로 번지며 빠지고 이 컷이 dir쪽에서 들어온다
 *   iris    이 컷이 원(cx, cy)에서 커지며 열린다 — 둥근 빛(달·폰 빛·빛 구슬)에서 다음 장면으로
 */
import type React from "react";
import type { KeyName } from "../lib/palette";

export type Enter =
  | { type: "cut" }
  | { type: "flash"; dur?: number; color?: string }
  | { type: "dip"; dur?: number }
  | { type: "white"; dur?: number }
  | { type: "cross"; dur?: number }
  | { type: "whip"; dur?: number; dir?: 1 | -1 }
  | { type: "iris"; dur?: number; cx?: number; cy?: number };

export type ShotCtx = {
  /** 곡 시각(초) */
  t: number;
  /** 컷 안에서 지난 초 */
  lt: number;
  /** 컷 길이(초) */
  dur: number;
  /** 컷 진행 0..1 */
  p: number;
  /** 지금 박 번호(소수). 박 정수 = 박이 치는 순간 */
  beat: number;
  /** 컷 시작 박 번호(정수에 가깝다) */
  beat0: number;
  /** 박에 맞춰 튀었다 사그라드는 값 0..1 */
  pulse: number;
  /** 음량·저음·타격 0..1 */
  level: number; low: number; hit: number;
};

export type Shot = {
  id: string;
  /** 시작 시각(초). song.ts의 B(n)·beat(i)로 적는다 */
  start: number;
  key: KeyName;
  enter?: Enter;
  render: (c: ShotCtx) => React.ReactNode;
};
