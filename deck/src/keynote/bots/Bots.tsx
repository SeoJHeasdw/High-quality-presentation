import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Frame } from "../KeynoteFrame";
import { Source, SOURCES } from "../Stories";
import { usePerformanceMotion } from "../usePerformanceMotion";
import type { BotsWorld } from "./world";
import { AUTO, LAYOUT, SHARES } from "./layout";
import "./bots.css";

/*
 * 6번 · 웹에 오는 요청. 발표자가 누를 때마다 두 큐를 지난다.
 *   0 요청이 웹페이지로 흘러들고, 관측 지점에서 사람과 자동화로 나뉘어 53%와 47%가 된다.
 *   1 자동화 53이 AI가 아닌 봇 44 · Googlebot 5 · AI 봇 등 4로 나뉘고, 가장 작은 칸에서 질문이 나온다.
 * 3D 공간은 bots/world.ts, 글과 라벨은 여기의 DOM이 맡는다. 좌표는 layout.ts(화면 px)를 3D와 함께 쓴다.
 */

/** 화면 px → kn-body 안의 위치. kn-body의 원점은 화면 (100, 162)이다. */
const at = (x: number, y: number): CSSProperties => ({ left: x - 100, top: y - 162 });
const SEG = LAYOUT.slab.segments;
const mid = (i: number) => (SEG[i].x0 + SEG[i].x1) / 2;
const SLAB_BOTTOM = LAYOUT.slab.y + LAYOUT.slab.h;

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

  useEffect(() => {
    let cancelled = false, w: BotsWorld | null = null;
    const canvas = canvasRef.current!;
    const lost = () => setFailed(true);
    Promise.all([import("./world"), document.fonts.load('760 300px "Pretendard Variable"'), document.fonts.load('620 128px "Pretendard Variable"')]).then(([mod]) => {
      if (cancelled) return;
      try {
        const glyphs = { auto: mod.sampleNumber(String(AUTO), 6000, 11), human: mod.sampleNumber(String(SHARES[3]), 6000, 13) };
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
      <p>Cloudflare · 2025년 12월 2일 HTML 요청</p>
      <h1>웹에는 사람만 오는 게 아닙니다</h1>
    </div>

    {live && <>
      {intro && cue === 0 && gate && <div className="bt-gate" style={at(gate.x, gate.y)}>
        <b>관측 지점</b><span className="is-human"><i/>사람</span><span className="is-auto"><i/>자동화</span>
      </div>}

      {/* 3D가 준비된 뒤에 놓는다. 라벨의 등장 시각이 공간의 시계와 같이 간다. */}
      {gate && <figure className="bt-share" data-cue={cue} data-intro={intro || undefined} aria-label="HTML 요청 중 자동화 53%, 사람 47%">
        <div className="bt-group is-auto" style={{ ...at(SEG[0].x0, 392), width: SEG[2].x1 - SEG[0].x0 }}><span>자동화</span><b>{AUTO}%</b></div>
        <div className="bt-group is-human" style={{ ...at(SEG[3].x0, 392), width: SEG[3].x1 - SEG[3].x0 }}><span>사람</span><b>{SHARES[3]}%</b></div>
      </figure>}

      {cue === 1 && <div className="bt-parts" aria-label="자동화 53% 중 AI가 아닌 봇 44%, Googlebot 5%, AI 봇 등 약 4%">
        <div className="bt-part is-bot" style={at(SEG[0].x0, SLAB_BOTTOM + 30)}><span>AI가 아닌 봇</span><b>{SHARES[0]}%</b></div>
        <div className="bt-part is-google" style={at(mid(1), SLAB_BOTTOM + 8)}><i/><div><span>Googlebot</span><b>{SHARES[1]}%</b></div></div>
        <div className="bt-part is-agent" style={at(mid(2), SLAB_BOTTOM + 8)}><i/><div><span>AI 봇 등</span><b>≈{SHARES[2]}%</b></div></div>
        <h2 className="bt-question" style={at(mid(2) + 18, SLAB_BOTTOM + 162)}>에이전트도 웹사이트를 쓴다면?</h2>
      </div>}
    </>}

    {failed && <BotFallback step={step}/>}

    <p className="story-scope bt-scope" key={`s${cue}`}>{cue === 0 || failed
      ? "자동화 53%는 사람 47%의 나머지로 계산했습니다. 모든 봇이 AI 에이전트인 것은 아닙니다."
      : "AI 봇 등 ≈4%는 사람·AI가 아닌 봇·Googlebot의 나머지입니다. 같은 보고서의 2025년 AI 봇 평균은 4.2%입니다."}</p>
    <Source href={SOURCES.cloudflare}>Cloudflare · 2025 Year in Review</Source>
  </Frame>;
}

/** WebGL을 쓸 수 없을 때: 숫자와 막대를 평면으로 보여준다. */
function BotFallback({ step }: { step: number }) {
  return <div className="bt-fallback">
    <figure className="request-share" aria-label="HTML 요청 중 자동화 53%, 사람 47%">
      <div className="request-share-labels"><div><span>자동화</span><strong>53<small>%</small></strong></div><div><span>사람</span><strong>47<small>%</small></strong></div></div>
      <div className="request-share-bar" aria-hidden="true"><i/><i/></div>
    </figure>
    {step >= 1 && <div className="request-share-question"><h2>에이전트도 웹사이트를 쓴다면?</h2></div>}
  </div>;
}
