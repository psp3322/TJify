import { TtlCache } from "@/lib/cache";
import { createCircuit } from "@/lib/circuit";
import { createLimiter } from "@/lib/limiter";
import type { Brand, KaraokeSong } from "@/lib/types";
import { searchManana, type MananaSearchKind } from "./manana";
import type { KaraokeSearcher } from "./matcher";

/*
 * 브랜드별 검색기. 방문자 브라우저에서 Manana API를 바로 부른다 (TJ·금영 둘 다).
 * 같은 검색어는 메모리에 캐시하고, 동시에 나가는 요청 수를 제한하고, 계속 실패하면 잠시 요청을 멈춘다.
 */

const HOUR = 60 * 60 * 1000;
const cache = new TtlCache<KaraokeSong[]>(4000);
const ttl = (songs: KaraokeSong[]) => (songs.length > 0 ? 12 * HOUR : 1 * HOUR);

const limit = createLimiter(4);
const circuit = createCircuit("노래방 번호 검색 서버(Manana)");

const NON_WORD = /[^\p{L}\p{N}]+/gu;

function cacheKey(...parts: string[]): string {
  return parts.map((p) => p.normalize("NFKC").toLowerCase().replace(/\s+/g, "")).join("|");
}

const manana = (kind: MananaSearchKind, query: string, brand: Brand) => circuit(() => limit(() => searchManana(kind, query, brand)));

async function byTitle(brand: Brand, query: string): Promise<KaraokeSong[]> {
  const songs = await manana("song", query, brand);
  if (songs.length > 0) return songs;
  // 노래방 DB는 띄어쓰기를 살리거나 뺀 채 저장돼 있어서, 없으면 공백을 뺀 검색어로 한 번 더 찾는다.
  // "Don't"처럼 문장부호가 있는 제목은 부호까지 뺀다
  const compactQuery = query.replace(/\s+/g, "");
  const stripped = query.replace(NON_WORD, "");
  const retry = compactQuery !== query.trim() ? compactQuery : stripped && stripped !== compactQuery ? stripped : "";
  return retry ? manana("song", retry, brand) : songs;
}

function searcher(brand: Brand): KaraokeSearcher {
  return {
    searchByTitle: (q) => cache.getOrLoad(cacheKey(brand, "title", q), () => byTitle(brand, q), ttl),
    searchBySinger: (q) => cache.getOrLoad(cacheKey(brand, "singer", q), () => manana("singer", q, brand), ttl),
  };
}

export const searchers: Record<Brand, KaraokeSearcher> = {
  tj: searcher("tj"),
  ky: searcher("ky"),
};
