import { useContext, type CSSProperties, type ReactNode } from "react";
import { Frame, SlidePosition } from "../KeynoteFrame";
import { LeashCopy, LeashLayer } from "../leash/Leash";
import ClosingChoices from "../ClosingChoices";
import Blueprint3D from "./Blueprint3D";
import "./finale.css";

/*
 * 54~56번 · 새벽. 15번의 밤, 37~40번의 새벽 2시 47분 뒤에 같은 집이 푸른 새벽(42·43)을 지나 해 뜨는 아침(44)이 된다.
 * 배경은 15번 Blender 장면의 마지막 구도를 시간대만 바꿔 다시 렌더한 것(tools/render-house-scroll.py --time).
 * 세 장이 한 묶음(finale)이라 배경은 다시 그리지 않고 밝아진다.
 * 53번(신에게 목줄이 걸릴까)도 이 묶음의 첫 장이다(part -1, leashFrom 2). 그 3D 장면(leash/)이 54번 첫 단계까지 같은 캔버스로 이어져,
 * 입자 몸과 목줄이 풀려 집이 되고 그 집이 새벽 사진이 된다. 장이 바뀌어도 화면이 깜빡이지 않는다.
 * 판단의 기록은 local-tts-engine/docs/DECISIONS.md의 실제 기록이다.
 */

const WAYS = ["대본 → 목소리 → 받아쓰기 대조 → 다시 만들기", "화면 먼저 찍기 → 대본 → 목소리 후보 → 길이 맞춰 편집", "후보를 직접 듣고 고르기"];
const DECISIONS: [string, string][] = [
  ["08.23", "로컬 제작 · 듣고 Qwen 채택"],
  ["08.25", "목소리 어댑터 0.60"],
  ["09.03", "독립 Whisper로 검수"],
  ["09.21", "영어 목소리 미채택"],
];
const RESULTS: [string, string][] = [
  ["/demos/bob-demo.jpg", "제 목소리 영상"],
  ["/factory-film/03-image.jpg", "새로 만든 이미지"],
  ["/factory-film/04-music.jpg", "음악 후보"],
  ["/house-scroll/a4.jpg", "이 발표"],
];
const MODELS = ["Qwen3-TTS 1.7B", "다음 모델", "그다음 모델"];

function Strata() {
  // 이 발표의 장표 수는 덱에서 읽는다. 장을 끼워도 숫자가 어긋나지 않는다.
  const total = useContext(SlidePosition)?.total ?? 44;
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
        <div className="fs-items">{RESULTS.map(([src, t]) => <figure key={t} className="fs-thumb"><img src={src} alt=""/><figcaption>{t === "이 발표" ? `이 발표 · ${total}장` : t}</figcaption></figure>)}</div></div>
      <span className="fs-future">앞으로 30년 동안 쌓을 자리</span>
    </div>
  </div>;
}

function Blueprint() {
  // 방 = 만들고 있는 것, 점선 = 아직 그리기만 한 것. 13번 청사진 선의 언어를 이어 쓴다.
  return <div className="fb">
    <svg className="fb-plan" viewBox="0 0 980 600" aria-label="자비스 설계도: 엔진 세 개는 지은 방, 방들을 잇는 연결은 아직 점선">
      <defs><pattern id="fb-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="#6fb6e61a" strokeWidth="1"/></pattern></defs>
      <rect x="0" y="0" width="980" height="600" fill="url(#fb-grid)"/>
      <path className="fb-wall" d="M40 60H940V560H40Z"/>
      {/* 엔진 세 개: 지어진 방 */}
      {[["TTS", 70, 330], ["ASSETS", 330, 330], ["MUSIC", 590, 330]].map(([n, x, y], i) => <g key={n as string} className="fb-room fb-room--built" style={{ "--i": i } as CSSProperties}>
        <rect x={x as number} y={y as number} width="230" height="190"/><text x={(x as number) + 22} y={(y as number) + 44}>{n}</text></g>)}
      {/* 연결: RICE(Agent OS)가 방들을 잇는 길은 아직 설계 */}
      <g className="fb-room fb-room--plan"><rect x="330" y="90" width="490" height="170"/><text x="352" y="134">연결</text><text className="fb-sub" x="352" y="166">구상</text></g>
      {/* 연결: 점선 복도 */}
      <path className="fb-link" d="M185 330V200H330M445 330V260M705 330V260M820 175H900V470H820"/>
      {/* 현관: 저 */}
      <g className="fb-door"><path d="M40 440H14"/><circle cx="40" cy="440" r="12"/></g>
    </svg>
  </div>;
}

/** 43번은 단계마다 제목이 바뀐다(0 지금, 1 조합, 2 사무직이었다면, 3 계속 늘어나는 방, 4 방 하나에서 뻗는 사례). */
/** 43-0 · 남아 있는 문제 셋. 이 장에서 가장 중요한 말이라 제목과 함께 화면에 둔다. */
const PROBLEMS: [string, string][] = [
  ["01 연결", "RICE가 방들을 제 맥락으로 잇는 길은 아직 점선입니다."],
  ["02 품질", "만드는 만큼, 고르고 고치는 데에도 제 시간이 듭니다."],
  ["03 쓸모", "만드는 일에 빠지지 않고, 쓸모가 있는지 계속 확인합니다."],
];
const UNFINISHED: { kicker: string; title: ReactNode; lead: string; notes?: [string, string][] }[] = [
  { kicker: "아직 남아 있는 문제", title: <>만들 수 있다는 것과<br/>매일 쓸 만하다는 것은<br/>다릅니다</>, lead: "", notes: PROBLEMS },
  { kicker: "방과 방을 이으면", title: <>조합하면<br/>할 수 있는 일이 늘어납니다</>, lead: "같은 설계가 목소리, 업무, 주식 판단에 들어가 있습니다. 조합은 아직 가능성입니다." },
  { kicker: "제가 사무직이었다면", title: <>이 방들부터<br/>지었을 겁니다</>, lead: "엑셀, 브라우저, PDF와 PPT, 문서 방향. 전부 제 가정입니다." },
  // 마지막 단계: 17번의 "다 할 수 있다"(과도기의 희열)를 회수한다. 파는 이야기로 읽히지 않게 사례는 두지 않는다.
  { kicker: "방 하나를 더 지을 때마다", title: <><em>다 할 수 있다</em>는 말은<br/>여기까지 넓어집니다</>, lead: "방이 하나 늘 때마다, 이을 수 있는 조합은 두 배 넘게 늘어납니다." },
];
const HEAD: { name: string; kicker: string; title: ReactNode; lead: string }[] = [
  { name: "30년 동안 쌓을 것", kicker: "30년 동안 쌓을 것", title: <>모델이 바뀌어도<br/>제 작업은 남기고 싶습니다</>, lead: "더 좋은 AI가 나오면, 이미 만든 기반 위에서 받아들일 수 있도록 합니다." },
  { name: "아직 남아 있는 문제", kicker: "아직 남아 있는 문제", title: <>만들 수 있다는 것과<br/>매일 쓸 만하다는 것은<br/>다릅니다</>, lead: "" },
  // 44 · 에세이의 끝. 16번의 질문("앞으로 30년, 저는 뭘 하며 살까요?")을 다시 띄우고 답한다. 표지의 "나는 자비스를 만들고 있다"로 돌아온다.
  //      그 아래에는 처음의 두 마음(희열 · 두려움)이 같은 크기로 선다.
  { name: "서제호의 30년", kicker: "앞으로 30년, 저는 뭘 하며 살까요?", title: <>아직은 모릅니다.<br/>그래서 <em>제 자비스</em>를 만들고 있습니다</>, lead: "" },
];

/** 54-0 · 53번에서 넘어오는 이음새의 제목 */
const BRIDGE = { name: "30년 동안 쌓을 것", kicker: "제가 할 수 있는 것", title: <>목줄이 걸릴지는 모릅니다.<br/>제가 할 수 있는 건<br/><em>제 집</em>을 짓는 일입니다</>, lead: "그날이 오든, 늦게 오든, 안 오든 남는 집으로요." };

/** part -1은 41번과 53번(신에게 목줄), 0~2는 54~56번. 53~56번 네 장이 같은 틀을 이어 쓰도록 자식의 자리를 맞춘다. */
export default function FinaleStory({ part, step = 0, leashFrom = 0 }: { part: -1 | 0 | 1 | 2; step?: number; leashFrom?: number }) {
  // 목줄 장면은 둘로 나뉜다: 41번(낱말 → 몸, 목줄의 문장)과, 42~52번(그 안에 누가 있을까)을 지나 돌아오는 53번(신에게 목줄이 걸릴까).
  // 53번은 41번의 셋째 단계부터 이어 그린다(leashFrom = 2).
  const leash = part === -1, bridge = part === 0 && step === 0, ls = step + leashFrom;
  const head: { name: string; kicker: string; title: ReactNode; lead: string; notes?: [string, string][] } | null =
    leash ? null : bridge ? BRIDGE : part === 1 ? { ...HEAD[1], ...UNFINISHED[Math.min(3, step)] } : HEAD[part];
  // 41·42번의 3D 단계: 41번 -1~1, 42번 2~3
  const phase = leash ? ls - 1 : 2 + step;
  const className = leash ? "personal-v2 leash finale-pre" : `finale finale--${part}${bridge ? " finale--bridge" : ""}${part === 2 ? " kn-closing" : ""}`;
  return <Frame n={54 + part} name={head?.name ?? "신에게 목줄"} step={step} className={className}>
    <div className="fn-sky" aria-hidden="true">
      <img className="fn-plate fn-plate--blue" src="/house-dawn/blue.jpg" alt=""/>
      <img className="fn-plate fn-plate--sun" src="/house-dawn/sunrise.jpg" alt=""/>
      <div className="fn-tint"/>
      <div className="fn-shade"/>
    </div>
    {part <= 0 && <LeashLayer phase={phase}/>}
    {head ? <div className="fn-head" key={`h${part}-${part === 0 || part === 1 ? step : 0}`}>
      <p className="fn-kicker">{head.kicker}</p>
      <h1>{head.title}</h1>
      {head.lead && <p className="fn-lead">{head.lead}</p>}
      {head.notes && <ul className="fn-notes">{head.notes.map(([name, text], i) => <li key={name} style={{ "--i": i } as CSSProperties}><b>{name}</b>{text}</li>)}</ul>}
    </div> : <LeashCopy step={ls}/>}
    {part === 0 && step === 1 && <Strata/>}
    {part === 1 && <><Blueprint3D step={step} fallback={<Blueprint/>}/><p className="fn-legend"><span><i/>실선 · 만든 방</span><span><i data-dash/>점선 · 구상·가정</span></p></>}
    {part === 2 && <>
      <p className="fn-ask">처음의 두 마음은, 지금도 그대로입니다.</p>
      <ClosingChoices/>
    </>}
  </Frame>;
}
