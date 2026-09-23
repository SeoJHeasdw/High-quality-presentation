import { useEffect, useRef, type CSSProperties } from "react";
import { Frame } from "../KeynoteFrame";
import { usePerformanceMotion } from "../usePerformanceMotion";
import align from "../data/tts-alignment.json";
import wave from "../data/tts-waveform.json";
import "./personal.css";

/*
 * 15번 · 강의 한 편이 만들어지는 실제 기록.
 * 대본·목소리·자막·영상 네 줄은 모두 실제 강의의 같은 24초(원본 00:25–00:49)에서 가져왔다.
 *   대본  local-tts-engine 타임라인의 원문 문장과 시각
 *   목소리 실제 음성의 파형 (data/tts-waveform.json)
 *   자막  단어 단위 정렬 시각 (data/tts-alignment.json)
 *   영상  같은 구간의 프레임 (public/demos/tts-strip.jpg)
 * 재생 헤드는 오른쪽 위 영상의 재생 위치를 따른다. 모션을 끄면 한 지점에 멈춘 화면을 보여준다.
 */
const DUR = 24;
const STILL = 2.4; // 모션을 끌 때 멈춰 보여줄 시각: "AI가"를 읽는 순간
type Word = { t0: number; t1: number; text: string; say: string | null };
type Sentence = { t0: number; t1: number; text: string; say: string | null; clipped: boolean };
const SENTENCES = align.sentences as Sentence[];
const WORDS = align.words as Word[];
const at = (t: number) => ({ "--x": t / DUR } as CSSProperties);
const span = (t0: number, t1: number) => ({ "--x": t0 / DUR, "--w": (t1 - t0) / DUR } as CSSProperties);

export default function ProductionTimeline() {
  const motion = usePerformanceMotion();
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const clock = useRef<HTMLSpanElement>(null);
  const said = useRef<HTMLElement>(null);

  useEffect(() => {
    const v = video.current!, el = root.current!;
    let raf = 0, lastS = -1, lastW = -1;
    const words = [...el.querySelectorAll<HTMLElement>(".pt-word")], sents = [...el.querySelectorAll<HTMLElement>(".pt-sentence")];
    const paint = (t: number) => {
      el.style.setProperty("--t", String(t / DUR));
      if (clock.current) clock.current.textContent = `${t.toFixed(1)}s`;
      const s = SENTENCES.findIndex((x) => t >= x.t0 && t < x.t1 + 0.35), w = WORDS.findIndex((x) => t >= x.t0 && t < x.t1 + 0.08);
      if (s !== lastS) { sents.forEach((n, i) => n.toggleAttribute("data-now", i === s)); lastS = s; }
      if (w !== lastW) {
        words.forEach((n, i) => { n.toggleAttribute("data-now", i === w); n.toggleAttribute("data-past", i < w); });
        if (said.current) { said.current.textContent = w >= 0 ? WORDS[w].text : ""; said.current.toggleAttribute("data-on", w >= 0); }
        lastW = w;
      }
    };
    const loop = () => { paint(v.currentTime || 0); raf = requestAnimationFrame(loop); };
    if (motion) {
      v.currentTime = 0;
      const id = window.setTimeout(() => { void v.play().catch(() => {}); }, 1400);
      raf = requestAnimationFrame(loop);
      return () => { window.clearTimeout(id); cancelAnimationFrame(raf); v.pause(); };
    }
    v.pause();
    const still = () => { v.currentTime = STILL; paint(STILL); };
    if (v.readyState >= 1) still(); else v.addEventListener("loadedmetadata", still, { once: true });
    return () => v.removeEventListener("loadedmetadata", still);
  }, [motion]);

  const bars = 240, step = wave.peaks.length / bars;
  const peaks = Array.from({ length: bars }, (_, i) => { let m = 0; for (let k = Math.floor(i * step); k < Math.floor((i + 1) * step); k++) m = Math.max(m, wave.peaks[k] ?? 0); return m; });

  return <Frame n={15} name="제가 쓸 도구부터" className="personal-v2 p14">
    <div className="p14-copy">
      <p className="pv-eyebrow">제가 고른 일 · 예를 들면 강의 한 편</p>
      <h1>저는 쓸 일이 있는 도구부터<br/>만들고 있습니다</h1>
      <p className="p14-lead">좋은 AI가 나오면, 이런 작업에 가져다 써보는 겁니다.</p>
      <p className="p14-model"><span>제 컴퓨터에서 도는 모델</span><b>Qwen3-TTS 1.7B</b><i>+</i><b>제 목소리 어댑터</b></p>
    </div>

    <figure className="p14-monitor">
      <video ref={video} src="/demos/tts-lecture.mp4" poster="/demos/tts-lecture.jpg" muted loop playsInline preload="auto" aria-label="대본을 제 목소리로 읽고 자막과 장표를 붙인 실제 강의 영상"/>
      <figcaption><i/>실제 강의 · 원본 00:25–00:49</figcaption>
    </figure>

    <div className="p14-timeline" ref={root} data-motion={motion || undefined}>
      <div className="pt-ruler" aria-hidden="true">{Array.from({ length: DUR / 2 + 1 }, (_, i) => <span key={i} style={at(i * 2)}>{i * 2}s</span>)}</div>
      <div className="pt-track pt-track--script" style={{ "--order": 0 } as CSSProperties}>
        <header><b>대본</b><span>제가 쓴 내용</span></header>
        <div className="pt-lane">{SENTENCES.map((s, i) => <div key={i} className="pt-sentence" data-clipped={s.clipped || undefined} style={span(s.t0, s.t1)}>
          <span>{s.text}</span>{s.say && <em>읽기 · {s.say.replace(/[.]$/, "")}</em>}
        </div>)}</div>
      </div>
      <div className="pt-track pt-track--voice" style={{ "--order": 1 } as CSSProperties}>
        <header><b>목소리</b><span>제 목소리로 읽기</span></header>
        <div className="pt-lane pt-wave" aria-hidden="true">
          <div className="pt-wave__bars">{peaks.map((p, i) => <i key={i} style={{ height: `${Math.max(4, p * 100)}%` }}/>)}</div>
          <div className="pt-wave__bars pt-wave__bars--on">{peaks.map((p, i) => <i key={i} style={{ height: `${Math.max(4, p * 100)}%` }}/>)}</div>
        </div>
      </div>
      <div className="pt-track pt-track--words" style={{ "--order": 2 } as CSSProperties}>
        <header><b>자막</b><span>소리에 맞춰 붙이기</span></header>
        <div className="pt-lane">{WORDS.map((w, i) => <span key={i} className="pt-word" data-read={w.say ? "true" : undefined} style={span(w.t0, w.t1)}>{w.text}</span>)}</div>
      </div>
      <div className="pt-track pt-track--video" style={{ "--order": 3 } as CSSProperties}>
        <header><b>강의 영상</b><span>보고, 듣고, 고치기</span></header>
        <div className="pt-lane pt-strip" aria-hidden="true"/>
      </div>
      <div className="pt-head" aria-hidden="true"><span ref={clock}>0.0s</span><b ref={said}/></div>
    </div>
    <p className="p14-source">local-tts-engine 제작 기록의 실제 시각 · 문장·단어 정렬, 파형, 프레임은 같은 24초 구간</p>
  </Frame>;
}
