import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { usePerformanceMotion } from "../usePerformanceMotion";
import { combosOf, type BlueprintWorld, type RoomId } from "./blueprint";
import "../incident/incident.css";

/*
 * 43번 · 방은 계속 늘어나고 조합은 두 배 넘게 는다(다섯 단계). 마지막 단계는 방 하나에서 뻗는 사례 세 개다. 3D는 finale/blueprint.ts, 방 이름·상태 라벨과 조합의 수는 여기의 DOM이 맡는다.
 * 조합의 수는 3D 장면에 실제로 선 방의 수(tally)를 매 프레임 따라간다.
 * RICE 방 벽의 영상은 실제 RICE 소개 영상이며 소리 없이 재생한다. P는 재생·일시정지, A는 소리다.
 * WebGL을 쓸 수 없으면 기존 평면 설계도(fallback)를 그린다.
 */
type Tone = "gold" | "ice" | "mute";
/** lift: 줄기를 그만큼(px) 늘려 라벨을 더 멀리 단다. 가까운 방의 라벨끼리 겹치지 않게 할 때만 쓴다. */
type LabelId = Exclude<RoomId, "field">;
type Label = { id: LabelId; name: ReactNode; sub?: string; tag?: string; tone: Tone; dir?: "up" | "down" | "left" | "right"; lift?: number };
const BUILT: Label[] = [
  { id: "tts", name: "TTS", sub: "목소리 · 강의 영상", tag: "개발 중", tone: "gold" },
  { id: "assets", name: "ASSETS", sub: "이미지 · 3D", tag: "개발 중", tone: "gold" },
  { id: "music", name: "MUSIC", sub: "음악", tag: "개발 중", tone: "gold" },
  { id: "rice", name: "RICE", sub: "로컬 업무 에이전트", tag: "만듦", tone: "gold" },
  // Personal CIO의 라벨은 넓어서 바로 왼쪽 MUSIC 라벨의 윗모서리를 덮는다. 조금 더 높이 단다.
  { id: "cio", name: "Personal CIO", sub: "주식 판단 기록 · 주문은 제가 결정", tag: "만듦", tone: "gold", lift: 32 },
];
const ME: Label = { id: "door", name: "나", tone: "gold", dir: "left" };
const CASES: Label[] = [
  { id: "caseCast", name: "주식 방송", sub: "목소리 × 영상 × Personal CIO", tag: "가능성", tone: "gold" },
  { id: "caseSell", name: "주식 프로그램 판매", sub: "Personal CIO를 제품으로", tag: "가능성", tone: "gold" },
  { id: "caseData", name: "프로그램 공개 · 데이터 판매", sub: "동의받은 익명 데이터를 금융회사에", tag: "가능성", tone: "gold" },
];
const CASE_IDS = new Set<LabelId>(["caseCast", "caseSell", "caseData"]);
function labelsFor(phase: number): Label[] {
  if (phase === 0) return [...BUILT, { id: "os", name: "Agent OS", sub: "제 맥락으로 잇는 부분", tag: "구상", tone: "ice" }, ME];
  // 조합 단계: 빛이 나가는 방(TTS·ASSETS·Personal CIO)만 흐린 이름을 남긴다. RICE 이름은 조합 라벨과 같은 자리에 겹친다.
  if (phase === 1) return [
    ...BUILT.filter((l) => l.id === "tts" || l.id === "assets" || l.id === "cio").map((l) => ({ ...l, sub: undefined, tag: undefined, lift: undefined, tone: "mute" as Tone })),
    { id: "comboStock", name: "주식 분석 영상 · 분석 서비스 · 제 투자 판단 기록", sub: "영상 공장 × Personal CIO", tag: "가능성", tone: "gold" },
    { id: "comboLecture", name: "강의 채널", sub: "목소리 × 강의", tag: "이미 하는 일", tone: "gold", dir: "left" },
  ];
  // 번져 가는 방: 이름 대신 왼쪽의 조합의 수가 이야기한다. 모든 거리는 현관(나)에서 시작한다.
  if (phase === 3) return [ME];
  // 방 하나(Personal CIO)에서 뻗는 갈래. 줄이 닿는 순서대로 하나씩 맺힌다(reveal).
  if (phase >= 4) return [ME, { id: "cio", name: "Personal CIO", tone: "gold", dir: "right" }, ...CASES];
  // 사무직의 방: 뒷줄(엑셀·PDF)과 문서는 지붕 위로, 앞줄 브라우저는 방 앞 바닥 아래로 단다(blueprint.ts의 BELOW).
  return [
    { id: "excel", name: "엑셀 자동화", tag: "가정", tone: "ice" },
    { id: "browser", name: "브라우저 조작", tag: "가정", tone: "ice", dir: "down" },
    { id: "pdf", name: "PDF ↔ PPT", tag: "가정", tone: "ice", lift: 64 },
    { id: "doc", name: "문서 가로 ↔ 세로", tag: "가정", tone: "ice" },
  ];
}
const IDS: LabelId[] = ["caseCast", "caseSell", "caseData", "tts", "assets", "music", "rice", "cio", "os", "door", "comboStock", "comboLecture", "excel", "browser", "pdf", "doc"];

/** 단계가 끝났을 때 선 방의 수(처음 그릴 때와 모션을 끈 화면의 숫자) */
const FINAL_N = [5, 5, 9, 40, 40];
/** 26 · 502 · 65,519 · 104만 · 1.3억 · 1.1조처럼 읽히는 단위로 */
function formatCount(v: number) {
  if (v < 1e5) return v.toLocaleString("en-US");
  if (v < 1e8) return `${Math.round(v / 1e4).toLocaleString("en-US")}만`;
  if (v < 1e12) return v < 1e9 ? `${(v / 1e8).toFixed(1)}억` : `${Math.round(v / 1e8).toLocaleString("en-US")}억`;
  return `${(v / 1e12).toFixed(1)}조`;
}

export default function Blueprint3D({ step, fallback }: { step: number; fallback: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Partial<Record<LabelId, HTMLDivElement | null>>>({});
  const numRef = useRef<HTMLSpanElement>(null), roomsRef = useRef<HTMLElement>(null), supRef = useRef<HTMLElement>(null), nRef = useRef<HTMLSpanElement>(null), exactRef = useRef<HTMLSpanElement>(null);
  const world = useRef<BlueprintWorld | null>(null);
  const [failed, setFailed] = useState(false);
  const motion = usePerformanceMotion();
  const stepRef = useRef(step); stepRef.current = step;
  const motionRef = useRef(motion); motionRef.current = motion;

  useEffect(() => {
    let cancelled = false, w: BlueprintWorld | null = null;
    const canvas = canvasRef.current!, video = videoRef.current!;
    // 원본은 여기서 붙이고 떠날 때 뗀다(개발 모드에서 효과가 두 번 돌아도 영상이 비지 않게).
    video.src = "/demos/rice-demo.mp4"; video.muted = true;
    if (motionRef.current) void video.play().catch(() => {});
    const lost = () => setFailed(true);
    const move = (e: PointerEvent) => w?.setPointer(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1);
    import("./blueprint").then((mod) => {
      if (cancelled) return;
      try { w = mod.createBlueprintWorld(canvas, video, stepRef.current, motionRef.current); }
      catch { setFailed(true); return; }
      world.current = w;
      const live = w;
      canvas.addEventListener("blueprint-lost", lost);
      let shown = { n: -1, value: -1 };
      live.onFrame(() => {
        if (labelsRef.current) labelsRef.current.style.opacity = live.labelAlpha().toFixed(3);
        const { n, value } = live.tally();
        if (value !== shown.value && numRef.current) {
          numRef.current.textContent = formatCount(value);
          if (exactRef.current) exactRef.current.textContent = value >= 1e5 ? `= ${value.toLocaleString("en-US")}` : "";
        }
        if (n !== shown.n) {
          for (const el of [roomsRef.current, supRef.current, nRef.current]) if (el) el.textContent = String(n);
          // 방이 하나 설 때마다 숫자가 한 번 뛴다(2·3단계)
          const num = numRef.current?.parentElement;
          if (num && shown.n > 0) { num.classList.remove("is-bump"); void num.offsetWidth; num.classList.add("is-bump"); }
        }
        shown = { n, value };
        for (const id of IDS) {
          const el = labelRefs.current[id]; if (!el) continue;
          const { x, y, visible } = live.project(id);
          el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
          el.style.visibility = visible ? "" : "hidden";
          // 사례는 금색 줄이 닿는 순간에 맞춰 3D가 직접 켠다(CSS의 늦은 전환을 쓰지 않는다)
          if (CASE_IDS.has(id)) { el.style.transition = "none"; el.style.opacity = live.reveal(id).toFixed(3); }
        }
      });
      addEventListener("pointermove", move);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; removeEventListener("pointermove", move); canvas.removeEventListener("blueprint-lost", lost); w?.dispose(); world.current = null; video.pause(); video.removeAttribute("src"); video.load(); };
  }, []);
  useEffect(() => { world.current?.setPhase(step); }, [step]);
  useEffect(() => { world.current?.setMotion(motion); }, [motion]);
  // RICE 영상: 모션이 켜져 있으면 소리 없이 이어서 재생하고, 끄면 멈춘다. P는 재생·일시정지, A는 소리.
  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    if (motion) { v.muted = true; void v.play().catch(() => {}); } else { v.pause(); if (v.currentTime < 0.1) v.currentTime = 6; }
  }, [motion]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const v = videoRef.current; if (!v) return;
      if (e.key.toLowerCase() === "p") { e.preventDefault(); if (v.paused) void v.play().catch(() => {}); else v.pause(); }
      if (e.key.toLowerCase() === "a") { e.preventDefault(); v.muted = !v.muted; }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const active = new Map(labelsFor(step).map((l) => [l.id, l]));
  return <div className="fb3" data-step={step} data-fallback={failed || undefined}>
    <video ref={videoRef} className="fb3-video" poster="/demos/rice-demo.jpg" muted loop playsInline preload="auto" aria-label="RICE 소개 영상(소리 없음)"/>
    <canvas ref={canvasRef} className="fb3-canvas iw-canvas" width={1920} height={1080} aria-hidden="true"/>
    <div className="iw-labels fb3-labels" ref={labelsRef} aria-hidden="true">
      {IDS.map((id) => {
        const l = active.get(id);
        return <div key={id} ref={(el) => { labelRefs.current[id] = el; }} className="iw-label" data-on={(l && !failed) || undefined} data-tone={l?.tone ?? "ice"} data-dir={l?.dir ?? "up"} style={{ "--lift": `${l?.lift ?? 0}px` } as CSSProperties}>
          <i className="iw-label-dot"/>
          <div className="iw-label-box">
            {l?.tag && <span className="iw-label-tag">{l.tag}</span>}
            <strong>{l?.name}</strong>
            {l?.sub && <span className="iw-label-sub">{l.sub}</span>}
          </div>
        </div>;
      })}
    </div>
    <div className="fb3-count" data-on={(step >= 1 && !failed) || undefined} aria-hidden="true">
      <span className="fb3-count__label">이론상 이을 수 있는 조합</span>
      <strong className="fb3-count__num"><span ref={numRef}>{formatCount(combosOf(FINAL_N[step] ?? 5))}</span><small>가지</small></strong>
      <span className="fb3-count__rooms">방 <b ref={roomsRef}>{FINAL_N[step] ?? 5}</b>개 중 둘 이상을 고르는 경우 · 2<sup ref={supRef}>{FINAL_N[step] ?? 5}</sup> − <span ref={nRef}>{FINAL_N[step] ?? 5}</span> − 1</span>
      <span className="fb3-count__exact" ref={exactRef}/>
    </div>
    {failed && fallback}
  </div>;
}
