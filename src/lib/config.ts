/*
 * 빌드할 때 정해지는 공개 설정. GitHub Pages에서는 저장소 Settings → Secrets and variables → Actions에 넣은 값이 들어온다.
 * 정적 사이트라 이 값들은 누구나 볼 수 있는 자바스크립트 파일에 그대로 들어간다. 비밀 값은 넣으면 안 된다.
 */

/** GitHub Pages 프로젝트 사이트의 경로 (예: "/TJify"). 로컬에서는 빈 값 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

export const PUBLIC_CONFIG = {
  /** 공개 YouTube 재생목록을 읽는 API 키. Google Cloud에서 이 사이트 주소에서만 쓰이게 제한해 둔다 */
  youtubeApiKey: process.env.NEXT_PUBLIC_YOUTUBE_API_KEY?.trim() ?? "",
  /** Spotify 앱의 Client ID (PKCE 방식이라 secret은 필요 없다) */
  spotifyClientId: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID?.trim() ?? "",
  /** Google OAuth 웹 클라이언트 ID */
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "",
};

/** 사이트 첫 화면 주소. OAuth 리디렉션 URI와 공유 링크에 쓴다 (예: https://psp3322.github.io/TJify/) */
export function siteUrl(): string {
  return `${window.location.origin}${BASE_PATH}/`;
}

/** 빌드 때 만든 파일이나 public 폴더 파일의 주소 */
export function assetUrl(path: string): string {
  return `${BASE_PATH}${path}`;
}
