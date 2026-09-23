# 발표 사례의 근거

확인일: 2026-09-22. 본문에서는 현상과 관찰을 짧게 말하고, 해석은 발표자 관점으로 구분한다.

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
| 13 | 불 켜진 집과 30년 눈금 | 12번 마지막 정지 이미지(`public/house-scroll/a7.jpg`, Blender 렌더)를 그대로 이어 쓴다. 1995년생·32세는 발표자가 제시한 값이다(만 나이로는 생일에 따라 31세일 수 있다). |
| 14 | 대본·목소리·자막·영상 네 줄과 재생 헤드 | local-tts-engine의 `CH00 전체.timeline.json`에서 00:25–00:49 구간의 원문 문장, 읽기 문장(예: "AI가" → "에이아이가"), 단어 단위 정렬 시각을 뽑아 `src/keynote/data/tts-alignment.json`에 저장했다. 걸친 문장(앞 0.46초, 뒤 1.04초)은 흐리게 표시한다. 모델 표기는 같은 파일의 provider(`mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16`, 어댑터 `jaeho-ko-r16-v1`)를 따른다. 프레임 띠는 같은 영상에서 2초 간격으로 뽑았다(`public/demos/tts-strip.jpg`). |
| 15 | 많은 점, 느슨해지는 고리, 요구사항 표 | 점과 고리는 도식이며 사용자 수나 성능 수치가 아니다. 표의 "보통의 서비스" 쪽 문구(빠르게·늘 켜 두기 등)는 비교를 위한 일반적 표현이다. |
| 16 | 저 → Agent OS → Factory → 결과 → 저 | Agent OS와 전체 연결은 구상(점선·"구상" 표시), 엔진 세 개는 개발 중("개발 중" 표시). 결과 화면은 실제 강의 영상의 한 장면이다. |
| 17 | 세 결과물의 갤러리 | 18번 Blender 갤러리와 같은 배치(가운데 01 VOICE, 왼쪽 02 IMAGE, 오른쪽 03 MUSIC). 이미지 출처는 기존 17번과 같다. |

서비스 결과물의 원본 경로는 `public/demos/provenance.json`에 기록했다.
음악 후보는 project.json의 humanReview가 unreviewed이므로 발표에도 개발 후보로 표시했다.

## 악용 사례 구간 · 27~34번

| 내용 | 확인한 범위 | 근거 |
| --- | --- | --- |
| 제가 녹음한 적 없는 문장 (27) | 23번 강의 영상의 한 문장(원본 00:38.8–00:44.4)은 녹음이 아니라 대본을 `jaeho-ko-r16-v1` 어댑터로 읽힌 합성 음성이다(`CH00 전체.timeline.json`의 provider). | 로컬 `local-tts-engine/output/edits/2026-09-08/…/CH00 전체.timeline.json` |
| 12.3분 · 35.3초 · 약 67MB (27) | 승인한 92클립·12.252분 중 train 82개, rank 16 LoRA, 60 optimizer step, 학습 35.3초, 어댑터 약 67MB(2026-08-25 실행 기록). 과거 한 번의 실행이며 성능 보증이 아니다. 녹음·정제·청취 승인 시간은 포함하지 않는다고 화면과 대본에 밝힌다. | 로컬 `local-tts-engine/docs/DECISIONS.md` |
| 공개 모델의 "3초" (27) | Qwen3-TTS 공개 저장소: "Base model capable of 3-second rapid voice clone from user audio input", 2026.1.22 공개, Apache-2.0. 개발사의 설명이며 발표에서 따로 검증하지 않았다. | [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS) (2026-09-23 열람) |
| 새벽의 사칭 전화 (31) | 번호·시각·자막 문장은 가상이다. "짧은 음성과 음성 복제 프로그램", 급하다는 재촉, 나만 도울 수 있다는 말, 비밀 요구는 FTC가 설명한 수법을 따랐다. 실제 사칭 음성을 만들거나 재생하지 않았다. | [FTC · 2023.09](https://consumer.ftc.gov/articles/scammers-use-fake-emergencies-steal-your-money) |
| 확인하는 방법 (34) | 재촉에 바로 응하지 않기, 알고 있는 번호로 다시 연락하기, 비밀로 하라고 해도 다른 가족에게 확인하기는 FTC 권고다. 다시 건 통화의 대사는 가상이다. | 같은 FTC 문서 |
| 현재 TTS 제작 과정 | Qwen3-TTS 생성 뒤 독립 Whisper 받아쓰기로 대본과 대조하고 재생성한다. STT는 말의 내용·누락을 확인하며 화자 신원이나 완벽한 음색 복제를 입증하지 않는다. 직접 듣고 고르는 과정이 별도로 있다. | 로컬 `local-tts-engine/docs/QUALITY.md` |
| 다음 모델과 사용 문턱 | Qwen 4·5는 다음 세대를 가정한 이름이다. 출시·성능에 대한 사실 주장이 아니다. 지금 어렵다는 설명은 발표자의 통합 제작 과정에 한정하며, 일반인이 아직 음성 복제를 할 수 없다는 뜻이 아니다. | 발표자의 경험과 전망 |
| 통화 녹음 | 기기·지역에 따라 기능이 다르다. 모든 휴대전화가 자동 녹음을 지원한다고 주장하지 않는다. | 조건부 가상 상황 |
| 익숙한 목소리로 사칭 | 가족을 사칭한 AI 음성 복제 사기와 음성 메시지 사칭이 이미 경고됐다. 알고 있던 번호나 다른 연락 경로로 확인하는 행동도 같은 출처에 근거한다. | [FTC](https://consumer.ftc.gov/articles/scammers-use-fake-emergencies-steal-your-money), [FBI](https://www.fbi.gov/investigate/cyber/alerts/2025/senior-us-officials-continue-to-be-impersonated-in-malicious-messaging-campaign) |
| 외도 증거를 가장한 음성 | 발표자가 제시한 가상 상황이며 확인된 사건으로 소개하지 않는다. 사칭·허위 증거·괴롭힘의 일반적인 위험은 Europol 보고서에 근거한다. | [Europol](https://www.europol.europa.eu/publications-events/publications/facing-reality-law-enforcement-and-challenge-of-deepfakes) |
| 동의 없는 합성 이미지·영상 | 일상 사진·영상을 성적인 내용으로 조작해 괴롭히거나 협박한 피해가 보고됐다. 2D·3D 도구가 불법이라고 주장하지 않으며, 당사자의 동의 없는 조작과 악용을 다룬다. | [FBI IC3 · 2023-06-05](https://www.ic3.gov/PSA/2023/PSA230605) |

화면의 파형·메시지·이미지 확산은 설명용 개념도다. 30번의 벽과 사람, 33번의 사진 칸과 "퍼진 사본" 숫자는 도식이며 실제 사람 수나 공유 수가 아니다. 33번의 사진은 모자이크한 가상의 인물을 코드로 그린 것이다. 31·32·34번의 휴대전화와 방은 Blender 렌더다. 배경 얼굴은 식별 가능한 실제 인물을 표현하지 않는 생성 이미지다. 실제 사칭 음성이나 유해한 합성물은 제작하지 않았다.
