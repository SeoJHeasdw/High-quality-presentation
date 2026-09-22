/** Adapted from React Bits TiltedCard and GlareHover. MIT + Commons Clause — see ./LICENSE.md. */
import { useEffect, useRef, type RefObject } from "react";
import { motion, useMotionValue, useSpring, useMotionTemplate, type SpringOptions } from "motion/react";
import "./TiltedCard.css";

const springValues: SpringOptions = { damping: 30, stiffness: 100, mass: 2 };

interface TiltedCardProps {
  imageSrc: string;
  altText: string;
  captionText: string;
  enabled: boolean;
  expanded?: boolean;
  scaleOnHover?: number;
  rotateAmplitude?: number;
  onActivate: () => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
}

/** Rect-normalized pointer coordinates also work inside the deck's scaled 1920px stage. */
export default function TiltedCard({ imageSrc, altText, captionText, enabled, expanded = false, scaleOnHover = 1.035, rotateAmplitude = 8, onActivate, triggerRef }: TiltedCardProps) {
  const localRef = useRef<HTMLButtonElement>(null);
  const ref = triggerRef ?? localRef;
  const rotateX = useSpring(0, springValues);
  const rotateY = useSpring(0, springValues);
  const scale = useSpring(1, springValues);
  const glareOpacity = useSpring(0, { damping: 28, stiffness: 170 });
  const glareX = useMotionValue(50);
  const glareY = useMotionValue(50);
  const glarePosition = useMotionTemplate`${glareX}% ${glareY}%`;

  const reset = () => { rotateX.set(0); rotateY.set(0); scale.set(1); glareOpacity.set(0); };
  useEffect(() => {
    if (!enabled) { rotateX.jump(0); rotateY.jump(0); scale.jump(1); glareOpacity.jump(0); }
  }, [enabled, rotateX, rotateY, scale, glareOpacity]);

  return <button
    type="button"
    ref={ref}
    className="rb-tilted-card"
    aria-label={`${captionText} 크게 보기`}
    aria-haspopup="dialog"
    aria-expanded={expanded}
    data-motion={enabled ? "on" : "off"}
    onClick={onActivate}
    onPointerMove={event => {
      if (!enabled || event.pointerType === "touch" || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      rotateX.set((y - .5) * -2 * rotateAmplitude);
      rotateY.set((x - .5) * 2 * rotateAmplitude);
      glareX.set((1 - x) * 100); glareY.set((1 - y) * 100);
    }}
    onPointerEnter={event => {
      if (!enabled || event.pointerType === "touch") return;
      scale.set(scaleOnHover); glareOpacity.set(.65);
    }}
    onPointerLeave={reset}
    onBlur={reset}
  >
    <motion.span className="rb-tilted-card__inner" style={{ rotateX, rotateY, scale }}>
      <img className="rb-tilted-card__image" src={imageSrc} alt={altText} draggable={false}/>
      <motion.span className="rb-tilted-card__glare" aria-hidden="true" style={{ opacity: glareOpacity, backgroundPosition: glarePosition }}/>
      <span className="rb-tilted-card__inspect" aria-hidden="true">크게 보기 <svg viewBox="0 0 20 20" fill="none"><path d="M6 4h10v10M16 4 4 16"/></svg></span>
    </motion.span>
  </button>;
}
