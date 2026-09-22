import { Frame, Reveal } from "./KeynoteFrame";
import musicWave from "./data/music-waveform.json";

export function PersonalIntro() {
 return <Frame n={13} name="서제호의 30년" className="personal-slide personal-intro">
  <p className="personal-eyebrow">이제 제 얘기를 해보겠습니다.</p>
  <h1>앞으로 30년,<br/>저는 뭘 하며 살까요?</h1>
  <div className="personal-profile"><strong>서제호</strong><span>1995년생 · 서울 · AI Engineer</span></div>
  <div className="personal-age-line" aria-label="지금 서른두 살부터 서른 년 뒤 예순두 살까지">
   <div><strong>32</strong><span>지금</span></div><i/><div><strong>62</strong><span>30년 뒤</span></div>
  </div>
 </Frame>;
}

export function PersonalCompute() {
 return <Frame n={14} name="제가 쓸 도구부터" className="personal-slide personal-compute">
  <p className="personal-eyebrow">제가 고른 일</p>
  <h1>저는 쓸 일이 있는 도구부터<br/>만들고 있습니다</h1>
  <div className="personal-lecture-caption"><span>예를 들면</span><strong>강의 한 편</strong></div>
  <div className="personal-lecture-line" aria-label="대본에서 목소리와 자막을 거쳐 강의 영상으로">
   <Reveal className="lecture-part"><span>대본</span><div className="lecture-paper" aria-hidden="true"><i/><i/><i/><i/></div><p>제가 쓴 내용</p></Reveal>
   <span className="lecture-arrow" aria-hidden="true">→</span>
   <Reveal order={1} className="lecture-part"><span>목소리</span><div className="lecture-voice" aria-hidden="true">{[24,46,76,48,94,60,36,71,100,60,33,52,83,42,25].map((h,i)=><i key={i} style={{height:h}}/>)}</div><p>제 목소리로 읽기</p></Reveal>
   <span className="lecture-arrow" aria-hidden="true">→</span>
   <Reveal order={2} className="lecture-part"><span>자막</span><div className="lecture-subtitles" aria-hidden="true"><i/><i/><i/></div><p>소리에 맞춰 붙이기</p></Reveal>
   <span className="lecture-arrow" aria-hidden="true">→</span>
   <Reveal order={3} className="lecture-part lecture-result"><span>강의 영상</span><div className="lecture-screen" aria-hidden="true"><i/></div><p>보고, 듣고, 고치기</p></Reveal>
  </div>
  <p className="personal-compute-note">좋은 AI가 나오면, 이런 작업에 가져다 써보는 겁니다.</p>
 </Frame>;
}

export function PersonalRequirements({step}:{step:number}) {
 return <Frame n={15} name="사용자는 저 한 명" className="personal-slide personal-requirements" step={step}>
  <p className="personal-eyebrow">제 도구의 요구사항</p>
  <h1>쓰는 사람은 저 한 명입니다</h1>
  <div className="personal-single-user"><strong>1<span>명</span></strong><p>기획도, 사용도 제가 합니다.</p></div>
  <div className="personal-requirement-copy">
   {step===0?<div className="personal-small-brief"><span>당장 필요한 기능</span><h2>강의 음성을 만들고,<br/>틀린 페이지만<br/><em>다시 만들고 싶었습니다</em></h2><p>여기서부터 시작하면 됩니다.</p></div>:<div className="personal-tradeoffs">
    <Reveal><h2>조금 느려도 괜찮습니다</h2><p>기다리는 건 저니까요.</p></Reveal>
    <Reveal order={1}><h2>잠깐 꺼도 됩니다</h2><p>안 쓰는 시간에 고치면 됩니다.</p></Reveal>
    <Reveal order={2}><h2>필요한 기능부터 만듭니다</h2><p>제가 안 쓰는 기능은 나중에.</p></Reveal>
    <Reveal order={3}><h2>화면도 제 손에 맞춥니다</h2><p>제가 쓰기 편하면 됩니다.</p></Reveal>
   </div>}
  </div>
  <Reveal on={step>=1} className="personal-record-rule">원본과 작업 기록은 잃어버리면 안 됩니다.</Reveal>
 </Frame>;
}

export function PersonalSystem({step}:{step:number}) {
 return <Frame n={16} name="자비스에 맡기고 싶은 일" className="personal-slide personal-system" step={step}>
  <p className="personal-eyebrow">이 도구들을 어떻게 묶을까</p>
  <h1>“이 대본으로 강의 영상을 만들어줘”</h1>
  <div className="personal-job-line">
   <Reveal className="personal-job-part"><span className="personal-job-label">AGENT OS</span><h2>순서를 정하고<br/>작업을 챙깁니다</h2><p>대본과 목소리 설정을 찾고<br/>수정할 곳을 기억합니다.</p></Reveal>
   <span className="personal-job-arrow" data-on={step>=1||undefined} aria-hidden="true">→</span>
   <Reveal className="personal-job-part" on={step>=1} order={1}><span className="personal-job-label">FACTORY</span><h2>음성·자막·화면을<br/>만듭니다</h2><p>제작 엔진이 맡은 결과를<br/>하나씩 내놓습니다.</p></Reveal>
   <span className="personal-job-arrow" data-on={step>=2||undefined} aria-hidden="true">→</span>
   <Reveal className="personal-job-part personal-job-human" on={step>=2} order={1}><span className="personal-job-label">저는</span><h2>들어보고<br/>틀린 곳을 고칩니다</h2><p>“이 페이지 발음만<br/>다시 만들어줘.”</p></Reveal>
  </div>
  <p className="personal-system-status">이렇게 이어서 쓰는 게 목표입니다. <span>지금은 각 엔진을 따로 개발하고 있습니다.</span></p>
 </Frame>;
}

export function PersonalEngines() {
 return <Frame n={17} name="개발 중인 세 도구" className="personal-slide personal-engines">
  <p className="personal-eyebrow">실제 화면과 결과물</p>
  <h1>제가 만들고 있는 세 가지 도구</h1>
  <div className="personal-engine-previews">
   <Reveal className="personal-engine-preview personal-tts-preview"><div className="personal-preview-title"><span>TTS</span><h2>강의 음성 수정</h2></div><figure><img src="/engines/tts-editing.png" alt="TTS 엔진에서 페이지 범위와 목소리 후보 수를 정하는 편집 화면"/></figure><p>페이지를 골라 음성을 다시 만드는 화면</p></Reveal>
   <Reveal className="personal-engine-preview personal-assets-preview" order={1}><div className="personal-preview-title"><span>ASSETS</span><h2>장면 배치</h2></div><figure><img src="/demos/assets-previz.jpg" alt="Assets 엔진이 출력한 장면 배치 영상의 한 프레임"/></figure><p>장면 배치와 카메라를 확인하는 스케치</p></Reveal>
   <Reveal className="personal-engine-preview personal-music-preview" order={2}><div className="personal-preview-title"><span>MUSIC</span><h2>음악 후보</h2></div><figure aria-label="실제 생성한 15초 음악 후보의 파형"><div className="personal-preview-wave">{musicWave.peaks.map((h,i)=><i key={i} style={{height:Math.max(3,h*148)}}/>)}</div><span className="personal-wave-duration">00:00 <i/> 00:15</span></figure><p>15초 개발 후보 · 최종 청취 승인 전</p></Reveal>
  </div>
  <div className="personal-engines-next"><p>아직은 각각의 도구입니다.</p><span>하나씩 들어가 보겠습니다. <b aria-hidden="true">→</b></span></div>
 </Frame>;
}
