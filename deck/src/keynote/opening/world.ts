import * as THREE from "three";
import { GLSL_SAFE, PhaseClock, W, H, createStage, easeInOut, easeOut, pixelCamera, rand, smooth, toWorld } from "../stage3d/runtime";

/*
 * 2~3번 · 사진 한 장에서 강의 영상까지.
 *   0  10여 년 전: 사진 한 장이 어둠 속에 떠 있다.
 *   1  기계가 본 사진: 주사선이 지나가며 사진이 화소의 부조가 되고, 화소가 흘러가 단어 "고양이"가 된다.
 *   2  지금: 부조와 단어가 흩어진다. 요청 문장은 DOM이 맡는다.
 *   3  흩어진 빛이 화면의 테두리로 모이고, 그 자리에 실제 강의 영상이 열린다(DOM).
 * 카메라는 z=0 평면의 1단위가 화면 1px이 되도록 고정한다. 그래서 DOM과 3D의 위치가 같은 좌표를 쓴다.
 */

export const PHASES = 4;
const COLS = 110, ROWS = 76;
const PHOTO_W = 1000, PHOTO_H = 687;
const TILE = new THREE.Vector2(PHOTO_W / COLS, PHOTO_H / ROWS);
/** 무대 배치(화면 px). DOM 쪽 CSS와 같은 값이다. */
export const LAYOUT = {
  photo0: { x: 1112, y: 598, scale: 0.97, rotY: -0.07 },
  photo1: { x: 548, y: 610, scale: 0.7, rotY: 0.46 },
  word: { x: 1402, y: 600 },
  screen: { x: 392, y: 292, w: 1136, h: 639 },
};
/** 사진 안에서 고양이 얼굴이 있는 곳(가로·세로 0~1, 위가 0). 탐지 틀이 이곳을 감싼다. */
const FACE = { u0: 0.26, u1: 0.76, v0: 0.14, v1: 0.7 };
const GOLD = new THREE.Color("#ffd899");
const ICE = new THREE.Color("#a8dcff");

export type OpeningWorld = {
  setPhase: (p: number) => void;
  setMotion: (on: boolean) => void;
  setPointer: (x: number, y: number) => void;
  onFrame: (cb: () => void) => void;
  dispose: () => void;
};

export type OpeningAssets = { image: HTMLImageElement; glyph: [number, number][] };

/** 단어를 캔버스에 그려 글자 안쪽의 점을 고른다. */
export function sampleGlyph(text: string, count: number, font: string): [number, number][] {
  const w = 1200, h = 420, c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.fillStyle = "#fff"; g.font = font; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, w / 2, h / 2 + 10);
  const data = g.getImageData(0, 0, w, h).data, inside: number[] = [];
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (data[(y * w + x) * 4 + 3] > 150) inside.push(x, y);
  const r = rand(17), out: [number, number][] = [];
  for (let i = 0; i < count; i++) { const k = Math.floor(r() * (inside.length / 2)) * 2; out.push([inside[k] - w / 2 + (r() - .5) * 2, inside[k + 1] - h / 2 + (r() - .5) * 2]); }
  return out;
}

export function createOpeningWorld(canvas: HTMLCanvasElement, assets: OpeningAssets, initialPhase: number, initialMotion: boolean): OpeningWorld {
  const stage = createStage(canvas, { background: "#05080d", fov: 30, bloom: [0.62, 0.55, 0.74], exposure: 1.02, lostEvent: "opening-lost" });
  const { scene, camera, glow } = stage;
  const camD = pixelCamera(camera);
  const pc = new PhaseClock(Math.max(0, Math.min(PHASES - 1, initialPhase)), initialMotion);

  /* 사진의 화소 ---------------------------------------------------------- */
  const sample = document.createElement("canvas"); sample.width = COLS; sample.height = ROWS;
  const sg = sample.getContext("2d", { willReadFrequently: true })!;
  sg.drawImage(assets.image, 0, 0, COLS, ROWS);
  const px = sg.getImageData(0, 0, COLS, ROWS).data;

  const photoTex = new THREE.Texture(assets.image); photoTex.colorSpace = THREE.SRGBColorSpace; photoTex.needsUpdate = true; photoTex.anisotropy = 8;
  stage.keep(photoTex);

  const relief = new THREE.Group(); scene.add(relief);

  // 은은한 뒷빛: 사진이 공간에 떠 있다는 느낌만 준다.
  const backGlow = new THREE.Mesh(new THREE.PlaneGeometry(2300, 1700), new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color("#4a7fa8"), transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }));
  backGlow.position.z = -260; relief.add(backGlow);

  const photoMat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: photoTex }, uScan: { value: 0 }, uBright: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `${GLSL_SAFE}varying vec2 vUv; uniform sampler2D uMap; uniform float uScan,uBright;
      void main(){
        float v=1.-vUv.y; if(v<uScan) discard;
        vec3 c=texture2D(uMap,vUv).rgb;
        // 가장자리를 살짝 어둡게: 인화지가 빛을 받는 느낌
        vec2 q=vUv-.5; float vig=1.-sstep(.28,.75,length(q*vec2(1.,.8)))*.28;
        gl_FragColor=vec4(c*vig*uBright*.9,1.);
      }`,
  });
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(PHOTO_W, PHOTO_H), photoMat); relief.add(photo);

  const n = COLS * ROWS;
  const cell = new Float32Array(n * 2), col = new Float32Array(n * 3), lum = new Float32Array(n), rnd = new Float32Array(n);
  { const r = rand(5);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const i = y * COLS + x, k = i * 4;
      const cr = px[k] / 255, cg = px[k + 1] / 255, cb = px[k + 2] / 255;
      cell.set([x, y], i * 2);
      // sRGB → 선형: 셰이더가 선형 공간에서 계산한다.
      col.set([cr, cg, cb].map((v) => Math.pow(v, 2.2)), i * 3);
      lum[i] = 0.299 * cr + 0.587 * cg + 0.114 * cb;
      rnd[i] = r();
    } }
  const boxGeo = new THREE.InstancedBufferGeometry();
  { const b = new THREE.BoxGeometry(1, 1, 1); boxGeo.index = b.index; for (const k of ["position", "normal", "uv"]) boxGeo.setAttribute(k, b.getAttribute(k)); }
  boxGeo.instanceCount = n;
  boxGeo.setAttribute("aCell", new THREE.InstancedBufferAttribute(cell, 2));
  boxGeo.setAttribute("aCol", new THREE.InstancedBufferAttribute(col, 3));
  boxGeo.setAttribute("aLum", new THREE.InstancedBufferAttribute(lum, 1));
  boxGeo.setAttribute("aRnd", new THREE.InstancedBufferAttribute(rnd, 1));
  const tileMat = new THREE.ShaderMaterial({
    uniforms: { uScan: { value: 0 }, uLift: { value: 0 }, uTint: { value: 0 }, uAway: { value: 0 }, uTime: { value: 0 }, uTile: { value: TILE }, uSize: { value: new THREE.Vector2(PHOTO_W, PHOTO_H) } },
    vertexShader: `${GLSL_SAFE}
      attribute vec2 aCell; attribute vec3 aCol; attribute float aLum; attribute float aRnd;
      uniform float uScan,uLift,uAway,uTime; uniform vec2 uTile,uSize;
      varying vec3 vCol; varying vec3 vN; varying float vTop; varying float vEdge;
      void main(){
        vec2 c=vec2((aCell.x+.5)*uTile.x-uSize.x*.5, uSize.y*.5-(aCell.y+.5)*uTile.y);
        float v=(aCell.y+.5)/${ROWS}.;
        float on=sstep(v-.015,v+.02,uScan);
        float h=max(1.5,(6.+aLum*aLum*120.)*uLift*on);
        vec3 p=position;
        float s=on*(1.-uAway*.7);
        p.xy*=uTile*.86*s; p.z=(p.z+.5)*h;
        p.xy+=c;
        p.z+=sin(uTime*.9+aRnd*6.283)*3.*uLift;
        // 흩어질 때는 뒤쪽 깊은 곳으로 물러난다.
        p+=vec3(c*(.35+aRnd*.8),-900.-aRnd*1500.)*uAway*uAway;
        vCol=aCol; vN=normalize(normalMatrix*normal); vTop=step(.49,position.z);
        vEdge=exp(-abs(v-uScan)*40.)*step(.001,uScan)*step(uScan,.999);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
      }`,
    fragmentShader: `${GLSL_SAFE}
      uniform float uTint,uAway; varying vec3 vCol; varying vec3 vN; varying float vTop; varying float vEdge;
      void main(){
        vec3 L=normalize(vec3(-.45,.55,.75));
        float ndl=max(dot(normalize(vN),L),0.);
        vec3 c=vCol*(.34+.8*ndl);
        float l=dot(vCol,vec3(.299,.587,.114));
        vec3 machine=vec3(.16,.34,.62)*(.25+l*1.5)*(.45+.7*ndl);
        c=mix(c,machine,uTint*.42);
        c+=vec3(.55,.8,1.)*vEdge*1.6;
        c*=1.-uAway*.85;
        gl_FragColor=vec4(c,1.);
      }`,
  });
  const tiles = new THREE.Mesh(boxGeo, tileMat); tiles.frustumCulled = false; relief.add(tiles);

  // 주사선
  const scanMat = new THREE.MeshBasicMaterial({ map: glow, color: ICE.clone().multiplyScalar(1.6), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const scanLine = new THREE.Mesh(new THREE.PlaneGeometry(PHOTO_W * 1.25, 70), scanMat); scanLine.position.z = 40; relief.add(scanLine);
  const scanCoreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#dff3ff").multiplyScalar(2.2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const scanCore = new THREE.Mesh(new THREE.PlaneGeometry(PHOTO_W * 1.06, 2.4), scanCoreMat); scanCore.position.z = 42; relief.add(scanCore);

  // 탐지 틀: 얼굴을 감싸는 네 모서리
  const fx0 = (FACE.u0 - .5) * PHOTO_W, fx1 = (FACE.u1 - .5) * PHOTO_W, fy0 = (.5 - FACE.v0) * PHOTO_H, fy1 = (.5 - FACE.v1) * PHOTO_H;
  const arm = 70, bz = 132;
  const corner = (x: number, y: number, sx: number, sy: number) => [x, y + sy * arm, bz, x, y, bz, x, y, bz, x + sx * arm, y, bz];
  const bracketGeo = new THREE.BufferGeometry();
  bracketGeo.setAttribute("position", new THREE.Float32BufferAttribute([...corner(fx0, fy0, 1, -1), ...corner(fx1, fy0, -1, -1), ...corner(fx0, fy1, 1, 1), ...corner(fx1, fy1, -1, 1)], 3));
  const bracketMat = new THREE.LineBasicMaterial({ color: GOLD.clone().multiplyScalar(2.2), transparent: true, opacity: 0, depthWrite: false });
  const bracket = new THREE.LineSegments(bracketGeo, bracketMat); relief.add(bracket);
  const boxFillMat = new THREE.MeshBasicMaterial({ color: GOLD.clone().multiplyScalar(0.5), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const boxFill = new THREE.Mesh(new THREE.PlaneGeometry(fx1 - fx0, fy0 - fy1), boxFillMat); boxFill.position.set((fx0 + fx1) / 2, (fy0 + fy1) / 2, bz - 2); relief.add(boxFill);
  const edgeGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(fx1 - fx0, fy0 - fy1));
  const edgeMat = new THREE.LineBasicMaterial({ color: GOLD.clone().multiplyScalar(1.1), transparent: true, opacity: 0, depthWrite: false });
  const edge = new THREE.LineSegments(edgeGeo, edgeMat); edge.position.copy(boxFill.position); relief.add(edge);

  /* 사진 → 단어로 흐르는 빛 ---------------------------------------------- */
  const placeRelief = (g: THREE.Group, L: typeof LAYOUT.photo0) => {
    g.position.copy(toWorld(L.x, L.y)); g.scale.setScalar(L.scale); g.rotation.set(0, L.rotY, 0); g.updateMatrixWorld(true);
  };
  const ghost = new THREE.Group(); placeRelief(ghost, LAYOUT.photo1);
  const glyph = assets.glyph, m = glyph.length;
  const aFrom = new Float32Array(m * 3), aTo = new Float32Array(m * 3), aDust = new Float32Array(m * 3), aFrame = new Float32Array(m * 3), aCol = new Float32Array(m * 3), aSeed = new Float32Array(m);
  {
    const r = rand(23), q = new THREE.Vector3();
    const word = toWorld(LAYOUT.word.x, LAYOUT.word.y);
    const S = LAYOUT.screen, per = 2 * (S.w + S.h);
    // 얼굴 쪽 화소를 더 많이 고른다: 이름은 그 부분에서 나왔다.
    for (let i = 0; i < m; i++) {
      const face = r() < 0.62;
      const u = face ? FACE.u0 + r() * (FACE.u1 - FACE.u0) : r(), v = face ? FACE.v0 + r() * (FACE.v1 - FACE.v0) : r();
      const cx = Math.min(COLS - 1, Math.floor(u * COLS)), cy = Math.min(ROWS - 1, Math.floor(v * ROWS)), k = (cy * COLS + cx);
      q.set((u - .5) * PHOTO_W, (.5 - v) * PHOTO_H, 6 + lum[k] * lum[k] * 120).applyMatrix4(ghost.matrixWorld);
      aFrom.set([q.x, q.y, q.z], i * 3);
      aTo.set([word.x + glyph[i][0], word.y - glyph[i][1], (r() - .5) * 16], i * 3);
      aCol.set([col[k * 3], col[k * 3 + 1], col[k * 3 + 2]], i * 3);
      aDust.set([(r() - .5) * 2600, (r() - .5) * 1500, -300 - r() * 1400], i * 3);
      // 영상 화면의 테두리 둘레에 고르게, 일부는 안쪽 면에
      let d = r() * per, fx: number, fy: number;
      if (d < S.w) { fx = S.x + d; fy = S.y; } else if ((d -= S.w) < S.h) { fx = S.x + S.w; fy = S.y + d; } else if ((d -= S.h) < S.w) { fx = S.x + S.w - d; fy = S.y + S.h; } else { d -= S.w; fx = S.x; fy = S.y + S.h - d; }
      if (r() < 0.22) { fx = S.x + r() * S.w; fy = S.y + r() * S.h; }
      const fw = toWorld(fx, fy); aFrame.set([fw.x, fw.y, (r() - .5) * 10], i * 3);
      aSeed[i] = r();
    }
  }
  const streamGeo = new THREE.BufferGeometry();
  streamGeo.setAttribute("position", new THREE.BufferAttribute(aTo.slice(), 3));
  streamGeo.setAttribute("aFrom", new THREE.BufferAttribute(aFrom, 3));
  streamGeo.setAttribute("aTo", new THREE.BufferAttribute(aTo, 3));
  streamGeo.setAttribute("aDust", new THREE.BufferAttribute(aDust, 3));
  streamGeo.setAttribute("aFrame", new THREE.BufferAttribute(aFrame, 3));
  streamGeo.setAttribute("aCol", new THREE.BufferAttribute(aCol, 3));
  streamGeo.setAttribute("aSeed", new THREE.BufferAttribute(aSeed, 1));
  const streamMat = new THREE.ShaderMaterial({
    uniforms: { uStream: { value: 0 }, uScatter: { value: 0 }, uGather: { value: 0 }, uAlpha: { value: 1 }, uTime: { value: 0 }, uGold: { value: GOLD.clone() }, uIce: { value: ICE.clone() }, uD: { value: camD } },
    vertexShader: `${GLSL_SAFE}
      attribute vec3 aFrom; attribute vec3 aTo; attribute vec3 aDust; attribute vec3 aFrame; attribute vec3 aCol; attribute float aSeed;
      uniform float uStream,uScatter,uGather,uTime,uD; varying vec3 vC; varying float vA; uniform vec3 uGold,uIce;
      void main(){
        float k=clamp((uStream*1.45-aSeed*.45),0.,1.); k=k*k*(3.-2.*k);
        vec3 mid=mix(aFrom,aTo,.5)+vec3(0.,90.+aSeed*140.,260.+aSeed*200.);
        vec3 a=mix(aFrom,mid,k), b=mix(mid,aTo,k), p=mix(a,b,k);
        p+=vec3(sin(uTime*1.3+aSeed*40.),cos(uTime*1.1+aSeed*30.),0.)*(1.5+6.*uScatter);
        float s=clamp(uScatter*1.3-aSeed*.3,0.,1.); s=1.-pw(1.-s,3.);
        p=mix(p,aDust+vec3(sin(uTime*.13+aSeed*9.)*40.,cos(uTime*.11+aSeed*7.)*30.,0.),s);
        float g=clamp(uGather*1.35-aSeed*.35,0.,1.); g=g*g*(3.-2.*g);
        p=mix(p,aFrame,g);
        vec3 c=mix(aCol*1.3,uGold*1.25,sstep(.25,.9,k));
        c=mix(c,uIce*.55,s); c=mix(c,uIce*1.35,g);
        vC=c; vA=sstep(.02,.16,k)*(1.-.55*s*(1.-g));
        vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_PointSize=(2.4+aSeed*1.6+ (1.-k)*1.2)*(uD/-mv.z);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: `${GLSL_SAFE}uniform float uAlpha; varying vec3 vC; varying float vA;
      void main(){ float d=length(gl_PointCoord-.5); float a=sstep(.5,.05,d); gl_FragColor=vec4(vC*a*vA*uAlpha,1.); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const stream = new THREE.Points(streamGeo, streamMat); stream.frustumCulled = false; scene.add(stream);

  // 단어 아래의 빛 웅덩이
  const wordGlowMat = new THREE.MeshBasicMaterial({ map: glow, color: GOLD.clone().multiplyScalar(0.55), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const wordGlow = new THREE.Mesh(new THREE.PlaneGeometry(1300, 560), wordGlowMat); wordGlow.position.copy(toWorld(LAYOUT.word.x, LAYOUT.word.y)).setZ(-120); scene.add(wordGlow);

  // 영상 화면 뒤의 빛
  const S = LAYOUT.screen;
  const screenGlowMat = new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color("#5f9fd4"), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const screenGlow = new THREE.Mesh(new THREE.PlaneGeometry(S.w * 1.9, S.h * 2.0), screenGlowMat); screenGlow.position.copy(toWorld(S.x + S.w / 2, S.y + S.h / 2)).setZ(-200); scene.add(screenGlow);

  /* 떠다니는 먼지 */
  const dustGeo = new THREE.BufferGeometry();
  { const r = rand(41), k = 900, a = new Float32Array(k * 3); for (let i = 0; i < k; i++) a.set([(r() - .5) * 3000, (r() - .5) * 1800, -1600 + r() * 1700], i * 3); dustGeo.setAttribute("position", new THREE.BufferAttribute(a, 3)); }
  const dustMat = new THREE.PointsMaterial({ color: new THREE.Color("#7fb0d8"), size: 5, map: glow, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const dust = new THREE.Points(dustGeo, dustMat); scene.add(dust);

  /* 갱신 ------------------------------------------------------------------ */
  const P0 = LAYOUT.photo0, P1 = LAYOUT.photo1;
  const pointerS = new THREE.Vector2();
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  function update(dt: number) {
    pc.tick(dt);
    const p = pc.phase, t = pc.t, time = pc.clock;
    const u = (s: number, d: number) => pc.ev(s, d);

    // 단계별 목표. 앞으로 넘긴 단계만 시간에 따라 움직인다.
    let scan = 0, lift = 0, tint = 0, move = 0, bracketA = 0, streamK = 0, scatter = 0, gather = 0, away = 0, alpha = 1, photoB = 1;
    if (p === 0) { photoB = 0.35 + 0.65 * easeOut(u(0.1, 1.4)); }
    if (p >= 1) {
      scan = p === 1 ? easeInOut(u(0.15, 1.35)) : 1;
      lift = p === 1 ? easeOut(u(0.3, 1.6)) : 1;
      tint = p === 1 ? smooth(0.2, 1.3, t) : 1;
      move = p === 1 ? easeInOut(u(1.25, 1.35)) : 1;
      bracketA = p === 1 ? smooth(2.35, 2.8, t) * (1 - 0.55 * smooth(4.6, 5.4, t)) : 0.45;
      streamK = p === 1 ? u(2.55, 2.4) : 1;
    }
    if (p >= 2) {
      scatter = p === 2 ? easeOut(u(0, 2.2)) : 1;
      away = p === 2 ? easeInOut(u(0, 1.9)) : 1;
      bracketA = 0;
    }
    if (p >= 3) {
      gather = easeInOut(u(0, 1.35));
      alpha = 1 - smooth(1.45, 2.3, t);
    }

    placeRelief(relief, { x: lerp(P0.x, P1.x, move), y: lerp(P0.y, P1.y, move), scale: lerp(P0.scale, P1.scale, move), rotY: lerp(P0.rotY, P1.rotY, move) });
    // 모션이 켜져 있으면 포인터를 따라 아주 조금 기운다.
    if (pc.motion) {
      pointerS.lerp(stage.pointer, 1 - Math.exp(-dt * 2.2));
      relief.rotation.y += pointerS.x * 0.06 + Math.sin(time * 0.35) * 0.012;
      relief.rotation.x = pointerS.y * 0.04 + Math.sin(time * 0.29) * 0.01;
    }

    photoMat.uniforms.uScan.value = scan;
    photoMat.uniforms.uBright.value = photoB;
    photo.visible = scan < 1 && away < 1;
    tileMat.uniforms.uScan.value = scan;
    tileMat.uniforms.uLift.value = lift;
    tileMat.uniforms.uTint.value = tint;
    tileMat.uniforms.uAway.value = away;
    tileMat.uniforms.uTime.value = time;
    tiles.visible = scan > 0 && away < 0.999;
    const scanY = (0.5 - scan) * PHOTO_H;
    scanLine.position.y = scanCore.position.y = scanY;
    const scanVis = scan > 0.001 && scan < 0.999 ? 1 : 0;
    scanMat.opacity = 0.55 * scanVis; scanCoreMat.opacity = 0.9 * scanVis;

    bracketMat.opacity = bracketA; edgeMat.opacity = bracketA * 0.35; boxFillMat.opacity = bracketA * 0.07;
    bracket.scale.setScalar(1 + (1 - smooth(2.35, 2.75, t)) * 0.12 * (p === 1 ? 1 : 0));

    streamMat.uniforms.uStream.value = streamK;
    streamMat.uniforms.uScatter.value = scatter;
    streamMat.uniforms.uGather.value = gather;
    streamMat.uniforms.uAlpha.value = alpha;
    streamMat.uniforms.uTime.value = time;
    stream.visible = (streamK > 0 || p >= 2) && alpha > 0.001;
    wordGlowMat.opacity = 0.32 * smooth(0.5, 1, streamK) * (1 - scatter);
    screenGlowMat.opacity = p >= 3 ? 0.26 * smooth(0.6, 2.0, t) : 0;
    backGlow.visible = away < 1;
    (backGlow.material as THREE.MeshBasicMaterial).opacity = 0.16 * (1 - away) * (p === 0 ? photoB : 1);

    dust.rotation.y = time * 0.004; dust.position.y = Math.sin(time * 0.1) * 12;
  }

  stage.start(update, () => pc.motion);

  return {
    setPhase(next) {
      next = Math.max(0, Math.min(PHASES - 1, next));
      if (next === pc.phase) return;
      pc.go(next); stage.kick();
    },
    setMotion(on) { pc.setMotion(on); stage.kick(); },
    setPointer(x, y) { stage.pointer.set(x, y); },
    onFrame: stage.onFrame,
    dispose: stage.dispose,
  };
}

export { W, H };
