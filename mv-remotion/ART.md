# 뮤비 2 — 아트 바이블과 편집표

`감성 힙합 초안`(180초, 87.5 BPM, 65마디)에 맞춘 Remotion 뮤비. Blender 없이 React + SVG로만 그린다.
이야기는 예전 뮤비(`../mv/README.md`의 표)와 같다. 바뀐 것은 **그리는 법**이다.

## 1. 예전 뮤비에서 고친 것 — 이 문서의 모든 규칙은 이 여섯 가지에서 나온다

| 예전 | 여기서는 |
| --- | --- |
| 3분 내내 같은 남보라(hue 235~245°), 화면 절반이 밝기 20/255 이하 | **컬러 스크립트**(`src/lib/palette.ts`의 `K`). 감정이 바뀌는 곳마다 색이 바뀐다. 하늘(빛)은 밝게 |
| 아이가 배경에 묻힘(후드 L* 24, 하늘 L* 13) | 인물은 **어두운 실루엣**, 하늘은 밝다. 명암 차가 가장 큰 곳 = 시선이 갈 곳 |
| 종 모양 몸이라 포즈가 실루엣으로 안 읽힘 | 팔·다리·후드 꼬리가 있는 실루엣 뼈대(`src/kid`). **검게 칠해도 동작이 읽혀야 한다** |
| 4컷이 같은 와이드(카메라 배율만 1.0~1.32) | 핵심 순간마다 **거리·각도를 바꾼다**: 익스트림 와이드 / 와이드 / 미디엄 / 클로즈업 / 인서트 / 올려다보기 / 내려다보기 |
| 컷 40개가 전부 1·2·3마디, 모두 마디 첫 박 | 컷 길이를 **반 박~2마디로 섞는다**. 긴장 구간은 짧게, 감정의 정점은 길게. 박 중간에도 자른다 |
| 붓질 필터(형태와 무관한 붓결) | 필터 대신 **층(깊이)·빛·공기 원근·심도**. 마감은 필름 입자와 비네트 |

## 2. 규칙

1. **명암**: 프레임마다 가장 밝은 것과 가장 어두운 것이 있어야 한다. 실루엣은 `k.sil`, 빛은 `k.moon`·`k.accent`·`k.glow`. 화면이 전체적으로 어두운 컷(폭풍·어둠 속 폰)도 빛나는 점 하나는 둔다.
2. **실루엣 우선**: 인물은 `<Kid>`로만 그린다. 테두리 빛(`rim`)은 빛이 오는 방향(`dx, dy`)으로. 포즈는 옆모습이 기본이고, 실루엣이 잘 읽히는 각도를 고른다(팔이 몸 앞에 겹치면 안 읽힌다).
3. **얼굴은 빛이 있을 때만**: `face`(0..1)와 `faceColor`. 폰 = 차가운 색(`k.cold`), 나방·달 = 금빛(`k.accent`·`k.moon`). 얼굴이 보이는 순간이 감정이 보이는 순간이다. 남발하지 않는다.
4. **차가운 빛 = 기계·고립, 금빛 = 사람·마음**. 폰 화면, 창의 푸른 깜빡임, 번개는 차갑다. 나방, 달, 실은 금빛이다. 이야기의 갈등은 이 두 빛의 싸움이다.
5. **화면에 글자를 넣지 않는다.**
6. **움직임**: 직선 등속 이동을 쓰지 않는다. `kf`의 `expoOut`(빠르게 들어와 오래 멈춤), `back`(살짝 넘쳤다 자리 잡음), `springStep`(튕김)을 쓴다. 큰 동작 앞에는 예비동작(웅크림), 뒤에는 2차 동작(후드 꼬리 `swing`, 목도리)을 둔다. 걷기·달리기는 `gait(거리 / (s × STRIDE))`로 발이 미끄러지지 않게 한다.
7. **카메라**: 거의 모든 컷에 약한 `handheld()`를 건다. 시차를 위해 층을 세 개 이상 쓴다(하늘 Infinity, 먼 도시 5~14, 주인공 1, 전경 0.4~0.7). 전경을 카메라 앞으로 흐리게 지나가게 하면 깊이가 생긴다.
8. **박자**: 큰 동작(착지·잡기·번쩍임)은 박에 떨어뜨린다(`beat(i)`). `c.pulse`(박마다 튀는 값)는 빛의 숨쉬기에만 약하게 쓴다. 모든 것을 박에 흔들면 싸 보인다.
9. **매치컷**: 같은 모양으로 장면을 잇는다. 폰 화면 ↔ 창(사각형 빛), 달 ↔ 빛 구슬(원), 1번 도시 ↔ 65번 도시(같은 구도, 차가움 → 따뜻함).

## 3. 키트 (`src/lib`, `src/kid`) — 막 파일에서는 고치지 말고 가져다 쓴다

```tsx
import { Layer, Scene, Screen, project, unproject, type Cam } from "../lib/camera";   // 깊이 층·카메라
import { K } from "../lib/palette";                                                  // 컬러 스크립트
import { B, beat } from "../lib/song";                                               // 마디·박 → 초
import { clamp, ease, handheld, kf, lin, mix, mixc, mixhex, rnd, smooth, springStep, n2 } from "../lib/math";
import { SkyBackdrop, CityLayers, RoofSet } from "../lib/sets";                      // 무대 묶음
import { Glow, GodRays, Moon, SkyFill, Stars, Cloud, CloudBank, Wisp, Lightning, Rain } from "../lib/sky";
import { Skyline, Facade, WindowFrame, Parapet, Antenna, WaterTank, Laundry, Bed, Curtain } from "../lib/city";
import { Moths, Thread, Burst, swarm, stream, toward, type M } from "../lib/moths";
import { Kid, ikArm, skeleton } from "../kid/rig";
import { P, pose, lerpPose, poseSeq, gait, climb, STRIDE } from "../kid/pose";
```

- **컷 하나** = `{ id, start, key, enter, render: (c) => <Scene cam={...}>…</Scene> }`. `c.lt`는 컷 안 시각, `c.t`는 곡 시각, `c.dur`, `c.p`, `c.pulse`, `c.beat`. 순수 함수여야 한다(상태·useState 금지).
- **Scene / Layer**: `<Scene cam={{x, y, zoom, rot, focus, dof}}>` 안에 `<Layer d={깊이}>`를 뒤에서 앞 순서로 쌓는다. 좌표는 깊이 1·줌 1일 때 화면 px(1920×1080). `d=Infinity`는 움직이지 않는다. `focus`에서 먼 층은 자동으로 흐려진다(`dof` 세기, 와이드는 0.5~2, 클로즈업은 6~12). 빛 층은 `blend="screen"`.
- **아이**: `<Kid pose={pose({...P.leap, x, y, s, facing})} sil={k.sil} rim={{dx, dy, color: k.rim}} />`. `variant="friend"`, `accent={K.chorus.accent}`(분홍 방울)이 친구다. 자세 목록은 `src/kid/pose.ts`의 `P`, 각도 규칙도 그 파일 머리말에 있다. `skeleton(pose)`로 손·머리의 세계 좌표를 얻어 폰·실·다른 손을 붙인다. `ikArm(pose, 0|1, x, y)`는 손을 한 점에 닿게 한다.
- **나방**: `<Moths t={c.t} at={(t) => swarm(...) | stream(...) | toward(...)} trail={n} />`. `at`은 시각의 함수다(꼬리는 과거 시각을 다시 계산한다). 떼 50~120마리, 줄기 20~60마리 정도가 적당하다.
- **전환**은 `enter`로만 건다: `cut`·`flash`·`dip`·`white`·`cross`·`whip`·`iris`(자세한 뜻은 `src/shots/types.ts`).
- **기준 장면**: `src/shots/act2a.tsx`(0:44~0:55, 7컷). 카메라 거리 바꾸기, 예비동작, 박에 맞춘 충격, 먼지, 얼굴 빛, 원근으로 뻗는 팔의 예가 모두 있다. **먼저 읽는다.**

## 4. 편집표 (67컷)

박 번호 → 시각은 `beat(i)`, 마디 첫 박은 `B(n) = beat(2 + 4n)`. 한 박 ≈ 0.683초, 한 마디 ≈ 2.74초.
구간 경계: B(4)=13.69 · B(8)=24.70 · B(15)=44.00 · B(19)=54.97 · B(24)=68.73 · B(28)=79.55 · B(44)=123.33 · B(48)=134.35 · B(60)=167.34 · B(64)=178.35.
거리: EWS 익스트림 와이드 · WS 와이드 · MS 미디엄 · CU 클로즈업 · ECU 익스트림 클로즈업 · INS 인서트 · OTS 어깨 너머 · POV 시점.

### 1막 · 외로운 밤 → 나방 → 지붕 (0:00–0:44) — `act1.tsx`

| # | id | 시작 → 끝 | 키 | 들어옴 | 화면 |
| --- | --- | --- | --- | --- | --- |
| 1 | a1-city | 0 → B(1) | lonely | cut | EWS 높은 곳에서 본 밤 도시. 창 수백 개 중 하나로 천천히 다가간다. 그 창만 폰 빛으로 차갑게 깜빡인다 |
| 2 | a1-room | B(1) → B(2) | lonely | cut | MS 방 안. 밝은 창(달빛 도시)을 등진 옆모습 실루엣이 침대에 앉아 있다. 폰 빛만 얼굴에. 천천히 밀어 들어감 |
| 3 | a1-screen | B(2) → beat(12) | lonely | cut | ECU 두 손의 폰과 차갑게 빛나는 얼굴. 스크롤하는 깜빡임 |
| 4 | a1-tap | beat(12) → B(3) | lonely | cut | INS 유리창 가득. 밖에서 나방이 박마다 유리를 두드린다(톡 할 때마다 유리에 금빛 번짐). 3번의 폰 사각형과 매치컷 |
| 5 | a1-lookup | B(3) → B(4) | lonely | cut | OTS 뒤에서. 아이가 폰에서 창으로 고개를 돌리고 일어선다. 나방이 창밖에서 빛난다 |
| 6 | a1-open | B(4) → beat(20) | moths | flash | WS 창이 활짝 열리고 커튼이 부풀며 나방이 쏟아져 들어온다. 방이 금빛으로 찬다 |
| 7 | a1-swirl | beat(20) → beat(22) | moths | cut | CU 나방이 머리 둘레를 돈다. 처음으로 얼굴이 금빛으로 밝다. 눈이 커지고 웃는다 |
| 8 | a1-spin | beat(22) → B(6) | moths | cut | WS 팔을 벌리고 도는 아이와 소용돌이치는 나방. 침대 위 폰은 홀로 차갑게 빛난다 |
| 9 | a1-finger | B(6) → beat(30) | moths | cut | ECU 든 손끝. 나방 한 마리가 박(28)에 앉는다. 얕은 심도, 뒤에 나방 보케 |
| 10 | a1-sill | beat(30) → B(8) | moths | cut | MS(밖에서) 나방이 창밖으로 나가고, 창틀에 올라선 아이가 창에 액자처럼 걸린다 |
| 11 | a1-climb | B(8) → B(10) | roof | cut | WS 긴 테이크. 건물 벽(배수관)을 타고 지붕으로. 카메라가 따라 올라간다(지나가는 창 몇 개는 폰 빛으로 차갑다) |
| 12 | a1-roofwide | B(10) → B(11) | roof | cut | EWS 밝은 블루아워 지평선 앞 지붕 실루엣과 작은 아이. 빨랫줄·안테나 |
| 13 | a1-walk | B(11) → B(12) | roof | cut | MS 옆 트래킹 걸음. 전경의 안테나·빨래가 흐리게 지나간다. 나방이 앞장선다 |
| 14 | a1-stop | B(12) → B(13) | roof | cut | 낮은 각도 뒤에서. 멈춰 선 아이, 나방이 위로 날아오르고 고개가 따라 든다(후드 꼬리 흔들림) |
| 15 | a1-moon | B(13) → B(14) | roof | cross | 카메라가 위로 틸트해 거대한 달을 드러낸다. 나방의 빛 꼬리가 달로 오른다 |
| 16 | a1-wonder | B(14) → B(15) | roof | cut | CU 달빛(금빛)을 받은 얼굴. 눈이 커지고 입이 "o" → 작은 미소 |

### 2막 앞 · 첫 도전과 실패 (0:44–0:55) — `act2a.tsx` (기준 장면, 완성)

17 a2-measure(OTS 달 재기) · 18 a2-scuff(INS 발 구르기, 한 박) · 19 a2-run(옆 트래킹 도움닫기) · 20 a2-leap(아래에서, 달을 등진 도약) · 21 a2-apex(EWS, 정점에서 떨어짐) · 22 a2-plop(엉덩방아) · 23 a2-phone(폰의 차가운 빛 위에 나방)

### 2막 뒤 · 나방 사다리와 브레이크 (0:55–1:19) — `act2b.tsx`

| # | id | 시작 → 끝 | 키 | 들어옴 | 화면 |
| --- | --- | --- | --- | --- | --- |
| 24 | a2-gather | B(19) → B(20) | hope | flash | EWS 지붕 위. 도시 곳곳(창·거리)에서 나방 줄기가 모여들어 달 쪽으로 쌓이기 시작한다 |
| 25 | a2-rungs | B(20) → B(21) | hope | cut | CU 사다리가 조립된다. 난간 두 줄과 발판(나방 한 마리 = 발판 하나)이 8분음마다 차례로 붙으며 화면 위로 이어진다 |
| 26 | a2-climb | B(21) → B(22) | hope | cut | WS 낮은 각도. 한 박에 한 칸씩 오른다(`climb(박)`). 사다리가 달로 향한다 |
| 27 | a2-vertigo | B(22) → beat(90) | hope | cut | POV 아래. 까마득한 도시, 깊이로 줄어드는 발판. 약한 돌리 줌 |
| 28 | a2-wobble | beat(90) → B(23) | hope | cut | MS 휘청, 난간을 꽉 잡는다. 발판 나방들이 밝아져 받쳐 준다. 숨을 고른다 |
| 29 | a2-higher | B(23) → B(24) | hope | cut | WS 더 높이. 사다리가 아래로 아득하다. 천천히 뒤로 빠진다 |
| 30 | a2-lookback | B(24) → B(26) | quiet | dip | 긴 테이크(5.5초). 소리가 빠진다. 사다리 위에서 어깨 너머로 돌아본다. 저 아래 자기 방 창 하나가 폰 빛으로 차갑다. 그 창으로 천천히 밀어 들어감 |
| 31 | a2-pocket | B(26) → B(27) | quiet | cut | CU 손. 폰(차가운 빛)을 보다가 끄고 주머니에 넣는다. 차가운 빛이 꺼진다 |
| 32 | a2-resolve | B(27) → B(28) | quiet→chorus | cut | MS 낮은 각도. 위를 보는 아이. 달이 점점 밝아져 끝에서 화면이 하얗게 찬다(다음 컷이 white로 들어옴) |

### 3막 · 날아오름과 친구 (1:19–2:03) — `act3.tsx`

| # | id | 시작 → 끝 | 키 | 들어옴 | 화면 |
| --- | --- | --- | --- | --- | --- |
| 33 | a3-thread | B(28) → B(29) | chorus | white | EWS 달이 빛의 실(`Thread`)을 사다리 꼭대기의 아이에게 내려 준다 |
| 34 | a3-grab | B(29) → beat(120) | chorus | cut | CU 손이 박에 실을 잡는다(`Burst`) |
| 35 | a3-liftoff | beat(120) → B(30) | chorus | cut | 실이 아이를 휙 끌어 올린다(늘어남). 사다리가 나방 소용돌이로 풀린다 |
| 36 | a3-flyover | B(30) → B(32) | chorus | cut | 긴 비행(2마디). 옆에서 따라가는 카메라, 도시 층이 휙휙 지나가는 시차, 창 불빛 보케, 나방 꼬리 |
| 37 | a3-windows | B(32) → B(33) | chorus | cut | 빠르게 스치는 창의 벽. 창마다 폰 빛에 갇힌 외로운 실루엣 |
| 38 | a3-whip | B(33) → beat(134) | chorus | whip | 휙 패닝이 한 창에서 멈춘다: 분홍 방울의 친구 |
| 39 | a3-friend | beat(134) → B(34) | chorus | cut | CU 창 안의 친구. 폰 빛에 차가운 얼굴, 혼자. 2번 컷의 거울 구도 |
| 40 | a3-tap | B(34) → B(35) | chorus | cut | 나방이 유리를 두드린다(4번의 거울). 친구가 고개를 든다. 창밖에 실을 잡고 떠 있는 아이가 손을 흔든다 |
| 41 | a3-hesitate | B(35) → B(36) | chorus | cut | 창이 열린다. 친구는 폰(차가운 빛)과 내민 손(금빛)을 번갈아 본다. 얼굴 반은 차갑고 반은 따뜻하다 |
| 42 | a3-hands | B(36) → B(38) | chorus | cut | ECU 두 손이 다가간다(2마디, 감정의 정점이라 길게). B(37)에 손끝이 닿고 금빛이 터지며 손이 맞잡힌다 |
| 43 | a3-together | B(38) → B(39) | chorus | cut | WS 손잡고 함께 창을 나와 길 위로 솟는다. 나방이 따른다 |
| 44 | a3-spiral | B(39) → B(40) | chorus | cut | 올려다보는 각도. 둘이 나선을 그리며 구름층을 향해 오른다 |
| 45 | a3-moonpass | B(40) → B(42) | chorus | flash | 구름을 뚫고 열린 하늘. 거대한 달 앞을 두 실루엣이 가로지른다 |
| 46 | a3-halo | B(42) → B(44) | chorus→silver | cut | 달 둘레를 돈다. 나방이 후광 고리를 만든다. 구름 바다 쪽으로 미끄러지며 긴 테이크 |

### 4막 · 구름 위, 폭풍, 떨어짐 (2:03–2:30) — `act4.tsx`

| # | id | 시작 → 끝 | 키 | 들어옴 | 화면 |
| --- | --- | --- | --- | --- | --- |
| 47 | a4-sit | B(44) → beat(182) | silver | cross | WS 구름 끝에 나란히 걸터앉아 다리를 흔든다(`P.sitEdge`). 은빛, 고요 |
| 48 | a4-peek | beat(182) → B(46) | silver | cut | POV 구름 틈 아래로 좁은 길 하나를 사이에 두고 마주 보는 두 창 |
| 49 | a4-realize | B(46) → beat(190) | silver | cut | MS 서로를 본다. 이웃이었다. 웃음(달빛 얼굴), 몸이 튄다 |
| 50 | a4-hint | beat(190) → B(48) | silver→storm | cut | 먼 지평선에 번개가 깜빡인다. 바람이 인다. 색이 빠지기 시작한다 |
| 51 | a4-hop | B(48) → B(50) | storm | flash | 옆 트래킹. 구름 징검다리를 함께 뛴다(착지마다 박). 오른쪽에서 검은 구름이 밀려온다 |
| 52 | a4-strike | B(50) → beat(202) | storm | cut | 번개가 내리친다. 하얀 번쩍임, 나방이 사방으로 흩어진다 |
| 53 | a4-slip | beat(202) → B(51) | storm | cut | CU 맞잡은 손가락이 미끄러져 떨어진다(느리게) |
| 54 | a4-fall | B(51) → B(52) | storm | cut | 위에서 내려다봄. 친구가 검은 구름 속으로 작아지며 떨어진다. 위에서 손을 뻗는 아이 |
| 55 | a4-dive | beat(210) 직전 B(52) → beat(210) | storm | cut | 머리부터 다이빙(`P.dive`). 비 줄기, 빠른 카메라 |
| 56 | a4-catch | beat(210) → B(53) | storm | cut | CU 박에 손을 잡는다(`Burst`). 둘이 함께 굴러 떨어진다 |
| 57 | a4-dark | B(53) → B(54) | storm | dip | 폭풍 속 거의 어둠. 둘이 폰을 켠다. 작은 차가운 빛 두 개만 얼굴을 비춘다. 비 |

### 5막 · 구조, 달, 새벽 (2:30–3:00) — `act5.tsx`

| # | id | 시작 → 끝 | 키 | 들어옴 | 화면 |
| --- | --- | --- | --- | --- | --- |
| 58 | a5-call | B(54) → beat(222) | rescue | cut | EWS 어두운 폭풍 한가운데 차가운 점 둘. 멀리서 금빛 점들이 그 빛을 향해 돈다 |
| 59 | a5-converge | beat(222) → B(55) | rescue | cut | 사방에서 나방 줄기가 빠르게 모여든다(꼬리) |
| 60 | a5-cradle | B(55) → B(56) | rescue | cut | 나방이 두 아이 아래에 빛나는 요람을 만들어 받는다. 얼굴이 금빛으로 덮인다 |
| 61 | a5-ascent | B(56) → B(57) | rescue | cut | 폭풍을 뚫고 빠르게 오른다. 비가 아래로 스치고 번개, 빛이 커진다 |
| 62 | a5-break | B(57) → B(58) | clear | white | 폭풍 꼭대기를 뚫고 맑은 하늘. 거대한 달 |
| 63 | a5-touch | B(58) → B(59) | clear | cut | CU 맞잡은 두 손이 달 표면에 닿는다. 빛의 물결(`Burst` + 고리) |
| 64 | a5-bloom | B(59) → B(60) | bloom | flash | EWS 달이 터져 수많은 금빛 실이 도시로 흘러내린다 |
| 65 | a5-ignite | B(60) → B(61) | bloom | cut | 1번과 같은 구도(북엔드). 실이 도시에 닿고 창이 박마다 하나씩 켜진다. 도시가 따뜻해진다 |
| 66 | a5-sleep | B(61) → B(62) | dawn | dip | 새벽 방. 빛 구슬을 안고 잠든 아이. 창밖은 복숭앗빛 |
| 67 | a5-wave | B(62) → 끝(180) | dawn | cut | 길을 사이에 두고 마주 보는 두 창. 각자 창가에서 서로를 알아보고 손을 흔든다. 천천히 뒤로 빠진다(끝 2.4초는 MV가 검게 페이드) |

## 5. 작업과 확인

```bash
npm install
node tools/stills.mjs --entry src/entries/act1.ts --times 2,6.5,9 --sheet out/a1.jpg   # 막 하나만 묶어 정지 화면
node tools/render.mjs --entry src/entries/act1.ts --from 0 --to 14 --scale .5 --concurrency 2 --out out/a1.mp4
node tools/render.mjs                                                                     # 전체 1080p → out/mv.mp4
npm run studio                                                                            # Remotion Studio
npx tsc --noEmit
```

**검수 질문**(컷마다): 정지 화면 한 장을 검게 칠해도 동작이 읽히나? 가장 밝은 곳이 시선이 갈 곳인가? 앞 컷과 거리·각도가 다른가? 큰 동작이 박에 떨어지나? 직선 등속 움직임이 남아 있나?

**속도 예산**: 1080p 한 프레임이 동시 4개 렌더에서 1.5초 안쪽. CSS 흐림(심도) 층은 컷당 5개 이하. 나방은 한 `<Moths>`에 150마리 이하, 꼬리는 5 이하.
