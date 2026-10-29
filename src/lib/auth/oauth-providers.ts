import "server-only";
import { googleConfig, spotifyConfig } from "@/lib/env";
import { UpstreamError } from "@/lib/http";
import { AuthExpiredError, NotConfiguredError } from "./errors";
import type { Provider, ProviderSession } from "./session";

interface TokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

/** Spotify Liked Songs·플레이리스트 읽기 권한 */
const SPOTIFY_SCOPES = ["user-library-read", "playlist-read-private", "playlist-read-collaborative"];
/** YouTube 좋아요·재생목록 읽기 권한 (읽기 전용) */
const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/youtube.readonly"];

export interface AuthorizeParams {
  redirectUri: string;
  state: string;
  challenge: string;
}

export function authorizeUrl(provider: Provider, { redirectUri, state, challenge }: AuthorizeParams): string {
  if (provider === "spotify") {
    const cfg = spotifyConfig();
    if (!cfg) throw new NotConfiguredError(provider);
    const url = new URL("https://accounts.spotify.com/authorize");
    url.search = new URLSearchParams({
      client_id: cfg.clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: SPOTIFY_SCOPES.join(" "),
      state,
      code_challenge_method: "S256",
      code_challenge: challenge,
    }).toString();
    return url.toString();
  }
  const cfg = googleConfig();
  if (!cfg) throw new NotConfiguredError(provider);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: GOOGLE_SCOPES.join(" "),
    state,
    code_challenge_method: "S256",
    code_challenge: challenge,
    access_type: "offline",
    include_granted_scopes: "true",
    // refresh token을 매번 받으려면 동의 화면을 다시 띄워야 한다
    prompt: "consent",
  }).toString();
  return url.toString();
}

async function postToken(url: string, body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => ({}))) as Partial<TokenResponse> & { error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    if (json.error === "invalid_grant") throw new AuthExpiredError();
    throw new UpstreamError(`토큰 발급 실패: ${json.error_description ?? json.error ?? `HTTP ${res.status}`}`, res.status);
  }
  return json as TokenResponse;
}

function toSession(token: TokenResponse, previous?: ProviderSession): ProviderSession {
  return {
    accessToken: token.access_token,
    // 갱신 응답에 새 refresh token이 없으면 기존 것을 계속 쓴다
    refreshToken: token.refresh_token ?? previous?.refreshToken,
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
    displayName: previous?.displayName,
  };
}

export async function exchangeCode(provider: Provider, code: string, verifier: string, redirectUri: string): Promise<ProviderSession> {
  if (provider === "spotify") {
    const cfg = spotifyConfig();
    if (!cfg) throw new NotConfiguredError(provider);
    // PKCE 방식이라 client secret 없이 교환한다
    const token = await postToken("https://accounts.spotify.com/api/token", {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: cfg.clientId,
      code_verifier: verifier,
    });
    return toSession(token);
  }
  const cfg = googleConfig();
  if (!cfg) throw new NotConfiguredError(provider);
  const token = await postToken("https://oauth2.googleapis.com/token", {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code_verifier: verifier,
  });
  return toSession(token);
}

export async function refreshSession(provider: Provider, session: ProviderSession): Promise<ProviderSession> {
  if (!session.refreshToken) throw new AuthExpiredError();
  if (provider === "spotify") {
    const cfg = spotifyConfig();
    if (!cfg) throw new NotConfiguredError(provider);
    const token = await postToken("https://accounts.spotify.com/api/token", {
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
      client_id: cfg.clientId,
    });
    return toSession(token, session);
  }
  const cfg = googleConfig();
  if (!cfg) throw new NotConfiguredError(provider);
  const token = await postToken("https://oauth2.googleapis.com/token", {
    grant_type: "refresh_token",
    refresh_token: session.refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });
  return toSession(token, session);
}

/** 연결 해제 시 Google 토큰 폐기 (Spotify는 폐기 API가 없다) */
export async function revoke(provider: Provider, session: ProviderSession): Promise<void> {
  if (provider !== "google") return;
  const token = session.refreshToken ?? session.accessToken;
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    signal: AbortSignal.timeout(5_000),
  }).catch(() => undefined);
}
