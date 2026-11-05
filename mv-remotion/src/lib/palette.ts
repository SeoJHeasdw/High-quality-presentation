/**
 * 컬러 스크립트. 이야기의 감정이 바뀌는 곳마다 색이 바뀐다(예전 뮤비는 3분 내내 같은 남보라였다).
 * 원칙: 하늘(빛)은 밝고, 인물은 실루엣으로 어둡다. 화면에서 가장 밝은 곳 = 시선이 갈 곳.
 *   차가운 빛(폰·번개·창의 푸른 깜빡임) = 기계·고립 / 금빛(나방·달) = 사람·마음
 *
 * sky: 위→아래 그라데이션 / glow: 지평선 빛 / moon: 달 빛 / fog: 먼 건물이 녹아드는 색(공기 원근)
 * sil: 실루엣 / rim: 인물 테두리 빛 / win: 창 불빛 / accent: 그 구간의 강조색
 */
export type Key = {
  sky: [string, string, string, string];
  glow: string; moon: string; fog: string; sil: string; silFar: string; rim: string; win: string; cold: string; accent: string; cloud: string; cloudLit: string;
};

export const K = {
  /** 0:00–0:13 외로운 방. 차갑고 고립됨. 창만 밝다 */
  lonely: { sky: ["#03050f", "#0a1430", "#1d3a62", "#3f6d96"], glow: "#7fb3d9", moon: "#dcefff", fog: "#16304f", sil: "#02040a", silFar: "#081226", rim: "#a9d2ff", win: "#ffb860", cold: "#b8dcff", accent: "#9fd0ff", cloud: "#132643", cloudLit: "#5d89b3" },
  /** 0:13–0:24 나방이 쏟아져 들어옴. 금빛이 처음 들어온다 */
  moths: { sky: ["#03050f", "#0c1634", "#25406a", "#4d7aa0"], glow: "#ffcf8a", moon: "#fff1cf", fog: "#1d3557", sil: "#03040b", silFar: "#0b1428", rim: "#ffd590", win: "#ffb860", cold: "#b8dcff", accent: "#ffc45a", cloud: "#16294a", cloudLit: "#7b98bd" },
  /** 0:24–0:44 지붕. 블루아워처럼 지평선이 밝은 남색 */
  roof: { sky: ["#070b26", "#1a2a66", "#4867b4", "#a9bdf2"], glow: "#e6ecff", moon: "#fff3d2", fog: "#5a72b8", sil: "#040616", silFar: "#1b2554", rim: "#ffe3a6", win: "#ffc06a", cold: "#bcd6ff", accent: "#ffd27a", cloud: "#2c3d80", cloudLit: "#c4cff5" },
  /** 0:44–1:08 첫 도전과 나방 사다리. 보랏빛 희망, 금빛이 커진다 */
  hope: { sky: ["#0b0828", "#2f2272", "#8a4f9e", "#f2a88e"], glow: "#ffc89a", moon: "#ffe8b0", fog: "#7d5aa0", sil: "#070418", silFar: "#2a1d55", rim: "#ffd38c", win: "#ffc06a", cold: "#c6d4ff", accent: "#ffc860", cloud: "#4a347e", cloudLit: "#f0b8b0" },
  /** 1:08–1:19 브레이크. 소리가 빠진다. 색도 빠진다 */
  quiet: { sky: ["#070a14", "#18213a", "#39465f", "#6d7890"], glow: "#a5afc4", moon: "#e9ecf5", fog: "#3a465e", sil: "#03050b", silFar: "#1a2236", rim: "#d4dcef", win: "#ffb860", cold: "#a9c9ff", accent: "#cfd8ea", cloud: "#262f45", cloudLit: "#8590a8" },
  /** 1:19–2:03 후렴. 가장 채도 높은 밤: 군청→자홍, 거대한 달 */
  chorus: { sky: ["#07062a", "#1f1c7c", "#6a2fa0", "#ff7fa8"], glow: "#ffb0c8", moon: "#fff6dc", fog: "#5a3a9a", sil: "#05031a", silFar: "#2a1e66", rim: "#ffeac0", win: "#ffb45c", cold: "#a8c8ff", accent: "#ff8fb8", cloud: "#3a2e8a", cloudLit: "#ffc6dc" },
  /** 2:03–2:14 구름 위. 은빛 라벤더, 조용함 */
  silver: { sky: ["#0a0f30", "#2e3a80", "#8a96d0", "#e2e2fa"], glow: "#ffffff", moon: "#ffffff", fog: "#9aa2d6", sil: "#0b0d26", silFar: "#3a4280", rim: "#f6f2ff", win: "#ffc06a", cold: "#cfe0ff", accent: "#e8e4ff", cloud: "#7c86c4", cloudLit: "#f4f2ff" },
  /** 2:14–2:30 폭풍. 채도가 빠진 청록 회색, 번개만 하얗다 */
  storm: { sky: ["#030607", "#0e1a1d", "#22343a", "#3a5056"], glow: "#8fb6bf", moon: "#d8f0ff", fog: "#1e2e33", sil: "#010203", silFar: "#0e181b", rim: "#cdeeff", win: "#ffb860", cold: "#c8ecff", accent: "#e8f8ff", cloud: "#1b2a2e", cloudLit: "#55707a" },
  /** 2:30–2:38 구조. 어둠 속에서 금빛이 모인다 */
  rescue: { sky: ["#05040c", "#1b1424", "#3e2a2c", "#6e4a30"], glow: "#ffb347", moon: "#ffe6b0", fog: "#2e2228", sil: "#030206", silFar: "#1d141c", rim: "#ffc56a", win: "#ffb860", cold: "#c8ecff", accent: "#ffb347", cloud: "#2a1e26", cloudLit: "#a87a4a" },
  /** 2:38–2:44 폭풍 위 맑은 하늘. 깨끗한 청색 + 거대한 달 */
  clear: { sky: ["#040a2c", "#123a9a", "#3f86f0", "#bfe0ff"], glow: "#fff6dc", moon: "#fff8e6", fog: "#5f8fd8", sil: "#030716", silFar: "#1a2f6a", rim: "#fff2c8", win: "#ffc06a", cold: "#d6ecff", accent: "#ffe7a8", cloud: "#3a5fae", cloudLit: "#f2f6ff" },
  /** 2:44–2:50 달이 터진다. 흰 금빛 */
  bloom: { sky: ["#140c18", "#4a2a3a", "#c0784a", "#ffe0a0"], glow: "#fff2c8", moon: "#ffffff", fog: "#8a5a4a", sil: "#120a10", silFar: "#3a2430", rim: "#fff2c8", win: "#ffc46a", cold: "#d6ecff", accent: "#ffd27a", cloud: "#5a3a44", cloudLit: "#ffd8a8" },
  /** 2:50–3:00 새벽. 복숭아·장밋빛. 실루엣도 따뜻하고 조금 밝다 */
  dawn: { sky: ["#2c3474", "#7a6aa8", "#e89aa8", "#ffcf9a"], glow: "#fff0c8", moon: "#fff6e0", fog: "#b48aa8", sil: "#22183a", silFar: "#6a5280", rim: "#ffd8a8", win: "#ffd08a", cold: "#d6ecff", accent: "#ffc8a0", cloud: "#b08ab8", cloudLit: "#ffe6cc" },
} satisfies Record<string, Key>;
export type KeyName = keyof typeof K;
