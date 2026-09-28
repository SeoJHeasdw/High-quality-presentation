import { useEffect, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import type { FilmApi } from "../film/FilmSection";
import type { Progress } from "../film/frames";
import { UI } from "../copy";
import { useI18n } from "../lib/i18n";
import { lockScroll, reducedMotion } from "../lib/scroll";

/*
 * 첫 화면. 가운데 선이 불러온 만큼 자라다가, 준비되면 영상 첫 프레임 속 측량선의 자리로
 * 옮겨 가 겹친 뒤 사라진다. 로더의 선이 곧 영상의 첫 선이 된다.
 */
export default function Loader({ progress, api, onReveal, onDone }: { progress: Progress & { failed?: boolean }; api: MutableRefObject<FilmApi | null>; onReveal: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<"loading" | "handoff" | "reveal">("loading");
  const [line, setLine] = useState<CSSProperties>({});
  const t0 = useRef(performance.now());
  const firstTotal = 44;
  const pct = progress.failed ? 1 : Math.min(1, progress.loaded / firstTotal);

  useEffect(() => { lockScroll(true); window.scrollTo(0, 0); return () => lockScroll(false); }, []);

  useEffect(() => {
    if (phase !== "loading" || !(progress.firstPass || progress.failed)) return;
    const wait = Math.max(0, 1500 - (performance.now() - t0.current));
    const id = setTimeout(async () => {
      try { await document.fonts.ready; } catch { /* 글꼴이 늦어도 진행한다 */ }
      const ln = api.current?.lineOnScreen();
      if (!ln || reducedMotion()) { setPhase("reveal"); onReveal(); setTimeout(onDone, 700); return; }
      // 왼쪽 끝에서 오른쪽 끝으로: 가로선이 크게 돌지 않고 살짝 기울며 내려앉는다
      const [l, r] = ln.a[0] <= ln.b[0] ? [ln.a, ln.b] : [ln.b, ln.a];
      const dx = r[0] - l[0], dy = r[1] - l[1];
      setLine({ "--x": `${l[0]}px`, "--y": `${l[1]}px`, "--w": `${Math.hypot(dx, dy)}px`, "--a": `${Math.atan2(dy, dx)}rad` } as CSSProperties);
      setPhase("handoff");
      setTimeout(() => { setPhase("reveal"); onReveal(); }, 1150);
      setTimeout(onDone, 2100);
    }, wait);
    return () => clearTimeout(id);
  }, [progress.firstPass, progress.failed, phase]);

  return (
    <div className="loader" data-phase={phase} style={line} role="status" aria-live="polite">
      <div className="loader__brand">
        <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="5" width="22" height="22" /><path d="M5 27L27 10" /><circle cx="27" cy="10" r="2.4" /></svg>
        <span>Technology Expert Lab</span>
      </div>
      <div className="loader__line" style={{ "--p": pct } as CSSProperties}><i /></div>
      <div className="loader__status">
        <span>{t(UI.loader.status)}</span>
        <b>{String(Math.round(pct * 100)).padStart(3, "0")}%</b>
      </div>
    </div>
  );
}
