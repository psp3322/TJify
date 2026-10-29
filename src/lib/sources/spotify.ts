import { AuthExpiredError } from "@/lib/auth/errors";
import { UpstreamError } from "@/lib/http";
import type { PlaylistSummary, Track, TrackPage } from "@/lib/types";

/*
 * Spotify Web API (2026년 2~3월 Development Mode 변경 반영)
 *  - GET /me/tracks            : Liked Songs
 *  - GET /me/playlists         : 내 플레이리스트 (플레이리스트 객체의 tracks 필드가 items로 바뀜)
 *  - GET /playlists/{id}/items : 플레이리스트 곡 (/tracks 엔드포인트는 개발 모드에서 403, 항목의 track 필드가 item으로 바뀜)
 * 바뀌기 전 형식도 같이 읽을 수 있게 해 둔다.
 */

const API = "https://api.spotify.com/v1";
const PAGE = 50;

interface SpotifyImage {
  url: string;
  width?: number | null;
}

interface SpotifyTrackObject {
  id?: string | null;
  name?: string;
  type?: string;
  is_local?: boolean;
  artists?: Array<{ name?: string }>;
  album?: { name?: string; images?: SpotifyImage[] };
  external_urls?: { spotify?: string };
}

interface SpotifyItem {
  track?: SpotifyTrackObject | null;
  item?: SpotifyTrackObject | null;
}

interface Paging<T> {
  items?: T[];
  next?: string | null;
  total?: number;
}

interface SpotifyPlaylist {
  id: string;
  name?: string;
  images?: SpotifyImage[] | null;
  owner?: { display_name?: string | null };
  tracks?: { total?: number };
  items?: { total?: number };
}

export function pickImage(images: SpotifyImage[] | null | undefined): string | undefined {
  if (!images?.length) return undefined;
  const sized = images.filter((i) => (i.width ?? 0) >= 64).sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return (sized[0] ?? images[images.length - 1]).url;
}

export function normalizeSpotifyTrack(t: SpotifyTrackObject | null | undefined): Track | null {
  if (!t || !t.id || t.is_local || (t.type && t.type !== "track") || !t.name) return null;
  return {
    id: `spotify:${t.id}`,
    source: "spotify",
    title: t.name,
    artists: (t.artists ?? []).map((a) => a.name ?? "").filter(Boolean),
    album: t.album?.name,
    imageUrl: pickImage(t.album?.images),
    url: t.external_urls?.spotify,
  };
}

export function normalizeSpotifyItems(items: SpotifyItem[] | undefined): Track[] {
  return (items ?? []).map((it) => normalizeSpotifyTrack(it.item ?? it.track)).filter((t): t is Track => t !== null);
}

async function spotifyGet<T>(token: string, path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.6" },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401) throw new AuthExpiredError();
  if (res.status === 403) {
    throw new UpstreamError(
      "Spotify가 요청을 거부했습니다. 개발 모드 앱이라면 대시보드 User Management에 이 계정이 등록돼 있는지, 앱 소유자 계정이 Premium인지 확인하세요.",
      403,
    );
  }
  if (res.status === 429) {
    throw new UpstreamError(`Spotify 요청 한도 초과. ${res.headers.get("retry-after") ?? "잠시"}초 뒤 다시 시도하세요.`, 429);
  }
  if (!res.ok) throw new UpstreamError(`Spotify API 오류 (HTTP ${res.status})`, res.status);
  return (await res.json()) as T;
}

function offsetFrom(cursor: string | null): number {
  const n = Number(cursor);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

export async function fetchDisplayName(token: string): Promise<string | undefined> {
  try {
    const me = await spotifyGet<{ display_name?: string | null; id?: string }>(token, "/me");
    return me.display_name ?? me.id ?? undefined;
  } catch {
    return undefined;
  }
}

export async function fetchLikedTracks(token: string, cursor: string | null): Promise<TrackPage> {
  const offset = offsetFrom(cursor);
  const page = await spotifyGet<Paging<SpotifyItem>>(token, "/me/tracks", { limit: String(PAGE), offset: String(offset) });
  return {
    tracks: normalizeSpotifyItems(page.items),
    next: page.next ? String(offset + PAGE) : null,
    total: page.total,
  };
}

export async function fetchPlaylists(token: string): Promise<PlaylistSummary[]> {
  const out: PlaylistSummary[] = [];
  for (let offset = 0; offset < 500; offset += PAGE) {
    const page = await spotifyGet<Paging<SpotifyPlaylist | null>>(token, "/me/playlists", { limit: String(PAGE), offset: String(offset) });
    for (const p of page.items ?? []) {
      if (!p?.id) continue;
      out.push({
        id: p.id,
        name: p.name ?? "(이름 없음)",
        imageUrl: pickImage(p.images),
        trackCount: p.items?.total ?? p.tracks?.total,
        owner: p.owner?.display_name ?? undefined,
      });
    }
    if (!page.next) break;
  }
  return out;
}

export async function fetchPlaylistTracks(token: string, playlistId: string, cursor: string | null): Promise<TrackPage> {
  const offset = offsetFrom(cursor);
  const params = { limit: String(PAGE), offset: String(offset), additional_types: "track" };
  const id = encodeURIComponent(playlistId);
  let page: Paging<SpotifyItem>;
  try {
    page = await spotifyGet<Paging<SpotifyItem>>(token, `/playlists/${id}/items`, params);
  } catch (error) {
    // 예전 엔드포인트만 열려 있는 앱(확장 할당량 등)을 위한 대비
    if (error instanceof UpstreamError && error.status === 404) {
      page = await spotifyGet<Paging<SpotifyItem>>(token, `/playlists/${id}/tracks`, params);
    } else {
      throw error;
    }
  }
  return {
    tracks: normalizeSpotifyItems(page.items),
    next: page.next ? String(offset + PAGE) : null,
    total: page.total,
  };
}
