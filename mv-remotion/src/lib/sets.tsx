/**
 * 자주 쓰는 무대(배경 층 묶음). 인물·전경은 컷에서 따로 얹는다.
 *   SkyBackdrop  하늘·별·달·빛줄기·옅은 구름결(움직이지 않는 먼 층)
 *   CityLayers   먼→가까운 도시 실루엣 세 겹(공기 원근: 멀수록 fog 색)
 *   RoofSet      SkyBackdrop + CityLayers + 지붕(난간·물탱크·안테나·빨랫줄)
 */
import React from "react";
import { Layer } from "./camera";
import { mixhex } from "./math";
import type { Key } from "./palette";
import { GodRays, Moon, SkyFill, Stars, Wisp } from "./sky";
import { Antenna, Laundry, Parapet, Skyline, WaterTank } from "./city";

export type MoonSpec = { x: number; y: number; r: number; glow?: number; pulse?: number; rays?: number };

export const SkyBackdrop: React.FC<{ k: Key; t: number; moon?: MoonSpec | null; stars?: number; horizon?: number; seed?: number; wisps?: number; glowOpacity?: number }> = ({ k, t, moon, stars = 1, horizon = 980, seed = 1, wisps = 1, glowOpacity = .55 }) => (
  <>
    <Layer d={Infinity}>
      <SkyFill k={k} y0={-300} y1={horizon + 120} glowY={horizon} glowOpacity={glowOpacity} />
      {stars > 0 ? <Stars seed={seed} t={t} alpha={stars} y1={horizon - 250} /> : null}
    </Layer>
    {moon ? (
      <Layer d={60}>
        {moon.rays ? <GodRays x={moon.x} y={moon.y} t={t} color={k.moon} opacity={.16 * moon.rays} len={moon.r * 16} /> : null}
        <Moon x={moon.x} y={moon.y} r={moon.r} color={k.moon} glow={moon.glow ?? 1} pulse={moon.pulse ?? 0} />
      </Layer>
    ) : null}
    {wisps > 0 ? (
      <Layer d={30} opacity={wisps}>
        <Wisp x={300} y={260} w={1300} color={k.cloudLit} opacity={.22} t={t} />
        <Wisp x={1500} y={420} w={1600} color={k.cloudLit} opacity={.18} t={t} drift={-6} />
        <Wisp x={900} y={140} w={900} color={k.cloudLit} opacity={.12} t={t} drift={5} />
      </Layer>
    ) : null}
  </>
);

/** 도시 세 겹. base는 깊이 1 기준 지붕 높이(그 아래로 도시가 내려다보인다) */
export const CityLayers: React.FC<{ k: Key; t: number; base: number; seed?: number; ignite?: (u: number, i: number) => number; density?: number; far?: boolean }> = ({ k, t, base, seed = 4, ignite, density = 1, far = true }) => (
  <>
    {far ? (
      <Layer d={14}>
        <Skyline seed={seed} base={base + 260} minH={120} maxH={420} minW={40} maxW={120} color={mixhex(k.fog, k.sky[3], .25)} t={t} win={{ density: .18 * density, size: .45, warm: k.win, cold: k.cold }} details={false} x0={-1400} x1={3400} ignite={ignite} />
      </Layer>
    ) : null}
    <Layer d={5}>
      <Skyline seed={seed + 1} base={base + 330} minH={180} maxH={560} minW={70} maxW={170} color={mixhex(k.silFar, k.fog, .55)} t={t} win={{ density: .2 * density, size: .7, warm: k.win, cold: k.cold }} x0={-1000} x1={3000} ignite={ignite} />
    </Layer>
    <Layer d={2.2}>
      <Skyline seed={seed + 2} base={base + 420} minH={200} maxH={520} minW={120} maxW={260} color={mixhex(k.silFar, k.sil, .45)} t={t} win={{ density: .16 * density, size: 1, warm: k.win, cold: k.cold }} x0={-800} x1={2800} ignite={ignite} />
    </Layer>
  </>
);

/** 지붕 무대. roofY = 지붕 바닥 높이(깊이 1). x0~x1이 지붕, 그 밖은 낭떠러지 */
export const RoofSet: React.FC<{ k: Key; t: number; moon?: MoonSpec | null; roofY?: number; x0?: number; x1?: number; seed?: number; props?: boolean; wind?: number; stars?: number; city?: boolean }> = ({ k, t, moon, roofY = 860, x0 = -1200, x1 = 1500, seed = 4, props = true, wind = .6, stars = 1, city = true }) => (
  <>
    <SkyBackdrop k={k} t={t} moon={moon} stars={stars} horizon={roofY + 120} />
    {city ? <CityLayers k={k} t={t} base={roofY} seed={seed} /> : null}
    <Layer d={1}>
      <Parapet x0={x0} x1={x1} y={roofY} h={34} color={k.sil} />
      {props ? (
        <>
          <WaterTank x={x0 + 420} y={roofY - 34} s={150} color={k.sil} />
          <Antenna x={x0 + 700} y={roofY - 34} h={260} color={k.sil} t={t} seed={seed} light="#ff6a5a" />
          <Laundry x0={x0 + 820} y0={roofY - 190} x1={x0 + 1350} y1={roofY - 175} sag={22} color={k.sil} t={t} wind={wind} items={5} seed={seed} />
        </>
      ) : null}
    </Layer>
  </>
);
