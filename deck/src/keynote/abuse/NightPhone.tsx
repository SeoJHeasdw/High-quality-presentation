import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import plate from "../../../public/abuse/night-phone.json";
import { quadMatrix3d } from "./homography";
import { usePerformanceMotion } from "../usePerformanceMotion";

/*
 * 31·32·34번의 무대. Blender로 렌더한 한밤중 협탁(public/abuse/night-phone.jpg) 위에서
 * 휴대전화 화면만 DOM으로 바꾼다. 화면의 네 모서리는 렌더 스크립트가 내보낸 값(night-phone.json)을 쓴다.
 * 모든 통화·메시지는 가상 상황이다. 실제 사칭 음성은 만들거나 재생하지 않는다.
 */
export type PhoneMode = "incoming" | "call" | "reveal" | "chat" | "chat-more" | "hangup" | "callback";
const UI_W = 390, UI_H = 845;
const MATRIX = quadMatrix3d(UI_W, UI_H, plate.screen.corners);
const [cx, cy] = plate.screen.corners.reduce(([x, y], [a, b]) => [x + a / 4, y + b / 4], [0, 0]);

const FAKE_LINES = ["엄마… 나야.", "폰이 깨져서 친구 폰으로 전화했어.", "나 사고 났어. 지금 좀 급해.", "엄마밖에 없어. 아빠한테는 말하지 마.", "지금 바로 보내줘야 해…"];

function StatusBar({ time = "2:47" }: { time?: string }) {
  return <div className="ph-status"><b>{time}</b><span className="ph-status__icons"><i className="ph-signal"/><i className="ph-wifi"/><i className="ph-battery"/></span></div>;
}

function FakeWave({ red = true, bars = 36 }: { red?: boolean; bars?: number }) {
  return <div className="ph-wave" data-red={red || undefined} aria-hidden="true">{Array.from({ length: bars }, (_, i) => <i key={i} style={{ "--i": i, "--h": 0.25 + Math.abs(Math.sin(i * 1.7) * Math.cos(i * .43)) * .75 } as CSSProperties}/>)}</div>;
}

export function PhoneScreen({ mode }: { mode: PhoneMode }) {
  if (mode === "incoming") return <div className="ph ph--incoming">
    <StatusBar/>
    <div className="ph-caller"><span className="ph-caller__kind">휴대전화</span><strong>알 수 없는 번호</strong><span className="ph-caller__num">010-••••-4127</span></div>
    <div className="ph-avatar" aria-hidden="true"><i/></div>
    <div className="ph-actions"><span className="ph-btn ph-btn--decline"><i/>거절</span><span className="ph-btn ph-btn--accept"><i/>응답</span></div>
  </div>;
  if (mode === "call" || mode === "reveal") return <div className="ph ph--call" data-reveal={mode === "reveal" || undefined}>
    <StatusBar time="2:48"/>
    <div className="ph-caller ph-caller--small"><strong>알 수 없는 번호</strong><span className="ph-timer">통화 중</span></div>
    <FakeWave/>
    <div className="ph-live"><span className="ph-live__label">실시간 자막</span>
      {FAKE_LINES.map((line, i) => <p key={i} style={{ "--i": i } as CSSProperties}>{line}</p>)}
    </div>
    {mode === "reveal" && <div className="ph-stamp"><b>합성된 목소리</b><span>통화 녹음으로 흉내 낸 음성 · 가상 상황</span></div>}
    <div className="ph-controls"><span/><span/><span/><span className="ph-btn ph-btn--decline ph-btn--end"><i/></span></div>
  </div>;
  if (mode === "chat" || mode === "chat-more") return <div className="ph ph--chat" data-more={mode === "chat-more" || undefined}>
    <StatusBar time="2:53"/>
    <div className="ph-chat-head"><i className="ph-back"/><span className="ph-chat-avatar"/><div><strong>알 수 없는 사용자</strong><span>친구가 아닌 사용자</span></div></div>
    <div className="ph-thread">
      <div className="ph-bubble ph-bubble--voice" style={{ "--i": 0 } as CSSProperties}><i className="ph-play"/><FakeWave bars={22}/><span>0:14</span></div>
      <div className="ph-bubble" style={{ "--i": 1 } as CSSProperties}>남편분 목소리 맞죠?</div>
      <div className="ph-bubble" style={{ "--i": 2 } as CSSProperties}>끝까지 들어보세요.</div>
      {mode === "chat-more" && <>
        <div className="ph-bubble ph-bubble--late" style={{ "--i": 0 } as CSSProperties}>남편한테 이 얘기 하면<br/>증거 다 지워버릴 거예요.</div>
        <div className="ph-bubble ph-bubble--late ph-bubble--hard" style={{ "--i": 1 } as CSSProperties}>지금부터는 저만 믿으세요.</div>
        <div className="ph-typing ph-bubble--late" style={{ "--i": 2 } as CSSProperties}><i/><i/><i/></div>
      </>}
    </div>
    <div className="ph-input"><span>메시지 입력</span></div>
  </div>;
  if (mode === "hangup") return <div className="ph ph--hangup">
    <StatusBar time="2:48"/>
    <div className="ph-caller"><span className="ph-caller__kind">통화 종료</span><strong>알 수 없는 번호</strong><span className="ph-caller__num">00:41</span></div>
    <div className="ph-suggest"><span>확인하기</span><div className="ph-contact"><i/><div><strong>우리 딸</strong><span>저장된 번호로 다시 걸기</span></div><b/></div></div>
  </div>;
  return <div className="ph ph--callback">
    <StatusBar time="2:49"/>
    <div className="ph-caller"><span className="ph-caller__kind">저장된 번호</span><strong>우리 딸</strong><span className="ph-timer ph-timer--ok">통화 중</span></div>
    <FakeWave red={false}/>
    <div className="ph-live ph-live--ok"><span className="ph-live__label">실시간 자막</span><p style={{ "--i": 0 } as CSSProperties}>엄마? 이 시간에 무슨 일이야.</p><p style={{ "--i": 1 } as CSSProperties}>나 자고 있었는데…</p></div>
    <div className="ph-controls"><span/><span/><span/><span className="ph-btn ph-btn--decline ph-btn--end"><i/></span></div>
  </div>;
}

/** 진동음은 기본으로 끈다. 발표자가 A를 눌렀을 때만, 수신 중인 동안 낮은 진동음을 낸다. */
function useBuzz(active: boolean, sound: boolean) {
  useEffect(() => {
    if (!active || !sound) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const osc = ctx.createOscillator(), lfo = ctx.createOscillator(), gain = ctx.createGain(), lp = ctx.createBiquadFilter(), master = ctx.createGain();
    osc.type = "sawtooth"; osc.frequency.value = 148; lfo.type = "square"; lfo.frequency.value = 36;
    lp.type = "lowpass"; lp.frequency.value = 420; master.gain.value = 0;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = .35; lfo.connect(lfoGain); lfoGain.connect(gain.gain); gain.gain.value = .45;
    osc.connect(gain); gain.connect(lp); lp.connect(master); master.connect(ctx.destination);
    osc.start(); lfo.start();
    const t0 = ctx.currentTime + .05;
    for (let k = 0; k < 40; k++) { // 0.9초 울리고 1.1초 쉰다
      const s = t0 + k * 2; master.gain.setValueAtTime(0, s); master.gain.linearRampToValueAtTime(.22, s + .04); master.gain.setValueAtTime(.22, s + .86); master.gain.linearRampToValueAtTime(0, s + .9);
    }
    return () => { try { osc.stop(); lfo.stop(); } catch { /* 이미 멈춤 */ } void ctx.close(); };
  }, [active, sound]);
}

export default function NightPhone({ mode, tone = "cold", children }: { mode: PhoneMode; tone?: "cold" | "red" | "warm"; children?: ReactNode }) {
  const motion = usePerformanceMotion();
  const [sound, setSound] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== "a") return;
      e.preventDefault(); setSound((v) => !v);
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);
  useBuzz(mode === "incoming" && motion, sound);
  // 장식 층만 숨긴다. 32번의 살펴보기 버튼(children)은 보조 기술에서도 누를 수 있어야 한다.
  return <div ref={root} className="np" data-mode={mode} data-tone={tone} data-motion={motion || undefined}
    style={{ "--cx": `${cx}px`, "--cy": `${cy}px` } as CSSProperties}>
    {/* np-cam: 통화가 연결되면 휴대전화 쪽으로 다가간다. np-stage: 장면 내내 아주 느리게 조여 온다. */}
    <div className="np-cam"><div className="np-stage">
      <img className="np-plate" src="/abuse/night-phone.jpg" alt=""/>
      <div className="np-glow" aria-hidden="true"/>
      <div className="np-ripples" aria-hidden="true"><i/><i/><i/></div>
      <div className="np-shake" aria-hidden="true"><div className="np-screen" style={{ transform: MATRIX, width: UI_W, height: UI_H }}><PhoneScreen mode={mode}/><i className="np-sheen"/></div></div>
      {children}
    </div></div>
    <div className="np-grain" aria-hidden="true"/>
    <div className="np-vignette" aria-hidden="true"/>
    <span className="np-sound" aria-hidden="true" data-on={sound || undefined}>{sound ? "진동음 켜짐 · A" : "진동음 A"}</span>
  </div>;
}
