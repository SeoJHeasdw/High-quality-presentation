import * as THREE from "three";
import { GLSL_SAFE, PhaseClock, clamp01, createStage, easeInOut, easeOut, fitShot, rand, smooth, type Pose, type Shot } from "../stage3d/runtime";

/*
 * 43번 · 방은 계속 늘어나고, 방이 늘수록 조합은 두 배 넘게 는다. 13번 집의 청사진 격자 위에서 방이 솟아오른다.
 *   0  지어진 방: TTS · ASSETS · MUSIC(개발 중), RICE와 Personal CIO(만듦). Agent OS와 복도는 점선(구상).
 *      RICE 방의 벽에는 실제 RICE 소개 영상이 소리 없이 재생된다.
 *   1  지어진 방 다섯 개의 모든 짝 사이로 빛이 이어진다(둘 이상을 잇는 조합 26가지).
 *      실제 예 두 가지(강의 채널 · 주식 분석)는 금색으로 따로 맺힌다(가능성).
 *   2  "제가 사무직이었다면": 사무직의 방 네 개가 하나씩 서고, 설 때마다 앞의 모든 방과 이어진다(9개 → 502가지).
 *   3  카메라가 물러나며 현관에서 뻗은 거리를 따라 방이 번져 간다(40개 → 약 1.1조 가지). 새 방은 앞의 방 둘과 이어진다.
 *   4  숫자만으로는 와닿지 않으니 방 하나(Personal CIO)에서 뻗는 갈래를 보인다: 금색 줄이 올라가 사례 세 개가 맺힌다(가능성).
 * 조합의 수 = 방 n개에서 둘 이상을 고르는 경우의 수 2ⁿ − n − 1. 숫자(DOM)는 화면에 선 방의 수를 그대로 따라간다.
 * 마무리 묶음(40~44)의 새벽 하늘(DOM, .fn-sky) 위에 투명하게 얹는다. 빛은 하늘에 더해진다(runtime의 transparent).
 */

export const PHASES = 5;
const GOLD = new THREE.Color("#ffd49a");
const ICE = new THREE.Color("#9fd6ff");
/** 알파를 건드리지 않고 색만 더한다(투명 캔버스 뒤의 하늘이 그대로 비친다). */
const ADD = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor } as const;

type Room = { id: RoomId; x: number; z: number; w: number; d: number; kind: "built" | "plan" | "office" | "field"; h?: number; born?: number };
export type RoomId = "tts" | "assets" | "music" | "rice" | "cio" | "os" | "excel" | "browser" | "pdf" | "doc" | "door" | "comboStock" | "comboLecture" | "caseCast" | "caseSell" | "caseData" | "field";
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
const DOOR = new THREE.Vector3(-6.2, 0, 0);
const OFFICE: RoomId[] = ["excel", "browser", "pdf", "doc"];
/** 2단계에서 사무직의 방이 서는 시각(초) */
const OFFICE_BORN = [0.6, 1.15, 1.7, 2.25];

/* 3 · 번져 가는 방. 현관(저)에서 뒤로 난 거리 두 개와 원래 복도의 빈자리에, 현관에서 가까운 자리부터 선다.
   방 40개(지은 5 + 사무직 4 + 새로 31)에서 멈춘다. 먼 모서리는 비워 둬 아직 번지는 중으로 보이게 한다. */
const STREETS = [0, -8.4, -16.8];
const FIELD_COUNT = 31;
const FIELD: Room[] = (() => {
  const taken = new Set(ROOMS.map((r) => `${r.x.toFixed(1)},${r.z.toFixed(1)}`));
  const slots: (Room & { path: number })[] = [];
  for (const s of STREETS) for (let k = 0; k < 8; k++) for (const side of [1, -1]) {
    const x = 2.1 + 3.7 * k, z = s + side * 2.5;
    if (taken.has(`${x.toFixed(1)},${z.toFixed(1)}`)) continue;
    slots.push({ id: "field", x, z, w: 3, d: 2.6, kind: "field", path: Math.abs(s) + (x - DOOR.x) + (side < 0 ? 0.3 : 0) });
  }
  slots.sort((a, b) => a.path - b.path);
  // 뒤로 갈수록 빨리 선다(가속). 카메라가 물러나는 동안 대부분이 선다.
  return slots.slice(0, FIELD_COUNT).map((r, i) => ({ ...r, born: 0.9 + 4.2 * Math.pow(i / (FIELD_COUNT - 1), 0.62) }));
})();

const top = (r: Room) => new THREE.Vector3(r.x, (r.kind === "built" ? r.h ?? 1.4 : r.kind === "office" ? 1.4 : 0.05) + 0.25, r.z);
const roof = (r: Room) => new THREE.Vector3(r.x, r.kind === "built" ? r.h ?? 1.4 : 1.4, r.z);
// 앞줄 사무직 방(브라우저)의 라벨은 방 앞 바닥에서 아래로 단다. 뒷줄 라벨과 화면에서 겹치지 않고, 라벨이 제 방에 붙어 보인다.
const BELOW: RoomId[] = ["browser"];
const front = (r: Room) => new THREE.Vector3(r.x, 0.02, r.z + r.d / 2);
const byId = (id: RoomId) => ROOMS.find((r) => r.id === id)!;
const corners = (r: Room, y = 0) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => new THREE.Vector3(r.x + sx * r.w / 2, y, r.z + sz * r.d / 2));
const COMBO_STOCK = new THREE.Vector3(6.2, 3.7, 0.6);
// 강의 채널의 빛점은 TTS 방 왼쪽 바깥에 둔다(왼쪽으로 펼치는 라벨이 TTS 방을 가리지 않게).
const COMBO_LECTURE = new THREE.Vector3(-1.4, 2.8, 4.6);
/* 4 · Personal CIO 방 하나에서 뻗는 갈래. 번진 방들 위의 빈 하늘에 맺힌다(라벨은 Blueprint3D). */
export const CASES: { id: "caseCast" | "caseSell" | "caseData"; at: THREE.Vector3; born: number }[] = [
  { id: "caseCast", at: new THREE.Vector3(4, 4.2, -10), born: 0.6 },
  { id: "caseSell", at: new THREE.Vector3(14, 4.2, -12), born: 1.3 },
  { id: "caseData", at: new THREE.Vector3(24, 4.2, -8), born: 2.0 },
];
const built = () => ROOMS.filter((r) => r.kind !== "office").flatMap((r) => [...corners(r), ...corners(r, r.kind === "built" ? r.h ?? 1.4 : 0)]).concat([DOOR]);
const SHOTS: Shot[] = [
  { az: -34, el: 36, rect: [760, 250, 1790, 900], points: built },
  { az: -30, el: 38, rect: [760, 250, 1830, 900], points: () => [...built(), COMBO_STOCK, COMBO_LECTURE] },
  // 왼쪽 단(제목 아래)은 조합의 수를 적는 자리라 비워 둔다
  { az: -24, el: 22, rect: [820, 430, 1790, 930], points: () => ROOMS.flatMap((r) => corners(r)).concat([DOOR]) },
  { az: -30, el: 44, rect: [820, 250, 1840, 930], points: () => [...ROOMS, ...FIELD].flatMap((r) => corners(r)).concat([DOOR]) },
];
SHOTS.push(SHOTS[3]); // 4단계는 같은 자리에서 사례만 맺힌다

/** 방 n개에서 둘 이상을 고르는 경우의 수. 방이 하나 늘면 2배 + n이 된다. */
export const combosOf = (n: number) => 2 ** n - n - 1;
export type Tally = { on: boolean; n: number; value: number };

export const ANCHORS: Record<Exclude<RoomId, "field">, THREE.Vector3> = {
  tts: new THREE.Vector3(), assets: new THREE.Vector3(), music: new THREE.Vector3(), rice: new THREE.Vector3(), cio: new THREE.Vector3(), os: new THREE.Vector3(),
  excel: new THREE.Vector3(), browser: new THREE.Vector3(), pdf: new THREE.Vector3(), doc: new THREE.Vector3(), door: new THREE.Vector3(), comboStock: new THREE.Vector3(), comboLecture: new THREE.Vector3(),
  caseCast: new THREE.Vector3(), caseSell: new THREE.Vector3(), caseData: new THREE.Vector3(),
};

export type BlueprintWorld = { setPhase: (p: number) => void; setMotion: (on: boolean) => void; setPointer: (x: number, y: number) => void; project: (id: Exclude<RoomId, "field">) => { x: number; y: number; visible: boolean }; labelAlpha: () => number; reveal: (id: Exclude<RoomId, "field">) => number; tally: () => Tally; onFrame: (cb: () => void) => void; dispose: () => void };

export function createBlueprintWorld(canvas: HTMLCanvasElement, video: HTMLVideoElement, initialPhase: number, initialMotion: boolean): BlueprintWorld {
  const stage = createStage(canvas, { background: "#05070c", fov: 32, lostEvent: "blueprint-lost", transparent: true, exposure: 1.05 });
  const { scene, camera, glow } = stage;
  const pc = new PhaseClock(Math.max(0, Math.min(PHASES - 1, initialPhase)), initialMotion);
  // 첫 단계가 아닌 곳으로 들어오는 건 44번에서 ←로 돌아올 때뿐이다. 그 단계의 마지막 상태(방 40개 · 1.1조)를 바로 보인다.
  const replay = pc.motion && pc.phase === 0;
  if (!replay) pc.enteredAt = -1e6;
  const POSES: Pose[] = SHOTS.map((s) => fitShot(s, camera));
  const keep = <T extends { dispose: () => void }>(t: T) => { stage.keep(t); return t; };

  /* 청사진 격자: 13번 집의 평면선과 같은 파란 선.
     화면 전체의 바닥이 아니라 방 둘레에 깔린 한 장의 판이다(뒤의 새벽 사진 하늘까지 덮지 않게).
     방이 늘면 판도 방을 따라 넓어진다. 화면에서 칸이 몇 px로 좁아지는 먼 곳은 선을 지워 지글거리지 않게 한다. */
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.ShaderMaterial({
    uniforms: { uLit: { value: 0 }, uC: { value: new THREE.Vector2(2.4, 0) }, uR: { value: new THREE.Vector2(12, 6.8) } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `${GLSL_SAFE}varying vec3 vW; uniform float uLit; uniform vec2 uC,uR;
      float gridLine(vec2 p, float s, float w){ vec2 q=p/s; vec2 fw=fwidth(q); vec2 g=abs(fract(q-.5)-.5)/fw; return (1.-min(min(g.x,g.y)/w,1.))*(1.-sstep(.1,.3,max(fw.x,fw.y))); }
      void main(){ float r=length((vW.xz-uC)/uR);
        float fade=1.-sstep(.62,1.,r);
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
  const dashedLine = (pts: THREE.Vector3[], mat: THREE.ShaderMaterial) => {
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const dist = new Float32Array(pts.length); for (let i = 1; i < pts.length; i++) dist[i] = dist[i - 1] + pts[i].distanceTo(pts[i - 1]);
    g.setAttribute("aDist", new THREE.BufferAttribute(dist, 1));
    const l = new THREE.Line(g, mat); scene.add(l); return l;
  };
  const stub = (r: Room, street: number) => [new THREE.Vector3(r.x, 0.02, street), new THREE.Vector3(r.x, 0.02, r.z - Math.sign(r.z - street) * r.d / 2)];
  const corridorMat = dashMat(ICE, 2.2);
  dashedLine([DOOR.clone().setY(0.02), new THREE.Vector3(120, 0.02, 0)], corridorMat);
  // 방마다 복도에서 들어가는 짧은 점선
  ROOMS.filter((r) => r.kind !== "plan").forEach((r) => dashedLine(stub(r, 0), corridorMat));
  // 3 · 현관에서 뒤로 난 거리와 새 방의 입구(3단계에만 보인다)
  const streetMat = dashMat(ICE, 2.2);
  dashedLine([DOOR.clone().setY(0.02), new THREE.Vector3(DOOR.x, 0.02, STREETS[STREETS.length - 1])], streetMat);
  STREETS.slice(1).forEach((s) => dashedLine([new THREE.Vector3(DOOR.x, 0.02, s), new THREE.Vector3(120, 0.02, s)], streetMat));
  FIELD.forEach((r) => dashedLine(stub(r, STREETS.reduce((a, s) => (Math.abs(r.z - s) < Math.abs(r.z - a) ? s : a))), streetMat));

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
      const edge = dashMat(r.kind === "office" ? ICE.clone().lerp(GOLD, 0.25) : ICE, 3);
      const pts = corners(r, 0.03).map((v) => v.sub(new THREE.Vector3(r.x, 0, r.z)));
      const all = [...pts, pts[0]]; const geo = new THREE.BufferGeometry().setFromPoints(all);
      const dist = new Float32Array(all.length); for (let i = 1; i < all.length; i++) dist[i] = dist[i - 1] + all[i].distanceTo(all[i - 1]);
      geo.setAttribute("aDist", new THREE.BufferAttribute(dist, 1));
      g.add(new THREE.Line(geo, edge));
      // 가정의 방(사무직 · 번져 가는 방)은 점선 기둥으로 높이만 그려 둔다
      if (r.kind === "office" || r.kind === "field") {
        const up = corners(r, 0).map((v) => v.sub(new THREE.Vector3(r.x, 0, r.z)));
        up.forEach((v) => { const ln = [v, v.clone().setY(1.4)]; const lg = new THREE.BufferGeometry().setFromPoints(ln); lg.setAttribute("aDist", new THREE.BufferAttribute(new Float32Array([0, 1.4]), 1)); g.add(new THREE.Line(lg, edge)); });
        const cap = [...up.map((v) => v.clone().setY(1.4)), up[0].clone().setY(1.4)]; const rg = new THREE.BufferGeometry().setFromPoints(cap);
        const rd = new Float32Array(cap.length); for (let i = 1; i < cap.length; i++) rd[i] = rd[i - 1] + cap[i].distanceTo(cap[i - 1]); rg.setAttribute("aDist", new THREE.BufferAttribute(rd, 1)); g.add(new THREE.Line(rg, edge));
      }
      rooms.push({ r, edge, g, floor });
    }
  };
  ROOMS.forEach(makeRoom); FIELD.forEach(makeRoom);

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

  /* 1~3 · 방과 방을 잇는 빛의 그물. 한 번에 그리는 선 묶음 하나다.
     1단계: 지어진 방 다섯 개의 모든 짝(10). 2단계: 사무직의 방이 설 때마다 앞의 모든 방과. 3단계: 새 방이 앞의 방 둘과.
     4단계: Personal CIO에서 사례 세 개로 올라가는 금색 줄.
     선은 새 방 쪽에서 앞의 방으로 자라고, 막 이어질 때 밝았다가 가라앉는다. 그 위로 빛 알갱이가 오간다. */
  const rnd = rand(43);
  const builtRooms = ROOMS.filter((r) => r.kind === "built"), officeRooms = OFFICE.map(byId);
  const links: { from: Room; to: Room | THREE.Vector3; phase: number; born: number; gold?: boolean }[] = [];
  const pairs = builtRooms.flatMap((r, i) => builtRooms.slice(i + 1).map((s) => [r, s] as const));
  for (let i = pairs.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pairs[i], pairs[j]] = [pairs[j], pairs[i]]; }
  pairs.forEach(([a, b], i) => links.push({ from: a, to: b, phase: 1, born: 0.35 + i * 0.13 }));
  officeRooms.forEach((o, k) => [...builtRooms, ...officeRooms.slice(0, k)].forEach((r, j) => links.push({ from: o, to: r, phase: 2, born: OFFICE_BORN[k] + 0.3 + j * 0.04 })));
  FIELD.forEach((f, i) => {
    const pool = [...builtRooms, ...officeRooms, ...FIELD.slice(0, i)];
    const picks = new Set<number>(); while (picks.size < 2) picks.add(Math.floor(rnd() * pool.length));
    [...picks].forEach((j, c) => links.push({ from: f, to: pool[j], phase: 3, born: f.born! + 0.25 + c * 0.12 }));
  });
  CASES.forEach((c) => links.push({ from: byId("cio"), to: c.at, phase: 4, born: c.born - 0.5, gold: true }));
  const SEG = 24, V = links.length * SEG * 2;
  const lpos = new Float32Array(V * 3), lT = new Float32Array(V), lBorn = new Float32Array(V), lPhase = new Float32Array(V), lSeed = new Float32Array(V), lGold = new Float32Array(V);
  links.forEach((l, i) => {
    const a = roof(l.from), b = l.to instanceof THREE.Vector3 ? l.to : roof(l.to), d = a.distanceTo(b);
    // 사례로 가는 줄은 방에서 곧게 솟아 사례에 닿는다(넘어갔다 내려오지 않게)
    const curve = new THREE.QuadraticBezierCurve3(a, a.clone().lerp(b, 0.5).setY(Math.max(a.y, b.y) + (l.gold ? 0.6 : Math.min(4, 0.5 + d * 0.16))), b);
    const pts = curve.getPoints(SEG), seed = rnd();
    for (let s = 0; s < SEG; s++) for (let e = 0; e < 2; e++) {
      const v = (i * SEG + s) * 2 + e, p = pts[s + e];
      lpos.set([p.x, p.y, p.z], v * 3); lT[v] = (s + e) / SEG; lBorn[v] = l.born; lPhase[v] = l.phase; lSeed[v] = seed; lGold[v] = l.gold ? 1 : 0;
    }
  });
  const webGeo = new THREE.BufferGeometry();
  webGeo.setAttribute("position", new THREE.BufferAttribute(lpos, 3));
  webGeo.setAttribute("aT", new THREE.BufferAttribute(lT, 1)); webGeo.setAttribute("aBorn", new THREE.BufferAttribute(lBorn, 1));
  webGeo.setAttribute("aPhase", new THREE.BufferAttribute(lPhase, 1)); webGeo.setAttribute("aSeed", new THREE.BufferAttribute(lSeed, 1)); webGeo.setAttribute("aGold", new THREE.BufferAttribute(lGold, 1));
  const webMat = new THREE.ShaderMaterial({
    uniforms: { uPhase: { value: 0 }, uT: { value: 0 }, uTime: { value: 0 }, uA: { value: 1 }, uDim: { value: 1 }, uGold: { value: GOLD.clone() }, uIce: { value: ICE.clone() } },
    vertexShader: `attribute float aT,aBorn,aPhase,aSeed,aGold; varying float vT,vBorn,vPhase,vSeed,vGold;
      void main(){ vT=aT; vBorn=aBorn; vPhase=aPhase; vSeed=aSeed; vGold=aGold; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `${GLSL_SAFE}varying float vT,vBorn,vPhase,vSeed,vGold; uniform float uPhase,uT,uTime,uA,uDim; uniform vec3 uGold,uIce;
      void main(){
        if (vPhase > uPhase + .5) discard;
        float age = vPhase < uPhase - .5 ? 1e3 : uT - vBorn;
        float grow = clamp(age / .45, 0., 1.);
        if (age < 0. || vT > grow) discard;
        float tip = exp(-pw((grow - vT) * 16., 2.)) * (1. - sstep(.4, .6, age));
        float flash = exp(-max(age - .45, 0.) * 2.2);
        float base = vGold > .5 ? .8 : vPhase < 1.5 ? .55 : vPhase < 2.5 ? .3 : .2;
        float packet = exp(-pw((fract(uTime * .28 + vSeed) - vT) * 14., 2.));
        vec3 col = vPhase < 1.5 || vGold > .5 ? uGold : uIce;
        gl_FragColor = vec4(col * (base + flash * .75 + tip * 1.4 + packet * base * 2.2) * uA * (vGold > .5 ? 1. : uDim), 1.); }`,
    ...ADD,
  });
  scene.add(new THREE.LineSegments(webGeo, webMat));

  /* 1 · 실제 예 두 가지: 금색으로 따로 맺히는 조합(가능성) */
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
  const caseKnots = CASES.map((c) => knot(c.at, 2.2));
  const caseOn = (born: number, p: number, t: number) => (p === 4 ? smooth(born, born + 0.5, t) : 0);

  /* 상태 */
  const cam = { from: new THREE.Vector3(), fromLook: new THREE.Vector3(), eye: new THREE.Vector3(...POSES[pc.phase].eye), look: new THREE.Vector3(...POSES[pc.phase].look), t0: -1e6, dur: 2.4 };
  if (replay) { cam.from.set(...POSES[pc.phase].eye).multiplyScalar(1.08); cam.fromLook.set(...POSES[pc.phase].look); cam.t0 = 0; cam.dur = 2.6; }
  const eyeNow = new THREE.Vector3(), lookNow = new THREE.Vector3(...POSES[pc.phase].look);
  const pointerS = new THREE.Vector2();
  const S: Record<string, number> = {};
  const follow = (k: string, target: number, dt: number, rate = 3) => { if (S[k] === undefined || !pc.motion) return (S[k] = target); return (S[k] += (target - S[k]) * (1 - Math.exp(-dt * rate))); };
  const order = (r: Room) => (r.kind === "plan" ? 0.6 : r.kind === "built" ? ["tts", "assets", "music", "rice", "cio"].indexOf(r.id) * 0.28 : 0);
  // 격자 판의 중심과 반지름(단계마다 방을 따라 넓어진다)
  const PAD: [number, number, number, number][] = [[2.4, 0, 12, 6.8], [2.4, 0, 12, 6.8], [6.2, 0, 16.5, 7.2], [11, -7.6, 24, 15.5], [11, -7.6, 24, 15.5]];
  const tally: Tally = { on: false, n: 5, value: 0 };

  function update(dt: number) {
    pc.tick(dt);
    const p = pc.phase, t = pc.t, time = pc.clock;
    const k = pc.motion ? easeInOut(clamp01((time - cam.t0) / cam.dur)) : 1;
    eyeNow.lerpVectors(cam.from, cam.eye, k); lookNow.lerpVectors(cam.fromLook, cam.look, k);
    if (pc.motion) { pointerS.lerp(stage.pointer, 1 - Math.exp(-dt * 2)); eyeNow.x += Math.sin(time * 0.15) * 0.25 + pointerS.x * 0.6; eyeNow.y += Math.sin(time * 0.19) * 0.1 - pointerS.y * 0.3; }
    camera.position.copy(eyeNow); camera.lookAt(lookNow);

    // 첫 단계: 격자가 깔리고 방이 차례로 솟는다
    const intro = pc.phase === 0 ? t : 1e3;
    gridU.uLit.value = smooth(0.1, 1.4, intro);
    const pad = PAD[p];
    gridU.uC.value.set(follow("cx", pad[0], dt, 0.9), follow("cz", pad[1], dt, 0.9)); gridU.uR.value.set(follow("rx", pad[2], dt, 0.9), follow("rz", pad[3], dt, 0.9));
    corridorMat.uniforms.uA.value = 0.7 * smooth(1.0, 2.0, intro); corridorMat.uniforms.uTime.value = time;
    corridorMat.uniforms.uFade.value = follow("fade", p >= 3 ? 46 : p === 2 ? 28 : 22, dt, 0.8);
    streetMat.uniforms.uA.value = follow("street", p >= 3 ? 0.55 : 0, dt, 1.4); streetMat.uniforms.uTime.value = time; streetMat.uniforms.uFade.value = 46;
    rooms.forEach((o) => {
      const r = o.r;
      let a: number, rise = 1;
      if (r.kind === "built") { rise = easeOut(clamp01((intro - 1.2 - order(r)) / 1.1)); a = smooth(1.1 + order(r), 1.6 + order(r), intro); }
      else if (r.kind === "plan") a = smooth(1.8, 2.6, intro);
      else if (r.kind === "office") { const b = OFFICE_BORN[OFFICE.indexOf(r.id)]; a = p < 2 ? 0 : p === 2 ? smooth(b, b + 0.5, t) : 1; rise = p === 2 ? easeOut(clamp01((t - b) / 0.7)) : 1; }
      else { const b = r.born!; a = p < 3 ? 0 : p === 3 ? smooth(b, b + 0.4, t) : 1; rise = p === 3 ? easeOut(clamp01((t - b) / 0.55)) : 1; }
      o.g.scale.y = Math.max(0.001, rise); o.g.visible = a > 0.001;
      if (o.wall) o.wall.uniforms.uA.value = a;
      if ("uniforms" in o.edge) { o.edge.uniforms.uA.value = a * (r.kind === "field" ? 0.6 : 0.9); o.edge.uniforms.uTime.value = time; }
      else o.edge.opacity = a;
      o.floor.opacity = a * (r.kind === "built" ? 1 : r.kind === "field" ? 0.45 : 0.6);
    });
    const vOn = smooth(2.6, 3.4, intro);
    screenMat.opacity = vOn * 0.92; (screenGlow.material as THREE.SpriteMaterial).opacity = vOn * 0.28;
    door.material.opacity = 0.6 + 0.4 * Math.sin(time * 1.8) * (pc.motion ? 1 : 0);

    // 1~3 · 빛의 그물
    webMat.uniforms.uPhase.value = p; webMat.uniforms.uT.value = t; webMat.uniforms.uTime.value = time;
    // 4 · 사례로 가는 금색 줄만 보이도록 나머지 그물은 가라앉힌다
    webMat.uniforms.uDim.value = p === 4 ? 1 - 0.7 * smooth(0, 0.8, t) : 1;

    // 1 · 실제 예 두 가지. 2단계로 넘어가면 걷힌다(라벨이 없는 곡선이 사무직의 방 위를 가로지르지 않게).
    const leave = p === 2 ? 1 - smooth(0, 0.8, t) : p > 2 ? 0 : 1;
    combos.forEach((c) => {
      const on = p === 0 ? 0 : p === 1 ? smooth(1.9 + c.i * 0.3, 2.6 + c.i * 0.3, t) : 0.55 * leave;
      c.mat.uniforms.uA.value = on; c.mat.uniforms.uTime.value = time;
      const s = pc.motion ? (time * 0.35 + c.i * 0.27) % 1 : 0.6;
      c.spark.position.copy(c.curve.getPoint(s)); c.spark.material.opacity = on * (p === 1 ? 1 : 0.5);
    });
    stockKnot.opacity = p === 0 ? 0 : p === 1 ? smooth(2.6, 3.2, t) : 0.6 * leave;
    lectureKnot.opacity = p === 0 ? 0 : p === 1 ? smooth(2.8, 3.4, t) : 0.6 * leave;
    CASES.forEach((c, i) => { caseKnots[i].opacity = caseOn(c.born, p, t) * (0.75 + 0.25 * Math.sin(time * 2 + i) * (pc.motion ? 1 : 0)); });

    // 조합의 수: 1단계는 그물이 그려지는 동안 26까지 오르고, 2·3단계는 선 방의 수를 따라간다
    tally.on = p >= 1;
    if (p === 1) { tally.n = 5; tally.value = Math.round(combosOf(5) * easeOut(clamp01((t - 0.35) / 1.8))); }
    else if (p === 2) { tally.n = 5 + OFFICE_BORN.filter((b) => t > b + 0.3).length; tally.value = combosOf(tally.n); }
    else if (p === 3) { tally.n = 9 + FIELD.filter((f) => t > f.born! + 0.25).length; tally.value = combosOf(tally.n); }
    else if (p === 4) { tally.n = 9 + FIELD.length; tally.value = combosOf(tally.n); }

    (Object.keys(ANCHORS) as (keyof typeof ANCHORS)[]).forEach((id) => {
      if (id === "door") ANCHORS.door.copy(DOOR).setY(0.4);
      else if (id === "comboStock") ANCHORS.comboStock.copy(COMBO_STOCK).setY(COMBO_STOCK.y + 0.35);
      else if (id === "comboLecture") ANCHORS.comboLecture.copy(COMBO_LECTURE).setY(COMBO_LECTURE.y + 0.3);
      else if (id === "caseCast" || id === "caseSell" || id === "caseData") ANCHORS[id].copy(CASES.find((c) => c.id === id)!.at).setY(4.5);
      else ANCHORS[id].copy(BELOW.includes(id) ? front(byId(id)) : top(byId(id)));
    });
  }
  stage.start(update, () => pc.motion);

  return {
    setPhase(next) {
      next = Math.max(0, Math.min(PHASES - 1, next)); if (next === pc.phase) return;
      const forward = pc.go(next);
      cam.from.copy(camera.position); cam.fromLook.copy(lookNow); cam.eye.set(...POSES[next].eye); cam.look.set(...POSES[next].look); cam.t0 = pc.clock; cam.dur = forward ? [2.4, 2.0, 2.6, 3.6, 1.6][next] : 1.4;
      stage.kick();
    },
    setMotion(on) { pc.setMotion(on); if (!on) { cam.t0 = -1e6; cam.from.copy(cam.eye); cam.fromLook.copy(cam.look); } stage.kick(); },
    setPointer(x, y) { stage.pointer.set(x, y); },
    project: (id) => stage.project(ANCHORS[id]),
    labelAlpha() { if (!pc.motion || pc.phase === 4) return 1; return smooth(0.6, 1, clamp01((pc.clock - cam.t0) / cam.dur)); },
    reveal(id) { const c = CASES.find((k) => k.id === id); return c ? caseOn(c.born, pc.phase, pc.t) : 1; },
    tally: () => tally,
    onFrame: stage.onFrame,
    dispose: stage.dispose,
  };
}
