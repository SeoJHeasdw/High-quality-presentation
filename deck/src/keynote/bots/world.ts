import * as THREE from "three";
import { AUTO, LAYOUT, SHARES } from "./layout";
import { FONT, GLSL_SAFE, PhaseClock, canvasTexture, createStage, easeInOut, easeOut, pixelCamera, rand, roundRect, smooth, toWorld } from "../stage3d/runtime";

/*
 * 6번 · 웹에 오는 요청. 점 하나가 요청 하나다.
 *   0  어둠 속 웹페이지로 요청이 흘러든다. 페이지 앞 관측 지점을 지나면 사람(금색)과 자동화(하늘색)로 나뉜다.
 *      흐름이 멈추면 점들이 떠올라 숫자 53%와 47%, 그 아래 비율 막대가 된다.
 *   1  숫자가 풀려 막대로 내려앉고, 막대가 두꺼워지며 자동화 53이 AI가 아닌 봇 44 · Googlebot 5 · AI 봇 등 4로 나뉜다.
 *      AI 봇 등만 밝게 남는다. 제목과 설명은 DOM이 맡는다.
 * 카메라는 z=0 평면의 1단위가 화면 1px이 되도록 고정한다(2~3번과 같다). DOM과 3D가 같은 좌표를 쓴다.
 * 점의 개수는 비중과 정확히 같다(Cloudflare 2025.12.02 HTML 요청, FACT-CHECK.md).
 */

export const PHASES = 2;
const N = 16000;

const ICE = new THREE.Color("#8fd0ff");
const GOLD = new THREE.Color("#ffd49a");
const NEUTRAL = new THREE.Color("#9fb2c4");

export type BotsWorld = {
  setPhase: (p: number) => void;
  setMotion: (on: boolean) => void;
  /** 관측 지점 윗변 가운데의 화면 좌표(px) */
  gateAnchor: { x: number; y: number };
  dispose: () => void;
};

/** 숫자와 퍼센트 기호를 그려 글자 안쪽 점을 고른다. 결과는 (왼쪽 끝, 바닥선) 기준 px, 아래가 +y. */
export function sampleNumber(text: string, count: number, seed: number): [number, number][] {
  const w = 900, h = 380, pad = 20, base = 320, c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.fillStyle = "#fff"; g.textBaseline = "alphabetic";
  (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "-14px";
  g.font = `760 300px ${FONT}`; g.fillText(text, pad, base);
  const tw = g.measureText(text).width;
  (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
  g.font = `620 128px ${FONT}`; g.fillText("%", pad + tw + 8, base);
  const data = g.getImageData(0, 0, w, h).data, inside: number[] = [];
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (data[(y * w + x) * 4 + 3] > 150) inside.push(x, y);
  const r = rand(seed), out: [number, number][] = [];
  for (let i = 0; i < count; i++) { const k = Math.floor(r() * (inside.length / 2)) * 2; out.push([inside[k] - pad + (r() - .5) * 2, inside[k + 1] - base + (r() - .5) * 2]); }
  return out;
}

/** 이름 없는 웹페이지 한 장. 사람이 보는 화면이라는 것만 알 수 있으면 된다. */
function pageTexture() {
  const W = 1376, H = 860;
  return canvasTexture(W, H, (g) => {
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#132131"); bg.addColorStop(1, "#0a121c");
    roundRect(g, 0, 0, W, H, 34); g.fillStyle = bg; g.fill();
    g.save(); roundRect(g, 0, 0, W, H, 34); g.clip();
    g.fillStyle = "#09101a"; g.fillRect(0, 0, W, 88);
    ["#ff6b5e", "#ffc24b", "#39d27a"].forEach((c, i) => { g.fillStyle = c; g.globalAlpha = .7; g.beginPath(); g.arc(48 + i * 34, 44, 10, 0, 7); g.fill(); });
    g.globalAlpha = 1; roundRect(g, 176, 22, 620, 44, 22); g.fillStyle = "#15202d"; g.fill();
    g.strokeStyle = "#7f97ab"; g.lineWidth = 2.4; roundRect(g, 200, 36, 13, 12, 3); g.stroke(); g.beginPath(); g.arc(206.5, 36, 5, Math.PI, 0); g.stroke();
    g.font = `500 24px ${FONT}`; g.fillStyle = "#9fb4c6"; g.textBaseline = "middle"; g.fillText("www.example.com", 228, 45);
    // 메뉴
    g.fillStyle = "#e8eef4"; g.globalAlpha = .85; roundRect(g, 64, 128, 132, 22, 11); g.fill();
    g.globalAlpha = .35; [0, 1, 2, 3].forEach((i) => { roundRect(g, 820 + i * 128, 130, 92, 18, 9); g.fill(); });
    // 본문
    g.globalAlpha = .92; g.fillStyle = "#eef3f8"; roundRect(g, 64, 232, 520, 44, 12); g.fill(); roundRect(g, 64, 294, 400, 44, 12); g.fill();
    g.globalAlpha = .34; [0, 1, 2].forEach((i) => { roundRect(g, 64, 380 + i * 36, i === 2 ? 330 : 480, 18, 9); g.fill(); });
    g.globalAlpha = 1; roundRect(g, 64, 510, 190, 58, 29); g.fillStyle = "#e2c795"; g.fill();
    const img = g.createLinearGradient(700, 210, 1310, 590); img.addColorStop(0, "#2b4d6b"); img.addColorStop(1, "#6b5a3a");
    roundRect(g, 700, 210, 612, 370, 22); g.fillStyle = img; g.fill();
    g.globalAlpha = .5; g.fillStyle = "#d9ecff"; g.beginPath(); g.arc(1150, 320, 46, 0, 7); g.fill();
    g.fillStyle = "#0e1a26"; g.globalAlpha = .55; g.beginPath(); g.moveTo(700, 580); g.lineTo(930, 380); g.lineTo(1080, 500); g.lineTo(1180, 430); g.lineTo(1312, 560); g.lineTo(1312, 580); g.fill();
    // 카드
    g.globalAlpha = 1; [0, 1, 2].forEach((i) => {
      const x = 64 + i * 424; roundRect(g, x, 640, 400, 176, 18); g.fillStyle = "#101c29"; g.fill();
      g.fillStyle = "#e8eef4"; g.globalAlpha = .6; roundRect(g, x + 28, 672, 200, 20, 10); g.fill();
      g.globalAlpha = .25; roundRect(g, x + 28, 712, 320, 14, 7); g.fill(); roundRect(g, x + 28, 740, 260, 14, 7); g.fill(); g.globalAlpha = 1;
    });
    g.restore();
    g.strokeStyle = "#a8cbe5"; g.globalAlpha = .28; g.lineWidth = 3; roundRect(g, 1.5, 1.5, W - 3, H - 3, 33); g.stroke();
  });
}

export function createBotsWorld(canvas: HTMLCanvasElement, glyphs: { auto: [number, number][]; human: [number, number][] }, initialPhase: number, initialMotion: boolean): BotsWorld {
  const stage = createStage(canvas, { background: "#05080d", fov: 30, bloom: [0.58, 0.5, 0.72], exposure: 1.0, lostEvent: "bots-lost" });
  const { scene, camera, glow } = stage;
  const camD = pixelCamera(camera);
  const pc = new PhaseClock(Math.max(0, Math.min(PHASES - 1, initialPhase)), initialMotion);

  /* 웹페이지와 관측 지점 --------------------------------------------------- */
  const L = LAYOUT.page, GL = LAYOUT.gate;
  const site = new THREE.Group();
  site.position.copy(toWorld(L.x, L.y)); site.rotation.y = L.rotY; scene.add(site); site.updateMatrixWorld(true);

  const siteGlowMat = new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color("#4a7fa8"), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const siteGlow = new THREE.Mesh(new THREE.PlaneGeometry(L.w * 2.2, L.h * 2.4), siteGlowMat); siteGlow.position.z = -160; site.add(siteGlow);
  const pageTex = pageTexture(); stage.keep(pageTex);
  const pageMat = new THREE.MeshBasicMaterial({ map: pageTex, transparent: true, opacity: 0, depthWrite: false, color: new THREE.Color(0.8, 0.8, 0.8) });
  const page = new THREE.Mesh(new THREE.PlaneGeometry(L.w, L.h), pageMat); site.add(page);

  // 관측 지점: 흐름을 가로질러 비스듬히 선 얇은 막. 요청은 여기를 지나며 사람과 자동화로 나뉜다.
  const gateGroup = new THREE.Group();
  gateGroup.position.copy(toWorld(GL.x, GL.y)); gateGroup.rotation.y = GL.rotY; scene.add(gateGroup); gateGroup.updateMatrixWorld(true);
  const gateMat = new THREE.ShaderMaterial({
    uniforms: { uOn: { value: 0 }, uFlash: { value: 0 }, uTime: { value: 0 }, uAlpha: { value: 1 }, uCol: { value: new THREE.Color("#bfe6ff") } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `${GLSL_SAFE}varying vec2 vUv; uniform float uOn,uFlash,uTime,uAlpha; uniform vec3 uCol;
      void main(){
        vec2 q=abs(vUv-.5);
        float edge=max(sstep(.485,.5,q.x),sstep(.488,.5,q.y));
        float corner=sstep(.4,.5,q.x)*sstep(.42,.5,q.y);
        float sweep=exp(-pw((vUv.y-fract(uTime*.22))*10.,2.));
        float fill=.01+.025*(1.-sstep(0.,.5,q.x))*(1.-sstep(.1,.5,q.y));
        float a=uOn*(fill+edge*.42+corner*.6+sweep*.03)+uFlash*(.06+edge*.6);
        gl_FragColor=vec4(uCol*a*uAlpha,1.);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const gate = new THREE.Mesh(new THREE.PlaneGeometry(GL.w, GL.h), gateMat); gateGroup.add(gate);
  const gateTop = gateGroup.localToWorld(new THREE.Vector3(0, GL.h / 2, 0));

  /* 요청 ------------------------------------------------------------------- */
  // 길은 두 토막이다. 출발점 → 관측 지점(진행도 KG) → 페이지. 관측 지점을 지나면 자동화는 위로, 사람은 아래로 갈라진다.
  const KG = 0.5, TAILS = 3;
  const base = { from: new Float32Array(N * 3), ca: new Float32Array(N * 3), gate: new Float32Array(N * 3), cb: new Float32Array(N * 3), end: new Float32Array(N * 3), num: new Float32Array(N * 3), slab: new Float32Array(N * 3), meta: new Float32Array(N * 4) };
  {
    const r = rand(61), v = new THREE.Vector3(), n = new THREE.Vector3(0, 0, 1).applyQuaternion(gateGroup.quaternion);
    const bounds = [SHARES[0], SHARES[0] + SHARES[1], AUTO].map((s) => Math.round(N * s / 100));
    let ia = 0, ih = 0;
    const barFrac = 0.22;
    for (let i = 0; i < N; i++) {
      const cls = i < bounds[0] ? 0 : i < bounds[1] ? 1 : i < bounds[2] ? 2 : 3, human = cls === 3, sd = r();
      // 출발: 화면 왼쪽 바깥, 넓게
      const s = toWorld(-260 + r() * 200, GL.y + (r() - .5) * 460).setZ(-420 + r() * 520);
      // 관측 지점을 지나는 곳: 막 안쪽
      const g = gateGroup.localToWorld(v.set((r() - .5) * GL.w * .8, (r() - .5) * GL.h * .78, 0)).clone();
      const ca = g.clone().addScaledVector(n, -(260 + r() * 120)).add(new THREE.Vector3(0, (r() - .5) * 60, 0));
      // 페이지: 자동화는 위쪽, 사람은 아래쪽
      const e = site.localToWorld(v.set((r() - .5) * L.w * .9, (human ? -1 : 1) * (0.08 + r() * 0.4) * L.h, 2)).clone();
      const cb = g.clone().addScaledVector(n, 220 + r() * 120).add(new THREE.Vector3(0, (human ? -1 : 1) * (120 + r() * 100), 0));
      base.from.set([s.x, s.y, s.z], i * 3); base.ca.set([ca.x, ca.y, ca.z], i * 3); base.gate.set([g.x, g.y, g.z], i * 3);
      base.cb.set([cb.x, cb.y, cb.z], i * 3); base.end.set([e.x, e.y, e.z], i * 3);
      base.meta.set([cls, sd, 3.1 + r() * 1.4, r()], i * 4);
      // 0단계: 숫자 또는 막대
      let tx: number, ty: number;
      if (r() < barFrac) {
        const B = human ? LAYOUT.bar.human : LAYOUT.bar.auto;
        tx = B.x0 + r() * (B.x1 - B.x0); ty = LAYOUT.bar.y + r() * LAYOUT.bar.h;
      } else {
        const N0 = human ? LAYOUT.num.human : LAYOUT.num.auto, pt = human ? glyphs.human[ih++ % glyphs.human.length] : glyphs.auto[ia++ % glyphs.auto.length];
        tx = N0.x + pt[0]; ty = N0.base + pt[1];
      }
      const tw = toWorld(tx, ty); base.num.set([tw.x, tw.y, (r() - .5) * 14], i * 3);
      // 1단계: 두꺼운 막대의 제 칸
      const S = LAYOUT.slab.segments[cls];
      const sw = toWorld(S.x0 + r() * (S.x1 - S.x0), LAYOUT.slab.y + r() * LAYOUT.slab.h); base.slab.set([sw.x, sw.y, (r() - .5) * 90], i * 3);
    }
  }
  // 움직임이 보이도록 흐르는 동안만 점 뒤에 꼬리 두 개를 붙인다. 숫자가 되면 꼬리는 머리 안으로 사라진다.
  const geo = new THREE.BufferGeometry();
  {
    const rep = (a: Float32Array, k: number) => { const out = new Float32Array(a.length * TAILS); for (let j = 0; j < TAILS; j++) out.set(a, j * a.length); return new THREE.BufferAttribute(out, k); };
    geo.setAttribute("position", rep(base.num, 3));
    geo.setAttribute("aFrom", rep(base.from, 3)); geo.setAttribute("aCa", rep(base.ca, 3)); geo.setAttribute("aGateP", rep(base.gate, 3));
    geo.setAttribute("aCb", rep(base.cb, 3)); geo.setAttribute("aEnd", rep(base.end, 3)); geo.setAttribute("aNum", rep(base.num, 3)); geo.setAttribute("aSlab", rep(base.slab, 3));
    geo.setAttribute("aMeta", rep(base.meta, 4));
    const tail = new Float32Array(N * TAILS); for (let j = 0; j < TAILS; j++) tail.fill(j, j * N, (j + 1) * N);
    geo.setAttribute("aTail", new THREE.BufferAttribute(tail, 1));
  }
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uFlow: { value: 0 }, uReveal: { value: 0 }, uGate: { value: 0 }, uGather: { value: 0 }, uSlab: { value: 0 }, uFocus: { value: 0 }, uTime: { value: 0 }, uD: { value: camD },
      uNeutral: { value: NEUTRAL.clone() }, uIce: { value: ICE.clone() }, uGold: { value: GOLD.clone() },
      uSteel: { value: new THREE.Color("#5e86a6") }, uGoogle: { value: new THREE.Color("#8fc4e8") }, uAgent: { value: new THREE.Color("#e6f6ff") },
    },
    vertexShader: `${GLSL_SAFE}
      attribute vec3 aFrom; attribute vec3 aCa; attribute vec3 aGateP; attribute vec3 aCb; attribute vec3 aEnd; attribute vec3 aNum; attribute vec3 aSlab;
      attribute vec4 aMeta; attribute float aTail;
      uniform float uFlow,uReveal,uGate,uGather,uSlab,uFocus,uTime,uD;
      uniform vec3 uNeutral,uIce,uGold,uSteel,uGoogle,uAgent;
      varying vec3 vC; varying float vA;
      vec3 bz(vec3 a,vec3 b,vec3 c,float t){ return mix(mix(a,b,t),mix(b,c,t),t); }
      void main(){
        float cls=aMeta.x, seed=aMeta.y, dur=aMeta.z;
        float human=step(2.5,cls), agent=step(1.5,cls)*(1.-human);
        vec3 col=mix(uIce,uGold,human);
        // 흐름: 머리 뒤의 꼬리는 조금 앞선 시간의 자리
        float k=fract(uFlow/dur+seed)-aTail*.007;
        float kk=clamp(k,0.,1.);
        vec3 f=kk<${KG.toFixed(2)}?bz(aFrom,aCa,aGateP,kk/${KG.toFixed(2)}):bz(aGateP,aCb,aEnd,(kk-${KG.toFixed(2)})/${(1 - KG).toFixed(2)});
        float passed=step(${KG.toFixed(2)},kk)*uGate;
        float flash=passed*exp(-(kk-${KG.toFixed(2)})*42.);
        vec3 cFlow=mix(uNeutral*.42,col*.95,passed)+col*flash*1.8;
        float tailA=aTail<.5?1.:aTail<1.5?.42:.18;
        float aFlow=sstep(0.,.06,kk)*(1.-sstep(.93,1.,kk))*step(kk,uReveal-aMeta.w*.06)*step(0.,k)*tailA;
        // 떠올라 숫자가 된다
        float g=clamp(uGather*1.5-seed*.5,0.,1.); g=g*g*(3.-2.*g);
        vec3 mid=mix(f,aNum,.5)+vec3(0.,40.+seed*120.,180.+seed*240.);
        vec3 p=mix(mix(f,mid,g),mix(mid,aNum,g),g);
        // 두꺼운 막대로 내려앉는다
        float r2=fract(seed*7.13);
        float s=clamp(uSlab*1.5-r2*.5,0.,1.); s=s*s*(3.-2.*s);
        vec3 mid2=mix(aNum,aSlab,.5)+vec3(0.,0.,160.+r2*200.);
        p=mix(mix(p,mid2,s),mix(mid2,aSlab,s),s);
        float live=g*(1.-s)+s*(1.+agent*uFocus*2.);
        p+=vec3(sin(uTime*1.1+seed*37.),cos(uTime*.9+seed*23.),sin(uTime*.7+seed*11.)*4.)*1.3*live;
        vec3 seg=cls<.5?uSteel:cls<1.5?uGoogle:cls<2.5?uAgent:uGold;
        float tw=.8+.3*sin(uTime*3.1+seed*60.);
        seg*=mix(1.,mix(.42,.95*tw,agent),uFocus);
        vec3 c=mix(cFlow,col*1.15,g);
        c=mix(c,seg,s);
        vC=c;
        // 꼬리는 숫자가 되면서 사라진다
        vA=mix(aFlow,aTail<.5?1.:0.,g);
        vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_PointSize=(1.7+seed*1.2+g*.8+agent*uFocus*.5)*(uD/-mv.z);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: `${GLSL_SAFE}varying vec3 vC; varying float vA;
      void main(){ if(vA<.002) discard; float d=length(gl_PointCoord-.5); float a=sstep(.5,.05,d); gl_FragColor=vec4(vC*a*vA,1.); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat); points.frustumCulled = false; scene.add(points);

  // 숫자 아래의 빛 웅덩이, AI 봇 칸 뒤의 빛
  const pool = (color: string, w: number, h: number, x: number, y: number) => {
    const m = new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color(color), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); mesh.position.copy(toWorld(x, y)).setZ(-140); scene.add(mesh); return m;
  };
  const autoPool = pool("#3f7fb0", 1100, 560, 330, 560), humanPool = pool("#a8854e", 1000, 560, LAYOUT.num.human.x + 230, 560);
  const agentSeg = LAYOUT.slab.segments[2];
  const agentPool = pool("#9fd6ff", 300, 380, (agentSeg.x0 + agentSeg.x1) / 2, LAYOUT.slab.y + LAYOUT.slab.h / 2);

  /* 떠다니는 먼지 */
  const dustGeo = new THREE.BufferGeometry();
  { const r = rand(43), k = 800, a = new Float32Array(k * 3); for (let i = 0; i < k; i++) a.set([(r() - .5) * 3000, (r() - .5) * 1800, -1600 + r() * 1700], i * 3); dustGeo.setAttribute("position", new THREE.BufferAttribute(a, 3)); }
  const dustMat = new THREE.PointsMaterial({ color: new THREE.Color("#7fb0d8"), size: 5, map: glow, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const dust = new THREE.Points(dustGeo, dustMat); scene.add(dust);

  /* 갱신 ------------------------------------------------------------------ */
  // 0단계 시간표(초, 4.5초 안에 끝난다): 페이지가 나타나고, 흐름의 머리가 관측 지점에 닿고, 흐름이 멈추고, 숫자가 된다.
  const T = { reveal: 0.15, revealDur: 1.4, gate: 0.85, slow: 2.55, gather: 2.75, gatherDur: 1.75 };
  let flow = 0;
  function update(dt: number) {
    pc.tick(dt);
    const p = pc.phase, t = pc.t, time = pc.clock;
    const u = (s: number, d: number) => pc.ev(s, d);

    let siteA = 0, reveal = 1, gateOn = 0, flash = 0, gather = 1, slab = 0, focus = 0;
    if (p === 0) {
      siteA = easeOut(u(0, 0.9)) * (1 - easeInOut(u(T.gather, 1.0)));
      reveal = u(T.reveal, T.revealDur) * 1.08;
      gateOn = smooth(T.gate - 0.45, T.gate, t);
      flash = Math.exp(-Math.max(0, t - T.gate) * 2.6) * smooth(T.gate - 0.05, T.gate + 0.05, t);
      gather = easeInOut(u(T.gather, T.gatherDur));
      // 흐름은 앞으로 넘겨 들어왔을 때만 흐르고, 숫자가 되기 직전에 멈춘다.
      flow += dt * (1 - smooth(T.slow, T.gather + 0.2, t));
    }
    if (p >= 1) {
      slab = easeInOut(u(0.1, 1.9));
      focus = smooth(1.7, 2.7, t);
    }

    pageMat.opacity = siteA * 0.92;
    siteGlowMat.opacity = siteA * 0.22;
    site.position.z = -260 * (p === 0 ? easeInOut(u(T.gather, 1.2)) : 1);
    site.visible = gateGroup.visible = siteA > 0.001;
    gateGroup.position.z = site.position.z;
    gateMat.uniforms.uOn.value = gateOn;
    gateMat.uniforms.uFlash.value = flash;
    gateMat.uniforms.uAlpha.value = siteA;
    gateMat.uniforms.uTime.value = time;

    const U = mat.uniforms;
    U.uFlow.value = flow; U.uReveal.value = reveal; U.uGate.value = 1; U.uGather.value = gather;
    U.uSlab.value = slab; U.uFocus.value = focus; U.uTime.value = time;

    autoPool.opacity = 0.22 * smooth(0.55, 1, gather) * (1 - slab);
    humanPool.opacity = 0.2 * smooth(0.55, 1, gather) * (1 - slab);
    agentPool.opacity = 0.2 * focus;

    dust.rotation.y = time * 0.004; dust.position.y = Math.sin(time * 0.1) * 12;
  }

  stage.start(update, () => pc.motion);
  camera.updateMatrixWorld();
  const anchor = stage.project(gateTop);

  return {
    setPhase(next) {
      next = Math.max(0, Math.min(PHASES - 1, next));
      if (next === pc.phase) return;
      pc.go(next); stage.kick();
    },
    setMotion(on) { pc.setMotion(on); stage.kick(); },
    gateAnchor: { x: anchor.x, y: anchor.y },
    dispose: stage.dispose,
  };
}
