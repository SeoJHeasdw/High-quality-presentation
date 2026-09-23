import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import PixelTransition from "./react-bits/abuse/PixelTransition";
import DecryptedText from "./react-bits/abuse/DecryptedText";
import { usePerformanceMotion } from "./usePerformanceMotion";
import "./abuse-interactive.css";

export function Decipher({ text, active }: { text: string; active: boolean }) {
  const motion = usePerformanceMotion();
  return active && motion ? <DecryptedText text={text} speed={60} maxIterations={8} animateOn="view"
    characters="가나다라마바사아자차카타파하01□＋" parentClassName="abuse-decipher" encryptedClassName="abuse-decipher-noise"
    data-react-bits="DecryptedText"/> : <span>{text}</span>;
}

export function useInspection(step: number, onInspect?: (active: boolean) => void) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const active = hovered || focused || pinned;
  useEffect(() => { setHovered(false); setFocused(false); setPinned(false); }, [step]);
  useEffect(() => { onInspect?.(active); }, [active, onInspect]);
  return {
    active, pinned,
    hint: pinned ? "클릭해 고정 해제" : active ? "클릭해 펼쳐두기" : "가리켜서 살펴보기",
    handlers: {
      onPointerEnter: () => setHovered(true),
      onPointerLeave: () => setHovered(false),
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
      onClick: () => setPinned(value => !value),
    },
  };
}

export function InteractivePixelFace() {
  const motion = usePerformanceMotion();
  const root = useRef<HTMLDivElement>(null);
  const [rebuilt, setRebuilt] = useState(false);
  const [revision, setRevision] = useState(0);
  const resetPointer = () => {
    const face = root.current;
    if (!face) return;
    face.removeAttribute("data-tracking");
    face.style.setProperty("--face-dx", "0px");
    face.style.setProperty("--face-dy", "0px");
  };
  useEffect(() => { if (!motion) resetPointer(); }, [motion]);
  const follow = (event: PointerEvent<HTMLButtonElement>) => {
    if (!motion || !root.current) return;
    const face = root.current, rect = face.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    face.dataset.tracking = "true";
    face.style.setProperty("--pointer-x", `${Math.round(x * 64) / 64 * 100}%`);
    face.style.setProperty("--pointer-y", `${Math.round(y * 36) / 36 * 100}%`);
    face.style.setProperty("--face-dx", `${(x - .65) * 34}px`);
    face.style.setProperty("--face-dy", `${(y - .5) * 25}px`);
  };
  return <div ref={root} className="abuse-face abuse-face-interactive" data-rebuilt={rebuilt || undefined}
    data-revision={revision} data-motion-enabled={motion}>
    <div className="abuse-face-plane">
      <PixelTransition active={rebuilt} motionEnabled={motion} gridSize={32} rows={18}
        pixelColor="#1c5830" animationStepDuration={.43}
        firstContent={<img src="/abuse/pixel-face.png" alt=""/>}
        secondContent={<div className="abuse-face-rebuilt"><img src="/abuse/pixel-face.png" alt=""/><div className="abuse-face-matrix"/><span className="abuse-face-identity"><Decipher text="누가 만들었을까요?" active={rebuilt}/></span></div>}/>
      <div className="abuse-face-detail" aria-hidden="true"><img src="/abuse/pixel-face.png" alt=""/></div>
    </div>
    <div className="abuse-face-aim" aria-hidden="true"><i/><i/><i/><i/></div>
    <button type="button" className="abuse-face-control" aria-label="픽셀 얼굴 다시 구성하기" aria-pressed={rebuilt}
      onPointerMove={follow} onPointerLeave={resetPointer} onBlur={resetPointer}
      onClick={() => { setRebuilt(value => !value); setRevision(value => value + 1); }}>
      <span>포인터로 살펴보기 <i/> 클릭해 다시 구성</span>
    </button>
  </div>;
}

export function EvidenceInspection({ children, step }: { children: ReactNode; step: number }) {
  const motion = usePerformanceMotion();
  const inspection = useInspection(step);
  return <div className="abuse-message-concept abuse-evidence-inspection" data-inspecting={inspection.active || undefined}
    data-pinned={inspection.pinned || undefined}>
    <PixelTransition active={inspection.active} motionEnabled={motion} gridSize={16} rows={8}
      pixelColor="#205338" animationStepDuration={.26} firstContent={children}
      secondContent={<div className="abuse-evidence-back">
        <span className="abuse-inspection-kicker">음성을 살펴보면</span>
        <div className="abuse-evidence-equation"><span>그럴듯한 음성</span><b>≠</b><strong><Decipher text="확인된 사실" active={inspection.active}/></strong></div>
        <span className="abuse-inspection-caption">주장과 사실을 구분해야 합니다.</span>
      </div>}/>
    <button type="button" className="abuse-inspection-control" aria-label="가상의 음성 메시지 살펴보기"
      aria-expanded={inspection.active} aria-pressed={inspection.pinned} {...inspection.handlers}>
      <span>{inspection.hint} <b aria-hidden="true">＋</b></span>
    </button>
    <div className="abuse-message-route"><span>배우자에게 전달</span><i aria-hidden="true"/><span>?</span></div>
  </div>;
}

export function MediaInspection({ children, step, onInspect }: { children: ReactNode; step: number; onInspect: (active: boolean) => void }) {
  const motion = usePerformanceMotion();
  const inspection = useInspection(step, onInspect);
  const root = useRef<HTMLDivElement>(null);
  const resetPointer = () => {
    root.current?.style.setProperty("--media-rx", "0deg");
    root.current?.style.setProperty("--media-ry", "0deg");
  };
  useEffect(() => { if (!motion) resetPointer(); }, [motion]);
  const tilt = (event: PointerEvent<HTMLButtonElement>) => {
    if (!motion || !root.current) return;
    const rect = root.current.getBoundingClientRect();
    root.current.style.setProperty("--media-rx", `${((event.clientY - rect.top) / rect.height - .5) * -10}deg`);
    root.current.style.setProperty("--media-ry", `${((event.clientX - rect.left) / rect.width - .5) * 12}deg`);
  };
  return <div ref={root} className="abuse-media-original abuse-media-inspection" data-inspecting={inspection.active || undefined}
    data-pinned={inspection.pinned || undefined}>
    <div className="abuse-media-tilt">
      <PixelTransition active={inspection.active} motionEnabled={motion} gridSize={15} rows={9}
        pixelColor="#204b2b" animationStepDuration={.3} firstContent={children}
        secondContent={<div className="abuse-media-back">
          <span className="abuse-inspection-kicker">이미지 밖에서 확인할 것</span>
          <strong><Decipher text="누가 만들었나요?" active={inspection.active}/></strong>
          <div className="abuse-media-questions"><span>원본은?</span><span>당사자의 동의는?</span></div>
          <span className="abuse-inspection-caption">보이는 장면만으로는 알 수 없습니다.</span>
        </div>}/>
      <button type="button" className="abuse-inspection-control" aria-label="이미지의 출처와 동의 살펴보기"
        aria-expanded={inspection.active} aria-pressed={inspection.pinned} {...inspection.handlers}
        onPointerMove={tilt} onPointerLeave={() => { inspection.handlers.onPointerLeave(); resetPointer(); }}>
        <span>{inspection.hint} <b aria-hidden="true">＋</b></span>
      </button>
    </div>
  </div>;
}
