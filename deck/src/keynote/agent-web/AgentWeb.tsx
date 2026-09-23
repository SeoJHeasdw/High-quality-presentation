import { useEffect, useRef, useState } from "react";
import { Frame } from "../KeynoteFrame";
import { usePerformanceMotion } from "../usePerformanceMotion";
import type { AgentWebWorld, AnchorId } from "./world";
import "../incident/incident.css";
import "./agent-web.css";

/*
 * 7~8번은 하나의 공간이다(묶음 agent-web). 7번 두 단계, 8번 세 단계가 순서대로 phase 0~4가 된다.
 * 3D 공간은 agent-web/world.ts, 제목·설명·출처와 라벨은 여기의 DOM이 맡는다.
 */
export const AGENT_WEB_SOURCES = {
  webmcp: "https://developer.chrome.com/blog/webmcp-epp",
  aside: "https://aside.com/",
};

type Tone = "ice" | "amber" | "gold" | "mute";
type Label = { id: AnchorId; name: string; sub?: string; tone?: Tone; tag?: string; dir?: "up" | "left" | "right" };
function labelsFor(p: number): Label[] {
  if (p === 0) return [
    { id: "gate", name: "사람인지 확인", sub: "사람에게 묻는 질문", tone: "amber", dir: "right" },
    { id: "site", name: "웹사이트", sub: "사람이 보는 화면", tone: "mute", dir: "up" },
  ];
  if (p === 1) return [
    { id: "tools", name: "사이트가 알려주는 기능", sub: "에이전트가 호출한다", tone: "ice", tag: "WEBMCP", dir: "up" },
    { id: "gate", name: "사람인지 확인", tone: "mute", dir: "right" },
  ];
  if (p === 2) return [
    { id: "bill", name: "광고", sub: "사람의 눈에 띄려는 비용", tone: "amber", dir: "right" },
  ];
  if (p === 3) return [
    { id: "pick", name: "B 선택", sub: "20,000원 절약", tone: "gold", dir: "up" },
    { id: "agent", name: "화면 대신 조건을 읽는다", tone: "ice", dir: "up" },
  ];
  return [{ id: "priceA", name: "광고비 → 가격?", sub: "판매자의 새 선택지", tone: "amber", tag: "발표자의 가설", dir: "right" }];
}
const ALL_IDS: AnchorId[] = ["gate", "site", "tools", "agent", "bill", "pick", "priceA"];

const COPY = [
  { kicker: "웹사이트와 에이전트", title: "에이전트용 웹 기능이 생기고 있습니다" },
  { kicker: "가상 구매 사례", title: "같은 키보드, 어디서 살까요?" },
];
const NARRATION = [
  "웹사이트는 먼저 사람인지 확인합니다.",
  "WebMCP · 사이트가 제공하는 기능을 에이전트가 호출합니다.",
  "같은 무선 키보드 · 내일 도착 · 14일 이내 반품",
  "같은 조건이라면, 에이전트는 가격을 봅니다.",
  "판매자는 광고비를 줄여 가격을 낮추게 될까요?",
];

export default function AgentWebStory({ part, step }: { part: 0 | 1; step: number }) {
  const phase = part === 0 ? step : 2 + step;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Partial<Record<AnchorId, HTMLDivElement | null>>>({});
  const world = useRef<AgentWebWorld | null>(null);
  const [failed, setFailed] = useState(false);
  const motion = usePerformanceMotion();
  const motionRef = useRef(motion); motionRef.current = motion;
  const phaseRef = useRef(phase); phaseRef.current = phase;

  useEffect(() => {
    const canvas = canvasRef.current!;
    let w: AgentWebWorld | null = null, cancelled = false;
    const lost = () => setFailed(true);
    const move = (e: PointerEvent) => w?.setPointer(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1);
    Promise.all([import("./world"), document.fonts.ready]).then(([{ createAgentWebWorld }]) => {
      if (cancelled) return;
      try { w = createAgentWebWorld(canvas, phaseRef.current, motionRef.current); }
      catch { setFailed(true); return; }
      world.current = w;
      const live = w;
      canvas.addEventListener("agentweb-lost", lost);
      live.onFrame(() => {
        if (labelsRef.current) labelsRef.current.style.opacity = live.labelAlpha().toFixed(3);
        for (const id of ALL_IDS) {
          const el = labelRefs.current[id]; if (!el) continue;
          const { x, y, visible } = live.project(id);
          el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
          el.style.visibility = visible ? "" : "hidden";
        }
      });
      addEventListener("pointermove", move);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; removeEventListener("pointermove", move); canvas.removeEventListener("agentweb-lost", lost); w?.dispose(); world.current = null; };
  }, []);
  useEffect(() => { world.current?.setPhase(phase); }, [phase]);
  useEffect(() => { world.current?.setMotion(motion); }, [motion]);

  const active = new Map(labelsFor(phase).map((l) => [l.id, l]));
  const copy = COPY[part];
  return <Frame n={7 + part} name={part === 0 ? "에이전트가 쓰는 웹" : "에이전트가 고르는 판매처"} step={step} className="story-edit story-agent-web">
    <div className="iw aw" data-fallback={failed || undefined} data-phase={phase} aria-hidden="true">
      <canvas ref={canvasRef} className="iw-canvas" width={1920} height={1080}/>
      <div className="iw-shade aw-shade"/>
      <div className="iw-labels" ref={labelsRef}>
        {ALL_IDS.map((id) => {
          const l = active.get(id);
          return <div key={id} ref={(el) => { labelRefs.current[id] = el; }} className="iw-label" data-on={(l && !failed) || undefined} data-tone={l?.tone ?? "ice"} data-dir={l?.dir ?? "up"}>
            <i className="iw-label-dot"/>
            <div className="iw-label-box">
              {l?.tag && <span className="iw-label-tag">{l.tag}</span>}
              <strong>{l?.name}</strong>
              {l?.sub && <span className="iw-label-sub">{l.sub}</span>}
            </div>
          </div>;
        })}
      </div>
    </div>

    <div className="aw-heading" key={`h${part}`}>
      <p>{copy.kicker}</p>
      <h1>{copy.title}</h1>
    </div>
    {part === 1 && <div className="aw-request" key="request"><i/>“내일까지 받으면 돼. 싼 곳으로 골라줘.”</div>}
    <p className="aw-narrative" key={`n${phase}`} data-phase={phase}>
      {phase === 4 && <span className="aw-tag">발표자의 가설</span>}
      {NARRATION[phase]}
    </p>
    {phase === 1 && <p className="aw-aside" key="aside"><b>Aside</b>사람과 에이전트가 함께 쓰는 브라우저도 나왔습니다</p>}
    {failed && <AgentWebFallback phase={phase}/>}

    {part === 0
      ? <aside className="story-source aw-source"><a href={AGENT_WEB_SOURCES.webmcp} target="_blank" rel="noreferrer">Chrome · WebMCP early preview · 2026.02.10 ↗</a><a href={AGENT_WEB_SOURCES.aside} target="_blank" rel="noreferrer">Aside 공식 소개 ↗</a><span>도구 이름은 설명용 예시</span></aside>
      : <aside className="story-source aw-source"><span>가상 금액과 조건 · 판매자 신뢰와 나머지 조건은 같다고 가정 · 가격 전략은 발표자의 가설</span></aside>}
  </Frame>;
}

/** WebGL을 쓸 수 없을 때: 같은 내용을 평면으로 보여준다. */
function AgentWebFallback({ phase }: { phase: number }) {
  if (phase <= 1) return <div className="aw-fallback">
    <div className="aw-fb-card"><span>사람인지 확인</span><b>☑ 나는 로봇이 아닙니다</b></div>
    {phase === 1 && <div className="aw-fb-card is-ice"><span>WebMCP · 사이트가 알려주는 기능 (예시)</span><b>상품 검색 · 옵션 선택 · 주문하기</b></div>}
  </div>;
  return <div className="aw-fallback">
    <div className="aw-fb-card"><span>판매처 A</span><b>129,000원</b></div>
    <div className="aw-fb-card" data-pick={phase >= 3 || undefined}><span>판매처 B</span><b>109,000원</b>{phase >= 3 && <em>B 선택 · 20,000원 절약</em>}</div>
  </div>;
}
