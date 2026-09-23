import type { CSSProperties } from "react";
import { Frame } from "../KeynoteFrame";
import "./personal.css";

/*
 * 13번 · 12번 스크롤 페이지가 멈춘 마지막 화면(불 켜진 집)에서 이어진다.
 * 도시의 이야기에서 집 한 채, 한 사람의 이야기로 내려온다.
 */
const YEARS = Array.from({ length: 31 }, (_, i) => 2026 + i);

export default function PersonalIntro() {
  return <Frame n={13} name="서제호의 30년" className="personal-v2 p13">
    <div className="p13-bg" aria-hidden="true"><img src="/house-scroll/a7.jpg" alt=""/></div>
    <div className="p13-shade" aria-hidden="true"/>
    <div className="p13-copy">
      <p className="pv-eyebrow">이제 제 얘기를 해보겠습니다</p>
      <h1>앞으로 30년,<br/>저는 뭘 하며 살까요?</h1>
      <p className="p13-profile"><strong>서제호</strong><span>1995년생 · 서울 · AI Engineer</span></p>
    </div>
    <figure className="p13-years" aria-label="2026년 서른두 살부터 2056년 예순두 살까지의 30년">
      <div className="p13-line" aria-hidden="true"><i className="p13-comet"/></div>
      <ol aria-hidden="true">{YEARS.map((y, i) => {
        const major = i % 5 === 0;
        return <li key={y} data-major={major || undefined} data-now={i === 0 || undefined} data-mark={i === 5 || undefined} style={{ "--i": i } as CSSProperties}>
          <i/>{major && <span>{y}</span>}
        </li>;
      })}</ol>
      <div className="p13-age p13-age--now"><b>32</b><span>지금</span></div>
      <div className="p13-age p13-age--mark"><span>5년 뒤, 무슨 일을 맡기게 될까</span></div>
      <div className="p13-age p13-age--end"><b>62</b><span>30년 뒤</span></div>
    </figure>
  </Frame>;
}
