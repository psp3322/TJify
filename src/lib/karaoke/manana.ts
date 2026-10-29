import { fetchWithRetry, UpstreamError } from "@/lib/http";
import type { Brand, KaraokeSong } from "@/lib/types";
import { userAgent } from "./user-agent";

/**
 * Manana 노래방 API (https://api.manana.kr/karaoke) 클라이언트.
 * 금영·TJ 공식 API가 없어서 여러 노래방 번호 앱이 데이터 출처로 쓰는 공개 API다.
 * 응답 항목: { brand, no, title, singer, composer, lyricist, release }
 */
const MANANA_URL = "https://api.manana.kr/karaoke";

const MANANA_BRAND: Record<Brand, string> = {
  tj: "tj",
  ky: "kumyoung",
};

export type MananaSearchKind = "song" | "singer";

export function buildMananaUrl(kind: MananaSearchKind, query: string, brand: Brand): string {
  // 경로 구분자와 겹치는 문자는 공백으로 바꾼다
  const segment = encodeURIComponent(query.replace(/[/\\?#]/g, " ").trim());
  return `${MANANA_URL}/${kind}/${segment}.json?brand=${MANANA_BRAND[brand]}`;
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

/** 배열 응답과 { data: [...] } 응답 둘 다 받는다. brand 파라미터가 무시돼도 결과를 걸러 낸다 */
export function parseMananaRows(json: unknown, brand: Brand): KaraokeSong[] {
  const rows: unknown[] = Array.isArray(json)
    ? json
    : json && typeof json === "object" && Array.isArray((json as { data?: unknown }).data)
      ? (json as { data: unknown[] }).data
      : [];
  const want = MANANA_BRAND[brand];
  const songs: KaraokeSong[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const rowBrand = text(r.brand).toLowerCase();
    if (rowBrand && rowBrand !== want) continue;
    const no = text(r.no);
    const title = text(r.title);
    if (!no || !title || seen.has(no)) continue;
    seen.add(no);
    const lyricist = text(r.lyricist);
    const composer = text(r.composer);
    songs.push({
      brand,
      no,
      title,
      singer: text(r.singer),
      ...(lyricist ? { lyricist } : {}),
      ...(composer ? { composer } : {}),
    });
  }
  return songs;
}

export interface MananaSearchOptions {
  fetchImpl?: typeof fetch;
}

export async function searchManana(
  kind: MananaSearchKind,
  query: string,
  brand: Brand,
  options: MananaSearchOptions = {},
): Promise<KaraokeSong[]> {
  if (!query.trim()) return [];
  const res = await fetchWithRetry(buildMananaUrl(kind, query, brand), {
    fetchImpl: options.fetchImpl,
    headers: { "User-Agent": userAgent(), Accept: "application/json" },
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new UpstreamError(`Manana API 실패 (HTTP ${res.status})`, res.status);
  const body = await res.text();
  if (body.trimStart().startsWith("<")) throw new UpstreamError("Manana API가 JSON 대신 HTML을 돌려줬습니다");
  try {
    return parseMananaRows(JSON.parse(body), brand);
  } catch {
    throw new UpstreamError("Manana API 응답을 읽지 못했습니다");
  }
}
