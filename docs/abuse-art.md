# 악용 서사의 배경 이미지

- 도구: built-in `image_gen`
- 최종 파일: `deck/public/abuse/pixel-face.png`
- 용도: 32번의 픽셀 얼굴 배경. 식별 가능한 실제 인물을 표현하지 않는다. 2026-09-23부터 CSS 필터로 붉게 물들여 쓴다(원본 파일은 그대로).
- 기존 21~25번 Blender 영상은 변경하지 않는다.

## 생성 프롬프트

Use case: stylized-concept. Asset type: cinematic 16:9 background for a Korean presentation chapter about malicious use of AI, identity deception and fabricated evidence. Create one ominous anonymous human face formed entirely from emerald green square pixels, sparse code-like glyph fragments, fine raster dots and dim vertical digital traces, emerging from pitch black. Frontal face, slightly bowed head, faceted cheekbones and hollow shadowed eyes, unsettling and restrained, serious editorial cyberpunk mood, no recognizable person, no named movie character, no mask, no hood cliché. Put the large face in the RIGHT 45 percent; keep the LEFT 50 percent nearly pure black as negative space for live editable presentation copy. Face is a digital apparition, not a photograph of a criminal. Dark rich blacks, small saturated green phosphor highlights, carefully controlled bloom and scanline texture. Premium high-detail art, crisp pixels at edges, subtle depth, not generic clip art, no logos, no typography, no readable text, no watermark, no gore or explicit content. Landscape 16:9, 1920x1080 or larger.

## 한밤중의 휴대전화 (35·36·38번)

- 도구: Blender 5.2 EEVEE, `deck/tools/render-night-phone.py`
- 결과: `deck/public/abuse/night-phone.jpg`(2880×1620, 덱에서는 1920×1080으로 표시), `night-phone.json`(휴대전화 화면의 네 모서리, 1920×1080 좌표)
- 장면: 협탁 위에 화면이 위로 놓인 휴대전화, 충전 선, 초점 밖의 책과 물컵, 블라인드 사이로 든 달빛, 화면에서 번지는 차가운 빛. 사람이나 실제 제품의 상표를 표현하지 않는다.
- 화면은 어둡게 렌더하고, 통화·메시지 화면은 덱의 DOM이 네 모서리에 맞춰 덮는다. 화면 속 번호·이름·자막은 모두 가상이다.

## 신에게 목줄 (39번)

- 외부 이미지를 쓰지 않는다. 사람의 상반신 실루엣은 `deck/src/keynote/leash/world.ts`의 `sampleBody`가 캔버스에 타원·사다리꼴·곡선으로 직접 그린 뒤 입자로 샘플링한다.
- 낱말(약속·설득·명령·거짓말·기도·계약·법·광고·소문·뉴스·맹세·부탁·허락·거절·promise·command·prompt·token·law·prayer·story·yes·no·obey·please·believe)은 Pretendard로 그려 점을 고른다.
- 색은 검정·파랑(낱말과 몸 = 기계)·금색(사람이 채우려는 목줄)만 쓴다. 31~38번의 붉은 방과 구분한다.
