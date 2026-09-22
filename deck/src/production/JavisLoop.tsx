/**
 * JD-C · 팩토리 순환도 (의도 → 판단 → 생산 → 검증, 빙글빙글 돈다)
 *
 * AgentLoopDiagram을 그대로 쓰지 않는다. 그 그림의 노드(목표·계획·도구·
 * 관찰·재판단)는 에이전트 1개의 외부 동작이고, 여기서 말하는 건 팩토리
 * 한 바퀴(의도·판단·생산·검증)라 라벨이 거짓말이 된다.
 *
 * 규약:
 * - items: "라벨 · 설명" 4개. 라벨(앞부분)이 노드에, 설명이 캡션에 선다.
 * - steps 4: s_k에서 앞 k개 노드가 켜진다. s0은 빈 회로 + 흐르는 점만.
 */
import type { CourseSlideSpec } from "./course-types";
import { AccentText } from "./copy-steps";
import "./javis-scenes.css";

const POS = [
  { x: 200, y: 44 },
  { x: 330, y: 150 },
  { x: 200, y: 256 },
  { x: 70, y: 150 },
];

const CIRCUIT =
  "M 200 44 L 330 150 L 200 256 L 70 150 Z";

export default function JavisLoop({
  spec,
  step,
}: {
  spec: CourseSlideSpec;
  step: number;
}) {
  const nodes = (spec.items ?? []).map((item) => {
    const [label, sub] = item.split("·");
    return { label: label.trim(), sub: (sub ?? "").trim() };
  });
  const lit = Math.min(step, nodes.length);
  const current = nodes[Math.min(Math.max(lit - 1, 0), nodes.length - 1)];

  return (
    <div className="javis-loop">
      <h2 className="javis-h-title">
        <AccentText text={spec.title} accent={spec.accent} />
      </h2>
      <svg viewBox="0 -34 400 348" className="javis-loop__svg" aria-hidden>
        <path d={CIRCUIT} className="javis-loop__track" />
        <path d={CIRCUIT} className="javis-loop__flow" />
        <circle r="7" className="javis-loop__dot">
          <animateMotion dur="5s" repeatCount="indefinite" path={CIRCUIT} />
        </circle>
        {nodes.map((node, i) => {
          const p = POS[i];
          const on = i < lit;
          return (
            <g key={node.label} transform={`translate(${p.x},${p.y})`}>
              <circle r="26" className="javis-loop__node" data-on={on || undefined} />
              <text
                y="-34"
                textAnchor="middle"
                className="javis-loop__name"
                data-on={on || undefined}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="javis-loop__caption" data-on={lit > 0 || undefined}>
        <span className="mono">
          {String(Math.max(lit, 1)).padStart(2, "0")} / {String(nodes.length).padStart(2, "0")}
        </span>
        <strong>{current?.label}</strong>
        <span>{current?.sub}</span>
      </div>
    </div>
  );
}
