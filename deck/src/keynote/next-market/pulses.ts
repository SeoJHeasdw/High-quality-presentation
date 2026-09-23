/*
 * 속도 챕터의 빛. 빛 한 줄기가 판단 하나를 뜻하는 도식이다(실제 호출이 아니다).
 * 한 줄기가 목적지에 닿는 시간은 Jev 발표의 응답 시간 범위(70~500ms)에서 고른다.
 * 좌표는 렌더에 쓴 카메라로 투영한 고층 건물 옥상이다(track.json의 pulses).
 */
type Pulse = { a: number; b: number; t0: number; dur: number; gold: boolean };
type Ring = { x: number; y: number; t0: number; gold: boolean };

export type PulseField = { setActive(on: boolean): void; dispose(): void };

export function createPulses(canvas: HTMLCanvasElement, points: number[][]): PulseField {
  const g = canvas.getContext("2d");
  if (!g || points.length < 2) return { setActive() {}, dispose() {} };
  let pulses: Pulse[] = [];
  let rings: Ring[] = [];
  let raf = 0;
  let active = false;
  let nextSpawn = 0;
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const pick = (now: number) => {
    const a = Math.floor(rand() * points.length);
    for (let tries = 0; tries < 12; tries++) {
      const b = Math.floor(rand() * points.length);
      const d = Math.hypot(points[a][0] - points[b][0], points[a][1] - points[b][1]);
      if (b !== a && d > 90 && d < 620) {
        pulses.push({ a, b, t0: now, dur: 70 + rand() * 430, gold: rand() < .22 });
        return;
      }
    }
  };

  const at = (p: Pulse, t: number) => {
    const [ax, ay] = points[p.a], [bx, by] = points[p.b];
    const lift = Math.hypot(bx - ax, by - ay) * .32;
    const cx = (ax + bx) / 2, cy = Math.min(ay, by) - lift;
    const u = 1 - t;
    return [u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by];
  };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (active && now >= nextSpawn) {
      pick(now);
      nextSpawn = now + 70 + rand() * 60;
    }
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.globalCompositeOperation = "lighter";
    // 건물 옥상의 수신점
    for (const [x, y] of points) {
      g.fillStyle = "rgba(170,220,255,.28)";
      g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fill();
    }
    pulses = pulses.filter((p) => {
      const t = (now - p.t0) / p.dur;
      if (t >= 1) {
        rings.push({ x: points[p.b][0], y: points[p.b][1], t0: now, gold: p.gold });
        return false;
      }
      const tone = p.gold ? "255,205,130" : "175,228,255";
      const steps = 14, tail = .45;
      g.lineCap = "round";
      for (let i = 0; i < steps; i++) {
        const s0 = Math.max(0, t - tail + (tail * i) / steps), s1 = Math.max(0, t - tail + (tail * (i + 1)) / steps);
        const [x0, y0] = at(p, s0), [x1, y1] = at(p, s1);
        g.strokeStyle = `rgba(${tone},${((i + 1) / steps) * .85})`;
        g.lineWidth = 1 + ((i + 1) / steps) * 2.2;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      }
      const [hx, hy] = at(p, t);
      const glow = g.createRadialGradient(hx, hy, 0, hx, hy, 14);
      glow.addColorStop(0, `rgba(${tone},1)`); glow.addColorStop(1, `rgba(${tone},0)`);
      g.fillStyle = glow; g.beginPath(); g.arc(hx, hy, 14, 0, Math.PI * 2); g.fill();
      return true;
    });
    rings = rings.filter((r) => {
      const t = (now - r.t0) / 520;
      if (t >= 1) return false;
      g.strokeStyle = `rgba(${r.gold ? "255,205,130" : "175,228,255"},${(1 - t) * .9})`;
      g.lineWidth = 1.6;
      g.beginPath(); g.arc(r.x, r.y, 3 + t * 20, 0, Math.PI * 2); g.stroke();
      return true;
    });
    g.globalCompositeOperation = "source-over";
    if (!active && !pulses.length && !rings.length) {
      cancelAnimationFrame(raf); raf = 0;
      g.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  return {
    setActive(on) {
      if (on === active) return;
      active = on;
      if (on && !raf) raf = requestAnimationFrame(frame);
    },
    dispose() {
      active = false;
      cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
