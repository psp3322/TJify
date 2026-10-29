import { fetchWithRetry, UpstreamError } from "@/lib/http";
import type { KaraokeSong } from "@/lib/types";
import { parseTjSearchHtml } from "./tj-parser";
import { userAgent } from "./user-agent";

const TJ_SEARCH_URL = "https://www.tjmedia.com/song/accompaniment_search";

export type TjSearchType = "integrated" | "title" | "singer" | "number";
export type TjPageSize = 15 | 30 | 50 | 100;

// TJ 검색 폼의 strType 값: 0 통합, 1 곡제목, 2 가수명, 4 작사가, 8 작곡가, 16 곡번호, 32 메들리
const STR_TYPE: Record<TjSearchType, string> = {
  integrated: "0",
  title: "1",
  singer: "2",
  number: "16",
};

/** TJ 사이트 자체 스크립트와 같은 방식으로 검색 URL을 만든다 (검색어 공백 제거 포함) */
export function buildTjSearchUrl(query: string, type: TjSearchType, rows: TjPageSize = 50): string {
  const params = new URLSearchParams({
    pageNo: "1",
    pageRowCnt: String(rows),
    strSotrGubun: "ASC", // TJ 쪽 파라미터 이름 그대로 (오타 아님)
    strSortType: "",
    nationType: "",
    strType: STR_TYPE[type],
    searchTxt: query.replace(/\s+/g, ""),
  });
  return `${TJ_SEARCH_URL}?${params.toString()}`;
}

export interface TjSearchOptions {
  rows?: TjPageSize;
  fetchImpl?: typeof fetch;
}

export async function searchTj(query: string, type: TjSearchType, options: TjSearchOptions = {}): Promise<KaraokeSong[]> {
  if (!query.replace(/\s+/g, "")) return [];
  const res = await fetchWithRetry(buildTjSearchUrl(query, type, options.rows ?? 50), {
    fetchImpl: options.fetchImpl,
    headers: {
      "User-Agent": userAgent(),
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
  });
  if (!res.ok) throw new UpstreamError(`TJ 검색 실패 (HTTP ${res.status})`, res.status);
  return parseTjSearchHtml(await res.text());
}
