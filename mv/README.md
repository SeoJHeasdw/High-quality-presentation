# 뮤비 시안

`감성 힙합 초안` 3분에 맞춘 모션그래픽 뮤직비디오 시안이다. Blender 없이 브라우저 캔버스로 그리고, 아직 장표에는 넣지 않았다. 발표 덱(`../deck`)과는 코드가 섞이지 않고, 덱에는 렌더한 mp4만 쓴다.

지금 기본은 **유화 뮤비 본편**(`src/paint/film.ts`, 3분 23컷)이다. 레퍼런스는 손그림 캐릭터의 연기와 남보라 밤·금빛 색감이고,
가사 없이 후드 쓴 아이의 연기로 간다: 외로운 밤 → 창밖의 빛 → 나방이 길을 만들어 줌 → 빛을 타고 하늘로 → 새벽.
깨끗하게 그린 장면을 붓질 패스(`painter.ts`)가 다시 칠하고, 빛은 따로 그려 아이 뒤만 지운 뒤 더한다. 얼굴과 낙서(점선 궤적·느낌표·하트)는 붓질 뒤에 또렷하게 얹는다.
움직임은 초당 15장으로 끊고, 컷은 모두 마디 첫 박에서 바뀐다(구간이 바뀌는 큰 박자에는 번쩍임, 브레이크와 새벽은 검정으로 넘어간다).
공용 재료(하늘·도시·나방·빛의 실·낙서)는 `kit.ts`, 아이는 `hoodie.ts`. 화면에 글자는 넣지 않는다. 첫 시안(선·도형)은 `?look=lines`, `--look lines`.

```bash
npm install           # 처음 한 번 (playwright, typescript)
npm run dev           # http://localhost:5185  Space 재생 · ←/→ 5초 · ↑/↓ 구간 · D 편집표
npm run render        # render/hiphop-mv.mp4 (1080p, 원곡 WAV 포함, 4코어에서 약 12분)
npm run render -- --from 79 --to 100 --fade --out render/part.mp4   # 일부만
npm run render -- --still 15,93,175   # 그 시각의 PNG만 render/stills/
npm run analyze       # 곡을 바꿨을 때 public/hiphop-analysis.json 다시 만들기
```

`tools/analyze.py`가 곡에서 박(87.5 BPM)·마디·구간·프레임별 음량과 스펙트럼을 뽑는다. 화면은 시각 t만 보고 그리므로
실시간 재생과 mp4 렌더가 같은 그림을 낸다. 유화 본편은 프레임마다 붓질을 하므로 실시간 재생은 느리다. 덱에는 렌더한 mp4를 쓴다.

## 구조

```
mv/
  src/          장면·붓질 코드 (mv.ts 선 시안, paint/film.ts 유화 본편)
  tools/        serve.mjs(미리보기 서버) · render.mjs(mp4) · analyze.py(곡 분석) · index.html
  public/       hiphop-analysis.json
  render/       결과물 (gitignore)
```

곡과 글꼴(`/demos`, `/fonts`)은 `../deck/public`을 그대로 가리킨다. 복사본이 없으니 곡 파일을 바꾸면 `npm run analyze`로 분석 JSON을 다시 만든다.

