import * as THREE from "three";
import { FONT, GLSL_SAFE, PhaseClock, canvasTexture, clamp01, createStage, easeInOut, easeOut, fitShot, quad, rand, roundRect, smooth, type Pose, type Shot } from "../stage3d/runtime";

/*
 * 7~8번 · 에이전트가 쓰는 웹. 한 공간을 두 장 동안 유지하고, 발표자가 누를 때마다 카메라와 상태만 옮긴다.
 *   0  (7) 웹사이트 앞의 "나는 로봇이 아닙니다". 사람은 확인을 받고 들어가고, 에이전트는 그 앞에서 기다린다.
 *   1  (7) 사이트가 겹을 연다. 화면 뒤에 사이트가 알려주는 기능(WebMCP)이 있고, 에이전트가 그 기능을 부른다.
 *   2  (8) 같은 키보드를 파는 두 판매처. A 위에는 광고판이 켜져 있다.
 *   3  (8) 에이전트는 화면 대신 조건을 읽는다. 같은 조건, 다른 가격. B를 고른다.
 *   4  (8) A의 광고판이 가격표로 흘러내린다. 판매자의 선택에 대한 발표자의 가설.
 * 판매처·가격·도구 이름은 모두 설명용 예시다(FACT-CHECK.md).
 */

export const PHASES = 5;

const ICE = new THREE.Color("#8fd0ff");
const GOLD = new THREE.Color("#ffd49a");
const AMBER = new THREE.Color("#ffb45e");
const WHITE = new THREE.Color("#eef6ff");

/* 배치 ------------------------------------------------------------------- */
const SW = 5.6, SH = 3.5;           // 판매처 화면 크기 (16:10)
const A = new THREE.Vector3(0, 2.35, 0);
const B = new THREE.Vector3(8.4, 2.35, 0);
const GATE = new THREE.Vector3(-3.7, 1.25, 3.2);
const AGENT_WAIT = new THREE.Vector3(-6.0, 1.45, 4.3);
const AGENT_SHOP = new THREE.Vector3(4.2, 2.05, 3.6);
const BILL = new THREE.Vector3(0, 5.15, 0);
const BILL_W = 5.2, BILL_H = BILL_W * 360 / 1400;
/** 7-1에서 겹이 벌어지는 곳(판매처 A 기준). 화면은 앞·왼쪽으로, 기능은 뒤·오른쪽으로. */
const UI_OPEN = new THREE.Vector3(-1.7, 0.1, 1.3), UI_OPEN_RY = 0.34;
const TOOLS_OPEN = new THREE.Vector3(2.5, 0.05, -1.1), TOOLS_OPEN_RY = 0.42;
const AGENT_TOOLS = new THREE.Vector3(6.7, 2.35, 2.5);

/** 단계별 샷: 보여야 할 것과 그것이 들어갈 화면 영역. 제목(왼쪽 위)과 설명(왼쪽 아래)을 피한다. */
const SHOTS: Shot[] = [
  { az: -8, el: 10, rect: [240, 390, 1780, 850], points: () => [...quad(A, SW + 0.2, SH + 0.2), A.clone().setY(0), ...quad(GATE, 2.9, 0.8, 0.32), GATE.clone().setY(0), AGENT_WAIT.clone()] },
  { az: 30, el: 12, rect: [260, 370, 1790, 850], points: () => [...quad(A.clone().add(UI_OPEN), SW, SH, UI_OPEN_RY), ...quad(A.clone().add(TOOLS_OPEN), SW, SH, TOOLS_OPEN_RY), AGENT_TOOLS.clone()] },
  { az: 0, el: 8, rect: [230, 430, 1790, 870], points: () => [...quad(A, SW, SH), ...quad(B, SW, SH), ...quad(BILL, BILL_W, BILL_H), A.clone().setY(0.3), B.clone().setY(0.3)] },
  { az: 0, el: 12, rect: [230, 440, 1790, 880], points: () => [...quad(A, SW, SH), ...quad(B, SW, SH), A.clone().setY(0.3), B.clone().setY(0.3), BILL.clone().setY(4.6)] },
  { az: -8, el: 7, rect: [700, 340, 1700, 860], points: () => [...quad(A, SW, SH), ...quad(BILL, BILL_W, BILL_H)] },
];

export const ANCHORS = {
  gate: new THREE.Vector3(), site: new THREE.Vector3(), agent: new THREE.Vector3(), human: new THREE.Vector3(), tools: new THREE.Vector3(),
  storeA: new THREE.Vector3(), storeB: new THREE.Vector3(), bill: new THREE.Vector3(), pick: new THREE.Vector3(), priceA: new THREE.Vector3(),
};
export type AnchorId = keyof typeof ANCHORS;

/* 그림 -------------------------------------------------------------------- */
function drawKeyboard(g: CanvasRenderingContext2D, x: number, y: number, w: number) {
  const h = w * 0.34;
  const body = g.createLinearGradient(x, y, x, y + h);
  body.addColorStop(0, "#39434f"); body.addColorStop(1, "#232a33");
  g.save(); g.shadowColor = "rgba(0,0,0,.55)"; g.shadowBlur = 40; g.shadowOffsetY = 18;
  roundRect(g, x, y, w, h, 22); g.fillStyle = body; g.fill(); g.restore();
  const rows = [14, 13, 12, 11], pad = 26, kh = (h - pad * 2 - 3 * 10) / 4;
  rows.forEach((n, r) => {
    const kw = (w - pad * 2 - (n - 1) * 9) / n;
    for (let i = 0; i < n; i++) {
      const kx = x + pad + i * (kw + 9) + (r === 3 ? 0 : 0), ky = y + pad + r * (kh + 10);
      const wide = r === 3 && i > 3 && i < 8;
      if (r === 3 && i > 4 && i < 8) continue;
      roundRect(g, kx, ky, wide ? kw * 4 + 27 : kw, kh, 7);
      const kg = g.createLinearGradient(kx, ky, kx, ky + kh); kg.addColorStop(0, "#dfe6ee"); kg.addColorStop(1, "#aab6c3");
      g.fillStyle = kg; g.fill();
    }
  });
}

function storeTexture(label: string, price: string) {
  return canvasTexture(1280, 800, (g) => {
    const bg = g.createLinearGradient(0, 0, 0, 800); bg.addColorStop(0, "#142131"); bg.addColorStop(1, "#0b131e");
    roundRect(g, 0, 0, 1280, 800, 34); g.fillStyle = bg; g.fill();
    // 주소 표시줄
    g.fillStyle = "#0a111a"; roundRect(g, 0, 0, 1280, 84, 34); g.fill(); g.fillRect(0, 50, 1280, 34);
    ["#ff6b5e", "#ffc24b", "#39d27a"].forEach((c, i) => { g.fillStyle = c; g.globalAlpha = .75; g.beginPath(); g.arc(46 + i * 34, 42, 10, 0, 7); g.fill(); });
    g.globalAlpha = 1; roundRect(g, 170, 20, 560, 44, 22); g.fillStyle = "#16212e"; g.fill();
    g.font = `500 24px ${FONT}`; g.fillStyle = "#9fb4c6"; g.textBaseline = "middle"; g.fillText(`store-${label.toLowerCase()}.example`, 200, 43);
    g.font = `600 24px ${FONT}`; g.fillStyle = "#d9e4ee"; g.textAlign = "right"; g.fillText(`판매처 ${label}`, 1236, 43); g.textAlign = "left";
    // 상품 사진 자리
    const pg = g.createRadialGradient(340, 400, 40, 340, 440, 420); pg.addColorStop(0, "#2d3f55"); pg.addColorStop(1, "#162230");
    roundRect(g, 44, 124, 590, 630, 26); g.fillStyle = pg; g.fill();
    drawKeyboard(g, 84, 360, 510);
    // 상품 정보
    g.font = `500 30px ${FONT}`; g.fillStyle = "#9fb4c6"; g.fillText("같은 상품", 690, 170);
    g.font = `700 60px ${FONT}`; g.fillStyle = "#f3f5f7"; g.fillText("무선 키보드", 688, 246);
    g.font = `800 104px ${FONT}`; g.fillStyle = "#ffffff"; g.fillText(price, 684, 382);
    const pw = g.measureText(price).width;
    g.font = `600 44px ${FONT}`; g.fillStyle = "#b8c6d2"; g.fillText("원", 684 + pw + 16, 396);
    [["내일 도착", 690], ["14일 이내 반품", 868]].forEach(([t, x]) => {
      g.font = `600 30px ${FONT}`; const w = g.measureText(t as string).width + 44;
      roundRect(g, x as number, 462, w, 58, 29); g.fillStyle = "#1c2c3d"; g.fill(); g.strokeStyle = "#3d5a74"; g.lineWidth = 2; g.stroke();
      g.fillStyle = "#cfe3f2"; g.fillText(t as string, (x as number) + 22, 492);
    });
    roundRect(g, 690, 640, 546, 104, 22); g.fillStyle = "#e2c795"; g.fill();
    g.font = `700 42px ${FONT}`; g.fillStyle = "#1a1408"; g.textAlign = "center"; g.fillText("구매하기", 963, 694); g.textAlign = "left";
  });
}

function captchaTexture(checked: boolean) {
  return canvasTexture(960, 250, (g) => {
    roundRect(g, 4, 4, 952, 242, 22); g.fillStyle = "#f1f4f7"; g.fill(); g.strokeStyle = "#c9d3dc"; g.lineWidth = 3; g.stroke();
    roundRect(g, 52, 70, 108, 108, 12); g.fillStyle = "#ffffff"; g.fill(); g.strokeStyle = checked ? "#2e9b5a" : "#8a97a4"; g.lineWidth = 5; g.stroke();
    if (checked) { g.strokeStyle = "#1f9a52"; g.lineWidth = 14; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); g.moveTo(76, 126); g.lineTo(100, 152); g.lineTo(140, 94); g.stroke(); }
    g.font = `600 58px ${FONT}`; g.fillStyle = "#1c2632"; g.textBaseline = "middle"; g.fillText("나는 로봇이 아닙니다", 200, 126);
  });
}

function toolsHeaderTexture() {
  return canvasTexture(1280, 220, (g) => {
    g.font = `800 76px ${FONT}`; g.fillStyle = "#bfe6ff"; g.textBaseline = "middle"; g.fillText("WebMCP", 40, 74);
    g.font = `500 38px ${FONT}`; g.fillStyle = "#8fb8d6"; g.fillText("사이트가 에이전트에게 알려주는 기능", 40, 160);
    g.font = `600 26px ${FONT}`; g.fillStyle = "#6f94ad"; g.textAlign = "right"; g.fillText("예시", 1240, 74);
  });
}
function toolRowTexture(name: string, input: string) {
  return canvasTexture(1200, 170, (g) => {
    roundRect(g, 4, 4, 1192, 162, 26); g.fillStyle = "rgba(14,34,52,.92)"; g.fill(); g.strokeStyle = "rgba(143,208,255,.7)"; g.lineWidth = 3; g.stroke();
    roundRect(g, 38, 58, 84, 54, 14); g.strokeStyle = "#8fd0ff"; g.lineWidth = 3; g.stroke();
    g.font = `700 26px ${FONT}`; g.fillStyle = "#8fd0ff"; g.textBaseline = "middle"; g.textAlign = "center"; g.fillText("도구", 80, 86); g.textAlign = "left";
    g.font = `700 56px ${FONT}`; g.fillStyle = "#f1f8ff"; g.fillText(name, 156, 86);
    g.font = `500 34px ${FONT}`; g.fillStyle = "#9cc2dd"; g.textAlign = "right"; g.fillText(input, 1150, 88);
  });
}
function dataTexture(label: string, price: string, pick: boolean) {
  return canvasTexture(1280, 800, (g) => {
    roundRect(g, 6, 6, 1268, 788, 34); g.fillStyle = "rgba(8,20,32,.94)"; g.fill();
    g.strokeStyle = pick ? "rgba(255,212,154,.95)" : "rgba(143,208,255,.55)"; g.lineWidth = 4; g.stroke();
    g.font = `700 40px ${FONT}`; g.fillStyle = pick ? "#ffd49a" : "#9fd6ff"; g.textBaseline = "middle"; g.fillText(`판매처 ${label} · 에이전트가 읽는 조건`, 60, 84);
    const rows: [string, string][] = [["상품", "같은 무선 키보드"], ["도착", "내일"], ["반품", "14일 이내"]];
    rows.forEach(([k, v], i) => {
      const y = 196 + i * 104;
      g.font = `500 40px ${FONT}`; g.fillStyle = "#7f9db4"; g.fillText(k, 60, y);
      g.font = `600 48px ${FONT}`; g.fillStyle = "#e9f2f9"; g.fillText(v, 230, y);
      g.strokeStyle = "#4fd08a"; g.lineWidth = 8; g.lineCap = "round"; g.beginPath(); g.moveTo(1150, y); g.lineTo(1172, y + 22); g.lineTo(1210, y - 22); g.stroke();
      g.fillStyle = "rgba(143,208,255,.14)"; g.fillRect(60, y + 50, 1160, 2);
    });
    g.font = `500 40px ${FONT}`; g.fillStyle = "#7f9db4"; g.fillText("가격", 60, 616);
    g.font = `800 120px ${FONT}`; g.fillStyle = pick ? "#ffe0ae" : "#ffffff"; g.fillText(price, 226, 620);
    const pw = g.measureText(price).width;
    g.font = `600 52px ${FONT}`; g.fillStyle = "#b9c9d6"; g.fillText("원", 226 + pw + 18, 634);
  });
}
function billboardTexture() {
  return canvasTexture(1400, 360, (g) => {
    const bg = g.createLinearGradient(0, 0, 1400, 360); bg.addColorStop(0, "#ff7a45"); bg.addColorStop(.55, "#ffb347"); bg.addColorStop(1, "#ffd978");
    roundRect(g, 0, 0, 1400, 360, 36); g.fillStyle = bg; g.fill();
    const r = rand(3); g.fillStyle = "rgba(255,255,255,.55)";
    for (let i = 0; i < 60; i++) { const x = r() * 1400, y = r() * 360, s = 2 + r() * 5; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); }
    roundRect(g, 48, 44, 128, 64, 14); g.fillStyle = "rgba(40,16,0,.78)"; g.fill();
    g.font = `800 36px ${FONT}`; g.fillStyle = "#ffe2b8"; g.textBaseline = "middle"; g.textAlign = "center"; g.fillText("광고", 112, 78); g.textAlign = "left";
    g.font = `900 112px ${FONT}`; g.fillStyle = "#2a0f00"; g.fillText("오늘의 추천!", 60, 232);
    g.font = `800 52px ${FONT}`; g.fillStyle = "#4a1c00"; g.textAlign = "right"; g.fillText("무선 키보드", 1340, 236); g.textAlign = "left";
  });
}

/* 재질 -------------------------------------------------------------------- */
const floorMat = () => new THREE.ShaderMaterial({
  uniforms: { uLit: { value: 0 } },
  vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `${GLSL_SAFE}varying vec3 vW; uniform float uLit;
    float gridLine(vec2 p, float s, float w){ vec2 q=p/s; vec2 g=abs(fract(q-.5)-.5)/fwidth(q); return 1.-min(min(g.x,g.y)/w,1.); }
    void main(){
      vec2 p=vW.xz-vec2(4.2,0.); float r=length(p*vec2(.7,1.));
      vec3 col=vec3(.012,.018,.028);
      float fade=exp(-max(r-5.,0.)*.09);
      col+=vec3(.22,.42,.62)*(gridLine(vW.xz,1.,1.)*.04+gridLine(vW.xz,4.,1.2)*.09)*fade*uLit;
      col=mix(col,vec3(.002,.003,.006),sstep(14.,44.,r));
      gl_FragColor=vec4(col,1.);
    }`,
});

const cableMat = (color: THREE.Color, length: number) => new THREE.ShaderMaterial({
  uniforms: { uColor: { value: color.clone() }, uLit: { value: 0 }, uTime: { value: 0 }, uDraw: { value: 0 }, uLen: { value: length } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `${GLSL_SAFE}varying vec2 vUv; uniform vec3 uColor; uniform float uLit,uTime,uDraw,uLen;
    void main(){
      float t=vUv.x; if(t>uDraw) discard;
      float d=t*uLen;
      float dash=pw(.5+.5*sin((d-uTime*3.2)*1.6),18.);
      float head=exp(-abs(t-uDraw)*uLen*2.)*step(uDraw,.999);
      vec3 c=uColor*(.35+dash*2.2+head*3.);
      gl_FragColor=vec4(c*uLit,1.);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});

export type AgentWebWorld = {
  setPhase: (p: number) => void;
  setMotion: (on: boolean) => void;
  setPointer: (x: number, y: number) => void;
  project: (id: AnchorId) => { x: number; y: number; visible: boolean };
  labelAlpha: () => number;
  onFrame: (cb: () => void) => void;
  dispose: () => void;
};

export function createAgentWebWorld(canvas: HTMLCanvasElement, initialPhase: number, initialMotion: boolean): AgentWebWorld {
  const stage = createStage(canvas, { background: "#060a11", fog: 0.024, fov: 34, bloom: [0.55, 0.5, 0.88], exposure: 1.0, lostEvent: "agentweb-lost" });
  const { scene, camera, glow } = stage;
  const pc = new PhaseClock(Math.max(0, Math.min(PHASES - 1, initialPhase)), initialMotion);
  const POSES: Pose[] = SHOTS.map((shot) => fitShot(shot, camera));
  const INTRO: Pose = { eye: [POSES[0].eye[0] - 3, POSES[0].eye[1] + 3.5, POSES[0].eye[2] + 7], look: POSES[0].look };
  const tex = <T extends THREE.Texture>(t: T) => { stage.keep(t); return t; };

  scene.add(new THREE.HemisphereLight("#6d8fb0", "#05080d", 0.6));
  const key = new THREE.DirectionalLight("#cfe4ff", 1.1); key.position.set(-6, 12, 9); scene.add(key);
  const warm = new THREE.DirectionalLight("#ffcf99", 0.45); warm.position.set(10, 6, -6); scene.add(warm);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), floorMat()); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const floorU = (floor.material as THREE.ShaderMaterial).uniforms;

  const additive = (color: THREE.Color, opacity = 0) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  const pool = (pos: THREE.Vector3, size: number, color: THREE.Color) => {
    const mat = new THREE.MeshBasicMaterial({ map: glow, color: color.clone(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.7), mat); m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.02, pos.z + 0.4); scene.add(m); return mat;
  };
  const frameEdges = (w: number, h: number, color: THREE.Color, thick = 0.035) => {
    const g = new THREE.Group(); const mat = new THREE.MeshBasicMaterial({ color: color.clone(), transparent: true, opacity: 1 });
    for (const [x, y, ww, hh] of [[0, h / 2, w + thick, thick], [0, -h / 2, w + thick, thick], [-w / 2, 0, thick, h], [w / 2, 0, thick, h]] as const) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, thick), mat); m.position.set(x, y, 0); g.add(m);
    }
    return { group: g, mat };
  };

  /* 판매처 ------------------------------------------------------------------ */
  type Store = { root: THREE.Group; ui: THREE.Group; uiMat: THREE.MeshBasicMaterial; uiFrame: THREE.MeshBasicMaterial; tools: THREE.Group; data: THREE.Mesh; dataMat: THREE.MeshBasicMaterial; pool: THREE.MeshBasicMaterial; stand: THREE.MeshStandardMaterial };
  const makeStore = (pos: THREE.Vector3, label: string, price: string, pick: boolean): Store => {
    const root = new THREE.Group(); root.position.copy(pos); scene.add(root);
    const standMat = new THREE.MeshStandardMaterial({ color: "#10161f", metalness: 0.8, roughness: 0.35, transparent: true, opacity: 1 });
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, pos.y - SH / 2, 0.16), standMat); post.position.set(0, -SH / 2 - (pos.y - SH / 2) / 2, -0.15); root.add(post);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 1.1), standMat); base.position.set(0, -pos.y + 0.04, -0.15); root.add(base);
    const ui = new THREE.Group(); root.add(ui);
    const uiMat = new THREE.MeshBasicMaterial({ map: tex(storeTexture(label, price)), transparent: true, opacity: 1, color: new THREE.Color(.84, .84, .84), toneMapped: false });
    ui.add(new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), uiMat));
    const back = new THREE.Mesh(new THREE.BoxGeometry(SW + 0.12, SH + 0.12, 0.1), standMat); back.position.z = -0.08; ui.add(back);
    const f = frameEdges(SW + 0.12, SH + 0.12, GOLD.clone().multiplyScalar(1.15)); f.group.position.z = 0.01; ui.add(f.group);
    const tools = new THREE.Group(); root.add(tools);
    const dataMat = new THREE.MeshBasicMaterial({ map: tex(dataTexture(label, price, pick)), transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    const data = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), dataMat); data.position.z = 0.07; root.add(data);
    return { root, ui, uiMat, uiFrame: f.mat, tools, data, dataMat, pool: pool(pos, 8, ICE), stand: standMat };
  };
  const storeA = makeStore(A, "A", "129,000", false);
  const storeB = makeStore(B, "B", "109,000", true);

  // A의 도구 겹(WebMCP): 머리글 + 도구 세 줄
  const toolHeaderMat = new THREE.MeshBasicMaterial({ map: tex(toolsHeaderTexture()), transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const toolHeader = new THREE.Mesh(new THREE.PlaneGeometry(SW, SW * 220 / 1280), toolHeaderMat); toolHeader.position.set(0, SH / 2 - 0.42, 0); storeA.tools.add(toolHeader);
  const TOOL_SPEC: [string, string][] = [["상품 검색", "검색어"], ["옵션 선택", "색상 · 배열"], ["주문하기", "배송지"]];
  const toolRows = TOOL_SPEC.map(([name, input], i) => {
    const mat = new THREE.MeshBasicMaterial({ map: tex(toolRowTexture(name, `입력 · ${input}`)), transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(SW * 0.94, SW * 0.94 * 170 / 1200), mat); m.position.set(0, 0.42 - i * 0.84, 0.02); storeA.tools.add(m);
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(SW * 1.02, 0.95), new THREE.MeshBasicMaterial({ map: glow, color: ICE.clone().multiplyScalar(1.4), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    flash.position.copy(m.position).setZ(-0.02); storeA.tools.add(flash);
    return { mesh: m, mat, flash: flash.material as THREE.MeshBasicMaterial };
  });
  const toolPanelMat = new THREE.ShaderMaterial({
    uniforms: { uAlpha: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `${GLSL_SAFE}varying vec2 vUv; uniform float uAlpha,uTime;
      void main(){ vec2 p=vUv; float edge=min(min(p.x,1.-p.x)*1.6,min(p.y,1.-p.y));
        float border=sstep(.012,.0,edge); vec2 g=fract(p*vec2(32.,20.)); float dots=sstep(.08,.0,length(g-.5))*.35;
        float sweep=exp(-abs(fract(p.y*.6-uTime*.12)-.5)*16.)*.25;
        vec3 c=vec3(.45,.75,1.)*(.05+dots*.3+sweep*.4+border*1.2);
        gl_FragColor=vec4(c*uAlpha,1.); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const toolPanel = new THREE.Mesh(new THREE.PlaneGeometry(SW + 0.3, SH + 0.3), toolPanelMat); toolPanel.position.z = -0.03; storeA.tools.add(toolPanel);

  /* 사람 확인 ------------------------------------------------------------------ */
  const gate = new THREE.Group(); gate.position.copy(GATE); gate.rotation.y = 0.32; scene.add(gate);
  const capOff = tex(captchaTexture(false)), capOn = tex(captchaTexture(true));
  const capMat = new THREE.MeshBasicMaterial({ map: capOff, transparent: true, opacity: 1, toneMapped: false, color: new THREE.Color(.78, .8, .82) });
  const capW = 2.9, capH = capW * 250 / 960;
  gate.add(new THREE.Mesh(new THREE.PlaneGeometry(capW, capH), capMat));
  const gateStandMat = new THREE.MeshStandardMaterial({ color: "#10161f", metalness: 0.8, roughness: 0.35, transparent: true, opacity: 1 });
  const gatePost = new THREE.Mesh(new THREE.BoxGeometry(0.08, GATE.y - capH / 2, 0.08), gateStandMat);
  gatePost.position.set(0, -capH / 2 - (GATE.y - capH / 2) / 2, -0.06); gate.add(gatePost);
  // 사람 확인 앞의 빛의 막: 에이전트가 멈춰 서는 곳
  const veilMat = new THREE.ShaderMaterial({
    uniforms: { uAlpha: { value: 0 }, uTime: { value: 0 }, uHit: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `${GLSL_SAFE}varying vec2 vUv; uniform float uAlpha,uTime,uHit;
      void main(){ vec2 p=vUv; float lines=pw(.5+.5*cos(p.y*6.283*26.),26.); float fall=sstep(1.,.0,p.y)*sstep(0.,.08,p.y);
        float d=length((p-vec2(.5,.36))*vec2(1.6,1.)); float ring=exp(-abs(d-uHit*.55)*22.)*(1.-uHit);
        vec3 c=vec3(1.,.72,.38)*(lines*.35+.04)*fall + vec3(1.,.78,.45)*ring*1.4;
        float side=sstep(0.,.15,p.x)*sstep(1.,.85,p.x);
        gl_FragColor=vec4(c*side*uAlpha,1.); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.0), veilMat); veil.position.set(0, 0.25, 0.55); gate.add(veil);
  const gatePool = pool(GATE, 4, AMBER);

  /* 사람의 커서 ---------------------------------------------------------------- */
  const cursorShape = new THREE.Shape(); cursorShape.moveTo(0, 0); cursorShape.lineTo(0, -0.62); cursorShape.lineTo(0.16, -0.47); cursorShape.lineTo(0.27, -0.72); cursorShape.lineTo(0.37, -0.67); cursorShape.lineTo(0.26, -0.43); cursorShape.lineTo(0.46, -0.43); cursorShape.closePath();
  const cursorMat = new THREE.MeshBasicMaterial({ color: WHITE.clone().multiplyScalar(1.6), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const cursor = new THREE.Mesh(new THREE.ShapeGeometry(cursorShape), cursorMat); scene.add(cursor);
  const cursorGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: WHITE.clone(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); cursorGlow.scale.setScalar(1.3); scene.add(cursorGlow);
  const clickRingMat = additive(WHITE.clone().multiplyScalar(1.5));
  const clickRing = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.34, 64), clickRingMat); gate.add(clickRing);
  const checkPos = new THREE.Vector3(-capW / 2 + capW * 106 / 960, capH / 2 - capH * 124 / 250, 0.02);
  clickRing.position.copy(checkPos);

  /* 에이전트 --------------------------------------------------------------------- */
  const agent = new THREE.Group(); scene.add(agent);
  const coreMat = new THREE.MeshStandardMaterial({ color: "#0a1620", emissive: ICE.clone(), emissiveIntensity: 3.4, flatShading: true, metalness: 0.2, roughness: 0.4 });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), coreMat); agent.add(core);
  const shellMat = new THREE.LineBasicMaterial({ color: ICE.clone().multiplyScalar(1.5), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
  const shell = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.55, 1)), shellMat); agent.add(shell);
  const orbitMat = additive(ICE.clone().multiplyScalar(2), 0.7);
  const orbit = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.012, 8, 96), orbitMat); orbit.rotation.x = Math.PI / 2.4; agent.add(orbit);
  const agentGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: ICE.clone().multiplyScalar(0.9), transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })); agentGlow.scale.setScalar(3.2); agent.add(agentGlow);
  const agentLight = new THREE.PointLight("#8fd0ff", 5, 7, 2); agent.add(agentLight);

  /* 광고판 --------------------------------------------------------------------- */
  const bill = new THREE.Group(); bill.position.copy(BILL); scene.add(bill);
  const billMat = new THREE.MeshBasicMaterial({ map: tex(billboardTexture()), transparent: true, opacity: 0, toneMapped: false, depthWrite: false });
  const billW = BILL_W, billH = BILL_H;
  bill.add(new THREE.Mesh(new THREE.PlaneGeometry(billW, billH), billMat));
  const billGlowMat = new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color("#ff9a4d"), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const billGlow = new THREE.Mesh(new THREE.PlaneGeometry(billW * 2.2, billH * 3.4), billGlowMat); billGlow.position.z = -0.2; bill.add(billGlow);
  const billPost = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), gateStandMat); billPost.position.set(0, -billH / 2 - 0.2, -0.1); bill.add(billPost);
  // 광고판을 비추는 두 줄기 조명
  const beamCone = (x: number) => {
    const geo = new THREE.ConeGeometry(1.0, 3.0, 40, 1, true); geo.translate(0, -1.5, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uAlpha: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `${GLSL_SAFE}varying vec2 vUv; uniform float uAlpha; void main(){ float a=sstep(0.,1.,vUv.y)*.07; gl_FragColor=vec4(vec3(1.,.78,.5)*a*uAlpha,1.); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const cone = new THREE.Mesh(geo, mat); cone.position.set(x, 2.4, 1.0); cone.rotation.x = -0.5; cone.rotation.z = x > 0 ? 0.25 : -0.25; bill.add(cone);
    return mat;
  };
  const cones = [beamCone(-2.2), beamCone(2.2)];

  // 광고판에서 가격표로 흘러내리는 빛
  // 판매처 화면 텍스처에서 가격 글자가 있는 곳 (가로 0.72, 세로 0.48)
  const PRICE_A = new THREE.Vector3(A.x + SW * (0.72 - 0.5), A.y + SH * (0.5 - 0.48), 0.12);
  const dropGeo = new THREE.BufferGeometry();
  { const n = 900, r = rand(8), from = new Float32Array(n * 3), to = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      from.set([BILL.x + (r() - .5) * billW, BILL.y + (r() - .5) * billH, 0.1], i * 3);
      to.set([PRICE_A.x + (r() - .5) * 2.1, PRICE_A.y + (r() - .5) * 0.45, PRICE_A.z + r() * 0.1], i * 3);
      seed[i] = r();
    }
    dropGeo.setAttribute("position", new THREE.BufferAttribute(from.slice(), 3));
    dropGeo.setAttribute("aFrom", new THREE.BufferAttribute(from, 3)); dropGeo.setAttribute("aTo", new THREE.BufferAttribute(to, 3)); dropGeo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1)); }
  const dropMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uAlpha: { value: 0 }, uTime: { value: 0 }, uLoop: { value: 0 } },
    vertexShader: `${GLSL_SAFE}attribute vec3 aFrom; attribute vec3 aTo; attribute float aSeed; uniform float uT,uTime,uLoop; varying float vK;
      void main(){ float k=clamp(uT*1.5-aSeed*.5,0.,1.);
        // 첫 흐름이 끝나면 광고판에서 가격표로 계속 흘러내린다(uLoop). 모션을 끄면 경로 위에 멈춰 있다.
        k=mix(k,fract(aSeed*7.13+uTime*.28),uLoop); float e=k*k*(3.-2.*k);
        vec3 mid=mix(aFrom,aTo,.5)+vec3((aSeed-.5)*1.5,.4,1.2); vec3 p=mix(mix(aFrom,mid,e),mix(mid,aTo,e),e);
        p+=vec3(sin(uTime*2.+aSeed*50.),cos(uTime*1.7+aSeed*40.),0.)*.03; vK=k;
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_PointSize=(1.1+aSeed*1.3)*(52./-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `${GLSL_SAFE}uniform float uAlpha; varying float vK;
      void main(){ float d=length(gl_PointCoord-.5); float a=sstep(.5,.05,d); vec3 c=mix(vec3(1.,.62,.3),vec3(1.,.86,.6),vK);
        gl_FragColor=vec4(c*a*uAlpha*sstep(0.,.05,vK)*(1.-sstep(.85,1.,vK))*.9,1.); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const drops = new THREE.Points(dropGeo, dropMat); drops.frustumCulled = false; scene.add(drops);
  const priceRingMat = additive(GOLD.clone().multiplyScalar(1.1));
  const priceRing = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.125, 96), priceRingMat); priceRing.scale.set(1.3, 0.5, 1); priceRing.position.copy(PRICE_A); scene.add(priceRing);

  /* 선 -------------------------------------------------------------------------- */
  type Beam = { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; curve: THREE.CatmullRomCurve3 };
  const beam = (pts: THREE.Vector3[], color: THREE.Color, radius = 0.028): Beam => {
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal"); const len = curve.getLength();
    const mat = cableMat(color, len); const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, radius, 8, false), mat); scene.add(mesh);
    return { mesh, mat, curve };
  };
  // 7-1: 에이전트 → 도구 세 줄 (도구 겹이 펼쳐진 뒤의 위치 기준)
  const toolWorld = (i: number) => A.clone().add(TOOLS_OPEN).add(new THREE.Vector3(SW * 0.47, 0.42 - i * 0.84, 0.05).applyAxisAngle(new THREE.Vector3(0, 1, 0), TOOLS_OPEN_RY));
  const toolBeams = [0, 1, 2].map((i) => { const to = toolWorld(i); const mid = AGENT_TOOLS.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 0.35, 0.6)); return beam([AGENT_TOOLS.clone(), mid, to], ICE); });
  // 8-1: 에이전트 → 두 판매처의 조건
  // 조건 카드의 에이전트 쪽 가장자리로 들어간다
  const readBeams = [A, B].map((s, i) => { const to = s.clone().add(new THREE.Vector3((i ? -1 : 1) * SW / 2, -0.35, 0.1)); const mid = AGENT_SHOP.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 0.55, 0.9)); return beam([AGENT_SHOP.clone(), mid, to], ICE, 0.024); });
  const pickBeam = beam([AGENT_SHOP.clone(), AGENT_SHOP.clone().lerp(B, 0.5).add(new THREE.Vector3(0, 0.3, 1.4)), B.clone().add(new THREE.Vector3(-1.2, -0.9, 0.92))], GOLD, 0.04);
  const pickRingMat = additive(GOLD.clone().multiplyScalar(2));
  const pickRing = new THREE.Mesh(new THREE.RingGeometry(2.6, 2.66, 128), pickRingMat); pickRing.rotation.x = -Math.PI / 2; pickRing.position.set(B.x, 0.03, 0.2); scene.add(pickRing);
  const pickPool = pool(B, 9, GOLD);

  /* 먼지 */
  const dustGeo = new THREE.BufferGeometry();
  { const r = rand(12), n = 700, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([-12 + r() * 30, r() * 9, -12 + r() * 24], i * 3); dustGeo.setAttribute("position", new THREE.BufferAttribute(a, 3)); }
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: new THREE.Color("#7fb4dc"), size: 0.05, map: glow, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);

  /* 상태 -------------------------------------------------------------------- */
  const cam = { from: new THREE.Vector3(), fromLook: new THREE.Vector3(), eye: new THREE.Vector3(...POSES[pc.phase].eye), look: new THREE.Vector3(...POSES[pc.phase].look), t0: -1e6, dur: 2.4 };
  if (pc.motion) {
    const f = pc.phase === 0 ? INTRO : { eye: POSES[pc.phase].eye.map((v) => v * 1.06) as [number, number, number], look: POSES[pc.phase].look };
    cam.from.set(...f.eye); cam.fromLook.set(...f.look); cam.t0 = 0; cam.dur = pc.phase === 0 ? 3.0 : 1.8;
  }
  const eyeNow = new THREE.Vector3(...POSES[pc.phase].eye), lookNow = new THREE.Vector3(...POSES[pc.phase].look);
  const pointerS = new THREE.Vector2();
  const S: Record<string, number> = {};
  /** 공간에 남는 상태(투명도·빛)는 목표값으로 부드럽게 따라간다. 모션이 꺼지면 바로 목표값. */
  const follow = (k: string, target: number, dt: number, rate = 3) => {
    if (S[k] === undefined || !pc.motion) return (S[k] = target);
    return (S[k] += (target - S[k]) * (1 - Math.exp(-dt * rate)));
  };
  const lerpV = (a: THREE.Vector3, b: THREE.Vector3, t: number) => a.clone().lerp(b, t);
  const bezier = (a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, t: number) => lerpV(lerpV(a, c, t), lerpV(c, b, t), t);

  function update(dt: number) {
    pc.tick(dt);
    const p = pc.phase, t = pc.t, time = pc.clock, ev = (s: number, d: number) => pc.ev(s, d);

    /* 카메라 */
    const k = pc.motion ? easeInOut(clamp01((time - cam.t0) / cam.dur)) : 1;
    eyeNow.lerpVectors(cam.from, cam.eye, k); lookNow.lerpVectors(cam.fromLook, cam.look, k);
    if (pc.motion) {
      pointerS.lerp(stage.pointer, 1 - Math.exp(-dt * 2));
      eyeNow.x += Math.sin(time * 0.17) * 0.22 + pointerS.x * 0.6;
      eyeNow.y += Math.sin(time * 0.21) * 0.1 - pointerS.y * 0.3;
    }
    camera.position.copy(eyeNow); camera.lookAt(lookNow);
    floorU.uLit.value = follow("floor", 1, dt, 1.2);

    /* 사람 확인 (0) */
    const gateOn = p <= 1 ? 1 : 0;
    const clicked = p === 0 ? t > 1.75 : true;
    capMat.map = clicked ? capOn : capOff;
    capMat.opacity = follow("cap", gateOn, dt); gateStandMat.opacity = capMat.opacity;
    gate.visible = capMat.opacity > 0.01;
    // 커서: 왼쪽에서 들어와 체크박스를 누르고, 화면 안으로 들어간다.
    if (p === 0) {
      const c0 = GATE.clone().add(new THREE.Vector3(-3.6, 1.8, 2.4)), click = gate.localToWorld(checkPos.clone()).add(new THREE.Vector3(0, 0, 0.05));
      const inside = A.clone().add(new THREE.Vector3(-1.2, 0.3, 0.15));
      let pos: THREE.Vector3, a = 1;
      if (t < 1.6) pos = bezier(c0, c0.clone().lerp(click, 0.5).add(new THREE.Vector3(0.4, 0.6, 0)), click, easeInOut(ev(0.4, 1.2)));
      else if (t < 2.2) pos = click;
      else { pos = lerpV(click, inside, easeInOut(ev(2.2, 1.3))); a = 1 - smooth(2.9, 3.5, t); }
      a *= smooth(0.3, 0.7, t);
      cursor.position.copy(pos); cursor.lookAt(camera.position); cursor.position.addScaledVector(new THREE.Vector3(0, 0, 1), 0.02);
      cursorMat.opacity = a; (cursorGlow.material as THREE.SpriteMaterial).opacity = a * 0.35; cursorGlow.position.copy(pos);
      const ck = ev(1.6, 0.6); clickRingMat.opacity = ck > 0 && ck < 1 ? (1 - ck) * 0.9 : 0; clickRing.scale.setScalar(0.6 + ck * 1.6);
      ANCHORS.human.copy(pos).add(new THREE.Vector3(0.2, 0.3, 0));
    } else { cursorMat.opacity = 0; (cursorGlow.material as THREE.SpriteMaterial).opacity = 0; clickRingMat.opacity = 0; }

    /* 에이전트 위치 */
    let ap: THREE.Vector3;
    if (p === 0) {
      const start = AGENT_WAIT.clone().add(new THREE.Vector3(-5.5, 0.8, 3));
      ap = bezier(start, start.clone().lerp(AGENT_WAIT, 0.5).add(new THREE.Vector3(0, 0.9, 0)), AGENT_WAIT, easeOut(ev(1.6, 1.6)));
    } else if (p === 1) {
      const e = easeInOut(ev(0.9, 1.6));
      ap = bezier(AGENT_WAIT, new THREE.Vector3(1.5, 0.9, 6.2), AGENT_TOOLS, e);
    } else {
      ap = p === 2 ? lerpV(AGENT_TOOLS, AGENT_SHOP, easeInOut(ev(0.2, 1.6))) : AGENT_SHOP.clone();
    }
    ap.y += Math.sin(time * 1.4) * 0.06;
    agent.scale.setScalar(follow("agentScale", p === 4 ? 0.55 : 1, dt, 3));
    agent.position.copy(ap); ANCHORS.agent.copy(ap).add(new THREE.Vector3(0, 0.75, 0));
    core.rotation.y = time * 0.8; shell.rotation.y = -time * 0.3; orbit.rotation.z = time * 0.9;
    // 사람 확인 앞에서 멈춰 섰을 때의 빛의 막
    const wait = p === 0 ? smooth(2.9, 3.3, t) : 0;
    veilMat.uniforms.uAlpha.value = follow("veil", p === 0 ? 0.25 + wait * 0.35 : 0, dt, 4);
    veilMat.uniforms.uHit.value = p === 0 ? ev(3.0, 1.2) : 1;
    veilMat.uniforms.uTime.value = time;
    gatePool.opacity = follow("gatePool", p === 0 ? 0.25 + wait * 0.35 : 0, dt);
    coreMat.emissive.copy(ICE).lerp(AMBER, p === 0 ? wait * 0.55 : 0);

    /* A: 겹이 열린다 (1), 다시 닫힌다 (2~) */
    const open = p === 1 ? easeInOut(ev(0.2, 1.4)) : 0;
    const openS = follow("open", open, dt, p === 1 ? 20 : 3);
    storeA.ui.position.copy(UI_OPEN).multiplyScalar(openS);
    storeA.ui.rotation.y = UI_OPEN_RY * openS;
    storeA.tools.position.copy(TOOLS_OPEN).multiplyScalar(openS);
    storeA.tools.rotation.y = TOOLS_OPEN_RY * openS;
    const toolsA = p === 1 ? smooth(0.5, 1.4, t) : 0;
    const toolsV = follow("tools", toolsA, dt, p === 1 ? 20 : 4);
    toolPanelMat.uniforms.uAlpha.value = toolsV; toolPanelMat.uniforms.uTime.value = time;
    toolHeaderMat.opacity = toolsV;
    toolRows.forEach((r, i) => {
      r.mat.opacity = toolsV;
      const call = p === 1 ? ev(2.6 + i * 0.55, 0.55) : 0;
      r.flash.opacity = call > 0 && call < 1 ? Math.sin(call * Math.PI) * 0.7 : (p === 1 && t > 2.6 + i * 0.55 ? 0.18 : 0);
      const b = toolBeams[i];
      b.mat.uniforms.uDraw.value = p === 1 ? easeOut(ev(2.3 + i * 0.55, 0.6)) : 0;
      b.mat.uniforms.uLit.value = follow(`tb${i}`, p === 1 ? 1 : 0, dt, 5);
      b.mat.uniforms.uTime.value = time; b.mesh.visible = b.mat.uniforms.uLit.value > 0.01;
    });
    ANCHORS.tools.copy(A).add(TOOLS_OPEN).add(new THREE.Vector3(0.9, SH / 2 + 0.3, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), TOOLS_OPEN_RY));
    ANCHORS.gate.copy(GATE).add(new THREE.Vector3(0.9, 0.55, 0));
    ANCHORS.site.copy(A).add(new THREE.Vector3(SW * 0.3, SH / 2 + 0.25, 0));

    /* B와 광고판 (2~) */
    const shop = p >= 2 ? 1 : 0;
    const bIn = follow("bIn", shop, dt, 2.2);
    const bDim = follow("bDim", p === 4 ? 0.3 : 1, dt, 3);
    storeB.uiMat.opacity = bIn * bDim; storeB.uiFrame.opacity = bIn * bDim; storeB.stand.opacity = bIn; storeB.root.visible = bIn > 0.01;
    storeB.root.position.y = B.y - (1 - bIn) * 0.4;
    const billOn = p === 2 ? smooth(0.6, 1.4, t) : p >= 3 ? 1 : 0;
    // 4: 광고판은 빛을 가격표에 넘겨주고 희미한 윤곽만 남긴다.
    const billFade = p === 4 ? 1 - 0.78 * smooth(0.2, 2.6, t) : 1;
    const billDim = p === 3 ? 0.12 : 1;
    const billA = follow("bill", billOn * billFade * billDim, dt, 3);
    billMat.opacity = billA; billGlowMat.opacity = billA * 0.4 * (0.85 + 0.15 * Math.sin(time * 5.3));
    cones.forEach((m) => { m.uniforms.uAlpha.value = billA; });
    bill.visible = billA > 0.01;

    /* 에이전트가 읽는 조건 (3) */
    const readA = follow("read", p === 3 ? 1 : 0, dt, 3.5);
    [storeA, storeB].forEach((s, i) => {
      if (p === 3) s.dataMat.opacity = S[`data${i}`] = smooth(0.6 + i * 0.25, 1.3 + i * 0.25, t);
      else s.dataMat.opacity = follow(`data${i}`, 0, dt, 5);
      s.data.visible = s.dataMat.opacity > 0.01;
    });
    // 조건을 읽는 동안 화면(광고·사진)은 흐려진다
    const uiDim = 1 - 0.72 * readA;
    storeA.uiMat.opacity = uiDim; storeA.uiMat.color.setScalar(0.92 * (0.4 + 0.6 * uiDim));
    storeB.uiMat.color.setScalar(0.92 * (0.4 + 0.6 * (1 - 0.72 * readA)));
    if (p === 3) storeB.uiMat.opacity = Math.min(storeB.uiMat.opacity, 1 - 0.72 * readA);
    readBeams.forEach((b, i) => {
      b.mat.uniforms.uDraw.value = p === 3 ? easeOut(ev(0.3 + i * 0.25, 0.8)) : 0;
      b.mat.uniforms.uLit.value = follow(`rb${i}`, p === 3 ? 0.9 : 0, dt, 5) * (p === 3 ? 1 - smooth(2.4, 3.0, t) * 0.6 : 1);
      b.mat.uniforms.uTime.value = time; b.mesh.visible = b.mat.uniforms.uLit.value > 0.01;
    });
    const pick = p === 3 ? smooth(2.3, 2.9, t) : 0;
    pickBeam.mat.uniforms.uDraw.value = p === 3 ? easeOut(ev(2.3, 0.7)) : 0;
    pickBeam.mat.uniforms.uLit.value = follow("pb", pick, dt, 5); pickBeam.mat.uniforms.uTime.value = time; pickBeam.mesh.visible = pickBeam.mat.uniforms.uLit.value > 0.01;
    const pickV = follow("pick", p === 3 ? pick : 0, dt, 4);
    pickRingMat.opacity = pickV * 0.9; pickRing.scale.setScalar(1 + (1 - pickV) * 0.15); pickPool.opacity = pickV * 0.45;
    storeB.pool.opacity = follow("poolB", p >= 2 ? 0.18 : 0, dt);
    storeA.pool.opacity = follow("poolA", 0.22, dt);
    ANCHORS.storeA.copy(A).add(new THREE.Vector3(-SW / 2 + 0.3, -SH / 2 - 0.35, 0.3));
    ANCHORS.storeB.copy(B).add(new THREE.Vector3(-SW / 2 + 0.3, -SH / 2 - 0.35, 0.3));
    ANCHORS.bill.copy(BILL).add(new THREE.Vector3(billW / 2 + 0.2, 0, 0));
    ANCHORS.pick.copy(B).add(new THREE.Vector3(0, SH / 2 + 0.3, 0.9));
    ANCHORS.priceA.copy(PRICE_A).add(new THREE.Vector3(1.7, 0.2, 0));

    /* 광고비 → 가격 (4) */
    dropMat.uniforms.uT.value = p === 4 ? ev(0.3, 2.6) : 0;
    dropMat.uniforms.uLoop.value = p === 4 ? smooth(2.6, 3.6, t) : 0;
    dropMat.uniforms.uAlpha.value = p === 4 ? 1 : 0;
    dropMat.uniforms.uTime.value = time; drops.visible = p === 4;
    priceRingMat.opacity = follow("priceRing", p === 4 ? 0.55 * smooth(1.6, 2.6, t) : 0, dt) * (0.8 + 0.2 * Math.sin(time * 3));

    dust.rotation.y = time * 0.006;
  }

  stage.start(update, () => pc.motion);

  return {
    setPhase(next) {
      next = Math.max(0, Math.min(PHASES - 1, next));
      if (next === pc.phase) return;
      const forward = pc.go(next);
      cam.from.copy(camera.position); cam.fromLook.copy(lookNow);
      cam.eye.set(...POSES[next].eye); cam.look.set(...POSES[next].look); cam.t0 = pc.clock; cam.dur = forward ? 2.2 : 1.4;
      stage.kick();
    },
    setMotion(on) {
      pc.setMotion(on);
      if (!on) { cam.t0 = -1e6; cam.from.copy(cam.eye); cam.fromLook.copy(cam.look); }
      stage.kick();
    },
    setPointer(x, y) { stage.pointer.set(x, y); },
    project: (id) => stage.project(ANCHORS[id]),
    labelAlpha() {
      if (!pc.motion) return 1;
      return smooth(0.7, 1, clamp01((pc.clock - cam.t0) / cam.dur));
    },
    onFrame: stage.onFrame,
    dispose: stage.dispose,
  };
}
