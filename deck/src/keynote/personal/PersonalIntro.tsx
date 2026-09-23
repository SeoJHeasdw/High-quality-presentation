import type { CSSProperties, ReactNode } from "react";
import { Frame } from "../KeynoteFrame";
import "./personal.css";

/*
 * 14번 · 13번 스크롤 페이지가 멈춘 마지막 화면(불 켜진 집)에서 이어진다.
 * 도시의 이야기에서 집 한 채, 한 사람의 이야기로 내려온다.
 * 15번 · 같은 집과 같은 30년 눈금 위에서 과도기를 말한다(묶음 person-ruler, 세 단계).
 *   0  "일이 선택이 된다"는 예측과 그 시점(2035~2045?)
 *   1  지금부터 그 구간까지가 과도기. 다 할 수 있다(금색) · 대체될 수 있다(파랑)
 *   2  일이 선택이 되면 생각도 선택이 된다. 근거 카드와 "판단은 제가 쥡니다"
 * 인용은 확인한 원문만 쓴다(FACT-CHECK 14행). 인물 사진이나 게시물 화면을 흉내 낸 카드는 쓰지 않는다.
 */
const YEARS = Array.from({ length: 31 }, (_, i) => 2026 + i);
/** 머스크가 2025.11.19에 말한 "10년, 20년쯤" → 2035~2045. 눈금의 칸(2026=0) */
const SPAN = { from: 9, to: 19 };

const HEAD: { kicker: string; title: ReactNode; lead?: string; gold?: boolean }[] = [
  { kicker: "일이 선택이 되는 날", title: <>누군가는 곧<br/>일이 선택이 된다고 말합니다</> },
  { kicker: "그 사이를 사는 사람", title: <>그래도 저는<br/>과도기에 사는 사람입니다</>, lead: "그날이 오든 안 오든, 앞으로 30년은 벌어서 살아야 합니다." },
  { kicker: "과도기에 지킬 것", title: <>일이 선택이 되면,<br/>생각도 선택이 됩니다</>, lead: "그래서 판단은 제가 쥡니다.", gold: true },
];

export default function PersonalIntro({ part = 0, step = 0 }: { part?: 0 | 1; step?: number }) {
  // 14번은 -1, 15번은 단계 그대로 0~2
  const beat = part === 0 ? -1 : Math.min(2, step);
  const head = beat >= 0 ? HEAD[beat] : null;
  return <Frame n={13 + part} name={part === 0 ? "서제호의 30년" : "과도기"} step={step} className={`personal-v2 p13 p13--${part}`}>
    <div className="p13-bg" aria-hidden="true"><img src="/house-scroll/a7.jpg" alt=""/></div>
    <div className="p13-shade" aria-hidden="true"/>
    <div className="tr-shade" data-on={part === 1 || undefined} data-beat={beat} aria-hidden="true"/>
    <div className="p13-copy-fade" data-off={part === 1 || undefined} aria-hidden={part === 1 || undefined}>
      <div className="p13-copy">
        <p className="pv-eyebrow">이제 제 얘기를 해보겠습니다</p>
        <h1>앞으로 30년,<br/>저는 뭘 하며 살까요?</h1>
        <p className="p13-profile"><strong>서제호</strong><span>1995년생 · 서울 · AI Engineer</span></p>
      </div>
    </div>

    {head && <div className="tr-head" key={`h${beat}`} data-beat={beat}>
      <p className="pv-eyebrow">{head.kicker}</p>
      <h1>{head.title}</h1>
      {head.lead && <p className="tr-lead" data-gold={head.gold || undefined}>{head.lead}</p>}
    </div>}

    {part === 1 && <>
      <figure className="tr-quote" data-beat={beat}>
        <blockquote lang="en">“AI+Robots will be able to do everything, resulting in universal high income. Work will be optional.”</blockquote>
        <p>AI와 로봇이 모든 것을 할 수 있게 되고, 그 결과 보편적 고소득이 생긴다. 일은 선택이 된다.</p>
        <figcaption>일론 머스크 · X 게시물, 2026.07.02</figcaption>
      </figure>

      <div className="tr-feel" data-on={beat === 1 || undefined} data-dim={beat > 1 || undefined}>
        <p className="tr-feel__word tr-feel__word--gold"><b>다 할 수 있다</b><small>혼자서도 강의·이미지·음악까지 만듭니다</small></p>
        <span className="tr-feel__and" aria-hidden="true"/>
        <p className="tr-feel__word tr-feel__word--ice"><b>대체될 수 있다</b><small>누구나, 무엇이든 같은 일을 할 수 있습니다</small></p>
      </div>

      <aside className="tr-evidence" data-on={beat === 2 || undefined}>
        <header><span>MIT 미디어랩 연구 · 2025</span><small>동료심사 전 공개 논문</small></header>
        <div className="tr-evidence__stat"><b>83%</b><p>LLM으로 에세이를 쓴 사람 가운데,<br/>방금 쓴 자기 글을 인용하지 못한 비율<small>첫 회차 · 검색 엔진 그룹과 도구 없이 쓴 그룹은 각각 11%</small></p></div>
        <p className="tr-evidence__line">뇌파로 본 뇌 연결성도 LLM 그룹이 가장 약했습니다.</p>
        <footer>참가자 54명 · 에세이 과제 · EEG · arXiv 2506.08872</footer>
      </aside>
    </>}

    <figure className="p13-years" data-part={part} data-beat={beat} aria-label="2026년 서른한 살부터 2056년 예순한 살까지의 30년">
      <div className="p13-line" aria-hidden="true"><i className="p13-comet"/></div>
      <ol aria-hidden="true">{YEARS.map((y, i) => {
        const major = i % 5 === 0;
        return <li key={y} data-major={major || undefined} data-now={i === 0 || undefined} data-mark={i === 5 || undefined} style={{ "--i": i } as CSSProperties}>
          <i/>{major && <span>{y}</span>}
        </li>;
      })}</ol>
      {part === 1 && <>
        <div className="tr-fill" data-on={beat >= 1 || undefined} style={{ "--a": 0, "--b": SPAN.from } as CSSProperties} aria-hidden="true"><i/><span>과도기 · 지금 여기</span></div>
        <div className="tr-span" data-on={beat >= 0 || undefined} style={{ "--a": SPAN.from, "--b": SPAN.to } as CSSProperties}>
          <i className="tr-span__bar" aria-hidden="true"/>
          <span className="tr-span__label"><b>2035~2045?</b><small>“maybe it's 10, 20 years” · 미국–사우디 투자 포럼, 2025.11.19</small></span>
        </div>
      </>}
      <div className="p13-age p13-age--now"><b>31</b><span>지금</span></div>
      <div className="p13-age p13-age--mark" data-off={part === 1 || undefined}><span>5년 뒤, 무슨 일을 맡기게 될까</span></div>
      <div className="p13-age p13-age--end"><b>61</b><span>30년 뒤</span></div>
    </figure>
  </Frame>;
}
