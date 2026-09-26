import { useEffect, useRef, useState, type MutableRefObject } from "react";
import track from "./track.json";
import tower from "../twin/tower.json";
import { FrameStore, type Progress } from "./frames";
import { CHAPTERS, MEASURE, UI } from "../copy";
import { Lines, useI18n } from "../lib/i18n";
import { clamp, measure, onFrame, reducedMotion, scrollToY, smooth } from "../lib/scroll";

/*
 * 선에서 빛까지 — Blender로 렌더한 681 프레임을 스크롤로 훑는다.
 * 각 장(정지 지점)마다 머무는 구간(HOLD)을 두어 글을 읽는 동안 화면이 멈춰 있고,
 * 그 사이를 이동하는 구간에서만 영상이 흐른다. 라벨은 Blender가 내보낸 3D 점의 화면 좌표를 따른다.
 */
const ANCH: number[] = track.anchors;
const TOTAL: number = track.frames;
const FW: number = track.width, FH: number = track.height;
type LabelTrack = Record<string, [number, number, number][]>;
const LAB = track.labels as unknown as LabelTrack;
const DAY = [0, 14, 126, 214, 322, 468, 506, 540];

export type FilmApi = { lineOnScreen: () => { a: [number, number]; b: [number, number] } | null };

/*
 * 스크롤 → 프레임. 영상은 장과 장 사이를 멈추지 않고 지나가도록 렌더했다.
 * 장마다 "느린 구간"(SLOW 프레임을 SLOW_LEN 화면 높이에 걸쳐)을 두어 글을 읽는 동안에도
 * 스크롤하는 만큼 화면이 천천히 움직인다. 구간 경계는 단조 3차 곡선으로 이어 속도가 튀지 않는다.
 */
const TRAVEL = [.74, .64, .86, .82, .7, .66, .68];
const SLOW = 8;          // 장 프레임 앞뒤로 느리게 지나가는 프레임 수

type Plan = { knots: [number, number][]; zones: [number, number][]; total: number };

function plan(mobile: boolean): Plan {
  const k = mobile ? .85 : 1;
  const slowLen = (mobile ? .3 : .38);
  const knots: [number, number][] = [];
  const zones: [number, number][] = [];
  let at = 0;
  for (let i = 0; i < ANCH.length; i++) {
    const first = i === 0, last = i === ANCH.length - 1;
    const len = first ? .22 : last ? .7 : slowLen;
    const f0 = first ? 0 : ANCH[i] - SLOW, f1 = last ? ANCH[i] : ANCH[i] + SLOW;
    if (!first) knots.push([at, f0]);
    zones.push([at, at + len]);
    at += len;
    knots.push([at, f1]);
    if (!last) at += TRAVEL[i] * k;
  }
  knots.unshift([0, 0]);
  return { knots, zones, total: at };
}

/** 단조 3차 보간(Fritsch–Carlson). 프레임이 되돌아가지 않고 속도가 부드럽게 바뀐다. */
function monotone(pts: [number, number][], x: number) {
  const n = pts.length;
  if (x <= pts[0][0]) return pts[0][1];
  if (x >= pts[n - 1][0]) return pts[n - 1][1];
  const d = pts.slice(0, -1).map((p, i) => (pts[i + 1][1] - p[1]) / Math.max(1e-9, pts[i + 1][0] - p[0]));
  const m = pts.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  let i = 0;
  while (i < n - 2 && x > pts[i + 1][0]) i++;
  const h = pts[i + 1][0] - pts[i][0], t = (x - pts[i][0]) / h, t2 = t * t, t3 = t2 * t;
  return pts[i][1] * (2 * t3 - 3 * t2 + 1) + m[i] * h * (t3 - 2 * t2 + t) + pts[i + 1][1] * (-2 * t3 + 3 * t2) + m[i + 1] * h * (t3 - t2);
}

function mapScroll(p: Plan, s: number) {
  s = clamp(s, 0, p.total);
  const frame = clamp(monotone(p.knots, s), 0, TOTAL - 1);
  // 글의 장 번호: 느린 구간 안에서는 그 장, 사이에서는 선형으로 다음 장까지
  let chap = ANCH.length - 1;
  for (let i = 0; i < p.zones.length; i++) {
    const [a, b] = p.zones[i];
    if (s <= b) { chap = s >= a ? i : i - 1 + (s - p.zones[i - 1][1]) / (a - p.zones[i - 1][1]); break; }
  }
  return { frame, chap };
}

function chapterStart(p: Plan, k: number) {
  const [a, b] = p.zones[k];
  return k === 0 ? 0 : a + (b - a) * .45;
}

const pad = (n: number, w: number) => String(Math.max(0, Math.round(n))).padStart(w, "0");
const interp = (xs: number[], ys: number[], x: number) => {
  if (x <= xs[0]) return ys[0];
  for (let i = 0; i < xs.length - 1; i++) if (x <= xs[i + 1]) return ys[i] + (ys[i + 1] - ys[i]) * (x - xs[i]) / (xs[i + 1] - xs[i]);
  return ys[ys.length - 1];
};

export default function FilmSection({ onProgress, api, ready }: { onProgress: (p: Progress & { failed?: boolean }) => void; api: MutableRefObject<FilmApi | null>; ready: boolean }) {
  const { t, lang } = useI18n();
  const langRef = useRef(lang); langRef.current = lang;
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const chapters = useRef<(HTMLElement | null)[]>([]);
  const tags = useRef<Record<string, HTMLDivElement | null>>({});
  const hud = useRef<Record<string, HTMLElement | null>>({});
  const ruler = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLOListElement>(null);
  const hint = useRef<HTMLDivElement>(null);
  const fade = useRef<HTMLDivElement>(null);
  const cross = useRef<HTMLDivElement>(null);
  const measureSvg = useRef<SVGSVGElement>(null);
  const measureTag = useRef<HTMLDivElement>(null);
  const posterRefs = useRef<(HTMLImageElement | null)[]>([]);
  const [mobile, setMobile] = useState(() => window.innerWidth < 760);
  const [lengthVh, setLengthVh] = useState(() => plan(window.innerWidth < 760).total);
  const [still, setStill] = useState(() => reducedMotion());
  const planRef = useRef<Plan>(plan(mobile));
  const goRef = useRef<(k: number) => void>(() => {});

  useEffect(() => {
    const onResize = () => {
      const m = window.innerWidth < 760;
      setMobile(m);
      planRef.current = plan(m);
      setLengthVh(planRef.current.total);
    };
    addEventListener("resize", onResize);
    return () => removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const el = section.current!, cv = canvas.current!;
    const ctx = cv.getContext("2d", { alpha: false })!;
    const wide = Math.min(2, window.devicePixelRatio || 1) * window.innerWidth > 1500;
    const dir = wide ? "1920" : "1280";
    const store = new FrameStore(TOTAL, `/film/${dir}/`);
    const poster = new Image(); poster.src = "/film/poster/a0.jpg";
    let failed = false;
    let geo = measure(el), vw = innerWidth, vh = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
    let lastFrame = -1, lastDrawn = -1, lastDir = 1, focusX = FW * .5, needDraw = true;
    let cover = { s: 1, ox: 0, oy: 0 };
    let zoom = 1;   // 마지막 장: 영상이 끝에서 멈추는 동안에도 스크롤을 따라 천천히 다가간다
    const sizeCanvas = () => {
      vw = innerWidth; vh = innerHeight; dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
      geo = measure(el); needDraw = true;
    };
    sizeCanvas();
    const ro = new ResizeObserver(() => { geo = measure(el); });
    ro.observe(document.body);
    addEventListener("resize", sizeCanvas);

    store.onDecoded = () => { needDraw = true; };
    store.load((p) => onProgress(p)).catch(() => { failed = true; setStill(true); onProgress({ loaded: 0, total: TOTAL, firstPass: true, failed: true }); });

    const computeCover = (frame: number) => {
      const s = Math.max(vw / FW, vh / FH);
      const dw = FW * s, dh = FH * s;
      let ox: number;
      if (vw / vh < 1.1) {
        // 세로 화면: 타워(없으면 측량기)가 화면 가운데 오도록 따라간다.
        const id = frame < ANCH[2] ? "instrument" : "tower";
        const pt = LAB[id][Math.round(frame)];
        const target = frame > ANCH[6] + 20 ? FW * .5 : pt[0];
        focusX += (target - focusX) * .08;
        ox = clamp(vw * .5 - focusX * s, vw - dw, 0);
      } else {
        ox = (vw - dw) * .82;
      }
      const oy = (vh - dh) / 2;
      if (zoom !== 1) {
        // 화면 속 한 점(타워와 강 사이)을 고정한 채 확대: 라벨과 측선도 같은 변환을 쓴다
        const fx = FW * .66, fy = FH * .46, X = ox + fx * s, Y = oy + fy * s, z = s * zoom;
        cover = { s: z, ox: X - fx * z, oy: Y - fy * z };
      } else cover = { s, ox, oy };
    };
    const toScreen = (x: number, y: number) => [cover.ox + x * cover.s, cover.oy + y * cover.s] as [number, number];

    api.current = {
      lineOnScreen: () => {
        computeCover(0);
        const a = LAB.lineA[0], b = LAB.lineB[0];
        return { a: toScreen(a[0], a[1]), b: toScreen(b[0], b[1]) };
      },
    };

    const draw = (frame: number) => {
      const got = failed ? null : store.get(frame, lastDir);
      const src: CanvasImageSource | null = got ? got.bmp : poster.complete && poster.naturalWidth ? poster : null;
      if (!src) return;
      const iw = got ? got.bmp.width : poster.naturalWidth, ih = got ? got.bmp.height : poster.naturalHeight;
      const k = iw / FW;
      ctx.drawImage(src, 0, 0, iw, ih, cover.ox * dpr, cover.oy * dpr, FW * cover.s * dpr, (ih / k) * cover.s * dpr);
      lastDrawn = got ? got.index : -1;
    };

    const hudSet = (key: string, v: string) => { const n = hud.current[key]; if (n && n.textContent !== v) n.textContent = v; };
    const railItems = () => Array.from(rail.current?.querySelectorAll("li") ?? []);

    goRef.current = (k: number) => {
      scrollToY(geo.top + chapterStart(planRef.current, k) * vh, { duration: 1.2 + Math.abs(k - Math.round(lastChap)) * .5 });
    };
    let lastChap = 0;
    // ?debug: 스크롤이 원하는 프레임과 실제 그린 프레임이 어긋난 비율을 잰다
    const dbg = location.search.includes("debug") ? ((window as unknown as { __film: { ticks: number; miss: number; lag: number } }).__film = { ticks: 0, miss: 0, lag: 0 }) : null;

    const off = onFrame((y) => {
      const local = (y - geo.top) / vh;
      if (local < -1.2 || local > planRef.current.total + 1.2) return;
      const { frame, chap } = mapScroll(planRef.current, local);
      const lastZone = planRef.current.zones[ANCH.length - 1];
      const nz = 1 + .065 * smooth((local - lastZone[0]) / (planRef.current.total + .8 - lastZone[0]));
      if (Math.abs(nz - zoom) > 1e-5) { zoom = nz; needDraw = true; }
      lastChap = chap;
      const f = Math.round(frame);
      if (f !== lastFrame) { lastDir = f > lastFrame ? 1 : -1; lastFrame = f; store.prioritize(f); needDraw = true; }
      computeCover(frame);
      if (needDraw || lastDrawn !== f) { draw(frame); needDraw = false; }
      if (dbg) { dbg.ticks++; if (lastDrawn !== f) { dbg.miss++; dbg.lag += Math.abs(lastDrawn - f); } }

      // 장 글: 머무는 구간에서 보이고, 이동 구간의 앞뒤 22%에서 흐려진다
      chapters.current.forEach((node, i) => {
        if (!node) return;
        const d = chap - i;
        const o = clamp(1 - (Math.abs(d)) / .22);
        node.style.opacity = o.toFixed(3);
        node.style.visibility = o > 0.001 ? "visible" : "hidden";
        node.style.transform = `translate3d(0, ${(-d * 70).toFixed(1)}px, 0)`;
        node.toggleAttribute("inert", o < .5);
      });
      posterRefs.current.forEach((img, i) => { if (img) img.style.opacity = clamp(1 - Math.abs(chap - i) / .5).toFixed(3); });

      // 라벨
      CHAPTERS.forEach((ch, i) => {
        const w = clamp(1 - (Math.abs(chap - i) - .02) / .16);
        ch.labels.forEach((lb) => {
          const node = tags.current[`${i}:${lb.id}`];
          if (!node) return;
          const pt = LAB[lb.id]?.[f];
          const vis = pt && pt[2] ? w : 0;
          node.style.opacity = vis.toFixed(3);
          node.style.visibility = vis > 0.001 ? "visible" : "hidden";
          if (vis > 0) {
            const [sx, sy] = toScreen(pt[0], pt[1]);
            const flip = lb.side ? lb.side === "left" : sx > vw * .72;
            node.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)`;
            node.toggleAttribute("data-flip", flip);
            node.style.setProperty("--draw", smooth(vis).toFixed(3));
            const val = node.querySelector<HTMLElement>(".tag__value");
            if (val) {
              const txt = lb.value[langRef.current].replace("{fl}", pad(track.floors[f], 2)).replace("{skin}", pad(track.skin[f], 2)).replace("{el}", (tower.PL + track.floors[f] * tower.FH).toFixed(1));
              if (val.textContent !== txt) val.textContent = txt;
            }
          }
        });
      });

      // 마지막 장의 측선: 타워에서 다리까지 점선이 그어지고 가운데에 거리가 붙는다
      const mw = clamp(1 - (Math.abs(chap - (ANCH.length - 1)) - .02) / .2);
      const ma = LAB[MEASURE.from]?.[f], mb = LAB[MEASURE.to]?.[f];
      if (measureSvg.current && measureTag.current && ma && mb) {
        const [x1, y1] = toScreen(ma[0], ma[1]), [x2, y2] = toScreen(mb[0], mb[1]);
        const ln = measureSvg.current.querySelector("line")!;
        ln.setAttribute("x1", x1.toFixed(1)); ln.setAttribute("y1", y1.toFixed(1));
        ln.setAttribute("x2", x2.toFixed(1)); ln.setAttribute("y2", y2.toFixed(1));
        const dots = measureSvg.current.querySelectorAll("circle");
        dots[0].setAttribute("cx", x1.toFixed(1)); dots[0].setAttribute("cy", y1.toFixed(1));
        dots[1].setAttribute("cx", x2.toFixed(1)); dots[1].setAttribute("cy", y2.toFixed(1));
        measureSvg.current.style.opacity = mw.toFixed(3);
        measureSvg.current.style.setProperty("--draw", smooth(mw).toFixed(3));
        measureTag.current.style.opacity = clamp((mw - .5) * 2).toFixed(3);
        measureTag.current.style.transform = `translate3d(${((x1 + x2) / 2).toFixed(1)}px, ${((y1 + y2) / 2).toFixed(1)}px, 0)`;
      }

      // 계기판
      const fl = track.floors[f], sk = track.skin[f];
      const el = fl > 0 ? tower.PL + fl * tower.FH : 0;
      hudSet("day", `D+${pad(interp(ANCH, DAY, frame), 3)}`);
      hudSet("frame", `${pad(fl, 2)} / 48`);
      hudSet("skin", `${pad(sk, 2)} / 48`);
      hudSet("el", `${el >= 0 ? "+" : ""}${el.toFixed(1).padStart(5, "0")} m`);
      if (ruler.current) {
        ruler.current.style.setProperty("--frame", (el / 230).toFixed(4));
        ruler.current.style.setProperty("--skin", ((sk > 0 ? tower.PL + sk * tower.FH : 0) / 230).toFixed(4));
        ruler.current.style.opacity = (clamp((chap - 1.4) / .5) * clamp((6.6 - chap) / .5)).toFixed(3);
      }
      const k = Math.round(chap);
      railItems().forEach((li, i) => li.toggleAttribute("data-on", i === k));
      rail.current?.style.setProperty("--fill", (chap / (ANCH.length - 1)).toFixed(4));
      if (hint.current) hint.current.style.opacity = clamp(1 - local * 3).toFixed(3);
      // 마지막 장면은 떠나면서 먹빛으로 가라앉아 다음 구간(원칙)과 이어진다
      if (fade.current) fade.current.style.opacity = smooth((local - (planRef.current.total - .1)) / .75).toFixed(3);
    });

    // 발표할 때: 영상 구간 안에서 ←/→로 이전·다음 장
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey) return;
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || document.querySelector("dialog[open]")) return;
      const local = (scrollY - geo.top) / vh;
      if (local < -.3 || local > planRef.current.total) return;
      if (e.key === "ArrowRight") { e.preventDefault(); goRef.current(Math.min(ANCH.length - 1, Math.floor(lastChap + .02) + 1)); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goRef.current(Math.max(0, Math.ceil(lastChap - .02) - 1)); }
    };
    addEventListener("keydown", onKey);
    // 측량 십자선: 영상 위에서 포인터가 가리키는 대지 좌표(연출)
    const stage = el.querySelector<HTMLElement>(".film__stage")!;
    const fine = matchMedia("(pointer: fine)").matches;
    let idle = 0;
    const onMove = (e: PointerEvent) => {
      const c = cross.current; if (!c || !fine) return;
      const x = (e.clientX - cover.ox) / cover.s, y = (e.clientY - cover.oy) / cover.s;
      c.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      c.style.opacity = "1";
      const n = c.querySelector("b"); if (n) n.textContent = `X ${String(Math.round(x)).padStart(4, "0")} · Y ${String(Math.round(y)).padStart(4, "0")} · F ${String(lastFrame).padStart(3, "0")}`;
      clearTimeout(idle); idle = window.setTimeout(() => { c.style.opacity = "0"; }, 1600);
    };
    const onLeave = () => { if (cross.current) cross.current.style.opacity = "0"; };
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerleave", onLeave);

    return () => {
      off(); ro.disconnect(); removeEventListener("resize", sizeCanvas); removeEventListener("keydown", onKey);
      stage.removeEventListener("pointermove", onMove); stage.removeEventListener("pointerleave", onLeave); clearTimeout(idle);
      store.dispose(); api.current = null;
    };
  }, []);

  return (
    <section id="build" className="film" ref={section} data-ready={ready || undefined} style={{ height: `calc(${(lengthVh + 1).toFixed(3)} * 100vh)` }} aria-label={t(UI.nav.build)}>
      <div className="film__stage">
        <canvas ref={canvas} className="film__canvas" data-hidden={still || undefined} aria-hidden="true" />
        {still && <div className="film__posters" aria-hidden="true">
          {ANCH.map((_, i) => <img key={i} ref={(n) => { posterRefs.current[i] = n; }} src={`/film/poster/a${i}.jpg`} alt="" />)}
        </div>}
        <div className="film__scrim" aria-hidden="true" />
        <div className="film__fade" ref={fade} aria-hidden="true" />
        <div className="cross" ref={cross} aria-hidden="true"><i /><b /></div>

        <svg className="measure" ref={measureSvg} aria-hidden="true">
          <line pathLength={1} /><circle r="3.5" /><circle r="3.5" />
        </svg>
        <div className="measure__tag" ref={measureTag} aria-hidden="true"><span>{t(MEASURE.name)}</span><b>{MEASURE.value}</b></div>
        <div className="film__tags" aria-hidden="true">
          {CHAPTERS.map((ch, i) => ch.labels.map((lb) => (
            <div key={`${i}:${lb.id}`} ref={(n) => { tags.current[`${i}:${lb.id}`] = n; }} className="tag" data-tone={lb.tone || "line"}>
              <i className="tag__dot" />
              <svg className="tag__lead" viewBox="0 0 84 52" preserveAspectRatio="none"><polyline points="0,52 40,12 84,12" pathLength="1" /></svg>
              <div className="tag__text"><span className="tag__name">{t(lb.name)}</span><span className="tag__value">{t(lb.value)}</span></div>
            </div>
          )))}
        </div>

        <div className="film__chapters">
          {CHAPTERS.map((ch, i) => (
            <article key={ch.key} ref={(n) => { chapters.current[i] = n; }} className={`chapter chapter--${ch.key}`}>
              <p className="chapter__kicker">{t(ch.kicker)}</p>
              {i === 0 ? <h1 className="chapter__title"><Lines text={t(ch.title)} /></h1> : <h2 className="chapter__title"><Lines text={t(ch.title)} /></h2>}
              <p className="chapter__body">{t(ch.body)}</p>
              {ch.specs.length > 0 && <dl className="chapter__specs">
                {ch.specs.map(([k, v]) => <div key={k.ko}><dt>{t(k)}</dt><dd>{t(v)}</dd></div>)}
              </dl>}
            </article>
          ))}
        </div>

        <aside className="hud" aria-label={lang === "ko" ? "공정 계기판" : "Construction readout"}>
          <div><span>{t(UI.film.day)}</span><b ref={(n) => { hud.current.day = n; }}>D+000</b></div>
          <div><span>{t(UI.film.frame)}</span><b ref={(n) => { hud.current.frame = n; }}>00 / 48</b></div>
          <div><span>{t(UI.film.skin)}</span><b ref={(n) => { hud.current.skin = n; }} data-tone="lit">00 / 48</b></div>
          <div><span>{t(UI.film.el)}</span><b ref={(n) => { hud.current.el = n; }}>+000.0 m</b></div>
        </aside>

        <div className="ruler" ref={ruler} aria-hidden="true">
          <span className="ruler__title">{t(UI.film.ruler)}</span>
          <div className="ruler__track">
            {Array.from({ length: 24 }, (_, i) => <i key={i} style={{ bottom: `${(i * 10 / 230) * 100}%` }} data-major={i % 5 === 0 || undefined}>{i % 5 === 0 ? <em>{i * 10}</em> : null}</i>)}
            <b className="ruler__mark ruler__mark--skin" />
            <b className="ruler__mark ruler__mark--frame" />
          </div>
        </div>

        <ol className="rail" ref={rail} aria-label={lang === "ko" ? "공정 단계" : "Construction stages"}>
          {CHAPTERS.map((ch, i) => (
            <li key={ch.key}>
              <button type="button" onClick={() => goRef.current(i)}>
                <span className="rail__no">{String(i).padStart(2, "0")}</span>
                <span className="rail__name">{t(ch.rail)}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="film__hint" ref={hint} aria-hidden="true"><span className="film__hint-line" />{t(UI.film.scroll)}</div>
        <a className="film__skip" href="#manifesto">{t(UI.film.skip)}</a>
      </div>
    </section>
  );
}
