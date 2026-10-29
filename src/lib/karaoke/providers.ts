import { TtlCache } from "@/lib/cache";
import { createCircuit } from "@/lib/circuit";
import { createLimiter } from "@/lib/limiter";
import type { Brand, KaraokeSong } from "@/lib/types";
import { searchManana, type MananaSearchKind } from "./manana";
import type { KaraokeSearcher } from "./matcher";
import { searchTj, type TjSearchType } from "./tj";

/*
 * 브랜드별 검색기. 같은 검색어는 서버 메모리에 캐시하고,
 * 노래방 사이트로 나가는 동시 요청 수를 제한하고, 계속 실패하면 잠시 요청을 멈춘다.
 *   TJ   : tjmedia.com 공식 반주곡 검색 (실패하면 Manana API로 대체)
 *   금영 : Manana API (KY_PROVIDER=off 로 끌 수 있음)
 */

const HOUR = 60 * 60 * 1000;
const cache = new TtlCache<KaraokeSong[]>(8000);
const ttl = (songs: KaraokeSong[]) => (songs.length > 0 ? 12 * HOUR : 1 * HOUR);

const tjLimit = createLimiter(Number(process.env.TJ_CONCURRENCY) || 3);
const mananaLimit = createLimiter(Number(process.env.MANANA_CONCURRENCY) || 3);
const tjCircuit = createCircuit("TJ미디어 사이트");
const mananaCircuit = createCircuit("Manana API");

const NON_WORD = /[^\p{L}\p{N}]+/gu;

function cacheKey(...parts: string[]): string {
  return parts.map((p) => p.normalize("NFKC").toLowerCase().replace(/\s+/g, "")).join("|");
}

const tj = (query: string, type: TjSearchType, rows: 50 | 100) => tjCircuit(() => tjLimit(() => searchTj(query, type, { rows })));
const manana = (kind: MananaSearchKind, query: string, brand: Brand) =>
  mananaCircuit(() => mananaLimit(() => searchManana(kind, query, brand)));

async function withMananaFallback(kind: MananaSearchKind, query: string, primary: () => Promise<KaraokeSong[]>): Promise<KaraokeSong[]> {
  try {
    return await primary();
  } catch (error) {
    try {
      return await manana(kind, query, "tj");
    } catch {
      throw error;
    }
  }
}

function tjTitle(query: string): Promise<KaraokeSong[]> {
  return withMananaFallback("song", query, async () => {
    const songs = await tj(query, "title", 50);
    const stripped = query.replace(NON_WORD, "");
    // "Don't" 처럼 문장부호가 있는 제목은 부호를 뺀 검색어로 한 번 더
    if (songs.length === 0 && stripped && stripped !== query.replace(/\s+/g, "")) return tj(stripped, "title", 50);
    return songs;
  });
}

function tjSinger(query: string): Promise<KaraokeSong[]> {
  return withMananaFallback("singer", query, () => tj(query, "singer", 100));
}

async function kyTitle(query: string): Promise<KaraokeSong[]> {
  const songs = await manana("song", query, "ky");
  const compactQuery = query.replace(/\s+/g, "");
  // 금영 DB는 띄어쓰기를 살려 저장된 경우가 있어 원문 → 공백 제거 순으로 찾는다
  if (songs.length === 0 && compactQuery !== query.trim()) return manana("song", compactQuery, "ky");
  return songs;
}

function kySinger(query: string): Promise<KaraokeSong[]> {
  return manana("singer", query, "ky");
}

export function isBrandEnabled(brand: Brand): boolean {
  if (brand === "ky") return (process.env.KY_PROVIDER ?? "manana").toLowerCase() !== "off";
  return true;
}

export const searchers: Record<Brand, KaraokeSearcher> = {
  tj: {
    searchByTitle: (q) => cache.getOrLoad(cacheKey("tj", "title", q), () => tjTitle(q), ttl),
    searchBySinger: (q) => cache.getOrLoad(cacheKey("tj", "singer", q), () => tjSinger(q), ttl),
  },
  ky: {
    searchByTitle: (q) => cache.getOrLoad(cacheKey("ky", "title", q), () => kyTitle(q), ttl),
    searchBySinger: (q) => cache.getOrLoad(cacheKey("ky", "singer", q), () => kySinger(q), ttl),
  },
};
