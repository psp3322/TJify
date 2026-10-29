/** localStorage 읽기·쓰기. 사생활 보호 모드나 용량 초과로 실패해도 앱은 계속 동작해야 한다 */
export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 실패는 무시 (다음 방문 때 다시 찾으면 된다)
  }
}

export const STORAGE_KEYS = {
  matches: "tjify:matches:v1",
  overrides: "tjify:overrides:v1",
  sung: "tjify:sung:v1",
  prefs: "tjify:prefs:v1",
  paste: "tjify:paste:v1",
  links: "tjify:links:v1",
} as const;
