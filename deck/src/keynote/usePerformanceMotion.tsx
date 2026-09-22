import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const PerformanceMotion = createContext(false);

/** One policy for pointer effects, presentation pause, and OS reduced motion. */
export function PerformanceMotionProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [available, setAvailable] = useState(() => !document.hidden && !matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setAvailable(!document.hidden && !preference.matches);
    preference.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      preference.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return <PerformanceMotion.Provider value={enabled && available}>{children}</PerformanceMotion.Provider>;
}

export function usePerformanceMotion() { return useContext(PerformanceMotion); }
