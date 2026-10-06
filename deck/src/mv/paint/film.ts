/**
 * 유화 뮤비 본편(3분). 가사 없이 아이의 연기로 간다.
 *
 *   외로운 밤 → 창밖의 빛 → 나방이 길을 만들어 줌 → 빛을 타고 하늘로 → 새벽
 *
 * 한 프레임 = 깨끗한 장면(절반 해상도) → 붓질(painter.ts) → 빛 층(아이 뒤는 지운다, 가산 합성)
 *           → 얼굴·낙서(또렷하게) → 전환(번쩍임·검정) → 천 결·비네트.
 * 움직임은 초당 15장(30fps의 투스)으로 끊고, 붓은 초당 7.5번 흔든다. 컷은 모두 마디 첫 박이다.
 */
import type { Song } from "../song.ts";
import { pulse } from "../scenes.ts";
import { paint } from "./painter.ts";
import { drawHoodie, drawHoodieFace, hoodieMask, phoneRect, handAt, handsCenter, type Pose } from "./hoodie.ts";
import {
  W, H, P, HORIZON, hash, clamp, mix, smooth, key, blinkAt, easeIO, easeOut, hop, makeKit, type Kit, type Win,
  skyFill, starfield, cloudBands, cloudSea, moonDisc, cityBody, roofs, roofY,
  windowGlow, moth, starGlow, glowLine,
  dotted, bang, sweat, spiral, heart, sparkle, speedLines,
} from "./kit.ts";

const STEP = 15;
const RIM = "rgba(255,214,140,.9)";

type Cam = { cx: number; cy: number; z: number; r?: number };
type F = {
  t: number; tq: number; lt: number; dur: number; hold: number;
  song: Song; k: Kit;
  beatAge: number; downAge: number; beat: number; beatsF: number;
  level: number;
};
type S = { cam: Cam; kids: Pose[]; mask?: Pose[]; [key: string]: any };
type Shot = {
  name: string; start: number; end: number; enter?: "cut" | "flash" | "dip"; seed: number;
  draw: (c: CanvasRenderingContext2D, f: F) => S;
  glow?: (c: CanvasRenderingContext2D, f: F, s: S) => void;
  front?: (c: CanvasRenderingContext2D, f: F, s: S) => void;
};

const CAM0: Cam = { cx: 960, cy: 540, z: 1 };

function applyCam(c: CanvasRenderingContext2D, cam: Cam) {
  c.translate(960, 540);
  if (cam.r) c.rotate(cam.r);
  c.scale(cam.z, cam.z);
  c.translate(-cam.cx, -cam.cy);
}

function lighter(c: CanvasRenderingContext2D, fn: () => void) {
  c.save();
  c.globalCompositeOperation = "lighter";
  fn();
  c.restore();
}

function bez(a: { x: number; y: number }, b: { x: number; y: number }, ctl: { x: number; y: number }, v: number) {
  const u = 1 - v;
  return { x: u * u * a.x + 2 * u * v * ctl.x + v * v * b.x, y: u * u * a.y + 2 * u * v * ctl.y + v * v * b.y };
}

export type FilmOptions = {
  /** "tel": 팀 시연용. 끝에 나방이 모여 Technology Expert Lab을 만든다(기본은 글자 없음) */
  ending?: "tel";
};

export function createPaintedFilm(canvas: HTMLCanvasElement, song: Song, opts: FilmOptions = {}) {
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
  const k = makeKit();
  const db = song.a.downbeats;
  /** 가장 가까운 마디 첫 박 */
  const snap = (t: number) => {
    let best = t, d = 1.6;
    for (const x of db) if (Math.abs(x - t) < d) { d = Math.abs(x - t); best = x; }
    return best;
  };

  /* ── 도시를 멀리 놓는 도우미 ───────────────────────── */

  function farCity(c: CanvasRenderingContext2D, x: number, y: number, s: number, lit: number) {
    c.save(); c.translate(x, y); c.scale(s, s); cityBody(c, k, lit); c.restore();
  }
  function farCityGlow(c: CanvasRenderingContext2D, x: number, y: number, s: number, lit: number) {
    c.save(); c.translate(x, y); c.scale(s, s);
    lighter(c, () => windowGlow(c, k, lit, () => Infinity, pulse));
    c.restore();
  }

  /* ── 방(밤·새벽) ──────────────────────────────────── */

  const WIN = { x0: 1170, y0: 50, x1: 1990, y1: 770 };
  const CITY_IN_WINDOW = { x: 1100, y: 640 - HORIZON * .56, s: .56 };

  function room(c: CanvasRenderingContext2D, f: F, o: { lit: number; open?: number; dawn?: number; gold?: number }) {
    const dawn = o.dawn ?? 0;
    const wall = c.createLinearGradient(0, 0, 0, 830);
    wall.addColorStop(0, dawn ? "#1a1840" : P.wall0);
    wall.addColorStop(1, dawn ? "#2a2552" : P.wall1);
    c.fillStyle = wall;
    c.fillRect(-300, -300, W + 600, 1140);
    // 창 밖
    c.save();
    c.beginPath(); c.rect(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0); c.clip();
    c.translate(CITY_IN_WINDOW.x, CITY_IN_WINDOW.y); c.scale(CITY_IN_WINDOW.s, CITY_IN_WINDOW.s);
    if (dawn) {
      const sky = c.createLinearGradient(0, -300, 0, HORIZON);
      sky.addColorStop(0, "#2c2b62");
      sky.addColorStop(.6, mixColor("#2c2b62", "#9a6390", dawn));
      sky.addColorStop(1, mixColor("#3a3570", "#f0a86a", dawn));
      c.fillStyle = sky;
      c.fillRect(-400, -600, W + 800, HORIZON + 600);
      cloudBands(c, f.tq, 31, 4, 80, 80, `rgba(240,170,170,${.35 * dawn})`);
    } else {
      skyFill(c, -300, HORIZON);
      starfield(c, k, HORIZON - 200, f.tq);
      cloudBands(c, f.tq, 31, 5, 60, 70);
    }
    cityBody(c, k, o.lit);
    c.restore();
    // 창틀(열리면 두 짝이 안쪽으로 돈다)
    const open = o.open ?? 0;
    c.fillStyle = "#080a22";
    c.strokeStyle = "#080a22";
    c.lineWidth = 26;
    c.strokeRect(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0);
    if (open <= 0) {
      c.fillRect(1572, WIN.y0, 20, WIN.y1 - WIN.y0);
      c.fillRect(WIN.x0, 400, WIN.x1 - WIN.x0, 18);
    } else {
      const sw = (1 - open * .8);
      c.lineWidth = 16;
      for (const [hx, dir] of [[WIN.x0, 1], [WIN.x1, -1]] as [number, number][]) {
        const w = 410 * sw * dir;
        c.beginPath();
        c.moveTo(hx, WIN.y0); c.lineTo(hx + w, WIN.y0 - open * 50); c.lineTo(hx + w, WIN.y1 + open * 50); c.lineTo(hx, WIN.y1);
        c.closePath(); c.stroke();
        c.fillStyle = "rgba(120,140,220,.12)";
        c.fill();
      }
    }
    c.fillStyle = "#262a66";
    c.fillRect(WIN.x0 - 30, WIN.y1, WIN.x1 - WIN.x0 + 60, 26);
    c.fillStyle = "#3e4290";
    c.fillRect(WIN.x0 - 30, WIN.y1, WIN.x1 - WIN.x0 + 60, 5);
    const floor = c.createLinearGradient(0, 830, 0, H);
    floor.addColorStop(0, dawn ? "#251f4c" : P.floor0);
    floor.addColorStop(1, dawn ? "#32295a" : P.floor1);
    c.fillStyle = floor;
    c.fillRect(-300, 830, W + 600, H);
    c.fillStyle = "#0b0d2c";
    c.fillRect(-300, 822, W + 600, 10);
    c.fillStyle = dawn ? `rgba(240,160,130,${.22 * dawn})` : "rgba(110,110,190,.22)";
    c.beginPath(); c.moveTo(1180, 832); c.lineTo(1960, 832); c.lineTo(1560, H + 40); c.lineTo(640, H + 40); c.closePath(); c.fill();
    if (o.gold) {
      const gl = c.createRadialGradient(720, 620, 0, 720, 620, 700);
      gl.addColorStop(0, `rgba(255,190,100,${.35 * o.gold})`);
      gl.addColorStop(1, "rgba(255,190,100,0)");
      c.fillStyle = gl;
      c.fillRect(-300, -300, W + 600, H + 600);
    }
  }

  function roomCityGlow(c: CanvasRenderingContext2D, lit: number) {
    c.save();
    c.beginPath(); c.rect(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0); c.clip();
    c.translate(CITY_IN_WINDOW.x, CITY_IN_WINDOW.y); c.scale(CITY_IN_WINDOW.s, CITY_IN_WINDOW.s);
    lighter(c, () => windowGlow(c, k, lit, () => Infinity, pulse));
    c.restore();
  }

  function phoneLight(c: CanvasRenderingContext2D, p: Pose) {
    const pr = phoneRect(p);
    const gl = p.glow ?? 0;
    lighter(c, () => {
      c.globalAlpha = .55 * gl;
      c.drawImage(k.glowCold, pr.x - 160, pr.y - 160, 320, 320);
      c.globalAlpha = .9 * gl;
      c.drawImage(k.glowWhite, pr.x - 40, pr.y - 40, 80, 80);
    });
  }

  /* ── 컷들 ─────────────────────────────────────────── */

  const t1 = snap(8), t2 = song.a.sections[1]?.start ?? snap(13.7);
  const shots: Shot[] = [];
  const add = (name: string, at: number, seed: number, enter: Shot["enter"], body: Pick<Shot, "draw" | "glow" | "front">) => {
    shots.push({ name, start: at, end: 0, seed, enter, ...body });
  };

  // 01 방: 폰을 보던 아이, 유리를 두드리는 나방
  add("room-night", 0, 1, "cut", {
    draw(c, f) {
      const lt = f.lt;
      // 아이와 창 사이(880, 620)를 중심으로 천천히 다가간다
      const z = 1 + .05 * smooth(0, f.dur, lt);
      const cam: Cam = { cx: 880 + 80 / z, cy: 620 - 80 / z, z };
      const phone = key(lt, [[0, 1], [5.3, 1], [6.1, .3]]);
      const pose: Pose = {
        x: 700, y: 950, s: 440,
        squash: .012 * Math.sin(lt * 1.7) + key(lt, [[4.5, 0], [4.68, .08], [4.95, -.07], [5.25, 0]]),
        lean: key(lt, [[0, 0], [5.7, 0], [6.7, .07], [8.5, .09]]),
        turn: key(lt, [[0, 0], [4.55, 0], [4.75, -.2], [5.05, 1.1], [5.3, 1]]),
        lookX: key(lt, [[0, .15], [4.6, .15], [4.95, 1]]),
        lookY: key(lt, [[0, .8], [4.6, .8], [4.95, -.7]]),
        blink: blinkAt(lt, [1.7, 4.5, 6.8, 7.7]),
        phone, glow: (.8 + .2 * f.beat) * (.35 + .65 * phone),
      };
      c.save(); applyCam(c, cam);
      room(c, f, { lit: .16 });
      const pr = phoneRect(pose);
      const pool = c.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, 420);
      pool.addColorStop(0, `rgba(150,172,255,${.3 * (pose.glow ?? 0)})`);
      pool.addColorStop(1, "rgba(150,172,255,0)");
      c.fillStyle = pool;
      c.fillRect(pr.x - 420, pr.y - 420, 840, 840);
      drawHoodie(c, pose);
      const arrive = smooth(2.2, 3.6, lt);
      const tap = lt > 3.6 ? pulse(f.beatAge, .12) : 0;
      const m = { x: mix(2050, 1430, easeIO(arrive)) + Math.sin(f.tq * 5) * 10 - tap * 14, y: mix(260, 430, easeIO(arrive)) + Math.sin(f.tq * 7.3) * 9, tap, on: lt > 2.2 };
      if (m.on) { c.fillStyle = P.gold; c.beginPath(); c.arc(m.x, m.y, 12, 0, Math.PI * 2); c.fill(); }
      c.restore();
      return { cam, kids: [pose], m };
    },
    glow(c, f, s) {
      roomCityGlow(c, .16);
      phoneLight(c, s.kids[0]);
      lighter(c, () => {
        if (s.m.on) {
          moth(c, k, s.m.x, s.m.y, 24, f.tq, 0);
          if (s.m.tap > .05) { c.globalAlpha = s.m.tap * .7; c.drawImage(k.glowGold, s.m.x - 146, s.m.y - 120, 240, 240); c.globalAlpha = 1; }
        }
        for (let i = 0; i < 4; i++) {
          const on = smooth(6.6 + i * .3, 7.4 + i * .3, f.lt);
          if (on <= 0) continue;
          moth(c, k, mix(2060, 1300 + i * 140, easeIO(on)) + Math.sin(f.tq * (4 + i) + i) * 14, mix(200 + i * 60, 220 + i * 90, easeIO(on)) + Math.cos(f.tq * (5 + i)) * 10, 15, f.tq, i * 1.7);
        }
      });
    },
  });

  // 02 창밖: 아이 뒷모습 너머, 박마다 켜지는 창. 폭발 직전 나방이 날아오른다
  const LIT0 = .16, LIT_STEP = .055;
  add("city-window", t1, 2, "cut", {
    draw(c, f) {
      const lt = f.lt, dur = f.dur;
      const z = 1.04 + .04 * smooth(0, dur, lt);
      const cam: Cam = { cx: 960, cy: 760 - 220 / z - 70 * smooth(0, dur, lt), z };
      const lit = Math.min(.62, LIT0 + Math.floor(f.beatsF) * LIT_STEP);
      c.save(); applyCam(c, cam);
      skyFill(c, -400, HORIZON);
      starfield(c, k, HORIZON - 150, f.tq);
      cloudBands(c, f.tq, 31, 5, 60, 70);
      cityBody(c, k, lit);
      c.restore();
      const pose: Pose = {
        x: 330, y: 1230, s: 620, back: true, seated: false, lean: .05, rim: RIM,
        squash: .01 * Math.sin(lt * 1.7) + key(lt, [[dur - 1.4, 0], [dur - 1.1, .05], [dur - .4, -.05], [dur, 0]]),
      };
      drawHoodie(c, pose);
      return { cam: CAM0, kids: [pose], mask: [pose], cityCam: cam, lit };
    },
    glow(c, f, s) {
      const dur = f.dur, lt = f.lt;
      const rise = easeIO(smooth(dur - 1.3, dur, lt));
      const b0 = f.song.beatIndex(f.tq - f.lt + .02);
      const beats = f.song.a.beats;
      c.save();
      // 도시 카메라(아이는 화면 고정)
      c.translate(960, 540); c.scale(s.cityCam.z, s.cityCam.z); c.translate(-s.cityCam.cx, -s.cityCam.cy);
      lighter(c, () => {
        windowGlow(c, k, s.lit, (w: Win) => {
          const need = Math.ceil((w.r - LIT0) / LIT_STEP);
          if (need <= 0) return Infinity;
          const bi = b0 + need;
          return bi < beats.length ? f.tq - beats[bi] : Infinity;
        }, pulse);
        k.city.moths.forEach((m) => {
          const w = k.city.wins[m.win];
          if (s.lit <= w.r) return;
          const a = f.tq * m.speed + m.phase;
          moth(c, k, w.x + w.w / 2 + Math.cos(a) * m.rad + Math.sin(a * 2.3) * 8, w.y + w.h / 2 + Math.sin(a) * m.rad * .6 - rise * (260 + m.rad * 4), m.size, f.tq, m.phase);
        });
      });
      c.restore();
    },
  });

  // 03 창이 열리고 나방이 쏟아져 들어온다. 아이가 놀라 일어난다
  const SWARM = Array.from({ length: 36 }, (_, i) => ({
    sx: 1500 + hash(i, 301) * 400, sy: 160 + hash(i, 302) * 520, d: i * .045,
    R: 150 + hash(i, 303) * 190, sp: .9 + hash(i, 304) * .9, ph: hash(i, 305) * 6.28, size: 11 + hash(i, 306) * 9,
  }));
  function swarmPos(i: number, f: F, cx: number, cy: number, start = .35) {
    const m = SWARM[i];
    const p = easeIO(clamp((f.lt - start - m.d) / 1.3));
    const a = f.tq * m.sp + m.ph;
    const tx = cx + Math.cos(a) * m.R, ty = cy + Math.sin(a) * m.R * .5;
    const arc = Math.sin(p * Math.PI) * 120;
    return { x: mix(m.sx, tx, p), y: mix(m.sy, ty, p) - arc, front: Math.sin(a) > 0 && p > .95, p };
  }
  add("room-burst", t2, 1, "flash", {
    draw(c, f) {
      const lt = f.lt;
      const stand = lt > .55;
      const pose: Pose = stand ? {
        x: 700, y: 950, s: 440, seated: false, arms: lt > 3.4 && lt < 5 ? "up" : "none",
        squash: key(lt, [[.55, -.12], [.8, .04], [1.0, 0]]) + .01 * Math.sin(lt * 2),
        turn: Math.sin(lt * 1.5) * .7, lookX: Math.sin(lt * 1.5) * .9, lookY: -.4,
        blink: blinkAt(lt, [2.6, 4.4]), mouth: lt < 2.8 ? "o" : "smile",
      } : {
        x: 700, y: 950, s: 440, phone: .3, glow: .4,
        squash: key(lt, [[0, 0], [.2, .1], [.4, .14]]), turn: 1, lookX: 1, lookY: -.6, mouth: "o",
      };
      c.save(); applyCam(c, CAM0);
      room(c, f, { lit: .3, open: easeOut(lt / .4), gold: smooth(.4, 3, lt) });
      if (stand) { c.fillStyle = "#cfdcff"; c.fillRect(840, 932, 44, 16); }
      drawHoodie(c, pose);
      c.restore();
      return { cam: CAM0, kids: [pose], mask: [pose] };
    },
    glow(c, f, s) {
      roomCityGlow(c, .3);
      lighter(c, () => {
        if (f.lt > .55) { c.globalAlpha = .4; c.drawImage(k.glowCold, 862 - 60, 940 - 60, 120, 120); c.globalAlpha = 1; }
        SWARM.forEach((m, i) => { const p = swarmPos(i, f, 700, 600); if (!p.front) moth(c, k, p.x, p.y, m.size, f.tq, m.ph); });
      });
    },
    front(c, f, s) {
      if (f.lt > .05 && f.lt < 1.1) bang(c, 760, 300, 50, f.hold, 1 - smooth(.8, 1.1, f.lt));
      lighter(c, () => SWARM.forEach((m, i) => { const p = swarmPos(i, f, 700, 600); if (p.front) moth(c, k, p.x, p.y, m.size, f.tq, m.ph); }));
      if (f.lt > 3.4 && f.lt < 5.2) for (let i = 0; i < 4; i++) sparkle(c, 560 + i * 90, 260 + Math.sin(f.tq * 3 + i) * 20, 14, .8);
    },
  });

  // 04 가까이: 나방 하나가 손끝에 앉는다
  add("hand-moth", snap(19.2), 1, "cut", {
    draw(c, f) {
      const lt = f.lt;
      const cam: Cam = { cx: 790 + lt * 4, cy: 560, z: 2.05 + lt * .01 };
      const land = smooth(.4, 2.6, lt);
      const pose: Pose = {
        x: 700, y: 950, s: 440, seated: false, arms: lt > .5 ? "out" : "none",
        squash: .01 * Math.sin(lt * 1.8), turn: key(lt, [[0, .3], [2.6, .7]]),
        lookX: key(lt, [[0, 1], [2.6, .9]]), lookY: key(lt, [[0, -.8], [2.6, .1]]),
        blink: blinkAt(lt, [1.4, 4.6]), mouth: lt < 3 ? "o" : "smile",
      };
      c.save(); applyCam(c, cam);
      room(c, f, { lit: .3, open: 1, gold: 1 });
      drawHoodie(c, pose);
      c.restore();
      return { cam, kids: [pose], mask: [pose], land };
    },
    glow(c, f, s) {
      lighter(c, () => {
        SWARM.forEach((m, i) => {
          const a = f.tq * m.sp + m.ph;
          if (Math.sin(a) > 0) return;
          moth(c, k, 700 + Math.cos(a) * m.R * 1.2, 560 + Math.sin(a) * m.R * .5, m.size, f.tq, m.ph, .8);
        });
      });
    },
    front(c, f, s) {
      const hand = handAt(s.kids[0], 1);
      const p = easeIO(s.land);
      const x = mix(1060, hand.x, p) + (1 - p) * Math.sin(f.tq * 6) * 20, y = mix(380, hand.y - 18, p) + (1 - p) * Math.cos(f.tq * 5) * 14;
      lighter(c, () => {
        moth(c, k, x, y, 16, p > .98 ? f.tq * .25 : f.tq, 1);
        if (p > .98) { c.globalAlpha = .5 * f.beat; c.drawImage(k.glowGold, x - 90, y - 90, 180, 180); }
      });
      if (f.lt > 3) for (let i = 0; i < 3; i++) sparkle(c, hand.x - 60 + i * 50, hand.y - 70 - i * 20 + Math.sin(f.tq * 4 + i) * 6, 9, smooth(3, 3.4, f.lt));
    },
  });

  // 05 창밖 지붕으로: 창에서 내려와 나방을 따라 걷는다. 멀리 큰 별
  add("climb-out", snap(24.7), 4, "cut", {
    draw(c, f) {
      const lt = f.lt;
      const jump = hop(lt, 1.5, 2.1, 70);
      const walkT = clamp((lt - 2.4) / (f.dur - 2.4));
      const x = lt < 1.5 ? 330 : lt < 2.1 ? mix(330, 440, jump.p) : mix(440, 1120, walkT);
      const y = lt < 1.5 ? 770 : lt < 2.1 ? mix(770, roofY(440, 830, -380, 5), jump.p) + jump.y : roofY(x, 830, -380, 5);
      const cam: Cam = { cx: 960 + (x - 700) * .3, cy: 540, z: 1 };
      const pose: Pose = {
        x, y, s: 300, seated: false, facing: 1, turn: .9, lookX: .6, lookY: -.3,
        walk: lt > 2.4 ? f.beatsF * Math.PI : undefined,
        squash: lt > 2.05 && lt < 2.35 ? .12 : lt < 1.5 ? .01 * Math.sin(lt * 2) : 0,
        blink: blinkAt(lt, [.9, 5.2]), mouth: "smile",
      };
      c.save(); applyCam(c, cam);
      skyFill(c, -200, 820);
      starfield(c, k, 700, f.tq);
      cloudBands(c, f.tq, 41, 4, 90, 80);
      farCity(c, 300, 330, .62, .3);
      roofs(c, 830, -380, 5);
      // 아이의 건물과 열린 창
      c.fillStyle = "#0c0e2e";
      c.fillRect(-300, 300, 640, 900);
      c.fillStyle = "#ffcf7a";
      c.fillRect(200, 560, 200, 220);
      c.fillStyle = "#080a22";
      c.fillRect(296, 560, 10, 220);
      c.fillRect(190, 770, 230, 14);
      if (lt < 1.5) {
        const glow = c.createRadialGradient(300, 670, 0, 300, 670, 260);
        glow.addColorStop(0, "rgba(255,190,110,.35)"); glow.addColorStop(1, "rgba(255,190,110,0)");
        c.fillStyle = glow; c.fillRect(0, 400, 600, 600);
      }
      drawHoodie(c, pose);
      c.restore();
      return { cam, kids: [pose], mask: [pose] };
    },
    glow(c, f, s) {
      farCityGlow(c, 300, 330, .62, .3);
      lighter(c, () => {
        c.globalAlpha = .6; c.drawImage(k.glowGold, 300 - 220, 670 - 220, 440, 440); c.globalAlpha = 1;
        starGlow(c, k, 1700, 160, 16, .6 + .2 * f.beat);
        const kid = s.kids[0];
        for (let i = 0; i < 8; i++) moth(c, k, kid.x + 140 + i * 70, kid.y - 220 - i * 22 + Math.sin(f.tq * 3 + i) * 16, 12, f.tq, i);
      });
    },
  });

  // 06 지붕을 걷는다(따라가는 카메라). 박마다 한 걸음
  add("roof-walk", snap(33), 6, "cut", {
    draw(c, f) {
      const scroll = f.lt * 150;
      const y = roofY(760, 830, scroll, 7);
      const pose: Pose = { x: 760, y, s: 300, seated: false, facing: 1, turn: .9, lookX: .7, lookY: -.2, walk: f.beatsF * Math.PI, blink: blinkAt(f.lt, [2.2, 4.8]), mouth: "smile" };
      c.save(); applyCam(c, CAM0);
      skyFill(c, -200, 820);
      starfield(c, k, 700, f.tq);
      cloudBands(c, f.tq, 43, 4, 80, 80);
      const off = (scroll * .15) % (W * .62);
      for (let n = 0; n < 3; n++) farCity(c, -off + n * W * .62, 330, .62, .32);
      roofs(c, 830, scroll, 7);
      drawHoodie(c, pose);
      // 앞을 지나가는 빨랫줄
      for (let i = 0; i < 3; i++) {
        const x = ((i * 900 - scroll * 1.7) % 2700 + 2700) % 2700 - 300;
        c.fillStyle = "#05061a";
        c.fillRect(x, 520, 14, 700);
        c.strokeStyle = "#05061a"; c.lineWidth = 4;
        c.beginPath(); c.moveTo(x, 540); c.quadraticCurveTo(x + 260, 620, x + 520, 540); c.stroke();
        c.fillRect(x + 120, 575, 60, 80); c.fillRect(x + 300, 580, 50, 64);
      }
      c.restore();
      return { cam: CAM0, kids: [pose], mask: [pose], off };
    },
    glow(c, f, s) {
      for (let n = 0; n < 3; n++) farCityGlow(c, -s.off + n * W * .62, 330, .62, .32);
      lighter(c, () => {
        starGlow(c, k, 1600, 150, 18, .6 + .25 * f.beat);
        for (let i = 0; i < 7; i++) moth(c, k, 900 + i * 85, 560 - i * 26 + Math.sin(f.tq * 3 + i) * 18, 12, f.tq, i);
      });
    },
  });

  // 07 올려다본 하늘: 큰 별을 발견하고 가리킨다
  add("look-up", snap(38.5), 8, "cut", {
    draw(c, f) {
      const lt = f.lt;
      const cam: Cam = { cx: 960, cy: 540 - 60 * smooth(0, f.dur, lt), z: 1 };
      const pose: Pose = { x: 640, y: 1110, s: 470, back: true, seated: false, rim: RIM, arms: lt > 2.2 ? "point" : "none", squash: key(lt, [[2, 0], [2.2, .05], [2.5, -.03], [2.7, 0]]) };
      c.save(); applyCam(c, cam);
      skyFill(c, -300, 1100, P.sky0, "#20255e");
      starfield(c, k, 1100, f.tq);
      cloudBands(c, f.tq, 45, 5, 120, 110, P.cloud, .6);
      c.fillStyle = "#06071c";
      c.fillRect(-300, 980, W + 600, 400);
      c.fillRect(1500, 760, 6, 230); c.fillRect(1460, 800, 90, 5);
      c.restore();
      drawHoodie(c, pose);
      return { cam: CAM0, skyCam: cam, kids: [pose], mask: [pose] };
    },
    glow(c, f, s) {
      c.save(); applyCam(c, s.skyCam);
      lighter(c, () => {
        starGlow(c, k, 1420, 260, 34 + 6 * f.beat, 1);
        for (let i = 0; i < 12; i++) {
          const v = ((hash(i, 701) + f.lt * .12) % 1);
          const x = mix(700, 1420, v) + Math.sin(v * 9 + i) * 120 * (1 - v);
          const y = mix(820, 270, v) + Math.cos(v * 7 + i) * 60 * (1 - v);
          moth(c, k, x, y, 14 * (1 - v * .6), f.tq, i, 1 - smooth(.85, 1, v));
        }
      });
      c.restore();
    },
  });

  // 08 별에 닿으려고 점프 → 모자라서 엉덩방아
  const EDGE = 1000, ROOF8 = 800, STAR8 = { x: 1500, y: 230 };
  function edgeScene(c: CanvasRenderingContext2D, f: F) {
    skyFill(c, -300, 1100);
    starfield(c, k, 1000, f.tq);
    cloudBands(c, f.tq, 51, 4, 110, 90);
    farCity(c, 0, 640, .9, .3);
    roofs(c, ROOF8, 0, 11, EDGE);
  }
  function edgeGlow(c: CanvasRenderingContext2D, f: F, starA = 1) {
    farCityGlow(c, 0, 640, .9, .3);
    lighter(c, () => starGlow(c, k, STAR8.x, STAR8.y, 30 + 5 * f.beat, starA));
  }
  add("jump-fail", snap(44), 9, "cut", {
    draw(c, f) {
      const lt = f.lt;
      const base = roofY(760, ROOF8, 0, 11);
      const j = hop(lt, 1.45, 2.45, 300);
      const landed = lt >= 2.45;
      const pose: Pose = landed ? {
        x: 880, y: base, s: 320, facing: 1, turn: .6, seated: true, arms: "none",
        squash: key(lt, [[2.45, .25], [2.9, 0]]), blink: lt < 3.2 ? 1 : 0, mouth: lt < 4.4 ? "o" : "flat", lookY: .4,
      } : {
        x: j.air ? mix(760, 880, j.p) : 760, y: base + (j.air ? j.y : 0), s: 320, seated: false, facing: 1, turn: .9,
        lookX: .7, lookY: -.8, arms: j.air ? "up" : "none",
        squash: j.air ? -.15 * (1 - j.p) : key(lt, [[1, 0], [1.45, .18]]), blink: blinkAt(lt, [.6]), mouth: j.air ? "o" : undefined,
      };
      c.save(); applyCam(c, CAM0);
      edgeScene(c, f);
      drawHoodie(c, pose);
      c.restore();
      return { cam: CAM0, kids: [pose], mask: [pose], base };
    },
    glow(c, f) { edgeGlow(c, f); },
    front(c, f, s) {
      const lt = f.lt;
      if (lt > .9 && lt < 4.2) {
        const pts = Array.from({ length: 24 }, (_, i) => bez({ x: 800, y: s.base - 60 }, { x: STAR8.x - 10, y: STAR8.y + 10 }, { x: 1150, y: 120 }, i / 23));
        dotted(c, pts, f.hold, smooth(.9, 1.2, lt) * (1 - smooth(3.8, 4.2, lt)));
      }
      if (lt > 2.55 && lt < 4.4) spiral(c, 900, s.base - 300, 30, f.tq, 1 - smooth(4, 4.4, lt));
      if (lt > 2.5 && lt < 3.3) for (let i = 0; i < 3; i++) sparkle(c, 880 + Math.cos(f.tq * 8 + i * 2) * 70, s.base - 320 + Math.sin(f.tq * 8 + i * 2) * 20, 10, .9);
    },
  });

  // 09 폰을 보며 한숨 → 몸을 쭉 늘려 봐도 안 닿는다 → 털썩
  add("stretch", snap(49.5), 9, "cut", {
    draw(c, f) {
      const lt = f.lt;
      const cam: Cam = { cx: 1000, cy: 520, z: 1.35 };
      const base = roofY(880, ROOF8, 0, 11);
      let pose: Pose;
      if (lt < 2.2) pose = { x: 880, y: base, s: 320, facing: 1, turn: .5, phone: 1, glow: .8, lookY: .7, mouth: "flat", squash: .03 * Math.sin(lt * 1.3) + key(lt, [[1.2, 0], [1.5, .06], [2.1, 0]]), blink: blinkAt(lt, [.8]) };
      else if (lt < 4.3) pose = {
        x: 880, y: base, s: 320, seated: false, facing: 1, turn: .8, arms: lt > 2.6 ? "up" : "none", lookX: .5, lookY: -1, mouth: "o",
        squash: key(lt, [[2.2, .1], [2.45, 0], [2.6, 0], [3.1, -.33], [4.3, -.33]]), lean: lt > 3.1 ? Math.sin(lt * 9) * .06 : 0, blink: lt > 3.4 ? .6 : 0,
      };
      else pose = { x: 880, y: base, s: 320, facing: 1, turn: .5, seated: true, arms: "none", squash: key(lt, [[4.3, .24], [4.7, 0]]), mouth: "flat", lookY: .5, blink: blinkAt(lt, [5.2]) };
      c.save(); applyCam(c, cam);
      edgeScene(c, f);
      drawHoodie(c, pose);
      c.restore();
      return { cam, kids: [pose], mask: [pose], base };
    },
    glow(c, f, s) {
      edgeGlow(c, f, .9);
      if (f.lt < 2.2) phoneLight(c, s.kids[0]);
    },
    front(c, f, s) {
      if (f.lt > 4.45) sweat(c, 960, s.base - 330, 16, smooth(4.45, 4.7, f.lt));
    },
  });

  // 10 나방이 모여 별까지 빛의 다리를 놓는다
  const BRIDGE = { a: { x: EDGE - 10, y: 795 }, b: { x: STAR8.x - 20, y: STAR8.y + 30 }, c: { x: 1380, y: 840 } };
  const bridgeAt = (v: number) => bez(BRIDGE.a, BRIDGE.b, BRIDGE.c, v);
  add("bridge", snap(55), 9, "cut", {
    draw(c, f) {
      const lt = f.lt;
      const base = roofY(900, ROOF8, 0, 11);
      const stand = lt > 4.4;
      const pose: Pose = stand
        ? { x: 900, y: base, s: 300, seated: false, facing: 1, turn: .9, lookX: .8, lookY: -.5, mouth: "smile", squash: key(lt, [[4.4, -.1], [4.7, 0]]) }
        : { x: 900, y: base, s: 300, facing: 1, turn: lt > 1.2 ? .8 : .4, seated: true, arms: "none", lookX: lt > 1.2 ? .8 : 0, lookY: lt > 1.2 ? -.5 : .6, mouth: lt > 3.6 ? "smile" : lt > 2.9 ? "o" : "flat", blink: blinkAt(lt, [.7, 3.2]) };
      const reveal = easeIO(smooth(2.8, 3.8, lt));
      c.save(); applyCam(c, CAM0);
      edgeScene(c, f);
      if (reveal > 0) {
        c.strokeStyle = "#b08f58"; c.lineWidth = 10; c.lineCap = "round";
        c.beginPath();
        for (let i = 0; i <= 40; i++) { const p = bridgeAt(i / 40 * reveal); if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }
        c.stroke();
      }
      drawHoodie(c, pose);
      c.restore();
      return { cam: CAM0, kids: [pose], mask: [pose], reveal };
    },
    glow(c, f, s) {
      edgeGlow(c, f);
      lighter(c, () => {
        if (s.reveal > 0) glowLine(c, Array.from({ length: 50 }, (_, i) => bridgeAt(i / 49 * s.reveal)), 3);
        for (let i = 0; i < 40; i++) {
          const v = i / 39;
          const tgt = bridgeAt(v);
          const sx = hash(i, 801) < .5 ? -80 + hash(i, 802) * 200 : W + 80 - hash(i, 802) * 200, sy = hash(i, 803) * 700;
          const p = easeIO(clamp((f.lt - .2 - i * .03) / 1.6));
          moth(c, k, mix(sx, tgt.x, p) + Math.sin(f.tq * 4 + i) * 10 * (1 - p * .7), mix(sy, tgt.y - 16, p) + Math.cos(f.tq * 5 + i) * 8, 12, f.tq, i, .9);
        }
      });
    },
    front(c, f, s) {
      if (f.lt > 2.9 && f.lt < 4) bang(c, 930, s.kids[0].y - 330, 40, f.hold, 1 - smooth(3.7, 4, f.lt));
    },
  });

  // 11 빛의 다리를 걸어 오른다. 디딜 때마다 빛이 번진다
  const SLOPE = -.42;
  add("bridge-walk", snap(60.5), 12, "cut", {
    draw(c, f) {
      const lt = f.lt;
      const x = 600 + lt * 135;
      const pathY = (xx: number) => 900 + (xx - 600) * SLOPE;
      const cam: Cam = { cx: x + 220, cy: pathY(x) - 160, z: 1 };
      const pose: Pose = { x, y: pathY(x), s: 300, seated: false, facing: 1, turn: .9, lookX: .7, lookY: -.4, walk: f.beatsF * Math.PI, mouth: "smile", blink: blinkAt(lt, [3.1, 6.4]) };
      // 하늘과 아래 도시는 화면에 고정(시차)
      skyFill(c, -200, 1100);
      starfield(c, k, 1000, f.tq);
      cloudBands(c, f.tq, 55, 4, 120, 100);
      farCity(c, 0, 560 + lt * 18, .9, .35);
      c.save(); applyCam(c, cam);
      c.strokeStyle = "#b08f58"; c.lineWidth = 12; c.lineCap = "round";
      c.beginPath(); c.moveTo(x - 1400, pathY(x - 1400)); c.lineTo(x + 1600, pathY(x + 1600)); c.stroke();
      drawHoodie(c, pose);
      c.restore();
      return { cam, kids: [pose], mask: [pose], x, pathY };
    },
    glow(c, f, s) {
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
      farCityGlow(c, 0, 560 + f.lt * 18, .9, .35);
      c.restore();
      lighter(c, () => {
        glowLine(c, [{ x: s.x - 1400, y: s.pathY(s.x - 1400) }, { x: s.x + 1600, y: s.pathY(s.x + 1600) }], 3.5);
        // 디딘 자리의 빛
        const r = f.beatAge * 260;
        if (f.beatAge < .6) { c.globalAlpha = 1 - f.beatAge / .6; c.drawImage(k.glowGold, s.x - r, s.pathY(s.x) - r * .35, r * 2, r * .7); c.globalAlpha = 1; }
        for (let i = 0; i < 10; i++) {
          const xx = s.x - 600 + i * 160;
          moth(c, k, xx, s.pathY(xx) - 60 - (i % 3) * 30 + Math.sin(f.tq * 3 + i) * 14, 11, f.tq, i, .85);
        }
      });
    },
  });

  // 12 브레이크: 다리 위에서 멀리 자기 방 창을 돌아보고, 폰을 주머니에 넣는다
  add("look-back", song.a.sections[5]?.start ?? snap(68.7), 13, "dip", {
    draw(c, f) {
      const lt = f.lt;
      const pathY = (xx: number) => 900 + (xx - 200) * -.38;
      const x = 1000 - 120 * (1 - easeOut(lt / 1.5));
      const back = lt > 1.8 && lt < 7.5;
      const phoneUp = lt > 3 && lt < 6.3;
      const pose: Pose = {
        x, y: pathY(x), s: 330, seated: false, facing: back ? -1 : 1, turn: .9,
        lookX: back ? .6 : .6, lookY: back ? .6 : -.6, walk: lt < 1.5 ? f.beatsF * Math.PI : undefined,
        phone: phoneUp ? 1 : undefined, glow: phoneUp ? .8 : 0, arms: phoneUp ? "phone" : "none",
        mouth: lt > 7.8 ? "smile" : "flat", blink: blinkAt(lt, [2.5, 5, 7.2, 9]),
        squash: key(lt, [[6.3, 0], [6.5, .06], [6.8, 0], [8.4, 0], [8.6, .07], [8.9, 0]]) + .01 * Math.sin(lt * 1.5),
      };
      const cam: Cam = { cx: 960 + 30 * smooth(0, f.dur, lt), cy: 540, z: 1 + .06 * smooth(0, f.dur, lt) };
      c.save(); applyCam(c, cam);
      skyFill(c, -300, 1100);
      starfield(c, k, 1100, f.tq);
      cloudBands(c, f.tq, 57, 4, 140, 120, P.cloud, .5);
      farCity(c, -200, 760, .8, .1);
      c.strokeStyle = "#b08f58"; c.lineWidth = 12; c.lineCap = "round";
      c.beginPath(); c.moveTo(-200, pathY(-200)); c.lineTo(2200, pathY(2200)); c.stroke();
      drawHoodie(c, pose);
      c.restore();
      return { cam, kids: [pose], mask: [pose], pathY };
    },
    glow(c, f, s) {
      farCityGlow(c, -200, 760, .8, .1);
      lighter(c, () => {
        // 집 창 하나
        c.globalAlpha = .8 + .2 * f.beat;
        c.drawImage(k.glowGold, 230 - 50, 990 - 50, 100, 100);
        c.globalAlpha = 1;
        glowLine(c, [{ x: -200, y: s.pathY(-200) }, { x: 2200, y: s.pathY(2200) }], 3, .9);
        for (let i = 0; i < 9; i++) {
          const xx = 150 + i * 210;
          moth(c, k, xx, s.pathY(xx) - 40, 10, f.tq * .35, i, .8);
        }
        starGlow(c, k, 1750, 160, 26, .8);
      });
      if (s.kids[0].phone) phoneLight(c, s.kids[0]);
    },
  });

  // 13 1:19 큰 훅: 별에서 빛의 실이 쏟아져 들판으로 흘러온다
  const THREADS = 15;
  function threadPoint(n: number, v: number, tq: number) {
    const spread = (hash(n, 41) * 2 - 1) * (.5 + .5 * hash(n, 42));
    const freq = 1.2 + hash(n, 43) * 1.6;
    const amp = 8 + 110 * v;
    return {
      x: 960 + spread * Math.pow(v, 1.25) * 1100 + Math.sin(v * freq * Math.PI * 2 - tq * (1.6 + hash(n, 44)) + n) * amp,
      y: 300 + 860 * Math.pow(v, 1.5),
    };
  }
  add("threads", song.a.sections[6]?.start ?? snap(79.5), 3, "flash", {
    draw(c, f) {
      const lt = f.lt;
      const z = 1 + .03 * smooth(0, 6, lt);
      const cam: Cam = { cx: 960, cy: 500 + 40 / z, z };
      const reveal = easeIO(clamp(lt / .7));
      c.save(); applyCam(c, cam);
      skyFill(c, -200, 340);
      starfield(c, k, 330, f.tq);
      cloudBands(c, f.tq, 51, 6, 70, 48);
      const ground = c.createLinearGradient(0, 330, 0, H);
      ground.addColorStop(0, "#141846");
      ground.addColorStop(1, "#1d2156");
      c.fillStyle = ground;
      c.fillRect(-200, 330, W + 400, H);
      c.lineCap = "round";
      for (const b of k.blades) {
        c.strokeStyle = b.c < .5 ? "#0f1238" : "#2a2f6c";
        c.lineWidth = 1 + b.h * .08;
        c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x + (b.c - .5) * b.h * .4, b.y - b.h); c.stroke();
      }
      c.strokeStyle = "#a88a55";
      c.lineWidth = 6;
      for (let n = 0; n < THREADS; n++) {
        c.beginPath();
        for (let i = 0; i <= 60; i++) { const p = threadPoint(n, i / 60 * reveal, f.tq); if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }
        c.stroke();
      }
      c.fillStyle = P.goldCore;
      c.beginPath(); c.arc(960, 300, 16, 0, Math.PI * 2); c.fill();
      const pose: Pose = { x: 700, y: 1100, s: 300, back: true, seated: false, rim: RIM, arms: lt > 3.6 ? "up" : "none", squash: key(lt, [[0, 0], [.12, .1], [.35, -.06], [.6, 0]]) + .01 * Math.sin(lt * 1.7) };
      drawHoodie(c, pose);
      c.restore();
      return { cam, kids: [pose], mask: [pose], reveal };
    },
    glow(c, f, s) {
      lighter(c, () => {
        c.globalAlpha = .7 + .3 * f.beat;
        c.drawImage(k.glowGold, 960 - 420, 300 - 420, 840, 840);
        c.drawImage(k.glowWhite, 960 - 70, 300 - 70, 140, 140);
        c.globalAlpha = 1;
        for (let n = 0; n < THREADS; n++) {
          glowLine(c, Array.from({ length: 91 }, (_, i) => threadPoint(n, i / 90 * s.reveal, f.tq)));
          for (let j = 0; j < 3; j++) {
            const v = ((hash(n, 60 + j) + f.tq * .09) % 1) * s.reveal;
            const p = threadPoint(n, v, f.tq);
            c.globalAlpha = .9;
            c.drawImage(k.glowGold, p.x - 14 - v * 10, p.y - 14 - v * 10, 28 + v * 20, 28 + v * 20);
            c.globalAlpha = 1;
          }
        }
        for (let i = 0; i < 14; i++) {
          const v = 1 - ((hash(i, 71) + f.lt * (.07 + hash(i, 72) * .05)) % 1);
          const p = threadPoint(i % THREADS, v * s.reveal, f.tq);
          moth(c, k, p.x + Math.sin(f.tq * 3 + i) * 30, p.y - 20, 6 + v * 10, f.tq, i);
        }
      });
    },
  });

  // 14 실을 잡고 날아오른다(옆에서)
  add("fly-side", snap(85), 14, "cut", {
    draw(c, f) {
      const lt = f.lt;
      const off = (lt * 260) % (W * .55);
      const pose: Pose = {
        x: 900, y: 600 + Math.sin(f.tq * 2) * 22, s: 300, seated: false, facing: 1, turn: .9, arms: "fly", lean: .35,
        lookX: .8, lookY: -.3, mouth: lt < 1.5 ? "o" : "smile", squash: lt < .6 ? -.2 * (1 - lt / .6) : .01 * Math.sin(lt * 3),
      };
      skyFill(c, -200, 1100);
      starfield(c, k, 1000, f.tq);
      cloudBands(c, f.tq * 6, 61, 5, 120, 120, P.cloud, 1.5);
      for (let n = 0; n < 4; n++) farCity(c, -off + n * W * .55, 760, .55, .35);
      drawHoodie(c, pose);
      return { cam: CAM0, kids: [pose], mask: [pose], off };
    },
    glow(c, f, s) {
      for (let n = 0; n < 4; n++) farCityGlow(c, -s.off + n * W * .55, 760, .55, .35);
      const kid = s.kids[0], hand = handAt(kid, 1);
      lighter(c, () => {
        glowLine(c, Array.from({ length: 30 }, (_, i) => { const v = i / 29; return { x: mix(hand.x, 2150, v), y: mix(hand.y, -250, v) + Math.sin(v * 7 - f.tq * 4) * 30 * v }; }), 2.6);
        for (let i = 0; i < 12; i++) moth(c, k, kid.x - 150 - i * 85 + Math.sin(f.tq * 4 + i) * 14, kid.y - 120 + Math.cos(f.tq * 3 + i) * 40, 12, f.tq, i, 1 - i / 14);
      });
    },
    front(c, f, s) { speedLines(c, s.kids[0].x - 110, s.kids[0].y - 150, 1, 150, f.hold, .8); },
  });

  // 15 등 뒤에서: 도시 불빛을 향해 날아간다. 금빛 거리가 소실점으로 모이고, 날아가는 만큼 다가온다
  const VP = { x: 960, y: 500 };
  function streets(lt: number) {
    const lines: { x: number; y: number }[][] = [];
    // 세로 길은 간격이 들쭉날쭉하고, 가로 길은 군데군데 빠진다(반듯한 격자처럼 보이지 않게)
    for (let i = -7; i <= 7; i++) lines.push([VP, { x: VP.x + i * 330 + (hash(i + 20, 961) - .5) * 220, y: H + 40 }]);
    const fly = lt * 1.1;
    for (let j = 0; j < 14; j++) {
      const id = Math.floor(j + fly);
      if (hash(id, 962) < .3) continue;
      const z = 14 - ((j + fly) % 14);
      const y = VP.y + 600 / z;
      if (y > H + 40) continue;
      const half = (y - VP.y) / (H + 40 - VP.y) * 9 * 260;
      lines.push([{ x: VP.x - half, y }, { x: VP.x + half, y }]);
    }
    return lines;
  }
  add("fly-city", snap(90.5), 15, "cut", {
    draw(c, f) {
      const lt = f.lt;
      skyFill(c, -200, VP.y + 10);
      starfield(c, k, VP.y - 40, f.tq);
      cloudBands(c, f.tq * 3, 87, 4, 90, 80);
      for (let n = -1; n <= 1; n++) farCity(c, 480 + n * W * .5, VP.y - HORIZON * .5 + 6, .5, .45);
      const ground = c.createLinearGradient(0, VP.y, 0, H);
      ground.addColorStop(0, "#0d1034");
      ground.addColorStop(1, "#05061a");
      c.fillStyle = ground;
      c.fillRect(0, VP.y, W, H - VP.y);
      c.strokeStyle = "#5e4a32";
      c.lineWidth = 3;
      c.beginPath();
      for (const [a, b] of streets(lt)) { c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }
      c.stroke();
      const pose: Pose = { x: 960 + Math.sin(lt * .9) * 140, y: 820 + Math.sin(f.tq * 2) * 14, s: 250, back: true, seated: false, arms: "fly", lean: Math.cos(lt * .9) * .18, rim: RIM };
      drawHoodie(c, pose);
      return { cam: CAM0, kids: [pose], mask: [pose] };
    },
    glow(c, f, s) {
      for (let n = -1; n <= 1; n++) farCityGlow(c, 480 + n * W * .5, VP.y - HORIZON * .5 + 6, .5, .45);
      lighter(c, () => {
        c.strokeStyle = "rgba(255,190,100,.05)";
        c.lineWidth = 22;
        c.beginPath();
        for (const [a, b] of streets(f.lt)) { c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }
        c.stroke();
        c.strokeStyle = "rgba(255,226,160,.24)";
        c.lineWidth = 2;
        c.stroke();
        c.globalAlpha = .5;
        c.drawImage(k.glowGold, VP.x - 500, VP.y - 160, 1000, 320);
        c.globalAlpha = 1;
        const kid = s.kids[0];
        for (let i = 0; i < 14; i++) {
          const v = ((hash(i, 951) + f.lt * .35) % 1);
          moth(c, k, mix(kid.x + (hash(i, 952) - .5) * 500, VP.x + (hash(i, 953) - .5) * 200, v), mix(kid.y - 200, VP.y + 20, v), 13 * (1 - v * .8), f.tq, i, 1 - smooth(.8, 1, v));
        }
      });
    },
  });

  // 16 정면으로 날아오는 아이. 박마다 하트가 터진다
  add("fly-joy", snap(96), 16, "cut", {
    draw(c, f) {
      const lt = f.lt;
      const bg = c.createRadialGradient(960, 600, 0, 960, 600, 1100);
      bg.addColorStop(0, "#22275e");
      bg.addColorStop(1, P.sky0);
      c.fillStyle = bg;
      c.fillRect(0, 0, W, H);
      c.strokeStyle = "rgba(190,195,255,.45)";
      c.lineWidth = 2.5;
      c.beginPath();
      for (let i = 0; i < 140; i++) {
        const a = hash(i, 31) * Math.PI * 2;
        const z = (hash(i, 33) + f.tq * (.25 + .3 * hash(i, 32))) % 1;
        if (z < .2) continue;
        const r1 = 60 / (1.04 - z), r0 = 60 / (1.04 - Math.max(0, z - .03));
        c.moveTo(960 + Math.cos(a) * r0, 600 + Math.sin(a) * r0);
        c.lineTo(960 + Math.cos(a) * r1, 600 + Math.sin(a) * r1);
      }
      c.stroke();
      const pose: Pose = {
        x: 960, y: 820 + Math.sin(f.tq * 2.4) * 18, s: 520, seated: false, arms: "up", mouth: "smile",
        lookY: -.2, blink: blinkAt(lt, [2.5]), squash: .035 * f.beat,
      };
      drawHoodie(c, pose);
      return { cam: CAM0, kids: [pose], mask: [pose] };
    },
    glow(c, f) {
      lighter(c, () => {
        for (let i = 0; i < 18; i++) {
          const a = f.tq * 1.4 + i / 18 * Math.PI * 2;
          const r = 380 + 40 * Math.sin(i * 1.7);
          moth(c, k, 960 + Math.cos(a) * r, 560 + Math.sin(a) * r * .45, 14, f.tq, i, .9);
        }
      });
    },
    front(c, f) {
      const beats = f.song.a.beats;
      for (let j = f.song.beatIndex(f.tq); j >= 0 && f.tq - beats[j] < 1.3; j--) {
        if (beats[j] < f.t - f.lt) break;
        const age = f.tq - beats[j];
        const x = 960 + (hash(j, 1) - .5) * 900, y = 520 + (hash(j, 2) - .5) * 380 - age * 130;
        heart(c, x, y, 30 + hash(j, 3) * 22, 1 - age / 1.3);
        sparkle(c, x + 50, y - 40, 10, 1 - age / 1.3);
      }
    },
  });

  // 17 구름 사이를 감아 오르는 나선의 실
  function helix(n: number, u: number, tq: number) {
    const a = u * Math.PI * 6 + tq * .7 + n * Math.PI * 2 / 3;
    const r = 360 * (.65 + .35 * u);
    return { x: 960 + Math.cos(a) * r, y: 1150 - u * 1500, a };
  }
  add("spiral", snap(101.5), 17, "cut", {
    draw(c, f) {
      const lt = f.lt;
      const u = .12 + .62 * (lt / f.dur);
      const hp = helix(0, u, f.tq);
      const cam: Cam = { cx: 960, cy: hp.y + 40, z: 1 };
      const facing = -Math.sin(hp.a) >= 0 ? 1 : -1;
      const pose: Pose = { x: hp.x, y: hp.y + 40, s: 230 * (1 + .25 * Math.sin(hp.a)), seated: false, facing, turn: .8, arms: "fly", lean: .25, mouth: "smile", lookY: -.4 };
      c.save(); applyCam(c, cam);
      skyFill(c, -1500, 1400);
      starfield(c, k, 1100, f.tq);
      cloudBands(c, f.tq, 71, 4, 250, 160, P.cloudLit);
      cloudBands(c, f.tq, 73, 4, -500, 160, P.cloud);
      cloudSea(c, 980, f.tq, 75);
      c.strokeStyle = "#a88a55"; c.lineWidth = 5;
      for (let n = 0; n < 3; n++) {
        c.beginPath();
        for (let i = 0; i <= 120; i++) { const p = helix(n, i / 120, f.tq); if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }
        c.stroke();
      }
      drawHoodie(c, pose);
      c.restore();
      return { cam, kids: [pose], mask: [pose], u };
    },
    glow(c, f, s) {
      lighter(c, () => {
        for (let n = 0; n < 3; n++) glowLine(c, Array.from({ length: 160 }, (_, i) => helix(n, i / 159, f.tq)), 2.4);
        for (let i = 0; i < 16; i++) {
          const p = helix(i % 3, ((hash(i, 81) + f.lt * .05) % 1), f.tq);
          moth(c, k, p.x, p.y - 20, 12, f.tq, i, .9);
        }
      });
    },
  });

  // 18 거대한 달 앞을 지나간다
  add("moon", snap(112.4), 18, "cut", {
    draw(c, f) {
      const lt = f.lt;
      const pose: Pose = { x: mix(-150, 2050, lt / f.dur), y: 520 + Math.sin(lt * 1.4) * 40, s: 260, back: true, seated: false, arms: "fly", lean: .3, rim: "rgba(255,240,205,.95)" };
      skyFill(c, -200, 1100);
      starfield(c, k, 1000, f.tq);
      moonDisc(c, 1250, 470, 360);
      cloudSea(c, 880, f.tq, 77, lt * 90, "#4c4888", "#1f2060");
      drawHoodie(c, pose);
      return { cam: CAM0, kids: [pose], mask: [pose] };
    },
    glow(c, f, s) {
      const kid = s.kids[0], hand = handAt(kid, 1);
      lighter(c, () => {
        c.globalAlpha = .35;
        c.drawImage(k.glowWhite, 1250 - 700, 470 - 700, 1400, 1400);
        c.globalAlpha = 1;
        glowLine(c, Array.from({ length: 24 }, (_, i) => { const v = i / 23; return { x: mix(hand.x, hand.x + 900, v), y: mix(hand.y, -200, v) + Math.sin(v * 6 - f.tq * 3) * 26 * v }; }), 2.2);
        for (let i = 0; i < 10; i++) moth(c, k, kid.x - 120 - i * 80, kid.y - 90 + Math.sin(f.tq * 3 + i) * 30, 11, f.tq, i, 1 - i / 12);
      });
    },
  });

  // 19 구름 위에 앉아 쉰다. 별이 가까워졌다
  add("cloud-rest", song.a.sections[7]?.start ?? snap(123.3), 19, "dip", {
    draw(c, f) {
      const lt = f.lt;
      const pose: Pose = {
        x: 820, y: 770, s: 360, turn: .4, arms: "none",
        lookX: lt < 4 ? .5 : .6, lookY: lt < 4 ? .4 : -.7, mouth: lt > 6 ? "smile" : undefined,
        blink: blinkAt(lt, [2.1, 5.3, 8.8]), squash: .015 * Math.sin(lt * 1.3),
      };
      skyFill(c, -200, 1100);
      starfield(c, k, 900, f.tq);
      moonDisc(c, 330, 300, 130);
      cloudSea(c, 770, f.tq * .4, 79, 0, "#57528f", "#232465");
      drawHoodie(c, pose);
      return { cam: CAM0, kids: [pose], mask: [pose] };
    },
    glow(c, f) {
      lighter(c, () => {
        c.globalAlpha = .3; c.drawImage(k.glowWhite, 330 - 330, 300 - 330, 660, 660); c.globalAlpha = 1;
        starGlow(c, k, 1450, 220, 40 + 6 * f.beat, 1);
        for (let i = 0; i < 16; i++) {
          const x = 120 + i * 112 + hash(i, 85) * 40;
          moth(c, k, x, 740 + hash(i, 86) * 60, 9, f.tq * .3, i, .45 + .45 * Math.sin(f.tq * 1.6 + i));
        }
      });
    },
  });

  // 20 2:14 마지막 훅: 구름을 징검다리처럼 뛰어 별로
  add("cloud-hop", song.a.sections[8]?.start ?? snap(134.3), 20, "flash", {
    draw(c, f) {
      const ph = (f.beatsF % 2) / 2;
      const y = 790 - 4 * 170 * ph * (1 - ph);
      const pose: Pose = {
        x: 760, y, s: 300, seated: false, facing: 1, turn: .9, lookX: .7, lookY: -.4, mouth: "smile",
        arms: ph > .08 && ph < .92 ? "up" : "none", squash: ph < .08 ? .16 * (1 - ph / .08) : -.07,
      };
      skyFill(c, -200, 1100);
      starfield(c, k, 900, f.tq);
      cloudSea(c, 820, f.tq, 81, f.lt * 300, "#5a5596", "#24256a");
      drawHoodie(c, pose);
      return { cam: CAM0, kids: [pose], mask: [pose], ph };
    },
    glow(c, f, s) {
      lighter(c, () => {
        starGlow(c, k, 1640, 190, 50 + 8 * f.beat, 1);
        const kid = s.kids[0];
        for (let i = 0; i < 8; i++) moth(c, k, kid.x - 140 - i * 90, kid.y - 160 + Math.sin(f.tq * 3 + i) * 40, 11, f.tq, i, 1 - i / 10);
      });
    },
    front(c, f, s) {
      const bl = f.song.beatLength;
      const pts = Array.from({ length: 16 }, (_, j) => {
        const back = j * .05;
        const ph = (((f.beatsF - back / bl) % 2) + 2) % 2 / 2;
        return { x: 760 - back * 300, y: 790 - 4 * 170 * ph * (1 - ph) - 150 };
      });
      dotted(c, pts, f.hold, .8, false);
    },
  });

  // 21 실을 타고 곧장 별로 오른다
  add("ascent", snap(145.3), 21, "cut", {
    draw(c, f) {
      const lt = f.lt, prog = lt / f.dur;
      skyFill(c, -200, 1100, "#05071e", "#151a4a");
      c.strokeStyle = "rgba(200,205,255,.5)";
      c.lineWidth = 2;
      c.beginPath();
      for (let i = 0; i < 140; i++) {
        const x = hash(i, 51) * W, sp = 600 + 700 * hash(i, 52);
        const y = ((hash(i, 53) * (H + 200) + lt * sp) % (H + 200)) - 100;
        c.moveTo(x, y); c.lineTo(x, y - 20 - sp * .03);
      }
      c.stroke();
      c.fillStyle = P.cloud;
      for (let i = 0; i < 5; i++) {
        const y = ((hash(i, 55) * 1800 + lt * 520) % 1800) - 400;
        c.beginPath(); c.ellipse(hash(i, 56) * W, y, 320, 40, 0, 0, Math.PI * 2); c.fill();
      }
      const pose: Pose = { x: 960, y: 900 + Math.sin(f.tq * 2) * 10, s: 380, back: true, seated: false, arms: "up", rim: RIM };
      drawHoodie(c, pose);
      return { cam: CAM0, kids: [pose], mask: [pose], prog };
    },
    glow(c, f, s) {
      const sy = mix(40, 230, s.prog), sr = mix(40, 150, easeIO(s.prog));
      lighter(c, () => {
        starGlow(c, k, 960, sy, sr + 10 * f.beat, 1);
        glowLine(c, Array.from({ length: 40 }, (_, i) => { const v = i / 39; return { x: 960 + Math.sin(v * 8 - f.tq * 5) * 14 * (1 - v), y: mix(sy, H + 50, v) }; }), 2.6);
        for (let i = 0; i < 24; i++) {
          const a = f.tq * 2 + i / 24 * Math.PI * 2;
          const yy = 700 - ((f.lt * 260 + i * 60) % 900) + 300;
          moth(c, k, 960 + Math.cos(a) * (260 + 40 * Math.sin(i)), yy + Math.sin(a) * 60, 12, f.tq, i, .9);
        }
      });
    },
  });

  // 22 별에 손이 닿는다 → 터진 빛이 작은 구슬이 되어 품에 안긴다. 나방들은 별이 된다
  add("reach", snap(156.3), 22, "cut", {
    draw(c, f) {
      const lt = f.lt, touch = f.song.beatLength * 4;
      const warm = smooth(touch, f.dur, lt) * .8;
      skyFill(c, -200, 1100, P.sky0, mixColor("#191d4e", "#7a4f80", warm));
      starfield(c, k, 1100, f.tq, 1 + smooth(touch, touch + 2, lt));
      const front = lt > touch + 2.2;
      const pose: Pose = front
        ? { x: 960, y: 1000, s: 420, seated: false, arms: "hold", orb: 1, mouth: "smile", lookY: -.2, blink: blinkAt(lt, [touch + 3.6, touch + 6]), squash: key(lt, [[touch + 2.2, .12], [touch + 2.5, 0]]) + .015 * Math.sin(lt * 2) }
        : { x: 960, y: 1000, s: 420, back: true, seated: false, arms: "up", rim: RIM, squash: key(lt, [[0, 0], [touch - .4, -.12], [touch, -.12], [touch + .3, .06], [touch + .6, 0]]) };
      drawHoodie(c, pose);
      return { cam: CAM0, kids: [pose], mask: front ? [] : [pose], touch, front };
    },
    glow(c, f, s) {
      const lt = f.lt, touch = s.touch;
      lighter(c, () => {
        if (lt < touch) starGlow(c, k, 960, 330, mix(150, 200, lt / touch) + 10 * f.beat, 1);
        else {
          const r = (lt - touch) * 1400;
          c.globalAlpha = clamp(1 - (lt - touch) / 1.2);
          c.drawImage(k.glowWhite, 960 - r, 330 - r, r * 2, r * 2);
          c.globalAlpha = 1;
          const hc = handsCenter(s.kids[0]);
          const p = easeIO(clamp((lt - touch) / 1.6));
          const ox = mix(960, hc.x, p), oy = mix(330, s.front ? hc.y : 760, p);
          c.drawImage(k.glowGold, ox - 140, oy - 140, 280, 280);
          c.drawImage(k.glowWhite, ox - 36, oy - 36, 72, 72);
        }
        // 나방: 별 둘레를 돌다가, 닿는 순간 바깥으로 흩어져 별이 된다
        for (let i = 0; i < 30; i++) {
          const a = f.tq * 1.2 + i / 30 * Math.PI * 2;
          if (lt < touch) moth(c, k, 960 + Math.cos(a) * 300, 330 + Math.sin(a) * 120, 12, f.tq, i, .9);
          else {
            const q = easeOut((lt - touch) / 2);
            const x = 960 + Math.cos(i * 2.4) * (300 + q * 900), y = 330 + Math.sin(i * 2.4) * (120 + q * 500);
            if (q < .9) moth(c, k, x, y, 12 * (1 - q), f.tq, i, 1 - q);
            c.globalAlpha = q * (.6 + .4 * Math.sin(f.tq * 3 + i));
            c.drawImage(k.glowWhite, x - 10, y - 10, 20, 20);
            c.globalAlpha = 1;
          }
        }
      });
    },
    front(c, f, s) {
      const lt = f.lt, touch = s.touch;
      if (lt > touch && lt < touch + .45) { c.fillStyle = `rgba(255,240,215,${.8 * (1 - (lt - touch) / .45)})`; c.fillRect(-500, -500, W + 1000, H + 1000); }
      if (lt > touch + 2.6) for (let i = 0; i < 5; i++) {
        const ph = ((lt - touch - 2.6) * .4 + i / 5) % 1;
        heart(c, 960 + Math.cos(i * 1.9) * 260, 640 - ph * 260, 28 + i * 3, Math.sin(ph * Math.PI));
      }
    },
  });

  // 23 2:47 새벽: 창가에서 잠든 아이, 품의 빛 구슬, 창틀의 나방 한 마리. 글자는 넣지 않는다
  add("dawn", song.a.sections[9]?.start ?? snap(167.3), 23, "dip", {
    draw(c, f) {
      const lt = f.lt;
      const pose: Pose = { x: 1180, y: 950, s: 400, lean: .12, turn: -.3, arms: "hold", orb: .6, blink: 1, mouth: "smile", squash: .015 * Math.sin(lt * 1.1) };
      c.save(); applyCam(c, { cx: 960 + 40 * smooth(0, f.dur, lt), cy: 540, z: 1 + .04 * smooth(0, f.dur, lt) });
      room(c, f, { lit: .22, dawn: .45 + .55 * smooth(0, 8, lt) });
      drawHoodie(c, pose);
      c.restore();
      return { cam: { cx: 960 + 40 * smooth(0, f.dur, lt), cy: 540, z: 1 + .04 * smooth(0, f.dur, lt) }, kids: [pose] };
    },
    glow(c, f, s) {
      roomCityGlow(c, .22);
      const hc = handsCenter(s.kids[0]);
      lighter(c, () => {
        c.globalAlpha = .55 + .15 * Math.sin(f.tq * 1.2);
        c.drawImage(k.glowGold, hc.x - 160, hc.y - 160, 320, 320);
        c.globalAlpha = 1;
        moth(c, k, 1520, 752, 16, f.tq * .25, 0);
      });
    },
  });


  // 팀 시연용 엔딩(옵션): 새벽하늘 아래 지붕의 아이. 품과 도시 창에서 나방이 날아올라 글자를 이룬다
  if (opts.ending === "tel") {
    const TEXT = "Technology Expert Lab";
    const TY = 400;
    // 글자 모양을 한 번 그려서 나방이 앉을 자리를 뽑는다(엇갈린 격자)
    const targets: { x: number; y: number }[] = [];
    const halo = document.createElement("canvas");
    halo.width = W; halo.height = H;
    {
      const m = document.createElement("canvas");
      m.width = W; m.height = 300;
      const mg = m.getContext("2d", { willReadFrequently: true })!;
      mg.font = '700 128px "Pretendard Variable", Pretendard, sans-serif';
      mg.textAlign = "center";
      mg.textBaseline = "middle";
      mg.fillStyle = "#fff";
      mg.fillText(TEXT, W / 2, 150);
      const d = mg.getImageData(0, 0, W, 300).data;
      // 나방 하나하나가 보이는 간격(촘촘하면 흰 글씨처럼 뭉친다)
      const step = 10.5;
      for (let y = 0, row = 0; y < 300; y += step, row++) for (let x = row % 2 ? step / 2 : 0; x < W; x += step) {
        if (d[((y | 0) * W + (x | 0)) * 4 + 3] > 140) targets.push({ x, y: y - 150 + TY });
      }
      targets.sort((a, b) => hash(a.x | 0, a.y | 0) - hash(b.x | 0, b.y | 0));
      const hg = halo.getContext("2d")!;
      hg.filter = "blur(14px)";
      hg.drawImage(m, 0, TY - 150);
    }
    const KID = { x: 430, y: 1010 };
    add("tel-end", snap(172.85), 24, "cut", {
      draw(c, f) {
        const sky = c.createLinearGradient(0, -100, 0, 1000);
        sky.addColorStop(0, "#232458");
        sky.addColorStop(.55, "#6c4f86");
        sky.addColorStop(1, "#d9976c");
        c.fillStyle = sky;
        c.fillRect(-200, -200, W + 400, 1300);
        starfield(c, k, 380, f.tq, .6);
        cloudBands(c, f.tq, 97, 5, 120, 90, "rgba(226,160,176,.32)", .5);
        for (let n = 0; n < 2; n++) farCity(c, n * W * .55, 1000 - HORIZON * .55, .55, .2);
        c.fillStyle = "#080a22";
        c.fillRect(-200, 1000, W + 400, 200);
        c.fillStyle = "#2a2e6c";
        c.fillRect(-200, 1000, W + 400, 6);
        const pose: Pose = { x: KID.x, y: KID.y, s: 220, back: true, rim: RIM, squash: .01 * Math.sin(f.lt * 1.3) };
        drawHoodie(c, pose);
        return { cam: CAM0, kids: [pose], mask: [pose] };
      },
      glow(c, f) {
        for (let n = 0; n < 2; n++) farCityGlow(c, n * W * .55, 1000 - HORIZON * .55, .55, .2);
        const lt = f.lt;
        const formed = smooth(2.2, 3, lt);
        lighter(c, () => {
          // 아이 품의 빛
          c.globalAlpha = .6;
          c.drawImage(k.glowGold, KID.x - 120, KID.y - 210, 240, 240);
          c.globalAlpha = .2 * formed * (.85 + .15 * f.beat);
          c.drawImage(halo, 0, 0);
          c.globalAlpha = 1;
          targets.forEach((p, i) => {
            const fromKid = i % 2 === 0;
            const sx = fromKid ? KID.x + (hash(i, 991) - .5) * 60 : hash(i, 992) * W;
            const sy = fromKid ? KID.y - 110 : 700 + hash(i, 993) * 260;
            const q = easeIO(clamp((lt - .3 - hash(i, 994) * 1.2) / 1.2));
            if (q <= 0) return;
            const cx = (sx + p.x) / 2 + (hash(i, 995) - .5) * 500, cy = Math.min(sy, p.y) - 200 - hash(i, 996) * 200;
            const at = bez({ x: sx, y: sy }, p, { x: cx, y: cy }, q);
            const jit = q >= 1 ? Math.sin(f.tq * 2 + i) * 1.2 : 0;
            moth(c, k, at.x + jit, at.y + jit * .6, 6.5, q >= 1 ? f.tq * .35 : f.tq, i, .72);
          });
        });
      },
    });
  }

  /* ── 컷 정리와 한 프레임 ──────────────────────────── */

  shots.sort((a, b) => a.start - b.start);
  shots.forEach((s, i) => { s.end = i + 1 < shots.length ? shots[i + 1].start : song.duration; });

  function render(t: number) {
    t = clamp(t, 0, song.duration);
    const tq = Math.floor(t * STEP + 1e-6) / STEP;
    let i = shots.findIndex((s) => t >= s.start && t < s.end);
    if (i < 0) i = shots.length - 1;
    const shot = shots[i];
    const b0 = song.beatIndex(shot.start + .02);
    const tqq = Math.max(tq, shot.start);
    const beatAge = song.sinceBeat(tqq);
    const f: F = {
      t, tq: tqq, lt: tqq - shot.start, dur: shot.end - shot.start, hold: Math.floor(t * 7.5 + 1e-6),
      song, k, beatAge, downAge: song.sinceDownbeat(tqq), beat: pulse(beatAge, .2),
      beatsF: Math.max(0, song.beatIndex(tqq) - b0) + (beatAge === Infinity ? 0 : Math.min(1, beatAge / song.beatLength)),
      level: song.feature("level", tqq),
    };

    cg.setTransform(.5, 0, 0, .5, 0, 0);
    cg.globalCompositeOperation = "source-over";
    cg.globalAlpha = 1;
    cg.fillStyle = P.sky0;
    cg.fillRect(0, 0, W, H);
    const s = shot.draw(cg, f);

    paint(g, clean, f.hold, { flowSeed: shot.seed });

    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.globalCompositeOperation = "source-over";
    lg.globalAlpha = 1;
    lg.clearRect(0, 0, W, H);
    if (shot.glow) { lg.save(); applyCam(lg, s.cam); shot.glow(lg, f, s); lg.restore(); }
    if (s.mask && s.mask.length) {
      lg.save();
      applyCam(lg, s.cam);
      lg.globalCompositeOperation = "destination-out";
      lg.beginPath();
      s.mask.forEach((p) => hoodieMask(lg, p));
      lg.fill();
      lg.restore();
    }
    g.save();
    g.globalCompositeOperation = "lighter";
    g.drawImage(light, 0, 0);
    g.restore();

    g.save();
    applyCam(g, s.cam);
    s.kids.forEach((p) => drawHoodieFace(g, p));
    if (shot.front) shot.front(g, f, s);
    g.restore();

    // 전환
    if (shot.enter === "flash" && f.lt < .25) { g.fillStyle = `rgba(255,236,200,${.5 * (1 - f.lt / .25)})`; g.fillRect(0, 0, W, H); }
    let black = 0;
    if (shot.enter === "dip" && f.lt < .45) black = 1 - f.lt / .45;
    const next = shots[i + 1];
    if (next && next.enter === "dip" && shot.end - t < .35) black = Math.max(black, 1 - (shot.end - t) / .35);
    const fadeFrom = opts.ending === "tel" ? song.duration - 1.3 : song.duration - 2.2;
    black = Math.max(black, 1 - smooth(0, 1.2, t), smooth(fadeFrom, song.duration - .1, t));

    g.save();
    g.globalCompositeOperation = "overlay";
    g.globalAlpha = .08;
    for (let y = 0; y < H; y += 256) for (let x = 0; x < W; x += 256) g.drawImage(k.weave, x, y);
    g.restore();
    g.drawImage(k.vignette, 0, 0);
    if (black > 0) { g.fillStyle = `rgba(0,0,0,${clamp(black)})`; g.fillRect(0, 0, W, H); }
  }

  return { render, shots };
}

function mixColor(a: string, b: string, w: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(mix((pa >> s) & 255, (pb >> s) & 255, w));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}
