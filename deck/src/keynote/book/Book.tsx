import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Frame } from "../KeynoteFrame";
import { usePerformanceMotion } from "../usePerformanceMotion";
import "../personal/personal.css";
import "./book.css";

/*
 * 15번 · 백승헌 전무의 책 『몫: 인간의 자리』(파지트, 2026.11.1). 14번 끝의 "누가 멈출 수 있는지"를 이어받는다.
 * 배경은 Blender 영상(tools/render-book.py) 두 조각이다.
 *   0단계(장에 들어올 때): 표지의 빛이 공간에 흩어져 있다가 한 자리에서 표지로 맞춰지고, 책이 되어 왼쪽에 선다.
 *   1단계(→): 책이 눕고 가운데가 펼쳐지며 낱장이 넘어간다. 위에서 펼친 면을 내려다보다 241쪽의 인용 문장으로 빨려 들어가고,
 *            그 흰빛이 표지 속 문의 빛이 되어 문 앞에 선 사람을 뒤에서 보는 복도로 빠져나온다.
 * 앞으로 한 단계 넘길 때만 그 조각을 틀고, 끝나면 마지막 프레임(= 정지 화면 a-k)에 멈춘다. 뒤로 가거나 움직임을 끈 화면은 정지 화면만 보인다.
 * 글은 조각이 끝난 뒤에 뜬다. 인용과 쪽수는 script/keynote/stories.md의 근거 줄과 FACT-CHECK.md에 있다.
 */

type Copy = { eyebrow: string; title: ReactNode; source: string; quote?: boolean };
const COPY: Copy[] = [
  { eyebrow: "백승헌 지음 · 파지트 · 2026. 11. 1", title: <>그럼, 누가<br/><em>멈출 수</em> 있습니까?</>, source: "『몫: 인간의 자리』 책 소개" },
  { eyebrow: "에필로그 「결국, 우리의 몫」", quote: true, title: <>몫은 기술이 우리에게<br/>남겨주는 것이 아니라,<br/>우리가 <em>무엇을 맡기고<br/>무엇을 책임질지</em><br/>정하면서 만들어지는 것이다.</>, source: "『몫: 인간의 자리』 241쪽" },
];

/** 정지 지점 k(0 어둠, 1 책이 선 화면, 2 문 앞의 사람). 단계 s가 끝나면 정지 지점 s + 1에 멈춘다. 조각 k는 k에서 k + 1까지. */
const still = (k: number) => `/book/a-${k}.jpg`;
const segment = (k: number) => `/book/seg-${k}.mp4`;

function BookFilm({ step, shade, onSettled }: { step: number; shade: boolean; onSettled: (step: number) => void }) {
  const motion = usePerformanceMotion();
  const video = useRef<HTMLVideoElement>(null);
  const previous = useRef<number | null>(null);
  const playing = useRef<number | null>(null);   // 지금 조각을 틀고 있는 단계
  const anchor = step + 1;
  const [shown, setShown] = useState(anchor);
  // 영상을 정지 화면 위에 덮을지. 조각이 끝나도 걷지 않는다: 마지막 프레임이 정지 화면과 같아서, 걷는 순간의 깜빡임만 생긴다.
  const [cover, setCover] = useState(false);
  useEffect(() => { [1, 2].forEach(k => { const img = new Image(); img.src = still(k); void img.decode?.().catch(() => {}); }); }, []);
  useEffect(() => {
    const v = video.current!;
    const end = () => { playing.current = null; setShown(anchor); onSettled(step); };
    // 개발 모드에서는 effect가 한 번 더 돈다. 틀고 있던 조각은 그대로 두고 끝을 다시 기다린다.
    if (playing.current === step) {
      v.addEventListener("ended", end, { once: true });
      return () => v.removeEventListener("ended", end);
    }
    const from = previous.current; previous.current = step;
    // 장에 0단계로 들어오면 조각 0을, 한 단계 앞으로 넘기면 그 조각을 튼다.
    const forward = from === null ? step === 0 : step === from + 1;
    if (!forward || !motion) { v.pause(); playing.current = null; setCover(false); setShown(anchor); onSettled(step); return; }
    playing.current = step;
    v.poster = still(anchor - 1); v.src = segment(anchor - 1);
    setCover(true);
    v.addEventListener("ended", end, { once: true });
    v.play().catch((e: DOMException) => { if (e.name !== "AbortError") { setCover(false); end(); } });
    return () => v.removeEventListener("ended", end);
  }, [step, motion, anchor, onSettled]);
  return <div className="bk-film" data-anchor={anchor} aria-hidden="true">
    <img className="bk-still" src={still(shown)} alt=""/>
    <video ref={video} className="bk-video" data-visible={cover || undefined} muted playsInline preload="auto"/>
    {/* 글 뒤를 누르는 그늘은 글과 함께 나온다(영상 동안 펼친 면의 오른쪽 쪽이 어두워지지 않게). */}
    <div className="bk-shade" data-on={shade || undefined}/>
  </div>;
}

export default function BookStory({ step }: { step: number }) {
  const c = COPY[step];
  // 글은 그 단계의 영상이 끝난 뒤에 뜬다.
  const [settled, setSettled] = useState(-1);
  const settle = useCallback((s: number) => setSettled(s), []);
  return <Frame n={15} name="몫: 인간의 자리" step={step} className="book">
    <BookFilm step={step} shade={settled === step} onSettled={settle}/>
    <div className="bk-copy" key={step} data-quote={c.quote || undefined} data-hold={settled !== step || undefined}>
      <p className="pv-eyebrow">{c.eyebrow}</p>
      <h1>{c.title}</h1>
      <p className="bk-source">{c.source}</p>
    </div>
  </Frame>;
}
