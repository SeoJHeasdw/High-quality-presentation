import { useEffect, useRef, useState } from "react";
import { Frame } from "../KeynoteFrame";
import { usePerformanceMotion } from "../usePerformanceMotion";
import type { LeashWorld } from "./world";
import "../personal/personal.css";
import "./leash.css";

/*
 * 40번 · 확인하는 방법(39번) 뒤, 새벽(41번) 직전의 마지막 공포. 발표자의 질문이며 출처를 붙이지 않는다.
 * 세 단계: 0 이음새(가짜 아들의 말이 풀려 낱말들이 된다) · 1 실리콘밸리의 목줄 · 2 신에게 목줄이 걸릴까.
 * 3D의 단계는 -1, 0, 1이다(world.ts). 0·1은 이음새를 넣기 전의 단계 번호 그대로다.
 * 3D는 leash/world.ts(낱말이 모여 몸이 되고, 금색 고리가 닫히지 않는다), 글은 여기의 DOM이 맡는다.
 * 32~39번의 붉은 방이 아니라 검정·파랑·금색만 쓴다.
 */
export default function LeashStory({ step }: { step: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const world = useRef<LeashWorld | null>(null);
  const [failed, setFailed] = useState(false);
  const motion = usePerformanceMotion();
  const phase = step - 1;
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const motionRef = useRef(motion); motionRef.current = motion;

  useEffect(() => {
    let cancelled = false, w: LeashWorld | null = null;
    const canvas = canvasRef.current!;
    const lost = () => setFailed(true);
    const move = (e: PointerEvent) => w?.setPointer(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1);
    Promise.all([import("./world"), document.fonts.load('700 92px "Pretendard Variable"')]).then(([mod]) => {
      if (cancelled) return;
      try { w = mod.createLeashWorld(canvas, phaseRef.current, motionRef.current); }
      catch { setFailed(true); return; }
      world.current = w;
      canvas.addEventListener("leash-lost", lost);
      addEventListener("pointermove", move);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; removeEventListener("pointermove", move); canvas.removeEventListener("leash-lost", lost); w?.dispose(); world.current = null; };
  }, []);
  useEffect(() => { world.current?.setPhase(phase); }, [phase]);
  useEffect(() => { world.current?.setMotion(motion); }, [motion]);

  return <Frame n={39} name="신에게 목줄" step={step} className="personal-v2 leash">
    <div className="ls" data-step={step} data-fallback={failed || undefined} aria-hidden="true">
      <canvas ref={canvasRef} className="ls-canvas" width={1920} height={1080}/>
      <div className="ls-shade"/>
      <svg className="ls-fallback" viewBox="0 0 600 800"><ellipse cx="300" cy="150" rx="74" ry="92"/><path d="M262 220h76l4 80h-84zM258 292c-53 18-138 20-166 70-30 48-34 158-42 438h500c-8-280-12-390-42-438-28-50-113-52-166-70z"/><path className="ls-fallback__ring" d="M226 262a74 26 0 1 0 148 0"/></svg>
    </div>

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
  </Frame>;
}
