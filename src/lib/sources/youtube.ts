import { AuthExpiredError } from "@/lib/auth/errors";
import { UpstreamError } from "@/lib/http";
import { parseVideoTitle } from "@/lib/text/youtube-title";
import type { PlaylistSummary, Track, TrackPage } from "@/lib/types";

/*
 * YouTube Data API v3
 *  - videos.list?myRating=like        : 좋아요 표시한 동영상 (유튜브 뮤직에서 좋아요한 곡도 여기 들어온다)
 *  - playlists.list?mine=true         : 내 재생목록
 *  - playlistItems.list?playlistId=…  : 재생목록 항목
 * 호출당 할당량 1 단위. 기본 일일 한도는 10,000 단위다.
 */

const API = "https://www.googleapis.com/youtube/v3";
const MUSIC_CATEGORY = "10";

interface Thumbnails {
  default?: { url: string };
  medium?: { url: string };
  high?: { url: string };
}

interface VideoResource {
  id: string;
  snippet?: {
    title?: string;
    channelTitle?: string;
    categoryId?: string;
    thumbnails?: Thumbnails;
  };
  statistics?: { viewCount?: string };
}

function viewCount(stats: VideoResource["statistics"]): number | undefined {
  const n = Number(stats?.viewCount);
  return Number.isFinite(n) && n >= 0 && stats?.viewCount !== undefined ? n : undefined;
}

interface PlaylistItemResource {
  snippet?: {
    title?: string;
    videoOwnerChannelTitle?: string;
    resourceId?: { videoId?: string };
    thumbnails?: Thumbnails;
  };
}

interface PlaylistResource {
  id: string;
  snippet?: { title?: string; channelTitle?: string; thumbnails?: Thumbnails };
  contentDetails?: { itemCount?: number };
}

interface ListResponse<T> {
  items?: T[];
  nextPageToken?: string;
  pageInfo?: { totalResults?: number };
}

const UNAVAILABLE_TITLES = new Set(["Deleted video", "Private video", "삭제된 동영상", "비공개 동영상"]);

function thumb(t: Thumbnails | undefined): string | undefined {
  return t?.default?.url ?? t?.medium?.url ?? t?.high?.url;
}

function toTrack(videoId: string, rawTitle: string, channel: string | undefined, thumbnails: Thumbnails | undefined, categoryId?: string): Track {
  const parsed = parseVideoTitle(rawTitle, channel);
  const isTopic = Boolean(channel && /\s+-\s+Topic$/i.test(channel));
  return {
    id: `youtube:${videoId}`,
    source: "youtube",
    title: parsed.title,
    artists: parsed.artists,
    rawTitle,
    imageUrl: thumb(thumbnails),
    url: `https://www.youtube.com/watch?v=${videoId}`,
    // 재생목록 항목에는 카테고리 정보가 없어서 그때는 음악으로 본다
    isMusic: categoryId === undefined ? true : categoryId === MUSIC_CATEGORY || isTopic,
  };
}

export function normalizeLikedVideo(v: VideoResource): Track | null {
  const title = v.snippet?.title;
  if (!v.id || !title || UNAVAILABLE_TITLES.has(title)) return null;
  const track = toTrack(v.id, title, v.snippet?.channelTitle, v.snippet?.thumbnails, v.snippet?.categoryId ?? "");
  const views = viewCount(v.statistics);
  return views === undefined ? track : { ...track, views };
}

export function normalizePlaylistItem(item: PlaylistItemResource): Track | null {
  const s = item.snippet;
  const videoId = s?.resourceId?.videoId;
  if (!videoId || !s?.title || UNAVAILABLE_TITLES.has(s.title)) return null;
  return toTrack(videoId, s.title, s.videoOwnerChannelTitle, s.thumbnails);
}

/** 로그인한 사용자의 access token, 또는 공개 데이터만 읽는 서버 API 키 */
export type YouTubeAuth = { token: string } | { key: string };

interface GoogleErrorBody {
  error?: { message?: string; errors?: Array<{ reason?: string }>; details?: Array<{ reason?: string }> };
}

async function youtubeGet<T>(auth: YouTubeAuth | string, path: string, params: Record<string, string>, fetchImpl: typeof fetch = fetch): Promise<T> {
  const a: YouTubeAuth = typeof auth === "string" ? { token: auth } : auth;
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  if ("key" in a) url.searchParams.set("key", a.key);
  const res = await fetchImpl(url, {
    headers: { ...("token" in a ? { Authorization: `Bearer ${a.token}` } : {}), Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401 && "token" in a) throw new AuthExpiredError();
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as GoogleErrorBody | null;
    const reason = body?.error?.errors?.[0]?.reason;
    if (reason === "quotaExceeded") throw new UpstreamError("YouTube API 일일 할당량을 다 썼습니다. 내일 다시 시도하세요.", 429);
    if (reason === "playlistNotFound") {
      throw new UpstreamError("재생목록을 찾을 수 없어요. 비공개 재생목록이나 YouTube Music 자동 믹스는 가져올 수 없어요.", 404);
    }
    if (reason === "playlistItemsNotAccessible" || reason === "forbidden") {
      throw new UpstreamError("비공개 재생목록이라 볼 수 없어요. 재생목록을 '공개'나 '일부 공개'로 바꾸면 가져올 수 있어요.", 403);
    }
    if (body?.error?.details?.some((d) => d.reason === "API_KEY_INVALID")) {
      throw new UpstreamError("서버에 설정된 YOUTUBE_API_KEY가 올바르지 않아요.", 503);
    }
    throw new UpstreamError(`YouTube API 오류: ${body?.error?.message ?? `HTTP ${res.status}`}`, res.status);
  }
  return (await res.json()) as T;
}

export async function fetchChannelName(token: string): Promise<string | undefined> {
  try {
    const res = await youtubeGet<ListResponse<{ snippet?: { title?: string } }>>(token, "/channels", { part: "snippet", mine: "true" });
    return res.items?.[0]?.snippet?.title;
  } catch {
    return undefined;
  }
}

export async function fetchLikedVideos(token: string, cursor: string | null): Promise<TrackPage> {
  const res = await youtubeGet<ListResponse<VideoResource>>(token, "/videos", {
    part: "snippet,statistics",
    myRating: "like",
    maxResults: "50",
    pageToken: cursor ?? "",
  });
  return {
    tracks: (res.items ?? []).map(normalizeLikedVideo).filter((t): t is Track => t !== null),
    next: res.nextPageToken ?? null,
    total: res.pageInfo?.totalResults,
  };
}

export async function fetchPlaylists(token: string): Promise<PlaylistSummary[]> {
  const out: PlaylistSummary[] = [];
  let pageToken = "";
  for (let i = 0; i < 10; i++) {
    const res = await youtubeGet<ListResponse<PlaylistResource>>(token, "/playlists", {
      part: "snippet,contentDetails",
      mine: "true",
      maxResults: "50",
      pageToken,
    });
    for (const p of res.items ?? []) {
      out.push({
        id: p.id,
        name: p.snippet?.title ?? "(이름 없음)",
        imageUrl: thumb(p.snippet?.thumbnails),
        trackCount: p.contentDetails?.itemCount,
        owner: p.snippet?.channelTitle,
      });
    }
    if (!res.nextPageToken) break;
    pageToken = res.nextPageToken;
  }
  return out;
}

export async function fetchPlaylistItems(
  auth: YouTubeAuth | string,
  playlistId: string,
  cursor: string | null,
  fetchImpl?: typeof fetch,
): Promise<TrackPage> {
  const res = await youtubeGet<ListResponse<PlaylistItemResource>>(
    auth,
    "/playlistItems",
    { part: "snippet", playlistId, maxResults: "50", pageToken: cursor ?? "" },
    fetchImpl,
  );
  return {
    tracks: (res.items ?? []).map(normalizePlaylistItem).filter((t): t is Track => t !== null),
    next: res.nextPageToken ?? null,
    total: res.pageInfo?.totalResults,
  };
}

/**
 * 재생목록 항목에는 조회수가 없어서 videos.list로 한 번 더 받아 붙인다 (50곡에 할당량 1).
 * 조회수는 "다들 아는 노래인지"를 가늠하는 데만 쓰므로 실패하면 그냥 넘어간다.
 */
export async function withViewCounts(auth: YouTubeAuth | string, page: TrackPage, fetchImpl?: typeof fetch): Promise<TrackPage> {
  const ids = page.tracks.map((t) => t.id.replace(/^youtube:/, "")).filter(Boolean).slice(0, 50);
  if (ids.length === 0) return page;
  try {
    const res = await youtubeGet<ListResponse<VideoResource>>(auth, "/videos", { part: "statistics", id: ids.join(","), maxResults: "50" }, fetchImpl);
    const views = new Map((res.items ?? []).map((v) => [v.id, viewCount(v.statistics)]));
    return {
      ...page,
      tracks: page.tracks.map((t) => {
        const n = views.get(t.id.replace(/^youtube:/, ""));
        return n === undefined ? t : { ...t, views: n };
      }),
    };
  } catch {
    return page;
  }
}

/** 재생목록 제목. 못 가져와도 곡 목록은 보여 줄 수 있으니 실패하면 undefined */
export async function fetchPlaylistTitle(auth: YouTubeAuth | string, playlistId: string, fetchImpl?: typeof fetch): Promise<string | undefined> {
  try {
    const res = await youtubeGet<ListResponse<PlaylistResource>>(auth, "/playlists", { part: "snippet", id: playlistId, maxResults: "1" }, fetchImpl);
    return res.items?.[0]?.snippet?.title;
  } catch {
    return undefined;
  }
}
