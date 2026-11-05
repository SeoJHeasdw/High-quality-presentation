/**
 * 2막 앞부분(0:44–0:55) — 기준 장면. 첫 도전과 실패.
 * 예전 뮤비는 이 11초를 같은 와이드 한 장으로 버텼다. 여기서는 컷마다 거리·각도·속도가 다르다:
 *   달 재기(어깨 너머) → 발 구르기(인서트, 한 박) → 도움닫기(옆 트래킹) → 도약(아래에서, 달을 등진 실루엣)
 *   → 정점(아주 먼 와이드: 달이 얼마나 먼지) → 엉덩방아(충격·먼지·흔들림) → 폰(차가운 빛) 위에 나방(금빛)
 */
import React from "react";
import { Layer, Scene, Screen, project, unproject, type Cam } from "../lib/camera";
import { K } from "../lib/palette";
import { B, beat } from "../lib/song";
import { clamp, ease, handheld, kf, lin, mix, mixc, rnd, smooth, springStep } from "../lib/math";
import { CityLayers, RoofSet, SkyBackdrop } from "../lib/sets";
import { Glow, GodRays, Moon } from "../lib/sky";
import { Antenna, Parapet } from "../lib/city";
import { Moths, Burst, stream, swarm, type M } from "../lib/moths";
import { Kid, skeleton } from "../kid/rig";
import { P, gait, lerpPose, pose, STRIDE } from "../kid/pose";
import type { Shot } from "./types";

const k = K.hope;
const RIM = (dx: number, dy: number, w = .014) => ({ dx, dy, color: k.rim, width: w, glow: .7 });

/** 먼지 한 번: 점 (x, y)에서 t0에 퍼진다 */
const Dust: React.FC<{ x: number; y: number; t: number; t0: number; n?: number; r?: number; color?: string; seed?: number }> = ({ x, y, t, t0, n = 14, r = 120, color = k.fog, seed = 3 }) => {
  const a = t - t0;
  if (a < 0 || a > 1.4) return null;
  const e = ease("expoOut", a / 1.4);
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const side = rnd(seed, i) > .5 ? 1 : -1;
        const dx = side * r * (.3 + rnd(seed, i + 10)) * e;
        const dy = -r * .35 * (.2 + rnd(seed, i + 20)) * e + a * a * 20;
        const rr = r * (.18 + rnd(seed, i + 30) * .2) * (.5 + e);
        return <Glow key={i} x={x + dx} y={y + dy} r={rr} color={color} opacity={(1 - a / 1.4) * .7} />;
      })}
    </g>
  );
};

/** 반짝 별(어지러움): 머리 둘레를 돈다 */
const Dizzy: React.FC<{ x: number; y: number; t: number; a: number; r: number }> = ({ x, y, t, a, r }) => (
  <g opacity={a}>
    {[0, 1, 2].map((i) => {
      const ang = t * 7 + (i * Math.PI * 2) / 3;
      const px = x + Math.cos(ang) * r, py = y + Math.sin(ang) * r * .35;
      const s = 7 + 3 * Math.sin(t * 9 + i);
      return <path key={i} d={`M${px},${py - s}L${px + s * .3},${py - s * .3}L${px + s},${py}L${px + s * .3},${py + s * .3}L${px},${py + s}L${px - s * .3},${py + s * .3}L${px - s},${py}L${px - s * .3},${py - s * .3}Z`} fill={k.accent} />;
    })}
  </g>
);

// 박 번호: B(15)=박 62 = 44.0초
const T_MEASURE = B(15), T_SCUFF = beat(65), T_RUN = B(16), T_LEAP = beat(68), T_APEX = B(17), T_PLOP = beat(72), T_PHONE = B(18);

export const act2a: Shot[] = [
  {
    // 17. 어깨 너머: 엄지·검지로 달을 집어 본다. 손가락 사이에 꼭 맞게 닫히는 순간이 박(64)
    id: "a2-measure", start: T_MEASURE, key: "hope", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt;
      const tPinch = beat(64) - T_MEASURE;
      const hh = handheld(c.t, 3, 5);
      const cam: Cam = { x: 960 + hh.x, y: 540 + hh.y, zoom: kf(lt, [[0, 1], [c.dur, 1.06, "lin"]]), rot: hh.r, focus: 30, dof: 7 };
      const moon = { x: 1180, y: 330, r: 32 };
      const ms = project(cam, 60, moon.x, moon.y);
      const mr = moon.r * ms.s;
      const raise = ease("expoOut", lin(.05, .6, lt));
      const drop = ease("in", lin(1.72, 2.05, lt));
      const p = pose({ ...P.stand, x: 420, y: 1720, s: 1300, facing: 1, armN: [.1, .2], headTilt: kf(lt, [[0, -.25], [.4, -.4], [tPinch + .3, -.4], [tPinch + .55, -.24, "back"]]), lean: -.06 });
      const sk = skeleton(p);
      // 카메라에서 멀어지며 달 쪽으로 뻗는 팔(원근으로 손이 작아진다). 손은 달 바로 왼쪽 아래
      const goal = unproject(cam, 1, ms.x - mr * 1.6, ms.y + mr * 1.3);
      const H = { x: mix(sk.shN.x + 60, goal.x, raise), y: mix(sk.shN.y + 260, goal.y, raise) + drop * 520 };
      const ang = Math.atan2(ms.y - H.y, ms.x - H.x);
      const nx = -Math.sin(ang), ny = Math.cos(ang);
      const ax = H.x - sk.shN.x, ay = H.y - sk.shN.y, al = Math.hypot(ax, ay) || 1;
      const px = -ay / al, py = ax / al;
      const w0 = 62, w1 = 22;
      const arm = `M${sk.shN.x + px * w0},${sk.shN.y + py * w0}Q${sk.shN.x + ax * .5 + px * 40},${sk.shN.y + ay * .5 + py * 40} ${H.x + px * w1},${H.y + py * w1}L${H.x - px * w1},${H.y - py * w1}Q${sk.shN.x + ax * .5 - px * 34},${sk.shN.y + ay * .5 - py * 34} ${sk.shN.x - px * w0},${sk.shN.y - py * w0}Z`;
      // 손가락: 엄지(아래)·검지(위)가 달 지름만큼 남을 때까지 닫힌다
      const close = ease("back", lin(.6, tPinch, lt));
      const gap = mix(mr * 4.2, mr * 2.05, close);
      const fl = mr * 1.9;
      const tip = (side: number, len: number) => ({ x: H.x + Math.cos(ang) * len + nx * side * gap / 2, y: H.y + Math.sin(ang) * len + ny * side * gap / 2 });
      const f1 = tip(-1, fl), f2 = tip(1, fl * .85);
      const ping = Math.exp(-Math.max(0, lt - tPinch) * 5) * (lt >= tPinch ? 1 : 0);
      return (
        <Scene cam={cam}>
          <SkyBackdrop k={k} t={c.t} moon={{ ...moon, pulse: ping, glow: 1 + ping }} horizon={900} />
          <CityLayers k={k} t={c.t} base={820} seed={4} />
          <Layer d={60} blend="screen"><Glow x={moon.x} y={moon.y} r={170} color={k.accent} opacity={ping * .9} /></Layer>
          <Layer d={6}>
            <Moths t={c.t} at={(t) => swarm(21, 9, t, { cx: 1150, cy: 380, rx: 300, ry: 140, size: 3.5 })} color={k.accent} />
          </Layer>
          <Layer d={1}>
            <Kid pose={p} sil={k.sil} rim={RIM(.6, -.8, .008)} />
            <path d={arm} fill={k.sil} />
            <circle cx={H.x} cy={H.y} r={w1 * 1.35} fill={k.sil} />
            <g stroke={k.sil} strokeWidth={13} strokeLinecap="round">
              <path d={`M${H.x},${H.y}Q${(H.x + f1.x) / 2 - nx * gap * .25},${(H.y + f1.y) / 2 - ny * gap * .25} ${f1.x},${f1.y}`} fill="none" />
              <path d={`M${H.x},${H.y}Q${(H.x + f2.x) / 2 + nx * gap * .25},${(H.y + f2.y) / 2 + ny * gap * .25} ${f2.x},${f2.y}`} fill="none" />
            </g>
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 18. 인서트(한 박): 발이 지붕 바닥을 뒤로 두 번 긁는다. 먼지. 낮은 카메라
    id: "a2-scuff", start: T_SCUFF, key: "hope", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt;
      const h8 = c.dur / 2;
      const kick = (x: number) => Math.sin(clamp(x) * Math.PI);
      const s1 = kick(lt / h8), s2 = kick((lt - h8) / h8);
      const cam: Cam = { x: 960 + Math.sin(lt * 40) * 2 * (s1 + s2), y: 540, zoom: 1, focus: 1, dof: 14 };
      const p = pose({ ...P.crouch, x: 1000, y: 930, s: 2300, facing: 1, legN: [mix(.9, .1, s1 + s2 * .8), mix(1.6, .5, s1 + s2 * .8)], legF: [.75, 1.5], squash: .05 });
      return (
        <Scene cam={cam}>
          <SkyBackdrop k={k} t={c.t} moon={{ x: 1500, y: 160, r: 60 }} horizon={760} />
          <CityLayers k={k} t={c.t} base={720} seed={4} far={false} />
          <Layer d={1}>
            <rect x={-400} y={930} width={2800} height={400} fill={k.sil} />
            <g fill={mixc(k.sil, k.fog, .35)}>
              {Array.from({ length: 70 }, (_, i) => <circle key={i} cx={-200 + rnd(5, i) * 2400} cy={940 + rnd(6, i) * 140} r={2 + rnd(7, i) * 5} />)}
            </g>
            <Kid pose={p} sil={k.sil} rim={RIM(.6, -.8, .004)} />
            <Dust x={1020} y={925} t={lt} t0={.05} r={150} color={mixc(k.fog, k.sky[3], .3)} />
            <Dust x={1020} y={925} t={lt} t0={h8 + .03} r={170} color={mixc(k.fog, k.sky[3], .3)} seed={9} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 19. 옆 트래킹: 지붕을 가로질러 달린다. 가까운 안테나가 흐리게 휙 지나간다(전경)
    id: "a2-run", start: T_RUN, key: "hope", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt;
      const v = 1350;
      const accel = (t: number) => (t < .25 ? .5 * (v / .25) * t * t : v * .125 + v * (t - .25));
      const dist = accel(lt);
      const x = 140 + dist;
      const s = 430;
      const g = gait(dist / (s * STRIDE.run), mix(1.2, 2, smooth(0, .3, lt)));
      const p = pose({ ...g, x, y: 860, s, facing: 1, swing: .9, headTilt: -.15 });
      const cam: Cam = { x: x + 140 + Math.sin(lt * 23) * 3, y: 560, zoom: 1, focus: 1, dof: 4 };
      return (
        <Scene cam={cam}>
          <RoofSet k={k} t={c.t} moon={{ x: 1450, y: 250, r: 48, rays: .6 }} roofY={860} x0={-2400} x1={2980} props={false} />
          <Layer d={1}>
            <Antenna x={-300} y={826} h={300} color={k.sil} t={c.t} />
            <Antenna x={1900} y={826} h={220} color={k.sil} t={c.t} seed={3} />
            <Kid pose={p} sil={k.sil} rim={RIM(.7, -.7)} />
          </Layer>
          <Layer d={1.6}>
            <Moths t={c.t} at={(t) => stream(31, 16, t, (u) => ({ x: mix(x - 900, x + 250, u) / 1, y: 520 + Math.sin(u * 6 + t) * 70 }), { speed: .9, spread: 60, size: 6 })} color={k.accent} trail={3} />
          </Layer>
          <Layer d={.42}>
            <Antenna x={1150} y={1220} h={900} color={k.sil} t={c.t} />
            <Antenna x={2450} y={1220} h={760} color={k.sil} t={c.t} seed={7} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 20. 아래에서 올려다본 도약: 거대한 달을 등지고 실루엣이 솟는다. 위로 갈수록 느려진다(정점의 정지감)
    id: "a2-leap", start: T_LEAP, key: "hope", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt;
      const take = .16;
      const up = ease("expoOut", lin(take, c.dur + .2, lt));
      const crouch = 1 - smooth(0, take, lt);
      const x = mix(560, 1010, up), y = mix(1010, 470, up);
      const base = lt < take ? lerpPose(P.stand, P.crouch, smooth(0, take * .7, lt)) : lerpPose(P.leap, { ...P.leap, armN: [2.75, 0], armF: [2.5, .1], legN: [1.0, 1.9], legF: [-.45, .6] }, smooth(.5, 1.3, lt));
      const p = pose({ ...base, anchor: lt < take ? "feet" : "center", x, y: lt < take ? 1010 : y, s: 520, facing: 1, swing: -1.2 * up + .3, rot: lt < take ? 0 : mix(.45, .2, up) });
      const cam: Cam = { x: 960, y: mix(600, 520, up), zoom: mix(1, 1.08, up), rot: mix(.02, -.01, up), focus: 1, dof: 3 };
      const moon = { x: 1000, y: 420, r: 300 };
      return (
        <Scene cam={cam}>
          <SkyBackdrop k={k} t={c.t} moon={{ ...moon, glow: 1.1, rays: 1.4, pulse: c.pulse * .3 }} horizon={1150} stars={.5} wisps={.6} />
          <Layer d={2.5}>
            <Moths t={c.t} at={(t) => stream(41, 40, t, (u) => ({ x: mix(400, 1250, u), y: mix(1150, 200, Math.pow(u, .8)) }), { speed: .55, spread: 140, size: 7 })} color={k.accent} trail={4} />
          </Layer>
          <Layer d={1}>
            <Kid pose={p} sil={k.sil} rim={RIM(0, -1, .012)} rim2={{ dx: .9, dy: -.2, color: "#ffffff", width: .006, glow: .4 }} />
            {/* 지붕 모서리(아래 왼쪽 전경) */}
            <path d={`M-200,1010L700,1010L700,1300L-200,1300Z`} fill={k.sil} />
            <rect x={-200} y={985} width={910} height={26} fill={k.sil} />
            <Dust x={600} y={1000} t={lt} t0={take - .02} r={110} color={mixc(k.fog, k.moon, .4)} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 21. 아주 먼 와이드: 달은 여전히 멀다. 정점에서 잠깐 멈췄다가 떨어진다
    id: "a2-apex", start: T_APEX, key: "hope", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt;
      const hang = .42;
      const fall = Math.max(0, lt - hang);
      const x = 820 + lt * 40;
      const y = 520 - (lt < hang ? Math.sin((lt / hang) * Math.PI / 2) * 14 : 14 - fall * fall * 900);
      const fl = smooth(hang - .05, hang + .25, lt);
      const p = pose({ ...lerpPose(P.apex, P.flail, fl), anchor: "center", x, y: Math.min(y + 0, 2000), s: 64, facing: 1, rot: fl * -.4 + Math.sin(lt * 14) * .08 * fl, swing: mix(-.6, 1.4, fl) });
      const cam: Cam = { x: 960 + lt * 6, y: 540, zoom: 1, focus: 1, dof: .6 };
      // 도약 궤적: 지붕 모서리에서 정점까지 금빛 점
      const trail = Array.from({ length: 14 }, (_, i) => {
        const u = i / 13;
        return { x: mix(560, 820, u), y: mix(890, 506, 1 - Math.pow(1 - u, 2)) };
      });
      return (
        <Scene cam={cam}>
          <SkyBackdrop k={k} t={c.t} moon={{ x: 1560, y: 230, r: 62, rays: .5 }} horizon={980} />
          <CityLayers k={k} t={c.t} base={880} seed={4} />
          <Layer d={1}>
            <Parapet x0={-400} x1={560} y={890} h={14} color={k.sil} />
            {trail.map((q, i) => <circle key={i} cx={q.x} cy={q.y} r={3.2} fill={k.accent} opacity={(1 - smooth(.2, 1.2, lt)) * (.3 + .7 * (i / 13))} />)}
            <Kid pose={p} sil={k.sil} rim={RIM(.8, -.6, .03)} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 22. 엉덩방아: 위에서 떨어져 바닥에 쿵. 눌렸다 튀고, 먼지·화면 흔들림·어지러운 별
    id: "a2-plop", start: T_PLOP, key: "hope", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt;
      const hit = .14;
      const fallY = lt < hit ? mix(-300, 900, Math.pow(lt / hit, 2)) : 900;
      const sq = lt < hit ? -.15 : (1 - springStep(lt - hit, 16, .35)) * .45;
      const shake = lt > hit ? Math.exp(-(lt - hit) * 7) * 26 : 0;
      const look = smooth(.95, 1.25, lt);
      const shakeHead = lt > .9 && lt < 1.3 ? Math.sin((lt - .9) * 40) * .12 * (1 - (lt - .9) / .4) : 0;
      const p = pose({
        ...(lt < hit ? P.flail : P.plop), x: 900, y: fallY, s: 400, facing: 1, squash: sq,
        headTilt: lt < hit ? .1 : mix(.25, -.4, look) + shakeHead, swing: lt < hit ? 1.6 : (1 - springStep(lt - hit, 9, .25)) * 2.2 - .2,
      });
      const cam: Cam = { x: 960 + Math.sin(lt * 61) * shake, y: 540 + Math.cos(lt * 53) * shake, zoom: 1.0 + (lt > hit ? .03 * Math.exp(-(lt - hit) * 5) : 0), focus: 1, dof: 5 };
      const sk = skeleton(p);
      return (
        <Scene cam={cam}>
          <RoofSet k={k} t={c.t} moon={{ x: 1500, y: 210, r: 44 }} roofY={900} x0={-1400} x1={3200} props={false} />
          <Layer d={1}>
            <Antenna x={1500} y={866} h={280} color={k.sil} t={c.t} seed={2} light="#ff6a5a" />
            <Kid pose={p} sil={k.sil} rim={RIM(.75, -.65)} />
            <Dust x={900} y={895} t={lt} t0={hit} r={200} n={18} color={mixc(k.fog, k.sky[3], .25)} />
            <Dizzy x={sk.head.x} y={sk.head.y - 90} t={c.t} a={smooth(.3, .45, lt) * (1 - smooth(1.05, 1.25, lt))} r={60} />
          </Layer>
        </Scene>
      );
    },
  },
  {
    // 23. 3/4 정면 미디엄: 한숨 → 폰(차가운 빛이 얼굴에) → 나방이 화면에 앉는다(금빛이 섞인다) → 나방을 따라 올려다본다
    id: "a2-phone", start: T_PHONE, key: "hope", enter: { type: "cut" },
    render: (c) => {
      const lt = c.lt;
      const tOn = beat(76) - T_PHONE, tLand = beat(77) - T_PHONE, tOff = tLand + .45;
      const sigh = smooth(.15, .6, lt) - smooth(.6, .9, lt) * .5;
      const take = smooth(.75, 1.2, lt);
      const on = smooth(tOn - .05, tOn + .1, lt);
      const warm = smooth(tLand, tLand + .25, lt) * (1 - smooth(tOff + .6, tOff + 1.4, lt) * .4);
      const up = smooth(tOff, tOff + .7, lt);
      // 나방 경로: 오른쪽 위에서 내려와 폰에 앉았다가 위로
      const base = pose({ ...lerpPose(P.sitKnees, P.phone, take), anchor: "feet", x: 860, y: 1110, s: 640, facing: 1, faceDir: .55, bend: .12 + sigh * .14, headTilt: mix(.2 + sigh * .2, .42, take) - up * .95, legN: [1.85, 2.4], legF: [1.7, 2.35] });
      const sk = skeleton(base);
      const ph = { x: mix(sk.haN.x, sk.haF.x, .35), y: mix(sk.haN.y, sk.haF.y, .35) - 6 };
      const moth = (t: number): M[] => {
        const l = t - T_PHONE;
        let x: number, y: number, a = .4;
        if (l < tLand) { const u = ease("out", lin(tLand - 1.1, tLand, l)); x = mix(1500, ph.x, u) + Math.sin(l * 9) * 30 * (1 - u); y = mix(80, ph.y - 8, u) + Math.cos(l * 7) * 20 * (1 - u); }
        else if (l < tOff) { x = ph.x; y = ph.y - 8; a = -1.57; }
        else { const u = ease("in", lin(tOff, tOff + 1.2, l)); x = ph.x + u * 260 + Math.sin(l * 8) * 20 * u; y = ph.y - 8 - u * 900; a = -1.2; }
        return [{ x, y, s: 13, a, f: l < tLand || l > tOff ? l * 18 : l * 3, b: 1 }];
      };
      const p = pose({ ...base, phone: on, face: on * .95, faceColor: mixc(k.cold, "#ffd27a", warm), eyes: mix(.55, 1.1, warm), smile: warm > .6 && lt < tOff + .3 ? 1 : 0, mouth: up * .5 });
      const cam: Cam = { x: 980, y: mix(560, 520, up), zoom: kf(lt, [[0, 1.0], [c.dur, 1.14, "lin"]]), focus: 1, dof: 9 };
      return (
        <Scene cam={cam}>
          <RoofSet k={k} t={c.t} moon={{ x: 1560, y: 150, r: 40 }} roofY={940} x0={-1400} x1={3200} props={false} />
          <Layer d={1}>
            <Kid pose={p} sil={k.sil} rim={RIM(.7, -.7, .01)} phoneColor={mixc(k.cold, "#ffe3a0", warm)} />
          </Layer>
          <Layer d={1} blend="screen">
            <Glow x={ph.x} y={ph.y} r={300} color={mixc(k.cold, "#ffcf70", warm)} opacity={on * (.16 + warm * .2)} />
            <Moths t={c.t} at={moth} color={k.accent} trail={lt > tOff ? 5 : 0} />
          </Layer>
        </Scene>
      );
    },
  },
];
