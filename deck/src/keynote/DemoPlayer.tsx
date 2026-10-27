import { useEffect, useRef, useState } from "react";
import { Briefing } from "./KeynoteFrame";
import musicWave from "./data/music-waveform-hiphop.json";
import { shortcutKey } from "../components/keys";

/** 31번 · 뮤직비디오(../mv/render/hiphop-mv-tel.mp4). 로컬 발표 서버가 내보내며, 파일이 없으면 링크를 띄우지 않는다. */
const MV="/__javis/mv/hiphop-mv-tel.mp4";
const DEMOS={
 tts:{title:"회사 일로 만든 영상, 제 목소리로 들어보면",name:"실물 1 / TTS Engine",lead:"IBM Bob 데모 영상에서 Bob이 직접 일하는 26초입니다.",src:"/demos/bob-work.mp4",poster:"/demos/bob-work.jpg",caption:"실제 만든 IBM Bob 데모 영상 · 원본 2:49–3:15",description:"대본과 작업 화면을 받아 음성·자막·영상으로 만든 결과",audio:false},
 assets:{title:"영상도, 3D 에셋도 뽑아냅니다",name:"실물 2 / Assets Engine",lead:"10월에 Assets Engine으로 만든 것들을 15초로 이어 붙였습니다.",src:"/demos/assets-reel.mp4",poster:"/demos/assets-reel.jpg",caption:"실제 출력 · 2026.10.16–10.22 · 15초로 편집",description:"여우 영상 · 달빛 야시장 3D 소품 32개 · 건축 키트 · 나무 · 지형 질감",audio:false},
 music:{title:"이번에는, 설명 대신 잠깐 들어보겠습니다",name:"실물 3 / Music Engine",lead:"제가 만든 감성 힙합 초안을 들어보겠습니다.",src:"/demos/emotional-hiphop-draft.wav",poster:"",caption:"감성 힙합 초안 · 3분",description:"가사와 음악 지시로 만든 곡",audio:true},
};
export default function DemoPlayer({kind}:{kind:keyof typeof DEMOS}){
 const demo=DEMOS[kind],ref=useRef<HTMLMediaElement>(null);
 const autoStart=useRef<number|null>(null);
 const [playing,setPlaying]=useState(false),[muted,setMuted]=useState(kind==='assets'),[time,setTime]=useState(0),[error,setError]=useState("");
 const launchPending=useRef(false);
 const [launching,setLaunching]=useState(false),[launchMessage,setLaunchMessage]=useState("");
 const [hasMv,setHasMv]=useState(false);
 useEffect(()=>{
  if(kind!=='music')return;
  let cancelled=false;
  fetch(MV,{method:'HEAD'}).then(r=>{if(!cancelled)setHasMv(r.ok&&(r.headers.get('content-type')??'').startsWith('video/'))}).catch(()=>{});
  return()=>{cancelled=true};
 },[kind]);
 // 새 탭에서 뮤직비디오가 소리와 함께 재생되므로, 이 장의 음원은 멈춘다.
 const openMv=()=>{if(autoStart.current!==null){window.clearTimeout(autoStart.current);autoStart.current=null}ref.current?.pause()};
 const engineName=kind==='tts'?'TTS':kind==='assets'?'Assets':'Music';
 const launchEngine=async()=>{
  if(launchPending.current)return;
  launchPending.current=true;setLaunching(true);setLaunchMessage("");
  if(autoStart.current!==null){window.clearTimeout(autoStart.current);autoStart.current=null}
  ref.current?.pause();
  if(document.fullscreenElement)await document.exitFullscreen().catch(()=>{});
  try{
   const response=await fetch(`/__javis/engines/${kind}/launch`,{method:'POST',headers:{'X-Javis-Launch':'1'},signal:AbortSignal.timeout(10000)});
   const result=await response.json().catch(()=>null);
   if(!response.ok||!result?.ok)throw new Error(result?.error||"로컬 발표 서버를 다시 켠 뒤 실행해주세요.");
   setLaunchMessage(`${engineName} 엔진 실행을 요청했습니다. 앱 창을 확인해주세요.`);
  }catch(cause){setLaunchMessage(cause instanceof Error&&!(cause instanceof TypeError)&&cause.name!=='TimeoutError'?cause.message:"실행 서버에 연결하지 못했습니다. 로컬 발표 서버를 확인해주세요.")}
  finally{launchPending.current=false;setLaunching(false)}
 };
 const toggle=()=>{if(autoStart.current!==null){window.clearTimeout(autoStart.current);autoStart.current=null}const el=ref.current;if(!el)return;if(el.paused){setError("");void el.play().catch(()=>setError("재생 버튼을 눌러주세요."))}else el.pause()};
 const sound=()=>{const el=ref.current;if(!el)return;el.muted=!el.muted;setMuted(el.muted)};
 useEffect(()=>{
  const media=ref.current;
  autoStart.current=window.setTimeout(()=>{autoStart.current=null;if(media) void media.play().catch(()=>{if(media.paused)setError("자동 재생이 차단되었습니다. 재생을 눌러주세요.")})},kind==='assets'?0:1000);
  const onKey=(e:KeyboardEvent)=>{if(e.ctrlKey||e.metaKey||e.altKey||e.target instanceof HTMLInputElement)return;if(shortcutKey(e)==='p'){e.preventDefault();toggle()}if(shortcutKey(e)==='a'){e.preventDefault();sound()}};
  window.addEventListener('keydown',onKey);return()=>{window.removeEventListener('keydown',onKey);if(autoStart.current!==null)window.clearTimeout(autoStart.current);media?.pause()};
 },[]);
 const events={onPlay:()=>{setPlaying(true);setError("")},onPause:()=>setPlaying(false),onEnded:()=>setPlaying(false),onTimeUpdate:()=>setTime(ref.current?.currentTime??0),onError:()=>setError("미디어를 불러오지 못했습니다. 로컬 서버를 확인해주세요.")};
 const duration=demo.audio?musicWave.duration:kind==='tts'?24:15;
 return <Briefing n={26} name={demo.name} title={demo.title} lead={demo.lead} className="demo-slide">
  <div className="demo-screen">
   {demo.audio?<><audio ref={ref as React.RefObject<HTMLAudioElement>} src={demo.src} preload="auto" muted={muted} {...events}/><div className="music-wave" aria-label="실제 음원의 파형">{musicWave.peaks.map((height,i)=><i key={i} data-played={time/duration>=i/musicWave.peaks.length||undefined} style={{height:`${Math.max(5,height*220)}px`}}/>)}</div><span className="music-time">{time.toFixed(1)}<small> / {duration.toFixed(1)} s</small></span></>:<video ref={ref as React.RefObject<HTMLVideoElement>} src={demo.src} poster={demo.poster} preload="auto" playsInline muted={muted} {...events}/>}
   <span className="demo-caption">{demo.caption}</span>
  </div>
  <div className="demo-controls" onKeyDown={e=>{if(e.key===' ')e.stopPropagation()}}><button type="button" onClick={toggle}>{playing?"일시정지":"재생"} <kbd>P</kbd></button>{kind!=='assets'&&<button type="button" onClick={sound}>{muted?"소리 켜기":"소리 끄기"} <kbd>A</kbd></button>}<span role="status">{launchMessage||error||demo.description}</span>{hasMv&&<a className="demo-launch demo-mv" href={MV} target="_blank" rel="noreferrer" onClick={openMv}>뮤직비디오 <b aria-hidden="true">↗</b></a>}<button type="button" className="demo-launch" onClick={()=>void launchEngine()} disabled={launching} aria-busy={launching}>{launching?"앱 여는 중…":`${engineName} 엔진 실행`} <b aria-hidden="true">↗</b></button></div>
 </Briefing>;
}
