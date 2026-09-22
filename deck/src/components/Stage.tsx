import { useEffect, useRef, type ReactNode } from "react";

/**
 * 1920×1080 고정 캔버스. 뷰포트에 맞춰 통째로 스케일한다.
 * → 어떤 모니터에서 녹화해도 타이포 크기 비율이 동일하게 유지된다.
 */
export default function Stage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fit = () => {
      const el = ref.current;
      if (!el) return;
      const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
      el.style.setProperty("--stage-scale", String(s));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <div className="stage-wrap">
      <div className="stage" ref={ref}>
        {children}
      </div>
    </div>
  );
}
