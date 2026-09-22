/**
 * COURSE 덱의 챕터 레지스트리.
 *
 * 화면 원고는 여기 없다. chapters/chXX-*.ts 에 챕터별로 들어 있고
 * 이 파일은 그것을 파일명 순서로 모아 하나의 덱으로 잇기만 한다.
 *
 * ── 왜 나눠 두는가 ────────────────────────────────────────────
 * 수백 장을 한 파일에 두면 챕터 하나를 고칠 때도 전체를 읽어야 한다.
 * 화면 수에 상한이 없으므로(course-blueprint.md §5) 이 비용은 커지기만 한다.
 * 챕터 파일은 자기 레슨 목록과 예산을 헤더 주석에 들고 있으므로,
 * 한 챕터를 작업할 때 필요한 건 그 파일 하나와 같은 챕터의 대본뿐이다.
 *
 * ── 새 챕터를 추가하려면 ──────────────────────────────────────
 * chapters/ 에 `chXX-이름.ts` 를 만들고 ChapterSpec 을 default export
 * 하면 끝이다. glob 이 자동으로 집어가므로 이 파일은 건드리지 않는다.
 * 대본은 script/course/chXX.md 에 같은 화면 ID 를 `## 키` 로 쓴다.
 */

import { SCRIPT } from "../script";
import { slideSteps } from "./course-types";
import type { ChapterSpec, CourseSlideSpec } from "./course-types";

export { slideSteps } from "./course-types";
export type {
  ChapterSpec,
  CourseLayout,
  CourseSide,
  CourseSlideSpec,
} from "./course-types";

const modules = import.meta.glob("./chapters/*.ts", {
  eager: true,
}) as Record<string, { default: ChapterSpec }>;

/** 파일명이 chXX- 로 시작하므로 경로 정렬이 곧 챕터 순서다. */
export const CHAPTERS: ChapterSpec[] = Object.keys(modules)
  .sort()
  .map((path) => modules[path].default);

/** 덱이 실제로 넘기는 전체 화면. 배열 순서가 녹화 순서다. */
export const COURSE_SLIDES: CourseSlideSpec[] = CHAPTERS.flatMap(
  (chapter) => chapter.slides,
);

/**
 * 화면 ID 는 소문자 슬러그다 (`toolpick-semantic`). course-types.ts 참고.
 *
 * 챕터 번호를 검사하지 않는다 — ID 에 위치가 없기 때문이다. 화면이 어느
 * 챕터에 있는지는 배열이 말하고, ID 는 그게 무슨 화면인지만 말한다.
 */
const ID_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * 개발 중에만 도는 무결성 검사.
 *
 * 화면이 수백 장이 되면 ID 오타, 두 곳에 붙여 넣은 화면,
 * 이름만 바꾸고 대본 키를 안 고친 화면을 눈으로 잡을 수 없다.
 * 프로덕션 번들에서는 통째로 빠진다.
 */
if (import.meta.env.DEV) {
  const problems: string[] = [];
  const seen = new Map<string, number>();

  for (const chapter of CHAPTERS) {
    for (const slide of chapter.slides) {
      if (!ID_FORMAT.test(slide.id)) {
        problems.push(
          `${slide.id} — ID 는 소문자 슬러그여야 한다 (예: toolpick-semantic)`,
        );
      }

      seen.set(slide.id, (seen.get(slide.id) ?? 0) + 1);

      const script = SCRIPT[slide.id];
      if (!script) {
        problems.push(`${slide.id} — 대본 없음 (script/course/chXX.md)`);
      } else {
        // `→` 를 눌렀는데 읽을 대본이 없는 스텝을 잡는다.
        const missing = [];
        for (let s = 0; s <= slideSteps(slide); s++) {
          if (!script[s]) missing.push(s);
        }
        if (missing.length) {
          problems.push(`${slide.id} — 스텝 ${missing.join(", ")} 대본 없음`);
        }
      }
    }
  }

  for (const [id, count] of seen) {
    if (count > 1) problems.push(`${id} — ID 가 ${count}번 중복됨`);
  }

  if (problems.length) {
    console.warn(
      `[course] 화면 ${COURSE_SLIDES.length}장 중 ${problems.length}건:\n` +
        problems.map((p) => `  · ${p}`).join("\n"),
    );
  }
}
