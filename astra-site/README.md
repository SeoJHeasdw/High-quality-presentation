# Technology Expert Lab — construction concept site

13번 장표의 Blender 집을 출발점으로 만든 **독립형 건설사 콘셉트 웹사이트**입니다. 기존 발표 앱을 수정하거나 실행하지 않아도 됩니다.

## 실행

```bash
cd astra-site
npm install
npm run dev
```

브라우저에서 [http://localhost:5190](http://localhost:5190)을 엽니다. 발표 덱은 별도 포트에서 계속 실행할 수 있습니다.

## 화면 구성

- 13번 장표의 Blender 집 원본을 추출한 3D 모델이 한 구간에서 세밀하게 조립됩니다. 마우스 드래그로 회전하고, 방향키로도 시점을 바꿀 수 있습니다. WebGL을 사용할 수 없으면 정지 이미지를 표시합니다.
- 하단의 네 장면 버튼으로 조립 단계를 바로 선택할 수 있습니다.
- 기둥·보·바닥 패널·유리·목재 외피가 개별 궤적으로 도착합니다. 조립 구간의 실제 스크롤 거리는 초기 버전 대비 1.5배이며, 위로 스크롤하면 같은 궤적을 되짚습니다.
- 기둥은 사방에서 회전하며 진입하고, 보는 양방향 곡선, 유리는 외벽에 수직인 경로, 목재는 연속적인 물결 경로를 따릅니다. 회전은 도착 전에 정리되고 마지막 구간은 부드럽게 맞물립니다.
- 한국어를 기본으로 프로젝트 상세 보기, EN/KR 전환, 모바일 메뉴, 문의 미리보기가 작동합니다.
- 모션 줄이기 설정에서는 페이지 전환 효과와 관성 움직임을 줄입니다.

## 자료와 범위

- `public/film/a3.jpg`: WebGL을 사용할 수 없을 때 쓰는 13번 장표의 정지 렌더입니다.
- `public/models/house.glb`: 같은 장표의 Blender 집 geometry를 웹용 재질로 변환한 모델입니다. `tools/export-house-glb.py`로 재생성할 수 있습니다.
- `public/images/project-*.webp`: 이 데모를 위해 새로 만든 **가상의 건축 콘셉트 이미지**입니다.
- `public/images/hero-civic.webp`, `material-detail.webp`: 새로운 첫 화면과 재료 소개를 위해 만든 가상 건축 이미지입니다.
- `src/architecturalMaterials.ts`: 외부 요청 없이 생성되는 표면 질감과 실시간 3D 재질입니다.
- `src/houseAssembly.ts`, `src/assemblyGeometry.ts`: 원본 부재를 분리하고, 큰 표면을 패널로 나누어 개별 조립 순서와 궤적을 계산합니다. 여러 부재가 하나의 메시를 공유해 렌더링 비용을 억제합니다.
- `public/fonts/`: 발표 덱의 Pretendard 로컬 폰트와 라이선스 파일입니다.

소개된 프로젝트와 이미지는 실제 시공 실적이 아닌 가상 콘셉트입니다. 문의 양식은 입력과 완료 상태만 보여주며 데이터를 전송하지 않습니다.

배포용 파일은 `npm run build`로 `dist/`에 생성됩니다.
