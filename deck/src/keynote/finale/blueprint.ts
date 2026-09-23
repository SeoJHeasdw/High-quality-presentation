import * as THREE from "three";
import { GLSL_SAFE, PhaseClock, clamp01, createStage, easeInOut, easeOut, fitShot, smooth, type Pose, type Shot } from "../stage3d/runtime";

/*
 * 43번 · 공장은 계속 늘어난다. 13번 집의 청사진 격자 위에서 방이 솟아오른다.
 *   0  지어진 방: TTS · ASSETS · MUSIC(개발 중), RICE와 Personal CIO(만듦). Agent OS와 복도는 점선(구상).
 *      RICE 방의 벽에는 실제 RICE 소개 영상이 소리 없이 재생된다.
 *   1  방과 방 사이로 빛이 흐르며 조합이 생긴다(가능성).
 *   2  "제가 사무직이었다면": 점선 방 네 개가 서고, 카메라가 물러나며 같은 복도에 점선 방이 지평선까지 이어진다.
 * 마무리 묶음(40~43)의 새벽 하늘(DOM, .fn-sky) 위에 투명하게 얹는다. 빛은 하늘에 더해지도록 알파를 쓰지 않는다.
 */

export const PHASES = 3;
const GOLD = new THREE.Color("#ffd49a");
const ICE = new THREE.Color("#9fd6ff");
/** 알파를 건드리지 않고 색만 더한다(투명 캔버스 뒤의 하늘이 그대로 비친다). */
const ADD = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor } as const;

type Room = { id: RoomId; x: number; z: number; w: number; d: number; kind: "built" | "plan" | "office" | "far"; h?: number };
export type RoomId = "tts" | "assets" | "music" | "rice" | "cio" | "os" | "excel" | "browser" | "pdf" | "doc" | "door" | "comboStock" | "comboLecture";
/** 복도는 x축을 따라 오른쪽 뒤로 이어진다. 방은 복도 양쪽에 선다. */
const ROOMS: Room[] = [
  { id: "os", x: -2.4, z: 0, w: 3.6, d: 5.6, kind: "plan" },
  { id: "tts", x: 2.1, z: 2.5, w: 3, d: 2.6, kind: "built" },
  { id: "assets", x: 2.1, z: -2.5, w: 3, d: 2.6, kind: "built" },
  { id: "music", x: 5.8, z: 2.5, w: 3, d: 2.6, kind: "built" },
  { id: "rice", x: 5.8, z: -2.5, w: 3, d: 2.6, kind: "built", h: 2.0 },
  { id: "cio", x: 9.5, z: 2.5, w: 3, d: 2.6, kind: "built" },
  { id: "excel", x: 9.5, z: -2.5, w: 3, d: 2.6, kind: "office" },
  { id: "browser", x: 13.2, z: 2.5, w: 3, d: 2.6, kind: "office" },
  { id: "pdf", x: 13.2, z: -2.5, w: 3, d: 2.6, kind: "office" },
  { id: "doc", x: 16.9, z: 2.5, w: 3, d: 2.6, kind: "office" },
];
const FAR: Room[] = Array.from({ length: 26 }, (_, i) => ({ id: "doc" as RoomId, x: 16.9 + 3.7 * Math.floor((i + 1) / 2) + (i % 2 ? 0 : 0), z: i % 2 ? 2.5 : -2.5, w: 3, d: 2.6, kind: "far" as const })).slice(1);
const DOOR = new THREE.Vector3(-6.2, 0, 0);
// 사무직의 방은 라벨 높이를 엇갈려 겹치지 않게 한다
const OFFICE_Y: Partial<Record<RoomId, number>> = { excel: 2.5, pdf: 2.9, browser: 0.9, doc: 1.9 };
const top = (r: Room) => new THREE.Vector3(r.x, (r.kind === "built" ? r.h ?? 1.4 : r.kind === "office" ? OFFICE_Y[r.id] ?? 1.4 : 0.05) + 0.25, r.z);
const byId = (id: RoomId) => ROOMS.find((r) => r.id === id)!;
const corners = (r: Room, y = 0) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => new THREE.Vector3(r.x + sx * r.w / 2, y, r.z + sz * r.d / 2));
const COMBO_STOCK = new THREE.Vector3(6.2, 3.7, 0.6);
const COMBO_LECTURE = new THREE.Vector3(-0.4, 2.8, 4.6);
const built = () => ROOMS.filter((r) => r.kind !== "office").flatMap((r) => [...corners(r), ...corners(r, r.kind === "built" ? r.h ?? 1.4 : 0)]).concat([DOOR]);
const SHOTS: Shot[] = [
  { az: -34, el: 36, rect: [760, 250, 1830, 900], points: built },
  { az: -30, el: 38, rect: [760, 250, 1830, 900], points: () => [...built(), COMBO_STOCK, COMBO_LECTURE] },
  { az: -22, el: 17, rect: [560, 430, 1740, 960], points: () => ROOMS.flatMap((r) => corners(r)).concat([DOOR]) },
];

export const ANCHORS: Record<RoomId, THREE.Vector3> = {
  tts: new THREE.Vector3(), assets: new THREE.Vector3(), music: new THREE.Vector3(), rice: new THREE.Vector3(), cio: new THREE.Vector3(), os: new THREE.Vector3(),
  excel: new THREE.Vector3(), browser: new THREE.Vector3(), pdf: new THREE.Vector3(), doc: new THREE.Vector3(), door: new THREE.Vector3(), comboStock: new THREE.Vector3(), comboLecture: new THREE.Vector3(),
};

export type BlueprintWorld = { setPhase: (p: number) => void; setMotion: (on: boolean) => void; setPointer: (x: number, y: number) => void; project: (id: RoomId) => { x: number; y: number; visible: boolean }; labelAlpha: () => number; onFrame: (cb: () => void) => void; dispose: () => void };

export function createBlueprintWorld(canvas: HTMLCanvasElement, video: HTMLVideoElement, initialPhase: number, initialMotion: boolean): BlueprintWorld {
  const stage = createStage(canvas, { background: "#05070c", fov: 32, lostEvent: "blueprint-lost", transparent: true, exposure: 1.05 });
  const { scene, camera, glow } = stage;
  const pc = new PhaseClock(Math.max(0, Math.min(PHASES - 1, initialPhase)), initialMotion);
  const POSES: Pose[] = SHOTS.map((s) => fitShot(s, camera));
  const keep = <T extends { dispose: () => void }>(t: T) => { stage.keep(t); return t; };

  /* 청사진 격자: 13번 집의 평면선과 같은 파란 선 */
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.ShaderMaterial({
    uniforms: { uLit: { value: 0 }, uReach: { value: 0 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `${GLSL_SAFE}varying vec3 vW; uniform float uLit,uReach;
      float gridLine(vec2 p, float s, float w){ vec2 q=p/s; vec2 g=abs(fract(q-.5)-.5)/fwidth(q); return 1.-min(min(g.x,g.y)/w,1.); }
      void main(){ vec2 c=vW.xz-vec2(4.,0.); float r=length(c*vec2(.55,1.));
        float fade=1.-sstep(9.+uReach*40.,16.+uReach*70.,r);
        float g=gridLine(vW.xz,.5,1.)*.18+gridLine(vW.xz,2.,1.3)*.5;
        gl_FragColor=vec4(vec3(.36,.62,.86)*g*fade*uLit*.55,1.); }`,
    ...ADD,
  }));
  grid.rotation.x = -Math.PI / 2; scene.add(grid);
  const gridU = (grid.material as THREE.ShaderMaterial).uniforms;

  /* 복도: 점선이 오른쪽 뒤로 흐른다(연결은 아직 구상) */
  const dashMat = (color: THREE.Color, scale: number) => new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color.clone() }, uA: { value: 0 }, uTime: { value: 0 }, uScale: { value: scale }, uFade: { value: 60 } },
    vertexShader: `attribute float aDist; varying float vD; varying vec3 vW; void main(){ vD=aDist; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `${GLSL_SAFE}varying float vD; varying vec3 vW; uniform vec3 uColor; uniform float uA,uTime,uScale,uFade;
      void main(){ float d=step(.45,fract(vD*uScale-uTime*.6)); float f=1.-sstep(uFade*.6,uFade,vW.x); gl_FragColor=vec4(uColor*d*uA*f*1.3,1.); }`,
    ...ADD,
  });
  const dashedLine = (pts: THREE.Vector3[], mat: THREE.ShaderMaterial, closed = false) => {
    const all = closed ? [...pts, pts[0]] : pts;
    const g = new THREE.BufferGeometry().setFromPoints(all);
    const dist = new Float32Array(all.length); for (let i = 1; i < all.length; i++) dist[i] = dist[i - 1] + all[i].distanceTo(all[i - 1]);
    g.setAttribute("aDist", new THREE.BufferAttribute(dist, 1));
    const l = new THREE.Line(g, mat); scene.add(l); return l;
  };
  const corridorMat = dashMat(ICE, 2.2);
  dashedLine([DOOR.clone().setY(0.02), new THREE.Vector3(120, 0.02, 0)], corridorMat);
  // 방마다 복도에서 들어가는 짧은 점선
  [...ROOMS.filter((r) => r.kind !== "plan"), ...FAR].forEach((r) => dashedLine([new THREE.Vector3(r.x, 0.02, 0), new THREE.Vector3(r.x, 0.02, r.z - Math.sign(r.z) * r.d / 2)], corridorMat));

  /* 방 */
  type RoomObj = { r: Room; edge: THREE.LineBasicMaterial | THREE.ShaderMaterial; wall?: THREE.ShaderMaterial; g: THREE.Group; floor: THREE.MeshBasicMaterial };
  const rooms: RoomObj[] = [];
  const makeRoom = (r: Room) => {
    const g = new THREE.Group(); g.position.set(r.x, 0, r.z); scene.add(g);
    const floor = new THREE.MeshBasicMaterial({ color: (r.kind === "built" ? GOLD : ICE).clone().multiplyScalar(0.12), ...ADD, opacity: 1 });
    const f = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.d), floor); f.rotation.x = -Math.PI / 2; f.position.y = 0.01; g.add(f);
    if (r.kind === "built") {
      const h = r.h ?? 1.4;
      const wall = new THREE.ShaderMaterial({
        uniforms: { uA: { value: 0 }, uColor: { value: GOLD.clone() } },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
        fragmentShader: `${GLSL_SAFE}varying vec2 vUv; uniform float uA; uniform vec3 uColor; void main(){ float v=1.-vUv.y; gl_FragColor=vec4(uColor*(.05+.2*v*v)*uA,1.); }`,
        side: THREE.DoubleSide, ...ADD,
      });
      const box = new THREE.Mesh(new THREE.BoxGeometry(r.w, h, r.d), wall); box.position.y = h / 2; g.add(box);
      const edge = new THREE.LineBasicMaterial({ color: GOLD.clone().multiplyScalar(1.5), opacity: 1, ...ADD });
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(r.w, h, r.d)), edge); e.position.y = h / 2; g.add(e);
      rooms.push({ r, edge, wall, g, floor });
    } else {
      const edge = dashMat(r.kind === "plan" ? ICE : r.kind === "office" ? ICE.clone().lerp(GOLD, 0.25) : ICE, 3);
      const pts = corners(r, 0.03).map((v) => v.sub(new THREE.Vector3(r.x, 0, r.z)));
      const all = [...pts, pts[0]]; const geo = new THREE.BufferGeometry().setFromPoints(all);
      const dist = new Float32Array(all.length); for (let i = 1; i < all.length; i++) dist[i] = dist[i - 1] + all[i].distanceTo(all[i - 1]);
      geo.setAttribute("aDist", new THREE.BufferAttribute(dist, 1));
      g.add(new THREE.Line(geo, edge));
      // 사무직의 방은 점선 기둥으로 높이만 그려 둔다(가정)
      if (r.kind === "office") {
        const up = corners(r, 0).map((v) => v.sub(new THREE.Vector3(r.x, 0, r.z)));
        up.forEach((v) => { const ln = [v, v.clone().setY(1.4)]; const lg = new THREE.BufferGeometry().setFromPoints(ln); lg.setAttribute("aDist", new THREE.BufferAttribute(new Float32Array([0, 1.4]), 1)); g.add(new THREE.Line(lg, edge)); });
        const roof = [...up.map((v) => v.clone().setY(1.4)), up[0].clone().setY(1.4)]; const rg = new THREE.BufferGeometry().setFromPoints(roof);
        const rd = new Float32Array(roof.length); for (let i = 1; i < roof.length; i++) rd[i] = rd[i - 1] + roof[i].distanceTo(roof[i - 1]); rg.setAttribute("aDist", new THREE.BufferAttribute(rd, 1)); g.add(new THREE.Line(rg, edge));
      }
      rooms.push({ r, edge, g, floor });
    }
  };
  ROOMS.forEach(makeRoom); FAR.forEach(makeRoom);

  /* RICE 방의 벽: 실제 소개 영상(소리 없음) */
  const videoTex = keep(new THREE.VideoTexture(video)); videoTex.colorSpace = THREE.SRGBColorSpace;
  const rice = byId("rice"), riceH = rice.h ?? 2.0;
  const screenW = rice.w * 0.92, screenH = screenW * 9 / 16;
  const screenMat = new THREE.MeshBasicMaterial({ map: videoTex, transparent: true, opacity: 0, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH), screenMat);
  // 카메라 쪽(+z, -x)을 보도록 방의 안쪽 벽에 세운다
  screen.position.set(rice.x, Math.min(riceH - 0.1, screenH / 2 + 0.25), rice.z - rice.d / 2 + 0.05); scene.add(screen);
  const screenGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color("#6fb6e6"), opacity: 0, ...ADD })); screenGlow.scale.set(screenW * 2.2, screenH * 2.6, 1); screenGlow.position.copy(screen.position).add(new THREE.Vector3(0, 0, -0.1)); scene.add(screenGlow);

  /* 현관: 저 */
  const door = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: GOLD.clone().multiplyScalar(1.6), opacity: 1, ...ADD })); door.scale.setScalar(1.3); door.position.copy(DOOR).setY(0.25); scene.add(door);

  /* 1 · 조합: 방과 방 사이의 빛 */
  const arc = (a: THREE.Vector3, b: THREE.Vector3, lift: number) => new THREE.QuadraticBezierCurve3(a, a.clone().lerp(b, 0.5).setY(Math.max(a.y, b.y) + lift), b);
  const combos = [
    { curve: arc(top(byId("tts")), COMBO_STOCK, 1.6), color: GOLD },
    { curve: arc(top(byId("assets")), COMBO_STOCK, 2.2), color: GOLD },
    { curve: arc(top(byId("cio")), COMBO_STOCK, 0.8), color: GOLD },
    { curve: arc(top(byId("tts")), COMBO_LECTURE, 0.9), color: GOLD },
  ].map((c, i) => {
    const pts = c.curve.getPoints(80), g = new THREE.BufferGeometry().setFromPoints(pts);
    const dist = new Float32Array(pts.length); for (let k = 1; k < pts.length; k++) dist[k] = dist[k - 1] + pts[k].distanceTo(pts[k - 1]);
    g.setAttribute("aDist", new THREE.BufferAttribute(dist, 1));
    const mat = dashMat(c.color.clone().multiplyScalar(1.5), 3.6); const line = new THREE.Line(g, mat); scene.add(line);
    const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: c.color.clone().multiplyScalar(2), opacity: 0, ...ADD })); spark.scale.setScalar(0.7); scene.add(spark);
    return { ...c, mat, spark, i };
  });
  const knot = (at: THREE.Vector3, s: number) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: GOLD.clone().multiplyScalar(1.8), opacity: 0, ...ADD })); sp.scale.setScalar(s); sp.position.copy(at); scene.add(sp); return sp.material; };
  const stockKnot = knot(COMBO_STOCK, 1.6), lectureKnot = knot(COMBO_LECTURE, 1.1);

  /* 상태 */
  const cam = { from: new THREE.Vector3(), fromLook: new THREE.Vector3(), eye: new THREE.Vector3(...POSES[pc.phase].eye), look: new THREE.Vector3(...POSES[pc.phase].look), t0: -1e6, dur: 2.4 };
  if (pc.motion) { cam.from.set(...POSES[pc.phase].eye).multiplyScalar(1.08); cam.fromLook.set(...POSES[pc.phase].look); cam.t0 = 0; cam.dur = 2.6; }
  const eyeNow = new THREE.Vector3(), lookNow = new THREE.Vector3(...POSES[pc.phase].look);
  const pointerS = new THREE.Vector2();
  const S: Record<string, number> = {};
  const follow = (k: string, target: number, dt: number, rate = 3) => { if (S[k] === undefined || !pc.motion) return (S[k] = target); return (S[k] += (target - S[k]) * (1 - Math.exp(-dt * rate))); };
  const order = (r: Room) => (r.kind === "plan" ? 0.6 : r.kind === "built" ? ["tts", "assets", "music", "rice", "cio"].indexOf(r.id) * 0.28 : 0);

  function update(dt: number) {
    pc.tick(dt);
    const p = pc.phase, t = pc.t, time = pc.clock, ev = (s: number, d: number) => pc.ev(s, d);
    const k = pc.motion ? easeInOut(clamp01((time - cam.t0) / cam.dur)) : 1;
    eyeNow.lerpVectors(cam.from, cam.eye, k); lookNow.lerpVectors(cam.fromLook, cam.look, k);
    if (pc.motion) { pointerS.lerp(stage.pointer, 1 - Math.exp(-dt * 2)); eyeNow.x += Math.sin(time * 0.15) * 0.25 + pointerS.x * 0.6; eyeNow.y += Math.sin(time * 0.19) * 0.1 - pointerS.y * 0.3; }
    camera.position.copy(eyeNow); camera.lookAt(lookNow);

    // 첫 단계: 격자가 깔리고 방이 차례로 솟는다
    const intro = pc.phase === 0 ? t : 1e3;
    gridU.uLit.value = smooth(0.1, 1.4, intro); gridU.uReach.value = follow("reach", p === 2 ? 1 : 0, dt, 0.9);
    corridorMat.uniforms.uA.value = 0.7 * smooth(1.0, 2.0, intro); corridorMat.uniforms.uTime.value = time;
    corridorMat.uniforms.uFade.value = follow("fade", p === 2 ? 110 : 22, dt, 0.8);
    rooms.forEach((o) => {
      const r = o.r;
      let a: number, rise = 1;
      if (r.kind === "built") { rise = easeOut(clamp01((intro - 1.2 - order(r)) / 1.1)); a = smooth(1.1 + order(r), 1.6 + order(r), intro); }
      else if (r.kind === "plan") a = smooth(1.8, 2.6, intro);
      else if (r.kind === "office") a = p === 2 ? smooth(0.6 + ["excel", "browser", "pdf", "doc"].indexOf(r.id) * 0.3, 1.3 + ["excel", "browser", "pdf", "doc"].indexOf(r.id) * 0.3, t) : 0;
      else { const d = r.x - 20; a = p === 2 ? smooth(1.8 + d * 0.04, 2.6 + d * 0.04, t) * (1 - smooth(40, 90, r.x)) : 0; }
      o.g.scale.y = Math.max(0.001, rise); o.g.visible = a > 0.001;
      if (o.wall) o.wall.uniforms.uA.value = a;
      if ("uniforms" in o.edge) { o.edge.uniforms.uA.value = a * (r.kind === "far" ? 0.55 : 0.9); o.edge.uniforms.uTime.value = time; }
      else o.edge.opacity = a;
      o.floor.opacity = a * (r.kind === "built" ? 1 : 0.6);
    });
    const vOn = smooth(2.6, 3.4, intro);
    screenMat.opacity = vOn * 0.92; (screenGlow.material as THREE.SpriteMaterial).opacity = vOn * 0.28;
    door.material.opacity = 0.6 + 0.4 * Math.sin(time * 1.8) * (pc.motion ? 1 : 0);

    // 1 · 조합의 빛
    combos.forEach((c) => {
      const on = p >= 1 ? (p === 1 ? smooth(0.4 + c.i * 0.35, 1.1 + c.i * 0.35, t) : 0.55) : 0;
      c.mat.uniforms.uA.value = on; c.mat.uniforms.uTime.value = time;
      const s = pc.motion ? (time * 0.35 + c.i * 0.27) % 1 : 0.6;
      c.spark.position.copy(c.curve.getPoint(s)); c.spark.material.opacity = on * (p === 1 ? 1 : 0.5);
    });
    stockKnot.opacity = p >= 1 ? (p === 1 ? smooth(1.4, 2.0, t) : 0.6) : 0;
    lectureKnot.opacity = p >= 1 ? (p === 1 ? smooth(1.6, 2.2, t) : 0.6) : 0;

    (Object.keys(ANCHORS) as RoomId[]).forEach((id) => {
      if (id === "door") ANCHORS.door.copy(DOOR).setY(0.4);
      else if (id === "comboStock") ANCHORS.comboStock.copy(COMBO_STOCK).setY(COMBO_STOCK.y + 0.35);
      else if (id === "comboLecture") ANCHORS.comboLecture.copy(COMBO_LECTURE).setY(COMBO_LECTURE.y + 0.3);
      else ANCHORS[id].copy(top(byId(id)));
    });
  }
  stage.start(update, () => pc.motion);

  return {
    setPhase(next) {
      next = Math.max(0, Math.min(PHASES - 1, next)); if (next === pc.phase) return;
      const forward = pc.go(next);
      cam.from.copy(camera.position); cam.fromLook.copy(lookNow); cam.eye.set(...POSES[next].eye); cam.look.set(...POSES[next].look); cam.t0 = pc.clock; cam.dur = forward ? (next === 2 ? 3.2 : 2.0) : 1.4;
      stage.kick();
    },
    setMotion(on) { pc.setMotion(on); if (!on) { cam.t0 = -1e6; cam.from.copy(cam.eye); cam.fromLook.copy(cam.look); } stage.kick(); },
    setPointer(x, y) { stage.pointer.set(x, y); },
    project: (id) => stage.project(ANCHORS[id]),
    labelAlpha() { if (!pc.motion) return 1; return smooth(0.6, 1, clamp01((pc.clock - cam.t0) / cam.dur)); },
    onFrame: stage.onFrame,
    dispose: stage.dispose,
  };
}

