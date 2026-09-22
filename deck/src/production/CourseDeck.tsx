import type { CSSProperties } from "react";
import Aurora from "../reactbits/Aurora/Aurora";
import ShinyText from "../reactbits/ShinyText/ShinyText";
import SpotlightCard from "../reactbits/SpotlightCard/SpotlightCard";
import { Reveal, SafeFx, Step, type DeckModule } from "../components/deck-kit";
import ClassifyShot from "./ClassifyShot";
import FoldSteps from "./FoldSteps";
import JavisHandoff from "./JavisHandoff";
import JavisToken from "./JavisToken";
import JavisLoop from "./JavisLoop";
import { AccentText, CopyLines, copyReveal, sentences } from "./copy-steps";
import {
  COURSE_SLIDES,
  slideSteps,
  type CourseSide,
  type CourseSlideSpec,
} from "./course-content";
import "./course.css";

function CourseBackground({ ambient = false }: { ambient?: boolean }) {
  return (
    <div className="course-bg" aria-hidden>
      {ambient && (
        <div className="course-bg__aurora">
          <SafeFx>
            <Aurora
              colorStops={["#3A2BFF", "#7C8CFF", "#FFD166"]}
              amplitude={0.72}
              blend={0.52}
              speed={0.22}
            />
          </SafeFx>
        </div>
      )}
      <div className="course-bg__glow" />
      <div className="course-bg__veil" />
    </div>
  );
}

/**
 * 화면에 남는 유일한 진행 표시는 상단 진행 바뿐이다.
 * 장표 번호(`85 / 678`)는 영상에 찍힐 이유가 없어서 뺐다.
 * 제작 중에 필요한 번호는 하단 발표자 바와 번호 이동 오버레이가 보여준다.
 */
function CourseChrome({ eyebrow }: { eyebrow?: string }) {
  // 묶인 화면에서는 이 요소가 살아남으므로 글이 바뀔 때 키로 다시 띄운다.
  if (!eyebrow) return null;
  return (
    <div className="course-eyebrow" key={eyebrow}>
      {eyebrow}
    </div>
  );
}

function Side({ side }: { side?: CourseSide }) {
  if (!side) return null;
  return (
    <div className="course-side">
      {side.image && (
        <div className="course-side__thumb">
          <img src={side.image} alt="" />
        </div>
      )}
      {side.label && <div className="course-side__label mono">{side.label}</div>}
      <h3>{side.title}</h3>
      {side.body && <p>{side.body}</p>}
    </div>
  );
}

function VersusSide({
  side,
  tone,
}: {
  side?: CourseSide;
  tone: "left" | "right";
}) {
  if (!side) return null;
  return (
    <SpotlightCard
      className={`course-versus__card course-versus__card--${tone}`}
      spotlightColor={
        tone === "right"
          ? "rgba(255, 209, 102, 0.2)"
          : "rgba(132, 146, 255, 0.22)"
      }
    >
      {/* A / B 워터마크를 붙이지 않는다. 두 항목에 글자를 붙여도 뜻이
          생기지 않고 대시보드 장식으로만 읽힌다. 좌우를 가르는 것은
          label 과 색(파랑/금색)이면 충분하다. */}
      <Side side={side} />
    </SpotlightCard>
  );
}


function RevealedItems({
  items = [],
  step,
  reveal,
  className,
}: {
  items?: string[];
  step: number;
  reveal?: boolean;
  className: string;
}) {
  return (
    <div
      className={className}
      style={{ "--course-item-count": Math.max(items.length, 1) } as CSSProperties}
    >
      {items.map((item, i) => (
        <Step key={item} on={!reveal || step >= i} dim={reveal}>
          <div className={`${className}__item`}>
            <span className="mono">{String(i + 1).padStart(2, "0")}</span>
            <strong>{item}</strong>
          </div>
        </Step>
      ))}
    </div>
  );
}

function CourseSlide({
  spec,
  step,
}: {
  spec: CourseSlideSpec;
  step: number;
}) {
  const ambient = spec.layout === "cover" || spec.layout === "chapter";

  if (spec.layout === "cover") {
    return (
      <section className="slide course-slide course-layout--cover">
        <CourseBackground ambient />
        <div className="course-frame course-cover">
          <Reveal delay={0.05}>
            <div className="course-cover__kicker mono">{spec.eyebrow}</div>
          </Reveal>
          <Reveal delay={0.18}>
            <h1>{spec.title}</h1>
          </Reveal>
          {/* `steps` 를 준 커버만 부제가 문장 하나씩 따라온다. */}
          <Reveal delay={0.36}>
            <CopyLines spec={spec} step={step} />
          </Reveal>
        </div>
      </section>
    );
  }

  return (
    <section className={`slide course-slide course-layout--${spec.layout}`} data-course-slide={spec.id}>
      <CourseBackground ambient={ambient} />
      {/* 막 B 의 실패 해부는 레슨 이름을 제목 줄로 데려간다 — 좌상단
          고정 자리가 비면서 무대가 화면 위쪽까지 올라온다. 회상 퀴즈는
          공용 질문판이라 그 제목 줄이 없다. 좌상단을 그대로 둬야
          레슨 표기가 사라지지 않는다. */}
      <CourseChrome
        eyebrow={
          spec.act === "b" && spec.scene !== "fail-quiz"
            ? undefined
            : spec.eyebrow
        }
      />

      <div className="course-frame">
        {spec.layout === "chapter" && (
          <div className="course-chapter">
            <Reveal delay={0.05} className="course-chapter__number mono">
              {spec.metric}
            </Reveal>
            {/* `steps` 를 준 표지만 제목이 먼저 서고 부제가
                문장 하나씩 따라온다. */}
            <Reveal delay={0.18} className="course-chapter__copy">
              <h2>{spec.title}</h2>
              <CopyLines spec={spec} step={step} />
            </Reveal>
          </div>
        )}

        {spec.layout === "statement" && (
          <Reveal delay={0.08} className="course-statement" data-align={spec.align}>
            <h2>
              <AccentText
                text={spec.title}
                accent={spec.accent}
                lit={copyReveal(spec, step).lit}
              />
            </h2>
            <CopyLines spec={spec} step={step} />
          </Reveal>
        )}

        {/* 사진 한 장이 논지인 화면. 경로는 metric, 캡션은 items[0].
            이미지 원본이 작으므로(cat1.png 550×378) 프레임을 키우지 않는다 —
            늘리면 1080p 녹화에서 뭉개진다. */}
        {/* `steps` 를 준 화면만 순차로 열린다. 안 준 화면은 통째로 서는
            기존 동작 그대로다 — 사진 한 장이 논지인 화면은 이 레이아웃을
            다섯 곳에서 쓰고, 그중 하나만 이야기 순서가 있기 때문이다.

            사진은 **앵커**다. →를 눌러도 사진은 그대로 있고 그 위의 한 줄과
            오른쪽 카피만 바뀐다. left 가 물음, right 가 답이다. */}
        {spec.layout === "photo" && (
          <Reveal
            delay={0.08}
            className={
              spec.shotFull
                ? "course-photo course-photo--wide course-photo--full"
                : spec.shotWide
                  ? "course-photo course-photo--wide"
                  : "course-photo"
            }
            data-step={spec.steps === undefined ? undefined : step}
            data-camera={spec.shotCamera ? "on" : undefined}
            /* 칸 하나짜리 캡처(1.15:1)는 가로로 긴 배치가 안 맞는다.
               그 스텝에서는 글을 왼쪽으로 보내고 캡처에 세로를 다 준다. */
            data-framed={spec.shotFrames?.[step] ? "on" : undefined}
          >
            <figure
              className="course-photo__frame"
              /* 가로로 긴 캡처는 액자에 넣는 것만으로는 안 읽힌다. 띠가
                 켜지면 **그 자리를 확대한다** — 원점을 띠 중앙에 두고
                 이미지를 키우면 액자는 그대로고 안쪽만 들어간다.
                 영상(217)에서 지능 열을 2배로 파고든 것과 같은 수법이다. */
              /* 스텝별 캡처가 걸려 있으면 확대하지 않는다 — 그 칸이
                 이미 통째로 들어와 있다. */
              /* `shotZoom: false` 는 확대만 끈다 — 띠는 그대로 짚는다
                 (course-types.ts shotZoom). */
              data-zoom={
                !spec.shotFrames && !spec.shotCamera && spec.shotFull && spec.shotBands
                && spec.shotZoom !== false
                && step >= 1 && step <= spec.shotBands.length
                  ? "on"
                  : undefined
              }
              data-camera={spec.shotCamera ? "on" : undefined}
              data-framed={spec.shotFrames?.[step] ? "on" : undefined}
              style={(() => {
                if (spec.shotCamera && spec.shotBands) {
                  const focused = step >= 1 && step <= spec.shotBands.length;
                  if (!focused) {
                    return {
                      "--shot-camera-scale": "1",
                      "--shot-camera-x": "0%",
                      "--shot-camera-y": "0%",
                    } as CSSProperties;
                  }
                  const band = spec.shotBands[step - 1];
                  const scale = 1.25;
                  const centerX = ((band.left ?? 0) + (band.width ?? 100) / 2) / 100;
                  const centerY = (band.top + band.height / 2) / 100;
                  return {
                    "--shot-camera-scale": String(scale),
                    "--shot-camera-x": `${(50 - centerX * scale * 100).toFixed(2)}%`,
                    "--shot-camera-y": `${(50 - centerY * scale * 100).toFixed(2)}%`,
                  } as CSSProperties;
                }
                /* `shotFrames` 가 있으면 1~3 은 이미 잘라 둔 카드로 초점을
                   만들고 마지막 스텝은 전체 캡처로 돌아온다. 마지막의 null 을
                   "확대할 프레임이 없음"으로 읽으면 비용 카드만 2.7배로 남는다. */
                if (spec.shotFrames) return undefined;
                if (spec.shotZoom === false) return undefined;
                if (!spec.shotFull || !spec.shotBands || step < 1) return undefined;
                if (step > spec.shotBands.length) return undefined;
                const b = spec.shotBands[step - 1];

                /* 확대율은 **제일 넓은 띠**가 가로로 안 잘리는 값이다.
                   스텝마다 다른 배율을 주면 같은 캡처가 매번 다른 크기로
                   서서, 읽던 줄을 다시 찾아야 한다. 96 은 양옆 여백 몫이다. */
                const widest = Math.max(...spec.shotBands.map((x) => x.width ?? 100));
                const zoom = Math.min(2.6, 96 / widest);

                /* `transform-origin` 은 **원점을 제자리에 붙들 뿐 가운데로
                   옮겨 주지 않는다.** 띠 중앙을 그대로 원점으로 주면 왼쪽에
                   붙은 띠는 왼쪽 끝이 액자 밖으로 잘려 나간다. 그래서
                   보이는 창(폭 1/zoom)이 띠를 가운데 두도록 원점을 역산하고,
                   창이 이미지 밖으로 나가면 가장자리에 붙인다. */
                const originFor = (start: number, size: number) => {
                  if (zoom <= 1.001) return 50;
                  const center = (start + size / 2) / 100;
                  const win = 1 / zoom;
                  const left = Math.min(Math.max(center - win / 2, 0), 1 - win);
                  return (left / (1 - win)) * 100;
                };

                return {
                  "--shot-zoom": zoom.toFixed(3),
                  "--shot-x": `${originFor(b.left ?? 0, b.width ?? 100).toFixed(2)}%`,
                  "--shot-y": `${originFor(b.top, b.height).toFixed(2)}%`,
                } as CSSProperties;
              })()}
            >
              <img src={spec.shotFrames?.[step] ?? spec.metric} alt="" />

              {/* 읽는 자리를 순서대로 짚는다 (course-types.ts shotBands).
                  띠 하나가 밝게 남고 나머지 캡처는 어두워진다 — 어둡게
                  까는 것은 띠 바깥으로 퍼지는 box-shadow 한 겹이라
                  이미지 위에 다른 그림을 얹지 않는다. */}
              {spec.shotBands && !spec.shotCamera && (
                <div className="course-photo__bands" aria-hidden>
                  {spec.shotBands.map((band, i) => (
                    <span
                      key={band.note}
                      className="course-photo__band"
                      /* 마지막 띠는 그 뒤 스텝(착지)에서도 켜져 있다 —
                         같은 전체 캡처를 쓰는 화면에서는 결론을 말하는 동안
                         짚던 자리가 사라지면 안 된다. `shotFrames` 화면은
                         마지막에 세 축 전체로 복귀하므로 띠를 모두 끈다. */
                      data-on={
                        step >= 1 &&
                        !(spec.shotLandingClear && step >= spec.shotBands!.length + 1) &&
                        !(spec.shotFrames && step >= spec.shotBands!.length + 1) &&
                        Math.min(step - 1, spec.shotBands!.length - 1) === i
                      }
                      style={{
                        top: `${band.top}%`,
                        height: `${band.height}%`,
                        left: `${band.left ?? 0}%`,
                        width: `${band.width ?? 100}%`,
                      }}
                    />
                  ))}
                </div>
              )}

              {spec.left && (
                <div
                  className="course-photo__ask"
                  data-answered={spec.steps !== undefined && step >= 1}
                >
                  <span className="course-photo__ask-q">
                    <i className="mono">{spec.left.label}</i>
                    <b>{spec.left.title}</b>
                  </span>
                  {spec.right && (
                    <span className="course-photo__ask-a">
                      <i className="mono">{spec.right.label}</i>
                      <b>{spec.right.title}</b>
                    </span>
                  )}
                </div>
              )}
              {spec.items?.[0] && (
                <figcaption className="mono">{spec.items[0]}</figcaption>
              )}
            </figure>
            <div
              className="course-photo__copy"
              data-on={
                spec.steps === undefined || spec.shotBands !== undefined || step >= 2
              }
              data-landing={
                (spec.shotFrames || spec.shotCamera || spec.shotLandingClear) &&
                spec.shotBands && step >= spec.shotBands.length + 1
                  ? "on"
                  : undefined
              }
            >
              <h2>
                <AccentText text={spec.title} accent={spec.accent} />
              </h2>

              {/* 밴드 화면에서는 제목이 앵커로 서 있고 이 줄만 바뀐다.
                  부제는 마지막 스텝에서 착지로 열린다. */}
              {spec.shotBands && (
                <div
                  className="course-photo__read"
                  data-on={
                    step >= 1 &&
                    !((spec.shotFrames || spec.shotCamera || spec.shotLandingClear) &&
                      step >= spec.shotBands.length + 1)
                  }
                >
                  <span className="mono">
                    {String(Math.min(Math.max(step, 1), spec.shotBands.length)).padStart(2, "0")}
                  </span>
                  {/* 같은 인용문을 유지하는 착지 스텝에서는 진입 모션을 다시 시작하지 않는다. */}
                  <b key={spec.shotBands[Math.min(Math.max(step - 1, 0), spec.shotBands.length - 1)].note}>
                    {
                      spec.shotBands[
                        Math.min(Math.max(step - 1, 0), spec.shotBands.length - 1)
                      ].note
                    }
                  </b>
                </div>
              )}

              {spec.subtitle && (
                <p
                  data-on={
                    spec.shotBands === undefined || step >= spec.shotBands.length + 1
                  }
                >
                  {spec.subtitle}
                </p>
              )}
            </div>
          </Reveal>
        )}

        {/* 실제로 도는 화면이 논지인 자리. 도해가 못 하는 것 하나를 한다.

            비디오는 **앵커가 아니다.** 사진과 달리 대본이 흐르는 동안
            화면이 계속 바뀌므로 체감 장면 시계가 여기서는 돌지 않는다.
            그래서 오른쪽 레일이 모든 스텝에서 지금 무엇을 보라고 짚는다.
            `items[0]` 이 첫 스텝이고 마지막 스텝은 부제 착지다. 소리는 넣지
            않는다 — 나레이션과 겹친다. */}
        {spec.layout === "video" && (
          <Reveal delay={0.08} className="course-video">
            <figure className="course-video__frame">
              <video
                src={spec.video}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
              />
            </figure>
            <div className="course-video__copy">
              <h2>
                <AccentText text={spec.title} accent={spec.accent} />
              </h2>

              {/* 영상이 도는 동안 이 줄만 바뀐다. 화면을 멈춰 세우지
                  않고도 "지금 여기를 보세요"를 만들 수 있다. */}
              {spec.steps !== undefined && spec.items?.length ? (
                <div className="course-video__line">
                  <span className="mono">
                    {String(Math.min(step + 1, spec.items.length)).padStart(2, "0")}
                  </span>
                  <b key={step}>
                    {spec.items[Math.min(step, spec.items.length - 1)]}
                  </b>
                </div>
              ) : null}

              {spec.subtitle && (
                <p
                  data-on={
                    spec.steps === undefined ||
                    step >= (spec.items?.length ?? 0)
                  }
                >
                  {spec.subtitle}
                </p>
              )}
            </div>
          </Reveal>
        )}

        {/* 사람 하나가 무대에서 한 말이 논지인 화면. 사진은 metric,
            인용문은 title, 출처는 items(0 이름, 나머지 메타 줄)다.

            photo 를 쓰지 않는다. photo 는 **읽어야 하는 캡처**용이라 흰 테두리
            액자를 두르는데, 인물 사진은 원본 배경이 이미 어두워서 액자를 두르면
            덱 위에 스티커를 붙인 것처럼 뜬다. 여기서는 액자를 없애고 왼쪽 끝을
            투명으로 흘려, 인물이 덱의 어둠에서 그대로 떠오르게 한다. */}
        {/* `steps` 를 준 화면만 순서대로 열린다. 안 준 화면은 통째로 선다.

            스텝을 준 화면에서는 **자격 줄(items[1])이 먼저 크게 선다.**
            "이 말이 누구 입에서 나왔나"가 이 장의 전부인데, 그게 8pt
            메타 줄로 바닥에 깔려 있으면 아무도 안 읽는다. 크게 세웠다가
            제자리로 내려앉히면 그 줄을 한 번은 보게 된다.

            내려앉는 것은 transform 뿐이다 — 자리는 처음부터 최종
            위치에 잡혀 있어서 인용문이 열릴 때 글이 밀리지 않는다. */}
        {spec.layout === "quote" && (
          <Reveal delay={0.08} className="course-quote">
            <div
              className="course-quote__copy"
              data-step={spec.steps === undefined ? undefined : step}
            >
              <div className="course-quote__mark" aria-hidden>
                &ldquo;
              </div>
              <blockquote>
                <AccentText text={spec.title} accent={spec.accent} />
              </blockquote>
              <div className="course-quote__by">
                {spec.items?.map((line, i) =>
                  i === 0 ? (
                    <strong key={line}>{line}</strong>
                  ) : (
                    <span
                      className={
                        i === 1 ? "mono course-quote__credit" : "mono"
                      }
                      key={line}
                    >
                      {line}
                    </span>
                  ),
                )}
              </div>
            </div>
            <figure className="course-quote__portrait">
              <img src={spec.metric} alt="" />
            </figure>
          </Reveal>
        )}

        {spec.layout === "definition" && (
          <Reveal
            delay={0.08}
            className="course-definition"
            data-align={spec.align}
            data-tone={definitionTone(spec.title)}
          >
            <h2>
              <AccentText
                text={spec.title}
                accent={spec.accent}
                lit={copyReveal(spec, step).lit}
              />
            </h2>
            <div className="course-definition__rule" />
            <CopyLines spec={spec} step={step} accentInLines />
          </Reveal>
        )}

        {spec.layout === "classify" && <ClassifyShot spec={spec} step={step} />}

        {spec.layout === "fold-steps" && <FoldSteps spec={spec} step={step} />}

        {/* JAVIS bespoke scenes. 제목·자막·ID 규약은 course-types와 각
            컴포넌트 머리 주석을 따른다. */}
        {spec.layout === "javis-handoff" && (
          <Reveal delay={0.08}>
            <JavisHandoff spec={spec} step={step} />
          </Reveal>
        )}

        {spec.layout === "javis-token" && (
          <Reveal delay={0.08}>
            <JavisToken spec={spec} step={step} />
          </Reveal>
        )}

        {spec.layout === "javis-loop" && (
          <Reveal delay={0.08}>
            <JavisLoop spec={spec} step={step} />
          </Reveal>
        )}

        {spec.layout === "split" && (
          <Reveal delay={0.08} className="course-headed-layout">
            <h2>{spec.title}</h2>
            <div
              className="course-pair"
              data-focus={
                spec.steps === undefined || step >= 2
                  ? undefined
                  : step === 0
                    ? "left"
                    : "right"
              }
            >
              <div className="course-pair__panel course-pair__panel--left">
                <Side side={spec.left} />
              </div>
              <div className="course-pair__connector" aria-hidden>
                <span className="course-pair__signal" />
                <i>→</i>
              </div>
              <div className="course-pair__panel course-pair__panel--right">
                <Side side={spec.right} />
              </div>
            </div>
          </Reveal>
        )}

        {spec.layout === "comparison" && (
          <Reveal delay={0.08} className="course-headed-layout">
            <h2>{spec.title}</h2>
            {/* steps 를 준 화면만 초점이 왼쪽 → 오른쪽으로 옮겨간다.
                안 준 화면은 두 칸이 함께 서 있는 기존 동작 그대로다. */}
            {/* 왼쪽 → 오른쪽 → 둘 다. 마지막 상태는 초점을 풀어 두 칸을
                같은 무게로 세운다 — 대비가 결론인 화면에서 그 자리가
                한 비트를 더 만든다. steps 를 안 준 화면은 처음부터 둘 다다. */}
            <div
              className="course-versus"
              data-focus={
                spec.steps === undefined || step >= 2
                  ? undefined
                  : step === 0
                    ? "left"
                    : "right"
              }
            >
              <VersusSide side={spec.left} tone="left" />
              <div className="course-versus__mark" aria-label="versus">
                <ShinyText
                  text="VS"
                  speed={2.8}
                  delay={0.8}
                  yoyo
                  color="#8492ff"
                  shineColor="#ffffff"
                  className="mono"
                />
              </div>
              <VersusSide side={spec.right} tone="right" />
            </div>
          </Reveal>
        )}


        {spec.layout === "metric" && (
          <Reveal
            delay={0.08}
            className="course-metric"
            data-tone={spec.tone}
          >
            <div
              className="course-metric__value"
              style={
                { "--metric-len": (spec.metric ?? "").length } as CSSProperties
              }
            >
              {/* 금색 숫자만 결이 흐른다. 이 화면의 결론이 숫자 하나이므로
                  덱에서 유일하게 움직이는 것이 그 숫자여야 한다. */}
              {spec.tone === "gold" ? (
                <ShinyText
                  text={spec.metric ?? ""}
                  speed={3.6}
                  delay={0.7}
                  yoyo
                  color="#ffd166"
                  shineColor="#fff6dd"
                />
              ) : (
                spec.metric
              )}
            </div>
            {/* 숫자가 먼저 서고, 그다음 제목, 그다음 부제 문장이 하나씩.
                숫자 하나가 논지인 화면이라 그 숫자만 8초 세워 두는 것이
                이 레이아웃에서 가장 강한 첫 비트다. */}
            <div
              className="course-metric__copy"
              data-stepped={spec.steps !== undefined}
            >
              <h2 data-on={spec.steps === undefined || step >= 1}>{spec.title}</h2>
              <p className="course-copy-lines">
                {sentences(spec.subtitle).map((line, i) => (
                  <span
                    key={line}
                    data-on={spec.steps === undefined || step >= i + 2}
                  >
                    {line}{" "}
                  </span>
                ))}
              </p>
              {/* 남의 말을 인용한 화면은 누가 언제 한 말인지가 화면에 남아야 한다. */}
              {spec.items?.[0] && (
                <div className="course-metric__source mono">{spec.items[0]}</div>
              )}
            </div>
          </Reveal>
        )}

        {spec.layout === "warning" && (
          <Reveal
            delay={0.08}
            className={`course-warning ${spec.id === "market-warn" ? "course-warning--market" : ""}`.trim()}
          >
            <div className="course-warning__mark">!</div>
            <h2>
              <AccentText
                text={spec.title}
                accent={spec.accent}
                lit={copyReveal(spec, step).lit}
              />
            </h2>
            <CopyLines spec={spec} step={step} />
          </Reveal>
        )}

        {/* 네 항목이 처음부터 다 보이는 채로 30초를 설명하던 화면이다
            (VIDEO-PACING-GUIDELINES.md §2 "오래 머물러도 되는 근거가 아니다").
            `revealItems: true` 를 주면 말하는 항목만 열린다 — sequence ·
            flow · recap 과 같은 규약이고, 안 준 화면은 그대로 다 선다. */}
        {spec.layout === "checklist" && (
          <Reveal delay={0.08} className="course-headed-layout">
            <h2>{spec.title}</h2>
            <div className="course-checklist">
              {/* Step 으로 감싸지 않는다 — .course-checklist 의 그리드가
                  직계 자식을 잡고 있어서 한 겹이 끼면 줄이 무너진다.
                  같은 클래스를 항목 div 에 직접 얹는다. */}
              {spec.items?.map((item, i) => (
                <div
                  key={item}
                  className={spec.revealItems ? "step step--dim" : undefined}
                  data-on={!spec.revealItems || step >= i}
                >
                  <span className="mono">{String(i + 1).padStart(2, "0")}</span>
                  <strong>{item}</strong>
                </div>
              ))}
            </div>
            {/* 항목을 다 연 다음에 오는 착지 한 줄.
                대본을 들어 보면 목록형 화면은 거의 항상 "이 셋의 공통점이
                보이시나요" 로 끝나는데, 그 30초 동안 화면이 안 바뀌고 있었다.
                `steps` 를 항목 수와 같게 주면 마지막에 이 줄이 선다. */}
            {spec.subtitle && (
              <p
                className="course-checklist__landing"
                data-on={
                  spec.steps === undefined || step >= (spec.items?.length ?? 0)
                }
              >
                <AccentText text={spec.subtitle} accent={spec.accent} />
              </p>
            )}
          </Reveal>
        )}

        {/* 레슨을 여는 카드. `subtitle` 은 문장이 아니라 섹션 태그라
            (LLM · RAG) 카피 스텝을 걸 자리가 없다. 대신 `items` 에 적은
            줄이 하나씩 선다 — 이름 풀이, 이 레슨에서 볼 것 같은 짧은 말.
            안 준 카드는 제목만 뜨는 기존 동작 그대로다.

            그림 없이 글만 가운데 세우는 화면이라 **제목 안의 한 마디가
            유일한 초점이다.** accent 를 안 준 카드는 AccentText 가 원문을
            그대로 돌려주므로 기존 열한 장은 안 바뀐다. */}
        {spec.layout === "demo" && (
          <Reveal delay={0.08} className="course-demo">
            <div className="course-demo__tag mono">{spec.subtitle}</div>
            <h2>
              <AccentText text={spec.title} accent={spec.accent} />
            </h2>
            {spec.items && spec.items.length > 0 && (
              <div className="course-demo__lines">
                {spec.items.map((line, i) => (
                  <span
                    key={line}
                    data-on={spec.steps === undefined || step >= i + 1}
                  >
                    {line}
                  </span>
                ))}
              </div>
            )}
          </Reveal>
        )}

        {spec.layout === "sequence" && (
          <div className="course-headed-layout">
            <Reveal delay={0.06}>
              <h2>{spec.title}</h2>
            </Reveal>
            <RevealedItems
              items={spec.items}
              step={step}
              reveal={spec.revealItems}
              className="course-sequence"
            />
          </div>
        )}

        {spec.layout === "flow" && (
          <div className="course-headed-layout">
            <Reveal delay={0.06}>
              <h2>{spec.title}</h2>
            </Reveal>
            <div className="course-flow">
              {spec.items?.map((item, i) => (
                <div className="course-flow__group" key={item}>
                  <Step on={!spec.revealItems || step >= i} dim={spec.revealItems}>
                    <div className="course-flow__item">
                      <span className="mono">{String(i + 1).padStart(2, "0")}</span>
                      <strong>{item}</strong>
                    </div>
                  </Step>
                  {i < (spec.items?.length ?? 0) - 1 && (
                    <span className="course-flow__arrow">→</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {spec.layout === "recap" && (
          <div className="course-headed-layout">
            <Reveal delay={0.06}>
              {/* accent 가 없으면 AccentText 는 원문 그대로다 — 기존 recap 은 안 바뀐다. */}
              <h2>
                <AccentText text={spec.title} accent={spec.accent} />
              </h2>
            </Reveal>
            <RevealedItems
              items={spec.items}
              step={step}
              reveal={spec.revealItems}
              className="course-recap"
            />
          </div>
        )}

        {/* 두 칸을 같이 세워 두면 어디부터 읽어야 하는지가 없다.
            `steps: 1` 을 주면 왼쪽 → 오른쪽으로 초점이 옮겨간다.
            comparison 과 같은 규약이고, 안 준 화면은 둘이 함께 선다. */}
        {spec.layout === "case" && (
          <Reveal delay={0.08} className="course-headed-layout">
            <h2>{spec.title}</h2>
            <div
              className="course-case"
              data-focus={
                spec.steps === undefined || step >= 2
                  ? undefined
                  : step === 0
                    ? "left"
                    : "right"
              }
            >
              <Side side={spec.left} />
              <div className="course-case__operator">≠</div>
              <Side side={spec.right} />
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}

/* ── 이어 붙일 화면 묶기 ────────────────────────────────────
   `multi-1 · multi-3 · multi-n` 처럼 같은 그림에 focus 만 다른 화면이
   덱 전체에 120장 넘게 있다. 이런 화면을 매번 다시 마운트하면 배경까지
   0.5초 페이드가 다시 돌아 화면이 찢어져 보인다. 같은 묶음으로 표시해
   그림은 남기고 상태만 바꾼다 (deck-kit.tsx 의 SlideDef.group).

   기준은 하나다 — **두 화면이 같은 DOM 을 그리는가.**
   상태에 따라 다른 컴포넌트로 갈라지는 씬은 묶으면 전환 없이 툭 바뀌므로
   아래 두 목록으로 빼 둔다. 새 씬을 추가할 때 갈라지는 구조라면 여기 적는다. */

/** 씬 이름은 같은 족이지만 상태마다 다른 그림을 그리는 것들 */
const SOLO_FAMILIES = new Set([
  "system-map:topology", // network(그물) vs hierarchy(트리)
  "loop-scene:golden", // grid(격자) vs updates(타임라인)
  "loop-scene:swap", // assets(자산 셋) vs nodiff(코드 vs 결과)
  "loop-scene:org", // then(조직도) · why(표) · now(옷 갈아입기) 셋 다 다름
]);

/** 같은 족 안에서 저 혼자 다른 그림인 씬 */
const SOLO_SCENES = new Set([
  "pick-overview", // 목록형. 뒤따르는 pick-* 는 파이프라인형이다
  "single-count", // 좌우 두 판 비교. 앞뒤 single-* 는 판단 하나를 감싸는 구도다
  "single-handoff", // 상자 둘과 관. 같은 족이지만 그림이 통째로 다르다
  "camera-in",
  "camera-out",
  /* `runtime-*` 여섯은 한 족처럼 보이지만 RuntimeVisual 이 씬마다 **다른
     컴포넌트**를 돌려준다 (Chapter3Visuals). 족으로 묶으면 268 → 269 →
     270 과 274 → 275 에서 서로 다른 그림이 전환 없이 툭 갈아 끼워졌다.
     실제로 같은 DOM 을 그리는 짝은 둘뿐이라 그 둘만 남긴다 —
     retry ↔ choice (RuntimeRecoveryVisual) · spans ↔ diagnosis
     (RuntimeSpansVisual). */
  "runtime-stop",
  "runtime-budget",
  "runtime-trace",
  "plan-rebuild", // 혼자 Loop 다이어그램을 그린다
]);

/**
 * `definition` 은 두 가지 일에 쓰이고 있다 — **용어를 세우는 판**(LLM · RAG ·
 * MCP · Skill …)과 **문장을 착지시키는 판**이다. 전수로 세어 보면 38 장 중
 * 23 장이 뒤쪽이다.
 *
 * 그런데 판의 글자는 128px 한 값이었다. 용어 한 마디에는 맞는 크기지만
 * 문장에 씌우면 같은 일을 하는 `statement`(104px)보다 23% 크게 서서, 이웃한
 * 착지 장표들 사이에서 그 장만 튄다 (hype-answer · 40 llm-def-1 이
 * 각각 따로 지적된 자리다).
 *
 * 그래서 **제목이 문장이면 `statement` 와 같은 자로 잰다.** 한국어 종결어미로
 * 가른다 — 이 덱의 제목은 전부 한국어 문장이거나 명사구라 이 구분이 선다.
 * 챕터 파일을 23 곳 고치는 대신 판이 스스로 맞춘다.
 */
const SENTENCE_END = /(습니다|입니다|합니다|됩니다|니다|는다|한다|된다|이다|까|요|죠|다)[.?!]?$/;

function definitionTone(title: string): "term" | "landing" {
  const last = title.replace(/\n/g, " ").trim().split(/\s+/).pop() ?? "";
  return SENTENCE_END.test(last.replace(/[’'"”』」)]+$/, "")) ? "landing" : "term";
}

function sceneGroup(spec: CourseSlideSpec): string | undefined {
  if (spec.continuity) return `${spec.layout}:continuity:${spec.continuity.id}`;
  const scene = spec.scene;
  if (!scene || SOLO_SCENES.has(scene)) return undefined;
  // Only consecutive shots of the same extension structure retain their DOM.
  if (spec.layout === "extension-scene") return `extension-scene:${scene}`;
  if (spec.layout === "failure-scene") return `failure-scene:${scene}`;

  /* prelude-* 는 이름만 한 족이고 실제 그림은 렌즈·축·신호·토폴로지·
     통제 레일로 전부 다르다. 전부 `prelude` 로 묶으면 장을 넘겨도 바깥
     진입 모션이 돌지 않고 무대가 즉시 갈아 끼워진다. 같은 DOM 을 쓰는
     Orchestrator 두 장만 이어 붙인다. */
  if (spec.layout === "architecture-map" && scene.startsWith("prelude-")) {
    return scene.startsWith("prelude-orchestrator")
      ? "architecture-map:prelude-orchestrator"
      : undefined;
  }

  const parts = scene.split("-");
  // chapter-map 은 씬이 `테마-그림-초점` 3단이고 노드 개수를 items 에서 받는다.
  // 그림과 개수까지 같아야 이어 붙는다.
  const family =
    spec.layout === "chapter-map"
      ? `${parts[0]}-${parts[1]}-${spec.items?.length ?? 0}`
      : parts[0];

  const key = `${spec.layout}:${family}`;
  return SOLO_FAMILIES.has(key) ? undefined : key;
}

const slides: DeckModule["slides"] = COURSE_SLIDES.map((spec) => ({
  id: spec.id,
  scriptKey: spec.id,
  steps: slideSteps(spec),
  group: sceneGroup(spec),
  render: ({ step }) => <CourseSlide spec={spec} step={step} />,
}));

const CourseDeck: DeckModule = { className: "deck-course", slides };
export default CourseDeck;
