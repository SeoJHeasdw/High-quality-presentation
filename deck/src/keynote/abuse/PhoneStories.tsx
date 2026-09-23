import type { CSSProperties, ReactNode } from "react";
import { Frame } from "../KeynoteFrame";
import { Decipher, useInspection } from "../AbuseInteractive";
import NightPhone, { type PhoneMode } from "./NightPhone";
import PhoneAudio from "./PhoneAudio";
import plate from "../../../public/abuse/night-phone.json";
import { quadPoint } from "./homography";
import "./night-phone.css";
import "./abuse-v2.css";

/*
 * 36·37번은 같은 휴대전화 한 대에서 이어진다(묶음 night-phone). 36번은 새벽의 전화, 37번은 같은 밤에 온 메시지.
 * 39번은 같은 휴대전화에서 확인하는 방법으로 끝난다. 모두 가상 상황이다.
 */
const NARRATION: ReactNode[] = [
  <>새벽 2시 47분. <b>모르는 번호</b>로 전화가 옵니다.</>,
  <>받아보니, <b>아는 목소리</b>입니다.</>,
  <><b className="is-red">익숙한 목소리 ≠ 본인</b></>,
  <>같은 밤, 모르는 사람이 <b>음성 메시지</b>를 보냅니다.</>,
  <>“지금부터는 저만 믿으세요.” <b className="is-red">상대를 고립시키는 거짓말</b>입니다.</>,
];
const MODES: PhoneMode[] = ["incoming", "call", "reveal", "chat", "chat-more"];

/** 37번 · 음성 메시지 옆의 살펴보기. 휴대전화 화면 위 말풍선 자리에 붙는다. */
function PhoneEvidence({ step }: { step: number }) {
  const inspection = useInspection(step);
  const [x, y] = quadPoint(390, 845, plate.screen.corners, 18, 170);
  return <div className="pe" style={{ "--x": `${x}px`, "--y": `${y}px` } as CSSProperties} data-inspecting={inspection.active || undefined} data-pinned={inspection.pinned || undefined}>
    <button type="button" className="abuse-inspection-control pe-control" aria-label="가상의 음성 메시지 살펴보기" aria-expanded={inspection.active} aria-pressed={inspection.pinned} {...inspection.handlers}>
      <span>{inspection.hint} <b aria-hidden="true">＋</b></span>
    </button>
    <div className="pe-card" aria-hidden={!inspection.active}>
      <span className="pe-kicker">이 음성을 살펴보면</span>
      <div className="pe-eq"><span>그럴듯한 목소리</span><b>≠</b><strong><Decipher text="확인된 사실" active={inspection.active}/></strong></div>
      <ul><li>누가 보냈나요?</li><li>원본은 어디에 있나요?</li><li>당사자에게 직접 물어봤나요?</li></ul>
    </div>
  </div>;
}

export function PhoneStory({ part, step }: { part: 0 | 1; step: number }) {
  const phase = part === 0 ? step : 3 + step;
  return <Frame n={35 + part} name={part === 0 ? "익숙한 목소리를 이용한다면" : "가짜 증거로 관계를 흔든다면"} step={step} className="abuse-slide abuse-v2 abuse-phone">
    <div className="abuse-content">
      <NightPhone mode={MODES[phase]} tone={phase === 2 || phase === 4 ? "red" : "cold"}>{part === 1 && <PhoneEvidence step={step}/>}</NightPhone>
      <PhoneAudio src={part === 0 ? "/abuse/audio/phone-call.m4a?v=acting-2" : "/abuse/audio/phone-message.m4a?v=acting-2"} active={phase === 1 || phase === 3} delayMs={part === 0 ? 500 : 950} label={part === 0 ? "가상 통화" : "가상 음성 메시지"}/>
      <div className="av-copy" key={`c${part}`}>
        <p className="av-eyebrow"><span className="av-tag">가상 상황 {part === 0 ? "01" : "02"}</span>{part === 0 ? "사칭 전화" : "관계 조작"}</p>
        {part === 0 ? <h1>들어본 목소리라서<br/><em>믿게 된다면</em></h1> : <h1>가짜 ‘증거’로<br/><em>관계를 흔든다면</em></h1>}
      </div>
      <p className="av-line" key={`l${phase}`} data-phase={phase}>{NARRATION[phase]}</p>
      <p className="av-note">{part === 0
        ? <><span>통화 내용·번호는 가상 · 발표자 본인 목소리를 Qwen3-TTS로 합성</span><a href="https://consumer.ftc.gov/articles/scammers-use-fake-emergencies-steal-your-money" target="_blank" rel="noreferrer">FTC · 짧은 음성으로 가족 목소리를 흉내 내는 사기 ↗</a></>
        : <><span>음성 메시지는 가상 · 발표자 본인 목소리를 Qwen3-TTS로 합성</span><a href="https://www.europol.europa.eu/publications-events/publications/facing-reality-law-enforcement-and-challenge-of-deepfakes" target="_blank" rel="noreferrer">Europol · 딥페이크의 위험 ↗</a></>}</p>
    </div>
  </Frame>;
}

const CHECKS = ["급하다는 말에 바로 보내지 않기", "끊고, 알고 있던 번호로 다시 걸기", "다른 가족에게도 확인하기"];
export function VerifyStory({ step }: { step: number }) {
  return <Frame n={38} name="무엇으로 확인할까요" step={step} className="abuse-slide abuse-v2 abuse-phone abuse-verify">
    <div className="abuse-content">
      <NightPhone mode={step === 0 ? "hangup" : "callback"} tone="warm"/>
      <div className="av-copy av-copy--verify">
        <p className="av-eyebrow">만드는 능력만큼, 확인하는 일도</p>
        <p className="av-premise">익숙한 목소리도,<br/>그럴듯한 영상도.</p>
        <h1>무엇으로<br/><em>확인할까요?</em></h1>
        <ol className="av-checks">{CHECKS.map((c, i) => <li key={c} data-on={step >= 1 || i < 2 || undefined} style={{ "--i": i } as CSSProperties}><b>{String(i + 1).padStart(2, "0")}</b>{c}</li>)}</ol>
      </div>
      <p className="av-note"><span>FTC가 권하는 확인 방법 · 통화는 가상 상황</span><a href="https://consumer.ftc.gov/articles/scammers-use-fake-emergencies-steal-your-money" target="_blank" rel="noreferrer">FTC · 가족을 사칭한 긴급 요청 ↗</a></p>
    </div>
  </Frame>;
}
