import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { AuthExpiredError, NotConfiguredError } from "@/lib/auth/errors";
import { refreshSession } from "@/lib/auth/oauth-providers";
import { clearSession, readSession, writeSession, type Provider, type ProviderSession } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/http";

export interface ApiError {
  error: "not_connected" | "auth_expired" | "not_configured" | "upstream" | "bad_request" | "rate_limited" | "internal";
  message: string;
}

export function jsonError(status: number, error: ApiError["error"], message: string): NextResponse<ApiError> {
  return NextResponse.json({ error, message }, { status });
}

export function errorResponse(error: unknown): NextResponse<ApiError> {
  if (error instanceof AuthExpiredError) return jsonError(401, "auth_expired", error.message);
  if (error instanceof NotConfiguredError) return jsonError(503, "not_configured", error.message);
  if (error instanceof UpstreamError) {
    const status = error.status && [403, 404, 429, 503].includes(error.status) ? error.status : 502;
    return jsonError(status, "upstream", error.message);
  }
  console.error(error);
  return jsonError(500, "internal", "서버에서 문제가 생겼습니다.");
}

const REFRESH_MARGIN_MS = 60_000;

/**
 * 연동된 계정의 access token으로 run을 실행하고 JSON으로 돌려준다.
 * 만료가 가까우면 먼저 갱신하고, 401이 나면 한 번 갱신 후 다시 시도한다. 갱신한 토큰은 쿠키에 다시 쓴다.
 */
export async function withProvider<T>(request: NextRequest, provider: Provider, run: (accessToken: string) => Promise<T>): Promise<NextResponse> {
  let session: ProviderSession | null;
  try {
    session = await readSession(request, provider);
  } catch (error) {
    return errorResponse(error);
  }
  if (!session) return jsonError(401, "not_connected", "계정이 연결돼 있지 않습니다.");

  let current = session;
  let refreshed = false;
  const refresh = async () => {
    current = await refreshSession(provider, current);
    refreshed = true;
  };

  try {
    if (current.expiresAt - REFRESH_MARGIN_MS <= Date.now()) await refresh();
    let data: T;
    try {
      data = await run(current.accessToken);
    } catch (error) {
      if (!(error instanceof AuthExpiredError) || refreshed) throw error;
      await refresh();
      data = await run(current.accessToken);
    }
    const res = NextResponse.json(data);
    if (refreshed) await writeSession(request, res, provider, current);
    return res;
  } catch (error) {
    const res = errorResponse(error);
    // refresh token까지 거절되면 쿠키를 지워 다시 연결하게 한다
    if (error instanceof AuthExpiredError) clearSession(request, res, provider);
    // 갱신은 됐는데 그다음 호출이 실패한 경우에도 새 토큰은 저장한다 (Spotify는 갱신할 때 refresh token을 바꿔 줄 수 있다)
    else if (refreshed) await writeSession(request, res, provider, current);
    return res;
  }
}

/** 다른 사이트가 이 서버를 노래방 사이트 프록시로 쓰지 못하게, 같은 출처의 요청만 받는다 */
export function isSameOrigin(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "none";
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin || origin === process.env.APP_URL?.replace(/\/+$/, "");
}
