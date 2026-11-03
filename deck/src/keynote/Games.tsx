import { useRef, useState, type CSSProperties } from "react";
import { Briefing } from "./KeynoteFrame";
import "./games.css";

/*
 * 32번 · 실물 4 / 게임. 29~31번의 엔진 결과물이 모이는 곳: 에셋과 BGM을 넣은 게임 세 개를 동시에 만들고 있다.
 * 칩의 실선은 지금 엔진에서 넣는 것, 점선은 다음(NPC 목소리는 세 게임 모두 아직). 근거는 FACT-CHECK와 대본.
 */
type Use = "on" | "next";
const GAMES: { id: string; name: string; meta: string; img: string; shot: string; uses: [string, Use][] }[] = [
  { id: "moonlight", name: "달빛 야시장", meta: "Unity · 친구와 협동 · 10/29 친구 테스트판", img: "/games/moonlight.jpg", shot: "게임 화면",
    uses: [["에셋", "on"], ["BGM", "on"], ["NPC 목소리", "next"]] },
  { id: "maxmax", name: "maxmax", meta: "Unity · 크리처와 집 짓는 협동 · 가칭", img: "/games/maxmax.jpg", shot: "게임에 넣은 크리처",
    uses: [["에셋", "on"], ["BGM", "on"], ["NPC 목소리", "next"]] },
  { id: "reclaim", name: "RECLAIM WORKS", meta: "Unreal · 버려진 설비를 되살리는 싱글", img: "/games/reclaim.jpg", shot: "회색 상자 단계의 게임 화면",
    uses: [["에셋", "next"], ["BGM", "on"], ["NPC 목소리", "next"]] },
];

export default function GameShelf() {
  const pending = useRef(false);
  const [launching, setLaunching] = useState("");
  const [message, setMessage] = useState("");
  const launch = async (game: typeof GAMES[number]) => {
    if (pending.current) return;
    pending.current = true; setLaunching(game.id); setMessage("");
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    try {
      const response = await fetch(`/__javis/games/${game.id}/launch`, { method: "POST", headers: { "X-Javis-Launch": "1" }, signal: AbortSignal.timeout(10000) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.error || "로컬 발표 서버를 다시 켠 뒤 실행해주세요.");
      setMessage(`${game.name} 실행을 요청했습니다. 게임 창을 확인해주세요.`);
    } catch (error) {
      setMessage(error instanceof Error && !(error instanceof TypeError) && error.name !== "TimeoutError" ? error.message : "실행 서버에 연결하지 못했습니다. 로컬 발표 서버를 확인해주세요.");
    } finally { pending.current = false; setLaunching(""); }
  };
  return <Briefing n={32} name="실물 4 / 게임" title="그리고 결국, 게임이 만들어집니다" lead="에셋과 BGM은 제 엔진에서 나옵니다. 지금 세 개를 동시에 만들고 있습니다." className="demo-slide games-slide">
    <div className="gm-row">
      {GAMES.map((g, i) => <article className="gm-card" key={g.name} style={{ "--i": i } as CSSProperties}>
        <figure><img src={g.img} alt=""/><figcaption>{g.shot}</figcaption></figure>
        <h2>{g.name}</h2>
        <p>{g.meta}</p>
        <ul>{g.uses.map(([u, s]) => <li key={u} data-use={s}>{u}{s === "next" && <small>다음</small>}</li>)}</ul>
        <button className="gm-launch" type="button" aria-label={`${g.name} 실행`} disabled={!!launching} onClick={() => void launch(g)}><span>{launching === g.id ? "여는 중…" : "게임 실행 ↗"}</span></button>
      </article>)}
    </div>
    <p className="gm-legend"><i data-use="on"/>지금 제 엔진에서 넣는 것 <i data-use="next"/>다음</p>
    <p className="gm-status" role="status">{message}</p>
  </Briefing>;
}
