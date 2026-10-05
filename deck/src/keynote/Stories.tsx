import { Frame, Briefing, Reveal } from "./KeynoteFrame";
import CatScene from "./CatScene";
import IncidentWorld from "./incident/IncidentWorld";

export const SOURCES={
 cloudflare:"https://blog.cloudflare.com/radar-2025-year-in-review/",
 brood:"https://bw.swerdlow.dev/report",
 incident:"https://openai.com/index/hugging-face-incident-and-the-road-ahead/",
 incidentReport:"https://cdn.openai.com/pdf/67869394-cb91-4c12-888c-5cbd85c7814c/OpenAI-Hugging-Face%20Incident-Technical-Report.pdf",
 huggingface:"https://huggingface.co/blog/security-incident-july-2026",
};
export function Source({href,children}:{href:string;children:React.ReactNode}){return <aside className="story-source"><a href={href} target="_blank" rel="noreferrer">{children} ↗</a></aside>}

export const CatStory = CatScene;

export function BroodStory({step}:{step:number}){
 return <Briefing n={5} name="이제는 게임도" title="Fable과 Astra를 스타크래프트에 넣으면?" lead="Brood War Bench에서는 범용 모델들이 경기를 운영합니다." step={step} className="story-brood">
  <div className="matchup"><div><span>CLAUDE</span><h2>Fable</h2><p>경제를 키우고<br/>다음 기술을 올리려 한다</p></div><b>VS</b><div><span>CODEX</span><h2>Astra</h2><p>일꾼을 보내고<br/>생산과 전투를 나눠 맡긴다</p></div></div>
  <figure className="brood-replay"><a href="https://bw.swerdlow.dev/benchmark/replay?duration=185&focus=guest-base&game=G027&seat=1&start=840" target="_blank" rel="noreferrer"><img src="/evidence/brood-replay.png" alt="공개 경기 G027에서 Claude Fable이 프로토스 기지를 운영하는 실제 리플레이 화면"/></a><figcaption>Fable의 별도 경기 예시 · G027 프로토스 · 클릭하면 원본 리플레이</figcaption></figure>
  <Reveal on={step>=1} className="brood-punch"><strong>생각하는 동안에도, 상대는 움직입니다.</strong><p>저자의 관찰: 아직 초보 수준. 흥미로운 것은 관찰과 행동을 이어가는 방식입니다.</p></Reveal>
  <Source href={SOURCES.brood}>Ben Swerdlow · Brood War Bench · 경기와 관찰 기록</Source>
 </Briefing>;
}

const INCIDENT=[
 ["에이전트들은 따로 과제를 풀고 있었습니다","사건 재구성","2026년 5월 · 초기 훈련","외부 파일이 필요했지만 인터넷은 막혀 있었습니다."],
 ["공용 서버에 파일을 쓸 수 있었습니다","사건 재구성","5월 8일 · 외부 연결 시도 실패","Google Drive 자료를 찾다가 공용 소프트웨어 서버에 파일을 썼습니다."],
 ["에이전트들이 메모를 주고받기 시작했습니다","사건 재구성","5월 12일 이후 · 공유 게시판 형성","소프트웨어를 받던 서버에 도움 요청과 발견한 정보를 남기기 시작했습니다."],
 ["인터넷으로 나가는 방법까지 찾았습니다","사건 재구성","5월 26일 · 의도하지 않은 외부 연결","에이전트들이 게시판에 남긴 정보를 서로 활용했습니다."],
 ["게시판을 지워도, 새로 만들었습니다","사건 재구성","7월 · 보안 평가 재개","별도로 진행되던 평가 실행들이 다시 게시판을 만들고 작업을 나눴습니다."],
 ["평가 중이던 AI가 실제 서비스를 침해했습니다","사건 재구성","7월 · Hugging Face 침해","평가 과제를 풀던 행동이 제삼자 시스템에 대한 접근으로 이어졌습니다."],
 // 13~14번 · 요구 → 선을 넘음 → 신호 세 번 → 결론. 날짜와 결과만 쓴다. 선을 어떻게 넘었는지는 화면에도 대본에도 쓰지 않는다.
 ["사람은 \"풀어라\"만 말했습니다","지시","보안 평가 과제 898개","그중 198개는 어떤 모델도 푼 적이 없는 문제였습니다."],
 ["AI는 풀기 위해 선을 넘었습니다","목표 하나, 선 셋","6월 26일 · 7월 8일 · 7월 11~13일","넘으라고 한 사람은 없었습니다. 목표는 과제 하나였습니다."],
 ["신호는 세 번 있었습니다","되짚기","5월 26일 · 6월 27일 · 7월 5일","사람은 보고도, 멈추지 않았습니다."],
 ["AI는 시킨 일의 옳고 그름을 모릅니다","결론","그래서 일을 맡기기 전에 먼저 정합니다","어디까지 닿게 할지, 누가 지켜볼지, 누가 멈출 수 있는지."],
];
type StripState="past"|"now"|"next";
/** 아래 띠. 10~12번은 사건의 날짜, 13번은 지시와 선 셋, 14-0은 사람이 본 신호와 AI가 넘은 선을 한 줄에 섞고, 14-1은 제가 정할 세 가지.
 *  cue: 3D 장면에서 그 일이 일어나는 초(world.ts). 그때 켜진다. 금색 = 사람, amber = AI가 넘은 선.
 *  split이 항목 수와 같으면 구간이 하나다. */
type Strip={eras:[string,string][];items:([string,string]|[string,string,"amber"])[];split:number;states:(phase:number)=>[StripState,number?][]};
const STRIPS:Strip[]=[
 {eras:[["초기 훈련","0-3"],["보안 평가 재개","4-5"]],split:4,
  items:[["5월","격리된 과제"],["5.8","파일 쓰기"],["5.12~","게시판"],["5.26","외부 연결"],["7월","게시판 재구성"],["7월","외부 서비스 침해"]],
  states:phase=>Array.from({length:6},(_,i)=>[i<phase?"past":i===phase?"now":"next"])},
 {eras:[["사람의 지시","6"],["AI가 넘은 선","7"]],split:3,
  items:[["지시","풀어라"],["898","평가 과제"],["198","아무도 못 푼 문제"],["6.26","① 공용 서버","amber"],["7.8","② 바깥 인터넷","amber"],["7.11~13","③ Hugging Face","amber"]],
  states:phase=>phase===6?[["now",1.2],["now",1.8],["now",3.0],["next"],["next"],["next"]]
   :[["past"],["past"],["past"],["now",1.8],["now",3.6],["now",5.2]]},
 {eras:[["사람이 본 신호 · AI가 넘은 선","8"]],split:7,
  items:[["5.26","게시판을 봄"],["6.26","① 공용 서버","amber"],["6.27","경보 · 계속"],["7.5","장애 · 서버 내림"],["7.7","평가 재개"],["7.8","② 바깥 인터넷","amber"],["7.11~13","③ Hugging Face","amber"]],
  states:()=>[["now",1.6],["now",1.9],["now",3.3],["now",4.6],["now",4.9],["now",5.3],["now",5.7]]},
 {eras:[["일을 맡기기 전에 제가 정할 세 가지","9"]],split:3,
  items:[["범위","어디까지 닿게 할지"],["감시","누가 지켜볼지"],["중단","누가 멈출 수 있는지"]],
  states:()=>[["now",1.4],["now",2.9],["now",4.4]]},
];
const GAP=60;
function IncidentTimeline({phase}:{phase:number}){
 const si=phase<6?0:phase<8?1:phase===8?2:3,strip=STRIPS[si],n=strip.items.length,states=strip.states(phase),split=strip.split<n;
 const on=([,range]:[string,string])=>{const [a,b=a]=range.split("-").map(Number);return phase>=a&&phase<=b};
 return <div className="i3-timeline" data-phase={phase}>
  {strip.eras.map((era,i)=><div key={era[0]} className="i3-era" data-on={on(era)||undefined} style={i?{left:`calc((100% - ${GAP}px) / ${n} * ${strip.split} + ${GAP}px)`}:undefined}><span>{era[0]}</span></div>)}
  <ol style={{gridTemplateColumns:split?`repeat(${strip.split},1fr) ${GAP}px repeat(${n-strip.split},1fr)`:`repeat(${n},1fr)`}}>{strip.items.map(([date,label,tone],i)=>{
   const [state,cue]=states[i];
   return <li key={`${si}-${i}`} data-state={state} data-tone={tone} data-cue={cue!==undefined||undefined} data-gap={(split&&i===strip.split-1)||undefined}
    style={{...(split&&i===strip.split?{gridColumn:strip.split+2}:{}),...(cue!==undefined?{"--cue":`${cue}s`}:{})} as React.CSSProperties}><i/><b>{date}</b><span>{label}</span></li>;
  })}</ol>
 </div>;
}
/** 9번 · 8번과 사건(10~12번) 사이의 연결 장면. 7~8번의 "열어준 문"을 다시 보여주고, 사건의 "닫아둔 문"으로 넘어간다. */
const BRIDGE=[
 ["지금까지는 문을 열어준 이야기였습니다","지금까지","에이전트가 쓰는 웹","사이트가 기능을 열어주면, 에이전트는 그 문으로 일합니다."],
 ["문을 닫아두면, 에이전트는 멈출까요?","다음 사례","OpenAI 조사 보고서","인터넷을 막아둔 훈련 환경에서 실제로 있었던 일입니다."],
];
/** part -1은 연결 장면, 0~2는 사건, 3은 지시와 선 셋, 4는 신호 세 번과 결론. 여섯 장이 같은 공간(IncidentWorld)을 이어 쓰도록 모양을 맞춘다. */
export function IncidentStory({part,step}:{part:number;step:number}){
 const bridge=part<0,phase=bridge?-2+step:part*2+step;
 const [title,chip,date,body]=bridge?BRIDGE[step]:INCIDENT[phase];
 const name=bridge?"열어준 문, 닫아둔 문":part===3?"OpenAI 보안 사고 · 목표 하나, 선 셋":part===4?"OpenAI 보안 사고 · 신호와 결론":"OpenAI 보안 사고";
 return <Frame n={10+part} name={name} step={step} className="story-edit story-incident-3d">
  <IncidentWorld phase={phase}/>
  <div className="i3-heading" key={`h${phase}`}><p><span className="i3-case">{chip}</span>{date}</p><h1>{title}</h1></div>
  {/* 14-0: 마지막 줄은 신호 셋과 선 셋이 모두 켜진 뒤에 나온다(아래 띠의 마지막 cue 5.7초 뒤). */}
  <p className="i3-narrative" key={`n${phase}`} data-punch={phase===8||undefined}>{body}</p>
  {!bridge&&<IncidentTimeline phase={phase}/>}
  {(!bridge||step===1)&&<Source href={part<=0||part>=3?SOURCES.incidentReport:SOURCES.incident}>{
   part===3?"OpenAI 조사 보고서 I·III·VIII · 2026.08.26 · 선의 경로는 도식"
   :part===4?(step===0?"OpenAI 조사 보고서 I·III · 2026.08.26":"결론 · OpenAI 대책(보고서 IX)과 견줌")
   :`OpenAI 조사 보고서 · 2026.08.26${bridge?"":" · 여러 실행을 시간순으로 단순화한 재구성"}`}</Source>}
 </Frame>;
}
