import type { CSSProperties, ReactNode } from "react";
import { Frame } from "../KeynoteFrame";
import ClosingChoices from "../ClosingChoices";
import Blueprint3D from "./Blueprint3D";
import "./finale.css";

/*
 * 40~43번 · 새벽. 13번의 밤, 35~38번의 새벽 2시 47분 뒤에 같은 집이 푸른 새벽(40~42)을 지나 해 뜨는 아침(43)이 된다.
 * 배경은 12번 Blender 장면의 마지막 구도를 시간대만 바꿔 다시 렌더한 것(tools/render-house-scroll.py --time).
 * 네 장이 한 묶음(finale)이라 배경은 다시 그리지 않고 밝아진다.
 * 판단·실패 기록은 local-tts-engine/docs/DECISIONS.md의 실제 기록이다.
 */

const WAYS = ["대본 → 목소리 → 받아쓰기 대조 → 다시 만들기", "화면 먼저 찍기 → 대본 → 목소리 후보 → 길이 맞춰 편집", "후보를 직접 듣고 고르기"];
const DECISIONS: [string, string][] = [
  ["08.23", "로컬 제작 · 듣고 Qwen 채택"],
  ["08.25", "목소리 어댑터 0.60"],
  ["09.03", "독립 Whisper로 검수"],
  ["09.21", "영어 목소리 미채택"],
];
const RESULTS: [string, string][] = [
  ["/demos/tts-lecture.jpg", "제 목소리 강의"],
  ["/factory-film/03-image.jpg", "새로 만든 이미지"],
  ["/factory-film/04-music.jpg", "음악 후보"],
  ["/house-scroll/a4.jpg", "이 발표 · 43장"],
];
const MODELS = ["Qwen3-TTS 1.7B", "다음 모델", "그다음 모델"];

function Strata() {
  return <div className="fs">
    <div className="fs-models" aria-label="바뀌는 것: 모델">
      <span className="fs-lane-label">바뀌는 것 <b>모델</b></span>
      <div className="fs-model-track">{MODELS.map((m, i) => <span key={m} className="fs-model" style={{ "--i": i } as CSSProperties}><b>{m}</b><small>{i === 0 ? "지금 쓰는 모델" : "가정"}</small></span>)}</div>
    </div>
    <div className="fs-axis" aria-hidden="true"><span>2026 · 지금</span><i/><span>2056</span></div>
    <div className="fs-layers" aria-label="남는 것: 작업 방식, 판단의 기록, 결과물">
      <div className="fs-layer" style={{ "--i": 0 } as CSSProperties}><span className="fs-lane-label">남는 것 <b>작업 방식</b></span>
        <div className="fs-items">{WAYS.map((w) => <span key={w} className="fs-chip">{w}</span>)}</div></div>
      <div className="fs-layer" style={{ "--i": 1 } as CSSProperties}><span className="fs-lane-label"><b>판단의 기록</b></span>
        <div className="fs-items">{DECISIONS.map(([d, t]) => <span key={d} className="fs-chip fs-chip--log"><time>{d}</time>{t}</span>)}</div></div>
      <div className="fs-layer" style={{ "--i": 2 } as CSSProperties}><span className="fs-lane-label"><b>결과물</b></span>
        <div className="fs-items">{RESULTS.map(([src, t]) => <figure key={t} className="fs-thumb"><img src={src} alt=""/><figcaption>{t}</figcaption></figure>)}</div></div>
      <span className="fs-future">앞으로 30년 동안 쌓을 자리</span>
    </div>
  </div>;
}

const LOG: { date: string; what: string; result: string; tone: "no" | "fix" | "yes" }[] = [
  { date: "09.21", what: "화면 녹화에 마이크 소리 함께 담기", result: "소리의 약 13%를 놓쳐 쓰지 않기로", tone: "no" },
  { date: "09.21", what: "영어 목소리 표본", result: "직접 듣고 미채택", tone: "no" },
  { date: "09.20", what: "“RICE”가 “알아이씨이”로 들림", result: "문제는 목소리가 아니라 철자였다", tone: "fix" },
  { date: "09.18", what: "브라우저 새 판본", result: "4K 3초 시험에서 프레임 95개 → 65개, 이전 판본으로 고정", tone: "no" },
  { date: "09.09", what: "영어 낱말만 따로 합성한 샘플 4개", result: "모두 거절", tone: "no" },
  { date: "08.25", what: "제 목소리 어댑터 강도", result: "1.00 대신 0.60 채택", tone: "yes" },
];
const TONE = { no: "안 됨", fix: "고침", yes: "채택" };

function OpenLog() {
  return <div className="fo">
    <div className="fo-log">
      <header><span>보여줄 것 · 실제로 만든 결과와 잘 안됐던 과정</span><small>local-tts-engine 결정 기록</small></header>
      <ol>{LOG.map((e, i) => <li key={i} data-tone={e.tone} style={{ "--i": i } as CSSProperties}>
        <time>{e.date}</time><div><strong>{e.what}</strong><span>{e.result}</span></div><b>{TONE[e.tone]}</b>
      </li>)}</ol>
    </div>
    <div className="fo-reach">
      <span className="fo-reach__label">기대하는 것 · 함께할 사람과 다음에 해볼 일</span>
      <svg className="fo-net" viewBox="0 0 640 380" aria-hidden="true">
        {[[520, 70], [590, 180], [470, 300], [360, 110], [330, 260], [560, 330], [420, 40]].map(([x, y], i) => <g key={i} style={{ "--i": i } as CSSProperties}>
          <line x1="90" y1="190" x2={x} y2={y}/><circle cx={x} cy={y} r="7"/></g>)}
        <circle className="fo-me" cx="90" cy="190" r="16"/>
      </svg>
      <p className="fo-pledge"><b>약속</b>다른 사람의 목소리나 모습이 들어가는 결과물은 당사자의 동의를 먼저 확인합니다.</p>
    </div>
  </div>;
}

function Blueprint() {
  // 방 = 만들고 있는 것, 점선 = 아직 그리기만 한 것. 12번 청사진 선의 언어를 이어 쓴다.
  return <div className="fb">
    <svg className="fb-plan" viewBox="0 0 980 600" aria-label="자비스 설계도: 세 엔진은 개발 중, Agent OS와 연결은 아직 설계">
      <defs><pattern id="fb-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="#6fb6e61a" strokeWidth="1"/></pattern></defs>
      <rect x="0" y="0" width="980" height="600" fill="url(#fb-grid)"/>
      <path className="fb-wall" d="M40 60H940V560H40Z"/>
      {/* 엔진 세 개: 지어진 방 */}
      {[["TTS", 70, 330], ["ASSETS", 330, 330], ["MUSIC", 590, 330]].map(([n, x, y], i) => <g key={n as string} className="fb-room fb-room--built" style={{ "--i": i } as CSSProperties}>
        <rect x={x as number} y={y as number} width="230" height="190"/><text x={(x as number) + 22} y={(y as number) + 44}>{n}</text><text className="fb-sub" x={(x as number) + 22} y={(y as number) + 76}>개발 중</text></g>)}
      {/* Agent OS: 아직 설계 */}
      <g className="fb-room fb-room--plan"><rect x="330" y="90" width="490" height="170"/><text x="352" y="134">Agent OS</text><text className="fb-sub" x="352" y="166">구상</text></g>
      {/* 연결: 점선 복도 */}
      <path className="fb-link" d="M185 330V200H330M445 330V260M705 330V260M820 175H900V470H820"/>
      {/* 현관: 저 */}
      <g className="fb-door"><path d="M40 440H14"/><circle cx="40" cy="440" r="12"/></g>
    </svg>
    <ul className="fb-notes">
      <li style={{ "--i": 0 } as CSSProperties}><b>01 연결</b>각 엔진을 제 맥락으로 이어 쓰는 흐름은 아직 설계입니다.</li>
      <li style={{ "--i": 1 } as CSSProperties}><b>02 품질</b>만드는 것만큼 고르고 고치는 데에도 제 시간이 듭니다.</li>
      <li style={{ "--i": 2 } as CSSProperties}><b>03 생활</b>시스템을 만드는 시간이 쓸모 있는 결과로 이어져야 합니다.</li>
    </ul>
  </div>;
}

/** 42번은 세 단계마다 제목이 바뀐다(0 지금, 1 조합, 2 사무직이었다면). */
const UNFINISHED: { kicker: string; title: ReactNode; lead: string }[] = [
  { kicker: "아직 남아 있는 문제", title: <>완성된 자비스까지는<br/>갈 길이 있습니다</>, lead: "지금은 방마다 기능을 만들고, 실제로 쓰다 막히는 부분을 고치는 단계입니다." },
  { kicker: "방과 방을 이으면", title: <>조합하면<br/>새 일이 생깁니다</>, lead: "같은 설계가 목소리, 업무, 주식 판단에 들어가 있습니다. 조합은 아직 가능성입니다." },
  { kicker: "제가 사무직이었다면", title: <>그리고 방은<br/>계속 늘어납니다</>, lead: "엑셀, 브라우저, PDF와 PPT, 문서 방향부터 만들었을 겁니다." },
];
const HEAD: { name: string; kicker: string; title: ReactNode; lead: string }[] = [
  { name: "30년 동안 쌓을 것", kicker: "30년 동안 쌓을 것", title: <>모델이 바뀌어도<br/>제 작업은 남기고 싶습니다</>, lead: "더 좋은 AI가 나오면, 이미 만든 기반 위에서 받아들일 수 있도록 합니다." },
  { name: "밖으로도 이어갈 계획", kicker: "밖으로도 이어갈 계획", title: <>만드는 과정도<br/>공개하려고 합니다</>, lead: "새로운 일이 생겼을 때, 제가 무엇을 할 수 있는 사람인지 알 수 있도록 합니다." },
  { name: "아직 남아 있는 문제", kicker: "아직 남아 있는 문제", title: <>완성된 자비스까지는<br/>갈 길이 있습니다</>, lead: "지금은 방마다 기능을 만들고, 실제로 쓰다 막히는 부분을 고치는 단계입니다." },
  { name: "팀과 나누고 싶은 질문", kicker: "팀과 나누고 싶은 질문", title: <>내 일 하나를 맡겨본다면,<br/>무엇부터 바꿔볼 수 있을까요?</>, lead: "" },
];

export default function FinaleStory({ part, step = 0 }: { part: 0 | 1 | 2 | 3; step?: number }) {
  const head = part === 2 ? { ...HEAD[2], ...UNFINISHED[Math.min(2, step)] } : HEAD[part];
  return <Frame n={40 + part} name={head.name} className={`finale finale--${part}${part === 3 ? " kn-closing" : ""}`}>
    <div className="fn-sky" aria-hidden="true">
      <img className="fn-plate fn-plate--blue" src="/house-dawn/blue.jpg" alt=""/>
      <img className="fn-plate fn-plate--sun" src="/house-dawn/sunrise.jpg" alt=""/>
      <div className="fn-tint"/>
      <div className="fn-shade"/>
    </div>
    <div className="fn-head" key={`h${part}-${part === 2 ? step : 0}`}>
      <p className="fn-kicker">{head.kicker}</p>
      <h1>{head.title}</h1>
      {head.lead && <p className="fn-lead">{head.lead}</p>}
    </div>
    {part === 0 && <Strata/>}
    {part === 1 && <OpenLog/>}
    {part === 2 && <><Blueprint3D step={step} fallback={<Blueprint/>}/><p className="fn-legend"><span><i/>실선 · 만든 방</span><span><i data-dash/>점선 · 구상·가정</span></p></>}
    {part === 3 && <>
      <ClosingChoices/>
      <p className="fn-final">저는 앞으로 30년을 준비하는 방법으로,<br/><b>제 자비스를 만들고 있습니다.</b></p>
    </>}
  </Frame>;
}
