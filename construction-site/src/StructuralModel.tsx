import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { addArchitecturalUVs, architecturalFinishes } from './architecturalMaterials';
import { createHouseAssembly } from './houseAssembly';

type Lang = 'ko' | 'en';
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const ease = (v: number) => { const t = clamp(v, 0, 1); return t * t * (3 - 2 * t); };
const hash01 = (value: number) => {
  let n = Math.imul(value + 1, 0x9e3779b1);
  n ^= n >>> 16;
  n = Math.imul(n, 0x85ebca6b);
  n ^= n >>> 13;
  return (n >>> 0) / 0xffffffff;
};

export default function StructuralModel({ progress, lang }: { progress: number; lang: Lang }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(progress);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [dragging, setDragging] = useState(false);
  useEffect(() => { progressRef.current = progress; }, [progress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch {
      setStatus('failed');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .92;
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.type = THREE.VSMShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(31, 1, .1, 70);
    const model = new THREE.Group();
    scene.add(model);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const studio = new RoomEnvironment();
    const environment = pmrem.fromScene(studio, .025);
    scene.environment = environment.texture;
    scene.environmentIntensity = .38;
    studio.dispose();
    pmrem.dispose();
    RectAreaLightUniformsLib.init();
    scene.add(new THREE.HemisphereLight(0xdde5ec, 0x252724, .25));
    const key = new THREE.DirectionalLight(0xffead3, 2.4);
    key.position.set(-3, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    key.shadow.camera.near = .5;
    key.shadow.camera.far = 20;
    key.shadow.bias = -.00015;
    key.shadow.normalBias = .008;
    key.shadow.radius = 6;
    key.shadow.blurSamples = 8;
    scene.add(key, key.target);
    const fill = new THREE.DirectionalLight(0xbed2e2, .7);
    fill.position.set(6, 3, -5);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xe2c6a1, 1.15);
    rim.position.set(-5, 4, -4);
    scene.add(rim);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ color: 0x000000, opacity: .38 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.receiveShadow = true;
    scene.add(shadow);

    // A broad contact falloff anchors the maquette without a visible platform edge.
    const contactCanvas = document.createElement('canvas');
    contactCanvas.width = contactCanvas.height = 128;
    const context = contactCanvas.getContext('2d');
    if (context) {
      const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 64);
      gradient.addColorStop(0, 'rgba(0,0,0,.42)');
      gradient.addColorStop(.4, 'rgba(0,0,0,.26)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 128, 128);
    }
    const contactTexture = new THREE.CanvasTexture(contactCanvas);
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 6.2), new THREE.MeshBasicMaterial({ map: contactTexture, transparent: true, depthWrite: false, opacity: .8 }));
    contact.rotation.x = -Math.PI / 2;
    scene.add(contact);
    const finishes = architecturalFinishes();
    const renderTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(renderer, renderTarget);
    composer.addPass(new RenderPass(scene, camera));
    const occlusion = new GTAOPass(scene, camera, 1, 1);
    occlusion.blendIntensity = .9;
    occlusion.updateGtaoMaterial({ radius: .22, distanceExponent: 1.7, thickness: .3, distanceFallOff: .6, samples: 12 });
    occlusion.updatePdMaterial({ radius: 5, samples: 8, rings: 2 });
    const renderOcclusion = occlusion.render.bind(occlusion);
    occlusion.render = (...args) => {
      const hidden: THREE.Object3D[] = [];
      model.traverse((object) => {
        if (!(object as THREE.Mesh).isMesh || !object.visible) return;
        const material = (object as THREE.Mesh).material;
        if ((Array.isArray(material) ? material : [material]).some((m) => m.transparent)) {
          object.visible = false;
          hidden.push(object);
        }
      });
      contact.visible = false;
      renderOcclusion(...args);
      contact.visible = true;
      hidden.forEach((object) => { object.visible = true; });
    };
    composer.addPass(occlusion);
    const output = new OutputPass();
    composer.addPass(output);

    let assembly: ReturnType<typeof createHouseAssembly> | undefined;
    const geometries = new Set<THREE.BufferGeometry>([shadow.geometry, contact.geometry]);
    const materials = new Set<THREE.Material>([shadow.material, contact.material]);
    const textures = new Set<THREE.Texture>([contactTexture, ...finishes.resources]);
    const ownMaterial = (m: THREE.Material) => {
      materials.add(m);
      for (const value of Object.values(m)) if ((value as THREE.Texture | null)?.isTexture) textures.add(value as THREE.Texture);
    };
    let disposed = false;
    let failed = false;
    let visible = true;
    let frame = 0;
    let previousProgress = -1;
    let previouslyRendered = false;
    let eased = 0;
    let radius = 9.4;
    let desktopComposition = true;
    let currentRadius = 9.4;
    let currentAimX = 0;
    let currentAimY = -.1;
    let pointer: number | null = null;
    let lastX = 0;
    let lastY = 0;
    let targetYaw = .53;
    let targetElev = .30;
    let yaw = targetYaw;
    let elev = targetElev;
    let yawVelocity = 0;
    let elevVelocity = 0;
    let userInteracted = false;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motionPreferenceChanged = () => {
      previouslyRendered = false;
      renderer.shadowMap.needsUpdate = true;
    };
    reduceMotion.addEventListener('change', motionPreferenceChanged);
    new GLTFLoader().load('/models/house.glb', (gltf) => {
      if (disposed) return;
      const house = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(house);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      if (!Number.isFinite(size.x) || size.x <= 0) {
        failed = true;
        setStatus('failed');
        return;
      }
      const scale = 5.8 / size.x;
      house.scale.setScalar(scale);
      house.position.copy(center).multiplyScalar(-scale);
      model.add(house);
      shadow.position.y = -size.y * scale / 2 - .016;
      contact.position.y = shadow.position.y + .003;
      const interiorLight = (position: [number, number, number], width: number, height: number, intensity: number) => {
        const light = new THREE.RectAreaLight(0xffbf77, intensity, width * scale, height * scale);
        light.position.set(...position).sub(center).multiplyScalar(scale);
        light.lookAt(light.position.x, light.position.y - 1, light.position.z);
        scene.add(light);
      };
      interiorLight([0, 3.95, 1], 12.5, 5.5, 2.1);
      interiorLight([8, 7.92, 0], 16, 5.5, 1.8);

      house.traverse((object) => {
        if (!(object as THREE.Mesh).isMesh) return;
        const mesh = object as THREE.Mesh;
        geometries.add(mesh.geometry);
        addArchitecturalUVs(mesh.geometry);
        mesh.receiveShadow = true;
        const old = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        old.forEach(ownMaterial);
        const updated = old.map(finishes.apply);
        updated.forEach(ownMaterial);
        mesh.material = Array.isArray(mesh.material) ? updated : updated[0];
      });
      const varyWood = (name: string, strength: number, seed: number) => {
        const object = house.getObjectByName(name);
        if (!(object as THREE.Mesh | undefined)?.isMesh) return;
        const mesh = object as THREE.Mesh;
        const position = mesh.geometry.getAttribute('position');
        if (!position || position.count % 24 !== 0) return;
        const colors = new Float32Array(position.count * 3);
        for (let box = 0; box < position.count / 24; box += 1) {
          const tone = (hash01(box + seed) - .5) * strength;
          const warmth = (hash01(box + seed + 1009) - .5) * strength * .28;
          for (let vertex = 0; vertex < 24; vertex += 1) {
            const at = (box * 24 + vertex) * 3;
            colors[at] = 1 + tone + warmth;
            colors[at + 1] = 1 + tone * .88;
            colors[at + 2] = 1 + tone * .74 - warmth * .4;
          }
        }
        mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const finishes = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        finishes.forEach((material) => {
          const finish = material as THREE.MeshStandardMaterial;
          finish.vertexColors = true;
          finish.needsUpdate = true;
        });
      };
      varyWood('cedar_slats', .16, 71);
      varyWood('deck_boards', .09, 607);
      assembly = createHouseAssembly(house, (geometry) => geometries.add(geometry));
      assembly.update(clamp(progressRef.current, 0, 1), reduceMotion.matches);
      renderer.shadowMap.needsUpdate = true;
      previouslyRendered = false;
      setStatus('ready');
    }, undefined, () => {
      if (disposed) return;
      failed = true;
      setStatus('failed');
    });

    const resize = () => {
      const w = Math.max(1, wrap.clientWidth);
      const h = Math.max(1, wrap.clientHeight);
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      occlusion.setSize(Math.round(w * .7), Math.round(h * .7));
      occlusion.enabled = w > 640;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      previouslyRendered = false;
      desktopComposition = w > 760;
      const visibleAspect = Math.min(w, window.innerWidth) / h;
      radius = 9.7 * Math.max(1, (w <= 640 ? 1.18 : 1.47) / visibleAspect);
    };
    resize();
    currentRadius = radius;
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(wrap);
    const visibilityObserver = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? false;
    }, { rootMargin: '20% 0px 20% 0px' });
    visibilityObserver.observe(wrap);

    const finish = (event: PointerEvent, cancel: boolean) => {
      if (event.pointerId !== pointer) return;
      if (wrap.hasPointerCapture(event.pointerId)) wrap.releasePointerCapture(event.pointerId);
      pointer = null;
      if (cancel) { yawVelocity = 0; elevVelocity = 0; }
      setDragging(false);
    };
    const down = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      pointer = event.pointerId;
      userInteracted = true;
      lastX = event.clientX;
      lastY = event.clientY;
      yawVelocity = 0;
      elevVelocity = 0;
      wrap.setPointerCapture(event.pointerId);
      setDragging(true);
      if (event.pointerType === 'mouse') event.preventDefault();
    };
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      targetYaw -= dx * .008;
      targetElev = clamp(targetElev + dy * .0045, .16, .82);
      yawVelocity = -dx * .0018;
      elevVelocity = dy * .0009;
    };
    const up = (event: PointerEvent) => finish(event, false);
    const cancel = (event: PointerEvent) => finish(event, true);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') targetYaw += .25;
      else if (event.key === 'ArrowRight') targetYaw -= .25;
      else if (event.key === 'ArrowUp') targetElev = clamp(targetElev - .1, .16, .82);
      else if (event.key === 'ArrowDown') targetElev = clamp(targetElev + .1, .16, .82);
      else if (event.key === 'Home') { targetYaw = .53; targetElev = .30; }
      else return;
      userInteracted = true;
      yawVelocity = 0;
      elevVelocity = 0;
      event.preventDefault();
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      failed = true;
      setStatus('failed');
    };
    wrap.addEventListener('pointerdown', down);
    wrap.addEventListener('pointermove', move);
    wrap.addEventListener('pointerup', up);
    wrap.addEventListener('pointercancel', cancel);
    wrap.addEventListener('keydown', keydown);
    canvas.addEventListener('webglcontextlost', contextLost);

    let previousTime = performance.now();
    const render = (time = performance.now()) => {
      frame = requestAnimationFrame(render);
      const delta = Math.min((time - previousTime) / 1000, .2);
      previousTime = time;
      if (!visible || failed) return;
      eased += (clamp(progressRef.current, 0, 1) - eased) * (reduceMotion.matches ? 1 : 1 - Math.exp(-delta * 6));
      const p = clamp(eased, 0, 1);
      const detailFocus = userInteracted ? 0 : ease((p - .28) / .20) * (1 - ease((p - .50) / .14));
      const orbitFit = userInteracted ? (desktopComposition ? 1.12 : 1.08) : 1;
      const landscapeFit = desktopComposition ? 1 + .04 * ease((p - .58) / .2) : 1;
      const desiredRadius = radius * orbitFit * landscapeFit * (1 - detailFocus * (desktopComposition ? .16 : .08));
      const desiredAimX = desktopComposition ? -.5 - .2 * detailFocus : 0;
      const framingMoving = Math.abs(currentRadius - desiredRadius) > .001 || Math.abs(currentAimX - desiredAimX) > .001;
      const assemblyMoving = Math.abs(p - previousProgress) > .0001;
      const cameraMoving = Math.abs(yaw - targetYaw) > .0001 || Math.abs(elev - targetElev) > .0001 || Math.abs(yawVelocity) > .00005 || Math.abs(elevVelocity) > .00005;
      if (previouslyRendered && !assemblyMoving && !cameraMoving && !framingMoving && pointer === null) return;
      if (assemblyMoving) renderer.shadowMap.needsUpdate = true;
      previousProgress = p;
      previouslyRendered = true;
      assembly?.update(p, reduceMotion.matches);
      if (pointer === null && !reduceMotion.matches) {
        targetYaw += yawVelocity;
        targetElev = clamp(targetElev + elevVelocity, .16, .82);
        yawVelocity *= .88;
        elevVelocity *= .88;
        if (Math.abs(yawVelocity) < .00005) yawVelocity = 0;
        if (Math.abs(elevVelocity) < .00005) elevVelocity = 0;
      }
      const damping = reduceMotion.matches ? 1 : 1 - Math.exp(-delta * 9);
      yaw += (targetYaw - yaw) * damping;
      elev += (targetElev - elev) * damping;
      currentRadius += (desiredRadius - currentRadius) * damping;
      currentAimX += (desiredAimX - currentAimX) * damping;
      currentAimY += ((-.1 + .22 * detailFocus) - currentAimY) * damping;
      const horizontal = Math.cos(elev) * currentRadius;
      camera.position.set(Math.sin(yaw) * horizontal, Math.sin(elev) * currentRadius, Math.cos(yaw) * horizontal);
      camera.lookAt(currentAimX, currentAimY, 0);
      composer.render();
    };
    render();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      wrap.removeEventListener('pointerdown', down);
      wrap.removeEventListener('pointermove', move);
      wrap.removeEventListener('pointerup', up);
      wrap.removeEventListener('pointercancel', cancel);
      wrap.removeEventListener('keydown', keydown);
      canvas.removeEventListener('webglcontextlost', contextLost);
      reduceMotion.removeEventListener('change', motionPreferenceChanged);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      occlusion.dispose();
      output.dispose();
      composer.dispose();
      environment.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      className={'structure-visual' + (dragging ? ' structure-visual--dragging' : '')}
      ref={wrapRef}
      role="img"
      tabIndex={0}
      aria-label={lang === 'ko'
        ? '스크롤로 집이 조립됩니다. 마우스로 드래그하거나 방향키로 회전할 수 있습니다.'
        : 'The house assembles on scroll. Drag or use the arrow keys to rotate it.'}
    >
      {status === 'failed' ? <div className="structure-visual__fallback" /> : <canvas ref={canvasRef} />}
      {status === 'loading' && <div className="structure-visual__loading" role="status">{lang === 'ko' ? '건축 모델을 불러오는 중…' : 'Loading architectural model…'}</div>}
    </div>
  );
}
