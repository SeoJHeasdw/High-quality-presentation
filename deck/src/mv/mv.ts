/**
 * 뮤비 시안. render(t)는 t초의 한 프레임을 그린다. 실시간 재생(<audio>의 currentTime)과
 * mp4 렌더(tools/mv/render.mjs가 프레임 시각을 하나씩 넘긴다)가 이 함수 하나를 쓴다.
 *
 * 층: 장면 → (전환이면 앞 컷을 겹친다) → 제목·끝 글자 → 가사 → HUD → 비네트·그레인 → 처음/끝 검정
 */
import { Song, type Lyric } from "./song.ts";
import { buildEdit, shotAt, type Shot } from "./edit.ts";
import { C, FONT, H, W, SCENES, clamp, createKit, hash, pulse, smooth, type Frame, type Kit, type Role } from "./scenes.ts";

export type MusicVideoOptions = { lyrics?: Lyric[]; hud?: boolean };

const FADE = .45;

function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

function bake(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d")!);
  return c;
}

/** 숫자 폭을 고정해 그린다(시간 표시가 흔들리지 않게) */
function tabular(g: CanvasRenderingContext2D, text: string, x: number, y: number, adv: number, align: "left" | "right") {
  const start = align === "right" ? x - text.length * adv : x;
  g.textAlign = "center";
  for (let i = 0; i < text.length; i++) g.fillText(text[i], start + (i + .5) * adv, y);
}

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function createMusicVideo(canvas: HTMLCanvasElement, song: Song, opts: MusicVideoOptions = {}) {
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  const shots = buildEdit(song);
  const kit: Kit = createKit(song);
  const layer = document.createElement("canvas");
  layer.width = W; layer.height = H;
  const lg = layer.getContext("2d")!;
  const sections = song.a.sections;
  const introEnd = sections[0].end;
  const outroStart = sections[sections.length - 1].start;
  const lyrics = opts.lyrics ?? [];

  const vignette = bake(W, H, (c) => {
    const v = c.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * 1.05);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,.62)");
    c.fillStyle = v;
    c.fillRect(0, 0, W, H);
  });
  const grain = [0, 1, 2, 3].map((s) => bake(256, 256, (c) => {
    const img = c.createImageData(256, 256);
    for (let i = 0; i < 256 * 256; i++) {
      const v = 128 + (hash(i, s + 50) - .5) * 120;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  }));

  function frameFor(t: number, shot: Shot): Frame {
    const si = shot.section;
    const role: Role = si === 0 ? "intro" : si === sections.length - 1 ? "outro" : "body";
    return {
      t,
      lt: t - shot.start,
      shotStart: shot.start,
      shotLen: shot.end - shot.start,
      variant: shot.variant,
      role,
      energy: sections[si].energy,
      song,
      level: song.feature("level", t),
      low: song.feature("low", t),
      mid: song.feature("mid", t),
      high: song.feature("high", t),
      hit: song.feature("hit", t),
      beatAge: song.sinceBeat(t),
      downAge: song.sinceDownbeat(t),
      beatIdx: song.beatIndex(t),
      barIdx: song.barIndex(t),
      spec: song.spectrum(t, new Float32Array(song.bands)),
    };
  }

  function scene(c: CanvasRenderingContext2D, t: number, shot: Shot) {
    const f = frameFor(t, shot);
    // 장면이 화면을 다 칠하지 않아도 앞 프레임이 비치지 않게
    c.fillStyle = C.bg;
    c.fillRect(0, 0, W, H);
    c.save();
    // 센 장면은 박에 맞춰 카메라가 살짝 밀린다
    if (shot.scene === "ridge" || shot.scene === "tunnel") {
      const s = 1 + .014 * pulse(f.beatAge, .14) * (.4 + f.energy);
      c.translate(W / 2, H / 2); c.scale(s, s); c.translate(-W / 2, -H / 2);
    }
    SCENES[shot.scene](c, f, kit);
    c.restore();
    return f;
  }

  function title(t: number) {
    // 0~13초: 레코드 왼쪽에 제목이 한 글자씩
    const out = 1 - smooth(introEnd - 1.4, introEnd - .5, t);
    if (t > introEnd || out <= 0) return;
    g.save();
    g.textBaseline = "alphabetic";
    g.textAlign = "left";
    g.font = `800 104px ${FONT}`;
    const text = "감성 힙합 초안";
    let x = 150;
    for (let i = 0; i < text.length; i++) {
      const a = smooth(2 + i * .09, 2.6 + i * .09, t) * out;
      g.fillStyle = rgba(C.ink, a);
      g.fillText(text[i], x, 520 + (1 - a) * 24);
      x += g.measureText(text[i]).width + 4;
    }
    const b = smooth(3.6, 4.4, t) * out;
    g.fillStyle = rgba(C.gold, b);
    g.fillRect(152, 566, 120 * b, 3);
    g.font = `500 34px ${FONT}`;
    g.fillStyle = rgba(C.mute, b);
    g.fillText("가사와 음악 지시로 만든 곡", 152, 630);
    g.font = `500 22px ${FONT}`;
    g.fillStyle = rgba(C.steel, b);
    tabular(g, `${song.a.bpm.toFixed(1)} BPM · ${mmss(song.duration)}`, 152, 676, 13.5, "left");
    g.restore();
  }

  function credits(t: number) {
    const a = smooth(outroStart + 1.2, outroStart + 2.6, t) * (1 - smooth(song.duration - 3.2, song.duration - 1.6, t));
    if (a <= 0) return;
    g.save();
    g.textAlign = "left";
    g.font = `800 84px ${FONT}`;
    g.fillStyle = rgba(C.ink, a);
    g.fillText("감성 힙합 초안", 150, 520);
    g.fillStyle = rgba(C.gold, a);
    g.fillRect(152, 556, 120, 3);
    g.font = `500 30px ${FONT}`;
    g.fillStyle = rgba(C.mute, a);
    g.fillText("가사와 음악 지시로 만든 곡", 152, 614);
    g.font = `500 22px ${FONT}`;
    g.fillStyle = rgba(C.steel, a);
    g.fillText("뮤직비디오 시안 · 곡 분석으로 편집", 152, 660);
    g.restore();
  }

  function lyric(t: number) {
    const l = lyrics.find((x) => t >= x.start && t < x.end);
    if (!l) return;
    const reveal = Math.min(.6, (l.end - l.start) * .35);
    const n = Math.ceil(l.text.length * clamp((t - l.start) / reveal));
    const a = 1 - smooth(l.end - .25, l.end, t);
    g.save();
    g.textAlign = "center";
    g.font = `700 56px ${FONT}`;
    g.shadowColor = "rgba(0,0,0,.8)";
    g.shadowBlur = 18;
    g.fillStyle = rgba(C.ink, a);
    g.fillText(l.text.slice(0, n), 960, 905);
    g.restore();
  }

  function hud(t: number) {
    const a = smooth(introEnd, introEnd + 1, t) * (1 - smooth(outroStart, outroStart + 1, t)) * .85;
    if (a <= 0) return;
    g.save();
    g.globalAlpha = a;
    g.textBaseline = "alphabetic";
    g.font = `600 22px ${FONT}`;
    g.fillStyle = C.ink;
    g.textAlign = "left";
    g.fillText("감성 힙합 초안", 64, 82);
    g.font = `500 15px ${FONT}`;
    g.fillStyle = C.mute;
    g.fillText("MUSIC VIDEO DRAFT", 64, 108);
    g.font = `600 20px ${FONT}`;
    g.fillStyle = C.ink;
    tabular(g, `${song.a.bpm.toFixed(1)} BPM`, W - 64, 82, 12.5, "right");
    const bars = song.a.downbeats.length;
    const bar = Math.max(1, song.barIndex(t) + 1);
    g.fillStyle = C.mute;
    g.font = `500 15px ${FONT}`;
    tabular(g, `BAR ${String(bar).padStart(2, "0")} / ${bars}`, W - 64, 108, 9.5, "right");
    // 박: 네 칸 중 지금 박
    const inBar = song.barIndex(t) < 0 ? -1 : Math.min(3, Math.floor(song.sinceDownbeat(t) / song.beatLength + .02));
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i === inBar ? (i === 0 ? C.gold : C.ink) : rgba(C.steel, .35);
      g.fillRect(W - 64 - (4 - i) * 22 + 6, 124, 16, 4);
    }

    // 곡 전체 파형: 지나온 쪽은 금색
    const x0 = 64, x1 = W - 64, y = 1012, n = 300;
    const p = t / song.duration;
    for (let i = 0; i < n; i++) {
      const u = i / n;
      const h = 2 + song.peak(u * song.duration) * 22;
      g.fillStyle = u <= p ? rgba(C.gold, .85) : rgba(C.steel, .35);
      g.fillRect(x0 + u * (x1 - x0), y - h / 2, Math.max(1, (x1 - x0) / n - 2), h);
    }
    for (const s of sections) {
      const x = x0 + s.start / song.duration * (x1 - x0);
      g.fillStyle = rgba(C.ink, .25);
      g.fillRect(x, y + 16, 1, 8);
    }
    g.fillStyle = C.goldHi;
    g.fillRect(x0 + p * (x1 - x0) - 1, y - 18, 2, 36);
    g.font = `500 16px ${FONT}`;
    g.fillStyle = C.ink;
    tabular(g, mmss(t), x0, y - 26, 10, "left");
    g.fillStyle = C.mute;
    tabular(g, mmss(song.duration), x1, y - 26, 10, "right");
    g.restore();
  }

  function render(t: number) {
    t = clamp(t, 0, song.duration);
    const si = shotAt(shots, t);
    const shot = shots[si];
    const f = scene(g, t, shot);
    const since = t - shot.start;

    // 전환
    if (si > 0 && shot.enter === "fade" && since < FADE) {
      const prev = shots[si - 1];
      scene(lg, t, prev);
      g.save();
      g.globalAlpha = 1 - smooth(0, FADE, since);
      g.drawImage(layer, 0, 0);
      g.restore();
      const w = W * smooth(0, .3, since);
      g.fillStyle = rgba(C.gold, .7 * (1 - smooth(.15, FADE, since)));
      g.fillRect(W / 2 - w / 2, H / 2 - 1, w, 2);
    } else if (si > 0 && shot.enter === "flash" && since < .22) {
      g.fillStyle = rgba(C.goldHi, .5 * (1 - since / .22));
      g.fillRect(0, 0, W, H);
    } else if (si > 0 && shot.enter === "cut" && since < .07) {
      g.fillStyle = rgba("#ffffff", .1 * f.energy);
      g.fillRect(0, 0, W, H);
    }

    title(t);
    credits(t);
    lyric(t);
    if (opts.hud !== false) hud(t);

    g.drawImage(vignette, 0, 0);
    g.save();
    g.globalCompositeOperation = "overlay";
    g.globalAlpha = .06;
    const fi = Math.floor(t * 24);
    const tile = grain[fi % 4];
    const ox = -Math.floor(hash(fi, 7) * 256), oy = -Math.floor(hash(fi, 8) * 256);
    for (let y = oy; y < H; y += 256) for (let x = ox; x < W; x += 256) g.drawImage(tile, x, y);
    g.restore();

    // 처음과 끝은 검정에서 / 검정으로
    const black = Math.max(1 - smooth(0, 1.8, t), smooth(song.duration - 1.8, song.duration - .2, t));
    if (black > 0) {
      g.fillStyle = `rgba(0,0,0,${black})`;
      g.fillRect(0, 0, W, H);
    }
  }

  return { render, shots, song };
}

export { Song };
export type { Lyric };
