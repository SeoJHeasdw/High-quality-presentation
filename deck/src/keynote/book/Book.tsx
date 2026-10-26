import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Frame } from "../KeynoteFrame";
import { usePerformanceMotion } from "../usePerformanceMotion";
import "../personal/personal.css";
import "./book.css";

/*
 * 15번 · 백승헌 전무의 책 『몫: 인간의 자리』(파지트, 2026.11.1). 14번 끝의 "누가 멈출 수 있는지"를 이어받는다.
 * 배경은 Blender 영상(tools/render-book.py): 표지의 빛이 공간에 흩어져 있다가 한 자리에서 표지로 맞춰지고, 책이 되어 왼쪽에 선다.
 * 장에 들어오면 영상을 한 번 틀고 마지막 프레임(a-1과 같다)에 멈춘다. 뒤로 돌아오거나 움직임을 끈 화면은 정지 화면만 보인다.
 * 0단계는 책이 끝까지 붙든 질문, 1단계는 에필로그의 한 문장. 인용과 쪽수는 script/keynote/stories.md의 근거 줄과 FACT-CHECK.md에 있다.
 */

type Copy = { eyebrow: string; title: ReactNode; source: string; quote?: boolean };
const COPY: Copy[] = [
  { eyebrow: "백승헌 지음 · 파지트 · 2026. 11. 1", title: <>그럼, 누가<br/><em>멈출 수</em> 있습니까?</>, source: "『몫: 인간의 자리』 책 소개" },
  { eyebrow: "에필로그 「결국, 우리의 몫」", quote: true, title: <>몫은 기술이 우리에게<br/>남겨주는 것이 아니라,<br/>우리가 <em>무엇을 맡기고<br/>무엇을 책임질지</em><br/>정하면서 만들어지는 것이다.</>, source: "『몫: 인간의 자리』 241쪽" },
];

function BookFilm({ step, onSettled }: { step: number; onSettled: () => void }) {
  const motion = usePerformanceMotion();
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  // 장에 들어온 순간 한 번만 정한다. 0단계로 들어왔을 때만 튼다(1단계에서 0으로 돌아와도 다시 틀지 않는다).
  const entered = useRef(step);
  useEffect(() => {
    if (entered.current !== 0 || !motion) { onSettled(); return; }
    const v = video.current!;
    // 개발 모드에서는 이 effect가 두 번 돈다. 주소를 다시 넣으면 앞의 play()가 AbortError로 끊기니 한 번만 넣고, 끊긴 것은 실패로 치지 않는다.
    if (!v.getAttribute("src")) v.src = "/book/seg-0.mp4";
    setPlaying(true);
    v.addEventListener("ended", onSettled, { once: true });
    v.play().catch((e: DOMException) => { if (e.name !== "AbortError") { setPlaying(false); onSettled(); } });
    return () => v.removeEventListener("ended", onSettled);
  }, [motion, onSettled]);
  return <div className="bk-film" aria-hidden="true">
    <img className="bk-still" src="/book/a-1.jpg" alt=""/>
    {/* 끝나도 숨기지 않는다: 마지막 프레임이 정지 화면과 같아서, 숨기는 순간의 깜빡임만 생긴다. */}
    <video ref={video} className="bk-video" data-visible={playing || undefined} poster="/book/a-0.jpg" muted playsInline preload="auto"/>
    <div className="bk-shade"/>
  </div>;
}

export default function BookStory({ step }: { step: number }) {
  const c = COPY[step];
  // 글은 책이 왼쪽에 선 뒤(영상이 끝난 뒤)에 뜬다. 그 전에 다음 단계로 넘기면 바로 뜬다.
  const [settled, setSettled] = useState(false);
  const settle = useCallback(() => setSettled(true), []);
  return <Frame n={15} name="몫: 인간의 자리" step={step} className="book">
    <BookFilm step={step} onSettled={settle}/>
    <div className="bk-copy" key={step} data-quote={c.quote || undefined} data-hold={(!settled && step === 0) || undefined}>
      <p className="pv-eyebrow">{c.eyebrow}</p>
      <h1>{c.title}</h1>
      <p className="bk-source">{c.source}</p>
    </div>
  </Frame>;
}
