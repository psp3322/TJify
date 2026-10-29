import type { NextRequest } from "next/server";
import { jsonError, withProvider } from "@/lib/api";
import { isLibrarySource } from "@/lib/auth/provider-param";
import * as spotify from "@/lib/sources/spotify";
import * as youtube from "@/lib/sources/youtube";

/** 플레이리스트 곡 한 페이지 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/library/[source]/playlists/[id]">) {
  const { source, id } = await ctx.params;
  const cursor = request.nextUrl.searchParams.get("cursor");
  if (!isLibrarySource(source)) return jsonError(404, "bad_request", "알 수 없는 출처입니다.");
  if (!/^[\w-]{1,128}$/.test(id)) return jsonError(400, "bad_request", "플레이리스트 id 형식이 맞지 않습니다.");
  return source === "spotify"
    ? withProvider(request, "spotify", (token) => spotify.fetchPlaylistTracks(token, id, cursor))
    : withProvider(request, "google", (token) => youtube.fetchPlaylistItems(token, id, cursor));
}
