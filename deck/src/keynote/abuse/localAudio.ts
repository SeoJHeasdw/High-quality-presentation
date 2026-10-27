/*
 * 발표자 컴퓨터에만 두는 음성(deck/local-only/, 깃에 올리지 않음)이 있으면 그것을, 없으면 public/abuse/audio의 기본 음성을 쓴다.
 * 같은 이름의 .json에는 그 음성에 맞춘 값(예: 자막이 뜨는 시각)을 둔다. 폴더가 없으면 둘 다 비어 있다.
 */
const DIR = "../../../local-only/";
const audio = import.meta.glob<string>("../../../local-only/*.m4a", { eager: true, query: "?url", import: "default" });
const notes = import.meta.glob<Record<string, unknown>>("../../../local-only/*.json", { eager: true, import: "default" });

export function audioSrc(name: string, fallback: string): string {
  return audio[`${DIR}${name}.m4a`] ?? fallback;
}

export function localNote<T>(name: string): T | undefined {
  return notes[`${DIR}${name}.json`] as T | undefined;
}
