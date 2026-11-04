import { fetchWithRetry, UpstreamError } from "@/lib/http";
import { t } from "@/lib/i18n";
import type { Brand, KaraokeSong } from "@/lib/types";

/**
 * Manana 노래방 API (https://api.manana.kr/karaoke) 클라이언트.
 * TJ·금영 공식 API가 없어서 여러 노래방 번호 앱이 데이터 출처로 쓰는 공개 API다.
 * 브라우저에서 바로 부를 수 있어서 이 사이트의 번호 검색은 모두 여기로 간다.
 * 경로: song/{제목}/{브랜드}.json, singer/{가수}/{브랜드}.json, popular/{브랜드}/{daily|weekly|monthly}.json
 * 응답 항목: { brand, no, title, singer, composer, lyricist, release }
 */
const MANANA_URL = "https://api.manana.kr/karaoke";

const MANANA_BRAND: Record<Brand, string> = {
  tj: "tj",
  ky: "kumyoung",
};

export type MananaSearchKind = "song" | "singer";

/** 경로 구분자와 겹치는 문자를 공백으로 바꾼 검색어. 점만 있는 검색어는 경로가 바뀌므로 빈 값으로 본다 */
function pathSegment(query: string): string {
  const cleaned = query.replace(/[/\\?#]/g, " ").trim();
  return /^\.*$/.test(cleaned) ? "" : encodeURIComponent(cleaned);
}

export function buildMananaUrl(kind: MananaSearchKind, query: string, brand: Brand): string {
  return `${MANANA_URL}/${kind}/${pathSegment(query)}/${MANANA_BRAND[brand]}.json`;
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function rowsOf(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object" && Array.isArray((json as { data?: unknown }).data)) return (json as { data: unknown[] }).data;
  return [];
}

/** 배열 응답과 { data: [...] } 응답 둘 다 받는다. 다른 브랜드 행이 섞여 와도 걸러 낸다 */
export function parseMananaRows(json: unknown, brand: Brand): KaraokeSong[] {
  const want = MANANA_BRAND[brand];
  const songs: KaraokeSong[] = [];
  const seen = new Set<string>();
  for (const row of rowsOf(json)) {
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

async function getJson(url: string, options: MananaSearchOptions & { headers?: HeadersInit; timeoutMs?: number }): Promise<unknown | null> {
  const res = await fetchWithRetry(url, {
    fetchImpl: options.fetchImpl,
    // 브라우저에서 사전 요청(preflight) 없이 바로 가도록 기본 헤더만 쓴다
    headers: { Accept: "application/json", ...options.headers },
    // Manana는 응답이 10초를 넘기는 때가 있어서 넉넉히 기다린다
    timeoutMs: options.timeoutMs ?? 20_000,
    retries: 1,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new UpstreamError(t("error.karaokeHttp", { status: res.status }), res.status);
  const body = await res.text();
  if (body.trimStart().startsWith("<")) throw new UpstreamError(t("error.karaokeMaintenance"));
  try {
    return JSON.parse(body);
  } catch {
    throw new UpstreamError(t("error.karaokeParse"));
  }
}

export async function searchManana(
  kind: MananaSearchKind,
  query: string,
  brand: Brand,
  options: MananaSearchOptions = {},
): Promise<KaraokeSong[]> {
  if (!pathSegment(query)) return [];
  const json = await getJson(buildMananaUrl(kind, query, brand), options);
  return json === null ? [] : parseMananaRows(json, brand);
}

export type MananaPeriod = "daily" | "weekly" | "monthly";

export interface PopularEntry {
  no: string;
  rank: number;
  title: string;
  singer: string;
}

/** 인기곡 응답은 순위 순서로 온다. rank 필드가 있으면 그 값을, 없으면 순서를 순위로 쓴다 */
export function parseMananaPopular(json: unknown, brand: Brand): PopularEntry[] {
  const raw = rowsOf(json);
  return parseMananaRows(json, brand).map((song) => {
    const index = raw.findIndex((r) => r && typeof r === "object" && text((r as Record<string, unknown>).no) === song.no);
    const rank = Number((raw[index] as Record<string, unknown> | undefined)?.rank);
    return { no: song.no, rank: Number.isInteger(rank) && rank > 0 ? rank : index + 1, title: song.title, singer: song.singer };
  });
}

/** 노래방 인기곡 TOP100 (빌드할 때 TJ 차트를 못 받으면 대신 쓴다) */
export async function fetchMananaPopular(
  brand: Brand,
  period: MananaPeriod,
  options: MananaSearchOptions & { headers?: HeadersInit } = {},
): Promise<PopularEntry[]> {
  const json = await getJson(`${MANANA_URL}/popular/${MANANA_BRAND[brand]}/${period}.json`, { ...options, timeoutMs: 45_000 });
  return json === null ? [] : parseMananaPopular(json, brand);
}
