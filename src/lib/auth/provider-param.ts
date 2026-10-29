import type { Provider } from "./session";

export function isProvider(value: string): value is Provider {
  return value === "spotify" || value === "google";
}

export type LibrarySource = "spotify" | "youtube";

export function isLibrarySource(value: string): value is LibrarySource {
  return value === "spotify" || value === "youtube";
}

/** 라이브러리 출처 → 토큰을 가진 OAuth 제공자 */
export function providerOf(source: LibrarySource): Provider {
  return source === "spotify" ? "spotify" : "google";
}
