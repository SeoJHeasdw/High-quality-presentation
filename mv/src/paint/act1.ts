/**
 * 1막: 외로운 밤 → 나방이 불러냄 → 지붕을 걸어 달을 발견한다 (0:00 ~ 0:44).
 * 방의 컷들(1·3·4)은 처음 그대로의 구도와 시간표를 지키고, 아이의 연기만 새 뼈대로 다듬었다.
 */
import { pulse } from "../scenes.ts";
import { hash, clamp, mix, smooth, P, key, blinkAt, easeIO, easeOut, moth, bang, sparkle, cityBody, windowGlow, roofY } from "./kit.ts";
import { drawHoodie, handAt, phoneRect, type Pose } from "./hoodie.ts";
import { armsSeq, kf, breathe, jump, walker, walkDist } from "./anim.ts";
import { nightSky, moonSwirls, moonBloom, type Moon } from "./sky.ts";
import { applyCam, lighter, CAM0, RIM, type Ctx, type Cam } from "./stage.ts";
import { room, roomCityGlow, phoneLight, farCity, farCityGlow, roofsPainted, roofsGlow, mottle } from "./world.ts";

const LIT0 = .16, LIT_STEP = .055;

export function act1(x: Ctx) {
  const { k, add, B } = x;
  const beat = x.song.beatLength;

  /** 하늘 위의 달(화면 좌표). 멀수록 작고 흐리다 */
  const moonAt = (f: { tq: number; beat: number }, mx: number, my: number, r: number, lit = 1): Moon => ({ x: mx, y: my, r, beat: f.beat, t: f.tq, lit });

  /* ── 01 방: 폰을 보던 아이, 유리를 두드리는 나방 ─────────── */
  add("room-night", 0, 1, "cut", {
    draw(c, f) {
      const lt = f.lt;
      // 아이와 창 사이(880, 620)를 중심으로 천천히 다가간다
      const z = 1 + .05 * smooth(0, f.dur, lt);
      const cam: Cam = { cx: 880 + 80 / z, cy: 620 - 80 / z, z };
      const phone = key(lt, [[0, 1], [5.3, 1], [6.1, .3]]);
      // 나방이 창을 두드리는 소리에 고개를 돌린다: 먼저 움찔(-.2)하고 휙 돌아본다
      const notice = smooth(4.5, 4.75, lt) * (1 - smooth(5.6, 6.3, lt));
      const pose: Pose = {
        x: 700, y: 950, s: 440, sit: 1,
        squash: breathe(lt) + kf(lt, [[4.5, 0], [4.68, .08], [4.95, -.07, "out"], [5.25, 0]]),
        lean: kf(lt, [[0, 0], [5.7, 0], [6.7, .07], [8.5, .09]]),
        turn: kf(lt, [[0, 0], [4.55, 0], [4.75, -.2], [5.05, 1.1, "out"], [5.3, 1]]),
        lookX: kf(lt, [[0, .15], [4.6, .15], [4.95, 1]]),
        lookY: kf(lt, [[0, .8], [4.6, .8], [4.95, -.7]]),
        nod: kf(lt, [[0, .7], [4.55, .7], [5.0, 0]]),
        blink: blinkAt(lt, [1.7, 4.5, 6.8, 7.7]),
        brow: -.55 * notice, browY: .9 * notice, eyes: 1 + .22 * notice,
        mouth: lt < 4.7 ? "flat" : lt < 7 ? "o" : "awe",
        phone: phone + (lt < 4.5 ? .02 * Math.sin(lt * 3.3) : 0),
        glow: (.8 + .2 * f.beat) * (.35 + .65 * phone),
      };
      c.save(); applyCam(c, cam);
      room(c, k, f.tq, { lit: .16 });
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
      roomCityGlow(c, k, .16);
      phoneLight(c, k, s.kids[0]);
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

  /* ── 02 창밖: 아이 뒷모습 너머, 박마다 켜지는 창. 폭발 직전 나방이 날아오른다 ── */
  add("city-window", B(2), 2, "cut", {
    draw(c, f) {
      const lt = f.lt, dur = f.dur;
      const z = 1.04 + .04 * smooth(0, dur, lt);
      const cam: Cam = { cx: 960, cy: 760 - 220 / z - 70 * smooth(0, dur, lt), z };
      const lit = Math.min(.62, LIT0 + Math.floor(f.beatsF) * LIT_STEP);
      const moon = moonAt(f, 1560, 170, 24, .75);
      nightSky(c, { seed: 2, t: f.tq, stars: 9, starsY: 400, y1: 700, clouds: 4, cloudY: [60, 380], moon });
      c.save(); applyCam(c, cam);
      cityBody(c, k, lit);
      c.restore();
      const pose: Pose = {
        x: 330, y: 1230, s: 620, back: true, lean: .05, rim: RIM,
        squash: breathe(lt, .01) + kf(lt, [[dur - 1.4, 0], [dur - 1.1, .05], [dur - .4, -.05], [dur, 0]]),
      };
      drawHoodie(c, pose);
      return { cam: CAM0, kids: [pose], mask: [pose], cityCam: cam, lit, swirls: moonSwirls(moon), turns: 1.1 };
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
        windowGlow(c, k, s.lit, (w) => {
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
      moonBloom(c, k.glowWhite, moonAt(f, 1560, 170, 24, .75), .12);
    },
  });

  /* ── 03 창이 열리고 나방이 쏟아져 들어온다. 아이가 놀라 일어난다 ── */
  const SWARM = Array.from({ length: 36 }, (_, i) => ({
    sx: 1500 + hash(i, 301) * 400, sy: 160 + hash(i, 302) * 520, d: i * .045,
    R: 150 + hash(i, 303) * 190, sp: .9 + hash(i, 304) * .9, ph: hash(i, 305) * 6.28, size: 11 + hash(i, 306) * 9,
  }));
  function swarmPos(i: number, lt: number, tq: number, cx: number, cy: number, start = .35) {
    const m = SWARM[i];
    const p = easeIO(clamp((lt - start - m.d) / 1.3));
    const a = tq * m.sp + m.ph;
    const tx = cx + Math.cos(a) * m.R, ty = cy + Math.sin(a) * m.R * .5;
    const arc = Math.sin(p * Math.PI) * 120;
    return { x: mix(m.sx, tx, p), y: mix(m.sy, ty, p) - arc, front: Math.sin(a) > 0 && p > .95, p };
  }
  add("room-burst", B(4), 1, "flash", {
    draw(c, f) {
      const lt = f.lt;
      // 앉은 채 폰을 보다가 → 쾅(0) → 움찔 뒤로 젖힘(.2~.45) → 폰을 떨어뜨리며 벌떡(.5~) → 늘어났다 가라앉는다
      const sit = kf(lt, [[.45, 1], [.95, 0, "back"]]);
      const stood = lt > .5;
      const sway = Math.sin(lt * 1.5);
      const watching = smooth(1.2, 1.6, lt);
      const pose: Pose = {
        x: 700, y: 950, s: 440, sit,
        squash: kf(lt, [[0, 0], [.2, .1], [.45, .14], [.62, -.15, "out"], [.85, .05], [1.1, 0]]) + (lt > 1.2 ? breathe(lt, .01, 2) : 0),
        lean: kf(lt, [[0, 0], [.22, -.1], [.45, -.12], [.62, .06], [.95, 0]]) + .03 * sway * watching,
        turn: lt < 1.1 ? 1 : mix(1, sway * .7, watching),
        lookX: lt < 1.1 ? 1 : sway * .9, lookY: -.5,
        tilt: .07 * sway * watching,
        blink: blinkAt(lt, [2.6, 4.4]),
        brow: -.8 * (1 - smooth(1.3, 2.3, lt)), browY: 1 * (1 - smooth(1.3, 2.3, lt)), eyes: 1 + .3 * (1 - smooth(1.2, 2.6, lt)),
        mouth: lt < 2.8 ? "o" : "grin", joy: smooth(3.0, 3.4, lt) * (1 - smooth(5.2, 5.5, lt)) * .7,
        arms: lt < .3 ? "phone" : armsSeq(lt, [[0, "guard"], [.5, "cheer", .22, "back"], [1.0, "none", .35], [3.4, "up", .4, "back"], [5.0, "none", .5]]),
        phone: lt < .3 ? .3 : undefined, glow: lt < .3 ? .4 : 0,
      };
      c.save(); applyCam(c, CAM0);
      room(c, k, f.tq, { lit: .3, open: easeOut(lt / .4), gold: smooth(.4, 3, lt) });
      if (stood) {
        // 떨어진 폰: 손에서 바닥으로 튕기며 눕는다
        const fall = easeOut((lt - .3) / .45);
        const py = mix(840, 940, fall) - Math.sin(fall * Math.PI) * 50;
        c.save(); c.translate(862, py); c.rotate(mix(-.4, 0, fall));
        c.fillStyle = "#cfdcff"; c.fillRect(-22, -8, 44, 16);
        c.restore();
      }
      drawHoodie(c, pose);
      c.restore();
      return { cam: CAM0, kids: [pose], mask: [pose] };
    },
    glow(c, f) {
      roomCityGlow(c, k, .3);
      lighter(c, () => {
        if (f.lt > .55) { c.globalAlpha = .4; c.drawImage(k.glowCold, 862 - 60, 940 - 60, 120, 120); c.globalAlpha = 1; }
        SWARM.forEach((m, i) => { const p = swarmPos(i, f.lt, f.tq, 700, 600); if (!p.front) moth(c, k, p.x, p.y, m.size, f.tq, m.ph); });
      });
    },
    front(c, f) {
      if (f.lt > .05 && f.lt < 1.1) bang(c, 760, 300, 50, f.hold, 1 - smooth(.8, 1.1, f.lt));
      lighter(c, () => SWARM.forEach((m, i) => { const p = swarmPos(i, f.lt, f.tq, 700, 600); if (p.front) moth(c, k, p.x, p.y, m.size, f.tq, m.ph); }));
      if (f.lt > 3.4 && f.lt < 5.2) for (let i = 0; i < 4; i++) sparkle(c, 560 + i * 90, 260 + Math.sin(f.tq * 3 + i) * 20, 14, .8);
    },
  });

  /* ── 04 가까이: 나방 하나가 손끝에 앉는다 ────────────── */
  add("hand-moth", B(6), 1, "cut", {
    draw(c, f) {
      const lt = f.lt;
      const cam: Cam = { cx: 790 + lt * 4, cy: 560, z: 2.05 + lt * .01 };
      const land = smooth(.4, 2.6, lt);
      const pose: Pose = {
        x: 700, y: 950, s: 440,
        arms: armsSeq(lt, [[0, "none"], [.35, "out", .55, "back"]]),
        squash: breathe(lt, .01, 1.8), turn: kf(lt, [[0, .3], [2.6, .7]]),
        lookX: kf(lt, [[0, 1], [2.6, .9]]), lookY: kf(lt, [[0, -.8], [2.6, .1]]),
        tilt: kf(lt, [[0, .05], [2.6, -.08]]),
        blink: blinkAt(lt, [1.4, 4.6]), mouth: lt < 3 ? "o" : "smile", joy: smooth(3.1, 3.5, lt) * .5,
        brow: -.4 * (1 - smooth(1, 2.6, lt)), browY: .8 * (1 - smooth(1, 2.6, lt)),
      };
      c.save(); applyCam(c, cam);
      room(c, k, f.tq, { lit: .3, open: 1, gold: 1 });
      drawHoodie(c, pose);
      c.restore();
      return { cam, kids: [pose], mask: [pose], land };
    },
    glow(c, f) {
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
      const mx = mix(1060, hand.x, p) + (1 - p) * Math.sin(f.tq * 6) * 20, my = mix(380, hand.y - 18, p) + (1 - p) * Math.cos(f.tq * 5) * 14;
      lighter(c, () => {
        moth(c, k, mx, my, 16, p > .98 ? f.tq * .25 : f.tq, 1);
        if (p > .98) { c.globalAlpha = .5 * f.beat; c.drawImage(k.glowGold, mx - 90, my - 90, 180, 180); }
      });
      if (f.lt > 3) for (let i = 0; i < 3; i++) sparkle(c, hand.x - 60 + i * 50, hand.y - 70 - i * 20 + Math.sin(f.tq * 4 + i) * 6, 9, smooth(3, 3.4, f.lt));
    },
  });

  /* ── 05 창밖 지붕으로: 창에서 내려와 나방을 따라 걷는다 ──── */
  const ROOF5 = 830, SCROLL5 = -380;
  const walk5 = walker(300, beat, { beatsPerCycle: 2 });
  add("climb-out", B(8), 4, "cut", {
    draw(c, f) {
      const lt = f.lt;
      const HOP0 = 1.5, HOP1 = 2.15, WALK0 = 2.4;
      const j = jump(lt, HOP0, HOP1, 70, { anticip: .3, land: .16 });
      const sill = { x: 290, y: 770 };
      const land = { x: 470, y: roofY(470, ROOF5, SCROLL5, 5) - 14 };
      const dist = walkDist(lt, WALK0, walk5.speed, .4);
      const px = lt < HOP0 ? sill.x : lt < HOP1 ? mix(sill.x, land.x, j.p) : land.x + dist;
      const py = lt < HOP1 ? mix(sill.y, land.y, lt < HOP0 ? 0 : j.p) + j.y : roofY(px, ROOF5, SCROLL5, 5) - 14;
      const walking = lt >= WALK0;
      const cam: Cam = { cx: 960 + (px - 700) * .3, cy: 540, z: 1 };
      const g0 = walking ? Math.min(1, (lt - WALK0) / .4) : 0;
      const pose: Pose = {
        x: px, y: py, s: 300, dir: 1, turn: .9, lookX: .6, lookY: -.3 + .25 * (1 - smooth(0, .9, lt)),
        walk: walk5.phase(dist), gait: g0, stride: walk5.stride,
        squash: lt < HOP1 + .6 ? j.squash : breathe(lt, .008, 2),
        tuck: j.tuck,
        arms: armsSeq(lt, [[0, "none"], [HOP0 - .02, "reach", .12], [HOP0 + .1, "up", .2, "back"], [HOP1 + .1, "none", .35]]),
        blink: blinkAt(lt, [.9, 5.2]), mouth: lt < HOP0 ? "o" : "smile", joy: lt > 6 ? .4 : 0,
        brow: lt < HOP0 ? -.3 : 0,
      };
      const moon = moonAt(f, 1680, 190, 34, .9);
      nightSky(c, { seed: 4, t: f.tq, stars: 8, starsY: 460, y1: 760, clouds: 4, cloudY: [80, 420], moon });
      c.save(); applyCam(c, cam);
      farCity(c, k, 300, 330, .62, .3);
      roofsPainted(c, f.tq, ROOF5, SCROLL5, 5, undefined, { windows: 4 });
      // 아이의 건물과 열린 창
      const wallR = 400;
      const wg = c.createLinearGradient(0, 300, 0, 1100);
      wg.addColorStop(0, "#13164a"); wg.addColorStop(1, "#080a26");
      c.fillStyle = wg; c.fillRect(-300, 300, wallR + 300, 900);
      mottle(c, -300, 300, wallR + 300, 800, 411, 30, .08, 34);
      c.fillStyle = "#04051a"; c.fillRect(wallR - 6, 300, 6, 900);
      c.fillStyle = "rgba(110,124,230,.35)"; c.fillRect(wallR - 10, 300, 4, 900);
      c.fillStyle = "#04051a"; c.fillRect(196, 548, 188, 236);
      c.fillStyle = "#ffcf7a"; c.fillRect(204, 556, 172, 214);
      c.fillStyle = "#080a22"; c.fillRect(286, 556, 8, 214);
      c.fillStyle = "#2c3380"; c.fillRect(186, 770, 208, 14);
      if (lt < HOP1) {
        const glow = c.createRadialGradient(290, 670, 0, 290, 670, 260);
        glow.addColorStop(0, "rgba(255,190,110,.35)"); glow.addColorStop(1, "rgba(255,190,110,0)");
        c.fillStyle = glow; c.fillRect(0, 400, 600, 600);
      }
      drawHoodie(c, pose);
      c.restore();
      return { cam, kids: [pose], mask: [pose], swirls: moonSwirls(moon), turns: 1.1, moon };
    },
    glow(c, f, s) {
      farCityGlow(c, k, 300, 330, .62, .3);
      roofsGlow(c, k, ROOF5, SCROLL5, 5, undefined, 4);
      lighter(c, () => {
        c.globalAlpha = .6; c.drawImage(k.glowGold, 290 - 220, 670 - 220, 440, 440); c.globalAlpha = 1;
        const kid = s.kids[0];
        for (let i = 0; i < 8; i++) moth(c, k, kid.x + 140 + i * 70, kid.y - 220 - i * 22 + Math.sin(f.tq * 3 + i) * 16, 12, f.tq, i);
      });
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
      moonBloom(c, k.glowWhite, s.moon, .14);
      c.restore();
    },
  });

  /* ── 06 지붕을 걷는다(따라가는 카메라). 박마다 한 걸음 ────── */
  const walk6 = walker(300, beat, { beatsPerCycle: 1 });
  add("roof-walk", B(11), 6, "cut", {
    draw(c, f) {
      const scroll = f.lt * walk6.speed;
      const px = 760;
      const py = roofY(px, 830, scroll, 7) - 14;
      const pose: Pose = {
        x: px, y: py, s: 300, dir: 1, turn: .9, lookX: .7, lookY: -.2 + .1 * Math.sin(f.lt * 1.3),
        walk: walk6.phase(scroll + 18), gait: 1, stride: walk6.stride, tilt: .035 * Math.sin(walk6.phase(scroll) * Math.PI * 2),
        blink: blinkAt(f.lt, [2.2, 4.8]), mouth: "smile", nod: .25 * Math.abs(Math.sin(walk6.phase(scroll) * Math.PI * 2)),
      };
      const moon = moonAt(f, 1620, 170, 40, .95);
      nightSky(c, { seed: 6, t: f.tq, stars: 8, starsY: 480, y1: 760, clouds: 4, cloudY: [80, 430], moon });
      c.save(); applyCam(c, CAM0);
      const off = (scroll * .15) % (1920 * .62);
      for (let n = 0; n < 3; n++) farCity(c, k, -off + n * 1920 * .62, 330, .62, .32);
      roofsPainted(c, f.tq, 830, scroll, 7, undefined, { windows: 4 });
      drawHoodie(c, pose);
      // 앞을 지나가는 빨랫줄
      for (let i = 0; i < 3; i++) {
        const lx = ((i * 900 - scroll * 1.7) % 2700 + 2700) % 2700 - 300;
        c.fillStyle = "#05061a";
        c.fillRect(lx, 520, 14, 700);
        c.strokeStyle = "#05061a"; c.lineWidth = 4;
        c.beginPath(); c.moveTo(lx, 540); c.quadraticCurveTo(lx + 260, 620, lx + 520, 540); c.stroke();
        c.fillRect(lx + 120, 575, 60, 80); c.fillRect(lx + 300, 580, 50, 64);
      }
      c.restore();
      return { cam: CAM0, kids: [pose], mask: [pose], off, scroll, swirls: moonSwirls(moon), turns: 1.1, moon };
    },
    glow(c, f, s) {
      for (let n = 0; n < 3; n++) farCityGlow(c, k, -s.off + n * 1920 * .62, 330, .62, .32);
      roofsGlow(c, k, 830, s.scroll, 7, undefined, 4);
      lighter(c, () => {
        for (let i = 0; i < 7; i++) moth(c, k, 900 + i * 85, 560 - i * 26 + Math.sin(f.tq * 3 + i) * 18, 12, f.tq, i);
      });
      moonBloom(c, k.glowWhite, s.moon, .14);
    },
  });

  /* ── 07 올려다본 하늘: 달을 발견하고 가리킨다 ─────────── */
  add("look-up", B(13), 8, "cut", {
    draw(c, f) {
      const lt = f.lt;
      const tilt = smooth(0, f.dur, lt);
      const cam: Cam = { cx: 960, cy: 540 - 60 * tilt, z: 1 };
      // 달이 떠오르듯 천천히 커진다
      const moon = moonAt(f, 1420, 262 + 60 * tilt, mix(48, 62, smooth(.5, 3, lt)));
      const pose: Pose = {
        x: 640, y: 1110, s: 470, back: true, rim: RIM,
        arms: armsSeq(lt, [[0, "none"], [2.1, "point", .45, "back"]]),
        squash: breathe(lt, .008) + kf(lt, [[1.9, 0], [2.2, .05], [2.5, -.03], [2.7, 0]]),
        tilt: kf(lt, [[0, 0], [1.2, -.05], [2.4, -.09]]), nod: -kf(lt, [[0, 0], [1.4, 1]]),
      };
      nightSky(c, { seed: 8, t: f.tq, stars: 9, starsY: 700, y1: 1000, clouds: 5, cloudY: [120, 700], moon });
      c.save(); applyCam(c, cam);
      roofsPainted(c, f.tq, 990, 0, 8, undefined, { windows: 2 });
      c.restore();
      c.save(); applyCam(c, cam);
      c.fillStyle = "#06071c";
      c.fillRect(1500, 760, 6, 230); c.fillRect(1460, 800, 90, 5);
      c.restore();
      c.save(); applyCam(c, CAM0);
      drawHoodie(c, pose);
      c.restore();
      return { cam: CAM0, kids: [pose], mask: [pose], moon, camShift: cam, swirls: moonSwirls(moon), turns: 1.1 };
    },
    glow(c, f, s) {
      moonBloom(c, k.glowWhite, s.moon, .16);
      lighter(c, () => {
        for (let i = 0; i < 12; i++) {
          const v = ((hash(i, 701) + f.lt * .12) % 1);
          const mx = mix(700, s.moon.x, v) + Math.sin(v * 9 + i) * 120 * (1 - v);
          const my = mix(820, s.moon.y + 10, v) + Math.cos(v * 7 + i) * 60 * (1 - v);
          moth(c, k, mx, my, 14 * (1 - v * .6), f.tq, i, 1 - smooth(.85, 1, v));
        }
      });
    },
  });

}
