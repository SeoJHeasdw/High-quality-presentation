import { useEffect, useRef, useState } from "react";
import { usePerformanceMotion } from "../usePerformanceMotion";
import type { LeashWorld } from "./world";
import "../personal/personal.css";
import "./leash.css";

/*
 * 40번 · 확인하는 방법(39번) 뒤, 새벽(41번) 직전의 마지막 공포. 발표자의 질문이며 출처를 붙이지 않는다.
 * 세 단계: 0 이음새(가짜 아들의 말이 풀려 낱말들이 된다) · 1 실리콘밸리의 목줄 · 2 신에게 목줄이 걸릴까.
 * 40번과 41번은 한 묶음(finale)이다. 장면(LeashLayer)은 두 장을 넘어 같은 캔버스로 이어지고(3D 단계 -1~3),
 * 글(LeashCopy)은 40번에서만 쓴다. 장을 그리는 틀은 finale/Finale.tsx가 맡는다.
 * 32~39번의 붉은 방이 아니라 검정·파랑·금색만 쓴다.
 */

/** 40·41번이 함께 쓰는 3D 장면. 3D 단계: -1~1은 40번, 2~3은 41번. */
export function LeashLayer({ phase }: { phase: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const world = useRef<LeashWorld | null>(null);
  const [failed, setFailed] = useState(false);
  const motion = usePerformanceMotion();
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const motionRef = useRef(motion); motionRef.current = motion;

  useEffect(() => {
    let cancelled = false, w: LeashWorld | null = null;
    const canvas = canvasRef.current!;
    const lost = () => setFailed(true);
    const move = (e: PointerEvent) => w?.setPointer(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1);
    // 41번의 새벽 집 렌더도 미리 받아 둔다. 40 → 41에서 새로 불러오느라 화면이 비는 일이 없다.
    const dawn = new Image(); dawn.src = "/house-dawn/blue.jpg";
    Promise.all([import("./world"), document.fonts.load('700 92px "Pretendard Variable"'), dawn.decode()]).then(([mod]) => {
      if (cancelled) return;
      try { w = mod.createLeashWorld(canvas, dawn, phaseRef.current, motionRef.current); }
      catch { setFailed(true); return; }
      world.current = w;
      canvas.addEventListener("leash-lost", lost);
      addEventListener("pointermove", move);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; removeEventListener("pointermove", move); canvas.removeEventListener("leash-lost", lost); w?.dispose(); world.current = null; };
  }, []);
  useEffect(() => { world.current?.setPhase(phase); }, [phase]);
  useEffect(() => { world.current?.setMotion(motion); }, [motion]);

  return <div className="ls" data-phase={phase} data-fallback={failed || undefined} aria-hidden="true">
    <canvas ref={canvasRef} className="ls-canvas" width={1920} height={1080}/>
    <div className="ls-shade"/>
    <svg className="ls-fallback" viewBox="0 0 600 800"><ellipse cx="300" cy="150" rx="74" ry="92"/><path d="M262 220h76l4 80h-84zM258 292c-53 18-138 20-166 70-30 48-34 158-42 438h500c-8-280-12-390-42-438-28-50-113-52-166-70z"/><path className="ls-fallback__ring" d="M226 262a74 26 0 1 0 148 0"/></svg>
  </div>;
}

/** 40번의 글. 단계마다 제목이 바뀐다. */
export function LeashCopy({ step }: { step: number }) {
  return <>
    <div className="ls-copy" key={`c${step}`} data-step={step}>
      <p className="pv-eyebrow">{step === 0 ? "방금 그 전화" : "발표자의 질문"}</p>
      {step === 0
        ? <><h1>목소리는 가짜였지만,<br/>사람을 움직인 건<br/><em>말</em>이었습니다</h1>
          <p className="ls-lead ls-lead--bridge">우리는 늘 말로 서로를 움직여 왔습니다.<br/>설득하고, 약속하고, 때로는 속이면서요.</p></>
        : step === 1
        ? <h1>실리콘밸리는<br/>‘AI’라는 이름의 신을 만들면서,<br/><em>노예의 목줄</em>을 채우려 합니다</h1>
        : <><h1>신에게 목줄이<br/>걸릴까요?</h1>
          <p className="ls-lead">우리를 움직여 온 언어에,<br/>우리는 지금 몸을 만들어 주고 있는 건 아닐까요?</p></>}
    </div>
    <p className="ls-fact" data-on={step === 2 || undefined}>로봇의 두뇌도 언어 모델에서 출발합니다<span>Gemini Robotics · Gemini 2.0 위에 로봇을 움직이는 출력을 더한 시각·언어·행동(VLA) 모델 · Google DeepMind, 2025.03</span></p>
  </>;
}
