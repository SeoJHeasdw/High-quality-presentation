/**
 * 편집표. 구간의 에너지 순위로 장면을 고르고, 4마디마다 컷을 나눈다.
 *
 *   첫 구간 / 끝 구간           레코드(제목 / 끝 글자)
 *   에너지 .75 이상            능선 ↔ 터널을 4마디마다 번갈아
 *   .45 ~ .75                 터널 ↔ 도시
 *   .15 ~ .45                 비 오는 도시
 *   .3 미만이고 센 구간 바로 뒤  레코드(숨 고르기)
 *   .15 미만이고 4마디 남짓     제목 글자(브레이크)
 *
 * 구간 이름(벌스·훅)은 귀로 확인하기 전에는 쓰지 않는다. 컷 위치는 늘 마디 첫 박이다.
 */
import type { Song } from "./song.ts";

export type SceneId = "record" | "city" | "ridge" | "tunnel" | "type";
export type Transition = "cut" | "fade" | "flash";

export type Shot = {
  start: number;
  end: number;
  scene: SceneId;
  /** 같은 장면 안의 카메라 구도 번호 */
  variant: number;
  section: number;
  /** 이 컷으로 들어올 때의 전환 */
  enter: Transition;
};

export const BARS_PER_SHOT = 4;

export function buildEdit(song: Song): Shot[] {
  const { sections, downbeats } = song.a;
  const shots: Shot[] = [];
  const bar = song.beatLength * 4;

  sections.forEach((sec, si) => {
    const prev = sections[si - 1];
    const last = si === sections.length - 1;
    const lengthBars = (sec.end - sec.start) / bar;
    let pool: SceneId[];
    if (si === 0 || last) pool = ["record"];
    else if (sec.energy >= .75) pool = ["ridge", "tunnel"];
    else if (sec.energy < .15 && lengthBars <= 4.6) pool = ["type"];
    else if (sec.energy < .3 && prev && prev.energy >= .75) pool = ["record"];
    else if (sec.energy >= .45) pool = ["tunnel", "city"];
    else pool = ["city"];

    // 구간 안의 마디 첫 박을 4마디씩 묶는다. 2마디가 안 되는 꼬리는 앞 컷에 붙인다
    const inner = downbeats.filter((d) => d > sec.start + bar * .5 && d < sec.end - bar * .5);
    const cuts = [sec.start];
    for (let k = BARS_PER_SHOT - 1; k < inner.length; k += BARS_PER_SHOT) cuts.push(inner[k]);
    if (cuts.length > 1 && sec.end - cuts[cuts.length - 1] < bar * 2) cuts.pop();
    // 처음과 끝(제목·끝 글자)은 컷을 나누지 않는다
    if (si === 0 || last) cuts.length = 1;

    cuts.forEach((start, k) => {
      const end = k + 1 < cuts.length ? cuts[k + 1] : sec.end;
      const scene = pool[k % pool.length];
      const before = shots[shots.length - 1];
      let enter: Transition = "cut";
      if (before && before.scene !== scene) {
        const jump = prev ? sec.energy - prev.energy : 0;
        enter = k === 0 && jump > .35 ? "flash" : "fade";
      }
      shots.push({ start, end, scene, variant: Math.floor(k / pool.length) + si, section: si, enter });
    });
  });
  // 마지막 컷은 곡 끝까지
  if (shots.length) shots[shots.length - 1].end = Math.max(shots[shots.length - 1].end, song.duration);
  return shots;
}

export function shotAt(shots: Shot[], t: number) {
  for (let i = shots.length - 1; i >= 0; i--) if (t >= shots[i].start) return i;
  return 0;
}
