import { useState } from "react";
import { Frame } from "./KeynoteFrame";
import FactoryFilm, { type FactoryFilmState } from "./FactoryFilm";

const CUES = [
 { name:"Factory 안으로", label:"JAVIS FACTORY", title:"목소리, 이미지, 음악", detail:"제가 만든 세 도구 안으로 들어가 보겠습니다.", shot:"gallery" },
 { name:"대본에서 영상으로", label:"TTS ENGINE", title:"대본을 제 목소리로 읽습니다", detail:"음성과 자막을 붙인 실제 IBM Bob 데모 영상", shot:"portal" },
 { name:"설명을 이미지로", label:"ASSETS ENGINE", title:"청록색 유리 깃털, 금속 몸체", detail:"Local Assets Engine으로 새로 생성한 이미지", shot:"match-cut" },
 { name:"가사에서 음악으로", label:"MUSIC ENGINE", title:"가사와 분위기를 음악으로", detail:"실제 음악 후보의 파형을 사용했습니다.", shot:"shutter" },
 { name:"실제 결과물", label:"MADE WITH JAVIS", title:"이제 직접 보고 들어보겠습니다", detail:"먼저 제 목소리로 만든 IBM Bob 데모 영상입니다.", shot:"iris" },
];

/* 장면은 →를 누를 때마다 하나씩 재생되고 마지막 화면에서 멈춘다. 스스로 넘어가지 않는다: 장면마다 말을 할지, 바로 넘길지는 발표자가 정한다.
   이름과 제목은 장면이 재생되는 동안 보이고, 설명 줄은 멈춘 화면에서 나온다. */
export default function EngineSequence({phase}:{phase:number}) {
 const cue=CUES[phase];
 const [film,setFilm]=useState<FactoryFilmState|null>(null);
 const here=film?.phase===phase?film:null,settled=!!here?.settled;
 return <Frame n={21+phase} name={cue.name} className={`kn-engine-sequence kn-factory-film factory-film-phase-${phase}`}>
  <FactoryFilm phase={phase} onStateChange={setFilm}/>
  <div className="factory-film-caption" data-ready={settled||here?.status==="playing"||undefined} data-held={settled||undefined} data-shot={cue.shot} key={phase}>
   <span className="factory-film-label">{cue.label}</span>
   <h1>{cue.title}</h1>
   <p>{cue.detail}</p>
  </div>
  <div className="factory-film-cues" aria-label="Factory 장면 위치">{CUES.map((item,index)=><span key={item.label} data-active={index===phase||undefined} aria-label={item.name}/>)}</div>
 </Frame>;
}
