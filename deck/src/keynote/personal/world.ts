import * as THREE from "three";
import { FONT, GLSL_SAFE, PhaseClock, canvasTexture, clamp01, createStage, easeInOut, easeOut, fitShot, rand, roundRect, smooth, type Pose, type Shot } from "../stage3d/runtime";

/*
 * 17~20번 · 사용자는 저 한 명, 그 한 사람을 둘러싼 흐름, 그리고 Factory 안.
 *   0  (17) 많은 사용자의 점들이 가라앉고, 금색 점 하나(저)만 남는다.
 *   1  (17) 저를 둘러싼 조건의 고리들이 느슨해진다. 가장 안쪽의 금색 고리(원본과 작업 기록)만 그대로다.
 *   2  (18) 카메라가 물러나며 고리 위의 흐름이 드러난다. 요청이 Agent OS(구상)로 간다.
 *   3  (18) Agent OS가 Factory의 엔진으로 일을 넘기고, 강의 영상이 나온다.
 *   4  (18) 결과가 저에게 돌아오고, "이 페이지 발음만 다시" 요청이 TTS로 되돌아간다.
 *   5  (19) 카메라가 Factory 안으로 들어간다. 엔진이 호를 따라 스테이션으로 늘어서고, 요청이 오면 맞는 스테이션 하나만 켜진다.
 *          위에 따로 떨어진 문(프론티어 모델)에는 어려운 판단만 올라간다.
 *   6  (19) 문 양옆으로 실제 영수증 두 장이 내려온다(디지털 월세).
 *   7  (19) 물러나면 모든 스테이션이 각자 자기 일을 한다.
 *   8  (20) 공간 전체가 어두워지고 청중의 질문이 뜬다(DOM).
 *   9  (20) 세 가지 베팅: 결과물이 빛나고, 저에게서 금색 고리가 퍼지고, 목소리 스테이션의 모델이 새것으로 바뀐다.
 * Agent OS, 전체 연결, 요청을 나누는 라우팅은 구상이다. 스테이션(엔진)들은 따로 개발 중이다(대본·화면에 표시).
 */

export const PHASES = 10;
const ICE = new THREE.Color("#8fd0ff");
const GOLD = new THREE.Color("#ffd49a");
const WHITE = new THREE.Color("#eef5ff");

const R = 5.2;
const at = (deg: number, y = 0) => { const a = THREE.MathUtils.degToRad(deg); return new THREE.Vector3(R * Math.cos(a), y, R * Math.sin(a)); };
/** 네 자리: 저(앞 왼쪽) → Agent OS(뒤 왼쪽) → Factory(뒤 오른쪽) → 결과(앞 오른쪽) → 저 */
const A0 = 135;
const ME = at(A0, 0.9), OS = at(A0 + 90, 1.35), FACTORY = at(A0 + 180, 0), OUT = at(A0 + 270, 1.25);
const ENGINES = [
  { name: "TTS", sub: "음성·자막·영상", pos: FACTORY.clone().add(new THREE.Vector3(1.85, 0, 0.1)) },
  { name: "ASSETS", sub: "이미지·3D", pos: FACTORY.clone().add(new THREE.Vector3(0, 0, -0.25)) },
  { name: "MUSIC", sub: "곡 후보", pos: FACTORY.clone().add(new THREE.Vector3(-1.85, 0, 0.1)) },
];

/* Factory 안(5~9): 고리의 가운데에서 Factory 쪽을 보면 스테이션이 호를 따라 늘어서 있다. */
const IN_F = new THREE.Vector3(FACTORY.x, 0, FACTORY.z).normalize();
const IN_R = new THREE.Vector3(-IN_F.z, 0, IN_F.x);
const FACE_Y = Math.atan2(-IN_F.x, -IN_F.z);
const IN_AZ = THREE.MathUtils.radToDeg(FACE_Y);
const stationAt = (x: number, front = 0) => FACTORY.clone().addScaledVector(IN_R, x).addScaledVector(IN_F, 0.3 + x * x / 20 - front);
/** 왼쪽부터 RICE · 음악 · 이미지·3D · 받아쓰기 검수 · 목소리 */
const ST_IDS = ["stRice", "stMusic", "stAssets", "stStt", "stVoice"] as const;
const ST_X = [-4.1, -2.05, 0, 2.05, 4.1];
const ST_POS = ST_X.map((x) => stationAt(x));
/** 기존 엔진 세 개(TTS·ASSETS·MUSIC)가 옮겨 가는 스테이션 자리 */
const ENGINE_TO_ST = [4, 2, 1];
const DOOR = FACTORY.clone().addScaledVector(IN_F, 2.3).setY(4.7);
const DOOR_W = 1.7, DOOR_H = 2.8;
const BUS_PTS = [-6.1, -4.1, -2.05, 0, 2.05, 4.1, 5.3].map((x) => stationAt(x, 1.35).setY(0.05));
const CODEX_W = 3.5, CODEX_H = CODEX_W * 150 / 1565, CLAUDE_W = 3.5, CLAUDE_H = CLAUDE_W * 550 / 1990;
// 문 앞 아래쪽에 두 장이 걸린다. 금액 라벨은 각 영수증 아래에 선다.
const CODEX_AT = DOOR.clone().addScaledVector(IN_R, -2.15).add(new THREE.Vector3(0, -2.35, 0)).addScaledVector(IN_F, -1.3);
const CLAUDE_AT = DOOR.clone().addScaledVector(IN_R, 2.2).add(new THREE.Vector3(0, -2.05, 0)).addScaledVector(IN_F, -1.3);

const around = (c: THREE.Vector3, r: number, h = r) => [[-r, 0, 0], [r, 0, 0], [0, -h, 0], [0, h, 0], [0, 0, -r], [0, 0, r]].map(([x, y, z]) => c.clone().add(new THREE.Vector3(x, y, z)));
const ring = () => [ME, OS.clone().setY(2.6), ...around(ME, 1.1), OUT.clone().add(new THREE.Vector3(1.3, -0.7, 0.3)), OUT.clone().add(new THREE.Vector3(-1.3, 0.8, 0)), ...ENGINES.flatMap((e) => [e.pos.clone().setY(2.5), e.pos.clone().add(new THREE.Vector3(0.7, 0, 0.7))]), at(A0 + 225, 0), at(A0 + 45, 0)];
const stations = (top = 2.3) => ST_POS.flatMap((p) => [p.clone(), p.clone().setY(top)]);
const doorCorners = () => [-1, 1].flatMap((sx) => [-1, 1].map((sy) => DOOR.clone().addScaledVector(IN_R, sx * DOOR_W / 2).add(new THREE.Vector3(0, sy * DOOR_H / 2, 0))));
const quadCorners = (c: THREE.Vector3, w: number, h: number) => [-1, 1].flatMap((sx) => [-1, 1].map((sy) => c.clone().addScaledVector(IN_R, sx * w / 2).add(new THREE.Vector3(0, sy * h / 2, 0))));
const wide = () => [...ring(), ...ST_POS.map((p) => p.clone().setY(2.4)), DOOR.clone().setY(DOOR.y + DOOR_H / 2 + 0.4)];
const SHOTS: Shot[] = [
  { az: 0, el: 15, rect: [300, 420, 900, 860], points: () => around(ME.clone().setY(0.6), 2.2, 1.1) },
  { az: 0, el: 22, rect: [260, 400, 920, 860], points: () => around(ME.clone().setY(0.4), 2.3, 1.2) },
  { az: -4, el: 31, rect: [330, 485, 1790, 905], points: ring },
  { az: 3, el: 31, rect: [330, 485, 1790, 905], points: ring },
  { az: 0, el: 33, rect: [330, 485, 1790, 905], points: ring },
  // 18 · 공장 안
  { az: IN_AZ, el: 13, rect: [520, 230, 1800, 930], points: () => [...stations(), ...doorCorners()] },
  { az: IN_AZ + 2, el: 5, rect: [760, 250, 1830, 760], points: () => [...doorCorners(), ...quadCorners(CODEX_AT, CODEX_W, CODEX_H), ...quadCorners(CLAUDE_AT, CLAUDE_W, CLAUDE_H)] },
  { az: IN_AZ - 6, el: 21, rect: [420, 250, 1820, 940], points: () => [...stations(), ...doorCorners(), BUS_PTS[0]] },
  // 19 · 베팅
  { az: 0, el: 34, rect: [560, 380, 1840, 880], points: wide },
  { az: 2, el: 33, rect: [600, 380, 1840, 860], points: wide },
];

export const ANCHORS = {
  me: new THREE.Vector3(), os: new THREE.Vector3(), factory: new THREE.Vector3(), tts: new THREE.Vector3(), out: new THREE.Vector3(), redo: new THREE.Vector3(), crowd: new THREE.Vector3(),
  stVoice: new THREE.Vector3(), stStt: new THREE.Vector3(), stAssets: new THREE.Vector3(), stMusic: new THREE.Vector3(), stRice: new THREE.Vector3(),
  frontier: new THREE.Vector3(), router: new THREE.Vector3(), rentCodex: new THREE.Vector3(), rentClaude: new THREE.Vector3(),
  betOut: new THREE.Vector3(), betMe: new THREE.Vector3(), betFactory: new THREE.Vector3(),
};
export type AnchorId = keyof typeof ANCHORS;

function chipTexture(text: string) {
  return canvasTexture(560, 140, (g) => {
    roundRect(g, 4, 4, 552, 132, 30); g.fillStyle = "rgba(10,24,38,.92)"; g.fill(); g.strokeStyle = "rgba(143,208,255,.75)"; g.lineWidth = 3; g.stroke();
    g.font = `600 56px ${FONT}`; g.fillStyle = "#e6f4ff"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 280, 72);
  });
}
function engineTexture(name: string, sub: string, gold: boolean) {
  return canvasTexture(640, 260, (g) => {
    g.font = `800 96px ${FONT}`; g.fillStyle = gold ? "#ffe0ae" : "#cfeaff"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(name, 320, 96);
    g.font = `500 46px ${FONT}`; g.fillStyle = gold ? "#e8c78e" : "#8fb8d6"; g.fillText(sub, 320, 196);
  });
}

const cableMat = (color: THREE.Color, length: number) => new THREE.ShaderMaterial({
  uniforms: { uColor: { value: color.clone() }, uLit: { value: 0 }, uTime: { value: 0 }, uDraw: { value: 0 }, uLen: { value: length }, uBase: { value: 0.12 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `${GLSL_SAFE}varying vec2 vUv; uniform vec3 uColor; uniform float uLit,uTime,uDraw,uLen,uBase;
    void main(){ float t=vUv.x; float lit=step(t,uDraw)*uLit;
      float dash=pw(.5+.5*sin((t*uLen-uTime*3.)*1.5),16.);
      float head=exp(-abs(t-uDraw)*uLen*2.2)*step(uDraw,.999)*uLit;
      vec3 c=uColor*(uBase+lit*(.5+dash*2.)+head*3.);
      gl_FragColor=vec4(c,1.); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});

export type OneUserWorld = {
  setPhase: (p: number) => void; setMotion: (on: boolean) => void; setPointer: (x: number, y: number) => void;
  project: (id: AnchorId) => { x: number; y: number; visible: boolean }; labelAlpha: () => number; onFrame: (cb: () => void) => void; dispose: () => void;
};

export type OneUserImages = { lecture: HTMLImageElement; codex: HTMLImageElement; claude: HTMLImageElement; image: HTMLImageElement; music: HTMLImageElement };

/** 19-0에서 되풀이하는 요청. 스테이션 번호(ST_IDS 순서), -1은 프론티어 문. */
const REQUESTS = [4, 3, 2, -1, 1, 0];
const REQ_START = 3.1, REQ_GAP = 1.55, DOOR_GAP = 3.6;
const REQ_AT: number[] = []; let REQ_CYCLE = 0;
for (const r of REQUESTS) { REQ_AT.push(REQ_CYCLE); REQ_CYCLE += r < 0 ? DOOR_GAP : REQ_GAP; }

export function createOneUserWorld(canvas: HTMLCanvasElement, images: OneUserImages, initialPhase: number, initialMotion: boolean): OneUserWorld {
  const { lecture } = images;
  const stage = createStage(canvas, { background: "#05080d", fog: 0.03, fov: 34, bloom: [0.7, 0.55, 0.8], lostEvent: "oneuser-lost" });
  const { scene, camera, glow } = stage;
  const pc = new PhaseClock(Math.max(0, Math.min(PHASES - 1, initialPhase)), initialMotion);
  const POSES: Pose[] = SHOTS.map((s) => fitShot(s, camera));
  const keep = <T extends { dispose: () => void }>(t: T) => { stage.keep(t); return t; };
  const additive = (color: THREE.Color, opacity = 0) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const imageTexture = (im: HTMLImageElement) => { const t = keep(new THREE.Texture(im)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; return t; };
  const glowSprite = (color: THREE.Color, scale: number) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(scale); return s; };

  scene.add(new THREE.HemisphereLight("#6d8fb0", "#05080d", 0.55));
  const key = new THREE.DirectionalLight("#cfe4ff", 1.0); key.position.set(-6, 12, 9); scene.add(key);

  /* 바닥 */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.ShaderMaterial({
    uniforms: { uLit: { value: 0 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `${GLSL_SAFE}varying vec3 vW; uniform float uLit;
      float gridLine(vec2 p, float s, float w){ vec2 q=p/s; vec2 g=abs(fract(q-.5)-.5)/fwidth(q); return 1.-min(min(g.x,g.y)/w,1.); }
      void main(){ float r=length(vW.xz); vec3 col=vec3(.01,.016,.026);
        col+=vec3(.22,.42,.62)*(gridLine(vW.xz,1.,1.)*.03+gridLine(vW.xz,4.,1.2)*.07)*exp(-max(r-6.,0.)*.08)*uLit;
        col=mix(col,vec3(.002,.003,.006),sstep(14.,40.,r)); gl_FragColor=vec4(col,1.); }`,
  }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const floorU = (floor.material as THREE.ShaderMaterial).uniforms;

  /* 많은 사용자 (0) */
  const crowdGeo = new THREE.BufferGeometry();
  { const r = rand(4), n = 4200, a = new Float32Array(n * 3), s = new Float32Array(n);
    for (let i = 0; i < n; i++) { const ang = r() * Math.PI * 2, d = 1.6 + Math.pow(r(), 0.7) * 22; a.set([ME.x + Math.cos(ang) * d, 0.08 + r() * 0.1, ME.z + Math.sin(ang) * d * 0.9], i * 3); s[i] = r(); }
    crowdGeo.setAttribute("position", new THREE.BufferAttribute(a, 3)); crowdGeo.setAttribute("aSeed", new THREE.BufferAttribute(s, 1)); }
  const crowdMat = new THREE.ShaderMaterial({
    uniforms: { uFade: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `${GLSL_SAFE}attribute float aSeed; uniform float uFade,uTime; varying float vA;
      void main(){ vec3 p=position; float k=clamp(uFade*1.6-aSeed*.6,0.,1.); p.y-=k*.6;
        vA=(1.-k)*(.55+.45*sin(uTime*1.7+aSeed*40.));
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_PointSize=(1.4+aSeed*1.8)*(90./-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `${GLSL_SAFE}varying float vA; void main(){ float d=length(gl_PointCoord-.5); gl_FragColor=vec4(vec3(.5,.78,1.)*sstep(.5,.05,d)*vA*.8,1.); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const crowd = new THREE.Points(crowdGeo, crowdMat); crowd.frustumCulled = false; scene.add(crowd);

  /* 저 */
  const me = new THREE.Group(); me.position.copy(ME); scene.add(me);
  const meCoreMat = new THREE.MeshStandardMaterial({ color: "#1a1206", emissive: GOLD.clone(), emissiveIntensity: 3.2, metalness: 0.3, roughness: 0.3 });
  const meCore = new THREE.Mesh(new THREE.SphereGeometry(0.3, 48, 32), meCoreMat); me.add(meCore);
  const meGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: GOLD.clone(), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })); meGlow.scale.setScalar(3.4); me.add(meGlow);
  const meLight = new THREE.PointLight("#ffd49a", 6, 8, 2); me.add(meLight);
  const mePoolMat = new THREE.MeshBasicMaterial({ map: glow, color: GOLD.clone().multiplyScalar(0.8), transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending });
  const mePool = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), mePoolMat); mePool.rotation.x = -Math.PI / 2; mePool.position.set(ME.x, 0.02, ME.z); scene.add(mePool);
  // 19 · 이름이 퍼져 나가는 금색 고리 두 개
  const nameWaves = [0, 1].map(() => { const mat = additive(GOLD.clone().multiplyScalar(2)); const m = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 160), mat); m.rotation.x = -Math.PI / 2; m.position.set(ME.x, 0.06, ME.z); m.visible = false; scene.add(m); return { m, mat }; });

  /* 조건의 고리 (1): 바닥 위의 네 고리는 느슨해지고, 금색 고리 하나는 그대로 */
  const limits = [0, 1, 2, 3].map((i) => {
    const mat = additive(ICE.clone().multiplyScalar(1.6));
    const m = new THREE.Mesh(new THREE.RingGeometry(0.98, 1, 160), mat); m.rotation.x = -Math.PI / 2; m.position.set(ME.x, 0.04 + i * 0.01, ME.z); scene.add(m);
    return { m, mat, r0: 0.75 + i * 0.14, r1: 1.45 + i * 0.42 };
  });
  const lockMat = additive(GOLD.clone().multiplyScalar(2));
  const lock = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.56, 160), lockMat); lock.rotation.x = -Math.PI / 2; lock.position.set(ME.x, 0.05, ME.z); scene.add(lock);

  /* 흐름의 고리: 저 → Agent OS → Factory → 결과 → 저 */
  const arcs = [0, 1, 2, 3].map((i) => {
    const pts = Array.from({ length: 41 }, (_, k) => at(A0 + 90 * i + (90 * k) / 40, 0.06));
    const curve = new THREE.CatmullRomCurve3(pts); const len = curve.getLength();
    const mat = cableMat(i === 3 ? GOLD : ICE, len);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.035, 8, false), mat); scene.add(mesh);
    return { mat, curve };
  });
  const packet = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: GOLD.clone().multiplyScalar(2.2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); packet.scale.setScalar(1.1); scene.add(packet);

  /* Agent OS (구상): 점선 고리 + 가운데 핵 + 맥락 칩 */
  const os = new THREE.Group(); os.position.copy(OS); scene.add(os);
  const osRingMat = new THREE.ShaderMaterial({
    uniforms: { uLit: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `${GLSL_SAFE}varying vec2 vUv; uniform float uLit,uTime;
      void main(){ float dash=step(.45,fract(vUv.x*48.-uTime*.25)); gl_FragColor=vec4(vec3(.56,.82,1.)*(.12+dash*1.3)*uLit,1.); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const osRing = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.03, 8, 200), osRingMat); osRing.rotation.x = Math.PI / 2; os.add(osRing);
  const osRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.02, 8, 160), osRingMat); osRing2.rotation.x = Math.PI / 2.4; os.add(osRing2);
  const osCoreMat = new THREE.MeshStandardMaterial({ color: "#0a1620", emissive: ICE.clone(), emissiveIntensity: 0, flatShading: true });
  const osCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), osCoreMat); os.add(osCore);
  const osGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: ICE.clone(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); osGlow.scale.setScalar(4); os.add(osGlow);
  const CONTEXT = ["대본", "목소리 설정", "작업 중 파일", "수정할 곳"];
  const chips = CONTEXT.map((t, i) => {
    const mat = new THREE.MeshBasicMaterial({ map: keep(chipTexture(t)), transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.72, 0.43), mat); scene.add(m);
    return { m, mat, a: (i / 4) * Math.PI * 2 };
  });

  /* 스테이션: 유리 상자, 받침, 가운데 핵. 18번의 엔진 세 개도 같은 모양이다. */
  const makeStation = (pos: THREE.Vector3, color: THREE.Color) => {
    const g = new THREE.Group(); g.position.copy(pos); scene.add(g);
    const glassMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: ICE.clone() }, uLit: { value: 0 } },
      vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `${GLSL_SAFE}varying vec3 vN; varying vec3 vW; uniform vec3 uColor; uniform float uLit;
        void main(){ vec3 V=normalize(cameraPosition-vW); float f=pw(1.-abs(dot(normalize(vN),V)),2.4); gl_FragColor=vec4(uColor*(.04+f*.45)*uLit,1.); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.55, 1.25), glassMat); box.position.y = 0.2 + 0.775; g.add(box);
    const plinthMat = new THREE.MeshStandardMaterial({ color: "#0c131c", metalness: 0.75, roughness: 0.35, transparent: true, opacity: 1 });
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.2, 1.45), plinthMat); plinth.position.y = 0.1; g.add(plinth);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.25, 1.55, 1.25)), new THREE.LineBasicMaterial({ color: ICE.clone().multiplyScalar(1.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    edges.position.y = box.position.y; g.add(edges);
    const coreMat = new THREE.MeshStandardMaterial({ color: "#0a1620", emissive: color, emissiveIntensity: 0, flatShading: true, transparent: true, opacity: 1 });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 0), coreMat); core.position.y = box.position.y; g.add(core);
    // 켜졌을 때 위로 서는 빛기둥과 바닥의 빛
    const beam = glowSprite(ICE.clone().multiplyScalar(1.2), 1); beam.scale.set(1.1, 3.4, 1); beam.position.y = 1.7; g.add(beam);
    const poolMat = new THREE.MeshBasicMaterial({ map: glow, color: ICE.clone(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), poolMat); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.03; g.add(pool);
    return { g, glassMat, edges: edges.material as THREE.LineBasicMaterial, coreMat, core, plinthMat, beam: beam.material as THREE.SpriteMaterial, poolMat };
  };
  const engines = ENGINES.map((e, i) => {
    const s = makeStation(e.pos, i === 0 ? GOLD.clone() : ICE.clone());
    const labelMat = new THREE.MeshBasicMaterial({ map: keep(engineTexture(e.name, e.sub, i === 0)), transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.57), labelMat); label.position.set(0, 2.2, 0); s.g.add(label);
    return { ...s, labelMat, label };
  });
  // 공장 안에서 새로 서는 두 스테이션: 받아쓰기 검수(3), RICE(0)
  const extra = [3, 0].map((st) => ({ st, ...makeStation(ST_POS[st], ICE.clone()) }));
  /** 스테이션 번호 → 그 스테이션의 물체 */
  const stationObj = (st: number) => { const e = ENGINE_TO_ST.indexOf(st); return e >= 0 ? engines[e] : extra.find((x) => x.st === st)!; };
  // 19 · 목소리 스테이션에 새로 들어오는 모델
  const newCoreMat = new THREE.MeshStandardMaterial({ color: "#0a1620", emissive: WHITE.clone(), emissiveIntensity: 0, flatShading: true, transparent: true, opacity: 0 });
  const newCore = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), newCoreMat); scene.add(newCore);
  const swapRingMat = additive(WHITE.clone().multiplyScalar(1.6));
  const swapRing = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.78, 96), swapRingMat); swapRing.rotation.x = -Math.PI / 2; scene.add(swapRing);

  /* 요청 버스: 스테이션 앞을 지나는 선. 요청을 나누는 부분(입구)은 구상이다. */
  const busCurve = new THREE.CatmullRomCurve3(BUS_PTS, false, "centripetal");
  const busMat = cableMat(ICE, busCurve.getLength()); busMat.uniforms.uBase.value = 0.1;
  const bus = new THREE.Mesh(new THREE.TubeGeometry(busCurve, 200, 0.03, 8, false), busMat); scene.add(bus);
  const busU = ST_POS.map((p) => { let best = 0, bd = 1e9; for (let k = 0; k <= 200; k++) { const d = busCurve.getPoint(k / 200).distanceToSquared(p); if (d < bd) { bd = d; best = k / 200; } } return best; });
  const centerU = busU[2];
  const routerMat = new THREE.ShaderMaterial({
    uniforms: { uLit: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `${GLSL_SAFE}varying vec2 vUv; uniform float uLit,uTime; void main(){ float dash=step(.5,fract(vUv.x*36.-uTime*.3)); gl_FragColor=vec4(vec3(.56,.82,1.)*(.1+dash*1.1)*uLit,1.); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const router = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.02, 8, 120), routerMat); router.rotation.x = Math.PI / 2; router.position.copy(BUS_PTS[0]).setY(0.08); scene.add(router);

  /* 프론티어 모델: 위에 따로 떨어진 문 하나 */
  const door = new THREE.Group(); door.position.copy(DOOR); door.rotation.y = FACE_Y; scene.add(door);
  const doorFillMat = new THREE.ShaderMaterial({
    uniforms: { uLit: { value: 0 }, uFlare: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `${GLSL_SAFE}varying vec2 vUv; uniform float uLit,uFlare,uTime;
      void main(){ vec2 q=vUv-.5; float core=1.-sstep(.0,.6,length(q*vec2(1.7,.75)));
        float rays=pw(.5+.5*sin(vUv.x*26.+sin(vUv.y*3.+uTime*.5)*1.5),10.)*.18*sstep(.0,.8,vUv.y);
        float e=(.05+core*.34+rays)*uLit+uFlare*(.35+core*1.2);
        gl_FragColor=vec4(vec3(.8,.9,1.)*e,1.); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  door.add(new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W, DOOR_H), doorFillMat));
  const doorFrameMat = new THREE.MeshBasicMaterial({ color: WHITE.clone().multiplyScalar(1.5), transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  for (const [w, h, x, y] of [[DOOR_W + 0.12, 0.06, 0, DOOR_H / 2], [DOOR_W + 0.12, 0.06, 0, -DOOR_H / 2], [0.06, DOOR_H, -DOOR_W / 2, 0], [0.06, DOOR_H, DOOR_W / 2, 0]]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), doorFrameMat); bar.position.set(x, y, 0.02); door.add(bar);
  }
  const doorGlow = glowSprite(WHITE.clone().multiplyScalar(0.6), 1); doorGlow.scale.set(5.2, 6.2, 1); doorGlow.position.z = -0.4; door.add(doorGlow);
  // 판단 요청이 오르내리는 길: 버스 가운데에서 문 아래로
  const judgeCurve = new THREE.CatmullRomCurve3([busCurve.getPoint(centerU).setY(0.06), busCurve.getPoint(centerU).setY(2.2), DOOR.clone().setY(DOOR.y - DOOR_H / 2 - 0.9), DOOR.clone().setY(DOOR.y - DOOR_H / 2)], false, "centripetal");
  const judgeMat = cableMat(WHITE, judgeCurve.getLength()); judgeMat.uniforms.uBase.value = 0.08;
  const judge = new THREE.Mesh(new THREE.TubeGeometry(judgeCurve, 100, 0.022, 8, false), judgeMat); scene.add(judge);

  /* 디지털 월세: 잘라낸 실제 영수증 두 장 */
  const receipt = (im: HTMLImageElement, w: number, h: number, at: THREE.Vector3, tilt: number) => {
    const g = new THREE.Group(); g.position.copy(at); g.rotation.set(0, FACE_Y + tilt, 0); scene.add(g);
    const mat = new THREE.MeshBasicMaterial({ map: imageTexture(im), transparent: true, opacity: 0, toneMapped: false });
    g.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat));
    const frameMat = new THREE.LineBasicMaterial({ color: WHITE.clone().multiplyScalar(1.6), transparent: true, opacity: 0 });
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(w + 0.06, h + 0.06)), frameMat));
    const halo = glowSprite(WHITE.clone().multiplyScalar(0.45), 1); halo.scale.set(w * 1.5, h * 2.6 + 0.8, 1); halo.position.z = -0.15; g.add(halo);
    return { g, mat, frameMat, halo: halo.material as THREE.SpriteMaterial, at };
  };
  const codexR = receipt(images.codex, CODEX_W, CODEX_H, CODEX_AT, 0.1);
  const claudeR = receipt(images.claude, CLAUDE_W, CLAUDE_H, CLAUDE_AT, -0.1);

  /* 요청의 빛 */
  const packets = Array.from({ length: 4 }, () => { const s = glowSprite(ICE.clone().multiplyScalar(2.4), 0.8); scene.add(s); return s; });

  /* 결과: 실제 강의 화면 (+20번에서 새 이미지·음악 카드) */
  const lectureTex = imageTexture(lecture);
  const outG = new THREE.Group(); outG.position.copy(OUT); scene.add(outG);
  const outMat = new THREE.MeshBasicMaterial({ map: lectureTex, transparent: true, opacity: 0, toneMapped: false });
  const outW = 2.3, outH = outW * 9 / 16;
  const outScreen = new THREE.Mesh(new THREE.PlaneGeometry(outW, outH), outMat); outG.add(outScreen);
  const outFrameMat = new THREE.LineBasicMaterial({ color: GOLD.clone().multiplyScalar(1.4), transparent: true, opacity: 0 });
  outG.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(outW + 0.06, outH + 0.06)), outFrameMat));
  const outGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: ICE.clone().multiplyScalar(0.6), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); outGlow.scale.set(5, 3.2, 1); outGlow.position.z = -0.3; outG.add(outGlow);
  const works = [images.image, images.music].map((im, i) => {
    const w = 1.5, h = w * 9 / 16;
    const mat = new THREE.MeshBasicMaterial({ map: imageTexture(im), transparent: true, opacity: 0, toneMapped: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(-2.1, 0.5 - i * 1.0, -0.05); outG.add(m);
    const frameMat = new THREE.LineBasicMaterial({ color: GOLD.clone().multiplyScalar(1.4), transparent: true, opacity: 0 });
    const f = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(w + 0.05, h + 0.05)), frameMat); f.position.copy(m.position); outG.add(f);
    return { mat, frameMat };
  });

  /* 다시 만들어 달라는 금색 되돌림: 저 → TTS */
  const redoCurve = new THREE.CatmullRomCurve3([ME.clone().setY(1.0), ME.clone().lerp(ENGINES[0].pos, 0.35).setY(2.6), ME.clone().lerp(ENGINES[0].pos, 0.7).setY(2.6), ENGINES[0].pos.clone().setY(1.25)], false, "centripetal");
  const redoMat = cableMat(GOLD, redoCurve.getLength()); redoMat.uniforms.uBase.value = 0;
  const redo = new THREE.Mesh(new THREE.TubeGeometry(redoCurve, 120, 0.045, 8, false), redoMat); scene.add(redo);

  /* 먼지 */
  const dustGeo = new THREE.BufferGeometry();
  { const r = rand(9), n = 600, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([-16 + r() * 32, r() * 8, -14 + r() * 26], i * 3); dustGeo.setAttribute("position", new THREE.BufferAttribute(a, 3)); }
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: new THREE.Color("#7fb4dc"), size: 0.05, map: glow, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(dust);

  /* 상태 */
  const cam = { from: new THREE.Vector3(), fromLook: new THREE.Vector3(), eye: new THREE.Vector3(...POSES[pc.phase].eye), look: new THREE.Vector3(...POSES[pc.phase].look), t0: -1e6, dur: 2.4 };
  if (pc.motion) { cam.from.set(...POSES[pc.phase].eye).multiplyScalar(1.12); cam.fromLook.set(...POSES[pc.phase].look); cam.t0 = 0; cam.dur = 2.6; }
  const eyeNow = new THREE.Vector3(), lookNow = new THREE.Vector3(...POSES[pc.phase].look);
  const pointerS = new THREE.Vector2();
  const S: Record<string, number> = {};
  const follow = (k: string, target: number, dt: number, rate = 3) => {
    if (S[k] === undefined || !pc.motion) return (S[k] = target);
    return (S[k] += (target - S[k]) * (1 - Math.exp(-dt * rate)));
  };
  const tmp = new THREE.Vector3();
  const hit = (x: number) => (x < 0 ? 0 : x < 0.12 ? x / 0.12 : Math.exp(-(x - 0.12) * 0.9));

  /** 19-0 · 되풀이하는 요청의 빛과 스테이션의 반응. 모션을 끄면 목소리 스테이션 하나만 켜진 장면으로 멈춘다. */
  function requests(loopT: number | null) {
    const act = [0, 0, 0, 0, 0]; let flare = 0, judgeLit = 0, used = 0;
    if (loopT === null) { act[4] = 1; return { act, flare, judgeLit }; }
    const c = ((loopT % REQ_CYCLE) + REQ_CYCLE) % REQ_CYCLE;
    REQUESTS.forEach((st, j) => {
      for (const local of [c - REQ_AT[j], c - REQ_AT[j] + REQ_CYCLE]) {
        // 아직 시작하지 않은 첫 주기 앞의 요청은 그리지 않는다
        if (local < 0 || local > 6 || loopT - local < -1e-6) continue;
        const pk = used < packets.length ? packets[used] : null;
        if (st >= 0) {
          const run = 1.05, hop = 0.35, u = busU[st];
          if (local < run + hop && pk) {
            if (local < run) pk.position.copy(busCurve.getPoint(u * easeInOut(local / run))).setY(0.3);
            else pk.position.copy(busCurve.getPoint(u)).setY(0.3).lerp(tmp.copy(ST_POS[st]).setY(0.95), (local - run) / hop);
            pk.material.opacity = 1; pk.material.color.copy(ICE).multiplyScalar(2.4); used++;
          }
          act[st] = Math.max(act[st], hit(local - run - hop));
        } else {
          const run = 0.8, up = 1.1, down = 1.0;
          judgeLit = Math.max(judgeLit, local < run + up + 0.8 + down ? 1 : 0);
          if (pk && local < run + up + 0.8 + down) {
            if (local < run) pk.position.copy(busCurve.getPoint(centerU * easeInOut(local / run))).setY(0.3);
            else if (local < run + up) pk.position.copy(judgeCurve.getPoint(easeInOut((local - run) / up)));
            else if (local < run + up + 0.8) pk.position.copy(judgeCurve.getPoint(1));
            else pk.position.copy(judgeCurve.getPoint(1 - easeInOut((local - run - up - 0.8) / down)));
            pk.material.opacity = local > run + up && local < run + up + 0.8 ? 0.4 : 1; pk.material.color.copy(WHITE).multiplyScalar(2.6); used++;
          }
          flare = Math.max(flare, hit(local - run - up) * 0.9);
        }
      }
    });
    for (let i = used; i < packets.length; i++) packets[i].material.opacity = 0;
    return { act, flare, judgeLit };
  }

  function update(dt: number) {
    pc.tick(dt);
    const p = pc.phase, t = pc.t, time = pc.clock, ev = (s: number, d: number) => pc.ev(s, d);
    const inside = p >= 5 && p <= 7;

    const k = pc.motion ? easeInOut(clamp01((time - cam.t0) / cam.dur)) : 1;
    eyeNow.lerpVectors(cam.from, cam.eye, k); lookNow.lerpVectors(cam.fromLook, cam.look, k);
    if (pc.motion) { pointerS.lerp(stage.pointer, 1 - Math.exp(-dt * 2)); eyeNow.x += Math.sin(time * 0.17) * 0.2 + pointerS.x * (inside ? 0.3 : 0.5); eyeNow.y += Math.sin(time * 0.21) * 0.08 - pointerS.y * 0.25; }
    camera.position.copy(eyeNow); camera.lookAt(lookNow);
    floorU.uLit.value = follow("floor", 1, dt, 1.2);

    /* 0: 많은 점이 가라앉는다 */
    crowdMat.uniforms.uFade.value = p === 0 ? smooth(1.2, 3.6, t) : 1; crowdMat.uniforms.uTime.value = time;
    crowd.visible = crowdMat.uniforms.uFade.value < 0.999;
    const meIn = p === 0 ? smooth(1.8, 3.2, t) : 1;
    meCoreMat.emissiveIntensity = 0.6 + 3.0 * meIn; (meGlow.material as THREE.SpriteMaterial).opacity = 0.2 + 0.7 * meIn;
    meGlow.scale.setScalar(2.6 + 1.0 * meIn + Math.sin(time * 1.6) * 0.12); meLight.intensity = 1 + 5 * meIn;
    mePoolMat.opacity = 0.12 + 0.3 * meIn;
    me.position.y = ME.y + Math.sin(time * 1.1) * 0.05;

    /* 1: 조건의 고리 */
    const lim = p === 1 ? easeInOut(ev(0.4, 2.2)) : p > 1 ? 1 : 0;
    const limA = follow("limA", p === 1 ? 1 : p > 1 && p < 5 ? 0.18 : 0, dt, 3);
    limits.forEach((l, i) => {
      const e = p === 1 ? easeInOut(ev(0.4 + i * 0.25, 1.6)) : lim;
      const r = l.r0 + (l.r1 - l.r0) * e; l.m.scale.setScalar(r);
      l.mat.opacity = limA * (0.85 - 0.6 * e);
      l.mat.color.copy(ICE).multiplyScalar(1.6 - 0.8 * e);
    });
    lockMat.opacity = follow("lock", p === 1 ? smooth(1.8, 2.6, t) : p > 1 ? 0.55 : 0, dt, 4) * (0.85 + 0.15 * Math.sin(time * 2.4));

    /* 2~4: 흐름. 공장 안(5~7)에서는 가라앉고, 베팅(8~9)에서 다시 보인다. */
    const flowA = follow("flowA", inside ? 0.25 : 1, dt, 2);
    const arcLit = [p >= 2 ? 1 : 0, p >= 3 ? 1 : 0, p >= 3 ? 1 : 0, p >= 4 ? 1 : 0];
    const arcDraw = [
      p === 2 ? easeOut(ev(1.4, 1.4)) : p > 2 ? 1 : 0,
      p === 3 ? easeOut(ev(0.3, 1.1)) : p > 3 ? 1 : 0,
      p === 3 ? easeOut(ev(2.0, 1.1)) : p > 3 ? 1 : 0,
      p === 4 ? easeOut(ev(0.2, 1.2)) : p >= 8 ? 1 : 0,
    ];
    arcs.forEach((a, i) => { a.mat.uniforms.uLit.value = follow(`arc${i}`, arcLit[i], dt, 4) * flowA; a.mat.uniforms.uDraw.value = arcDraw[i]; a.mat.uniforms.uTime.value = time; a.mat.uniforms.uBase.value = follow("arcBase", p >= 2 ? 0.14 : 0, dt, 2); });
    // 요청의 빛이 지금 그려지는 고리의 머리를 따라간다
    const live = p === 2 ? 0 : p === 3 ? (t < 1.6 ? 1 : 2) : p === 4 ? 3 : -1;
    if (live >= 0 && arcDraw[live] > 0 && arcDraw[live] < 1) { packet.position.copy(arcs[live].curve.getPoint(arcDraw[live])).setY(0.35); (packet.material as THREE.SpriteMaterial).opacity = 1; }
    else (packet.material as THREE.SpriteMaterial).opacity = 0;

    // Agent OS
    const osOn = follow("os", p >= 2 ? (p === 2 ? smooth(2.4, 3.1, t) : 1) : 0, dt, 3) * flowA;
    osRingMat.uniforms.uLit.value = 0.25 + 0.75 * osOn; osRingMat.uniforms.uTime.value = time;
    os.visible = p >= 2 || osOn > 0.01;
    osCoreMat.emissiveIntensity = 3 * osOn; (osGlow.material as THREE.SpriteMaterial).opacity = 0.5 * osOn;
    osCore.rotation.y = time * 0.7; osRing2.rotation.z = time * 0.3;
    chips.forEach((c, i) => {
      // 흩어져 있던 맥락이 Agent OS 위에 한 줄로 모인다
      const gather = p === 2 ? easeInOut(ev(2.6 + i * 0.14, 1.2)) : p > 2 ? 1 : 0;
      const a = c.a + time * 0.2;
      tmp.set(OS.x + Math.cos(a) * 3.2, OS.y + 0.4 + Math.sin(a * 2) * 0.3, OS.z + Math.sin(a) * 2.2);
      c.m.position.copy(tmp).lerp(new THREE.Vector3(OS.x + (i - 1.5) * 1.85, OS.y + 1.1, OS.z + 0.2), gather);
      c.m.quaternion.copy(camera.quaternion);
      c.mat.opacity = follow(`chip${i}`, p >= 2 && p <= 4 ? (p === 2 ? smooth(2.2 + i * 0.12, 2.8 + i * 0.12, t) : 0.85) : 0, dt, 4);
    });

    /* 5~9 · 공장 안 */
    const spread = p === 5 ? easeInOut(ev(0.5, 2.3)) : p > 5 ? 1 : 0;
    const req = p === 5 ? requests(pc.motion ? (t < 999 ? t - REQ_START : time) : null) : null;
    if (!req) packets.forEach((pk) => { pk.material.opacity = 0; });
    const newCoreIn = p === 9 ? easeInOut(ev(2.9, 1.3)) : 0;
    const oldCoreOut = p === 9 ? easeInOut(ev(2.5, 1.0)) : 0;
    const stationLevel = (st: number, i: number) => {
      if (p < 5) return -1; // 18번까지의 엔진 규칙을 쓴다
      if (p === 5) return 0.05 + 0.95 * (req?.act[st] ?? 0);
      if (p === 6) return 0.06;
      if (p === 7) return 0.62 + 0.38 * (pc.motion ? 0.5 + 0.5 * Math.sin(time * 1.5 + i * 1.3) : 1);
      return 0.45;
    };
    engines.forEach((e, i) => {
      const st = ENGINE_TO_ST[i];
      e.g.position.lerpVectors(ENGINES[i].pos, ST_POS[st], spread);
      e.g.rotation.y = FACE_Y * spread;
      const lv = stationLevel(st, i);
      let on: number, busy = 0;
      if (lv < 0) {
        on = follow(`eng${i}`, p >= 2 ? (p === 3 ? smooth(1.2 + i * 0.12, 1.8 + i * 0.12, t) : p > 3 ? 1 : 0.35) : 0, dt, 3);
        busy = (p === 3 && i === 0 ? smooth(1.4, 1.9, t) : 0) + (p === 4 && i === 0 ? 0.6 + 0.4 * smooth(2.2, 2.8, t) : 0);
      } else on = follow(`eng${i}`, lv, dt, p === 5 ? 9 : 3);
      const room = lv >= 0; // 공장 안에서는 쉬는 스테이션을 더 어둡게 둔다
      e.glassMat.uniforms.uLit.value = room ? 0.14 + 0.86 * on : 0.3 + 0.7 * on; e.glassMat.uniforms.uColor.value.copy(i === 0 && busy > 0 ? ICE.clone().lerp(GOLD, Math.min(1, busy)) : ICE);
      e.edges.opacity = room ? 0.1 + 0.75 * on : 0.2 + 0.6 * on; e.coreMat.emissiveIntensity = (room ? 0.25 + 3.4 * on : 0.6 + 2.8 * on) + 1.5 * busy;
      const inRoom = lv >= 0 ? Math.max(0, on - 0.25) / 0.75 : 0;
      e.beam.opacity = (p >= 5 && p <= 7 ? 0.9 : 0.25) * inRoom; e.poolMat.opacity = 0.55 * inRoom;
      if (room) { const d6 = follow(`d6e${i}`, p === 6 ? 0.25 : 1, dt, 3); e.glassMat.uniforms.uLit.value *= d6; e.edges.opacity *= d6; e.coreMat.emissiveIntensity *= d6; e.core.scale.setScalar(1 + 0.25 * inRoom); }
      e.labelMat.opacity = on * (1 - spread); e.label.quaternion.copy(camera.quaternion); e.label.visible = spread < 0.99;
      e.core.rotation.y = time * (0.6 + i * 0.1) * (1 + busy + inRoom);
      if (i === 0) { e.coreMat.opacity = 1 - oldCoreOut; e.core.position.y = 0.975 + oldCoreOut * 1.3; e.core.visible = oldCoreOut < 0.999; }
      e.g.visible = p >= 2 || on > 0.01;
    });
    extra.forEach((e, j) => {
      const rise = p === 5 ? easeOut(ev(1.0 + j * 0.3, 1.6)) : p > 5 ? 1 : 0;
      const on = follow(`xst${j}`, stationLevel(e.st, 3 + j), dt, p === 5 ? 9 : 3);
      e.g.position.copy(ST_POS[e.st]).setY(-2.2 * (1 - rise)); e.g.rotation.y = FACE_Y; e.g.visible = rise > 0.001;
      e.glassMat.uniforms.uLit.value = (0.14 + 0.86 * on) * rise; e.edges.opacity = (0.1 + 0.75 * on) * rise; e.coreMat.emissiveIntensity = (0.25 + 3.4 * on) * rise;
      const inRoom = Math.max(0, on - 0.25) / 0.75;
      e.beam.opacity = (p >= 5 && p <= 7 ? 0.9 : 0.25) * inRoom * rise; e.poolMat.opacity = 0.55 * inRoom * rise;
      const d6 = follow(`d6x${j}`, p === 6 ? 0.25 : 1, dt, 3); e.glassMat.uniforms.uLit.value *= d6; e.edges.opacity *= d6; e.coreMat.emissiveIntensity *= d6; e.core.scale.setScalar(1 + 0.25 * inRoom);
      e.core.rotation.y = time * (0.7 + j * 0.15) * (1 + inRoom);
    });
    // 19 · 새 모델이 목소리 스테이션으로 내려온다
    const voice = ST_POS[4];
    newCore.position.copy(voice).setY(0.975 + (1 - newCoreIn) * 1.6); newCore.rotation.y = time * 0.9; newCore.rotation.x = time * 0.4;
    newCoreMat.opacity = newCoreIn; newCoreMat.emissiveIntensity = 3.4 * newCoreIn; newCore.visible = newCoreIn > 0.001;
    const swapPulse = p === 9 ? smooth(3.9, 4.2, t) * (1 - smooth(4.2, 5.6, t)) : 0;
    swapRing.position.copy(voice).setY(0.08); swapRing.scale.setScalar(1 + (p === 9 ? smooth(3.9, 5.6, t) : 0) * 1.6); swapRingMat.opacity = swapPulse * 0.9; swapRing.visible = swapPulse > 0.001;

    // 버스와 입구(구상)
    const busDraw = p === 5 ? easeOut(ev(0.9, 1.6)) : p > 5 ? 1 : 0;
    busMat.uniforms.uDraw.value = busDraw; busMat.uniforms.uTime.value = time;
    busMat.uniforms.uLit.value = follow("bus", p === 5 ? 0.55 : p === 6 ? 0.2 : p === 7 ? 1 : p >= 8 ? 0.35 : 0, dt, 3);
    busMat.uniforms.uBase.value = p >= 5 ? 0.12 : 0; bus.visible = p >= 5;
    routerMat.uniforms.uLit.value = follow("router", p === 5 ? smooth(1.4, 2.2, t) : p >= 8 ? 0.3 : 0, dt, 3); routerMat.uniforms.uTime.value = time; router.visible = p >= 5;

    // 프론티어 문
    const doorIn = p === 5 ? easeOut(ev(1.3, 1.8)) : p > 5 ? 1 : 0;
    door.position.copy(DOOR).setY(DOOR.y + (1 - doorIn) * 1.6 + (pc.motion ? Math.sin(time * 0.6) * 0.05 : 0)); door.visible = doorIn > 0.001;
    const doorLit = follow("door", p === 5 ? 0.7 : p === 6 ? 1 : p === 7 ? 0.6 : 0.8, dt, 3) * doorIn;
    doorFillMat.uniforms.uLit.value = doorLit; doorFillMat.uniforms.uFlare.value = req?.flare ?? 0; doorFillMat.uniforms.uTime.value = time;
    doorFrameMat.opacity = Math.min(1, doorIn * (0.45 + 0.35 * doorLit + (req?.flare ?? 0)));
    (doorGlow.material as THREE.SpriteMaterial).opacity = doorIn * (0.1 + 0.18 * doorLit + 0.55 * (req?.flare ?? 0));
    judgeMat.uniforms.uLit.value = follow("judge", p === 5 ? (req?.judgeLit ?? 0) : p === 6 ? 0.8 : p === 7 ? 0.3 : 0, dt, 5); judgeMat.uniforms.uDraw.value = 1; judgeMat.uniforms.uTime.value = time;
    judge.visible = p >= 5;

    // 영수증: 문 양옆으로 내려와 걸린다
    [codexR, claudeR].forEach((r, i) => {
      const drop = p === 6 ? easeOut(ev(0.6 + i * 0.45, 1.1)) : 0;
      const shown = follow(`rent${i}`, p === 6 ? 1 : 0, dt, p === 6 ? 20 : 4);
      const settle = p === 6 ? Math.sin(clamp01(ev(0.6 + i * 0.45, 1.6)) * Math.PI * 2) * (1 - ev(0.6 + i * 0.45, 1.6)) * 0.06 : 0;
      r.g.position.copy(r.at).setY(r.at.y + (1 - drop) * 3.2 * (p === 6 ? 1 : 0));
      r.g.rotation.z = settle;
      const a = p === 6 ? drop : shown;
      r.mat.opacity = a; r.frameMat.opacity = a * 0.7; r.halo.opacity = a * 0.35; r.g.visible = a > 0.001;
    });

    // 결과와 20번의 결과물 카드
    const outOn = follow("out", p === 3 ? smooth(3.0, 3.6, t) : p === 4 || p >= 8 ? 1 : p >= 5 ? 0 : p > 3 ? 1 : 0, dt, 4);
    outMat.opacity = outOn; outFrameMat.opacity = outOn; (outGlow.material as THREE.SpriteMaterial).opacity = outOn * 0.35;
    outG.quaternion.copy(camera.quaternion); outG.visible = outOn > 0.01;
    outG.position.copy(OUT).setY(OUT.y + (1 - outOn) * -0.4);
    const bet1 = p === 9 ? smooth(0.3, 1.1, t) : 0;
    works.forEach((w, i) => { const a = p === 9 ? smooth(0.5 + i * 0.25, 1.3 + i * 0.25, t) : 0; w.mat.opacity = a; w.frameMat.opacity = a; });
    outFrameMat.color.copy(GOLD).multiplyScalar(1.4 + 1.6 * bet1);

    // 19 · 저에게서 퍼지는 이름
    nameWaves.forEach((w, i) => {
      const on = p === 9 ? smooth(1.3, 1.8, t) : 0;
      const ph = pc.motion ? ((time * 0.42 + i * 0.5) % 1) : 0.45 + i * 0.3;
      w.m.visible = on > 0.001; w.m.scale.setScalar(0.8 + ph * 3.6); w.mat.opacity = on * (1 - ph) * 0.8;
    });
    if (p === 9) { const b = smooth(1.3, 1.8, t); meGlow.scale.multiplyScalar(1 + 0.3 * b); meCoreMat.emissiveIntensity += 1.5 * b; }

    // 4: 되돌림
    redoMat.uniforms.uLit.value = follow("redo", p === 4 ? 1 : 0, dt, 4);
    redoMat.uniforms.uDraw.value = p === 4 ? easeOut(ev(1.4, 1.2)) : 0; redoMat.uniforms.uTime.value = time;
    redo.visible = redoMat.uniforms.uLit.value > 0.01;
    if (p === 4) { const pulse = ev(1.0, 0.8); meGlow.scale.multiplyScalar(1 + Math.sin(pulse * Math.PI) * 0.25); }

    ANCHORS.me.copy(ME).add(tmp.set(0, p <= 1 ? 0.7 : 0.6, 0));
    ANCHORS.crowd.copy(ME).add(tmp.set(3.6, 0.2, -2.6));
    ANCHORS.os.copy(OS).add(tmp.set(0, 1.75, 0));
    ANCHORS.factory.copy(ENGINES[1].pos).add(tmp.set(0, 2.75, 0));
    ANCHORS.tts.copy(ENGINES[0].pos).add(tmp.set(0, 2.6, 0));
    ANCHORS.out.copy(OUT).add(tmp.set(0, outH / 2 + 0.2, 0));
    ANCHORS.redo.copy(redoCurve.getPoint(0.42)).add(tmp.set(0, 0.1, 0));
    // 이웃한 라벨이 겹치지 않도록 높이를 엇갈린다
    ST_IDS.forEach((id, st) => ANCHORS[id].copy(ST_POS[st]).setY(st % 2 ? 2.95 : 2.05));
    ANCHORS.frontier.copy(DOOR).setY(door.position.y + DOOR_H / 2 + 0.3);
    ANCHORS.router.copy(BUS_PTS[0]).setY(0.35);
    ANCHORS.rentCodex.copy(codexR.g.position).add(tmp.set(0, -CODEX_H / 2 - 0.08, 0));
    ANCHORS.rentClaude.copy(claudeR.g.position).add(tmp.set(0, -CLAUDE_H / 2 - 0.08, 0));
    ANCHORS.betOut.copy(OUT).add(tmp.set(0, 0, 0)).addScaledVector(tmp.set(1, 0, 0).applyQuaternion(camera.quaternion), outW / 2 + 0.1);
    ANCHORS.betMe.copy(ME).add(tmp.set(0, 0.2, 0)).addScaledVector(tmp.set(-1, 0, 0).applyQuaternion(camera.quaternion), 0.5);
    ANCHORS.betFactory.copy(voice).setY(2.6);
    dust.rotation.y = time * 0.005;
  }

  stage.start(update, () => pc.motion);

  return {
    setPhase(next) {
      next = Math.max(0, Math.min(PHASES - 1, next));
      if (next === pc.phase) return;
      const forward = pc.go(next);
      cam.from.copy(camera.position); cam.fromLook.copy(lookNow);
      cam.eye.set(...POSES[next].eye); cam.look.set(...POSES[next].look); cam.t0 = pc.clock;
      cam.dur = forward ? (next === 2 ? 2.8 : next === 5 ? 3.0 : next === 8 ? 2.6 : 2.0) : 1.4;
      stage.kick();
    },
    setMotion(on) { pc.setMotion(on); if (!on) { cam.t0 = -1e6; cam.from.copy(cam.eye); cam.fromLook.copy(cam.look); } stage.kick(); },
    setPointer(x, y) { stage.pointer.set(x, y); },
    project: (id) => stage.project(ANCHORS[id]),
    labelAlpha() { if (!pc.motion) return 1; return smooth(0.7, 1, clamp01((pc.clock - cam.t0) / cam.dur)); },
    onFrame: stage.onFrame,
    dispose: stage.dispose,
  };
}
