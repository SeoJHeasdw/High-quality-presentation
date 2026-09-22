import { useEffect, useState } from "react";
import { useDeckNav, fmtTime, type DeckModule } from "./deck-kit";
import { getScript } from "../script";
import "./presenter.css";

function jumpWindow(total: number, current: number): Array<number | string> {
  if (total <= 24) return Array.from({ length: total }, (_, i) => i);

  const points = new Set<number>([0, total - 1]);
  for (let i = Math.max(0, current - 4); i <= Math.min(total - 1, current + 4); i++) {
    points.add(i);
  }

  const sorted = [...points].sort((a, b) => a - b);
  const out: Array<number | string> = [];
  sorted.forEach((value, i) => {
    if (i > 0 && value - sorted[i - 1] > 1) out.push(`gap-${i}`);
    out.push(value);
  });
  return out;
}

/**
 * 노트북에 띄우는 발표자 창. 녹화되지 않는 쪽이다.
 * 슬라이드 창과 BroadcastChannel 로 상태를 공유하므로
 * 어느 창에서 →를 눌러도 둘 다 같이 움직인다.
 */
export default function PresenterView({
  deckId,
  mod,
  deckName,
  deckCode,
}: {
  deckId: string;
  mod: DeckModule;
  deckName: string;
  deckCode: string;
}) {
  const {
    index,
    step,
    maxStep,
    total,
    t0,
    motion,
    captionGuide,
    goto,
    jump,
  } = useDeckNav(mod.slides, deckId);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const slide = mod.slides[index];
  const elapsed = (now - t0) / 1000;
  const jumpItems = jumpWindow(total, index);

  const current = getScript(slide.scriptKey, step);
  const hasNextStep = step < maxStep;
  const next = hasNextStep
    ? getScript(slide.scriptKey, step + 1)
    : getScript(mod.slides[index + 1]?.scriptKey, 0);

  return (
    <div className="pv">
      <header className="pv__bar">
        <div className="pv__deck">
          <b>{deckName}</b>
          <span>{deckCode}</span>
        </div>

        <div className="pv__pos">
          {/* 숫자를 누르는 중이면 현재 위치 대신 이동할 번호를 보여준다.
              조작은 노트북(이 창)에서 하므로 여기가 먼저 보여야 한다. */}
          <span className="pv__pill" data-typing={jump !== "" || undefined}>
            {jump !== "" ? (
              <>
                이동 <b>{jump}</b> / {total} · Enter
              </>
            ) : (
              <>
                슬라이드 <b>{index + 1}</b> / {total}
              </>
            )}
          </span>
          {maxStep > 0 && (
            <span className="pv__pill">
              스텝 <b>{step}</b> / {maxStep}
            </span>
          )}
        </div>

        <div className="pv__right">
          <span className="pv__timer">{fmtTime(elapsed)}</span>
          <span className="pv__pill" data-off={!motion}>
            모션 {motion ? "ON" : "OFF"}
          </span>
          {deckId === "course" && (
            <span className="pv__pill" data-off={!captionGuide}>
              자막영역 {captionGuide ? "ON" : "OFF"}
            </span>
          )}
        </div>
      </header>

      <main className="pv__main">
        <section className="pv__script">
          <div className="pv__label">
            지금 읽을 것
            {slide.scriptKey && (
              <code>
                {slide.scriptKey} · {step}
              </code>
            )}
          </div>

          {current ? (
            <div className="pv__text" key={`${index}-${step}`}>
              {current.split("\n\n").map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          ) : (
            <div className="pv__empty">
              <p>이 스텝의 대본이 아직 없습니다.</p>
              <code>
                script/ 아래 .md 에 ## {slide.scriptKey ?? slide.id} → ### {step}
              </code>
            </div>
          )}
        </section>

        <aside className="pv__side">
          <div className="pv__panel pv__panel--grow">
            <div className="pv__label">
              다음 {hasNextStep ? "스텝" : "슬라이드"}
            </div>
            <p className="pv__next">
              {next ?? (index + 1 >= total ? "— 마지막 슬라이드 —" : "—")}
            </p>
          </div>
        </aside>
      </main>

      <footer className="pv__foot">
        <div className="pv__jump">
          {jumpItems.map((item) =>
            typeof item === "number" ? (
              <button
                key={mod.slides[item].id}
                data-active={item === index}
                onClick={() => goto(item)}
              >
                {item + 1}
              </button>
            ) : (
              <span className="pv__jump-gap" key={item}>···</span>
            ),
          )}
        </div>
        <div className="pv__keys">
          <span>
            <kbd>→</kbd> 다음
          </span>
          <span>
            <kbd>←</kbd> 이전
          </span>
          <span>
            <kbd>숫자</kbd>
            <kbd>Enter</kbd> 번호로 이동
          </span>
          <span>
            <kbd>T</kbd> 타이머 리셋
          </span>
          <span>
            <kbd>R</kbd> 다시 재생
          </span>
          <span>
            <kbd>M</kbd> 모션 토글
          </span>
          {deckId === "course" && (
            <span>
              <kbd>S</kbd> 자막영역
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}
