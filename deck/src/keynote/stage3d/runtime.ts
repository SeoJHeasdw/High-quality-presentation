import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/*
 * 2~3, 7~8, 15~16번 공간이 함께 쓰는 틀.
 * 9~11번 사건 공간(incident/world.ts)과 같은 규칙을 따른다.
 *   · 1920×1080 한 장을 렌더하고, 무대 배율은 CSS가 맞춘다.
 *   · 앞으로 넘길 때만 장면의 움직임을 재생하고, 뒤로 가거나 건너뛰면 그 단계의 마지막 상태를 보여준다.
 *   · 모션을 끄면 시계를 멈추고 마지막 상태를 한 번만 그린다.
 */

export const W = 1920, H = 1080;

/* Metal(Apple GPU)에서는 가장자리가 뒤집힌 smoothstep과 음수의 pow가 NaN이 되어 bloom이 화면 전체로 번진다. */
export const GLSL_SAFE = `
float sstep(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0., 1.); return t * t * (3. - 2. * t); }
float pw(float x, float y){ return pow(max(x, 0.), y); }
`;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const smooth = (a: number, b: number, t: number) => { const k = clamp01((t - a) / (b - a)); return k * k * (3 - 2 * k); };
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
export function rand(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export const FONT = '"Pretendard Variable", "Apple SD Gothic Neo", sans-serif';

export function glowTexture(size = 128) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.18, "rgba(255,255,255,.55)");
  grd.addColorStop(0.45, "rgba(255,255,255,.14)"); grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/** 캔버스에 그린 그림을 텍스처로. 폰트가 늦게 오면 다시 그린다. */
export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const paint = () => { const g = c.getContext("2d")!; g.clearRect(0, 0, w, h); draw(g); };
  paint();
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  document.fonts?.ready.then(() => { paint(); texture.needsUpdate = true; });
  return texture;
}

/** 단계 사이를 오갈 때 쓰는 시계. 앞으로 넘긴 단계만 0초부터 재생한다. */
export class PhaseClock {
  clock = 0;
  enteredAt = -1e6;
  constructor(public phase: number, public motion: boolean) { if (motion) this.enteredAt = 0; }
  tick(dt: number) { if (this.motion) this.clock += dt; }
  /** 현재 단계에 들어온 뒤의 시간. 재생하지 않는 단계는 충분히 큰 값. */
  get t() { return this.enteredAt < -1e5 ? 1e3 : this.clock - this.enteredAt; }
  /** start초에 시작해 dur초 동안 0→1 */
  ev(start: number, dur: number) { return clamp01((this.t - start) / dur); }
  go(next: number) {
    const forward = next === this.phase + 1;
    this.phase = next;
    this.enteredAt = forward && this.motion ? this.clock : -1e6;
    return forward;
  }
  setMotion(on: boolean) { this.motion = on; if (!on) this.enteredAt = -1e6; }
}

export type Stage = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  glow: THREE.Texture;
  pointer: THREE.Vector2;
  /** 무대에서 쓰는 텍스처·렌더 타깃 등 따로 정리할 것들 */
  keep: (d: { dispose: () => void }) => void;
  /** 매 프레임 불리는 갱신. dt는 모션이 꺼져 있으면 0. */
  start: (update: (dt: number) => void, isMoving: () => boolean) => void;
  kick: () => void;
  onFrame: (cb: () => void) => void;
  project: (v: THREE.Vector3) => { x: number; y: number; visible: boolean };
  dispose: () => void;
};

export function createStage(canvas: HTMLCanvasElement, opts: { background: string; fog?: number; fov?: number; bloom?: [number, number, number]; exposure?: number; lostEvent: string }): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  const ratio = () => Math.min(1.6, Math.max(1, (window.devicePixelRatio || 1) * (canvas.getBoundingClientRect().width / W || 1)));
  renderer.setPixelRatio(ratio());
  renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = opts.exposure ?? 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(opts.background);
  if (opts.fog) scene.fog = new THREE.FogExp2(opts.background, opts.fog);
  const camera = new THREE.PerspectiveCamera(opts.fov ?? 34, W / H, 1, 20000);

  // 후처리를 거치면 기본 안티앨리어싱이 빠진다. 사진과 얇은 선의 가장자리를 위해 MSAA 타깃을 쓴다.
  const target = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const [strength, radius, threshold] = opts.bloom ?? [0.7, 0.5, 0.78];
  const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), strength, radius, threshold);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const glow = glowTexture();
  const disposables: { dispose: () => void }[] = [glow, composer as unknown as { dispose: () => void }];
  const pointer = new THREE.Vector2();
  const listeners: (() => void)[] = [];
  const tmp = new THREE.Vector3();

  let update: (dt: number) => void = () => {};
  let moving: () => boolean = () => false;
  let raf = 0, last = performance.now(), frames = 0, disposed = false, dirty = 3, hold = false;
  const frame = () => {
    raf = 0;
    if (disposed || hold) return;
    const now = performance.now(); const dt = Math.min(0.1, (now - last) / 1000); last = now;
    update(dt);
    composer.render();
    canvas.dataset.frames = String(++frames);
    if (frames === 1) canvas.dataset.ready = "true";
    listeners.forEach((l) => l());
    if (moving() && !document.hidden) raf = requestAnimationFrame(frame);
    else if (--dirty > 0) raf = requestAnimationFrame(frame);
  };
  const kick = () => { dirty = 3; if (!raf && !hold && !disposed) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const onVis = () => kick();
  const onLost = (e: Event) => { e.preventDefault(); canvas.dispatchEvent(new CustomEvent(opts.lostEvent)); };
  document.addEventListener("visibilitychange", onVis);
  canvas.addEventListener("webglcontextlost", onLost);

  if (import.meta.env.DEV) {
    // 렌더 검수용: 시계를 멈추고 원하는 만큼 진행한다.
    const w = window as unknown as Record<string, unknown>;
    w[`__${opts.lostEvent}Pause`] = () => { hold = true; if (raf) cancelAnimationFrame(raf); raf = 0; };
    w[`__${opts.lostEvent}Advance`] = (sec: number) => { for (let i = 0; i < Math.round(sec * 30); i++) update(1 / 30); composer.render(); listeners.forEach((l) => l()); };
  }

  return {
    renderer, scene, camera, composer, bloom, glow, pointer,
    keep: (d) => { disposables.push(d); },
    start(u, m) { update = u; moving = m; kick(); },
    kick,
    onFrame(cb) { listeners.push(cb); },
    project(v) {
      tmp.copy(v).project(camera);
      return { x: (tmp.x + 1) / 2 * W, y: (1 - tmp.y) / 2 * H, visible: tmp.z < 1 && tmp.z > -1 };
    },
    dispose() {
      disposed = true; if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("webglcontextlost", onLost);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
      });
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      // 장을 오가며 리허설해도 WebGL 컨텍스트가 쌓이지 않게 바로 돌려준다. 잃음 이벤트는 위에서 이미 뗐다.
      renderer.forceContextLoss();
    },
  };
}

/** 화면 좌표(px)와 같은 단위로 쓰는 카메라. z=0 평면의 1단위가 화면 1px이다. */
export function pixelCamera(camera: THREE.PerspectiveCamera) {
  const d = (H / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  camera.position.set(0, 0, d); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
  return d;
}
/** 화면 좌표(px, 좌상단 원점) → z=0 평면의 월드 좌표 */
export const toWorld = (x: number, y: number) => new THREE.Vector3(x - W / 2, H / 2 - y, 0);

export type Pose = { eye: [number, number, number]; look: [number, number, number] };
/** 카메라 방향(방위각·앙각, 도)과 반드시 보여야 할 점들, 그 점들이 들어갈 화면 영역(px)으로 샷을 정한다. */
export type Shot = { az: number; el: number; rect: [number, number, number, number]; points: () => THREE.Vector3[] };
export function fitShot(shot: Shot, camera: THREE.PerspectiveCamera): Pose {
  const pts = shot.points();
  const look = pts.reduce((a, v) => a.add(v), new THREE.Vector3()).multiplyScalar(1 / pts.length);
  const az = THREE.MathUtils.degToRad(shot.az), el = THREE.MathUtils.degToRad(shot.el);
  const dir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  const [rx0, ry0, rx1, ry1] = shot.rect, rw = rx1 - rx0, rh = ry1 - ry0, rcx = (rx0 + rx1) / 2, rcy = (ry0 + ry1) / 2;
  const q = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
  const measure = (d: number) => {
    camera.position.copy(look).addScaledVector(dir, d); camera.lookAt(look); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const v of pts) { q.copy(v).project(camera); const x = (q.x + 1) / 2 * W, y = (1 - q.y) / 2 * H; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { x0, y0, x1, y1 };
  };
  let d = 20;
  for (let iter = 0; iter < 6; iter++) {
    let lo = 2, hi = 200;
    for (let k = 0; k < 32; k++) { const mid = (lo + hi) / 2, b = measure(mid); if (b.x1 - b.x0 <= rw && b.y1 - b.y0 <= rh) hi = mid; else lo = mid; }
    d = hi;
    const b = measure(d);
    const dx = (b.x0 + b.x1) / 2 - rcx, dy = (b.y0 + b.y1) / 2 - rcy;
    const perPx = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * d / H;
    camera.matrixWorld.extractBasis(right, up, q);
    look.addScaledVector(right, dx * perPx).addScaledVector(up, -dy * perPx);
  }
  const eye = look.clone().addScaledVector(dir, d);
  return { eye: [eye.x, eye.y, eye.z], look: [look.x, look.y, look.z] };
}
/** 가로 w, 세로 h 판의 네 모서리(중심 c, y축 회전 ry) */
export function quad(c: THREE.Vector3, w: number, h: number, ry = 0) {
  const r = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry)).multiplyScalar(w / 2);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => c.clone().addScaledVector(r, sx).add(new THREE.Vector3(0, sy * h / 2, 0)));
}
