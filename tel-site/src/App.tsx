import { useCallback, useEffect, useRef, useState } from "react";
import FilmSection, { type FilmApi } from "./film/FilmSection";
import TwinSection from "./twin/TwinSection";
import type { Progress } from "./film/frames";
import Loader from "./sections/Loader";
import Header from "./sections/Header";
import Manifesto from "./sections/Manifesto";
import Projects from "./sections/Projects";
import { Contact, ContactDialog, Footer } from "./sections/Contact";
import { I18nProvider } from "./lib/i18n";
import { startScroll } from "./lib/scroll";

export default function App() {
  const [progress, setProgress] = useState<Progress & { failed?: boolean }>({ loaded: 0, total: 681, firstPass: false });
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [asking, setAsking] = useState(false);
  const film = useRef<FilmApi | null>(null);

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    startScroll();
  }, []);

  // 첫 패스가 끝난 뒤에는 로더를 다시 그리지 않도록 진행률 갱신을 줄인다
  const onProgress = useCallback((p: Progress & { failed?: boolean }) => {
    setProgress((old) => (old.firstPass && !p.failed ? old : p));
  }, []);

  return (
    <I18nProvider>
      <a className="skip" href="#manifesto">본문으로 건너뛰기</a>
      <Header onContact={() => setAsking(true)} />
      <main>
        <FilmSection onProgress={onProgress} api={film} ready={revealed} />
        <Manifesto />
        <TwinSection />
        <Projects />
        <Contact onContact={() => setAsking(true)} />
      </main>
      <Footer />
      <ContactDialog open={asking} onClose={() => setAsking(false)} />
      {loading && <Loader progress={progress} api={film} onReveal={() => setRevealed(true)} onDone={() => { setRevealed(true); setLoading(false); }} />}
    </I18nProvider>
  );
}
