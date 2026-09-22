import { useEffect, useRef, useState } from "react";
import { Renderer, Camera, Transform, Geometry, Program, Mesh, Vec3 } from "ogl";

export const ENGINES = [
  { name: "tts-engine", detail: "내 목소리로 만드는 강의", at: [0, 0, 0], color: [.38, .76, 1.] },
  { name: "assets-engine", detail: "이미지와 3D 에셋", at: [9, .6, -9], color: [.78, .85, 1.] },
  { name: "music-engine", detail: "곡을 만들고, 듣고, 고르기", at: [18, -.6, -18], color: [1., .73, .39] },
] as const;
const POSES = [
  { eye: [9, 4, 19], look: [9, -1, -7] },
  { eye: [-2.9, .7, 7], look: [-2.9, 0, 0] },
  { eye: [6.1, 1.3, -2], look: [6.1, .6, -9] },
  { eye: [15.1, .1, -11], look: [15.1, -.6, -18] },
  { eye: [9, 7, 20], look: [9, -1, -7] },
];
const vertex = `
attribute vec3 position;
attribute vec3 seed;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uTime;
uniform float uKind;
uniform float uTravel;
uniform float uActive;
uniform float uDpr;
varying float vAlpha;
varying float vKind;
mat2 rotate(float a) { return mat2(cos(a),-sin(a),sin(a),cos(a)); }
void main(){
 vec3 p=position;
 float t=uTime;
 vAlpha=.5;vKind=uKind;
 if(uKind<.5){
   float envelope=exp(-p.x*p.x*.15);
   p.y+=sin(p.x*2.9+t*.8+seed.y*3.8)*.53*envelope;
   p.z+=cos(p.x*1.8-t*.42+seed.y*4.)*.36;
   vAlpha=.35+.65*pow(.5+.5*sin(p.x*2.-t*1.7+seed.y),5.);
 }else if(uKind<1.5){
   p.xz=rotate(t*.14)*p.xz;p.xy=rotate(.16*sin(t*.15))*p.xy;
   vAlpha=.25+.7*pow(.5+.5*sin(p.y*3.-t*.85),4.);
 }else if(uKind<2.5){
   p.xy*=1.+.07*sin(seed.x*9.+t*1.9);
   p.xz=rotate(.38)*p.xz;p.yz=rotate(.15*sin(t*.25))*p.yz;
   vAlpha=.3+.7*pow(.5+.5*sin(seed.x*4.-t*1.4),6.);
 }else if(uKind<3.5){
   p.z+=seed.z*uTravel*3.;vAlpha=.15+seed.x*.3+uTravel*.2;
 }else if(uKind<4.5){
   vAlpha=.13+.65*pow(.5+.5*sin(seed.x*26.-t*1.8),14.);
 }else{
   p.z+=seed.z*uTravel*6.;vAlpha=uTravel*.55;
 }
 if(uKind<2.5 && uActive>.5 && uActive<3.5 && abs(uKind-(uActive-1.))>.2)vAlpha*=.16;
 vec4 mv=modelViewMatrix*vec4(p,1.);
 gl_Position=projectionMatrix*mv;
 gl_PointSize=clamp(24.*uDpr/max(2.,-mv.z),1.1,7.);
 vAlpha*=smoothstep(0.,1.4,-mv.z);
}
`;
const fragment = `
precision highp float;
uniform vec3 uColor;
varying float vAlpha;
varying float vKind;
void main(){
 float a=vAlpha;
 if(vKind<3.5){float d=length(gl_PointCoord-.5);a*=exp(-d*d*15.);}
 gl_FragColor=vec4(uColor,a);
}
`;

function randomFactory() { let seed = 817; return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

/** A single 3D world survives all five camera cues, including reverse navigation. */
export default function EngineWorld({ phase }: { phase: number }) {
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef<(HTMLDivElement | null)[]>([]);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let renderer: Renderer;
    try { renderer = new Renderer({ dpr: 1, alpha: true, antialias: false, depth: false, preserveDrawingBuffer: true, webgl: 1 }); }
    catch { setFailed(true); return; }
    const gl = renderer.gl;
    if (!gl) { setFailed(true); return; }
    container.prepend(gl.canvas);
    gl.clearColor(.016, .024, .037, 1);
    const camera = new Camera(gl, { fov: 54, near: .1, far: 150 });
    const world = new Transform();
    const programs: Program[] = [], geometries: Geometry[] = [];
    const rnd = randomFactory();
    const addMesh = (positions: number[], seeds: number[], kind: number, color: readonly number[], at = [0,0,0], lines: boolean | "segments" = false) => {
      const geometry = new Geometry(gl, { position: { size: 3, data: new Float32Array(positions) }, seed: { size: 3, data: new Float32Array(seeds) } });
      const program = new Program(gl, { vertex, fragment, uniforms: { uTime: { value: 0 }, uKind: { value: kind }, uTravel: { value: 0 }, uActive: { value: 0 }, uDpr: { value: 1 }, uColor: { value: color } }, transparent: true, depthTest: false, depthWrite: false });
      program.setBlendFunc(gl.SRC_ALPHA, gl.ONE);
      const mesh = new Mesh(gl, { geometry, program, mode: lines === "segments" ? gl.LINES : lines ? gl.LINE_STRIP : gl.POINTS });
      mesh.position.set(at[0], at[1], at[2]); mesh.frustumCulled = false; mesh.setParent(world);
      programs.push(program); geometries.push(geometry);
    };
    ENGINES.forEach((engine, kind) => {
      const p: number[] = [], s: number[] = [];
      const push = (x: number,y: number,z: number,a: number,b: number) => { p.push(x,y,z);s.push(a,b,rnd()); };
      if (kind === 0) {
        for(let row=0;row<52;row++) for(let x=0;x<160;x++) push((x/159-.5)*5.2,(row/51-.5)*1.8,(row/51-.5)*1.1,x/159,row/51);
      } else if (kind === 1) {
        for(let face=0;face<6;face++) for(let a=0;a<38;a++) for(let b=0;b<38;b++) {
          const u=(a/37-.5)*3.2,v=(b/37-.5)*3.2,w=face%2?1.6:-1.6;
          const xyz=face<2?[w,u,v]:face<4?[u,w,v]:[u,v,w];push(xyz[0],xyz[1],xyz[2],a/37,b/37);
        }
      } else {
        for(let ring=0;ring<36;ring++) for(let a=0;a<220;a++) {
          const angle=a/220*Math.PI*2,inner=ring/36*Math.PI*2,radius=1.9+.45*Math.cos(inner);
          push(radius*Math.cos(angle),radius*Math.sin(angle),.45*Math.sin(inner),angle,inner);
        }
      }
      addMesh(p,s,kind,engine.color,[...engine.at]);
    });
    const stars: number[] = [], starSeeds: number[] = [];
    for(let i=0;i<1600;i++){stars.push(rnd()*65-22,rnd()*28-14,rnd()*80-45);starSeeds.push(rnd(),rnd(),rnd());}
    addMesh(stars,starSeeds,3,[.35,.5,.67]);
    const streaks: number[] = [], streakSeeds: number[] = [];
    for(let i=0;i<700;i++) {
      const x=rnd()*65-22,y=rnd()*28-14,z=rnd()*80-45;
      streaks.push(x,y,z,x,y,z);streakSeeds.push(rnd(),0,0,rnd(),0,1);
    }
    addMesh(streaks,streakSeeds,5,[.4,.7,1],[0,0,0],"segments");
    for(let strand=0;strand<22;strand++) {
      const p: number[] = [], s: number[] = [];
      for(let i=0;i<380;i++) {
        const x=i/379*55-15;
        p.push(x,Math.sin(x*.21+strand*.2)*.65+(strand-11)*.115,-x+(strand-11)*.18);
        s.push(i/379+strand*.031,0,0);
      }
      addMesh(p,s,4,strand>19?[.76,.51,.23]:[.19,.42,.7],[0,-1.7,0],true);
    }
    let raf = 0, last=0, elapsed=1, active=phaseRef.current, start=0, frames=0;
    let fromEye = new Vec3(...POSES[active].eye), fromLook = new Vec3(...POSES[active].look);
    let eye = fromEye.clone(), look = fromLook.clone();
    let paused=false, dirty=true;
    const reduce=matchMedia('(prefers-reduced-motion: reduce)');
    const deck=container.closest('[data-motion]');
    const update=()=>{paused=reduce.matches||deck?.getAttribute('data-motion')==='off';dirty=true;};
    const observer=new MutationObserver(update);if(deck)observer.observe(deck,{attributes:true,attributeFilter:['data-motion']});
    reduce.addEventListener('change',update);update();
    const resize=()=>{const width=Math.min(1600,Math.max(960,container.getBoundingClientRect().width));renderer.setSize(width,width*9/16);gl.canvas.style.width='100%';gl.canvas.style.height='100%';camera.perspective({aspect:16/9});dirty=true;};
    resize();window.addEventListener('resize',resize);
    const onLost=(event: Event)=>{event.preventDefault();cancelAnimationFrame(raf);setFailed(true);};
    gl.canvas.addEventListener('webglcontextlost',onLost);
    gl.canvas.dataset.ready='true';
    gl.canvas.dataset.world='factory';
    const render=(stamp: number)=>{
      const dt=last?Math.min(.05,(stamp-last)/1000):0;last=stamp;
      if(!paused&&!document.hidden)elapsed+=dt;
      if(active!==phaseRef.current){active=phaseRef.current;start=elapsed;fromEye=eye.clone();fromLook=look.clone();dirty=true;}
      const progress=paused?1:Math.min(1,(elapsed-start)/1.85);
      const ease=progress<.5?4*progress*progress*progress:1-Math.pow(-2*progress+2,3)/2;
      const travel=Math.sin(progress*Math.PI);
      eye.copy(fromEye).lerp(new Vec3(...POSES[active].eye),ease);
      look.copy(fromLook).lerp(new Vec3(...POSES[active].look),ease);
      camera.position.copy(eye);camera.lookAt(look);camera.perspective({fov:54+travel*11,aspect:16/9});
      if((!paused&&!document.hidden)||dirty){
        programs.forEach(p=>{p.uniforms.uTime.value=elapsed;p.uniforms.uTravel.value=travel;p.uniforms.uActive.value=active;});
        renderer.render({scene:world,camera});
        gl.canvas.dataset.frames=String(++frames);gl.canvas.dataset.phase=String(active);
        gl.canvas.dataset.camera=eye.map(value=>value.toFixed(3)).join(',');
        container.style.setProperty('--travel',String(travel));
        container.dataset.moving=progress<1?'true':'false';
        ENGINES.forEach((engine,i)=>{
          const label=labels.current[i];if(!label)return;
          const point=new Vec3(engine.at[0],engine.at[1]-2.5,engine.at[2]);
          camera.project(point);
          const overview=active===0||active===4;
          label.style.transform=`translate(${(point.x*.5+.5)*1920}px,${(-point.y*.5+.5)*1080}px) translate(-50%,0)`;
          label.style.opacity=String(overview?Math.max(0,1-travel*2):0);
        });
        dirty=false;
      }
      raf=requestAnimationFrame(render);
    };
    raf=requestAnimationFrame(render);
    return()=>{
      cancelAnimationFrame(raf);observer.disconnect();reduce.removeEventListener('change',update);window.removeEventListener('resize',resize);
      gl.canvas.removeEventListener('webglcontextlost',onLost);
      geometries.forEach(g=>g.remove());programs.forEach(p=>p.remove());gl.canvas.remove();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);

  return <div className="engine-world" ref={host} data-fallback={failed||undefined} aria-hidden="true">
    {ENGINES.map((engine,i)=><div className="engine-world-label" key={engine.name} ref={el=>{labels.current[i]=el}}><strong>{engine.name}</strong><span>{engine.detail}</span></div>)}
    <div className="engine-flight-glow" />
    {failed&&<div className="engine-fallback">TTS / ASSETS / MUSIC</div>}
  </div>;
}
