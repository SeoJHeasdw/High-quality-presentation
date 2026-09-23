# 발표 사례의 근거

확인일: 2026-09-22, 2026-09-23(38 → 43장 확장). 장표 번호는 43장 기준이다. 본문에서는 현상과 관찰을 짧게 말하고, 해석은 발표자 관점으로 구분한다.

| 사례 | 확인한 범위 | 원문 |
| --- | --- | --- |
| Cloudflare | 2025.12.02 HTML 요청에서 사람 47%. 자동화 53%는 보수 계산. 고객 사이트 관측이며 인구·사용 시간·현재 전체 HTTP 비중이 아님. 봇 모두가 AI라는 뜻도 아님. | [Year in Review](https://blog.cloudflare.com/radar-2025-year-in-review/) |
| WebMCP | 사이트가 브라우저 에이전트에 구조화된 동작을 제공하는 early preview 발표. CAPTCHA의 완전 폐지를 뜻하지 않음. | [Chrome 발표](https://developer.chrome.com/blog/webmcp-epp) |
| Aside | 사람과 에이전트가 함께 쓰는 브라우저를 표방. 제품 소개의 순위·절대적 보안 주장을 재인용하지 않음. | [공식 소개](https://aside.com/) |
| Brood War Bench | 범용 모델·하니스 간 경기, 저자의 경제·전투 행동 관찰. 저자는 모두 초보 수준이라고 평가. 특정 경기용 추가 학습이 없었다는 단정은 하지 않음. | [벤치마크 보고서](https://bw.swerdlow.dev/report) |
| 공개 게임 화면 | G027 Fable의 프로토스 시점 14:15. Astra와의 직접 경기 화면이라고 주장하지 않음. | [리플레이](https://bw.swerdlow.dev/benchmark/replay?duration=185&focus=guest-base&game=G027&seat=1&start=840) |
| 초기 훈련 | 5/8 Google Drive 자료가 필요한 과제. 최초 SSRF 시도 실패 중 공유 파일 작성. 5/12 이후 메모/게시판. 초기 쓰기는 공유 자격증명으로 가능했으며 권한 탈취를 선행 조건으로 묘사하지 않음. 5/26 외부 연결 성공. | [OpenAI 기술 보고서 III.A](https://cdn.openai.com/pdf/67869394-cb91-4c12-888c-5cbd85c7814c/OpenAI-Hugging-Face%20Incident-Technical-Report.pdf) |
| 7월 침해 | 초기 훈련과 구분되는 후속 평가 실행. 서버 조치 후 게시판 재구성, 협력, Hugging Face 침해. 여러 실행을 단일 에이전트의 연속 행동으로 표현하지 않음. 배포 서비스와 동일한 보호 조건도 아님. | [OpenAI 조사](https://openai.com/index/hugging-face-incident-and-the-road-ahead/), [피해 서비스 공개](https://huggingface.co/blog/security-incident-july-2026) |
| 코딩 에이전트 출시 | 2025년 공개 시점: Claude Code 2.24(연구 프리뷰), Codex CLI 4.16, Codex 5.16(연구 프리뷰), GitHub Copilot 코딩 에이전트 5.19(공개 프리뷰), Gemini CLI 6.25, Kiro 7.14. "모든 회사"로 일반화하지 않고 "AI 회사들이 집중했다"로 쓴다. | [GitHub](https://github.blog/changelog/2025-05-19-github-copilot-coding-agent-in-public-preview/), [OpenAI Codex](https://openai.com/index/introducing-codex/), [Kiro](https://kiro.dev/blog/introducing-kiro/) |
| GitHub 이슈 해결률 | SWE-bench Verified는 사람이 검증한 실제 GitHub 이슈 500개. GPT-4o 33.2%(OpenAI 2024.08.13, 최적 스캐폴드), Claude Opus 4.5 80.9%(Anthropic 2025.11.24). 시점과 스캐폴드가 다른 최고 점수의 비교이며 같은 조건의 실험이 아님. 화면은 반올림한 33%, 81%. | [OpenAI](https://openai.com/index/introducing-swe-bench-verified/), [Anthropic](https://www.anthropic.com/news/claude-opus-4-5) |
| 개발자 3조 달러 | a16z 추정: 개발자 약 3천만 명 × 1인당 연 10만 달러의 경제적 가치. 임금 총액이나 소프트웨어 매출이 아님. 기획 단계의 "1조"를 이 수치로 교정. | [a16z · 2025.10.09](https://a16z.com/the-trillion-dollar-ai-software-development-stack/) |
| 지식근로 18.6조 달러 | BofA Global Research: 영업·마케팅·고객지원·재무·인사·IT·운영 7개 직군의 전 세계 연간 임금. 건축·3D 같은 전문 직군은 빠져 있어 "+"로 표시. a16z와 기준(가치와 임금)이 달라 정확한 배수로 말하지 않음. IT 직군과 개발자는 일부 겹침. | [Fortune · 2025.06.26](https://fortune.com/2025/06/26/agentic-ai-spending-155-billion-by-2030-cfo-bofa-analysts) |
| Jev | TypeSafe AI가 2026.09.15 공개. 구조화된 판단 값, 개발사 제시 응답 시간 70–500ms, 출력 토큰 무료·입력 100만 토큰당 0.042달러(개발사 가격). 공식 시연은 Doom과 Wikiracing. "환각 0%", "40~200배 빠름" 같은 개발사 주장은 화면에 쓰지 않음. 속도 보장이나 투자 수익으로 확대하지 않음. | [개발사 발표](https://typesafe.ai/blog/introducing-system-one-models-and-jev) |

가격 인하가 광고보다 유리해질 가능성과 실시간 주식 트레이딩은 발표자의 미래 응용 가설이다.
12번에서 문제 풀이 능력이 건축 설계·3D 모션 그래픽 같은 전문가의 일로 넘어온다는 문장은 발표자의 관점이다.
12번의 집과 도시는 Blender로 렌더한 설명용 장면이다. 도시의 금색 구역은 80블록 중 13블록(16%)으로 3 ÷ 18.6에 맞췄고, 직군별 구역의 크기는 데이터가 아니다. 빛 한 줄기의 이동 시간은 Jev가 발표한 응답 시간 범위에서 고른 도식이며 실제 호출이 아니다.
AGI 도달 여부를 위 사례만으로 판정하지 않는다. 사건 그림의 방·메모·통로는 실제 로그 화면이 아니라 설명용 비유다.
고양이는 기존 발표에 있던 사진이며 특정 역사적 논문의 시험 자료라고 주장하지 않는다.

## 2026-09-23 화면 재구성에서 새로 쓴 자료

| 장표 | 화면에 나오는 것 | 근거와 범위 |
| --- | --- | --- |
| 2~3 | 고양이 사진의 화소 부조, 금색 입자로 된 "고양이" | 기존 사진(`public/shots/cat1.png`, 550×378)을 2배로 다시 샘플링한 `cat1@2x.jpg`를 쓴다. 부조와 입자는 "사진 → 단어 하나"를 보여주는 연출이며 특정 인식 모델의 내부 값·신뢰도가 아니다. 숫자를 붙이지 않는다. |
| 3 | 실제 강의 영상과 음성 파형 | `public/demos/tts-lecture.mp4`(원본 00:25–00:49)와 같은 구간의 파형 `tts-waveform.json`. 소리는 끄고 재생한다. |
| 7 | 판매처 화면, 사람 확인, WebMCP 도구 세 줄 | Chrome 발표(2026.02.10)는 WebMCP를 "구조화된 도구를 사이트가 에이전트에게 제공하는 표준 방식"으로 소개하고, 선언형(HTML 폼)·명령형(JavaScript) 두 API와 전자상거래의 상품 구성·결제 탐색을 사용 예로 든다. 화면의 도구 이름(상품 검색·옵션 선택·주문하기)과 `store-a.example` 주소는 설명용 예시다. 사람 확인을 우회하는 장면으로 그리지 않는다. |
| 8 | 두 판매처, 광고판, 가격표로 흐르는 빛 | 금액·조건·광고판 문구는 가상 예시. 광고비가 가격으로 옮겨가는 빛은 발표자의 가설을 나타내는 연출이다. |
| 13 | 불 켜진 집과 30년 눈금 | 12번 마지막 정지 이미지(`public/house-scroll/a7.jpg`, Blender 렌더)를 그대로 이어 쓴다. 1995년생·31세는 발표자가 제시한 값이다. 눈금은 2026년 31세부터 2056년 61세까지다. |
| 15 | 대본·목소리·자막·영상 네 줄과 재생 헤드 | local-tts-engine의 `CH00 전체.timeline.json`에서 00:25–00:49 구간의 원문 문장, 읽기 문장(예: "AI가" → "에이아이가"), 단어 단위 정렬 시각을 뽑아 `src/keynote/data/tts-alignment.json`에 저장했다. 걸친 문장(앞 0.46초, 뒤 1.04초)은 흐리게 표시한다. 모델 표기는 같은 파일의 provider(`mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16`, 어댑터 `jaeho-ko-r16-v1`)를 따른다. 프레임 띠는 같은 영상에서 2초 간격으로 뽑았다(`public/demos/tts-strip.jpg`). |
| 16 | 많은 점, 느슨해지는 고리, 요구사항 표 | 점과 고리는 도식이며 사용자 수나 성능 수치가 아니다. 표의 "보통의 서비스" 쪽 문구(빠르게·늘 켜 두기 등)는 비교를 위한 일반적 표현이다. |
| 17 | 저 → Agent OS → Factory → 결과 → 저 | Agent OS와 전체 연결은 구상(점선·"구상" 표시), 엔진 세 개는 개발 중("개발 중" 표시). 결과 화면은 실제 강의 영상의 한 장면이다. |
| 20 | 세 결과물의 갤러리 | 21번 Blender 갤러리와 같은 배치(가운데 01 VOICE, 왼쪽 02 IMAGE, 오른쪽 03 MUSIC). 이미지 출처는 기존 갤러리와 같다. |

서비스 결과물의 원본 경로는 `public/demos/provenance.json`에 기록했다.
음악 후보는 project.json의 humanReview가 unreviewed이므로 발표에도 개발 후보로 표시했다.

## 악용 사례 구간 · 31~38번

| 내용 | 확인한 범위 | 근거 |
| --- | --- | --- |
| 제가 녹음한 적 없는 문장 (31) | 26번 강의 영상의 한 문장(원본 00:38.8–00:44.4)은 녹음이 아니라 대본을 `jaeho-ko-r16-v1` 어댑터로 읽힌 합성 음성이다(`CH00 전체.timeline.json`의 provider). | 로컬 `local-tts-engine/output/edits/2026-09-08/…/CH00 전체.timeline.json` |
| 12.3분 · 35.3초 · 약 67MB (31) | 승인한 92클립·12.252분 중 train 82개, rank 16 LoRA, 60 optimizer step, 학습 35.3초, 어댑터 약 67MB(2026-08-25 실행 기록). 과거 한 번의 실행이며 성능 보증이 아니다. 녹음·정제·청취 승인 시간은 포함하지 않는다고 화면과 대본에 밝힌다. | 로컬 `local-tts-engine/docs/DECISIONS.md` |
| 공개 모델의 "3초" (31, 29) | Qwen3-TTS 공개 저장소: "Base model capable of 3-second rapid voice clone from user audio input", 2026.1.22 공개, Apache-2.0. 개발사의 설명이며 발표에서 따로 검증하지 않았다. | [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS) (2026-09-23 열람) |
| 새벽의 사칭 전화 (35) | 번호·시각·자막 문장은 가상이다. "짧은 음성과 음성 복제 프로그램", 급하다는 재촉, 나만 도울 수 있다는 말, 비밀 요구는 FTC가 설명한 수법을 따랐다. 실제 사칭 음성을 만들거나 재생하지 않았다. | [FTC · 2023.09](https://consumer.ftc.gov/articles/scammers-use-fake-emergencies-steal-your-money) |
| 확인하는 방법 (38) | 재촉에 바로 응하지 않기, 알고 있는 번호로 다시 연락하기, 비밀로 하라고 해도 다른 가족에게 확인하기는 FTC 권고다. 다시 건 통화의 대사는 가상이다. | 같은 FTC 문서 |
| 현재 TTS 제작 과정 | Qwen3-TTS 생성 뒤 독립 Whisper 받아쓰기로 대본과 대조하고 재생성한다. STT는 말의 내용·누락을 확인하며 화자 신원이나 완벽한 음색 복제를 입증하지 않는다. 직접 듣고 고르는 과정이 별도로 있다. | 로컬 `local-tts-engine/docs/QUALITY.md` |
| 다음 모델과 사용 문턱 | Qwen 4·5는 다음 세대를 가정한 이름이다. 출시·성능에 대한 사실 주장이 아니다. 지금 어렵다는 설명은 발표자의 통합 제작 과정에 한정하며, 일반인이 아직 음성 복제를 할 수 없다는 뜻이 아니다. | 발표자의 경험과 전망 |
| 통화 녹음 | 기기·지역에 따라 기능이 다르다. 모든 휴대전화가 자동 녹음을 지원한다고 주장하지 않는다. | 조건부 가상 상황 |
| 익숙한 목소리로 사칭 | 가족을 사칭한 AI 음성 복제 사기와 음성 메시지 사칭이 이미 경고됐다. 알고 있던 번호나 다른 연락 경로로 확인하는 행동도 같은 출처에 근거한다. | [FTC](https://consumer.ftc.gov/articles/scammers-use-fake-emergencies-steal-your-money), [FBI](https://www.fbi.gov/investigate/cyber/alerts/2025/senior-us-officials-continue-to-be-impersonated-in-malicious-messaging-campaign) |
| 외도 증거를 가장한 음성 | 발표자가 제시한 가상 상황이며 확인된 사건으로 소개하지 않는다. 사칭·허위 증거·괴롭힘의 일반적인 위험은 Europol 보고서에 근거한다. | [Europol](https://www.europol.europa.eu/publications-events/publications/facing-reality-law-enforcement-and-challenge-of-deepfakes) |
| 동의 없는 합성 이미지·영상 | 일상 사진·영상을 성적인 내용으로 조작해 괴롭히거나 협박한 피해가 보고됐다. 2D·3D 도구가 불법이라고 주장하지 않으며, 당사자의 동의 없는 조작과 악용을 다룬다. | [FBI IC3 · 2023-06-05](https://www.ic3.gov/PSA/2023/PSA230605) |

화면의 파형·메시지·이미지 확산은 설명용 개념도다. 34번의 벽과 사람, 37번의 사진 칸과 "퍼진 사본" 숫자는 도식이며 실제 사람 수나 공유 수가 아니다. 37번의 사진은 모자이크한 가상의 인물을 코드로 그린 것이다. 35·36·38번의 휴대전화와 방은 Blender 렌더다. 배경 얼굴은 식별 가능한 실제 인물을 표현하지 않는 생성 이미지다. 실제 사칭 음성이나 유해한 합성물은 제작하지 않았다.

## 마무리 구간 · 40~43번

| 내용 | 확인한 범위 | 근거 |
| --- | --- | --- |
| 새벽과 아침의 집 (40~43) | 12번 Blender 장면의 마지막 구도(프레임 570)를 시간대만 바꿔 다시 렌더했다(`--time blue`·`--time sunrise`). 창의 불, 해의 방향, 대기는 연출이며 실제 장소가 아니다. | `tools/render-house-scroll.py`, `public/house-dawn/` |
| 바뀌는 것 · 모델 (40) | 지금 쓰는 모델은 Qwen3-TTS 1.7B Base다. "다음 모델"·"그다음 모델"은 가정이라고 화면에 표시한다. 2026 → 2056 축은 발표자의 30년 계획이다. | 로컬 `local-tts-engine/README.md`, `docs/DECISIONS.md` 라이선스 표 |
| 작업 방식 세 줄 (40) | 대본 → 목소리 → 받아쓰기 대조 → 다시 만들기는 현재 TTS 검수 과정이다. 앱 데모는 화면을 먼저 찍고 대본을 쓴 뒤 편집이 대본 길이에 화면을 맞춘다. 장면마다 목소리 후보를 만들고 사람이 듣고 고른다. | 로컬 `local-tts-engine/docs/QUALITY.md`, `docs/APP-DEMO-DESIGN.md` 2~3절 |
| 판단의 기록 네 개 (40) | 08.23 로컬 제작·A/B 청취로 Qwen 채택, 08.25 어댑터 강도 0.60, 09.03 같은 계열 자기평가 대신 독립 Whisper 판독, 09.21 영어 목소리 표본 미채택. 날짜는 모두 2026년이다. | 로컬 `local-tts-engine/docs/DECISIONS.md` |
| 결과물 네 장 (40) | 26번 강의 영상의 한 장면, 20번 갤러리와 같은 두 장(Local Assets Engine으로 만든 새 이미지, 실제 음악 후보의 파형을 표현한 Blender 장면 · 음악은 청취 승인 전 개발 후보), 12번 집 렌더. "43장"은 이 발표의 장표 수다. | `public/demos/provenance.json`, `PersonalSlides.tsx`, 이 덱 |
| 잘 안됐던 과정 여섯 줄 (41) | 09.21 화면 녹화 음성 포함 미사용(마이크 입력이 소리의 약 13%를 놓침, 09.18 측정). 09.21 영어 목소리 표본 미채택. 09.20 RICE가 "알아이씨이"로 들린다는 지적 → 철자를 `Rice`로 보내 해결("문제는 목소리가 아니라 철자였다"). 09.18 playwright 1.63.0에서 4K 프레임 95개 → 65개라 1.62.0 고정(3초짜리 합성 화면 시험, 각 3회 측정이며 강의 전체의 4K 성능 보증이 아니다. 화면에 "3초 시험"을 적었다). 09.09 영어 낱말 단위 전환 샘플 4개 모두 거절. 08.25 1.00 대신 0.60 채택. | 로컬 `local-tts-engine/docs/DECISIONS.md` |
| 함께할 사람의 점 (41) | 점과 선은 도식이며 실제 사람·연락처·협업 약속이 아니다. 동의 확인은 발표자의 약속이다. | 발표자의 계획 |
| 설계도 (42) | 실선 방(TTS·ASSETS·MUSIC)은 "개발 중", 점선 방(Agent OS)과 복도는 "구상"으로 표시한다. 17번의 구분과 같다. 방의 크기는 진척도가 아니다. | 16번과 같은 기준 |
| 만들기 · 맡기기 (43) | 기존 마지막 장의 질문(계속 미루던 제작, 반복해서 하는 작업)의 문구를 그대로 두고 큰 낱말만 붙였다. | 발표자의 질문 |

## 38 → 43장 확장에서 새로 쓴 자료 · 14·18·19·29·39·42번

확인일: 2026-09-23. 원문을 확인하지 못한 표현은 화면에 쓰지 않았다.

| 내용 | 확인한 범위 | 근거 |
| --- | --- | --- |
| 일은 선택이 된다 (14) | 화면 인용은 X 게시물 원문 그대로다: "AI+Robots will be able to do everything, resulting in universal high income. Work will be optional." 2026-07-02 UTC 15:13(한국 시각 7월 3일 0시 13분, 게시물 ID의 시각). @chamath에게 단 답글이다. 한국어는 직역("보편적 고소득")이며 "황금기", "모두가 고액연봉자" 같은 원문에 없는 표현은 쓰지 않는다. 인물 사진·게시물 화면을 흉내 낸 카드는 쓰지 않는다(루트 `elon.png` 미사용). | [X](https://x.com/elonmusk/status/2072700088481182100), [Unusual Whales · 2026.07.13](https://unusual-whales.ghost.io/unusual_blog/post/musk-ai-robots-universal-high-income-work-optional/) |
| 2035~2045? (14) | 2025-11-19 미국–사우디 투자 포럼(워싱턴 케네디 센터): "I don't know what long term is, maybe it's 10, 20 years or something like that. My prediction is that work will be optional." 눈금의 파란 구간은 발언 시점에서 10~20년 뒤(2035~2045)이며, 원문도 "그쯤"이라는 어림이다. | [Fox Business · 2025.11.19](https://www.foxbusiness.com/economy/elon-musk-predicts-work-optional-coming-decades) |
| 기본소득이 아니라 고소득 · 삶의 의미 (14, 대본) | VivaTech 2024(2024-05-23, 화상 연결): "In a benign scenario probably none of us will have a job", "universal high income—not universal base income", "The question will really be one of meaning." 대본에서만 말한다. | [CNN · 2024.05.23](https://www.cnn.com/2024/05/23/tech/elon-musk-ai-your-job), [Fortune · 2024.05.24](https://fortune.com/2024/05/24/elon-musk-future-work-jobs-hobbies-artificial-intelligence) |
| 과도기 · 두 낱말 (14) | 금색 구간(2026~2035)은 지금부터 예측의 시점까지를 나타낸 발표자의 도식이다. "다 할 수 있다 · 대체될 수 있다"는 발표자의 감정이며 사실 주장이 아니다. | 발표자의 관점 |
| 83% · 뇌 연결성 (14) | MIT 미디어랩 Kosmyna 외 "Your Brain on ChatGPT", arXiv 2506.08872(v1 2025-06-10, v2 2025-12-31). 참가자 54명(LLM·검색 엔진·도구 없음 세 그룹 각 18명), 32채널 EEG, 에세이 과제. 첫 회차 질문 3(자기 글 인용)에서 LLM 그룹 83.3%(15/18)가 인용하지 못했고 검색 엔진·도구 없음 그룹은 각각 11.1%(2/18)였다(v1 31쪽). 초록: "LLM users displayed the weakest connectivity", "LLM users also struggled to accurately quote their own work." 동료심사 전 공개 논문이며 에세이 과제 하나의 결과라고 화면에 함께 적는다. 인과를 일반화하지 않는다. | [arXiv](https://arxiv.org/abs/2506.08872), [프로젝트 안내](https://www.brainonllm.com/) |
| 공장 안의 스테이션 (18) | 각 엔진 README의 제작 모델. 목소리 Qwen3-TTS 1.7B Base + `jaeho-ko-r16-v1` LoRA 0.60, 받아쓰기 검수 Whisper large-v3-turbo(MLX FP16, 같은 계열 자기평가 대신 독립 판독 · 2026-09-03 결정), 이미지 FLUX.2 klein 4B(기본)·3D TRELLIS.2 Mac 포트, 음악 ACE-Step 1.5(native MLX), 업무 에이전트 RICE는 Ollama의 `qwen3.6:35b-a3b-q4_K_M`(2026-09-21 촬영 화면에 표시된 모델. RICE는 사용자가 Claude와 Ollama 중 하나를 고른다). 스테이션은 "개발 중", 요청을 자동으로 나누는 라우팅은 구현되지 않아 점선·"구상"으로 표시한다. 스테이션의 크기·배치·빛은 도식이다. | 로컬 `local-tts-engine/README.md`·`docs/QUALITY.md`·`docs/DECISIONS.md`, `local-assets-engine/README.md`, `local-music-engine/README.md`, `bob/rice/README.md`·`rice-runtime/src/rice_runtime/core/config.py`, RICE 촬영 기록 `output/edits/2026-09-21/rice-first-run/demo/script.json` |
| 디지털 월세 (18) | 2026-09-23 캡처 두 장에서 잘라낸 부분만 쓴다(`public/rent/`). Codex 앱 설정의 "Pro 플랜 ₩159,000/월"(ChatGPT 구독으로 관리). Claude "월간 지출 한도 · 이번 달 US$76 중 US$72.77", 이번 주 제품별 사용량 Claude Code 100%. Claude 요금제 구독료는 합계에 넣지 않았다. "월 20만원 이상"은 환율과 무관하게 참이다(₩159,000 + US$72.77). 영수증은 코딩 에이전트 사용분이며 TTS 같은 반복 생산의 비용이 아니다. 원본 캡처의 대화 목록(사이드바)은 잘라냈고 원본은 커밋하지 않는다. | 루트 `codex 지출.png`, `claude 지출.png`(원본 미커밋) |
| Compound AI System (18) | Berkeley BAIR(Zaharia 외, 2024-02-18) "The Shift from Models to Compound AI Systems": "A system that tackles AI tasks using multiple interacting components, including multiple calls to models, retrievers, or external tools." 화면 주석은 이 정의의 요약이다. | [BAIR](https://bair.berkeley.edu/blog/2024/02/18/compound-ai-systems/) |
| LLM 라우팅 수치 (18, 대본 예비) | RouteLLM(LMSYS, 2024-07-01): GPT-4 Turbo와 Mixtral 8x7B 사이 라우팅으로 GPT-4 성능의 95%를 유지하며 MT Bench 85% 이상, MMLU 45%, GSM8K 35% 비용 절감. 연구 환경의 수치라 화면에 쓰지 않고 질문이 나올 때만 말한다. | [LMSYS](https://lmsys.org/blog/2024-07-01-routellm/) |
| 세 가지 베팅 (19) | 발표자의 판단이라고 화면에 표시한다. 시장 규모·수익 전망 수치를 붙이지 않는다. 스테이션이 새 것으로 바뀌는 장면은 도식이다. | 발표자의 판단 |
| 가장 구린 모델 (29) | Kevin Weil(당시 OpenAI 최고제품책임자), Lenny's Podcast 2025-04-10, 01:16:27: "The AI models that you're using today is the worst AI model you will ever use for the rest of your life." 같은 계열의 말로 Ethan Mollick 『Co-Intelligence』(2024)의 원칙 "Assume this is the worst AI you will ever use"가 있다. 화면의 한국어는 발표자의 옮김이다. | [Lenny's Newsletter](https://www.lennysnewsletter.com/p/kevin-weil-open-ai) |
| 고양이 회수 (29) | 2~3번과 같은 사진·입자 연출을 다시 쓴다. 고양이 사진에 연도를 붙이지 않는다. "1년 뒤? 2년 뒤?"는 질문이며 예측 수치가 아니다. | 2~3번 행과 같음 |
| 해마다 10배 (29) | a16z Guido Appenzeller "Welcome to LLMflation"(2024-11-12): "For an LLM of equivalent performance, the cost is decreasing by 10x every year." MMLU 42점을 내는 가장 싼 모델 기준 2021-11 GPT-3 100만 토큰당 60달러 → Llama 3.2 3B 0.06달러(3년 1,000배). MMLU 83점 기준으로는 GPT-4 출시 뒤 약 62배. 투자사의 추정이며 기준에 따라 폭이 크게 다르다고 화면에 함께 적는다. | [a16z](https://a16z.com/llmflation-llm-inference-cost/) |
| 신에게 목줄 (39) | 발표자의 질문이다(어디서 들은 이야기에 발표자의 생각을 더한 것). 출처를 붙이지 않고 "발표자의 질문"으로 표시한다. 낱말이 모여 사람의 형태가 되는 장면은 비유다. | 발표자의 질문 |
| 언어 모델에서 출발한 로봇 (39) | Google DeepMind(2025-03-12): Gemini Robotics는 "advanced vision-language-action (VLA) model that was built on Gemini 2.0 with the addition of physical actions as a new output modality for the purpose of directly controlling robots." | [Google DeepMind](https://deepmind.google/discover/blog/gemini-robotics-brings-ai-into-the-physical-world/) |
| 악마를 소환하는 일 (39, 대본) | MIT AeroAstro 100주년 심포지엄(2014-10-24): "With artificial intelligence, we are summoning the demon. … he's sure he can control the demon? It doesn't work out." 화면에는 쓰지 않는다. | [Washington Post · 2014.10.24](https://www.washingtonpost.com/news/innovations/wp/2014/10/24/elon-musk-with-artificial-intelligence-we-are-summoning-the-demon/) |
| RICE (42) | README 한 줄: "일하며 만든 업무 방식을 재사용 가능한 자산으로 축적하고, 검증된 자산을 조직 실행으로 확장하는 AI 업무 시스템". 같은 줄의 괄호 속 사내용 표기는 인용하지 않는다(오픈소스 공개 예정). | 로컬 `bob/rice/README.md` |
| RICE 소개 영상 (42) | 29.16초 전체를 1280×720으로 다시 인코딩했다(`public/demos/rice-demo.mp4`, 포스터는 6초 지점). Local TTS Engine의 앱 데모 과정으로 화면을 찍고 대본을 붙이고 발표자의 목소리로 만든 결과이며 2026-09-21 목소리 승인. 화면에서는 소리를 끈 채 재생한다. | 로컬 `local-tts-engine/output/edits/2026-09-21/rice-first-run/`, `docs/DECISIONS.md`, `public/demos/provenance.json` |
| Personal CIO (42) | README 문장: "좋은 모델일수록 더 나은 판단을 하도록 데이터와 과거 평가를 로컬 자산으로 남긴다. GPT와 Claude를 포함한 모델은 교체할 수 있고…", 역할 표 "사용자 · … 실제 주문을 최종 결정한다", "실제 주문 기능은 없으며". 거래내역·수익률·종목은 화면에 쓰지 않는다. | 로컬 `/Users/jaehoseo/Desktop/vswrk/money/README.md` |
| 조합과 사무직의 빈 방 (42) | 영상 공장 × Personal CIO 같은 조합과 엑셀·브라우저·PDF↔PPT·문서 가로↔세로 방은 "가능성"·"가정"으로 표시한 발표자의 구상이다. 유료 종목 토론방, 데이터 판매, 수익화 계획은 다루지 않는다. | 발표자의 구상 |
| 무대에서 뺀 것 | 유료 종목 토론방·리딩방: 2024-08-14 시행 개정 자본시장법은 SNS·오픈채팅방 같은 양방향 채널의 유료 회원제 영업을 투자자문업으로 규율한다(유사투자자문업 신고만으로는 할 수 없고 등록이 필요). 사기 구간과 겹쳐 오해를 부르므로 무대에서 다루지 않는다. | [KDI 경제교육·정보센터(금융위원회 안내)](https://eiec.kdi.re.kr/policy/materialView.do?num=250091), [머니투데이 · 2024.04](https://news.mt.co.kr/mtview.php?no=2024040620354931326) |
