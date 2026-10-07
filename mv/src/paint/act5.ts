/**
 * 4막: 새벽 (2:47 ~ 3:00). 달이 도시의 창마다 빛을 내려 주고, 아이는 자기 방으로 돌아와 잠든다.
 * 건너편 창의 친구와 둘은 마주 보는 집이었다. 둘이 손을 흔들고, 품에 안은 빛을 서로 보여 준다.
 *
 *   도시에 불이 하나씩 켜진다 → 새벽 방, 빛 구슬을 안고 잠든 아이 → 마주 보는 두 창
 *   (옵션 --ending tel: 마지막 두 마디를 나방이 글자를 이루는 장면으로 바꾼다)
 */
import { pulse } from "../scenes.ts";
import { hash, clamp, mix, smooth, blinkAt, easeIO, moth, sparkle, heart, glowLine } from "./kit.ts";
import { drawHoodie, handsCenter, FRIEND, type Pose } from "./hoodie.ts";
import { armsSeq, breathe } from "./anim.ts";
import { moonBloom, moonSwirls, nightSky, type Moon } from "./sky.ts";
import { applyCam, lighter, bez, CAM0, RIM, mixColor, type Ctx, type Cam, type F } from "./stage.ts";
import { room, roomCityGlow, farCity, farCityGlow, mottle } from "./world.ts";
import { windowGlow } from "./kit.ts";
import { friendWindow, type BigWindow } from "./world2.ts";

export function act5(x: Ctx) {
  const { k, add, B, opts } = x;

  /* ── 34a 도시에 불이 켜진다: 달이 내려준 실이 닿자 창이 하나씩, 첫 장면의 박자처럼 ───── */
  const THREADS = 16;
  const thread = (n: number, v: number, tq: number) => {
    const spread = (hash(n, 41) * 2 - 1) * (.5 + .5 * hash(n, 42));
    const freq = 1.2 + hash(n, 43) * 1.6, amp = 8 + 90 * v;
    return { x: 960 + spread * Math.pow(v, 1.15) * 1300 + Math.sin(v * freq * Math.PI * 2 - tq * (1.4 + hash(n, 44)) + n) * amp, y: 300 + 480 * Math.pow(v, 1.3) };
  };
  add("city-lights", B(60), 34, "cut", {
    draw(c, f) {
      const lt = f.lt, tq = f.tq;
      const lit = .2 + .8 * smooth(.25, 2.4, lt);
      const moon: Moon = { x: 960, y: 170, r: 150, beat: f.beat, t: tq, lit: 1 };
      nightSky(c, { seed: 34, t: tq, stars: 9, starsY: 380, y1: 760, top: "#0a0e32", bottom: "#2a3486", moon, streak: 1.4 });
      // 새벽이 지평선에서 번지기 시작한다
      const dg = c.createLinearGradient(0, 360, 0, 760);
      dg.addColorStop(0, "rgba(240,168,106,0)"); dg.addColorStop(1, `rgba(240,168,106,${.28 * smooth(.8, 2.7, lt)})`);
      c.fillStyle = dg; c.fillRect(-100, 360, 2200, 400);
      c.save(); applyCam(c, CAM0);
      farCity(c, k, 0, 300, 1.0, lit);
      c.restore();
      return { cam: CAM0, kids: [] as Pose[], moon, swirls: moonSwirls(moon), turns: 1.1, lit, lt };
    },
    glow(c, f, s) {
      const lt = f.lt, rev = easeIO(clamp(lt / .8));
      moonBloom(c, k.glowWhite, s.moon, .25);
      c.save(); c.translate(0, 300); lighter(c, () => { windowGlow(c, k, s.lit, () => Infinity, pulse); }); c.restore();
      lighter(c, () => {
        // 달에서 내려오는 실: 1절 후렴의 그 실이 이번에는 도시를 향해 흘러내린다
        for (let n = 0; n < THREADS; n++) {
          glowLine(c, Array.from({ length: 70 }, (_, i) => thread(n, i / 69 * rev, f.tq)), 2.4);
          for (let j = 0; j < 3; j++) {
            const v = ((hash(n, 60 + j) + lt * .22) % 1) * rev, p = thread(n, v, f.tq);
            c.globalAlpha = .9; c.drawImage(k.glowGold, p.x - 14, p.y - 14, 28, 28); c.globalAlpha = 1;
          }
        }
        // 닿는 자리마다 번지는 빛(박마다 한 번 더 번쩍)
        c.globalAlpha = .55 * s.lit + .3 * f.beat; c.drawImage(k.glowGold, 0, 560, 1920, 360); c.globalAlpha = 1;
        for (let i = 0; i < 26; i++) { const v = ((hash(i, 11) + lt * .12) % 1); moth(c, k, hash(i, 12) * 1920, 200 + v * 700, 10, f.tq, i, .8 * Math.sin(v * Math.PI)); }
      });
    },
  });

  /* ── 34b 새벽 방: 빛 구슬을 안고 잠든 아이. 창틀에는 나방 한 마리 ─── */
  add("dawn-room", B(61), 34, "dip", {
    draw(c, f) {
      const lt = f.lt;
      const pose: Pose = {
        x: 1180, y: 950, s: 400, sit: 1, dir: 1, lean: .12, turn: -.3, tilt: .1, nod: .7, arms: "hold", orb: .6, blink: 1, mouth: "smile",
        squash: breathe(lt, .015, 1.1),
      };
      const cam: Cam = { cx: 960 + 40 * smooth(0, f.dur, lt), cy: 540, z: 1 + .04 * smooth(0, f.dur, lt) };
      c.save(); applyCam(c, cam);
      room(c, k, f.tq, { lit: .3 + .3 * smooth(0, f.dur, lt), dawn: .55 + .45 * smooth(0, f.dur, lt) });
      drawHoodie(c, pose);
      c.restore();
      return { cam, kids: [pose], turns: 1.1, lt };
    },
    glow(c, f, s) {
      roomCityGlow(c, k, .3 + .3 * smooth(0, f.dur, f.lt));
      const hc = handsCenter(s.kids[0]);
      lighter(c, () => {
        c.globalAlpha = .55 + .15 * Math.sin(f.tq * 1.2);
        c.drawImage(k.glowGold, hc.x - 160, hc.y - 160, 320, 320);
        c.globalAlpha = 1;
        moth(c, k, 1520, 752, 16, f.tq * .25, 0);
      });
    },
  });

  /* ── 35 마주 보는 두 창: 새벽, 둘이 서로를 알아본다 ────────── */
  const WL: BigWindow = { x: 300, y: 215, w: 420, h: 460 };
  const WR: BigWindow = { x: 1200, y: 215, w: 420, h: 460 };
  const buildings = (c: CanvasRenderingContext2D, f: F, dawn: number) => {
    // 새벽 하늘(두 건물 사이 틈)
    const sky = c.createLinearGradient(0, 0, 0, 900);
    sky.addColorStop(0, "#2c2b62"); sky.addColorStop(.55, mixColor("#2c2b62", "#9a6390", dawn)); sky.addColorStop(1, mixColor("#3a3570", "#f0a86a", dawn));
    c.fillStyle = sky; c.fillRect(-100, -100, 2200, 1300);
    farCity(c, k, 0, 560, .8, .4);
    for (const [bx, bw] of [[-120, 880], [1160, 880]] as [number, number][]) {
      const wall = c.createLinearGradient(0, 0, 0, 1080);
      wall.addColorStop(0, "#1a1d60"); wall.addColorStop(1, "#0a0c2c");
      c.fillStyle = wall; c.fillRect(bx, -100, bw, 1300);
      mottle(c, bx, -100, bw, 1300, 55 + (bx > 0 ? 3 : 0), 40, .08, 52);
      c.fillStyle = "rgba(255,170,130,.12)"; c.fillRect(bx > 0 ? bx : bx + bw - 14, -100, 14, 1300);
    }
    // 건물 사이를 가로지르는 빨랫줄
    c.strokeStyle = "#04051a"; c.lineWidth = 3;
    c.beginPath(); c.moveTo(760, 150); c.quadraticCurveTo(960, 240, 1160, 170); c.stroke();
    for (let i = 0; i < 3; i++) { const v = (i + 1) / 4, px = mix(760, 1160, v), py = 150 + 4 * 45 * v * (1 - v) + 8 + (1160 - 760) * 0; c.fillStyle = ["#2c3478", "#7a3f78", "#6a5048"][i]; c.save(); c.translate(px, py + 4); c.transform(1, 0, Math.sin(f.tq * 1.4 + i) * .1, 1, 0, 0); c.fillRect(-14, 0, 28, 44); c.restore(); }
    // 두 창의 문턱 아래 벽 장식(층 띠)
    c.fillStyle = "rgba(60,70,150,.5)"; c.fillRect(-100, 730, 860, 8); c.fillRect(1160, 730, 860, 8);
  };
  const SHOW = 3.6;
  if (opts.ending !== "tel") {
    add("two-windows", B(62), 35, "cut", {
      draw(c, f) {
        const lt = f.lt, tq = f.tq;
        const dawn = .6 + .4 * smooth(0, f.dur, lt);
        const z = 1 - .05 * smooth(0, f.dur, lt);
        const cam: Cam = { cx: 960, cy: 520, z };
        const notice = smooth(1.0, 1.4, lt), wave = smooth(1.6, 1.9, lt) * (1 - smooth(3.3, 3.6, lt)), raise = smooth(SHOW, SHOW + .6, lt);
        const hero: Pose = {
          x: WL.x + WL.w * .52, y: WL.y + WL.h * .94, s: 290, sit: 1, dir: 1, turn: mix(.2, .85, notice), lookX: mix(.2, 1, notice), lookY: mix(-.1, 0, notice),
          arms: lt < 1.6 ? "none" : lt < SHOW ? "wave" : armsSeq(lt - SHOW, [[0, "wave"], [.6, "hold", .5, "back"]]), wave: wave > 0 ? tq * 9 : undefined,
          orb: raise, eyes: 1 + .25 * notice * (1 - smooth(1.6, 2.0, lt)), brow: -.4 * notice * (1 - smooth(1.5, 2, lt)), browY: .6 * notice * (1 - smooth(1.5, 2, lt)),
          mouth: lt < 1.0 ? "flat" : lt < 1.6 ? "o" : "grin", joy: smooth(1.7, 2.1, lt) * .8, blush: .6, squash: breathe(lt, .012), blink: blinkAt(lt, [.5, 4.8]),
        };
        const friend: Pose = {
          tint: FRIEND, x: WR.x + WR.w * .48, y: WR.y + WR.h * .94, s: 272, sit: 1, dir: -1, turn: mix(-.2, -.85, notice), lookX: mix(-.2, -1, notice), lookY: mix(-.1, 0, notice),
          arms: lt < 1.5 ? "none" : lt < SHOW ? "wave" : armsSeq(lt - SHOW, [[0, "wave"], [.6, "hold", .5, "back"]]), wave: wave > 0 ? tq * 9 + 1 : undefined,
          orb: raise, eyes: 1 + .25 * notice * (1 - smooth(1.5, 1.9, lt)), brow: -.4 * notice * (1 - smooth(1.4, 1.9, lt)), browY: .6 * notice * (1 - smooth(1.4, 1.9, lt)),
          mouth: lt < .9 ? "flat" : lt < 1.5 ? "o" : "grin", joy: smooth(1.6, 2.0, lt) * .9, blush: .7, squash: breathe(lt, .012, 1.9), blink: blinkAt(lt, [.9, 5.1]),
        };
        c.save(); applyCam(c, cam);
        buildings(c, f, dawn);
        friendWindow(c, tq, WL, 1, () => drawHoodie(c, hero));
        friendWindow(c, tq, WR, 1, () => drawHoodie(c, friend));
        c.restore();
        const moon: Moon = { x: 960, y: 170, r: 56, beat: f.beat, t: tq, lit: .4 };
        return { cam, kids: [hero, friend], turns: 1.1, hero, friend, raise, moon };
      },
      glow(c, f, s) {
        lighter(c, () => {
          // 새벽 빛이 틈으로 들어온다
          c.globalAlpha = .25; c.drawImage(k.glowGold, 560, 420, 800, 700); c.globalAlpha = 1;
          // 양쪽 창 안의 따뜻한 빛
          c.globalAlpha = .4; c.drawImage(k.glowGold, WL.x - 120, WL.y - 80, WL.w + 240, WL.h + 200); c.drawImage(k.glowPink, WR.x - 120, WR.y - 80, WR.w + 240, WR.h + 200); c.globalAlpha = 1;
          // 품의 빛 구슬: 서로를 향해 올라온다
          for (const p of [s.hero, s.friend]) {
            if (s.raise <= .01) continue;
            const hc = handsCenter(p);
            c.globalAlpha = s.raise * (.8 + .1 * Math.sin(f.tq * 3)); c.drawImage(k.glowGold, hc.x - 140, hc.y - 140, 280, 280);
            c.globalAlpha = s.raise; c.drawImage(k.glowWhite, hc.x - 34, hc.y - 34, 68, 68);
          }
          // 두 구슬을 잇는 나방의 흐름
          if (s.raise > .2) {
            const a = handsCenter(s.hero), b = handsCenter(s.friend);
            for (let i = 0; i < 22; i++) {
              const v = ((hash(i, 21) + f.lt * .16) % 1), p = bez(a, b, { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 150 }, v);
              moth(c, k, p.x + Math.sin(f.tq * 4 + i) * 8, p.y, 11, f.tq, i, s.raise * Math.sin(v * Math.PI));
            }
          }
          // 빨랫줄에 앉은 나방
          for (let i = 0; i < 3; i++) moth(c, k, mix(790, 1130, (i + .5) / 3), 190 + 4 * 45 * ((i + .5) / 3) * (1 - (i + .5) / 3) * (1 / 1) * .85, 10, f.tq * .2, i, .9);
        });
        moonBloom(c, k.glowWhite, s.moon, .06);
      },
      front(c, f, s) {
        if (f.lt > 1.7 && f.lt < 3.4) for (let i = 0; i < 2; i++) sparkle(c, 960 + (i ? 70 : -70), 420 + Math.sin(f.tq * 3 + i) * 20, 12, .8);
        if (f.lt > SHOW + .6) for (let i = 0; i < 5; i++) { const ph = ((f.lt - SHOW - .6) * .5 + i / 5) % 1; heart(c, 800 + i * 80 + Math.sin(i * 2) * 20, 360 - ph * 220, 20 + (i % 3) * 4, Math.sin(ph * Math.PI) * .9); }
      },
    });
  }

  /* ── 팀 시연용 엔딩(옵션): 새벽 지붕의 아이, 나방이 글자를 이룬다 ─────── */
  if (opts.ending === "tel") {
    const TEXT = "Technology Expert Lab";
    const TY = 400;
    const W = 1920, H = 1080;
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
      const step = 10.5;
      for (let y = 0, row = 0; y < 300; y += step, row++) for (let xx = row % 2 ? step / 2 : 0; xx < W; xx += step) {
        if (d[((y | 0) * W + (xx | 0)) * 4 + 3] > 140) targets.push({ x: xx, y: y - 150 + TY });
      }
      targets.sort((a, b) => hash(a.x | 0, a.y | 0) - hash(b.x | 0, b.y | 0));
      const hg = halo.getContext("2d")!;
      hg.filter = "blur(14px)";
      hg.drawImage(m, 0, TY - 150);
    }
    const KID = { x: 430, y: 1010 };
    add("tel-end", B(62), 24, "cut", {
      draw(c, f) {
        const sky = c.createLinearGradient(0, -100, 0, 1000);
        sky.addColorStop(0, "#232458");
        sky.addColorStop(.55, "#6c4f86");
        sky.addColorStop(1, "#d9976c");
        c.fillStyle = sky;
        c.fillRect(-200, -200, W + 400, 1300);
        const moon: Moon = { x: 1500, y: 160, r: 50, beat: f.beat, t: f.tq, lit: .35 };
        for (let n = 0; n < 2; n++) farCity(c, k, n * W * .55, 1000 - 760 * .55, .55, .2);
        c.fillStyle = "#080a22";
        c.fillRect(-200, 1000, W + 400, 200);
        c.fillStyle = "#2a2e6c";
        c.fillRect(-200, 1000, W + 400, 6);
        const pose: Pose = { x: KID.x, y: KID.y, s: 220, back: true, rim: RIM, squash: .01 * Math.sin(f.lt * 1.3) };
        drawHoodie(c, pose);
        return { cam: CAM0, kids: [pose], mask: [pose], moon, turns: 1.1 };
      },
      glow(c, f) {
        for (let n = 0; n < 2; n++) farCityGlow(c, k, n * W * .55, 1000 - 760 * .55, .55, .2);
        const lt = f.lt;
        const formed = smooth(2.2, 3, lt);
        lighter(c, () => {
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

}
