import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Frame } from "../KeynoteFrame";
import { usePerformanceMotion } from "../usePerformanceMotion";
import sample from "../data/english-narration.json";
import "./abuse-v2.css";

/*
 * 32번 · 제가 녹음한 적 없는 문장.
 * 제공받은 영어 내레이션에서 First 이전(원본 00:22.5)을 제거한 음성을 들려준다.
 * 파형과 문장별 단어 시점은 이 잘라낸 샘플을 기준으로 표시한다.
 * 숫자는 local-tts-engine/docs/DECISIONS.md(학습 기록)와 Qwen3-TTS 공개 README에서 가져왔다.
 */
const T0 = 0, T1 = sample.duration;
const BARS = sample.peaks;
const HEAD = [
  { kicker: "제 목소리로 만든 영어 내레이션", title: <>제 목소리입니다.</>, sub: "이번에는 영어로 읽은 샘플을 들어보겠습니다." },
  { kicker: "그런데", title: <>저는 이 문장을<br/><em>녹음한 적이 없습니다.</em></>, sub: "대본을 넣었더니, 제 목소리로 나왔습니다." },
  { kicker: "제 목소리를 흉내 내는 데 든 것", title: <>제 목소리는 이제<br/><em>파일 하나</em>입니다.</>, sub: "" },
];
const STATS: [string, string, string][] = [
  ["12.3", "분", "제가 고른 녹음 · 92개 클립"],
  ["35.3", "초", "학습 시간 · 노트북 한 대(M4 Max)"],
  ["67", "MB", "목소리 어댑터 파일 · 약"],
];

export default function OwnVoice({ step }: { step: number }) {
  const motion = usePerformanceMotion();
  const audio = useRef<HTMLAudioElement>(null);
  const autoStart = useRef<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const shownSentence = useRef(0);
  const sentence = sample.sentences[sentenceIndex];

  const playSample = () => {
    const v = audio.current; if (!v) return;
    if (v.ended || v.currentTime < T0 || v.currentTime >= T1) v.currentTime = T0;
    void v.play().then(() => setAudioBlocked(false)).catch(() => { if (v.paused) setAudioBlocked(true); });
  };
  // 먼저 영어 음성을 들려주고, 발표자가 넘긴 다음에 합성 사실을 드러낸다.
  useEffect(() => {
    const v = audio.current!;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "p" && step === 0) { e.preventDefault(); if (autoStart.current !== null) { window.clearTimeout(autoStart.current); autoStart.current = null; } if (v.paused) playSample(); else v.pause(); }
      if (k === "a") { e.preventDefault(); v.muted = !v.muted; setMuted(v.muted); }
    };
    let raf = 0;
    const tick = () => {
      const t = v.currentTime;
      if (!v.paused && t >= T1) { v.pause(); v.currentTime = T1; }
      const p = Math.max(0, Math.min(1, (t - T0) / (T1 - T0)));
      root.current?.style.setProperty("--played", String(v.paused && t <= T0 + .01 ? 0 : v.paused && t >= T1 ? 1 : p));
      const next = sample.sentences.findIndex(s => t < s.t1);
      const index = next < 0 ? sample.sentences.length - 1 : next;
      if (shownSentence.current !== index) { shownSentence.current = index; setSentenceIndex(index); }
      root.current?.querySelectorAll<HTMLElement>(".ov-word").forEach(el => el.toggleAttribute("data-said", t >= Number(el.dataset.at)));
      raf = requestAnimationFrame(tick);
    };
    const onPlay = () => { setPlaying(true); setAudioBlocked(false); }, onPause = () => setPlaying(false);
    v.addEventListener("play", onPlay); v.addEventListener("pause", onPause);
    window.addEventListener("keydown", onKey); raf = requestAnimationFrame(tick);
    return () => { window.removeEventListener("keydown", onKey); cancelAnimationFrame(raf); v.removeEventListener("play", onPlay); v.removeEventListener("pause", onPause); v.pause(); };
  }, [step]);
  useEffect(() => {
    if (step > 0) { audio.current?.pause(); return; }
    autoStart.current = window.setTimeout(() => { autoStart.current = null; playSample(); }, 1350);
    return () => { if (autoStart.current !== null) window.clearTimeout(autoStart.current); autoStart.current = null; };
  }, [step]);

  const head = HEAD[step];
  return <Frame n={32} name="제가 녹음한 적 없는 문장" step={step} className="abuse-slide abuse-v2 abuse-own">
    <div className="abuse-content">
      <div className="ov" ref={root} data-step={step} data-motion={motion || undefined}>
        <audio ref={audio} src="/abuse/audio/english-narration-sample.m4a" preload="auto" muted={muted} aria-hidden="true" className="ov-media"/>
        <div className="ov-head" key={`h${step}`}>
          <p className="av-eyebrow">{head.kicker}</p>
          <h1>{head.title}</h1>
          {head.sub && <p className="ov-sub">{head.sub}</p>}
        </div>
        <div className="ov-print" aria-hidden="true">
          <div className="ov-bars">{BARS.map((h, i) => <i key={i} style={{ "--h": Math.max(.06, h), "--i": i } as CSSProperties}/>)}</div>
          <span className="ov-file"><b>jaeho-ko-r16-v1</b><small>목소리 어댑터 · 약 67MB</small></span>
        </div>
        <p className="ov-sentence" aria-label={sentence.text}>{sentence.words.map((w, i) => <span key={`${sentenceIndex}-${i}`} className="ov-word" data-at={w.t0}>{w.text} </span>)}</p>
        <span className="ov-stamp">녹음 없음 · 대본에서 만든 목소리</span>
        <div className="ov-stats">
          {STATS.map(([n, u, label], i) => <div key={label} style={{ "--i": i } as CSSProperties}><strong>{n}<small>{u}</small></strong><span>{label}</span></div>)}
          <div className="ov-stat-public" style={{ "--i": 3 } as CSSProperties}><strong>3<small>초</small></strong><span>공개 모델이 밝힌, 목소리 복제에 필요한 음성 길이</span></div>
        </div>
        <div className="ov-controls" data-playing={playing || undefined}><button type="button" onClick={() => { const v = audio.current; if (!v) return; if (autoStart.current !== null) { window.clearTimeout(autoStart.current); autoStart.current = null; } if (v.paused) playSample(); else v.pause(); }}><kbd>P</kbd>{audioBlocked ? "소리 재생하기" : playing ? "정지" : "다시 듣기"}</button><button type="button" onClick={() => { const v = audio.current; if (!v) return; v.muted = !v.muted; setMuted(v.muted); }}><kbd>A</kbd>{muted ? "소리 켜기" : "소리 끄기"}</button></div>
      </div>
      <p className="av-note">{step < 2
        ? <span>영어 내레이션 샘플 · “First”부터 재생 · 원본 00:22.5 이후</span>
        : <><span>학습 기록: local-tts-engine DECISIONS · 과거 한 번의 실행이며 녹음·정리 시간은 따로 들었습니다</span><a href="https://github.com/QwenLM/Qwen3-TTS" target="_blank" rel="noreferrer">Qwen3-TTS · “3-second rapid voice clone” · 2026.1.22 · Apache-2.0 ↗</a></>}</p>
    </div>
  </Frame>;
}
