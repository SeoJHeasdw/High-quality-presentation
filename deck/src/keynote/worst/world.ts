import * as THREE from "three";
import { GLSL_SAFE, PhaseClock, createStage, easeInOut, easeOut, pixelCamera, rand, smooth, toWorld } from "../stage3d/runtime";

/*
 * 30번 · 지금 쓰는 모델이 앞으로 쓸 모델 중 가장 구린 모델이다. 2~3번 고양이의 입자 문법을 다시 부른다(회수).
 *   0  어둠 속에 먼지만 떠 있다. 청중의 속마음과 "지금은 그럴 수 있습니다"는 DOM이 맡는다.
 *   1  왼쪽에 2번의 화소 부조 고양이가 다시 떠오르고, 금색 입자가 "고양이"가 된다(한때: 사진 한 장 → 단어 하나).
 *      입자가 가운데의 화면 테두리로 모이고(지금: 요청 한 문장 → 강의 한 편), 일부가 오른쪽 어둠으로 흘러가며
 *      파란 눈금 "1년 뒤?" "2년 뒤?"를 지난다.
 *   2  오른쪽으로 흐르는 입자가 늘어나고 밝아진다. 결론과 근거는 DOM이 맡는다.
 * 카메라는 2~3번과 같이 z=0 평면의 1단위가 화면 1px이 되도록 고정한다. DOM과 3D가 같은 좌표를 쓴다.
 */

export const PHASES = 3;
const COLS = 72, ROWS = 50;
const PHOTO_W = 1000, PHOTO_H = 687;
/** 무대 배치(화면 px). DOM 쪽 CSS와 같은 값이다. */
export const LAYOUT = {
  relief: { x: 330, y: 640, scale: 0.34, rotY: 0.34 },
  word: { x: 700, y: 640, scale: 0.36 },
  frame: { x: 870, y: 520, w: 460, h: 259 },
  ticks: [1530, 1770],
  futureY: 650,
};
const FACE = { u0: 0.26, u1: 0.76, v0: 0.14, v1: 0.7 };
const GOLD = new THREE.Color("#ffd899");
const ICE = new THREE.Color("#a8dcff");

export type WorstWorld = { setPhase: (p: number) => void; setMotion: (on: boolean) => void; setPointer: (x: number, y: number) => void; onFrame: (cb: () => void) => void; dispose: () => void };
export type WorstAssets = { image: HTMLImageElement; glyph: [number, number][] };

export function createWorstWorld(canvas: HTMLCanvasElement, assets: WorstAssets, initialPhase: number, initialMotion: boolean): WorstWorld {
  const stage = createStage(canvas, { background: "#05080d", fov: 30, bloom: [0.62, 0.55, 0.74], exposure: 1.02, lostEvent: "worst-lost" });
  const { scene, camera, glow } = stage;
  const camD = pixelCamera(camera);
  const pc = new PhaseClock(Math.max(0, Math.min(PHASES - 1, initialPhase)), initialMotion);

  /* 화소 부조 고양이(2번과 같은 사진·같은 셰이더 문법, 칸 수만 줄였다) ------------------------- */
  const sample = document.createElement("canvas"); sample.width = COLS; sample.height = ROWS;
  const sg = sample.getContext("2d", { willReadFrequently: true })!;
  sg.drawImage(assets.image, 0, 0, COLS, ROWS);
  const px = sg.getImageData(0, 0, COLS, ROWS).data;
  const relief = new THREE.Group(); scene.add(relief);
  const R = LAYOUT.relief;
  relief.position.copy(toWorld(R.x, R.y)); relief.scale.setScalar(R.scale); relief.rotation.set(0, R.rotY, 0); relief.updateMatrixWorld(true);
  const n = COLS * ROWS, cell = new Float32Array(n * 2), col = new Float32Array(n * 3), lum = new Float32Array(n), rnd = new Float32Array(n);
  { const r = rand(5);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const i = y * COLS + x, k = i * 4, cr = px[k] / 255, cg = px[k + 1] / 255, cb = px[k + 2] / 255;
      cell.set([x, y], i * 2); col.set([cr, cg, cb].map((v) => Math.pow(v, 2.2)), i * 3);
      lum[i] = 0.299 * cr + 0.587 * cg + 0.114 * cb; rnd[i] = r();
    } }
  const boxGeo = new THREE.InstancedBufferGeometry();
  { const b = new THREE.BoxGeometry(1, 1, 1); boxGeo.index = b.index; for (const k of ["position", "normal", "uv"]) boxGeo.setAttribute(k, b.getAttribute(k)); }
  boxGeo.instanceCount = n;
  boxGeo.setAttribute("aCell", new THREE.InstancedBufferAttribute(cell, 2));
  boxGeo.setAttribute("aCol", new THREE.InstancedBufferAttribute(col, 3));
  boxGeo.setAttribute("aLum", new THREE.InstancedBufferAttribute(lum, 1));
  boxGeo.setAttribute("aRnd", new THREE.InstancedBufferAttribute(rnd, 1));
  const TILE = new THREE.Vector2(PHOTO_W / COLS, PHOTO_H / ROWS);
  const tileMat = new THREE.ShaderMaterial({
    uniforms: { uIn: { value: 0 }, uFade: { value: 1 }, uTime: { value: 0 }, uTile: { value: TILE }, uSize: { value: new THREE.Vector2(PHOTO_W, PHOTO_H) } },
    vertexShader: `${GLSL_SAFE}
      attribute vec2 aCell; attribute vec3 aCol; attribute float aLum; attribute float aRnd;
      uniform float uIn,uTime; uniform vec2 uTile,uSize; varying vec3 vCol; varying vec3 vN; varying float vA;
      void main(){
        vec2 c=vec2((aCell.x+.5)*uTile.x-uSize.x*.5, uSize.y*.5-(aCell.y+.5)*uTile.y);
        float k=clamp(uIn*1.5-aRnd*.5,0.,1.); k=k*k*(3.-2.*k);
        float h=max(1.5,(6.+aLum*aLum*120.)*k);
        vec3 p=position; p.xy*=uTile*.86; p.z=(p.z+.5)*h; p.xy+=c;
        p.z+=sin(uTime*.9+aRnd*6.283)*3.*k-(1.-k)*600.;
        vCol=aCol; vN=normalize(normalMatrix*normal); vA=k;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
      }`,
    fragmentShader: `${GLSL_SAFE}uniform float uFade; varying vec3 vCol; varying vec3 vN; varying float vA;
      void main(){ vec3 L=normalize(vec3(-.45,.55,.75)); float ndl=max(dot(normalize(vN),L),0.);
        vec3 c=vCol*(.34+.8*ndl); float l=dot(vCol,vec3(.299,.587,.114));
        vec3 machine=vec3(.16,.34,.62)*(.25+l*1.5)*(.45+.7*ndl); c=mix(c,machine,.42);
        gl_FragColor=vec4(c*vA*uFade,1.); }`,
  });
  const tiles = new THREE.Mesh(boxGeo, tileMat); tiles.frustumCulled = false; relief.add(tiles);
  const reliefGlow = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1400), new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color("#4a7fa8"), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  reliefGlow.position.z = -240; relief.add(reliefGlow);

  /* 입자: 부조 → 단어 → 화면 테두리 → 오른쪽 어둠 -------------------------------------------- */
  const glyph = assets.glyph, m = glyph.length;
  const aFrom = new Float32Array(m * 3), aWord = new Float32Array(m * 3), aFrame = new Float32Array(m * 3), aCol = new Float32Array(m * 3), aSeed = new Float32Array(m);
  {
    const r = rand(23), q = new THREE.Vector3();
    const word = toWorld(LAYOUT.word.x, LAYOUT.word.y), F = LAYOUT.frame, per = 2 * (F.w + F.h);
    for (let i = 0; i < m; i++) {
      const face = r() < 0.62;
      const u = face ? FACE.u0 + r() * (FACE.u1 - FACE.u0) : r(), v = face ? FACE.v0 + r() * (FACE.v1 - FACE.v0) : r();
      const cx = Math.min(COLS - 1, Math.floor(u * COLS)), cy = Math.min(ROWS - 1, Math.floor(v * ROWS)), k = cy * COLS + cx;
      q.set((u - .5) * PHOTO_W, (.5 - v) * PHOTO_H, 6 + lum[k] * lum[k] * 120).applyMatrix4(relief.matrixWorld);
      aFrom.set([q.x, q.y, q.z], i * 3);
      aWord.set([word.x + glyph[i][0] * LAYOUT.word.scale, word.y - glyph[i][1] * LAYOUT.word.scale, (r() - .5) * 8], i * 3);
      aCol.set([col[k * 3], col[k * 3 + 1], col[k * 3 + 2]], i * 3);
      let d = r() * per, fx: number, fy: number;
      if (d < F.w) { fx = F.x + d; fy = F.y; } else if ((d -= F.w) < F.h) { fx = F.x + F.w; fy = F.y + d; } else if ((d -= F.h) < F.w) { fx = F.x + F.w - d; fy = F.y + F.h; } else { d -= F.w; fx = F.x; fy = F.y + F.h - d; }
      if (r() < 0.12) { fx = F.x + r() * F.w; fy = F.y + r() * F.h; }
      const fw = toWorld(fx, fy); aFrame.set([fw.x, fw.y, (r() - .5) * 6], i * 3);
      aSeed[i] = r();
    }
  }
  const F = LAYOUT.frame;
  const out0 = toWorld(F.x + F.w, F.y + F.h / 2);
  const streamGeo = new THREE.BufferGeometry();
  streamGeo.setAttribute("position", new THREE.BufferAttribute(aWord.slice(), 3));
  streamGeo.setAttribute("aFrom", new THREE.BufferAttribute(aFrom, 3));
  streamGeo.setAttribute("aWord", new THREE.BufferAttribute(aWord, 3));
  streamGeo.setAttribute("aFrame", new THREE.BufferAttribute(aFrame, 3));
  streamGeo.setAttribute("aCol", new THREE.BufferAttribute(aCol, 3));
  streamGeo.setAttribute("aSeed", new THREE.BufferAttribute(aSeed, 1));
  const streamMat = new THREE.ShaderMaterial({
    uniforms: { uStream: { value: 0 }, uGather: { value: 0 }, uFlow: { value: 0 }, uAlpha: { value: 1 }, uTime: { value: 0 }, uGold: { value: GOLD.clone() }, uIce: { value: ICE.clone() }, uD: { value: camD }, uOut: { value: out0 }, uReach: { value: 0 } },
    vertexShader: `${GLSL_SAFE}
      attribute vec3 aFrom; attribute vec3 aWord; attribute vec3 aFrame; attribute vec3 aCol; attribute float aSeed;
      uniform float uStream,uGather,uFlow,uTime,uD,uReach; uniform vec3 uGold,uIce,uOut; varying vec3 vC; varying float vA;
      void main(){
        float k=clamp(uStream*1.45-aSeed*.45,0.,1.); k=k*k*(3.-2.*k);
        vec3 mid=mix(aFrom,aWord,.5)+vec3(0.,60.+aSeed*90.,180.+aSeed*140.);
        vec3 a=mix(aFrom,mid,k), b=mix(mid,aWord,k), p=mix(a,b,k);
        p+=vec3(sin(uTime*1.3+aSeed*40.),cos(uTime*1.1+aSeed*30.),0.)*1.6;
        float g=clamp(uGather*1.35-aSeed*.35,0.,1.); g=g*g*(3.-2.*g);
        p=mix(p,aFrame,g);
        vec3 c=mix(aCol*1.3,uGold*1.25,sstep(.25,.9,k));
        // 일부는 화면 테두리에서 오른쪽 어둠으로 계속 흘러간다(다음 모델들)
        float f=step(aSeed,uFlow);
        float s=fract(uTime*.075+aSeed*9.137);
        vec3 fut=uOut+vec3(s*(760.+uReach*260.), sin(aSeed*91.+s*4.)*(24.+s*230.), -s*s*(900.+uReach*600.));
        fut.y+=cos(aSeed*53.)*s*120.;
        p=mix(p,fut,f*g);
        c=mix(c,mix(uGold*1.3,uIce*1.4,sstep(.12,.55,s)),f*g);
        vC=c; vA=sstep(.02,.16,k)*(1.-f*g*sstep(.75,1.,s));
        vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_PointSize=(2.2+aSeed*1.5+(1.-k)*1.1)*(uD/-mv.z);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: `${GLSL_SAFE}uniform float uAlpha; varying vec3 vC; varying float vA;
      void main(){ float d=length(gl_PointCoord-.5); float a=sstep(.5,.05,d); gl_FragColor=vec4(vC*a*vA*uAlpha,1.); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const stream = new THREE.Points(streamGeo, streamMat); stream.frustumCulled = false; scene.add(stream);

  // 단어 아래의 빛, 화면 뒤의 빛
  const wordGlowMat = new THREE.MeshBasicMaterial({ map: glow, color: GOLD.clone().multiplyScalar(0.5), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const wordGlow = new THREE.Mesh(new THREE.PlaneGeometry(560, 300), wordGlowMat); wordGlow.position.copy(toWorld(LAYOUT.word.x, LAYOUT.word.y)).setZ(-100); scene.add(wordGlow);
  const screenGlowMat = new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color("#5f9fd4"), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const screenGlow = new THREE.Mesh(new THREE.PlaneGeometry(F.w * 2.1, F.h * 2.4), screenGlowMat); screenGlow.position.copy(toWorld(F.x + F.w / 2, F.y + F.h / 2)).setZ(-160); scene.add(screenGlow);

  // 파란 눈금: 1년 뒤? 2년 뒤?
  const tickMat = new THREE.ShaderMaterial({
    uniforms: { uA: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `${GLSL_SAFE}varying vec2 vUv; uniform float uA; void main(){ float e=1.-abs(vUv.y-.5)*2.; gl_FragColor=vec4(vec3(.55,.82,1.)*pw(e,1.6)*1.4*uA,1.); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const ticks = LAYOUT.ticks.map((x, i) => { const t = new THREE.Mesh(new THREE.PlaneGeometry(3, 300 + i * 70), tickMat); t.position.copy(toWorld(x, LAYOUT.futureY)).setZ(-40 - i * 60); scene.add(t); return t; });

  /* 떠다니는 먼지 */
  const dustGeo = new THREE.BufferGeometry();
  { const r = rand(41), k = 900, a = new Float32Array(k * 3); for (let i = 0; i < k; i++) a.set([(r() - .5) * 3000, (r() - .5) * 1800, -1600 + r() * 1700], i * 3); dustGeo.setAttribute("position", new THREE.BufferAttribute(a, 3)); }
  const dustMat = new THREE.PointsMaterial({ color: new THREE.Color("#7fb0d8"), size: 5, map: glow, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const dust = new THREE.Points(dustGeo, dustMat); scene.add(dust);

  const pointerS = new THREE.Vector2();
  function update(dt: number) {
    pc.tick(dt);
    const p = pc.phase, t = pc.t, time = pc.clock, u = (s: number, d: number) => pc.ev(s, d);
    let rin = 0, streamK = 0, gather = 0, flow = 0, reach = 0, tickA = 0;
    if (p >= 1) {
      // 단어가 선 뒤 잠시 머물렀다가 화면 테두리로 모인다
      rin = p === 1 ? easeOut(u(0.2, 1.4)) : 1;
      streamK = p === 1 ? u(1.0, 2.0) : 1;
      gather = p === 1 ? easeInOut(u(4.3, 1.4)) : 1;
      flow = p === 1 ? 0.3 * smooth(5.4, 7.0, t) : 0.3;
      tickA = p === 1 ? smooth(6.0, 7.2, t) : 1;
    }
    if (p >= 2) { flow = 0.3 + 0.28 * easeInOut(u(0.2, 2.2)); reach = easeInOut(u(0.2, 2.4)); }
    tileMat.uniforms.uIn.value = rin; tileMat.uniforms.uTime.value = time;
    tileMat.uniforms.uFade.value = 0.8 - 0.5 * gather;
    tiles.visible = rin > 0.001;
    (reliefGlow.material as THREE.MeshBasicMaterial).opacity = 0.14 * rin;
    if (pc.motion) {
      pointerS.lerp(stage.pointer, 1 - Math.exp(-dt * 2.2));
      relief.rotation.y = R.rotY + pointerS.x * 0.06 + Math.sin(time * 0.35) * 0.012;
      relief.rotation.x = pointerS.y * 0.04 + Math.sin(time * 0.29) * 0.01;
    }
    streamMat.uniforms.uStream.value = streamK; streamMat.uniforms.uGather.value = gather; streamMat.uniforms.uFlow.value = flow;
    streamMat.uniforms.uReach.value = reach; streamMat.uniforms.uTime.value = time;
    stream.visible = streamK > 0;
    wordGlowMat.opacity = 0.3 * smooth(0.5, 1, streamK) * (1 - gather);
    screenGlowMat.opacity = 0.22 * gather;
    tickMat.uniforms.uA.value = tickA * (0.7 + 0.3 * reach);
    ticks.forEach((tk) => { tk.visible = tickA > 0.001; });
    dust.rotation.y = time * 0.004; dust.position.y = Math.sin(time * 0.1) * 12;
  }
  stage.start(update, () => pc.motion);

  return {
    setPhase(next) { next = Math.max(0, Math.min(PHASES - 1, next)); if (next === pc.phase) return; pc.go(next); stage.kick(); },
    setMotion(on) { pc.setMotion(on); stage.kick(); },
    setPointer(x, y) { stage.pointer.set(x, y); },
    onFrame: stage.onFrame,
    dispose: stage.dispose,
  };
}
