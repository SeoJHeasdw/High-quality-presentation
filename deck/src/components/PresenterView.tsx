import { useEffect, useState } from "react";
import { useDeckNav, fmtTime, type DeckModule } from "./deck-kit";
import { getScript, splitScript } from "../script";
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
    annotationMode,
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

  // 읽을 말만 가운데에 두고, 근거 · 연출 · 발표 조작 같은 노트는 오른쪽에 둔다. 다음 장의 대본은 보여 주지 않는다(읽다가 헷갈린다).
  const current = getScript(slide.scriptKey, step);
  const { say, notes } = current ? splitScript(current) : { say: "", notes: "" };

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
          {annotationMode && <span className="pv__pill" data-warn="true">드로잉 중 · W로 종료</span>}
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

          {say ? (
            <div className="pv__text" key={`${index}-${step}`}>
              {say.split("\n\n").map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          ) : current ? (
            <div className="pv__empty">
              <p>이 스텝은 말할 대본 없이 넘깁니다. 오른쪽 노트를 보세요.</p>
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
            <div className="pv__label">근거 · 연출</div>
            {notes ? (
              <div className="pv__notes" key={`${index}-${step}`}>
                {notes.split("\n").filter((line) => line.trim()).map((line, i) => {
                  const head = line.match(/^([^:：]{1,70})[:：]\s*/);
                  return head && !/^https?$/.test(head[1]) ? (
                    <p key={i}><b>{head[1]}</b>{line.slice(head[0].length)}</p>
                  ) : (
                    <p key={i}>{line}</p>
                  );
                })}
              </div>
            ) : (
              <p className="pv__notes pv__notes--none">이 스텝의 노트는 없습니다.</p>
            )}
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
                disabled={annotationMode}
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
          <span>
            <kbd>W</kbd> 드로잉 토글
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
