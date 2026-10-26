import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Frame } from "../KeynoteFrame";
import { usePerformanceMotion } from "../usePerformanceMotion";
import type { WorstWorld } from "./world";
import "../personal/personal.css";
import "./worst.css";

/*
 * 30번 · 실제 결과물 세 편(27~29) 바로 뒤. "AI로 할 바엔 사람이 낫지 않나요?"를 먼저 인정하고,
 * 2~3번의 고양이를 다시 불러 "지금 쓰는 모델이 앞으로 쓸 모델 중 가장 멍청한 모델"로 회수한다.
 * 3D는 worst/world.ts(2~3번과 같은 입자 문법), 글·눈금 라벨·근거는 여기의 DOM이 맡는다. 좌표는 world.ts의 LAYOUT과 같다.
 */
/* 32-2 · 같은 요청으로 만든 사이트. Claude(../opus-site)와 Astra(../astra-site)는 프론티어 모델이 만든 것으로,
   HTML 파일 하나로 묶어(npm run build:single) public/sites/에 두었고 서버 없이 새 탭에서 열린다.
   RICE는 발표자 컴퓨터의 로컬 모델이 만든 것(../rice-site)이다. 이 컴퓨터에 RICE가 있으면 링크 대신 RICE 앱을 띄우고
   (다른 엔진 버튼과 같은 /__javis/engines/rice/launch), 발표자가 그 대화방의 파일 저장 카드에서 tel-site/index.html을 눌러 연다.
   RICE가 없는 컴퓨터(또는 실행 서버 없이 연 덱)에서는 정적 사본 /sites/rice-site.html(보정 1 판)을 새 탭에서 연다.
   어느 쪽인지는 장이 열릴 때 미리 묻는다: 누른 뒤에 정하면 새 탭이 팝업으로 막힐 수 있다.
   사이트 설명과 비용은 발표자가 말로 한다. */
const SITES = [
  { name: "Claude", href: "/sites/opus-site.html" },
  { name: "Astra", href: "/sites/astra-site.html" },
];
/* 32-0 · 개그맨 채널(트빌 20Billion, 메타코미디)이 AI로 만든 78초 드라마. YouTube 쇼츠라 인터넷이 필요하다. */
const DRAMA = "https://www.youtube.com/shorts/JWh7RKtbppQ";

export default function WorstModelStory({ step }: { step: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const world = useRef<WorstWorld | null>(null);
  const [failed, setFailed] = useState(false);
  const motion = usePerformanceMotion();
  const stepRef = useRef(step); stepRef.current = step;
  const motionRef = useRef(motion); motionRef.current = motion;
  // ←로 돌아왔을 때는 제목을 기다리지 않고 바로 보여준다(3D도 그 단계의 마지막 상태다).
  const dir = useRef({ prev: step, back: false });
  const [rice, setRice] = useState<{ busy: boolean; error: string }>({ busy: false, error: "" });
  const [riceApp, setRiceApp] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/__javis/engines/rice/available", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setRiceApp(!!d?.available); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const openRice = async () => {
    if (rice.busy) return;
    setRice({ busy: true, error: "" });
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    try {
      const response = await fetch("/__javis/engines/rice/launch", { method: "POST", headers: { "X-Javis-Launch": "1" }, signal: AbortSignal.timeout(10000) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.error || "로컬 발표 서버를 다시 켠 뒤 실행해주세요.");
      setRice({ busy: false, error: "" });
    } catch (cause) {
      // 앱을 띄우지 못하면 버튼을 정적 사본 링크로 바꾼다. 한 번 더 누르면 사이트가 열린다.
      setRice({ busy: false, error: cause instanceof Error && !(cause instanceof TypeError) && cause.name !== "TimeoutError" ? cause.message : "실행 서버에 연결하지 못했습니다." });
      setRiceApp(false);
    }
  };
  if (dir.current.prev !== step) dir.current = { prev: step, back: step < dir.current.prev };

  useEffect(() => {
    let cancelled = false, w: WorstWorld | null = null;
    const canvas = canvasRef.current!;
    const lost = () => setFailed(true);
    const move = (e: PointerEvent) => w?.setPointer(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1);
    const image = new Image(); image.src = "/shots/cat1@2x.jpg";
    const font = '800 300px "Pretendard Variable"';
    Promise.all([import("./world"), import("../opening/world"), image.decode(), document.fonts.load(font)]).then(([mod, opening]) => {
      if (cancelled) return;
      try { w = mod.createWorstWorld(canvas, { image, glyph: opening.sampleGlyph("고양이", 7000, font) }, stepRef.current, motionRef.current); }
      catch { setFailed(true); return; }
      world.current = w;
      canvas.addEventListener("worst-lost", lost);
      addEventListener("pointermove", move);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; removeEventListener("pointermove", move); canvas.removeEventListener("worst-lost", lost); w?.dispose(); world.current = null; };
  }, []);
  useEffect(() => { world.current?.setPhase(step); }, [step]);
  useEffect(() => { world.current?.setMotion(motion); }, [motion]);

  return <Frame n={29} name="가장 멍청한 모델" step={step} className="personal-v2 worst">
    <div className="wm" data-step={step} data-fallback={failed || undefined} aria-hidden="true">
      <canvas ref={canvasRef} className="wm-canvas" width={1920} height={1080}/>
      <div className="wm-shade"/>
      <figure className="wm-fallback"><img src="/shots/cat1@2x.jpg" alt=""/><span>고양이</span></figure>
    </div>

    <div className="wm-thought" data-on={step === 0 || undefined}>
      <blockquote>“AI로 할 바엔,<br/>사람이 하는 게 낫지 않나요?”</blockquote>
      <p>네. 지금은 그럴 수 있습니다.</p>
    </div>
    <div className="wm-evidence wm-evidence--drama" data-on={step === 0 || undefined}>
      <p className="wm-sites"><b>개그맨 채널이 AI로 만든 1분 남짓한 드라마</b><span>
        <a href={DRAMA} target="_blank" rel="noreferrer">트빌 20Billion · 2026.10 <i aria-hidden="true">↗</i></a></span></p>
    </div>

    {step >= 1 && <div className="wm-heading" key={`h${step}`} data-step={step} data-back={dir.current.back || undefined}>
      {step === 1 ? <>
        <p className="pv-eyebrow">이 업계에서 자주 하는 말</p>
        <h1>지금 쓰는 모델이,<br/>앞으로 쓸 모델 중 가장 멍청한 모델입니다</h1>
        <p className="wm-source">“The AI models that you're using today is the worst AI model you will ever use for the rest of your life.” · 케빈 웨일, 당시 OpenAI 최고제품책임자 · Lenny's Podcast, 2025.04</p>
      </> : <>
        <p className="pv-eyebrow">그래서</p>
        <h1>모델에 걸지 않습니다.<br/>좋아질수록 같이 좋아지는 공장에 겁니다</h1>
      </>}
    </div>}

    <div className="wm-screen" data-on={step >= 1 || undefined}><img src="/demos/bob-demo.jpg" alt=""/></div>
    <p className="wm-cap wm-cap--past" data-on={step >= 1 || undefined}><b>한때</b>사진 한 장 → 단어 하나</p>
    <p className="wm-cap wm-cap--now" data-on={step >= 1 || undefined}><b>지금</b>요청 한 문장 → 영상 한 편</p>
    {["1년 뒤?", "2년 뒤?"].map((label, i) => <p key={label} className="wm-tick" data-on={step >= 1 || undefined} style={{ "--i": i } as CSSProperties}>{label}</p>)}

    <div className="wm-evidence" data-on={step === 2 || undefined}>
      <p><b>같은 성능을 쓰는 값 · 해마다 약 10분의 1</b><span>a16z 추정 · 2021~2024 · MMLU 같은 점수를 내는 가장 싼 모델 기준, 과제에 따라 폭이 다릅니다</span></p>
      <p><b>제가 쓰는 Qwen3-TTS · 2026년 1월 공개</b><span>“3초 음성으로 목소리 복제”는 개발사의 설명입니다</span></p>
      <p className="wm-sites"><b>같은 요청으로 만든 사이트</b><span>{SITES.map(({ name, href }) =>
        <a key={name} href={href} target="_blank" rel="noreferrer">{name} <i aria-hidden="true">↗</i></a>)}
        {riceApp
          ? <button type="button" onClick={() => void openRice()} disabled={rice.busy} aria-busy={rice.busy} title="RICE 앱을 엽니다">{rice.busy ? "RICE 여는 중…" : "RICE · 로컬"} <i aria-hidden="true">↗</i></button>
          : <a href="/sites/rice-site.html" target="_blank" rel="noreferrer" title={rice.error ? `RICE 앱을 열지 못해 사이트를 엽니다 · ${rice.error}` : "RICE가 만든 사이트(보정 1 판)를 엽니다"}>RICE · 로컬 <i aria-hidden="true">↗</i></a>}</span></p>
    </div>
  </Frame>;
}
