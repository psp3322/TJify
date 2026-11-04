import type { MessageKey } from "@/lib/i18n";

export type LinkSource = "spotify" | "youtube";

export interface PlaylistLink {
  source: LinkSource;
  id: string;
}

export type ParsedLink = PlaylistLink | { error: LinkErrorCode };

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"]);
const SPOTIFY_ID = /^[A-Za-z0-9]{10,40}$/;
const YOUTUBE_LIST_ID = /^[\w-]{10,64}$/;
/** 주소 없이 재생목록 ID만 붙여넣었을 때 알아볼 접두사 (일반 재생목록, 앨범, 채널 업로드) */
const BARE_YOUTUBE_ID = /^(PL|OLAK5uy_|UU)[\w-]{8,62}$/;

/**
 * 붙여넣은 플레이리스트 주소를 해석한다.
 *   https://open.spotify.com/playlist/ID (/intl-ko/ 같은 언어 경로 포함), spotify:playlist:ID
 *   https://www.youtube.com/playlist?list=ID, music.youtube.com, youtu.be/영상?list=ID, watch?v=…&list=ID
 */
export function parsePlaylistLink(input: string): ParsedLink | null {
  const text = input.trim();
  if (!text) return null;

  const uri = text.match(/^spotify:playlist:([A-Za-z0-9]+)$/);
  if (uri && SPOTIFY_ID.test(uri[1])) return { source: "spotify", id: uri[1] };
  if (BARE_YOUTUBE_ID.test(text)) return { source: "youtube", id: text };

  // 주소처럼 생긴 것만 해석한다 ("밤편지" 같은 곡 이름을 주소로 오해하지 않게)
  const hasScheme = /^https?:\/\//i.test(text);
  if (/\s/.test(text) || (!hasScheme && !/^[\w-]+(\.[\w-]+)+\//.test(text))) return null;
  let url: URL;
  try {
    url = new URL(hasScheme ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();

  if (host === "open.spotify.com" || host === "play.spotify.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const at = parts.indexOf("playlist");
    const id = at >= 0 ? parts[at + 1] : undefined;
    return id && SPOTIFY_ID.test(id) ? { source: "spotify", id } : { error: "unsupported" };
  }
  // 앱의 "링크 복사"로 나오는 짧은 주소는 열어 봐야 실제 주소를 알 수 있다
  if (host === "spotify.link" || host.endsWith(".app.link")) return { error: "spotify_short_link" };

  if (YOUTUBE_HOSTS.has(host)) {
    const list = url.searchParams.get("list");
    return list && YOUTUBE_LIST_ID.test(list) ? { source: "youtube", id: list } : { error: "youtube_no_list" };
  }

  return { error: "unsupported" };
}

export type LinkErrorCode = "spotify_short_link" | "youtube_no_list" | "unsupported";

export const LINK_ERROR_KEYS: Record<LinkErrorCode, MessageKey> = {
  spotify_short_link: "link.error.spotify_short_link",
  youtube_no_list: "link.error.youtube_no_list",
  unsupported: "link.error.unsupported",
};

export function isPlaylistLink(parsed: ParsedLink | null): parsed is PlaylistLink {
  return Boolean(parsed && "source" in parsed);
}

/** 공유하기 좋은 표준 주소 */
export function canonicalLinkUrl(link: PlaylistLink): string {
  return link.source === "spotify"
    ? `https://open.spotify.com/playlist/${link.id}`
    : `https://www.youtube.com/playlist?list=${link.id}`;
}
