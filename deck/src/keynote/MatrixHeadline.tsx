import { useLayoutEffect, useRef, useState } from "react";
import { usePerformanceMotion } from "./usePerformanceMotion";
import "./matrix-headline.css";

// React Bits DecryptedText's sequential reveal + replacement-glyph structure,
// driven by one clock so the three lines finish in reading order.
const LINES = ["이 능력이", "누구에게나", "생긴다면?"];
const GLYPHS = Array.from("ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ▒░□＋");
const TOTAL = LINES.join("").replace(/\s/g, "").length;
const DURATION = 1800;
const INTERVAL = 40;
const COMPLETE = { revealed: TOTAL, tick: 0 };

export default function MatrixHeadline() {
  const motion = usePerformanceMotion();
  const finished = useRef(!motion);
  const [frame, setFrame] = useState(() => motion ? { revealed: 0, tick: 0 } : COMPLETE);

  useLayoutEffect(() => {
    if (!motion || finished.current) {
      finished.current = true;
      setFrame(current => current.revealed === TOTAL ? current : { ...current, revealed: TOTAL });
      return;
    }
    const start = performance.now();
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - start;
      const revealed = Math.min(TOTAL, Math.floor(elapsed / DURATION * TOTAL));
      setFrame({ revealed, tick: Math.floor(elapsed / INTERVAL) });
      if (revealed === TOTAL) {
        finished.current = true;
        window.clearInterval(timer);
      }
    }, INTERVAL);
    return () => window.clearInterval(timer);
  }, [motion]);

  const complete = frame.revealed === TOTAL;
  let index = 0;
  const lines = LINES.map((text, line) => {
    const cells = Array.from(text).map((char, position) => {
      if (char === " ") return <span key={position} className="matrix-glyph" data-final={char} data-glyph-state="space"><span className="matrix-glyph-live"> </span></span>;
      const order = index++;
      const locked = order < frame.revealed;
      const current = !complete && order === frame.revealed;
      const state = locked ? "locked" : current ? "scrambling" : "pending";
      const noise = GLYPHS[((Math.imul(frame.tick + 3, 1103515245) ^ Math.imul(order + 7, 2246822519)) >>> 0) % GLYPHS.length];
      return <span key={position} className="matrix-glyph" data-final={char} data-order={order} data-glyph-state={state}>
        <span className="matrix-glyph-live">{locked ? char : current ? noise : ""}</span>
      </span>;
    });
    return line === 1 ? <em key={line} className="matrix-line">{cells}</em> : <span key={line} className="matrix-line">{cells}</span>;
  });

  return <h1 className="matrix-headline" aria-label={LINES.join(" ")} data-state={complete ? "complete" : "decoding"}
    data-revealed={frame.revealed} data-total={TOTAL} data-tick={frame.tick}
    data-line={frame.revealed < 4 ? 0 : frame.revealed < 9 ? 1 : 2}>
    <span className="matrix-headline-visual" aria-hidden="true">{lines}</span>
  </h1>;
}
