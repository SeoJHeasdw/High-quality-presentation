// Adapted from React Bits TrueFocus (David Haz, 2026).
// MIT + Commons Clause; see ../LICENSE.md.
// Manual focus only: structured content stays readable, with native button activation.
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import "./TrueFocus.css";

type FocusRect = { x: number; y: number; width: number; height: number };

export interface TrueFocusItem {
  id: string;
  label: string;
  content: ReactNode;
}

interface TrueFocusProps {
  items: readonly TrueFocusItem[];
  className?: string;
  label?: string;
  motionEnabled?: boolean;
  animationDuration?: number;
}

export default function TrueFocus({ items, className = "", label = "선택지", motionEnabled = true, animationDuration = .32 }: TrueFocusProps) {
  const container = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [rect, setRect] = useState<FocusRect | null>(null);
  const active = hovered ?? focused ?? selected ?? 0;

  useLayoutEffect(() => {
    const host = container.current, target = buttons.current[active];
    if (!host || !target) return;
    let alive = true, pending = 0;
    const measure = () => {
      if (!alive) return;
      const parentRect = host.getBoundingClientRect(), itemRect = target.getBoundingClientRect();
      // DOMRects are viewport pixels; the frame animates inside the scaled stage.
      const scaleX = host.offsetWidth ? parentRect.width / host.offsetWidth : 1;
      const scaleY = host.offsetHeight ? parentRect.height / host.offsetHeight : 1;
      if (!scaleX || !scaleY) return;
      const next = {
        x: (itemRect.left - parentRect.left) / scaleX,
        y: (itemRect.top - parentRect.top) / scaleY,
        width: itemRect.width / scaleX,
        height: itemRect.height / scaleY,
      };
      setRect(previous => previous && Object.keys(next).every(key => Math.abs(previous[key as keyof FocusRect] - next[key as keyof FocusRect]) < .1) ? previous : next);
    };
    const schedule = () => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(measure);
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(host);
    buttons.current.forEach(button => { if (button) resize.observe(button); });
    // CSS transforms do not trigger ResizeObserver; Stage.fit changes this style.
    const stage = host.closest(".stage");
    const transform = new MutationObserver(schedule);
    if (stage) transform.observe(stage, { attributes: true, attributeFilter: ["style"] });
    window.addEventListener("resize", schedule);
    document.fonts?.ready.then(() => { if (alive) schedule(); });
    measure();
    return () => {
      alive = false;
      cancelAnimationFrame(pending);
      resize.disconnect();
      transform.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [active, items.length]);

  return <div ref={container} className={`rb-true-focus ${className}`} role="group" aria-label={label}
    data-motion={motionEnabled ? "on" : "off"} data-active={active} data-selected={selected ?? undefined}>
    {items.map((item, index) => <button key={item.id} ref={node => { buttons.current[index] = node; }}
      className="rb-true-focus__item" type="button" aria-label={item.label} aria-pressed={selected === index}
      data-active={active === index || undefined}
      onPointerEnter={event => { if (event.pointerType !== "touch") setHovered(index); }}
      onPointerLeave={() => setHovered(null)}
      onFocus={() => setFocused(index)} onBlur={() => setFocused(null)}
      onClick={() => setSelected(index)}>
      {item.content}
    </button>)}
    {rect && <motion.div className="rb-true-focus__frame" aria-hidden="true" initial={false}
      animate={rect} transition={{ duration: motionEnabled ? animationDuration : 0, ease: [.22, 1, .36, 1] }}>
      <i className="rb-true-focus__corner is-top-left"/><i className="rb-true-focus__corner is-top-right"/>
      <i className="rb-true-focus__corner is-bottom-left"/><i className="rb-true-focus__corner is-bottom-right"/>
    </motion.div>}
  </div>;
}
