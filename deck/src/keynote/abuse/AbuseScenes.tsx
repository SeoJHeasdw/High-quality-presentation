import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Frame } from "../KeynoteFrame";
import { MediaInspection } from "../AbuseInteractive";
import { usePerformanceMotion } from "../usePerformanceMotion";
import "./abuse-v2.css";

/* 34·37번의 캔버스 장면. 점과 사진 칸은 도식이며 사람 수·공유 수 같은 데이터가 아니다. */
const rand = (seed: number) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

function useCanvasLoop(draw: (g: CanvasRenderingContext2D, t: number) => void, deps: unknown[], motion: boolean) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!, g = c.getContext("2d")!;
    let raf = 0; const start = performance.now();
    const frame = () => { g.clearRect(0, 0, c.width, c.height); draw(g, motion ? (performance.now() - start) / 1000 : 1e3); if (motion) raf = requestAnimationFrame(frame); };
    frame();
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, motion]);
  return ref;
}

/* 30 · 벽 너머의 사람들 ---------------------------------------------------
 * 사람과 벽을 같은 원근(눈높이 1.6m, 초점 900px)으로 그린다. 먼 것부터 그려 벽이 뒤의 사람을 가린다.
 * 벽이 무너지면 사람들이 이쪽으로 걸어 나온다. 점과 벽은 도식이다. */
type Person = { x: number; z: number; red: boolean; s: number; phase: number };
const PEOPLE: Person[] = (() => { const r = rand(19), out: Person[] = []; for (let i = 0; i < 2600; i++) out.push({ x: (r() - .5) * 30, z: 11 + r() * 55, red: r() < .04, s: .88 + r() * .24, phase: r() * 6.28 }); return out; })();
const WALLS = ["생성", "확인", "수정", "연결"];
const WALL_Z = 8.5, WALL_W = 2.35, WALL_H = 2.7, WALL_X0 = -4.9;
const NEAR = 4.2; // 사람들이 다가오는 가장 가까운 거리. 더 가까이 오면 먼 곳에서 다시 나타난다.

function ThresholdCanvas({ open }: { open: boolean }) {
  const motion = usePerformanceMotion();
  const openAt = useRef(open ? -1e3 : Infinity);
  useEffect(() => { openAt.current = open ? performance.now() / 1000 : Infinity; }, [open]);
  const ref = useCanvasLoop((g, t) => {
    const cx = 1240, horizon = 500, f = 760, eye = 1.55;
    const now = performance.now() / 1000, since = motion ? now - openAt.current : open ? 1e3 : -1;
    const P = (x: number, y: number, z: number) => [cx + x / z * f, horizon + (eye - y) / z * f];
    // 지평선의 붉은 빛: 사람들은 그 앞의 검은 윤곽이 된다
    const glow = g.createRadialGradient(cx, horizon, 20, cx, horizon, 1100); glow.addColorStop(0, "rgba(120,26,24,.55)"); glow.addColorStop(.35, "rgba(60,12,12,.35)"); glow.addColorStop(1, "rgba(3,2,3,0)");
    g.fillStyle = glow; g.fillRect(0, 0, 1920, 1080);
    const band = g.createLinearGradient(0, horizon - 180, 0, horizon + 60); band.addColorStop(0, "rgba(90,20,20,0)"); band.addColorStop(.75, "rgba(150,34,30,.28)"); band.addColorStop(1, "rgba(90,20,20,0)");
    g.fillStyle = band; g.fillRect(0, horizon - 180, 1920, 240);
    type Item = { z: number; draw: () => void };
    const items: Item[] = [];
    WALLS.forEach((label, i) => {
      const fall = open ? Math.max(0, Math.min(1, (since - .15 - i * .2) / .8)) : 0, e = fall * fall;
      if (e >= 1) return;
      items.push({ z: WALL_Z, draw: () => {
        const xa = WALL_X0 + i * (WALL_W + .12), [x0, yb] = P(xa, 0, WALL_Z), [x1] = P(xa + WALL_W, 0, WALL_Z), [, yt] = P(0, WALL_H * (1 - e), WALL_Z);
        g.save(); g.globalAlpha = 1 - e;
        const grd = g.createLinearGradient(0, yt, 0, yb); grd.addColorStop(0, "rgba(44,10,12,.9)"); grd.addColorStop(1, "rgba(18,4,5,.96)");
        g.fillStyle = grd; g.fillRect(x0, yt, x1 - x0, yb - yt);
        g.strokeStyle = "rgba(255,110,100,.6)"; g.lineWidth = 1.5; g.strokeRect(x0 + .5, yt + .5, x1 - x0 - 1, yb - yt - 1);
        g.fillStyle = "rgba(255,120,110,.05)"; for (let y = yt + 10; y < yb; y += 10) g.fillRect(x0, y, x1 - x0, 1);
        if (e < .5) { g.fillStyle = "rgba(255,214,208,.95)"; g.font = `640 36px "Pretendard Variable", sans-serif`; g.textBaseline = "top"; g.fillText(label, x0 + 18, yt + 16); }
        g.restore();
      } });
    });
    for (const p of PEOPLE) {
      let z = p.z;
      if (open && since > .4) { z = p.z - (since - .4) * (2.4 + p.s * 1.3); while (z < NEAR) z += 58; }
      const [sx, sy] = P(p.x, 0, z);
      if (sx < -120 || sx > 2040) continue;
      items.push({ z, draw: () => {
        const hpx = 1.72 * p.s / z * f, bob = open ? Math.abs(Math.sin(t * 5.5 + p.phase)) * hpx * .02 : 0;
        const fog = Math.max(0, Math.min(1, (z - NEAR) / 55));
        const head = hpx * .12, top = sy - hpx - bob, shoulder = hpx * .2;
        if (p.red) g.fillStyle = `rgba(255,${62 + fog * 40},${54 + fog * 40},${.95 - fog * .45})`;
        else { const c = Math.round(6 + fog * 70); g.fillStyle = `rgba(${c + 8},${Math.round(c * .5)},${Math.round(c * .5)},${.97 - fog * .35})`; }
        g.beginPath(); g.ellipse(sx, top + head, head * .8, head, 0, 0, 6.283); g.fill();
        g.beginPath(); g.moveTo(sx - shoulder, top + head * 2.45); g.quadraticCurveTo(sx, top + head * 1.9, sx + shoulder, top + head * 2.45);
        g.lineTo(sx + shoulder * .72, sy); g.lineTo(sx - shoulder * .72, sy); g.closePath(); g.fill();
      } });
    }
    items.sort((a, b) => b.z - a.z).forEach((it) => it.draw());
  }, [open], motion);
  return <canvas ref={ref} className="th-crowd" width={1920} height={1080} aria-hidden="true"/>;
}

function ThresholdAudio({ active }: { active: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const autoStart = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const play = () => {
    const el = audio.current; if (!el) return;
    if (el.ended) el.currentTime = 0;
    void el.play().then(() => setBlocked(false)).catch(() => { if (el.paused) setBlocked(true); });
  };
  const toggle = () => {
    if (autoStart.current !== null) { window.clearTimeout(autoStart.current); autoStart.current = null; }
    const el = audio.current; if (!el) return;
    if (el.paused) play(); else el.pause();
  };
  const toggleSound = () => {
    const el = audio.current; if (!el) return;
    el.muted = !el.muted; setMuted(el.muted);
  };
  useEffect(() => {
    const el = audio.current; if (!el) return;
    el.pause(); el.currentTime = 0;
    if (!active) return;
    autoStart.current = window.setTimeout(() => { autoStart.current = null; play(); }, 450);
    return () => { if (autoStart.current !== null) window.clearTimeout(autoStart.current); autoStart.current = null; el.pause(); };
  }, [active]);
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.toLowerCase() === "p") { e.preventDefault(); toggle(); }
      if (e.key.toLowerCase() === "a") { e.preventDefault(); toggleSound(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);
  return <div className="th-sound" data-active={active || undefined}>
    <audio ref={audio} src="/abuse/audio/threshold-voices.m4a?v=scene-30-1" preload="auto" muted={muted}
      onPlay={() => { setPlaying(true); setBlocked(false); }} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}/>
    {active && <><span>가상 음성 연출</span><button type="button" onClick={toggle}>{blocked ? "소리 재생하기" : playing ? "일시정지" : "다시 듣기"} <kbd>P</kbd></button>
      <button type="button" onClick={toggleSound}>{muted ? "소리 켜기" : "소리 끄기"} <kbd>A</kbd></button></>}
  </div>;
}

export function ThresholdScene({ step }: { step: number }) {
  return <Frame n={34} name="그 수고가 줄어든다면" step={step} className="abuse-slide abuse-v2 abuse-threshold-v2">
    <div className="abuse-content">
      <div className="th" data-open={step >= 1 || undefined} aria-label={step ? "제가 메우던 수고가 사라지고 더 많은 사람이 들어오는 도식" : "생성, 확인, 수정, 연결에 손이 드는 지금"}>
        <ThresholdCanvas open={step >= 1}/>
        <div className="th-shade"/>
        <span className="th-caption">제가 메우던 수고</span>
      </div>
      <div className="av-copy">
        <p className="av-eyebrow">개인적인 전망</p>
        <h1>다음 모델이<br/><em>더 잘해준다면</em></h1>
      </div>
      <div className="th-after" data-on={step >= 1 || undefined}>
        <span>더 적은 수고로</span><strong>더 많은 사람이</strong>
        <p>“이 정도면 엔지니어가 아니어도<br/>해볼 수 있겠는데?”</p>
      </div>
      <ThresholdAudio active={step >= 1}/>
      <p className="av-note"><span>Qwen 4·5는 ‘더 발전한 다음 모델’을 가정한 이름입니다 · 사람과 벽은 도식</span></p>
    </div>
  </Frame>;
}

/* 33 · 지워도 남는 사본 ---------------------------------------------------- */
function portrait(seed: number) {
  const c = document.createElement("canvas"); c.width = 160; c.height = 210;
  const g = c.getContext("2d")!, r = rand(seed);
  const bg = g.createLinearGradient(0, 0, 0, 210); bg.addColorStop(0, `hsl(${200 + r() * 40} 14% ${20 + r() * 10}%)`); bg.addColorStop(1, "#0b0d10"); g.fillStyle = bg; g.fillRect(0, 0, 160, 210);
  g.filter = "blur(3px)";
  const cloth = `hsl(${r() * 360} ${18 + r() * 20}% ${22 + r() * 16}%)`, skin = `hsl(${18 + r() * 10} ${28 + r() * 16}% ${52 + r() * 12}%)`;
  g.fillStyle = cloth; g.beginPath(); g.ellipse(80, 206, 74, 60, 0, 0, 6.283); g.fill();
  g.fillStyle = skin; g.fillRect(68, 118, 24, 34);
  const face = g.createRadialGradient(72, 76, 6, 80, 84, 44); face.addColorStop(0, skin); face.addColorStop(1, `hsl(20 20% ${24 + r() * 8}%)`);
  g.fillStyle = face; g.beginPath(); g.ellipse(80, 84, 31, 40, 0, 0, 6.283); g.fill();
  g.fillStyle = `hsl(25 20% ${8 + r() * 10}%)`; g.beginPath(); g.ellipse(80, 58, 36, 26 + r() * 10, 0, Math.PI, 0); g.fill();
  g.fillStyle = "#00000055"; g.fillRect(62, 78, 36, 8);
  g.filter = "none";
  // 모자이크: 누구인지 알아볼 수 없게
  const s = document.createElement("canvas"); s.width = 22; s.height = 29; const sg = s.getContext("2d")!; sg.drawImage(c, 0, 0, 22, 29);
  g.imageSmoothingEnabled = false; g.drawImage(s, 0, 0, 160, 210);
  g.fillStyle = "#00000088"; g.fillRect(0, 176, 160, 34);
  g.fillStyle = "#ffffffaa"; g.fillRect(10, 188, 58, 5); g.fillStyle = "#ffffff55"; g.fillRect(10, 198, 36, 4);
  g.fillStyle = "#ff5a52"; g.beginPath(); g.arc(144, 192, 5, 0, 6.283); g.fill();
  return c;
}

type Tile = { x: number; y: number; rot: number; img: number; at: number; s: number };
const TILES: Tile[] = (() => {
  const r = rand(33), out: Tile[] = [];
  const cols = 15, rows = 8, cx = 7, cy = 3.6;
  const cells: { x: number; y: number; d: number }[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) cells.push({ x: i, y: j, d: Math.hypot(i - cx, (j - cy) * 1.5) + r() * 1.2 });
  cells.sort((a, b) => a.d - b.d);
  cells.forEach((c, rank) => out.push({ x: 64 + c.x * 128 + (r() - .5) * 26, y: 70 + c.y * 132 + (r() - .5) * 22, rot: (r() - .5) * .16, img: Math.floor(r() * 6), at: Math.log2(rank + 1) * .62, s: .86 + r() * .2 }));
  return out;
})();

function Copies({ run }: { run: number }) {
  const motion = usePerformanceMotion();
  const imgs = useRef<HTMLCanvasElement[]>([]);
  if (!imgs.current.length) imgs.current = Array.from({ length: 6 }, (_, i) => portrait(101 + i * 7));
  const [count, setCount] = useState(motion ? 1 : TILES.length);
  const ref = useCanvasLoop((g, t) => {
    let shown = 0;
    for (const tile of TILES) {
      const k = Math.max(0, Math.min(1, (t - tile.at) / .35)); if (k <= 0) continue; shown++;
      const e = 1 - Math.pow(1 - k, 3), w = 112 * tile.s * e, h = 147 * tile.s * e;
      g.save(); g.translate(tile.x + 56, tile.y + 73); g.rotate(tile.rot); g.globalAlpha = .9 * e;
      g.drawImage(imgs.current[tile.img], -w / 2, -h / 2, w, h);
      g.strokeStyle = "#ffffff22"; g.lineWidth = 1; g.strokeRect(-w / 2, -h / 2, w, h); g.restore();
    }
    if (motion) setCount((c) => (c === shown ? c : shown));
  }, [run], motion);
  return <>
    <canvas ref={ref} className="md-copies" width={1920} height={1080} aria-hidden="true"/>
    <span className="md-count"><small>퍼진 사본</small><b>{count}</b></span>
  </>;
}

export function MediaScene({ step }: { step: number }) {
  const [inspecting, setInspecting] = useState(false);
  const original = useRef<HTMLCanvasElement | null>(null);
  const [src, setSrc] = useState("");
  useEffect(() => { original.current = portrait(101); setSrc(original.current.toDataURL()); }, []);
  return <Frame n={37} name="당사자에게 남는 피해" step={step} className="abuse-slide abuse-v2 abuse-media-v2">
    <div className="abuse-content">
      <div className="md" data-deleted={step >= 1 || undefined} data-inspecting={inspecting || undefined}>
        <Copies run={0}/>
        <div className="md-shade"/>
      </div>
      <div className="md-original">
        <MediaInspection step={step} onInspect={setInspecting}>
          <div className="md-photo">{src && <img src={src} alt=""/>}<span>합성된 사진</span></div>
        </MediaInspection>
        <span className="md-deleted" aria-hidden={step < 1}>원본 삭제</span>
      </div>
      <div className="av-copy av-copy--right">
        <p className="av-eyebrow"><span className="av-tag">가상 상황 03</span>동의 없는 합성</p>
        <h1>만든 영상이<br/>한 사람을<br/><em>따라다닌다면</em></h1>
        <p className="md-line" data-on={step >= 1 || undefined}>가짜라고 밝혀도,<br/>이미 퍼진 것까지 지우기는 어렵습니다.</p>
      </div>
      <p className="av-note"><span>동의 없는 조작과 유포는 괴롭힘·협박에도 쓰입니다 · 사진 칸과 숫자는 도식</span><a href="https://www.ic3.gov/PSA/2023/PSA230605" target="_blank" rel="noreferrer">FBI · 조작된 이미지·영상 ↗</a></p>
    </div>
  </Frame>;
}
