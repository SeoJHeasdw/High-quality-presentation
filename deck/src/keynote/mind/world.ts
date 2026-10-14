import * as THREE from "three";
import { FONT, GLSL_SAFE, PhaseClock, clamp01, createStage, easeInOut, easeOut, pixelCamera, rand, smooth, toWorld } from "../stage3d/runtime";
import { Ink, drawing, svgPolys } from "./ink";
import * as S from "./drawings";

/*
 * 42~52번 · 그 안에 누가 있을까. 질문 하나를 따라간다: AI는 '누군가'의 선 안에 있나, 밖에 있나.
 *   방 A(42~44) 긴 탁자의 자리들(성직자 수십 명) → 물은 것 둘(저울 · 하트) → 왜 성직자였나(옛 등잔) → 카메라가 저녁 자리 둘로 →
 *        반론의 사슬(글자) → 탁자 위의 41번 금색 고리 → 빛 기둥 셋이 하나씩(없다 · 모른다 · 있는 것 같다) → 바닥의 금색 원(기준은?)
 *   45~48은 Blender 전시관 영상이다(tools/render-mind-hall.py, Mind.tsx의 HallLayer). 그동안 이 캔버스는 쉰다.
 *   방 D(49) 기록을 다시 읽는 AI → 클라이브 웨어링의 일기 → 판단의 기록을 다시 읽는 자비스 → 쓰면서 배우는 연구
 *   방 E(50) 몸이 생긴 로봇 → 흉내 낸 아픔(로봇 환자의 얼굴) → 두 빈칸(몸 · 기억)이 채워지는 중 → 기술적 장벽이 없어 보인다
 *   방 F(51~52) 낱말이 뇌가 되고, 바닥의 빛 원이 그 발밑 쪽으로 다가와 멈춘다 → 30년 눈금의 기록이 뇌 밖에 모였다가 안으로 들어간다 → 카메라가 뇌로 다가간다
 * 따뜻한 색(분필 금빛)은 사람과 동물, 파랑은 AI다. 빨강은 쓰지 않는다(이 덱에서 사실이 아님을 뜻하는 색).
 * 카메라는 방마다 z=방 평면의 1단위가 화면 1px이 되도록 선다(DOM 라벨과 같은 좌표). 43번에서는 탁자 쪽으로, 52-3~4에서는 뇌 쪽으로 다가간다.
 */

export const PHASES = 43;
/** 장마다 시작 단계(42~52번)와 단계 수 - 1 */
export const PART_BASE = [0, 3, 6, 10, 16, 20, 23, 26, 30, 34, 38];
export const PART_STEPS = [2, 2, 3, 5, 3, 2, 2, 3, 3, 3, 4];
/** 45~48번(단계 10~25)은 전시관 영상이다. 그 단계의 방은 -1이고 캔버스는 쉰다. */
export const HALL = { from: 10, to: 25 };
export const ROOM = (p: number) => (p < 10 ? 0 : p <= HALL.to ? -1 : p < 30 ? 3 : p < 34 ? 4 : 5);
const STRIDE = 2600;
const BG = "#0b0806";
const CHALK = new THREE.Color("#f2d9ae");
const GOLD = new THREE.Color("#ffcf86");
const ICE = new THREE.Color("#8fd0ff");
const WORDS = ["약속", "설득", "명령", "거짓말", "기도", "계약", "법", "광고", "소문", "뉴스", "맹세", "부탁", "허락", "거절", "promise", "command", "prompt", "token", "law", "prayer", "story", "yes", "no", "obey", "please", "believe"];

/* 화면 배치(px). Mind.tsx의 라벨도 같은 값을 쓴다. ---------------------------------------- */
export const LAYOUT = {
  answers: [1090, 1390, 1690],
  asks: [1180, 1580],
  askY: 420,
  answerY: 500,
  memBrain: { x: 1672, y: 560, h: 260 },
  records: { x: 1010, y: 660 },
  cards: { x: 1440, ys: [418, 498, 578, 658] },
  column: { x: 1500, ys: [470, 630] },
  ruler: { x0: 1000, x1: 1780, y: 892 },
};
/** 47-1 · 일기: 첫 줄(글자, Mind.tsx)이 서는 시각, 다음 줄 사이 간격(초), 줄의 자리(px) */
export const DIARY = { first: 1.5, gap: 0.36, rule0: 360, gap_y: 52, x0: 1111 };
export type MindWorld = { setPhase: (p: number) => void; setMotion: (on: boolean) => void; onFrame: (cb: () => void) => void; dispose: () => void };

/* 낱말 → 뇌 입자 ------------------------------------------------------------------------- */
function sampleBrain(count: number, h: number, seed: number) {
  const W = 300, H = 240, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.fillStyle = "#fff"; g.fill(new Path2D(S.BRAIN_OUTLINE)); g.fill(new Path2D("M200 176 Q230 205 255 190 Q262 175 255 160 Z"));
  const d = g.getImageData(0, 0, W, H).data, inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 128;
  const fill: number[] = [], edge: number[] = [];
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (inside(x, y)) (inside(x - 5, y) && inside(x + 5, y) && inside(x, y - 5) && inside(x, y + 5) ? fill : edge).push(x, y);
  const r = rand(seed), s = h / H, out: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const src = r() < 0.3 ? edge : fill, k = Math.floor(r() * (src.length / 2)) * 2, x = src[k], y = src[k + 1];
    // 가운데는 두껍고 가장자리는 얇은 덩어리
    const cx = (x - W / 2) / (W / 2), cy = (y - H / 2) / (H / 2), depth = Math.sqrt(Math.max(0, 1 - cx * cx * 0.8 - cy * cy * 0.8));
    out.push(new THREE.Vector3((x - W / 2 + (r() - .5) * 2) * s, (H / 2 - y + (r() - .5) * 2) * s, (r() - .5) * 2 * depth * h * 0.3));
  }
  return out;
}
function sampleWords(perWord: number, seed: number) {
  const out: { word: number; x: number; y: number }[] = [], c = document.createElement("canvas"); c.width = 520; c.height = 160;
  const g = c.getContext("2d", { willReadFrequently: true })!, r = rand(seed);
  WORDS.forEach((w, wi) => {
    g.clearRect(0, 0, 520, 160); g.fillStyle = "#fff"; g.font = `700 92px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(w, 260, 84);
    const d = g.getImageData(0, 0, 520, 160).data, px: number[] = [];
    for (let y = 0; y < 160; y += 2) for (let x = 0; x < 520; x += 2) if (d[(y * 520 + x) * 4 + 3] > 140) px.push(x, y);
    for (let i = 0; i < perWord; i++) { const k = Math.floor(r() * (px.length / 2)) * 2; out.push({ word: wi, x: px[k] - 260, y: 80 - px[k + 1] }); }
  });
  return out;
}

class WordBrain {
  points: THREE.Points; mat: THREE.ShaderMaterial; interior: THREE.Vector3[];
  constructor(at: THREE.Vector3, h: number, perWord: number, seed: number, camD: number, size = 1) {
    const words = sampleWords(perWord, seed), m = words.length, brain = sampleBrain(m, h, seed + 1), r = rand(seed + 2);
    const aWord = new Float32Array(m * 3), aBrain = new Float32Array(m * 3), aSeed = new Float32Array(m), aGroup = new Float32Array(m);
    const spots = WORDS.map((_, i) => { const a = (i / WORDS.length) * Math.PI * 2 + r() * 0.3, rad = h * (0.95 + r() * 0.55); return new THREE.Vector3(Math.cos(a) * rad * 1.15, Math.sin(a) * rad * 0.62, -h * 0.9 + r() * h * 1.4); });
    const sc = WORDS.map(() => (0.2 + r() * 0.18) * h / 300);
    for (let i = 0; i < m; i++) {
      const w = words[i], s = spots[w.word];
      aWord.set([s.x + w.x * sc[w.word], s.y + w.y * sc[w.word], s.z], i * 3);
      aBrain.set([brain[i].x, brain[i].y, brain[i].z], i * 3);
      aSeed[i] = r(); aGroup[i] = w.word / WORDS.length;
    }
    this.interior = brain.filter((_, i) => i % 3 === 0).map((v) => v.clone().multiplyScalar(0.86).add(at));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(aBrain.slice(), 3));
    geo.setAttribute("aWord", new THREE.BufferAttribute(aWord, 3));
    geo.setAttribute("aBrain", new THREE.BufferAttribute(aBrain, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(aSeed, 1));
    geo.setAttribute("aGroup", new THREE.BufferAttribute(aGroup, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uForm: { value: 1 }, uA: { value: 0 }, uTime: { value: 0 }, uD: { value: camD }, uC: { value: ICE.clone() }, uS: { value: size } },
      vertexShader: `${GLSL_SAFE}
        attribute vec3 aWord; attribute vec3 aBrain; attribute float aSeed; attribute float aGroup;
        uniform float uForm, uA, uTime, uD, uS; varying float vA;
        void main(){
          float k = clamp(uForm * 1.6 - aGroup * .45 - aSeed * .15, 0., 1.); k = k * k * (3. - 2. * k);
          vec3 w = aWord + vec3(sin(uTime * .21 + aGroup * 17.) * 18., cos(uTime * .17 + aGroup * 11.) * 12., 0.) * (1. - k);
          vec3 mid = mix(w, aBrain, .5) + vec3(-80. + aGroup * 160., 60. * sin(aGroup * 20.), 180.) * uS;
          vec3 p = mix(mix(w, mid, k), mix(mid, aBrain, k), k);
          p += vec3(sin(uTime * 1.3 + aSeed * 50.), cos(uTime * 1.1 + aSeed * 40.), sin(uTime * .9 + aSeed * 30.)) * (1. + 1.4 * k) * uS;
          vec4 mv = modelViewMatrix * vec4(p, 1.); float z = -mv.z;
          vA = uA * (.5 + .5 * k) * exp(-pw(.00036 * max(z - 1900., 0.), 2.)) * sstep(120., 760., z);
          gl_PointSize = (1.9 + aSeed * 1.3) * (.55 + .45 * uS) * (uD / z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `${GLSL_SAFE}uniform vec3 uC; varying float vA;
        void main(){ float d = length(gl_PointCoord - .5); gl_FragColor = vec4(uC * 1.15 * sstep(.5, .05, d) * vA, 1.); }`,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.mat); this.points.frustumCulled = false; this.points.position.copy(at);
  }
  set(a: number, form: number, time: number) { this.mat.uniforms.uA.value = a; this.mat.uniforms.uForm.value = form; this.mat.uniforms.uTime.value = time; this.points.visible = a > 0.002; }
}

/** 출발점들에서 뇌 안으로 흘러드는 빛. loop면 읽고 사라지기를 되풀이하고, 아니면 들어가 남는다. */
class Flow {
  points: THREE.Points; mat: THREE.ShaderMaterial;
  constructor(sources: THREE.Vector3[], targets: THREE.Vector3[], count: number, seed: number, camD: number, color: THREE.Color) {
    const r = rand(seed), src = new Float32Array(count * 3), dst = new Float32Array(count * 3), sd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = sources[Math.floor(r() * sources.length)], b = targets[Math.floor(r() * targets.length)];
      src.set([a.x + (r() - .5) * 8, a.y + (r() - .5) * 8, a.z], i * 3); dst.set([b.x, b.y, b.z], i * 3); sd[i] = r();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(src.slice(), 3));
    geo.setAttribute("aSrc", new THREE.BufferAttribute(src, 3));
    geo.setAttribute("aDst", new THREE.BufferAttribute(dst, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(sd, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uSpan: { value: 2.4 }, uLoop: { value: 0 }, uA: { value: 0 }, uTime: { value: 0 }, uD: { value: camD }, uC: { value: color.clone() } },
      vertexShader: `${GLSL_SAFE}
        attribute vec3 aSrc; attribute vec3 aDst; attribute float aSeed;
        uniform float uT, uSpan, uLoop, uA, uTime, uD; varying float vA;
        void main(){
          float lt = uLoop > .5 ? mod(uT - aSeed * 2.4, 2.4) : uT - aSeed * uSpan;
          float k = clamp(lt / 1.15, 0., 1.); k = k * k * (3. - 2. * k);
          vec3 mid = mix(aSrc, aDst, .5) + vec3(0., 40. + aSeed * 70., 140.);
          vec3 p = mix(mix(aSrc, mid, k), mix(mid, aDst, k), k);
          p += vec3(sin(uTime * 1.7 + aSeed * 60.), cos(uTime * 1.3 + aSeed * 40.), 0.) * (1.2 + 3. * (1. - k));
          float a = sstep(0., .12, lt) * (uLoop > .5 ? 1. - sstep(1.1, 1.7, lt) : .55 + .45 * sin(uTime * 2. + aSeed * 30.) * k);
          vA = lt < 0. ? 0. : uA * a;
          vec4 mv = modelViewMatrix * vec4(p, 1.); float z = -mv.z;
          gl_PointSize = (2.2 + aSeed * 1.6) * (uD / z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `${GLSL_SAFE}uniform vec3 uC; varying float vA;
        void main(){ float d = length(gl_PointCoord - .5); gl_FragColor = vec4(uC * 1.4 * sstep(.5, .05, d) * vA, 1.); }`,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.mat); this.points.frustumCulled = false;
  }
  set(a: number, t: number, time: number, loop = false, span = 2.4) { const u = this.mat.uniforms; u.uA.value = a; u.uT.value = t; u.uTime.value = time; u.uLoop.value = loop ? 1 : 0; u.uSpan.value = span; this.points.visible = a > 0.002; }
}

/** 표의 칸 하나: 고리(판정 전), 반 칸, 찬 칸 */
class Lamp {
  mesh: THREE.Mesh; mat: THREE.ShaderMaterial;
  constructor(at: THREE.Vector3, color: THREE.Color, r = 18) {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uA: { value: 0 }, uFill: { value: 0 }, uHalf: { value: 0 }, uRing: { value: 1 }, uR: { value: r }, uS: { value: 96 }, uC: { value: color.clone() } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `${GLSL_SAFE}varying vec2 vUv; uniform float uA, uFill, uHalf, uRing, uR, uS; uniform vec3 uC;
        void main(){
          vec2 q = (vUv - .5) * uS; float d = length(q);
          float e = (d - uR) / 1.25; float ring = exp(-e * e);
          float inside = 1. - sstep(uR - 3., uR - 1.2, d);
          float mask = uHalf > .5 ? sstep(1.2, -1.2, q.x) : 1.;
          float fill = inside * mask * uFill;
          float glow = exp(-d / 15.) * .32 * uFill * (uHalf > .5 ? .6 : 1.);
          gl_FragColor = vec4(uC * uA * (ring * .62 * uRing + fill * 1.05 + glow), 1.);
        }`,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(96, 96), this.mat); this.mesh.position.copy(at);
  }
  set(a: number, fill: number, half: boolean, ring = 1) { const u = this.mat.uniforms; u.uA.value = a; u.uFill.value = fill; u.uHalf.value = half ? 1 : 0; u.uRing.value = ring; this.mesh.visible = a > 0.002; }
}

/** 부드러운 빛 판. 캔버스에 그린 원형 그라데이션(glow 텍스처)을 크게 늘리면 Safari가 그라데이션에 섞는 디더링 점이 빨강·초록 얼룩으로 커진다. 그래서 셰이더에서 직접 계산한다. */
function softGlow(color: THREE.Color, opacity = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { uC: { value: color.clone() }, uA: { value: opacity } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `varying vec2 vUv; uniform vec3 uC; uniform float uA;
      void main(){ vec2 q = (vUv - .5) * 2.; float r2 = dot(q, q); float a = exp(-r2 * 4.2) * (1. - smoothstep(.85, 1., r2)); gl_FragColor = vec4(uC * a * uA, 1.); }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
}
const glowA = (m: THREE.Material, a: number) => { ((m as THREE.ShaderMaterial).uniforms.uA.value = a); };

/** 화면 좌표(px) 폴리라인 → 방 평면의 Ink. 원점은 (cx, cy). */
function screenInk(lines: [number, number][][], k: number, color: THREE.Color, o: { width?: number; sketch?: number; seed?: number; dz?: number } = {}) {
  const cx = lines.flat().reduce((s, [x]) => s + x, 0) / lines.flat().length, cy = lines.flat().reduce((s, [, y]) => s + y, 0) / lines.flat().length;
  const polys = lines.map((l) => {
    const pts = svgPolys([`M${l.map(([x, y]) => `${x} ${y}`).join(" L")}`], 3)[0] ?? [];
    return pts.map((v) => new THREE.Vector3(v.x - cx, cy - v.y, 0));
  });
  const ink = new Ink(polys, { color, width: o.width, sketch: o.sketch, seed: o.seed });
  ink.group.position.copy(toWorld(cx, cy)).setZ(-k * STRIDE + (o.dz ?? 0));
  return ink;
}
/** 화면 좌표(px)의 SVG 경로 → 방 평면의 Ink */
function screenPath(paths: string[], k: number, color: THREE.Color, o: { width?: number; sketch?: number; seed?: number } = {}) {
  const polys = svgPolys(paths), all = polys.flat(), cx = all.reduce((s, v) => s + v.x, 0) / all.length, cy = all.reduce((s, v) => s + v.y, 0) / all.length;
  const ink = new Ink(polys.map((p) => p.map((v) => new THREE.Vector3(v.x - cx, cy - v.y, 0))), { color, width: o.width, sketch: o.sketch, seed: o.seed });
  ink.group.position.copy(toWorld(cx, cy)).setZ(-k * STRIDE);
  return ink;
}
/** 손글씨처럼 보이는 낙서 한 줄(일기·대화 기록). 알아볼 수 있는 글자는 쓰지 않는다. */
function scribble(x0: number, y: number, len: number, seed: number): [number, number][] {
  const r = rand(seed), out: [number, number][] = []; let x = x0;
  while (x < x0 + len) {
    const a = 5 + r() * 5, w = 7 + r() * 6;
    for (let i = 0; i <= 6; i++) { const u = i / 6; out.push([x + u * w + Math.sin(u * Math.PI * 2) * 2.5, y - Math.sin(u * Math.PI) * a + (r() - .5) * 1.5]); }
    x += w + (r() < 0.16 ? 14 : 2);
  }
  return out;
}

export function createMindWorld(canvas: HTMLCanvasElement, initialPhase: number, initialMotion: boolean): MindWorld {
  // 장면 전체의 안개(scene.fog)는 쓰지 않는다. WebKit(Metal)에서 안개를 받는 기본 재질의 점들이 빨강·초록 얼룩으로 번졌다. 거리에 따른 흐림은 셰이더마다 직접 한다.
  const stage = createStage(canvas, { background: BG, fov: 30, bloom: [0.72, 0.55, 0.6], exposure: 1.0, lostEvent: "mind-lost" });
  const { scene, camera } = stage;
  const camD = pixelCamera(camera);
  const pc = new PhaseClock(Math.max(0, Math.min(PHASES - 1, initialPhase)), initialMotion);
  const Z = (k: number) => -k * STRIDE;
  const at = (x: number, y: number, k: number, dz = 0) => toWorld(x, y).setZ(Z(k) + dz);
  const add = <T extends { group?: THREE.Object3D; points?: THREE.Object3D; mesh?: THREE.Object3D }>(o: T) => { scene.add((o.group ?? o.points ?? o.mesh)!); return o; };

  /* 일정표: 단계 from~to 동안 보이고, from에서 delay초 뒤 dur초 동안 그려진다. 방을 떠날 때는 카메라가 지나간 뒤 사라진다. */
  type Track = { from: number; to: number; delay: number; dur: number; keep: boolean; apply: (a: number, d: number) => void };
  const tracks: Track[] = [];
  const track = (from: number, to: number, apply: Track["apply"], o: { delay?: number; dur?: number } = {}) => {
    const arrive = from === 0 || ROOM(from) !== ROOM(from - 1);
    tracks.push({ from, to, delay: o.delay ?? (arrive ? 1.15 : 0.2), dur: o.dur ?? 2.0, keep: ROOM(to + 1) !== ROOM(to), apply });
  };
  const inkOn = (ink: Ink, from: number, to: number, o?: { delay?: number; dur?: number }) => { add(ink); track(from, to, (a, d) => ink.set(a, d), o); return ink; };
  const vis = (p: number, t: number, tr: Track): [number, number] => {
    if (p < tr.from) return [0, 0];
    if (p <= tr.to) return p === tr.from ? [smooth(tr.delay, tr.delay + 0.35, t), clamp01((t - tr.delay) / tr.dur)] : [1, 1];
    if (p === tr.to + 1) return [tr.keep ? 1 - smooth(1.55, 1.85, t) : 1 - smooth(0, 0.55, t), 1];
    return [0, 1];
  };

  /* 방: 바닥 · 안쪽의 따뜻한 빛 · 먼지 ---------------------------------------------------- */
  const pools = Array.from({ length: 6 }, (_, k) => new THREE.Vector4(430, Z(k) - 260, 1100, 0.55));
  const floorMat = new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color("#c9935a") }, uCamZ: { value: 0 }, uPools: { value: pools }, uSpot: { value: new THREE.Vector4(0, 0, 0, 0) } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${GLSL_SAFE}varying vec3 vW; uniform vec3 uC; uniform float uCamZ; uniform vec4 uPools[6]; uniform vec4 uSpot;
      void main(){
        vec2 g = vW.xz / 210.;
        vec2 f = abs(fract(g - .5) - .5) / fwidth(g);
        float line = 1. - min(min(f.x, f.y), 1.);
        float pool = 0.;
        for (int i = 0; i < 6; i++) pool += uPools[i].w * exp(-pw(length(vW.xz - uPools[i].xy) / uPools[i].z, 2.));
        pool += uSpot.w * exp(-pw(length(vW.xz - uSpot.xy) / uSpot.z, 2.));
        float ahead = uCamZ - vW.z;
        float fog = exp(-pw(.00026 * max(ahead - 1400., 0.), 2.)) * sstep(-200., 600., ahead);
        float tile = .82 + .18 * sstep(.0, .02, sin(g.x * 3.14159) * sin(g.y * 3.14159));
        vec3 c = uC * (.035 + .3 * pool) * tile + uC * line * (.05 + .42 * pool);
        gl_FragColor = vec4(c * fog, 1.);
      }`,
    depthWrite: false,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9000, 24000), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(300, -540, -8500); floor.renderOrder = -2; scene.add(floor);
  const hazes = Array.from({ length: 6 }, (_, k) => {
    const m = softGlow(new THREE.Color("#8a5a2c"), 0.26);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(5200, 2400), m); h.position.set(520, 220, Z(k) - 1700); h.renderOrder = -1; scene.add(h); return h;
  });
  const dustGeo = new THREE.BufferGeometry();
  { const r = rand(43), n = 1600, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([(r() - .5) * 4200, -540 + r() * 1500, 1200 - r() * 15600], i * 3); dustGeo.setAttribute("position", new THREE.BufferAttribute(a, 3)); }
  const dust = new THREE.Points(dustGeo, new THREE.ShaderMaterial({
    uniforms: { uD: { value: camD }, uC: { value: new THREE.Color("#b88a58") } },
    vertexShader: `${GLSL_SAFE}uniform float uD; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); float z = max(-mv.z, 1.);
        vA = .3 * exp(-pw(.00024 * max(z - 1600., 0.), 2.)) * sstep(150., 700., z);
        gl_PointSize = 3.2 * (uD / z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `${GLSL_SAFE}uniform vec3 uC; varying float vA; void main(){ float d = length(gl_PointCoord - .5); gl_FragColor = vec4(uC * exp(-d * d * 18.) * vA, 1.); }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  }));
  dust.frustumCulled = false;
  scene.add(dust);

  /* 방 A(42~44) · 비밀 모임 · 저녁 자리 · 세 대답 ----------------------------------------------- */
  let pillarDim = 1;
  // 바닥 위의 긴 탁자. 위에서 보면 직사각형이고, 깊이 쪽으로 멀어진다.
  const TY = -392, TX0 = 220, TX1 = 600, TZ0 = 180, TZ1 = -2300;
  const tableLines: THREE.Vector3[][] = [
    [new THREE.Vector3(TX0, TY, TZ0), new THREE.Vector3(TX1, TY, TZ0), new THREE.Vector3(TX1, TY, TZ1), new THREE.Vector3(TX0, TY, TZ1), new THREE.Vector3(TX0, TY, TZ0)],
    [new THREE.Vector3(TX0 + 14, TY - 22, TZ0), new THREE.Vector3(TX1 - 14, TY - 22, TZ0)],
    ...[TZ0 - 40, -560, -1300, TZ1 + 40].flatMap((z) => [[new THREE.Vector3(TX0 + 18, TY, z), new THREE.Vector3(TX0 + 18, -540, z)], [new THREE.Vector3(TX1 - 18, TY, z), new THREE.Vector3(TX1 - 18, -540, z)]]),
  ].map((l) => { const out: THREE.Vector3[] = []; for (let i = 1; i < l.length; i++) { const a = l[i - 1], b = l[i], n = Math.max(2, Math.ceil(a.distanceTo(b) / 6)); for (let j = i === 1 ? 0 : 1; j <= n; j++) out.push(a.clone().lerp(b, j / n)); } return out; });
  const table = add(new Ink(tableLines, { color: CHALK, width: 1.5, up: new THREE.Vector3(0, 1, 0), seed: 3 }));
  table.group.position.z = Z(0);
  track(0, 5, (a, d) => table.set(a, d), { delay: 0.9, dur: 1.8 });
  // 자리마다 작은 불. 수십 명을 나타내는 도식이다. 4번째 줄의 두 자리가 저녁 자리(42-1)다.
  const SEATS = 14, seatPos: number[] = [], seatIdx: number[] = [], seatFocus: number[] = [];
  for (let i = 0; i < SEATS; i++) for (const side of [0, 1]) {
    const z = TZ0 - 90 - i * ((TZ0 - TZ1 - 180) / (SEATS - 1));
    seatPos.push(side ? TX1 + 58 : TX0 - 58, TY - 26, Z(0) + z); seatIdx.push(i + side * 0.5); seatFocus.push(i === 1 ? 1 : 0);
  }
  const seatGeo = new THREE.BufferGeometry();
  seatGeo.setAttribute("position", new THREE.Float32BufferAttribute(seatPos, 3));
  seatGeo.setAttribute("aIdx", new THREE.Float32BufferAttribute(seatIdx, 1));
  seatGeo.setAttribute("aFocus", new THREE.Float32BufferAttribute(seatFocus, 1));
  const seatMat = new THREE.ShaderMaterial({
    uniforms: { uOn: { value: 0 }, uFocus: { value: 0 }, uA: { value: 0 }, uTime: { value: 0 }, uD: { value: camD }, uC: { value: GOLD.clone() } },
    vertexShader: `${GLSL_SAFE}attribute float aIdx, aFocus; uniform float uOn, uFocus, uA, uTime, uD; varying float vA, vF;
      void main(){
        float on = sstep(aIdx * .07, aIdx * .07 + .35, uOn);
        float flick = .86 + .14 * sin(uTime * 7. + aIdx * 13.);
        vF = aFocus * uFocus;
        vA = uA * on * flick * mix(1., aFocus > .5 ? 1.7 : .28, uFocus);
        vec4 mv = modelViewMatrix * vec4(position, 1.);
        gl_PointSize = (26. + 26. * vF) * (uD / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `${GLSL_SAFE}uniform vec3 uC; varying float vA, vF;
      void main(){ float d = length(gl_PointCoord - .5); float a = exp(-d * d * 30.) + .5 * sstep(.12, .0, d); gl_FragColor = vec4(uC * a * vA, 1.); }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
  const seats = new THREE.Points(seatGeo, seatMat); seats.frustumCulled = false; scene.add(seats);
  track(0, 5, (a) => { seatMat.uniforms.uA.value = a; seats.visible = a > 0.002; }, { delay: 0.9 });
  // 42-1 · 물은 것 둘: 옳고 그름(저울)과 느낌(하트). 42-2 · 수천 년 동안 이런 질문을 다뤄 온 사람들(옛 등잔).
  const asks = [S.SCALE, S.HEART].map(([d, w, h], i) => {
    const ink = inkOn(drawing(d, w, h, { color: CHALK, scale: 0.62, seed: 26 + i }), 1, 1, { delay: 0.3 + i * 0.7, dur: 1.2 });
    ink.group.position.copy(at(LAYOUT.asks[i], LAYOUT.askY, 0)); return ink;
  });
  void asks;
  inkOn(drawing(...S.LAMP, { color: GOLD, scale: 0.92, seed: 28 }), 2, 2, { delay: 0.3, dur: 1.6 }).group.position.copy(at(1380, LAYOUT.askY, 0));
  // 43 · 카메라가 저녁 자리 둘로 다가가고(43-0), 반론이 한 칸씩 서고(43-1, 글자), 탁자 위에 41번의 금색 고리가 놓인다(43-2)
  // 위에서 내려다보는 자리. 고리가 열린 원으로 읽히도록 카메라를 고리 쪽으로 기울인다(44-0에서 다시 정면으로 돌아온다).
  const DOLLY = { x: 150, y: 260, z: 760 };
  const ahead = new THREE.Vector3(), aim = new THREE.Vector3();
  const RING_AT = new THREE.Vector3((TX0 + TX1) / 2, TY + 3, Z(0) + TZ0 - 90 - (TZ0 - TZ1 - 180) / (SEATS - 1));
  const tRing = new THREE.Mesh(new THREE.TorusGeometry(46, 2.6, 12, 160, Math.PI * 2 * 0.72), new THREE.MeshBasicMaterial({ color: GOLD.clone().multiplyScalar(1.5), transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
  tRing.rotation.set(-Math.PI / 2, 0, -0.9); tRing.position.copy(RING_AT); scene.add(tRing);
  const tRingGlow = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), softGlow(GOLD, 0)); tRingGlow.rotation.x = -Math.PI / 2; tRingGlow.position.copy(RING_AT).setY(TY + 1); scene.add(tRingGlow);
  track(5, 5, (a) => { (tRing.material as THREE.MeshBasicMaterial).opacity = a; glowA(tRingGlow.material as THREE.Material, 0.35 * a); tRing.visible = tRingGlow.visible = a > 0.002; }, { delay: 1.0 });
  // 44 · 세 개의 빛 기둥이 하나씩 서고(44-0~2), 44-3에서 흐려지며 바닥에 금색 원(기준)이 그려진다
  const coneMat = (i: number) => new THREE.ShaderMaterial({
    uniforms: { uA: { value: 0 }, uC: { value: new THREE.Color(i === 1 ? "#ffd9a0" : "#f6cf98") } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = uv.y; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `${GLSL_SAFE}varying vec3 vN; varying vec3 vV; varying float vY; uniform float uA; uniform vec3 uC;
      void main(){ float f = pw(abs(dot(vN, vV)), 2.2); gl_FragColor = vec4(uC * f * mix(.17, .03, vY) * uA, 1.); }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const emblems = [S.BOOK, S.LENS, S.BUBBLES].map(([d, w, h], i) => {
    const x = LAYOUT.answers[i], ink = add(drawing(d, w, h, { color: CHALK, scale: 0.56, seed: 20 + i }));
    ink.group.position.copy(at(x, LAYOUT.answerY, 0));
    const m = coneMat(i), cone = new THREE.Mesh(new THREE.CylinderGeometry(36, 165, 1240, 48, 1, true), m);
    cone.position.copy(at(x, LAYOUT.answerY, 0, -320)).setY(-540 + 620); scene.add(cone);
    const poolM = softGlow(new THREE.Color("#a4703c"), 0);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(620, 300), poolM); pool.rotation.x = -Math.PI / 2; pool.position.copy(cone.position).setY(-538); scene.add(pool);
    track(6 + i, 9, (a, dd) => { const k2 = a * pillarDim; ink.set(k2, dd); m.uniforms.uA.value = k2; cone.visible = pool.visible = a > 0.002; glowA(poolM, 0.5 * k2); }, { delay: 0.3, dur: 1.3 });
    return ink;
  });
  void emblems;
  const floorRing = new THREE.Mesh(new THREE.TorusGeometry(820, 3.2, 8, 256), new THREE.MeshBasicMaterial({ color: GOLD.clone().multiplyScalar(1.3), transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
  floorRing.rotation.x = -Math.PI / 2; floorRing.position.set(LAYOUT.answers[1] - 960, -536, Z(0) - 320); scene.add(floorRing);
  let floorRingA = 0; track(9, 9, (a, d) => { floorRingA = a * d; }, { delay: 0.7, dur: 1.4 });

  /* 방 D(49) · 기억 ------------------------------------------------------------------------ */
  const MB = LAYOUT.memBrain;
  const brainD = add(new WordBrain(at(MB.x, MB.y, 3), MB.h, 110, 80, camD, 0.8));
  let brainDA = 0; track(26, 29, (a) => { brainDA = a; }, { delay: 1.0 });
  // 49-0 · 대화 기록과, 그 위를 처음부터 다시 훑는 빛
  const CH = { x0: 1080, x1: 1500, y0: 250, y1: 872 };
  inkOn(screenPath([`M${CH.x0 + 20} ${CH.y0} H${CH.x1 - 20} Q${CH.x1} ${CH.y0} ${CH.x1} ${CH.y0 + 20} V${CH.y1 - 20} Q${CH.x1} ${CH.y1} ${CH.x1 - 20} ${CH.y1} H${CH.x0 + 20} Q${CH.x0} ${CH.y1} ${CH.x0} ${CH.y1 - 20} V${CH.y0 + 20} Q${CH.x0} ${CH.y0} ${CH.x0 + 20} ${CH.y0} Z`], 3, CHALK, { width: 1.2, seed: 81 }), 26, 26, { dur: 1.0 });
  const chatLines = Array.from({ length: 12 }, (_, j) => {
    const r = rand(90 + j), len = 150 + r() * 170, y = CH.y0 + 46 + j * 48, mine = j % 2 === 0;
    const x0 = mine ? CH.x0 + 32 : CH.x1 - 32 - len;
    const ink = add(screenInk([scribble(x0, y, len, 300 + j)], 3, mine ? CHALK : ICE, { width: 1.0, sketch: 0, seed: j }));
    return { ink, y };
  });
  let chatA = 0; track(26, 26, (a) => { chatA = a; }, { delay: 1.2 });
  const barMat = softGlow(ICE.clone().multiplyScalar(0.7), 0);
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(520, 70), barMat); scene.add(bar);
  // 49-1 · 클라이브 웨어링의 일기: 같은 말을 다시 쓰고 앞의 줄을 지운다(첫 줄은 Mind.tsx가 글자로 쓴다)
  const PG = { x: 1300, y: 565, s: 0.92 };
  inkOn(drawing(...S.PAGE, { color: CHALK, scale: PG.s, seed: 82 }), 27, 27, { dur: 1.2 }).group.position.copy(at(PG.x, PG.y, 3));
  const pageX0 = PG.x - 290 * PG.s + 78, pageX1 = PG.x + 290 * PG.s - 30, RULE0 = DIARY.rule0, GAP = DIARY.gap_y;
  inkOn(screenInk(Array.from({ length: 10 }, (_, j): [number, number][] => [[pageX0 - 20, RULE0 + j * GAP], [pageX1, RULE0 + j * GAP]]), 3, CHALK.clone().multiplyScalar(0.32), { width: 0.8, sketch: 0, seed: 83 }), 27, 27, { delay: 1.4, dur: 0.6 });
  const entries = Array.from({ length: 7 }, (_, j) => {
    const y = RULE0 + (j + 1) * GAP - 3, r = rand(400 + j), len = 200 + r() * 110;
    const text = add(screenInk([scribble(pageX0 + 70, y, len, 500 + j)], 3, CHALK, { width: 0.95, sketch: 0, seed: j + 40 }));
    const stamp = add(screenInk([scribble(pageX0, y, 46, 600 + j)], 3, GOLD, { width: 0.95, sketch: 0, seed: j + 60 }));
    const strike = add(screenInk([[[pageX0 - 6, y - 6 + (r() - .5) * 4], [pageX0 + 80 + len, y - 10 + (r() - .5) * 4]]], 3, CHALK, { width: 1.1, sketch: 0, seed: j + 80 }));
    return { text, stamp, strike, at: DIARY.first + (j + 1) * DIARY.gap };
  });
  let diaryA = 0; track(27, 27, (a) => { diaryA = a; }, { delay: 1.15 });
  // 49-2~3 · 판단의 기록(카드, Mind.tsx)에서 뇌로 들어가는 빛
  const C = LAYOUT.cards, cardSrc = C.ys.map((y) => at(C.x, y, 3));
  const flowRead = add(new Flow(cardSrc, brainD.interior, 700, 84, camD, GOLD));
  const flowKeep = add(new Flow(cardSrc, brainD.interior, 900, 85, camD, GOLD));
  let readA = 0, keepA = 0; track(28, 28, (a) => { readA = a; }, { delay: 0.6 }); track(29, 29, (a) => { keepA = a; }, { delay: 0.5 });

  /* 방 E(50) · 몸 -------------------------------------------------------------------------- */
  const hand = inkOn(drawing(...S.HAND, { color: ICE, scale: 0.95, seed: 90 }), 30, 30, { dur: 1.3 });
  inkOn(drawing(...S.NEEDLE, { color: CHALK, scale: 1, seed: 91 }), 30, 30, { delay: 1.4, dur: 0.6 }).group.position.copy(at(1170, 640, 4));
  const spark = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), softGlow(GOLD, 0));
  spark.position.copy(at(1170, 538, 4)); scene.add(spark);
  inkOn(drawing(...S.HEX, { color: ICE, scale: 1.05, seed: 92 }), 30, 30, { delay: 1.6, dur: 1.6 }).group.position.copy(at(1610, 770, 4));
  inkOn(drawing(...S.HEX_FAR, { color: ICE.clone().multiplyScalar(0.45), scale: 1.05, seed: 93 }), 30, 30, { delay: 2.4, dur: 0.8 }).group.position.copy(at(1610, 770, 4));
  let handA = 0; track(30, 30, (a) => { handA = a; }, { delay: 1.15 });
  const face = inkOn(drawing(...S.FACE, { color: ICE, scale: 1.38, seed: 94 }), 31, 31, { dur: 1.2 });
  face.group.position.copy(at(1390, 560, 4));
  const calm = add(drawing(...S.FACE_CALM, { color: ICE, scale: 1.38, seed: 95 })), pain = add(drawing(...S.FACE_PAIN, { color: ICE, scale: 1.38, seed: 96 }));
  calm.group.position.copy(face.group.position); pain.group.position.copy(face.group.position);
  let faceA = 0; track(31, 31, (a) => { faceA = a; }, { delay: 0.2 });
  const brainE = add(new WordBrain(at(LAYOUT.column.x, LAYOUT.column.ys[0] - 160, 4), 90, 60, 97, camD, 0.4));
  let brainEA = 0; track(32, 33, (a) => { brainEA = a; }, { delay: 0.2 });
  // 50-2~3 · AI를 선 밖에 두던 두 빈칸(몸 · 기억). 둘 다 반 칸이 깜박이며 채워지는 중이다.
  const column = LAYOUT.column.ys.map((y, row) => {
    const lamp = add(new Lamp(at(LAYOUT.column.x, y, 4), ICE, 26));
    track(32, 33, (a) => { lamp.set(a, 0, true, 1); }, { delay: 0.5 + row * 0.25, dur: 0.6 });
    return lamp;
  });

  /* 방 F(51~52) · 선이 움직인다면 · 30년을 함께 겪은 AI ---------------------------------------- */
  const brainF = add(new WordBrain(at(1390, 470, 5), 440, 220, 100, camD, 1.3));
  let brainFA = 0, brainFF = 0; track(34, 42, (a, d) => { brainFA = a; brainFF = d; }, { delay: 1.0, dur: 2.2 });
  // 51-1 · 바닥의 빛 원(45~46번의 선)이 AI의 발밑 쪽으로 넓어지다 바로 앞에서 멈춘다
  // 바닥은 방 평면보다 먼 곳이라야 화면에 보인다. FEET는 화면에서 뇌 바로 아래(1390, 760)에 보이는 바닥의 점이다.
  const FEET_D = 2015 * 540 / 220, FEET = new THREE.Vector3(430 * FEET_D / camD, -536, Z(5) + camD - FEET_D);
  const FR = new THREE.Vector3(-1500, -536, FEET.z - 1800);
  const F_R = FR.distanceTo(FEET) - 160;
  const fRingMat = new THREE.MeshBasicMaterial({ color: GOLD.clone().multiplyScalar(1.4), transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
  const fRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.0042, 8, 320), fRingMat); fRing.rotation.x = -Math.PI / 2; fRing.position.copy(FR); scene.add(fRing);
  const fWash = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), softGlow(GOLD.clone().multiplyScalar(0.6), 0)); fWash.rotation.x = -Math.PI / 2; fWash.position.copy(FR).setY(-537); scene.add(fWash);
  let fRingA = 0; track(35, 37, (a) => { fRingA = a; }, { delay: 0.2 });
  // 52-0 · 30년 눈금. 52-1 · 눈금에서 기록(금빛)이 올라와 뇌 바깥에 모인다. 52-2 · 그 기록이 뇌 안으로 들어가 남는다.
  const R = LAYOUT.ruler, ticks: [number, number][][] = [[[R.x0, R.y], [R.x1, R.y]]];
  for (let i = 0; i <= 30; i++) { const x = R.x0 + (R.x1 - R.x0) * i / 30, big = i % 10 === 0; ticks.push([[x, R.y], [x, R.y - (big ? 26 : 11)]]); }
  inkOn(screenInk(ticks, 5, CHALK, { width: 1.1, sketch: 0, seed: 101 }), 38, 40, { dur: 1.0 });
  const tickSrc = Array.from({ length: 31 }, (_, i) => at(R.x0 + (R.x1 - R.x0) * i / 30, R.y - 14, 5));
  const cloud = (() => { const r = rand(103), c = at(LAYOUT.records.x, LAYOUT.records.y, 5); return Array.from({ length: 400 }, () => { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 78; return c.clone().add(new THREE.Vector3(Math.cos(a) * d, Math.sin(a) * d * 0.7, (r() - .5) * 60)); }); })();
  const flowRec = add(new Flow(tickSrc, cloud, 1100, 104, camD, GOLD));
  const flowInto = add(new Flow(cloud, brainF.interior, 1100, 105, camD, GOLD));
  let recA = 0, intoA = 0; track(39, 39, (a) => { recA = a; }, { delay: 0.4 }); track(40, 42, (a) => { intoA = a; }, { delay: 0 });

  function update(dt: number) {
    pc.tick(dt);
    const p = pc.phase, t = pc.t, time = pc.clock;
    // 전시관 영상(방 -1)을 지나 돌아올 때는 날아가지 않고 그 방에 바로 선다
    const room = ROOM(p), prev = p > 0 ? ROOM(p - 1) : room, here = room < 0 ? 0 : room;
    const k = room !== prev && room >= 0 && prev >= 0 ? prev + (room - prev) * easeInOut(pc.ev(0, 1.8)) : here;
    const dolly = p === 3 ? easeInOut(pc.ev(0.1, 1.9)) : p === 4 || p === 5 ? 1 : p === 6 ? 1 - easeInOut(pc.ev(0, 1.3)) : 0;
    // 52-3 · 카메라가 뇌로 천천히 다가가고 52-4에서 그대로 머문다
    const push = p === 41 ? easeInOut(pc.ev(0.2, 3.2)) : p === 42 ? 1 : 0;
    camera.position.set(DOLLY.x * dolly + 250 * push, DOLLY.y * dolly + 40 * push, camD - k * STRIDE - DOLLY.z * dolly - 560 * push);
    // 고리가 화면 오른쪽(글 단 밖)에 오도록 고리보다 조금 왼쪽을 본다
    ahead.copy(camera.position).add(new THREE.Vector3(0, 0, -1000));
    aim.copy(RING_AT).add(new THREE.Vector3(-300, 40, 0));
    camera.lookAt(ahead.lerp(aim, dolly));
    floorMat.uniforms.uCamZ.value = camera.position.z;
    hazes.forEach((h) => { const dist = camera.position.z - h.position.z; glowA(h.material as THREE.Material, 0.26 * smooth(500, 1500, dist)); });
    dust.rotation.y = time * 0.002;
    pillarDim = p === 9 ? 1 - 0.55 * smooth(0.2, 1.2, t) : 1;
    for (const tr of tracks) { const [a, d] = vis(p, t, tr); tr.apply(a, d); }

    // 42 · 자리의 불은 하나씩 켜지고, 43에서 저녁 자리 둘만 남는다. 44에서는 빛 기둥 밑이 밝다.
    seatMat.uniforms.uOn.value = p === 0 ? t - 0.9 : 99; seatMat.uniforms.uTime.value = time;
    seatMat.uniforms.uFocus.value = p === 3 ? smooth(0.2, 1.3, t) : p > 3 ? 1 : 0;
    floorMat.uniforms.uSpot.value.set(LAYOUT.answers[1] - 960, Z(0) - 320, 900, p >= 6 && p <= 9 ? 0.5 * (p === 6 ? smooth(0.3, 1.6, t) : 1) * pillarDim : 0);
    (floorRing.material as THREE.MeshBasicMaterial).opacity = floorRingA; floorRing.visible = floorRingA > 0.002;

    // 47 · 대화 기록은 한 번 훑을 때마다 한 줄씩 는다. 훑는 빛은 늘 맨 위에서 출발한다.
    const cyc = p === 26 ? Math.max(0, (t - 1.6) / 1.15) : 99, lines = Math.min(12, 4 + Math.floor(cyc)), u = cyc % 1;
    chatLines.forEach((l, j) => l.ink.set(chatA * (j < lines ? 1 : 0), j < lines - 1 || cyc > 20 ? 1 : clamp01(u * 3)));
    const lastY = chatLines[Math.max(0, lines - 1)].y;
    bar.position.copy(at(1290, CH.y0 + 20 + (lastY - CH.y0 - 20) * easeInOut(clamp01(u / 0.8)), 3));
    glowA(barMat, p === 26 && cyc < 20 && lines < 12 ? 0.55 * chatA * (1 - smooth(0.8, 1, u)) : 0);
    entries.forEach((e, j) => {
      const s = p === 27 ? t : 99;
      e.text.set(diaryA * smooth(e.at, e.at + 0.15, s), clamp01((s - e.at) / 0.35));
      e.stamp.set(diaryA * smooth(e.at, e.at + 0.15, s), clamp01((s - e.at) / 0.2));
      const next = entries[j + 1]?.at ?? 1e9;
      e.strike.set(diaryA * smooth(next, next + 0.1, s), clamp01((s - next) / 0.22));
    });
    brainD.set(brainDA, 1, time);
    flowRead.set(readA, p === 28 ? t - 0.6 : 99, time, true);
    flowKeep.set(keepA, p === 29 ? t - 0.5 : 99, time, false, 2.6);

    // 48 · 손이 바늘에 닿는 순간 반사처럼 빠진다
    const down = p === 30 ? easeInOut(pc.ev(1.3, 0.75)) : 1, jerk = p === 30 ? easeOut(pc.ev(2.08, 0.22)) : 1;
    hand.group.position.copy(at(1170, 330 + 112 * down - 96 * jerk, 4));
    glowA(spark.material as THREE.Material, p === 30 ? handA * 0.9 * (smooth(2.0, 2.08, t) - smooth(2.15, 2.6, t)) : 0);
    const grim = p === 31 ? smooth(1.4, 1.8, t) : 1;
    calm.set(faceA * (1 - grim), p === 31 ? clamp01((t - 0.9) / 0.6) : 1); pain.set(faceA * grim, 1);
    // 48-2 · 비어 있던 아픔과 기억 칸이 채워지는 중이다(깜박이는 반 칸)
    brainE.set(brainEA, 1, time);
    if (p === 32 || p === 33) column.forEach((lamp, row) => { lamp.mat.uniforms.uFill.value = (p === 33 ? 0.55 : 0.3) + 0.2 * Math.sin(time * 2.2 + row * 1.7) * (p === 32 ? smooth(1.4, 2.2, t) : 1); });

    // 51 · 낱말이 다시 뇌가 되고, 바닥의 원이 그 발밑 쪽으로 넓어지다 멈춘다(51-3에서는 가장자리가 숨 쉬듯 밝아졌다 흐려진다)
    const rr = p === 35 ? 700 + (F_R - 700) * easeInOut(pc.ev(0.3, 2.4)) : p > 35 ? F_R : 700;
    fRing.scale.setScalar(rr); fWash.scale.set(rr, rr, 1);
    fRingMat.opacity = fRingA * (p === 37 ? 0.7 + 0.3 * Math.sin(time * 2.6) : 1); fRing.visible = fRingA > 0.002;
    glowA(fWash.material as THREE.Material, 0.22 * fRingA); fWash.visible = fRing.visible;
    // 52 · 기록은 뇌 밖에 모였다가(52-1) 안으로 들어가 남는다(52-2~). 52-4에서는 모두 조금 흐려진다.
    brainF.set(brainFA * (p === 42 ? 1 - 0.35 * smooth(0.3, 2.0, t) : 1), p === 34 ? brainFF : 1, time);
    flowRec.set(recA, p === 39 ? t - 0.5 : 99, time, false, 1.8);
    flowInto.set(intoA * (p === 42 ? 1 - 0.35 * smooth(0.3, 2.0, t) : 1), p === 40 ? t - 0.1 : 99, time, false, 2.2);
  }
  stage.start(update, () => pc.motion);

  return {
    setPhase(next) { next = Math.max(0, Math.min(PHASES - 1, next)); if (next === pc.phase) return; pc.go(next); stage.kick(); },
    setMotion(on) { pc.setMotion(on); stage.kick(); },
    onFrame: stage.onFrame,
    dispose: stage.dispose,
  };
}

