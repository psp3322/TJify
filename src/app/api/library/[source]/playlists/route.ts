import type { NextRequest } from "next/server";
import { jsonError, withProvider } from "@/lib/api";
import { isLibrarySource } from "@/lib/auth/provider-param";
import * as spotify from "@/lib/sources/spotify";
import * as youtube from "@/lib/sources/youtube";

/** 내 플레이리스트(재생목록) 목록 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/library/[source]/playlists">) {
  const { source } = await ctx.params;
  if (!isLibrarySource(source)) return jsonError(404, "bad_request", "알 수 없는 출처입니다.");
  return source === "spotify"
    ? withProvider(request, "spotify", async (token) => ({ playlists: await spotify.fetchPlaylists(token) }))
    : withProvider(request, "google", async (token) => ({ playlists: await youtube.fetchPlaylists(token) }));
}
