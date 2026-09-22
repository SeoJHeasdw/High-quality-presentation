import { Briefing } from "./KeynoteFrame";

export default function PriceComparison({step}:{step:number}){
 return <Briefing n={8} name="제가 상상해보는 변화" title="내 대신 에이전트가 고른다면?" lead="같은 제품을 파는 두 곳을 비교해봤습니다. 설명을 위한 가상 사례입니다." step={step} className="price-presentation">
  <div className="purchase-comparison" data-cue={step}>
   <div className="purchase-request"><span>내가 맡긴 조건</span><p>“같은 제품이면, 내일까지 오는 곳 중에서 골라줘.”</p></div>
   <table aria-label="가상의 판매처 A와 B 비교">
    <colgroup><col className="purchase-label-col"/><col/><col/></colgroup>
    <thead><tr><th>비교할 것</th><th>판매처 A</th><th className="offer-b">판매처 B <span className="offer-choice" aria-hidden={step<1}>이 조건의 선택</span></th></tr></thead>
    <tbody>
     <tr><th>같은 제품</th><td>무선 키보드</td><td className="offer-b">무선 키보드</td></tr>
     <tr><th>도착 / 반품</th><td>내일 도착 / 14일 이내</td><td className="offer-b">내일 도착 / 14일 이내</td></tr>
     <tr className="purchase-price"><th>결제 금액</th><td>129,000<span>원</span></td><td className="offer-b">109,000<span>원</span></td></tr>
    </tbody>
   </table>
   <div className="purchase-result" data-visible={step>=1||undefined}><span>다른 조건과 판매자 신뢰가 같다면</span><strong>차이는 20,000원</strong></div>
   <div className="purchase-question" data-visible={step>=2||undefined}>홍보에 쓸 비용을 가격으로 돌리는 선택도 생기지 않을까요?</div>
  </div>
  <aside className="story-source">가상 금액과 조건 · 가격 전략에 대한 발표자의 가설</aside>
 </Briefing>;
}
