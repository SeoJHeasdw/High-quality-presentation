/**
 * 2막 후반: 1절 후렴(1:19 ~ 2:03). 달이 실을 내려주고, 아이는 실을 잡고 날아오른다.
 * 도시의 창들을 스치다 같은 외로운 창 하나를 발견하고, 창을 두드려 친구를 데리고 나온다.
 * 둘이 함께 구름을 뚫고 올라, 커다란 달 앞을 지난다.
 *
 *   달이 실을 내려준다 → 실을 잡고 떠오른다 → 날아간다 → 창들을 스친다(저마다의 밤)
 *   → 차가운 불빛의 창 → 창을 두드린다(1막의 거울) → 창이 열린다, 손을 내민다
 *   → 손이 닿는다 → 함께 난다 → 구름을 뚫고 오른다 → 달 앞을 지난다
 */
import { hash, clamp, mix, smooth, blinkAt, easeIO, easeOut, moth, sparkle, heart, glowLine, lightThread, windStreaks } from "./kit.ts";
import { pulse } from "../scenes.ts";
import { drawHoodie, handAt, headAt, FRIEND, HERO, shade, type Pose } from "./hoodie.ts";
import { armsSeq, kf, breathe } from "./anim.ts";
import { nightSky, moonSwirls, moonBloom, cloudStreaks, type Moon } from "./sky.ts";
import { applyCam, lighter, CAM0, RIM, type Ctx, type Cam, type F } from "./stage.ts";
import { farCity, farCityGlow, roofsPainted, roofsGlow, mottle, phoneLight } from "./world.ts";
import { fieldPaint, facadePaint, wallWithWindow, friendWindow, roomWall, roomFrame, cloudSeaPaint, billow, winKind, type BigWindow } from "./world2.ts";

const TAU = Math.PI * 2;

export function act3(x: Ctx) {
  const { k, add, B } = x;
  const moonAt = (f: F, mx: number, my: number, r: number, lit = 1): Moon => ({ x: mx, y: my, r, beat: f.beat, t: f.tq, lit });

  /* ── 13 달이 실을 쏟는다: 별이 아니라 달에서, 들판으로 흘러온다 ──── */
  const THREADS = 15;
  function threadPoint(n: number, v: number, tq: number, ox = 960, oy = 330) {
    const spread = (hash(n, 41) * 2 - 1) * (.5 + .5 * hash(n, 42));
    const freq = 1.2 + hash(n, 43) * 1.6;
    const amp = 8 + 110 * v;
    return {
      x: ox + spread * Math.pow(v, 1.25) * 1100 + Math.sin(v * freq * Math.PI * 2 - tq * (1.6 + hash(n, 44)) + n) * amp,
      y: oy + 860 * Math.pow(v, 1.5),
    };
  }
  add("threads", B(28), 3, "flash", {
    draw(c, f) {
      const lt = f.lt;
      const reveal = easeIO(clamp(lt / .7));
      const moon = moonAt(f, 960, 250, 118);
      nightSky(c, { seed: 13, t: f.tq, stars: 10, starsY: 420, y1: 520, moon });
      c.save(); applyCam(c, CAM0);
      fieldPaint(c, k, 480, f.tq);
      c.lineCap = "round";
      c.strokeStyle = "#a88a55";
      c.lineWidth = 6;
      for (let n = 0; n < THREADS; n++) {
        c.beginPath();
        for (let i = 0; i <= 60; i++) { const p = threadPoint(n, i / 60 * reveal, f.tq); if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }
        c.stroke();
      }
      const pose: Pose = {
        x: 700, y: 1100, s: 300, back: true, rim: RIM,
        arms: armsSeq(lt, [[0, "none"], [2.3, "cheer", .55, "back"]]),
        squash: kf(lt, [[0, 0], [.12, .1], [.35, -.06], [.6, 0]]) + breathe(lt, .01),
        tilt: kf(lt, [[0, 0], [.8, -.1]]), nod: -kf(lt, [[0, 0], [.9, 1]]),
      };
      drawHoodie(c, pose);
      c.restore();
      return { cam: CAM0, kids: [pose], mask: [pose], reveal, moon, swirls: moonSwirls(moon), turns: 1.1 };
    },
    glow(c, f, s) {
      moonBloom(c, k.glowWhite, s.moon, .2);
      lighter(c, () => {
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
        for (let i = 0; i < 16; i++) {
          const v = 1 - ((hash(i, 71) + f.lt * (.07 + hash(i, 72) * .05)) % 1);
          const p = threadPoint(i % THREADS, v * s.reveal, f.tq);
          moth(c, k, p.x + Math.sin(f.tq * 3 + i) * 30, p.y - 20, 7 + v * 11, f.tq, i);
        }
      });
    },
  });

  /* ── 14a 실을 잡는다 → 발이 땅에서 떨어진다 ─────────────── */
  const GRIP = .85, PULL = 1.3;
  add("grab-lift", B(30), 14, "cut", {
    draw(c, f) {
      const lt = f.lt, u = 420;
      const rise = lt < PULL ? 0 : 520 * (lt - PULL) * (lt - PULL);
      const kx = 760, ky = 980 - Math.min(rise, 300);
      const handRest = { x: kx + .34 * u, y: ky - 1.16 * u };
      // 실의 끝: 위에서 내려와 손에 닿고, 잡은 뒤에는 손과 함께 올라간다
      const end = lt < GRIP ? { x: mix(handRest.x + 90, handRest.x, easeOut(lt / GRIP)), y: mix(handRest.y - 260, handRest.y, easeOut(lt / GRIP)) } : handRest;
      const moon = moonAt(f, 1500, 150, 108);
      nightSky(c, { seed: 14, t: f.tq, stars: 9, starsY: 460, y1: 700, moon });
      c.save(); applyCam(c, CAM0);
      fieldPaint(c, k, 600 + rise * 1.1, f.tq);
      c.restore();
      const pose: Pose = {
        x: kx, y: ky, s: u, dir: 1, turn: .65,
        handR: end, reachR: smooth(.15, .6, lt), arms: "wide",
        squash: lt < GRIP ? breathe(lt, .01) : kf(lt, [[GRIP, 0], [GRIP + .2, .12], [PULL - .02, .16], [PULL + .15, -.12, "out"], [PULL + .6, -.02]]),
        tuck: smooth(PULL, PULL + .5, lt) * .5, dangle: smooth(PULL, PULL + .4, lt) * 1.2, flutter: f.tq * 7,
        lean: kf(lt, [[0, 0], [PULL, 0], [PULL + .4, .12]]),
        lookX: .5, lookY: kf(lt, [[0, -.7], [GRIP, -.5], [PULL, 0], [PULL + .4, .5]]),
        brow: kf(lt, [[0, -.4], [GRIP, -.4], [PULL, -.7], [PULL + .5, 0]]), browY: kf(lt, [[0, .6], [PULL, 1], [PULL + .6, .2]]),
        eyes: 1 + .3 * smooth(PULL - .1, PULL + .1, lt), mouth: lt < GRIP ? "o" : lt < PULL + .5 ? "o" : "grin", joy: smooth(PULL + .7, PULL + 1.0, lt) * .6,
        blink: blinkAt(lt, [.55]),
        drag: { x: 0, y: -rise * .06 },
      };
      c.save(); applyCam(c, CAM0);
      drawHoodie(c, pose);
      c.restore();
      return { cam: CAM0, kids: [pose], mask: [pose], moon, swirls: moonSwirls(moon), turns: 1.1, end, rise };
    },
    glow(c, f, s) {
      moonBloom(c, k.glowWhite, s.moon, .2);
      lighter(c, () => {
        // 달에서 손까지 늘어진 실
        const top = { x: s.moon.x - 20, y: s.moon.y + 40 };
        lightThread(c, k, s.end, top, f.tq, { amp: 34, w: 2.8 });
        for (let i = 0; i < 10; i++) {
          const v = ((hash(i, 91) + f.lt * .2) % 1);
          moth(c, k, mix(top.x, s.end.x, v) + Math.sin(f.tq * 3 + i) * 24, mix(top.y, s.end.y, v), 11, f.tq, i, .9);
        }
        // 풀잎에서 튀는 빛
        if (f.lt > PULL) for (let i = 0; i < 8; i++) { c.globalAlpha = (1 - (f.lt - PULL) / 1.3) * .6; c.drawImage(k.glowGold, 640 + i * 52, 1040 - ((f.lt - PULL) * 380 + i * 30) % 400 - 14, 28, 28); }
        c.globalAlpha = 1;
      });
    },
  });

  /* ── 14b 날아간다(옆에서): 도시와 지붕이 빠르게 흘러간다 ─────── */
  add("fly-side", B(31), 14, "cut", {
    draw(c, f) {
      const lt = f.lt, tq = f.tq;
      const sway = Math.sin(tq * 2) * 22, bob = Math.sin(tq * 3.1) * .04;
      const look = smooth(3.9, 4.6, lt);                                   // 마지막에 아래를 내려다본다
      const kx = 900, kc = 560 + sway;
      const pose: Pose = {
        x: kx, y: kc + 135, s: 300, dir: 1, turn: .85, rot: .42 + bob, arms: "fly",
        dangle: 1.3, flutter: tq * 6, tuck: .25, lookX: .8, lookY: mix(-.3, .8, look),
        mouth: lt < 1.5 ? "o" : "grin", joy: smooth(1.4, 2.0, lt) * (1 - look) * .7, brow: -.3 * (1 - smooth(1, 1.6, lt)), browY: .6 * (1 - smooth(1, 1.6, lt)),
        blink: blinkAt(lt, [2.3, 4.4]), nod: look * .8, drag: { x: -150, y: 20 * Math.sin(tq * 3) },
      };
      const moon = moonAt(f, 1560, 190, 110);
      nightSky(c, { seed: 15, t: f.tq, stars: 8, starsY: 520, y1: 900, clouds: 3, cloudY: [60, 480], moon });
      cloudStreaks(c, tq * 40, 61, 4, 200, 600, "#6b63ae", .26);
      windStreaks(c, tq, 5, 9, 150, 760, 1100);
      c.save(); applyCam(c, CAM0);
      const off = (lt * 260) % (1920 * .55);
      for (let n = 0; n < 4; n++) farCity(c, k, -off + n * 1920 * .55, 760, .55, .35);
      roofsPainted(c, tq, 980, lt * 700, 21, undefined, { windows: 1 });
      drawHoodie(c, pose);
      c.restore();
      return { cam: CAM0, kids: [pose], mask: [pose], moon, swirls: moonSwirls(moon), turns: 1.1, off, scroll: lt * 700 };
    },
    glow(c, f, s) {
      for (let n = 0; n < 4; n++) farCityGlow(c, k, -s.off + n * 1920 * .55, 760, .55, .35);
      roofsGlow(c, k, 980, s.scroll, 21, undefined, 1);
      moonBloom(c, k.glowWhite, s.moon, .18);
      const kid = s.kids[0], hand = handAt(kid, 1);
      lighter(c, () => {
        lightThread(c, k, hand, { x: 2150, y: -250 }, f.tq, { amp: 48, w: 2.6 });
        for (let i = 0; i < 14; i++) moth(c, k, kid.x - 170 - i * 88 + Math.sin(f.tq * 4 + i) * 14, kid.y - 150 + Math.cos(f.tq * 3 + i) * 44 + i * 6, 12, f.tq, i, 1 - i / 16);
      });
    },
  });

  /* ── 15·16 창들을 스친다 → 차가운 불빛의 창 하나에 멈춘다 ────── */
  // 두 컷이 같은 시계를 쓴다(15의 시작부터). 도시 창이 흘러가다 감속해 친구의 창에서 멈춘다.
  const GX = 300, V0 = 640, COL = 9;
  const scrollRaw = (tr: number) => {
    let sc = 0;
    for (let s = 0; s < tr; s += 1 / 60) sc += V0 * (1 - smooth(2.3, 4.7, s)) / 60;
    return sc;
  };
  const OFF = COL * GX + 80 - 1010 - scrollRaw(4.9);
  const scrollAt = (tr: number) => scrollRaw(tr) + OFF;
  const dtShot = () => B(34) - B(33);
  const flyPose = (f: F, tr: number, hold: boolean): Pose => {
    const tq = f.tq;
    const stop = smooth(2.3, 4.7, tr);
    const sway = Math.sin(tq * 2) * 18 * (1 - stop);
    const kx = mix(640, 880, stop), kc = 540 + sway + 20 * stop;
    const spotted = smooth(3.4, 3.9, tr);
    return {
      x: kx, y: kc + 135, s: 300, dir: 1, turn: mix(.85, .9, spotted), rot: mix(.36, .1, stop), arms: "fly",
      dangle: mix(1.3, .5, stop), flutter: tq * 6, tuck: mix(.2, .0, stop),
      lookX: mix(.6, 1, spotted), lookY: mix(.1, -.15, stop),
      mouth: tr < 3.4 ? "smile" : "o", joy: tr < 3.4 ? .5 * (1 - stop) : 0,
      brow: -.6 * spotted, browY: .9 * spotted, eyes: 1 + .3 * spotted,
      blink: blinkAt(tr, [1.1, 2.9, 4.5]), drag: { x: -140 * (1 - stop), y: 10 * Math.sin(tq * 3) },
      nod: hold ? 0 : 0,
    };
  };
  const facadeScene = (c: CanvasRenderingContext2D, f: F, tr: number, cam: Cam) => {
    const pose = flyPose(f, tr, true);
    c.save(); applyCam(c, cam);
    const win = facadePaint(c, { scroll: scrollAt(tr), t: f.tq, seed: 4, gx: GX, special: { col: COL, row: 1, kind: "friend" } });
    drawHoodie(c, pose);
    c.restore();
    return { pose, win };
  };
  const facadeGlow = (c: CanvasRenderingContext2D, f: F, tr: number, win: { x: number; y: number; w: number; h: number } | null, pose: Pose) => {
    lighter(c, () => {
      // 창마다 따뜻한 빛이 번진다(벽에 비친다)
      const sc = scrollAt(tr);
      for (let col = Math.floor(sc / GX) - 1; col * GX - sc < 1920 + GX; col++) for (let row = 0; row < 3; row++) {
        const wx = col * GX - sc + 80, wy = 80 + row * 330;
        const isF = col === COL && row === 1;
        const kind = isF ? "friend" : winKind(col, row, 4);
        if (kind === "dark") continue;
        c.globalAlpha = isF ? .5 : kind === "tv" ? .3 : .32;
        c.drawImage(isF || kind === "tv" ? k.glowCold : k.glowGold, wx - 90, wy - 70, 320, 340);
      }
      c.globalAlpha = 1;
      const hand = handAt(pose, 1);
      lightThread(c, k, hand, { x: 2200, y: -300 }, f.tq, { amp: 48, w: 2.6 });
      for (let i = 0; i < 12; i++) moth(c, k, pose.x - 160 - i * 80 + Math.sin(f.tq * 4 + i) * 14, pose.y - 160 + Math.cos(f.tq * 3 + i) * 40, 12, f.tq, i, 1 - i / 14);
    });
    void win;
  };
  add("windows", B(33), 15, "cut", {
    draw(c, f) {
      const cam: Cam = CAM0;
      const r = facadeScene(c, f, f.lt, cam);
      return { cam, kids: [r.pose], mask: [r.pose], win: r.win };
    },
    glow(c, f, s) { facadeGlow(c, f, f.lt, s.win, s.kids[0]); },
  });
  add("spot", B(34), 16, "cut", {
    draw(c, f) {
      const tr = f.lt + dtShot();
      const push = smooth(0, f.dur, f.lt);
      const cam: Cam = { cx: mix(960, 1050, push), cy: mix(540, 500, push), z: mix(1, 1.28, push) };
      const r = facadeScene(c, f, tr, cam);
      return { cam, kids: [r.pose], mask: [r.pose], win: r.win, tr };
    },
    glow(c, f, s) {
      facadeGlow(c, f, s.tr, s.win, s.kids[0]);
      // 나방들이 먼저 창으로 날아간다
      lighter(c, () => {
        const win = s.win;
        if (!win) return;
        for (let i = 0; i < 8; i++) {
          const p = easeIO(clamp((f.lt - .9 - i * .08) / 1.2));
          const sx = s.kids[0].x - 120 - i * 40, sy = s.kids[0].y - 160 + i * 14;
          moth(c, k, mix(sx, win.x + win.w * .3 + (i % 3) * 22, p) + Math.sin(f.tq * 4 + i) * 10 * (1 - p), mix(sy, win.y + win.h * .35 + (i % 4) * 24, p), 12, f.tq, i, .95);
        }
      });
    },
  });

  /* ── 17 창을 두드린다: 1막 첫 장면의 거울. 이번엔 안쪽에 외로운 아이가 있다 ── */
  const WIN: BigWindow = { x: 760, y: 130, w: 520, h: 620 };
  add("friend-window", B(35), 17, "cut", {
    draw(c, f) {
      const lt = f.lt, NOTICE = 1.15;
      const z = 1 + .05 * smooth(0, f.dur, lt);
      const cam: Cam = { cx: 960 - 20 * smooth(0, f.dur, lt), cy: 540, z };
      const surprise = smooth(NOTICE, NOTICE + .2, lt) * (1 - smooth(1.9, 2.4, lt));
      const sit = kf(lt, [[1.95, 1], [2.45, 0, "back"]]);
      const friend: Pose = {
        tint: FRIEND, x: WIN.x + WIN.w * .55, y: WIN.y + WIN.h * .93, s: 300, sit, dir: 1,
        // 폰을 보다가(고개 숙임) → 톡 소리에 번쩍 고개를 든다
        turn: kf(lt, [[0, -.15], [NOTICE - .05, -.15], [NOTICE + .1, .1], [NOTICE + .6, .0]]),
        nod: kf(lt, [[0, .8], [NOTICE - .05, .8], [NOTICE + .15, -.2], [NOTICE + .7, 0]]),
        lookX: kf(lt, [[0, 0], [NOTICE, 0], [NOTICE + .4, .35]]), lookY: kf(lt, [[0, .85], [NOTICE - .05, .85], [NOTICE + .2, -.1]]),
        tilt: kf(lt, [[0, .04], [NOTICE, .04], [NOTICE + .5, -.12]]),
        brow: -.6 * surprise, browY: surprise + .15, eyes: 1 + .3 * surprise, blink: blinkAt(lt, [.6, 2.3]),
        mouth: lt < NOTICE ? "flat" : "o",
        squash: breathe(lt, .012) + kf(lt, [[NOTICE, 0], [NOTICE + .08, .07], [NOTICE + .3, -.05], [NOTICE + .6, 0]]),
        arms: lt < 1.9 ? "phone" : armsSeq(lt, [[0, "phone"], [1.9, "guard", .3], [2.45, "reach", .3]]),
        phone: lt < 1.9 ? kf(lt, [[0, .75], [NOTICE, .75], [NOTICE + .3, .35], [1.9, .3]]) : undefined,
        glow: lt < 1.9 ? .9 * (1 - .35 * smooth(NOTICE, NOTICE + .3, lt)) : 0,
      };
      // 문 앞의 아이(뒷모습): 창을 바라본다
      const hero: Pose = { x: 250, y: 1230, s: 660, back: true, rim: RIM, lean: .04, squash: breathe(lt, .01) + kf(lt, [[NOTICE - .05, 0], [NOTICE, .02], [NOTICE + .3, -.02], [NOTICE + .6, 0]]) };
      c.save(); applyCam(c, cam);
      wallWithWindow(c, f.tq, WIN, 3);
      friendWindow(c, f.tq, WIN, 0, () => drawHoodie(c, friend));
      c.restore();
      c.save(); applyCam(c, CAM0); drawHoodie(c, hero); c.restore();
      return { cam, kids: [friend], hero, mask: [], turns: 1.1 };
    },
    glow(c, f, s) {
      const fr = s.kids[0];
      lighter(c, () => {
        // 창 안의 차가운 빛(폰)과 방의 줄 전구
        c.globalAlpha = (fr.glow ?? 0) * .7;
        c.drawImage(k.glowCold, WIN.x + WIN.w * .55 - 280, WIN.y + WIN.h * .62 - 280, 560, 560);
        c.globalAlpha = .45;
        for (let i = 0; i < 9; i++) { const v = (i + .5) / 9; c.drawImage(k.glowGold, mix(WIN.x, WIN.x + WIN.w, v) - 40, WIN.y + WIN.h * .12 + 4 * (WIN.h * .18) * v * (1 - v) - 32, 80, 80); }
        c.globalAlpha = 1;
        // 나방이 유리를 톡톡: 박마다 한 번
        const tap = f.lt > .5 ? pulse(f.beatAge, .12) : 0;
        const mx = WIN.x + WIN.w * .72 + Math.sin(f.tq * 5) * 8 - tap * 12, my = WIN.y + WIN.h * .38 + Math.cos(f.tq * 6) * 7;
        moth(c, k, mx, my, 24, f.tq, 0);
        if (tap > .05) { c.globalAlpha = tap * .7; c.drawImage(k.glowGold, mx - 120, my - 100, 240, 240); c.globalAlpha = 1; }
        for (let i = 0; i < 5; i++) moth(c, k, 340 + i * 60 + Math.cos(f.tq * 1.3 + i) * 30, 360 - i * 36 + Math.sin(f.tq * 1.7 + i) * 24, 11, f.tq, i, .8);
        // 뒷모습 아이의 손끝에서 올라가는 실
        lightThread(c, k, { x: 420, y: 780 }, { x: 620, y: -200 }, f.tq, { amp: 36, w: 2.4 });
      });
    },
  });

  /* ── 18 창이 열린다: 방 안에서 본다. 밖에는 달빛 속에 그 아이가 떠 있다 ── */
  const WIN2: BigWindow = { x: 1010, y: 140, w: 760, h: 600 };
  /** 창 너머 풍경: 하늘, 달, 건너편(그 아이의 건물과 불 켜진 창) */
  function beyond(c: CanvasRenderingContext2D, f: F) {
    const { x, y, w, h } = WIN2;
    c.save();
    c.beginPath(); c.rect(x, y, w, h); c.clip();
    const moon = moonAt(f, x + w * .8, y + h * .24, 90);
    nightSky(c, { seed: 18, t: f.tq, stars: 7, starsY: y + h * .6, y1: y + h, moon, clouds: 2, cloudY: [y + 20, y + h * .6] });
    farCity(c, k, x - 100, y + h * .72, .6, .3);
    // 건너편: 그 아이의 건물. 그가 나온 창이 열려 따뜻한 불이 켜져 있다
    const bx = x + 70, by = y + h * .38;
    c.fillStyle = "#0c0f3a"; c.fillRect(bx, by, 300, 600);
    mottle(c, bx, by, 300, 600, 207, 20, .08, 26);
    c.fillStyle = "#04051a"; c.fillRect(bx + 76, by + 90, 112, 140);
    c.fillStyle = "#ffcf7a"; c.fillRect(bx + 82, by + 96, 100, 128);
    c.fillStyle = "#04051a"; c.fillRect(bx + 128, by + 96, 6, 128);
    c.restore();
    return moon;
  }
  const FR0 = 560, FRX = 850;
  add("window-opens", B(36), 18, "cut", {
    draw(c, f) {
      const lt = f.lt, u = 360;
      const open = easeOut((lt - 1.35) / .7);
      const fx = lt < .9 ? mix(FR0, FRX, easeIO(lt / .9)) : lt < 2.0 ? FRX : FRX - 26 * smooth(1.8, 2.2, lt);
      const walking = lt < .9;
      const seeHim = smooth(1.85, 2.1, lt);
      const giveUp = smooth(4.55, 5.1, lt);                    // 손을 내민다
      // 폰: 걸어오며 들고 있다 → 창을 열려고 주머니에 넣는다 → 그를 보고 망설이며 다시 꺼낸다 → 주머니에 넣고 손을 내민다
      const phoneMode = lt < 1.05 || (lt >= 3.0 && lt < 4.2);
      const phoneUp = lt < 1.05 ? kf(lt, [[0, .55], [.7, .55], [1.05, 0]]) : kf(lt, [[3.0, 0], [3.5, .8], [3.9, .8], [4.2, 0]]);
      const phoneVis = lt < 1.05 ? 1 - smooth(.9, 1.05, lt) : smooth(3.0, 3.15, lt) * (1 - smooth(4.05, 4.2, lt));
      const friend: Pose = {
        tint: FRIEND, x: fx, y: 905, s: u, dir: 1, turn: kf(lt, [[0, .5], [.9, .8], [2.0, .8], [3.2, .6], [4.0, .85]]),
        walk: walking ? lt * 1.5 : undefined, gait: walking ? Math.min(1, lt / .25) * (1 - smooth(.7, .9, lt)) : 0, stride: .42,
        arms: phoneMode ? "phone" : armsSeq(lt, [[0, "pocket"], [1.3, "reach", .3], [1.9, "guard", .3], [2.6, "pocket", .3], [4.2, "pocket", .01], [4.4, "none", .3]]),
        phone: phoneMode ? phoneUp : undefined, phoneOn: phoneVis, glow: phoneMode ? .85 * phoneVis : 0,
        handR: giveUp > 0 ? { x: mix(FRX + 60, 1120, giveUp), y: mix(640, 540, giveUp) } : undefined, reachR: giveUp,
        lookX: .9, lookY: kf(lt, [[0, .1], [1.9, .1], [2.6, -.05], [3.3, .7], [3.9, -.05]]),
        nod: kf(lt, [[2.6, 0], [3.2, 1], [3.7, 1], [4.0, 0]]),
        brow: kf(lt, [[0, 0], [1.9, 0], [2.0, -.7], [3.3, -.5], [4.3, -.1], [5, .1]]), browY: kf(lt, [[0, 0], [1.9, .1], [2.1, 1], [3.3, .3], [4.3, 0]]),
        eyes: 1 + .35 * seeHim * (1 - smooth(3.0, 3.6, lt)),
        mouth: lt < 1.9 ? "flat" : lt < 3.4 ? "o" : lt < 4.4 ? "sad" : "smile", joy: smooth(4.9, 5.3, lt) * .5,
        squash: breathe(lt, .01) + kf(lt, [[1.9, 0], [1.98, .08], [2.3, -.04], [2.6, 0]]), blink: blinkAt(lt, [.5, 3.6]),
      };
      const hero: Pose = {
        x: 1390, y: 520 + 135 + Math.sin(f.tq * 2) * 14, s: 300, dir: -1, turn: kf(lt, [[0, .1], [1.3, .1], [1.9, -.5], [2.7, -.2]]), rot: -.06 + .03 * Math.sin(f.tq * 1.7),
        arms: armsSeq(lt, [[0, "fly"], [1.7, "wave", .35, "back"], [2.8, "none", .3]]), wave: lt > 1.9 && lt < 2.9 ? f.tq * 9 : undefined,
        handL: lt > 2.9 ? { x: mix(1260, 1110, smooth(2.9, 3.6, lt)), y: mix(560, 530, smooth(2.9, 3.6, lt)) } : undefined, reachL: smooth(2.9, 3.5, lt),
        dangle: .8, flutter: f.tq * 5, tuck: .15, lookX: -.8, lookY: .05,
        mouth: lt < 1.7 ? "smile" : "grin", joy: smooth(1.7, 2.2, lt) * .8, blink: blinkAt(lt, [1.0, 3.4, 4.7]), drag: { x: 40, y: 8 * Math.sin(f.tq * 3) },
      };
      const push = smooth(0, f.dur, lt);
      const cam: Cam = { cx: mix(1190, 1120, push), cy: 500, z: mix(1.1, 1.32, push) };
      c.save(); applyCam(c, cam);
      roomWall(c, f.tq);
      const moon = beyond(c, f);
      drawHoodie(c, hero);
      roomFrame(c, f.tq, WIN2, open);
      drawHoodie(c, friend);
      c.restore();
      // 붓 소용돌이는 화면 좌표: 달을 카메라 변환에 맞춘다
      const sm: Moon = { ...moon, x: 960 + (moon.x - cam.cx) * cam.z, y: 540 + (moon.y - cam.cy) * cam.z, r: moon.r * cam.z };
      return { cam, kids: [friend, hero], mask: [hero], friend, hero, moon, open, swirls: moonSwirls(sm), turns: 1.1 };
    },
    glow(c, f, s) {
      lighter(c, () => {
        // 방 안의 줄 전구 번짐과 열린 창으로 들어오는 달빛
        c.globalAlpha = .12 + .1 * s.open; c.drawImage(k.glowWhite, WIN2.x - 160, WIN2.y - 100, 1000, 800); c.globalAlpha = 1;
        // 건너편 창의 따뜻한 불
        c.globalAlpha = .55; c.drawImage(k.glowGold, WIN2.x + 70 + 82 - 70, WIN2.y + WIN2.h * .38 + 96 - 60, 220, 220); c.globalAlpha = 1;
        // 달이 비추는 실
        const hand = headAt(s.hero);
        lightThread(c, k, { x: hand.x + 40, y: hand.y - 100 }, { x: 1980, y: -300 }, f.tq, { amp: 40, w: 2.4 });
        // 창이 열리며 들어오는 나방
        const ent = smooth(1.45, 3.0, f.lt);
        for (let i = 0; i < 9; i++) {
          const p = easeIO(clamp((f.lt - 1.45 - i * .12) / 1.5)), a = f.tq * (1 + hash(i, 33) * .8) + i;
          moth(c, k, mix(1500 + i * 40, 780 + Math.cos(a) * 110, p), mix(260 + i * 50, 540 + Math.sin(a) * 70, p), 12, f.tq, i, ent);
        }
      });
      if (s.friend.glow && s.friend.glow > .05) phoneLight(c, k, s.friend);
      moonBloom(c, k.glowWhite, s.moon, .12);
    },
  });

  /* ── 19 손이 닿는다: 빛이 터지고 문턱에서 발이 떨어진다 ───────── */
  add("hands-meet", B(38), 19, "cut", {
    draw(c, f) {
      const lt = f.lt, TOUCH = .95;
      const lift = lt < TOUCH + .1 ? 0 : 640 * (lt - TOUCH - .1) * (lt - TOUCH - .1);
      const cy = 540 - lift * .55;
      const cam: Cam = { cx: 960, cy, z: mix(1, .92, smooth(TOUCH, f.dur, lt)) };
      const meet = { x: 960, y: 640 - lift };
      const approach = easeOut(lt / TOUCH);
      const hero: Pose = {
        x: 1330, y: 1180 - lift, s: 560, dir: -1, turn: -.85, rot: -.04, handL: { x: mix(1180, meet.x + 20, approach), y: mix(700, meet.y, approach) }, reachL: 1, arms: "reach",
        lookX: -.8, lookY: .0, mouth: "smile", joy: smooth(TOUCH, TOUCH + .3, lt) * .6, blink: blinkAt(lt, [1.8]),
        brow: -.3, browY: .4, dangle: .5, flutter: f.tq * 4,
      };
      const friend: Pose = {
        tint: FRIEND, x: 600, y: 1130 - lift, s: 520, dir: 1, turn: .85,
        handR: { x: mix(780, meet.x - 20, approach), y: mix(760, meet.y, approach) }, reachR: 1, arms: "reach",
        lookX: .8, lookY: -.05, mouth: lt < TOUCH ? "o" : "grin", joy: smooth(TOUCH + .15, TOUCH + .45, lt) * .8,
        brow: lt < TOUCH ? -.5 : 0, browY: lt < TOUCH ? .6 : .2, eyes: 1 + .2 * (lt < TOUCH ? 1 : 0), blink: blinkAt(lt, [.4]),
        tuck: smooth(TOUCH + .1, TOUCH + .6, lt) * .6, dangle: smooth(TOUCH + .1, TOUCH + .6, lt), flutter: f.tq * 5,
        squash: kf(lt, [[TOUCH - .15, 0], [TOUCH + .02, -.1, "out"], [TOUCH + .5, 0]]),
      };
      const moon = moonAt(f, 1500, 200, 130);
      nightSky(c, { seed: 19, t: f.tq, stars: 8, starsY: 520, y1: 900, moon, clouds: 3, cloudY: [60, 420] });
      c.save(); applyCam(c, cam);
      // 문턱과 방(왼쪽)
      c.fillStyle = "#3a4296"; c.fillRect(-200, 900, 1320, 34);
      c.fillStyle = "#6a76c8"; c.fillRect(-200, 900, 1320, 5);
      const wg = c.createLinearGradient(0, 0, 900, 0);
      wg.addColorStop(0, "#161b58"); wg.addColorStop(1, "rgba(22,27,88,0)");
      c.fillStyle = wg; c.fillRect(-300, -200, 1300, 1100);
      c.fillStyle = "#0c0f48"; c.fillRect(-200, 934, 1320, 400);
      drawHoodie(c, friend);
      drawHoodie(c, hero);
      c.restore();
      return { cam, kids: [friend, hero], mask: [friend, hero], moon, swirls: moonSwirls(moon), turns: 1.1, TOUCH, meet, lift };
    },
    glow(c, f, s) {
      moonBloom(c, k.glowWhite, s.moon, .14);
      if (f.lt >= s.TOUCH) {
        const q = f.lt - s.TOUCH;
        lighter(c, () => {
          const r = 120 + q * 900;
          c.globalAlpha = clamp(1 - q / 1.0);
          c.drawImage(k.glowWhite, s.meet.x - r, s.meet.y - r, r * 2, r * 2);
          c.globalAlpha = .7; c.drawImage(k.glowGold, s.meet.x - 260, s.meet.y - 260, 520, 520); c.globalAlpha = 1;
          // 두 손에서 퍼지는 빛의 물결(동심원이 번졌다 사라진다)과 가는 실 둘이 부드럽게 감긴다
          for (let n = 0; n < 3; n++) {
            const age = (q * 1.2 + n / 3) % 1, rr = 90 + age * 420;
            c.globalAlpha = (1 - age) * .5; c.drawImage(k.glowGold, s.meet.x - rr, s.meet.y - rr * .8, rr * 2, rr * 1.6);
          }
          c.globalAlpha = 1;
          for (let n = 0; n < 2; n++) glowLine(c, Array.from({ length: 30 }, (_, i) => { const v = i / 29, a = v * Math.PI * 2.4 + f.tq * 3 + n * Math.PI; return { x: s.meet.x + Math.cos(a) * (40 + 70 * v), y: s.meet.y + Math.sin(a) * (16 + 30 * v) - v * 70 }; }), 1.8, .8);
          for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + f.tq, d = 80 + q * 260 + hash(i, 5) * 80; moth(c, k, s.meet.x + Math.cos(a) * d, s.meet.y + Math.sin(a) * d * .6, 12, f.tq, i, clamp(1 - q * .5)); }
        });
      }
    },
    front(c, f, s) {
      if (f.lt >= s.TOUCH && f.lt < s.TOUCH + .9) { for (let i = 0; i < 4; i++) sparkle(c, s.meet.x - 120 + i * 80, s.meet.y - 140 - (i % 2) * 40, 14, 1 - (f.lt - s.TOUCH) / .9); }
      if (f.lt > s.TOUCH + .5) for (let i = 0; i < 4; i++) { const ph = ((f.lt - s.TOUCH - .5) * .7 + i / 4) % 1; heart(c, s.meet.x - 100 + i * 70 + Math.sin(i * 2) * 40, s.meet.y - 180 - ph * 200, 24 + i * 3, Math.sin(ph * Math.PI)); }
    },
  });

  /* ── 20 함께 난다: 창을 떠나 도시 위로 ───────────────────── */
  add("fly-together", B(39), 20, "cut", {
    draw(c, f) {
      const lt = f.lt, tq = f.tq;
      const uA = 290, uB = 266;
      const c1 = { x: 800 + 40 * smooth(0, f.dur, lt), y: 520 + Math.sin(tq * 2.1) * 16 };
      const c2 = { x: 1070 + 40 * smooth(0, f.dur, lt), y: 585 + Math.sin(tq * 2.1 + 1.3) * 16 };
      const M = { x: (c1.x + c2.x) / 2 + 6, y: (c1.y + c2.y) / 2 - 28 };
      const hero: Pose = {
        x: c1.x, y: c1.y + .45 * uA, s: uA, dir: 1, turn: .8, rot: .36, arms: "none",
        handR: M, reachR: 1, handL: { x: c1.x + 60, y: c1.y - 240 }, reachL: 1,
        dangle: 1.2, flutter: tq * 6, tuck: .2, lookX: .9, lookY: -.1, mouth: "grin", joy: .75, blush: .6, blink: blinkAt(lt, [1.9]),
        drag: { x: -150, y: 12 * Math.sin(tq * 3) },
      };
      const friend: Pose = {
        tint: FRIEND, x: c2.x, y: c2.y + .45 * uB, s: uB, dir: 1, turn: -.7, rot: .34, arms: "none",
        handL: M, reachL: 1, handR: { x: c2.x + 90, y: c2.y - 220 }, reachR: 1,
        dangle: 1.3, flutter: tq * 6 + 1.4, tuck: .25, lookX: -.9, lookY: -.1, mouth: "grin", joy: .85, blush: .8, blink: blinkAt(lt, [.8]),
        drag: { x: -150, y: 12 * Math.sin(tq * 3 + 1) },
      };
      const moon = moonAt(f, 1560, 200, 120);
      nightSky(c, { seed: 20, t: tq, stars: 8, starsY: 520, y1: 900, clouds: 3, cloudY: [60, 460], moon });
      cloudStreaks(c, tq * 40, 62, 4, 240, 640, "#6b63ae", .26);
      windStreaks(c, tq, 6, 9, 150, 780, 1000);
      c.save(); applyCam(c, CAM0);
      const off = (lt * 240) % (1920 * .55);
      for (let n = 0; n < 4; n++) farCity(c, k, -off + n * 1920 * .55, 800 + lt * 60, .55, .38);
      roofsPainted(c, tq, 990 + lt * 260, lt * 500, 23, undefined, { windows: 1 });
      drawHoodie(c, hero);
      drawHoodie(c, friend);
      c.restore();
      return { cam: CAM0, kids: [hero, friend], mask: [hero, friend], moon, swirls: moonSwirls(moon), turns: 1.1, off, M, hero, friend };
    },
    glow(c, f, s) {
      for (let n = 0; n < 4; n++) farCityGlow(c, k, -s.off + n * 1920 * .55, 800 + f.lt * 60, .55, .38);
      moonBloom(c, k.glowWhite, s.moon, .18);
      lighter(c, () => {
        for (const [p, a] of [[s.hero, 0], [s.friend, 1]] as [Pose, number][]) {
          const hand = handAt(p, a as 0 | 1);
          lightThread(c, k, hand, { x: 2200, y: -300 }, f.tq, { amp: 46, w: 2.4, ph: a * 2 });
        }
        c.globalAlpha = .6; c.drawImage(k.glowGold, s.M.x - 90, s.M.y - 90, 180, 180); c.globalAlpha = 1;
        for (let i = 0; i < 16; i++) moth(c, k, s.hero.x - 190 - i * 76 + Math.sin(f.tq * 4 + i) * 14, s.hero.y - 130 + Math.cos(f.tq * 3 + i) * 50 + i * 10, 12, f.tq, i, 1 - i / 18);
      });
    },
    front(c, f, s) {
      if (f.lt > .5) for (let i = 0; i < 3; i++) { const ph = ((f.lt - .5) * .8 + i / 3) % 1; heart(c, s.M.x - 40 + i * 60, s.M.y - 150 - ph * 160, 22 + i * 4, Math.sin(ph * Math.PI)); }
    },
  });

  /* ── 21 구름을 뚫고 나선으로 오른다: 둘이 서로를 돌며. 친구가 신나서 공중제비를 돈다 ── */
  const HX = 960, HR = 250;
  const helixPt = (th: number, u: number) => ({ x: HX + Math.cos(th - u * Math.PI * 1.5) * HR * (1 - .1 * Math.abs(u)), y: 560 - u * 780 + 40 * Math.sin(th - u * Math.PI * 1.5) });
  add("spiral-up", B(40), 21, "cut", {
    draw(c, f) {
      const lt = f.lt, tq = f.tq;
      const rise = lt * 780;
      const th = 1.0 + lt * 1.5;
      const moon = moonAt(f, 1500, 210, mix(130, 220, smooth(0, f.dur, lt)));
      nightSky(c, { seed: 21, t: tq, stars: 8, starsY: 500, y1: 1000, top: "#070a28", bottom: "#1c2260", moon });
      // 구름 덩이가 아래로 쏟아져 지나간다(올라가는 느낌)
      c.save(); applyCam(c, CAM0);
      for (let i = 0; i < 20; i++) {
        const par = .5 + hash(i, 6) * 1.0;
        const yy = ((hash(i, 5) * 2800 + rise * par) % 2800) - 600;
        const xx = hash(i, 7) * 2400 - 300;
        billow(c, xx, yy, 120 + hash(i, 8) * 150, i % 3 ? "#6f68b4" : "#8a82c6", "#262270", .6, -.8, 3, .46, i);
      }
      c.restore();
      c.save(); c.translate(960, 540); c.rotate(Math.PI / 2); c.translate(-960, -540);
      windStreaks(c, tq, 9, 10, 100, 980, 1400, -1, "170,190,255", .18);
      c.restore();
      const roll = kf(lt, [[2.3, 0], [3.7, TAU, "io"]]);
      const mk = (a: number, tint: typeof HERO | undefined, u0: number, extra: Partial<Pose>): Pose => {
        const sn = Math.sin(a), cs = Math.cos(a), sc = 1 + .2 * sn;
        const dir = sn > 0 ? -1 : 1;
        const turn = .85 * dir * clamp(Math.abs(sn) * 3, 0, 1);
        return {
          tint, x: HX + cs * HR, y: 560 + 40 * sn + .45 * u0 * sc, s: u0 * sc, dir, turn, rot: dir * .16, arms: "fly",
          dangle: 1.1, flutter: tq * 6 + a, tuck: .2, lookX: dir * .6, lookY: -.3, mouth: "grin", joy: .6, drag: { x: dir * -90, y: 14 },
          ...extra,
        };
      };
      const A = mk(th, undefined, 250, { blink: blinkAt(lt, [1.3]), lookX: 0, lookY: -.5 });
      const Bk = mk(th + Math.PI, FRIEND, 232, { rot: ((Math.sin(th + Math.PI) > 0 ? -1 : 1) * .16) + roll, joy: .9, blink: blinkAt(lt, [.6]), mouth: lt > 2.3 && lt < 3.7 ? "yell" : "grin" });
      // 뒤에 있는 아이를 먼저 그린다
      const order = Math.sin(th) > 0 ? [Bk, A] : [A, Bk];
      c.save(); applyCam(c, CAM0);
      for (const p of order) drawHoodie(c, p);
      c.restore();
      return { cam: CAM0, kids: order, mask: order, moon, swirls: moonSwirls(moon), turns: 1.1, th, A, Bk };
    },
    glow(c, f, s) {
      moonBloom(c, k.glowWhite, s.moon, .18);
      lighter(c, () => {
        for (const [th0, k0] of [[s.th, 0], [s.th + Math.PI, 1]] as [number, number][]) {
          glowLine(c, Array.from({ length: 70 }, (_, i) => helixPt(th0, -.6 + i / 69 * 2.2)), 2.4);
          for (let j = 0; j < 7; j++) {
            const u = -.5 + ((hash(j, 81 + k0) + f.lt * .12) % 1) * 2.0, p = helixPt(th0, u);
            moth(c, k, p.x, p.y - 12, 11, f.tq, j + k0 * 7, .9);
          }
        }
      });
    },
    front(c, f, s) {
      if (f.lt > 2.3 && f.lt < 3.8) sparkle(c, s.Bk.x + 80, s.Bk.y - 280 + Math.sin(f.tq * 6) * 12, 16, smooth(2.3, 2.6, f.lt) * (1 - smooth(3.4, 3.8, f.lt)));
    },
  });

  /* ── 22 커다란 달 앞을 지난다: 달을 등진 둘의 실루엣 ───────── */
  const HERO_SIL = shade(HERO, .4), FRIEND_SIL = shade(FRIEND, .28);
  add("moon-pass", B(42), 22, "cut", {
    draw(c, f) {
      const lt = f.lt, tq = f.tq;
      const grow = smooth(0, 2.4, lt);
      const moon = moonAt(f, 1060, 450, mix(260, 360, grow));
      nightSky(c, { seed: 22, t: tq, stars: 7, starsY: 360, y1: 1000, moon });
      cloudSeaPaint(c, { y: mix(1010, 830, smooth(0, 3.4, lt)), t: tq, seed: 5, rows: 3, size: 170, tint: "#b9acea", shade: "#403a96", light: [0, -1], scroll: lt * 120 });
      const X = mix(-260, 1380, smooth(.1, 3.9, lt)) + 60 * smooth(3.9, f.dur, lt);
      const bob = Math.sin(lt * 1.2) * 40 * (1 - smooth(3.6, f.dur, lt)) + 330 * smooth(3.9, f.dur, lt);
      const M = { x: X + 130, y: 500 + bob - 30 };
      const hero: Pose = {
        tint: HERO_SIL, x: X, y: 500 + bob + 130, s: 300, dir: 1, turn: .55, rot: .2, rim: "rgba(255,226,150,.95)", arms: "none",
        handR: M, reachR: 1, handL: { x: X + 70, y: 500 + bob - 230 }, reachL: 1, dangle: 1, flutter: tq * 5, tuck: .15,
        lookX: .8, lookY: -.1, mouth: "grin", joy: .7, blush: .5, blink: blinkAt(lt, [2.2]), drag: { x: -110, y: 10 },
      };
      const friend: Pose = {
        tint: FRIEND_SIL, x: X + 260, y: 560 + bob + 120, s: 276, dir: 1, turn: -.55, rot: .2, rim: "rgba(255,226,150,.95)", arms: "none",
        handL: M, reachL: 1, handR: { x: X + 340, y: 560 + bob - 220 }, reachR: 1, dangle: 1.1, flutter: tq * 5 + 1.2, tuck: .2,
        lookX: -.8, lookY: -.1, mouth: "grin", joy: .8, blush: .6, blink: blinkAt(lt, [1.4]), drag: { x: -110, y: 10 },
      };
      c.save(); applyCam(c, CAM0);
      drawHoodie(c, hero);
      drawHoodie(c, friend);
      c.restore();
      return { cam: CAM0, kids: [hero, friend], mask: [hero, friend], moon, swirls: moonSwirls(moon), turns: 1.1, hero, friend, X, bob };
    },
    glow(c, f, s) {
      moonBloom(c, k.glowWhite, s.moon, .3);
      lighter(c, () => {
        for (const [p, a] of [[s.hero, 0], [s.friend, 1]] as [Pose, number][]) {
          const hand = handAt(p, a as 0 | 1);
          lightThread(c, k, hand, { x: hand.x + 700, y: -300 }, f.tq, { amp: 40, w: 2.2, ph: a, a: .9 });
        }
        for (let i = 0; i < 18; i++) moth(c, k, s.hero.x - 150 - i * 70 + Math.sin(f.tq * 3 + i) * 16, s.hero.y - 90 + Math.cos(f.tq * 2.4 + i) * 60 + i * 8, 12, f.tq, i, 1 - i / 20);
      });
    },
  });

}
