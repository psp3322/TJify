import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, isSameOrigin, jsonError, withProvider } from "@/lib/api";
import { readSession } from "@/lib/auth/session";
import { TtlCache } from "@/lib/cache";
import { youtubeApiKey } from "@/lib/env";
import { UpstreamError } from "@/lib/http";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";
import * as spotify from "@/lib/sources/spotify";
import * as youtube from "@/lib/sources/youtube";
import type { TrackPage } from "@/lib/types";

/*
 * 플레이리스트 링크로 곡 목록 가져오기.
 *  YouTube : 공개·일부 공개 재생목록은 서버 API 키(YOUTUBE_API_KEY)로 로그인 없이 읽는다.
 *            키가 없거나 비공개 재생목록이면 YouTube를 연결한 사용자의 토큰으로 읽는다.
 *  Spotify : 2026년 2월 정책 변경으로 개발 모드 앱은 연결한 계정이 만들었거나
 *            공동 작업 중인 플레이리스트만 읽을 수 있다.
 */

const take = createRateLimiter(120, 60_000);
// 같은 공개 재생목록을 여러 사람이 열어도 YouTube 할당량을 한 번만 쓰도록 잠깐 캐시한다
const publicPages = new TtlCache<TrackPage>(500);
const PUBLIC_TTL = 10 * 60 * 1000;

const SPOTIFY_NOT_CONNECTED =
  "Spotify 플레이리스트는 Spotify를 연결한 뒤에 가져올 수 있어요. Spotify 정책상 연결한 계정이 만들었거나 공동 작업 중인 플레이리스트만 읽을 수 있어요.";
const SPOTIFY_FORBIDDEN =
  "이 플레이리스트는 가져올 수 없어요. Spotify 정책상 연결한 계정이 만들었거나 공동 작업 중인 플레이리스트만 읽을 수 있고, Spotify가 만든 플레이리스트(Today's Top Hits 등)도 막혀 있어요.";
const YOUTUBE_NO_KEY =
  "로그인 없이 YouTube 재생목록을 가져오려면 서버에 YOUTUBE_API_KEY가 필요해요. 지금은 YouTube를 연결하면 가져올 수 있어요.";

async function youtubePage(auth: youtube.YouTubeAuth | string, id: string, cursor: string | null): Promise<TrackPage> {
  const [page, title] = await Promise.all([
    youtube.fetchPlaylistItems(auth, id, cursor).then((p) => youtube.withViewCounts(auth, p)),
    cursor ? Promise.resolve(undefined) : youtube.fetchPlaylistTitle(auth, id),
  ]);
  return title ? { ...page, title } : page;
}

export async function GET(request: NextRequest, ctx: RouteContext<"/api/import/[source]/[id]">) {
  const { source, id } = await ctx.params;
  const cursor = request.nextUrl.searchParams.get("cursor");
  if (source !== "spotify" && source !== "youtube") return jsonError(404, "bad_request", "알 수 없는 출처입니다.");
  if (!/^[\w-]{1,128}$/.test(id)) return jsonError(400, "bad_request", "플레이리스트 주소 형식이 맞지 않습니다.");
  if (!isSameOrigin(request)) return jsonError(403, "bad_request", "허용되지 않은 요청입니다.");

  const limit = take(clientKey(request.headers));
  if (!limit.ok) return jsonError(429, "rate_limited", `요청이 너무 많습니다. ${limit.retryAfterSec}초 뒤 다시 시도하세요.`);

  if (source === "youtube") {
    const key = youtubeApiKey();
    const googleSession = await readSession(request, "google").catch(() => null);
    if (key) {
      try {
        const page = await publicPages.getOrLoad(`${id}|${cursor ?? ""}`, () => youtubePage({ key }, id, cursor), () => PUBLIC_TTL);
        return NextResponse.json(page);
      } catch (error) {
        // 비공개 재생목록이면 연결된 계정으로 한 번 더 시도한다
        const privateList = error instanceof UpstreamError && (error.status === 403 || error.status === 404);
        if (!privateList || !googleSession) return errorResponse(error);
      }
    }
    if (!googleSession) return jsonError(503, "not_configured", YOUTUBE_NO_KEY);
    return withProvider(request, "google", (token) => youtubePage(token, id, cursor));
  }

  if (!(await readSession(request, "spotify").catch(() => null))) return jsonError(401, "not_connected", SPOTIFY_NOT_CONNECTED);
  return withProvider(request, "spotify", async (token) => {
    try {
      const [page, title] = await Promise.all([
        spotify.fetchPlaylistTracks(token, id, cursor),
        cursor ? Promise.resolve(undefined) : spotify.fetchPlaylistName(token, id),
      ]);
      return title ? { ...page, title } : page;
    } catch (error) {
      if (error instanceof UpstreamError && (error.status === 403 || error.status === 404)) {
        throw new UpstreamError(SPOTIFY_FORBIDDEN, error.status);
      }
      throw error;
    }
  });
}
