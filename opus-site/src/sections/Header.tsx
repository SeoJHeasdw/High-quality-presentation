import { useEffect, useRef, useState } from "react";
import { UI } from "../copy";
import { useI18n } from "../lib/i18n";
import { lockScroll, measure, onFrame, scrollToEl } from "../lib/scroll";

export function Mark() {
  return (
    <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="5" y="5" width="22" height="22" />
      <path d="M5 27L27 10" />
      <circle cx="27" cy="10" r="2.4" />
    </svg>
  );
}

/** 밝은 종이 구간 위에서는 글자색을 뒤집는다. 페이지 맨 위에는 전체 진행 선. */
export default function Header({ onContact }: { onContact: () => void }) {
  const { t, lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLElement>(null);

  useEffect(() => {
    let papers: { top: number; height: number }[] = [];
    const remeasure = () => { papers = Array.from(document.querySelectorAll<HTMLElement>("[data-surface='paper']")).map(measure); };
    remeasure();
    const ro = new ResizeObserver(remeasure); ro.observe(document.body);
    const off = onFrame((y) => {
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      bar.current?.style.setProperty("--p", (y / max).toFixed(4));
      const probe = y + 32;
      const light = papers.some((p) => probe >= p.top && probe < p.top + p.height);
      head.current?.toggleAttribute("data-light", light);
      head.current?.toggleAttribute("data-scrolled", y > 40);
    });
    return () => { off(); ro.disconnect(); };
  }, []);

  useEffect(() => { lockScroll(open); }, [open]);

  const go = (id: string) => { setOpen(false); setTimeout(() => scrollToEl(document.getElementById(id)), open ? 350 : 0); };
  const links: [string, string][] = [["build", t(UI.nav.build)], ["twin", t(UI.nav.twin)], ["work", t(UI.nav.work)]];

  return (
    <>
      <header className="head" ref={head} data-open={open || undefined}>
        <div className="head__progress" ref={bar} aria-hidden="true" />
        <a className="head__brand" href="#top" onClick={(e) => { e.preventDefault(); go("build"); }} aria-label="Technology Expert Lab">
          <Mark /><span className="head__tel">TEL</span><span className="head__full">Technology Expert Lab</span>
        </a>
        <nav className="head__nav" aria-label={lang === "ko" ? "주 메뉴" : "Main"}>
          {links.map(([id, label]) => <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); go(id); }}>{label}</a>)}
        </nav>
        <div className="head__actions">
          <button type="button" className="head__lang" onClick={() => setLang(lang === "ko" ? "en" : "ko")} aria-label={t(UI.nav.langLabel)}>{t(UI.nav.lang)}</button>
          <button type="button" className="head__cta" onClick={onContact}>{t(UI.nav.contact)}<Arrow /></button>
          <button type="button" className="head__menu" aria-expanded={open} aria-controls="menu" onClick={() => setOpen(!open)} aria-label={open ? t(UI.nav.close) : t(UI.nav.menu)}><i /><i /></button>
        </div>
      </header>
      <div id="menu" className="menu" data-open={open || undefined} aria-hidden={!open}>
        <nav>
          {links.map(([id, label], i) => <a key={id} href={`#${id}`} tabIndex={open ? 0 : -1} onClick={(e) => { e.preventDefault(); go(id); }}><span>{String(i + 1).padStart(2, "0")}</span>{label}</a>)}
          <button type="button" tabIndex={open ? 0 : -1} onClick={() => { setOpen(false); onContact(); }}><span>04</span>{t(UI.nav.contact)}</button>
        </nav>
        <button type="button" className="menu__lang" tabIndex={open ? 0 : -1} onClick={() => setLang(lang === "ko" ? "en" : "ko")}>{lang === "ko" ? "English" : "한국어"}</button>
      </div>
    </>
  );
}

export function Arrow({ down = false }: { down?: boolean }) {
  return (
    <svg className="arrow" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={down ? { transform: "rotate(90deg)" } : undefined}>
      <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
