import { useState, type CSSProperties, type ReactNode } from "react";
import type { SlideDef } from "../components/deck-kit";
import { Frame } from "./KeynoteFrame";
import { EvidenceInspection, InteractivePixelFace, MediaInspection } from "./AbuseInteractive";
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

function PixelFace() {
  return <div className="abuse-face" aria-hidden="true"><img src="/abuse/pixel-face.png" alt=""/></div>;
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
  return <AbuseFrame n={27} name="같은 능력, 다른 의도" variant="turn">
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
  return <AbuseFrame n={28} name="지금은 제가 메우는 일" variant="workbench" step={step}>
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

export function AbuseThreshold({ step }: { step: number }) {
  return <AbuseFrame n={29} name="그 수고가 줄어든다면" variant="threshold" step={step}>
    <p className="abuse-eyebrow">개인적인 전망</p>
    <h1>다음 모델이<br/><em>더 잘해준다면</em></h1>
    <div className="abuse-threshold-graphic" data-open={step >= 1 || undefined} aria-label={step ? "사람이 메우던 수고가 줄어든다는 가정" : "지금은 생성, 확인, 수정, 연결에 손이 드는 상태"}>
      <div className="abuse-barrier">{["생성", "확인", "수정", "연결"].map((word, i) => <div key={word} style={{ "--barrier-index": i } as CSSProperties}><span>{word}</span><i/><i/><i/><i/><i/></div>)}</div>
      <span className="abuse-barrier-caption">제가 메우던 수고</span>
      <Cue on={step >= 1} className="abuse-threshold-opening"><span>더 적은 수고로</span><strong>더 많은 사람이</strong></Cue>
    </div>
    <Cue on={step >= 1} className="abuse-threshold-quote"><p>“이 정도면 엔지니어가 아니어도<br/>해볼 수 있겠는데?”</p></Cue>
    <p className="abuse-note">Qwen 4·5는 ‘더 발전한 다음 모델’을 가정한 이름입니다.</p>
  </AbuseFrame>;
}

export function AbuseVoice({ step }: { step: number }) {
  return <AbuseFrame n={30} name="익숙한 목소리를 이용한다면" variant="voice" step={step}>
    <p className="abuse-eyebrow">가상 상황 01 / 사칭 전화</p>
    <h1>들어본 목소리라서<br/><em>믿게 된다면</em></h1>
    <div className="abuse-call-origin">
      <span className="abuse-object-label">평범한 통화에서 남은 녹음</span>
      <div className="abuse-recording"><span className="abuse-recording-dot" aria-hidden="true"/><Wave/><span className="abuse-concept-label">개념 파형</span></div>
      <p>통화 녹음 기능은<br/>기기와 지역에 따라 다릅니다.</p>
    </div>
    <Cue on={step >= 1} className="abuse-call-arrow"><span aria-hidden="true">→</span><span>악용된다면</span></Cue>
    <Cue on={step >= 1} className="abuse-call-arrival">
      <div className="abuse-caller-ring" aria-hidden="true"><svg viewBox="0 0 80 80"><path d="M22 15c-6 2-10 9-7 19 5 16 15 26 31 31 10 3 17-1 19-7l-13-12-9 5c-6-3-11-8-14-14l5-9Z"/></svg></div>
      <span className="abuse-object-label">가족이나 지인처럼 들리는 전화</span>
      <p>익숙한 목소리 <b>≠</b> 본인</p>
      <span className="abuse-call-risk">돈을 보내 달라는 말까지<br/>믿게 만들 수 있습니다.</span>
    </Cue>
    <p className="abuse-note"><span>목소리를 닮게 만든 사칭 수법은 이미 악용되고 있습니다.</span><a href="https://consumer.ftc.gov/articles/scammers-use-fake-emergencies-steal-your-money" target="_blank" rel="noreferrer">FTC · 음성 사칭 사기 ↗</a></p>
  </AbuseFrame>;
}

export function AbuseTrust({ step }: { step: number }) {
  return <AbuseFrame n={31} name="가짜 증거로 관계를 흔든다면" variant="trust" step={step}>
    <p className="abuse-eyebrow">가상 상황 02 / 관계 조작</p>
    <div className="abuse-trust-copy"><h1>가짜 ‘증거’로<br/><em>관계를 흔든다면</em></h1><p>외도 정황처럼 꾸민 음성을<br/>배우자에게 보내는 상황</p></div>
    <EvidenceInspection step={step}>
      <div className="abuse-message-top"><span>가상의 음성 메시지</span><span>조작된 정황</span></div>
      <div className="abuse-message-wave"><i aria-hidden="true"/><Wave/></div>
      <span className="abuse-message-empty">외도 정황이라고 주장하는 음성</span>
    </EvidenceInspection>
    <Cue on={step >= 1} className="abuse-trust-consequence"><span className="abuse-consequence-rule" aria-hidden="true"/><div><span className="abuse-isolation-quote">“나만 믿으라”</span><p>상대를 고립시키는<br/><em>거짓말이 될 수 있습니다.</em></p></div></Cue>
    <p className="abuse-note"><span>확인되지 않은 내용을 ‘증거’로 받아들이게 만드는 위험</span><a href="https://www.europol.europa.eu/publications-events/publications/facing-reality-law-enforcement-and-challenge-of-deepfakes" target="_blank" rel="noreferrer">Europol · 딥페이크의 위험 ↗</a></p>
  </AbuseFrame>;
}

function AbstractMedia({ ghost = false }: { ghost?: boolean }) {
  return <div className={`abuse-abstract-media ${ghost ? "is-copy" : ""}`} aria-hidden="true">
    <div className="abuse-media-pixels">{Array.from({ length: 96 }, (_, i) => <i key={i} style={{ opacity: .08 + Math.abs(Math.sin(i * 1.71) * Math.cos(i * .31)) * .75 }}/>)}</div>
    <span>IMAGE / VIDEO</span><b>+</b>
  </div>;
}

export function AbuseMedia({ step }: { step: number }) {
  const [inspecting, setInspecting] = useState(false);
  return <AbuseFrame n={32} name="당사자에게 남는 피해" variant="media" step={step}>
    <p className="abuse-eyebrow">가상 상황 03 / 동의 없는 합성</p>
    <div className="abuse-media-spread" data-spread={step >= 1 || undefined} data-inspecting={inspecting || undefined} aria-label="가짜 이미지나 영상이 퍼지며 여러 흔적을 남기는 개념도">
      <div className="abuse-media-copy abuse-media-copy-one"><AbstractMedia ghost/></div>
      <div className="abuse-media-copy abuse-media-copy-two"><AbstractMedia ghost/></div>
      <MediaInspection step={step} onInspect={setInspecting}><AbstractMedia/></MediaInspection>
      <span className="abuse-media-object-caption">가짜 이미지·영상</span>
      <Cue on={step >= 1} className="abuse-media-traces"><span>공유</span><i aria-hidden="true"/><span>재공유</span><i aria-hidden="true"/><span>남는 흔적</span></Cue>
    </div>
    <div className="abuse-media-copy-text"><h1>만든 영상이<br/>한 사람을<br/><em>따라다닌다면</em></h1><Cue on={step >= 1}><p>동의 없이 만들어 퍼뜨리면,<br/>허위 내용이 평판을<br/>해칠 수 있습니다.</p></Cue></div>
    <p className="abuse-note"><span>동의 없는 조작과 유포는 괴롭힘·협박에도 쓰일 수 있습니다.</span><a href="https://www.ic3.gov/PSA/2023/PSA230605" target="_blank" rel="noreferrer">FBI · 조작된 이미지·영상 ↗</a></p>
  </AbuseFrame>;
}

export function AbuseQuestion() {
  return <AbuseFrame n={33} name="무엇으로 확인할까요" variant="question">
    <PixelFace/>
    <div className="abuse-question-copy"><p className="abuse-eyebrow">만드는 능력만큼, 확인하는 일도</p><p className="abuse-question-premise">익숙한 목소리도,<br/>그럴듯한 영상도.</p><h1>무엇으로<br/><em>확인할까요?</em></h1><p className="abuse-question-checks">저장된 번호로 다시 전화하기<br/>다른 연락 수단으로 확인하기</p></div>
    <span className="abuse-question-mark" aria-hidden="true">?</span>
  </AbuseFrame>;
}

export const ABUSE_SLIDES: SlideDef[] = [
  { id: "abuse-turn", scriptKey: "abuse-turn", render: () => <AbuseTurn/> },
  { id: "abuse-workbench", scriptKey: "abuse-workbench", steps: 2, render: ({ step }) => <AbuseWorkbench step={step}/> },
  { id: "abuse-threshold", scriptKey: "abuse-threshold", steps: 1, render: ({ step }) => <AbuseThreshold step={step}/> },
  { id: "abuse-voice", scriptKey: "abuse-voice", steps: 1, render: ({ step }) => <AbuseVoice step={step}/> },
  { id: "abuse-trust", scriptKey: "abuse-trust", steps: 1, render: ({ step }) => <AbuseTrust step={step}/> },
  { id: "abuse-media", scriptKey: "abuse-media", steps: 1, render: ({ step }) => <AbuseMedia step={step}/> },
  { id: "abuse-question", scriptKey: "abuse-question", render: () => <AbuseQuestion/> },
];
