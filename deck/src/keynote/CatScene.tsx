import { Frame } from "./KeynoteFrame";

/** One photo stays mounted while the lecturer advances four deliberately held cues. */
export default function CatScene({now=false,step=0}:{now?:boolean;step?:number}){
 const cue=now?2+step:step;
 const titles=["이게 뭐야?","사진에서 이름을 알아내는 일","“제 목소리로 강의 영상 만들어줘.”","“제 목소리로 강의 영상 만들어줘.”"];
 return <Frame n={now?3:2} name={now?"지금 만드는 강의":"조금 전의 과거"} step={step} className="cat-presentation">
  <div className="cat-scene" data-cue={cue}>
   <div className="cat-scene-heading" key={`heading-${cue}`}><p>{cue===0?"10여 년 전":now?"지금":"기계가 돌려준 답"}</p><h1>{titles[cue]}</h1></div>
   <figure className="cat-subject" aria-hidden={now||undefined}><img src="/shots/cat1.png" alt="기존 발표에서 사용했던 아기 고양이 사진"/></figure>
   {cue===1&&<div className="cat-conversation" key="conversation-1">
    <span className="cat-context">이름 하나</span><h2>고양이</h2><p>처음 보는 사진에서<br/>이 단어를 찾아냈습니다.</p>
   </div>}
   {now&&<div className="lecture-request" data-result={step>=1||undefined}>
    <div className="lecture-input"><span>내가 준비한 것</span><h2>대본과 장표</h2><p>제 목소리로 읽고<br/>자막과 화면을 붙입니다.</p></div>
    <figure className="lecture-output" aria-hidden={step<1}><img src="/demos/tts-lecture.jpg" alt="TTS Engine으로 제작한 실제 강의 영상의 장표와 자막"/><figcaption>제 엔진으로 만든 강의 영상</figcaption></figure>
   </div>}
  </div>
 </Frame>;
}
