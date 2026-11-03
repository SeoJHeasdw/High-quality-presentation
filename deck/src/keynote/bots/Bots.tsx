import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Frame } from "../KeynoteFrame";
import { Source, SOURCES } from "../Stories";
import { usePerformanceMotion } from "../usePerformanceMotion";
import type { BotsWorld } from "./world";
import { AUTO, AUTO_NOW, LAYOUT, SHARES, SHARES_NOW } from "./layout";
import "./bots.css";

/*
 * 6번 · 웹에 오는 요청. 발표자가 누를 때마다 세 큐를 지난다.
 *   0 요청이 웹페이지로 흘러들고, 관측 지점에서 사람과 봇으로 나뉘어 53%와 47%가 된다.
 *   1 봇 53이 그 밖의 봇 49 · AI 봇 등 4로 나뉘고, 작은 칸에서 질문이 나온다.
 *   2 가정 시나리오. 같은 막대의 칸 경계가 55 · 10 · 35로 옮겨 가고, 라벨과 숫자가 따라간다.
 * 3D 공간은 bots/world.ts, 글과 라벨은 여기의 DOM이 맡는다. 좌표는 layout.ts(화면 px)를 3D와 함께 쓴다.
 */

/** 화면 px → kn-body 안의 위치. kn-body의 원점은 화면 (100, 162)이다. */
const at = (x: number, y: number): CSSProperties => ({ left: x - 100, top: y - 162 });
const SEG = LAYOUT.slab.segments, NOW = LAYOUT.slab.now;
const mid = (i: number, seg = SEG) => (seg[i].x0 + seg[i].x1) / 2;
const SLAB_BOTTOM = LAYOUT.slab.y + LAYOUT.slab.h;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** 2단계로 넘어가는 정도(0→1). 3D 막대의 칸 경계와 같은 시간표(world.ts: 0.1초 뒤 1.9초)를 쓴다. 뒤로 오면 바로 0이다. */
function useShift(on: boolean, motion: boolean) {
  const [k, setK] = useState(on ? 1 : 0);
  useEffect(() => {
    if (!on || !motion) { setK(on ? 1 : 0); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => { const t = Math.min(1, Math.max(0, (now - t0 - 100) / 1900)); setK(ease(t)); if (t < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on, motion]);
  return k;
}

export default function BotStory({ step }: { step: number }) {
  const cue = step;
  const motion = usePerformanceMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const world = useRef<BotsWorld | null>(null);
  const cueRef = useRef(cue); cueRef.current = cue;
  const motionRef = useRef(motion); motionRef.current = motion;
  const [failed, setFailed] = useState(false);
  const [gate, setGate] = useState<{ x: number; y: number } | null>(null);
  // 흐름 연출은 첫 큐로 들어왔을 때 한 번만 보여준다. 뒤로 돌아오면 숫자가 이미 서 있다.
  const [intro, setIntro] = useState(() => cue === 0 && motion);
  useEffect(() => { if (cue !== 0 || !motion) setIntro(false); }, [cue, motion]);
  const now = cue >= 2, k = useShift(now, motion);
  const share = (then: number, next: number) => Math.round(then + (next - then) * k);
  const seg = now ? NOW : SEG;

  useEffect(() => {
    let cancelled = false, w: BotsWorld | null = null;
    const canvas = canvasRef.current!;
    const lost = () => setFailed(true);
    Promise.all([import("./world"), document.fonts.load('760 300px "Pretendard Variable"'), document.fonts.load('620 128px "Pretendard Variable"')]).then(([mod]) => {
      if (cancelled) return;
      try {
        const glyphs = { auto: mod.sampleNumber(String(AUTO), 6000, 11), human: mod.sampleNumber(String(SHARES[2]), 6000, 13) };
        w = mod.createBotsWorld(canvas, glyphs, cueRef.current, motionRef.current);
      } catch { setFailed(true); return; }
      world.current = w;
      setGate(w.gateAnchor);
      canvas.addEventListener("bots-lost", lost);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; canvas.removeEventListener("bots-lost", lost); w?.dispose(); world.current = null; };
  }, []);
  useEffect(() => { world.current?.setPhase(cue); }, [cue]);
  useEffect(() => { world.current?.setMotion(motion); }, [motion]);

  const live = !failed;
  return <Frame n={6} name="웹 요청의 변화" step={step} className="story-edit story-bots-revision bots">
    <div className="bt" data-cue={cue} data-fallback={failed || undefined} aria-hidden="true">
      <canvas ref={canvasRef} className="bt-canvas" width={1920} height={1080}/>
      <div className="bt-shade"/>
    </div>

    <div className="bt-heading">
      {now ? <p key="now" data-now="">2026년 10월 집계 + 발표자의 가정</p> : <p key="then">Cloudflare · 2025년 12월 2일 HTML 요청</p>}
      <h1>웹에는 사람만 오는 게 아닙니다</h1>
    </div>

    {live && <>
      {intro && cue === 0 && gate && <div className="bt-gate" style={at(gate.x, gate.y)}>
        <b>관측 지점</b><span className="is-human"><i/>사람</span><span className="is-auto"><i/>봇</span>
      </div>}

      {/* 3D가 준비된 뒤에 놓는다. 라벨의 등장 시각이 공간의 시계와 같이 간다. */}
      {gate && <figure className="bt-share" data-cue={cue} data-intro={intro || undefined} aria-label={now ? "가정 시나리오: HTML 요청 중 봇 65%, 사람 35%" : "HTML 요청 중 봇 53%, 사람 47%"}>
        <div className="bt-group is-auto" style={{ ...at(seg[0].x0, 392), width: seg[1].x1 - seg[0].x0 }}><span>봇</span><b>{share(AUTO, AUTO_NOW)}%</b></div>
        <div className="bt-group is-human" style={{ ...at(seg[2].x0, 392), width: seg[2].x1 - seg[2].x0 }}><span>사람</span><b>{share(SHARES[2], SHARES_NOW[2])}%</b></div>
      </figure>}

      {cue >= 1 && <div className="bt-parts" data-cue={cue} aria-label={now ? "봇 65% 중 그 밖의 봇 55%, AI 봇 등 10%(가정)" : "봇 53% 중 그 밖의 봇 49%, AI 봇 등 약 4%"}>
        <div className="bt-part is-bot" style={at(SEG[0].x0, SLAB_BOTTOM + 30)}><span>그 밖의 봇</span><b>{share(SHARES[0], SHARES_NOW[0])}%</b></div>
        <div className="bt-part is-agent" style={at(mid(1, seg), SLAB_BOTTOM + 8)}><i/><div>
          <span>AI 봇 등{now && <em>가정</em>}</span><b>{now ? "" : "≈"}{share(SHARES[1], SHARES_NOW[1])}%</b>
        </div></div>
        <h2 className="bt-question" style={at(mid(1, seg) + 18, SLAB_BOTTOM + 162)}>에이전트도 웹사이트를 쓴다면?</h2>
      </div>}
    </>}

    {failed && <BotFallback step={step}/>}

    <p className="story-scope bt-scope" key={`s${cue}`}>{now
      ? "봇 65%·사람 35%는 2026년 10월 집계를 반올림했습니다. AI 봇 등 10%는 측정값이 아니라 발표자의 가정입니다."
      : cue === 0 || failed
      ? "봇 53%는 사람 47%의 나머지로 계산했습니다. 모든 봇이 AI 에이전트인 것은 아닙니다."
      : "AI 봇 등 ≈4%는 사람과 그 밖의 봇을 뺀 나머지입니다. 같은 보고서의 2025년 AI 봇 평균은 4.2%입니다."}</p>
    {now ? <Source href={SOURCES.botsNow}>SEOmator · Cloudflare Radar 2026년 10월 집계</Source>
      : <Source href={SOURCES.cloudflare}>Cloudflare · 2025 Year in Review</Source>}
  </Frame>;
}

/** WebGL을 쓸 수 없을 때: 숫자와 막대를 평면으로 보여준다. */
function BotFallback({ step }: { step: number }) {
  const [auto, human] = step >= 2 ? [AUTO_NOW, SHARES_NOW[2]] : [AUTO, SHARES[2]];
  return <div className="bt-fallback">
    <figure className="request-share" aria-label={`HTML 요청 중 봇 ${auto}%, 사람 ${human}%`}>
      <div className="request-share-labels" style={{ gridTemplateColumns: `${auto}fr ${human}fr` }}><div><span>봇</span><strong>{auto}<small>%</small></strong></div><div><span>사람</span><strong>{human}<small>%</small></strong></div></div>
      <div className="request-share-bar" aria-hidden="true"><i style={{ flex: auto }}/><i style={{ flex: human }}/></div>
    </figure>
    {step >= 1 && <div className="request-share-question"><h2>에이전트도 웹사이트를 쓴다면?</h2></div>}
  </div>;
}
