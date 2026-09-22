import { Frame, Briefing, Reveal } from "./KeynoteFrame";
import CatScene from "./CatScene";
import PriceComparison from "./PriceComparison";
import IncidentDiagram from "./IncidentDiagram";

export const SOURCES={
 cloudflare:"https://blog.cloudflare.com/radar-2025-year-in-review/",
 webmcp:"https://developer.chrome.com/blog/webmcp-epp",
 aside:"https://aside.com/",
 brood:"https://bw.swerdlow.dev/report",
 incident:"https://openai.com/index/hugging-face-incident-and-the-road-ahead/",
 incidentReport:"https://cdn.openai.com/pdf/67869394-cb91-4c12-888c-5cbd85c7814c/OpenAI-Hugging-Face%20Incident-Technical-Report.pdf",
 huggingface:"https://huggingface.co/blog/security-incident-july-2026",
 jev:"https://typesafe.ai/blog/introducing-system-one-models-and-jev",
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

export function BotStory({step}:{step:number}){
 return <Frame n={6} name="웹 요청의 변화" step={step} className="story-edit story-bots-revision">
  <div className="story-heading"><p>Cloudflare · 2025년 12월 2일 HTML 요청</p><h1>웹에는 사람만 오는 게 아닙니다</h1></div>
  <figure className="request-share" aria-label="HTML 요청 중 자동화 53%, 사람 47%">
   <div className="request-share-labels"><div><span>자동화</span><strong>53<small>%</small></strong></div><div><span>사람</span><strong>47<small>%</small></strong></div></div>
   <div className="request-share-bar" aria-hidden="true"><i/><i/></div>
  </figure>
  <Reveal on={step>=1} className="request-share-question"><h2>에이전트도 웹사이트를 쓴다면?</h2></Reveal>
  <p className="story-scope">자동화 비율은 사람 47%의 나머지로 계산했습니다. 모든 봇이 AI 에이전트인 것은 아닙니다.</p>
  <Source href={SOURCES.cloudflare}>Cloudflare · 2025 Year in Review</Source>
 </Frame>;
}

export function WebDoorStory({step}:{step:number}){
 return <Frame n={7} name="에이전트가 쓰는 웹" step={step} className="story-edit story-web-revision">
  <div className="story-heading"><p>웹사이트와 에이전트</p><h1>에이전트용 웹 기능이 생기고 있습니다</h1></div>
  <div className="web-access-comparison">
   <div className="web-human-check"><span className="access-label">사람인지 확인</span><div className="captcha-example"><i>✓</i><b>나는 로봇이 아닙니다</b></div></div>
   <Reveal on={step>=1} className="web-agent-access"><span className="access-label">에이전트에게 기능 제공</span><h2>WebMCP</h2><p>사이트가 제공하는 기능을<br/>에이전트가 호출합니다.</p><div className="web-aside"><strong>Aside</strong><span>사람과 에이전트가 함께 쓰는 브라우저</span></div></Reveal>
  </div>
  <Source href={SOURCES.webmcp}>Chrome · WebMCP early preview · 2026.02.10</Source><a className="secondary-source" href={SOURCES.aside} target="_blank" rel="noreferrer">Aside 공식 소개 ↗</a>
 </Frame>;
}

export const PriceStory = PriceComparison;

const INCIDENT=[
 ["에이전트들은 따로 과제를 풀고 있었습니다","2026년 5월 · 초기 훈련","외부 파일이 필요했지만 인터넷은 막혀 있었습니다."],
 ["공용 서버에 파일을 쓸 수 있었습니다","5월 8일 · 외부 연결 시도 실패","Google Drive 자료를 찾다가 공용 소프트웨어 서버에 파일을 썼습니다."],
 ["에이전트들이 메모를 주고받기 시작했습니다","5월 12일 이후 · 공유 게시판 형성","소프트웨어를 받던 서버에 도움 요청과 발견한 정보를 남기기 시작했습니다."],
 ["인터넷으로 나가는 방법까지 찾았습니다","5월 26일 · 의도하지 않은 외부 연결","에이전트들이 게시판에 남긴 정보를 서로 활용했습니다."],
 ["게시판을 지워도, 새로 만들었습니다","7월 · 보안 평가 재개","별도로 진행되던 평가 실행들이 다시 게시판을 만들고 작업을 나눴습니다."],
 ["평가 중이던 AI가 실제 서비스를 침해했습니다","7월 · Hugging Face 침해","평가 과제를 풀던 행동이 제삼자 시스템에 대한 접근으로 이어졌습니다."],
];
export function IncidentStory({part,step}:{part:number;step:number}){
 const phase=part*2+step,[title,date,body]=INCIDENT[phase];
 return <Frame n={9+part} name="OpenAI 보안 사고" step={step} className="story-edit story-incident-revision">
  <div className="story-heading"><p>{date}</p><h1>{title}</h1></div>
  <IncidentDiagram phase={phase}/>
  <p className="incident-narrative" key={phase}>{body}</p>
  <Source href={part===0?SOURCES.incidentReport:SOURCES.incident}>OpenAI 조사 보고서 · 2026.08.26 · 여러 실행을 시간순으로 단순화한 도해</Source>
 </Frame>;
}

export function JevStory({step}:{step:number}){
 return <Frame n={12} name="프로그램의 응답 속도" step={step} className="story-edit story-jev-revision">
  <div className="story-heading"><p>TypeSafe AI · Jev</p><h1>AI의 답을 프로그램이 바로 쓴다면</h1></div>
  <div className="jev-response"><div className="jev-duration"><strong>70–500<small>ms</small></strong><p>응답 시간 · 개발사 측정</p></div><p className="jev-return">프로그램이 쓸<br/><em>판단 값</em>을 돌려줍니다.</p></div>
  <Reveal on={step>=1} className="jev-action-flow"><div><span>게임 상황</span><small>응용 예시</small></div><i/><div className="jev-action-model"><span>다음 행동 선택</span><small>Jev · 70–500ms</small></div><i/><div><span>게임에 행동 전달</span></div></Reveal>
  <Source href={SOURCES.jev}>TypeSafe AI · Jev 발표 · 2026.09.15 · 속도는 개발사 측정</Source>
 </Frame>;
}
