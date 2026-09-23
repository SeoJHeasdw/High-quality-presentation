import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Frame } from "../KeynoteFrame";
import { usePerformanceMotion } from "../usePerformanceMotion";
import type { AnchorId, OneUserWorld } from "./world";
import "../incident/incident.css";
import "./personal.css";

/*
 * 17~20번은 하나의 공간이다(묶음 one-user).
 *   17번 두 단계 → phase 0~1, 18번 세 단계 → 2~4, 19번 세 단계 → 5~7, 20번 두 단계 → 8~9.
 * 3D는 personal/world.ts, 요구사항 표·설명·라벨은 여기의 DOM이 맡는다.
 * 19번(공장 안)의 모델 이름은 각 엔진 README의 제작 모델이다(FACT-CHECK 18행). 스테이션은 개발 중, 요청을 나누는 라우팅은 구상이다.
 */
type Tone = "ice" | "amber" | "gold" | "mute" | "white";
type Label = { id: AnchorId; name: ReactNode; sub?: string; tone?: Tone; tag?: string; dir?: "up" | "left" | "right" | "down"; fade?: boolean; size?: "lg" };
const STATIONS: { id: AnchorId; name: string; model: string }[] = [
  { id: "stVoice", name: "목소리", model: "Qwen3-TTS + 제 목소리 어댑터" },
  { id: "stStt", name: "받아쓰기 검수", model: "Whisper large-v3-turbo" },
  { id: "stAssets", name: "이미지 · 3D", model: "FLUX.2 klein · TRELLIS.2" },
  { id: "stMusic", name: "음악", model: "ACE-Step 1.5" },
  { id: "stRice", name: "업무 에이전트 RICE", model: "qwen3.6 35B · Ollama" },
];
function labelsFor(p: number): Label[] {
  if (p === 0) return [{ id: "me", name: "저 한 명", sub: "기획도, 사용도 제가 합니다", tone: "gold", dir: "up" }, { id: "crowd", name: "보통의 서비스", sub: "많은 사용자", tone: "mute", dir: "up", fade: true }];
  if (p === 1) return [{ id: "me", name: "저", tone: "gold", dir: "up" }];
  if (p === 2) return [{ id: "me", name: "저", sub: "요청 한 문장", tone: "gold", dir: "left" }, { id: "os", name: "Agent OS", sub: "순서를 정하고 작업을 챙깁니다", tone: "ice", tag: "구상", dir: "up" }];
  if (p === 3) return [{ id: "os", name: "Agent OS", tone: "mute", tag: "구상", dir: "up" }, { id: "factory", name: "Factory", sub: "음성·자막·화면을 만듭니다", tone: "ice", tag: "개발 중", dir: "up" }, { id: "out", name: "강의 영상", tone: "gold", dir: "right" }];
  if (p === 4) return [{ id: "me", name: "저는", sub: "들어보고 틀린 곳을 고칩니다", tone: "gold", dir: "left" }, { id: "redo", name: "“이 페이지 발음만 다시 만들어줘.”", tone: "gold", dir: "up" }, { id: "os", name: "Agent OS", tone: "mute", tag: "구상", dir: "up" }, { id: "factory", name: "Factory", tone: "mute", tag: "개발 중", dir: "up" }];
  const stations = (tone: Tone, sub = true): Label[] => STATIONS.map((s) => ({ id: s.id, name: s.name, sub: sub ? s.model : undefined, tone, dir: "up" }));
  const frontier: Label = { id: "frontier", name: "프론티어 모델", sub: "판단이 필요할 때만 부릅니다", tone: "white", dir: "up" };
  if (p === 5) return [...stations("ice"), frontier, { id: "router", name: "요청 나누기", sub: "어느 스테이션이 맡을지", tone: "mute", tag: "구상", dir: "left" }];
  if (p === 6) return [{ ...frontier, sub: "구독과 추가 사용량 · 월 20만원 이상" }, { id: "rentCodex", name: <>₩159,000<small>/월</small></>, sub: "Codex · Pro 플랜", tone: "white", dir: "down", size: "lg" }, { id: "rentClaude", name: <>US$72.77</>, sub: "Claude · 이번 달 추가 사용량 · 한도 US$76", tone: "white", dir: "down", size: "lg" }];
  if (p === 7) return [...stations("ice", false), { ...frontier, sub: "어려운 판단만" }];
  if (p === 8) return [];
  return [
    { id: "betOut", name: "01 사람이 보고 듣는 결과물", sub: "목소리·영상·2D·3D·음악은 계속 값을 받습니다", tone: "gold", dir: "right" },
    { id: "betMe", name: "02 과도기엔 이름이 포트폴리오", sub: "무엇을 만드는 사람인지 보여줍니다", tone: "gold", dir: "left" },
    { id: "betFactory", name: "03 스테이션은 갈아 끼웁니다", sub: "공장이 본체입니다", tone: "gold", dir: "up" },
  ];
}
const ALL_IDS: AnchorId[] = ["me", "crowd", "os", "factory", "out", "redo", "stVoice", "stStt", "stAssets", "stMusic", "stRice", "frontier", "router", "rentCodex", "rentClaude", "betOut", "betMe", "betFactory"];

const SPECS: [string, string, string, string][] = [
  ["속도", "빠르게", "조금 느려도 괜찮습니다", "기다리는 건 저니까요."],
  ["가동", "늘 켜 두기", "잠깐 꺼도 됩니다", "안 쓰는 시간에 고치면 됩니다."],
  ["기능", "모두를 위한 기능", "필요한 기능부터 만듭니다", "제가 안 쓰는 기능은 나중에."],
  ["화면", "누구나 쓰는 화면", "화면도 제 손에 맞춥니다", "제가 쓰기 편하면 됩니다."],
];
const FLOW = [
  "Agent OS · 대본과 목소리 설정을 찾고, 수정할 곳을 기억합니다.",
  "Factory · 제작 엔진이 맡은 결과를 하나씩 내놓습니다.",
  "저는 · 완성된 영상을 듣고, 틀린 곳만 다시 맡깁니다.",
];
/** 19번의 제목. 20번은 따로 그린다. */
const FACTORY_HEAD: { kicker: string; title: ReactNode; lead: ReactNode }[] = [
  { kicker: "Factory 안", title: <>일마다 맞춘 모델이<br/>대기하고 있습니다</>, lead: "요청이 오면 맞는 스테이션 하나만 켜집니다." },
  { kicker: "디지털 월세", title: <>비싼 지능은<br/>판단에만 빌려 씁니다</>, lead: <>만드는 데만 이만큼 나갑니다.<br/>매일 반복하는 생산은 제 컴퓨터의 모델에게 맡깁니다.</> },
  { kicker: "그래서 공장입니다", title: <>각자<br/>자기 일만 합니다</>, lead: "새 일이 생기면 스테이션을 하나 더 들이면 됩니다." },
];

export default function OneUserStory({ part, step }: { part: 0 | 1 | 2 | 3; step: number }) {
  const phase = [0, 2, 5, 8][part] + step;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Partial<Record<AnchorId, HTMLDivElement | null>>>({});
  const world = useRef<OneUserWorld | null>(null);
  const [failed, setFailed] = useState(false);
  const motion = usePerformanceMotion();
  const motionRef = useRef(motion); motionRef.current = motion;
  const phaseRef = useRef(phase); phaseRef.current = phase;

  useEffect(() => {
    const canvas = canvasRef.current!;
    let w: OneUserWorld | null = null, cancelled = false;
    const lost = () => setFailed(true);
    const move = (e: PointerEvent) => w?.setPointer(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1);
    const images = ["/demos/tts-lecture.jpg", "/rent/codex-plan.png", "/rent/claude-usage.png", "/factory-film/03-image.jpg", "/factory-film/04-music.jpg"].map((src) => { const im = new Image(); im.src = src; return im; });
    Promise.all([import("./world"), ...images.map((im) => im.decode()), document.fonts.ready]).then(([mod]) => {
      if (cancelled) return;
      const { createOneUserWorld } = mod as typeof import("./world");
      try { w = createOneUserWorld(canvas, { lecture: images[0], codex: images[1], claude: images[2], image: images[3], music: images[4] }, phaseRef.current, motionRef.current); }
      catch { setFailed(true); return; }
      world.current = w;
      const live = w;
      canvas.addEventListener("oneuser-lost", lost);
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
    return () => { cancelled = true; removeEventListener("pointermove", move); canvas.removeEventListener("oneuser-lost", lost); w?.dispose(); world.current = null; };
  }, []);
  useEffect(() => { world.current?.setPhase(phase); }, [phase]);
  useEffect(() => { world.current?.setMotion(motion); }, [motion]);

  const active = new Map(labelsFor(phase).map((l) => [l.id, l]));
  const names = ["사용자는 저 한 명", "자비스에 맡기고 싶은 일", "공장 안", "제가 건 것"];
  return <Frame n={16 + part} name={names[part]} step={step} className={`personal-v2 one-user one-user--${part}`}>
    <div className="iw ou" data-fallback={failed || undefined} data-phase={phase} aria-hidden="true">
      <canvas ref={canvasRef} className="iw-canvas" width={1920} height={1080}/>
      <div className="iw-shade ou-shade" data-phase={phase}/>
      <div className="iw-labels" ref={labelsRef}>
        {ALL_IDS.map((id) => {
          const l = active.get(id);
          return <div key={id} ref={(el) => { labelRefs.current[id] = el; }} className="iw-label" data-on={(l && !failed) || undefined} data-fade={l?.fade || undefined} data-tone={l?.tone ?? "ice"} data-dir={l?.dir ?? "up"} data-size={l?.size}>
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

    {part === 0 && <>
      <div className="ou-heading" key="h0"><p className="pv-eyebrow">제 도구의 요구사항</p><h1>쓰는 사람은 저 한 명입니다</h1></div>
      <div className="ou-brief" data-on={phase === 0 || undefined}>
        <span>당장 필요한 기능</span>
        <h2>강의 음성을 만들고,<br/>틀린 페이지만<br/><em>다시 만들고 싶었습니다</em></h2>
        <p>여기서부터 시작하면 됩니다.</p>
      </div>
      <div className="ou-spec" data-on={phase === 1 || undefined}>
        <header><span>보통의 서비스</span><b>사용자가 저 한 명일 때</b></header>
        {SPECS.map(([k, from, to, why], i) => <div className="ou-spec__row" key={k} style={{ "--i": i } as CSSProperties}>
          <span className="ou-spec__key">{k}</span>
          <div className="ou-spec__track"><small>{from}</small><i/><b/></div>
          <div className="ou-spec__to"><strong>{to}</strong><span>{why}</span></div>
        </div>)}
        <div className="ou-spec__row ou-spec__row--lock" style={{ "--i": 4 } as CSSProperties}>
          <span className="ou-spec__key">기록</span>
          <div className="ou-spec__track"><small>그대로</small><i/><b/></div>
          <div className="ou-spec__to"><strong>원본과 작업 기록은 잃어버리면 안 됩니다</strong><span>고치다가 이전 것으로 돌아갈 수 있어야 하니까요.</span></div>
        </div>
      </div>
    </>}
    {part === 1 && <>
      <div className="ou-heading ou-heading--quote" key="h1"><p className="pv-eyebrow">이 도구들을 어떻게 묶을까</p><h1>“이 대본으로 강의 영상을 만들어줘”</h1></div>
      <p className="ou-flow" key={`f${phase}`} data-step={phase - 2}>{FLOW[phase - 2]}</p>
      <p className="ou-status">이렇게 이어서 쓰는 게 목표입니다<span>지금은 각 엔진을 따로 개발하고 있습니다</span></p>
    </>}
    {part === 2 && <>
      <div className="ou-heading of-heading" key={`h${phase}`} data-phase={phase}>
        <p className="pv-eyebrow">{FACTORY_HEAD[step].kicker}</p>
        <h1>{FACTORY_HEAD[step].title}</h1>
        <p className="of-lead">{FACTORY_HEAD[step].lead}</p>
      </div>
      <p className="of-note" data-on={phase === 7 || undefined}>이런 구조를 <b>Compound AI System</b>이라고 부릅니다<span>여러 모델과 도구가 나눠 맡는 AI 시스템 · Berkeley BAIR, 2024</span></p>
      <p className="ou-status of-status" data-phase={phase}>{phase === 6 ? <>2026.09.23 캡처 · 코딩 에이전트 사용분<span>매일 반복하는 생산 비용이 아닙니다</span></> : <>스테이션은 개발 중<span>요청을 나누는 흐름은 아직 구상입니다</span></>}</p>
    </>}
    {part === 3 && <>
      <blockquote className="ob-question" data-on={phase === 8 || undefined} data-small={phase === 9 || undefined}>“결국 영상 만드는 거 아닌가요?”</blockquote>
      {phase === 9 && <div className="ou-heading ob-heading" data-on key="h9">
        <p className="pv-eyebrow">발표자의 판단</p>
        <h1>제가 건 것은<br/>세 가지입니다</h1>
      </div>}
      <p className="ob-next" data-on={phase === 9 || undefined}>그래서 먼저 만든 스테이션들의 결과물입니다 <b aria-hidden="true">→</b></p>
    </>}
    {failed && part < 2 && <div className="ou-fallback">{part === 0 ? <b>1명</b> : <b>Agent OS → Factory → 저</b>}</div>}
    {failed && part === 2 && phase !== 6 && <ul className="ob-fallback">{STATIONS.map((st) => <li key={st.id}>{st.name}<span>{st.model}</span></li>)}</ul>}
    {failed && part === 2 && phase === 6 && <ul className="ob-fallback"><li>₩159,000/월<span>Codex · Pro 플랜</span></li><li>US$72.77<span>Claude · 이번 달 추가 사용량 · 한도 US$76</span></li></ul>}
    {failed && phase === 9 && <ul className="ob-fallback">{labelsFor(9).map((l) => <li key={l.id}>{l.name}<span>{l.sub}</span></li>)}</ul>}
  </Frame>;
}
