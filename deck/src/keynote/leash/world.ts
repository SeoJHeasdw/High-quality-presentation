import * as THREE from "three";
import { FONT, GLSL_SAFE, PhaseClock, createStage, easeInOut, easeOut, pixelCamera, rand, smooth, toWorld } from "../stage3d/runtime";

/*
 * 40번 · 신에게 목줄이 걸릴까요? 2번의 입자 문법을 거꾸로 쓴다. 2번에서는 사진이 단어가 됐고, 여기서는 단어가 모여 몸이 된다.
 *  -1  (39번에서 이어짐) 휴대전화 자막이 있던 자리에 가짜 아들의 말이 붉은 입자로 떠 있다가, 풀리며 파랑이 되어
 *      깊이 흩어진다. 그 자리에서 사람을 움직여 온 낱말들이 떠오른다. 가짜였던 말이 빨강을 잃고 말들 사이로 섞인다.
 *   0  어둠 속에 사람을 움직여 온 낱말들(약속·설득·명령·prompt…)이 떠 있다가, 흘러와 사람의 형태를 이룬다(파랑 = 기계).
 *   1  금색 고리(사람이 채우려는 목줄)가 다가와 목을 감으려 하지만 닫히지 않고, 끝에서 금빛이 흩어진다.
 *   2  (41번 첫 단계) 고리가 풀려 떨어지고, 몸의 입자가 금빛으로 옮겨 가 집을 짓는다(새벽 집 렌더의 불 켜진 창과 윤곽).
 *      입자 집 아래로 그 렌더가 떠오른다. 2번의 "사진 → 입자"를 거꾸로 쓴다.
 *   3  (41번 둘째 단계) 사진에 멈춘다. 캔버스는 DOM이 흐리게 걷어내고 마무리의 흐린 새벽 배경이 이어받는다.
 * 40번과 41번은 한 묶음(finale)이라 캔버스가 장을 넘어 이어진다. 장이 바뀌어도 화면이 깜빡이지 않는다.
 * 실루엣은 외부 이미지 없이 캔버스에 직접 그린 형태를 입자로 샘플링한다. 빨강은 쓰지 않는다(사실이 아님을 뜻하는 색이다).
 * 카메라는 z=0 평면의 1단위가 화면 1px이 되도록 둔다(DOM과 같은 좌표).
 */

export const PHASES = 4;
/** 39번에서 넘어오는 이음새 한 단계. 기존 단계 번호(0, 1)는 그대로 둔다. */
export const MIN_PHASE = -1;
/** 39·37번 가상 통화의 자막 가운데 네 줄(NightPhone.tsx의 FAKE_LINES). 39번 휴대전화 자막 자리(화면 오른쪽)에 놓는다. */
const SCAM = ["엄마… 나야.", "나 사고 났어.", "지금 좀 급해.", "아빠한테는 말하지 마."];
const SCAM_AT = { x: 1080, y: 372, gap: 104 };
const RED = new THREE.Color("#ff6259");
export const LAYOUT = { body: { x: 1300, y: 600, h: 820 }, neckY: 0 };
const ICE = new THREE.Color("#8fd0ff");
const GOLD = new THREE.Color("#ffd899");
const WORDS = ["약속", "설득", "명령", "거짓말", "기도", "계약", "법", "광고", "소문", "뉴스", "맹세", "부탁", "허락", "거절", "promise", "command", "prompt", "token", "law", "prayer", "story", "yes", "no", "obey", "please", "believe"];

/** 새벽 집 렌더 속 집의 자리(화면 px). 입자는 이 안의 밝은 곳과 윤곽으로 간다. */
const HOUSE = { x0: 770, y0: 300, x1: 1770, y1: 830 };
/** 사진의 밝기. 41번 첫 단계에서 캔버스가 그리는 새벽 집 */
const PLATE_BRIGHTNESS = 0.72;

/** 사진에서 집의 밝은 곳(창·빛)과 윤곽을 골라 목표점과 그 자리의 색을 만든다. */
function sampleHouse(image: HTMLImageElement, count: number) {
  const W = 1920, H = 1080, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(image, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H).data;
  const lum = (x: number, y: number) => { const k = (y * W + x) * 4; return (0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]) / 255; };
  const bright: number[] = [], edge: number[] = [];
  for (let y = HOUSE.y0; y < HOUSE.y1; y += 2) for (let x = HOUSE.x0; x < HOUSE.x1; x += 2) {
    const l = lum(x, y);
    if (l > 0.62) bright.push(x, y);
    else if (Math.abs(lum(x + 2, y) - lum(x - 2, y)) + Math.abs(lum(x, y + 2) - lum(x, y - 2)) > 0.22) edge.push(x, y);
  }
  const r = rand(29), pts: { x: number; y: number; c: [number, number, number] }[] = [];
  for (let i = 0; i < count; i++) {
    const src = r() < 0.72 ? bright : edge, k = Math.floor(r() * (src.length / 2)) * 2, x = src[k], y = src[k + 1], j = (y * W + x) * 4;
    pts.push({ x: x + (r() - .5) * 2, y: y + (r() - .5) * 2, c: [d[j] / 255, d[j + 1] / 255, d[j + 2] / 255] });
  }
  return pts;
}

export type LeashWorld = { setPhase: (p: number) => void; setMotion: (on: boolean) => void; setPointer: (x: number, y: number) => void; onFrame: (cb: () => void) => void; dispose: () => void };

/** 사람의 상반신 실루엣을 그려 안쪽 점과 윤곽 점을 고른다. 좌표는 몸의 중심 기준 px, 위가 +y. */
export function sampleBody(count: number, h: number): { pts: [number, number][]; neck: number; neckW: number } {
  const W = 600, H = 800, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.fillStyle = "#fff";
  g.beginPath(); g.ellipse(300, 150, 74, 92, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(262, 220); g.lineTo(338, 220); g.lineTo(342, 300); g.lineTo(258, 300); g.closePath(); g.fill();
  g.beginPath();
  g.moveTo(258, 292); g.bezierCurveTo(205, 310, 120, 312, 92, 362); g.bezierCurveTo(62, 410, 58, 520, 50, 800);
  g.lineTo(550, 800); g.bezierCurveTo(542, 520, 538, 410, 508, 362); g.bezierCurveTo(480, 312, 395, 310, 342, 292); g.closePath(); g.fill();
  const data = g.getImageData(0, 0, W, H).data;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && data[(y * W + x) * 4 + 3] > 128;
  const fill: number[] = [], edge: number[] = [];
  for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) {
    if (!inside(x, y)) continue;
    (inside(x - 6, y) && inside(x + 6, y) && inside(x, y - 6) && inside(x, y + 6) ? fill : edge).push(x, y);
  }
  const r = rand(31), s = h / H, pts: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const src = r() < 0.34 ? edge : fill, k = Math.floor(r() * (src.length / 2)) * 2;
    pts.push([(src[k] - W / 2 + (r() - .5) * 3) * s, (H / 2 - src[k + 1] + (r() - .5) * 3) * s]);
  }
  return { pts, neck: (H / 2 - 262) * s, neckW: 84 * s };
}

/** 자막 한 줄씩 그려 글자 안의 점을 고른다. 좌표는 줄의 왼쪽 끝·가운데 기준 px, 위가 +y. */
function sampleLines(lines: string[], perLine: number) {
  const W = 900, H = 120, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  const r = rand(53), out: { line: number; x: number; y: number }[] = [];
  lines.forEach((text, li) => {
    g.clearRect(0, 0, W, H); g.fillStyle = "#fff"; g.font = `700 60px ${FONT}`; g.textBaseline = "middle"; g.fillText(text, 4, 62);
    const d = g.getImageData(0, 0, W, H).data, px: number[] = [];
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (d[(y * W + x) * 4 + 3] > 140) px.push(x, y);
    for (let i = 0; i < perLine; i++) { const k = Math.floor(r() * (px.length / 2)) * 2; out.push({ line: li, x: px[k] - 4, y: 60 - px[k + 1] }); }
  });
  return out;
}

/** 낱말을 작은 글자로 그려 글자 안의 점을 고른다(낱말마다 점 무리 하나). */
function sampleWords(perWord: number) {
  const out: { word: number; x: number; y: number }[] = [];
  const c = document.createElement("canvas"); c.width = 520; c.height = 160;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  const r = rand(7);
  WORDS.forEach((w, wi) => {
    g.clearRect(0, 0, 520, 160); g.fillStyle = "#fff"; g.font = `700 92px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(w, 260, 84);
    const d = g.getImageData(0, 0, 520, 160).data, px: number[] = [];
    for (let y = 0; y < 160; y += 2) for (let x = 0; x < 520; x += 2) if (d[(y * 520 + x) * 4 + 3] > 140) px.push(x, y);
    for (let i = 0; i < perWord; i++) { const k = Math.floor(r() * (px.length / 2)) * 2; out.push({ word: wi, x: px[k] - 260, y: 80 - px[k + 1] }); }
  });
  return out;
}

export function createLeashWorld(canvas: HTMLCanvasElement, dawn: HTMLImageElement, initialPhase: number, initialMotion: boolean): LeashWorld {
  const stage = createStage(canvas, { background: "#030508", fov: 30, bloom: [0.7, 0.6, 0.72], exposure: 1.0, lostEvent: "leash-lost" });
  const { scene, camera, glow } = stage;
  const camD = pixelCamera(camera);
  const pc = new PhaseClock(Math.max(MIN_PHASE, Math.min(PHASES - 1, initialPhase)), initialMotion);
  const B = LAYOUT.body, center = toWorld(B.x, B.y);

  /* 낱말 → 몸 ------------------------------------------------------------------------------ */
  const words = sampleWords(260);
  const m = words.length;
  const body = sampleBody(m, B.h);
  const aWord = new Float32Array(m * 3), aBody = new Float32Array(m * 3), aSeed = new Float32Array(m), aEdge = new Float32Array(m);
  {
    const r = rand(19);
    // 낱말마다 자리를 정한다: 오른쪽 2/3과 깊이에 흩어 두고, 글 단(왼쪽)은 비운다
    const spots = WORDS.map((_, i) => {
      const col = i % 6, row = Math.floor(i / 6);
      const x = 1010 + col * 158 + (r() - .5) * 110, y = 170 + row * 185 + (r() - .5) * 120;
      return toWorld(x, y).setZ(-950 + r() * 1150);
    });
    const sc = WORDS.map(() => 0.34 + r() * 0.3);
    for (let i = 0; i < m; i++) {
      const w = words[i], s = spots[w.word];
      // 몸의 중심을 원점으로 둔다(포인터를 따라 몸이 제자리에서 조금 돈다)
      aWord.set([s.x + w.x * sc[w.word] - center.x, s.y + w.y * sc[w.word] - center.y, s.z], i * 3);
      const b = body.pts[i];
      aBody.set([b[0], b[1], (r() - .5) * 40], i * 3);
      aSeed[i] = r(); aEdge[i] = w.word / WORDS.length;
    }
  }
  // 41번 첫 단계: 몸의 점마다 새벽 집 속 자리와 그 자리의 색(선형). 어두운 윤곽 점은 금빛으로 끌어올린다.
  const aHouse = new Float32Array(m * 3), aCol = new Float32Array(m * 3);
  {
    const house = sampleHouse(dawn, m), r = rand(61);
    for (let i = 0; i < m; i++) {
      const h = house[i], w = toWorld(h.x, h.y);
      aHouse.set([w.x - center.x, w.y - center.y, (r() - .5) * 10], i * 3);
      const lin = h.c.map((v) => Math.pow(v, 2.2)) as [number, number, number];
      const lift = Math.max(0, 0.5 - (0.3 * lin[0] + 0.6 * lin[1] + 0.1 * lin[2]));
      aCol.set([lin[0] + GOLD.r * lift, lin[1] + GOLD.g * lift, lin[2] + GOLD.b * lift], i * 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(aBody.slice(), 3));
  geo.setAttribute("aHouse", new THREE.BufferAttribute(aHouse, 3));
  geo.setAttribute("aCol", new THREE.BufferAttribute(aCol, 3));
  geo.setAttribute("aWord", new THREE.BufferAttribute(aWord, 3));
  geo.setAttribute("aBody", new THREE.BufferAttribute(aBody, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(aSeed, 1));
  geo.setAttribute("aGroup", new THREE.BufferAttribute(aEdge, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uIn: { value: 0 }, uForm: { value: 0 }, uBuild: { value: 0 }, uFade: { value: 1 }, uTime: { value: 0 }, uD: { value: camD }, uIce: { value: ICE.clone() }, uGold: { value: GOLD.clone() }, uNeck: { value: new THREE.Vector2(0, body.neck) }, uStrain: { value: 0 } },
    vertexShader: `${GLSL_SAFE}
      attribute vec3 aWord; attribute vec3 aBody; attribute vec3 aHouse; attribute vec3 aCol; attribute float aSeed; attribute float aGroup;
      uniform float uIn,uForm,uBuild,uFade,uTime,uD,uStrain; uniform vec2 uNeck; uniform vec3 uIce,uGold; varying float vA; varying float vHot; varying vec3 vC;
      void main(){
        // 낱말 무리는 무리마다 조금씩 늦게 출발한다
        float k=clamp(uForm*1.6-aGroup*.45-aSeed*.15,0.,1.); k=k*k*(3.-2.*k);
        vec3 drift=vec3(sin(uTime*.21+aGroup*17.)*28.,cos(uTime*.17+aGroup*11.)*18.,0.);
        vec3 w=aWord+drift*(1.-k);
        vec3 mid=mix(w,aBody,.5)+vec3(-120.+aGroup*240.,80.*sin(aGroup*20.),260.);
        vec3 p=mix(mix(w,mid,k),mix(mid,aBody,k),k);
        // 몸이 된 뒤에도 표면은 숨 쉬듯 흔들린다
        p+=vec3(sin(uTime*1.3+aSeed*50.),cos(uTime*1.1+aSeed*40.),sin(uTime*.9+aSeed*30.))*(1.2+2.5*k);
        // 41번: 머리부터 풀려 집이 된다(위쪽 점이 먼저 출발한다)
        float order=clamp((aBody.y+500.)/1000.,0.,1.);
        float b=clamp(uBuild*1.6-(1.-order)*.35-aSeed*.25,0.,1.); b=b*b*(3.-2.*b);
        vec3 mid2=mix(aBody,aHouse,.5)+vec3(-90.+aSeed*180.,120.+aSeed*120.,240.+aSeed*200.);
        p=mix(p,mix(mix(aBody,mid2,b),mix(mid2,aHouse,b),b),sstep(0.,.02,b));
        float neck=exp(-pow(length(p.xy-uNeck)/140.,2.));
        vHot=neck*uStrain*.6;
        vC=mix(mix(uIce*1.15,vec3(.9,.97,1.)*1.5,vHot),mix(uGold*1.2,aCol*1.6+uGold*.15,.6),sstep(.15,.85,b));
        vA=uIn*(.55+.45*k)*uFade;
        vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_PointSize=(2.1+aSeed*1.4)*(uD/-mv.z);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: `${GLSL_SAFE}varying float vA; varying vec3 vC;
      void main(){ float d=length(gl_PointCoord-.5); float a=sstep(.5,.05,d); gl_FragColor=vec4(vC*a*vA,1.); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat); points.frustumCulled = false; points.position.copy(center); scene.add(points);
  // 41번: 새벽 집 렌더. 화면과 같은 1920×1080이라 입자의 목표점이 사진 속 자리와 같다.
  const dawnTex = new THREE.Texture(dawn); dawnTex.colorSpace = THREE.SRGBColorSpace; dawnTex.needsUpdate = true; stage.keep(dawnTex);
  const plateMat = new THREE.MeshBasicMaterial({ map: dawnTex, transparent: true, opacity: 0, toneMapped: false, depthWrite: false, color: new THREE.Color(PLATE_BRIGHTNESS, PLATE_BRIGHTNESS, PLATE_BRIGHTNESS) });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1920, 1080), plateMat); plate.position.z = -2; plate.renderOrder = -1; scene.add(plate);
  const bodyGlowMat = new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color("#3f78a8"), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const bodyGlow = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1300), bodyGlowMat); bodyGlow.position.copy(center).setZ(-220); scene.add(bodyGlow);

  /* 이음새(-1): 가짜 아들의 말 → 낱말들 사이로 --------------------------------------------------- */
  const lines = sampleLines(SCAM, 1500), n = lines.length;
  const sFrom = new Float32Array(n * 3), sTo = new Float32Array(n * 3), sSeed = new Float32Array(n), sLine = new Float32Array(n);
  {
    const r = rand(71);
    for (let i = 0; i < n; i++) {
      const L = lines[i], at = toWorld(SCAM_AT.x + L.x, SCAM_AT.y + L.line * SCAM_AT.gap - L.y);
      sFrom.set([at.x, at.y, 0], i * 3);
      // 낱말 무리의 한 점으로 흘러간다: 가짜였던 말이 사람을 움직여 온 말들 사이에 섞인다
      const j = Math.floor(r() * m) * 3;
      sTo.set([aWord[j] + center.x, aWord[j + 1] + center.y, aWord[j + 2]], i * 3);
      sSeed[i] = r(); sLine[i] = L.line;
    }
  }
  const scamGeo = new THREE.BufferGeometry();
  scamGeo.setAttribute("position", new THREE.BufferAttribute(sFrom.slice(), 3));
  scamGeo.setAttribute("aFrom", new THREE.BufferAttribute(sFrom, 3));
  scamGeo.setAttribute("aTo", new THREE.BufferAttribute(sTo, 3));
  scamGeo.setAttribute("aSeed", new THREE.BufferAttribute(sSeed, 1));
  scamGeo.setAttribute("aLine", new THREE.BufferAttribute(sLine, 1));
  const scamMat = new THREE.ShaderMaterial({
    uniforms: { uShow: { value: 0 }, uGo: { value: 0 }, uTime: { value: 0 }, uD: { value: camD }, uRed: { value: RED.clone() }, uIce: { value: ICE.clone() } },
    vertexShader: `${GLSL_SAFE}
      attribute vec3 aFrom; attribute vec3 aTo; attribute float aSeed; attribute float aLine;
      uniform float uShow,uGo,uTime,uD; varying float vA; varying float vG;
      void main(){
        float show=clamp(uShow*1.8-aLine*.26,0.,1.);
        float g=clamp(uGo*1.5-aSeed*.5,0.,1.); g=g*g*(3.-2.*g);
        vec3 mid=mix(aFrom,aTo,.5)+vec3(-60.+aSeed*120.,50.+aSeed*140.,180.+aSeed*160.);
        vec3 p=mix(mix(aFrom,mid,g),mix(mid,aTo,g),g);
        p+=vec3(sin(uTime*1.2+aSeed*40.),cos(uTime*1.05+aSeed*33.),0.)*(1.+5.*g);
        vA=show*(1.-sstep(.72,1.,g)); vG=g;
        vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_PointSize=(2.2+aSeed*1.3)*(uD/-mv.z);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: `${GLSL_SAFE}uniform vec3 uRed,uIce; varying float vA; varying float vG;
      void main(){ float d=length(gl_PointCoord-.5); float a=sstep(.5,.05,d); vec3 c=mix(uRed*1.2,uIce*1.15,sstep(.08,.6,vG)); gl_FragColor=vec4(c*a*vA,1.); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const scam = new THREE.Points(scamGeo, scamMat); scam.frustumCulled = false; scene.add(scam);
  const scamGlowMat = new THREE.MeshBasicMaterial({ map: glow, color: RED.clone().multiplyScalar(0.5), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const scamGlow = new THREE.Mesh(new THREE.PlaneGeometry(1200, 700), scamGlowMat); scamGlow.position.copy(toWorld(SCAM_AT.x + 300, SCAM_AT.y + 1.5 * SCAM_AT.gap)).setZ(-200); scene.add(scamGlow);

  /* 금색 고리: 닫히지 않는 목줄 --------------------------------------------------------------- */
  const neck = new THREE.Vector3(center.x, center.y + body.neck - 6, 0);
  const R0 = body.neckW * 0.9;
  const ringMat = new THREE.ShaderMaterial({
    uniforms: { uArc: { value: 0.72 }, uA: { value: 0 }, uTime: { value: 0 }, uGold: { value: GOLD.clone() } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `${GLSL_SAFE}varying vec2 vUv; uniform float uArc,uA,uTime; uniform vec3 uGold;
      void main(){ float u=vUv.x; if(u>uArc) discard;
        float end=min(u,uArc-u); float spark=exp(-end*60.)*1.6;
        float pulse=.85+.15*sin(u*60.-uTime*4.);
        gl_FragColor=vec4(uGold*(1.3*pulse+spark)*uA,1.); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 12, 220), ringMat); scene.add(ring);
  const ringGlowMat = new THREE.MeshBasicMaterial({ map: glow, color: GOLD.clone().multiplyScalar(0.5), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const ringGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ringGlowMat); scene.add(ringGlow);
  // 고리 끝에서 떨어지는 금빛
  const sparkN = 420, sparkGeo = new THREE.BufferGeometry(), sparkSeed = new Float32Array(sparkN);
  { const r = rand(77); for (let i = 0; i < sparkN; i++) sparkSeed[i] = r(); }
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(sparkN * 3), 3));
  sparkGeo.setAttribute("aSeed", new THREE.BufferAttribute(sparkSeed, 1));
  const sparkMat = new THREE.ShaderMaterial({
    uniforms: { uA: { value: 0 }, uTime: { value: 0 }, uD: { value: camD }, uEndA: { value: new THREE.Vector3() }, uEndB: { value: new THREE.Vector3() }, uGold: { value: GOLD.clone() } },
    vertexShader: `${GLSL_SAFE}attribute float aSeed; uniform float uTime,uD,uA; uniform vec3 uEndA,uEndB; varying float vA;
      void main(){ float s=fract(uTime*.22+aSeed*7.31); vec3 o=aSeed<.5?uEndA:uEndB;
        vec3 p=o+vec3(sin(aSeed*97.)*s*90.,-s*s*380.-s*40.,cos(aSeed*71.)*s*60.);
        vA=uA*(1.-s)*(.4+.6*fract(aSeed*13.));
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_PointSize=(1.6+aSeed*1.8)*(uD/-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `${GLSL_SAFE}uniform vec3 uGold; varying float vA; void main(){ float d=length(gl_PointCoord-.5); gl_FragColor=vec4(uGold*1.4*sstep(.5,.05,d)*vA,1.); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat); sparks.frustumCulled = false; scene.add(sparks);

  /* 먼지 */
  const dustGeo = new THREE.BufferGeometry();
  { const r = rand(43), k = 700, a = new Float32Array(k * 3); for (let i = 0; i < k; i++) a.set([(r() - .5) * 3200, (r() - .5) * 1900, -1800 + r() * 1800], i * 3); dustGeo.setAttribute("position", new THREE.BufferAttribute(a, 3)); }
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: new THREE.Color("#5d86a8"), size: 4, map: glow, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(dust);

  const pointerS = new THREE.Vector2(), q = new THREE.Quaternion(), e = new THREE.Euler(), tmp = new THREE.Vector3();
  // 이음새에서 이미 떠오른 낱말은 다음 단계에서 다시 사라졌다 나타나지 않는다.
  let wordsIn = 0;
  function update(dt: number) {
    pc.tick(dt);
    const p = pc.phase, t = pc.t, time = pc.clock, u = (s: number, d: number) => pc.ev(s, d);

    // 이음새: 자막이 한 줄씩 서고(0.2~1.4초), 풀려서 흩어지며(2.3초~) 그 자리에서 낱말들이 떠오른다.
    const show = p === -1 ? smooth(0.2, 1.4, t) : 0;
    const go = p === -1 ? easeInOut(u(2.3, 2.0)) : 1;
    scam.visible = p === -1 && go < 0.999;
    scamMat.uniforms.uShow.value = show; scamMat.uniforms.uGo.value = go; scamMat.uniforms.uTime.value = time;
    scamGlowMat.opacity = 0.12 * show * (1 - smooth(0, 0.5, go));
    wordsIn = p === -1 ? smooth(2.8, 4.3, t) : Math.max(wordsIn, p === 0 ? smooth(0.1, 1.6, t) : 1);
    const fadeIn = wordsIn;
    const form = p === -1 ? 0 : p === 0 ? easeInOut(u(1.6, 3.6)) : 1;
    // 41번: 고리가 풀려 떨어지고(0.3~1.4), 몸이 집이 되고(0.9~3.5), 사진이 떠오른다(3.0~4.5).
    const drop = p === 2 ? easeInOut(u(0.3, 1.1)) : p > 2 ? 1 : 0;
    const build = p === 2 ? u(0.9, 2.6) : p > 2 ? 1 : 0;
    const photo = p === 2 ? smooth(3.0, 4.5, t) : p > 2 ? 1 : 0;
    const fade = p === 2 ? 1 - smooth(3.5, 4.9, t) : p > 2 ? 0 : 1;
    mat.uniforms.uIn.value = fadeIn; mat.uniforms.uForm.value = form; mat.uniforms.uTime.value = time;
    mat.uniforms.uBuild.value = build; mat.uniforms.uFade.value = fade;
    points.visible = fade > 0.001;
    plateMat.opacity = photo; plate.visible = photo > 0.001;
    bodyGlowMat.opacity = 0.16 * form * (1 - smooth(0, 0.4, build));
    (dust.material as THREE.PointsMaterial).opacity = 0.28 * (1 - photo);

    // 고리: 다가와서 좁혀지다가, 닫히지 못하고 다시 벌어진다. 41번에서는 그 자리에서 풀려 떨어진다.
    const come = p === 1 ? easeOut(u(0.3, 1.8)) : p > 1 ? 1 : 0;
    const squeeze = p === 1 ? easeInOut(u(1.9, 1.1)) : p > 1 ? 1 : 0;
    const give = p === 1 ? easeOut(u(3.1, 0.9)) : p > 1 ? 1 : 0;
    const shake = p === 1 && pc.motion ? Math.sin(time * 38) * (smooth(2.6, 3.0, t) - smooth(3.0, 3.5, t)) * 0.02 : 0;
    const arc = 0.62 + 0.3 * squeeze - 0.2 * give; // 0.92까지 닫히다가 0.72로 벌어져 멈춘다(끝내 닫히지 않는다)
    const radius = R0 * (5.5 - 4.5 * come) * (1 - 0.12 * squeeze + 0.1 * give);
    ring.visible = come > 0.001 && drop < 0.999;
    ringMat.uniforms.uArc.value = arc + shake; ringMat.uniforms.uA.value = come * (1 - drop); ringMat.uniforms.uTime.value = time;
    tmp.copy(neck).add(new THREE.Vector3(0, (1 - come) * 160 - drop * drop * 420, (1 - come) * 700));
    ring.position.copy(tmp); ring.scale.setScalar(radius);
    // 틈이 청중 쪽(앞 아래, 가슴 위)에 오도록 고리를 먼저 돌리고, 아래 가장자리가 앞으로 오게 눕힌다
    const spin = -Math.PI / 2 - (arc + 1) * Math.PI + (1 - come) * 3.2 + shake * 4;
    e.set(-1.18 + 0.08 * give, 0.1 + (1 - come) * 0.9, spin); q.setFromEuler(e); ring.quaternion.copy(q);
    ringGlow.position.copy(tmp).setZ(tmp.z - 30); ringGlow.scale.setScalar(radius * 5); ringGlowMat.opacity = 0.2 * come * (1 - drop);
    // 끝점: 토러스의 u=0과 u=arc 지점
    const endAt = (uu: number, out: THREE.Vector3) => out.set(Math.cos(uu * Math.PI * 2), Math.sin(uu * Math.PI * 2), 0).multiplyScalar(radius).applyQuaternion(q).add(tmp);
    endAt(0, sparkMat.uniforms.uEndA.value); endAt(arc, sparkMat.uniforms.uEndB.value);
    sparkMat.uniforms.uA.value = p === 1 ? smooth(3.1, 3.8, t) : 0; sparkMat.uniforms.uTime.value = time; sparks.visible = p === 1;
    mat.uniforms.uStrain.value = p === 1 ? smooth(1.9, 2.8, t) * (1 - 0.5 * give) : 0;

    if (pc.motion) {
      pointerS.lerp(stage.pointer, 1 - Math.exp(-dt * 2));
      // 집이 될 때는 몸이 돌지 않는다. 입자가 사진 속 제자리에 앉아야 한다.
      const still = 1 - smooth(0, 0.3, build);
      points.rotation.y = (pointerS.x * 0.05 + Math.sin(time * 0.2) * 0.03) * still;
      points.rotation.x = pointerS.y * 0.03 * still;
    }
    dust.rotation.y = time * 0.003;
  }
  // 사진이 선 뒤(41번)에는 그릴 것이 바뀌지 않으므로 멈춘다.
  stage.start(update, () => pc.motion && (pc.phase < 2 || (pc.phase === 2 && pc.t < 5.2)));

  return {
    setPhase(next) { next = Math.max(MIN_PHASE, Math.min(PHASES - 1, next)); if (next === pc.phase) return; pc.go(next); stage.kick(); },
    setMotion(on) { pc.setMotion(on); stage.kick(); },
    setPointer(x, y) { stage.pointer.set(x, y); },
    onFrame: stage.onFrame,
    dispose: stage.dispose,
  };
}
