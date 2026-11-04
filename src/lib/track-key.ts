import { compact } from "@/lib/text/normalize";

/** 같은 곡이면 출처(Spotify/YouTube/붙여넣기)가 달라도 같은 키를 갖게 한다 */
export function trackKey(track: { title: string; artists: string[] }): string {
  const artists = track.artists.map(compact).filter(Boolean).sort().join(",");
  return `${compact(track.title)}|${artists}`;
}
