import * as THREE from "three";
import { FONT, GLSL_SAFE, PhaseClock, canvasTexture, clamp01, createStage, easeInOut, easeOut, fitShot, rand, roundRect, smooth, type Pose, type Shot } from "../stage3d/runtime";

/*
 * 15~16번 · 사용자는 저 한 명, 그리고 그 한 사람을 둘러싼 흐름.
 *   0  (15) 많은 사용자의 점들이 가라앉고, 금색 점 하나(저)만 남는다.
 *   1  (15) 저를 둘러싼 조건의 고리들이 느슨해진다. 가장 안쪽의 금색 고리(원본과 작업 기록)만 그대로다.
 *   2  (16) 카메라가 물러나며 고리 위의 흐름이 드러난다. 요청이 Agent OS(구상)로 간다.
 *   3  (16) Agent OS가 Factory의 엔진으로 일을 넘기고, 강의 영상이 나온다.
 *   4  (16) 결과가 저에게 돌아오고, "이 페이지 발음만 다시" 요청이 TTS로 되돌아간다.
 * Agent OS와 전체 연결은 구상이다. 엔진들은 따로 개발 중이다(대본·화면에 표시).
 */

export const PHASES = 5;
const ICE = new THREE.Color("#8fd0ff");
const GOLD = new THREE.Color("#ffd49a");
const TEAL = new THREE.Color("#72e6cf");

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

const around = (c: THREE.Vector3, r: number, h = r) => [[-r, 0, 0], [r, 0, 0], [0, -h, 0], [0, h, 0], [0, 0, -r], [0, 0, r]].map(([x, y, z]) => c.clone().add(new THREE.Vector3(x, y, z)));
const ring = () => [ME, OS.clone().setY(2.6), ...around(ME, 1.1), OUT.clone().add(new THREE.Vector3(1.3, -0.7, 0.3)), OUT.clone().add(new THREE.Vector3(-1.3, 0.8, 0)), ...ENGINES.flatMap((e) => [e.pos.clone().setY(2.5), e.pos.clone().add(new THREE.Vector3(0.7, 0, 0.7))]), at(A0 + 225, 0), at(A0 + 45, 0)];
const SHOTS: Shot[] = [
  { az: 0, el: 15, rect: [300, 420, 900, 860], points: () => around(ME.clone().setY(0.6), 2.2, 1.1) },
  { az: 0, el: 22, rect: [260, 400, 920, 860], points: () => around(ME.clone().setY(0.4), 2.3, 1.2) },
  { az: -4, el: 31, rect: [330, 485, 1790, 905], points: ring },
  { az: 3, el: 31, rect: [330, 485, 1790, 905], points: ring },
  { az: 0, el: 33, rect: [330, 485, 1790, 905], points: ring },
];

export const ANCHORS = {
  me: new THREE.Vector3(), os: new THREE.Vector3(), factory: new THREE.Vector3(), tts: new THREE.Vector3(), out: new THREE.Vector3(), redo: new THREE.Vector3(), crowd: new THREE.Vector3(),
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

export function createOneUserWorld(canvas: HTMLCanvasElement, lecture: HTMLImageElement, initialPhase: number, initialMotion: boolean): OneUserWorld {
  const stage = createStage(canvas, { background: "#05080d", fog: 0.03, fov: 34, bloom: [0.7, 0.55, 0.8], lostEvent: "oneuser-lost" });
  const { scene, camera, glow } = stage;
  const pc = new PhaseClock(Math.max(0, Math.min(PHASES - 1, initialPhase)), initialMotion);
  const POSES: Pose[] = SHOTS.map((s) => fitShot(s, camera));
  const keep = <T extends { dispose: () => void }>(t: T) => { stage.keep(t); return t; };
  const additive = (color: THREE.Color, opacity = 0) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

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

  /* Factory: 엔진 세 개 */
  const engines = ENGINES.map((e, i) => {
    const g = new THREE.Group(); g.position.copy(e.pos); scene.add(g);
    const color = i === 0 ? GOLD.clone() : ICE.clone();
    const glassMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: ICE.clone() }, uLit: { value: 0 } },
      vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `${GLSL_SAFE}varying vec3 vN; varying vec3 vW; uniform vec3 uColor; uniform float uLit;
        void main(){ vec3 V=normalize(cameraPosition-vW); float f=pw(1.-abs(dot(normalize(vN),V)),2.4); gl_FragColor=vec4(uColor*(.04+f*.45)*uLit,1.); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.55, 1.25), glassMat); box.position.y = 0.2 + 0.775; g.add(box);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.2, 1.45), new THREE.MeshStandardMaterial({ color: "#0c131c", metalness: 0.75, roughness: 0.35 })); plinth.position.y = 0.1; g.add(plinth);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.25, 1.55, 1.25)), new THREE.LineBasicMaterial({ color: ICE.clone().multiplyScalar(1.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    edges.position.y = box.position.y; g.add(edges);
    const coreMat = new THREE.MeshStandardMaterial({ color: "#0a1620", emissive: color, emissiveIntensity: 0, flatShading: true });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 0), coreMat); core.position.y = box.position.y; g.add(core);
    const labelMat = new THREE.MeshBasicMaterial({ map: keep(engineTexture(e.name, e.sub, i === 0)), transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.57), labelMat); label.position.set(0, 2.2, 0); g.add(label);
    return { g, glassMat, edges: edges.material as THREE.LineBasicMaterial, coreMat, core, labelMat, label, color };
  });

  /* 결과: 실제 강의 화면 */
  const lectureTex = keep(new THREE.Texture(lecture)); lectureTex.colorSpace = THREE.SRGBColorSpace; lectureTex.needsUpdate = true;
  const outG = new THREE.Group(); outG.position.copy(OUT); scene.add(outG);
  const outMat = new THREE.MeshBasicMaterial({ map: lectureTex, transparent: true, opacity: 0, toneMapped: false });
  const outW = 2.3, outH = outW * 9 / 16;
  const outScreen = new THREE.Mesh(new THREE.PlaneGeometry(outW, outH), outMat); outG.add(outScreen);
  const outFrameMat = new THREE.LineBasicMaterial({ color: GOLD.clone().multiplyScalar(1.4), transparent: true, opacity: 0 });
  outG.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(outW + 0.06, outH + 0.06)), outFrameMat));
  const outGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: ICE.clone().multiplyScalar(0.6), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); outGlow.scale.set(5, 3.2, 1); outGlow.position.z = -0.3; outG.add(outGlow);

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

  function update(dt: number) {
    pc.tick(dt);
    const p = pc.phase, t = pc.t, time = pc.clock, ev = (s: number, d: number) => pc.ev(s, d);

    const k = pc.motion ? easeInOut(clamp01((time - cam.t0) / cam.dur)) : 1;
    eyeNow.lerpVectors(cam.from, cam.eye, k); lookNow.lerpVectors(cam.fromLook, cam.look, k);
    if (pc.motion) { pointerS.lerp(stage.pointer, 1 - Math.exp(-dt * 2)); eyeNow.x += Math.sin(time * 0.17) * 0.2 + pointerS.x * 0.5; eyeNow.y += Math.sin(time * 0.21) * 0.08 - pointerS.y * 0.25; }
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
    const limA = follow("limA", p === 1 ? 1 : p > 1 ? 0.18 : 0, dt, 3);
    limits.forEach((l, i) => {
      const e = p === 1 ? easeInOut(ev(0.4 + i * 0.25, 1.6)) : lim;
      const r = l.r0 + (l.r1 - l.r0) * e; l.m.scale.setScalar(r);
      l.mat.opacity = limA * (0.85 - 0.6 * e);
      l.mat.color.copy(ICE).multiplyScalar(1.6 - 0.8 * e);
    });
    lockMat.opacity = follow("lock", p === 1 ? smooth(1.8, 2.6, t) : p > 1 ? 0.55 : 0, dt, 4) * (0.85 + 0.15 * Math.sin(time * 2.4));

    /* 2~4: 흐름 */
    const arcLit = [p >= 2 ? 1 : 0, p >= 3 ? 1 : 0, p >= 3 ? 1 : 0, p >= 4 ? 1 : 0];
    const arcDraw = [
      p === 2 ? easeOut(ev(1.4, 1.4)) : p > 2 ? 1 : 0,
      p === 3 ? easeOut(ev(0.3, 1.1)) : p > 3 ? 1 : 0,
      p === 3 ? easeOut(ev(2.0, 1.1)) : p > 3 ? 1 : 0,
      p === 4 ? easeOut(ev(0.2, 1.2)) : 0,
    ];
    arcs.forEach((a, i) => { a.mat.uniforms.uLit.value = follow(`arc${i}`, arcLit[i], dt, 4); a.mat.uniforms.uDraw.value = arcDraw[i]; a.mat.uniforms.uTime.value = time; a.mat.uniforms.uBase.value = follow("arcBase", p >= 2 ? 0.14 : 0, dt, 2); });
    // 요청의 빛이 지금 그려지는 고리의 머리를 따라간다
    const live = p === 2 ? 0 : p === 3 ? (t < 1.6 ? 1 : 2) : p === 4 ? 3 : -1;
    if (live >= 0 && arcDraw[live] > 0 && arcDraw[live] < 1) { packet.position.copy(arcs[live].curve.getPoint(arcDraw[live])).setY(0.35); (packet.material as THREE.SpriteMaterial).opacity = 1; }
    else (packet.material as THREE.SpriteMaterial).opacity = 0;

    // Agent OS
    const osOn = follow("os", p >= 2 ? (p === 2 ? smooth(2.4, 3.1, t) : 1) : 0, dt, 3);
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
      c.mat.opacity = follow(`chip${i}`, p >= 2 ? (p === 2 ? smooth(2.2 + i * 0.12, 2.8 + i * 0.12, t) : 0.85) : 0, dt, 4);
    });

    // Factory
    engines.forEach((e, i) => {
      const on = follow(`eng${i}`, p >= 2 ? (p === 3 ? smooth(1.2 + i * 0.12, 1.8 + i * 0.12, t) : p > 3 ? 1 : 0.35) : 0, dt, 3);
      const busy = (p === 3 && i === 0 ? smooth(1.4, 1.9, t) : 0) + (p === 4 && i === 0 ? 0.6 + 0.4 * smooth(2.2, 2.8, t) : 0);
      e.glassMat.uniforms.uLit.value = 0.3 + 0.7 * on; e.glassMat.uniforms.uColor.value.copy(i === 0 && busy > 0 ? ICE.clone().lerp(GOLD, Math.min(1, busy)) : ICE);
      e.edges.opacity = 0.2 + 0.6 * on; e.coreMat.emissiveIntensity = 0.6 + 2.8 * on + 1.5 * busy;
      e.labelMat.opacity = on; e.label.quaternion.copy(camera.quaternion);
      e.core.rotation.y = time * (0.6 + i * 0.1) * (1 + busy);
      e.g.visible = p >= 2 || on > 0.01;
    });

    // 결과
    const outOn = follow("out", p === 3 ? smooth(3.0, 3.6, t) : p > 3 ? 1 : 0, dt, 4);
    outMat.opacity = outOn; outFrameMat.opacity = outOn; (outGlow.material as THREE.SpriteMaterial).opacity = outOn * 0.35;
    outG.quaternion.copy(camera.quaternion); outG.visible = outOn > 0.01;
    outG.position.copy(OUT).setY(OUT.y + (1 - outOn) * -0.4);

    // 4: 되돌림
    redoMat.uniforms.uLit.value = follow("redo", p === 4 ? 1 : 0, dt, 4);
    redoMat.uniforms.uDraw.value = p === 4 ? easeOut(ev(1.4, 1.2)) : 0; redoMat.uniforms.uTime.value = time;
    redo.visible = redoMat.uniforms.uLit.value > 0.01;
    if (p === 4) { const pulse = ev(1.0, 0.8); meGlow.scale.multiplyScalar(1 + Math.sin(pulse * Math.PI) * 0.25); }

    ANCHORS.me.copy(ME).add(new THREE.Vector3(0, p <= 1 ? 0.7 : 0.6, 0));
    ANCHORS.crowd.copy(ME).add(new THREE.Vector3(3.6, 0.2, -2.6));
    ANCHORS.os.copy(OS).add(new THREE.Vector3(0, 1.75, 0));
    ANCHORS.factory.copy(ENGINES[1].pos).add(new THREE.Vector3(0, 2.75, 0));
    ANCHORS.tts.copy(ENGINES[0].pos).add(new THREE.Vector3(0, 2.6, 0));
    ANCHORS.out.copy(OUT).add(tmp.set(0, outH / 2 + 0.2, 0));
    ANCHORS.redo.copy(redoCurve.getPoint(0.42)).add(new THREE.Vector3(0, 0.1, 0));
    dust.rotation.y = time * 0.005;
  }

  stage.start(update, () => pc.motion);

  return {
    setPhase(next) {
      next = Math.max(0, Math.min(PHASES - 1, next));
      if (next === pc.phase) return;
      const forward = pc.go(next);
      cam.from.copy(camera.position); cam.fromLook.copy(lookNow);
      cam.eye.set(...POSES[next].eye); cam.look.set(...POSES[next].look); cam.t0 = pc.clock; cam.dur = forward ? (next === 2 ? 2.8 : 2.0) : 1.4;
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
