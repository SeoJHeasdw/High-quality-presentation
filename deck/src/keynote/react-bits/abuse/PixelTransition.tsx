// Adapted from react-bits/src/ts-default/Animations/PixelTransition/PixelTransition.tsx.
// Retains its random pixel cover/reveal; adds presenter-controlled state and cancellable motion.
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { gsap } from 'gsap';
import './PixelTransition.css';

interface PixelTransitionProps {
  firstContent: ReactNode;
  secondContent: ReactNode;
  active: boolean;
  motionEnabled: boolean;
  gridSize?: number;
  rows?: number;
  pixelColor?: string;
  animationStepDuration?: number;
  className?: string;
  style?: CSSProperties;
}

export default function PixelTransition({
  firstContent, secondContent, active, motionEnabled, gridSize = 15, rows = gridSize,
  pixelColor = '#70eb86', animationStepDuration = .34, className = '', style,
}: PixelTransitionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pixelGridRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const previousRef = useRef(active);

  useLayoutEffect(() => {
    const pixelGridEl = pixelGridRef.current;
    if (!pixelGridEl) return;
    const fragment = document.createDocumentFragment();
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < gridSize; col++) {
        const pixel = document.createElement('div');
        pixel.classList.add('pixelated-image-card__pixel');
        pixel.style.backgroundColor = pixelColor;
        pixel.style.width = `${100 / gridSize + .04}%`;
        pixel.style.height = `${100 / rows + .04}%`;
        pixel.style.left = `${col * 100 / gridSize}%`;
        pixel.style.top = `${row * 100 / rows}%`;
        fragment.appendChild(pixel);
      }
    }
    pixelGridEl.replaceChildren(fragment);
    return () => {
      timelineRef.current?.kill();
      gsap.killTweensOf(pixelGridEl.children);
      pixelGridEl.replaceChildren();
    };
  }, [gridSize, rows, pixelColor]);

  useLayoutEffect(() => {
    const container = containerRef.current, grid = pixelGridRef.current, activeEl = activeRef.current;
    if (!container || !grid || !activeEl) return;
    const pixels = grid.querySelectorAll<HTMLDivElement>('.pixelated-image-card__pixel');
    const changed = active !== previousRef.current;
    previousRef.current = active;
    timelineRef.current?.kill();
    gsap.killTweensOf(pixels);
    gsap.set(pixels, { display: 'none' });
    const settle = () => {
      activeEl.style.display = active ? 'block' : 'none';
      container.dataset.pixelState = 'settled';
    };
    if (!motionEnabled || !changed || !pixels.length) {
      settle();
      return;
    }
    container.dataset.pixelState = 'covering';
    const staggerDuration = animationStepDuration / pixels.length;
    const timeline = gsap.timeline({ onComplete: settle });
    timelineRef.current = timeline;
    timeline.to(pixels, {
      display: 'block', duration: 0,
      stagger: { each: staggerDuration, from: 'random' },
    });
    timeline.add(() => {
      activeEl.style.display = active ? 'block' : 'none';
      container.dataset.pixelState = 'revealing';
    }, animationStepDuration);
    timeline.to(pixels, {
      display: 'none', duration: 0,
      stagger: { each: staggerDuration, from: 'random' },
    }, animationStepDuration);
    return () => {
      timeline.kill();
      gsap.killTweensOf(pixels);
      gsap.set(pixels, { display: 'none' });
    };
  }, [active, motionEnabled, gridSize, rows, pixelColor, animationStepDuration]);

  return <div ref={containerRef} className={`abuse-pixel-transition pixelated-image-card ${className}`}
    style={style} data-active={active || undefined} data-react-bits="PixelTransition">
    <div className="pixelated-image-card__default" aria-hidden={active}>{firstContent}</div>
    <div className="pixelated-image-card__active" ref={activeRef} aria-hidden={!active}>{secondContent}</div>
    <div className="pixelated-image-card__pixels" ref={pixelGridRef} aria-hidden="true"/>
  </div>;
}
