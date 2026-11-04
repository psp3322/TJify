"use client";

import { AuthExpiredError, NotConfiguredError, NotConnectedError, type LoginErrorCode } from "@/lib/auth/errors";
import { codeChallenge, randomToken } from "@/lib/auth/pkce";
import { PUBLIC_CONFIG, siteUrl } from "@/lib/config";
import { isNetworkError, UpstreamError } from "@/lib/http";
import { t } from "@/lib/i18n";
import { fetchDisplayName } from "@/lib/sources/spotify";
import { fetchChannelName } from "@/lib/sources/youtube";
import { STORAGE_KEYS } from "./storage";
import { createStoredValue, type StoredValue } from "./stored-value";

/*
 * 브라우저에서 하는 계정 연결 (서버 없는 정적 사이트용).
 *  Spotify : Authorization Code + PKCE. client secret 없이 토큰을 받고 refresh token으로 갱신한다.
 *  Google  : 클라이언트 측 웹 앱용 OAuth 흐름(response_type=token). 토큰이 한 시간 뒤 만료되면 다시 연결한다.
 * 리디렉션 URI는 사이트 첫 화면 주소 하나다. 토큰은 이 브라우저의 localStorage에만 저장한다.
 */

export type Provider = "spotify" | "google";

export interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  displayName?: string;
}

/** Spotify Liked Songs·플레이리스트 읽기 권한 */
const SPOTIFY_SCOPES = ["user-library-read", "playlist-read-private", "playlist-read-collaborative"];
/** YouTube 좋아요·재생목록 읽기 권한 (읽기 전용) */
const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/youtube.readonly"];
const PENDING_KEY = "tjify:auth-pending";
const REFRESH_MARGIN_MS = 60_000;

export const tokenStores: Record<Provider, StoredValue<StoredToken | null>> = {
  spotify: createStoredValue<StoredToken | null>(STORAGE_KEYS.authSpotify, null),
  google: createStoredValue<StoredToken | null>(STORAGE_KEYS.authGoogle, null),
};

export function isConfigured(provider: Provider): boolean {
  return Boolean(provider === "spotify" ? PUBLIC_CONFIG.spotifyClientId : PUBLIC_CONFIG.googleClientId);
}

export function spotifyAuthorizeUrl(clientId: string, redirectUri: string, state: string, challenge: string): string {
  const url = new URL("https://accounts.spotify.com/authorize");
  url.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SPOTIFY_SCOPES.join(" "),
    state,
    code_challenge_method: "S256",
    code_challenge: challenge,
  }).toString();
  return url.toString();
}

export function googleAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "token",
    scope: GOOGLE_SCOPES.join(" "),
    state,
    include_granted_scopes: "true",
  }).toString();
  return url.toString();
}

interface PendingLogin {
  provider: Provider;
  state: string;
  verifier?: string;
}

// 로그인 화면에 다녀오는 동안만 필요한 값이라 탭이 닫히면 사라지는 sessionStorage에 둔다
function savePending(pending: PendingLogin) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // 저장이 막힌 브라우저면 돌아왔을 때 state_mismatch로 안내된다
  }
}

function takePending(): PendingLogin | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingLogin) : null;
  } catch {
    return null;
  }
}

/** 로그인 화면으로 보낸다. 돌아오면 첫 화면에서 completeLogin으로 마무리한다 */
export async function startLogin(provider: Provider): Promise<void> {
  if (!isConfigured(provider)) throw new NotConfiguredError(provider);
  const state = randomToken(16);
  if (provider === "spotify") {
    const verifier = randomToken(48);
    savePending({ provider, state, verifier });
    window.location.assign(spotifyAuthorizeUrl(PUBLIC_CONFIG.spotifyClientId, siteUrl(), state, await codeChallenge(verifier)));
  } else {
    savePending({ provider, state });
    window.location.assign(googleAuthorizeUrl(PUBLIC_CONFIG.googleClientId, siteUrl(), state));
  }
}

export type OAuthResponse =
  | { kind: "code"; code: string; state: string }
  | { kind: "token"; accessToken: string; expiresIn: number; state: string }
  | { kind: "error"; error: string; state: string };

/**
 * 주소에 실려 온 OAuth 응답을 읽는다. Spotify는 쿼리(?code=…), Google은 # 뒤(#access_token=…)에 담아 보낸다.
 * state가 없으면 OAuth 응답이 아니다 (이 사이트가 붙이는 ?error= 알림과 구분된다).
 */
export function readOAuthResponse(search: string, hash: string): OAuthResponse | null {
  for (const params of [new URLSearchParams(search), new URLSearchParams(hash.replace(/^#/, ""))]) {
    const state = params.get("state");
    if (!state) continue;
    const error = params.get("error");
    if (error) return { kind: "error", error, state };
    const code = params.get("code");
    if (code) return { kind: "code", code, state };
    const accessToken = params.get("access_token");
    if (accessToken) {
      const expiresIn = Number(params.get("expires_in"));
      return { kind: "token", accessToken, expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600, state };
    }
  }
  return null;
}

interface TokenJson {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

async function requestSpotifyToken(body: Record<string, string>, previous?: StoredToken): Promise<StoredToken> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: PUBLIC_CONFIG.spotifyClientId, ...body }),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => ({}))) as TokenJson;
  if (!res.ok || !json.access_token) {
    if (json.error === "invalid_grant") throw new AuthExpiredError();
    throw new UpstreamError(t("error.spotifyToken", { detail: json.error_description ?? json.error ?? `HTTP ${res.status}` }), res.status);
  }
  return {
    accessToken: json.access_token,
    // 갱신 응답에 새 refresh token이 없으면 기존 것을 계속 쓴다
    refreshToken: json.refresh_token ?? previous?.refreshToken,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    displayName: previous?.displayName,
  };
}

export type LoginOutcome = { ok: true; provider: Provider } | { ok: false; provider: Provider | null; error: LoginErrorCode };

/** 로그인 화면에서 돌아온 응답을 확인하고 토큰을 저장한다 */
export async function completeLogin(response: OAuthResponse): Promise<LoginOutcome> {
  const pending = takePending();
  if (!pending || pending.state !== response.state) return { ok: false, provider: pending?.provider ?? null, error: "state_mismatch" };
  const { provider } = pending;
  if (response.kind === "error") return { ok: false, provider, error: response.error === "access_denied" ? "access_denied" : "failed" };

  try {
    let token: StoredToken;
    if (provider === "spotify" && response.kind === "code" && pending.verifier) {
      token = await requestSpotifyToken({
        grant_type: "authorization_code",
        code: response.code,
        redirect_uri: siteUrl(),
        code_verifier: pending.verifier,
      });
      token.displayName = await fetchDisplayName(token.accessToken);
    } else if (provider === "google" && response.kind === "token") {
      token = { accessToken: response.accessToken, expiresAt: Date.now() + response.expiresIn * 1000 };
      token.displayName = await fetchChannelName(token.accessToken);
    } else {
      return { ok: false, provider, error: "failed" };
    }
    tokenStores[provider].set(token);
    return { ok: true, provider };
  } catch (error) {
    return { ok: false, provider, error: isNetworkError(error) ? "network" : "failed" };
  }
}

const refreshing = new Map<Provider, Promise<StoredToken>>();

function expire(provider: Provider): never {
  tokenStores[provider].set(null);
  throw new AuthExpiredError(t("error.authExpiredProvider", { provider: provider === "spotify" ? "Spotify" : "YouTube" }));
}

async function refresh(provider: Provider, current: StoredToken): Promise<StoredToken> {
  const refreshToken = current.refreshToken;
  // Google 클라이언트 측 흐름에는 refresh token이 없어서 다시 연결해야 한다
  if (provider === "google" || !refreshToken) expire(provider);
  let pending = refreshing.get(provider);
  if (!pending) {
    pending = requestSpotifyToken({ grant_type: "refresh_token", refresh_token: refreshToken }, current)
      .then((token) => {
        tokenStores[provider].set(token);
        return token;
      })
      .catch((error: unknown) => (error instanceof AuthExpiredError ? expire(provider) : Promise.reject(error)))
      .finally(() => refreshing.delete(provider));
    refreshing.set(provider, pending);
  }
  return pending;
}

/** 연결한 계정의 access token으로 run을 실행한다. 만료가 가까우면 먼저 갱신하고, 401이 나면 한 번 갱신한 뒤 다시 시도한다 */
export async function withToken<T>(provider: Provider, run: (accessToken: string) => Promise<T>): Promise<T> {
  let token = tokenStores[provider].getSnapshot();
  if (!token) throw new NotConnectedError(provider);
  let refreshed = false;
  if (token.expiresAt - REFRESH_MARGIN_MS <= Date.now()) {
    token = await refresh(provider, token);
    refreshed = true;
  }
  try {
    return await run(token.accessToken);
  } catch (error) {
    if (!(error instanceof AuthExpiredError)) throw error;
    if (refreshed) expire(provider);
    token = await refresh(provider, token);
    try {
      return await run(token.accessToken);
    } catch (retryError) {
      if (retryError instanceof AuthExpiredError) expire(provider);
      throw retryError;
    }
  }
}

export function disconnect(provider: Provider) {
  const token = tokenStores[provider].getSnapshot();
  tokenStores[provider].set(null);
  if (provider === "google" && token) {
    // Google 쪽 권한도 바로 거둔다. 실패해도 토큰은 한 시간 뒤 저절로 만료된다 (Spotify는 폐기 API가 없다)
    void fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token.accessToken)}`, { method: "POST", mode: "no-cors" }).catch(
      () => undefined,
    );
  }
}
