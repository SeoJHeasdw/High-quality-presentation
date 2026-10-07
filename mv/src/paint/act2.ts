/**
 * 2막 전반: 달을 향한 첫 도전과 실패, 그리고 빛의 다리 (0:44 ~ 1:19).
 *
 *   계획(달을 손가락으로 재 본다) → 도움닫기와 점프 → 모자라서 모서리에서 휘청, 엉덩방아
 *   → 폰을 꺼냈다가 나방이 화면에 앉는다 → 나방이 모여 다리를 놓는다 → 다리를 걷는다
 *   → (브레이크) 멀리 자기 방 창을 돌아보고, 폰을 주머니에 넣는다
 */
import { hash, clamp, mix, smooth, blinkAt, easeIO, easeOut, moth, bang, sparkle, dabLine, dust, dizzy, roofY } from "./kit.ts";
import { drawHoodie, phoneRect, type Pose, type ArmsT } from "./hoodie.ts";
import { armsSeq, kf, breathe, jump, walker, walkDist } from "./anim.ts";
import { nightSky, moonSwirls, moonBloom, type Moon } from "./sky.ts";
import { applyCam, lighter, bez, CAM0, type Ctx, type Cam, type F } from "./stage.ts";
import { phoneLight, farCity, farCityGlow, roofsPainted, roofsGlow, alley, alleyGlow, ladderPaint, ladderGlow, mottle } from "./world.ts";

const EDGE = 1080, ROOF = 800;
const base = (px: number) => roofY(px, ROOF, 0, 11) - 14;

/** 점프 시간표(8b와 8c가 같은 시계를 쓴다: 8c의 시각은 8b 시작으로부터 잰다) */
const RJ = { RUN0: .7, T0: 1.85, T1: 3.35, X0: 470, XT: 860, XL: 985, H: 270 };

export function act2(x: Ctx) {
  const { k, add, B, song } = x;
  const beat = song.beatLength;
  const U = 320;
  const moonAt = (f: F, mx: number, my: number, r: number, lit = 1): Moon => ({ x: mx, y: my, r, beat: f.beat, t: f.tq, lit });

  function platformWorld(c: CanvasRenderingContext2D, f: F) {
    farCity(c, k, 0, 640, .9, .3);
    alley(c, f.tq, EDGE, ROOF);
    roofsPainted(c, f.tq, ROOF, 0, 11, EDGE);
  }
  function platformGlow(c: CanvasRenderingContext2D, f: F) {
    farCityGlow(c, k, 0, 640, .9, .3);
    roofsGlow(c, k, ROOF, 0, 11, EDGE);
    alleyGlow(c, k, EDGE, ROOF, f.beat);
  }
  /** 달을 화면 좌표에 놓는다(카메라가 움직이면 아주 조금만 따라 움직인다: 멀리 있으므로) */
  const moonFor = (f: F, cam: Cam, r = 74): Moon => moonAt(f, 1500 - (cam.cx - 960) * .12, 250 - (cam.cy - 540) * .12, r * (1 + (cam.z - 1) * .5));

  /** 점프 궤적: 이륙 자리에서 달 아래까지. 세계 좌표(붓 점으로 칠해 붓질을 통과시킨다) */
  const arcPts = (from: { x: number; y: number }) => Array.from({ length: 26 }, (_, i) => bez(from, { x: 1425, y: 318 }, { x: 1150, y: 70 }, i / 25));

  /* ── 08a 계획: 달을 손가락으로 재 보고, 도움닫기하려 물러난다 ── */
  const walkBack = walker(U, beat, { beatsPerCycle: 2 });
  add("plan", B(15), 9, "cut", {
    draw(c, f) {
      const lt = f.lt;
      const moon = moonFor(f, CAM0);
      const TURN = 1.55;
      const dist = walkDist(lt, TURN + .45, walkBack.speed, .3);
      const px = 720 - dist;
      const flip = lt >= TURN + .2;
      const going = lt > TURN + .45;
      const pose: Pose = {
        x: px, y: base(px), s: U, dir: flip ? -1 : 1,
        turn: kf(lt, [[0, .8], [TURN, .8], [TURN + .2, 0], [TURN + .45, -.9]]),
        lookX: lt < TURN ? .8 : -.7, lookY: kf(lt, [[0, -.7], [TURN, -.7], [TURN + .35, 0]]),
        walk: going ? walkBack.phase(dist) : undefined, gait: going ? Math.min(1, (lt - TURN - .45) / .3) : 0, stride: walkBack.stride,
        arms: armsSeq(lt, [[0, "none"], [.5, "point", .4, "back"], [1.3, "none", .3]]),
        tilt: kf(lt, [[0, 0], [.6, .09], [1.3, .09], [1.5, 0]]),
        nod: kf(lt, [[1.15, 0], [1.38, 1], [1.62, 0]]),
        brow: kf(lt, [[0, -.2], [1.1, -.2], [1.3, .6]]), browY: kf(lt, [[0, .5], [1.1, .5], [1.3, 0]]),
        mouth: lt < 1.3 ? "o" : "flat", blink: blinkAt(lt, [1.0, 2.3]), squash: breathe(lt, .01),
      };
      nightSky(c, { seed: 9, t: f.tq, stars: 8, starsY: 520, y1: 900, clouds: 3, cloudY: [60, 460], moon });
      c.save(); applyCam(c, CAM0);
      platformWorld(c, f);
      dabLine(c, arcPts({ x: 780, y: base(760) - 150 }), f.hold, smooth(.8, 1.1, lt) * (1 - smooth(1.8, 2.1, lt)));
      drawHoodie(c, pose);
      c.restore();
      return { cam: CAM0, kids: [pose], mask: [pose], moon, swirls: moonSwirls(moon), turns: 1.1, px };
    },
    glow(c, f, s) {
      platformGlow(c, f);
      moonBloom(c, k.glowWhite, s.moon, .16);
      lighter(c, () => {
        for (let i = 0; i < 7; i++) {
          const a = f.tq * (1 + hash(i, 21) * .6) + i * 1.1;
          moth(c, k, s.px + 90 + Math.cos(a) * 130 + i * 18, base(s.px) - 230 + Math.sin(a * 1.3) * 60 - i * 12, 12, f.tq, i, .9);
        }
      });
    },
  });

  /* ── 08b 도움닫기와 점프: 달리고, 뜨고, 가장 높은 데서 컷 ───── */
  const run = { stride: .72 };
  add("run-jump", B(16), 9, "cut", {
    draw(c, f) {
      const lt = f.lt, { RUN0, T0, T1, X0, XT, XL, H } = RJ;
      const ramp = .4;
      const speed = (XT - X0) / (T0 - RUN0 - ramp / 2);
      const dist = walkDist(lt, RUN0, speed, ramp);
      const j = jump(lt, T0, T1, H, { crouch: .06, anticip: .12 });
      const px = lt < T0 ? X0 + dist : mix(XT, XL, easeOut(j.p));
      const py = base(px) + j.y;
      const ready = smooth(0, .25, lt) * (1 - smooth(RUN0 - .05, RUN0 + .12, lt));
      const cam: Cam = { cx: mix(960, 1040, smooth(RUN0, T0 + .8, lt)), cy: 540 - 60 * smooth(T0, T0 + 1, lt), z: 1 + .06 * smooth(RUN0, T0 + .9, lt) };
      const pose: Pose = {
        x: px, y: py, s: U, dir: 1, turn: .85, lookX: .8, lookY: lt < T0 ? -.35 : -.7,
        walk: lt >= RUN0 && lt < T0 ? dist / (run.stride * U) : undefined, gait: lt >= RUN0 && lt < T0 ? Math.min(1, (lt - RUN0) / .25) : 0,
        stride: run.stride, run: 1,
        squash: lt < T0 - .15 ? .16 * ready + breathe(lt, .006) : j.squash, lean: .13 * ready, tuck: j.tuck,
        arms: armsSeq(lt, [[0, "none"], [T0 - .05, "reach", .1], [T0 + .12, "cheer", .22, "back"]]),
        brow: .5 * (1 - smooth(T0 + .5, T0 + 1.0, lt)) - .7 * smooth(T0 + .55, T0 + .95, lt), browY: .9 * smooth(T0 + .55, T0 + .95, lt),
        mouth: lt < T0 ? "grin" : "o", eyes: 1 + .3 * smooth(T0 + .5, T0 + .9, lt), blink: blinkAt(lt, [.5]),
        drag: { x: -speed * .04 * (lt >= RUN0 && lt < T0 ? 1 : 0), y: 0 },
      };
      const moon = moonFor(f, cam);
      nightSky(c, { seed: 9, t: f.tq, stars: 8, starsY: 520, y1: 900, clouds: 3, cloudY: [60, 460], moon });
      c.save(); applyCam(c, cam);
      platformWorld(c, f);
      dabLine(c, arcPts({ x: RJ.XT + 20, y: base(RJ.XT) - 150 }), f.hold, smooth(RJ.T0 - .1, RJ.T0 + .25, lt));
      drawHoodie(c, pose);
      c.restore();
      return { cam, kids: [pose], mask: [pose], moon, swirls: moonSwirls(moon), turns: 1.1, px, py, j };
    },
    glow(c, f, s) {
      platformGlow(c, f);
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
      moonBloom(c, k.glowWhite, s.moon, .16);
      c.restore();
      lighter(c, () => {
        for (let i = 0; i < 8; i++) {
          const a = f.tq * (1 + hash(i, 21) * .6) + i * 1.1;
          moth(c, k, s.px - 40 - i * 46 + Math.cos(a) * 30, s.py - 190 - i * 10 + Math.sin(a * 1.3) * 40, 12, f.tq, i, .85);
        }
      });
    },
  });

  /* ── 08c 모자라서 모서리에서 휘청, 엉덩방아 ─────────────── */
  add("fall-plop", B(17), 9, "cut", {
    draw(c, f) {
      const lt = f.lt, jt = lt + (B(17) - B(16)), { T0, T1, XT, XL, H } = RJ;
      const j = jump(jt, T0, T1, H, { land: .0 });
      const landed = jt >= T1;
      const q = Math.max(0, jt - T1);                      // 착지 후 시간
      const TOPPLE = .95;                                   // 균형을 잃는 순간(착지 후)
      const px = landed ? XL - 10 * smooth(TOPPLE, TOPPLE + .3, q) : mix(XT, XL, easeOut(j.p));
      const py = base(px) + (landed ? 0 : j.y);
      // 착지 후 팔을 풍차처럼 돌리며 휘청 → 쿵
      const wind = landed && q < TOPPLE + .1 ? 1 : 0;
      const a = jt * 15;
      const arms: ArmsT = !landed ? armsSeq(lt, [[0, "cheer"], [.12, "flail", .3, "back"]])
        : wind ? [{ x: -.2 + .5 * Math.cos(a), y: .42 + .5 * Math.sin(a) }, { x: .2 - .5 * Math.cos(a), y: .42 - .5 * Math.sin(a) }]
        : armsSeq(q - TOPPLE, [[0, "wide"], [.2, "none", .35]]);
      const sitT = kf(q, [[TOPPLE - .02, 0], [TOPPLE + .22, 1, "in"]]);
      const slump = kf(q, [[TOPPLE + .22, 0], [TOPPLE + .32, .26, "out"], [TOPPLE + .55, .02, "back"], [TOPPLE + .9, 0]]);
      const pose: Pose = {
        x: px, y: py, s: U, dir: 1, turn: .8, sit: sitT,
        lookX: .6, lookY: landed ? kf(q, [[0, -.4], [TOPPLE, .1], [TOPPLE + .5, .7]]) : -.7,
        tuck: j.tuck * (landed ? 0 : 1),
        squash: !landed ? j.squash : (wind ? .05 * Math.sin(q * 20) : slump + breathe(q, .012)),
        lean: landed && q < TOPPLE ? .26 * Math.sin(q * 11) * Math.exp(-q * 1.3) + .06 : landed && q < TOPPLE + .3 ? mix(.1, -.1, smooth(TOPPLE, TOPPLE + .3, q)) : 0,
        arms,
        brow: !landed ? -.7 : kf(q, [[0, -.9], [TOPPLE + .3, -.9], [TOPPLE + 1, -.3]]), browY: !landed ? .9 : kf(q, [[0, 1], [TOPPLE + .3, 1], [TOPPLE + 1, 0]]),
        eyes: 1.3, mouth: !landed ? "o" : q < TOPPLE + .6 ? "yell" : "sad",
        blink: landed && q > TOPPLE + .25 && q < TOPPLE + .8 ? 1 : 0,
        drag: { x: 0, y: !landed ? -H * .0 : 0 },
      };
      const moon = moonFor(f, CAM0);
      nightSky(c, { seed: 9, t: f.tq, stars: 8, starsY: 520, y1: 900, clouds: 3, cloudY: [60, 460], moon });
      const shake = landed && q > TOPPLE + .2 && q < TOPPLE + .55 ? Math.sin(q * 90) * 5 * (1 - (q - TOPPLE - .2) / .35) : 0;
      const cam: Cam = { cx: 960, cy: 540 + shake, z: 1 };
      c.save(); applyCam(c, cam);
      platformWorld(c, f);
      dabLine(c, arcPts({ x: RJ.XT + 20, y: base(RJ.XT) - 150 }), f.hold, 1 - smooth(RJ.T1 + .6, RJ.T1 + 1.2, jt));
      drawHoodie(c, pose);
      c.restore();
      return { cam, kids: [pose], mask: [pose], moon, swirls: moonSwirls(moon), turns: 1.1, px, py, q, landed, TOPPLE };
    },
    glow(c, f, s) {
      platformGlow(c, f);
      moonBloom(c, k.glowWhite, s.moon, .16);
      lighter(c, () => {
        for (let i = 0; i < 6; i++) {
          const aa = f.tq * (1 + hash(i, 21) * .6) + i * 1.1;
          moth(c, k, 500 + i * 60 + Math.cos(aa) * 30, 420 + Math.sin(aa * 1.3) * 40 + i * 14, 12, f.tq, i, .7);
        }
      });
    },
    front(c, f, s) {
      if (s.landed && s.q > s.TOPPLE + .2) {
        dust(c, s.px - 30, base(s.px), 120, (s.q - s.TOPPLE - .2) / .9);
        if (s.q > s.TOPPLE + .6) dizzy(c, s.px, s.py - 330, 52, f.tq, smooth(s.TOPPLE + .6, s.TOPPLE + .9, s.q));
      }
    },
  });

  /* ── 09 한숨 → 폰을 꺼낸다 → 나방이 화면에 앉는다 → 달을 올려다보고 일어선다 ── */
  const SITX = 975;
  add("sigh-phone", B(18), 9, "cut", {
    draw(c, f) {
      const lt = f.lt;
      const cam: Cam = { cx: 1010, cy: 560, z: 1.32 };
      const OUT = .55, LAND = 1.15, LIFT = 1.65, RISE = 2.0;
      const sit = kf(lt, [[RISE, 1], [RISE + .55, 0, "back"]]);
      const phoneUp = kf(lt, [[OUT, 0], [OUT + .4, .9], [LIFT, .9], [LIFT + .3, .3], [RISE - .1, .0]]);
      const hasPhone = lt >= OUT && lt < RISE + .05;
      const pose: Pose = {
        x: SITX, y: base(SITX), s: U, dir: 1, turn: kf(lt, [[0, .5], [OUT, .5], [LAND, .1], [LIFT, .5], [RISE, .8]]), sit,
        squash: kf(lt, [[0, 0], [.22, .05], [.5, -.02], [.8, 0]]) + (lt > RISE ? kf(lt, [[RISE, .05], [RISE + .3, -.1, "out"], [RISE + .7, 0]]) : breathe(lt, .01)),
        lookX: kf(lt, [[0, .3], [OUT, .3], [OUT + .3, 0], [LIFT, .5], [LIFT + .3, .9]]),
        lookY: kf(lt, [[0, .6], [LAND - .1, .85], [LIFT - .05, .6], [LIFT + .3, -.9], [RISE, -.9]]),
        nod: kf(lt, [[0, 1], [LIFT, .6], [LIFT + .3, -1], [RISE + .3, -.4]]),
        tilt: kf(lt, [[0, .1], [LAND, -.1], [LIFT, 0]]),
        brow: kf(lt, [[0, -.7], [LAND - .1, -.7], [LAND + .2, -.2], [RISE, .5]]), browY: kf(lt, [[0, 0], [LAND, .7], [LIFT, .2], [RISE, 0]]),
        eyes: 1 + .25 * smooth(LAND - .1, LAND + .1, lt) * (1 - smooth(LIFT, LIFT + .3, lt)),
        mouth: lt < LAND ? "sad" : lt < RISE ? "o" : "smile", joy: smooth(LAND + .3, LAND + .5, lt) * (1 - smooth(LIFT - .1, LIFT + .1, lt)) * .5,
        blink: blinkAt(lt, [.35, 1.0, 2.4]),
        arms: !hasPhone ? armsSeq(lt, [[0, "none"], [OUT - .25, "pocket", .25], [RISE, "pocket", .01], [RISE + .1, "none", .4]]) : "phone",
        phone: hasPhone ? phoneUp : undefined, phoneOn: hasPhone ? clamp((lt - OUT) / .15) * (1 - smooth(RISE - .1, RISE + .05, lt)) : 1,
        glow: hasPhone ? .85 : 0,
      };
      const moon = moonFor(f, cam, 74);
      nightSky(c, { seed: 9, t: f.tq, stars: 8, starsY: 520, y1: 900, clouds: 3, cloudY: [60, 460], moon });
      c.save(); applyCam(c, cam);
      platformWorld(c, f);
      drawHoodie(c, pose);
      c.restore();
      return { cam, kids: [pose], mask: [], moon, swirls: moonSwirls(moon), turns: 1.1, LAND, LIFT, OUT, RISE, hasPhone };
    },
    glow(c, f, s) {
      c.save(); platformGlow(c, f); c.restore();
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); moonBloom(c, k.glowWhite, s.moon, .16); c.restore();
      const pose = s.kids[0];
      if (s.hasPhone) phoneLight(c, k, pose);
      const pr = phoneRect(pose);
      lighter(c, () => {
        // 나방: 위에서 내려와 폰 화면에 앉았다가, 달 쪽으로 떠오른다
        const lt = f.lt;
        const land = smooth(.8, s.LAND, lt) , lift = smooth(s.LIFT, s.LIFT + .75, lt);
        if (lt > .7) {
          const from = { x: pr.x + 260, y: pr.y - 360 }, to = { x: pr.x, y: pr.y - 8 }, away = { x: 1380, y: 330 };
          const p0 = bez(from, to, { x: pr.x + 40, y: pr.y - 300 }, easeIO(land));
          const mx = mix(p0.x, away.x, easeIO(lift)), my = mix(p0.y, away.y, easeIO(lift)) - Math.sin(lift * Math.PI) * 60;
          moth(c, k, mx, my, 15, lt > s.LAND && lt < s.LIFT ? f.tq * .3 : f.tq, 2.2);
          if (lt > s.LAND - .05 && lt < s.LAND + .35) { c.globalAlpha = .6 * (1 - (lt - s.LAND) / .4); c.drawImage(k.glowGold, pr.x - 90, pr.y - 90, 180, 180); c.globalAlpha = 1; }
        }
        for (let i = 0; i < 5; i++) {
          const aa = f.tq * (1 + hash(i, 21) * .6) + i * 1.1;
          moth(c, k, 420 + i * 70 + Math.cos(aa) * 30, 400 + Math.sin(aa * 1.3) * 40 + i * 20, 11, f.tq, i, .55);
        }
      });
    },
    front(c, f, s) {
      if (f.lt > s.LAND - .1 && f.lt < s.LAND + .6) sparkle(c, phoneRect(s.kids[0]).x + 40, phoneRect(s.kids[0]).y - 70, 12, 1 - (f.lt - s.LAND) / .7);
    },
  });

  /* ── 10 나방이 모여 달까지 빛의 다리를 놓는다 ─────────────── */
  const BR = { a: { x: EDGE - 14, y: ROOF - 8 }, b: { x: 1447, y: 318 }, c: { x: 1318, y: 604 } };
  const bridgeAt = (v: number) => bez(BR.a, BR.b, BR.c, v);
  const bridgePts = Array.from({ length: 60 }, (_, i) => bridgeAt(i / 59));
  add("bridge-build", B(19), 9, "cut", {
    draw(c, f) {
      const lt = f.lt;
      const reveal = easeIO(smooth(2.7, 4.2, lt));
      const gasp = smooth(2.7, 2.95, lt) * (1 - smooth(3.6, 3.9, lt));
      const px = lt < 3.9 ? 975 : mix(975, 1040, easeIO(smooth(3.9, f.dur, lt)));
      const hop = lt > 4.2 && lt < 4.7 ? jump(lt, 4.2, 4.65, 40, { anticip: .1, land: .12 }) : jump(lt, 99, 100, 0);
      const cheer = smooth(3.8, 4.1, lt);
      const watch = Math.sin(lt * 1.3);
      const pose: Pose = {
        x: px, y: base(px) + hop.y, s: U, dir: 1, turn: .55 + .35 * watch * (1 - smooth(2.6, 3.0, lt)), sit: 0,
        walk: lt > 4.9 ? (lt - 4.9) * 1.4 : undefined, gait: lt > 4.9 ? Math.min(1, (lt - 4.9) / .3) : 0, stride: .42,
        squash: (lt > 4.1 ? hop.squash : kf(lt, [[2.65, 0], [2.78, .09], [3.0, -.07, "out"], [3.3, 0]])) + breathe(lt, .01),
        lookX: .6, lookY: kf(lt, [[0, -.5], [2.7, -.7], [3.9, -.8]]), tuck: hop.tuck,
        tilt: .06 * watch * (1 - smooth(2.6, 3.0, lt)),
        arms: armsSeq(lt, [[0, "none"], [2.72, "guard", .2], [3.8, "cheer", .25, "back"], [4.8, "none", .4]]),
        brow: -.7 * gasp, browY: gasp, eyes: 1 + .35 * gasp, mouth: lt < 2.7 ? "smile" : lt < 3.9 ? "awe" : "grin", joy: cheer * (1 - smooth(4.9, 5.2, lt)) * .8,
        blink: blinkAt(lt, [1.2, 4.9]),
      };
      const moon = moonFor(f, CAM0);
      nightSky(c, { seed: 9, t: f.tq, stars: 8, starsY: 520, y1: 900, clouds: 3, cloudY: [60, 460], moon });
      c.save(); applyCam(c, CAM0);
      platformWorld(c, f);
      if (reveal > 0) ladderPaint(c, bridgePts, "back", { reveal, t: f.tq, fadeEnd: .12 });
      drawHoodie(c, pose);
      if (reveal > 0) ladderPaint(c, bridgePts, "front", { reveal, t: f.tq, fadeEnd: .12 });
      c.restore();
      return { cam: CAM0, kids: [pose], mask: [pose], moon, swirls: moonSwirls(moon), turns: 1.1, reveal, px };
    },
    glow(c, f, s) {
      platformGlow(c, f);
      moonBloom(c, k.glowWhite, s.moon, .16);
      lighter(c, () => {
        if (s.reveal > 0) ladderGlow(c, k, bridgePts, f.tq, f.beat, { reveal: s.reveal, fadeEnd: .12 });
        // 나방이 사방에서 다리의 제 자리로 날아든다
        for (let i = 0; i < 44; i++) {
          const tgt = bridgeAt(i / 43);
          const left = hash(i, 801) < .5;
          const sx = left ? -80 + hash(i, 802) * 200 : 1920 + 80 - hash(i, 802) * 200, sy = hash(i, 803) * 600;
          const p = easeIO(clamp((f.lt - .5 - i * .035) / 1.8));
          if (p >= 1 && s.reveal > 0) continue;
          moth(c, k, mix(sx, tgt.x, p) + Math.sin(f.tq * 4 + i) * 12 * (1 - p * .7), mix(sy, tgt.y - 14, p) + Math.cos(f.tq * 5 + i) * 9, 12, f.tq, i, .9);
        }
      });
    },
    front(c, f, s) {
      if (f.lt > 2.75 && f.lt < 3.95) bang(c, s.px + 40, base(s.px) - 360, 42, f.hold, 1 - smooth(3.6, 3.95, f.lt));
    },
  });

  /* ── 11 빛의 다리를 걷는다: 조심조심 → 아래를 보고 휘청 → 용기 ── */
  const SLOPE = -.38, WS = 300, RUNG = 57;
  const walkUp = walker(WS, beat, { beatsPerCycle: 1.5, stride: .38 });
  const pathY = (xx: number) => 900 + (xx - 600) * SLOPE;
  add("bridge-walk", B(21), 12, "cut", {
    draw(c, f) {
      const lt = f.lt, START = 1.5;
      const dist = walkDist(lt, START, walkUp.speed, .5);
      const wx = 600 + dist * Math.cos(Math.atan(-SLOPE));
      const look = smooth(3.8, 4.4, lt) * (1 - smooth(6.0, 6.6, lt));       // 아래를 내려다본다
      const wobble = look * Math.sin(lt * 9) * .1;
      const pose: Pose = {
        x: wx, y: pathY(wx), s: WS, dir: 1, turn: .85, slope: -SLOPE * .9,
        walk: lt >= START ? walkUp.phase(dist) : undefined, gait: lt >= START ? Math.min(1, (lt - START) / .5) : 0, stride: walkUp.stride,
        lean: .06 + wobble - .08 * (1 - smooth(START - .2, START + .3, lt)),
        squash: breathe(lt, .008) + .04 * look * Math.abs(Math.sin(lt * 9)),
        arms: lt < START ? armsSeq(lt, [[0, "wide"], [.6, "out", .4], [START - .3, "wide", .2]]) : look > .05 ? armsSeq(lt, [[0, "none"], [3.8, "wide", .3], [6.2, "none", .5]]) : "none",
        lookX: .6, lookY: kf(lt, [[0, .5], [START, .5], [START + .6, -.2], [3.8, -.2], [4.3, .95], [6.1, .95], [6.6, -.5]]),
        nod: look, tilt: -.06 * look,
        brow: kf(lt, [[0, -.5], [START, -.5], [START + .8, 0], [3.8, 0], [4.3, -.6], [6.2, -.6], [6.8, .35]]),
        browY: kf(lt, [[0, .5], [START, .5], [START + .8, 0], [4.3, .6], [6.2, .6], [6.8, 0]]),
        eyes: 1 + .3 * look, mouth: lt < START ? "o" : look > .3 ? "yell" : lt > 6.6 ? "grin" : "smile", joy: lt > 7 ? .5 : 0,
        blink: blinkAt(lt, [START + 1.2, 7.4]),
      };
      const cam: Cam = { cx: wx + 220, cy: pathY(wx) - 160 + 40 * look, z: 1 };
      const moon = moonAt(f, 1500 - dist * .03, 300 - dist * .02 + 20 * look, mix(92, 150, smooth(0, f.dur, lt)));
      nightSky(c, { seed: 12, t: f.tq, stars: 9, starsY: 560, y1: 1000, clouds: 4, cloudY: [80, 520], moon });
      // 아래 도시(화면에 고정되어 천천히 내려간다)
      farCity(c, k, 0, 560 + lt * 20, .9, .35);
      // 사다리는 달의 가장자리 앞에서 옅어지며 끝난다(달에 꽂히지 않는다). 시작점은 세계에 고정해
      // 발판이 아이를 따라 미끄러지지 않고, 한 걸음마다 발판 하나가 발밑에 오도록 맞춘다
      const startX = 600 - (RUNG * 19 - 33) * Math.cos(Math.atan(-SLOPE)), endX = cam.cx + (moon.x - moon.r * 1.15 - 960) / cam.z;
      const n = Math.max(2, Math.ceil((endX - startX) / 62));
      const pts = Array.from({ length: n + 1 }, (_, i) => { const xx = startX + i * (endX - startX) / n; return { x: xx, y: pathY(xx) }; });
      const stepFrac = pose.walk !== undefined ? (((pose.walk * 2) % 1) + 1) % 1 : 1;
      const foot = { x: wx + 33, y: pathY(wx + 33), a: Math.exp(-stepFrac * 6) * (pose.gait ?? 0) };
      c.save(); applyCam(c, cam);
      ladderPaint(c, pts, "back", { t: f.tq, fadeEnd: .16, rung: RUNG });
      drawHoodie(c, pose);
      ladderPaint(c, pts, "front", { t: f.tq, fadeEnd: .16, rung: RUNG });
      c.restore();
      return { cam, kids: [pose], mask: [pose], moon, swirls: moonSwirls(moon), turns: 1.1, wx, pts, foot };
    },
    glow(c, f, s) {
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
      farCityGlow(c, k, 0, 560 + f.lt * 20, .9, .35);
      moonBloom(c, k.glowWhite, s.moon, .16);
      c.restore();
      lighter(c, () => {
        ladderGlow(c, k, s.pts, f.tq, f.beat, { fadeEnd: .16, rung: RUNG, foot: s.foot });
        for (let i = 0; i < 10; i++) {
          const xx = s.wx - 600 + i * 160 + Math.sin(f.tq * .9 + i) * 24;
          moth(c, k, xx, pathY(xx) - 130 - (i % 3) * 36 + Math.sin(f.tq * 3 + i) * 14, 11, f.tq, i, .85);
        }
      });
    },
  });

  /* ── 12a 브레이크: 다리 위에서 멀리 자기 방 창을 돌아본다 ──── */
  const lbY = (xx: number) => { const v = clamp((xx - 260) / 1490); return 840 - 330 * Math.pow(v, 1.1) + 30 * Math.sin(v * Math.PI); };
  add("look-back", B(24), 13, "dip", {
    draw(c, f) {
      const lt = f.lt;
      const z = 1 + .05 * smooth(0, f.dur, lt);
      const cam: Cam = { cx: 960, cy: 540, z };
      const turn = kf(lt, [[0, .9], [1.2, .9], [1.8, -.9]]);
      const pose: Pose = {
        x: 1130, y: lbY(1130) - 8, s: 240, dir: lt < 1.5 ? 1 : -1, turn, sit: kf(lt, [[0, 0], [.9, 1]]),
        lookX: lt < 1.5 ? .6 : -.9, lookY: lt < 1.5 ? -.2 : .45,
        squash: breathe(lt, .012, 1.3), tilt: kf(lt, [[1.8, 0], [3.5, .07]]), nod: kf(lt, [[1.8, 0], [3.4, .5]]),
        arms: "none", mouth: lt < 2.2 ? "flat" : lt > 4.4 ? "smile" : "flat",
        blink: blinkAt(lt, [2.5, 5.0, 7.4]), brow: lt > 2 ? -.3 : 0, browY: lt > 2 ? .2 : 0,
      };
      const moon = moonAt(f, 1580, 200, 100);
      nightSky(c, { seed: 14, t: f.tq, stars: 10, starsY: 560, y1: 1000, clouds: 5, cloudY: [80, 560], moon });
      c.save(); applyCam(c, cam);
      farCity(c, k, -200, 760, .8, .1);
      // 멀리 아래, 자기 방이 있던 건물과 불 켜진 창 하나
      c.fillStyle = "#0a0c2e"; c.fillRect(120, 860, 190, 400);
      mottle(c, 120, 860, 190, 400, 133, 18, .08, 22);
      c.fillStyle = "#ffcf7a"; c.fillRect(190, 920, 54, 62);
      c.fillStyle = "#04051a"; c.fillRect(214, 920, 4, 62);
      // 다리와 아이가 앉은 평평한 자리
      const pts = Array.from({ length: 50 }, (_, i) => { const xx = mix(260, 1750, i / 49); return { x: xx, y: lbY(xx) }; });
      ladderPaint(c, pts, "back", { t: f.tq, fadeEnd: .1 });
      drawHoodie(c, pose);
      ladderPaint(c, pts, "front", { t: f.tq, fadeEnd: .1 });
      c.restore();
      return { cam, kids: [pose], mask: [pose], moon, swirls: moonSwirls(moon), turns: 1.1, pts };
    },
    glow(c, f, s) {
      farCityGlow(c, k, -200, 760, .8, .1);
      moonBloom(c, k.glowWhite, s.moon, .16);
      lighter(c, () => {
        c.globalAlpha = .8 + .2 * f.beat;
        c.drawImage(k.glowGold, 217 - 80, 951 - 80, 160, 160);
        c.globalAlpha = 1;
        ladderGlow(c, k, s.pts, f.tq, 0, { fadeEnd: .1 });
        for (let i = 0; i < 4; i++) moth(c, k, 300 + i * 22 + Math.cos(f.tq * 1.4 + i) * 26, 900 - i * 30 + Math.sin(f.tq * 1.8 + i) * 22, 10, f.tq, i, .7);
      });
    },
  });

  /* ── 12b 가까이: 폰의 차가운 빛 → 나방 → 주머니에 넣는다 → 올려다본다 ── */
  add("pocket", B(26), 14, "cut", {
    draw(c, f) {
      const lt = f.lt;
      const PUT = 2.9, UP = 3.9;
      const sit = 1;
      const hasPhone = lt < PUT + .5;
      const phoneUp = kf(lt, [[0, .5], [.8, .95], [2.5, .95], [PUT, .2], [PUT + .4, 0]]);
      const pose: Pose = {
        x: 820, y: 1090, s: 560, dir: 1, turn: kf(lt, [[0, .15], [UP, .15], [UP + .5, .5]]), sit,
        squash: breathe(lt, .014, 1.4),
        lookX: kf(lt, [[0, 0], [UP, 0], [UP + .5, .6]]), lookY: kf(lt, [[0, .85], [UP - .1, .7], [UP + .5, -.9]]),
        nod: kf(lt, [[0, 1], [UP - .2, .6], [UP + .5, -1]]), tilt: kf(lt, [[0, .05], [1.8, -.08], [PUT, 0]]),
        arms: hasPhone ? "phone" : armsSeq(lt - PUT - .5, [[0, "pocket"], [.3, "none", .4]]),
        phone: hasPhone ? phoneUp : undefined, phoneOn: hasPhone ? 1 - smooth(PUT + .25, PUT + .5, lt) : 1,
        glow: hasPhone ? .95 * (1 - smooth(PUT, PUT + .45, lt)) : 0,
        brow: kf(lt, [[0, -.4], [1.5, -.4], [2.0, 0], [UP + .3, .5]]), browY: kf(lt, [[0, 0], [1.5, 0], [2, .4], [UP, 0]]),
        mouth: lt < 1.4 ? "flat" : lt < UP ? "smile" : "smile", joy: smooth(1.7, 2.1, lt) * (1 - smooth(PUT - .3, PUT, lt)) * .6,
        blink: blinkAt(lt, [1.0, 3.4, 5.0]),
      };
      const moon = moonAt(f, 1540, 300, 150);
      nightSky(c, { seed: 15, t: f.tq, stars: 8, starsY: 600, y1: 1000, moon });
      c.save(); applyCam(c, CAM0);
      drawHoodie(c, pose);
      c.restore();
      return { cam: CAM0, kids: [pose], mask: [], moon, swirls: moonSwirls(moon), turns: 1.1, PUT, hasPhone };
    },
    glow(c, f, s) {
      moonBloom(c, k.glowWhite, s.moon, .14);
      const pose = s.kids[0];
      if (s.hasPhone) phoneLight(c, k, pose);
      const pr = phoneRect(pose);
      lighter(c, () => {
        // 폰 위에 앉았다가 떠나는 나방
        const land = smooth(1.2, 2.0, f.lt), lift = smooth(s.PUT - .5, s.PUT + .4, f.lt);
        if (f.lt > 1.1) {
          const from = { x: pr.x + 380, y: pr.y - 420 }, to = { x: pr.x + 6, y: pr.y - 12 }, away = { x: 1180, y: 160 };
          const p0 = bez(from, to, { x: pr.x + 80, y: pr.y - 380 }, easeIO(land));
          moth(c, k, mix(p0.x, away.x, easeIO(lift)), mix(p0.y, away.y, easeIO(lift)) - Math.sin(lift * Math.PI) * 80, 22, f.lt > 2 && f.lt < s.PUT - .4 ? f.tq * .25 : f.tq, 3.1);
          if (f.lt > 1.9 && f.lt < 2.5) { c.globalAlpha = .5 * (1 - (f.lt - 1.9) / .6); c.drawImage(k.glowGold, pr.x - 120, pr.y - 120, 240, 240); c.globalAlpha = 1; }
        }
      });
    },
  });

}
