import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { GLSL_SAFE, rand } from "../stage3d/runtime";

/*
 * 42~49번이 쓰는 손그림 선. SVG 경로(뷰박스 좌표, 아래가 +y)를 일정한 간격의 점으로 풀고, 그 점을 따라 띠를 세운다.
 * 띠의 폭은 셰이더에서 벌리므로, 그림을 키우거나 줄여도 화면에서 선의 굵기가 같다(uWS = 1 / 그림의 배율).
 * 선은 경로 순서대로 한 붓으로 그려지고(uDraw 0 → 1), 펜 끝이 잠깐 밝다. 한 줄을 조금 비켜 한 번 더 그어 손으로 그린 느낌을 낸다.
 * 카메라 쪽으로 너무 가까워진 선과 먼 선은 흐려진다(장 사이를 날아 지나갈 때).
 */

const loader = new SVGLoader();

/** 점 사이 간격이 일정하도록 다시 고른다. */
function resample(pts: THREE.Vector2[], spacing: number) {
  if (pts.length < 2) return pts;
  const out = [pts[0].clone()];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], len = a.distanceTo(b);
    let d = spacing - carry;
    while (d <= len) { out.push(a.clone().lerp(b, d / len)); d += spacing; }
    carry = len - (d - spacing);
  }
  const last = pts[pts.length - 1];
  if (out[out.length - 1].distanceTo(last) > spacing * 0.3) out.push(last.clone());
  return out;
}

/** SVG path d 목록 → 폴리라인 목록(뷰박스 좌표). */
export function svgPolys(paths: string[], spacing = 3): THREE.Vector2[][] {
  const out: THREE.Vector2[][] = [];
  for (const d of paths) {
    const data = loader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`);
    for (const path of data.paths) for (const sub of path.subPaths) {
      const pts = resample(sub.getPoints(28), spacing);
      if (pts.length > 1) out.push(pts);
    }
  }
  return out;
}

/** 뷰박스 좌표 → 그림 중심 기준 로컬 좌표(위가 +y). */
export function centered(polys: THREE.Vector2[][], vw: number, vh: number): THREE.Vector3[][] {
  return polys.map((p) => p.map((v) => new THREE.Vector3(v.x - vw / 2, vh / 2 - v.y, 0)));
}

export type InkOpts = { color: THREE.Color; width?: number; up?: THREE.Vector3; sketch?: number; seed?: number; fog?: number };

/** 폴리라인(로컬 3D 좌표) → 띠 메시 */
export class Ink {
  group = new THREE.Group();
  mat: THREE.ShaderMaterial;
  constructor(polys: THREE.Vector3[][], o: InkOpts) {
    const up = o.up ?? new THREE.Vector3(0, 0, 1), r = rand(o.seed ?? 11), sketch = o.sketch ?? 0.42;
    const pos: number[] = [], nrm: number[] = [], side: number[] = [], prog: number[] = [], bright: number[] = [], idx: number[] = [];
    let total = 0;
    const lens = polys.map((p) => { let s = 0; for (let i = 1; i < p.length; i++) s += p[i].distanceTo(p[i - 1]); total += s; return s; });
    const t = new THREE.Vector3(), n = new THREE.Vector3(), q = new THREE.Vector3();
    const strip = (p: THREE.Vector3[], base: number, b: number, wobble: number, phase: number) => {
      const start = pos.length / 3;
      let acc = 0;
      for (let i = 0; i < p.length; i++) {
        if (i) acc += p[i].distanceTo(p[i - 1]);
        t.subVectors(p[Math.min(p.length - 1, i + 1)], p[Math.max(0, i - 1)]).normalize();
        n.crossVectors(t, up); if (n.lengthSq() < 1e-6) n.set(0, 1, 0); n.normalize();
        // 손그림 겹선: 선을 따라 천천히 바뀌는 만큼 옆으로 비킨다
        q.copy(p[i]).addScaledVector(n, wobble * Math.sin(acc * 0.021 + phase) + wobble * 0.5 * Math.sin(acc * 0.057 + phase * 2.3));
        const g = (base + acc) / total;
        for (const s of [-1, 1]) { pos.push(q.x, q.y, q.z); nrm.push(n.x, n.y, n.z); side.push(s); prog.push(g); bright.push(b); }
        if (i) { const k = start + i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
      }
    };
    let base = 0;
    polys.forEach((p, i) => {
      strip(p, base, 1, 0, 0);
      if (sketch > 0) strip(p, base, sketch, 1.6, r() * 20);
      base += lens[i];
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("aN", new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
    geo.setAttribute("aProg", new THREE.Float32BufferAttribute(prog, 1));
    geo.setAttribute("aB", new THREE.Float32BufferAttribute(bright, 1));
    geo.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uC: { value: o.color.clone() }, uA: { value: 0 }, uDraw: { value: 0 }, uW: { value: o.width ?? 1.35 }, uWS: { value: 1 }, uFog: { value: o.fog ?? 0.00036 } },
      vertexShader: `${GLSL_SAFE}
        attribute vec3 aN; attribute float aSide, aProg, aB;
        uniform float uW, uWS, uFog; varying float vSide, vProg, vB, vF;
        void main(){
          vec3 p = position + aN * aSide * uW * uWS;
          vec4 mv = modelViewMatrix * vec4(p, 1.);
          float z = -mv.z;
          vF = exp(-pw(uFog * max(z - 1900., 0.), 2.)) * sstep(120., 760., z);
          vSide = aSide; vProg = aProg; vB = aB;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `${GLSL_SAFE}
        uniform vec3 uC; uniform float uA, uDraw; varying float vSide, vProg, vB, vF;
        void main(){
          float on = step(vProg, uDraw);
          float e = 1. - sstep(.2, 1., abs(vSide));
          float tip = exp(-pw((uDraw - vProg) * 90., 2.)) * on * (1. - step(.999, uDraw));
          gl_FragColor = vec4(uC * e * vB * uA * vF * on * (1. + 2.2 * tip), 1.);
        }`,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, this.mat); mesh.frustumCulled = false;
    this.group.add(mesh);
  }
  set(a: number, draw = 1) { this.mat.uniforms.uA.value = a; this.mat.uniforms.uDraw.value = draw; this.group.visible = a > 0.002 && draw > 0.0005; }
  scaleTo(s: number) { this.group.scale.setScalar(s); this.mat.uniforms.uWS.value = 1 / s; }
}

/** SVG 그림 하나를 만들어 화면 좌표(px)의 중심에 둔다. */
export function drawing(paths: string[], vw: number, vh: number, o: InkOpts & { scale?: number }) {
  const ink = new Ink(centered(svgPolys(paths), vw, vh), o);
  ink.scaleTo(o.scale ?? 1);
  return ink;
}
