import track from "./track.json";

/*
 * 12번 스크롤 페이지의 영상 좌표.
 * 스크롤 위치 p는 정지 지점 단위(0~7)다. 정지 지점 사이는 영상 프레임과 선형으로 대응한다.
 * 영상의 움직임에는 이미 가감속이 들어 있으므로, 앞으로 넘길 때는 p도 원래 속도로 흘려보낸다.
 */
export const FPS: number = track.fps;
export const ANCHORS: number[] = track.anchors;
export const LAST_STEP = ANCHORS.length - 1;
export const FRAMES: number = track.frames;

export function frameAt(p: number) {
  const k = Math.max(0, Math.min(LAST_STEP - 1, Math.floor(p)));
  const t = Math.max(0, Math.min(1, p - k));
  return ANCHORS[k] + (ANCHORS[k + 1] - ANCHORS[k]) * t;
}

export function progressAt(frame: number) {
  if (frame <= 0) return 0;
  for (let k = 0; k < LAST_STEP; k++) {
    if (frame <= ANCHORS[k + 1]) return k + (frame - ANCHORS[k]) / (ANCHORS[k + 1] - ANCHORS[k]);
  }
  return LAST_STEP;
}

/** p1에서 p2까지 영상을 원래 속도로 재생하는 데 걸리는 시간(초). */
export function spanSeconds(p1: number, p2: number) {
  return Math.abs(frameAt(p2) - frameAt(p1)) / FPS;
}

/**
 * 영상 한 개를 프레임 단위로 옮긴다. 앞선 탐색이 끝나기 전에는 새로 걸지 않고
 * 마지막 요청만 기억한다. 탐색을 쌓으면 디코더가 밀려 화면이 멈춰 보인다.
 */
export class Scrubber {
  private want = -1;
  private busy = false;
  constructor(private video: HTMLVideoElement) {
    video.addEventListener("seeked", this.done);
  }
  seek(frame: number) {
    this.want = Math.max(0, Math.min(FRAMES - 1, Math.round(frame)));
    if (!this.busy) this.apply();
  }
  /** 지금 화면에 나온 프레임. 재생 중에도 쓴다. */
  get shown() {
    return Math.max(0, this.video.currentTime * FPS - 0.5);
  }
  get settled() {
    return !this.busy && Math.abs(this.shown - this.want) < 0.51;
  }
  private apply() {
    // 프레임의 한가운데를 가리켜 반올림 때문에 앞 프레임이 나오는 일을 막는다.
    const t = (this.want + 0.5) / FPS;
    if (Math.abs(this.video.currentTime - t) < 0.5 / FPS) return;
    this.busy = true;
    this.video.currentTime = t;
  }
  private done = () => {
    this.busy = false;
    if (this.want >= 0) this.apply();
  };
  dispose() {
    this.video.removeEventListener("seeked", this.done);
  }
}
