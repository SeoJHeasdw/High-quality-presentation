import Lenis from "lenis";

/*
 * 페이지 전체가 한 개의 rAF 루프를 쓴다. Lenis가 휠을 부드럽게 만들고,
 * 각 구간은 onFrame으로 (스크롤 위치, 경과 시간)을 받아 자기 화면만 그린다.
 * 모션 줄이기 설정에서는 Lenis 없이 브라우저 스크롤을 그대로 쓴다.
 */
type Sub = (y: number, dt: number, now: number) => void;
const subs = new Set<Sub>();
let lenis: Lenis | null = null;
let started = false;

export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function startScroll() {
  if (started) return;
  started = true;
  if (!reducedMotion()) {
    lenis = new Lenis({ lerp: 0.14, wheelMultiplier: 1, smoothWheel: true, syncTouch: false, anchors: false });
  }
  let last = performance.now();
  const loop = (now: number) => {
    lenis?.raf(now);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const y = window.scrollY;
    subs.forEach((s) => s(y, dt, now));
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

export function onFrame(s: Sub) {
  subs.add(s);
  return () => { subs.delete(s); };
}

export function scrollToY(y: number, opts: { immediate?: boolean; duration?: number } = {}) {
  if (lenis) lenis.scrollTo(y, { immediate: !!opts.immediate, duration: opts.duration ?? 1.8, easing: (t) => 1 - Math.pow(1 - t, 3) });
  else window.scrollTo({ top: y, behavior: opts.immediate || reducedMotion() ? "auto" : "smooth" });
}

export function scrollToEl(el: Element | null, offset = 0) {
  if (!el) return;
  scrollToY(el.getBoundingClientRect().top + window.scrollY + offset);
}

export function lockScroll(lock: boolean) {
  if (lenis) lock ? lenis.stop() : lenis.start();
  document.documentElement.classList.toggle("is-locked", lock);
}

/** 문서 기준 위치. 레이아웃이 바뀔 때만 다시 잰다. */
export function measure(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return { top: r.top + window.scrollY, height: r.height };
}

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
