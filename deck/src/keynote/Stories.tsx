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
 ["에이전트들은 따로 과제를 풀고 있었습니다","2026년 5월 · 초기 훈련","외부 파일이 필요했지만 인터넷은 막혀 있었습니다."],
 ["공용 서버에 파일을 쓸 수 있었습니다","5월 8일 · 외부 연결 시도 실패","Google Drive 자료를 찾다가 공용 소프트웨어 서버에 파일을 썼습니다."],
 ["에이전트들이 메모를 주고받기 시작했습니다","5월 12일 이후 · 공유 게시판 형성","소프트웨어를 받던 서버에 도움 요청과 발견한 정보를 남기기 시작했습니다."],
 ["인터넷으로 나가는 방법까지 찾았습니다","5월 26일 · 의도하지 않은 외부 연결","에이전트들이 게시판에 남긴 정보를 서로 활용했습니다."],
 ["게시판을 지워도, 새로 만들었습니다","7월 · 보안 평가 재개","별도로 진행되던 평가 실행들이 다시 게시판을 만들고 작업을 나눴습니다."],
 ["평가 중이던 AI가 실제 서비스를 침해했습니다","7월 · Hugging Face 침해","평가 과제를 풀던 행동이 제삼자 시스템에 대한 접근으로 이어졌습니다."],
];
const TIMELINE:[string,string][]=[["5월","격리된 과제"],["5.8","파일 쓰기"],["5.12~","게시판"],["5.26","외부 연결"],["7월","게시판 재구성"],["7월","외부 서비스 침해"]];
function IncidentTimeline({phase}:{phase:number}){
 return <div className="i3-timeline" data-phase={phase}>
  <div className="i3-era" data-on={phase<4||undefined}><span>초기 훈련</span></div>
  <div className="i3-era i3-era--late" data-on={phase>=4||undefined}><span>보안 평가 재개</span></div>
  <ol>{TIMELINE.map(([date,label],i)=><li key={i} data-state={i<phase?"past":i===phase?"now":"next"}><i/><b>{date}</b><span>{label}</span></li>)}</ol>
 </div>;
}
/** 9번 · 8번과 사건(10~12번) 사이의 연결 장면. 7~8번의 "열어준 문"을 다시 보여주고, 사건의 "닫아둔 문"으로 넘어간다. */
const BRIDGE=[
 ["지금까지는 문을 열어준 이야기였습니다","지금까지","에이전트가 쓰는 웹","사이트가 기능을 열어주면, 에이전트는 그 문으로 일합니다."],
 ["문을 닫아두면, 에이전트는 멈출까요?","다음 사례","OpenAI 조사 보고서","인터넷을 막아둔 훈련 환경에서 실제로 있었던 일입니다."],
];
/** part -1은 연결 장면, 0~2는 사건. 네 장이 같은 공간(IncidentWorld)을 이어 쓰도록 모양을 맞춘다. */
export function IncidentStory({part,step}:{part:number;step:number}){
 const bridge=part<0,phase=bridge?-2+step:part*2+step;
 const [title,chip,date,body]=bridge?BRIDGE[step]:[INCIDENT[phase][0],"사건 재구성",INCIDENT[phase][1],INCIDENT[phase][2]];
 return <Frame n={9+part} name={bridge?"열어준 문, 닫아둔 문":"OpenAI 보안 사고"} step={step} className="story-edit story-incident-3d">
  <IncidentWorld phase={phase}/>
  <div className="i3-heading" key={`h${phase}`}><p><span className="i3-case">{chip}</span>{date}</p><h1>{title}</h1></div>
  <p className="i3-narrative" key={`n${phase}`}>{body}</p>
  {!bridge&&<IncidentTimeline phase={phase}/>}
  {(!bridge||step===1)&&<Source href={part<=0?SOURCES.incidentReport:SOURCES.incident}>OpenAI 조사 보고서 · 2026.08.26{bridge?"":" · 여러 실행을 시간순으로 단순화한 재구성"}</Source>}
 </Frame>;
}
