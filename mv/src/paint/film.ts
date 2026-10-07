/**
 * 유화 뮤비 본편(3분). 가사 없이 아이의 연기로 간다.
 *
 *   외로운 밤 → 나방이 불러냄 → 달을 향한 첫 도전(실패) → 빛의 다리 → 달이 내려준 실로 날아오름
 *   → 같은 외로운 창의 친구를 만나 함께 날아감 → 폭풍에 흩어진 빛 → 차가운 빛과 따뜻한 빛이 모여 다시 오름
 *   → 달이 도시의 창마다 빛을 나눠 줌 → 새벽, 마주 보는 두 창
 *
 * 한 프레임 = 깨끗한 장면(절반 해상도) → 붓질(painter.ts) → 빛 층(아이 뒤는 지운다, 가산 합성)
 *           → 얼굴·낙서(또렷하게) → 전환(번쩍임·검정) → 천 결·비네트.
 * 움직임은 초당 15장(30fps의 투스)으로 끊고, 붓은 초당 7.5번 흔든다. 컷은 모두 마디 첫 박이다.
 * 컷 목록은 act*.ts, 아이는 hoodie.ts(뼈대), 움직임은 anim.ts, 무대는 world.ts·sky.ts에 있다.
 */
import type { Song } from "../song.ts";
import { pulse } from "../scenes.ts";
import { paint } from "./painter.ts";
import { drawHoodieFace, maskKid } from "./hoodie.ts";
import { W, H, P, clamp, smooth, makeKit } from "./kit.ts";
import { applyCam, type Ctx, type F, type Shot, type FilmOptions } from "./stage.ts";
import { act1 } from "./act1.ts";
import { act2 } from "./act2.ts";
import { act3 } from "./act3.ts";
import { act4 } from "./act4.ts";
import { act5 } from "./act5.ts";

export type { FilmOptions };

const STEP = 15;

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

  const shots: Shot[] = [];
  const x: Ctx = {
    k, song, opts,
    B: (n) => (n < 0 ? 0 : db[Math.min(n, db.length - 1)]),
    add: (name, at, seed, enter, body) => { shots.push({ name, start: at, end: 0, seed, enter, ...body }); },
  };

  act1(x);
  act2(x);
  act3(x);
  act4(x);
  act5(x);

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

    paint(g, clean, f.hold, { flowSeed: shot.seed, flowTurns: s.turns, swirls: s.swirls });

    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.globalCompositeOperation = "source-over";
    lg.globalAlpha = 1;
    lg.clearRect(0, 0, W, H);
    if (shot.glow) { lg.save(); applyCam(lg, s.cam); shot.glow(lg, f, s); lg.restore(); }
    if (s.mask && s.mask.length) {
      lg.save();
      applyCam(lg, s.cam);
      lg.globalCompositeOperation = "destination-out";
      s.mask.forEach((p) => maskKid(lg, p));
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
    for (let y = 0; y < H; y += 256) for (let xx = 0; xx < W; xx += 256) g.drawImage(k.weave, xx, y);
    g.restore();
    g.drawImage(k.vignette, 0, 0);
    if (black > 0) { g.fillStyle = `rgba(0,0,0,${clamp(black)})`; g.fillRect(0, 0, W, H); }
  }

  return { render, shots };
}
