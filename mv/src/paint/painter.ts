/**
 * 유화 붓질 패스. 깨끗하게 그린 장면(절반 해상도)에서 색을 집어 붓 자국을 겹겹이 칠한다.
 *
 *   1. 흐린 밑칠: 장면을 흐려서 깐다(붓 사이 빈틈이 검게 보이지 않게)
 *   2. 굵은 붓 → 중간 붓 → 가는 붓. 가는 붓은 윤곽(밝기 변화가 큰 곳)에만 간다
 *   3. 붓 방향: 윤곽이 있으면 윤곽을 따라, 없으면 소용돌이 흐름(하늘의 고흐 같은 결)
 *
 * 붓 위치는 격자에 고정하고, 초당 7.5번 조금씩만 흔든다. 손으로 칠한 애니메이션처럼
 * 그림이 살짝 꿈틀거리되 멈춘 곳이 번쩍이지는 않는다.
 */
import { hash, mix } from "../scenes.ts";

export function vnoise(x: number, y: number, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const s = seed * 7919;
  const a = hash(xi + s, yi), b = hash(xi + 1 + s, yi);
  const c = hash(xi + s, yi + 1), d = hash(xi + 1 + s, yi + 1);
  return mix(mix(a, b, u), mix(c, d, u), v);
}

export type Brush = { cell: number; len: number; width: number; detail: number; alpha: number };

// 매끈하게: 길고 넓은 붓을 옅게 겹치고, 가는 붓은 또렷한 윤곽에만
export const BRUSHES: Brush[] = [
  { cell: 20, len: 48, width: 20, detail: 0, alpha: .8 },
  { cell: 11, len: 28, width: 10.5, detail: 0, alpha: .74 },
  { cell: 6, len: 13, width: 4, detail: 22, alpha: .85 },
];

export type PaintOptions = {
  /** 흐름장의 씨앗(장면마다 다르게) */
  flowSeed: number;
  /** 소용돌이 크기. 작을수록 큰 소용돌이 */
  flowScale?: number;
  /** 붓 흔들림 정도(칸 크기 대비) */
  boil?: number;
};

export function paint(dst: CanvasRenderingContext2D, src: HTMLCanvasElement, hold: number, o: PaintOptions) {
  const W = dst.canvas.width, H = dst.canvas.height;
  const sw = src.width, sh = src.height;
  const k = sw / W;
  const data = src.getContext("2d")!.getImageData(0, 0, sw, sh).data;
  const fs = o.flowScale ?? .0022;
  const boil = o.boil ?? .2;

  dst.save();
  dst.filter = "blur(5px)";
  dst.drawImage(src, 0, 0, W, H);
  dst.filter = "none";
  dst.lineCap = "round";

  const lum = (x: number, y: number) => {
    const xi = Math.min(sw - 1, Math.max(0, x | 0)), yi = Math.min(sh - 1, Math.max(0, y | 0));
    const i = (yi * sw + xi) * 4;
    return data[i] * .3 + data[i + 1] * .59 + data[i + 2] * .11;
  };

  BRUSHES.forEach((b, li) => {
    const cols = Math.ceil(W / b.cell) + 1, rows = Math.ceil(H / b.cell) + 1;
    dst.globalAlpha = b.alpha;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const id = i * 131 + j * 7 + li * 100003;
      const x = (i + hash(id, 1)) * b.cell + (hash(id, hold) - .5) * b.cell * boil;
      const y = (j + hash(id, 2)) * b.cell + (hash(id, hold + 977) - .5) * b.cell * boil;
      const sx = x * k, sy = y * k;
      const gx = lum(sx + 1.5, sy) - lum(sx - 1.5, sy);
      const gy = lum(sx, sy + 1.5) - lum(sx, sy - 1.5);
      const mag = Math.hypot(gx, gy);
      if (mag < b.detail) continue;
      const a = mag > 9
        ? Math.atan2(gy, gx) + Math.PI / 2
        : vnoise(x * fs, y * fs, o.flowSeed) * Math.PI * 2.6 + (hash(id, 3) - .5) * .25;
      const xi = Math.min(sw - 1, Math.max(0, sx | 0)), yi = Math.min(sh - 1, Math.max(0, sy | 0));
      const p = (yi * sw + xi) * 4;
      const f = .95 + .1 * hash(id, 4);
      const r = Math.min(255, data[p] * f), g = Math.min(255, data[p + 1] * f), bl = Math.min(255, data[p + 2] * f + 3 * (hash(id, 5) - .3));
      const len = b.len * (.7 + .6 * hash(id, 6)) * (mag > 30 ? .65 : 1);
      const cx = Math.cos(a) * len / 2, cy = Math.sin(a) * len / 2;
      const bend = (hash(id, 7) - .5) * len * .25;
      dst.strokeStyle = `rgb(${r | 0},${g | 0},${bl | 0})`;
      dst.lineWidth = b.width * (.75 + .5 * hash(id, 8));
      dst.beginPath();
      dst.moveTo(x - cx, y - cy);
      dst.quadraticCurveTo(x - cy / len * 2 * bend, y + cx / len * 2 * bend, x + cx, y + cy);
      dst.stroke();
    }
  });
  dst.restore();
}

/** 캔버스 천의 결. 칠한 뒤 아주 옅게 덮는다 */
export function canvasWeave(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const v = 128 + (Math.sin(x * 1.9) * Math.sin(y * 1.7) * 18) + (hash(x, y) - .5) * 40;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
