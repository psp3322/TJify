"use client";

import { UpstreamError } from "@/lib/http";
import * as spotify from "@/lib/sources/spotify";
import * as youtube from "@/lib/sources/youtube";
import type { PlaylistSummary, TrackPage } from "@/lib/types";
import { isConfigured, tokenStores, withToken } from "./auth";
import { youtubeApiKey } from "./settings";

/*
 * 곡 목록 불러오기. 서버 없이 방문자 브라우저에서 YouTube Data API와 Spotify Web API를 바로 부른다.
 *  YouTube : 공개·일부 공개 재생목록은 API 키(사이트에 넣어 둔 키나 설정에 넣은 내 키)로 로그인 없이 읽는다.
 *            키가 없거나 비공개 재생목록이면 YouTube를 연결한 계정의 토큰으로 읽는다.
 *  Spotify : 2026년 2월 정책 변경으로 개발 모드 앱은 연결한 계정이 만들었거나 공동 작업 중인 플레이리스트만 읽을 수 있다.
 */

export type LibraryErrorCode = "not_connected" | "not_configured" | "no_youtube_key";

export class LibraryError extends Error {
  constructor(
    message: string,
    readonly code: LibraryErrorCode,
  ) {
    super(message);
    this.name = "LibraryError";
  }
}

const SPOTIFY_NOT_CONFIGURED = "Spotify 플레이리스트는 Spotify 정책상 로그인 없이 읽을 수 없어요. 곡 목록을 붙여넣기로 넣어 주세요.";
const SPOTIFY_NOT_CONNECTED =
  "Spotify 플레이리스트는 Spotify를 연결한 뒤에 가져올 수 있어요. Spotify 정책상 연결한 계정이 만들었거나 공동 작업 중인 플레이리스트만 읽을 수 있어요.";
const SPOTIFY_FORBIDDEN =
  "이 플레이리스트는 가져올 수 없어요. Spotify 정책상 연결한 계정이 만들었거나 공동 작업 중인 플레이리스트만 읽을 수 있고, Spotify가 만든 플레이리스트(Today's Top Hits 등)도 막혀 있어요.";
const YOUTUBE_NO_KEY = "YouTube 재생목록을 가져오려면 YouTube API 키가 필요해요. 아래 '설정'에 내 키를 넣거나 YouTube를 연결해 주세요.";

async function youtubePage(auth: youtube.YouTubeAuth | string, id: string, cursor: string | null): Promise<TrackPage> {
  const [page, title] = await Promise.all([
    youtube.fetchPlaylistItems(auth, id, cursor).then((p) => youtube.withViewCounts(auth, p)),
    cursor ? Promise.resolve(undefined) : youtube.fetchPlaylistTitle(auth, id),
  ]);
  return title ? { ...page, title } : page;
}

async function youtubeLinkPage(id: string, cursor: string | null): Promise<TrackPage> {
  const key = youtubeApiKey();
  const connected = Boolean(tokenStores.google.getSnapshot());
  if (key) {
    try {
      return await youtubePage({ key }, id, cursor);
    } catch (error) {
      // 비공개 재생목록이면 연결된 계정으로 한 번 더 시도한다
      const privateList = error instanceof UpstreamError && (error.status === 403 || error.status === 404);
      if (!privateList || !connected) throw error;
    }
  }
  if (!connected) throw new LibraryError(YOUTUBE_NO_KEY, "no_youtube_key");
  return withToken("google", (token) => youtubePage(token, id, cursor));
}

async function spotifyLinkPage(id: string, cursor: string | null): Promise<TrackPage> {
  if (!isConfigured("spotify")) throw new LibraryError(SPOTIFY_NOT_CONFIGURED, "not_configured");
  if (!tokenStores.spotify.getSnapshot()) throw new LibraryError(SPOTIFY_NOT_CONNECTED, "not_connected");
  return withToken("spotify", async (token) => {
    try {
      const [page, title] = await Promise.all([
        spotify.fetchPlaylistTracks(token, id, cursor),
        cursor ? Promise.resolve(undefined) : spotify.fetchPlaylistName(token, id),
      ]);
      return title ? { ...page, title } : page;
    } catch (error) {
      if (error instanceof UpstreamError && (error.status === 403 || error.status === 404)) throw new UpstreamError(SPOTIFY_FORBIDDEN, error.status);
      throw error;
    }
  });
}

type PageLoader = (cursor: string | null) => Promise<TrackPage>;

/**
 * 목록 키 → 페이지를 불러오는 함수. 모르는 키면 null.
 *   "spotify:liked", "youtube:playlist:PL123"  연결한 계정의 좋아요·플레이리스트
 *   "link:youtube:PL123", "link:spotify:37i…"  붙여넣은 링크
 */
export function libraryLoader(key: string): PageLoader | null {
  const [first, second, third] = key.split(":");
  if (first === "link" && third) {
    if (second === "youtube") return (cursor) => youtubeLinkPage(third, cursor);
    if (second === "spotify") return (cursor) => spotifyLinkPage(third, cursor);
    return null;
  }
  if (first === "spotify") {
    if (second === "liked") return (cursor) => withToken("spotify", (token) => spotify.fetchLikedTracks(token, cursor));
    if (second === "playlist" && third) return (cursor) => withToken("spotify", (token) => spotify.fetchPlaylistTracks(token, third, cursor));
  }
  if (first === "youtube") {
    if (second === "liked") return (cursor) => withToken("google", (token) => youtube.fetchLikedVideos(token, cursor));
    if (second === "playlist" && third) return (cursor) => withToken("google", (token) => youtubePage(token, third, cursor));
  }
  return null;
}

/** 연결한 계정의 플레이리스트(재생목록) 목록 */
export function fetchPlaylists(source: "spotify" | "youtube"): Promise<PlaylistSummary[]> {
  return source === "spotify" ? withToken("spotify", spotify.fetchPlaylists) : withToken("google", youtube.fetchPlaylists);
}
