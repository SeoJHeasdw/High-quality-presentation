import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePerformanceMotion } from "../usePerformanceMotion";
import type { BlueprintWorld, RoomId } from "./blueprint";
import "../incident/incident.css";

/*
 * 43번 · 공장은 계속 늘어난다(세 단계). 3D는 finale/blueprint.ts, 방 이름·상태 라벨은 여기의 DOM이 맡는다.
 * RICE 방 벽의 영상은 실제 RICE 소개 영상이며 소리 없이 재생한다. P는 재생·일시정지, A는 소리다.
 * WebGL을 쓸 수 없으면 기존 평면 설계도(fallback)를 그린다.
 */
type Tone = "gold" | "ice" | "mute";
type Label = { id: RoomId; name: ReactNode; sub?: string; tag?: string; tone: Tone; dir?: "up" | "left" | "right" };
const BUILT: Label[] = [
  { id: "tts", name: "TTS", sub: "목소리 · 강의 영상", tag: "개발 중", tone: "gold" },
  { id: "assets", name: "ASSETS", sub: "이미지 · 3D", tag: "개발 중", tone: "gold" },
  { id: "music", name: "MUSIC", sub: "음악", tag: "개발 중", tone: "gold" },
  { id: "rice", name: "RICE", sub: "로컬 업무 에이전트", tag: "만듦", tone: "gold" },
  { id: "cio", name: "Personal CIO", sub: "주식 판단 기록 · 주문은 제가 결정", tag: "만듦", tone: "gold" },
];
function labelsFor(phase: number): Label[] {
  if (phase === 0) return [...BUILT, { id: "os", name: "Agent OS", sub: "제 맥락으로 잇는 부분", tag: "구상", tone: "ice" }, { id: "door", name: "저", tone: "gold", dir: "left" }];
  if (phase === 1) return [
    ...BUILT.map((l) => ({ ...l, sub: undefined, tag: undefined, tone: "mute" as Tone })),
    { id: "comboStock", name: "주식 분석 영상 · 분석 서비스 · 제 투자 판단 기록", sub: "영상 공장 × Personal CIO", tag: "가능성", tone: "gold" },
    { id: "comboLecture", name: "강의 채널", sub: "목소리 × 강의", tag: "이미 하는 일", tone: "gold", dir: "left" },
  ];
  return [
    { id: "excel", name: "엑셀 자동화", tag: "가정", tone: "ice", dir: "left" },
    { id: "browser", name: "브라우저 조작", tag: "가정", tone: "ice" },
    { id: "pdf", name: "PDF ↔ PPT", tag: "가정", tone: "ice" },
    { id: "doc", name: "문서 가로 ↔ 세로", tag: "가정", tone: "ice" },
  ];
}
const IDS: RoomId[] = ["tts", "assets", "music", "rice", "cio", "os", "door", "comboStock", "comboLecture", "excel", "browser", "pdf", "doc"];

export default function Blueprint3D({ step, fallback }: { step: number; fallback: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Partial<Record<RoomId, HTMLDivElement | null>>>({});
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
      live.onFrame(() => {
        if (labelsRef.current) labelsRef.current.style.opacity = live.labelAlpha().toFixed(3);
        for (const id of IDS) {
          const el = labelRefs.current[id]; if (!el) continue;
          const { x, y, visible } = live.project(id);
          el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
          el.style.visibility = visible ? "" : "hidden";
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
    {failed && fallback}
  </div>;
}
