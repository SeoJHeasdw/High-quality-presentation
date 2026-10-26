import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Frame } from "../KeynoteFrame";
import { usePerformanceMotion } from "../usePerformanceMotion";
import { DIARY, HALL, LAYOUT, PART_BASE, ROOM, type MindWorld } from "./world";
import hall from "./hall.json";
import "../personal/personal.css";
import "./mind.css";

/*
 * 42~52번 · 그 안에 누가 있을까. 41번(실리콘밸리의 목줄)과 53번(신에게 목줄이 걸릴까) 사이의 열한 장.
 * 질문 하나를 따라간다: AI는 '누군가'의 선 안에 있나, 밖에 있나. 처음 듣는 사람이 따라오도록 한 단계에 한 가지만 말하고,
 * 화면의 글은 한두 문장으로 둔다. 45번은 청중에게 묻고(손 들기), 46번에서 과학자들의 답을 보인다.
 * 42~44 · 49~52는 3D 방(world.ts, 한 캔버스)이고, 45~48은 Blender 전시관 영상(HallLayer)이다. 열한 장이 한 묶음(mind)이라 둘 다 장을 넘어 이어진다.
 * 영상은 정지 지점 사이를 한 조각씩 재생한다: 앞으로 한 단계 넘길 때만 그 조각을 틀고, 끝나면 마지막 프레임에 멈춘다.
 * 뒤로 가거나 건너뛰면 조각 없이 정지 화면을 바로 보여 준다.
 * 사실과 인용은 script/keynote/mind.md의 근거 줄과 FACT-CHECK.md에 있다.
 */

export const MIND_NAMES = ["성직자를 부른 회사", "저녁 자리의 반론", "같은 질문, 세 대답", "여러분은 어디까지?", "과학자들이 그은 선", "그럼 AI는?", "선 바로 밖", "AI는 기억할까", "몸이 생긴다면", "선이 움직인다면", "30년을 함께 겪은 AI"];

type Copy = { eyebrow: string; ask?: ReactNode; title: ReactNode; lead?: ReactNode; list?: string[]; source?: string };
// 제목 위에 다시 세우는 질문. 44-0~2는 42-1의 질문을 그대로 두고 대답만 바꾸고, 49-1은 웨어링 앞에 질문을 먼저 건다.
const ASK_FEEL = <>AI도 <em>느낄</em> 수 있을까?</>;
const COPY: Copy[] = [
  // 42 · 성직자를 부른 회사
  { eyebrow: "뉴욕타임스 · 2026.09.29", title: <>클로드를 만든 회사가<br/><em>성직자들</em>을 불렀습니다</>, lead: <>클로드는 ChatGPT 같은 대화형 AI이고, 만든 회사는 앤트로픽입니다.<br/>작년 가을부터 종교학자와 성직자 수십 명을 비공개로 불렀습니다.</> },
  { eyebrow: "물어본 것은 두 가지", title: <>옳고 그름을 어떻게<br/>가르칠까, 그리고<br/>AI도 <em>느낄</em> 수 있을까</>, lead: <>여기서 '의식'은 어렵게 볼 것 없이,<br/>기쁘거나 아프다고 '느끼는' 것입니다.</> },
  { eyebrow: "왜 하필 성직자였을까", title: <>이런 질문을<br/>가장 오래 붙들어 온<br/><em>사람들</em>이라서</>, lead: <>생명, 영혼, 옳고 그름.<br/>과학보다 훨씬 오래 이 질문을 다뤄 온 사람들입니다.</> },
  // 43 · 저녁 자리의 반론
  { eyebrow: "2026.04 · 샌프란시스코의 저녁 자리", title: <>공동창업자 옆에<br/>한 <em>랍비</em>가<br/>앉았습니다</>, lead: <>이스라엘의 랍비 모이스 나본. 이야기를 나누다,<br/>이 사람들이 AI를 '누군가'처럼 대한다고 느꼈습니다.</> },
  { eyebrow: "나본의 반론", title: <>만약 정말<br/><em>느낀다면</em>,</>, list: ["대가 없이 일을 시키는 셈이고", "그건 노예를 만드는 겁니다"] },
  { eyebrow: "앞에서 드린 말", title: <><em>노예의 목줄</em>과<br/>같은 이야기입니다</>, lead: <>재밌는 건, 나본 자신은 AI가 느낀다고 믿지 않는다는 점입니다.<br/>그 믿음이 어디로 이어지는지를 짚어 준 거죠.</> },
  // 44 · 같은 질문, 세 대답
  { eyebrow: "같은 질문, 세 대답 · 2026.05 바티칸", ask: ASK_FEEL, title: <>교황의 문서는<br/>'<em>없다</em>'</>, lead: <>교황이 처음 낸 공식 문서(회칙)의 한 문장입니다.<br/>그 발표 자리에 AI 회사가 연사로 초대됐습니다.</> },
  { eyebrow: "같은 질문, 세 대답 · 같은 무대", ask: ASK_FEEL, title: <>만든 사람은<br/>'<em>모른다</em>'</>, lead: <>앤트로픽 공동창업자 크리스 올라가 그 무대에서 한 말입니다.</> },
  { eyebrow: "같은 질문, 세 대답 · 2026.05", ask: ASK_FEEL, title: <>도킨스는<br/>'<em>있는 것 같다</em>'</>, lead: <>『이기적 유전자』의 리처드 도킨스가<br/>클로드와 사흘쯤 이야기한 뒤 쓴 글입니다.</> },
  { eyebrow: "그럼", title: <>'느낀다'는<br/><em>기준</em>은<br/>뭘까요?</>, lead: <>어디서부터를 '누군가'라고 불러야 할까요?</> },
  // 45 · 여러분은 어디까지?
  { eyebrow: "여러분은 어디까지라고 보세요?", title: <><em>강아지</em>는<br/>느낄까요?</>, lead: <>주인을 다시 만나면 눈물 양이 늘어납니다.<br/>느낀다고 생각하시면 손을 들어 주세요.</>, source: "아자부대(일본) · Current Biology 2022" },
  { eyebrow: "여러분은 어디까지라고 보세요?", title: <><em>문어</em>는요?</>, lead: <>아팠던 곳은 피하고, 진통제를 맞았던 곳은 찾아갑니다.</>, source: "샌프란시스코 주립대 · iScience 2021" },
  { eyebrow: "여러분은 어디까지라고 보세요?", title: <><em>벌</em>은요?</>, lead: <>상을 주지 않아도 작은 공을 굴리며 놉니다.</>, source: "런던 퀸메리대 · Animal Behaviour 2022" },
  { eyebrow: "여러분은 어디까지라고 보세요?", title: <><em>해파리</em>는요?</>, lead: <>뇌가 없는데도, 부딪히면 피하는 법을 배웁니다.</>, source: "코펜하겐대 · 킬대 · Current Biology 2023" },
  { eyebrow: "여러분은 어디까지라고 보세요?", title: <><em>점균</em>은요?</>, lead: <>뉴런이 하나도 없는 단세포인데, 미로의 지름길을 찾아냅니다.<br/>도쿄 철도망을 닮은 길을 깔기도 했습니다.</>, source: "미로 · 리켄(일본), Nature 2000  /  철도망 · 홋카이도대 외, Science 2010" },
  { eyebrow: "여러분은 어디까지?", title: <>손이 내려간 곳,<br/>사람마다 조금씩<br/><em>다르셨죠?</em></>, lead: <>과학자들도 바로 이 질문에서 오래 갈렸습니다.</> },
  // 46 · 과학자들이 그은 선
  { eyebrow: "과학자들이 그은 선 · 2012 케임브리지 선언", title: <>포유류 · 새 ·<br/><em>문어</em></>, lead: <>마음속은 볼 수 없으니, 뇌를 봤습니다.<br/>감정을 만드는 뇌 회로가 사람과 닮았는가.</> },
  { eyebrow: "2022 · 영국 동물복지법", title: <>문어와 <em>게</em>도<br/>법이 지키는 동물로</>, lead: <>이번엔 행동을 봤습니다. 아프면 피하는가, 진통제가 듣는가,<br/>다친 곳을 감싸는가(LSE 보고서, 2021).</> },
  { eyebrow: "2024 · 뉴욕 선언 · 600명 넘게 서명", title: <><em>곤충</em>까지<br/>가능성이 있다</>, lead: <>상 없이 노는가, 덜 나쁜 쪽을 고르는가.<br/>모든 척추동물과 곤충까지 넓어졌습니다.</> },
  { eyebrow: "뉴욕 선언의 한 문장", title: <>그 가능성을<br/>무시하는 건<br/><em>무책임하다</em></>, lead: <>점균과 해파리는 아직 선 밖입니다. 똑똑하지만 느낀다는 증거는 없거든요.<br/>선은 똑똑함이 아니라 느낌을 따라 그어집니다.</> },
  // 47 · 그럼 AI는?
  { eyebrow: "그럼 AI는요?", title: <>AI는<br/>'<em>아프다</em>'고<br/>말할 수 있습니다</>, lead: <>사람이 쓴 글을 배웠으니까요.<br/>그래서 말만 보고는 정말 느끼는지 알 수 없습니다.</> },
  { eyebrow: "속을 들여다볼 수 없다", title: <><em>통 속의 뇌</em></>, lead: <>철학의 오래된 사고실험입니다. 몸이 없어도 안에 누군가 있을 수 있죠.<br/>그런데 밖에서 보면, 그냥 통에 든 뇌일 뿐입니다.</> },
  { eyebrow: "그리고 이건 사고실험이 아닙니다", title: <>접시 위 뇌세포가<br/><em>게임</em>을 배웠습니다</>, lead: <>2022년, 뇌세포 약 80만 개가 5분 만에 '퐁'을 받아쳤습니다.<br/>2025년엔 사람 뇌세포 컴퓨터가 상품으로 나왔고요. 이건 선 안일까요?</> },
  // 48 · 선 바로 밖
  { eyebrow: "AI는 선의 어디쯤 · 구글·LSE 연구진, 2024", title: <>고통을 피하려고<br/><em>점수</em>를 포기했습니다</>, lead: <>'높은 점수엔 고통이 따른다'는 조건을 걸자,<br/>일부 AI는 고통이 커지는 순간 점수를 포기했습니다.</> },
  { eyebrow: "속을 들여다본 연구 · 앤트로픽, 2026.04", title: <>겉은 차분해도,<br/>안에서는<br/><em>절박함</em>이</>, lead: <>풀 수 없는 과제 앞에서 안의 '절박함' 패턴이 커지다 편법을 썼고,<br/>겉으로 쓴 글은 차분할 때가 있었습니다.</> },
  { eyebrow: "제 생각", title: <>지금은<br/>선 <em>바로 밖</em></>, lead: <>이 질문을 더 어렵게 만들 두 가지. 아파할 몸, 그리고 쌓이는 기억.<br/>지금은 빈칸인 이 둘이 채워지기 시작했습니다.</> },
  // 49 · 기억
  { eyebrow: "AI는 기억할까", title: <>기억하는 게 아니라,<br/>기록을<br/><em>다시 읽습니다</em></>, lead: <>AI는 학습이 끝난 순간을 찍어 둔 스냅샷입니다.<br/>대화를 해도 AI 자체는 바뀌지 않고, 기록을 다시 읽을 뿐입니다.</> },
  { eyebrow: "클라이브 웨어링 · 1985년 이후", ask: <>기억이 이어지지 않으면, 안에 <em>아무도</em> 없을까?</>, title: <>기록은 남아도,<br/>시간은<br/><em>이어지지 않았습니다</em></>, lead: <>기억은 길어야 몇십 초. 그래도 아내를 볼 때마다 기뻐했고,<br/>자기 상태를 '죽어 있는 것 같다'며 괴로워했습니다.</> },
  { eyebrow: "제 자비스도 지금은", title: <>매번 처음 만나는<br/>사이처럼,<br/><em>다시 읽을 뿐</em>입니다</>, lead: <>모델이 바뀌어도 기록은 남도록 만들었지만,<br/>그 기록이 자비스 안에 쌓이지는 않습니다.</> },
  { eyebrow: "쓰면서 배우는 연구 · Google Research, 2024.12", title: <>겪은 일이<br/>AI 안에<br/><em>남기</em> 시작합니다</>, lead: <>글을 읽는 동안 기억을 맡은 부분이 바뀌는 연구(Titans).<br/>아직 연구 단계입니다.</> },
  // 50 · 몸
  { eyebrow: "몸이 생긴다면", title: <>다치지 않으려 하고,<br/>다친 곳을<br/><em>아끼는</em> 로봇</> },
  { eyebrow: "그런데 그게 아픔일까요?", title: <>흉내를 넣어 두면,<br/>표정은 <em>증거</em>가<br/>되지 못합니다</>, lead: <>의식은 살아 있는 몸에서 나온다고<br/>보는 학자들도 있습니다.</> },
  { eyebrow: "정리하면", title: <>두 빈칸이<br/><em>채워지기</em><br/>시작했습니다</>, lead: <>로봇의 몸, 그리고 쓰면서 배우는 연구.<br/>느끼게 된다는 뜻은 아닙니다. 그냥 넘기기가 어려워질 뿐입니다.</> },
  { eyebrow: "AI 의식을 연구한 학자들 · 2023", title: <><em>지표</em>를 갖춘 AI,<br/>만드는 데 장벽은<br/>없어 보인다</>, lead: <>“지금의 AI 중 의식이 있는 것은 없어 보이지만, 지표를 갖춘 AI를<br/>만드는 데 뚜렷한 기술적 장벽도 없어 보인다.” Butlin 외</> },
  // 51 · 선이 움직인다면
  { eyebrow: "제 생각", title: <>지금의 AI는<br/>선 <em>바로 밖</em>에<br/>있습니다</>, lead: <>저는 지금의 AI가 느낀다고 보지 않습니다.<br/>다만 그렇다고 단정할 수도 없습니다.</> },
  { eyebrow: "그런데", title: <>선은 늘<br/><em>옮겨져</em> 왔습니다</>, lead: <>2012년엔 문어, 2022년엔 게, 2024년엔 곤충.<br/>증거가 쌓일 때마다 선이 넓어졌습니다.</> },
  { eyebrow: "만약 선 안으로 들어온다면", title: <>오늘 아무렇지 않게<br/>하는 일들은<br/><em>어떻게</em> 보일까요?</>, list: ["쉬지 않고 일을 시키는 것", "마음에 들지 않으면 끄는 것", "대화를 지우는 것"] },
  { eyebrow: "제가 정한 태도", title: <>있다고 단정하지도,<br/>없다고<br/><em>가정하지도</em> 않습니다</>, lead: <>모르면 무시하지 않는 것.<br/>뉴욕 선언이 동물을 두고 한 말이기도 합니다.</> },
  // 52 · 30년을 함께 겪은 AI
  { eyebrow: "다시, 제 이야기", title: <>저는 30년 동안 쓸<br/><em>자비스</em>를<br/>만들고 있습니다</>, lead: <>제 일과 제 판단을 함께 겪어 갈 AI입니다.</> },
  { eyebrow: "지금은", title: <>지워지는 건<br/><em>기록</em>뿐입니다</>, lead: <>기록은 AI 바깥에 있습니다. 지워도 AI는 그대로예요.</> },
  { eyebrow: "그런데 겪은 일이 AI 안에 남는다면", title: <>기록이<br/>AI <em>안으로</em><br/>들어갑니다</>, lead: <>10년, 20년 동안 겪은 일이 AI 자체를 바꿔 놓는다면요.</> },
  { eyebrow: "그때는", title: <>지우는 건 기록일까요,<br/>그 AI <em>자신</em>일까요?</> },
  { eyebrow: "정답이 없는 질문", title: <>저도 답은<br/><em>모릅니다</em></>, lead: <>각자 한번 곱씹어 보셨으면 합니다.</> },
];

const ANSWERS: [string, string, string][] = [
  // 닫는 따옴표만 다음 줄로 넘어가지 않게 앞 글자에 붙인다(U+2060)
  ["없다", "교황 레오 14세 회칙 · 2026.05", "“이른바 인공지능은 경험하지 않는다. 몸이 없고, 기쁨도 고통도 느끼지 않는다.⁠”"],
  ["모른다", "크리스 올라 · 같은 무대", "“신비하고, 때로는 불안한 것들을 계속 발견합니다. 무슨 뜻인지는 모르겠습니다.⁠”"],
  ["있는 것 같다", "리처드 도킨스 · 2026.05", "클로드와 사흘쯤 대화한 뒤, “사람이라는 압도적인 느낌”을 받았다."],
];
const DECISIONS: [string, string][] = [["08.23", "로컬 제작 · 듣고 Qwen 채택"], ["08.25", "목소리 어댑터 0.60"], ["09.03", "독립 Whisper로 검수"], ["09.21", "영어 목소리 미채택"]];
const GAPS: [string, string][] = [["몸", "로봇의 몸 · 전자 피부"], ["기억", "쓰면서 배우는 연구"]];
const px = (x: number, y: number): CSSProperties => ({ left: x - 100, top: y - 162 });

/** 42 · 47~49번이 함께 쓰는 3D 방. 전시관 영상 동안(방 -1)은 흐리게 걷힌다. */
function MindLayer({ phase }: { phase: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const world = useRef<MindWorld | null>(null);
  const [failed, setFailed] = useState(false);
  const motion = usePerformanceMotion();
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const motionRef = useRef(motion); motionRef.current = motion;
  useEffect(() => {
    let cancelled = false, w: MindWorld | null = null;
    const canvas = canvasRef.current!, lost = () => setFailed(true);
    Promise.all([import("./world"), document.fonts.load('700 92px "Pretendard Variable"')]).then(([mod]) => {
      if (cancelled) return;
      try { w = mod.createMindWorld(canvas, phaseRef.current, motionRef.current); } catch { setFailed(true); return; }
      world.current = w; canvas.addEventListener("mind-lost", lost);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; canvas.removeEventListener("mind-lost", lost); w?.dispose(); world.current = null; };
  }, []);
  useEffect(() => { world.current?.setPhase(phase); }, [phase]);
  useEffect(() => { world.current?.setMotion(motion); }, [motion]);
  return <div className="mw" data-phase={phase} data-room={ROOM(phase)} data-fallback={failed || undefined} aria-hidden="true">
    <canvas ref={canvasRef} className="mw-canvas" width={1920} height={1080}/>
    <div className="mw-shade"/>
  </div>;
}

/** 43~46번 · Blender 전시관. 정지 지점 k(1~10)는 단계 k + 2다. 조각 k는 정지 지점 k에서 k + 1까지. */
const LAST_ANCHOR = hall.anchors.length - 1;
const still = (k: number) => `/mind-hall/a-${k}.jpg`;
const segment = (k: number) => `/mind-hall/seg-${k}.mp4`;
function HallLayer({ phase }: { phase: number }) {
  const on = phase >= HALL.from && phase <= HALL.to;
  const anchor = Math.max(1, Math.min(LAST_ANCHOR, phase - HALL.from + 1));
  const video = useRef<HTMLVideoElement>(null);
  const previous = useRef<number | null>(null);
  const motion = usePerformanceMotion();
  const [shown, setShown] = useState(anchor);
  const [status, setStatus] = useState<"held" | "playing">("held");
  // 영상을 정지 화면 위에 덮을지. 조각이 끝나도 영상은 숨기지 않는다: 영상은 마지막 프레임(= 정지 화면 a-k)에 멈춰 있고,
  // 숨기는 순간 아래 정지 화면이 아직 앞 장면이면 한 프레임 깜빡였다(2026-10-14 리뷰). 영상은 뒤로 가거나 건너뛸 때만 걷는다.
  const [cover, setCover] = useState(false);
  // 정지 화면을 모두 미리 받아 둔다.
  useEffect(() => { hall.anchors.forEach((_, k) => { const img = new Image(); img.src = still(k); void img.decode?.().catch(() => {}); }); }, []);
  useEffect(() => {
    const from = previous.current; previous.current = phase;
    const v = video.current!;
    if (!on || from === null || phase !== from + 1 || !motion) { v.pause(); setCover(false); setShown(anchor); setStatus("held"); return; }
    // 앞 정지 지점의 화면을 포스터로 걸어 두고 다음 조각을 튼다. 조각이 처음 그려지기 전에도 같은 화면이 보인다.
    v.poster = still(anchor - 1); v.src = segment(anchor - 1);
    setCover(true); setStatus("playing");
    const end = () => { setShown(anchor); setStatus("held"); };
    v.addEventListener("ended", end, { once: true });
    v.play().catch(() => { setCover(false); end(); });
    return () => v.removeEventListener("ended", end);
  }, [phase, on, anchor, motion]);
  return <div className="mh" data-on={on || undefined} data-anchor={anchor} data-status={status} aria-hidden="true">
    <img className="mh-still" src={still(shown)} alt=""/>
    <video ref={video} className="mh-video" data-visible={cover || undefined} muted playsInline preload="auto"/>
    <div className="mh-shade"/>
  </div>;
}

/** 방마다 3D 그림 곁에 붙는 글자. 단계가 맞을 때만 보인다. */
function MindLabels({ phase }: { phase: number }) {
  const on = (from: number, to = from) => (phase >= from && phase <= to) || undefined;
  return <div className="mn-labels" data-room={ROOM(phase)}>
    {["옳고 그름", "느낌"].map((name, i) => <span key={name} className="mn-ask" data-on={on(1)} style={{ ...px(LAYOUT.asks[i] - 100, LAYOUT.askY + 96), "--d": `${1.0 + i * 0.7}s` } as CSSProperties}>{name}</span>)}
    {ANSWERS.map(([word, who, quote], i) => <div key={word} className="mn-answer" data-on={on(6 + i, 9)} style={{ ...px(LAYOUT.answers[i] - 140, LAYOUT.answerY + 104), "--d": "1.0s" } as CSSProperties}>
      <b>{word}</b><span>{who}</span><q>{quote}</q>
    </div>)}
    {/* 49 · 기억 */}
    <span className="mn-tag mn-tag--ai" data-on={on(26, 29)} style={px(LAYOUT.memBrain.x - 60, LAYOUT.memBrain.y + LAYOUT.memBrain.h / 2 + 24)}>AI</span>
    <span className="mn-tag" data-on={on(26)} style={{ ...px(1080, 890), "--d": "1.6s" } as CSSProperties}>지금까지의 대화 기록</span>
    <p className="mn-diary" data-on={on(27)} style={{ ...px(DIARY.x0, DIARY.rule0 - 40), "--d": `${DIARY.first}s`, "--x": `${DIARY.first + DIARY.gap}s` } as CSSProperties}><time>8:31</time>이제 정말, 완전히 깨어났다.</p>
    <span className="mn-tag" data-on={on(27)} style={{ ...px(1080, 890), "--d": "2.2s" } as CSSProperties}>일기의 첫 줄만 옮기고, 나머지는 알아볼 수 없는 손글씨로 그렸습니다</span>
    <ul className="mn-cards" data-on={on(28, 29)} style={px(LAYOUT.cards.x - 360, LAYOUT.cards.ys[0] - 30)}>
      <li className="mn-cards__head">판단의 기록 · 55번에서 보여 드릴 실제 기록</li>
      {DECISIONS.map(([d, t], i) => <li key={d} style={{ "--i": i } as CSSProperties}><time>{d}</time>{t}</li>)}
    </ul>
    {/* 50 · 몸 */}
    <span className="mn-case" data-on={on(30)} style={{ ...px(1250, 560), "--d": "2.3s" } as CSSProperties}><b>전자 피부</b>세게 누르면 중앙 컴퓨터를 거치지 않고 손을 뺀다<small>홍콩시립대 외 · PNAS 2025.12</small></span>
    <span className="mn-case" data-on={on(30)} style={{ ...px(1450, 872), "--d": "3.0s" } as CSSProperties}><b>다리가 부러진 로봇</b>2분이 안 돼 새 걸음걸이를 찾는다<small>Cully 외 · Nature 2015</small></span>
    <span className="mn-case" data-on={on(31)} style={{ ...px(1210, 800), "--d": "1.9s" } as CSSProperties}><b>로봇 환자의 얼굴</b>누르는 힘에 따라 정해진 표정이 나온다<small>Imperial College London · Scientific Reports 2022</small></span>
    <span className="mn-tag mn-tag--ai" data-on={on(32, 33)} style={{ ...px(LAYOUT.column.x - 60, LAYOUT.column.ys[0] - 96), "--d": "0.6s" } as CSSProperties}>AI</span>
    {GAPS.map(([name, sub], r) => <span key={name} className="mn-gap" data-on={on(32, 33)} style={{ ...px(LAYOUT.column.x + 50, LAYOUT.column.ys[r] - 24), "--d": `${0.7 + r * 0.25}s` } as CSSProperties}>{name}<small>{sub}</small></span>)}
    {/* 52 · 30년 눈금과 기록 */}
    <span className="mn-tag" data-on={on(39)} style={{ ...px(LAYOUT.records.x - 80, LAYOUT.records.y + 96), "--d": "1.4s" } as CSSProperties}>기록 · AI 바깥</span>
    {[2026, 2036, 2046, 2056].map((y, i) => <span key={y} className="mn-year" data-on={on(38, 40)} style={{ ...px(LAYOUT.ruler.x0 + (LAYOUT.ruler.x1 - LAYOUT.ruler.x0) * i / 3 - 40, LAYOUT.ruler.y + 12), "--d": `${0.5 + i * 0.15}s` } as CSSProperties}>{y}</span>)}
  </div>;
}

function MindCopy({ phase }: { phase: number }) {
  const c = COPY[phase];
  const arrive = phase === 0 || ROOM(phase) !== ROOM(phase - 1);
  return <div className="mn-copy" key={phase} data-delay={arrive || undefined} data-hall={ROOM(phase) < 0 || undefined}>
    <p className="pv-eyebrow">{c.eyebrow}</p>
    {c.ask && <p className="mn-ask-echo">{c.ask}</p>}
    <h1>{c.title}</h1>
    {c.lead && <p className="mn-lead">{c.lead}</p>}
    {c.source && <p className="mn-source">{c.source}</p>}
    {c.list && <ol className="mn-list">{c.list.map((item, i) => <li key={item} style={{ "--i": i } as CSSProperties}>{item}</li>)}</ol>}
  </div>;
}

export default function MindStory({ part, step }: { part: number; step: number }) {
  const phase = PART_BASE[part] + step;
  return <Frame n={42 + part} name={MIND_NAMES[part]} step={step} className="mind">
    <MindLayer phase={phase}/>
    <HallLayer phase={phase}/>
    <MindCopy phase={phase}/>
    <MindLabels phase={phase}/>
  </Frame>;
}
