import { useEffect, useRef, useState } from "react";

export type FieldScene = "horizon" | "uncertain" | "one" | "core" | "signal";
const MODES: Record<FieldScene, number> = { horizon: 0, uncertain: 1, one: 2, core: 3, signal: 4 };

const vertex = `
attribute vec2 position;
varying vec2 uv;
void main() { uv = position * .5 + .5; gl_Position = vec4(position, 0., 1.); }
`;

const fragment = `
precision highp float;
varying vec2 uv;
uniform float time;
uniform float mode;
uniform float beat;
uniform vec2 pointer;
const float PI = 3.14159265;
float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
mat2 rot(float a) { return mat2(cos(a),-sin(a),sin(a),cos(a)); }
float line(float d, float w) { return w / (abs(d) + w); }
vec3 ice = vec3(.35,.7,1.);
vec3 gold = vec3(1.,.7,.35);
void main() {
  vec2 p = (uv-.5)*vec2(1.77778,1.);
  p += pointer*.009;
  vec3 col = vec3(.012,.018,.028);
  vec2 st = uv*vec2(400.,225.);
  vec2 cell=floor(st);
  float star=pow(max(0.,1.-length(fract(st)-.5)*2.),12.)*step(.996,hash(cell));
  col += star*.22;
  if(mode < .5) {
    vec2 q=p-vec2(.33,-.015);
    q=rot(-.30)*q;
    vec2 e=q*vec2(.85,2.65);
    float r=length(e);
    float a=atan(e.y,e.x);
    float bend=.013*sin(a*3.+time*.16)+.006*sin(a*8.-time*.12);
    float disk=exp(-abs(r-.345-bend)*13.);
    float bands=pow(.5+.5*sin(r*470.+a*3.-time*.65),11.);
    float hot=exp(-abs(r-.325-bend)*180.);
    vec3 color=mix(ice,gold,smoothstep(-.4,.4,q.x));
    col+=color*(disk*bands*.6+hot*.8);
    col+=color*exp(-abs(r-.33)*9.)*.12;
    float orb=length((p-vec2(.33,-.015))*vec2(1.,1.04));
    float rim=exp(-abs(orb-.219)*200.);
    float shadow=1.-smoothstep(.204,.218,orb);
    col=mix(col,vec3(.008,.012,.019),shadow);
    col+=mix(ice,gold,smoothstep(-.1,.3,p.x-.33))*rim*.65;
    float lens=exp(-abs(q.y)*150.)*exp(-abs(q.x)*2.5);
    col+=vec3(.35,.56,.75)*lens*.32;
  } else if(mode < 1.5) {
    vec2 q=p-vec2(-.69,0.);
    float spread=pow(max(q.x,0.),1.55);
    for(int i=0;i<38;i++) {
      float f=float(i)/37.;
      float y=(f-.5)*spread*.95 + sin(q.x*3.3+f*8.+time*.13)*spread*.13;
      float d=q.y-y;
      float traveling=pow(.5+.5*sin(q.x*7.-time*.55+f*13.),10.);
      vec3 tint=mix(ice,gold,step(.91,f));
      col+=tint*line(d,.00052)*(.19+traveling*.65)*smoothstep(0.,.3,q.x);
    }
    col+=ice*exp(-length(q)*42.)*.8;
  } else if(mode < 2.5) {
    vec2 q=p-vec2(.28,-.005);
    float r=length(q);
    vec2 grid=q*vec2(98.,98.);
    vec2 id=floor(grid);
    float dots=exp(-length(fract(grid)-.5)*13.);
    float wave=.5+.5*sin(length(id)*.38-time*.5);
    float hole=smoothstep(.23,.30,r);
    col+=mix(ice,vec3(.9,.82,.55),wave)*dots*hole*(.17+wave*.6);
    float ring=exp(-abs(r-.265)*450.);
    col+=gold*ring*.85;
    col+=gold*exp(-abs(r-.265)*25.)*.075;
    float pulse=exp(-abs(r-(.28+mod(time*.028,.5)))*140.);
    col+=ice*pulse*.07*hole;
  } else if(mode < 3.5) {
    vec2 q=p-vec2(.36,-.02);
    float r=length(q);
    float radius=.285;
    if(r<radius) {
      vec3 n=vec3(q/radius,sqrt(max(0.,1.-r*r/(radius*radius))));
      n.xz=rot(time*.09)*n.xz;
      n.yz=rot(.28)*n.yz;
      float lon=atan(n.z,n.x);
      float lat=asin(n.y);
      float mesh=pow(.5+.5*cos(lon*54.),32.)*pow(.5+.5*cos(lat*54.),32.);
      float threads=pow(.5+.5*sin(lat*95.+lon*3.+time*.23),24.);
      float fresnel=pow(1.-sqrt(max(0.,1.-r*r/(radius*radius))),2.);
      col+=ice*(mesh*.9+threads*.12+fresnel*.24);
      col+=vec3(.6,.9,1.)*exp(-abs(r-radius)*230.)*.8;
    }
    for(int i=0;i<3;i++) {
      float f=float(i);
      vec2 orbit=rot(.4+f*.89+time*.013*(f-1.))*q;
      float ellipse=length(orbit*vec2(.72,1.85));
      float a=atan(orbit.y*1.85,orbit.x*.72);
      float light=pow(.5+.5*sin(a-time*.22+f*2.),12.);
      col+=mix(ice,gold,step(1.5,f))*line(ellipse-.305,.00075)*(.18+light*.65);
    }
    col+=ice*exp(-r*5.)*.05;
  } else {
    vec2 q=p-vec2(.12,-.14);
    q=rot(-.2)*q;
    float r=length(q*vec2(.8,1.25));
    float a=atan(q.y,q.x);
    for(int i=0;i<16;i++) {
      float f=float(i);
      float radius=.035+f*.053;
      float ripple=.006*sin(a*4.-time*.2+f*.6);
      float wave=pow(.5+.5*sin(f*.6-time*.6),6.);
      col+=mix(gold,ice,f/20.)*line(r-radius-ripple,.0009)*(.14+wave*.4);
    }
    col+=gold*exp(-r*170.)*3.;
    col+=gold*exp(-r*10.)*.11;
  }
  float edge=1.-smoothstep(.48,1.14,length(p*vec2(.72,1.)));
  col*=.5+.5*edge;
  col += (hash(gl_FragCoord.xy)-.5)*.013;
  gl_FragColor=vec4(col,1.);
}
`;

/** One canvas, bounded resolution, no assets or network requests. */
export default function CinematicField({ scene, step = 0 }: { scene: FieldScene; step?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const beatRef = useRef(step);
  beatRef.current = step;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    setFailed(false);
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power", preserveDrawingBuffer: true });
    if (!gl) { setFailed(true); return; }
    let raf = 0, elapsed = 4, last = 0, disposed = false, dirty = true;
    const shaders: WebGLShader[] = [];
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const deck = canvas.closest("[data-motion]");
    let paused = reduced.matches || deck?.getAttribute("data-motion") === "off";
    const updatePause = () => { paused = reduced.matches || deck?.getAttribute("data-motion") === "off"; };
    const observer = new MutationObserver(updatePause);
    if (deck) observer.observe(deck, { attributes: true, attributeFilter: ["data-motion"] });
    reduced.addEventListener("change", updatePause);
    const move = (event: PointerEvent) => { mouse.tx = event.clientX / innerWidth - .5; mouse.ty = .5 - event.clientY / innerHeight; };
    const lost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(raf); setFailed(true); };
    const resize = () => {
      const width = Math.min(1600, Math.max(960, Math.round(canvas.getBoundingClientRect().width)));
      canvas.width = width; canvas.height = Math.round(width * 9 / 16);
      gl.viewport(0, 0, canvas.width, canvas.height);
      dirty = true;
    };
    try {
      program = gl.createProgram();
      for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
        const shader = gl.createShader(type)!;
        shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "Shader failed");
        gl.attachShader(program!, shader);
      }
      gl.linkProgram(program!);
      if (!gl.getProgramParameter(program!, gl.LINK_STATUS)) throw new Error("WebGL link failed");
      gl.useProgram(program);
      buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
      const attr = gl.getAttribLocation(program!, "position");
      gl.enableVertexAttribArray(attr); gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);
      const uTime = gl.getUniformLocation(program!, "time"), uBeat = gl.getUniformLocation(program!, "beat");
      const uPointer = gl.getUniformLocation(program!, "pointer");
      gl.uniform1f(gl.getUniformLocation(program!, "mode"), MODES[scene]);
      resize();
      let frames = 0;
      const render = (stamp: number) => {
        if (disposed) return;
        const delta = last ? Math.min((stamp-last)/1000, .05) : 0;
        last = stamp;
        if (!document.hidden) {
          if (!paused) { elapsed += delta; mouse.x+=(mouse.tx-mouse.x)*.025; mouse.y+=(mouse.ty-mouse.y)*.025; }
          if (!paused || dirty || frames === 0) {
            gl.uniform1f(uTime, elapsed); gl.uniform1f(uBeat, beatRef.current);
            gl.uniform2f(uPointer, mouse.x, mouse.y);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            canvas.dataset.frames = String(++frames);
            dirty = false;
          }
        }
        raf = requestAnimationFrame(render);
      };
      raf = requestAnimationFrame(render);
      canvas.dataset.ready = "true";
      window.addEventListener("pointermove", move);
      window.addEventListener("resize", resize);
      canvas.addEventListener("webglcontextlost", lost);
    } catch (error) {
      console.warn("[keynote] WebGL fallback", error);
      setFailed(true);
    }
    return () => {
      disposed = true; cancelAnimationFrame(raf); observer.disconnect();
      reduced.removeEventListener("change", updatePause);
      window.removeEventListener("pointermove", move); window.removeEventListener("resize", resize);
      canvas.removeEventListener("webglcontextlost", lost);
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      shaders.forEach(shader => gl.deleteShader(shader));
      // StrictMode replays effects on the same connected canvas. Release only
      // a canvas that actually left the document, after React commits removal.
      setTimeout(() => {
        if (!canvas.isConnected) gl.getExtension("WEBGL_lose_context")?.loseContext();
      }, 0);
    };
  }, [scene]);

  return <div className={`kn-field kn-field--${scene}`} data-fallback={failed || undefined} aria-hidden="true">
    <div className="kn-field__fallback" />
    <canvas ref={ref} style={{ opacity: failed ? 0 : 1 }} />
  </div>;
}
