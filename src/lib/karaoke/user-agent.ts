const DEFAULT_UA = "Mozilla/5.0 (compatible; TJify/0.1; +https://github.com/psp3322/TJify)";

/** 노래방 사이트에 보낼 User-Agent. 막히면 KARAOKE_USER_AGENT 환경 변수로 바꿀 수 있다 */
export function userAgent(): string {
  return process.env.KARAOKE_USER_AGENT?.trim() || DEFAULT_UA;
}
