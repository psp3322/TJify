import { aliasesFor } from "./artist-aliases";
import { artistPieces, compact, hasHangul } from "./normalize";

/** 가수 목록을 비교용 변형 전부로 펼친다 (조각 + 별칭). */
export function expandArtists(artists: string[]): string[] {
  const out = new Map<string, string>();
  for (const artist of artists) {
    for (const piece of artistPieces(artist)) {
      for (const name of [piece, ...aliasesFor(piece)]) {
        const key = compact(name);
        if (key && !out.has(key)) out.set(key, name);
      }
    }
  }
  return [...out.values()];
}

/**
 * 노래방 "가수명 검색"에 넣을 검색어 후보 (우선순위 순).
 * 노래방 DB는 국내 가수를 한글로 적는 경우가 많아 한글 표기를 앞에 둔다.
 * 한 글자 별칭("비", "진")은 검색 결과가 너무 넓어져서 뺀다.
 */
export function singerQueries(artists: string[]): string[] {
  const primary = artists.find((a) => compact(a).length > 0);
  if (!primary) return [];
  const pieces = artistPieces(primary);
  const names: string[] = [];
  for (const piece of pieces) names.push(...aliasesFor(piece));
  names.push(...pieces);
  const usable = names.filter((n) => Array.from(compact(n)).length >= 2);
  const hangulFirst = [...usable.filter(hasHangul), ...usable.filter((n) => !hasHangul(n))];
  const seen = new Set<string>();
  return hangulFirst.filter((n) => {
    const key = compact(n);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
