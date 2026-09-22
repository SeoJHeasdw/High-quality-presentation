import { Frame } from "./KeynoteFrame";

/** One photo stays mounted while the lecturer advances four deliberately held cues. */
export default function CatScene({now=false,step=0}:{now?:boolean;step?:number}){
 const cue=now?2+step:step;
 const titles=["이게 뭐야?","사진에서 이름을 알아내는 일","이제는, 일을 맡깁니다","부탁의 크기가 달라졌습니다"];
 return <Frame n={now?3:2} name={now?"10여 년 사이에":"조금 전의 과거"} step={step} className="cat-presentation">
  <div className="cat-scene" data-cue={cue}>
   <div className="cat-scene-heading" key={`heading-${cue}`}><p>{cue===0?"10여 년 전":now?"지금 제가 하는 부탁":"기계가 돌려준 답"}</p><h1>{titles[cue]}</h1></div>
   <figure className="cat-subject"><img src="/shots/cat1.png" alt="기존 발표에서 사용했던 아기 고양이 사진"/></figure>
   {cue>0&&<div className="cat-conversation" key={`conversation-${cue}`}>
    {cue===1?<><span className="cat-context">이름 하나</span><h2>고양이</h2><p>처음 보는 사진에서<br/>이 단어를 찾아냈습니다.</p></>:<><span className="cat-context">작업 하나</span><h2>“강의 한 편<br/>만들어줘.”</h2>{cue===2?<p>대답을 듣고 끝내던 자리에서,<br/>완성된 결과물을 부탁합니다.</p>:<div className="cat-work-sequence">{["대본","음성","자막","영상"].map((label,i)=><span key={label} style={{animationDelay:`${i*130+400}ms`}}>{label}</span>)}</div>}</>}
   </div>}
  </div>
 </Frame>;
}
