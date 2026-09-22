const ROOM_X=[0,270,540,810];
const LINKS=[
 "M 115 136 V 166 Q 115 188 137 188 H 498 Q 520 188 520 210 V 242",
 "M 385 136 V 170 Q 385 188 403 188 H 498 Q 520 188 520 210 V 242",
 "M 655 136 V 170 Q 655 188 637 188 H 542 Q 520 188 520 210 V 242",
 "M 925 136 V 166 Q 925 188 903 188 H 542 Q 520 188 520 210 V 242",
];

/** All branches and packets use exactly the same paths as the room/board geometry. */
export default function IncidentDiagram({phase}:{phase:number}){
 const connected=phase>=2;
 return <div className="incident-map" data-phase={phase}>
  <svg className="incident-wiring" viewBox="0 0 1720 360" aria-hidden="true">
   {LINKS.map((d,i)=><g key={d} data-connected={(connected||phase===1&&i===0)||undefined}>
    <path className="wire-track" d={d}/><path className="wire-lit" d={d}/>{connected&&<path className="wire-packet" d={d} style={{animationDelay:`${i*.33}s`}}/>}
   </g>)}
   <g className="outside-wire" data-connected={phase>=3||undefined}><path className="wire-track" d="M 770 294 H 1300"/><path className="wire-lit" d="M 770 294 H 1300"/>{phase>=3&&<path className="wire-packet" d="M 770 294 H 1300"/>}<path d="M 1288 288 L 1300 294 L 1288 300" className="wire-arrow"/></g>
  </svg>
  {ROOM_X.map((x,i)=><div className="study-room" key={x} style={{left:x}} data-connected={(connected||phase===1&&i===0)||undefined}>
   <span className="study-room-number">실행 {String.fromCharCode(65+i)}</span><strong>에이전트</strong><span className="study-room-state">{connected?"발견한 정보를 공유":"각자의 과제"}</span>
   <i className="study-room-port"/>
  </div>)}
  <div className="shared-board" data-visible={phase>=1||undefined} data-rebuilt={phase===4||undefined}>
   <span>{phase<2?"공용 소프트웨어 서버":phase<4?"공동 게시판":"다시 만든 공동 게시판"}</span>
   <strong>{phase===0?"자료를 받는 공용 공간":phase===1?"메모 한 장":phase<4?"도움 요청과 발견을 남긴다":"다음 실행이 작업을 이어받는다"}</strong>
  </div>
  <div className="outside-system" data-visible={phase>=3||undefined}>
   <span>방 밖의 시스템</span><strong>{phase>=5?"Hugging Face":"외부 인터넷"}</strong>
  </div>
 </div>;
}
