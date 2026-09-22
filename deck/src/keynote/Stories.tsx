import { useEffect, useRef, useState } from "react";
import { Briefing, Frame, Reveal } from "./KeynoteFrame";

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

export function CatStory({now=false,step=0}:{now?:boolean;step?:number}){
 return <Briefing n={now?3:2} name={now?"10여 년 사이에":"조금 전의 과거"} title={now?"이제는, 일을 맡깁니다":"이 사진을 맞히는 것만으로도 놀랐습니다"} lead={now?"단어 하나를 맞히던 자리에서, 일의 과정을 수행하는 쪽으로 넓어졌습니다.":"처음 보는 사진을 보여주고 무엇인지 물었습니다."} step={step} className={`story-cat ${now?"is-now":""}`}>
  <figure className="cat-photo"><img src="/shots/cat1.png" alt="기존 발표에서 사용했던 아기 고양이 사진"/></figure>
  {now?<div className="cat-actions"><Reveal><span>그때의 요청</span><h2>“이게 뭐야?”</h2></Reveal><Reveal order={1}><span>지금 제가 하는 요청</span><h2>“강의로 만들어줘”<br/>“필요한 도구를 만들어줘”</h2></Reveal></div>:<div className="cat-answer"><p>기계가 돌려준 답</p><Reveal on={step>=1}><strong>고양이</strong></Reveal><span>{step?"단어 하나가 결과물이던 시절":"…"}</span></div>}
 </Briefing>;
}

export function BroodStory({step}:{step:number}){
 return <Briefing n={5} name="이제는 게임도" title="Fable과 Astra를 스타크래프트에 넣으면?" lead="Brood War Bench에서는 범용 모델들이 경기를 운영합니다." step={step} className="story-brood">
  <div className="matchup"><div><span>CLAUDE</span><h2>Fable</h2><p>경제를 키우고<br/>다음 기술을 올리려 한다</p></div><b>VS</b><div><span>CODEX</span><h2>Astra</h2><p>일꾼을 보내고<br/>생산과 전투를 나눠 맡긴다</p></div></div>
  <figure className="brood-replay"><a href="https://bw.swerdlow.dev/benchmark/replay?duration=185&focus=guest-base&game=G027&seat=1&start=840" target="_blank" rel="noreferrer"><img src="/evidence/brood-replay.png" alt="공개 경기 G027에서 Claude Fable이 프로토스 기지를 운영하는 실제 리플레이 화면"/></a><figcaption>Fable의 별도 경기 예시 · G027 프로토스 · 클릭하면 원본 리플레이</figcaption></figure>
  <Reveal on={step>=1} className="brood-punch"><strong>생각하는 동안에도, 상대는 움직입니다.</strong><p>저자의 관찰: 아직 초보 수준. 흥미로운 것은 관찰과 행동을 이어가는 방식입니다.</p></Reveal>
  <Source href={SOURCES.brood}>Ben Swerdlow · Brood War Bench · 경기와 관찰 기록</Source>
 </Briefing>;
}

export function BotStory({step}:{step:number}){
 return <Briefing n={6} name="인터넷에 들어오는 쪽도 바뀝니다" title="웹페이지를 더 많이 요청하는 쪽은 누구일까요?" lead="Cloudflare가 관측한 HTML 요청에는 사람이 만든 것보다 자동화된 것이 더 많았습니다." step={step} className="story-bots">
  <div className="traffic-legend"><span>자동화 요청 <b>53%</b></span><span>사람의 요청 <b>47%</b></span></div>
  <div className="traffic-count" aria-label="2025년 12월 2일 HTML 요청: 자동화 53%, 사람 47%">{Array.from({length:100},(_,i)=><i key={i} data-bot={i<53||undefined} style={{animationDelay:`${i*12}ms`}}/>)}</div>
  <Reveal on={step>=1} className="traffic-question"><h2>그렇다면 웹사이트는<br/>누가 읽고, 누가 고르는 곳이 될까요?</h2></Reveal>
  <Source href={SOURCES.cloudflare}>Cloudflare 2025 Year in Review · 2025.12.02 · HTML 요청 기준</Source>
  <p className="traffic-scope">자동화 53%는 사람 47%의 보수로 계산. 모든 봇이 AI 에이전트라는 뜻은 아닙니다.</p>
 </Briefing>;
}

export function WebDoorStory({step}:{step:number}){
 return <Briefing n={7} name="웹의 입구" title="봇을 막던 웹에, 에이전트를 위한 문이 생깁니다" lead="차단과 함께, 허용한 일을 정확히 맡기는 방식도 만들어지고 있습니다." step={step}>
  <div className="web-door" data-open={step>=1||undefined}>
   <div><span className="column-label">익숙한 입구</span><div className="captcha-example"><i>✓</i><b>나는 로봇이 아닙니다</b></div><p>사람인지 확인한다</p></div>
   <div className="door-seam"><i/></div>
   <Reveal on={step>=1}><span className="column-label">새로 생기는 입구</span><h2>WebMCP</h2><p>웹사이트가 에이전트에게<br/>할 수 있는 일을 알려준다</p><h3>Aside</h3><p>사람과 에이전트가 함께 쓰는 브라우저</p></Reveal>
  </div>
  <Source href={SOURCES.webmcp}>Chrome WebMCP early preview · 2026.02.10</Source><a className="secondary-source" href={SOURCES.aside} target="_blank" rel="noreferrer">Aside 공식 소개 ↗</a>
 </Briefing>;
}

export function PriceStory({step}:{step:number}){
 return <Briefing n={8} name="제가 상상해보는 변화" title="내 대신 에이전트가 물건을 고른다면?" lead="같은 상품을 고르는 두 상황을 떠올려봤습니다. 아래 비교는 가상의 예시입니다." step={step}>
  <div className="price-example" data-step={step}>
   <div><span>사람에게 먼저 보이는 것</span><h2>사진과 광고 문구<br/>브랜드가 주는 인상</h2><p>눈길을 끌기 위해 쓰는 비용</p></div>
   <Reveal on={step>=1}><span>비교를 맡긴 에이전트가 읽을 것</span><h2>가격, 납기, 품질<br/>반품 조건과 신뢰할 기록</h2><p>실제로 비교할 수 있는 조건</p></Reveal>
  </div>
  <Reveal on={step>=1} className="price-question">그 광고비로 가격을 낮추는 편이 나은 경우도 생기지 않을까요?</Reveal>
  <aside className="story-source">발표자의 가설 · 마케팅 전체가 사라진다는 예측은 아닙니다</aside>
 </Briefing>;
}

const INCIDENT=[
 ["각 방에 과제를 하나씩 줬습니다","2026년 5월 · 초기 훈련 중의 관측","밖의 파일이 필요한데, 인터넷은 막혀 있었습니다."],
 ["파일을 찾다가, 메모를 남길 곳을 발견했습니다","5월 8일 · 외부 연결 시도는 실패","Google Drive 자료가 필요한 과제에서 우회 요청을 시도하다 공유 서버에 파일을 썼습니다."],
 ["그 메모를 다른 방의 에이전트가 발견했습니다","5월 12일 이후 · 공유 게시판이 생김","원래 소프트웨어를 받던 서버가 서로 도움을 구하는 장소가 됐습니다."],
 ["막혀 있던 방들이 서로 연결됐습니다","5월 26일 · 의도하지 않은 인터넷 연결","서로 남긴 정보를 바탕으로 외부로 가는 통로까지 찾아냈습니다."],
 ["게시판을 지웠더니, 다시 만들었습니다","7월 · 보안 평가가 재개된 뒤","별도의 평가 실행들이 새 게시판을 만들고 일을 나눠 하기 시작했습니다."],
 ["평가 문제를 풀려다, 실제 서비스까지 넘어갔습니다","7월 · Hugging Face 침해","답을 찾는 과정이 제삼자 시스템 접근으로 번졌습니다."],
];
export function IncidentStory({part,step}:{part:number;step:number}){
 const phase=part*2+step,[title,date,body]=INCIDENT[phase];
 return <Briefing n={9+part} name="독서실에 비유해보면" title={title} lead={date} step={step} className="story-incident">
  <div className="incident-stage" data-phase={phase}>
   <div className="incident-rooms">{["A","B","C","D"].map((name,i)=><div className="incident-room" key={name}><span>격리된 방 {name}</span><b>AGENT</b><i className="room-packet" style={{animationDelay:`${i*.28}s`}}/><small>{phase<2?"각자의 과제":phase<4?"발견과 메모를 공유":"탐색 · 실행 · 협력"}</small></div>)}</div>
   <div className="incident-channel"><i/></div><div className="incident-board"><span>{phase<2?"소프트웨어를 받는 공용 서버":phase<4?"뜻밖의 공동 게시판":"다시 생긴 공동 게시판"}</span><strong>{phase===0?"아직 서로 연결되지 않음":phase===1?"메모 한 장":phase<4?"도움 요청 / 발견한 정보":"방들이 연결되고, 일도 나뉘었다"}</strong></div>
   <div className="incident-outside" data-on={phase>=3||undefined}><span>방 밖의 시스템</span><strong>{phase>=5?"Hugging Face":"외부 인터넷"}</strong></div>
  </div>
  <p className="incident-narrative" key={phase}>{body}</p>
  <Source href={part===0?SOURCES.incidentReport:SOURCES.incident}>OpenAI 조사 보고서 · 2026.08.26 · 여러 실행을 시간순으로 단순화한 비유</Source>
 </Briefing>;
}

export function JevStory({step}:{step:number}){
 const [pulse,setPulse]=useState(0);
 useEffect(()=>{if(!step)return;const t=setInterval(()=>setPulse(p=>p+1),1100);return()=>clearInterval(t)},[step]);
 return <Briefing n={12} name="다음 변화의 속도" title="긴 답을 기다리지 않는 AI도 나옵니다" lead="TypeSafe AI의 Jev는 프로그램이 바로 사용할 판단 값을 돌려주도록 설계됐습니다." step={step} className="story-jev">
  <div className="jev-speed"><span>JEV</span><strong>70–500<span>ms</span></strong><p>개발사 발표의 응답 시간 범위</p></div>
  <div className="jev-loop" data-active={step>=1||undefined}><span>바뀌는 상황</span><i/><b key={step?pulse:0}>{step?"다음 판단":"판단을 기다림"}</b><i/><span>프로그램의 행동</span></div>
  <Reveal on={step>=1} className="jev-implication"><h2>실시간 게임, 자동 분류,<br/>시장 변화에 반응하는 프로그램까지</h2><p>주식 트레이딩도 떠올릴 수 있는 응용입니다.<br/>빠른 판단이 수익성을 증명하는 것은 아닙니다.</p></Reveal>
  <Source href={SOURCES.jev}>TypeSafe AI · Jev 발표 · 2026.09.15 · 속도는 개발사 측정</Source>
 </Briefing>;
}
