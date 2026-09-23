import { useEffect, useRef, useState } from "react";
import { Frame } from "./KeynoteFrame";
import { usePerformanceMotion } from "./usePerformanceMotion";
import LectureWave from "./opening/LectureWave";
import type { OpeningWorld } from "./opening/world";
import "./opening/opening.css";

/*
 * 2~3번은 하나의 공간이다(묶음 cat-opening). 발표자가 누를 때마다 네 개의 큐를 지난다.
 *   0 사진 한 장  1 화소가 단어가 된다  2 지금의 요청  3 실제 강의 영상
 * 3D 공간은 opening/world.ts, 글과 영상은 여기의 DOM이 맡는다.
 */
const REQUEST = "내 목소리로 강의 영상 만들어줘.";
const HEAD: [string, string][] = [
  ["10여 년 전", "이게 뭐야?"],
  ["기계가 돌려준 답", "사진에서 이름을 알아내는 일"],
  ["지금", ""],
  ["지금", ""],
];

export default function CatScene({ now = false, step = 0 }: { now?: boolean; step?: number }) {
  const cue = now ? 2 + step : step;
  const motion = usePerformanceMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const autoStart = useRef<number | null>(null);
  const world = useRef<OpeningWorld | null>(null);
  const cueRef = useRef(cue); cueRef.current = cue;
  const motionRef = useRef(motion); motionRef.current = motion;
  const [failed, setFailed] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [typed, setTyped] = useState(cue >= 2 ? REQUEST.length : 0);
  const prevCue = useRef(cue);

  useEffect(() => {
    let cancelled = false, w: OpeningWorld | null = null;
    const canvas = canvasRef.current!;
    const lost = () => setFailed(true);
    const move = (e: PointerEvent) => w?.setPointer(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1);
    const image = new Image(); image.src = "/shots/cat1@2x.jpg";
    const font = '800 300px "Pretendard Variable"';
    Promise.all([import("./opening/world"), image.decode(), document.fonts.load(font)]).then(([mod]) => {
      if (cancelled) return;
      try { w = mod.createOpeningWorld(canvas, { image, glyph: mod.sampleGlyph("고양이", 9000, font) }, cueRef.current, motionRef.current); }
      catch { setFailed(true); return; }
      world.current = w;
      canvas.addEventListener("opening-lost", lost);
      addEventListener("pointermove", move);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; removeEventListener("pointermove", move); canvas.removeEventListener("opening-lost", lost); w?.dispose(); world.current = null; };
  }, []);
  useEffect(() => { world.current?.setPhase(cue); }, [cue]);
  useEffect(() => { world.current?.setMotion(motion); }, [motion]);

  // 요청 문장은 앞으로 넘겨 들어왔을 때만 한 글자씩 적는다.
  useEffect(() => {
    const forward = cue === 2 && prevCue.current === 1;
    prevCue.current = cue;
    if (cue < 2) { setTyped(0); return; }
    if (!forward || !motion) { setTyped(REQUEST.length); return; }
    setTyped(0);
    let i = 0;
    const id = window.setInterval(() => { i += 1; setTyped(i); if (i >= REQUEST.length) window.clearInterval(id); }, 55);
    return () => window.clearInterval(id);
  }, [cue, motion]);

  // 결과가 열리면 실제 강의의 목소리를 한 번 들려준다. 모션을 끄면 첫 화면에 멈춘다.
  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    if (cue === 3 && motion) {
      v.currentTime = 0;
      autoStart.current = window.setTimeout(() => { autoStart.current = null; void v.play().catch(() => { if (v.paused) setAudioBlocked(true); }); }, 2400);
      return () => { if (autoStart.current !== null) window.clearTimeout(autoStart.current); autoStart.current = null; };
    }
    v.pause(); if (cue < 3) v.currentTime = 0;
  }, [cue, motion]);
  useEffect(() => {
    if (cue !== 3) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const v = videoRef.current; if (!v) return;
      if (e.key.toLowerCase() === "p") { e.preventDefault(); if (autoStart.current !== null) { window.clearTimeout(autoStart.current); autoStart.current = null; } if (v.paused) { if (v.ended) v.currentTime = 0; void v.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true)); } else v.pause(); }
      if (e.key.toLowerCase() === "a") { e.preventDefault(); v.muted = !v.muted; setMuted(v.muted); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cue]);
  useEffect(() => () => videoRef.current?.pause(), []);

  const [kicker, title] = HEAD[cue];
  return <Frame n={now ? 3 : 2} name={now ? "지금 만드는 강의" : "조금 전의 과거"} step={step} className="cat-presentation opening">
    <div className="op" data-cue={cue} data-fallback={failed || undefined} aria-hidden="true">
      <canvas ref={canvasRef} className="op-canvas" width={1920} height={1080}/>
      <div className="op-shade"/>
      <figure className="op-fallback-photo"><img src="/shots/cat1@2x.jpg" alt=""/></figure>
      <span className="op-fallback-word">고양이</span>
    </div>

    <div className="op-heading" key={`h${cue}`} data-cue={cue}>
      <p>{kicker}</p>
      {title && <h1>{title}</h1>}
    </div>

    <div className="op-readout" data-on={cue === 1 || undefined}>
      <span><small>입력</small>사진 한 장</span><i/><span><small>출력</small><b>단어 하나</b></span>
    </div>

    <div className="op-request" data-cue={cue} data-on={cue >= 2 || undefined}>
      <div className="op-prompt">
        <span className="op-prompt__dot" aria-hidden="true"/>
        <p aria-label={REQUEST}><span>{REQUEST.slice(0, typed)}</span><i className="op-caret" data-done={typed >= REQUEST.length || undefined}/></p>
        <span className="op-prompt__send" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg></span>
      </div>
      <div className="op-attach"><small>내가 준비한 것</small>
        <span className="op-chip"><i className="op-chip__doc"/>대본</span>
        <span className="op-chip"><i className="op-chip__slide"/>장표</span>
      </div>
    </div>

    <div className="op-screen" data-on={cue === 3 || undefined}>
      <figure className="op-screen__frame">
        <video ref={videoRef} src="/demos/tts-lecture.mp4" poster="/demos/tts-lecture.jpg" muted={muted} playsInline preload="auto" onPlay={() => { setPlaying(true); setAudioBlocked(false); }} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} aria-label="TTS Engine으로 제작한 실제 강의 영상의 장표와 자막"/>
      </figure>
      <div className="op-screen__meta">
        <LectureWave video={videoRef} bars={140}/>
        <p><b>제 목소리</b>로 읽고, 자막과 장표를 붙인 강의 영상 · 제 엔진으로 제작</p>
      </div>
      <div className="op-screen__controls"><button type="button" onClick={() => { const v = videoRef.current; if (!v) return; if (autoStart.current !== null) { window.clearTimeout(autoStart.current); autoStart.current = null; } if (v.paused) { if (v.ended) v.currentTime = 0; void v.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true)); } else v.pause(); }}>{audioBlocked ? "소리 재생하기" : playing ? "일시정지" : "다시 듣기"} <kbd>P</kbd></button><button type="button" onClick={() => { const v = videoRef.current; if (!v) return; v.muted = !v.muted; setMuted(v.muted); }}>{muted ? "소리 켜기" : "소리 끄기"} <kbd>A</kbd></button></div>
    </div>
  </Frame>;
}
