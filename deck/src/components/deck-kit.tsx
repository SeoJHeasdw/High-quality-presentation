import {
  Component,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import { gsap } from "gsap";
import { courseMotionPolicy, registerCourseMotion } from "./course-motion";

/* ── 배경 이펙트 안전망 ─────────────────────────────────
   react-bits 의 배경들은 WebGL(ogl)을 쓴다. GPU 프로세스가 죽거나
   WebGL 이 막힌 환경에서는 컴포넌트가 throw 하는데, 그대로 두면
   슬라이드 전체가 날아간다. 녹화 중에 그런 일이 나면 안 되므로
   배경만 조용히 버리고 텍스트는 살린다. */

export class SafeFx extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err: unknown) {
    console.warn("[deck] 배경 이펙트를 건너뜁니다 (WebGL 사용 불가):", err);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/* ── 슬라이드 정의 ──────────────────────────────────────── */

export interface SlideCtx {
  /** 현재 노출된 스텝 수. 0 = 아직 아무 스텝도 안 나온 상태 */
  step: number;
  /** 슬라이드가 화면에 올라온 뒤 증가하는 키 (재생용) */
  runKey: number;
}

export interface SlideDef {
  id: string;
  /** 대본 조회 키 */
  scriptKey?: string;
  /** 이 슬라이드 안에서 →로 넘길 단계 수 (없으면 0) */
  steps?: number;
  /**
   * 이어 붙일 화면 묶음. 같은 값을 가진 화면끼리 연속으로 놓이면
   * 다시 그리지 않고 상태만 바꾼다.
   *
   * 예를 들어 `multi-1 · multi-3 · multi-n` 은 같은 그림에 focus 만 다르다.
   * 매번 통째로 다시 마운트하면 배경까지 0.5초 페이드가 다시 돌아서
   * 화면이 찢어져 보인다. 묶어 두면 그림은 그대로 있고 노드만 옮겨간다.
   *
   * **DOM 이 같은 화면끼리만 묶어야 한다.** 상태에 따라 다른 컴포넌트를
   * 그리는 씬(예: topology-network vs topology-hierarchy)을 묶으면
   * 전환 없이 툭 바뀐다. 판단은 CourseDeck.tsx 의 sceneGroup 이 한다.
   */
  group?: string;
  render: (ctx: SlideCtx) => ReactNode;
}

export interface DeckModule {
  /** 덱 루트에 붙는 클래스 (deck-course) */
  className: string;
  slides: SlideDef[];
}

/* ── 스텝(프래그먼트) ──────────────────────────────────── */

export function Step({
  on,
  children,
  delay = 0,
  dim = false,
  className = "",
  style,
}: {
  on: boolean;
  children: ReactNode;
  /** 같은 스텝 안에서 순차 등장시키고 싶을 때 (ms) */
  delay?: number;
  /** false 일 때 사라지지 않고 흐릿하게만 남김 */
  dim?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`step ${dim ? "step--dim" : ""} ${className}`.trim()}
      data-on={on}
      style={{ transitionDelay: on ? `${delay}ms` : "0ms", ...style }}
    >
      {children}
    </div>
  );
}

/* ── Reveal: 마운트 시 GSAP 등장 (ScrollTrigger 없이 확정 재생) ── */

export function Reveal({
  children,
  delay = 0,
  y = 26,
  duration,
  stagger = 0.08,
  /** 자식 요소를 각각 stagger 할지 (false면 컨테이너 통째로) */
  childrenStagger = false,
  className = "",
  style,
  /* data-* 를 그대로 흘려 보낸다. 이게 없으면 화면 쪽에서 건 `data-align`
     같은 속성이 조용히 사라지고, CSS 선택자만 안 맞는 상태가 된다. */
  ...rest
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  duration?: number;
  stagger?: number;
  childrenStagger?: boolean;
  className?: string;
  style?: CSSProperties;
} & React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const policy = courseMotionPolicy(el);
    const targets = childrenStagger ? Array.from(el.children) : [el];
    const unregister: (() => void)[] = [];
    const ctx = gsap.context(() => {
      const tween = gsap.fromTo(
        targets,
        { autoAlpha: 0, y },
        {
          autoAlpha: 1,
          y: 0,
          duration: policy.disabled ? 0 : duration ?? policy.enterDuration / 1000,
          delay: policy.disabled ? 0 : delay,
          stagger,
          ease: "power3.out",
          force3D: true,
        },
      );
      for (const target of targets) unregister.push(registerCourseMotion(target, () => tween.progress() < 1, ["opacity", "transform"]));
    }, ref);
    return () => { unregister.forEach(remove => remove()); ctx.revert(); };
  }, [delay, y, duration, stagger, childrenStagger]);

  return (
    <div ref={ref} className={className} style={style} {...rest}>
      {children}
    </div>
  );
}

/* ── 선 그리기 애니메이션 (다이어그램 화살표) ──────────── */

export function DrawPath({
  d,
  on,
  delay = 0,
  duration = 0.7,
  className = "",
  ...rest
}: {
  d: string;
  on: boolean;
  delay?: number;
  duration?: number;
  className?: string;
} & React.SVGProps<SVGPathElement>) {
  const ref = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(0);

  useLayoutEffect(() => {
    if (ref.current) setLen(ref.current.getTotalLength());
  }, [d]);

  return (
    <path
      ref={ref}
      d={d}
      className={className}
      fill="none"
      strokeDasharray={len || undefined}
      strokeDashoffset={on ? 0 : len || 0}
      style={{
        transition: `stroke-dashoffset ${duration}s cubic-bezier(0.22,1,0.36,1) ${delay}s, opacity .35s ease`,
        opacity: len ? 1 : 0,
      }}
      {...rest}
    />
  );
}

/* ── 창 간 동기화 ────────────────────────────────────────
   슬라이드 창(외부 모니터, 전체화면)과 발표자 창(노트북)을 맞춘다.
   어느 창에서 키를 눌러도 되도록 양쪽 다 송신/수신한다. */

const CHANNEL = "udemy-deck-sync";

interface NavState {
  index: number;
  step: number;
  runKey: number;
}

export function fmtTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function useDeckNav(slides: SlideDef[], deckId: string) {
  const total = slides.length;
  const [nav, setNav] = useState<NavState>({ index: 0, step: 0, runKey: 0 });
  const [t0, setT0] = useState(() => Date.now());
  const [motion, setMotion] = useState(true);
  const [hudHidden, setHudHidden] = useState(deckId === "keynote");
  const [captionGuide, setCaptionGuide] = useState(false);
  /** 숫자로 입력 중인 이동 대상. 확정 전까지의 버퍼라 화면에만 보이고 전송하지 않는다. */
  const [jump, setJump] = useState("");

  const slidesRef = useRef(slides);
  slidesRef.current = slides;
  const navRef = useRef(nav);
  navRef.current = nav;
  const t0Ref = useRef(t0);
  t0Ref.current = t0;
  const jumpRef = useRef(jump);
  jumpRef.current = jump;

  const chanRef = useRef<BroadcastChannel | null>(null);
  const selfId = useRef(Math.random().toString(36).slice(2));
  const fromRemote = useRef(false);
  const lastBroadcastNav = useRef(nav);

  const post = (msg: Record<string, unknown>) => {
    chanRef.current?.postMessage({
      ...msg,
      deck: deckId,
      from: selfId.current,
    });
  };

  /* 채널 연결 */
  useEffect(() => {
    const ch = new BroadcastChannel(CHANNEL);
    chanRef.current = ch;

    ch.onmessage = (e) => {
      const m = e.data;
      if (!m || m.from === selfId.current || m.deck !== deckId) return;

      switch (m.type) {
        case "nav":
          fromRemote.current = true;
          setNav(m.nav);
          break;
        case "hello":
          // 늦게 열린 창이 현재 상태를 물어본 것 — 지금 상태로 답한다
          ch.postMessage({
            type: "nav",
            nav: navRef.current,
            deck: deckId,
            from: selfId.current,
          });
          ch.postMessage({
            type: "timer",
            t0: t0Ref.current,
            deck: deckId,
            from: selfId.current,
          });
          break;
        case "timer":
          setT0(m.t0);
          break;
        case "motion":
          setMotion(m.on);
          break;
        case "hud":
          setHudHidden(m.hidden);
          break;
        case "caption-guide":
          setCaptionGuide(m.on);
          break;
      }
    };

    ch.postMessage({ type: "hello", deck: deckId, from: selfId.current });
    return () => ch.close();
  }, [deckId]);

  /* 상태가 바뀌면 상대 창에 알린다 (첫 렌더와 원격 반영분은 제외 — 에코 방지) */
  useEffect(() => {
    if (lastBroadcastNav.current === nav) return;
    lastBroadcastNav.current = nav;
    if (fromRemote.current) {
      fromRemote.current = false;
      return;
    }
    post({ type: "nav", nav });
  }, [nav]);

  /* 키보드 */
  useEffect(() => {
    const stepsOf = (i: number) => slidesRef.current[i]?.steps ?? 0;
    const count = () => slidesRef.current.length;

    /* 같은 묶음 안에서 옮겨갈 때는 runKey 를 올리지 않는다.
       runKey 가 마운트 키의 일부라(App.tsx) 올리는 순간 화면이 통째로
       다시 그려진다. 묶음이 바뀔 때만 올려서 그때는 정상적으로 전환한다. */
    const sameGroup = (from: number, to: number) => {
      const g = slidesRef.current[from]?.group;
      return g !== undefined && g === slidesRef.current[to]?.group;
    };
    const nextRun = (s: NavState, to: number) =>
      sameGroup(s.index, to) ? s.runKey : s.runKey + 1;

    const onKey = (e: KeyboardEvent) => {
      const go = (fn: (s: NavState) => NavState) => {
        e.preventDefault();
        setJump("");
        setNav(fn);
      };

      /* 장표 번호로 바로 이동.
         화면이 수백 장이라 →만으로는 뒤쪽에 닿을 수 없다. 숫자를 눌러
         번호를 쌓고 Enter 로 확정한다 (Esc 취소, Backspace 한 글자 지움).
         스텝은 0 으로 두고 들어간다 — 그 장표를 처음부터 보게 된다. */
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        setJump((v) => (v + e.key).replace(/^0+(?=\d)/, "").slice(0, 4));
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        setJump((v) => v.slice(0, -1));
        return;
      }
      if (e.key === "Escape") {
        setJump("");
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const n = Number(jumpRef.current);
        setJump("");
        if (!jumpRef.current || !Number.isFinite(n) || n < 1) return;
        setNav((s) => ({
          index: Math.max(0, Math.min(count() - 1, n - 1)),
          step: 0,
          runKey: s.runKey + 1,
        }));
        return;
      }

      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case " ":
        case "PageDown":
          go((s) => {
            if (s.step < stepsOf(s.index)) return { ...s, step: s.step + 1 };
            if (s.index >= count() - 1) return s;
            const to = s.index + 1;
            return { index: to, step: 0, runKey: nextRun(s, to) };
          });
          break;

        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          go((s) => {
            if (s.step > 0) return { ...s, step: s.step - 1 };
            if (s.index <= 0) return s;
            const to = s.index - 1;
            return { index: to, step: stepsOf(to), runKey: nextRun(s, to) };
          });
          break;

        case "Home":
          go((s) => ({ index: 0, step: 0, runKey: s.runKey + 1 }));
          break;

        case "End":
          go((s) => ({
            index: count() - 1,
            step: stepsOf(count() - 1),
            runKey: s.runKey + 1,
          }));
          break;

        case "r":
        case "R":
          go((s) => ({ ...s, step: 0, runKey: s.runKey + 1 }));
          break;

        case "t":
        case "T": {
          // 녹화 시작 버튼 누르는 순간에 같이 눌러 타이머를 0으로
          e.preventDefault();
          const now = Date.now();
          setT0(now);
          post({ type: "timer", t0: now });
          break;
        }

        case "m":
        case "M": {
          e.preventDefault();
          setMotion((v) => {
            post({ type: "motion", on: !v });
            return !v;
          });
          break;
        }

        case "h":
        case "H": {
          // 노트북(발표자 창)에서 눌러도 녹화되는 창의 HUD 가 같이 숨어야 한다
          e.preventDefault();
          setHudHidden((v) => {
            post({ type: "hud", hidden: !v });
            return !v;
          });
          break;
        }

        case "s":
        case "S": {
          // 제작 중에만 쓰는 자막 안전영역 가이드. 녹화 전에는 반드시 OFF.
          e.preventDefault();
          setCaptionGuide((v) => {
            post({ type: "caption-guide", on: !v });
            return !v;
          });
          break;
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deckId]);

  const goto = (i: number) =>
    setNav((s) => ({
      index: Math.max(0, Math.min(slidesRef.current.length - 1, i)),
      step: 0,
      runKey: s.runKey + 1,
    }));

  return {
    index: nav.index,
    step: nav.step,
    runKey: nav.runKey,
    maxStep: slides[nav.index]?.steps ?? 0,
    total,
    goto,
    /** 숫자로 입력 중인 이동 대상 (""면 입력 중이 아님) */
    jump,
    t0,
    motion,
    hudHidden,
    captionGuide,
  };
}

/* ── 진행 바 ──────────────────────────────────────────── */

export function Progress({ value }: { value: number }) {
  return (
    <div className="progress">
      <div
        className="progress__fill"
        style={{ ["--progress" as string]: `${value * 100}%` }}
      />
    </div>
  );
}
