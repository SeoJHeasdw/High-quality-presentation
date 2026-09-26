import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { L, Lang } from "../copy";

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (s: L) => string };
const I18n = createContext<Ctx>({ lang: "ko", setLang: () => {}, t: (s) => s.ko });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    try { return (localStorage.getItem("tel-lang") as Lang) || "ko"; } catch { return "ko"; }
  });
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = lang === "ko" ? "Technology Expert Lab — 선에서, 빛까지" : "Technology Expert Lab — From line to light";
    try { localStorage.setItem("tel-lang", lang); } catch { /* 저장이 막혀도 동작한다 */ }
  }, [lang]);
  return <I18n.Provider value={{ lang, setLang, t: (s) => s[lang] }}>{children}</I18n.Provider>;
}

export const useI18n = () => useContext(I18n);

/** 줄바꿈(\n)을 <br/>로. */
export function Lines({ text }: { text: string }) {
  const parts = text.split("\n");
  return <>{parts.map((p, i) => <span key={i} className="line-break">{p}{i < parts.length - 1 && <br />}</span>)}</>;
}
