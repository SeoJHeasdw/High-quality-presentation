import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Frame } from "../KeynoteFrame";
import { usePerformanceMotion } from "../usePerformanceMotion";
import type { AnchorId, OneUserWorld } from "./world";
import "../incident/incident.css";
import "./personal.css";

/*
 * 19~22번은 하나의 공간이다(묶음 one-user).
 *   19번 두 단계 → phase 0~1, 20번 세 단계 → 2~4, 21번 세 단계 → 5~7, 22번 세 단계 → 8~10.
 * 3D는 personal/world.ts, 요구사항 표·설명·라벨은 여기의 DOM이 맡는다.
 * 19번(공장 안)의 모델 이름은 각 엔진 README의 제작 모델이다(FACT-CHECK 18행). 스테이션은 개발 중이다.
 * 위계(프론티어 모델 = 임원 → RICE = 현장 관리자 → 스테이션)에서 RICE가 일을 나누고 프론티어가 지켜보다 직접 내려오는 흐름은 구상이다.
 * 22번은 "결국 영상 만드는 거 아닌가요?"에 답한다: 기업이었다면 같은 공장에 다른 스테이션이 선다(22-1, 발표자의 가정) → 저는 개인이라 제 것을 넣었다(22-2).
 */
type Tone = "ice" | "amber" | "gold" | "mute" | "white" | "teal";
/** at: 단계가 시작되고 몇 초 뒤에 나타나는지. 3D 장면에서 그 일이 일어나는 때에 맞춘다(world.ts). */
type Label = { id: AnchorId; name: ReactNode; sub?: string; tone?: Tone; tag?: string; dir?: "up" | "left" | "right" | "down"; fade?: boolean; size?: "lg"; at?: number };
const STATIONS: { id: AnchorId; name: string; model: string }[] = [
  { id: "stVoice", name: "목소리", model: "Qwen3-TTS + 제 목소리 어댑터" },
  { id: "stStt", name: "받아쓰기 검수", model: "Whisper large-v3-turbo" },
  { id: "stAssets", name: "이미지 · 3D", model: "FLUX.2 klein · TRELLIS.2" },
  { id: "stMusic", name: "음악", model: "ACE-Step 1.5" },
];
function labelsFor(p: number): Label[] {
  if (p === 0) return [{ id: "me", name: "저 한 명", sub: "저에게 맞춰 만든 도구", tone: "gold", dir: "up" }, { id: "crowd", name: "사서 쓰는 소프트웨어", sub: "여러 사람에게 맞춘 공통 기능", tone: "mute", dir: "up", fade: true }];
  if (p === 1) return [{ id: "me", name: "나", tone: "gold", dir: "up" }];
  if (p === 2) return [{ id: "me", name: "나", sub: "요청 한 문장", tone: "gold", dir: "left" }, { id: "os", name: "Agent OS", sub: "순서를 정하고 작업을 챙깁니다", tone: "ice", tag: "구상", dir: "up" }];
  if (p === 3) return [{ id: "os", name: "Agent OS", tone: "mute", tag: "구상", dir: "up" }, { id: "factory", name: "Factory", sub: "음성·자막·화면을 만듭니다", tone: "ice", tag: "개발 중", dir: "up" }, { id: "out", name: "강의 영상", tone: "gold", dir: "right" }];
  if (p === 4) return [{ id: "me", name: "저는", sub: "들어보고 틀린 곳을 고칩니다", tone: "gold", dir: "left" }, { id: "redo", name: "“이 페이지 발음만 다시 만들어줘.”", tone: "gold", dir: "up" }, { id: "os", name: "Agent OS", tone: "mute", tag: "구상", dir: "up" }, { id: "factory", name: "Factory", tone: "mute", tag: "개발 중", dir: "up" }];
  // 양 끝 스테이션의 라벨은 바깥쪽으로 뺀다(안쪽 두 라벨과 위의 RICE에 자리를 준다)
  const stations = (tone: Tone, sub = true): Label[] => STATIONS.map((s) => ({ id: s.id, name: s.name, sub: sub ? s.model : undefined, tone, dir: !sub ? "up" : s.id === "stVoice" ? "right" : s.id === "stMusic" ? "left" : "up" }));
  const frontier: Label = { id: "frontier", name: "프론티어 모델", sub: "맡기고 지켜보다, 막히면 직접 합니다", tone: "white", tag: "임원", dir: "up" };
  const rice: Label = { id: "rice", name: "업무 에이전트 RICE", sub: "qwen3.6 35B · 엔진에 일을 나눕니다", tone: "teal", tag: "현장 관리자 · 구상", dir: "right" };
  if (p === 5) return [...stations("ice"), frontier, rice];
  if (p === 6) return [{ ...frontier, sub: "구독과 추가 사용량 · 월 20만원 이상" }, { id: "rentCodex", name: <>₩159,000<small>/월</small></>, sub: "Codex · Pro 플랜", tone: "white", dir: "down", size: "lg" }, { id: "rentClaude", name: <>US$72.77</>, sub: "Claude · 이번 달 추가 사용량 · 한도 US$76", tone: "white", dir: "down", size: "lg" }];
  if (p === 7) return [...stations("ice", false), { ...frontier, sub: "판단하고 지켜봅니다" }, { ...rice, name: "RICE", sub: "일을 나눕니다", tag: "현장 관리자" }];
  if (p === 8) return [];
  // 22-1 · 기업이었다면(가정). 쉬운 이름을 위에, 기술 이름을 아래에 둔다. at은 핵이 내려앉는 때(world.ts SWAP_AT + SWAP_DUR)다.
  if (p === 9) return [
    { id: "stMusic", name: "데이터 조회", sub: "Text-to-SQL", tone: "white", dir: "left", at: 1.5 },
    { id: "stAssets", name: "문서 검색", sub: "RAG", tone: "white", dir: "up", at: 1.9 },
    { id: "stStt", name: "회의 정리", sub: "STT · Teams 회의 받아쓰기", tone: "white", dir: "up", at: 2.2 },
    { id: "stVoice", name: "＋ 다음 업무", sub: "필요해지면 하나 더", tone: "mute", dir: "right", at: 2.7 },
    { ...frontier, sub: "판단하고 지켜봅니다" },
    { ...rice, name: "관리자 Agent", sub: "엔진에 일을 나눕니다", tag: "현장 관리자" },
  ];
  // 22-2 · 저는 개인이라: 제 스테이션으로 돌아온다
  return [...stations("gold", false), { ...frontier, sub: "판단하고 지켜봅니다" }, { ...rice, name: "RICE", sub: "일을 나눕니다", tag: "현장 관리자" }];
}
const ALL_IDS: AnchorId[] = ["me", "crowd", "os", "factory", "out", "redo", "stVoice", "stStt", "stAssets", "stMusic", "rice", "frontier", "rentCodex", "rentClaude"];

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
/** 21번의 제목 */
const FACTORY_HEAD: { kicker: string; title: ReactNode; lead: ReactNode }[] = [
  { kicker: "Factory 안", title: <>프론티어는 임원,<br/>RICE는 현장 관리자</>, lead: <>일은 RICE가 엔진에 나눠 주고, 프론티어는 지켜봅니다.<br/>RICE가 막히면 그때 직접 내려옵니다.</> },
  { kicker: "디지털 월세", title: <>비싼 지능은<br/>판단에만 빌려 씁니다</>, lead: <>만드는 데만 이만큼 나갑니다.<br/>모든 일을 임원에게 시키면 토큰이 남아나지 않습니다.</> },
  { kicker: "그래서 공장입니다", title: <>각자<br/>자기 일만 합니다</>, lead: <>임원은 판단하고, 관리자는 나누고, 스테이션은 만듭니다.<br/>새 일이 생기면 스테이션을 하나 더 들이면 됩니다.</> },
];
/** 22번의 답 두 단계: 기업이었다면(phase 9) → 저는 개인이라(phase 10) */
const ANSWER_HEAD: { kicker: string; title: ReactNode; lead: ReactNode }[] = [
  { kicker: "맞습니다. 저 한 명에게 맞췄습니다", title: <>기업이었다면<br/>스테이션이 달랐을 겁니다</>, lead: <>쓰는 사람이 바뀌면 들어가는 엔진이 바뀝니다.<br/>임원 · 관리자 · 스테이션의 구조는 그대로입니다.</> },
  { kicker: "저는 개인이라", title: <>제가 쓸 것을<br/>넣었습니다</>, lead: <>스테이션은 갈아 끼우면 됩니다.<br/>남는 것은 공장입니다.</> },
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
    const images = ["/demos/tts-lecture.jpg", "/rent/codex-plan.png", "/rent/claude-usage.png"].map((src) => { const im = new Image(); im.src = src; return im; });
    Promise.all([import("./world"), ...images.map((im) => im.decode()), document.fonts.ready]).then(([mod]) => {
      if (cancelled) return;
      const { createOneUserWorld } = mod as typeof import("./world");
      try { w = createOneUserWorld(canvas, { lecture: images[0], codex: images[1], claude: images[2] }, phaseRef.current, motionRef.current); }
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
  const names = ["사지 않고 만들어 씁니다", "자비스에 맡기고 싶은 일", "공장 안", "기업이었다면"];
  return <Frame n={16 + part} name={names[part]} step={step} className={`personal-v2 one-user one-user--${part}`}>
    <div className="iw ou" data-fallback={failed || undefined} data-phase={phase} aria-hidden="true">
      <canvas ref={canvasRef} className="iw-canvas" width={1920} height={1080}/>
      <div className="iw-shade ou-shade" data-phase={phase}/>
      <div className="iw-labels" ref={labelsRef}>
        {ALL_IDS.map((id) => {
          const l = active.get(id);
          return <div key={id} ref={(el) => { labelRefs.current[id] = el; }} className="iw-label" data-on={(l && !failed) || undefined} data-fade={l?.fade || undefined} data-tone={l?.tone ?? "ice"} data-dir={l?.dir ?? "up"} data-size={l?.size}
            style={l?.at ? { transitionDelay: `${l.at}s` } : undefined}>
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
      {phase === 0
        ? <div className="ou-heading" key="h0"><p className="pv-eyebrow">사는 소프트웨어에서, 만드는 소프트웨어로</p><h1>이제는 사지 않고, 만들어 씁니다</h1></div>
        : <div className="ou-heading" key="h1"><p className="pv-eyebrow">제 강의 음성 도구의 요구사항</p><h1>쓰는 사람은 저 한 명입니다</h1></div>}
      <div className="ou-brief" data-on={phase === 0 || undefined}>
        <span>코드 값이 싸졌습니다</span>
        <h2>포토샵이 필요하면?<br/><em>쓸 기능만 직접 만듭니다</em></h2>
        <p>엔지니어의 한 시간이 비쌀 때는 사서 썼습니다.<br/>이제는 그 한 시간이 싸졌습니다.</p>
      </div>
      <div className="ou-spec" data-on={phase === 1 || undefined}>
        <header><span>사서 쓰는 소프트웨어</span><b>저 한 명을 위해 만들 때</b></header>
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
      <p className="ou-status of-status" data-phase={phase}>{phase === 6 ? <>2026.09.23 캡처 · 코딩 에이전트 사용분<span>매일 반복하는 생산 비용이 아닙니다</span></> : <>스테이션은 개발 중<span>RICE가 일을 나누고 프론티어가 지켜보는 흐름은 구상입니다</span></>}</p>
    </>}
    {part === 3 && <>
      <blockquote className="ob-question" data-on={phase === 8 || undefined} data-small={phase >= 9 || undefined}>“결국 영상 만드는 거 아닌가요?”</blockquote>
      {phase >= 9 && <div className="ou-heading of-heading ob-heading" data-on key={`h${phase}`}>
        <p className="pv-eyebrow">{ANSWER_HEAD[phase - 9].kicker}</p>
        <h1>{ANSWER_HEAD[phase - 9].title}</h1>
        <p className="of-lead">{ANSWER_HEAD[phase - 9].lead}</p>
      </div>}
      <p className="of-note ob-note" data-on={phase === 9 || undefined}>스테이션만 다른 <b>Compound AI System</b>입니다<span>모델 하나가 아니라, 일마다 맞춘 엔진이 나눠 맡습니다</span></p>
      <p className="ob-next" data-on={phase === 10 || undefined}>그래서 먼저 만든 스테이션들의 결과물입니다 <b aria-hidden="true">→</b></p>
    </>}
    {failed && part < 2 && <div className="ou-fallback">{part === 0 ? <b>1명</b> : <b>Agent OS → Factory → 저</b>}</div>}
    {failed && part === 2 && phase !== 6 && <ul className="ob-fallback">{STATIONS.map((st) => <li key={st.id}>{st.name}<span>{st.model}</span></li>)}</ul>}
    {failed && part === 2 && phase === 6 && <ul className="ob-fallback"><li>₩159,000/월<span>Codex · Pro 플랜</span></li><li>US$72.77<span>Claude · 이번 달 추가 사용량 · 한도 US$76</span></li></ul>}
    {failed && phase >= 9 && <ul className="ob-fallback ob-fallback--answer">{labelsFor(phase).filter((l) => l.id !== "frontier").map((l) => <li key={l.id}>{l.name}<span>{l.sub}</span></li>)}</ul>}
  </Frame>;
}
