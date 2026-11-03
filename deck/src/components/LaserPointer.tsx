import { useEffect, useRef } from "react";
import "./laser-pointer.css";

/** 화면 배율과 관계없이 포인터를 장표 좌표에 맞춘다. */
export default function LaserPointer({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const position = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const dot = ref.current;
    const stage = dot?.parentElement;
    if (!dot || !stage) return;

    const update = () => {
      const point = position.current;
      const rect = stage.getBoundingClientRect();
      const inside = point && point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
      dot.hidden = !active || !inside;
      if (inside) {
        dot.style.left = `${(point.x - rect.left) / rect.width * 1920}px`;
        dot.style.top = `${(point.y - rect.top) / rect.height * 1080}px`;
      }
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      position.current = { x: event.clientX, y: event.clientY };
      update();
    };
    const leave = (event: MouseEvent) => {
      if (event.relatedTarget === null) {
        position.current = null;
        update();
      }
    };
    const blur = () => { position.current = null; update(); };
    update();
    window.addEventListener("pointermove", move);
    document.addEventListener("mouseout", leave);
    window.addEventListener("blur", blur);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("mouseout", leave);
      window.removeEventListener("blur", blur);
      window.removeEventListener("resize", update);
    };
  }, [active]);

  return <div ref={ref} className="laser-pointer" hidden aria-hidden="true" />;
}
