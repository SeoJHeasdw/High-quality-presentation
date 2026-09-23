import { useEffect, useRef, type RefObject } from "react";
import wave from "../data/tts-waveform.json";

/** 실제 강의 영상의 음성 파형. 재생 위치를 따라 금색으로 채워진다. */
export default function LectureWave({ video, bars = 128, className = "" }: { video: RefObject<HTMLVideoElement | null>; bars?: number; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const time = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const paint = () => {
      const v = video.current, el = root.current;
      if (v && el) {
        const d = v.duration || wave.duration, t = v.currentTime || 0;
        el.style.setProperty("--played", String(Math.min(1, t / d)));
        if (time.current) time.current.textContent = `0:${String(Math.floor(t)).padStart(2, "0")} / 0:${String(Math.round(d)).padStart(2, "0")}`;
      }
      raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [video]);
  const step = wave.peaks.length / bars;
  const peaks = Array.from({ length: bars }, (_, i) => {
    let m = 0; for (let k = Math.floor(i * step); k < Math.floor((i + 1) * step); k++) m = Math.max(m, wave.peaks[k] ?? 0);
    return m;
  });
  const bar = (p: number, i: number) => <i key={i} style={{ height: `${Math.max(6, p * 100)}%` }}/>;
  // 같은 막대를 두 겹 그리고, 위 겹을 재생 위치까지만 보이게 자른다.
  return <div className={`lecture-wave ${className}`} ref={root} aria-hidden="true">
    <div className="lecture-wave__track">
      <div className="lecture-wave__bars">{peaks.map(bar)}</div>
      <div className="lecture-wave__bars lecture-wave__bars--on">{peaks.map(bar)}</div>
      <b className="lecture-wave__head"/>
    </div>
    <span className="lecture-wave__time" ref={time}>0:00 / 0:24</span>
  </div>;
}
