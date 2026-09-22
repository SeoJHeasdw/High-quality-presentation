import type { DeckModule } from "../components/deck-kit";
import { Frame, Briefing, Reveal, Rows, SlidePosition } from "./KeynoteFrame";
import EngineSequence from "./EngineSequence";
import { CatStory, BroodStory, BotStory, WebDoorStory, PriceStory, IncidentStory, JevStory } from "./Stories";
import DemoPlayer from "./DemoPlayer";
import { PersonalIntro, PersonalCompute, PersonalRequirements, PersonalSystem, PersonalEngines } from "./PersonalSlides";
import "./keynote.css";
import "./stories.css";
import "./presentation.css";
import "./opening-revision.css";
import "./story-revision.css";
import "./personal-slides.css";
import "./factory-artifacts.css";

const OriginalDeck: DeckModule = {
 className:"deck-keynote",
 slides:[
  {id:"manifesto-cover",scriptKey:"manifesto-cover",render:()=> <Frame n={1} name="제가 살아가려는 방식" scene="uncertain" className="kn-cover">
   <p className="kn-kicker">AI Engineer의 개인 실험</p><h1>나는 자비스를<br/>만들고 있다</h1><p className="hero-note">앞으로 30년, 제 일과 삶을 어떻게 바꿔갈 것인가</p>
  </Frame>},
  {id:"manifesto-person",scriptKey:"manifesto-person",render:()=> <PersonalIntro/>},
  {id:"manifesto-thirty",scriptKey:"manifesto-thirty",render:()=> <Briefing n={3} name="시간의 범위" title="앞으로 30년을 생각했습니다" lead="지금의 직업과 도구가 그대로일 것이라고 가정하기 어렵습니다.">
   <div className="life-timeline">{[["2026","지금 만드는 것"],["2031","5년 뒤의 일"],["2056","30년 뒤의 삶"]].map(([year,label],i)=><Reveal key={year} order={i}><strong>{year}</strong><span>{label}</span></Reveal>)}</div><p className="brief-takeaway">일이 바뀔 때마다, 처음부터 다시 시작하고 싶지는 않습니다.</p>
  </Briefing>},
  {id:"manifesto-unknown",scriptKey:"manifesto-unknown",render:()=> <Frame n={4} name="5년 뒤" className="future-question">
   <p className="future-eyebrow">사진 한 장을 알아보던 AI가 여기까지 왔습니다</p><h1>5년 뒤에는<br/><em>무슨 일을</em><br/>맡기게 될까?</h1><div className="future-year" aria-hidden="true">2031<strong>?</strong></div><p className="future-baseline"><span>2026</span>지금은 강의 영상을 만들고 있습니다.</p>
  </Frame>},
  {id:"tel-personal-change",scriptKey:"tel-personal-change",steps:1,render:({step})=> <Briefing n={5} name="우리에게 익숙한 이야기" title="AI가 중요하다는 것은 알고 있습니다" lead="제가 더 해보고 싶은 것은, 그 변화에 맞춰 제 생활을 바꾸는 일입니다." step={step}>
   <div className="brief-columns"><Reveal><span className="column-label">업무에서 보는 변화</span><h2>기업에 미치는 영향<br/>기술과 산업의 방향</h2><p>우리 팀이 계속 살피고 있는 문제입니다.</p></Reveal><Reveal order={1} on={step>=1}><span className="column-label">제가 직접 바꿔볼 것</span><h2>시간을 쓰는 방식<br/>혼자 만들 수 있는 범위</h2><p>그래서 제 일을 하나씩 맡겨보기 시작했습니다.</p></Reveal></div>
  </Briefing>},
  {id:"manifesto-compute",scriptKey:"manifesto-compute",render:()=> <PersonalCompute/>},
  {id:"manifesto-requirements",scriptKey:"manifesto-requirements",steps:1,render:({step})=> <PersonalRequirements step={step}/>},
  {id:"manifesto-possible",scriptKey:"manifesto-possible",render:()=> <Briefing n={8} name="실제로 달라진 점" title="생각을 도구로 만드는 일이 가까워졌습니다" lead="에이전트와 함께 만들고, 직접 써보고, 필요한 부분을 고칩니다.">
   <Rows items={[["시작","혼자 구현할 양 때문에 미루던 일을 작게 만들어봅니다."],["사용","제 작업에 넣어보면 필요한 것이 더 구체적으로 보입니다."],["수정","불편한 부분을 설명하고, 고친 결과를 다시 확인합니다."]]}/>
  </Briefing>},
  {id:"manifesto-system",scriptKey:"manifesto-system",steps:2,render:({step})=> <PersonalSystem step={step}/>},
  {id:"manifesto-day",scriptKey:"manifesto-day",render:()=> <Briefing n={10} name="제 생활에 대입하면" title="만들고 싶은 것은 구체적입니다" lead="직업 밖에서도 제 아이디어를 결과물로 만들어보고 싶습니다.">
   <Rows items={[["강의 한 편","제 대본을 제 목소리로 읽고, 자막과 화면을 붙입니다."],["게임과 콘텐츠","필요한 이미지와 3D 소품을 직접 만들고 고칩니다."],["음악 한 곡","가사와 방향을 주고, 후보를 들으며 마음에 드는 곡을 고릅니다."]]}/>
  </Briefing>},
  {id:"factory-repositories",scriptKey:"factory-repositories",render:()=> <PersonalEngines/>},
  ...["factory-enter","factory-tts","factory-assets","factory-music","factory-return"].map((id,phase)=>({id,scriptKey:id,group:"factory-flight",render:()=> <EngineSequence phase={phase}/>})),
  {id:"factory-revision",scriptKey:"factory-revision",steps:1,render:({step})=> <Briefing n={17} name="만든 뒤의 작업" title="한 번 생성하고 끝내지 않습니다" lead="결과를 고르고 수정할 수 있어야, 제 작업에 계속 쓸 수 있습니다." step={step} className="brief-evidence">
   <div className="evidence-copy"><Reveal><h2>후보를 비교하고<br/>필요한 곳을 다시 만든다</h2><p>원본과 선택 기록을 남깁니다.</p></Reveal><Reveal order={1} on={step>=1}><h2>최종 판단은 직접 한다</h2><p>발음, 음악성, 에셋 품질을<br/>자동 검사만으로 승인하지 않습니다.</p></Reveal></div>
   <figure className="evidence-shot" data-focus={step}><img src="/engines/tts-editing.png" alt="Local TTS Engine의 페이지 범위 음성 재생성 화면"/><figcaption>Local TTS Engine 개발 중 화면</figcaption></figure>
  </Briefing>},
  {id:"tel-this-presentation",scriptKey:"tel-this-presentation",steps:1,render:({step})=> <Briefing n={18} name="지금 보고 계신 것도" title="이 발표도 AI와 함께 만들었습니다" lead="원하는 경험을 말하고, Astra와 구현하고, 실제로 보며 다시 고쳤습니다." step={step}>
   <Reveal className="actual-request"><span className="column-label">제가 요청한 것</span><blockquote>“→를 누르면 안으로 빨려 들어가면서<br/>실제 엔진들이 나타나면 좋겠어요.”</blockquote></Reveal><Reveal on={step>=1} className="request-result"><span>방금 지나온 장면</span><p>그 요청을 코드와 움직임으로 만들고,<br/>보이는 결과를 기준으로 수정했습니다.</p></Reveal>
  </Briefing>},
  {id:"manifesto-remains",scriptKey:"manifesto-remains",render:()=> <Briefing n={19} name="30년 동안 쌓을 것" title="모델이 바뀌어도 제 작업은 남기고 싶습니다" lead="더 좋은 AI가 나오면, 이미 만든 기반 위에서 받아들일 수 있도록 합니다.">
   <Rows items={[["작업 방식","반복해서 잘 된 일은 다음에도 꺼내 쓸 수 있게 만듭니다."],["판단의 기록","무엇을 골랐고 왜 고쳤는지 남깁니다."],["결과물","다음 강의와 콘텐츠에 다시 쓸 자산을 쌓습니다."]]}/>
  </Briefing>},
  {id:"tel-sharing",scriptKey:"tel-sharing",render:()=> <Briefing n={20} name="밖으로도 이어갈 계획" title="만드는 과정도 공개하려고 합니다" lead="새로운 일이 생겼을 때, 제가 무엇을 할 수 있는 사람인지 알 수 있도록 합니다.">
   <div className="brief-columns"><Reveal><span className="column-label">보여줄 것</span><h2>실제로 만든 결과와<br/>잘 안됐던 과정</h2><p>직접 해보고 얻은 경험을 나누려고 합니다.</p></Reveal><Reveal order={1}><span className="column-label">기대하는 것</span><h2>함께할 사람과<br/>다음에 해볼 일</h2><p>예측하기 어려운 미래에 선택지를 늘리고 싶습니다.</p></Reveal></div>
  </Briefing>},
  {id:"tel-unfinished",scriptKey:"tel-unfinished",render:()=> <Briefing n={21} name="아직 남아 있는 문제" title="완성된 자비스까지는 갈 길이 있습니다" lead="지금은 엔진별 기능을 만들고, 실제 사용에서 막히는 부분을 고치는 단계입니다.">
   <Rows items={[["연결","각 엔진을 제 맥락으로 운영하는 전체 흐름은 계속 만들어야 합니다."],["품질","만드는 것만큼 고르고 수정하는 데에도 제 시간이 듭니다."],["생활","시스템을 만드는 시간이 실제로 쓸모 있는 결과로 이어져야 합니다."]]}/>
  </Briefing>},
  {id:"tel-invitation",scriptKey:"tel-invitation",render:()=> <Briefing n={22} name="팀과 나누고 싶은 질문" className="kn-closing" title={<>내 일 하나를 맡겨본다면,<br/>무엇부터 바꿔볼 수 있을까요?</>} lead="저는 앞으로 30년을 준비하는 방법으로, 제 자비스를 만들고 있습니다.">
   <div className="closing-prompts"><Reveal><h2>계속 미루던 제작</h2><p>혼자 하기엔 일이 많아서<br/>시작하지 못했던 것</p></Reveal><Reveal order={1}><h2>반복해서 하는 작업</h2><p>내 기준은 분명한데<br/>매번 손이 가는 것</p></Reveal></div>
  </Briefing>},
 ],
};
const byId=(id:string)=>OriginalDeck.slides.find(slide=>slide.id===id)!;
const ordered = [
 byId("manifesto-cover"),
 {id:"story-cat",scriptKey:"story-cat",group:"cat-opening",steps:1,render:({step})=><CatStory step={step}/>},
 {id:"story-now",scriptKey:"story-now",group:"cat-opening",steps:1,render:({step})=> <CatStory now step={step}/>},
 byId("manifesto-unknown"),
 {id:"story-brood",scriptKey:"story-brood",steps:1,render:({step})=><BroodStory step={step}/>},
 {id:"story-bots",scriptKey:"story-bots",steps:1,render:({step})=><BotStory step={step}/>},
 {id:"story-web-door",scriptKey:"story-web-door",steps:1,render:({step})=><WebDoorStory step={step}/>},
 {id:"story-price",scriptKey:"story-price",steps:2,render:({step})=><PriceStory step={step}/>},
 ...["story-rooms","story-board","story-boundary"].map((id,part)=>({id,scriptKey:id,steps:1,group:"incident-rooms",render:({step})=><IncidentStory part={part} step={step}/>})),
 {id:"story-jev",scriptKey:"story-jev",steps:1,render:({step})=><JevStory step={step}/>},
 byId("manifesto-person"),
 byId("manifesto-compute"),
 byId("manifesto-requirements"),
 byId("manifesto-system"),
 byId("factory-repositories"),
 ...OriginalDeck.slides.filter(slide=>slide.group==="factory-flight"),
 ...(["tts","assets","music"] as const).map(kind=>({id:`demo-${kind}`,scriptKey:`demo-${kind}`,render:()=> <DemoPlayer kind={kind}/>})),
 byId("tel-this-presentation"),
 byId("manifesto-remains"),
 byId("tel-sharing"),
 byId("tel-unfinished"),
 byId("tel-invitation"),
];
const KeynoteDeck:DeckModule={className:"deck-keynote",slides:ordered.map((slide,index)=>({...slide,render:ctx=><SlidePosition.Provider value={{index,total:ordered.length}}>{slide.render(ctx)}</SlidePosition.Provider>}))};
export default KeynoteDeck;
