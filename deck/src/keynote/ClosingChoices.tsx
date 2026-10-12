import TrueFocus, { type TrueFocusItem } from "../reactbits/TrueFocus/TrueFocus";
import { usePerformanceMotion } from "./usePerformanceMotion";
import "./ClosingChoices.css";

// 44번 · 처음의 두 마음(17번의 금색 "다 할 수 있다"와 파란 "대체될 수 있다", 표지의 "희열과 두려움")을 마지막에 다시 세운다.
// 큰 낱말이 마음이고, 그 아래가 그 마음으로 하는 일이다. 두 칸을 이어 읽으면 "방은 하나씩 짓고, 판단은 제가 쥡니다"가 된다.
const CHOICES: readonly TrueFocusItem[] = [
  {
    id: "joy", label: "희열 · 다 할 수 있다",
    content: <><span className="closing-choices__num">01</span><span className="closing-choices__word">희열</span><span className="closing-choices__title">다 할 수 있다</span><span className="closing-choices__description">방은 하나씩 짓고,</span></>,
  },
  {
    id: "fear", label: "두려움 · 대체될 수 있다",
    content: <><span className="closing-choices__num">02</span><span className="closing-choices__word">두려움</span><span className="closing-choices__title">대체될 수 있다</span><span className="closing-choices__description">판단은 제가 쥡니다.</span></>,
  },
];

export default function ClosingChoices() {
  const motionEnabled = usePerformanceMotion();
  return <TrueFocus items={CHOICES} label="처음의 두 마음" className="closing-choices"
    motionEnabled={motionEnabled}/>;
}
