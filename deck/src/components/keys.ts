/* 단축키는 글자가 아니라 자판 위치로 읽는다.
   한글 입력 상태에서 F를 누르면 e.key는 "ㄹ"이지만 e.code는 그대로 "KeyF"다.
   글자 키는 소문자 한 글자("f")로, 나머지(ArrowRight, Escape, " ", 숫자)는 e.key 그대로 돌려준다. */
export function shortcutKey(e: KeyboardEvent): string {
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3).toLowerCase();
  return e.key.length === 1 ? e.key.toLowerCase() : e.key;
}
