export class AuthExpiredError extends Error {
  constructor(message = "로그인이 만료됐습니다. 다시 연결해 주세요.") {
    super(message);
    this.name = "AuthExpiredError";
  }
}

export class NotConfiguredError extends Error {
  constructor(provider: "spotify" | "google") {
    super(`${provider === "spotify" ? "Spotify" : "Google"} 연동 설정(환경 변수)이 없습니다.`);
    this.name = "NotConfiguredError";
  }
}

/**
 * OAuth가 끝나고 첫 화면으로 돌아갈 때 주소에 붙이는 오류 코드.
 * 문구 대신 코드만 넘겨서, 누군가 주소에 임의의 문장을 넣어 화면에 띄우지 못하게 한다.
 */
export const LOGIN_ERRORS = {
  access_denied: "연결을 취소했어요.",
  state_mismatch: "로그인 확인 값이 맞지 않아요. 처음부터 다시 연결해 주세요.",
  not_configured: "서버에 연동 설정(환경 변수)이 없어요. README의 설정 방법을 확인해 주세요.",
  network: "로그인 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.",
  failed: "연결에 실패했어요. 다시 시도해 주세요.",
} as const;

export type LoginErrorCode = keyof typeof LOGIN_ERRORS;

export function loginErrorMessage(code: string | null): string | null {
  if (!code) return null;
  return code in LOGIN_ERRORS ? LOGIN_ERRORS[code as LoginErrorCode] : LOGIN_ERRORS.failed;
}
