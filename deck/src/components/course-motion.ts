/** Default motion for a committed slide/step change, including plain React text replacement.
 * It observes one navigation commit, never ambient frames, clocks, or arbitrary mutations.
 * Existing finite animation owns its properties. Removed/hidden content exits immediately.
 */
type Visual = {
  element: Element;
  text: string;
  graphic: string;
  visible: boolean;
  opacity: number;
  rect: DOMRect;
  display: string;
  translate: string;
  paint: Record<string, string>;
};
export type MotionSnapshot = Map<Element, Visual>;
type MotionRecord = { tag: string; className: string; text: string; reason: string; properties: string[]; duration: number };
export type MotionReport = { cue: string; automatic: MotionRecord[]; native: number; disabled: boolean; scanMs: number };

const PAINT = ["color", "backgroundColor", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor", "boxShadow"];
const SKIP = "script,style,defs,filter,linearGradient,radialGradient,clipPath,mask,pattern,canvas,video,audio,.course-bg,.slide__bg,[data-course-motion='off'],[data-course-motion='custom']";
const FADE_PROPERTIES = new Set(["opacity", "filter", "clipPath"]);
const MOVE_PROPERTIES = new Set(["transform", "translate", "scale", "rotate", "left", "top", "width", "height"]);
const authoredMotion = new WeakMap<Element, { active: () => boolean; properties: Set<string> }>();

/** GSAP reveals use the same ownership contract as browser-native animations. */
export function registerCourseMotion(element: Element, active: () => boolean, properties: string[]) {
  const entry = { active, properties: new Set(properties) };
  authoredMotion.set(element, entry);
  return () => { if (authoredMotion.get(element) === entry) authoredMotion.delete(element); };
}

function activeAuthored(root: Element) {
  return Array.from(root.querySelectorAll("*")).filter(element => authoredMotion.get(element)?.active());
}

export function motionMilliseconds(value: string, fallback: number): number {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return value.trim().endsWith("ms") ? n : n * 1000;
}

export function courseMotionPolicy(root: Element) {
  const style = getComputedStyle(root.closest(".deck-course") ?? root);
  const distance = Number.parseFloat(style.getPropertyValue("--course-motion-distance"));
  return {
    duration: motionMilliseconds(style.getPropertyValue("--course-motion-duration"), 500),
    moveDuration: motionMilliseconds(style.getPropertyValue("--course-motion-move-duration"), 500),
    enterDuration: motionMilliseconds(style.getPropertyValue("--course-motion-enter-duration"), 850),
    distance: Number.isFinite(distance) ? distance : 14,
    ease: style.getPropertyValue("--course-motion-ease").trim() || "ease",
    moveEase: style.getPropertyValue("--course-motion-move-ease").trim() || "ease",
    disabled: !!root.closest("[data-course-motion='off']") || matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

function directText(element: Element) {
  return Array.from(element.childNodes).filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join("").replace(/\s+/g, " ").trim();
}

function graphicSignature(element: Element) {
  if (element instanceof SVGElement) return ["d", "points", "x", "y", "cx", "cy", "r", "width", "height", "href"].map(a => element.getAttribute(a) ?? "").join("|");
  if (element instanceof HTMLImageElement) return element.currentSrc || element.src;
  return "";
}

export function snapshotMotion(root: HTMLElement): MotionSnapshot {
  const result: MotionSnapshot = new Map();
  const visible = new Map<Element, boolean>();
  const bounds = root.getBoundingClientRect();
  for (const element of Array.from(root.querySelectorAll("*"))) {
    if (element.closest(SKIP)) continue;
    const style = getComputedStyle(element), rect = element.getBoundingClientRect();
    const ownVisible = style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > .005;
    const parentVisible = element.parentElement === root ? true : visible.get(element.parentElement) ?? true;
    visible.set(element, ownVisible && parentVisible);
    const paint: Record<string, string> = {};
    for (const property of PAINT) paint[property] = style[property];
    result.set(element, {
      element, text: directText(element), graphic: graphicSignature(element),
      visible: ownVisible && parentVisible && rect.width > 0 && rect.height > 0
        && rect.right > bounds.left && rect.left < bounds.right && rect.bottom > bounds.top && rect.top < bounds.bottom,
      opacity: Number(style.opacity), rect, display: style.display, translate: style.translate, paint,
    });
  }
  return result;
}

function nativeProperties(root: HTMLElement, owned: Set<Animation>) {
  const byElement = new Map<Element, Set<string>>();
  const infinite = new Set<Element>();
  let count = 0;
  for (const animation of root.getAnimations({ subtree: true })) {
    if (owned.has(animation) || animation.playState === "finished" || animation.playState === "idle") continue;
    const effect = animation.effect as KeyframeEffect;
    if (!(effect?.target instanceof Element)) continue;
    const timing = effect.getTiming();
    if (timing.iterations === Infinity) { infinite.add(effect.target); continue; }
    if (!Number(timing.duration)) continue;
    const properties = byElement.get(effect.target) ?? new Set<string>();
    for (const frame of effect.getKeyframes()) for (const name of Object.keys(frame)) properties.add(name);
    byElement.set(effect.target, properties); count++;
  }
  for (const element of activeAuthored(root)) { byElement.set(element, authoredMotion.get(element).properties); count++; }
  return { byElement, infinite, count };
}

function animatedAncestor(element: Element, root: Element, map: Map<Element, Set<string>>, properties: Set<string>) {
  for (let current: Element | null = element; current && current !== root; current = current.parentElement) {
    if (Array.from(map.get(current) ?? []).some(property => properties.has(property))) return true;
  }
  return false;
}

function infiniteAncestor(element: Element, root: Element, infinite: Set<Element>) {
  for (let current: Element | null = element; current && current !== root; current = current.parentElement) if (infinite.has(current)) return true;
  return false;
}

function hasOwnVisual(v: Visual) {
  return !!v.text || !!v.graphic || ["IMG", "SVG", "svg"].includes(v.element.tagName)
    || v.paint.backgroundColor !== "rgba(0, 0, 0, 0)" && v.paint.backgroundColor !== "transparent";
}

function normalizeNativeFades(root: HTMLElement, policy: ReturnType<typeof courseMotionPolicy>) {
  for (const animation of root.getAnimations({ subtree: true })) {
    if (!(animation instanceof CSSAnimation || animation instanceof CSSTransition)) continue;
    const effect = animation.effect as KeyframeEffect, timing = effect.getTiming();
    if (timing.iterations === Infinity || animation.playState === "finished" || !(effect.target instanceof Element)
      || effect.target.closest("[data-course-motion='custom']")) continue;
    const frames = effect.getKeyframes();
    if (!frames.some(frame => "opacity" in frame)) continue;
    // A small content reveal follows the global rhythm; travelling/zooming cameras keep authored choreography.
    const transforms = frames.filter(frame => frame.transform && frame.transform !== "none");
    const camera = transforms.some(frame => {
      try {
        const matrix = new DOMMatrixReadOnly(String(frame.transform));
        return Math.abs(matrix.m41) > 40 || Math.abs(matrix.m42) > 40 || Math.abs(matrix.a - 1) > .08
          || Math.abs(matrix.d - 1) > .08 || Math.abs(matrix.b) > .01 || Math.abs(matrix.c) > .01;
      } catch { return true; }
    });
    if (!camera) effect.updateTiming({ duration: policy.duration, easing: transforms.length ? policy.moveEase : policy.ease });
  }
}

export class CourseMotionController {
  private animations = new Set<Animation>();
  constructor(private root: HTMLElement) {}

  cancel() {
    for (const animation of this.animations) animation.cancel();
    this.animations.clear();
  }

  before(): MotionSnapshot {
    // Fast navigation must not carry an unfinished fade into the next cue.
    this.cancel();
    return snapshotMotion(this.root);
  }

  after(previous: MotionSnapshot, cue: string): MotionReport {
    const started = performance.now(), policy = courseMotionPolicy(this.root);
    const report: MotionReport = { cue, automatic: [], native: 0, disabled: policy.disabled, scanMs: 0 };
    if (policy.disabled) { this.publish(report); return report; }
    normalizeNativeFades(this.root, policy);
    const current = snapshotMotion(this.root);
    const native = nativeProperties(this.root, this.animations);
    report.native = native.count;
    const covered = new Set<Element>();
    const scale = this.root.closest(".stage")?.getBoundingClientRect().width / 1920 || 1;
    for (const [element, next] of current) {
      if (!next.visible) continue;
      let parentCovered = false;
      for (let parent = element.parentElement; parent && parent !== this.root; parent = parent.parentElement) if (covered.has(parent)) { parentCovered = true; break; }
      if (parentCovered) continue;
      const old = previous.get(element);
      const appearing = !old || !old.visible;
      const textChanged = !!next.text && !!old && next.text !== old.text;
      const graphicChanged = !!next.graphic && !!old && next.graphic !== old.graphic;
      const nativeFade = animatedAncestor(element, this.root, native.byElement, FADE_PROPERTIES);
      const nativeMove = animatedAncestor(element, this.root, native.byElement, MOVE_PROPERTIES);
      const ambient = infiniteAncestor(element, this.root, native.infinite);
      const from: Keyframe = {}, to: Keyframe = {};
      const properties: string[] = [];
      let reason = "", covers = false;
      const fade = !nativeFade && (appearing && hasOwnVisual(next) || textChanged || graphicChanged);
      if (fade) {
        from.opacity = 0; to.opacity = next.opacity; properties.push("opacity");
        reason = appearing ? "enter" : textChanged ? "text" : "graphic";
        covers = true;
      } else if (old && !nativeFade && Math.abs(next.opacity - old.opacity) > .01) {
        from.opacity = old.opacity; to.opacity = next.opacity; properties.push("opacity"); reason = "focus"; covers = true;
      }
      // Translate is independent of an authored CSS transform. Keep SVG/camera/infinite paths in their own coordinate systems.
      if (element instanceof HTMLElement && next.display !== "inline" && next.translate === "none" && !nativeMove && !ambient) {
        const dx = old ? (old.rect.x - next.rect.x) / scale : 0;
        const dy = old ? (old.rect.y - next.rect.y) / scale : 0;
        const moving = !!old && old.visible && Math.hypot(dx, dy) > 1 && Math.hypot(dx, dy) < 600;
        if (moving || fade) {
          from.translate = moving ? `${dx}px ${dy}px` : `0px ${policy.distance}px`;
          to.translate = "0px 0px"; properties.push("translate"); reason ||= "move"; covers = true;
        }
      }
      if (old && old.visible && !appearing) for (const property of PAINT) {
        if (old.paint[property] !== next.paint[property] && !native.byElement.get(element)?.has(property)) {
          from[property] = old.paint[property]; to[property] = next.paint[property]; properties.push(property); reason ||= "state";
        }
      }
      if (!properties.length) continue;
      const duration = properties.includes("translate") ? policy.moveDuration : policy.duration;
      if (!duration) continue;
      const animation = element.animate([from, to], { duration, easing: properties.includes("translate") ? policy.moveEase : policy.ease, fill: "both" });
      animation.id = "course-default-motion";
      this.animations.add(animation);
      animation.onfinish = () => { animation.cancel(); this.animations.delete(animation); };
      if (covers) covered.add(element);
      report.automatic.push({ tag: element.tagName, className: element.getAttribute("class") ?? "", text: next.text.slice(0, 140), reason, properties, duration });
    }
    report.scanMs = performance.now() - started;
    this.publish(report);
    return report;
  }

  mount(cue: string) {
    const policy = courseMotionPolicy(this.root);
    if (!policy.disabled) normalizeNativeFades(this.root, policy);
    this.publish({ cue, automatic: [], native: this.root.getAnimations({ subtree: true }).length, disabled: courseMotionPolicy(this.root).disabled, scanMs: 0 });
  }

  private publish(report: MotionReport) {
    // Compact read-only diagnostics for the navigation audit, not application state.
    (window as Window & { __courseMotion?: MotionReport }).__courseMotion = report;
    (window as Window & { __courseMotionNativeTargets?: () => Element[] }).__courseMotionNativeTargets = () => activeAuthored(this.root);
  }
}
