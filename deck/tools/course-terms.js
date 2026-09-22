/**
 * 강의 덱의 용어 규칙. lint-course.mjs 가 이 파일만 읽는다.
 *
 * ── 이 덱이 쓰는 한 줄 규칙 ────────────────────────────────
 * **이름표는 영어, 문장은 한글. 판정 기준은 대본이다.**
 *
 * 다이어그램 배지·eyebrow·비교 레이아웃의 label 은 "이름표 자리"다.
 * 벤더 화면에서 그대로 만날 말이므로 영어로 둔다.
 * 제목·부제·항목은 "문장 자리"다. 한국어 문법으로 읽히면 한글이 맞다.
 *
 * 예외는 하나뿐이다 — 그 화면이 **그 단어를 가르치는 화면**일 때.
 * (`Span은 Run 안의 한 단계를 보여줍니다` 처럼)
 *
 * 그래서 린터는 자동으로 못 고친다. 후보를 띄우고 사람이 판정한다.
 * 판정이 끝난 예외는 ALLOW 에 적어 두면 다시 안 뜬다.
 */

/** 문장 자리에서도 영어가 맞는 말. 이 덱이 가르치는 용어들이다. */
export const ALWAYS_EN = [
  "Agent", "Loop", "Context", "Runtime", "Trace", "Span", "Run",
  "Memory", "State", "Schema", "Registry", "Checkpoint", "Goal",
  "Observation", "Instructions", "Skill", "Prompt", "Budget",
  "Sub-Agent", "Multi-Agent", "Single Agent", "Tool Calling",
  "Guardrail", "Authentication", "Authorization", "Permission", "Harness",
  "Handoff", "Workflow", "Task", "Eval", "HITL",
];

/**
 * 같은 개념의 영어/한글 짝.
 *
 * 한 화면에서 장표는 en, 대본은 ko 를 쓰고 있으면 후보로 띄운다.
 * 귀로 "구조"를 듣는데 눈으로 Architecture 를 읽는 자리가 이렇게 잡힌다.
 * ch02 에서 나온 27 곳이 전부 이 검사에 걸렸다.
 */
export const PAIRS = [
  { en: "Architecture", ko: "구조" },
  { en: "Policy", ko: "정책" },
  { en: "Model", ko: "모델" },
  { en: "Tool", ko: "도구" },
  { en: "Eval", ko: "평가" },
  { en: "Task", ko: "작업" },
  { en: "Permission", ko: "권한" },
  { en: "Retry", ko: "재시도" },
  { en: "Escalate", ko: "이관" },
  { en: "Recovery", ko: "복구" },
  { en: "Classify", ko: "분류" },
  { en: "Identity", ko: "신원" },
  { en: "Gateway", ko: "게이트웨이" },
  { en: "Channel", ko: "채널" },
  { en: "Worker", ko: "작업자" },
  { en: "Parent", ko: "상위" },
];

/**
 * 같은 단어의 두 표기. 하나로 통일해야 한다 — 이건 판정이 필요 없다.
 *
 * `[정답, 나오면 안 되는 표기...]` 순서다.
 */
export const SPELLINGS = [
  ["Checkpoint", "체크포인트"],
  ["Registry", "레지스트리"],
  ["Runtime", "런타임"],
  ["Guardrail", "가드레일"],
  ["Context", "컨텍스트"],
  ["refund_order", "refund_create"],
];

/**
 * 장표에 나오는데 그 챕터 대본에는 한 번도 안 나오는 이름을 잡는다.
 *
 * ch02 의 `Worker` 가 이 경우였다 — 제목은 Sub-Agent, 부제는 Worker 인데
 * 대본에는 Worker 가 아예 없었다. 같은 걸 세 이름으로 부르고 있었다.
 *
 * 여기 적힌 건 대본에 없어도 정상인 것들이다 (고유명사·코드·캡션).
 */
export const SCRIPT_EXEMPT = [
  "OpenAI", "Anthropic", "IBM", "Meta", "Google", "Amazon", "Microsoft",
  "ChatGPT", "Claude", "Grok", "Gemini", "Copilot", "Cursor",
  "MCP", "API", "HTTP", "SaaS", "FAQ", "ACP", "RAG", "LLM", "UI", "ID",
  "AI", "Engineer", "Code", "Summit", "YC", "Startup", "School",
  "PASS", "VALID", "REQUIRED", "ERROR", "OK", "RUN", "WAIT", "DONE",
  "LIMIT", "HIT", "PERMISSION", "ESCALATE", "DIAGNOSIS", "SPAN",
  // 벤더가 붙인 패턴 이름. 대본은 풀어 쓴 형태로 부르기도 한다
  // (장표 "Parallel" ↔ 대본 "Parallelization")
  "Agentic", "Parallel", "Parallelization", "Routing", "Orchestrator",
  "Evaluator", "Optimizer", "Critic", "Retrieval", "Chaining",
];

/**
 * 판정이 끝난 예외. `"화면ID · 단어"` 로 적는다.
 *
 * 여기 들어온 건 "확인했고 이대로가 맞다"는 뜻이다.
 * 왜 맞는지 한 줄 남겨 두면 다음 사람이 다시 안 뒤진다.
 */
export const ALLOW = [
  "permission-scope · Permission",   // 대본이 "Permission 은 스위치가 아니다"로 시작해 한글로 받는다. 가르치는 짝
  "stack-open · Architecture",       // 부제가 "Architecture Stack" — 섹션 태그(이름표) 자리
  "reference-open · Architecture",   // 부제가 "Reference Architecture" — 같은 이유
  "frame-cover · Architecture",      // 커버 부제의 섹션 나열
  "trace-observability-risk · Tool", // "Prompt, Tool 인자, 결과" — 셋 다 기록 필드 이름
  "subagent-warn · Parent",          // 대본이 "Parent Agent가 결과를 검증하고"로 같이 쓴다
  "planning-parallel · Task",        // 그림의 TASK 01~04 배지를 가리키는 말
  "foundation-runtime · Tool",       // "Instructions, State, 허용 Tool, 직전 결과" — 영어 용어 나열이라 하나만 한글이면 깨진다
  "toolcall-flow · Tool",            // 4단계 흐름 라벨. 같은 줄의 Runtime 도 영어다
  "reference-tools · Tool",          // "Tool은 Registry를 통해" — Tool 을 주어로 쓰는 정의성 제목
  "reference-control · Policy",      // 챕터 닫는 요약. Policy·Trace·Runtime 셋 다 앞에서 정의된 짝이다

  // ── CH01 (2026-08-24 판정) ──
  "llm-def-pretrain · Pre",          // 부제의 "Pre-training". 대본이 "영어로는 pre-training이고요"로 읽는다 — 소문자라 못 잡은 것뿐
  "llm-compress · The",              // items 의 출처 줄 "Meta — The Llama 3 Herd of Models". 논문 제목이라 낭독 대상이 아니다
  "llm-compress · Herd",             // 같은 출처 줄
  "llm-compress · Models",           // 같은 출처 줄
  "rag-open · Retrieval-Augmented",  // items 가 "Retrieval-Augmented Generation · 검색으로 보강한 생성". 대본은 한글 쪽("검색으로 보강한 생성")을 읽는다

  // ── CH03 벤더 3편 (2026-09-03 판정) ──
  // 화면이 규격의 진짜 이름을 들고, 낭독은 그게 무엇을 하는지 한글로 받는다.
  // 규격 자체는 4장이 다루므로 여기서 이름을 외우게 하지 않는 게 맞다.
  "ibm-pipeline-overview · Card",          // 화면의 `agent-card.json`. 대본은 "주소 하나에 이런 문서를 걸어 둡니다"
  "ibm-pipeline-overview · SendMessage",   // 화면의 호출 이름. 대본은 "공개된 메시지 한 통"
  "ibm-pipeline-overview · TaskState",     // 화면의 상태 이름표. 대본은 상태 여덟 개를 한글로 읽는다
  // Meta 사례의 역할 이름은 그 회사 내부 명칭이지 업계 용어가 아니다.
  // 개수까지 한글로 읽고("탐색이 둘, 모듈 분석이 열하나…") 이름표는 화면에 둔다.
  "meta-metric · Explorer",
  "meta-metric · Analyst",
  "meta-metric · Writer",
  "meta-metric · Fixer",
];

/** 나레이션 분당 글자수. NARRATION-PIPELINE.md 의 표와 같은 기준을 쓴다. */
export const CHARS_PER_MIN = 330;

/* ── 체류 시간 (VIDEO-PACING-GUIDELINES.md) ──────────────────
   영상에서 한 시각 상태가 얼마나 오래 정지해 있는지를 재는 규칙이다.
   CHARS_PER_MIN(330)은 "레슨이 몇 분짜리인가"를 어림하는 값이고,
   여기 쓰는 값은 **실제로 나온 음성 클립을 재서 낸 것**이다. */

/**
 * 공백을 뺀 한글 대본 한 글자가 몇 초로 읽히는가.
 *
 * render/narration/ch01-intro 파일럿 7클립 실측 — 1,047자 / 173.4초.
 * 시스템 TTS(Yuna, rate 180) 기준이고 클립별 5.78~6.28자/초로 모였다.
 * **목소리나 속도를 바꾸면 이 값을 다시 재야 한다.**
 */
export const CHARS_PER_SEC = 6.04;

/** VIDEO-PACING-GUIDELINES.md §7 의 절대 임계값. */
export const DWELL = { warn: 15, bad: 20, fail: 30 };

/**
 * 같은 12초라도 화면이 받는 무게는 다르다.
 *
 * - text: 문장·라벨 하나가 추가된 뒤 바로 정지
 * - focus: 같은 그림 안에서 말하는 곳이 앞으로 나오거나 강조가 이동
 * - meaning: 구조·관계·결과 자체가 새로 생김
 *
 * 진입 애니메이션이 1초 만에 끝난 뒤 멈추면, 남은 시간은 완성 상태의
 * 강도로 잰다. 반복 글로우나 호흡 효과는 체류 한도를 늘려 주지 않는다.
 */
export const TIER_DWELL = { text: 10, focus: 12, meaning: 15 };

/**
 * 레이아웃 이름만으로는 스텝의 실제 변화 강도를 모르는 장면들.
 * 배열 인덱스가 대본의 `###` 번호다. 새 장면을 넣을 때는 화면을 실제로
 * 넘겨 본 뒤 적는다 — 컴포넌트가 무엇을 그릴 예정인지는 판정 근거가 아니다.
 */
export const BEAT_TIER_OVERRIDES = {
  // FailureVisuals: reviewed renders. Text/focus remain distinct from actual state and path changes.
  "failure-scene:fail-cover": ["text"],
  "failure-scene:fail-closing": ["text"],
  "failure-scene:fail-landing": ["text"],
  "failure-scene:fail-identity": ["text"],
  "failure-scene:fail-conversation": ["text"],
  "failure-scene:fail-incident": ["meaning", "meaning", "focus"],
  "failure-scene:fail-brief": ["meaning", "focus"],
  "failure-scene:fail-contract": ["meaning", "focus"],
  "failure-scene:fail-rewrite": ["focus", "focus", "text"],
  "failure-scene:fail-scope": ["meaning", "meaning", "text"],
  "failure-scene:fail-org": ["meaning", "focus"],
  "failure-scene:fail-routing": ["meaning", "focus"],
  "failure-scene:fail-compression": ["meaning", "focus"],
  "failure-scene:fail-dependency": ["meaning", "focus"],
  "failure-scene:fail-journey": ["meaning", "focus"],
  "failure-scene:fail-permission": ["meaning", "focus", "text"],
  "failure-scene:fail-runs": ["meaning", "meaning", "text"],
  "failure-scene:fail-context": ["meaning", "focus"],
  "failure-scene:fail-regression": ["meaning", "focus"],
  "failure-scene:fail-trace": ["meaning", "focus"],
  "failure-scene:fail-bars": ["meaning", "focus"],
  "failure-scene:fail-toolrack": ["meaning", "focus"],
  "failure-scene:fail-receipt": ["meaning", "focus"],
  "failure-scene:fail-timeline": ["meaning", "focus"],
  "failure-scene:fail-checkpoint": ["meaning", "meaning", "meaning"],
  "failure-scene:fail-approval": ["meaning", "focus"],
  "failure-scene:fail-queue": ["meaning", "focus", "meaning"],
  "failure-scene:fail-plan": ["meaning", "meaning", "meaning"],
  "failure-scene:fail-loop": ["meaning", "focus", "meaning"],
  "failure-scene:fail-exits": ["meaning", "focus"],
  "failure-scene:fail-merge": ["meaning", "meaning", "focus"],
  "failure-scene:fail-xray": ["meaning", "focus"],
  "failure-scene:fail-autonomy": ["meaning", "focus"],
  "failure-scene:fail-ruler": ["meaning", "focus", "text"],
  "failure-scene:fail-dataset": ["meaning", "focus", "focus"],
  "failure-scene:fail-evalrow": ["meaning", "focus"],
  "failure-scene:fail-owners": ["meaning", "focus"],
  "failure-scene:fail-grading": ["meaning", "focus"],
  "failure-scene:fail-evalscope": ["meaning", "focus"],
  "failure-scene:fail-component": ["meaning", "meaning", "text"],
  "failure-scene:fail-cycle": ["meaning", "focus"],
  "failure-scene:fail-redaction": ["meaning", "meaning", "text"],
  "failure-scene:fail-versions": ["meaning", "meaning", "text"],
  "failure-scene:fail-calendar": ["meaning", "focus"],
  "failure-scene:fail-quiz": ["meaning", "focus", "text"],
  // Ch05 field case: rendered artifact/platform layers, transferred assumptions,
  // shared failure propagation, changed policy and its operating owner.
  "failure-scene:fail-asset": ["meaning", "meaning", "focus"],
  "failure-scene:fail-transfer": ["meaning", "meaning", "focus"],
  "failure-scene:fail-runtime": ["meaning", "meaning", "focus"],
  "failure-scene:fail-workchange": ["meaning", "focus", "focus"],
  "failure-scene:fail-catalog": ["meaning", "focus", "focus"],
  // ExtensionVisuals rendered states: paperwork/focus stays distinct from topology changes.
  "extension-scene:ext-spotlight": ["text"],
  "extension-scene:ext-names": ["text"],
  "extension-scene:ext-document": ["meaning", "focus"],
  "extension-scene:ext-ledger": ["meaning", "focus"],
  "extension-scene:ext-ticket": ["meaning", "text"],
  "extension-scene:ext-compare": ["focus"],
  "extension-scene:ext-map": ["meaning", "focus"],
  "extension-scene:ext-bundle": ["meaning", "focus"],
  "extension-scene:ext-route": ["meaning", "focus"],
  "extension-scene:ext-gate": ["meaning", "text"],
  "extension-scene:ext-distribution": ["meaning", "meaning", "text"],
  "extension-scene:ext-network": ["meaning", "focus", "meaning"],
  "extension-scene:ext-protocol": ["meaning", "focus", "text"],
  "extension-scene:ext-exchange": ["meaning", "focus", "text"],
  "extension-scene:ext-task": ["meaning", "focus"],
  "extension-scene:ext-layers": ["meaning", "focus"],
  "extension-scene:ext-risk": ["meaning", "focus"],
  "extension-scene:ext-roadmap": ["meaning", "focus"],
  "extension-scene:ext-quiz": ["meaning", "focus", "text"],
  "classify:classify-now": ["focus", "meaning", "focus"],
  "promptify:half": ["meaning", "meaning", "focus", "focus", "text", "focus"],
  "llm-scene:rlhf-habit": ["meaning", "meaning", "focus", "meaning"],
  "llm-scene:rlhf-pick": ["meaning", "focus", "focus"],
  "llm-scene:rerun-twice": ["meaning", "meaning", "focus"],
  "llm-scene:pretrain-loop": ["meaning", "meaning", "meaning", "meaning"],
  "llm-scene:compress-ratio": ["meaning", "meaning", "meaning", "focus"],
  "llm-scene:shutter-freeze": ["meaning", "meaning", "meaning"],
  "llm-scene:carry-cost": ["meaning", "focus"],
  "llm-scene:carry-cache": ["meaning", "meaning", "focus", "meaning", "text"],
  "llm-scene:carry-expire": ["focus", "meaning", "meaning", "focus"],
  "cutoff:cutoff-cover": ["meaning", "focus", "meaning", "focus", "meaning", "focus"],
  "cutoff:cutoff-bigger": ["meaning", "meaning", "focus", "meaning"],
  "workflow-vs-agent:wfa-fixed-llm": ["meaning", "meaning", "focus", "focus", "meaning", "meaning"],
  // 자격 줄이 크게 서고 → 제자리로 내려앉으며 이름이 붙고 → 인용문이 열린다.
  "quote:": ["meaning", "focus", "meaning"],
};

/**
 * 스텝마다 **다른 상태를 실제로 그리는** 레이아웃.
 *
 * 여기 없는 레이아웃은 대본을 `### 0 · ### 1` 로 아무리 쪼개도 화면이
 * 그대로다 — 렌더러가 step 을 넘기지 않거나 컴포넌트가 안 쓴다.
 * 그래서 이 목록 밖의 화면은 대본 스텝을 합쳐 한 상태로 잰다.
 * (판정 근거는 production/CourseDeck.tsx 의 레이아웃 분기다.)
 */
export const STEP_AWARE_LAYOUTS = new Set([
  "cold-open", "agent-anatomy", "handoff", "screen-count", "promptify", "stage-lanes",
  "fold-steps", "classify", "path-close",
  "token-pick", "cutoff", "rag-pipeline", "workflow-vs-agent", "ops-table",
  "inside-gap", "agent-scope", "chapter-arc", "course-map",
  "system-map", "loop-scene", "llm-scene", "manual-queue", "diagram",
  "shape-vs-loop", "chapter-map", "vendor-film", "extension-scene", "failure-scene",
  "javis-handoff", "javis-token", "javis-loop",
]);

/**
 * 스텝이 **부제 문장**을 여는 레이아웃 (copy-steps.tsx 의 `copyReveal`).
 *
 *   step 0  제목만 · step 1 accent 점등 + 첫 문장 · step 2~ 다음 문장
 *
 * 그래서 여기 있는 레이아웃의 `steps` 는 부제 문장 수와 정확히 같아야 한다.
 * 적으면 마지막 문장이 영영 안 열리고, 많으면 아무것도 안 바뀌는 빈 스텝이
 * 남는다 — 둘 다 화면에서는 조용해서 렌더해 봐도 잘 안 보인다.
 *
 * `metric` 만 예외다. 숫자가 먼저 서고 제목이 그다음이라 한 칸 밀린다.
 */
export const COPY_STEP_LAYOUTS = new Set([
  "statement", "definition", "warning", "metric",
  "chapter", "cover", "token-scale",
]);

/**
 * 그림이 스텝을 가져가는 씬. 여기서는 스텝이 부제를 열지 않는다.
 * (StageLanes.tsx 의 `drawsLanes`)
 */
export const DIAGRAM_STEP_SCENES = new Set(["lanes-three", "lanes-inside"]);

/** `revealItems: true` 가 있을 때만 스텝을 그리는 레이아웃. */
export const REVEAL_LAYOUTS = new Set(["sequence", "flow", "recap", "checklist"]);

/**
 * `steps` 를 줬을 때만 순차로 열리는 레이아웃.
 *
 * 한 레이아웃을 여러 화면이 나눠 쓰는데 그중 일부만 이야기 순서가 있는
 * 경우다. `steps` 를 안 준 화면은 통째로 서는 기존 동작 그대로다.
 */
export const STEPPED_IF_DECLARED = new Set([
  "comparison", "photo",          // 좌 → 우 초점 이동 / 사진 위 물음 → 답
  "case", "split",                // 좌 → 우 초점 이동
  "statement", "definition", "warning", "metric", // 제목 → accent 점등 → 부제 문장
  "chapter", "token-scale", "cover", // 그림·숫자는 앵커, 부제 문장만 열린다
  "demo",                         // 레슨 여는 카드 — items 가 한 줄씩
  "quote",                        // 자격 줄이 크게 섰다가 제자리로 내려앉는다
  /* architecture-map 은 씬마다 사정이 다르다. runtime-trace 계열은
     Chapter3Visuals 가 step 을 받아 표를 한 줄씩 열지만, 나머지 씬은
     아직 통째로 선다. 그래서 `steps` 를 준 화면만 스텝으로 센다 —
     안 준 화면은 예전처럼 단일 상태로 잡힌다. */
  "architecture-map",
  "chapter-map",
  "video",                        // 오른쪽 레일 한 줄만 스텝으로 바뀐다
]);


/* ── 비트의 종류 (VIDEO-PACING-GUIDELINES.md §11) ─────────────
   체류 시간 검사(7)는 모든 비트를 똑같이 한 개로 센다. 그런데 사람에게는
   전혀 같은 변화가 아니다 — 글 한 줄이 열리는 것과 도형이 바뀌는 것이
   같은 무게일 수 없다. 그래서 종류를 나눠 따로 센다.

     text     문장 · 목록 항목이 열린다             체감 약함
     focus    같은 그림에서 초점만 옮겨간다         중간
     meaning  도형이 바뀐다 · 실제 화면 · 인과 애니메이션  강함

   **텍스트 비트가 나쁜 게 아니다.** 나쁜 것은 의미 비트 없이 텍스트만
   몇 분씩 이어지는 구간이다. 그 구간에서 청중은 "강사가 슬라이드를 읽는
   장면"을 보게 된다. 판정 근거는 각 레이아웃이 실제로 무엇을 그리느냐다. */

/** 스텝마다 그림이 실제로 바뀌는 레이아웃. */
export const MEANING_LAYOUTS = new Set([
  "cold-open", "handoff", "photo", "screen-count", "promptify", "stage-lanes", "token-pick",
  "fold-steps", "classify", "path-close",
  "cutoff", "llm-scene", "rag-pipeline", "workflow-vs-agent", "ops-table",
  "inside-gap", "agent-scope", "chapter-arc", "course-map",
  "shape-vs-loop",
  "agent-anatomy", "system-map", "loop-scene", "diagram", "manual-queue",
  "token-scale", "architecture-map", "chapter-map",
  "vendor-film",
  // 영상은 앵커가 아니다 — 대본이 흐르는 동안 화면이 계속 바뀐다.
  // 그래서 ANCHORED_SCENES 에는 넣지 않는다 (체감 장면 시계가 안 돈다).
  "video",
]);

/** 좌 → 우 로 초점만 옮기는 레이아웃. `steps` 를 준 것만 해당된다. */
export const FOCUS_LAYOUTS = new Set(["comparison", "split", "case"]);

/**
 * 그림이 **앵커로 서 있고 옆 글만 열리는** 자리.
 *
 * 스텝 0 은 그림이 서고 1 은 짚는 자리지만, 그 뒤는 정직하게 글이다.
 * 여기를 meaning 으로 세면 검사가 스스로를 속인다.
 *
 * stage-lanes 는 2026-08-23 에 `lanes-here` 만 남았다. 나머지 씬은 칸이
 * 앵커로 서 있는 채로 **칸 안에서** 스텝마다 뭔가가 켜진다 — 셀에 이름이
 * 붙고(carry · reach), 브래킷이 서고, 관문이 나타나고, `?` 가 커진다
 * (StageLanes.tsx 머리의 스텝표). lanes-here 는 아직 `지금 여기` 하나뿐이라
 * 그대로 둔다.
 */
export const ANCHORED_SCENES = {
  "stage-lanes": (scene) => scene === "lanes-here",
  /* photo · quote 는 사진이 앵커다. `steps` 를 줘도 →가 바꾸는 것은 사진
     위의 한 줄과 옆 카피뿐이고 사진 자체는 그대로다 (CourseDeck.tsx 의
     photo 분기 주석). 여기 없던 동안 13~14장의 세 스텝이 전부 "도형이
     바뀜"으로 세어졌고, 그래서 **64초짜리 정지 사진이 비트 검사를
     통과**했다 (2026-08-23). */
  photo: () => true,
  quote: () => true,
  "agent-anatomy": () => true,
  "screen-count": (scene) => scene === "evidence",
  "token-scale": () => true,
  chapter: () => true,
  cover: () => true,
  demo: () => true,
};

/** 의미 비트 없이 이만큼(초) 넘게 가면 작업 목록에 올린다.
    보편 법칙이 아니라 얼굴 없는 개념 강의의 수동 검토선이다. */
export const MEANING_GAP = 45;

/* ── 체감 장면 시계 (VIDEO-PACING-GUIDELINES.md §0) ───────────
   사막 검사(7b)는 **그림이 있느냐**를 본다. 그런데 그림이 있어도 그
   그림이 안 변하면 눈에는 정지 화면이다 — 13~14장이 그랬다. 같은 고양이
   사진 한 장 위에서 64초가 흘렀는데, 도형 없이 간 구간도 아니고 분당
   비트도 맞아서 두 검사가 다 통과시켰다.

   그래서 세 번째 시계를 잰다. **지배 이미지가 안 바뀐 채 흐른 시간**이다.
   앵커 그림(ANCHORED_SCENES)은 스텝을 눌러도 그대로 서 있으므로, 그림이
   처음 서는 스텝 0 을 뺀 나머지가 전부 여기 쌓인다. 다음 장이 같은 그림을
   또 쓰면 장을 넘어서도 계속 쌓인다. */

/** 지배 이미지가 사진인 레이아웃. 도형보다 시계가 빠르다 (§0). */
export const PHOTO_LAYOUTS = new Set(["photo", "quote"]);

/** 그림이 안 변한 채 흐를 수 있는 시간. §0 의 15초 · 30초가 그대로 온다. */
export const FROZEN = { photo: 15, figure: 30 };
