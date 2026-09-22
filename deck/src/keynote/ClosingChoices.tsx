import TrueFocus, { type TrueFocusItem } from "../reactbits/TrueFocus/TrueFocus";
import { usePerformanceMotion } from "./usePerformanceMotion";
import "./ClosingChoices.css";

const CHOICES: readonly TrueFocusItem[] = [
  {
    id: "creation", label: "계속 미루던 제작",
    content: <><span className="closing-choices__title">계속 미루던 제작</span><span className="closing-choices__description">혼자 하기엔 일이 많아서<br/>시작하지 못했던 것</span></>,
  },
  {
    id: "repetition", label: "반복해서 하는 작업",
    content: <><span className="closing-choices__title">반복해서 하는 작업</span><span className="closing-choices__description">내 기준은 분명한데<br/>매번 손이 가는 것</span></>,
  },
];

export default function ClosingChoices() {
  const motionEnabled = usePerformanceMotion();
  return <TrueFocus items={CHOICES} label="내 일 하나를 맡겨본다면" className="closing-choices"
    motionEnabled={motionEnabled}/>;
}
