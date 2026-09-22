import { useEffect, useRef, useState } from "react";
import { Renderer, Camera, Transform, Geometry, Program, Mesh, Vec3, Box, Cylinder, Sphere, Torus, Texture, Plane } from "ogl";
import voiceWaveform from "./data/tts-waveform.json";
import musicWaveform from "./data/music-waveform.json";
import { createEngineCinematic } from "./EngineCinematic";

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

// Solid, depth-tested materials. The light sources behave like a product-photo studio.
const surfaceVertex = `
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vLocal;
varying vec2 vUv;
void main(){
 vec4 view=modelViewMatrix*vec4(position,1.);
 vNormal=normalize(normalMatrix*normal);vView=-view.xyz;vLocal=position;vUv=uv;
 gl_Position=projectionMatrix*view;
}`;
const surfaceFragment = `
precision highp float;
uniform vec3 uColor;
uniform float uMetal;
uniform float uRoughness;
uniform float uEmission;
uniform float uPattern;
uniform float uEngine;
uniform float uActive;
uniform float uTime;
uniform float uTextured;
uniform float uReveal;
uniform sampler2D uMap;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vLocal;
varying vec2 vUv;
void main(){
 vec3 n=normalize(vNormal),v=normalize(vView);
 vec3 base=uColor;
 if(uReveal<.999){float grain=fract(sin(dot(floor(vUv*145.),vec2(12.9898,78.233)))*43758.5453);if(grain>uReveal)discard;}
 if(uTextured>.5)base*=texture2D(uMap,vUv).rgb;
 if(uPattern>2.5){
   float edge=min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y));
   float opacity=smoothstep(0.,.11,edge)*smoothstep(.02,.18,vUv.y)*smoothstep(.018,.075,max(base.r,max(base.g,base.b)));
   if(uActive>.5&&uActive<3.5&&abs(uEngine-(uActive-1.))>.2)opacity*=.045;
   gl_FragColor=vec4(base*1.08,opacity);return;
 }
 float rough=uRoughness;
 if(uPattern>.5&&uPattern<1.5){
   vec2 weave=fract(vUv*vec2(100.,62.));
   float hole=smoothstep(.23,.34,length(weave-.5));
   base*=mix(.2,1.,hole);
 }
 if(uPattern>1.5&&uPattern<2.5){
   float r=length(vUv-.5);
   float groove=.5+.5*sin(r*1450.);
   base*=.64+.36*groove;
   n=normalize(n+vec3(sin(r*1450.)*.016,0.,0.));
 }
 vec3 key=normalize(vec3(-.65,.85,1.2)),fill=normalize(vec3(.9,.25,.6)),rim=normalize(vec3(.3,.65,-.7));
 float ndv=max(dot(n,v),0.);
 float diffuse=max(dot(n,key),0.);
 float exponent=mix(130.,12.,rough);
 float spec=pow(max(dot(n,normalize(key+v)),0.),exponent);
 float broad=pow(max(dot(n,normalize(fill+v)),0.),18.);
 float edge=pow(1.-ndv,3.);
 vec3 color=base*(.23+diffuse*.78+max(dot(n,fill),0.)*.26)*(1.-uMetal*.54);
 color+=mix(vec3(.78,.88,1.),base,uMetal*.55)*spec*(.46+uMetal*1.3);
 color+=vec3(.39,.65,.84)*broad*(.08+uMetal*.56);
 color+=vec3(.9,.65,.37)*pow(max(dot(n,normalize(rim+v)),0.),24.)*(.14+uMetal*.7);
 color+=mix(vec3(.17,.29,.42),base,.4)*edge*(.12+uMetal*.58);
 if(uPattern>1.5&&uPattern<2.5){
   float angle=atan(vUv.y-.5,vUv.x-.5),radius=length(vUv-.5);
   float reflection=pow(abs(sin(angle+.72)),20.);
   color+=vec3(.30,.36,.40)*reflection*(.50+.22*sin(radius*1450.));
 }
 color+=base*uEmission;
 if(uEngine>=0.&&uActive>.5&&uActive<3.5&&abs(uEngine-(uActive-1.))>.2)color*=.045;
 float fog=1.-exp(-length(vView)*.006);
 color=mix(color,vec3(.016,.024,.037),fog);
 gl_FragColor=vec4(color,1.);
}`;
const atmosphereVertex = `
attribute vec3 position;
attribute vec3 seed;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uTime;
uniform float uKind;
uniform float uTravel;
varying float vAlpha;
varying float vKind;
void main(){
 vec3 p=position;vKind=uKind;
 if(uKind<3.5){p.z+=seed.z*uTravel*3.;vAlpha=.12+seed.x*.23+uTravel*.15;}
 else if(uKind<4.5){vAlpha=.1+.42*pow(.5+.5*sin(seed.x*26.-uTime*1.1),14.);}
 else{p.z+=seed.z*uTravel*6.;vAlpha=uTravel*.32;}
 vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
 gl_PointSize=clamp(16./max(2.,-mv.z),1.,3.);vAlpha*=smoothstep(0.,1.4,-mv.z);
}`;
const atmosphereFragment = `
precision highp float;
uniform vec3 uColor;
varying float vAlpha;
varying float vKind;
void main(){
 float a=vAlpha;if(vKind<3.5){float d=length(gl_PointCoord-.5);a*=exp(-d*d*15.);}
 gl_FragColor=vec4(uColor,a);
}`;
function randomFactory() { let seed = 817; return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
type V3 = [number, number, number];

/** The same objects and canvas survive all five camera cues and reverse navigation. */
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
    try { renderer = new Renderer({ dpr: 1, alpha: true, antialias: true, depth: true, preserveDrawingBuffer: true, webgl: 1 }); }
    catch { setFailed(true); return; }
    const gl = renderer.gl;
    if (!gl) { setFailed(true); return; }
    container.prepend(gl.canvas);
    gl.clearColor(.016, .024, .037, 1);
    const camera = new Camera(gl, { fov: 54, near: .1, far: 150 });
    const world = new Transform();
    const programs: Program[] = [], geometries: Geometry[] = [], textures: Texture[] = [];
    let disposed=false, dirty=true;
    const request=new AbortController();
    const cinematic=createEngineCinematic(gl,world,ENGINES.map(engine=>engine.at),()=>{dirty=true;});
    const rnd = randomFactory();
    const keep = <T extends Geometry>(geometry:T) => { geometries.push(geometry);return geometry; };
    const box=keep(new Box(gl)),sphere=keep(new Sphere(gl,{radius:1,widthSegments:40,heightSegments:28}));
    const cylinder=keep(new Cylinder(gl,{radiusTop:1,radiusBottom:1,height:1,radialSegments:96}));
    const white = new Texture(gl,{image:new Uint8Array([255,255,255,255]),width:1,height:1,generateMipmaps:false});textures.push(white);
    const material=(color:V3,engine:number,metal=.0,roughness=.4,emission=0,pattern=0,map=white)=>{
      const program=new Program(gl,{vertex:surfaceVertex,fragment:surfaceFragment,uniforms:{uColor:{value:color},uMetal:{value:metal},uRoughness:{value:roughness},uEmission:{value:emission},uPattern:{value:pattern},uEngine:{value:engine},uActive:{value:phaseRef.current},uTime:{value:0},uMap:{value:map},uTextured:{value:map===white?0:1},uReveal:{value:1}},depthTest:true,depthWrite:true,cullFace:gl.BACK});
      programs.push(program);return program;
    };
    const node=(parent:Transform,at:V3=[0,0,0],rotation:V3=[0,0,0])=>{const item=new Transform();item.position.set(...at);item.rotation.set(...rotation);item.setParent(parent);return item;};
    const solid=(parent:Transform,geometry:Geometry,program:Program,at:V3=[0,0,0],scale:V3=[1,1,1],rotation:V3=[0,0,0])=>{
      const mesh=new Mesh(gl,{geometry,program});mesh.position.set(...at);mesh.scale.set(...scale);mesh.rotation.set(...rotation);mesh.frustumCulled=false;mesh.setParent(parent);return mesh;
    };
    const torus=(radius:number,tube:number)=>keep(new Torus(gl,{radius,tube,radialSegments:10,tubularSegments:96}));
    const rod=(parent:Transform,program:Program,from:V3,to:V3,radius:number)=>{
      const a=new Vec3(...from),b=new Vec3(...to),delta=b.clone().sub(a),length=delta.len();
      const mesh=solid(parent,cylinder,program,[(from[0]+to[0])/2,(from[1]+to[1])/2,(from[2]+to[2])/2],[radius,length,radius]);
      const direction=delta.normalize(),axis=new Vec3(direction.z,0,-direction.x);
      if(axis.len()>.0001)mesh.quaternion.fromAxisAngle(axis.normalize(),Math.acos(Math.max(-1,Math.min(1,direction.y))));
      else if(direction.y<0)mesh.rotation.x=Math.PI;return mesh;
    };
    const plinths:Transform[]=[];
    const roots=ENGINES.map((engine,i)=>{
      const root=node(world,[...engine.at]),plinth=node(root);plinths.push(plinth);
      const base=material([.018,.025,.03],i,0,1),edge=material(engine.color.map(c=>c*.34) as V3,i,.1,.6,.02);
      solid(plinth,cylinder,base,[0,-1.93,0],[1.90,.11,1.30]);
      solid(plinth,cylinder,base,[0,-2.025,0],[1.7,.10,1.14]);
      solid(plinth,torus(1.87,.01),edge,[0,-1.868,0],[1,.696,1],[Math.PI/2,0,0]);
      // Four small machined datum marks make the plinth a real object at close range.
      for(let j=0;j<4;j++){const angle=j*Math.PI/2;solid(plinth,box,edge,[Math.cos(angle)*1.77,-1.86,Math.sin(angle)*1.18],[j%2?.04:.12,.008,j%2?.12:.04]);}
      return root;
    });

    // Voice: a designed condenser microphone, with physical grille ribs and suspension.
    const voice=node(roots[0],[.15,.05,.12],[.02,-.22,-.13]);
    const titanium=material([.55,.65,.73],0,.85,.24),graphite=material([.045,.065,.084],0,.72,.31);
    const silver=material([.79,.86,.92],0,.9,.2),blue=material([.17,.61,.9],0,.48,.23,.23);
    const grille=material([.26,.33,.38],0,.75,.43,0,1);
    solid(voice,cylinder,graphite,[0,-.55,0],[.58,1.14,.58]);
    solid(voice,cylinder,titanium,[0,-1.11,0],[.56,.06,.56]);
    solid(voice,cylinder,grille,[0,.64,0],[.62,1.28,.62]);
    solid(voice,sphere,grille,[0,1.27,0],[.62,.43,.62]);
    solid(voice,sphere,graphite,[0,-.96,0],[.57,.34,.57]);
    const grilleRib=torus(.632,.013);
    for(let j=0;j<20;j++)solid(voice,grilleRib,titanium,[0,.03+j*.065,0],[1,1,1],[Math.PI/2,0,0]);
    for(let j=0;j<3;j++)solid(voice,torus(.60-j*.12,.012),titanium,[0,1.40+j*.11,0],[1,1,1],[Math.PI/2,0,0]);
    // The vertical front rail, engraved face plate and two suspension rings are separate solids.
    solid(voice,box,silver,[0,.65,.629],[.105,1.40,.035]);
    solid(voice,box,titanium,[0,-.53,.587],[.19,.47,.02]);
    solid(voice,box,graphite,[0,-.54,.601],[.025,.24,.014]);
    solid(voice,sphere,blue,[0,-.34,.618],[.025,.025,.012]);
    const shock=torus(.90,.037);
    solid(voice,shock,titanium,[0,-.63,0],[1,1,1],[Math.PI/2,0,0]);
    solid(voice,shock,graphite,[0,-1.04,0],[1,1,1],[Math.PI/2,0,0]);
    for(let j=0;j<8;j++){
      const a=j*Math.PI/4,b=a+.42;
      rod(voice,graphite,[Math.cos(a)*.88,-.63,Math.sin(a)*.88],[Math.cos(b)*.60,-1.04,Math.sin(b)*.60],.014);
      rod(voice,titanium,[Math.cos(a)*.89,-.64,Math.sin(a)*.89],[Math.cos(a)*.89,-1.03,Math.sin(a)*.89],.022);
    }
    rod(voice,titanium,[0,-1.0,-.84],[0,-1.57,-.84],.09);
    rod(voice,graphite,[0,-1.57,-.84],[0,-1.72,.08],.10);
    solid(voice,cylinder,titanium,[0,-1.80,.08],[.38,.12,.38]);
    const voiceRelief=node(roots[0],[0,.05,-.78],[0,-.02,0]);
    for(let j=0;j<84;j++){
      const amplitude=voiceWaveform.peaks[Math.floor(j/84*voiceWaveform.peaks.length)];
      const x=(j/83-.5)*3.85,h=.12+amplitude*1.5;
      solid(voiceRelief,box,blue,[x,.1,Math.sin(j/83*Math.PI)*-.24],[.022,h,.065]);
    }

    // Assets: metadata selects an actual current image or mesh, keeping the stage reusable.
    const artifact=node(roots[1],[0,.1,0],[0,-.32,0]);
    const artifactStage=node(artifact);
    let artifactYaw=-.32;
    container.dataset.assetState='loading';
    const loadArtifact=async()=>{
      try{
        const metadata=await fetch('/engines/factory-assets/hero.json',{signal:request.signal}).then(r=>{if(!r.ok)throw new Error('Artifact metadata unavailable');return r.json();});
        if(disposed)return;
        container.dataset.assetKind=metadata.type==='image'?'image':'mesh';container.dataset.assetTexture=metadata.texture;
        cinematic.setAssetReference(metadata.reference||metadata.texture);
        const texture=new Texture(gl,{flipY:metadata.type==='image'||metadata.textureInfo?.flipY===true,generateMipmaps:false,minFilter:gl.LINEAR});textures.push(texture);
        const image=new Image();
        image.onload=()=>{if(disposed)return;texture.image=image;dirty=true;container.dataset.assetState='ready';container.dataset.assetTriangles=String(metadata.triangleCount||0);};
        image.onerror=()=>{if(!disposed)container.dataset.assetState='error';};
        const surface=material([1,1,1],1,0,.85,0,metadata.type==='image'?3:0,texture);surface.cullFace=false;
        if(metadata.type==='image'){
          plinths[1].visible=false;
          const aspect=metadata.aspect||1;
          surface.transparent=true;surface.depthWrite=false;surface.setBlendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
          const size=metadata.displaySize||4.2;
          const geometry=keep(new Plane(gl,{width:size,height:size/aspect,widthSegments:64,heightSegments:64}));
          const mesh=solid(artifactStage,geometry,surface);cinematic.registerArtifact(geometry,mesh,texture);
          artifactYaw=metadata.rotationY??-.36;
        }else{
          const data=await fetch(metadata.mesh,{signal:request.signal}).then(r=>{if(!r.ok)throw new Error('Artifact geometry unavailable');return r.arrayBuffer();});
          if(disposed)return;
          const attributes:Record<string,{size:number,data:Float32Array}>={};
          for(const key of ['position','normal','uv']){const attribute=metadata[key];attributes[key]={size:attribute.size|| (key==='uv'?2:3),data:new Float32Array(data,attribute.byteOffset,metadata.vertexCount*(key==='uv'?2:3))};}
          const geometry=keep(new Geometry(gl,attributes));
          artifactStage.rotation.x=metadata.suggestedRotationX||0;
          const min=metadata.bounds.min as V3,max=metadata.bounds.max as V3,scale=(metadata.displaySize||3.35)/Math.max(max[0]-min[0],max[1]-min[1],max[2]-min[2]);
          const mesh=solid(artifactStage,geometry,surface,[-(min[0]+max[0])*.5*scale,-(min[1]+max[1])*.5*scale,-(min[2]+max[2])*.5*scale],[scale,scale,scale]);
          cinematic.registerArtifact(geometry,mesh,texture);artifactYaw=metadata.rotationY??-.65;
        }
        image.src=metadata.texture;dirty=true;
      }catch(error){if(!disposed&&!(error instanceof DOMException&&error.name==='AbortError'))container.dataset.assetState='error';}
    };
    void loadArtifact();

    // Music: a suspended lacquer master with concentric grooves and the real track's relief.
    const record=node(roots[2],[.12,.02,.1],[.12,-.28,.13]);
    const lacquer=material([.043,.047,.056],2,.88,.22,0,2),brass=material([.72,.40,.15],2,.79,.28),paper=material([.72,.62,.44],2,.08,.78);
    solid(record,cylinder,lacquer,[0,0,0],[1.71,.12,1.71],[Math.PI/2,0,0]);
    solid(record,torus(1.707,.012),brass,[0,0,0]);
    solid(record,cylinder,paper,[0,0,.073],[.55,.021,.55],[Math.PI/2,0,0]);
    solid(record,torus(.55,.009),brass,[0,0,.089]);
    solid(record,cylinder,graphite,[0,0,.098],[.077,.028,.077],[Math.PI/2,0,0]);
    solid(record,torus(.092,.012),brass,[0,0,.111]);
    // Type is a designed record label, not a fabricated album cover or output screenshot.
    const labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=512;
    const labelContext=labelCanvas.getContext('2d');
    if(labelContext){
      labelContext.translate(256,256);labelContext.rotate(-Math.PI/2);labelContext.translate(-256,-256);
      labelContext.clearRect(0,0,512,512);labelContext.fillStyle='#c0a475';labelContext.fillRect(0,0,512,512);
      labelContext.textAlign='center';labelContext.fillStyle='#2a2823';labelContext.font='500 31px sans-serif';labelContext.fillText('J A V I S',256,130);
      labelContext.font='16px sans-serif';labelContext.fillText('LOCAL MUSIC',256,166);labelContext.fillText('AUDIO / 01',256,365);
      labelContext.strokeStyle='#5a4b36';labelContext.lineWidth=1.5;labelContext.beginPath();labelContext.moveTo(115,186);labelContext.lineTo(397,186);labelContext.stroke();
      const labelTexture=new Texture(gl,{image:labelCanvas,generateMipmaps:true});textures.push(labelTexture);
      // A round cap masks the square artwork in the shader-free mesh silhouette.
      const labelGeometry=keep(new Cylinder(gl,{radiusTop:.525,radiusBottom:.525,height:.005,radialSegments:96}));
      solid(record,labelGeometry,material([1,1,1],2,.02,.7,0,0,labelTexture),[0,0,.09],[1,1,1],[Math.PI/2,0,0]);
    }
    const musicRelief=node(record,[0,0,-.1]);
    for(let j=0;j<112;j++){
      const a=j/112*Math.PI*2,amplitude=musicWaveform.peaks[Math.floor(j/112*musicWaveform.peaks.length)],h=.065+amplitude*.33,r=1.84+h*.5;
      solid(musicRelief,box,brass,[Math.cos(a)*r,Math.sin(a)*r,0],[.022,h,.05],[0,0,a-Math.PI/2]);
    }
    // The back ring and three fasteners give the floating master an engineered support.
    solid(roots[2],torus(1.26,.024),brass,[.12,-.1,-.58],[1,1,1],[.12,-.28,.13]);
    for(let j=0;j<3;j++){
      const a=j*Math.PI*2/3+.3;
      solid(roots[2],sphere,brass,[.12+Math.cos(a)*1.23,-.1+Math.sin(a)*1.23,-.5],[.067,.067,.07]);
    }

    const addAtmosphere=(positions:number[],seeds:number[],kind:number,color:readonly number[],lines:boolean|'segments'=false)=>{
      const geometry=keep(new Geometry(gl,{position:{size:3,data:new Float32Array(positions)},seed:{size:3,data:new Float32Array(seeds)}}));
      const program=new Program(gl,{vertex:atmosphereVertex,fragment:atmosphereFragment,uniforms:{uTime:{value:0},uKind:{value:kind},uTravel:{value:0},uColor:{value:color}},transparent:true,depthTest:true,depthWrite:false});
      program.setBlendFunc(gl.SRC_ALPHA,gl.ONE);programs.push(program);
      const mesh=new Mesh(gl,{geometry,program,mode:lines==='segments'?gl.LINES:lines?gl.LINE_STRIP:gl.POINTS});mesh.frustumCulled=false;mesh.setParent(world);
    };
    const stars:number[]=[],starSeeds:number[]=[];
    for(let i=0;i<480;i++){stars.push(rnd()*65-22,rnd()*28-14,rnd()*80-45);starSeeds.push(rnd(),rnd(),rnd());}
    addAtmosphere(stars,starSeeds,3,[.35,.5,.67]);
    const streaks:number[]=[],streakSeeds:number[]=[];
    for(let i=0;i<340;i++){const x=rnd()*65-22,y=rnd()*28-14,z=rnd()*80-45;streaks.push(x,y,z,x,y,z);streakSeeds.push(rnd(),0,0,rnd(),0,1);}
    addAtmosphere(streaks,streakSeeds,5,[.4,.7,1],'segments');
    for(let strand=0;strand<8;strand++){
      const p:number[]=[],s:number[]=[];
      for(let i=0;i<280;i++){const x=i/279*55-15;p.push(x,Math.sin(x*.21+strand*.3)*.3-2.3,-x+(strand-4)*.16);s.push(i/279+strand*.031,0,0);}
      addAtmosphere(p,s,4,strand===7?[.67,.43,.20]:[.15,.32,.48],true);
    }

    let raf=0,last=0,elapsed=1,active=phaseRef.current,start=1,frames=0;
    let fromEye=new Vec3(...POSES[active].eye),fromLook=new Vec3(...POSES[active].look);
    let eye=fromEye.clone(),look=fromLook.clone();
    let paused=false;
    const reduce=matchMedia('(prefers-reduced-motion: reduce)');
    const deck=container.closest('[data-motion]');
    const update=()=>{const next=reduce.matches||deck?.getAttribute('data-motion')==='off';if(next&&!paused)start=elapsed-3.6;paused=next;dirty=true;};
    const observer=new MutationObserver(update);if(deck)observer.observe(deck,{attributes:true,attributeFilter:['data-motion']});
    reduce.addEventListener('change',update);update();
    const resize=()=>{const width=Math.min(1920,Math.max(960,container.getBoundingClientRect().width));renderer.setSize(width,width*9/16);cinematic.resize(width,width*9/16);gl.canvas.style.width='100%';gl.canvas.style.height='100%';camera.perspective({aspect:16/9});dirty=true;};
    resize();window.addEventListener('resize',resize);
    const onLost=(event:Event)=>{event.preventDefault();cancelAnimationFrame(raf);setFailed(true);};
    gl.canvas.addEventListener('webglcontextlost',onLost);
    gl.canvas.dataset.ready='true';gl.canvas.dataset.world='factory';
    const render=(stamp:number)=>{
      const dt=last?Math.min(.05,(stamp-last)/1000):0;last=stamp;
      if(!paused&&!document.hidden)elapsed+=dt;
      if(active!==phaseRef.current){active=phaseRef.current;start=paused?elapsed-3.6:elapsed;fromEye=eye.clone();fromLook=look.clone();dirty=true;}
      const cue=paused?3.6:Math.max(0,elapsed-start);
      const progress=paused?1:Math.min(1,cue/1.65);
      const ease=1-Math.pow(1-progress,3);
      const travel=Math.sin(progress*Math.PI);
      eye.copy(fromEye).lerp(new Vec3(...POSES[active].eye),ease);look.copy(fromLook).lerp(new Vec3(...POSES[active].look),ease);
      camera.position.copy(eye);camera.lookAt(look);camera.perspective({fov:54+travel*11,aspect:16/9});
      if((!paused&&!document.hidden)||dirty){
        programs.forEach(program=>{if(program.uniforms.uTime)program.uniforms.uTime.value=elapsed;if(program.uniforms.uTravel)program.uniforms.uTravel.value=travel;if(program.uniforms.uActive)program.uniforms.uActive.value=active;if(program.uniforms.uReveal){const t=Math.max(0,Math.min(1,(cue-.45)/1.95));program.uniforms.uReveal.value=active>0&&active<4&&program.uniforms.uEngine.value===active-1?t*t*(3-2*t):1;}});
        voice.position.y=.05+Math.sin(elapsed*.55)*.045;voice.rotation.y=-.22+Math.sin(elapsed*.23)*.09;
        artifact.position.y=.1+Math.sin(elapsed*.45+.8)*.045;artifact.rotation.y=artifactYaw+Math.sin(elapsed*.22)*.12;
        record.position.y=.02+Math.sin(elapsed*.5+1.2)*.045;record.rotation.y=-.28+Math.sin(elapsed*.24)*.12;
        const settle=Math.max(0,Math.min(1,cue/3.4));
        if(active===1){voice.rotation.z=-.13-(1-settle)*.2;voiceRelief.scale.x=.2+.8*Math.min(1,cue/1.65);}
        else{voice.rotation.z=-.13;voiceRelief.scale.x=1;}
        record.rotation.z=active===3?.13-(1-settle)*.65:.13;
        cinematic.tick(active,cue,elapsed,travel);cinematic.render(camera);
        container.dataset.revealState=cue<3.4&&active>0&&active<4?'transforming':'settled';
        gl.canvas.dataset.frames=String(++frames);gl.canvas.dataset.phase=String(active);gl.canvas.dataset.camera=eye.map(value=>value.toFixed(3)).join(',');
        container.style.setProperty('--travel',String(travel));container.dataset.moving=progress<1?'true':'false';
        ENGINES.forEach((engine,i)=>{
          const label=labels.current[i];if(!label)return;
          const point=new Vec3(engine.at[0],engine.at[1]-2.5,engine.at[2]);camera.project(point);
          const overview=active===0||active===4;
          label.style.transform=`translate(${(point.x*.5+.5)*1920}px,${(-point.y*.5+.5)*1080}px) translate(-50%,0)`;label.style.opacity=String(overview?Math.max(0,1-travel*2):0);
        });
        dirty=false;
      }
      raf=requestAnimationFrame(render);
    };
    raf=requestAnimationFrame(render);
    return()=>{
      disposed=true;request.abort();cancelAnimationFrame(raf);cinematic.dispose();observer.disconnect();reduce.removeEventListener('change',update);window.removeEventListener('resize',resize);
      gl.canvas.removeEventListener('webglcontextlost',onLost);geometries.forEach(geometry=>geometry.remove());programs.forEach(program=>program.remove());textures.forEach(texture=>gl.deleteTexture(texture.texture));gl.canvas.remove();gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);

  return <div className="engine-world" ref={host} data-fallback={failed||undefined} aria-hidden="true">
    {ENGINES.map((engine,i)=><div className="engine-world-label" key={engine.name} ref={el=>{labels.current[i]=el}}><strong>{engine.name}</strong><span>{engine.detail}</span></div>)}
    <div className="engine-flight-glow" />
    {failed&&<div className="engine-fallback">TTS / ASSETS / MUSIC</div>}
  </div>;
}
