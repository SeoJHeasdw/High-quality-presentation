import { Geometry, Mesh, Plane, Post, Program, Texture, Transform } from "ogl";
import type { Camera, OGLRenderingContext } from "ogl";

type Triple=[number,number,number];
const ease=(a:number,b:number,t:number)=>{const x=Math.max(0,Math.min(1,(t-a)/(b-a)));return x*x*(3-2*x);};
const paperVertex=`
attribute vec3 position;attribute vec2 uv;
uniform mat4 modelViewMatrix;uniform mat4 projectionMatrix;uniform float uBend;
varying vec2 vUv;varying float vDepth;
void main(){vec3 p=position;p.z+=sin(uv.y*3.14159)*uBend+(uv.x-.5)*(uv.x-.5)*uBend;vec4 view=modelViewMatrix*vec4(p,1.);vDepth=-view.z;vUv=uv;gl_Position=projectionMatrix*view;}`;
const paperFragment=`
precision highp float;uniform sampler2D uMap;uniform float uAlpha;uniform vec3 uColor;
varying vec2 vUv;varying float vDepth;
void main(){float blur=clamp(abs(vDepth-7.)*.00065,0.,.018);vec3 c=texture2D(uMap,vUv).rgb;
 c+=texture2D(uMap,vUv+vec2(blur,0.)).rgb+texture2D(uMap,vUv-vec2(blur,0.)).rgb+texture2D(uMap,vUv+vec2(0.,blur)).rgb+texture2D(uMap,vUv-vec2(0.,blur)).rgb;
 float edge=smoothstep(0.,.012,min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y)));
 gl_FragColor=vec4(c*.115*uColor,uAlpha*edge*smoothstep(.7,2.,vDepth));}`;
const signalVertex=`
attribute vec3 position;attribute vec3 seed;uniform mat4 modelViewMatrix;uniform mat4 projectionMatrix;
uniform float uCue;uniform float uOpacity;uniform float uMode;uniform float uTime;
varying float vAlpha;varying float vWarm;
void main(){vec3 p=position;float size=1.;vWarm=seed.z;vAlpha=uOpacity;
 if(uMode<.5){
   float head=clamp(uCue/2.95,0.,1.);float t=max(0.,head-position.x*.27);float angle=t*7.6-2.1;
   p=vec3(sin(angle)*(3.8-1.65*t),-1.6+3.2*t+sin(t*6.28)*.35,cos(angle)*(2.1-1.1*t));
   vAlpha*=pow(1.-position.x,1.8);size=(1.-position.x)*16.+2.;vWarm=.35+.65*t;
 }else{size=3.5+seed.x*6.;vAlpha*=.5+.5*sin(uTime*.6+seed.y*9.);}
 vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(size*9./max(1.,-mv.z),1.,36.);
 vAlpha*=smoothstep(.4,1.7,-mv.z);}`;
const signalFragment=`
precision highp float;uniform vec3 uColor;varying float vAlpha;varying float vWarm;
void main(){float d=length(gl_PointCoord-.5);float halo=exp(-d*d*14.);float core=exp(-d*d*90.);vec3 c=mix(uColor,vec3(1.,.68,.26),vWarm*.5);gl_FragColor=vec4(c*(.8+core*1.6)+vec3(1.,.84,.53)*core*.9,vAlpha*halo);}`;
const traceVertex=`
attribute vec3 position;uniform mat4 modelViewMatrix;uniform mat4 projectionMatrix;uniform float uOpacity;varying float vAlpha;
void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;vAlpha=uOpacity*smoothstep(.5,2.,-mv.z);}`;
const traceFragment=`precision highp float;uniform vec3 uColor;varying float vAlpha;void main(){gl_FragColor=vec4(uColor,vAlpha);}`;
const assembleVertex=`
attribute vec3 position;attribute vec3 seed;attribute vec2 uv;uniform mat4 modelViewMatrix;uniform mat4 projectionMatrix;uniform float uCue;varying float vAlpha;varying vec2 vUv;
void main(){vUv=uv;float build=smoothstep(.65,2.05,uCue);vec3 p=position;p+=(seed-.5)*(1.-build)*2.7;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
 gl_PointSize=clamp((2.1+seed.x*2.)*10./max(1.,-mv.z),1.,12.);vAlpha=smoothstep(.2,.75,uCue)*(1.-smoothstep(1.7,2.55,uCue));}`;
const assembleFragment=`precision highp float;uniform sampler2D uMap;uniform float uTextured;varying float vAlpha;varying vec2 vUv;void main(){float d=length(gl_PointCoord-.5);vec3 c=mix(vec3(.57,.81,1.),texture2D(uMap,vUv).rgb,uTextured);float brightness=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*1.5,vAlpha*exp(-d*d*15.)*smoothstep(.04,.18,brightness));}`;

/** A finite, presenter-triggered arrival. It never changes the slide or starts media. */
export function createEngineCinematic(gl:OGLRenderingContext,world:Transform,positions:readonly (readonly number[])[],onDirty:()=>void){
 const geometries:Geometry[]=[],programs:Program[]=[],textures:Texture[]=[];
 const keep=<T extends Geometry>(g:T)=>{geometries.push(g);return g;};
 const program=(vertex:string,fragment:string,uniforms:Record<string,any>,additive=false)=>{
   const p=new Program(gl,{vertex,fragment,uniforms,transparent:true,depthTest:true,depthWrite:false,cullFace:false});
   if(additive)p.setBlendFunc(gl.SRC_ALPHA,gl.ONE);programs.push(p);return p;
 };
 let disposed=false;
 const paperGeometry=keep(new Plane(gl,{width:1,height:1.38,widthSegments:8,heightSegments:10}));
 const makePaper=(kind:number)=>{
   const canvas=document.createElement('canvas');canvas.width=512;canvas.height=708;const ctx=canvas.getContext('2d')!;
   ctx.fillStyle=kind===2?'#dfc691':'#dadfe1';ctx.fillRect(0,0,512,708);
   ctx.fillStyle='#38424a';ctx.font='500 26px sans-serif';ctx.fillText(kind===0?'VOICE / SCRIPT':'MUSIC / DRAFT',48,80);
   ctx.fillStyle=kind===2?'#977548':'#7f919e';ctx.fillRect(48,112,416,2);
   for(let row=0;row<20;row++){const width=190+((row*83+kind*57)%220);ctx.globalAlpha=row%5===4?.3:.65;ctx.fillRect(48,153+row*23,width,row%5===0?6:3);}
   ctx.globalAlpha=1;ctx.fillStyle='#647b8b';ctx.font='16px sans-serif';ctx.fillText(kind===0?'JAVIS · VOICE':'JAVIS · SOUND',48,660);
   const texture=new Texture(gl,{image:canvas,generateMipmaps:false,minFilter:gl.LINEAR});textures.push(texture);return texture;
 };
 const chestTexture=new Texture(gl,{image:new Uint8Array([218,224,229,255]),width:1,height:1,generateMipmaps:false});textures.push(chestTexture);
 const setAssetReference=(url:string)=>{const image=new Image();image.onload=()=>{if(!disposed){chestTexture.image=image;chestTexture.width=image.width;chestTexture.height=image.height;onDirty();}};image.src=url;};
 const maps=[makePaper(0),chestTexture,makePaper(2)];
 const cards:{mesh:Mesh;program:Program;at:Triple;spin:Triple;offset:number;kind:number}[]=[];
 const groups=positions.map((position,kind)=>{
   const group=new Transform();group.position.set(position[0],position[1],position[2]);group.setParent(world);
   for(let i=0;i<11;i++){
     const p=program(paperVertex,paperFragment,{uMap:{value:maps[kind]},uAlpha:{value:0},uBend:{value:.15},uColor:{value:kind===1?[.9,.94,1.]:[.82,.88,.91]}});
     const mesh=new Mesh(gl,{geometry:paperGeometry,program:p});mesh.frustumCulled=false;mesh.setParent(group);
     const angle=i*2.399;cards.push({mesh,program:p,at:[Math.sin(angle)*(2.2+(i%3)*.7),Math.cos(angle)*1.8,2.0+(i%4)*1.65],spin:[Math.sin(i*2)*.4,Math.cos(i*3)*.65,Math.sin(i*4)*.4],offset:i*.04,kind});
   }
   return group;
 });
 const leaders=groups.map(group=>{
   const p:number[]=[],s:number[]=[];for(let i=0;i<260;i++){p.push(i/259,0,0);s.push(0,0,0);}
   const geometry=keep(new Geometry(gl,{position:{size:3,data:new Float32Array(p)},seed:{size:3,data:new Float32Array(s)}}));
   const material=program(signalVertex,signalFragment,{uCue:{value:0},uOpacity:{value:0},uMode:{value:0},uTime:{value:0},uColor:{value:[.21,.83,1.]}},true);
   const mesh=new Mesh(gl,{geometry,program:material,mode:gl.POINTS});mesh.frustumCulled=false;mesh.setParent(group);return material;
 });
 const networks=groups.map((group,kind)=>{
   const points:number[]=[],seeds:number[]=[],lines:number[]=[];
   for(let i=0;i<64;i++){const a=i*2.399,r=.75+2.7*Math.sqrt((i*17%67)/67);points.push(Math.cos(a)*r,Math.sin(a)*r*.74,-1.8-(i%5)*.62);seeds.push((i*17%61)/61,i/64,(i%4)/4);}
   for(let i=0;i<64;i++)for(let j=i+1;j<64;j++){const a=points.slice(i*3,i*3+3),b=points.slice(j*3,j*3+3);if(Math.hypot(...a.map((v,k)=>v-b[k]) as Triple)<1.7)lines.push(...a,...b);}
   const color=kind===2?[.65,.40,.16]:[.13,.45,.6];
   const pointProgram=program(signalVertex,signalFragment,{uCue:{value:0},uOpacity:{value:.2},uMode:{value:1},uTime:{value:0},uColor:{value:color}},true);
   const pointGeometry=keep(new Geometry(gl,{position:{size:3,data:new Float32Array(points)},seed:{size:3,data:new Float32Array(seeds)}}));
   const pointMesh=new Mesh(gl,{geometry:pointGeometry,program:pointProgram,mode:gl.POINTS});pointMesh.frustumCulled=false;pointMesh.setParent(group);
   const lineProgram=program(traceVertex,traceFragment,{uOpacity:{value:.09},uColor:{value:color}},true);
   const lineGeometry=keep(new Geometry(gl,{position:{size:3,data:new Float32Array(lines)}}));const lineMesh=new Mesh(gl,{geometry:lineGeometry,program:lineProgram,mode:gl.LINES});lineMesh.frustumCulled=false;lineMesh.setParent(group);
   return {pointProgram,lineProgram};
 });
 let assembly:Program|undefined;
 const registerArtifact=(geometry:Geometry,parent:Transform,map:Texture)=>{
   const input=geometry.attributes.position.data as Float32Array,inputUv=geometry.attributes.uv.data as Float32Array,sample:number[]=[],seed:number[]=[],uv:number[]=[];
   for(let i=0;i<input.length;i+=Math.max(3,Math.floor(input.length/7000/3)*3)){sample.push(input[i],input[i+1],input[i+2]);const k=i/3;uv.push(inputUv[k*2],inputUv[k*2+1]);seed.push((k*17%991)/991,(k*31%977)/977,(k*67%983)/983);}
   const shape=keep(new Geometry(gl,{position:{size:3,data:new Float32Array(sample)},seed:{size:3,data:new Float32Array(seed)},uv:{size:2,data:new Float32Array(uv)}}));
   assembly=program(assembleVertex,assembleFragment,{uCue:{value:4},uMap:{value:map},uTextured:{value:1}},true);
   const mesh=new Mesh(gl,{geometry:shape,program:assembly,mode:gl.POINTS});mesh.frustumCulled=false;mesh.setParent(parent);
 };
 const post=new Post(gl,{depth:true});
 const blur=post.addPass({fragment:`
 precision highp float;uniform sampler2D tMap;uniform vec2 uPixel;varying vec2 vUv;
 vec3 bright(vec2 p){vec3 c=texture2D(tMap,p).rgb;return max(c-vec3(.45),vec3(0.));}
 void main(){vec3 bloom=vec3(0.);for(int i=-6;i<=6;i++){float x=float(i);float w=exp(-x*x/14.);bloom+=bright(vUv+vec2(x*2.7*uPixel.x,0.))*w;}gl_FragColor=vec4(bloom/6.5,1.);}`,uniforms:{uPixel:{value:[1/1920,1/1080]}}});
 const composite=post.addPass({fragment:`
 precision highp float;uniform sampler2D tMap;uniform sampler2D uScene;uniform vec2 uPixel;uniform float uTravel;varying vec2 vUv;
 void main(){vec3 bloom=vec3(0.);for(int i=-6;i<=6;i++){float y=float(i);bloom+=texture2D(tMap,vUv+vec2(0.,y*2.7*uPixel.y)).rgb*exp(-y*y/14.);}bloom/=6.5;
 vec2 fromCenter=vUv-vec2(.68,.5);vec3 source=texture2D(uScene,vUv).rgb;
 float motion=uTravel*.0012;source.r=texture2D(uScene,vUv+fromCenter*motion).r;source.b=texture2D(uScene,vUv-fromCenter*motion).b;
 vec3 color=source+bloom*(1.45+uTravel*.9);color*=1.-smoothstep(.25,.85,length((vUv-.5)*vec2(1.,.8)))*.18;
 gl_FragColor=vec4(color,1.);}`,uniforms:{uScene:{value:null},uPixel:{value:[1/1920,1/1080]},uTravel:{value:0}}});
 const resize=(width:number,height:number)=>{post.resize({width,height});blur.uniforms.uPixel.value=[1/width,1/height];composite.uniforms.uPixel.value=[1/width,1/height];};
 const tick=(phase:number,cue:number,time:number,travel:number)=>{
   const active=phase-1,overview=phase===0||phase===4;
   for(const card of cards){
     const t=cue-card.offset,p=ease(0,2.25,t),k=1-p;
     card.program.uniforms.uAlpha.value=card.kind===active&&!overview?(1-ease(1.05,2.1,t))*.94:0;
     card.program.uniforms.uBend.value=.18+Math.sin(t*2+card.offset)*.12;
     card.mesh.position.set(card.at[0]*k+Math.sin(p*Math.PI)*.45,card.at[1]*k,card.at[2]*k-.45*p);
     card.mesh.rotation.set(card.spin[0]*(1+p),card.spin[1]+p*.45,card.spin[2]+p*.7);
     const scale=.88-.4*p;card.mesh.scale.set(scale,scale,scale);
   }
   leaders.forEach((p,i)=>{p.uniforms.uCue.value=cue;p.uniforms.uTime.value=time;p.uniforms.uOpacity.value=i===active&&!overview?(1-ease(2.55,3.45,cue))*.95:0;});
   networks.forEach(({pointProgram,lineProgram},i)=>{
     const strength=overview?.34:i===active?.28+.55*(1-ease(2.2,3.4,cue)):.04;
     pointProgram.uniforms.uOpacity.value=strength;pointProgram.uniforms.uTime.value=time;lineProgram.uniforms.uOpacity.value=strength*.27;
   });
   if(assembly)assembly.uniforms.uCue.value=phase===2?cue:4;
   composite.uniforms.uTravel.value=travel;
 };
 const render=(camera:Camera)=>post.render({scene:world,camera,beforePostCallbacks:[()=>{composite.uniforms.uScene.value=post.fbo.read.texture;}]});
 const dispose=()=>{
   disposed=true;geometries.forEach(g=>g.remove());programs.forEach(p=>p.remove());textures.forEach(t=>gl.deleteTexture(t.texture));
   post.passes.forEach(pass=>pass.program.remove());post.geometry.remove();
   for(const target of [post.fbo.read,post.fbo.write]){target.textures.forEach(t=>gl.deleteTexture(t.texture));gl.deleteFramebuffer(target.buffer);if(target.depthBuffer)gl.deleteRenderbuffer(target.depthBuffer);}
 };
 return {tick,render,resize,dispose,registerArtifact,setAssetReference};
}
