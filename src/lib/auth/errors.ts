import { t, type MessageKey } from "@/lib/i18n";

const PROVIDER_NAME = { spotify: "Spotify", google: "YouTube" } as const;

export class AuthExpiredError extends Error {
  constructor(message = t("error.authExpired")) {
    super(message);
    this.name = "AuthExpiredError";
  }
}

export class NotConfiguredError extends Error {
  constructor(provider: "spotify" | "google") {
    super(t("error.notConfigured", { provider: PROVIDER_NAME[provider] }));
    this.name = "NotConfiguredError";
  }
}

export class NotConnectedError extends Error {
  constructor(provider: "spotify" | "google") {
    super(t("error.notConnected", { provider: PROVIDER_NAME[provider] }));
    this.name = "NotConnectedError";
  }
}

/**
 * OAuth가 끝나고 첫 화면으로 돌아갈 때 주소에 붙이는 오류 코드.
 * 문구 대신 코드만 넘겨서, 누군가 주소에 임의의 문장을 넣어 화면에 띄우지 못하게 한다.
 */
export const LOGIN_ERROR_CODES = ["access_denied", "state_mismatch", "not_configured", "network", "failed"] as const;

export type LoginErrorCode = (typeof LOGIN_ERROR_CODES)[number];

export function loginErrorMessage(code: string | null, translate: (key: MessageKey) => string = t): string | null {
  if (!code) return null;
  const known = (LOGIN_ERROR_CODES as readonly string[]).includes(code) ? (code as LoginErrorCode) : "failed";
  return translate(`login.${known}`);
}
