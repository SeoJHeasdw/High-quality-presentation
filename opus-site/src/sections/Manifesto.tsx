import { useEffect, useRef } from "react";
import { UI } from "../copy";
import { useI18n } from "../lib/i18n";
import { clamp, measure, onFrame } from "../lib/scroll";

/** 원칙 한 문단. 스크롤을 따라 낱말에 하나씩 불이 들어온다. */
export default function Manifesto() {
  const { t, lang } = useI18n();
  const section = useRef<HTMLElement>(null);
  const words = useRef<HTMLSpanElement[]>([]);
  const rule = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = section.current!;
    let geo = measure(el);
    const ro = new ResizeObserver(() => { geo = measure(el); }); ro.observe(document.body);
    const off = onFrame((y) => {
      const vh = innerHeight;
      const p = clamp((y - geo.top + vh * .35) / Math.max(1, geo.height - vh * .6));
      const n = words.current.length;
      words.current.forEach((w, i) => {
        if (!w) return;
        const on = clamp((p * (n + 4) - i) / 4);
        w.style.setProperty("--on", on.toFixed(3));
      });
      rule.current?.style.setProperty("--p", p.toFixed(4));
    });
    return () => { off(); ro.disconnect(); };
  }, [lang]);

  const text = t(UI.manifesto.text);
  const parts = text.split(" ");
  words.current = [];
  return (
    <section id="manifesto" className="manifesto" ref={section}>
      <div className="manifesto__stage">
        <p className="kicker"><span className="manifesto__rule" ref={rule} aria-hidden="true" />{t(UI.manifesto.kicker)}</p>
        <p className="manifesto__text" aria-label={text}>
          {parts.map((w, i) => <span key={`${lang}-${i}`} ref={(n) => { if (n) words.current[i] = n; }} aria-hidden="true">{w} </span>)}
        </p>
      </div>
    </section>
  );
}
