import "server-only";

export interface SpotifyConfig {
  clientId: string;
}

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
}

function read(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function spotifyConfig(): SpotifyConfig | null {
  const clientId = read("SPOTIFY_CLIENT_ID");
  return clientId ? { clientId } : null;
}

export function googleConfig(): GoogleConfig | null {
  const clientId = read("GOOGLE_CLIENT_ID");
  const clientSecret = read("GOOGLE_CLIENT_SECRET");
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** 공개 YouTube 재생목록을 로그인 없이 읽을 때 쓰는 서버 API 키 */
export function youtubeApiKey(): string | null {
  return read("YOUTUBE_API_KEY") ?? null;
}

/** 쿠키 암호화 키. iron-session은 32자 이상을 요구한다 */
export function sessionPassword(): string {
  const secret = read("SESSION_SECRET");
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET 환경 변수가 없거나 32자보다 짧습니다. README의 설정 방법을 참고하세요.");
  }
  return secret;
}

/**
 * OAuth 리디렉션 URI의 기준 주소.
 * Spotify·Google 콘솔에 등록한 주소와 글자 하나까지 같아야 해서, 배포 환경에서는 APP_URL을 꼭 지정한다.
 */
export function appOrigin(requestOrigin: string): string {
  return (read("APP_URL") ?? requestOrigin).replace(/\/+$/, "");
}
