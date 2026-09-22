// Adapted from React Bits ClickSpark / David Haz. See ../LICENSE.md.
// The stage has a CSS scale: drawing and event coordinates stay in stage units.
import { useEffect, useRef } from "react";

export default function ClickSpark({ color = "#dcefff" }: { color?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current, host = canvas?.closest(".kn-slide");
    const ctx = canvas?.getContext("2d");
    if (!canvas || !host || !ctx) return;
    const sparks: { x: number; y: number; start: number }[] = [];
    let raf = 0;
    function draw(now: number) {
      raf = 0;
      ctx!.clearRect(0, 0, 1920, 1080);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const spark = sparks[i], progress = (now - spark.start) / 650;
        if (progress >= 1) { sparks.splice(i, 1); continue; }
        const eased = progress * (2 - progress), radius = 12 + eased * 80;
        ctx!.strokeStyle = color;
        ctx!.globalAlpha = (1 - progress) * .85;
        ctx!.lineWidth = 1.5;
        ctx!.beginPath(); ctx!.arc(spark.x, spark.y, radius * .65, 0, Math.PI * 2); ctx!.stroke();
        for (let n = 0; n < 12; n++) {
          const angle = n * Math.PI / 6, end = radius + 18 * (1 - eased);
          ctx!.beginPath();
          ctx!.moveTo(spark.x + radius * Math.cos(angle), spark.y + radius * Math.sin(angle));
          ctx!.lineTo(spark.x + end * Math.cos(angle), spark.y + end * Math.sin(angle)); ctx!.stroke();
        }
      }
      ctx!.globalAlpha = 1;
      canvas!.dataset.active = String(sparks.length > 0);
      if (sparks.length) raf = requestAnimationFrame(draw);
    }
    const click = (event: Event) => {
      const e = event as MouseEvent;
      if (!e.detail || (e.target as Element)?.closest("video,audio,input,textarea")) return;
      const rect = canvas.getBoundingClientRect();
      sparks.push({ x: (e.clientX - rect.left) * 1920 / rect.width, y: (e.clientY - rect.top) * 1080 / rect.height, start: performance.now() });
      if (sparks.length > 8) sparks.shift();
      if (!raf) raf = requestAnimationFrame(draw);
    };
    host.addEventListener("click", click);
    return () => { cancelAnimationFrame(raf); host.removeEventListener("click", click); };
  }, [color]);
  return <canvas ref={ref} width={1920} height={1080} className="performance-click-spark" aria-hidden="true"/>;
}
