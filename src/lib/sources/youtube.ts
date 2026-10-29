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
  return toTrack(v.id, title, v.snippet?.channelTitle, v.snippet?.thumbnails, v.snippet?.categoryId ?? "");
}

export function normalizePlaylistItem(item: PlaylistItemResource): Track | null {
  const s = item.snippet;
  const videoId = s?.resourceId?.videoId;
  if (!videoId || !s?.title || UNAVAILABLE_TITLES.has(s.title)) return null;
  return toTrack(videoId, s.title, s.videoOwnerChannelTitle, s.thumbnails);
}

async function youtubeGet<T>(token: string, path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401) throw new AuthExpiredError();
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string; errors?: Array<{ reason?: string }> } } | null;
    const reason = body?.error?.errors?.[0]?.reason;
    if (reason === "quotaExceeded") throw new UpstreamError("YouTube API 일일 할당량을 다 썼습니다. 내일 다시 시도하세요.", 429);
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
    part: "snippet",
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

export async function fetchPlaylistItems(token: string, playlistId: string, cursor: string | null): Promise<TrackPage> {
  const res = await youtubeGet<ListResponse<PlaylistItemResource>>(token, "/playlistItems", {
    part: "snippet",
    playlistId,
    maxResults: "50",
    pageToken: cursor ?? "",
  });
  return {
    tracks: (res.items ?? []).map(normalizePlaylistItem).filter((t): t is Track => t !== null),
    next: res.nextPageToken ?? null,
    total: res.pageInfo?.totalResults,
  };
}
