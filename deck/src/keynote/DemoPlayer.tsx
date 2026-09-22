import { useEffect, useRef, useState } from "react";
import { Briefing } from "./KeynoteFrame";
import musicWave from "./data/music-waveform.json";

const DEMOS={
 tts:{title:"제가 만든 강의, 제 목소리로 들어보면",name:"실물 1 / TTS Engine",lead:"기존 강의 영상에서 가져온 24초 구간입니다.",src:"/demos/tts-lecture.mp4",poster:"/demos/tts-lecture.jpg",caption:"실제 생성된 강의 영상 · 원본 00:25–00:49",description:"대본과 화면을 받아 음성·자막·영상으로 만든 결과",audio:false},
 assets:{title:"장면을 만들고, 카메라를 움직여봅니다",name:"실물 2 / Assets Engine",lead:"로컬 엔진이 만든 15초 프리비즈입니다. 구도와 움직임을 먼저 확인하는 스케치입니다.",src:"/demos/assets-previz.mp4",poster:"/demos/assets-previz.jpg",caption:"실제 프리비즈 출력 · 2026.09.22 · 15초",description:"장면 배치와 카메라 움직임이 영상으로 이어진 결과",audio:false},
 music:{title:"이번에는, 설명 대신 잠깐 들어보겠습니다",name:"실물 3 / Music Engine",lead:"한국어 음악 생성 흐름을 확인하며 만든 15초 개발 후보입니다.",src:"/demos/music-candidate.wav",poster:"",caption:"실제 생성 후보 · 최종 청취 승인 전",description:"가사와 음악 지시를 받아 만든 곡 후보",audio:true},
};
export default function DemoPlayer({kind}:{kind:keyof typeof DEMOS}){
 const demo=DEMOS[kind],ref=useRef<HTMLMediaElement>(null);
 const [playing,setPlaying]=useState(false),[muted,setMuted]=useState(true),[time,setTime]=useState(0),[error,setError]=useState("");
 const toggle=()=>{const el=ref.current;if(!el)return;if(el.paused){setError("");void el.play().catch(()=>setError("재생 버튼을 눌러주세요."))}else el.pause()};
 const sound=()=>{const el=ref.current;if(!el)return;el.muted=!el.muted;setMuted(el.muted)};
 useEffect(()=>{
  const media=ref.current;
  const onKey=(e:KeyboardEvent)=>{if(e.ctrlKey||e.metaKey||e.altKey||e.target instanceof HTMLInputElement)return;if(e.key.toLowerCase()==='p'){e.preventDefault();toggle()}if(e.key.toLowerCase()==='a'){e.preventDefault();sound()}};
  window.addEventListener('keydown',onKey);return()=>{window.removeEventListener('keydown',onKey);media?.pause()};
 },[]);
 const events={onPlay:()=>setPlaying(true),onPause:()=>setPlaying(false),onEnded:()=>setPlaying(false),onTimeUpdate:()=>setTime(ref.current?.currentTime??0),onError:()=>setError("미디어를 불러오지 못했습니다. 로컬 서버를 확인해주세요.")};
 const duration=demo.audio?15:kind==='tts'?24:15;
 return <Briefing n={23} name={demo.name} title={demo.title} lead={demo.lead} className="demo-slide">
  <div className="demo-screen">
   {demo.audio?<><audio ref={ref as React.RefObject<HTMLAudioElement>} src={demo.src} preload="auto" muted={muted} {...events}/><div className="music-wave" aria-label="실제 음원의 파형">{musicWave.peaks.map((height,i)=><i key={i} data-played={time/duration>=i/musicWave.peaks.length||undefined} style={{height:`${Math.max(5,height*220)}px`}}/>)}</div><span className="music-time">{time.toFixed(1)}<small> / 15.0 s</small></span></>:<video ref={ref as React.RefObject<HTMLVideoElement>} src={demo.src} poster={demo.poster} preload="auto" playsInline muted={muted} {...events}/>}
   <span className="demo-caption">{demo.caption}</span>
  </div>
  <div className="demo-controls" onKeyDown={e=>{if(e.key===' ')e.stopPropagation()}}><button type="button" onClick={toggle}>{playing?"일시정지":"재생"} <kbd>P</kbd></button>{kind!=='assets'&&<button type="button" onClick={sound}>{muted?"소리 켜기":"소리 끄기"} <kbd>A</kbd></button>}<span>{error||demo.description}</span></div>
 </Briefing>;
}
