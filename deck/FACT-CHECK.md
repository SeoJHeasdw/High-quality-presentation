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
| Jev | TypeSafe AI가 2026.09.15 공개. 구조화된 판단 값, 개발사 제시 응답 시간 70–500ms. 속도 보장이나 투자 수익으로 확대하지 않음. | [개발사 발표](https://typesafe.ai/blog/introducing-system-one-models-and-jev) |

가격 인하가 광고보다 유리해질 가능성과 실시간 주식 트레이딩은 발표자의 미래 응용 가설이다.
AGI 도달 여부를 위 사례만으로 판정하지 않는다. 사건 그림의 방·메모·통로는 실제 로그 화면이 아니라 설명용 비유다.
고양이는 기존 발표에 있던 사진이며 특정 역사적 논문의 시험 자료라고 주장하지 않는다.

서비스 결과물의 원본 경로는 `public/demos/provenance.json`에 기록했다.
음악 후보는 project.json의 humanReview가 unreviewed이므로 발표에도 개발 후보로 표시했다.

## 악용 사례 구간 · 27~33번

| 내용 | 확인한 범위 | 근거 |
| --- | --- | --- |
| 현재 TTS 제작 과정 | Qwen3-TTS 생성 뒤 독립 Whisper 받아쓰기로 대본과 대조하고 재생성한다. STT는 말의 내용·누락을 확인하며 화자 신원이나 완벽한 음색 복제를 입증하지 않는다. 직접 듣고 고르는 과정이 별도로 있다. | 로컬 `local-tts-engine/docs/QUALITY.md` |
| 다음 모델과 사용 문턱 | Qwen 4·5는 다음 세대를 가정한 이름이다. 출시·성능에 대한 사실 주장이 아니다. 지금 어렵다는 설명은 발표자의 통합 제작 과정에 한정하며, 일반인이 아직 음성 복제를 할 수 없다는 뜻이 아니다. | 발표자의 경험과 전망 |
| 통화 녹음 | 기기·지역에 따라 기능이 다르다. 모든 휴대전화가 자동 녹음을 지원한다고 주장하지 않는다. | 조건부 가상 상황 |
| 익숙한 목소리로 사칭 | 가족을 사칭한 AI 음성 복제 사기와 음성 메시지 사칭이 이미 경고됐다. 알고 있던 번호나 다른 연락 경로로 확인하는 행동도 같은 출처에 근거한다. | [FTC](https://consumer.ftc.gov/articles/scammers-use-fake-emergencies-steal-your-money), [FBI](https://www.fbi.gov/investigate/cyber/alerts/2025/senior-us-officials-continue-to-be-impersonated-in-malicious-messaging-campaign) |
| 외도 증거를 가장한 음성 | 발표자가 제시한 가상 상황이며 확인된 사건으로 소개하지 않는다. 사칭·허위 증거·괴롭힘의 일반적인 위험은 Europol 보고서에 근거한다. | [Europol](https://www.europol.europa.eu/publications-events/publications/facing-reality-law-enforcement-and-challenge-of-deepfakes) |
| 동의 없는 합성 이미지·영상 | 일상 사진·영상을 성적인 내용으로 조작해 괴롭히거나 협박한 피해가 보고됐다. 2D·3D 도구가 불법이라고 주장하지 않으며, 당사자의 동의 없는 조작과 악용을 다룬다. | [FBI IC3 · 2023-06-05](https://www.ic3.gov/PSA/2023/PSA230605) |

화면의 파형·메시지·이미지 확산은 설명용 개념도다. 배경 얼굴은 식별 가능한 실제 인물을 표현하지 않는 생성 이미지다. 실제 사칭 음성이나 유해한 합성물은 제작하지 않았다.
