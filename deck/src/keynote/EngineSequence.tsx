import EngineWorld from "./EngineWorld";
import { Frame } from "./KeynoteFrame";

const CUES = [
 { name:"Factory 안으로",title:"제가 만들고 있는 생산 기반",body:"하나의 아이디어를 여러 종류의 결과물로",detail:"",output:"" },
 { name:"목소리와 강의",title:"tts-engine",body:"내 목소리로 강의를 만든다",detail:"대본에서 음성, 자막, 강의 영상까지",output:"틀린 페이지의 음성을 다시 만들고 비교한다" },
 { name:"이미지와 입체",title:"assets-engine",body:"필요한 에셋을 직접 만든다",detail:"2D 이미지와 3D 소품을 만들고 편집한다",output:"결과를 보관하고 다음 작업에 다시 쓴다" },
 { name:"음악과 후보",title:"music-engine",body:"가사와 음악 지시로 곡을 만든다",detail:"후보를 듣고 고르며, 필요한 구간을 다시 만든다",output:"선택한 결과를 WAV로 내보낸다" },
 { name:"다시, 전체를 보면",title:"제가 갖추려는 것은 만드는 능력입니다",body:"목소리, 이미지, 음악을 내 작업에 꺼내 쓸 수 있도록",detail:"",output:"" },
];
export default function EngineSequence({phase}:{phase:number}){
 const cue=CUES[phase],overview=phase===0||phase===4;
 return <Frame n={12+phase} name={cue.name} className={`kn-engine-sequence ${overview?"is-overview":"is-engine"}`}>
  <EngineWorld phase={phase}/>
  <div className="engine-copy" key={phase}>
   <p className="kn-kicker">{overview?"JAVIS FACTORY":`LOCAL PRODUCTION / 0${phase}`}</p>
   <h1>{cue.title}</h1><h2>{cue.body}</h2>
   {!overview&&<div className="engine-capabilities"><p>{cue.detail}</p><p>{cue.output}</p></div>}
  </div>
  <div className="engine-route" aria-label="엔진 탐색 위치">
   {["Factory","TTS","Assets","Music","전체 조망"].map((name,i)=><span key={name} data-active={i===phase||undefined}>{name}</span>)}
  </div>
  <span className="engine-navigation">→ 다음 장면으로 이동</span>
 </Frame>;
}
