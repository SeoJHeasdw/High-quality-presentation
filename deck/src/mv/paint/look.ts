/**
 * 유화 톤 스타일 시험(곡의 앞 16초). 레퍼런스: 손그림 캐릭터의 연기 + 남보라 밤과 금빛.
 *
 *   방      0 ~ 첫 마디(≈8초)  폰을 보던 아이. 창밖 금색 나방이 박자에 맞춰 유리를 두드리고, 아이가 고개를 돌린다
 *   창밖    ~ 13.7초           아이 뒷모습 너머 도시. 박마다 창이 하나씩 켜지고 나방이 모인다. 폭발 직전 나방이 날아오른다
 *   빛의 실  13.7초 ~           폭발. 하늘의 빛에서 금빛 실이 쏟아져 들판으로 흘러온다
 *
 * 한 프레임 = 깨끗한 장면(절반 해상도) → 붓질 패스(painter.ts) → 빛(가산 합성) → 천 결·비네트.
 * 움직임은 초당 15장(30fps에서 두 프레임마다 한 장, 손그림 애니메이션의 "투스")으로 끊고,
 * 붓질은 초당 7.5번 흔든다.
 */
import type { Song } from "../song.ts";
import { W, H, hash, clamp, smooth, mix, pulse } from "../scenes.ts";
import { paint, canvasWeave } from "./painter.ts";
import { drawHoodie, drawHoodieFace, hoodieMask, phoneRect, type Pose } from "./hoodie.ts";

const STEP = 15;

const P = {
  sky0: "#10143c",
  sky1: "#2a2f72",
  wall0: "#12163f",
  wall1: "#1b2054",
  floor0: "#22255c",
  floor1: "#2f326c",
  cloud: "rgba(132,124,190,.55)",
  gold: "#ffc864",
  goldCore: "#fff1c4",
  cold: "#d6e4ff",
};

type Shot = { scene: "room" | "city" | "field"; start: number; end: number };
type Key = [number, number];

const easeIO = (x: number) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/** 키프레임 사이를 부드럽게 잇는다 */
function key(t: number, ks: Key[]) {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 0; i < ks.length - 1; i++) {
    const [t0, v0] = ks[i], [t1, v1] = ks[i + 1];
    if (t < t1) return mix(v0, v1, easeIO((t - t0) / (t1 - t0)));
  }
  return ks[ks.length - 1][1];
}

const blinkAt = (t: number, at: number[]) => (at.some((b) => Math.abs(t - b) < .07) ? 1 : 0);

function sprite(color: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, color);
  r.addColorStop(.25, color.replace(/[\d.]+\)$/, ".45)"));
  r.addColorStop(1, color.replace(/[\d.]+\)$/, "0)"));
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return c;
}

type Win = { x: number; y: number; w: number; h: number; r: number; warm: boolean };
type Building = { x: number; y: number; w: number; h: number; color: string };
type Moth = { win: number; rad: number; speed: number; phase: number; size: number };

function buildCity() {
  let seed = 4242;
  const rnd = () => hash(seed++, 77);
  const layers = [
    { color: "#1c2154", hMin: 120, hMax: 260, wMin: 90, wMax: 170, cw: 20, ch: 26, skip: .55 },
    { color: "#12163f", hMin: 220, hMax: 440, wMin: 140, wMax: 240, cw: 30, ch: 38, skip: .5 },
    { color: "#0a0d2c", hMin: 320, hMax: 640, wMin: 210, wMax: 330, cw: 44, ch: 54, skip: .45 },
  ];
  const buildings: Building[] = [];
  const wins: Win[] = [];
  const horizon = 760;
  layers.forEach((L, li) => {
    let x = -60 + rnd() * 40;
    while (x < W + 60) {
      const w = L.wMin + rnd() * (L.wMax - L.wMin);
      const h = L.hMin + Math.pow(rnd(), 1.3) * (L.hMax - L.hMin);
      buildings.push({ x, y: horizon - h, w, h: h + 400, color: L.color });
      const cols = Math.max(1, Math.floor(w / L.cw) - 1), rows = Math.max(1, Math.floor(h / L.ch) - 1);
      const ox = x + (w - cols * L.cw) / 2;
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
        if (rnd() < L.skip) continue;
        wins.push({ x: ox + k * L.cw + L.cw * .2, y: horizon - h + L.ch * .7 + r * L.ch, w: L.cw * .6, h: L.ch * .55, r: rnd() * (1.15 - li * .1), warm: rnd() < .82 });
      }
      x += w + rnd() * 14 - 4;
    }
  });
  const warm = wins.map((w, i) => (w.warm && w.w > 12 ? i : -1)).filter((i) => i >= 0);
  const moths: Moth[] = Array.from({ length: 34 }, (_, i) => ({
    win: warm[Math.floor(hash(i, 91) * warm.length)],
    rad: 18 + hash(i, 92) * 50,
    speed: 1.4 + hash(i, 93) * 2.2,
    phase: hash(i, 94) * Math.PI * 2,
    size: 9 + hash(i, 95) * 7,
  }));
  return { buildings, wins, moths, horizon };
}

export function createPaintedLook(canvas: HTMLCanvasElement, song: Song) {
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  const clean = document.createElement("canvas");
  clean.width = W / 2;
  clean.height = H / 2;
  const cg = clean.getContext("2d", { willReadFrequently: true })!;
  const light = document.createElement("canvas");
  light.width = W;
  light.height = H;
  const lg = light.getContext("2d")!;

  const city = buildCity();
  const weave = canvasWeave(256, 256);
  const glowGold = sprite("rgba(255,200,100,1)");
  const glowCold = sprite("rgba(170,195,255,1)");
  const glowWhite = sprite("rgba(255,244,214,1)");
  const vignette = document.createElement("canvas");
  vignette.width = W; vignette.height = H;
  {
    const v = vignette.getContext("2d")!;
    const r = v.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H);
    r.addColorStop(0, "rgba(4,4,20,0)");
    r.addColorStop(1, "rgba(4,4,20,.6)");
    v.fillStyle = r;
    v.fillRect(0, 0, W, H);
  }
  const stars = Array.from({ length: 140 }, (_, i) => ({ x: hash(i, 11) * W, y: hash(i, 12) * 700, s: .8 + hash(i, 13) * 1.8, tw: hash(i, 14) }));
  const blades = Array.from({ length: 2600 }, (_, i) => {
    const v = Math.pow(hash(i, 21), .8);
    return { x: hash(i, 22) * (W + 200) - 100, y: 340 + v * 760, h: 6 + v * 34, c: hash(i, 23) };
  });

  const t1 = song.a.downbeats.find((d) => d >= 7.5) ?? 8;
  const t2 = song.a.sections[1]?.start ?? 13.7;
  const shots: Shot[] = [
    { scene: "room", start: 0, end: t1 },
    { scene: "city", start: t1, end: t2 },
    { scene: "field", start: t2, end: song.duration },
  ];

  /* ── 도시(방 창밖과 창밖 장면이 같이 쓴다) ───────────── */

  const LIT0 = .16, LIT_STEP = .055;

  function lightsAt(t: number, shot: Shot) {
    if (shot.scene === "room") return LIT0;
    // 창밖 장면: 박마다 창이 더 켜진다
    const b0 = song.beatIndex(shot.start + .02);
    const n = Math.max(0, song.beatIndex(t) - b0);
    return Math.min(.62, LIT0 + n * LIT_STEP);
  }

  function citySky(c: CanvasRenderingContext2D, t: number) {
    const sky = c.createLinearGradient(0, -400, 0, city.horizon);
    sky.addColorStop(0, P.sky0);
    sky.addColorStop(1, P.sky1);
    c.fillStyle = sky;
    c.fillRect(-400, -600, W + 800, city.horizon + 600);
    for (const s of stars) {
      c.fillStyle = `rgba(230,228,255,${.35 + .4 * s.tw})`;
      c.fillRect(s.x, s.y - 300, s.s * 1.6, s.s * 1.6);
    }
    c.fillStyle = P.cloud;
    for (let i = 0; i < 5; i++) {
      const x = ((hash(i, 31) * W + t * (6 + i * 2)) % (W + 600)) - 300;
      const y = 60 + i * 70 + hash(i, 32) * 40;
      c.beginPath();
      c.ellipse(x, y, 260 + hash(i, 33) * 220, 22 + hash(i, 34) * 16, 0, 0, Math.PI * 2);
      c.fill();
    }
  }

  function cityBody(c: CanvasRenderingContext2D, lit: number) {
    for (const b of city.buildings) {
      c.fillStyle = b.color;
      c.fillRect(b.x, b.y, b.w, b.h);
      c.fillStyle = "rgba(70,80,160,.25)";
      c.fillRect(b.x, b.y, 3, b.h);
    }
    for (const w of city.wins) {
      const on = lit > w.r;
      c.fillStyle = on ? (w.warm ? P.gold : P.cold) : "rgba(60,70,130,.35)";
      c.fillRect(w.x, w.y, w.w, w.h);
    }
  }

  function mothPos(m: Moth, t: number, rise: number) {
    const w = city.wins[m.win];
    const a = t * m.speed + m.phase;
    return {
      x: w.x + w.w / 2 + Math.cos(a) * m.rad + Math.sin(a * 2.3) * 8,
      y: w.y + w.h / 2 + Math.sin(a) * m.rad * .6 - rise * (260 + m.rad * 4),
    };
  }

  function drawMoth(c: CanvasRenderingContext2D, x: number, y: number, size: number, t: number, ph: number, alpha = 1) {
    const flap = .25 + .75 * Math.abs(Math.sin(t * 8 + ph));
    c.save();
    c.translate(x, y);
    c.globalAlpha = .55 * alpha;
    c.drawImage(glowGold, -size * 2.2, -size * 2.2, size * 4.4, size * 4.4);
    c.globalAlpha = alpha;
    for (const s of [-1, 1]) {
      c.save();
      c.scale(s, 1);
      c.fillStyle = "#ffd583";
      c.beginPath(); c.ellipse(size * .45, -size * .2, size * .5, size * .36 * flap + .4, -.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#f2b45c";
      c.beginPath(); c.ellipse(size * .32, size * .22, size * .3, size * .22 * flap + .4, .6, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    c.fillStyle = "#fff4d6";
    c.fillRect(-size * .07, -size * .4, size * .14, size * .8);
    c.restore();
  }

  function cityGlow(c: CanvasRenderingContext2D, t: number, lit: number, sinceOn: (w: Win) => number, rise: number) {
    c.save();
    c.globalCompositeOperation = "lighter";
    for (const w of city.wins) {
      if (lit <= w.r) continue;
      const fresh = pulse(sinceOn(w), .35);
      const r = Math.max(w.w, w.h) * (1.5 + 1.8 * fresh);
      c.globalAlpha = .16 + .5 * fresh;
      c.drawImage(w.warm ? glowGold : glowCold, w.x + w.w / 2 - r, w.y + w.h / 2 - r, r * 2, r * 2);
    }
    c.globalAlpha = 1;
    city.moths.forEach((m, i) => {
      const w = city.wins[m.win];
      if (lit <= w.r) return;
      const p = mothPos(m, t, rise);
      drawMoth(c, p.x, p.y, m.size, t, m.phase);
    });
    c.restore();
  }

  /* ── 장면별 깨끗한 그림 + 빛 ──────────────────────────── */

  function roomPose(lt: number, tq: number): Pose {
    const breathe = .012 * Math.sin(lt * 1.7);
    const glowBase = .8 + .2 * pulse(song.sinceBeat(tq), .25);
    const phone = key(lt, [[0, 1], [5.3, 1], [6.1, .3]]);
    return {
      x: 700, y: 950, s: 440,
      squash: breathe + key(lt, [[4.5, 0], [4.68, .08], [4.95, -.07], [5.25, 0]]),
      lean: key(lt, [[0, 0], [5.7, 0], [6.7, .07], [8.5, .09]]),
      turn: key(lt, [[0, 0], [4.55, 0], [4.75, -.2], [5.05, 1.1], [5.3, 1]]),
      lookX: key(lt, [[0, .15], [4.6, .15], [4.95, 1]]),
      lookY: key(lt, [[0, .8], [4.6, .8], [4.95, -.7]]),
      blink: blinkAt(lt, [1.7, 4.5, 6.8, 7.7]),
      phone,
      glow: glowBase * (.35 + .65 * phone),
    };
  }

  /** 방 장면의 창 */
  const WIN = { x0: 1170, y0: 50, x1: 1990, y1: 770 };
  const CITY_IN_WINDOW = { x: 1100, y: 640 - city.horizon * .56, s: .56 };

  function tapMoth(lt: number, tq: number) {
    // 2.2초에 오른쪽에서 날아와 유리 앞에 머문다. 박마다 유리를 톡
    const arrive = smooth(2.2, 3.6, lt);
    const tap = lt > 3.6 ? pulse(song.sinceBeat(tq), .12) : 0;
    return {
      x: mix(2050, 1430, easeIO(arrive)) + Math.sin(tq * 5) * 10 - tap * 14,
      y: mix(260, 430, easeIO(arrive)) + Math.sin(tq * 7.3) * 9,
      tap,
      on: lt > 2.2,
    };
  }

  function room(c: CanvasRenderingContext2D, shot: Shot, t: number, tq: number) {
    const lt = tq - shot.start;
    const pose = roomPose(lt, tq);
    c.save();
    const z = 1 + .05 * smooth(0, shot.end - shot.start, lt);
    c.translate(880, 620); c.scale(z, z); c.translate(-880, -620);

    const wall = c.createLinearGradient(0, 0, 0, 830);
    wall.addColorStop(0, P.wall0);
    wall.addColorStop(1, P.wall1);
    c.fillStyle = wall;
    c.fillRect(-100, -100, W + 200, 940);

    // 창 밖
    c.save();
    c.beginPath(); c.rect(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0); c.clip();
    c.translate(CITY_IN_WINDOW.x, CITY_IN_WINDOW.y); c.scale(CITY_IN_WINDOW.s, CITY_IN_WINDOW.s);
    citySky(c, tq);
    cityBody(c, lightsAt(tq, shot));
    c.restore();
    // 창틀
    c.strokeStyle = "#0a0d26";
    c.lineWidth = 26;
    c.strokeRect(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0);
    c.fillStyle = "#0a0d26";
    c.fillRect(1572, WIN.y0, 20, WIN.y1 - WIN.y0);
    c.fillRect(WIN.x0, 400, WIN.x1 - WIN.x0, 18);
    c.fillStyle = "#2d3172";
    c.fillRect(WIN.x0 - 30, WIN.y1, WIN.x1 - WIN.x0 + 60, 26);
    c.fillStyle = "#4a4f9c";
    c.fillRect(WIN.x0 - 30, WIN.y1, WIN.x1 - WIN.x0 + 60, 5);

    // 바닥
    const floor = c.createLinearGradient(0, 830, 0, H);
    floor.addColorStop(0, P.floor0);
    floor.addColorStop(1, P.floor1);
    c.fillStyle = floor;
    c.fillRect(-100, 830, W + 200, H);
    c.fillStyle = "#0e1132";
    c.fillRect(-100, 822, W + 200, 10);
    // 창으로 들어온 달빛
    c.fillStyle = "rgba(120,120,200,.28)";
    c.beginPath(); c.moveTo(1180, 832); c.lineTo(1960, 832); c.lineTo(1560, H + 40); c.lineTo(640, H + 40); c.closePath(); c.fill();
    // 폰 빛 웅덩이
    const pr = phoneRect(pose);
    const pool = c.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, 420);
    pool.addColorStop(0, `rgba(150,172,255,${.35 * (pose.glow ?? 0)})`);
    pool.addColorStop(1, "rgba(150,172,255,0)");
    c.fillStyle = pool;
    c.fillRect(pr.x - 420, pr.y - 420, 840, 840);

    drawHoodie(c, pose);

    const m = tapMoth(lt, tq);
    if (m.on) { c.fillStyle = P.gold; c.beginPath(); c.arc(m.x, m.y, 12, 0, Math.PI * 2); c.fill(); }
    c.restore();
    return { pose, m, z };
  }

  function roomGlow(c: CanvasRenderingContext2D, shot: Shot, tq: number, st: { pose: Pose; m: ReturnType<typeof tapMoth>; z: number }) {
    const lt = tq - shot.start;
    c.save();
    c.translate(880, 620); c.scale(st.z, st.z); c.translate(-880, -620);
    // 창 밖의 불빛과 나방
    c.save();
    c.beginPath(); c.rect(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0); c.clip();
    c.translate(CITY_IN_WINDOW.x, CITY_IN_WINDOW.y); c.scale(CITY_IN_WINDOW.s, CITY_IN_WINDOW.s);
    cityGlow(c, tq, lightsAt(tq, shot), () => Infinity, 0);
    c.restore();
    c.globalCompositeOperation = "lighter";
    // 폰 화면
    const pr = phoneRect(st.pose);
    const gl = st.pose.glow ?? 0;
    c.globalAlpha = .55 * gl;
    c.drawImage(glowCold, pr.x - 160, pr.y - 160, 320, 320);
    c.globalAlpha = .9 * gl;
    c.drawImage(glowWhite, pr.x - 40, pr.y - 40, 80, 80);
    c.globalAlpha = 1;
    // 유리를 두드리는 나방: 두드릴 때마다 유리에 빛이 번진다
    if (st.m.on) {
      drawMoth(c, st.m.x, st.m.y, 24, tq, 0);
      if (st.m.tap > .05) {
        c.globalAlpha = st.m.tap * .7;
        c.drawImage(glowGold, st.m.x - 26 - 120, st.m.y - 120, 240, 240);
        c.globalAlpha = 1;
      }
    }
    // 6.8초부터 나방이 더 모인다
    for (let i = 0; i < 4; i++) {
      const on = smooth(6.6 + i * .3, 7.4 + i * .3, lt);
      if (on <= 0) continue;
      const x = mix(2060, 1300 + i * 140, easeIO(on)) + Math.sin(tq * (4 + i) + i) * 14;
      const y = mix(200 + i * 60, 220 + i * 90, easeIO(on)) + Math.cos(tq * (5 + i)) * 10;
      drawMoth(c, x, y, 15, tq, i * 1.7);
    }
    c.restore();
  }

  function cityShot(c: CanvasRenderingContext2D, shot: Shot, tq: number) {
    const lt = tq - shot.start, dur = shot.end - shot.start;
    const rise = smooth(dur - 1.3, dur, lt);
    c.save();
    const z = 1.04 + .04 * smooth(0, dur, lt);
    c.translate(960, 760); c.scale(z, z); c.translate(-960, -760);
    c.translate(0, 70 * smooth(0, dur, lt));
    citySky(c, tq);
    cityBody(c, lightsAt(tq, shot));
    c.restore();
    // 앞쪽: 창가에 선 아이의 뒷모습
    const pose: Pose = {
      x: 330, y: 1230, s: 620, back: true, seated: false,
      squash: .01 * Math.sin(lt * 1.7) + key(lt, [[dur - 1.4, 0], [dur - 1.1, .05], [dur - .4, -.05], [dur, 0]]),
      lean: .05, rim: "rgba(255,205,120,.75)",
    };
    drawHoodie(c, pose);
    return { z, rise, pose };
  }

  function cityShotGlow(c: CanvasRenderingContext2D, shot: Shot, tq: number, st: { z: number; rise: number }) {
    const lt = tq - shot.start, dur = shot.end - shot.start;
    const b0 = song.beatIndex(shot.start + .02);
    c.save();
    c.translate(960, 760); c.scale(st.z, st.z); c.translate(-960, -760);
    c.translate(0, 70 * smooth(0, dur, lt));
    const beats = song.a.beats;
    cityGlow(c, tq, lightsAt(tq, shot), (w) => {
      // 이 창이 켜진 박(처음 lit > r가 된 박)부터 흐른 시간
      const need = Math.ceil((w.r - LIT0) / LIT_STEP);
      if (need <= 0) return Infinity;
      const bi = b0 + need;
      return bi < beats.length ? tq - beats[bi] : Infinity;
    }, easeIO(st.rise));
    c.restore();
  }

  function threadPoint(k: number, v: number, t: number) {
    const spread = (hash(k, 41) * 2 - 1) * (.5 + .5 * hash(k, 42));
    const freq = 1.2 + hash(k, 43) * 1.6;
    const amp = 8 + 110 * v;
    const y = 300 + 860 * Math.pow(v, 1.5);
    const x = 960 + spread * Math.pow(v, 1.25) * 1100 + Math.sin(v * freq * Math.PI * 2 - t * (1.6 + hash(k, 44)) + k) * amp;
    return { x, y };
  }

  const THREADS = 15;

  function field(c: CanvasRenderingContext2D, shot: Shot, tq: number) {
    const lt = tq - shot.start;
    c.save();
    const z = 1 + .03 * smooth(0, 6, lt);
    c.translate(960, 500); c.scale(z, z); c.translate(-960, -500);
    const sky = c.createLinearGradient(0, 0, 0, 340);
    sky.addColorStop(0, P.sky0);
    sky.addColorStop(1, P.sky1);
    c.fillStyle = sky;
    c.fillRect(-100, -100, W + 200, 460);
    for (const s of stars) {
      if (s.y > 330) continue;
      c.fillStyle = `rgba(230,228,255,${.35 + .4 * s.tw})`;
      c.fillRect(s.x, s.y, s.s * 1.6, s.s * 1.6);
    }
    c.fillStyle = P.cloud;
    for (let i = 0; i < 6; i++) {
      const x = ((hash(i, 51) * W + tq * (5 + i * 2)) % (W + 700)) - 350;
      c.beginPath();
      c.ellipse(x, 70 + i * 48, 240 + hash(i, 52) * 260, 20 + hash(i, 53) * 14, 0, 0, Math.PI * 2);
      c.fill();
    }
    const ground = c.createLinearGradient(0, 330, 0, H);
    ground.addColorStop(0, "#1a1f55");
    ground.addColorStop(1, "#262b68");
    c.fillStyle = ground;
    c.fillRect(-100, 330, W + 200, H);
    // 풀잎: 세로 결이 있어야 붓이 풀처럼 눕는다
    c.lineCap = "round";
    for (const b of blades) {
      c.strokeStyle = b.c < .5 ? "#141846" : "#33397c";
      c.lineWidth = 1 + b.h * .08;
      c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x + (b.c - .5) * b.h * .4, b.y - b.h); c.stroke();
    }
    // 실의 밑색(붓이 금빛을 집도록)
    const reveal = easeIO(clamp(lt / .7));
    c.strokeStyle = "#b8955a";
    c.lineWidth = 6;
    for (let k = 0; k < THREADS; k++) {
      c.beginPath();
      for (let i = 0; i <= 60; i++) {
        const v = i / 60 * reveal;
        const p = threadPoint(k, v, tq);
        if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y);
      }
      c.stroke();
    }
    c.fillStyle = P.goldCore;
    c.beginPath(); c.arc(960, 300, 16, 0, Math.PI * 2); c.fill();
    c.restore();
    const pose: Pose = {
      x: 700, y: 1100, s: 300, back: true, seated: false, rim: "rgba(255,222,150,.95)",
      squash: key(lt, [[0, 0], [.12, .1], [.35, -.06], [.6, 0]]) + .01 * Math.sin(lt * 1.7),
    };
    drawHoodie(c, pose);
    return { z, reveal, pose };
  }

  function fieldGlow(c: CanvasRenderingContext2D, shot: Shot, tq: number, st: { z: number; reveal: number }) {
    const lt = tq - shot.start;
    c.save();
    c.translate(960, 500); c.scale(st.z, st.z); c.translate(-960, -500);
    c.globalCompositeOperation = "lighter";
    const beat = pulse(song.sinceBeat(tq), .2);
    c.globalAlpha = .7 + .3 * beat;
    c.drawImage(glowGold, 960 - 420, 300 - 420, 840, 840);
    c.drawImage(glowWhite, 960 - 70, 300 - 70, 140, 140);
    c.globalAlpha = 1;
    c.lineCap = "round";
    for (let k = 0; k < THREADS; k++) {
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i <= 90; i++) pts.push(threadPoint(k, i / 90 * st.reveal, tq));
      for (const [wd, a, col] of [[14, .05, "255,200,110"], [5, .18, "255,214,140"], [1.8, .85, "255,243,210"]] as [number, number, string][]) {
        c.strokeStyle = `rgba(${col},${a})`;
        c.lineWidth = wd;
        c.beginPath();
        pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
        c.stroke();
      }
      // 실을 타고 흘러오는 작은 빛잎
      for (let j = 0; j < 3; j++) {
        const v = ((hash(k, 60 + j) + tq * .09) % 1) * st.reveal;
        const p = threadPoint(k, v, tq);
        c.globalAlpha = .9;
        c.drawImage(glowGold, p.x - 14 - v * 10, p.y - 14 - v * 10, 28 + v * 20, 28 + v * 20);
        c.globalAlpha = 1;
      }
    }
    // 실을 거슬러 하늘로 오르는 나방
    for (let i = 0; i < 14; i++) {
      const v = 1 - ((hash(i, 71) + lt * (.07 + hash(i, 72) * .05)) % 1);
      const p = threadPoint(i % THREADS, v * st.reveal, tq);
      drawMoth(c, p.x + Math.sin(tq * 3 + i) * 30, p.y - 20, 6 + v * 10, tq, i);
    }
    c.restore();
  }

  function render(t: number) {
    const tq = Math.floor(t * STEP + 1e-6) / STEP;
    const shot = shots.find((s) => t >= s.start && t < s.end) ?? shots[shots.length - 1];
    cg.setTransform(.5, 0, 0, .5, 0, 0);
    cg.fillStyle = P.sky0;
    cg.fillRect(0, 0, W, H);
    let st: any;
    if (shot.scene === "room") st = room(cg, shot, t, tq);
    else if (shot.scene === "city") st = cityShot(cg, shot, tq);
    else st = field(cg, shot, tq);

    paint(g, clean, Math.floor(t * 7.5 + 1e-6), { flowSeed: shot.scene === "field" ? 3 : shot.scene === "city" ? 2 : 1 });

    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.globalCompositeOperation = "source-over";
    lg.clearRect(0, 0, W, H);
    if (shot.scene === "room") roomGlow(lg, shot, tq, st);
    else if (shot.scene === "city") cityShotGlow(lg, shot, tq, st);
    else fieldGlow(lg, shot, tq, st);
    if (st.pose && st.pose.back) {
      lg.globalCompositeOperation = "destination-out";
      lg.beginPath(); hoodieMask(lg, st.pose); lg.fill();
    }
    g.save();
    g.globalCompositeOperation = "lighter";
    g.drawImage(light, 0, 0);
    g.restore();
    if (shot.scene === "room") {
      g.save();
      const z = st.z;
      g.translate(880, 620); g.scale(z, z); g.translate(-880, -620);
      drawHoodieFace(g, st.pose);
      g.restore();
    }
    if (shot.scene === "field" && tq - shot.start < .25) {
      g.fillStyle = `rgba(255,236,200,${.5 * (1 - (tq - shot.start) / .25)})`;
      g.fillRect(0, 0, W, H);
    }

    g.save();
    g.globalCompositeOperation = "overlay";
    g.globalAlpha = .1;
    for (let y = 0; y < H; y += 256) for (let x = 0; x < W; x += 256) g.drawImage(weave, x, y);
    g.restore();
    g.drawImage(vignette, 0, 0);
    const black = Math.max(1 - smooth(0, 1.2, t), smooth(song.duration - 1.5, song.duration, t));
    if (black > 0) { g.fillStyle = `rgba(0,0,0,${black})`; g.fillRect(0, 0, W, H); }
  }

  return { render, shots };
}
