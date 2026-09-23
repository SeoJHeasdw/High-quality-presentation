import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Frame } from "../KeynoteFrame";
import { usePerformanceMotion } from "../usePerformanceMotion";
import track from "./track.json";
import { LAST_STEP, Scrubber, frameAt, progressAt, spanSeconds } from "./film";
import { createPulses } from "./pulses";
import "./next-market.css";

/*
 * 13번 · 다음 시장. 한 장 안에서 스크롤하는 페이지다.
 * 뒤에는 Blender로 렌더한 영상이 고정돼 있고(tools/render-house-scroll.py), 스크롤 위치가 프레임을 고른다.
 * 휠·트랙패드는 영상을 앞뒤로 훑고, →는 다음 정지 지점까지 원래 속도로 재생하며, ←는 빠르게 되감는다.
 * 스크롤로 정지 지점을 넘으면 덱의 단계도 바꿔 발표자 창의 대본이 따라온다.
 */

export const NEXT_MARKET_SOURCES = {
  swe: "https://www.anthropic.com/news/claude-opus-4-5",
  a16z: "https://a16z.com/the-trillion-dollar-ai-software-development-stack/",
  bofa: "https://fortune.com/2025/06/26/agentic-ai-spending-155-billion-by-2030-cfo-bofa-analysts",
  jev: "https://typesafe.ai/blog/introducing-system-one-models-and-jev",
};

const FILM = "/house-scroll/film.mp4";
const NAV: [string, number, number][] = [["문제 해결", 0, 3], ["시장", 4, 5], ["속도", 6, 6], ["다음", 7, 7]];

type Label = { id: keyof typeof track.labels; name: string; sub?: string; peak: number; gold?: boolean };
const LABELS: Label[] = [
  { id: "dev", name: "개발자", sub: "연 3조 달러", peak: 4, gold: true },
  { id: "sales", name: "영업", peak: 5 },
  { id: "marketing", name: "마케팅", peak: 5 },
  { id: "support", name: "고객지원", peak: 5 },
  { id: "finance", name: "재무", peak: 5 },
  { id: "hr", name: "인사", peak: 5 },
  { id: "it", name: "IT", sub: "개발자 포함", peak: 5, gold: true },
  { id: "ops", name: "운영", peak: 5 },
];

const LAUNCHES: [number, string, string][] = [
  [2, "2월", "Claude Code"], [4, "4월", "Codex CLI"], [5, "5월", "Codex"],
  [5, "5월", "Copilot 코딩 에이전트"], [6, "6월", "Gemini CLI"], [7, "7월", "Kiro"],
];

function Src({ href, children }: { href?: string; children: ReactNode }) {
  return <p className="nm-source">{href ? <a href={href} target="_blank" rel="noreferrer">{children} ↗</a> : children}</p>;
}

/** 여덟 구간. 순서가 곧 단계 번호다. */
const SECTIONS: { cls: string; body: ReactNode }[] = [
  { cls: "nm-s0", body: <>
    <p className="nm-kicker">문제를 푸는 방법</p>
    <h1>개발은 결국<br/>문제를 푸는 일이었습니다</h1>
    <p className="nm-lead">알고리즘은 가장 좋은 풀이를 찾는 방법입니다.</p>
  </> },
  { cls: "nm-s1", body: <>
    <p className="nm-kicker">2025년</p>
    <h1>AI 회사들이<br/>코딩 에이전트에<br/>집중했습니다</h1>
    <div className="nm-year" aria-label="2025년 코딩 에이전트 출시">
      <ol className="nm-months" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <li key={i} data-on={LAUNCHES.some(([m]) => m === i + 1) || undefined}><i/><span>{i + 1}</span></li>)}</ol>
      <ul className="nm-launches">{LAUNCHES.map(([, m, name]) => <li key={name}><b>{m}</b>{name}</li>)}</ul>
    </div>
    <Src>각 사 발표 · 2025년 공개 시점 · 날짜와 원문은 대본에</Src>
  </> },
  { cls: "nm-s2", body: <>
    <p className="nm-kicker">실제 GitHub 이슈 해결률</p>
    <h1>에이전트는<br/>문제를 푸는 방법을<br/>익혔습니다</h1>
    <div className="nm-bars">
      <div style={{ "--v": .332 } as CSSProperties}><span>2024.8 · GPT-4o</span><i/><b>33<small>%</small></b></div>
      <div className="is-now" style={{ "--v": .809 } as CSSProperties}><span>2025.11 · Claude Opus 4.5</span><i/><b>81<small>%</small></b></div>
    </div>
    <Src href={NEXT_MARKET_SOURCES.swe}>SWE-bench Verified · 사람이 확인한 실제 이슈 500개 · OpenAI 2024.8.13, Anthropic 2025.11.24</Src>
  </> },
  { cls: "nm-s3", body: <>
    <p className="nm-kicker">코드 밖으로</p>
    <h1>그 방법이 이제<br/>전문가의 일로<br/>넘어옵니다</h1>
    <ul className="nm-chips"><li>건축 설계</li><li>3D 모션 그래픽</li><li className="is-more">더 많은 지식 노동</li></ul>
    <Src>발표자의 관점</Src>
  </> },
  { cls: "nm-s4", body: <>
    <p className="nm-kicker">먼저 열린 시장</p>
    <p className="nm-figure is-gold"><b>3</b><span>조 달러</span></p>
    <h2>전 세계 개발자 약 3,000만 명이<br/>한 해에 만드는 가치</h2>
    <p className="nm-note">3,000만 명 × 1인당 10만 달러로 계산한 추정</p>
    <Src href={NEXT_MARKET_SOURCES.a16z}>a16z · The Trillion Dollar AI Software Development Stack · 2025.10.9</Src>
  </> },
  { cls: "nm-s5", body: <>
    <p className="nm-kicker">다음 시장</p>
    <p className="nm-figure"><b>18.6</b><span>조 달러<em>+</em></span></p>
    <h2>지식근로 7개 직군의<br/>한 해 임금</h2>
    <div className="nm-compare" aria-label="개발자 3조 달러와 7개 직군 18.6조 달러의 비교">
      <div className="is-gold" style={{ "--w": 3 / 18.6 } as CSSProperties}><i/><span>개발자 3조</span></div>
      <div style={{ "--w": 1 } as CSSProperties}><i/><span>7개 직군 18.6조</span></div>
    </div>
    <p className="nm-note">건축·3D 같은 전문 직군은 이 숫자에 들어 있지 않습니다.</p>
    <Src href={NEXT_MARKET_SOURCES.bofa}>BofA Global Research · Fortune 2025.6.26 · 기준이 다른 두 추정치를 나란히 둔 비교</Src>
  </> },
  { cls: "nm-s6", body: <>
    <p className="nm-kicker">그리고 속도</p>
    <p className="nm-figure is-ice"><b>0.07–0.5</b><span>초</span></p>
    <h2>Jev가 판단 하나를<br/>돌려주는 시간</h2>
    <div className="nm-flow"><span>상황</span><i/><span className="is-ice">판단 값</span><i/><span>행동</span></div>
    <ul className="nm-chips is-small"><li>게임</li><li>에이전트 루프</li><li>실시간 거래<small>가설</small></li></ul>
    <p className="nm-note">출력 토큰 무료 · 입력 100만 토큰당 0.042달러</p>
    <Src href={NEXT_MARKET_SOURCES.jev}>TypeSafe AI · Jev 발표 · 2026.9.15 · 속도와 가격은 개발사 발표 · 빛 한 줄기가 판단 하나인 도식</Src>
  </> },
  { cls: "nm-s7", body: <>
    <h1>이제 우리 일로<br/>넘어옵니다</h1>
    <p className="nm-lead">문제를 푸는 에이전트가 더 빠르고 싸게,<br/>더 많은 일에 들어옵니다.</p>
  </> },
];

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t); };
/** 단계 k를 중심으로 폭 w 안에서 떠오르는 값. 가운데 40%는 온전히 보인다. */
const window1 = (p: number, k: number, w: number) => smooth((w - Math.abs(p - k)) / (w * .6));
const navPos = (p: number) => (p <= 3 ? 0 : p < 4 ? p - 3 : p <= 5 ? 1 : p < 6 ? p - 4 : p < 7 ? p - 4 : 3);

type Mode = "idle" | "wheel" | "play" | "tween";

export default function NextMarket({ step }: { step: number }) {
  const motion = usePerformanceMotion();
  const motionRef = useRef(motion); motionRef.current = motion;
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const secRefs = useRef<(HTMLElement | null)[]>([]);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const navRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const barRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const failedRef = useRef(false); failedRef.current = failed;
  const [still, setStill] = useState(step);
  const st = useRef({ p: step, target: step, mode: "idle" as Mode, from: step, to: step, t0: 0, dur: 0, playTo: step, reported: step, self: -1, acc: 0, still: step });
  const api = useRef<{ go(to: number): void; report(k: number): void } | null>(null);

  useEffect(() => {
    const video = videoRef.current!, root = rootRef.current!, s = st.current;
    // src는 여기서 건다. 정리할 때 src를 비우므로, JSX 속성에만 두면 다시 마운트될 때 빈 영상이 된다.
    video.src = FILM;
    const scrub = new Scrubber(video);
    const pulses = createPulses(canvasRef.current!, track.pulses);
    const onReady = () => setReady(true);
    const onError = () => setFailed(true);
    video.addEventListener("seeked", onReady, { once: true });
    video.addEventListener("error", onError);

    const report = (k: number) => {
      if (k === s.reported) return;
      s.reported = k; s.self = k;
      window.dispatchEvent(new CustomEvent("deck:step", { detail: k }));
    };
    const go = (to: number) => {
      if (!motionRef.current || failedRef.current) { s.p = s.target = to; s.mode = "idle"; return; }
      const d = to - s.p;
      if (Math.abs(d) < 1e-3) { s.p = to; s.mode = "idle"; return; }
      if (d > 0) {
        // 앞으로는 영상을 그대로 재생한다. 여러 단계를 한 번에 건너뛸 때만 빠르게.
        s.playTo = s.target = to;
        video.playbackRate = clamp(d, 1, 3);
        if (s.mode !== "play") {
          s.mode = "play";
          scrub.seek(frameAt(s.p));
          // 재생이 막히면 같은 속도의 탐색으로 대신한다. 휠이 끼어들어 pause()로 끊긴 경우는 그대로 둔다.
          video.play().catch(() => {
            if (s.mode !== "play") return;
            s.mode = "tween"; s.from = s.p; s.to = s.playTo; s.t0 = performance.now(); s.dur = spanSeconds(s.p, s.playTo);
          });
        }
      } else {
        // 되돌아갈 때는 스크롤을 올리듯 빠르게 되감는다.
        if (s.mode === "play") video.pause();
        s.mode = "tween"; s.from = s.p; s.to = s.target = to; s.t0 = performance.now();
        s.dur = clamp(spanSeconds(s.p, to) / 2.6, .35, 1.4);
      }
    };
    api.current = { go, report };

    const paint = (p: number, f: number) => {
      secRefs.current.forEach((el, k) => {
        if (!el) return;
        const d = p - k, a = Math.abs(d);
        const o = a >= .46 ? 0 : a <= .2 ? 1 : smooth((.46 - a) / .26);
        el.style.opacity = o.toFixed(3);
        el.style.transform = `translate3d(0,${(-d * 240).toFixed(1)}px,0)`;
        el.style.visibility = o > 0 ? "visible" : "hidden";
      });
      LABELS.forEach((l, i) => {
        const el = labelRefs.current[i]; if (!el) return;
        const [x, y, v] = track.labels[l.id][f] ?? [0, 0, 0];
        const o = v ? window1(p, l.peak, .42) : 0;
        el.style.opacity = o.toFixed(3);
        el.style.visibility = o > 0 ? "visible" : "hidden";
        el.style.transform = `translate3d(${x}px,${y}px,0)`;
      });
      const n = navPos(p), i = Math.min(NAV.length - 2, Math.floor(n)), t = n - i;
      const a = navRefs.current[i], b = navRefs.current[i + 1];
      if (a && b && barRef.current) {
        const left = a.offsetLeft + (b.offsetLeft - a.offsetLeft) * t, width = a.offsetWidth + (b.offsetWidth - a.offsetWidth) * t;
        barRef.current.style.transform = `translate3d(${left.toFixed(1)}px,0,0)`;
        barRef.current.style.width = `${width.toFixed(1)}px`;
      }
      navRefs.current.forEach((el, k) => el?.toggleAttribute("data-on", Math.round(n) === k));
      if (railRef.current) railRef.current.style.setProperty("--fill", (p / LAST_STEP).toFixed(4));
      railRef.current?.querySelectorAll("i").forEach((dot, k) => dot.toggleAttribute("data-on", Math.round(p) === k));
      if (hintRef.current) hintRef.current.style.opacity = clamp(1 - p * 6).toFixed(3);
      if (canvasRef.current) canvasRef.current.style.opacity = (motionRef.current ? window1(p, 6, .3) : 0).toFixed(3);
      const k = Math.round(p);
      if (k !== s.still) { s.still = k; setStill(k); }
    };

    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(.1, (now - last) / 1000); last = now;
      if (s.mode === "play") {
        const end = frameAt(s.playTo), f = scrub.shown;
        s.p = Math.min(s.playTo, Math.max(s.p, progressAt(f)));
        if (f >= end - .5 || video.ended) { video.pause(); scrub.seek(end); s.p = s.playTo; s.mode = "idle"; }
      } else if (s.mode === "tween") {
        const t = clamp((now - s.t0) / (s.dur * 1000));
        s.p = s.from + (s.to - s.from) * t;
        if (t >= 1) s.mode = "idle";
      } else if (s.mode === "wheel") {
        s.p += (s.target - s.p) * (1 - Math.exp(-dt * 8));
        if (Math.abs(s.target - s.p) < .002) { s.p = s.target; s.mode = "idle"; }
        report(Math.round(s.p));
      }
      if (s.mode !== "play" && motionRef.current && !failedRef.current) scrub.seek(frameAt(s.p));
      paint(s.p, Math.round(frameAt(s.p)));
      pulses.setActive(motionRef.current && Math.abs(s.p - 6) < .3);
      const settled = s.mode === "idle" && (!motionRef.current || failedRef.current || scrub.settled);
      root.dataset.settled = String(settled);
      root.dataset.progress = s.p.toFixed(3);
    };
    raf = requestAnimationFrame(loop);

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;  // 핀치 확대는 브라우저에 맡긴다
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaMode === 2 ? e.deltaY * 900 : e.deltaY;
      if (!motionRef.current || failedRef.current) {
        // 모션을 끄면 한 번에 한 단계씩, 정지 지점 이미지만 보여준다.
        s.acc += dy;
        if (Math.abs(s.acc) > 240) {
          const k = clamp(Math.round(s.p) + Math.sign(s.acc), 0, LAST_STEP);
          s.acc = 0; s.p = s.target = k; s.mode = "idle"; report(k);
        }
        return;
      }
      if (s.mode === "play") video.pause();
      if (s.mode !== "wheel") s.target = s.p;
      s.target = clamp(s.target + dy / 1000, 0, LAST_STEP);
      s.mode = "wheel";
    };
    addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("wheel", onWheel);
      video.removeEventListener("seeked", onReady);
      video.removeEventListener("error", onError);
      pulses.dispose(); scrub.dispose();
      video.pause(); video.removeAttribute("src"); video.load();
      api.current = null;
    };
  }, []);

  // 덱의 단계가 바뀌면(→, ←, 발표자 창) 그 정지 지점으로 간다. 스크롤로 우리가 알린 단계는 건너뛴다.
  useEffect(() => {
    const s = st.current;
    if (step === s.self) { s.self = -1; return; }
    s.reported = step;
    api.current?.go(step);
  }, [step]);

  // 모션을 끄면 재생을 멈추고 정지 지점으로.
  useEffect(() => {
    const s = st.current;
    if (motion) return;
    videoRef.current?.pause();
    s.p = s.target = Math.round(s.p); s.mode = "idle";
  }, [motion]);

  const showStill = failed || !ready || !motion;
  return <Frame n={12} name="다음 시장" step={step} className="story-next-market">
    <div className="nm" ref={rootRef} data-scroll-page data-settled="false">
      <div className="nm-film" aria-hidden="true">
        <video ref={videoRef} muted playsInline preload="auto" data-hidden={showStill || undefined}/>
        <img src={`/house-scroll/a${still}.jpg`} alt="" data-visible={showStill || undefined}/>
        <canvas ref={canvasRef} className="nm-pulses" width={1920} height={1080}/>
        <div className="nm-shade"/>
      </div>
      <div className="nm-labels" aria-hidden="true">
        {LABELS.map((l, i) => <div key={l.id} ref={(el) => { labelRefs.current[i] = el; }} className="nm-label" data-gold={l.gold || undefined}>
          <i/><div><strong>{l.name}</strong>{l.sub && <span>{l.sub}</span>}</div>
        </div>)}
      </div>
      <div className="nm-page">
        {SECTIONS.map((sec, k) => <section key={k} ref={(el) => { secRefs.current[k] = el; }} className={`nm-sec ${sec.cls}`} aria-hidden={Math.round(still) !== k || undefined}>
          {sec.body}
        </section>)}
      </div>
      <nav className="nm-nav" aria-label="페이지 구간">
        {NAV.map(([name], k) => <span key={name} ref={(el) => { navRefs.current[k] = el; }}>{name}</span>)}
        <b ref={barRef} className="nm-nav-bar"/>
      </nav>
      <div className="nm-rail" ref={railRef} aria-hidden="true">{Array.from({ length: LAST_STEP + 1 }, (_, k) => <i key={k}/>)}</div>
      <div className="nm-hint" ref={hintRef} aria-hidden="true"><span className="nm-mouse"><i/></span>스크롤</div>
    </div>
  </Frame>;
}
