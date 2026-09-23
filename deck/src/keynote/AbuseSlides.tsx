import type { ReactNode } from "react";
import type { SlideDef } from "../components/deck-kit";
import { Frame } from "./KeynoteFrame";
import { InteractivePixelFace } from "./AbuseInteractive";
import OwnVoice from "./abuse/OwnVoice";
import { ThresholdScene, MediaScene } from "./abuse/AbuseScenes";
import { PhoneStory, VerifyStory } from "./abuse/PhoneStories";
import MatrixHeadline from "./MatrixHeadline";
import "./abuse-slides.css";

function AbuseFrame({ children, name, variant, n, step = 0 }: {
  children: ReactNode; name: string; variant: string; n: number; step?: number;
}) {
  return <Frame n={n} name={name} step={step} className={`abuse-slide abuse-${variant}`}>
    <div className="abuse-texture" aria-hidden="true"/>
    <div className="abuse-content">{children}</div>
  </Frame>;
}

function Cue({ on, children, className = "" }: { on: boolean; children: ReactNode; className?: string }) {
  return <div className={`abuse-reveal ${className}`} data-on={on || undefined}>{children}</div>;
}

function Wave({ small = false }: { small?: boolean }) {
  const count = small ? 34 : 60;
  return <div className="abuse-wave" aria-hidden="true">{Array.from({ length: count }, (_, i) => {
    const envelope = Math.sin(Math.PI * (i + 1) / (count + 1));
    const height = 7 + envelope * (12 + Math.abs(Math.sin(i * 1.73) * Math.cos(i * .39)) * 78);
    return <i key={i} style={{ height: `${height}%` }}/>;
  })}</div>;
}

export function AbuseTurn() {
  return <AbuseFrame n={32} name="같은 능력, 다른 의도" variant="turn">
    <InteractivePixelFace/>
    <div className="abuse-turn-copy">
      <p className="abuse-eyebrow">같은 능력, 다른 의도</p>
      <MatrixHeadline/>
      <p className="abuse-turn-line">만드는 사람의 목적까지<br/>좋아지는 건 아닙니다.</p>
    </div>
    <div className="abuse-edge-code" aria-hidden="true">VOICE<br/>IMAGE<br/>VIDEO</div>
  </AbuseFrame>;
}

export function AbuseWorkbench({ step }: { step: number }) {
  return <AbuseFrame n={33} name="지금은 제가 메우는 일" variant="workbench" step={step}>
    <p className="abuse-eyebrow">제 TTS 작업에서 겪는 과정</p>
    <h1>지금은, 제가 사이를 메우고 있습니다</h1>
    <div className="abuse-pipeline" data-focus={step}>
      <div className="abuse-pipeline-stage" data-current={step === 0 || undefined}>
        <span className="abuse-stage-number">01</span>
        <span className="abuse-stage-label">대본 → 음성</span>
        <div className="abuse-stage-visual abuse-generate"><div className="abuse-paper" aria-hidden="true"><i/><i/><i/><i/></div><Wave small/></div>
        <h2>일단 만듭니다</h2><p>음성 생성 · TTS</p>
      </div>
      <Cue on={step >= 1} className="abuse-pipeline-arrow"><span aria-hidden="true">→</span></Cue>
      <Cue on={step >= 1} className="abuse-pipeline-stage" >
        <div data-current={step === 1 || undefined}>
          <span className="abuse-stage-number">02</span>
          <span className="abuse-stage-label">음성 → 받아쓰기</span>
          <div className="abuse-stage-visual abuse-compare" aria-hidden="true"><div><span>대본</span><i/><i/><i/></div><div><span>받아쓴 내용</span><i/><i data-check="true"/><i/></div></div>
          <h2>빠진 말, 달라진 말</h2><p>제 음성을 다시 받아쓰게 해<br/>대본과 비교합니다 · STT</p>
        </div>
      </Cue>
      <Cue on={step >= 2} className="abuse-pipeline-arrow"><span aria-hidden="true">→</span></Cue>
      <Cue on={step >= 2} className="abuse-pipeline-stage">
        <div data-current={step === 2 || undefined}>
          <span className="abuse-stage-number">03</span>
          <span className="abuse-stage-label">문제 구간 → 새 음성</span>
          <div className="abuse-stage-visual abuse-regenerate"><Wave small/><span aria-hidden="true">↻</span></div>
          <h2>틀린 곳을 다시</h2><p>들어보고, 고치고, 다시 확인</p>
        </div>
      </Cue>
    </div>
    <Cue on={step >= 2} className="abuse-workbench-bridge"><span aria-hidden="true"/><p>이 사이를 잇는 <em>스크립트와 제 피드백</em>이 필요합니다.</p></Cue>
    <p className="abuse-note">개인 작업 경험 · 자동 대조 뒤에도 직접 듣고 판단합니다.</p>
  </AbuseFrame>;
}

export const ABUSE_SLIDES: SlideDef[] = [
  { id: "abuse-own-voice", scriptKey: "abuse-own-voice", steps: 2, render: ({ step }) => <OwnVoice step={step}/> },
  { id: "abuse-turn", scriptKey: "abuse-turn", render: () => <AbuseTurn/> },
  { id: "abuse-workbench", scriptKey: "abuse-workbench", steps: 2, render: ({ step }) => <AbuseWorkbench step={step}/> },
  { id: "abuse-threshold", scriptKey: "abuse-threshold", steps: 1, render: ({ step }) => <ThresholdScene step={step}/> },
  { id: "abuse-voice", scriptKey: "abuse-voice", steps: 2, group: "night-phone", render: ({ step }) => <PhoneStory part={0} step={step}/> },
  { id: "abuse-trust", scriptKey: "abuse-trust", steps: 1, group: "night-phone", render: ({ step }) => <PhoneStory part={1} step={step}/> },
  { id: "abuse-media", scriptKey: "abuse-media", steps: 1, render: ({ step }) => <MediaScene step={step}/> },
  { id: "abuse-question", scriptKey: "abuse-question", steps: 1, render: ({ step }) => <VerifyStory step={step}/> },
];
