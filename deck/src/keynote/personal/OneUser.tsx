import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Frame } from "../KeynoteFrame";
import { usePerformanceMotion } from "../usePerformanceMotion";
import type { AnchorId, OneUserWorld } from "./world";
import "../incident/incident.css";
import "./personal.css";

/*
 * 15~16번은 하나의 공간이다(묶음 one-user). 15번 두 단계, 16번 세 단계가 phase 0~4가 된다.
 * 3D는 personal/world.ts, 요구사항 표·설명·라벨은 여기의 DOM이 맡는다.
 */
type Tone = "ice" | "amber" | "gold" | "mute";
type Label = { id: AnchorId; name: string; sub?: string; tone?: Tone; tag?: string; dir?: "up" | "left" | "right"; fade?: boolean };
function labelsFor(p: number): Label[] {
  if (p === 0) return [{ id: "me", name: "저 한 명", sub: "기획도, 사용도 제가 합니다", tone: "gold", dir: "up" }, { id: "crowd", name: "보통의 서비스", sub: "많은 사용자", tone: "mute", dir: "up", fade: true }];
  if (p === 1) return [{ id: "me", name: "저", tone: "gold", dir: "up" }];
  if (p === 2) return [{ id: "me", name: "저", sub: "요청 한 문장", tone: "gold", dir: "left" }, { id: "os", name: "Agent OS", sub: "순서를 정하고 작업을 챙깁니다", tone: "ice", tag: "구상", dir: "up" }];
  if (p === 3) return [{ id: "os", name: "Agent OS", tone: "mute", tag: "구상", dir: "up" }, { id: "factory", name: "Factory", sub: "음성·자막·화면을 만듭니다", tone: "ice", tag: "개발 중", dir: "up" }, { id: "out", name: "강의 영상", tone: "gold", dir: "right" }];
  return [{ id: "me", name: "저는", sub: "들어보고 틀린 곳을 고칩니다", tone: "gold", dir: "left" }, { id: "redo", name: "“이 페이지 발음만 다시 만들어줘.”", tone: "gold", dir: "up" }, { id: "os", name: "Agent OS", tone: "mute", tag: "구상", dir: "up" }, { id: "factory", name: "Factory", tone: "mute", tag: "개발 중", dir: "up" }];
}
const ALL_IDS: AnchorId[] = ["me", "crowd", "os", "factory", "out", "redo"];

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

export default function OneUserStory({ part, step }: { part: 0 | 1; step: number }) {
  const phase = part === 0 ? step : 2 + step;
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
    const lecture = new Image(); lecture.src = "/demos/tts-lecture.jpg";
    Promise.all([import("./world"), lecture.decode(), document.fonts.ready]).then(([{ createOneUserWorld }]) => {
      if (cancelled) return;
      try { w = createOneUserWorld(canvas, lecture, phaseRef.current, motionRef.current); }
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
  return <Frame n={15 + part} name={part === 0 ? "사용자는 저 한 명" : "자비스에 맡기고 싶은 일"} step={step} className={`personal-v2 one-user one-user--${part}`}>
    <div className="iw ou" data-fallback={failed || undefined} data-phase={phase} aria-hidden="true">
      <canvas ref={canvasRef} className="iw-canvas" width={1920} height={1080}/>
      <div className="iw-shade ou-shade"/>
      <div className="iw-labels" ref={labelsRef}>
        {ALL_IDS.map((id) => {
          const l = active.get(id);
          return <div key={id} ref={(el) => { labelRefs.current[id] = el; }} className="iw-label" data-on={(l && !failed) || undefined} data-fade={l?.fade || undefined} data-tone={l?.tone ?? "ice"} data-dir={l?.dir ?? "up"}>
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

    {part === 0 ? <>
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
    </> : <>
      <div className="ou-heading ou-heading--quote" key="h1"><p className="pv-eyebrow">이 도구들을 어떻게 묶을까</p><h1>“이 대본으로 강의 영상을 만들어줘”</h1></div>
      <p className="ou-flow" key={`f${phase}`} data-step={phase - 2}>{FLOW[phase - 2]}</p>
      <p className="ou-status">이렇게 이어서 쓰는 게 목표입니다<span>지금은 각 엔진을 따로 개발하고 있습니다</span></p>
    </>}
    {failed && <div className="ou-fallback">{part === 0 ? <b>1명</b> : <b>Agent OS → Factory → 저</b>}</div>}
  </Frame>;
}
