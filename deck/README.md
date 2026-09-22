# JAVIS / 제가 살아가려는 방식

Technology Expert Lab 팀과 나누는 30년 생존 실험. 37장, 58개 발표 단계로 구성한 16:9 브라우저 발표다.
일반 설명은 숫자·비교·도해와 실제 결과물로, 대상 이동은 발표자가 누르는 큐로 표현한다. 표지와 Factory 연속 장면에는 공간 연출을 쓴다.

## 실행

```bash
npm install
npm run dev
```

- [발표 화면](http://localhost:5180/#keynote)
- [발표자 대본](http://localhost:5180/#keynote/present)
- [이전 기술 강의](http://localhost:5180/#course)

`→` / `Space`: 다음 단계, `←`: 이전 단계, `숫자 + Enter`: 장표 이동.
`F`: 전체화면, `H`: 조작 바, `M`: 모션 정지, `R`: 현재 장면 재시작.
발표자 창은 같은 브라우저에서 열어야 동기화된다.

4·17·27·31·32·37번에는 React Bits 기반 포인터·클릭 연출이 있다. 1번은 원래 표지로 유지한다.
17번 이미지는 클릭하면 크게 열리고 Escape로 닫힌다. 확대 중에도 방향키로 발표를 이어갈 수 있다.
적용 컴포넌트와 조작법은 [인터랙션 기록](../docs/react-bits-performance.md)에 있다.

## 이야기 흐름

| 장표 | 이야기 |
| --- | --- |
| 1~4 | 고양이 사진을 알아보던 AI, 일을 맡기는 현재, 예측하기 어려운 미래 |
| 5 | Brood War Bench와 공개 경기 화면 |
| 6~8 | 봇의 웹 요청, WebMCP와 Aside, 에이전트가 물건을 고를 때의 가설 |
| 9~11 | 초기 훈련과 이후 평가에서 격리된 에이전트들이 연결된 사건 |
| 12 | Jev의 빠른 판단과 프로그램 안으로 들어가는 AI |
| 13~17 | 개인의 자원, 내 제품의 기준, Agent OS와 Factory |
| 18~22 | Blender로 렌더링한 갤러리, 화면 통과, 매치 컷, 셔터 전환, 원형 전환 |
| 23~25 | 저장된 실제 강의 영상, 프리비즈, 음악 후보 재생 |
| 26 | 이 발표의 제작 과정 |
| 27~33 | 기술을 다루는 수고가 줄어들 때, 목소리 사칭·관계 조작·동의 없는 합성의 위험 |
| 34~37 | 남길 자산, 공개와 미완성 과제, 팀에 던지는 질문 |

## 서비스 시연 방식

본편은 **23~25번에 담은 실제 결과물을 재생**한다. `P`는 재생/일시정지,
`A`는 소리 켜기/끄기다. 처음에는 자동 재생과 소리를 끄고, 발표자가 시작한다.
다음 장으로 이동하면 이전 미디어는 종료된다. 음악은 15초 개발 후보이며 최종 청취 승인본이 아니다.

실제 앱을 더 보여줄 때는 `demo-launchers/TTS.command`, `Assets.command`, `Music.command`를
하나씩 사용한다. TTS와 Assets는 기존 `./app.sh`, Music은 기존 `npm run start:app`을 실행한다.
이 발표에서 앱을 자동 기동하거나 무거운 생성 작업을 시작하지 않는다.

18번부터 →로 진행하면 각 장면의 영상이 한 번 재생되고 마지막 화면에서 멈춘다.
18→19는 중앙 화면을 통과해 강의 화면으로 들어가고, 19→20은 화면 프레임을 맞춰 이미지 장면으로 바뀐다.
20→21은 화면을 가로지르는 물체 뒤에서 탑뷰로 전환하고, 21→22는 원반의 중앙을 통과해 전체 결과물을 보여준다.
←는 이전 장면의 마지막 화면을 보여준다. M으로 모션을 끄면 마지막 화면을 바로 표시하고, 다시 켜도 이미 끝난 장면을 재생하지 않는다. R은 현재 영상을 처음부터 재생한다.

Blender 원본 렌더 도구는 `tools/render-factory-film.py`, 배포용 영상과 마지막 화면은 `public/factory-film/`에 있다.
20번에 쓰는 청록색 새는 이 발표를 위해 Local Assets Engine으로 새로 생성한 2D 이미지다.
이미지 원본·프롬프트·모델·시드는 `public/engines/factory-assets/hero.json`에 있다. 기존 출력이나 엔진 코드는 변경하지 않았다.

17번의 미리보기도 실제 강의 캡처, 새 이미지가 등장하는 장면, 음악 파형 장면으로 맞췄다.
27번에서는 검정·녹색 픽셀 얼굴로 분위기를 전환한다. 28번의 생성·받아쓰기·재생성,
29번의 낮아지는 작업 문턱, 30~32번의 가상 피해 상황은 발표자의 다음 입력에 맞춰 공개한다.
33번에서는 다른 경로로 확인하는 질문으로 마무리하고, 기존 결론으로 돌아간다.
배경 이미지의 생성 기록은 `../docs/abuse-art.md`에 있다.

2번은 중앙의 고양이 사진이 왼쪽으로 이동·축소된다. 3번에서는 강의 제작 요청을 보여주고, 다음 단계에서 실제 강의 영상 캡처를 공개한다. 사진 DOM은 돌아갈 때를 위해 유지한다.
8번은 두 번 더 눌러 판매처 선택과 가격 전략 질문을 공개한다.
9~11번은 같은 에이전트와 공유 서버 도해를 유지하며 사건의 순서를 보여준다.

## 근거와 범위

출처 링크는 해당 장표 아래와 대본에 있다. `FACT-CHECK.md`에 수치의 범위와 확인되지 않은
주장을 정리했다. Cloudflare 비중은 2025.12.02 HTML 요청의 예시이며 현재 인터넷 전체의
고정 비율이 아니다. 가격 전략은 발표자의 가설로 표시한다. Jev 응답 시간은 개발사가 발표한 측정 범위다.

저장된 미디어 원본과 발췌 위치는 `public/demos/provenance.json`에 기록했다.
원본 엔진 저장소와 기존 생성물은 수정하지 않았다. 인터넷 연결은 외부 원문·리플레이 링크를
누를 때만 필요하고, 본편의 폰트·사진·영상·음원·시각화는 로컬에서 재생한다.

## 수정 위치

- 순서와 본문: `src/keynote/KeynoteDeck.tsx`
- 새 사례: `src/keynote/Stories.tsx`, `stories.css`
- PPT 디자인과 진행 장면: `presentation.css`, `CatScene.tsx`, `PriceComparison.tsx`, `IncidentDiagram.tsx`
- 1~17번 리뷰 반영: `opening-revision.css`, `story-revision.css`, `PersonalSlides.tsx`, `personal-slides.css`
- 실제 미디어 재생: `src/keynote/DemoPlayer.tsx`
- 공통 프레임과 번호: `src/keynote/KeynoteFrame.tsx`
- Factory 촬영·재생: `tools/render-factory-film.py`, `src/keynote/FactoryFilm.tsx`, `EngineSequence.tsx`, `factory-film.css`, `factory-artifacts.css`
- 새로 생성한 이미지와 출처: `public/engines/factory-assets/`
- 악용 사례 구간: `src/keynote/AbuseSlides.tsx`, `abuse-slides.css`, `public/abuse/`
- 대본: `script/keynote/manifesto.md`, `stories.md`, `abuse.md`

## 검사

```bash
npm run build
npm run check:keynote # 5180 서버 실행 필요
npm run check:performance # 포인터·클릭·키보드·모션 정지 검사
npm run lint:offline
```

전체 장표·단계와 대본 연결, 텍스트 배치, 외부 요청, 영상의 한 번 재생과 마지막 화면 유지, 역방향 이동,
발표자 동기화, GPU 비활성 대체 화면, 미디어의 실제 로딩과 재생을 확인한다.
검수 결과와 캡처는 `render/keynote/`에 저장한다.

---

# 기존 기술 강의 보관본

`../udemy-agent/deck`의 디자인 시스템(course.css 토큰 · CourseSlideSpec ·
CourseDeck 레이아웃 · 1920×1080 · 자막 안전영역)을 그대로 쓰는 자비스 강의용 덱.
A안(Night Keynote 정본) + bespoke 씬 3종.

`../udemy-agent/deck`의 디자인 시스템(course.css 토큰 · CourseSlideSpec ·
CourseDeck 레이아웃 · 1920×1080 · 자막 안전영역)을 그대로 쓰는 자비스 강의용 덱.
A안(Night Keynote 정본)으로 본편 28장을 간다.

## udemy-agent와 차별점

- **장표가 훨씬 적다.** 798장 → 28장. 온라인 얼굴없는 강의는 화면이 말을 다 해야
  해서 장표가 기하급수적으로 늘지만, 이 강의는 사람이 직접 말하는 오프라인이라
  화면은 결론 한 줄만 들고 설명은 화자가 한다.
- **글자가 적다.** 한 화면 1주장+1근거를 더 빡세게 지킨다. 청중은 화면을 읽는 게
  아니라 화자를 보면서 한 귀를 화면에 둔다.
- **애니메이션은 살린다.** 오프라인이라고 정지 장표로 가지 않는다. 스텝 순차공개,
  금색 metric(ShinyText), 가운데 정렬 착지를 전 장에 깔아 화면이 계속 살아 있다.
- **실물은 시연 자리다.** TTS 파이프라인 등은 화면에 결과를 한 줄만 두고 과정은
  현장 시연과 말로 한다.

## 구성 (28장)

| # | 챕터 파일 | 대본 | 시간 | 내용 |
| --- | --- | --- | --- | --- |
| 1 | `chapters/ch01-open.ts` (4장) | `script/course/ch01.md` | 0-5분 | 선언·연속씬·지도(질문 랜딩) |
| 2 | `chapters/ch02-why.ts` (4장) | `script/course/ch02.md` | 5-15분 | 판 베팅·가르는 기준·정의·착지 |
| 3 | `chapters/ch03-factory.ts` (5장) | `script/course/ch03.md` | 15-27분 | 순환도·음성 실물·규칙·비용 고백 |
| 4 | `chapters/ch04-token.ts` (6장) | `script/course/ch04.md` | 27-42분 | 코어. 티커·그래프·수치·서울대·2~3%·착지 |
| 5 | `chapters/ch05-web.ts` (5장) | `script/course/ch05.md` | 42-53분 | 호출 전환·CAPTCHA·돈·LLMO |
| 6 | `chapters/ch06-close.ts` (4장) | `script/course/ch06.md` | 53-60분 | 파트너·축적·선언·1호 기록 |

## bespoke 씬 3종 (`Javis*.tsx` + `javis-scenes.css`)

- **b · `javis-handoff`** (`open-split`·`open-take`, scene `jd-handoff` 공유):
  2008 금색칸 → 2026 칩이 하나씩 파랑으로 넘어가고 AGENT 스탬프.
- **a · `javis-token`** (`token-ticker`): 900×·31%·+2,434% 카운트업 티커 + 착지.
- **c · `javis-loop`** (`factory-loop`, scene `jd-loop`): 의도→판단→생산→검증
  순환도. 흐르는 파선 + 도는 점 + 스텝별 노드 점등.
- 신규 레이아웃은 `course-types.ts` union과 `tools/course-terms.js`의
  `STEP_AWARE_LAYOUTS`에도 등록돼 있어 lint 오탐이 나지 않는다.

제작 기준 문서는 이 저장소에 있다:
`../LESSON-SHAPE.md` · `../VIDEO-PACING-GUIDELINES.md` ·
`../docs/authoring-rules.md` · 기획 정본 `../강의안_통합.md`.

## 실행

```bash
npm install
npm run dev      # http://localhost:5180 — #course 로 28장 연속 확인
```

슬라이드 이동: `→`/`Space` 스텝 진행, 숫자+`Enter` 점프, `H` 발표자바 숨김(녹화 전),
`S` 자막 안전영역, `F` 전체화면.

## 검증

```bash
npm run typecheck
npm run lint:offline   # 오프라인 기준(리듬 한도 3배). 온라인 잣대는 lint:course
npm run where -- token-ticker
```

화면 ID는 내용 기반 슬러그이며 위치를 담지 않는다. 화면과 대본은
ID로 묶이고, 어긋나면 개발 서버가 경고한다.
