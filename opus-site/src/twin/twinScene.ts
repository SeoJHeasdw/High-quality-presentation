import * as THREE from "three";
import P from "./tower.json";

/*
 * 디지털 트윈: 영상 속 타워를 같은 제원(tower.json)으로 실시간 선 모델로 다시 짓는다.
 * 스크롤이 단면(수평 절단면)을 위에서 아래로 내리고, 절단면 아래는 밝게, 위는 옅게 그린다.
 * 절단된 층에는 해치로 채운 평면과 스캔 고리를 그린다. 캔버스는 불투명하게 그려
 * Safari에서 가산 혼합의 알파가 사라지는 문제를 피한다.
 */
export const TOP = P.PL + (P.NF + P.CROWN) * P.FH;
export const floorScale = (k: number) => 1 - P.TAPER * Math.pow(Math.min(1, Math.max(0, k / (P.NF - 1))), 1.25);
export const floorRot = (k: number) => (P.TWIST * k * Math.PI) / 180;

export function squircle(n = P.M, e = P.SQN) {
  const K = 4000, dense: THREE.Vector2[] = [];
  for (let i = 0; i <= K; i++) {
    const t = -Math.PI / 2 + (i / K) * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t);
    dense.push(new THREE.Vector2(Math.sign(c) * Math.pow(Math.abs(c), 2 / e), Math.sign(s) * Math.pow(Math.abs(s), 2 / e)));
  }
  const acc = [0];
  for (let i = 1; i < dense.length; i++) acc.push(acc[i - 1] + dense[i].distanceTo(dense[i - 1]));
  const total = acc[acc.length - 1], pts: THREE.Vector2[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const target = (total * i) / n;
    while (acc[j + 1] < target) j++;
    const t = (target - acc[j]) / Math.max(1e-9, acc[j + 1] - acc[j]);
    pts.push(dense[j].clone().lerp(dense[j + 1], t));
  }
  return pts;
}

/** 초타원 한 층의 바닥 면적(m²): 다각형 면적. */
export const BASE_AREA = (() => {
  const pts = squircle(720);
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; }
  return Math.abs(a / 2) * P.HALF * P.HALF;
})();

const BASE = squircle();
const CYAN = new THREE.Color("#7fd4ff");
const LIT = new THREE.Color("#ffb36b");
const RED = new THREE.Color("#ff5a4a");
const BG = new THREE.Color("#07090c");

/** 블렌더 좌표(x, y, z-위) → three 좌표(x, z-위, -y). */
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, z, -y);

function ringAt(k: number, scaleOverride?: number) {
  const s = (scaleOverride ?? floorScale(k)) * P.HALF, r = floorRot(Math.min(k, P.NF + P.CROWN));
  const c = Math.cos(r), sn = Math.sin(r);
  return BASE.map((p) => new THREE.Vector2(p.x * s * c - p.y * s * sn, p.x * s * sn + p.y * s * c));
}

type Layer = "structure" | "envelope" | "services";

export class TwinScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(28, 1, 1, 4000);
  private below = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  private above = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private groups: Record<Layer, THREE.Group> = { structure: new THREE.Group(), envelope: new THREE.Group(), services: new THREE.Group() };
  private cap = new THREE.Group();
  private capFixed = new THREE.Group();
  private capMat: THREE.ShaderMaterial;
  private scanRing: THREE.LineLoop;
  private clashes: THREE.Points;
  private clashFloors: number[] = [];
  private disposables: { dispose(): void }[] = [];
  private az = -0.9;
  private azVel = 0;
  private dragOffset = 0;
  private targetY = 110;
  cut = TOP;
  floor = P.NF - 1;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setClearColor(BG, 1);
    this.renderer.localClippingEnabled = true;
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.scene.fog = new THREE.Fog(BG, 420, 900);
    Object.values(this.groups).forEach((g) => this.scene.add(g));

    this.capMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uColor: { value: CYAN.clone() }, uTime: { value: 0 } },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uTime; varying vec3 vW;
        void main(){ float d = (vW.x + vW.z) * .55; float h = abs(fract(d) - .5); float line = smoothstep(.09, .02, h);
        gl_FragColor = vec4(uColor, .05 + line * .32); }`,
    });
    this.build();
    this.scanRing = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(BASE.map((p) => new THREE.Vector3(p.x * P.HALF, 0, -p.y * P.HALF))),
      new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 1 }));
    this.cap.add(this.scanRing);
    this.scene.add(this.cap, this.capFixed);
    this.clashes = this.buildClashes();
    this.groups.services.add(this.clashes);
  }

  private own<T extends { dispose(): void }>(x: T) { this.disposables.push(x); return x; }

  /** 같은 형상을 절단면 아래(밝게)·위(옅게) 두 번 그린다. */
  private twice(geo: THREE.BufferGeometry, color: THREE.Color, lo: number, hi: number, kind: "line" | "mesh", group: THREE.Group) {
    this.own(geo);
    const mk = (opacity: number, plane: THREE.Plane) => {
      const m = kind === "line"
        ? new THREE.LineBasicMaterial({ color, transparent: true, opacity, clippingPlanes: [plane], depthWrite: false })
        : new THREE.MeshBasicMaterial({ color, transparent: true, opacity, clippingPlanes: [plane], depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      this.own(m);
      const o = kind === "line" ? new THREE.LineSegments(geo, m) : new THREE.Mesh(geo, m);
      o.frustumCulled = false;
      group.add(o);
    };
    mk(hi, this.below);
    mk(lo, this.above);
  }

  private build() {
    const zk = (k: number) => P.PL + k * P.FH;
    // 슬래브 외곽
    const slab: number[] = [];
    for (let k = 0; k <= P.NF; k++) {
      const ring = ringAt(Math.min(k, P.NF - 1)), y = zk(k);
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        slab.push(a.x, y, -a.y, b.x, y, -b.y);
      }
    }
    this.twice(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(slab, 3)), CYAN, .1, .85, "line", this.groups.structure);
    // 코어와 기둥
    const core: number[] = [];
    const C = P.CORE, top = zk(P.NF + 2);
    for (const [x, y] of [[-C, -C], [C, -C], [C, C], [-C, C]]) core.push(x, 0, -y, x, top, -y);
    for (let k = 0; k <= P.NF + 2; k += 2) {
      const y = zk(k);
      core.push(-C, y, C, C, y, C, C, y, C, C, y, -C, C, y, -C, -C, y, -C, -C, y, -C, -C, y, C);
    }
    for (let i = 0; i < P.NCOL; i++) {
      const a = (Math.PI * 2 * (i + .5)) / P.NCOL, x = P.COLR * Math.cos(a), y = P.COLR * Math.sin(a);
      core.push(x, zk(0), -y, x, zk(P.NF), -y);
    }
    this.twice(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(core, 3)), CYAN, .08, .55, "line", this.groups.structure);
    // 외피: 핀(4칸마다)과 유리 볼륨
    const fins: number[] = [], glass: number[] = [];
    for (let k = 0; k < P.NF + P.CROWN; k++) {
      const crown = k >= P.NF;
      const ring = ringAt(k, crown ? floorScale(P.NF - 1) * (1 - .055 * (k - P.NF + 1)) : undefined), y0 = zk(k), y1 = zk(k + 1);
      for (let i = 0; i < ring.length; i += crown ? 2 : 4) fins.push(ring[i].x, y0, -ring[i].y, ring[i].x, y1, -ring[i].y);
      if (crown) continue;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        glass.push(a.x, y0, -a.y, b.x, y0, -b.y, b.x, y1, -b.y, a.x, y0, -a.y, b.x, y1, -b.y, a.x, y1, -a.y);
      }
    }
    this.twice(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(fins, 3)), CYAN, .05, .32, "line", this.groups.envelope);
    this.twice(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(glass, 3)), CYAN, .006, .035, "mesh", this.groups.envelope);
    // 설비: 코어 안 수직 샤프트와 층마다의 덕트 고리
    const mep: number[] = [];
    for (const [x, y] of [[-4.5, -4.5], [4.5, -4.5], [4.5, 4.5], [-4.5, 4.5]]) mep.push(x, 0, -y, x, zk(P.NF), -y);
    for (let k = 1; k < P.NF; k++) {
      const ring = ringAt(k).map((p) => p.clone().multiplyScalar(.62)), y = zk(k) + P.FH - .9;
      for (let i = 0; i < ring.length; i += 2) { const a = ring[i], b = ring[(i + 2) % ring.length]; mep.push(a.x, y, -a.y, b.x, y, -b.y); }
    }
    this.twice(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(mep, 3)), LIT, .03, .28, "line", this.groups.services);
    // 대지: 영상의 평면선과 같은 격자, 경계, 축 기호
    const ground: number[] = [];
    const rect = (x0: number, y0: number, x1: number, y1: number) => ground.push(x0, 0, -y0, x1, 0, -y0, x1, 0, -y0, x1, 0, -y1, x1, 0, -y1, x0, 0, -y1, x0, 0, -y1, x0, 0, -y0);
    rect(-62, -52, 62, 58);
    for (const g of [-24, -12, 0, 12, 24]) { ground.push(g, 0, 40, g, 0, -40); ground.push(-40, 0, -g, 40, 0, -g); }
    const circle = (cx: number, cy: number, r: number) => { for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2, b = ((i + 1) / 32) * Math.PI * 2; ground.push(cx + r * Math.cos(a), 0, -(cy + r * Math.sin(a)), cx + r * Math.cos(b), 0, -(cy + r * Math.sin(b))); } };
    for (const g of [-24, -12, 0, 12, 24]) { circle(g, -42.4, 1.9); circle(-42.4, g, 1.9); }
    const gg = this.own(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(ground, 3)));
    const gm = this.own(new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: .35 }));
    this.scene.add(new THREE.LineSegments(gg, gm));
    const far: number[] = [];
    for (let i = -300; i <= 300; i += 20) { far.push(i, -.01, -300, i, -.01, 300, -300, -.01, i, 300, -.01, i); }
    const fg = this.own(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(far, 3)));
    this.scene.add(new THREE.LineSegments(fg, this.own(new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: .06 }))));
    // 절단면의 해치 평면과 코어
    const shape = new THREE.Shape(BASE.map((p) => new THREE.Vector2(p.x * P.HALF, p.y * P.HALF)));
    const capGeo = this.own(new THREE.ShapeGeometry(shape));
    capGeo.rotateX(-Math.PI / 2);
    this.cap.add(new THREE.Mesh(capGeo, this.capMat));
    this.own(this.capMat);
    // 코어와 기둥은 층과 함께 돌지 않는다: 회전하지 않는 묶음에 둔다
    const coreFill = this.own(new THREE.PlaneGeometry(2 * C, 2 * C));
    coreFill.rotateX(-Math.PI / 2);
    const fill = new THREE.Mesh(coreFill, this.own(new THREE.MeshBasicMaterial({ color: BG, side: THREE.DoubleSide, depthWrite: false })));
    fill.position.y = .02;
    this.capFixed.add(fill);
    const coreGeo = this.own(new THREE.BufferGeometry().setFromPoints([v3(-C, -C, .03), v3(C, -C, .03), v3(C, C, .03), v3(-C, C, .03)]));
    this.capFixed.add(new THREE.LineLoop(coreGeo, this.own(new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: .9 }))));
    const colGeo: number[] = [];
    for (let i = 0; i < P.NCOL; i++) {
      const a = (Math.PI * 2 * (i + .5)) / P.NCOL, x = P.COLR * Math.cos(a), y = P.COLR * Math.sin(a), h = .6;
      colGeo.push(x - h, .03, -(y - h), x + h, .03, -(y - h), x + h, .03, -(y - h), x + h, .03, -(y + h), x + h, .03, -(y + h), x - h, .03, -(y + h), x - h, .03, -(y + h), x - h, .03, -(y - h));
    }
    this.capFixed.add(new THREE.LineSegments(this.own(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(colGeo, 3))),
      this.own(new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: .9 }))));
  }

  private buildClashes() {
    const pos: number[] = [], col: number[] = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let n = 0; n < 220; n++) {
      const k = Math.floor(rnd() * (P.NF - 1)) + 1;
      const a = rnd() * Math.PI * 2, r = P.CORE + 1.5 + rnd() * (P.HALF * floorScale(k) - P.CORE - 3);
      const y = P.PL + k * P.FH + P.FH - .9 - rnd() * .8;
      pos.push(r * Math.cos(a), y, -r * Math.sin(a));
      col.push(RED.r, RED.g, RED.b);
      this.clashFloors.push(k);
    }
    const g = this.own(new THREE.BufferGeometry());
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    const m = this.own(new THREE.PointsMaterial({ size: 3.2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: .95, depthWrite: false }));
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    return p;
  }

  /** 0(꼭대기)~1(바닥). 반환: 절단된 층, 해결된 간섭 비율. */
  setCut(p: number) {
    const y = TOP + 1 - p * (TOP + 1 - (P.PL + P.FH * .45));
    this.cut = y;
    this.below.constant = y;
    this.above.constant = -y;
    const k = Math.max(0, Math.min(P.NF - 1, Math.floor((y - P.PL) / P.FH)));
    this.floor = k;
    const inTower = y < P.PL + P.NF * P.FH;
    this.cap.visible = this.capFixed.visible = inTower;
    this.cap.position.y = this.capFixed.position.y = y;
    this.cap.rotation.y = floorRot(k);
    const s = floorScale(k);
    this.cap.scale.set(s, 1, s);
    // 38층부터 호텔·전망대: 영상에서 따뜻한 빛으로 켜지는 층은 해치도 호박색
    (this.capMat.uniforms.uColor.value as THREE.Color).copy(k + 1 > 37 ? LIT : CYAN);
    const colors = this.clashes.geometry.getAttribute("color") as THREE.BufferAttribute;
    let resolved = 0;
    this.clashFloors.forEach((f, i) => {
      const done = f >= k;
      if (done) resolved++;
      const c = done ? CYAN : RED;
      colors.setXYZ(i, c.r, c.g, c.b);
    });
    colors.needsUpdate = true;
    return { floor: k, inTower, resolved: resolved / this.clashFloors.length };
  }

  setLayer(layer: Layer, on: boolean) { this.groups[layer].visible = on; if (layer === "services") this.clashes.visible = on; }

  drag(dx: number) { this.azVel += dx * .0006; }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 38 : 28;
    this.camera.updateProjectionMatrix();
  }

  render(dt: number, now: number, auto: boolean) {
    this.az += (auto ? dt * .06 : 0) + this.azVel;
    this.azVel *= .92;
    this.dragOffset *= .9;
    const want = Math.max(34, Math.min(190, this.cut * .9 + 6));
    this.targetY += (want - this.targetY) * Math.min(1, dt * 3);
    const wide = this.camera.aspect >= 1;
    const R = wide ? 400 : 520, pitch = .4 + (1 - this.cut / TOP) * .16;
    const tx = 0;
    const target = new THREE.Vector3(Math.cos(this.az + Math.PI / 2) * tx, this.targetY, -Math.sin(this.az + Math.PI / 2) * tx);
    this.camera.position.set(target.x + R * Math.cos(pitch) * Math.cos(this.az), this.targetY + R * Math.sin(pitch), target.z + R * Math.cos(pitch) * Math.sin(this.az));
    this.camera.lookAt(target);
    this.capMat.uniforms.uTime.value = now / 1000;
    (this.scanRing.material as THREE.LineBasicMaterial).opacity = .75 + .25 * Math.sin(now / 240);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose();
  }
}
