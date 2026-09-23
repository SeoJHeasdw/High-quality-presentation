import type { CSSProperties } from "react";
import { Frame } from "./KeynoteFrame";
import EnginePreview from "./EnginePreview";
export { default as PersonalIntro } from "./personal/PersonalIntro";
export { default as PersonalCompute } from "./personal/ProductionTimeline";

export function PersonalEngines() {
 // 22번 Blender 갤러리와 같은 배치: 가운데 01 VOICE, 왼쪽 02 IMAGE, 오른쪽 03 MUSIC.
 const panels = [
  { key: "image", engine: "02 / IMAGE", title: "설명으로 만든 이미지", image: "/factory-film/03-image.jpg", alt: "현재 Local Assets Engine으로 생성한 청록색 유리 깃털의 새 이미지", description: "이 발표를 준비하며 새로 생성한 이미지" },
  { key: "voice", engine: "01 / VOICE", title: "제 목소리로 만든 강의", image: "/demos/tts-lecture.jpg", alt: "TTS Engine으로 만든 실제 강의 영상의 장표와 자막", description: "대본에 음성과 자막을 붙인 결과" },
  { key: "music", engine: "03 / MUSIC", title: "가사로 만든 음악", image: "/factory-film/04-music.jpg", alt: "실제 음악 후보의 파형을 원반 위에 표현한 Blender 장면", description: "실제 음악 후보의 파형을 표현한 장면" },
 ];
 return <Frame n={20} name="개발 중인 세 도구" className="personal-v2 p17">
  <div className="p17-hall" aria-hidden="true"><i className="p17-floor"/><i className="p17-strip p17-strip--l"/><i className="p17-strip p17-strip--r"/><i className="p17-beam p17-beam--l"/><i className="p17-beam p17-beam--c"/><i className="p17-beam p17-beam--r"/></div>
  <div className="p17-copy"><p className="pv-eyebrow">실제 화면과 결과물</p><h1>제가 만들고 있는 세 가지 도구</h1></div>
  <p className="p17-hint">마우스로 움직이고 · 클릭해서 크게 보기 <span aria-hidden="true">↗</span></p>
  <div className="p17-gallery">
   {panels.map((panel, i) => <div key={panel.key} className={`p17-panel p17-panel--${panel.key}`} style={{ "--i": i } as CSSProperties}>
    <EnginePreview engine={panel.engine} title={panel.title} image={panel.image} alt={panel.alt} description={panel.description}/>
   </div>)}
  </div>
  <div className="p17-next"><p>아직은 각각의 도구입니다.</p><span>하나씩 들어가 보겠습니다 <b aria-hidden="true">→</b></span></div>
 </Frame>;
}
