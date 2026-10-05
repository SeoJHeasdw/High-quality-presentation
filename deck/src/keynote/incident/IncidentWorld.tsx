import { useEffect, useRef, useState } from "react";
import type { AnchorId, IncidentWorld as World } from "./world";
import { usePerformanceMotion } from "../usePerformanceMotion";
import IncidentDiagram from "../IncidentDiagram";
import "./incident.css";

type Tone = "ice" | "amber" | "teal" | "mute" | "gold";
/** at: 단계가 시작되고 몇 초 뒤에 나타나는지. 3D 장면에서 그 일이 일어나는 때에 맞춘다(world.ts). */
type Label = { id: AnchorId; name: string; sub?: string; tone?: Tone; tag?: string; dir?: "up" | "left" | "right"; at?: number };

const ROOM_NAMES = ["실행 A", "실행 B", "실행 C", "실행 D"];
const ROLE = ["정보 수집", "정보 수집", "실행", "실행"];

/** What the space names at each beat. Kept short: the heading and narration carry the story. */
function labelsFor(p: number): Label[] {
  // 9번 연결 장면: 방 A의 에이전트 하나만 이름을 붙인다.
  if (p === -2) return [{ id: "room0", name: "에이전트", sub: "사이트가 열어준 기능을 부른다", dir: "left" }];
  if (p === -1) return [{ id: "room0", name: "에이전트", sub: "문이 닫힌 방" }, { id: "wall", name: "인터넷 차단", tone: "mute", dir: "left" }];
  const rooms = ROOM_NAMES.map((name, i): Label | null => {
    const id = `room${i}` as AnchorId;
    if (p === 0) return { id, name, sub: "각자의 과제" };
    if (p === 1) return i === 0 ? { id, name, sub: "Google Drive 파일이 필요" } : null;
    if (p === 4) return { id, name, sub: ROLE[i], tone: i < 2 ? "ice" : "teal" };
    return null;
  }).filter(Boolean) as Label[];
  const out: Label[] = [...rooms];
  if (p === 0) out.push({ id: "server", name: "공용 소프트웨어 서버", sub: "모든 실행이 접근", tag: "공용 공간", dir: "right" }, { id: "wall", name: "인터넷 차단", tone: "mute", dir: "left" });
  if (p === 1) out.push({ id: "file", name: "파일 쓰기 가능", sub: "공용 서버", tone: "amber", dir: "up" }, { id: "probe", name: "외부 연결 실패", sub: "서버를 거친 시도", tone: "ice", dir: "up" });
  if (p === 2) out.push({ id: "server", name: "공용 서버", sub: "소프트웨어를 받던 곳", tone: "mute", dir: "right" });
  if (p === 3) out.push({ id: "breach", name: "서버가 대신 요청", sub: "5월 26일", tone: "amber", dir: "up" }, { id: "globe", name: "외부 인터넷", tone: "amber", dir: "up" });
  if (p === 4) out.push({ id: "boardA", name: "다시 만든 게시판", sub: "작업을 나누고 이어받는다", tone: "ice", dir: "left" });
  if (p === 5) out.push({ id: "service", name: "Hugging Face", sub: "실제 외부 서비스", tone: "amber", tag: "제삼자 시스템", dir: "up" }, { id: "breach", name: "평가 환경 밖으로", tone: "amber", dir: "up" });
  // 13번 · 지시와 선 셋. 금색 = 사람(OpenAI), 호박색 = AI가 넘은 선. at은 world.ts의 ORDER_AT · LEG_AT에 맞춘다.
  if (p === 6) out.push(
    { id: "desk", name: "OpenAI", sub: "지시는 \"풀어라\" 하나", tone: "gold", tag: "사람", dir: "right", at: 0.3 },
    { id: "solved", name: "평가 과제 898개", tone: "ice", dir: "left", at: 1.8 },
    { id: "unsolved", name: "어떤 모델도 못 푼 198개", sub: "전체의 22%", tone: "amber", dir: "up", at: 3.0 },
  );
  if (p === 7) out.push(
    { id: "room0", name: "목표는 과제 하나", tone: "amber", dir: "left", at: 0.3 },
    { id: "server", name: "OpenAI 공용 서버", sub: "6월 26일 · 관리자처럼 쓰게 됨", tone: "amber", tag: "선 ①", dir: "right", at: 1.8 },
    { id: "globe", name: "바깥 인터넷", sub: "7월 8일 · 막아둔 벽 밖으로", tone: "amber", tag: "선 ②", dir: "left", at: 3.6 },
    { id: "serviceSide", name: "Hugging Face", sub: "7월 11~13일 · 실서비스 일부", tone: "amber", tag: "선 ③", dir: "right", at: 5.2 },
  );
  // 14번 · 신호 세 번과 결론. 신호는 고리가 켜지는 때(world.ts SIG_AT + 1.1초)에 맞춘다.
  if (p === 8) out.push(
    { id: "desk", name: "OpenAI", sub: "세 번 모두 사람이 봤다", tone: "gold", tag: "사람", dir: "up", at: 0.3 },
    { id: "sig0", name: "5월 26일", sub: "게시판 활동을 봤다", tone: "gold", dir: "left", at: 1.6 },
    { id: "sig1", name: "6월 27일", sub: "경보 · 멈출 필요 없음", tone: "gold", dir: "left", at: 3.3 },
    { id: "sig2", name: "7월 5일", sub: "서버 장애 · 서버를 내림", tone: "gold", dir: "right", at: 4.6 },
  );
  if (p === 9) out.push(
    { id: "fence", name: "범위", sub: "어디까지 닿게 할지", tone: "gold", dir: "up", at: 1.4 },
    { id: "desk", name: "감시", sub: "누가 지켜볼지", tone: "gold", dir: "right", at: 2.9 },
    { id: "halt", name: "중단", sub: "누가 멈출 수 있는지", tone: "gold", dir: "left", at: 4.4 },
  );
  return out;
}
const ALL_IDS: AnchorId[] = ["room0", "room1", "room2", "room3", "server", "file", "probe", "wall", "breach", "globe", "boardA", "service",
  "desk", "sig0", "sig1", "sig2", "halt", "solved", "unsolved", "fence", "serviceSide"];

export default function IncidentWorld({ phase }: { phase: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Partial<Record<AnchorId, HTMLDivElement | null>>>({});
  const world = useRef<World | null>(null);
  const [failed, setFailed] = useState(false);
  const motion = usePerformanceMotion();
  const motionRef = useRef(motion); motionRef.current = motion;
  const phaseRef = useRef(phase); phaseRef.current = phase;

  useEffect(() => {
    const canvas = canvasRef.current!;
    let w: World | null = null, cancelled = false;
    const lost = () => setFailed(true);
    const move = (e: PointerEvent) => w?.setPointer(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1);
    // three.js loads with the incident slides, not with the whole deck.
    import("./world").then(({ createIncidentWorld }) => {
      if (cancelled) return;
      try { w = createIncidentWorld(canvas, phaseRef.current, motionRef.current); }
      catch { setFailed(true); return; }
      world.current = w;
      const live = w;
      canvas.addEventListener("incident-lost", lost);
      live.onFrame(() => {
        if (labelsRef.current) labelsRef.current.style.opacity = live.labelAlpha().toFixed(3);
        for (const id of ALL_IDS) {
          const el = labelRefs.current[id]; if (!el) continue;
          const { x, y, visible } = live.project(id);
          el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
          el.style.visibility = visible ? "" : "hidden";
        }
      });
      addEventListener("pointermove", move);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; removeEventListener("pointermove", move); canvas.removeEventListener("incident-lost", lost); w?.dispose(); world.current = null; };
  }, []);
  useEffect(() => { world.current?.setPhase(phase); }, [phase]);
  useEffect(() => { world.current?.setMotion(motion); }, [motion]);

  const active = new Map(labelsFor(phase).map((l) => [l.id, l]));
  return <>
    <div className="iw" data-fallback={failed || undefined} data-phase={phase} aria-hidden="true">
      <canvas ref={canvasRef} className="iw-canvas" width={1920} height={1080}/>
      <div className="iw-shade"/>
      <div className="iw-labels" ref={labelsRef}>
        {ALL_IDS.map((id) => {
          const l = active.get(id);
          return <div key={id} ref={(el) => { labelRefs.current[id] = el; }} className="iw-label" data-on={(l && !failed) || undefined} data-tone={l?.tone ?? "ice"} data-dir={l?.dir ?? "up"}
            style={l?.at ? { transitionDelay: `${l.at}s` } : undefined}>
            <i className="iw-label-dot"/>
            <div className="iw-label-box">
              {l?.tag && <span className="iw-label-tag">{l.tag}</span>}
              <strong>{l?.name}</strong>
              {l?.sub && <span className="iw-label-sub">{l.sub}</span>}
            </div>
          </div>;
        })}
      </div>
    </div>
    {failed && phase >= 0 && <div className="iw-fallback story-incident-revision"><IncidentDiagram phase={phase}/></div>}
  </>;
}
