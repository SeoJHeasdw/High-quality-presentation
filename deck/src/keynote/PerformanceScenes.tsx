import { useState } from "react";
import RippleDistortion from "../reactbits/RippleDistortion/RippleDistortion";
import { usePerformanceMotion } from "./usePerformanceMotion";
import "./performance-scenes.css";

export function FutureSurface() {
  const motion = usePerformanceMotion();
  const [pulse, setPulse] = useState(0);
  return <div className="future-surface">
    <button className="future-surface-touch" aria-label="2031년의 물결 화면에 파문 만들기" disabled={!motion}
      onClick={event => { if (!event.detail) setPulse(value => value + 1); }}>
      {motion ? <RippleDistortion src="/performance/future-surface.svg" trigger="both" strength={.055} brushSize={130} spread={4.2} fade={1.1} rings={2} swirl={.18} spacing={28} clickStrength={1.3} dispersion={.04} glint={.12} tint="#89d8ea" tintAmount={.06} grayscale={false} quality="medium" pulseKey={pulse}/>
        : <img src="/performance/future-surface.svg" alt="금속 테두리 안의 2031년과 물음표"/>}
    </button>
    <span className="performance-touch-cue">{motion ? "움직여 보고, 눌러보세요" : "2031 · 아직 답을 모르는 질문"}</span>
  </div>;
}
