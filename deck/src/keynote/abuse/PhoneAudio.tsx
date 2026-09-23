import { useEffect, useRef, useState } from "react";

/** A short, explicitly fictional cue. It ends when the presenter changes beat. */
export default function PhoneAudio({ src, active, label, delayMs = 500 }: { src: string; active: boolean; label: string; delayMs?: number }) {
  const audio = useRef<HTMLAudioElement>(null);
  const autoStart = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const play = () => {
    const el = audio.current; if (!el) return;
    if (el.ended) el.currentTime = 0;
    void el.play().then(() => setBlocked(false)).catch(() => { if (el.paused) setBlocked(true); });
  };
  useEffect(() => {
    const el = audio.current; if (!el) return;
    el.pause(); el.currentTime = 0;
    if (!active) return;
    autoStart.current = window.setTimeout(() => { autoStart.current = null; play(); }, delayMs);
    return () => { if (autoStart.current !== null) window.clearTimeout(autoStart.current); autoStart.current = null; el.pause(); };
  }, [active, src, delayMs]);
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = audio.current; if (!el) return;
      if (e.key.toLowerCase() === "p") { e.preventDefault(); if (autoStart.current !== null) { window.clearTimeout(autoStart.current); autoStart.current = null; } if (el.paused) play(); else el.pause(); }
      if (e.key.toLowerCase() === "a") { e.preventDefault(); el.muted = !el.muted; setMuted(el.muted); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  return <div className="phone-audio" data-active={active || undefined}>
    <audio ref={audio} src={src} preload="auto" muted={muted} onPlay={() => { setPlaying(true); setBlocked(false); }} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}/>
    {active && <><span>{label} · 가상 상황 · 본인 목소리 합성</span><div>
      <button type="button" onClick={() => { const el = audio.current; if (!el) return; if (autoStart.current !== null) { window.clearTimeout(autoStart.current); autoStart.current = null; } if (el.paused) play(); else el.pause(); }}>{blocked ? "소리 재생하기" : playing ? "일시정지" : "다시 듣기"} <kbd>P</kbd></button>
      <button type="button" onClick={() => { const el = audio.current; if (!el) return; el.muted = !el.muted; setMuted(el.muted); }}>{muted ? "소리 켜기" : "소리 끄기"} <kbd>A</kbd></button>
    </div></>}
  </div>;
}
