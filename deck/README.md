# JAVIS / 제가 살아가려는 방식

Technology Expert Lab 팀과 나누는 30년 생존 실험. 38장, 69개 발표 단계로 구성한 16:9 브라우저 발표다.
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

4·17·28·32·33·38번에는 React Bits 기반 포인터·클릭 연출이 있다. 1번은 원래 표지로 유지한다.
17번 이미지는 클릭하면 크게 열리고 Escape로 닫힌다. 확대 중에도 방향키로 발표를 이어갈 수 있다.
적용 컴포넌트와 조작법은 [인터랙션 기록](../docs/react-bits-performance.md)에 있다.

## 이야기 흐름

| 장표 | 이야기 |
| --- | --- |
| 1~4 | 고양이 사진을 알아보던 AI, 일을 맡기는 현재, 예측하기 어려운 미래 |
| 5 | Brood War Bench와 공개 경기 화면 |
| 6~8 | 봇의 웹 요청, WebMCP와 Aside, 에이전트가 물건을 고를 때의 가설 |
| 9~11 | 초기 훈련과 이후 평가에서 격리된 에이전트들이 연결된 사건 |
| 12 | 스크롤 페이지: 집이 조립되고, 개발자 시장에서 지식근로 시장으로, Jev의 속도 |
| 13~17 | 개인의 자원, 내 제품의 기준, Agent OS와 Factory |
| 18~22 | Blender로 렌더링한 갤러리, 화면 통과, 매치 컷, 셔터 전환, 원형 전환 |
| 23~25 | 저장된 실제 강의 영상, 프리비즈, 음악 후보 재생 |
| 26 | 이 발표의 제작 과정 |
| 27~34 | 제가 녹음한 적 없는 제 목소리, 수고가 줄어들 때, 새벽의 사칭 전화·관계 조작·동의 없는 합성, 확인하는 방법 |
| 35~38 | 같은 집의 새벽과 아침: 바뀌는 모델과 남는 기록, 잘 안됐던 과정의 공개, 아직 설계인 부분, 만들기·맡기기 질문 |

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
27~34번은 어두운 방과 붉은색(덱의 색 규칙에서 빨강 = 사실이 아님)으로 분위기를 바꾼다(`src/keynote/abuse/`).
27번은 23번에서 들은 실제 강의의 한 문장을 금색 파형으로 다시 보여준 뒤, "저는 이 문장을 녹음한 적이 없습니다"로 붉게 바꾸고,
제 목소리 어댑터의 실제 학습 기록(12.3분·35.3초·약 67MB)과 공개 모델의 "3초" 설명을 놓는다. P는 이 문장 재생, A는 소리다.
28번은 붉게 물든 픽셀 얼굴, 29번은 지금의 제작 과정, 30번은 네 개의 벽(생성·확인·수정·연결)이 무너지며 검은 군중이 다가오는 도식이다.
31~32번은 Blender로 렌더한 한밤중 협탁 위 휴대전화 한 대(`public/abuse/night-phone.jpg`)에서 이어진다(묶음 night-phone).
새벽 2시 47분 모르는 번호의 전화 → 받으면 카메라가 휴대전화로 다가가고 실시간 자막으로 "엄마… 나야" → "합성된 목소리" 도장 →
같은 밤의 음성 메시지와 "지금부터는 저만 믿으세요". 휴대전화 화면은 DOM이며, 렌더가 내보낸 화면 네 모서리(`night-phone.json`)에 matrix3d로 얹는다.
31번 수신 중에 A를 누르면 진동음(WebAudio)이 난다. 기본은 꺼져 있다. 33번은 모자이크한 사진 한 장이 두 배씩 늘어 화면을 채우고, 원본을 지워도 사본이 남는다.
34번은 같은 휴대전화에서 끊고 저장된 번호로 다시 거는 확인 방법(FTC 권고)으로 끝난다. 모든 통화·메시지·사진은 가상 상황이며 실제 사칭 음성은 만들지 않았다.
배경 이미지의 생성 기록은 `../docs/abuse-art.md`에 있다.
35~38번은 한 묶음(finale)이다(`src/keynote/finale/`). 12번의 집을 시간대만 바꿔 다시 렌더한 푸른 새벽(35~37, 흐리게)과 해 뜨는 아침(38)이 뒤에 깔리고,
38번에서 배경이 선명해지며 아침으로 밝아진다. 35번은 위로 지나가는 모델(지금 Qwen3-TTS, 이후는 가정)과 아래에 쌓이는 작업 방식·판단의 기록·결과물의 세 겹,
36번은 local-tts-engine 결정 기록에서 뽑은 실제로 잘 안됐던 과정 여섯 줄과 동의 확인 약속, 37번은 개발 중인 방(TTS·ASSETS·MUSIC)과 점선의 구상(Agent OS·연결)으로 된 설계도,
38번은 "만들기"와 "맡기기" 두 낱말에 초점 틀이 옮겨 다니는 질문이다. 초점이 가는 쪽에 따라 아침빛의 색이 바뀐다.

2~3번은 three.js 공간 하나를 두 장 동안 유지한다(`src/keynote/opening/`). 사진이 어둠 속에 떠 있다가(2-0), 주사선이 지나가며 화소의 부조로 바뀌고
왼쪽으로 물러나며, 얼굴 쪽 화소가 흘러가 금색 입자의 "고양이"가 된다(2-1). 3번에서는 부조와 단어가 흩어지고 요청 문장이 한 글자씩 적히며(3-0),
빛이 화면의 테두리로 모인 자리에 실제 강의 영상이 소리 없이 재생되고 아래에 제 목소리의 파형이 재생 위치를 따라 채워진다(3-1).
7~8번은 three.js 공간 하나를 두 장 동안 유지한다(`src/keynote/agent-web/`). 판매처 화면 앞의 "나는 로봇이 아닙니다"(7-0) → 화면 뒤에서 사이트가 내놓은 기능(WebMCP)을
에이전트가 부른다(7-1) → 같은 화면이 판매처 A가 되고 B와 광고판이 선다(8-0) → 에이전트가 화면 대신 조건을 읽고 B를 고른다(8-1) → A의 광고판이 가격표로 흘러내린다(8-2, 발표자의 가설).
13번은 12번이 멈춘 마지막 이미지(불 켜진 집)에서 이어지고, 아래에 2026~2056년의 30년 눈금을 긋는다. 2031년 눈금은 4번의 질문을 다시 가리킨다.
14번은 실제 강의 24초의 제작 기록이다. 대본 문장·제 목소리 파형·단어 단위 자막·영상 프레임을 같은 시간축에 놓고, 오른쪽 위 영상의 재생 위치를 재생 헤드가 따라간다.
값은 local-tts-engine의 타임라인에서 뽑은 `src/keynote/data/tts-alignment.json`을 쓴다. M에서는 2.4초('AI가') 지점에 멈춘 화면을 보여준다.
15~16번은 three.js 공간 하나를 두 장 동안 유지한다(`src/keynote/personal/world.ts`). 많은 사용자의 점이 가라앉고 금색 점(저) 하나가 남는다(15-0) →
조건의 고리가 느슨해지고 요구사항 표가 "사용자가 저 한 명일 때"로 옮겨간다. 원본과 작업 기록만 잠겨 있다(15-1) → 카메라가 물러나며 저 → Agent OS(구상, 점선) →
Factory(개발 중) → 강의 영상 → 저의 고리가 차례로 켜지고, 마지막에 "이 페이지 발음만 다시" 요청이 TTS로 되돌아간다(16-0~2).
17번은 18번 Blender 갤러리와 같은 배치(가운데 01 VOICE, 왼쪽 02 IMAGE, 오른쪽 03 MUSIC)의 전시 공간이다. 카드의 기울기·확대 보기는 그대로 쓴다.
세 공간 모두 앞으로 넘길 때만 움직임을 재생하고, ←와 번호 이동은 그 단계의 마지막 상태를 보여준다. M 또는 모션 줄이기 설정에서도 마지막 상태를 표시한다.
WebGL을 쓸 수 없으면 같은 내용을 평면으로 보여준다. 공통 렌더 틀은 `src/keynote/stage3d/runtime.ts`에 있다.
9~11번은 three.js로 만든 사건 재구성 공간 하나를 세 장 동안 유지한다. →를 누를 때마다 카메라가 이동하며 격리된 실행 4개, 공용 서버, 방화벽, 게시판, 외부 인터넷, Hugging Face 침해를 차례로 보여준다.
앞으로 갈 때만 해당 단계의 움직임(연결 시도, 메모 이동, 게시판 재구성, 외부 연결)이 재생되고, ←는 이전 단계의 마지막 상태로 돌아간다. 아래 타임라인은 5월 초기 훈련과 7월 보안 평가를 서로 다른 구간으로 표시한다.
M 또는 모션 줄이기 설정에서는 각 단계의 마지막 상태를 바로 표시한다. WebGL을 쓸 수 없으면 기존 2D 도해(`IncidentDiagram.tsx`)를 표시한다.

12번은 한 장 안에서 스크롤하는 홈페이지다. 뒤에는 Blender로 렌더한 영상 하나가 고정돼 있고, 왼쪽 글이 스크롤을 따라 올라간다.
해 질 녘 빈 대지의 평면선 위로 기초·코어 벽·유리·슬래브·목재 상자·지붕이 위와 좌우에서 날아와 집이 되고, 불이 켜진다.
카메라가 물러나면 청사진 격자 위로 개발자 구역(금색)이 서고, 나머지 7개 직군의 도시가 세워진 뒤, 도시 위로 판단의 빛이 오가고, 다시 집으로 내려온다.
→는 다음 정지 지점까지 영상을 원래 속도로 재생하고 멈춘다. ←는 이전 지점으로 빠르게 되감는다. 트랙패드·마우스 휠은 영상을 앞뒤로 훑고,
정지 지점을 넘으면 덱의 단계가 바뀌어 발표자 창의 대본도 따라온다. 휠로는 장표를 넘기지 않는다. 끝에서 →를 누르면 13번으로 간다.
M 또는 모션 줄이기 설정에서는 정지 지점 이미지만 보여주고, 휠 한 번이 한 단계다. 도시의 라벨과 빛은 렌더에 쓴 카메라로 투영한 좌표(`track.json`)를 따라간다.

## 근거와 범위

출처 링크는 해당 장표 아래와 대본에 있다. `FACT-CHECK.md`에 수치의 범위와 확인되지 않은
주장을 정리했다. Cloudflare 비중은 2025.12.02 HTML 요청의 예시이며 현재 인터넷 전체의
고정 비율이 아니다. 가격 전략은 발표자의 가설로 표시한다. Jev 응답 시간과 가격은 개발사가 발표한 값이다.
12번의 3조 달러(a16z, 개발자가 만드는 가치)와 18.6조 달러(BofA, 7개 직군 임금)는 기준이 다른 추정치를 나란히 둔 것이다.

저장된 미디어 원본과 발췌 위치는 `public/demos/provenance.json`에 기록했다.
원본 엔진 저장소와 기존 생성물은 수정하지 않았다. 인터넷 연결은 외부 원문·리플레이 링크를
누를 때만 필요하고, 본편의 폰트·사진·영상·음원·시각화는 로컬에서 재생한다.

## 수정 위치

- 순서와 본문: `src/keynote/KeynoteDeck.tsx`
- 새 사례: `src/keynote/Stories.tsx`, `stories.css`
- PPT 디자인과 진행 장면: `presentation.css`, `IncidentDiagram.tsx`(9~11번 WebGL 대체 화면)
- 2~3번 공간: `src/keynote/CatScene.tsx`(글·요청·영상), `opening/world.ts`(사진·부조·입자), `opening/LectureWave.tsx`, `opening/opening.css`
- 7~8번 공간: `src/keynote/agent-web/AgentWeb.tsx`(제목·설명·라벨), `agent-web/world.ts`(판매처·도구·광고판·카메라 샷), `agent-web.css`
- 13·14번: `src/keynote/personal/PersonalIntro.tsx`, `ProductionTimeline.tsx`, `personal.css`, 제작 기록 `src/keynote/data/tts-alignment.json`, 프레임 띠 `public/demos/tts-strip.jpg`
- 15~16번 공간: `src/keynote/personal/OneUser.tsx`(요구사항 표·라벨), `personal/world.ts`
- 17번 전시 공간: `src/keynote/PersonalSlides.tsx`, `personal/personal.css`, `EnginePreview.tsx`
- 세 공간의 공통 렌더 틀(bloom·MSAA·단계 시계·샷 맞춤): `src/keynote/stage3d/runtime.ts`
- 9~11번 사건 재구성 공간: `src/keynote/incident/world.ts`(장면·카메라 샷), `IncidentWorld.tsx`(라벨), `incident.css`
- 12번 스크롤 페이지: `src/keynote/next-market/NextMarket.tsx`(글·스크롤·단계 동기화), `film.ts`(영상 좌표와 스크럽), `pulses.ts`(판단의 빛), `next-market.css`
- 12번 영상: `tools/render-house-scroll.py`(Blender 장면·카메라·라벨 좌표, `--mode layout`으로 글 단과 겹치는지 확인), `tools/encode-house-scroll.sh`(MP4와 정지 지점 이미지), 결과는 `public/house-scroll/`
- 4~6·9~11번 리뷰 반영: `opening-revision.css`, `story-revision.css`
- 실제 미디어 재생: `src/keynote/DemoPlayer.tsx`
- 공통 프레임과 번호: `src/keynote/KeynoteFrame.tsx`
- Factory 촬영·재생: `tools/render-factory-film.py`, `src/keynote/FactoryFilm.tsx`, `EngineSequence.tsx`, `factory-film.css`, `factory-artifacts.css`
- 새로 생성한 이미지와 출처: `public/engines/factory-assets/`
- 악용 사례 구간: `src/keynote/AbuseSlides.tsx`(순서), `src/keynote/abuse/`(27 OwnVoice, 30·33 AbuseScenes, 31·32·34 PhoneStories·NightPhone, `abuse-v2.css`, `night-phone.css`), `abuse-slides.css`, `public/abuse/`
- 한밤중 휴대전화 렌더: `tools/render-night-phone.py`(`--mode final`은 2880×1620과 화면 네 모서리 JSON)
- 마무리 구간 35~38번: `src/keynote/finale/Finale.tsx`(네 장의 글·기록·설계도), `finale.css`, 38번의 선택지 `src/keynote/ClosingChoices.tsx`
- 새벽·아침 배경: `blender --background --python tools/render-house-scroll.py -- --mode still --frames 570 --time blue|sunrise --scale 100 --samples 160 --out render/house-dawn`, 결과는 `public/house-dawn/`
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
