import { useEffect, useRef, useState } from "react";
import { lockScroll } from "../lib/scroll";
import { Arrow } from "./Header";
import { PROJECTS, UI } from "../copy";
import { Lines, useI18n } from "../lib/i18n";
import { clamp, measure, onFrame } from "../lib/scroll";

/*
 * 프로젝트: 밝은 도면지 위에서 옆으로 넘기는 구간. 세로 스크롤을 가로 이동으로 바꾸고,
 * 사진은 틀 안에서 반대로 조금 흘러 깊이를 준다. 좁은 화면에서는 세로로 쌓는다.
 */
export default function Projects() {
  const { t } = useI18n();
  const section = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const [len, setLen] = useState(3);
  const [horizontal, setHorizontal] = useState(() => innerWidth >= 900);
  const [openId, setOpenId] = useState<number | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dlg.current!;
    if (openId !== null && !d.open) { d.showModal(); lockScroll(true); }
    if (openId === null && d.open) d.close();
    if (openId === null) lockScroll(false);
  }, [openId]);
  const cur = openId !== null ? PROJECTS[openId] : null;

  useEffect(() => {
    const el = section.current!, track = trackRef.current!;
    let geo = measure(el), span = 0;
    const layout = () => {
      const h = innerWidth >= 900;
      setHorizontal(h);
      span = h ? Math.max(0, track.scrollWidth - innerWidth) : 0;
      setLen(h ? 1 + span / innerHeight : 0);
      requestAnimationFrame(() => { geo = measure(el); });
    };
    layout();
    const ro = new ResizeObserver(() => { geo = measure(el); }); ro.observe(document.body);
    addEventListener("resize", layout);
    const cards = Array.from(track.querySelectorAll<HTMLElement>(".work-card"));
    const off = onFrame((y) => {
      el.style.setProperty("--enter", clamp((y + innerHeight - geo.top) / (innerHeight * .8)).toFixed(3));
      if (!span) {
        cards.forEach((c) => {
          const r = c.getBoundingClientRect();
          const v = clamp(1 - (r.top - innerHeight * .2) / innerHeight);
          c.style.setProperty("--in", v.toFixed(3));
          c.style.setProperty("--px", "0");
        });
        return;
      }
      const p = clamp((y - geo.top) / Math.max(1, geo.height - innerHeight));
      track.style.transform = `translate3d(${(-p * span).toFixed(1)}px,0,0)`;
      const mid = innerWidth / 2;
      cards.forEach((c) => {
        const r = c.getBoundingClientRect();
        const d = (r.left + r.width / 2 - mid) / innerWidth;
        c.style.setProperty("--px", d.toFixed(4));
        c.style.setProperty("--in", clamp(1.25 - Math.abs(d) * 1.1).toFixed(3));
      });
      const idx = Math.min(PROJECTS.length, Math.max(1, Math.round(p * (PROJECTS.length - 1)) + 1));
      if (counter.current) counter.current.textContent = String(idx).padStart(2, "0");
    });
    return () => { off(); ro.disconnect(); removeEventListener("resize", layout); };
  }, []);

  return (
    <section id="work" className="work" ref={section} data-surface="paper" data-horizontal={horizontal || undefined}
      style={horizontal ? { height: `calc(${len.toFixed(3)} * 100vh + 1px)` } : undefined} aria-label={t(UI.work.kicker)}>
      <div className="work__stage">
        <div className="work__track" ref={trackRef}>
          <header className="work__head">
            <p className="kicker">{t(UI.work.kicker)}</p>
            <h2 className="title"><Lines text={t(UI.work.title)} /></h2>
            <p className="body">{t(UI.work.body)}</p>
            {horizontal && <p className="work__hint"><span className="work__count"><span ref={counter}>01</span> / {String(PROJECTS.length).padStart(2, "0")}</span>{t(UI.work.hint)}</p>}
          </header>
          {PROJECTS.map((p, i) => (
            <article key={p.id} className="work-card" data-id={p.id}>
              <button type="button" className="work-card__open" onClick={() => setOpenId(i)} aria-label={`${t(p.name)} — ${t(UI.work.open)}`} />
              <figure className="work-card__frame">
                <img src={p.image} alt="" loading="lazy" decoding="async" />
                <figcaption className="work-card__tag">{t(UI.work.fictional)}</figcaption>
              </figure>
              <div className="work-card__meta">
                <span className="work-card__no">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <p className="work-card__type">{t(p.type)}</p>
                  <h3 className="work-card__name">{t(p.name)}</h3>
                  <p className="work-card__body">{t(p.body)}</p>
                </div>
                <dl className="work-card__specs">
                  {p.specs.map(([k, v]) => <div key={k.ko}><dt>{t(k)}</dt><dd>{t(v)}</dd></div>)}
                </dl>
              </div>
            </article>
          ))}
        </div>
      </div>
      <dialog ref={dlg} className="ask work-dialog" onClose={() => setOpenId(null)} onClick={(e) => { if (e.target === dlg.current) setOpenId(null); }} aria-label={cur ? t(cur.name) : ""}>
        {cur && <div className="work-dialog__inner">
          <figure><img src={cur.image} alt="" /></figure>
          <div className="work-dialog__text">
            <button type="button" className="ask__close" onClick={() => setOpenId(null)} aria-label={t(UI.nav.close)}>×</button>
            <p className="kicker">{t(cur.type)} · {t(UI.work.fictional)}</p>
            <h2 className="ask__title">{t(cur.name)}</h2>
            <p className="work-dialog__body">{t(cur.body)}</p>
            <dl className="work-dialog__specs">{cur.specs.map(([k, v]) => <div key={k.ko}><dt>{t(k)}</dt><dd>{t(v)}</dd></div>)}</dl>
            <div className="work-dialog__nav">
              <button type="button" onClick={() => setOpenId((openId! + PROJECTS.length - 1) % PROJECTS.length)}>{t(UI.work.prev)}</button>
              <button type="button" onClick={() => setOpenId((openId! + 1) % PROJECTS.length)}>{t(UI.work.next)}<Arrow /></button>
            </div>
          </div>
        </div>}
      </dialog>
    </section>
  );
}
