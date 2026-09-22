/**
 * JD-A · 토큰 티커 (900× → 31% → +2,434%, 숫자가 직접 뛴다)
 *
 * 단일 장면(scene "jd-token"). 숫자가 논지인 자리라 숫자만 움직인다.
 *
 * 규약:
 * - items: "값|설명" 3개. 값 앞의 숫자가 카운트업 목표다.
 *   예) "900×|토큰 상정" "31%|월 성장" "+2,434%|1년 새"
 * - steps 3: s_k에서 앞 k개 카운터가 불이 들어오고 숫자가 뛴다.
 *   s3에서 subtitle 착지.
 */
import { useEffect, useRef, useState } from "react";
import type { CourseSlideSpec } from "./course-types";
import { AccentText } from "./copy-steps";
import "./javis-scenes.css";

function parseTarget(raw: string): number {
  const m = raw.replace(/,/g, "").match(/[+-]?[\d.]+/);
  return m ? parseFloat(m[0]) : 0;
}

function formatValue(raw: string, v: number): string {
  const shown = Math.round(v).toLocaleString("en-US");
  if (raw.includes("×")) return `${shown}×`;
  if (raw.startsWith("+")) return `+${shown}%`;
  return `${shown}%`;
}

function Counter({
  raw,
  label,
  started,
  tone,
}: {
  raw: string;
  label: string;
  started: boolean;
  tone?: "gold";
}) {
  const target = parseTarget(raw);
  const [v, setV] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    if (!started) {
      setV(0);
      return;
    }
    const t0 = performance.now();
    const dur = 900;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(target * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [started, target]);

  return (
    <div className="javis-ticker__cell" data-on={started || undefined}>
      <div
        className="javis-ticker__value mono"
        data-tone={tone ?? (started ? "ai" : undefined)}
      >
        {formatValue(raw, v)}
      </div>
      <div className="javis-ticker__label">{label}</div>
    </div>
  );
}

export default function JavisToken({
  spec,
  step,
}: {
  spec: CourseSlideSpec;
  step: number;
}) {
  const cells = (spec.items ?? []).map((item) => {
    const [raw, label] = item.split("|");
    return { raw: raw.trim(), label: (label ?? "").trim() };
  });

  return (
    <div className="javis-ticker">
      <h2 className="javis-h-title">
        <AccentText text={spec.title} accent={spec.accent} />
      </h2>
      <div className="javis-ticker__row">
        {cells.map((cell, i) => (
          <Counter
            key={cell.raw}
            raw={cell.raw}
            label={cell.label}
            started={step >= i + 1}
            tone={i === cells.length - 1 ? "gold" : undefined}
          />
        ))}
      </div>
      <p className="javis-ticker__landing" data-on={step >= 3 || undefined}>
        {spec.subtitle}
      </p>
    </div>
  );
}
