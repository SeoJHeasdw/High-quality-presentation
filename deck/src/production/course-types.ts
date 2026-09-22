/**
 * COURSE 덱의 화면 데이터 타입.
 *
 * 챕터 파일(chapters/chXX-*.ts)이 이 파일만 import 한다.
 * 레지스트리(course-content.ts)는 챕터 파일을 모으는 쪽이므로,
 * 타입을 여기 따로 두어 순환 import 를 만들지 않는다.
 */

/**
 * 다이어그램 초점·강조 타입. 구 AgentLoopDiagram에 있던 것을 스펙 계약
 * 유지를 위해 여기로 옮겼다 (diagramFull/diagramFocus/diagramAccent).
 */
export interface LoopFocus {
  nodes?: number[];
  ring?: boolean;
  gate?: boolean;
}

export interface LoopAccent {
  pulse?: number[];
  humanAll?: boolean;
  ringWrite?: boolean;
  gate?: boolean;
}

export type CourseLayout =
  | "cold-open"
  | "cover"
  | "chapter"
  | "statement"
  | "definition"
  | "agent-anatomy"
  | "system-map"
  | "loop-scene"
  | "handoff"
  | "photo"
  | "quote"
  | "rag-pipeline"
  | "workflow-vs-agent"
  | "shape-vs-loop"
  | "ops-table"
  | "inside-gap"
  | "agent-scope"
  | "chapter-arc"
  | "course-map"
  | "screen-count"
  | "promptify"
  | "fold-steps"
  | "classify"
  | "path-close"
  | "stage-lanes"
  | "token-pick"
  | "cutoff"
  | "llm-scene"
  | "architecture-map"
  | "vendor-film"
  | "chapter-map"
  | "extension-scene"
  | "failure-scene"
  | "split"
  | "manual-queue"
  | "token-scale"
  | "sequence"
  | "metric"
  | "case"
  | "warning"
  | "flow"
  | "comparison"
  | "checklist"
  | "demo"
  | "recap"
  | "video"
  | "diagram"
  | "javis-handoff"
  | "javis-token"
  | "javis-loop";

export interface CourseSide {
  label?: string;
  title: string;
  body?: string;
  /** 비교판의 의미 색. 위치는 우열을 뜻하지 않으며, 기본은 중립이다. */
  role?: "neutral" | "human" | "error";
  /** 칸 안에 들어가는 작은 사진. `public/` 기준 경로다 (예: `/shots/cat1.png`). */
  image?: string;
}

export type PacingExceptionKind = "dwell" | "desert" | "frozen";
export type SourceReading = {range: [number,number]; label: string; meaning: string};

export interface CourseSlideSpec {
  /**
   * `toolpick-semantic` 형식의 안정 식별자. docs/course-blueprint.md §14.
   *
   *   toolpick-semantic
   *   │         └─ 그 주제 안에서 이 화면을 가리키는 말
   *   └─────────── 주제. 내용 영역의 이름이지 위치가 아니다
   *
   * **위치를 담지 않는다.** 챕터 번호도 레슨 번호도 들어가지 않으므로,
   * 화면을 다른 챕터로 옮겨도 ID 는 그대로다. 이 덱은 순서를 세 번 바꿨고
   * 그때마다 위치를 담은 ID 가 거짓말이 됐다 — 그래서 떼어냈다.
   *
   * 순서는 배열이 담당한다. 배열 순서가 곧 녹화 순서다.
   *
   * 내용을 고쳐도 ID 는 유지하고, 삭제한 슬러그는 재사용하지 않는다.
   * scriptKey 로도 그대로 쓰이므로(CourseDeck.tsx) 여기를 바꾸면
   * script/course/chXX.md 의 `## 키` 도 같이 바꿔야 한다.
   */
  id: string;
  layout: CourseLayout;
  /**
   * 챕터를 이루는 **막**. 화면의 골격 자체를 바꾼다.
   *
   * 챕터 하나가 열일곱 레슨을 같은 틀로 흘리면, 그림을 쉰 가지로 그려도
   * 시청자의 눈은 같은 경로만 반복한다 — 좌상단 제목, 가운데 띠, 아래 한 줄.
   * 막은 그 경로를 바꾼다. 무게 중심이 위(`a`) · 전면(`b`) · 아래(`c`)로
   * 옮겨 가므로, 막이 바뀌는 자리에서 "장면이 넘어갔다"가 눈에 보인다.
   *
   * 레슨 파일이 속한 묶음에서 자동으로 붙는다(chapters/chNN-*.ts). 장마다
   * 손으로 적지 않는다 — 한 막 안에서 골격이 흔들리면 막의 의미가 없다.
   */
  act?: "a" | "b" | "c";
  /** 같은 대상을 같은 위치에 남기는 연속 장면만 명시한다. 전환 생략용 표식이 아니다. */
  continuity?: { id: string; label: string };
  eyebrow?: string;
  title: string;
  subtitle?: string;
  accent?: string;
  metric?: string;
  items?: string[];
  /**
   * 구조 그림 안에서 스텝마다 열리는 짧은 판정 문장.
   *
   * `items` 는 도형의 고정된 노드 이름이고, `visualBeats` 는 그 노드를
   * 설명하며 새로 생기는 정보다. 둘을 섞으면 화면을 넘길 때 구조 자체가
   * 갈아 끼워져 공간 기억이 끊긴다. Chapter 3의 market-* 도해는 노드는
   * 유지하고 이 줄을 한 장씩 올려 같은 그림 안에서 의미 비트를 만든다.
   */
  visualBeats?: string[];
  /** Narration steps can disclose separate parts of one existing scene state.
   * Selectors refer to authored evidence in that scene, never to generated captions. */
  stepSequence?: { frame: number; hide?: string[]; focus?: string[]; reading?: SourceReading }[];
  /** Resolved navigation cue for the full PDF source viewer. */
  sourceReading?: SourceReading;
  /** Original scene labels, indexed by frame; visualBeats follows narration steps. */
  sceneBeats?: string[];
  left?: CourseSide;
  right?: CourseSide;
  /**
   * 완성 영상을 사람이 직접 보고 승인한 장표 단위 리듬 특수 규칙.
   *
   * - dwell: 개별 스텝 체류 시간
   * - desert: 글 중심 구간 누적 시간
   * - frozen: 같은 그림의 체류 시간
   *
   * 어느 챕터에서든 사용할 수 있지만 자동으로 붙지 않는다. 반드시
   * `pacingExceptionReason`에 이 장표에서 예외가 성립하는 이유를 남긴다.
   */
  pacingExceptions?: PacingExceptionKind[];
  /** 예외 승인 이유. 화면에는 렌더되지 않고 콘텐츠 린터만 읽는다. */
  pacingExceptionReason?: string;
  /**
   * `diagram` 레이아웃에서 그림을 처음부터 통째로 세워 둔다.
   *
   * Loop 다이어그램은 스텝마다 노드를 하나씩 그린다. 처음 소개할 때는
   * 그게 맞지만, 뒤에서 **다시 꺼내 회수하는** 화면에서는 틀린다 —
   * 이미 아는 그림을 또 그리는 걸 기다리게 되고, 정작 말하려는
   * "이 칸에 이게 들어간다"가 빈 화면 위에서 시작된다. 회수 화면에서는
   * 그림을 다 세워 두고 스텝은 아래 한 줄만 넘긴다.
   */
  diagramFull?: boolean;
  /**
   * `diagramFull` 화면에서 스텝마다 그림의 어디를 밝힐지. 배열 인덱스 0 이 스텝 1 이다.
   *
   * 그림을 다 세워 둔 채 아래 한 줄만 바꾸면, 여섯 칸 중 지금 어느 칸을
   * 말하는지 청중이 직접 찾아야 한다. 그 몇 초 동안 문장을 놓친다.
   * 초점을 주면 말하는 부분만 남고 나머지가 죽는다 — 그림의 전체 모양은
   * 그대로라 "전부 이 안에 들어간다"도 같이 유지된다.
   *
   * 스텝 0 에는 초점을 주지 않는다. 그 자리는 그림 전체를 보는 자리다.
   */
  /** 스텝에 초점을 안 주려면 그 자리에 `null` 을 둔다. */
  diagramFocus?: (LoopFocus | null)[];
  /**
   * `diagramFocus` 와 같은 자리에 쓰되 **아무것도 죽이지 않는다.**
   * 배열 인덱스 0 이 스텝 1 이다.
   *
   * 초점은 나머지를 0.2 로 내리고 흐르는 점을 끈다 — 회수 장표에서는
   * 그게 앞 장에서 살아 있던 그림을 정지 사진으로 만든다. 강조가 필요한데
   * 그림은 살아 있어야 하는 자리에 이걸 쓴다 (AgentLoopDiagram 의 LoopAccent).
   */
  diagramAccent?: LoopAccent[];
  /** 항목을 화살표로 한 단계씩 보여줄 때만 사용한다. */
  revealItems?: boolean;
  /**
   * layout: "photo" 에서 글자가 든 스크린샷일 때 켠다.
   *
   * 기본 액자(520px)는 cat1.png(550×378) 같은 사진 기준이다. 발표 자료나
   * 제품 화면처럼 **읽어야 하는 글자가 든 캡처**는 그 폭에서 안 읽힌다.
   * 켜면 액자를 넓히고 캡션을 사진 밖으로 뺀다 — 겹쳐 놓으면 캡처 자신의
   * 제목을 가린다.
   */
  shotWide?: boolean;
  /**
   * `layout: "photo"` 에서 캡처를 **화면 전체 폭**으로 세운다.
   *
   * `shotWide`(860px)는 세로가 있는 캡처 기준이다. 가로세로비가 2.5:1 을
   * 넘는 캡처는 그 폭에서 높이가 300px 밖에 안 나와서 글자가 하나도
   * 안 읽힌다 — `artificial-analysis-index.png`(2.9:1)가 그랬다.
   *
   * 켜면 글이 캡처 **위로** 올라가고 캡처가 가로를 다 쓴다. 같은 파일이
   * 860px 에서 1720px 로, 높이가 296px 에서 590px 로 두 배가 된다.
   */
  shotFull?: boolean;
  /**
   * `shotFull` 캡처 한 장을 고정된 뷰포트 안에서 확대·이동한다.
   *
   * 스텝마다 다른 파일로 교체하지 않으므로 이미지 로딩 공백과 레이아웃
   * 재배치가 없고, `shotBands` 좌표를 카메라의 중심점으로 사용한다.
   * 스텝 0 은 전체, 1~n 은 각 band, 마지막은 다시 전체다.
   */
  shotCamera?: boolean;
  /** 마지막 착지 스텝에서 활성 band와 읽기 라벨을 걷고 캡처 전체로 돌아온다. */
  shotLandingClear?: boolean;
  /**
   * `shotFull` + `shotBands` 는 띠가 켜질 때 그 자리를 확대한다. 그게
   * **손해인 캡처**에서 끈다.
   *
   * 확대창은 폭이 `1/zoom` 이라 캡처보다 좁다. 한 줄이 캡처 폭을 다 쓰는
   * 문서 캡처에서는 그 창이 문장을 **단어 중간에서 잘라** 프레임 밖으로
   * 내보낸다 — 짚는 자리는 밝은데 그 옆 문장이 반쯤 잘린 채 서 있어서
   * 화면이 고장 난 것처럼 읽힌다. `grok-bot-doc` 이 그 자리다.
   *
   * `shotFull` 이면 캡처가 이미 1720px 이다. 거기서 읽히면 확대는 안 해도
   * 된다 — 끄면 띠는 밝히기만 하고 캡처는 제자리에 선다.
   */
  shotZoom?: false;
  /**
   * `layout: "photo"` 에서 **스텝마다 다른 캡처**를 건다. 비워 둔 자리는
   * `metric` 을 쓴다.
   *
   * 가로로 긴 캡처 한 장을 확대해서 한 칸을 들여다보는 것은 답이 아니다 —
   * 제목이 프레임 밖으로 잘리고, 옆 칸이 같이 들어오고, 무엇보다 원본
   * 픽셀을 늘리는 것이라 글자가 뭉갠다. **칸마다 따로 찍어서 통째로
   * 보여준다.** 그러면 확대가 필요 없다.
   *
   *   [null, 지능, 속도, 비용, null]
   *   0 세 칸을 나란히 · 1~3 그 칸 하나씩 · 4 다시 셋을 나란히 (착지)
   */
  shotFrames?: (string | null)[];
  /**
   * `layout: "photo"` 에서 캡처를 **읽는 순서대로** 짚는다.
   *
   * 글이 든 제품 캡처는 한 장이 60~80초를 버틴다 — 대본은 위에서 아래로
   * 문단을 옮겨 가며 읽는데 화면은 첫 프레임부터 마지막까지 완전히
   * 정지해 있다(VIDEO-PACING-GUIDELINES.md §0 사진 15초, §4 ③ 확대·주석).
   *
   * 밴드를 주면 스텝 1 부터 그 띠 하나만 밝게 남고 나머지 캡처가 어두워진다.
   * 스텝 0 은 캡처 전체를 보는 자리다. `steps` 는 밴드 수 + 1 로 준다 —
   * 마지막 스텝에서 오른쪽 부제(결론)가 열린다.
   *
   *   top · height    이미지 높이에 대한 백분율
   *   left · width    이미지 폭에 대한 백분율. 없으면 가로 전체
   *   note            그 자리를 읽는 동안 오른쪽에 서는 한 줄
   */
  /**
   * `layout: "video"` 가 재생할 화면 녹화. `public/` 기준 경로다.
   *
   * 도해가 못 하는 것 하나를 한다 — **실제로 되는 것을 보여 준다.**
   * 그래서 아무 데나 쓰지 않는다. 결과를 주장하는 자리, 실습을 여는
   * 자리처럼 "말로는 못 믿는" 곳에만 쓴다.
   *
   * 무음으로 넣는다. 나레이션은 TTS 로 따로 얹히므로 원본 소리가 있으면
   * 두 목소리가 겹친다. 클립이 대본보다 짧으면 그대로 다시 돈다(loop) —
   * 배속은 편집 단계에서 정하고 화면 데이터는 경로만 안다.
   *
   *   ffmpeg -ss 30 -t 110 -i 원본.mp4 \
   *     -filter:v "setpts=0.5*PTS" -an -c:v libx264 -crf 23 \
   *     -pix_fmt yuv420p -movflags +faststart out.mp4
   */
  video?: string;
  /**
   * `layout: "video"` 에서 **영상의 편집점이 대본의 어느 스텝에 걸려
   * 있는가.** 이걸 적어 두면 린터가 어긋남을 오류로 잡는다 (검사 12).
   *
   * 영상은 스텝을 따라가지 않는다 — `→` 를 눌러도 재생 위치는 그대로고,
   * 자기 시간표대로 혼자 흐른다. 확대·축소·이동 같은 편집점이 있는
   * 영상에서는 이게 **조용히 깨진다.** 대본 한 줄만 길어져도 확대가
   * 엉뚱한 문장 위에서 터지는데, 화면도 빌드도 아무 말을 안 한다.
   *
   *   duration  영상 파일의 길이(초). `ffprobe` 로 잰 값을 적는다
   *   cues      각 대본 스텝이 시작될 때 영상이 서 있어야 하는 지점(초).
   *             길이는 대본 스텝 수와 같아야 하고 `cues[0]` 은 0 이다
   *
   * 대본 길이는 글자 수로 환산한 추정치라(`CHARS_PER_SEC`) 정확히 맞을
   * 수는 없다. 린터는 스텝마다 **2 초**까지만 봐주고 그 이상은 오류다.
   * 뜨면 대본을 그 길이에 맞춰 줄이거나, 영상을 다시 편집하고 이 값을
   * 같이 고친다. 실제 TTS 를 뽑은 뒤에는 그 길이로 다시 맞춘다.
   *
   * 편집점이 없는 영상(그냥 도는 화면)에는 적지 않는다 — 꼬일 게 없다.
   */
  videoBeats?: { duration: number; cues: number[] };
  shotBands?: {
    top: number;
    height: number;
    left?: number;
    width?: number;
    note: string;
  }[];
  /**
   * 화면의 강조색을 금색으로 바꾼다. 기본값은 파랑(`--course-accent`)이다.
   *
   * 덱에서 금색은 "이번 화면의 결론"에 쓰는 색이다(완료 노드, 승인 게이트,
   * 재조립된 계획). 숫자 하나가 결론인 화면에서 파랑을 쓰면 다른 파란 숫자와
   * 같은 무게로 읽히므로 여기서만 금색으로 올린다.
   */
  tone?: "gold";
  /**
   * 문장 화면을 화면 한가운데에 가운데 정렬로 세운다.
   *
   * 기본값(왼쪽 정렬)은 뒤에 그림이나 다음 정보가 이어질 때의 자세다.
   * 반대로 **그 문장 하나가 그 자리의 전부**인 착지·반전 화면에서는
   * 왼쪽 위에 걸려 있으면 오른쪽의 빈 화면이 같이 읽힌다. 가운데로
   * 옮기면 볼 곳이 하나로 좁아진다 — 5장(`open-line`)이 그 자세다.
   *
   * `statement` · `definition` · `warning` 에서 동작한다.
   */
  align?: "center";
  /**
   * layout: "diagram" 일 때 그릴 도해.
   * 구조 장표는 텍스트 나열로 대신하지 않는다 (course-blueprint.md §8).
   */
  diagram?: "agent-loop";
  /** Chapter 2처럼 한 구조를 여러 화면 상태로 탐색할 때의 장면 키. */
  scene?: string;
  /**
   * 같은 씬 묶음 안에서 **지배 이미지가 실제로 변형되는** 장.
   *
   * sceneGroup 은 그대로다 — DOM 이 살아 있어야 그 변형이 애니메이션이 된다.
   * 레슨 모양 도구(`npm run lessons`)만 여기서 새 구도를 센다. 무엇이
   * 변형되는지 한 줄로 말할 수 있을 때만 켠다(화살표가 지워지고 LLM 이
   * 칸 위로 올라간다). 카드가 밝아지거나 초점이 옮겨 가는 것은 변형이
   * 아니다 (LESSON-SHAPE.md §3).
   */
  sceneCut?: boolean;
  /**
   * `→` 를 누를 횟수를 직접 지정한다. diagram 처럼 items 개수로
   * 스텝을 유추할 수 없는 레이아웃에서 쓴다. 없으면 revealItems 로 계산한다.
   */
  steps?: number;
  /**
   * 제작 메모 · 출처. **어디에도 렌더되지 않는다.**
   *
   * 발표자 창의 「화면 메모」 칸에 띄우던 것인데, 낭독과 자막이 파이프라인
   * 으로 넘어가면서(tools/captions.mjs, tools/capture.mjs) 그 창을 보는 사람이 없어졌다.
   *
   * 값은 남겨 둔다 — `[Sources] …` 로 시작하는 출처 표기가 여기 붙어 있고,
   * 그건 화면에 띄우려던 게 아니라 이 장표가 무엇에 근거하는지의 기록이다.
   * 새로 쓸 설명은 `//` 주석으로 쓰는 편이 낫다.
   */
  note?: string;
}

/**
 * 이 화면에서 `→` 를 누를 횟수.
 * 덱 렌더링과 무결성 검사가 같은 값을 봐야 하므로 여기 한 곳에 둔다.
 */
export function slideSteps(spec: CourseSlideSpec): number {
  if (spec.steps !== undefined) return spec.steps;
  if (spec.revealItems && spec.items) return Math.max(0, spec.items.length - 1);
  return 0;
}

export interface ChapterSpec {
  /** 0 은 강의 프레임(커버·오프닝). 1~8 은 실제 챕터. */
  chapter: number;
  title: string;
  /** 배열 순서가 곧 녹화 순서다. */
  slides: CourseSlideSpec[];
}
