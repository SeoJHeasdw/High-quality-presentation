import { useEffect, useState } from "react";
import Stage from "./components/Stage";
import PresenterView from "./components/PresenterView";
import {
  useDeckNav,
  Progress,
  fmtTime,
  type DeckModule,
} from "./components/deck-kit";
import CourseDeck from "./production/CourseDeck";
import KeynoteDeck from "./keynote/KeynoteDeck";
import CourseMotionBoundary from "./components/CourseMotionBoundary";
import "./styles/base.css";
import "./styles/course-motion.css";

export type DeckKey = "keynote" | "course";

const MODULES: Record<DeckKey, DeckModule> = {
  keynote: KeynoteDeck,
  course: CourseDeck,
};
const NAV_ITEMS: { id: DeckKey; label: string }[] = [
  { id: "keynote", label: "KEYNOTE" },
  { id: "course", label: "기존 강의" },
];

const DECK_META: Record<DeckKey, { name: string; code: string }> = {
  keynote: { name: "JAVIS", code: "나의 30년 생존 계획" },
  course: { name: "A COURSE SYSTEM", code: "실제 강의" },
};

interface Route {
  deck: DeckKey;
  presenter: boolean;
}

/** 기본은 새 키노트. #course에서 기존 기술 강의를 열 수 있다. */
function readHash(): Route {
  const raw = window.location.hash.replace("#", "").toLowerCase();
  const [deck, mode] = raw.split("/");
  return {
    deck: deck === "course" ? "course" : "keynote",
    presenter: mode === "present",
  };
}

/* ── 슬라이드 창 ─────────────────────────────────────── */

function DeckView({ id }: { id: DeckKey }) {
  const mod = MODULES[id];
  const {
    index,
    step,
    runKey,
    total,
    maxStep,
    motion,
    t0,
    hudHidden,
    captionGuide,
    jump,
  } = useDeckNav(mod.slides, id);
  const slide = mod.slides[index];

  return (
    <>
      <Stage>
        <div
          className={mod.className}
          data-motion={motion ? "on" : "off"}
          style={{ position: "absolute", inset: 0 }}
        >
          {/* 슬라이드가 바뀌면 통째로 리마운트해서 등장 애니메이션을 처음부터 재생.
              단, group 이 같은 연속 화면(같은 그림에 상태만 다른 것들)은 키가
              그대로라 마운트를 유지한다 — 배경까지 다시 그려 화면이 찢어지는 것을
              막는다. runKey 도 묶음 안에서는 올라가지 않는다 (deck-kit.tsx). */}
          {id === "keynote" ? (
            <div key={`${slide.group ?? slide.id}-${runKey}`} style={{ position: "absolute", inset: 0 }}>
              {slide.render({ step, runKey })}
            </div>
          ) : <CourseMotionBoundary
            key={`${id}-${slide.group ?? slide.id}-${runKey}`}
            cue={`${slide.id}:${step}:${runKey}`}
          >
            {slide.render({ step, runKey })}
          </CourseMotionBoundary>}
          <Progress value={total > 1 ? index / (total - 1) : 1} />
        </div>

        {id === "course" && (
          <div className="caption-safe-guide" data-on={captionGuide}>
            SUBTITLE SAFE AREA · 2 LINES
          </div>
        )}
      </Stage>

      <Hud
        deckId={id}
        index={index}
        total={total}
        step={step}
        maxStep={maxStep}
        t0={t0}
        motion={motion}
        hidden={hudHidden}
        captionGuide={captionGuide}
        jump={jump}
      />

      {/* 숫자를 누르는 즉시 화면 한가운데 크게 뜬다. 하단 바를 숨기고(H)
          녹화 중일 때도 어디로 가는지 보여야 하므로 HUD 밖에 둔다. */}
      {jump !== "" && (
        <div className="goto">
          <span className="goto__label">이동</span>
          <b>{jump}</b>
          <span className="goto__total">/ {total}</span>
          <span className="goto__hint">
            <kbd>Enter</kbd> 이동 <kbd>Esc</kbd> 취소
          </span>
        </div>
      )}
    </>
  );
}

/* ── 발표자 HUD (녹화 시 H 로 숨김) ───────────────────── */

function Hud({
  deckId,
  index,
  total,
  step,
  maxStep,
  t0,
  motion,
  hidden,
  captionGuide,
  jump,
}: {
  deckId: DeckKey;
  index: number;
  total: number;
  step: number;
  maxStep: number;
  t0: number;
  motion: boolean;
  hidden: boolean;
  captionGuide: boolean;
  jump: string;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const meta = DECK_META[deckId];

  return (
    <div className="hud" data-hidden={hidden}>
      <div className="hud__deck">
        {NAV_ITEMS.map(({ id, label }) => (
          <button
            key={id}
            data-active={id === deckId}
            data-wide
            onClick={() => {
              window.location.hash = id;
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <span className="hud__sep" />
      <strong style={{ fontWeight: 700 }}>{meta.name}</strong>
      <span className="hud__pill" data-typing={jump !== "" || undefined}>
        {jump !== "" ? `→ ${jump}` : index + 1} / {total}
      </span>
      {maxStep > 0 && (
        <span className="hud__pill">
          step {step} / {maxStep}
        </span>
      )}
      <span className="hud__pill">{fmtTime((now - t0) / 1000)}</span>
      {!motion && <span className="hud__pill">모션 OFF</span>}
      {deckId === "course" && (
        <span className="hud__pill">자막 가이드 {captionGuide ? "ON" : "OFF"}</span>
      )}
      <span className="hud__sep" />
      <button
        className="hud__open"
        onClick={() =>
          window.open(
            `${window.location.pathname}#${deckId}/present`,
            "presenter",
            "width=1280,height=820",
          )
        }
      >
        발표자 창 열기
      </button>
      <span className="hud__sep" />
      <span style={{ opacity: 0.6 }}>
        <kbd>숫자</kbd>+<kbd>Enter</kbd> 이동 <kbd>H</kbd> 숨기기 <kbd>F</kbd>{" "}
        전체화면
        {deckId === "course" && (
          <>
            {" "}<kbd>S</kbd> 자막영역
          </>
        )}
      </span>
    </div>
  );
}

/* ── 앱 ──────────────────────────────────────────────── */

export default function App() {
  const [route, setRoute] = useState<Route>(readHash);

  useEffect(() => {
    const onHash = () => setRoute(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  /* 전역 단축키는 F 전체화면 하나뿐이다.
     숫자키는 "장표 번호 이동"에 쓴다 (deck-kit.tsx 의 useDeckNav). */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (route.presenter) {
    return (
      <PresenterView
        key={route.deck}
        deckId={route.deck}
        mod={MODULES[route.deck]}
        deckName={DECK_META[route.deck].name}
        deckCode={DECK_META[route.deck].code}
      />
    );
  }

  return <DeckView key={route.deck} id={route.deck} />;
}
