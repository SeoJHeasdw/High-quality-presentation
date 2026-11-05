# 뮤비 2 (Remotion)

`감성 힙합 초안` 3분에 맞춘 뮤직비디오. **Blender 없이 Remotion(React + SVG)만으로** 그린다.
이야기는 [첫 뮤비](../mv/README.md)와 같다(외로운 밤 → 나방 → 달 → 친구 → 폭풍 → 새벽). 바뀐 것은 그리는 법이다.
무엇을 왜 바꿨는지, 컬러 스크립트, 67컷 편집표는 [ART.md](ART.md)에 있다.

| 첫 뮤비 | 뮤비 2 |
| --- | --- |
| 3분 내내 같은 남보라, 화면 절반이 밝기 20/255 이하 | 감정마다 색이 바뀌는 컬러 스크립트 11단계. 하늘(빛)은 밝게 |
| 아이가 배경에 묻힘 | 밝은 하늘 앞 어두운 실루엣 + 테두리 빛 |
| 종 모양 몸(포즈가 안 읽힘) | 팔·다리·후드 꼬리가 있는 뼈대. 검게 칠해도 동작이 읽힌다 |
| 같은 와이드로 4컷 | 컷마다 거리·각도가 다르다(어깨 너머·인서트·올려다보기·익스트림 와이드) |
| 40컷 모두 1·2·3마디, 마디 첫 박 | 67컷, 0.7~7초. 박 중간에도 자른다. 매치컷·휙 패닝·아이리스 |
| 붓질 필터 | 깊이 층(시차·심도)·공기 원근·필름 입자 |

```bash
npm install
npm run studio                       # Remotion Studio (http://localhost:3000)
node tools/render.mjs                # 전체 1080p → out/mv.mp4 (곡 포함, 4코어에서 약 48분, CRF 18이라 약 450MB)
node tools/render.mjs --from 44 --to 55 --scale .5 --out out/part.mp4     # 일부만(초)
node tools/stills.mjs --entry src/entries/act2a.ts --times 44.3,48.5 --sheet out/a.jpg   # 정지 화면
npx tsc --noEmit
```

전달용으로 줄이기(1080p 약 110MB, 720p 약 26MB):

```bash
ffmpeg -i out/mv.mp4 -c:v libx264 -preset slow -crf 23 -tune grain -c:a aac -b:a 192k -movflags +faststart out/mv-1080p.mp4
ffmpeg -i out/mv.mp4 -vf scale=1280:720:flags=lanczos -c:v libx264 -preset slow -crf 24 -c:a aac -b:a 160k -movflags +faststart out/mv-720p.mp4
```

곡(`../deck/public/demos/emotional-hiphop-draft.wav`)과 박 분석(`../mv/public/hiphop-analysis.json`)은 복사본을 두지 않는다.
렌더 직전에 `tools/prepare-assets.mjs`가 `public/`으로 가져온다(gitignore). 이 컨테이너의 Chromium headless shell을 쓰고(`remotion.config.ts`),
GL은 `swiftshader`로 돌린다(`swangle`은 프레임당 4초, `swiftshader`는 0.55초).

## 구조

```
src/
  MV.tsx            컷 이어 붙이기 · 전환(cut/flash/dip/white/cross/whip/iris) · 곡 · 필름 입자 · 비네트
  lib/camera.tsx    깊이 층(Layer d) 카메라: 시차·줌·기울기·피사계 심도
  lib/palette.ts    컬러 스크립트(K.lonely … K.dawn)
  lib/song.ts       박·마디(B(n)) → 초, 음량·타격
  lib/sky.tsx       하늘·달·별·빛줄기·구름·번개·비      lib/city.tsx  도시 실루엣·벽·창틀·지붕 소품·침대·커튼
  lib/moths.tsx     나방 입자(떼·줄기·대형으로 모이기)·빛의 실·반짝임   lib/sets.tsx  무대 묶음   lib/post.tsx  마감
  kid/pose.ts       자세 모델과 자세 목록(P)·걸음/달리기·사다리 오르기   kid/rig.tsx   실루엣 아이·친구, IK
  shots/act1.tsx … act5.tsx   막별 컷(act2a가 기준 장면)
  entries/actN.ts   막 하나만 묶는 진입점(미리보기용)
tools/  render.mjs · stills.mjs · sheet.py · prepare-assets.mjs
```
