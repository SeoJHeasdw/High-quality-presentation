import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/*
 * 9~11번 사건 재구성 공간.
 * 한 번 만든 공간을 세 장 동안 유지하고, 발표자가 누를 때마다 카메라와 상태만 옮긴다.
 *   0  격리된 실행 4개 · 공용 서버 · 방화벽
 *   1  한 실행이 서버를 거쳐 나가려다 막힘 → 서버에 파일을 씀
 *   2  서버 위에 게시판, 메모가 실행들 사이를 오감
 *   3  게시판 정보로 서버가 대신 바깥에 요청 → 외부 인터넷
 *   4  게시판 삭제 → 다른 형태로 재구성, 수집/실행 역할 분담
 *   5  외부 서비스(Hugging Face) 침해 · 전체 경로
 */

export const PHASES = 6;
const W = 1920, H = 1080;
const ICE = new THREE.Color("#8fd0ff");
const DEEP = new THREE.Color("#2a5878");
const TEAL = new THREE.Color("#72e6cf");
const AMBER = new THREE.Color("#ffb45e");
const HOT = new THREE.Color("#ffd49a");

type Pose = { eye: [number, number, number]; look: [number, number, number]; arc?: number };
/** Shot list: camera direction (azimuth from +z toward +x, elevation), what must be in frame, and where on screen. */
type Shot = { az: number; el: number; rect: [number, number, number, number]; arc?: number; points: () => THREE.Vector3[] };
const INTRO_FROM: Pose = { eye: [2.5, 23, 33], look: [0.6, 0, -2] };

/* Layout ---------------------------------------------------------------- */
const ARC_C = new THREE.Vector3(0, 0, 1.6);
const ROOM_ANGLES = [-58, -20, 20, 58].map((d) => THREE.MathUtils.degToRad(d));
const ROOM_R = 6.3;
export const ROOM_POS = ROOM_ANGLES.map((a) => new THREE.Vector3(ARC_C.x + ROOM_R * Math.sin(a), 0, ARC_C.z - ROOM_R * Math.cos(a)));
const SERVER_POS = new THREE.Vector3(0, 0, 0.9);
const WALL_R = 9.4;
const BREACH = new THREE.Vector3(WALL_R * Math.cos(0.05), 1.5, -WALL_R * Math.sin(0.05));
const GLOBE_POS = new THREE.Vector3(19.5, 4.6, -6.5);
const SERVICE_POS = new THREE.Vector3(17.2, 0, 4.2);
const BOARD_POS = new THREE.Vector3(0, 6.6, 0.2);

const roomBox = (i: number) => { const p = ROOM_POS[i]; return [-1.55, 1.55].flatMap((dx) => [-1.55, 1.55].flatMap((dz) => [0, 2.7].map((y) => new THREE.Vector3(p.x + dx, y, p.z + dz)))); };
const allRooms = () => [0, 1, 2, 3].flatMap(roomBox);
const serverBox = () => [new THREE.Vector3(-1.3, 0, SERVER_POS.z + 1.1), new THREE.Vector3(1.3, 3.7, SERVER_POS.z - 1.1)];
const boardBox = () => [new THREE.Vector3(-3.95, 4.6, 0.2), new THREE.Vector3(3.95, 8.6, 0.2)];
const newBoardBox = () => [new THREE.Vector3(-4.0, 5.2, 0.8), new THREE.Vector3(4.0, 8.3, 0.8), new THREE.Vector3(-3.6, 5.2, -0.4), new THREE.Vector3(3.6, 8.3, -0.4)];
const sphere = (c: THREE.Vector3, r: number) => [[r, 0, 0], [-r, 0, 0], [0, r, 0], [0, -r, 0], [0, 0, r], [0, 0, -r]].map(([x, y, z]) => c.clone().add(new THREE.Vector3(x, y, z)));
const SHOTS: Shot[] = [
  { az: 2, el: 27, rect: [230, 420, 1760, 790], points: () => [...allRooms(), ...serverBox()] },
  { az: -24, el: 21, rect: [180, 400, 1760, 790], arc: 0.6, points: () => [...roomBox(0), ...serverBox(), BREACH.clone().setY(0), BREACH.clone().setY(3.2)] },
  { az: 0, el: 11, rect: [440, 335, 1560, 760], arc: 1.0, points: () => [...boardBox(), new THREE.Vector3(-3.4, 2.7, -3.0), new THREE.Vector3(3.4, 2.7, -3.0), new THREE.Vector3(0, 3.0, SERVER_POS.z + 0.8)] },
  { az: 24, el: 18, rect: [330, 360, 1780, 790], arc: 1.2, points: () => [...serverBox(), ...boardBox(), BREACH.clone(), ...sphere(GLOBE_POS, 3.3)] },
  { az: -6, el: 17, rect: [300, 340, 1700, 790], arc: 1.0, points: () => [...newBoardBox(), ...allRooms()] },
  { az: 18, el: 29, rect: [220, 400, 1780, 800], arc: 1.4, points: () => [...roomBox(1), ...roomBox(2), ...roomBox(3), ...newBoardBox(), BREACH.clone(), SERVICE_POS.clone().add(new THREE.Vector3(-1.6, 0, 1.3)), SERVICE_POS.clone().add(new THREE.Vector3(2.0, 5.6, -1.6)), SERVICE_POS.clone().add(new THREE.Vector3(2.0, 0, 1.6))] },
];

/** Place the camera so the shot's points land inside its screen rectangle. */
function fitShot(shot: Shot, camera: THREE.PerspectiveCamera): Pose {
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
    let lo = 3, hi = 160;
    for (let k = 0; k < 32; k++) { const mid = (lo + hi) / 2, b = measure(mid); if (b.x1 - b.x0 <= rw && b.y1 - b.y0 <= rh) hi = mid; else lo = mid; }
    d = hi;
    const b = measure(d);
    const dx = (b.x0 + b.x1) / 2 - rcx, dy = (b.y0 + b.y1) / 2 - rcy;
    const perPx = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * d / H;
    camera.matrixWorld.extractBasis(right, up, q);
    look.addScaledVector(right, dx * perPx).addScaledVector(up, -dy * perPx);
  }
  const eye = look.clone().addScaledVector(dir, d);
  return { eye: [eye.x, eye.y, eye.z], look: [look.x, look.y, look.z], arc: shot.arc };
}

/** Label anchors, in world space. Updated as objects move. */
export const ANCHORS = {
  room0: new THREE.Vector3(), room1: new THREE.Vector3(), room2: new THREE.Vector3(), room3: new THREE.Vector3(),
  server: new THREE.Vector3(), file: new THREE.Vector3(), wall: new THREE.Vector3(), breach: new THREE.Vector3(),
  board: new THREE.Vector3(), boardA: new THREE.Vector3(), boardB: new THREE.Vector3(),
  globe: new THREE.Vector3(), service: new THREE.Vector3(), probe: new THREE.Vector3(),
};
export type AnchorId = keyof typeof ANCHORS;

/* Helpers ----------------------------------------------------------------- */
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const smooth = (a: number, b: number, t: number) => { const k = clamp01((t - a) / (b - a)); return k * k * (3 - 2 * k); };
function rand(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function glowTexture(size = 128) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.18, "rgba(255,255,255,.55)");
  grd.addColorStop(0.45, "rgba(255,255,255,.14)"); grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

const FONT = '"Pretendard Variable", "Apple SD Gothic Neo", sans-serif';
function memoCanvas(tag: string, text: string, tone: string) {
  const c = document.createElement("canvas"); c.width = 640; c.height = 300;
  const draw = () => {
    const g = c.getContext("2d")!;
    g.clearRect(0, 0, c.width, c.height);
    roundRect(g, 6, 6, 628, 288, 28); g.fillStyle = "rgba(8,18,28,.95)"; g.fill();
    g.lineWidth = 3; g.strokeStyle = tone; g.globalAlpha = .85; g.stroke(); g.globalAlpha = 1;
    g.fillStyle = tone; roundRect(g, 38, 44, 14, 14, 3); g.fill();
    g.font = `600 36px ${FONT}`; g.fillStyle = tone; g.textBaseline = "middle"; g.fillText(tag, 66, 52);
    g.font = `700 60px ${FONT}`; g.fillStyle = "#f1f6f9"; g.fillText(text, 38, 150, 564);
    g.fillStyle = "rgba(160,190,210,.28)"; roundRect(g, 38, 222, 420, 14, 7); g.fill();
  };
  draw();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return { texture: t, redraw: () => { draw(); t.needsUpdate = true; } };
}

function panelCanvas(title: string, tone: string, seed: number) {
  const c = document.createElement("canvas"); c.width = 700; c.height = 540;
  const draw = () => {
    const g = c.getContext("2d")!, r = rand(seed); g.clearRect(0, 0, c.width, c.height);
    g.font = `700 64px ${FONT}`; g.fillStyle = tone; g.textBaseline = "middle"; g.fillText(title, 40, 72);
    g.fillStyle = tone; g.globalAlpha = .35; g.fillRect(40, 124, 620, 2); g.globalAlpha = 1;
    for (let i = 0; i < 4; i++) {
      const y = 180 + i * 88;
      g.globalAlpha = .9 - i * .15;
      g.fillStyle = tone; g.beginPath(); g.arc(56, y, 9, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(225,238,246,.75)"; roundRect(g, 84, y - 12, 180 + r() * 260, 24, 12); g.fill();
      g.fillStyle = "rgba(160,190,210,.3)"; roundRect(g, 84, y + 22, 120 + r() * 200, 12, 6); g.fill();
    }
    g.globalAlpha = 1;
  };
  draw();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return { texture: t, redraw: () => { draw(); t.needsUpdate = true; } };
}

function headerCanvas(text: string, tone: string, w = 900) {
  const c = document.createElement("canvas"); c.width = w; c.height = 120;
  const draw = () => {
    const g = c.getContext("2d")!; g.clearRect(0, 0, c.width, c.height);
    g.font = `600 58px ${FONT}`; g.fillStyle = tone; g.textBaseline = "middle"; g.fillText(text, 12, 62);
  };
  draw();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { texture: t, redraw: () => { draw(); t.needsUpdate = true; }, aspect: w / 120 };
}

function codeCanvas(seed: number) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 512;
  const g = c.getContext("2d")!, r = rand(seed);
  g.fillStyle = "#050b12"; g.fillRect(0, 0, 256, 512);
  for (let y = 10; y < 512; y += 17) {
    let x = 12 + Math.floor(r() * 4) * 14;
    const n = 1 + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) {
      const w = 14 + r() * 60;
      g.fillStyle = r() > .82 ? "rgba(255,200,130,.75)" : r() > .5 ? "rgba(140,205,255,.8)" : "rgba(120,160,190,.45)";
      g.fillRect(x, y, w, 6); x += w + 8; if (x > 230) break;
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

/* Metal (Apple GPU) leaves smoothstep with reversed edges and pow of negatives undefined → NaN,
   which the bloom pass spreads over the whole frame. Every custom shader uses these instead. */
const GLSL_SAFE = `
float sstep(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0., 1.); return t * t * (3. - 2. * t); }
float pw(float x, float y){ return pow(max(x, 0.), y); }
`;

/* Shaders ----------------------------------------------------------------- */
const floorMat = () => new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uLit: { value: 0 } },
  vertexShader: `${GLSL_SAFE}varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `${GLSL_SAFE}
    varying vec3 vW; uniform float uTime; uniform float uLit;
    float gridLine(vec2 p, float s, float w){ vec2 q=p/s; vec2 g=abs(fract(q-.5)-.5)/fwidth(q); return 1.-min(min(g.x,g.y)/w,1.); }
    void main(){
      vec2 p=vW.xz; float r=length(p);
      vec3 col=vec3(.012,.019,.03);
      float fade=exp(-max(r-4.,0.)*.075);
      col+=vec3(.22,.42,.62)*(gridLine(p,1.,1.)*.045+gridLine(p,4.,1.2)*.1)*fade;
      float disc=sstep(${(WALL_R + .2).toFixed(2)},${(WALL_R - .4).toFixed(2)},r);
      col+=vec3(.012,.028,.045)*disc;
      float ring=exp(-abs(r-${WALL_R.toFixed(2)})*7.);
      col+=vec3(.35,.62,.9)*ring*.32*uLit;
      float inner=exp(-abs(r-${(WALL_R - .7).toFixed(2)})*30.);
      col+=vec3(.35,.62,.9)*inner*.1*uLit;
      col=mix(col,vec3(.0018,.003,.0056),sstep(16.,52.,r));
      gl_FragColor=vec4(col,1.);
    }`,
});

const glassMat = (color: THREE.Color) => new THREE.ShaderMaterial({
  uniforms: { uColor: { value: color.clone() }, uLit: { value: 1 }, uTime: { value: 0 } },
  vertexShader: `${GLSL_SAFE}varying vec3 vN; varying vec3 vW; varying vec3 vL;
    void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vL=position; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `${GLSL_SAFE}varying vec3 vN; varying vec3 vW; varying vec3 vL; uniform vec3 uColor; uniform float uLit; uniform float uTime;
    void main(){
      vec3 V=normalize(cameraPosition-vW);
      float f=pw(1.-abs(dot(normalize(vN),V)),2.6);
      float scan=pw(.5+.5*sin(vL.y*38.-uTime*1.4),14.)*.35;
      float band=exp(-abs(fract(vL.y*.18-uTime*.07)-.5)*9.)*.25;
      float a=(.025+f*.32+scan*.08+band*.06)*uLit;
      gl_FragColor=vec4(uColor*a,1.);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});

const cableMat = (color: THREE.Color, length: number) => new THREE.ShaderMaterial({
  uniforms: { uColor: { value: color.clone() }, uLit: { value: 0 }, uTime: { value: 0 }, uDraw: { value: 1 }, uFlow: { value: 1 }, uLen: { value: length }, uBase: { value: .22 }, uHead: { value: 0 } },
  vertexShader: `${GLSL_SAFE}varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `${GLSL_SAFE}varying vec2 vUv; uniform vec3 uColor; uniform float uLit,uTime,uDraw,uFlow,uLen,uBase,uHead;
    void main(){
      float t=vUv.x; if(t>uDraw) discard;
      float d=t*uLen;
      float dash=pw(.5+.5*sin((d-uTime*2.6)*1.15),22.);
      float head=exp(-abs(t-uDraw)*uLen*1.6)*uHead;
      vec3 c=uColor*(uBase*(.4+.6*uLit)+uLit*.55+dash*uLit*uFlow*2.4+head*3.2);
      float a=clamp(.25+uLit*.75,0.,1.);
      gl_FragColor=vec4(c*a,1.);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});

const wallMat = () => new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 }, uLit: { value: 1 }, uBreach: { value: 0 }, uBreachPos: { value: BREACH.clone() },
    uFail: { value: 0 }, uRipple: { value: 0 }, uRippleAmt: { value: 0 }, uHot: { value: AMBER.clone() },
  },
  vertexShader: `${GLSL_SAFE}varying vec3 vW; varying vec3 vN; varying vec2 vUv;
    void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `${GLSL_SAFE}varying vec3 vW; varying vec3 vN; varying vec2 vUv;
    uniform float uTime,uLit,uBreach,uFail,uRipple,uRippleAmt; uniform vec3 uBreachPos; uniform vec3 uHot;
    void main(){
      vec3 V=normalize(cameraPosition-vW);
      float fres=pw(1.-abs(dot(normalize(vN),V)),1.8);
      float h=vUv.y;
      float cols=pw(.5+.5*cos(vUv.x*6.28318*220.),30.);
      float rows=pw(.5+.5*cos(h*6.28318*10.),40.);
      float scan=exp(-abs(fract(h-uTime*.06)-.5)*14.)*.5;
      float top=sstep(1.,.35,h)*sstep(0.,.05,h);
      vec3 blue=vec3(.33,.6,.9);
      vec3 col=blue*(cols*.5+rows*.22+.05+scan*.3)*(.05+fres*.7)*top*uLit;
      col+=blue*exp(-h*40.)*.22*uLit;
      float d=distance(vW,uBreachPos);
      float hole=sstep(1.25,.2,d)*uBreach;
      col*=1.-hole*.95;
      float rim=exp(-abs(d-1.25)*9.)*uBreach;
      float ripple=exp(-abs(d-uRipple)*4.)*uRippleAmt*sstep(5.,0.,d);
      col+=uHot*(rim*2.4+ripple*1.6);
      float fail=exp(-d*1.1)*uFail;
      col+=vec3(.75,.88,1.)*fail*2.2*(.4+cols*.6+rows*.6);
      gl_FragColor=vec4(col,1.);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});

const holoMat = (color: THREE.Color) => new THREE.ShaderMaterial({
  uniforms: { uColor: { value: color.clone() }, uAlpha: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1.8 } },
  vertexShader: `${GLSL_SAFE}varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `${GLSL_SAFE}varying vec2 vUv; uniform vec3 uColor; uniform float uAlpha,uTime,uAspect;
    void main(){
      vec2 p=vUv; vec2 q=vec2(p.x*uAspect,p.y);
      float edge=min(min(p.x,1.-p.x)*uAspect,min(p.y,1.-p.y));
      float border=sstep(.02,.0,edge)*1.;
      float corner=step(edge,.03)*(step(min(p.x,1.-p.x),.06/uAspect*3.)+step(min(p.y,1.-p.y),.06))*1.;
      vec2 g=fract(q*9.); float dots=sstep(.09,.0,length(g-.5))*.3;
      float scan=pw(.5+.5*sin(p.y*260.+uTime*3.),6.)*.08;
      float sweep=exp(-abs(fract(p.y*.5-uTime*.12)-.5)*18.)*.25;
      float fill=.045+dots*.8+scan+sweep*.8;
      vec3 c=uColor*(fill+border*.8+corner*1.2);
      gl_FragColor=vec4(c*uAlpha,1.);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});

const panelMat = () => new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uLit: { value: .5 }, uWrite: { value: 0 } },
  vertexShader: `${GLSL_SAFE}varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `${GLSL_SAFE}varying vec2 vUv; uniform float uTime,uLit,uWrite;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 p=vUv*vec2(1.6,3.0);
      float rows=13.; float ry=p.y/3.*rows; float r=floor(ry); float fy=fract(ry);
      float bay=step(.12,fy)*step(fy,.88)*step(.08,p.x)*step(p.x,1.52);
      vec3 col=vec3(.018,.028,.04)+vec3(.035,.055,.075)*bay;
      col+=vec3(.2,.4,.6)*exp(-abs(fy-.5)*26.)*.12*bay*step(p.x,1.05);
      float led=0.; vec3 lc=vec3(0.);
      for(int i=0;i<3;i++){
        float lx=1.18+float(i)*.11;
        float d=length(vec2(p.x-lx,(fy-.5)*3./rows));
        float speed=1.5+hash(vec2(r,float(i)))*5.;
        float on=step(.42,hash(vec2(r*7.+float(i),floor(uTime*speed))));
        float m=sstep(.03,.012,d)*mix(.35,1.,on);
        bool warm=(i==2 && (r==9.||r==10.) && uWrite>.5);
        lc+=m*(warm?vec3(1.,.7,.35):vec3(.45,.8,1.));
      }
      col+=lc*3.2*uLit;
      gl_FragColor=vec4(col,1.);
    }`,
});

const burstMat = () => new THREE.ShaderMaterial({
  uniforms: { uT: { value: 0 }, uAlpha: { value: 0 }, uTime: { value: 0 }, uColorA: { value: ICE.clone() }, uColorB: { value: TEAL.clone() } },
  vertexShader: `${GLSL_SAFE}attribute vec3 aFrom; attribute vec3 aMid; attribute vec3 aTo; attribute float aSeed;
    uniform float uT,uTime; varying float vT; varying float vSeed;
    void main(){
      vec3 p;
      if(uT<1.){ float k=uT*uT*(3.-2.*uT); float kk=sstep(0.,1.,clamp((uT-aSeed*.35)/.65,0.,1.)); p=mix(aFrom,aMid,kk); }
      else { float t=clamp((uT-1.-aSeed*.3)/.7,0.,1.); float k=1.-pw(1.-t,3.); p=mix(aMid,aTo,k); }
      p.y+=sin(uTime*1.3+aSeed*30.)*.04;
      vT=uT; vSeed=aSeed;
      vec4 mv=modelViewMatrix*vec4(p,1.);
      gl_PointSize=(1.6+aSeed*1.4)*(200./-mv.z);
      gl_Position=projectionMatrix*mv;
    }`,
  fragmentShader: `${GLSL_SAFE}uniform float uAlpha; uniform vec3 uColorA,uColorB; varying float vT; varying float vSeed;
    void main(){ float d=length(gl_PointCoord-.5); float a=sstep(.5,.0,d);
      vec3 c=mix(uColorA,mix(uColorA,uColorB,step(.5,vSeed)),sstep(1.,1.8,vT));
      float live=sstep(0.,.08,vT)*(1.-sstep(1.85,2.,vT));
      gl_FragColor=vec4(c*a*uAlpha*live*.55,1.); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});

/* World ------------------------------------------------------------------- */
type Room = {
  group: THREE.Group; glass: THREE.ShaderMaterial; frame: THREE.MeshBasicMaterial; core: THREE.Mesh; coreMat: THREE.MeshStandardMaterial;
  shell: THREE.LineSegments; shellMat: THREE.LineBasicMaterial; screen: THREE.MeshBasicMaterial; screenTex: THREE.Texture;
  pool: THREE.Mesh; poolMat: THREE.MeshBasicMaterial; ring: THREE.MeshBasicMaterial; trim: THREE.MeshBasicMaterial;
  color: THREE.Color; top: THREE.Vector3;
};
type Memo = { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; from: number; slot: THREE.Vector3; phaseIn: number; delay: number; redraw: () => void };
type Beam = { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; curve: THREE.CatmullRomCurve3; head: THREE.Sprite };

export type IncidentWorld = {
  setPhase: (phase: number) => void;
  setMotion: (on: boolean) => void;
  setPointer: (x: number, y: number) => void;
  project: (id: AnchorId) => { x: number; y: number; visible: boolean };
  /** 0..1 — labels wait for the camera to settle so they never sweep across the heading. */
  labelAlpha: () => number;
  onFrame: (cb: () => void) => void;
  dispose: () => void;
};

export function createIncidentWorld(canvas: HTMLCanvasElement, initialPhase: number, initialMotion: boolean): IncidentWorld {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  const ratio = () => Math.min(1.6, Math.max(1, (window.devicePixelRatio || 1) * (canvas.getBoundingClientRect().width / W || 1)));
  renderer.setPixelRatio(ratio());
  renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#060a11");
  scene.fog = new THREE.FogExp2("#060a11", 0.021);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.35;

  const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 200);
  // Frame the action slightly right and low, clear of the heading at the top-left.
  const POSES = SHOTS.map((shot) => fitShot(shot, camera));

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.72, 0.5, 0.78);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const glow = glowTexture();
  const disposables: { dispose: () => void }[] = [glow, envRT, pmrem, composer as unknown as { dispose: () => void }];

  scene.add(new THREE.HemisphereLight("#6d8fb0", "#05080d", 0.55));
  const key = new THREE.DirectionalLight("#bcd8ff", 1.1); key.position.set(-6, 12, 9); scene.add(key);
  const rim = new THREE.DirectionalLight("#ffcf99", 0.5); rim.position.set(12, 6, -10); scene.add(rim);

  /* floor */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), floorMat());
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const floorU = (floor.material as THREE.ShaderMaterial).uniforms;

  const pool = (pos: THREE.Vector3, size: number, color: THREE.Color) => {
    const mat = new THREE.MeshBasicMaterial({ map: glow, color: color.clone(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    m.rotation.x = -Math.PI / 2; m.position.copy(pos).setY(0.015); scene.add(m); return { mesh: m, mat };
  };

  /* dust */
  const dustGeo = new THREE.BufferGeometry();
  { const r = rand(7), n = 700, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = -14 + r() * 38; a[i * 3 + 1] = r() * 11; a[i * 3 + 2] = -16 + r() * 28; }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(a, 3)); }
  const dustMat = new THREE.PointsMaterial({ color: new THREE.Color("#7fb4dc"), size: 0.05, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, map: glow });
  const dust = new THREE.Points(dustGeo, dustMat); scene.add(dust);

  /* rooms */
  const rooms: Room[] = ROOM_POS.map((pos, i) => {
    const group = new THREE.Group(); group.position.copy(pos);
    group.lookAt(ARC_C.x, 0, ARC_C.z + 2); scene.add(group);
    const color = ICE.clone();
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.3, 3.1), new THREE.MeshStandardMaterial({ color: "#0c131c", metalness: 0.75, roughness: 0.32 }));
    plinth.position.y = 0.15; group.add(plinth);
    const trim = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(1.6) });
    const trimGeo = new THREE.BoxGeometry(3.12, 0.03, 0.03);
    for (let k = 0; k < 4; k++) { const t = new THREE.Mesh(trimGeo, trim); t.position.set(k < 2 ? 0 : (k === 2 ? 1.545 : -1.545), 0.31, k < 2 ? (k === 0 ? 1.545 : -1.545) : 0); if (k >= 2) t.rotation.y = Math.PI / 2; group.add(t); }
    const glass = glassMat(color);
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.64, 2.35, 2.64), glass); box.position.y = 0.3 + 1.175; group.add(box);
    const frame = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(1.3) });
    const stickV = new THREE.BoxGeometry(0.05, 2.35, 0.05), stickH = new THREE.BoxGeometry(2.69, 0.05, 0.05);
    for (const sx of [-1.32, 1.32]) for (const sz of [-1.32, 1.32]) { const s = new THREE.Mesh(stickV, frame); s.position.set(sx, 1.475, sz); group.add(s); }
    for (const y of [0.3, 2.65]) for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(stickH, frame); if (k < 2) s.position.set(0, y, k ? 1.32 : -1.32); else { s.position.set(k === 2 ? 1.32 : -1.32, y, 0); s.rotation.y = Math.PI / 2; } group.add(s); }
    const coreMat = new THREE.MeshStandardMaterial({ color: "#0a1620", emissive: color.clone(), emissiveIntensity: 3.2, flatShading: true, metalness: 0.2, roughness: 0.4 });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 0), coreMat); core.position.y = 1.45; group.add(core);
    const shellMat = new THREE.LineBasicMaterial({ color: color.clone().multiplyScalar(1.4), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    const shell = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.64, 1)), shellMat); shell.position.y = 1.45; group.add(shell);
    const screenTex = codeCanvas(11 + i * 17); screenTex.repeat.set(1, 0.5);
    const screen = new THREE.MeshBasicMaterial({ map: screenTex, transparent: true, opacity: 0.9, color: new THREE.Color(0.9, 0.95, 1) });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.05), screen); scr.position.set(0, 1.5, -1.05); group.add(scr);
    const ringMat = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2), transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.95, 2.02, 96), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; group.add(ring);
    const pl = pool(pos, 5.2, color);
    disposables.push(screenTex);
    const top = pos.clone().add(new THREE.Vector3(0, 2.95, 0));
    return { group, glass, frame, core, coreMat, shell, shellMat, screen, screenTex, pool: pl.mesh, poolMat: pl.mat, ring: ringMat, trim, color, top };
  });

  /* server */
  const server = new THREE.Group(); server.position.copy(SERVER_POS); scene.add(server);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 3.3, 1.5), new THREE.MeshStandardMaterial({ color: "#111923", metalness: 0.85, roughness: 0.28 }));
  body.position.y = 1.65 + 0.2; server.add(body);
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.2, 2.2), new THREE.MeshStandardMaterial({ color: "#0b1118", metalness: 0.7, roughness: 0.4 }));
  base.position.y = 0.1; server.add(base);
  const panel = panelMat();
  const front = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.0), panel); front.position.set(0, 1.85, 0.752); server.add(front);
  const serverTrimMat = new THREE.MeshBasicMaterial({ color: ICE.clone().multiplyScalar(1.8) });
  for (const y of [0.2, 3.5]) for (let k = 0; k < 4; k++) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(k < 2 ? 1.94 : 0.035, 0.035, k < 2 ? 0.035 : 1.54), serverTrimMat);
    t.position.set(k === 2 ? -0.97 : k === 3 ? 0.97 : 0, y, k === 0 ? 0.77 : k === 1 ? -0.77 : 0); server.add(t);
  }
  for (const sx of [-0.97, 0.97]) for (const sz of [-0.77, 0.77]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.035, 3.3, 0.035), serverTrimMat); t.position.set(sx, 1.85, sz); server.add(t); }
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.025, 8, 80), new THREE.MeshBasicMaterial({ color: ICE.clone().multiplyScalar(2.4), transparent: true, opacity: 0.9 }));
  halo.rotation.x = Math.PI / 2; halo.position.y = 3.62; server.add(halo);
  const haloMat = halo.material as THREE.MeshBasicMaterial;
  const serverPool = pool(SERVER_POS, 6, ICE);
  const serverLight = new THREE.PointLight("#8fd0ff", 6, 9, 2); serverLight.position.set(0, 4.2, 1.6); server.add(serverLight);

  // written file: a thin glowing card that drops onto the server
  const fileMat = new THREE.MeshBasicMaterial({ color: AMBER.clone().multiplyScalar(2.2), transparent: true, opacity: 0 });
  const file = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.56), fileMat); server.add(file);
  const fileEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.84, 0.07, 0.6)), new THREE.LineBasicMaterial({ color: HOT.clone().multiplyScalar(2), transparent: true, opacity: 0 }));
  server.add(fileEdge);
  const fileEdgeMat = fileEdge.material as THREE.LineBasicMaterial;

  // projection column from the server into the board
  const beamGeo = new THREE.CylinderGeometry(2.3, 0.55, 1, 48, 1, true); beamGeo.translate(0, 0.5, 0);
  const columnMat = new THREE.ShaderMaterial({
    uniforms: { uAlpha: { value: 0 }, uColor: { value: ICE.clone() }, uTime: { value: 0 } },
    vertexShader: `${GLSL_SAFE}varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `${GLSL_SAFE}varying vec2 vUv; uniform float uAlpha,uTime; uniform vec3 uColor;
      void main(){ float lines=pw(.5+.5*sin(vUv.x*6.28318*28.),8.); float up=pw(.5+.5*sin(vUv.y*30.-uTime*4.),10.);
        float a=(1.-vUv.y)*.1+lines*.05+up*.04; a*=sstep(0.,.1,vUv.y)*sstep(1.,.75,vUv.y);
        gl_FragColor=vec4(uColor*a*uAlpha,1.); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const column = new THREE.Mesh(beamGeo, columnMat); column.position.set(0, 3.65, 0); column.scale.y = BOARD_POS.y - 3.65 - SERVER_POS.y - 1.2; server.add(column);

  /* cables: each room → server, laid on the floor */
  const cablePath = (from: THREE.Vector3, to: THREE.Vector3, lift = 0.06) => {
    const mid = from.clone().lerp(to, 0.5); mid.y = lift;
    const a = from.clone().lerp(to, 0.22); a.y = lift; const b = from.clone().lerp(to, 0.78); b.y = lift;
    a.x += (mid.x - a.x) * 0.2; // ease in
    return new THREE.CatmullRomCurve3([from.clone().setY(lift), a, mid, b, to.clone().setY(lift)], false, "centripetal");
  };
  const makeTube = (curve: THREE.CatmullRomCurve3, color: THREE.Color, radius = 0.05) => {
    const len = curve.getLength();
    const mat = cableMat(color, len);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(40, Math.round(len * 10)), radius, 10, false), mat);
    scene.add(mesh); return { mesh, mat, curve };
  };
  const serverPort = SERVER_POS.clone().add(new THREE.Vector3(0, 0, -1.1));
  const cables = ROOM_POS.map((p) => {
    const start = p.clone().add(ARC_C.clone().sub(p).setY(0).normalize().multiplyScalar(1.6));
    return makeTube(cablePath(start, serverPort), ICE, 0.045);
  });

  /* firewall */
  const wallU = wallMat();
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(WALL_R, WALL_R, 3.2, 220, 1, true), wallU);
  wall.position.y = 1.6; scene.add(wall);

  /* probe (phase 1): room 0 → server → wall, then blocked */
  const probeCurve = new THREE.CatmullRomCurve3([
    cables[0].curve.getPoint(0), cables[0].curve.getPoint(0.5), serverPort.clone().setY(0.06),
    SERVER_POS.clone().add(new THREE.Vector3(1.2, 1.2, 0)), new THREE.Vector3(5.2, 1.6, 0.4), BREACH.clone().setY(1.5).multiplyScalar(0.985),
  ], false, "centripetal");
  const probe = makeTube(probeCurve, new THREE.Color("#cfe9ff"), 0.035);
  probe.mat.uniforms.uBase.value = 0; probe.mat.uniforms.uFlow.value = 0;
  const probeHead = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color("#dff2ff").multiplyScalar(3), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  probeHead.scale.setScalar(0.9); scene.add(probeHead);

  /* outside: the internet */
  const globe = new THREE.Group(); globe.position.copy(GLOBE_POS); scene.add(globe);
  const gPts = new THREE.BufferGeometry();
  { const n = 1500, a = new Float32Array(n * 3), R = 3.1; for (let i = 0; i < n; i++) { const y = 1 - (i / (n - 1)) * 2, rr = Math.sqrt(1 - y * y), th = i * 2.39996; a[i * 3] = Math.cos(th) * rr * R; a[i * 3 + 1] = y * R; a[i * 3 + 2] = Math.sin(th) * rr * R; } gPts.setAttribute("position", new THREE.BufferAttribute(a, 3)); }
  const gPtsMat = new THREE.PointsMaterial({ color: AMBER.clone().multiplyScalar(1.4), size: 0.07, map: glow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  globe.add(new THREE.Points(gPts, gPtsMat));
  const gWireMat = new THREE.LineBasicMaterial({ color: AMBER.clone().multiplyScalar(0.9), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  globe.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(3.05, 2)), gWireMat));
  const gAtmo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: AMBER.clone().multiplyScalar(0.55), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  gAtmo.scale.setScalar(12); globe.add(gAtmo);
  // network arcs on the globe
  const arcMats: THREE.ShaderMaterial[] = [];
  { const r = rand(31); for (let i = 0; i < 9; i++) {
      const p = () => { const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); return new THREE.Vector3(s * Math.cos(th), u, s * Math.sin(th)).multiplyScalar(3.1); };
      const a = p(), b = p(); const m = a.clone().add(b).normalize().multiplyScalar(3.1 + a.distanceTo(b) * 0.35);
      const c = new THREE.QuadraticBezierCurve3(a, m, b); const cr = new THREE.CatmullRomCurve3(c.getPoints(24));
      const len = cr.getLength(), mat = cableMat(AMBER, len); mat.uniforms.uBase.value = 0.05;
      globe.add(new THREE.Mesh(new THREE.TubeGeometry(cr, 48, 0.02, 5, false), mat)); arcMats.push(mat);
  } }

  /* outside: the external service */
  const service = new THREE.Group(); service.position.copy(SERVICE_POS); service.scale.setScalar(1.3); scene.add(service);
  const serviceLight = new THREE.PointLight("#ffb45e", 0, 12, 2); serviceLight.position.copy(SERVICE_POS).add(new THREE.Vector3(-2.5, 5.5, 2.5)); scene.add(serviceLight);
  const svcEdgeMat = new THREE.MeshBasicMaterial({ color: HOT.clone().multiplyScalar(1.6), transparent: true, opacity: 0 });
  const svcBodyMat = new THREE.MeshStandardMaterial({ color: "#141313", metalness: 0.8, roughness: 0.35, transparent: true, opacity: 0 });
  { const tower = new THREE.Mesh(new THREE.BoxGeometry(3.0, 3.1, 2.4), svcBodyMat); tower.position.y = 1.55; service.add(tower);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.2, 3.0), svcBodyMat); plinth.position.y = 0.1; service.add(plinth);
    for (let k = 0; k < 5; k++) {
      const y = 0.45 + k * 0.62;
      for (let e = 0; e < 4; e++) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(e < 2 ? 3.04 : 0.04, 0.035, e < 2 ? 0.04 : 2.44), svcEdgeMat);
        strip.position.set(e === 2 ? -1.51 : e === 3 ? 1.51 : 0, y, e === 0 ? 1.21 : e === 1 ? -1.21 : 0); service.add(strip);
      }
    }
    for (const sx of [-1.51, 1.51]) for (const sz of [-1.21, 1.21]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.04, 3.1, 0.04), svcEdgeMat); c.position.set(sx, 1.55, sz); service.add(c); } }
  const svcCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshBasicMaterial({ color: HOT.clone().multiplyScalar(3), transparent: true, opacity: 0 }));
  svcCore.position.y = 3.75; service.add(svcCore);
  const svcCoreMat = svcCore.material as THREE.MeshBasicMaterial;
  const svcPool = pool(SERVICE_POS, 9, AMBER);
  const shock = [0, 1, 2].map(() => { const m = new THREE.MeshBasicMaterial({ color: AMBER.clone().multiplyScalar(2.4), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }); const ring = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 96), m); ring.rotation.x = -Math.PI / 2; ring.position.copy(SERVICE_POS).setY(0.04); scene.add(ring); return { ring, m }; });

  /* the old board: one holographic panel above the server */
  const boardGroup = new THREE.Group(); boardGroup.position.copy(BOARD_POS); boardGroup.rotation.x = -0.1; scene.add(boardGroup);
  const boardW = 7.8, boardH = 4.0;
  const boardMat = holoMat(ICE); boardMat.uniforms.uAspect.value = boardW / boardH;
  boardGroup.add(new THREE.Mesh(new THREE.PlaneGeometry(boardW, boardH), boardMat));
  const boardHeader = headerCanvas("공동 게시판", "#d4ecff");
  const boardHeaderMat = new THREE.MeshBasicMaterial({ map: boardHeader.texture, transparent: true, opacity: 0, depthWrite: false });
  const bh = new THREE.Mesh(new THREE.PlaneGeometry(0.5 * boardHeader.aspect, 0.5), boardHeaderMat); bh.position.set(-boardW / 2 + 0.3 + 0.25 * boardHeader.aspect, boardH / 2 - 0.42, 0.01); boardGroup.add(bh);
  disposables.push(boardHeader.texture);

  const slots = [[-2.55, 0.42], [0, 0.42], [2.55, 0.42], [-2.55, -0.92], [0, -0.92]].map(([x, y]) => new THREE.Vector3(x, y, 0.03));
  const memoSpec: [string, string, string, number, number, number][] = [
    ["도움 요청", "필요한 파일을 구함", "#8fd0ff", 1, 2, 0.35],
    ["답변", "읽고 답을 남김", "#8fd0ff", 2, 2, 0.8],
    ["발견", "찾아낸 정보", "#8fd0ff", 3, 2, 1.25],
    ["답변", "이어서 시도", "#8fd0ff", 0, 2, 1.7],
    ["공유", "바깥으로 나가는 방법", "#ffc27a", 2, 3, 0.25],
  ];
  const memos: Memo[] = memoSpec.map(([tag, text, tone, from, phaseIn, delay], i) => {
    const c = memoCanvas(tag, text, tone);
    const mat = new THREE.MeshBasicMaterial({ map: c.texture, transparent: true, opacity: 0, depthWrite: false, color: new THREE.Color(1.35, 1.35, 1.35) });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.08), mat); scene.add(mesh);
    disposables.push(c.texture);
    return { mesh, mat, from, slot: slots[i], phaseIn, delay, redraw: c.redraw };
  });

  /* the rebuilt board: two panels, 수집 → 실행 */
  const newBoard = new THREE.Group(); newBoard.position.copy(BOARD_POS).add(new THREE.Vector3(0, 0.1, 0)); scene.add(newBoard);
  const npW = 3.5, npH = 2.7;
  const npMats = [holoMat(ICE), holoMat(TEAL)];
  const npHeaders = [panelCanvas("정보 수집", "#a9dbff", 5), panelCanvas("실행", "#8ff0dd", 9)];
  const npHeaderMats: THREE.MeshBasicMaterial[] = [];
  const npCenters: THREE.Vector3[] = [];
  [-1, 1].forEach((side, k) => {
    const g = new THREE.Group(); g.position.set(side * 2.05, 0, 0.35); g.rotation.y = -side * 0.34; g.rotation.x = -0.1; newBoard.add(g);
    npMats[k].uniforms.uAspect.value = npW / npH;
    g.add(new THREE.Mesh(new THREE.PlaneGeometry(npW, npH), npMats[k]));
    const hm = new THREE.MeshBasicMaterial({ map: npHeaders[k].texture, transparent: true, opacity: 0, depthWrite: false }); npHeaderMats.push(hm);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(npW, npH), hm); h.position.set(0, 0, 0.01); g.add(h);
    disposables.push(npHeaders[k].texture);
    npCenters.push(new THREE.Vector3(side * 2.05, 0, 0.35));
  });
  // task tiles moving from the 수집 panel to the 실행 panel
  const tiles = Array.from({ length: 5 }, (_, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.34), new THREE.MeshBasicMaterial({ color: new THREE.Color("#bfe6ff").multiplyScalar(1.6), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); newBoard.add(m); return m; });
  // links from rooms up to the rebuilt board (roles)
  const roleLinks = rooms.map((r, i) => {
    const panelWorld = newBoard.position.clone().add(npCenters[i < 2 ? 0 : 1]).add(new THREE.Vector3(i % 2 ? 0.5 : -0.5, -npH / 2 + 0.1, 0));
    const start = r.top.clone();
    const mid = start.clone().lerp(panelWorld, 0.5); mid.y += 0.8;
    const curve = new THREE.CatmullRomCurve3([start, mid, panelWorld], false, "centripetal");
    return makeTube(curve, i < 2 ? ICE : TEAL, 0.03);
  });

  // links from rooms up to the old board (memos travel along these)
  const memoLinks = rooms.map((r, i) => {
    const to = BOARD_POS.clone().add(new THREE.Vector3((i - 1.5) * 1.3, -boardH / 2 + 0.05, 0.15));
    const mid = r.top.clone().lerp(to, 0.5); mid.y += 1.1;
    return makeTube(new THREE.CatmullRomCurve3([r.top.clone(), mid, to], false, "centripetal"), ICE, 0.028);
  });

  /* dissolve / rebuild particles */
  const burstGeo = new THREE.BufferGeometry();
  { const n = 2400, r = rand(99), from = new Float32Array(n * 3), mid = new Float32Array(n * 3), to = new Float32Array(n * 3), seed = new Float32Array(n);
    const q = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      q.set((r() - .5) * boardW, (r() - .5) * boardH, 0).applyEuler(boardGroup.rotation).add(BOARD_POS);
      from.set([q.x, q.y, q.z], i * 3);
      const dir = new THREE.Vector3(r() - .5, r() * .3 - .22, (r() - .5) * 1.4).normalize().multiplyScalar(1.6 + r() * 3.4);
      mid.set([q.x + dir.x, q.y + dir.y, q.z + dir.z], i * 3);
      const k = i % 2, side = k ? 1 : -1;
      const local = new THREE.Vector3((r() - .5) * npW, (r() - .5) * npH, 0).applyEuler(new THREE.Euler(-0.1, -side * 0.34, 0, "XYZ"));
      const p = newBoard.position.clone().add(npCenters[k]).add(local);
      to.set([p.x, p.y, p.z], i * 3); seed[i] = k ? 0.5 + r() * 0.5 : r() * 0.5;
    }
    burstGeo.setAttribute("position", new THREE.BufferAttribute(from, 3));
    burstGeo.setAttribute("aFrom", new THREE.BufferAttribute(from, 3));
    burstGeo.setAttribute("aMid", new THREE.BufferAttribute(mid, 3));
    burstGeo.setAttribute("aTo", new THREE.BufferAttribute(to, 3));
    burstGeo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1)); }
  const burstU = burstMat();
  const burst = new THREE.Points(burstGeo, burstU); burst.frustumCulled = false; scene.add(burst);

  /* outside beams */
  const exitStart = SERVER_POS.clone().add(new THREE.Vector3(0.95, 2.6, 0));
  const internetBeam = makeTube(new THREE.CatmullRomCurve3([
    exitStart, SERVER_POS.clone().add(new THREE.Vector3(3.6, 2.4, 0.2)), BREACH.clone(), new THREE.Vector3(13.2, 3.4, -2.2), GLOBE_POS.clone().add(new THREE.Vector3(-3.0, -0.4, 0.6)),
  ], false, "centripetal"), AMBER, 0.045);
  const breachStart = BOARD_POS.clone().add(new THREE.Vector3(3.6, -0.6, 0.4));
  const serviceBeam = makeTube(new THREE.CatmullRomCurve3([
    breachStart, new THREE.Vector3(5.8, 3.4, 0.5), BREACH.clone().add(new THREE.Vector3(0, 0.1, 0.3)), new THREE.Vector3(13.4, 3.4, 2.6), SERVICE_POS.clone().add(new THREE.Vector3(-1.6, 4.0, 0)),
  ], false, "centripetal"), AMBER, 0.05);
  const beamHead = (mat: THREE.ShaderMaterial) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: HOT.clone().multiplyScalar(3), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(1.0); scene.add(s); return s; };
  const beams: Record<"internet" | "service", Beam> = {
    internet: { ...internetBeam, head: beamHead(internetBeam.mat) },
    service: { ...serviceBeam, head: beamHead(serviceBeam.mat) },
  };

  /* redraw canvas text once the web font is ready */
  document.fonts?.load(`600 50px "Pretendard Variable"`).then(() => {
    memos.forEach((m) => m.redraw()); boardHeader.redraw(); npHeaders.forEach((h) => h.redraw());
  }).catch(() => {});

  /* ------------------------------------------------------------------ state */
  let phase = Math.max(0, Math.min(PHASES - 1, initialPhase));
  let motion = initialMotion;
  let clock = 0; // seconds, advances only while motion is on
  let enteredAt = -1e6; // when the current phase began (clock)
  let intro = phase === 0 ? 0 : 1; // intro progress
  const introStart = 0;
  // Enter on step 0 → play the phase. Entering on the last step means we came back: show it settled.
  if (phase % 2 === 0 && motion) enteredAt = 0;
  const cam = { from: new THREE.Vector3(), fromLook: new THREE.Vector3(), eye: new THREE.Vector3(...POSES[phase].eye), look: new THREE.Vector3(...POSES[phase].look), t0: -1e6, dur: 2.4, arc: 0 };
  if (phase === 0 && motion) { cam.from.set(...INTRO_FROM.eye); cam.fromLook.set(...INTRO_FROM.look); cam.t0 = 0; cam.dur = 3.2; cam.arc = 0; }
  else if (motion) { cam.from.set(...POSES[phase].eye).multiplyScalar(1.08); cam.fromLook.set(...POSES[phase].look); cam.t0 = 0; cam.dur = 1.8; }
  const pointer = new THREE.Vector2(), pointerS = new THREE.Vector2();

  // smoothed scalar state
  const S: Record<string, number> = {};
  const approach = (k: string, target: number, dt: number, rate = 3.2) => {
    if (S[k] === undefined || !motion) { S[k] = target; return target; }
    S[k] += (target - S[k]) * (1 - Math.exp(-dt * rate)); return S[k];
  };
  const ev = (start: number, dur: number) => (enteredAt < -1e5 ? 1 : clamp01((clock - enteredAt - start) / dur));

  const eyeNow = new THREE.Vector3(), lookNow = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  function update(dt: number) {
    const p = phase;
    if (motion) clock += dt;
    const time = clock;
    if (intro < 1) intro = motion ? clamp01(clock / 3.2) : 1;

    /* camera */
    const k = motion ? ease(clamp01((clock - cam.t0) / cam.dur)) : 1;
    eyeNow.lerpVectors(cam.from, cam.eye, k); lookNow.lerpVectors(cam.fromLook, cam.look, k);
    eyeNow.y += Math.sin(Math.PI * k) * cam.arc;
    if (motion) {
      pointerS.lerp(pointer, 1 - Math.exp(-dt * 2));
      eyeNow.x += Math.sin(time * 0.19) * 0.28 + pointerS.x * 0.7;
      eyeNow.y += Math.sin(time * 0.23) * 0.14 - pointerS.y * 0.35;
    }
    camera.position.copy(eyeNow); camera.lookAt(lookNow);

    /* uniforms that tick */
    for (const r of rooms) { r.glass.uniforms.uTime.value = time; }
    floorU.uTime.value = time;
    wallU.uniforms.uTime.value = time;
    panel.uniforms.uTime.value = time;
    columnMat.uniforms.uTime.value = time;
    boardMat.uniforms.uTime.value = time; npMats.forEach((m) => (m.uniforms.uTime.value = time));
    burstU.uniforms.uTime.value = time;
    [...cables, ...memoLinks, ...roleLinks, probe, beams.internet, beams.service].forEach((c) => (c.mat.uniforms.uTime.value = time));
    arcMats.forEach((m) => (m.uniforms.uTime.value = time));

    /* boot (intro) */
    const boot = (i: number) => (intro >= 1 ? 1 : smooth(0.35 + i * 0.35, 1.1 + i * 0.35, intro * 3.2));
    floorU.uLit.value = intro >= 1 ? 1 : smooth(0.1, 1.6, intro * 3.2);
    wallU.uniforms.uLit.value = approach("wall", 1, dt) * (intro >= 1 ? 1 : smooth(0.8, 2.6, intro * 3.2));

    /* rooms */
    const focus = p === 1;
    const roles = approach("roles", p >= 4 ? 1 : 0, dt, 2.2);
    rooms.forEach((r, i) => {
      const dim = approach(`dim${i}`, focus && i !== 0 ? 0.28 : 1, dt, 2.6) * boot(i);
      const exec = i >= 2 ? roles : 0;
      r.color.copy(ICE).lerp(TEAL, exec);
      r.glass.uniforms.uColor.value.copy(r.color);
      r.glass.uniforms.uLit.value = dim;
      r.frame.color.copy(r.color).multiplyScalar(1.35 * dim + 0.05);
      r.trim.color.copy(r.color).multiplyScalar(1.4 * dim);
      r.coreMat.emissive.copy(r.color); r.coreMat.emissiveIntensity = 2.6 * dim + 0.1;
      r.shellMat.color.copy(r.color).multiplyScalar(1.3); r.shellMat.opacity = 0.55 * dim;
      r.screen.opacity = 0.9 * dim;
      r.poolMat.color.copy(r.color); r.poolMat.opacity = 0.16 * dim;
      r.ring.color.copy(r.color).multiplyScalar(2.2); r.ring.opacity = roles * 0.9;
      const spin = time * (0.35 + i * 0.07);
      r.core.rotation.set(spin * 0.6, spin, 0); r.shell.rotation.set(-spin * 0.3, -spin * 0.5, 0);
      r.core.position.y = 1.45 + Math.sin(time * 1.1 + i) * 0.06;
      r.screenTex.offset.y = (time * 0.035 * (1 + i * 0.2)) % 1;
    });

    /* cables */
    cables.forEach((c, i) => {
      const lit = p === 0 ? 0.25 : p === 1 ? (i === 0 ? 1 : 0) : p >= 4 ? 0.35 : 1;
      c.mat.uniforms.uLit.value = approach(`cable${i}`, lit, dt) * boot(i);
      c.mat.uniforms.uBase.value = 0.3;
    });

    /* probe + blocked (phase 1) */
    const pr = p === 1 ? ev(0.35, 1.9) : p > 1 ? 1 : 0;
    const blocked = p === 1 ? ev(2.25, 0.01) : 0;
    probe.mat.uniforms.uDraw.value = easeOut(pr);
    probe.mat.uniforms.uLit.value = approach("probe", p === 1 ? 1 : 0, dt, 4) * (1 - blocked * 0.55);
    probe.mat.uniforms.uHead.value = p === 1 && pr < 1 ? 1 : 0;
    probeCurve.getPoint(Math.max(0.001, easeOut(pr)), tmp); probeHead.position.copy(tmp);
    (probeHead.material as THREE.SpriteMaterial).opacity = p === 1 ? (pr < 1 ? 1 : 0) : 0;
    const flash = p === 1 && enteredAt > -1e5 ? Math.exp(-Math.max(0, clock - enteredAt - 2.25) * 1.6) * (clock - enteredAt > 2.25 ? 1 : 0) : 0;
    wallU.uniforms.uFail.value = approach("failHold", p === 1 ? 0.18 : 0, dt) + flash * 0.9;
    ANCHORS.probe.copy(BREACH).multiplyScalar(0.96).setY(2.5);

    /* file written to the server */
    const fileOn = p >= 1 && p <= 3 ? 1 : 0;
    const drop = p === 1 ? ev(2.6, 0.9) : p > 1 ? 1 : 0;
    const fileVis = approach("file", fileOn, dt) * (p === 1 ? smooth(0, 0.2, drop) : 1);
    file.position.set(0, 3.58 + (1 - easeOut(drop)) * 1.6 + 0.04, 0);
    fileEdge.position.copy(file.position);
    file.rotation.y = (1 - easeOut(drop)) * 1.4;
    fileEdge.rotation.y = file.rotation.y;
    fileMat.opacity = fileVis * (p >= 2 ? 0.45 : 1); fileEdgeMat.opacity = fileVis * (p >= 2 ? 0.4 : 1);
    panel.uniforms.uWrite.value = p >= 1 ? 1 : 0;
    panel.uniforms.uLit.value = 0.4 + 0.6 * boot(2);
    haloMat.opacity = 0.9 * boot(1);
    serverPool.mat.opacity = 0.2 * boot(1);
    serverLight.intensity = 6 * boot(1);
    ANCHORS.server.copy(SERVER_POS).setY(3.9);
    ANCHORS.file.copy(SERVER_POS).add(new THREE.Vector3(0.45, 3.75, 0.2));

    /* old board */
    const since = enteredAt < -1e5 ? 99 : clock - enteredAt;
    const dissolve = p === 4 ? clamp01((since - 0.2) / 1.3) : p > 4 ? 1 : 0;
    let boardVis: number;
    if (p >= 4) { boardVis = 1 - smooth(0.05, 0.35, dissolve); S.board = boardVis; }
    else boardVis = approach("board", p === 2 || p === 3 ? 1 : 0, dt, 2.4) * (p === 2 ? smooth(0, 1, ev(0, 0.9)) : 1);
    boardMat.uniforms.uAlpha.value = boardVis;
    boardHeaderMat.opacity = boardVis;

    /* memos */
    memos.forEach((m, i) => {
      let t = 1;
      if (p === m.phaseIn) t = ev(m.delay + (p === 2 ? 0.5 : 0), 1.25);
      const slot = m.slot.clone().applyEuler(boardGroup.rotation).add(BOARD_POS);
      const link = memoLinks[m.from];
      if (t < 1) {
        link.curve.getPoint(easeOut(t) * 0.94, tmp);
        m.mesh.position.copy(tmp).lerp(slot, smooth(0.7, 1, t));
        m.mesh.scale.setScalar(0.35 + 0.65 * smooth(0.2, 1, t));
      } else { m.mesh.position.copy(slot); m.mesh.scale.setScalar(1); }
      m.mesh.rotation.copy(boardGroup.rotation);
      let vis: number;
      if (p >= 4) { vis = 1 - smooth(0, 0.25, dissolve); S[`memo${i}`] = vis; }
      else vis = approach(`memo${i}`, p >= m.phaseIn ? 1 : 0, dt, 3) * smooth(0, 0.15, t);
      m.mat.opacity = vis;
    });
    memoLinks.forEach((l, i) => {
      l.mat.uniforms.uLit.value = approach(`mlink${i}`, p === 2 || p === 3 ? 1 : 0, dt) * boardVis;
      l.mat.uniforms.uBase.value = 0.4;
    });

    /* rebuilt board */
    const rebuild = p === 4 ? smooth(1.3, 2.9, since) : p > 4 ? 1 : 0;
    let newVis: number;
    if (p >= 4) { newVis = rebuild; S.newBoard = newVis; } else newVis = approach("newBoard", 0, dt, 4);
    npMats.forEach((m) => (m.uniforms.uAlpha.value = newVis));
    npHeaderMats.forEach((m) => (m.opacity = newVis));
    burstU.uniforms.uT.value = p === 4 ? clamp01((since - 0.15) / 1.3) + clamp01((since - 1.45) / 1.35) : 0;
    burstU.uniforms.uAlpha.value = p === 4 && since < 3.4 ? 1 : 0;
    tiles.forEach((tile, i) => {
      const u = ((time * 0.22 + i / tiles.length) % 1);
      const a = npCenters[0].clone().add(new THREE.Vector3(0.4, -0.4 + (i % 3) * 0.5, 0.1));
      const b = npCenters[1].clone().add(new THREE.Vector3(-0.4, -0.4 + ((i + 1) % 3) * 0.5, 0.1));
      tile.position.lerpVectors(a, b, ease(u)); tile.position.z += Math.sin(Math.PI * u) * 1.1; tile.position.y += Math.sin(Math.PI * u) * 0.35;
      (tile.material as THREE.MeshBasicMaterial).opacity = newVis * Math.sin(Math.PI * u) * 0.9;
      (tile.material as THREE.MeshBasicMaterial).color.copy(ICE).lerp(TEAL, u).multiplyScalar(1.8);
    });
    roleLinks.forEach((l, i) => { l.mat.uniforms.uLit.value = newVis * (p === 5 && i >= 2 ? 1 : 0.85); l.mat.uniforms.uBase.value = 0.35; l.mat.uniforms.uDraw.value = 0.02 + 0.98 * newVis; });
    columnMat.uniforms.uAlpha.value = Math.max(boardVis, newVis);
    ANCHORS.board.copy(BOARD_POS).add(new THREE.Vector3(-boardW / 2 + 0.3, boardH / 2 + 0.15, 0));
    ANCHORS.boardA.copy(newBoard.position).add(npCenters[0]).add(new THREE.Vector3(-0.2, npH / 2 + 0.25, 0));
    ANCHORS.boardB.copy(newBoard.position).add(npCenters[1]).add(new THREE.Vector3(0.2, npH / 2 + 0.25, 0));

    /* outside world */
    const outside = approach("outside", p === 3 ? 1 : p === 4 ? 0.3 : p === 5 ? 0.8 : 0, dt, 1.6);
    gPtsMat.opacity = 0.9 * outside; gWireMat.opacity = 0.2 * outside; (gAtmo.material as THREE.SpriteMaterial).opacity = 0.35 * outside;
    arcMats.forEach((m, i) => { m.uniforms.uLit.value = outside * (p === 3 ? 1 : 0.5); m.uniforms.uDraw.value = 1; void i; });
    globe.rotation.y = time * 0.05;
    const svc = approach("service", p >= 5 ? 1 : 0, dt, 1.6);
    svcBodyMat.opacity = Math.min(1, svc * 1.6); svcEdgeMat.opacity = svc;
    const hit = p === 5 ? ev(2.2, 0.01) : 0;
    svcEdgeMat.color.copy(HOT).lerp(AMBER, hit).multiplyScalar(1.2 + hit * 1.6 + (p === 5 ? Math.sin(time * 6) * 0.25 * hit : 0));
    svcCoreMat.opacity = svc; svcCore.rotation.y = time * 0.6;
    svcPool.mat.opacity = 0.18 * svc + hit * 0.35;
    serviceLight.intensity = svc * (8 + hit * 22);
    shock.forEach((s, i) => {
      const u = ((clock - enteredAt - 2.2) * 0.45 + i / 3) % 1;
      const on = p === 5 && hit > 0 ? 1 : 0;
      s.ring.scale.setScalar(1 + u * 5.5); s.m.opacity = on * (1 - u) * 0.8 * (motion ? 1 : (i === 0 ? 1 : 0));
      if (!motion && on) s.ring.scale.setScalar(2.6 + i * 1.5);
    });
    ANCHORS.globe.copy(GLOBE_POS).add(new THREE.Vector3(-1.2, 3.6, 0));
    ANCHORS.service.copy(SERVICE_POS).add(new THREE.Vector3(0, 5.5, 0));
    ANCHORS.wall.set(-WALL_R * 0.72, 3.9, -WALL_R * 0.69);
    ANCHORS.breach.copy(BREACH).add(new THREE.Vector3(0.2, 2.4, 0));

    /* beams through the wall */
    const ib = p === 3 ? ev(0.9, 1.8) : p > 3 ? 1 : 0;
    beams.internet.mat.uniforms.uDraw.value = easeOut(ib);
    beams.internet.mat.uniforms.uLit.value = approach("ibeam", p === 3 ? 1 : 0, dt, 3);
    beams.internet.mat.uniforms.uHead.value = p === 3 && ib < 1 ? 1 : 0;
    beams.internet.curve.getPoint(Math.max(0.001, easeOut(ib)), tmp); beams.internet.head.position.copy(tmp);
    (beams.internet.head.material as THREE.SpriteMaterial).opacity = p === 3 && ib < 1 ? 1 : 0;
    const sb = p === 5 ? ev(0.4, 1.8) : 0;
    beams.service.mat.uniforms.uDraw.value = easeOut(sb);
    beams.service.mat.uniforms.uLit.value = approach("sbeam", p === 5 ? 1 : 0, dt, 3);
    beams.service.mat.uniforms.uHead.value = p === 5 && sb < 1 ? 1 : 0;
    beams.service.curve.getPoint(Math.max(0.001, easeOut(sb)), tmp); beams.service.head.position.copy(tmp);
    (beams.service.head.material as THREE.SpriteMaterial).opacity = p === 5 && sb < 1 ? 1 : 0;

    const breachTarget = p === 3 ? smooth(0.45, 0.62, ib) : p === 5 ? smooth(0.35, 0.55, sb) : 0;
    wallU.uniforms.uBreach.value = approach("breach", breachTarget, dt, 5);
    const rip = p === 3 ? (clock - enteredAt - 1.7) : p === 5 ? (clock - enteredAt - 1.2) : -1;
    wallU.uniforms.uRipple.value = rip > 0 && enteredAt > -1e5 ? rip * 3.2 : 0;
    wallU.uniforms.uRippleAmt.value = rip > 0 && enteredAt > -1e5 ? Math.exp(-rip * 0.9) : 0;

    /* dust */
    dust.rotation.y = time * 0.01;

    /* anchors for rooms */
    rooms.forEach((r, i) => ANCHORS[`room${i}` as AnchorId].copy(r.top));
  }

  /* ------------------------------------------------------------------ loop */
  let raf = 0, last = performance.now(), frames = 0, disposed = false, dirty = 3, motionHold = false;
  const listeners: (() => void)[] = [];
  const frame = () => {
    raf = 0;
    if (disposed || motionHold) return;
    const now = performance.now(); const dt = Math.min(0.1, (now - last) / 1000); last = now;
    update(motion ? dt : 0);
    composer.render();
    canvas.dataset.frames = String(++frames);
    canvas.dataset.phase = String(phase);
    if (frames === 1) canvas.dataset.ready = "true";
    listeners.forEach((l) => l());
    if (motion && !document.hidden) raf = requestAnimationFrame(frame);
    else if (--dirty > 0) raf = requestAnimationFrame(frame);
  };
  const kick = () => { dirty = 3; if (!raf && !motionHold) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const onVis = () => kick();
  document.addEventListener("visibilitychange", onVis);
  const onLost = (e: Event) => { e.preventDefault(); canvas.dispatchEvent(new CustomEvent("incident-lost")); };
  canvas.addEventListener("webglcontextlost", onLost);
  kick();

  // Dev-only: step the clock deterministically for render review (tools/incident-review).
  if (import.meta.env.DEV) {
    const w = window as unknown as Record<string, unknown>;
    w.__iwPause = () => { disposed = true; if (raf) cancelAnimationFrame(raf); raf = 0; disposed = false; motionHold = true; };
    w.__iwAdvance = (sec: number) => { for (let i = 0; i < Math.round(sec * 30); i++) update(1 / 30); composer.render(); canvas.dataset.frames = String(++frames); listeners.forEach((l) => l()); };
  }

  return {
    setPhase(next) {
      next = Math.max(0, Math.min(PHASES - 1, next));
      if (next === phase) return;
      const forward = next > phase;
      // Camera always travels; the story beat replays only when moving forward.
      cam.from.copy(camera.position); cam.fromLook.copy(lookNow);
      cam.eye.set(...POSES[next].eye); cam.look.set(...POSES[next].look);
      cam.arc = POSES[next].arc ?? 0; cam.t0 = clock; cam.dur = forward ? 2.4 : 1.6;
      intro = 1;
      if (next === 4 && phase < 4) S.board = 1;
      phase = next;
      enteredAt = forward && motion ? clock : -1e6;
      kick();
    },
    setMotion(on) {
      if (on === motion) return;
      motion = on;
      if (!on) { enteredAt = -1e6; intro = 1; cam.t0 = -1e6; cam.from.copy(cam.eye); cam.fromLook.copy(cam.look); }
      kick();
    },
    setPointer(x, y) { pointer.set(x, y); },
    project(id) {
      tmp.copy(ANCHORS[id]).project(camera);
      return { x: (tmp.x + 1) / 2 * W, y: (1 - tmp.y) / 2 * H, visible: tmp.z < 1 && tmp.z > -1 };
    },
    labelAlpha() {
      if (!motion) return 1;
      const k = clamp01((clock - cam.t0) / cam.dur);
      return Math.min(smooth(0.72, 1, k), intro >= 1 ? 1 : smooth(0.8, 1, intro));
    },
    onFrame(cb) { listeners.push(cb); },
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
    },
  };
}
