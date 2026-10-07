/**
 * 3막: 구름 위의 휴식과 폭풍, 그리고 다시 오름 (2:03 ~ 2:47).
 *
 *   구름에 앉아 쉰다 · 도시 틈으로 서로의 창을 찾는다(둘은 마주 보는 집이었다)
 *   → 하늘이 어두워진다 → 구름 징검다리를 함께 뛴다 → 폭풍이 덮친다, 나방이 흩어진다
 *   → 친구가 발을 헛디딘다 → 아이가 뛰어들어 손을 잡는다 → 어둠 속, 둘이 폰을 켠다(차가운 빛)
 *   → 흩어졌던 나방이 그 빛을 보고 모여든다(따뜻한 빛) → 빛의 기둥을 타고 폭풍을 뚫는다
 *   → 맑은 하늘, 달에 손이 닿는다 → 달이 터져 빛이 사방으로
 *
 * 차가운 빛(폰·번개)과 따뜻한 빛(나방·달)이 처음으로 한 편이 된다.
 */
import { hash, clamp, mix, smooth, blinkAt, easeIO, easeOut, moth, heart, glowLine, windStreaks, dust } from "./kit.ts";
import { drawHoodie, headAt, handsCenter as handsCenter2, FRIEND, HERO, shade, type Pose } from "./hoodie.ts";
import { armsSeq, kf, breathe, jump, integ } from "./anim.ts";
import { nightSky, moonSwirls, moonBloom, type Moon } from "./sky.ts";
import { applyCam, lighter, CAM0, type Ctx, type Cam, type F } from "./stage.ts";
import { cloudSeaPaint, cloudIsland, cityHole, stormClouds, lightning, billow } from "./world2.ts";

const TAU = Math.PI * 2;
function mixHex2(a: string, b: string, w: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sft: number) => Math.round(mix((pa >> sft) & 255, (pb >> sft) & 255, w));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

export function act4(x: Ctx) {
  const { k, add, B, song } = x;
  const beat = song.beatLength;
  const moonAt = (f: F, mx: number, my: number, r: number, lit = 1): Moon => ({ x: mx, y: my, r, beat: f.beat, t: f.tq, lit });
  const mkHero = (o: Partial<Pose>): Pose => ({ x: 0, y: 0, s: 300, ...o });
  const mkFriend = (o: Partial<Pose>): Pose => ({ tint: FRIEND, x: 0, y: 0, s: 276, ...o });

  /* ── 23 구름 위에 앉아 쉰다. 구름 틈 아래로 도시가 보인다: 둘의 창이 마주 보고 있다 ──────────────
   *  23a 내려앉아 앉는다(와이드) → 23b 친구가 아래를 가리키고, 카메라가 구름 틈으로 파고든다
   *  두 컷이 같은 시계(T)를 쓴다. 23b의 T는 23a 시작부터 잰다. */
  const CLOUD_Y = 800;
  const HOLE = { x: 430, y: 960, rx: 380, ry: 104 };
  function sitState(T: number, tq: number) {
    const land = easeOut(T / .6), landed = T >= .6;
    const sit = kf(T, [[.75, 0], [1.25, 1, "out"]]);
    const lean = smooth(1.6, 2.4, T);
    const yy = landed ? CLOUD_Y : mix(CLOUD_Y - 300, CLOUD_Y, land);
    const looksDown = smooth(2.5, 3.0, T);
    const bump = kf(T, [[.58, 0], [.66, .14, "out"], [.95, 0]]);
    const point = armsSeq(T - 2.6, [[0, "none"], [.35, "point", .35, "back"]]);
    const hero = mkHero({
      x: 800, y: yy, s: 300, sit, dir: 1, turn: mix(.45, -.4, looksDown), tilt: -.05 * lean,
      squash: bump + breathe(T, .012), lookX: mix(.5, -.7, looksDown), lookY: mix(-.5, .8, looksDown),
      nod: .6 * looksDown, mouth: T < 2.5 ? "smile" : "o", brow: -.3 * looksDown, browY: .6 * looksDown, eyes: 1 + .25 * looksDown, blink: blinkAt(T, [1.6, 3.7]),
      arms: armsSeq(T, [[0, "cheer"], [.5, "none", .3]]), tuck: landed ? 0 : .5,
    });
    const friend = mkFriend({
      x: mix(1080, 1010, lean), y: yy - 10 * (1 - land), s: 276, sit, dir: T > 2.6 ? -1 : 1,
      turn: mix(-.45, -.6, looksDown), tilt: -.1 * lean,
      squash: bump * .9 + breathe(T, .012, 1.9), lookX: mix(-.5, -.7, looksDown), lookY: mix(-.5, .9, looksDown),
      nod: .5 * looksDown, mouth: T < 2.5 ? "smile" : "o", brow: -.3 * looksDown, browY: .6 * looksDown, eyes: 1 + .25 * looksDown, blink: blinkAt(T, [1.2, 3.3]),
      arms: T < 2.6 ? armsSeq(T, [[0, "cheer"], [.5, "none", .3]]) : point, tuck: landed ? 0 : .5,
    });
    void tq;
    return { hero, friend, looksDown };
  }
  const sitScene = (c: CanvasRenderingContext2D, f: F, T: number, cam: Cam) => {
    const st = sitState(T, f.tq);
    const moonW = moonAt(f, 1400, 300, 290);
    c.save(); applyCam(c, cam);
    nightSky(c, { seed: 23, t: f.tq, stars: 7, starsY: 420, y1: 900, moon: moonW });
    cloudSeaPaint(c, { y: CLOUD_Y + 30, t: f.tq, seed: 3, rows: 4, size: 150, tint: "#a89fdc", shade: "#383488", light: [.6, -.8] });
    cityHole(c, k, f.tq, HOLE.x, HOLE.y, HOLE.rx, HOLE.ry, 0);
    drawHoodie(c, st.hero); drawHoodie(c, st.friend);
    c.restore();
    // 붓 소용돌이는 화면 좌표: 달을 카메라 변환에 맞춘다
    const sm: Moon = { ...moonW, x: 960 + (moonW.x - cam.cx) * cam.z, y: 540 + (moonW.y - cam.cy) * cam.z, r: moonW.r * cam.z };
    return { st, moonW, sm };
  };
  const sitGlow = (c: CanvasRenderingContext2D, f: F, T: number, st: ReturnType<typeof sitState>, moonW: Moon) => {
    moonBloom(c, k.glowWhite, moonW, .22);
    lighter(c, () => {
      // 도시 틈의 두 창이 번갈아 반짝인다(먼저 분홍, 다음 따뜻한 금빛), 그리고 둘을 잇는 실
      const a = st.looksDown;
      if (a > .05) {
        const w1 = (.6 + .4 * Math.sin(f.tq * 5)) * smooth(2.8, 3.2, T), w2 = (.6 + .4 * Math.sin(f.tq * 5 + 1.5)) * smooth(3.3, 3.7, T);
        c.globalAlpha = w1 * a; c.drawImage(k.glowPink, HOLE.x + 30 - 70, HOLE.y + 14 - 70, 140, 140);
        c.globalAlpha = w2 * a; c.drawImage(k.glowGold, HOLE.x - 30 - 70, HOLE.y + 14 - 70, 140, 140);
        c.globalAlpha = 1;
        if (T > 3.7) {
          const tt = easeOut((T - 3.7) / .8);
          glowLine(c, [{ x: HOLE.x - 30 + 10, y: HOLE.y + 14 }, { x: mix(HOLE.x - 20, HOLE.x + 20, tt), y: HOLE.y + 14 - Math.sin(tt * Math.PI) * 10 }, { x: HOLE.x + 30 - 10, y: HOLE.y + 14 }].slice(0, 3), 2.6, a);
          for (let i = 0; i < 5; i++) { const v = ((hash(i, 5) + T * .35) % 1); moth(c, k, mix(HOLE.x - 24, HOLE.x + 24, v), HOLE.y + 6 - Math.sin(v * Math.PI) * 18, 7, f.tq, i, a * .9); }
        }
      }
      // 나방이 둘의 머리와 어깨에 내려앉는다
      for (let i = 0; i < 6; i++) {
        const tgt = i < 3 ? st.hero : st.friend, hp = headAt(tgt);
        const p = easeIO(clamp((T - 1.0 - i * .25) / 1.2));
        const ox = (i % 3 - 1) * 46, oy = -60 - (i % 2) * 34;
        moth(c, k, mix(hp.x + 400, hp.x + ox, p) + Math.sin(f.tq * 4 + i) * 10 * (1 - p), mix(hp.y - 300, hp.y + oy, p), 11, p >= 1 ? f.tq * .3 : f.tq, i, .95);
      }
    });
  };
  add("cloud-sit", B(44), 23, "cut", {
    draw(c, f) {
      const r = sitScene(c, f, f.lt, CAM0);
      return { cam: CAM0, kids: [r.st.hero, r.st.friend], mask: [r.st.hero, r.st.friend], turns: 1.1, swirls: moonSwirls(r.sm), r };
    },
    glow(c, f, s) { sitGlow(c, f, f.lt, s.r.st, s.r.moonW); },
    front(c, f) { if (f.lt > .6 && f.lt < 1.6) dust(c, 800, CLOUD_Y, 110, (f.lt - .6) / 1.0); },
  });
  add("cloud-peek", B(45), 23, "cut", {
    draw(c, f) {
      const T = f.lt + (B(45) - B(44)), e = easeIO(smooth(.55, 2.5, f.lt));
      const cam: Cam = { cx: mix(960, HOLE.x + 30, e), cy: mix(540, HOLE.y - 20, e), z: mix(1, 2.5, e) };
      const r = sitScene(c, f, T, cam);
      return { cam, kids: [r.st.hero, r.st.friend], mask: [], turns: 1.1, swirls: moonSwirls(r.sm), r, T };
    },
    glow(c, f, s) { sitGlow(c, f, s.T, s.r.st, s.r.moonW); },
  });

  /* ── 24 하늘이 어두워진다: 둘이 일어서 손을 잡고 먹구름을 바라본다 ───── */
  add("storm-hint", B(46), 24, "cut", {
    draw(c, f) {
      const lt = f.lt, tq = f.tq, dk = smooth(0, f.dur, lt) * .85;
      const stand = kf(lt, [[1.0, 1], [1.7, 0, "back"]]);
      const laugh = 1 - smooth(.9, 1.4, lt);
      const wind = dk;
      const FLASH = [[2.3, .18], [4.4, .3], [5.2, .5]] as [number, number][];
      const M = { x: 905 + 6 * Math.sin(tq * 3), y: CLOUD_Y - mix(235, 175, smooth(1.2, 1.7, lt)) };
      const hold = Math.max(laugh * smooth(0, .3, lt), smooth(1.5, 1.9, lt));
      const hero = mkHero({
        x: 800, y: CLOUD_Y, s: 300, sit: stand, dir: 1, turn: mix(.8, .85, 1 - laugh), tilt: .08 * laugh, squash: breathe(lt, .01) + kf(lt, [[1.65, .1], [1.8, -.08, "out"], [2.1, 0]]),
        arms: "none", handR: M, reachR: hold,
        lookX: mix(.9, .9, 1 - laugh), lookY: mix(-.1, .1, smooth(2, 3, lt)), brow: -.3 * smooth(2.1, 2.9, lt) + .4 * smooth(4.6, 5.0, lt), browY: .5 * smooth(2.1, 2.9, lt), joy: laugh * .9,
        mouth: lt < 1.0 ? "grin" : lt < 2.5 ? "smile" : lt < 4.6 ? "flat" : "smile", nod: kf(lt, [[4.4, 0], [4.6, 1], [4.85, 0]]), blink: blinkAt(lt, [1.3, 3.3]),
        drag: { x: -80 * wind, y: 8 }, lean: .06 * wind,
      });
      const friend = mkFriend({
        x: 1010, y: CLOUD_Y, s: 276, sit: stand, dir: 1, turn: mix(.8, .8, 1 - laugh), tilt: -.08 * laugh - .05 * smooth(2, 3, lt), squash: breathe(lt, .01, 1.8) + kf(lt, [[1.7, .1], [1.85, -.08, "out"], [2.15, 0]]),
        arms: "none", handL: M, reachL: hold, handR: undefined,
        lookX: .9, lookY: -.05, brow: -.6 * smooth(2.3, 2.9, lt), browY: .7 * smooth(2.3, 2.9, lt), eyes: 1 + .2 * smooth(2.3, 2.9, lt), joy: laugh * .95,
        mouth: lt < 1.0 ? "grin" : lt < 2.5 ? "smile" : lt < 4.6 ? "o" : "flat", blink: blinkAt(lt, [1.0, 3.9]), drag: { x: -80 * wind, y: 8 },
        lean: .08 * wind,
      });
      const moon = moonAt(f, 1300, 260, 230, 1 - .45 * dk);
      nightSky(c, { seed: 24, t: tq, stars: 6, starsY: 380, y1: 900, top: "#06081f", bottom: "#161a52", moon });
      stormClouds(c, tq, 9, { dark: dk, y: -80, flash: 0 });
      cloudSeaPaint(c, { y: CLOUD_Y + 30, t: tq, seed: 3, rows: 4, size: 150, tint: mix(0, 1, dk) > .5 ? "#8c84c8" : "#a89fdc", shade: "#2c2878", light: [.6, -.8] });
      c.save(); applyCam(c, CAM0);
      drawHoodie(c, hero); drawHoodie(c, friend);
      c.restore();
      let flash = 0;
      for (const [t0, a] of FLASH) flash = Math.max(flash, a * Math.exp(-Math.max(0, lt - t0) * 9) * (lt >= t0 ? 1 : 0));
      return { cam: CAM0, kids: [hero, friend], mask: [hero, friend], moon, swirls: moonSwirls(moon), turns: 1.1, dk, flash, hero, friend };
    },
    glow(c, f, s) {
      moonBloom(c, k.glowWhite, s.moon, .16);
      lighter(c, () => {
        // 멀리 번개(작게)
        if (s.flash > .02) lightning(c, k, 1640, 120, 1580 + 20 * Math.sin(f.lt), 560, 7, clamp(s.flash * 3));
        // 나방들이 바람에 밀려 한쪽으로 쓸려 간다
        for (let i = 0; i < 12; i++) {
          const v = ((hash(i, 11) + f.lt * (.1 + .25 * s.dk) * (1 + hash(i, 12))) % 1);
          moth(c, k, mix(1500, 200, v) + Math.sin(f.tq * 4 + i) * 20, 430 + hash(i, 13) * 280 + Math.sin(v * 8 + i) * 40, 12, f.tq, i, .9 * (1 - smooth(.85, 1, v)));
        }
      });
    },
    front(c, f, s) {
      if (f.lt < 1.5) for (let i = 0; i < 4; i++) { const ph = (f.lt * .9 + i / 4) % 1; heart(c, 840 + i * 64 + Math.sin(i * 2) * 26, 520 - ph * 200, 22 + (i % 3) * 5, Math.sin(ph * Math.PI) * (1 - smooth(1.0, 1.5, f.lt))); }
      if (s.flash > .02) { c.fillStyle = `rgba(210,222,255,${s.flash * .55})`; c.fillRect(-500, -500, 3000, 2200); }
    },
  });

  /* ── 25 구름 징검다리를 함께 뛴다(박마다 한 번) ───────────────── */
  const P2 = beat * 2;
  const ISL = (i: number) => ({ x: 300 + i * 620, y: CLOUD_Y + 24 * Math.sin(i * 1.9) });
  add("cloud-hop", B(48), 25, "flash", {
    draw(c, f) {
      const lt = f.lt, tq = f.tq;
      const hopOf = (delay: number, h: number) => {
        const t = lt - delay, kk = Math.max(0, Math.floor(t / P2)), tl = t - kk * P2;
        const a = ISL(kk), b = ISL(kk + 1);
        const j = jump(tl, .22, P2 - .1, h, { crouch: .2, anticip: .2, land: .18 });
        const px = t < 0 ? a.x : mix(a.x, b.x, j.p);
        const py = mix(a.y, b.y, j.p) + j.y;
        return { px, py, j, kk };
      };
      const h1 = hopOf(0, 250), h2 = hopOf(.08, 215);
      const hero = mkHero({
        x: h1.px - 105, y: h1.py, s: 300, dir: 1, turn: .55, squash: h1.j.squash, tuck: h1.j.tuck, arms: armsSeq(0, [[0, "none"]]),
        handR: { x: (h1.px + h2.px) / 2, y: (h1.py + h2.py) / 2 - 175 }, reachR: 1,
        lookX: .6, lookY: -.2, mouth: "grin", joy: .7, blush: .6, blink: blinkAt(lt, [1.9, 4.3]), drag: { x: -50, y: -h1.j.y * .06 },
      });
      const friend = mkFriend({
        x: h2.px + 105, y: h2.py, s: 276, dir: 1, turn: -.5, squash: h2.j.squash, tuck: h2.j.tuck, arms: "none",
        handL: { x: (h1.px + h2.px) / 2, y: (h1.py + h2.py) / 2 - 175 }, reachL: 1, handR: undefined,
        lookX: -.6, lookY: -.2, mouth: "grin", joy: .9, blush: .8, blink: blinkAt(lt, [.9, 3.4]), drag: { x: -50, y: -h2.j.y * .06 },
      });
      const cam: Cam = { cx: (hero.x + friend.x) / 2 + 260, cy: 540, z: 1 };
      const moon = moonAt(f, 1500, 210, 150, .75);
      nightSky(c, { seed: 25, t: tq, stars: 5, starsY: 360, y1: 900, top: "#06081f", bottom: "#161a52", moon });
      stormClouds(c, tq, 9, { dark: .75, y: -80 });
      cloudSeaPaint(c, { y: 1010, t: tq, seed: 7, rows: 3, size: 170, tint: "#7a72b8", shade: "#24226c", scroll: cam.cx * .5 });
      c.save(); applyCam(c, cam);
      for (let i = 0; i < 8; i++) { const p = ISL(i); cloudIsland(c, p.x, p.y, 340, 30 + i); }
      drawHoodie(c, hero); drawHoodie(c, friend);
      c.restore();
      return { cam, kids: [hero, friend], mask: [hero, friend], moon, swirls: moonSwirls(moon), turns: 1.1, hero, friend, h1, h2 };
    },
    glow(c, f, s) {
      moonBloom(c, k.glowWhite, s.moon, .14);
      lighter(c, () => {
        for (let i = 0; i < 14; i++) {
          const kid = i % 2 ? s.hero : s.friend;
          moth(c, k, kid.x - 150 - i * 52 + Math.sin(f.tq * 4 + i) * 16, kid.y - 170 - (i % 4) * 30 + Math.cos(f.tq * 3 + i) * 34, 12, f.tq, i, 1 - i / 17);
        }
      });
    },
    front(c, f, s) {
      for (const h of [s.h1, s.h2]) {
        const tl = (f.lt - (h === s.h2 ? .08 : 0)) - h.kk * P2;
        const land = tl - (P2 - .1);
        if (land > -.1 && land < .8 && h.kk >= 0) { const a = ISL(h.kk + 1); dust(c, a.x - (h === s.h2 ? -20 : 40), a.y + 6, 110, clamp((land + .1) / .9)); }
      }
    },
  });

  /** 번개의 번쩍임: 지정한 시각들에서 확 밝아졌다 사라진다 */
  const flashAt = (lt: number, ks: [number, number][]) => ks.reduce((m, [t0, a]) => Math.max(m, lt >= t0 ? a * Math.exp(-(lt - t0) * 8) : 0), 0);
  /** 폰 랜턴: 깨끗한 장면에 폰 몸체를 그린다(손 자리) */
  const phoneProp = (c: CanvasRenderingContext2D, px: number, py: number, ang: number, s = 1) => {
    c.save(); c.translate(px, py); c.rotate(ang);
    c.fillStyle = "#0d1030"; c.fillRect(-20 * s, -32 * s, 40 * s, 64 * s);
    c.fillStyle = "#e4eeff"; c.fillRect(-17 * s, -28 * s, 34 * s, 56 * s);
    c.restore();
  };
  /** 폰 랜턴의 차가운 빛(빛 층): 화면에서 번지는 원과 위로 퍼지는 빛의 부채꼴 */
  const lanternGlow = (c: CanvasRenderingContext2D, px: number, py: number, a: number, r = 1) => {
    if (a <= 0) return;
    c.save();
    c.globalCompositeOperation = "lighter";
    const g = c.createRadialGradient(px, py - 40 * r, 20, px, py - 40 * r, 520 * r);
    g.addColorStop(0, `rgba(210,228,255,${.5 * a})`); g.addColorStop(.35, `rgba(150,180,255,${.22 * a})`); g.addColorStop(1, "rgba(120,150,255,0)");
    c.fillStyle = g; c.beginPath(); c.arc(px, py - 40 * r, 520 * r, 0, TAU); c.fill();
    c.globalAlpha = a; c.drawImage(k.glowWhite, px - 70 * r, py - 70 * r, 140 * r, 140 * r);
    c.restore();
  };

  /* ── 26 폭풍이 덮친다: 먹구름이 몰려오고, 나방이 바람에 흩어진다 ──── */
  add("storm-hits", B(50), 26, "cut", {
    draw(c, f) {
      const lt = f.lt, tq = f.tq;
      const rush = smooth(0, 2.2, lt);
      const FL: [number, number][] = [[.5, .3], [1.55, .85], [2.35, .4]];
      const flash = flashAt(lt, FL);
      const shake = Math.sin(tq * 53) * 5 * flashAt(lt, [[1.55, 1]]);
      const cam: Cam = { cx: 960 + shake, cy: 540 + shake * .6, z: 1 };
      const lean = .1 * smooth(0, .6, lt);
      const hold: Partial<Pose> = { drag: { x: -230 * rush, y: 12 * Math.sin(tq * 9) }, lean, eyes: .75, brow: .5, browY: -.3 };
      const hero = mkHero({
        x: 900, y: CLOUD_Y, s: 300, dir: 1, turn: .8, arms: "guard", handR: { x: 1030, y: CLOUD_Y - 170 }, reachR: 1,
        squash: .04 * Math.sin(tq * 14) * rush, lookX: .8, lookY: -.1, mouth: lt < 1.3 ? "flat" : "yell", blink: lt > .7 ? .5 : 0, ...hold,
      });
      const friend = mkFriend({
        x: 1090, y: CLOUD_Y, s: 276, dir: 1, turn: .8, arms: "guard", handL: { x: 1030, y: CLOUD_Y - 170 }, reachL: 1,
        squash: .04 * Math.sin(tq * 14 + 1) * rush, lookX: .8, lookY: -.1, mouth: lt < 1.3 ? "o" : "yell", blink: lt > .7 ? .5 : 0, ...hold,
      });
      nightSky(c, { seed: 26, t: tq, stars: 0, y1: 900, top: "#04051a", bottom: "#101440" });
      stormClouds(c, tq, 9, { dark: 1, y: -60 + 20 * rush, flash });
      // 오른쪽에서 밀려오는 먹구름 벽
      c.save(); applyCam(c, CAM0);
      for (let i = 0; i < 9; i++) {
        const xx = 2400 - 1900 * rush + i * 150 + Math.sin(tq * 3 + i) * 20, yy = 150 + (i % 5) * 170;
        billow(c, xx, yy, 280 + hash(i, 4) * 120, mixHex2("#2a2468", "#4c4290", flash), "#07061e", .1, -.9, 3, .66, i);
      }
      c.restore();
      cloudSeaPaint(c, { y: CLOUD_Y + 30, t: tq * 2.5, seed: 3, rows: 4, size: 150, tint: "#6a62a8", shade: "#1e1a60", scroll: lt * 160 });
      c.save(); applyCam(c, cam);
      cloudIsland(c, 980, CLOUD_Y, 520, 33, { tint: "#8f86cc", shade: "#2c2878", scatter: smooth(.3, 2.4, lt) * .8, light: [-.5, -.8] });
      drawHoodie(c, hero); drawHoodie(c, friend);
      c.restore();
      return { cam, kids: [hero, friend], mask: [hero, friend], turns: 1.1, flash, rush, FL };
    },
    glow(c, f, s) {
      lighter(c, () => {
        if (f.lt > .5 && f.lt < 1.2) lightning(c, k, 1500, -40, 1340, 560, 3, flashAt(f.lt, [[.5, 1]]) * 2);
        if (f.lt > 1.55 && f.lt < 2.2) lightning(c, k, 650, -60, 780, 640, 5, flashAt(f.lt, [[1.55, 1]]) * 1.6);
        // 나방이 돌풍에 휩쓸려 사라진다(점점 흐려진다)
        for (let i = 0; i < 40; i++) {
          const t0 = hash(i, 51) * 1.2, a = clamp((f.lt - t0) / 1.4);
          const sx = 760 + hash(i, 52) * 460, sy = 500 + hash(i, 53) * 240;
          const e = a * a;
          moth(c, k, sx - e * 1500 + Math.sin(f.tq * 8 + i) * 30 * a, sy + Math.sin(e * 9 + i) * 90 * a - e * 140, 12 * (1 - a * .4), f.tq * 2, i, 1 - smooth(.55, 1, a));
        }
      });
    },
    front(c, f, s) {
      if (s.flash > .02) { c.fillStyle = `rgba(214,226,255,${s.flash * .6})`; c.fillRect(-500, -500, 3000, 2200); }
    },
  });

  /* ── 27 친구가 발을 헛디딘다: 손이 풀리고 구름 틈으로 떨어진다. 아이가 소리친다 ── */
  add("slip", B(51), 27, "cut", {
    draw(c, f) {
      const lt = f.lt, tq = f.tq;
      const cam: Cam = { cx: 1000, cy: 640, z: 1.3 };
      const FL: [number, number][] = [[.1, .5], [1.2, .9]];
      const flash = flashAt(lt, FL);
      const SLIP = .55, FALL = 1.05;
      const fall = lt < FALL ? 0 : (lt - FALL);
      const fy = lt < FALL ? CLOUD_Y : CLOUD_Y + 700 * fall * fall;
      const fx = 1090 + (lt < SLIP ? 0 : 36 * smooth(SLIP, FALL, lt)) + 180 * fall * fall;
      const slide = smooth(SLIP, FALL, lt);
      const hero = mkHero({
        x: 940, y: CLOUD_Y, s: 300, dir: 1, turn: kf(lt, [[0, .8], [FALL, .8], [FALL + .5, 0], [2.2, 0]]), arms: "guard",
        handR: lt < FALL + .15 ? { x: mix(1030, fx - 30, smooth(SLIP, FALL + .1, lt)), y: mix(CLOUD_Y - 170, fy - 150, smooth(SLIP, FALL + .1, lt)) } : { x: 1130 + 60 * (lt - FALL - .15), y: CLOUD_Y + 120 + 380 * (lt - FALL - .15) }, reachR: 1,
        lookX: .6, lookY: kf(lt, [[0, -.1], [FALL, .2], [FALL + .5, .9]]), lean: .1 + .16 * smooth(SLIP, FALL, lt) + .12 * smooth(FALL, FALL + .4, lt), eyes: 1.35,
        brow: -.9, browY: 1, mouth: "yell", drag: { x: -200, y: 12 * Math.sin(tq * 9) },
        squash: kf(lt, [[FALL, 0], [FALL + .12, .08], [FALL + .5, -.06], [1.9, 0]]) + (lt > 1.9 ? .1 * smooth(1.9, 2.4, lt) : 0),
      });
      const friend = mkFriend({
        x: fx, y: fy, s: 276, dir: 1, turn: .5, rot: lt < FALL ? .1 * slide : .1 + 1.6 * fall, arms: lt < FALL ? "guard" : "flail",
        handL: lt < FALL ? { x: mix(1030, 1060, slide), y: CLOUD_Y - 170 } : undefined, reachL: lt < FALL ? 1 : 0,
        lean: lt < FALL ? -.2 * slide : 0, eyes: 1.4, brow: -1, browY: 1, mouth: "yell", dangle: 1.3, flutter: tq * 12, tuck: .15,
        squash: lt < FALL ? .05 * slide : -.05, drag: { x: -120, y: -fall * 80 }, lookX: -.4, lookY: .4,
      });
      nightSky(c, { seed: 27, t: tq, stars: 0, y1: 1000, top: "#04051a", bottom: "#101440" });
      stormClouds(c, tq, 9, { dark: 1, y: -60, flash });
      cloudSeaPaint(c, { y: CLOUD_Y + 30, t: tq * 2.5, seed: 3, rows: 4, size: 150, tint: "#6a62a8", shade: "#1e1a60" });
      c.save(); applyCam(c, cam);
      // 발밑의 구름 섬이 갈라진다
      cloudIsland(c, 1000, CLOUD_Y, 500, 33, { tint: "#8f86cc", shade: "#2c2878", scatter: .8 + .2 * smooth(0, 1.5, lt), light: [-.5, -.8] });
      drawHoodie(c, hero);
      if (lt < 1.9) drawHoodie(c, friend);
      c.restore();
      return { cam, kids: lt < 1.9 ? [hero, friend] : [hero], mask: lt < 1.9 ? [hero, friend] : [hero], turns: 1.1, flash, friend, hero, fall };
    },
    glow(c, f, s) {
      lighter(c, () => {
        if (f.lt > 1.2 && f.lt < 1.9) lightning(c, k, 1500, -80, 1380, CLOUD_Y + 40, 8, flashAt(f.lt, [[1.2, 1]]) * 1.8);
        // 아이의 소리에 놀란 나방 몇 마리가 어두운 쪽에서 깜박인다
        for (let i = 0; i < 5; i++) moth(c, k, 260 + i * 70 + Math.sin(f.tq * 5 + i) * 18, 380 + i * 56, 12, f.tq * 2, i, .35 + .2 * Math.sin(f.tq * 6 + i));
      });
    },
    front(c, f, s) {
      if (s.flash > .02) { c.fillStyle = `rgba(214,226,255,${s.flash * .6})`; c.fillRect(-500, -500, 3000, 2200); }
    },
  });

  /* ── 28 아이가 뛰어든다: 떨어지는 둘, 손이 닿는 순간 한 호흡 멈춘다 ── */
  const CATCH = 1.55, HOLD = .27;
  add("dive-catch", B(52), 28, "cut", {
    draw(c, f) {
      // 손이 닿는 순간 몇 프레임 멈춘다(타격감)
      const lt0 = f.lt, lt = lt0 < CATCH ? lt0 : lt0 < CATCH + HOLD ? CATCH : lt0 - HOLD;
      const tq = f.tq;
      const FL: [number, number][] = [[.3, .5], [CATCH, .9]];
      const flash = flashAt(lt0, FL);
      const ap = smooth(0, CATCH, lt);
      const fy = 640 + 18 * Math.sin(lt * 3), fxp = 1000 + 30 * Math.sin(lt * 2.3);
      // 친구: 한 바퀴 돌며 떨어지다 손이 닿을 때 몸을 바로 세워 손을 위로 뻗는다. 아이는 머리부터 곤두박질
      const M = { x: fxp + 6, y: fy - 215 };
      const hy = mix(-300, M.y - 215, easeIO(ap)), hx = mix(960, M.x, ap);
      const grabbed = lt >= CATCH - .02;
      const spin = TAU * Math.pow(1 - ap, 1.4);
      const reach = smooth(CATCH - .45, CATCH, lt);
      const friend = mkFriend({
        x: fxp, y: fy + .45 * 276, s: 276, dir: 1, turn: .4, rot: .15 + spin, arms: "flail",
        handR: M, reachR: reach, eyes: 1.4, brow: -1, browY: 1, mouth: "yell", dangle: 1.4, flutter: tq * 12, tuck: .15,
        drag: { x: -60, y: 90 }, lookX: 0, lookY: -.7,
      });
      const hero = mkHero({
        x: hx, y: hy + .45 * 300, s: 300, dir: 1, turn: .3, rot: Math.PI + .06 * Math.sin(lt * 5), arms: "up",
        handL: { x: M.x - 14, y: M.y - 4 }, reachL: reach, handR: { x: M.x + 14, y: M.y - 4 }, reachR: reach,
        eyes: 1.2, brow: grabbed ? .3 : .6, browY: .3, mouth: grabbed ? "o" : "yell", lookX: 0, lookY: .9, dangle: .8, flutter: tq * 10, drag: { x: 0, y: 130 },
      });
      nightSky(c, { seed: 28, t: tq, stars: 0, y1: 1000, top: "#03041a", bottom: "#0c1038" });
      // 구름 덩이와 바람결이 위로 쏟아진다(떨어지는 느낌)
      c.save(); applyCam(c, CAM0);
      for (let i = 0; i < 12; i++) {
        const sp = 900 + hash(i, 6) * 900;
        const yy = 1300 - ((hash(i, 5) * 2400 + lt * sp) % 2400), xx = hash(i, 7) * 2200 - 150;
        billow(c, xx, yy, 130 + hash(i, 8) * 160, mixHex2("#2a2468", "#5a4ea0", flash), "#07061e", .3, -.9, 3, .55, i);
      }
      c.restore();
      c.save(); c.translate(960, 540); c.rotate(Math.PI / 2); c.translate(-960, -540);
      windStreaks(c, lt, 12, 12, 100, 980, 2200, 1, "170,190,255", .2);
      c.restore();
      c.save(); applyCam(c, CAM0);
      drawHoodie(c, friend); drawHoodie(c, hero);
      c.restore();
      return { cam: CAM0, kids: [friend, hero], mask: [friend, hero], turns: 1.1, flash, friend, hero, M, grabbed, lt0 };
    },
    glow(c, f, s) {
      lighter(c, () => {
        if (f.lt > .3 && f.lt < 1.0) lightning(c, k, 520, -60, 640, 760, 4, flashAt(f.lt, [[.3, 1]]) * 1.6);
        if (f.lt > CATCH && f.lt < CATCH + .8) { const q = (f.lt - CATCH) / .8; c.globalAlpha = (1 - q) * .8; c.drawImage(k.glowWhite, s.M.x - 220, s.M.y - 220, 440, 440); c.globalAlpha = 1; }
      });
    },
    front(c, f, s) {
      if (s.flash > .02) { c.fillStyle = `rgba(214,226,255,${s.flash * .55})`; c.fillRect(-500, -500, 3000, 2200); }
      // 손이 닿는 순간의 충격 표시(굵은 방사 획)
      if (f.lt > CATCH - .02 && f.lt < CATCH + HOLD + .25) {
        const q = clamp((f.lt - CATCH) / .5);
        c.save(); c.strokeStyle = "rgba(244,231,198,.9)"; c.lineCap = "round"; c.lineWidth = 7 * (1 - q * .5);
        for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + .2, r0 = 70 + q * 40, r1 = r0 + 60 * (1 - q); c.beginPath(); c.moveTo(s.M.x + Math.cos(a) * r0, s.M.y + Math.sin(a) * r0); c.lineTo(s.M.x + Math.cos(a) * r1, s.M.y + Math.sin(a) * r1); c.stroke(); }
        c.restore();
      }
    },
  });

  /* ── 29 어둠 속에서 둘이 폰을 켠다: 차가운 빛 두 개 ──────────── */
  add("lanterns", B(53), 29, "dip", {
    draw(c, f) {
      const lt = f.lt, tq = f.tq;
      const heroOn = smooth(.55, .9, lt), friendOn = smooth(1.4, 1.75, lt);
      const sway = Math.sin(tq * 1.6) * 14;
      const cx = 960 + sway;
      const hero = mkHero({
        x: cx - 100, y: 600 + .45 * 300 + 8 * Math.sin(tq * 2), s: 300, dir: 1, turn: .35, rot: .12, arms: "none",
        handR: { x: cx + 8, y: 470 }, reachR: 1, handL: heroOn > 0 ? { x: cx - 215, y: 395 - 20 * heroOn } : undefined, reachL: heroOn,
        lookX: .3, lookY: -.5, eyes: 1.1, brow: kf(lt, [[0, .8], [1.2, .5], [2.2, 0]]) * -1 + .1, browY: .4, mouth: lt < 1.8 ? "o" : "flat", blink: blinkAt(lt, [1.2, 2.3]),
        dangle: .5, flutter: tq * 4, drag: { x: 0, y: 70 },
      });
      const friend = mkFriend({
        x: cx + 100, y: 630 + .45 * 276 + 8 * Math.sin(tq * 2 + 1), s: 276, dir: 1, turn: -.35, rot: -.1, arms: "none",
        handL: { x: cx + 8, y: 470 }, reachL: 1, handR: friendOn > 0 ? { x: cx + 205, y: 410 - 20 * friendOn } : undefined, reachR: friendOn,
        lookX: -.3, lookY: -.5, eyes: 1.1, brow: kf(lt, [[0, .8], [1.7, .5], [2.5, 0]]) * -1 + .1, browY: .4, mouth: lt < 2 ? "o" : "flat", blink: blinkAt(lt, [.9, 2.1]),
        dangle: .5, flutter: tq * 4 + 1, drag: { x: 0, y: 70 },
      });
      nightSky(c, { seed: 29, t: tq, stars: 0, y1: 1000, top: "#02030f", bottom: "#070a2a" });
      c.save(); c.translate(960, 540); c.rotate(Math.PI / 2); c.translate(-960, -540);
      windStreaks(c, lt, 14, 8, 100, 980, 1200, 1, "120,140,220", .1);
      c.restore();
      const cam: Cam = { cx: 960, cy: 500, z: 1.28 };
      c.save(); applyCam(c, cam);
      drawHoodie(c, hero); drawHoodie(c, friend);
      if (heroOn > .05) phoneProp(c, cx - 215, 395 - 20 * heroOn - 30, -.25, 1);
      if (friendOn > .05) phoneProp(c, cx + 205, 410 - 20 * friendOn - 30, .25, 1);
      c.restore();
      return { cam, kids: [hero, friend], mask: [], turns: 1.1, heroOn, friendOn, cx, hero, friend };
    },
    glow(c, f, s) {
      lanternGlow(c, s.cx - 215, 395 - 20 * s.heroOn - 30, s.heroOn, 1);
      lanternGlow(c, s.cx + 205, 410 - 20 * s.friendOn - 30, s.friendOn, 1);
      // 두 사람의 얼굴과 후드를 비추는 은은한 차가운 빛
      lighter(c, () => { c.globalAlpha = .18 * (s.heroOn + s.friendOn); c.drawImage(k.glowCold, s.cx - 330, 330, 660, 560); c.globalAlpha = 1; });
    },
  });

  /* ── 30 흩어졌던 나방이 차가운 빛을 보고 모여든다 → 그물이 되어 받아 올린다 ── */
  const CUP = 3.1;
  const swarm = (lt: number, cx: number, cy: number, i: number, tq: number) => {
    const a0 = hash(i, 61) * TAU, r0 = 1000 + hash(i, 62) * 400, tArr = .1 + hash(i, 63) * 1.6;
    const ringR = 210 + hash(i, 64) * 150, w = (hash(i, 65) < .5 ? -1 : 1) * (1 + hash(i, 66) * 1.4);
    const q = easeIO(clamp((lt - tArr) / 1.5));
    const ang = a0 + q * Math.PI * 1.6 + w * lt * q;
    const rad = mix(r0, ringR, q);
    const A = { x: cx + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad * .55 };
    // 받아 올리는 그물(발밑의 얕은 그릇)
    const u = (hash(i, 67) * 2 - 1), bowl = { x: cx + u * 300, y: cy + 150 + 70 * u * u + hash(i, 68) * 40 + 6 * Math.sin(tq * 4 + i) };
    const b = smooth(2.0, CUP, lt);
    // 오르는 기둥(몸을 감아 도는 나선)
    const cc = smooth(CUP + .1, CUP + 1.2, lt), th = a0 + lt * (1.6 + hash(i, 69)) , yy = cy - 500 + ((hash(i, 70) * 1000 + lt * 500) % 1000);
    const C = { x: cx + Math.cos(th) * (200 + hash(i, 71) * 120), y: yy + Math.sin(th) * 40 };
    const p1 = { x: mix(A.x, bowl.x, b), y: mix(A.y, bowl.y, b) };
    return { x: mix(p1.x, C.x, cc), y: mix(p1.y, C.y, cc), q, alpha: clamp(q * 2) };
  };
  add("converge-catch", B(54), 30, "cut", {
    draw(c, f) {
      const lt = f.lt, tq = f.tq;
      const vy = (t: number) => 800 * (1 - smooth(1.7, CUP, t)) - 1000 * smooth(CUP + .1, CUP + 1.3, t);
      const Y = integ(vy, lt);
      const FL: [number, number][] = [[3.6, .5], [4.6, .6]];
      const flash = flashAt(lt, FL);
      const land = lt >= CUP, bump = kf(lt, [[CUP - .05, 0], [CUP + .08, .13, "out"], [CUP + .45, -.03, "back"], [CUP + .8, 0]]);
      const warm = smooth(.6, 3.2, lt);
      const cx = 960, cy = 560;
      const lant = (1 - .65 * warm);
      const hero = mkHero({
        x: cx - 105, y: cy + .45 * 300, s: 300, dir: 1, turn: .4, rot: .1 * (1 - warm), arms: "none",
        handR: { x: cx + 6, y: cy - 92 }, reachR: 1, handL: { x: cx - 225, y: cy - 175 + 8 * Math.sin(tq * 3) }, reachL: 1,
        squash: bump, lookX: .3, lookY: kf(lt, [[0, -.4], [1.2, -.7], [3, -.3]]), eyes: 1.15, brow: kf(lt, [[0, .5], [1.5, -.2], [3, -.4]]) * -1, browY: .3,
        mouth: lt < 1.6 ? "o" : lt < 3.4 ? "awe" : "smile", joy: smooth(3.4, 3.9, lt) * .7, blink: blinkAt(lt, [2.7, 4.4]),
        dangle: land ? 0 : .5, flutter: tq * 4, drag: { x: 0, y: land ? 20 : 80 * (1 - smooth(1.7, CUP, lt)) - 140 * smooth(CUP + .1, CUP + 1.3, lt) },
      });
      const friend = mkFriend({
        x: cx + 105, y: cy + .45 * 276, s: 276, dir: 1, turn: -.4, rot: -.1 * (1 - warm), arms: "none",
        handL: { x: cx + 6, y: cy - 92 }, reachL: 1, handR: { x: cx + 215, y: cy - 165 + 8 * Math.sin(tq * 3 + 1) }, reachR: 1,
        squash: bump * .9, lookX: -.3, lookY: kf(lt, [[0, -.4], [1.4, -.7], [3, -.3]]), eyes: 1.15, brow: kf(lt, [[0, .5], [1.5, -.2], [3, -.4]]) * -1, browY: .3,
        mouth: lt < 1.7 ? "o" : lt < 3.4 ? "awe" : "grin", joy: smooth(3.5, 4.0, lt) * .8, blink: blinkAt(lt, [2.4, 4.7]),
        dangle: land ? 0 : .5, flutter: tq * 4 + 1, drag: { x: 0, y: land ? 20 : 80 * (1 - smooth(1.7, CUP, lt)) - 140 * smooth(CUP + .1, CUP + 1.3, lt) },
      });
      nightSky(c, { seed: 30, t: tq, stars: 0, y1: 1000, top: "#03041a", bottom: "#0e1140" });
      c.save(); applyCam(c, CAM0);
      for (let i = 0; i < 12; i++) {
        const par = .6 + hash(i, 6) * .9;
        const yy = (((hash(i, 5) * 2600 - Y * par) % 2600) + 2600) % 2600 - 500, xx = hash(i, 7) * 2200 - 150;
        billow(c, xx, yy, 130 + hash(i, 8) * 170, mixHex2("#2a2468", "#5a4ea0", flash), "#07061e", .3, -.9, 3, .55, i);
      }
      c.restore();
      c.save(); c.translate(960, 540); c.rotate(Math.PI / 2); c.translate(-960, -540);
      windStreaks(c, Y / 1000, 15, 12, 100, 980, 1000, 1, "190,170,130", .16 * warm + .08);
      c.restore();
      c.save(); applyCam(c, CAM0);
      if (lt < 3.3) { phoneProp(c, cx - 225, cy - 175 - 30, -.25, 1); phoneProp(c, cx + 215, cy - 165 - 30, .25, 1); }
      drawHoodie(c, hero); drawHoodie(c, friend);
      c.restore();
      return { cam: CAM0, kids: [hero, friend], mask: [], turns: 1.1, flash, warm, lant, cx, cy };
    },
    glow(c, f, s) {
      const lt = f.lt;
      // 두 폰의 차가운 빛: 시간이 갈수록 따뜻한 빛에 묻힌다
      lanternGlow(c, s.cx - 225, s.cy - 175 - 30, 1, 1 - .5 * s.warm);
      lanternGlow(c, s.cx + 215, s.cy - 165 - 30, 1, 1 - .5 * s.warm);
      lighter(c, () => {
        // 따뜻한 빛 번짐(나방이 모일수록 커진다)
        c.globalAlpha = .55 * s.warm; c.drawImage(k.glowGold, s.cx - 520, s.cy - 380, 1040, 860); c.globalAlpha = 1;
        c.globalAlpha = .35 * s.warm; c.drawImage(k.glowWhite, s.cx - 260, s.cy - 220, 520, 520); c.globalAlpha = 1;
        for (let i = 0; i < 170; i++) {
          const m = swarm(lt, s.cx, s.cy, i, f.tq);
          if (m.alpha <= .02) continue;
          moth(c, k, m.x, m.y, 9 + hash(i, 72) * 7, f.tq * 1.3, i, m.alpha);
        }
        if (s.flash > .02) lightning(c, k, 300, -50, 380, 720, 6, s.flash * 1.5);
      });
    },
    front(c, f, s) {
      if (s.flash > .02) { c.fillStyle = `rgba(214,226,255,${s.flash * .45})`; c.fillRect(-500, -500, 3000, 2200); }
    },
  });

  /* ── 31 빛의 기둥을 타고 폭풍을 뚫는다 ─────────────────────── */
  add("ascent-storm", B(56), 31, "cut", {
    draw(c, f) {
      const lt = f.lt, tq = f.tq, cx = 960, cy = 570;
      const Y = integ(() => -1500, lt);
      const FL: [number, number][] = [[.35, .6], [1.25, .8], [2.1, .55]];
      const flash = flashAt(lt, FL);
      const cam: Cam = { cx: 960, cy: 540, z: 1, r: .035 * Math.sin(lt * 1.1) };
      const hero = mkHero({
        x: cx - 100, y: cy + .45 * 300, s: 300, dir: 1, turn: .35, arms: "none",
        handR: { x: cx + 6, y: cy - 92 }, reachR: 1, handL: { x: cx - 215, y: cy - 190 }, reachL: 1,
        lookX: .2, lookY: -.7, eyes: 1.1, brow: .45, browY: .1, mouth: "smile", joy: .3, blink: blinkAt(lt, [1.5]), dangle: .6, flutter: tq * 5, drag: { x: 0, y: -150 }, squash: -.03,
      });
      const friend = mkFriend({
        x: cx + 100, y: cy + .45 * 276, s: 276, dir: 1, turn: -.35, arms: "none",
        handL: { x: cx + 6, y: cy - 92 }, reachL: 1, handR: { x: cx + 205, y: cy - 185 }, reachR: 1,
        lookX: -.2, lookY: -.7, eyes: 1.1, brow: .45, browY: .1, mouth: "grin", joy: .5, blink: blinkAt(lt, [.9, 2.2]), dangle: .6, flutter: tq * 5 + 1, drag: { x: 0, y: -150 }, squash: -.03,
      });
      nightSky(c, { seed: 31, t: tq, stars: 0, y1: 1000, top: "#03041a", bottom: "#0e1140" });
      c.save(); applyCam(c, cam);
      for (let i = 0; i < 14; i++) {
        const par = .7 + hash(i, 6) * 1.0;
        const yy = (((hash(i, 5) * 2600 - Y * par) % 2600) + 2600) % 2600 - 500, xx = hash(i, 7) * 2200 - 150;
        billow(c, xx, yy, 150 + hash(i, 8) * 200, mixHex2("#2a2468", "#6a5eb0", flash), "#07061e", .3, -.9, 3, .55, i);
      }
      c.restore();
      c.save(); c.translate(960, 540); c.rotate(Math.PI / 2); c.translate(-960, -540);
      windStreaks(c, -Y / 1000 * 1.0, 16, 14, 100, 980, 1000, 1, "200,180,130", .2);
      c.restore();
      c.save(); applyCam(c, cam);
      phoneProp(c, cx - 215, cy - 190 - 30, -.25, 1); phoneProp(c, cx + 205, cy - 185 - 30, .25, 1);
      drawHoodie(c, hero); drawHoodie(c, friend);
      c.restore();
      return { cam, kids: [hero, friend], mask: [], turns: 1.1, flash, cx, cy };
    },
    glow(c, f, s) {
      const lt = f.lt;
      lanternGlow(c, s.cx - 215, s.cy - 190 - 30, 1, .6);
      lanternGlow(c, s.cx + 205, s.cy - 185 - 30, 1, .6);
      lighter(c, () => {
        c.globalAlpha = .6; c.drawImage(k.glowGold, s.cx - 560, s.cy - 420, 1120, 900); c.globalAlpha = 1;
        for (let i = 0; i < 170; i++) {
          const m = swarm(lt + 4.6, s.cx, s.cy, i, f.tq);
          moth(c, k, m.x, m.y, 9 + hash(i, 72) * 7, f.tq * 1.3, i, .95);
        }
        if (f.lt > .35 && f.lt < 1.1) lightning(c, k, 260, -60, 340, 760, 11, flashAt(f.lt, [[.35, 1]]) * 1.7);
        if (f.lt > 1.25 && f.lt < 2.0) lightning(c, k, 1640, -60, 1560, 780, 12, flashAt(f.lt, [[1.25, 1]]) * 1.8);
        if (f.lt > 2.1) lightning(c, k, 420, -60, 520, 700, 13, flashAt(f.lt, [[2.1, 1]]) * 1.5);
      });
    },
    front(c, f, s) {
      if (s.flash > .02) { c.fillStyle = `rgba(214,226,255,${s.flash * .5})`; c.fillRect(-500, -500, 3000, 2200); }
    },
  });

  /* ── 32 구름을 뚫고 맑은 하늘로: 달에 손이 닿는다 ───────────── */
  const TOUCH = 5.0;
  add("break-touch", B(57), 32, "flash", {
    draw(c, f) {
      const lt = f.lt, tq = f.tq;
      const rise = smooth(0, 4.6, lt);
      const moon = moonAt(f, 960, mix(330, 60, rise), mix(420, 820, rise * rise));
      const cloudY = mix(900, 1500, smooth(0, 2.6, lt));
      const cx = 960, cy = mix(640, 860, smooth(3.8, TOUCH, lt)) ;
      nightSky(c, { seed: 32, t: tq, stars: 12, starsY: 520, y1: 1000, top: "#070a2a", bottom: "#27307c", moon, streak: 1.6 });
      if (cloudY < 1400) cloudSeaPaint(c, { y: cloudY, t: tq, seed: 5, rows: 3, size: 190, tint: "#c3b6f0", shade: "#3d3892", light: [0, -1], scroll: lt * 60 });
      const reach = smooth(3.6, TOUCH - .1, lt);
      const tgtY = moon.y + moon.r * .55;
      const clasp = { x: cx + 4, y: cy - 95 };
      const hero = mkHero({
        x: cx - 95, y: cy + .45 * 300, s: 300, dir: 1, turn: .3, rot: .06, arms: "cheer", handL: { x: cx - 215, y: mix(cy - 300, tgtY, reach) }, reachL: 1, handR: clasp, reachR: 1,
        lookX: .1, lookY: -.9, eyes: 1.2, brow: -.4, browY: .7, mouth: lt < 1.6 ? "o" : "awe", joy: 0, blink: blinkAt(lt, [2.4]), dangle: .7, flutter: tq * 4, drag: { x: 0, y: -120 * (1 - reach) },
      });
      const friend = mkFriend({
        x: cx + 100, y: cy + .45 * 276, s: 276, dir: 1, turn: -.3, rot: -.06, arms: "cheer", handR: { x: cx + 205, y: mix(cy - 285, tgtY + 20, reach) }, reachR: 1, handL: clasp, reachL: 1,
        lookX: -.1, lookY: -.9, eyes: 1.2, brow: -.4, browY: .7, mouth: lt < 1.8 ? "o" : "awe", joy: 0, blink: blinkAt(lt, [1.9]), dangle: .7, flutter: tq * 4 + 1, drag: { x: 0, y: -120 * (1 - reach) },
      });
      c.save(); applyCam(c, CAM0);
      drawHoodie(c, hero); drawHoodie(c, friend);
      c.restore();
      return { cam: CAM0, kids: [hero, friend], mask: [hero, friend], moon, swirls: [{ x: moon.x, y: moon.y, r: moon.r * 3.6, spin: 1, pitch: .22 }], turns: 1.1, cx, cy, reach };
    },
    glow(c, f, s) {
      moonBloom(c, k.glowWhite, s.moon, .2 + .12 * s.reach);
      lighter(c, () => {
        // 몸 아래에서 따라 올라오는 나방 기둥(점점 흩어진다)
        for (let i = 0; i < 90; i++) {
          const th = hash(i, 81) * TAU + f.tq * (1 + hash(i, 82)), yy = s.cy + 80 + ((hash(i, 83) * 700 + f.lt * 300) % 700);
          moth(c, k, s.cx + Math.cos(th) * (90 + hash(i, 84) * 160 * (yy - s.cy) / 700 * 2), yy, 8 + hash(i, 85) * 6, f.tq * 1.3, i, .9 * (1 - (yy - s.cy - 80) / 700));
        }
        if (f.lt > TOUCH) { const q = f.lt - TOUCH; c.globalAlpha = clamp(1 - q * 2) * .8; const r = 160 + q * 900; c.drawImage(k.glowWhite, s.cx - r, s.moon.y + s.moon.r * .55 - r * .6, r * 2, r * 1.2); c.globalAlpha = 1; }
      });
    },
    front(c, f, s) {
      if (f.lt > TOUCH - .05 && f.lt < TOUCH + .5) {
        const q = (f.lt - TOUCH) / .5;
        c.fillStyle = `rgba(255,240,205,${.7 * (1 - q)})`; c.fillRect(-500, -500, 3000, 2200);
      }
    },
  });

  /* ── 33 달이 터진다: 빛의 실이 사방으로, 둘은 구슬 하나씩을 품에 안는다 ── */
  add("bloom", B(59), 33, "flash", {
    draw(c, f) {
      const lt = f.lt, tq = f.tq;
      const pull = smooth(0, f.dur, lt);
      const moon = moonAt(f, 960, mix(120, 330, pull), mix(760, 440, pull), 1);
      const cam: Cam = { cx: 960, cy: 540, z: 1 };
      nightSky(c, { seed: 33, t: tq, stars: 12, starsY: 520, y1: 1000, top: "#0a0e32", bottom: "#2e3890", moon, streak: 1.6 });
      cloudSeaPaint(c, { y: mix(1300, 900, pull), t: tq, seed: 5, rows: 3, size: 190, tint: "#c9bcf2", shade: "#443f9a", light: [0, -1] });
      const sil = (tint: typeof HERO) => shade(tint, .4);
      const hero = mkHero({
        tint: sil(HERO), x: 800, y: 960, s: 300, dir: 1, turn: .35, rim: "rgba(255,226,150,.95)", arms: "hold", orb: 1, lookX: .1, lookY: -.3,
        mouth: "smile", joy: .8, blush: .6, blink: 1 * smooth(1.0, 1.2, lt), squash: breathe(lt, .012),
      });
      const friend = mkFriend({
        tint: sil(FRIEND), x: 1110, y: 975, s: 276, dir: 1, turn: -.35, rim: "rgba(255,226,150,.95)", arms: "hold", orb: 1, lookX: -.1, lookY: -.3,
        mouth: "smile", joy: .9, blush: .7, blink: 1 * smooth(1.2, 1.4, lt), squash: breathe(lt, .012, 1.9),
      });
      c.save(); applyCam(c, cam);
      drawHoodie(c, hero); drawHoodie(c, friend);
      c.restore();
      return { cam, kids: [hero, friend], mask: [hero, friend], moon, swirls: [{ x: moon.x, y: moon.y, r: moon.r * 3.4, spin: 1, pitch: .2 }], turns: 1.1, hero, friend, pull };
    },
    glow(c, f, s) {
      const lt = f.lt;
      moonBloom(c, k.glowWhite, s.moon, .14 + .3 * (1 - smooth(.1, 1.0, lt)));
      lighter(c, () => {
        // 달에서 쏟아지는 실: 1절 후렴의 그 실이, 이번에는 둘 뒤로 도시를 향해 흘러내린다
        const reveal = easeIO(clamp(lt / .9));
        for (let n = 0; n < 16; n++) {
          const spread = (hash(n, 41) * 2 - 1) * (.5 + .5 * hash(n, 42)), freq = 1.2 + hash(n, 43) * 1.6;
          const th = (v: number) => ({
            x: s.moon.x + spread * Math.pow(v, 1.15) * 1500 + Math.sin(v * freq * Math.PI * 2 - f.tq * (1.4 + hash(n, 44)) + n) * (10 + 120 * v),
            y: s.moon.y + s.moon.r * .5 + 1300 * Math.pow(v, 1.4),
          });
          glowLine(c, Array.from({ length: 70 }, (_, i) => th(i / 69 * reveal)), 2.4 + f.beat);
          for (let j = 0; j < 3; j++) {
            const v = ((hash(n, 92 + j) + lt * .2) % 1) * reveal, p = th(v);
            c.globalAlpha = .9; c.drawImage(k.glowGold, p.x - 16 - v * 12, p.y - 16 - v * 12, 32 + v * 24, 32 + v * 24); c.globalAlpha = 1;
          }
        }
        // 둘의 품에 안긴 구슬
        for (const p of [s.hero, s.friend]) {
          const hc = handsCenter2(p);
          c.globalAlpha = .75 + .15 * Math.sin(f.tq * 3); c.drawImage(k.glowGold, hc.x - 150, hc.y - 150, 300, 300);
          c.globalAlpha = 1; c.drawImage(k.glowWhite, hc.x - 38, hc.y - 38, 76, 76);
        }
        const q = lt;
        if (q < .9) { c.globalAlpha = 1 - q / .9; const r = 200 + q * 1500; c.drawImage(k.glowWhite, s.moon.x - r, s.moon.y - r, r * 2, r * 2); c.globalAlpha = 1; }
      });
    },
    front(c, f, s) {
      if (f.lt > .5) for (let i = 0; i < 6; i++) { const ph = ((f.lt - .5) * .5 + i / 6) % 1; heart(c, 700 + i * 120 + Math.sin(i * 2) * 30, 760 - ph * 260, 24 + (i % 3) * 4, Math.sin(ph * Math.PI)); }
    },
  });

}
