/**
 * 챕터가 어떤 파일로 이루어져 있는지 아는 유일한 곳.
 *
 * lint-course · shots · narration 세 도구가 전부 챕터 파일을 **텍스트로**
 * 읽는다. 셋이 각자 `readdirSync` 를 돌리고 있어서, 챕터를 레슨 파일로
 * 쪼갤 때 세 곳이 같이 깨졌다. 수집만 여기로 모은다 — 파싱은 도구마다
 * 보는 것이 달라서 그대로 각자 한다.
 *
 * ── 챕터 하나는 파일 하나이거나 디렉터리 하나다 ────────────────
 *   chapters/ch04-extension.ts        한 파일에 다 들어 있는 챕터
 *   chapters/ch01-genai-to-agent.ts   레슨 파일을 이어 붙이는 인덱스
 *   chapters/ch01/01-L00-frame.ts     ← 그 조각들. 파일명 순서가 곧 덱 순서
 *
 * 인덱스 파일에는 화면이 없고 머리 주석(규모 · 레슨 목록)만 있다. 그래서
 * `chapterSource()` 는 **인덱스 + 조각들**을 이어 붙인 것을 돌려준다 —
 * 첫 블록 주석이 인덱스의 것이라 `규모: … N장` 검사가 그대로 돈다.
 *
 * 쪼갠 챕터를 늘리려면 디렉터리를 만들고 `NN-` 로 시작하는 파일을 넣으면
 * 된다. 여기는 안 고쳐도 된다.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CHAPTER_DIR = path.join(HERE, "..", "src/production/chapters");

/** `[{ key: "ch01", index: 절대경로, parts: [절대경로…] }]` — 덱 순서. */
export function chapterEntries(root = path.resolve(HERE, "..")) {
  const chapterDir = path.join(root, "src/production/chapters");
  const names = fs.readdirSync(chapterDir);
  return names
    .filter((n) => /^ch\d\d-.*\.ts$/.test(n))
    .sort()
    .map((n) => {
      const key = n.slice(0, 4);
      const dir = path.join(chapterDir, key);
      const parts = fs.existsSync(dir)
        ? fs
            .readdirSync(dir)
            .filter((f) => f.endsWith(".ts"))
            .sort()
            .map((f) => path.join(dir, f))
        : [];
      return { key, index: path.join(chapterDir, n), parts };
    });
}

/** 그 챕터를 이루는 파일 전부. 쪼개지 않은 챕터면 한 개다. */
export function chapterFiles(entry) {
  return entry.parts.length ? [entry.index, ...entry.parts] : [entry.index];
}

/** 파싱용 원본. 인덱스 머리 주석이 맨 앞이고 그 뒤로 화면이 순서대로 붙는다. */
export function chapterSource(entry) {
  return chapterFiles(entry)
    .map((f) => fs.readFileSync(f, "utf8"))
    .join("\n");
}

/** 화면 ID 를 덱 순서대로. 세 도구가 같은 규칙을 쓰도록 여기 둔다. */
export function chapterIds(entry) {
  return [...chapterSource(entry).matchAll(/^\s+id:\s*"([a-z0-9-]+)"/gm)].map(
    (m) => m[1],
  );
}
