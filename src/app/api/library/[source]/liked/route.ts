import type { NextRequest } from "next/server";
import { jsonError, withProvider } from "@/lib/api";
import { isLibrarySource } from "@/lib/auth/provider-param";
import * as spotify from "@/lib/sources/spotify";
import * as youtube from "@/lib/sources/youtube";

/** 좋아요 목록 한 페이지 (Spotify Liked Songs / YouTube 좋아요 표시한 동영상) */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/library/[source]/liked">) {
  const { source } = await ctx.params;
  const cursor = request.nextUrl.searchParams.get("cursor");
  if (!isLibrarySource(source)) return jsonError(404, "bad_request", "알 수 없는 출처입니다.");
  return source === "spotify"
    ? withProvider(request, "spotify", (token) => spotify.fetchLikedTracks(token, cursor))
    : withProvider(request, "google", (token) => youtube.fetchLikedVideos(token, cursor));
}
