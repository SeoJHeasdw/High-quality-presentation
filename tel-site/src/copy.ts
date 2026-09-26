/*
 * 모든 문구. 한국어가 기본, 영어는 같은 구조로.
 * 수치는 영상과 트윈이 쓰는 타워 모델(tools/render-film.py의 제원)에서 계산한 값이다.
 * 회사·프로젝트·공정 기록은 이 콘셉트 사이트를 위해 만든 가상의 내용이다(푸터에 밝힌다).
 */
export type Lang = "ko" | "en";
export type L = Record<Lang, string>;

/** 영상 위 라벨: 트랙 좌표 id, 이름, 값. 값의 {fl}{skin}{el}은 프레임마다 바뀐다. */
export type FilmLabel = { id: string; name: L; value: L; tone?: "line" | "lit"; side?: "left" | "right" };

export type Chapter = {
  key: string;
  rail: L;
  kicker: L;
  title: L;
  body: L;
  specs: [L, L][];
  labels: FilmLabel[];
};

export const CHAPTERS: Chapter[] = [
  {
    key: "line",
    rail: { ko: "첫 선", en: "Line" },
    kicker: { ko: "Technology Expert Lab", en: "Technology Expert Lab" },
    title: { ko: "선에서,\n빛까지.", en: "From line\nto light." },
    body: {
      ko: "땅 위에 긋는 첫 선부터 마지막 층의 불이 켜지는 순간까지. TEL은 모든 단계를 재면서 짓습니다.",
      en: "From the first line on the ground to the moment the last floor lights up. TEL measures every step it builds.",
    },
    specs: [],
    labels: [{ id: "instrument", name: { ko: "TS-01", en: "TS-01" }, value: { ko: "토탈스테이션", en: "Total station" } }],
  },
  {
    key: "survey",
    rail: { ko: "측량", en: "Survey" },
    kicker: { ko: "01 측량", en: "01 Survey" },
    title: { ko: "모든 건물은\n한 줄의 선에서\n시작합니다.", en: "Every building\nstarts with\na single line." },
    body: {
      ko: "기준점 하나에서 대지의 경계와 12 m 격자, 코어와 기둥 열두 개의 자리를 표시합니다. 최상층 외곽선까지 먼저 바닥에 그립니다.",
      en: "From one benchmark we mark the site boundary, a 12 m grid, the core and twelve columns — even the outline of the top floor is drawn on the ground first.",
    },
    specs: [
      [{ ko: "대지", en: "Site" }, { ko: "124 × 110 m", en: "124 × 110 m" }],
      [{ ko: "격자", en: "Grid" }, { ko: "A–E · 1–5 · 12 m", en: "A–E · 1–5 · 12 m" }],
      [{ ko: "기준층", en: "Typical floor" }, { ko: "38.0 × 38.0 m", en: "38.0 × 38.0 m" }],
    ],
    labels: [
      { id: "grid", name: { ko: "그리드 원점", en: "Grid origin" }, value: { ko: "A-1 · EL +0.300", en: "A-1 · EL +0.300" } },
      { id: "footprint", name: { ko: "기준층 외곽", en: "Floor outline" }, value: { ko: "1,377 m²", en: "1,377 m²" } },
    ],
  },
  {
    key: "foundation",
    rail: { ko: "기초", en: "Ground" },
    kicker: { ko: "02 기초", en: "02 Foundation" },
    title: { ko: "보이지 않는 곳을\n가장 먼저\n짓습니다.", en: "We build\nwhat you won’t see\nfirst." },
    body: {
      ko: "말뚝 40본 위에 두께 2.7 m의 매트 기초를 붓습니다. 코어는 골조보다 세 개 층 먼저 오르고, 크레인은 코어 안에서 함께 올라갑니다.",
      en: "A 2.7 m mat foundation is poured over 40 piles. The core climbs three floors ahead of the frame, and the crane climbs inside it.",
    },
    specs: [
      [{ ko: "말뚝", en: "Piles" }, { ko: "40본", en: "40" }],
      [{ ko: "매트 기초", en: "Mat" }, { ko: "t 2.7 m", en: "t 2.7 m" }],
      [{ ko: "코어 선행", en: "Core lead" }, { ko: "+3개 층", en: "+3 floors" }],
    ],
    labels: [
      { id: "raft", name: { ko: "매트 기초", en: "Mat foundation" }, value: { ko: "t 2.7 m", en: "t 2.7 m" } },
      { id: "crane", name: { ko: "타워 크레인", en: "Tower crane" }, value: { ko: "지브 62 m", en: "62 m jib" }, tone: "lit" },
    ],
  },
  {
    key: "structure",
    rail: { ko: "골조", en: "Frame" },
    kicker: { ko: "03 골조", en: "03 Structure" },
    title: { ko: "나흘에 한 층,\n오차는 3 mm\n안에서.", en: "A floor every\nfour days, within\n3 mm." },
    body: {
      ko: "슬래브가 놓일 때마다 레이저가 모서리를 다시 짚습니다. 설계 좌표에서 3 mm를 넘으면 다음 층을 붓지 않습니다.",
      en: "Every new slab edge is re-shot by laser. If it drifts more than 3 mm from the design coordinates, the next floor waits.",
    },
    specs: [
      [{ ko: "층 사이클", en: "Floor cycle" }, { ko: "4일", en: "4 days" }],
      [{ ko: "허용 오차", en: "Tolerance" }, { ko: "±3 mm", en: "±3 mm" }],
      [{ ko: "층간 회전", en: "Twist" }, { ko: "1.2° / 층", en: "1.2° / floor" }],
    ],
    labels: [
      { id: "slab", name: { ko: "슬래브 스캔", en: "Slab scan" }, value: { ko: "FL {fl} · Δ 1.8 mm", en: "FL {fl} · Δ 1.8 mm" } },
      { id: "skin", name: { ko: "커튼월", en: "Curtain wall" }, value: { ko: "FL {skin}", en: "FL {skin}" }, tone: "lit" },
    ],
  },
  {
    key: "topout",
    rail: { ko: "상량", en: "Top" },
    kicker: { ko: "04 상량", en: "04 Topping out" },
    title: { ko: "201.9 m,\n마지막 슬래브.", en: "201.9 m.\nThe last slab." },
    body: {
      ko: "48번째 층이 닫힙니다. 커튼월은 여덟 개 층 아래에서 뒤따르고, 두 공정이 같은 주에 끝나도록 순서를 짭니다.",
      en: "The 48th floor closes. The curtain wall follows eight floors below, sequenced so both trades finish in the same week.",
    },
    specs: [
      [{ ko: "골조", en: "Frame" }, { ko: "48 / 48층", en: "48 / 48" }],
      [{ ko: "커튼월 유닛", en: "Curtain units" }, { ko: "4,608장", en: "4,608" }],
      [{ ko: "최고 높이", en: "Roof" }, { ko: "EL +201.9 m", en: "EL +201.9 m" }],
    ],
    labels: [
      { id: "slab", name: { ko: "골조 완료", en: "Frame complete" }, value: { ko: "FL 48 · EL +201.9", en: "FL 48 · EL +201.9" } },
      { id: "skin", name: { ko: "커튼월", en: "Curtain wall" }, value: { ko: "FL {skin}", en: "FL {skin}" }, tone: "lit" },
    ],
  },
  {
    key: "complete",
    rail: { ko: "준공", en: "Done" },
    kicker: { ko: "05 준공", en: "05 Completion" },
    title: { ko: "그린 그대로\n서 있습니다.", en: "Standing\nexactly as drawn." },
    body: {
      ko: "층마다 1.2°씩 돌아 최상층은 56.4° 비틀렸습니다. 준공 측량에서 설계 모델과의 최대 편차는 4 mm였습니다.",
      en: "Each floor turns 1.2°, so the top floor sits 56.4° from the base. The as-built survey found a maximum deviation of 4 mm from the model.",
    },
    specs: [
      [{ ko: "높이", en: "Height" }, { ko: "222.9 m", en: "222.9 m" }],
      [{ ko: "연면적", en: "Gross area" }, { ko: "58,215 m²", en: "58,215 m²" }],
      [{ ko: "최대 편차", en: "Max deviation" }, { ko: "4 mm", en: "4 mm" }],
    ],
    labels: [
      { id: "crown", name: { ko: "왕관", en: "Crown" }, value: { ko: "EL +222.9 m", en: "EL +222.9 m" } },
      { id: "top", name: { ko: "비틀림", en: "Twist" }, value: { ko: "56.4°", en: "56.4°" } },
    ],
  },
  {
    key: "light",
    rail: { ko: "점등", en: "Light" },
    kicker: { ko: "06 점등", en: "06 Light" },
    title: { ko: "불이 켜지는 날까지가\n공사입니다.", en: "The job ends when\nthe lights come on." },
    body: {
      ko: "조명과 설비, 출입 시스템을 같은 모델에서 시운전합니다. 사람이 들어와 스위치를 켜는 날 우리의 공정표가 닫힙니다.",
      en: "Lighting, services and access are commissioned from the same model. Our schedule closes the day people walk in and switch them on.",
    },
    specs: [
      [{ ko: "시운전", en: "Commissioning" }, { ko: "38일", en: "38 days" }],
      [{ ko: "조명 회로", en: "Lighting circuits" }, { ko: "1,152", en: "1,152" }],
    ],
    labels: [{ id: "tower", name: { ko: "리버사이드 타워", en: "Riverside Tower" }, value: { ko: "48층 점등", en: "48 floors lit" }, tone: "lit" }],
  },
  {
    key: "city",
    rail: { ko: "도시", en: "City" },
    kicker: { ko: "07 도시", en: "07 City" },
    title: { ko: "한 현장에서 잰 것이\n다음 현장으로\n갑니다.", en: "What one site\nmeasures, the next\none inherits." },
    body: {
      ko: "사장교와 미술관, 연구 캠퍼스와 주거 단지. TEL의 현장들은 하나의 측량 데이터로 이어져 있습니다.",
      en: "A bridge, a museum, a research campus, a housing estate. Every TEL site shares one body of survey data.",
    },
    specs: [],
    labels: [
      { id: "crown", name: { ko: "리버사이드 타워", en: "Riverside Tower" }, value: { ko: "EL +222.9 m", en: "EL +222.9 m" }, tone: "lit", side: "left" },
      { id: "bridge", name: { ko: "리버라인 사장교", en: "Riverline Bridge" }, value: { ko: "주탑 112 m", en: "112 m pylons" }, side: "left" },
    ],
  },
];

/** 마지막 장: 타워와 사장교 사이를 잰 측선(수평거리는 모델 좌표에서 계산). */
export const MEASURE = { from: "measureA", to: "bridge", name: { ko: "측선 T–B · 수평거리", en: "Traverse T–B · horizontal" }, value: "716.9 m" };

export const UI = {
  nav: {
    build: { ko: "짓는 방식", en: "How we build" },
    twin: { ko: "디지털 트윈", en: "Digital twin" },
    work: { ko: "프로젝트", en: "Projects" },
    contact: { ko: "상담 신청", en: "Start a project" },
    lang: { ko: "EN", en: "KR" },
    langLabel: { ko: "영어로 보기", en: "View in Korean" },
    menu: { ko: "메뉴", en: "Menu" },
    close: { ko: "닫기", en: "Close" },
  },
  loader: {
    status: { ko: "현장 데이터를 불러오는 중", en: "Loading site data" },
    frames: { ko: "프레임", en: "frames" },
  },
  film: {
    scroll: { ko: "스크롤하면 공사가 시작됩니다", en: "Scroll to break ground" },
    day: { ko: "공정일", en: "Day" },
    frame: { ko: "골조", en: "Frame" },
    skin: { ko: "외피", en: "Skin" },
    el: { ko: "표고", en: "Elev." },
    ruler: { ko: "단면 표고", en: "Section elevation" },
    skip: { ko: "영상 건너뛰기", en: "Skip the film" },
  },
  manifesto: {
    kicker: { ko: "원칙", en: "Principle" },
    text: {
      ko: "우리는 모든 건물을 두 번 짓습니다. 한 번은 데이터 위에서, 한 번은 땅 위에서. 두 번째가 첫 번째와 똑같을 때 공사가 끝납니다.",
      en: "We build every building twice. Once in data, once on the ground. The job is done when the second matches the first.",
    },
  },
  twin: {
    kicker: { ko: "디지털 트윈", en: "Digital twin" },
    title: { ko: "착공 전에\n한 번 먼저\n짓습니다.", en: "We build it once\nbefore we\nbreak ground." },
    body: {
      ko: "타워의 48개 층을 모델 안에 먼저 쌓고, 부재가 부딪히는 자리를 현장에 가기 전에 고칩니다. 스크롤하면 단면이 한 층씩 내려갑니다.",
      en: "All 48 floors are stacked in the model first, and every clash between trades is fixed before anyone reaches the site. Scroll to move the section cut floor by floor.",
    },
    drag: { ko: "드래그해서 돌려 보세요", en: "Drag to rotate" },
    floor: { ko: "층", en: "Floor" },
    use: { ko: "용도", en: "Use" },
    area: { ko: "바닥 면적", en: "Floor area" },
    rotation: { ko: "회전", en: "Rotation" },
    elevation: { ko: "표고", en: "Elevation" },
    clashes: { ko: "착공 전 해결한 간섭", en: "Clashes resolved pre-construction" },
    layers: { ko: "레이어", en: "Layers" },
    structure: { ko: "구조", en: "Structure" },
    envelope: { ko: "외피", en: "Envelope" },
    services: { ko: "설비", en: "Services" },
    fallback: { ko: "이 브라우저에서는 3D 모델을 표시할 수 없어 단면 이미지로 대신합니다.", en: "3D isn’t available in this browser, so a section image is shown instead." },
  },
  uses: [
    { upTo: 3, name: { ko: "로비 · 리테일", en: "Lobby · Retail" } },
    { upTo: 20, name: { ko: "오피스", en: "Office" } },
    { upTo: 21, name: { ko: "스카이 로비", en: "Sky lobby" } },
    { upTo: 37, name: { ko: "오피스", en: "Office" } },
    { upTo: 46, name: { ko: "호텔", en: "Hotel" } },
    { upTo: 48, name: { ko: "전망대", en: "Observatory" } },
  ],
  work: {
    kicker: { ko: "프로젝트", en: "Projects" },
    title: { ko: "우리가 그은 선들.", en: "Lines we have drawn." },
    body: {
      ko: "영상 마지막 장면에서 빛으로 이어진 현장들입니다. 같은 도시, 같은 측량 기준 위에 서 있습니다.",
      en: "The sites linked by light in the last scene of the film. The same city, the same survey datum.",
    },
    hint: { ko: "스크롤하면 옆으로 넘어갑니다", en: "Scroll to move sideways" },
    fictional: { ko: "가상 프로젝트", en: "Concept project" },
    open: { ko: "자세히 보기", en: "View details" },
    prev: { ko: "이전", en: "Previous" },
    next: { ko: "다음 프로젝트", en: "Next project" },
  },
  contact: {
    kicker: { ko: "상담", en: "Contact" },
    title: { ko: "다음 선은\n어디에 그을까요?", en: "Where should\nwe draw the next line?" },
    body: {
      ko: "대지 위치와 구상만 알려 주세요. 첫 측량 계획을 2주 안에 보내 드립니다.",
      en: "Tell us where the site is and what you imagine. We’ll send a first survey plan within two weeks.",
    },
    cta: { ko: "프로젝트 상담 신청", en: "Start a project" },
    formTitle: { ko: "프로젝트 상담 신청", en: "Start a project" },
    notice: {
      ko: "이 사이트는 콘셉트 데모입니다. 입력한 내용은 어디에도 전송되지 않습니다.",
      en: "This is a concept website. Nothing you enter is sent anywhere.",
    },
    name: { ko: "이름", en: "Name" },
    company: { ko: "회사", en: "Company" },
    email: { ko: "이메일", en: "Email" },
    site: { ko: "대지 위치", en: "Site location" },
    type: { ko: "프로젝트 유형", en: "Project type" },
    types: [
      { ko: "초고층", en: "High-rise" },
      { ko: "교량 · 인프라", en: "Bridge · Infrastructure" },
      { ko: "문화 · 공공", en: "Cultural · Public" },
      { ko: "연구 · 산업", en: "Research · Industrial" },
      { ko: "주거", en: "Residential" },
    ],
    idea: { ko: "구상", en: "What you imagine" },
    submit: { ko: "신청 내용 확인", en: "Review request" },
    done: {
      ko: "신청 내용을 확인했습니다. 콘셉트 사이트라서 실제로 전송되지는 않았습니다.",
      en: "Request reviewed. As this is a concept site, nothing was sent.",
    },
    again: { ko: "다시 작성", en: "Write another" },
    required: { ko: "필수", en: "Required" },
  },
  footer: {
    note: {
      ko: "Technology Expert Lab과 이 사이트의 프로젝트, 공정 기록, 수치는 콘셉트 웹사이트를 위해 만든 가상의 내용입니다. 영상과 프로젝트 이미지는 Blender로 렌더링한 가상 장면입니다.",
      en: "Technology Expert Lab and every project, record and figure on this site are fictional, created for a concept website. The film and project images are rendered in Blender.",
    },
    top: { ko: "맨 위로", en: "Back to top" },
    offices: { ko: "현장", en: "Sites" },
    officeList: { ko: "서울 · 부산 · 싱가포르", en: "Seoul · Busan · Singapore" },
    since: { ko: "측량 기준 BM-01", en: "Datum BM-01" },
  },
};

export type Project = {
  id: string;
  image: string;
  name: L;
  type: L;
  specs: [L, L][];
  body: L;
};

export const PROJECTS: Project[] = [
  {
    id: "tower",
    image: "/projects/tower.jpg",
    name: { ko: "리버사이드 타워", en: "Riverside Tower" },
    type: { ko: "초고층 복합", en: "Mixed-use high-rise" },
    specs: [[{ ko: "높이", en: "Height" }, { ko: "222.9 m", en: "222.9 m" }], [{ ko: "층수", en: "Floors" }, { ko: "48", en: "48" }], [{ ko: "비틀림", en: "Twist" }, { ko: "56.4°", en: "56.4°" }]],
    body: { ko: "영상 속 그 타워. 층마다 1.2°씩 도는 커튼월을 4,608장의 유닛으로 닫았습니다.", en: "The tower in the film. Its turning curtain wall was closed with 4,608 units." },
  },
  {
    id: "bridge",
    image: "/projects/bridge.jpg",
    name: { ko: "리버라인 사장교", en: "Riverline Bridge" },
    type: { ko: "교량 · 인프라", en: "Bridge · Infrastructure" },
    specs: [[{ ko: "주탑", en: "Pylons" }, { ko: "112 m × 2", en: "112 m × 2" }], [{ ko: "주경간", en: "Main span" }, { ko: "166 m", en: "166 m" }], [{ ko: "케이블", en: "Stays" }, { ko: "96", en: "96" }]],
    body: { ko: "두 개의 역Y형 주탑에서 부채꼴 케이블이 내려와 강을 건넙니다.", en: "Fan stays drop from two inverted-Y pylons to carry the deck across the river." },
  },
  {
    id: "museum",
    image: "/projects/museum.jpg",
    name: { ko: "강변 미술관", en: "Riverside Museum" },
    type: { ko: "문화 · 공공", en: "Cultural · Public" },
    specs: [[{ ko: "지붕", en: "Roof" }, { ko: "152 × 60 m", en: "152 × 60 m" }], [{ ko: "유리 벽", en: "Glass wall" }, { ko: "높이 8.1 m", en: "8.1 m high" }], [{ ko: "기둥", en: "Columns" }, { ko: "10", en: "10" }]],
    body: { ko: "강 쪽으로 열린 낮고 긴 파빌리온. 얇은 지붕 하나가 전시장 전체를 덮습니다.", en: "A long, low pavilion open to the river, covered by a single thin roof." },
  },
  {
    id: "lab",
    image: "/projects/lab.jpg",
    name: { ko: "TEL 연구 캠퍼스", en: "TEL Research Campus" },
    type: { ko: "연구 · 산업", en: "Research · Industrial" },
    specs: [[{ ko: "연구동", en: "Halls" }, { ko: "3", en: "3" }], [{ ko: "톱날 채광창", en: "Sawtooth lights" }, { ko: "43열", en: "43 rows" }], [{ ko: "용도", en: "Use" }, { ko: "시험 · 클린룸", en: "Testing · Cleanroom" }]],
    body: { ko: "우리가 쓰는 측량 장비와 공법을 시험하는 곳. 톱날 지붕의 북향 채광창이 실험동에 고른 빛을 들입니다.", en: "Where we test our own survey gear and methods. North-facing sawtooth lights give the halls even daylight." },
  },
  {
    id: "house",
    image: "/projects/house.jpg",
    name: { ko: "더스크 하우스", en: "Dusk House" },
    type: { ko: "주거", en: "Residential" },
    specs: [[{ ko: "층수", en: "Floors" }, { ko: "2", en: "2" }], [{ ko: "캔틸레버", en: "Cantilever" }, { ko: "7.8 m", en: "7.8 m" }], [{ ko: "외피", en: "Skin" }, { ko: "삼나무 · 유리", en: "Cedar · Glass" }]],
    body: { ko: "가장 작은 현장도 같은 기준으로 짓습니다. 노출 콘크리트 코어 옆으로 목재 상자가 떠 있습니다.", en: "Our smallest site, built to the same datum: a cedar box floating beside an exposed concrete core." },
  },
];
