import { MATCHER_VERSION } from "@/lib/constants";
import type { Brand, BrandMatch, Confidence, KaraokeSong, MatchResult } from "@/lib/types";

export { trackKey } from "@/lib/track-key";

export interface StoredBrandMatch {
  best: KaraokeSong | null;
  confidence: Confidence;
  candidates: KaraokeSong[];
  error?: string;
}

export interface StoredMatch {
  v: number;
  at: number;
  tj?: StoredBrandMatch;
  ky?: StoredBrandMatch;
}

export type MatchStore = Record<string, StoredMatch>;

/** 사용자가 직접 고른 번호. null이면 "이 곡은 번호 없음" */
export type OverrideStore = Record<string, Partial<Record<Brand, KaraokeSong | null>>>;

const DAY = 24 * 60 * 60 * 1000;
const FOUND_TTL = 30 * DAY;
const NOT_FOUND_TTL = 7 * DAY;
const MAX_ENTRIES = 6000;
const MAX_CANDIDATES = 5;

function slim(match: BrandMatch): StoredBrandMatch {
  return {
    best: match.best,
    confidence: match.confidence,
    candidates: match.candidates.slice(0, MAX_CANDIDATES),
    ...(match.error ? { error: match.error } : {}),
  };
}

export function mergeResults(store: MatchStore, results: MatchResult[]): MatchStore {
  const next: MatchStore = { ...store };
  const now = Date.now();
  for (const r of results) {
    const prev = next[r.key]?.v === MATCHER_VERSION ? next[r.key] : undefined;
    next[r.key] = {
      v: MATCHER_VERSION,
      at: now,
      tj: r.tj ? slim(r.tj) : prev?.tj,
      ky: r.ky ? slim(r.ky) : prev?.ky,
    };
  }
  return next;
}

/** 저장된 결과를 그대로 써도 되는지 (오류였던 브랜드는 다시 찾는다) */
export function isFresh(entry: StoredMatch | undefined, brands: Brand[]): boolean {
  if (!entry || entry.v !== MATCHER_VERSION) return false;
  const age = Date.now() - entry.at;
  return brands.every((b) => {
    const m = entry[b];
    if (!m || m.error) return false;
    return age < (m.best ? FOUND_TTL : NOT_FOUND_TTL);
  });
}

/** 오래된 항목부터 지워 localStorage 용량을 지킨다 */
export function pruneStore(store: MatchStore): MatchStore {
  const keys = Object.keys(store);
  if (keys.length <= MAX_ENTRIES) return store;
  const keep = keys.sort((a, b) => store[b].at - store[a].at).slice(0, MAX_ENTRIES);
  return Object.fromEntries(keep.map((k) => [k, store[k]]));
}

export type NumberStatus = "pending" | "manual" | "found" | "maybe" | "none" | "error";

export interface ResolvedNumber {
  status: NumberStatus;
  song: KaraokeSong | null;
  confidence?: Confidence;
  error?: string;
}

/** 화면에 보여 줄 번호: 직접 고른 번호 > 자동 매칭 결과 */
export function resolveNumber(key: string, brand: Brand, store: MatchStore, overrides: OverrideStore): ResolvedNumber {
  const override = overrides[key];
  if (override && brand in override) {
    const song = override[brand] ?? null;
    return { status: song ? "manual" : "none", song };
  }
  const m = store[key]?.[brand];
  if (!m) return { status: "pending", song: null };
  if (m.error && !m.best) return { status: "error", song: null, error: m.error };
  if (!m.best) return { status: "none", song: null, confidence: m.confidence };
  return { status: m.confidence === "low" ? "maybe" : "found", song: m.best, confidence: m.confidence };
}

export function hasNumber(r: ResolvedNumber): boolean {
  return r.status === "found" || r.status === "maybe" || r.status === "manual";
}
