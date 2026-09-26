import { useEffect, useRef, useState, type FormEvent } from "react";
import { UI } from "../copy";
import { Lines, useI18n } from "../lib/i18n";
import { lockScroll, measure, onFrame, clamp, scrollToY } from "../lib/scroll";
import { Arrow, Mark } from "./Header";

/** 마지막 장면(빛으로 이어진 도시) 위의 상담 안내와 푸터. */
export function Contact({ onContact }: { onContact: () => void }) {
  const { t } = useI18n();
  const section = useRef<HTMLElement>(null);
  const bg = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = section.current!;
    let geo = measure(el);
    const ro = new ResizeObserver(() => { geo = measure(el); }); ro.observe(document.body);
    const off = onFrame((y) => {
      const p = clamp((y + innerHeight - geo.top) / (geo.height + innerHeight));
      bg.current?.style.setProperty("--p", p.toFixed(4));
    });
    return () => { off(); ro.disconnect(); };
  }, []);
  return (
    <section id="contact" className="contact" ref={section}>
      <div className="contact__bg" ref={bg} aria-hidden="true"><img src="/film/poster/a7.jpg" alt="" loading="lazy" /></div>
      <div className="contact__inner">
        <p className="kicker">{t(UI.contact.kicker)}</p>
        <h2 className="contact__title"><Lines text={t(UI.contact.title)} /></h2>
        <div className="contact__row">
          <p className="body">{t(UI.contact.body)}</p>
          <button type="button" className="button-line" onClick={onContact}>
            <span className="button-line__rule" aria-hidden="true" />
            {t(UI.contact.cta)}<Arrow />
          </button>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="foot">
      <div className="foot__grid">
        <div className="foot__brand"><Mark /><span>Technology Expert Lab</span></div>
        <dl>
          <div><dt>{t(UI.footer.offices)}</dt><dd>{t(UI.footer.officeList)}</dd></div>
          <div><dt>{t(UI.footer.since)}</dt><dd>N 37°31′ · E 126°56′ · EL +0.300</dd></div>
        </dl>
        <button type="button" className="foot__top" onClick={() => scrollToY(0, { duration: 2.4 })}>{t(UI.footer.top)} ↑</button>
      </div>
      <p className="foot__word" aria-hidden="true">Technology Expert Lab</p>
      <p className="foot__note">{t(UI.footer.note)}</p>
    </footer>
  );
}

export function ContactDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const d = ref.current!;
    if (open && !d.open) { setDone(false); d.showModal(); lockScroll(true); }
    if (!open && d.open) { d.close(); }
    if (!open) lockScroll(false);
  }, [open]);
  const submit = (e: FormEvent) => { e.preventDefault(); setDone(true); };
  return (
    <dialog ref={ref} className="ask" onClose={onClose} aria-labelledby="ask-title" onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="ask__inner">
        <button type="button" className="ask__close" onClick={onClose} aria-label={t(UI.nav.close)}>×</button>
        <p className="kicker">Technology Expert Lab</p>
        <h2 id="ask-title" className="ask__title">{t(UI.contact.formTitle)}</h2>
        <p className="ask__notice">{t(UI.contact.notice)}</p>
        {done ? (
          <div className="ask__done" role="status">
            <p>{t(UI.contact.done)}</p>
            <button type="button" className="button-line" onClick={() => setDone(false)}>{t(UI.contact.again)}<Arrow /></button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="ask__row">
              <label>{t(UI.contact.name)}<input name="name" autoComplete="name" required /></label>
              <label>{t(UI.contact.company)}<input name="company" autoComplete="organization" /></label>
            </div>
            <label>{t(UI.contact.email)}<input name="email" type="email" autoComplete="email" required /></label>
            <label>{t(UI.contact.site)}<input name="site" required /></label>
            <fieldset>
              <legend>{t(UI.contact.type)}</legend>
              <div className="ask__chips">
                {UI.contact.types.map((ty, i) => <label key={ty.ko}><input type="radio" name="type" value={ty.en} defaultChecked={i === 0} /><span>{t(ty)}</span></label>)}
              </div>
            </fieldset>
            <label>{t(UI.contact.idea)}<textarea name="idea" rows={3} /></label>
            <button type="submit" className="ask__submit">{t(UI.contact.submit)}<Arrow /></button>
          </form>
        )}
      </div>
    </dialog>
  );
}
