import { Frame, Reveal } from "./KeynoteFrame";

export default function PriceComparison({step}:{step:number}){
 return <Frame n={8} name="에이전트가 고르는 판매처" step={step} className="story-edit story-price-revision">
  <div className="story-heading"><p>가상 구매 사례</p><h1>같은 키보드, 어디서 살까요?</h1></div>
  <div className="price-request"><p>“내일까지 받으면 돼. 싼 곳으로 골라줘.”</p></div>
  <div className="price-offers" data-cue={step}>
   <p className="price-common">같은 무선 키보드 · 내일 도착 · 14일 이내 반품</p>
   <table aria-label="가상의 판매처 가격 비교"><thead><tr><th>판매처 A</th><th>판매처 B</th></tr></thead><tbody><tr><td>129,000<small>원</small></td><td>109,000<small>원</small></td></tr></tbody></table>
   <Reveal on={step>=1} className="price-choice">B 선택 <span>· 20,000원 절약</span></Reveal>
  </div>
  <Reveal on={step>=2} className="price-hypothesis"><h2>판매자는 광고비를 줄여 가격을 낮추게 될까요?</h2></Reveal>
  <aside className="story-source">가상 금액과 조건 · 판매자 신뢰와 나머지 조건은 같다고 가정 · 가격 전략은 발표자의 가설</aside>
 </Frame>;
}
