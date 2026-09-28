/**
 * 3D 무대를 초당 60번 안팎으로만 그린다. 120Hz 맥북 화면에서는 매 주사마다 다시 그려
 * 리허설만으로 발열이 났다. 발표 화면(TV 미러링·프로젝터)은 60Hz라 원래 그 이상 그리지 않으므로
 * 청중이 보는 화면은 같고, 맥북에서 연습할 때도 발표장과 같은 속도로 움직인다.
 *
 * 간격 기준을 1/75초로 두어 60Hz 이하 화면의 프레임은 하나도 버리지 않고, 120Hz에서는 한 번 걸러 그린다.
 */
const MIN_GAP_MS = 1000 / 75;

/** rAF 콜백의 시각을 받아 이번 프레임을 그릴지 알려주는 문. 루프마다 하나씩 만든다. */
export function frameGate(): (now: number) => boolean {
  let last = -Infinity;
  return (now) => {
    if (now - last < MIN_GAP_MS) return false;
    last = now;
    return true;
  };
}
