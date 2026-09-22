# TEL / JAVIS

Technology Expert Lab 발표용 16:9 브라우저 덱.
개인의 30년 계획, AI 사례, 실제 자비스 엔진과 결과물을 다룬다.

```bash
cd deck
npm install
npm run dev
```

[발표 화면](http://localhost:5180/#keynote) · [발표자 창](http://localhost:5180/#keynote/present)

발표 순서·조작·실물 시연은 [deck/README.md](deck/README.md), 디자인 원칙은
[docs/presentation-design.md](docs/presentation-design.md)에 있다.

## 로컬 Git

이 작업 폴더가 Git 저장소다. `origin`은 같은 컴퓨터의 `../tel_edu_javis.git` bare 저장소다.
외부 호스팅에는 올리지 않았다. `node_modules`, 빌드 결과, 렌더 검수 이미지, 비밀 설정은 추적하지 않는다.
발표에 필요한 사진·폰트·미디어는 추적한다.

- `main` / `baseline-2026-09-22`: 디자인 리뷰를 반영하기 전의 30장 버전
- `design/presentation-motion`: 발표자 제어 모션과 PPT 레이아웃을 다듬는 브랜치

```bash
git status
git diff main
git push origin design/presentation-motion
```
