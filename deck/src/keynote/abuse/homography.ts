/**
 * w×h 크기의 요소를 화면의 네 점(왼쪽 위 → 오른쪽 위 → 오른쪽 아래 → 왼쪽 아래)에 맞추는 CSS matrix3d.
 * Blender가 내보낸 휴대전화 화면의 모서리에 DOM 화면을 정확히 얹을 때 쓴다(transform-origin: 0 0).
 */
export function quadMatrix3d(w: number, h: number, corners: number[][]): string {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = corners;
  const dx1 = x1 - x2, dy1 = y1 - y2, dx2 = x3 - x2, dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den, k = (dx1 * sy - sx * dy1) / den;
  const a = x1 - x0 + g * x1, b = x3 - x0 + k * x3, c = x0;
  const d = y1 - y0 + g * y1, e = y3 - y0 + k * y3, f = y0;
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, c, f, 0, 1];
  return `matrix3d(${m.map((v) => +v.toFixed(8)).join(",")})`;
}

/** 같은 변환으로 w×h 요소 안의 한 점(x, y)이 화면의 어디에 놓이는지. */
export function quadPoint(w: number, h: number, corners: number[][], x: number, y: number): [number, number] {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = corners;
  const dx1 = x1 - x2, dy1 = y1 - y2, dx2 = x3 - x2, dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den, k = (dx1 * sy - sx * dy1) / den;
  const u = x / w, v = y / h, z = g * u + k * v + 1;
  return [((x1 - x0 + g * x1) * u + (x3 - x0 + k * x3) * v + x0) / z, ((y1 - y0 + g * y1) * u + (y3 - y0 + k * y3) * v + y0) / z];
}
