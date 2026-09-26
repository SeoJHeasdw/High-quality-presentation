import { useEffect, useRef, useState } from "react";
import P from "./tower.json";
import { UI } from "../copy";
import { Lines, useI18n } from "../lib/i18n";
import { clamp, measure, onFrame, reducedMotion } from "../lib/scroll";

/*
 * 디지털 트윈 구간. 스크롤하면 절단면이 꼭대기에서 바닥으로 한 층씩 내려가고,
 * 오른쪽 계기판이 그 층의 용도·면적·회전·표고를 보여 준다. 드래그로 돌린다.
 * three.js는 이 구간이 가까워질 때 불러온다.
 */
const TOTAL_CLASHES = 1284;
type Scene = import("./twinScene").TwinScene;

export default function TwinSection() {
  const { t, lang } = useI18n();
  const langRef = useRef(lang); langRef.current = lang;
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const out = useRef<Record<string, HTMLElement | null>>({});
  const bar = useRef<HTMLSpanElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const [failed, setFailed] = useState(false);
  const [layers, setLayers] = useState({ structure: true, envelope: true, services: true });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = section.current!;
    let geo = measure(el);
    let scene: Scene | null = null;
    let area = 0;
    let stop = () => {};
    let cancelled = false;
    const ro = new ResizeObserver(() => { geo = measure(el); scene?.resize(canvas.current!.clientWidth, canvas.current!.clientHeight); });
    ro.observe(document.body);
    ro.observe(canvas.current!);
    const io = new IntersectionObserver(async ([e]) => {
      if (!e.isIntersecting || scene || cancelled) return;
      io.disconnect();
      try {
        const mod = await import("./twinScene");
        if (cancelled) return;
        scene = new mod.TwinScene(canvas.current!);
        sceneRef.current = scene;
        area = mod.BASE_AREA;
        scene.resize(canvas.current!.clientWidth, canvas.current!.clientHeight);
        const floorScale = mod.floorScale;
        const set = (k: string, v: string) => { const n = out.current[k]; if (n && n.textContent !== v) n.textContent = v; };
        stop = onFrame((y, dt, now) => {
          const vh = innerHeight;
          const p = clamp((y - geo.top) / Math.max(1, geo.height - vh));
          if (y + vh < geo.top - vh * .5 || y > geo.top + geo.height + vh * .5) return;
          const r = scene!.setCut(clamp((p - .06) / .88));
          const k = r.floor;
          set("fl", String(k + 1).padStart(2, "0"));
          const use = UI.uses.find((u) => k + 1 <= u.upTo) ?? UI.uses[UI.uses.length - 1];
          set("use", use.name[langRef.current]);
          set("area", `${Math.round(area * floorScale(k) ** 2).toLocaleString("en-US")} m²`);
          set("rot", `${(P.TWIST * k).toFixed(1)}°`);
          set("el", `+${(P.PL + k * P.FH).toFixed(1)} m`);
          const solved = Math.round(TOTAL_CLASHES * r.resolved);
          set("clash", solved.toLocaleString("en-US"));
          bar.current?.style.setProperty("--p", r.resolved.toFixed(4));
          scene!.render(dt, now, !reducedMotion());
        });
      } catch {
        setFailed(true);
      }
    }, { rootMargin: "80% 0px" });
    io.observe(el);
    return () => { cancelled = true; io.disconnect(); ro.disconnect(); stop(); scene?.dispose(); sceneRef.current = null; };
  }, []);

  useEffect(() => {
    const s = sceneRef.current; if (!s) return;
    (Object.keys(layers) as (keyof typeof layers)[]).forEach((k) => s.setLayer(k, layers[k]));
  }, [layers]);

  // 드래그(포인터)와 키보드 회전
  useEffect(() => {
    const cv = canvas.current!;
    let lastX = 0, down = false;
    const onDown = (e: PointerEvent) => { down = true; lastX = e.clientX; cv.setPointerCapture(e.pointerId); setDragging(true); };
    const onMove = (e: PointerEvent) => { if (!down) return; sceneRef.current?.drag(e.clientX - lastX); lastX = e.clientX; };
    const onUp = () => { down = false; setDragging(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "ArrowLeft") sceneRef.current?.drag(-60); if (e.key === "ArrowRight") sceneRef.current?.drag(60); };
    cv.addEventListener("pointerdown", onDown); cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp); cv.addEventListener("pointercancel", onUp); cv.addEventListener("keydown", onKey);
    return () => {
      cv.removeEventListener("pointerdown", onDown); cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp); cv.removeEventListener("pointercancel", onUp); cv.removeEventListener("keydown", onKey);
    };
  }, []);

  const toggle = (k: keyof typeof layers) => setLayers((l) => ({ ...l, [k]: !l[k] }));

  return (
    <section id="twin" className="twin" ref={section} aria-label={t(UI.twin.kicker)}>
      <div className="twin__stage">
        <canvas ref={canvas} className="twin__canvas" data-dragging={dragging || undefined} tabIndex={0}
          aria-label={lang === "ko" ? "타워의 3D 선 모델. 좌우 방향키나 드래그로 돌릴 수 있습니다." : "3D line model of the tower. Rotate with drag or the arrow keys."} />
        {failed && <div className="twin__fallback"><img src="/film/poster/a5.jpg" alt="" /><p>{t(UI.twin.fallback)}</p></div>}
        <div className="twin__copy">
          <p className="kicker">{t(UI.twin.kicker)}</p>
          <h2 className="title"><Lines text={t(UI.twin.title)} /></h2>
          <p className="body">{t(UI.twin.body)}</p>
          <div className="twin__layers" role="group" aria-label={t(UI.twin.layers)}>
            {(["structure", "envelope", "services"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={layers[k]} onClick={() => toggle(k)} data-layer={k}>
                <i aria-hidden="true" />{t(UI.twin[k])}
              </button>
            ))}
          </div>
        </div>
        <aside className="twin__panel" aria-live="off">
          <div className="twin__floor"><span>FL</span><b ref={(n) => { out.current.fl = n; }}>48</b></div>
          <dl>
            <div><dt>{t(UI.twin.use)}</dt><dd ref={(n) => { out.current.use = n; }}>—</dd></div>
            <div><dt>{t(UI.twin.area)}</dt><dd ref={(n) => { out.current.area = n; }}>—</dd></div>
            <div><dt>{t(UI.twin.rotation)}</dt><dd ref={(n) => { out.current.rot = n; }}>—</dd></div>
            <div><dt>{t(UI.twin.elevation)}</dt><dd ref={(n) => { out.current.el = n; }}>—</dd></div>
          </dl>
          <div className="twin__clash">
            <p>{t(UI.twin.clashes)}</p>
            <p className="twin__clash-count"><b ref={(n) => { out.current.clash = n; }}>0</b><span>/ {TOTAL_CLASHES.toLocaleString("en-US")}</span></p>
            <span className="twin__bar" ref={bar} aria-hidden="true" />
          </div>
        </aside>
        <p className="twin__hint" aria-hidden="true">{t(UI.twin.drag)}</p>
      </div>
    </section>
  );
}
