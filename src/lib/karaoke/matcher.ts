import { describeError } from "@/lib/http";
import { expandArtists, singerQueries } from "@/lib/text/artists";
import {
  bestSimilarity,
  bracketContents,
  collapseSpaces,
  compact,
  isDecoration,
  stripBrackets,
  stripDecorations,
  titleVariants,
} from "@/lib/text/normalize";
import type { BrandMatch, Confidence, KaraokeSong } from "@/lib/types";

export interface KaraokeSearcher {
  searchByTitle(query: string): Promise<KaraokeSong[]>;
  searchBySinger(query: string): Promise<KaraokeSong[]>;
}

export interface TrackQuery {
  title: string;
  artists: string[];
}

export interface ScoredSong {
  song: KaraokeSong;
  score: number;
  titleSim: number;
  artistSim: number;
}

const TITLE_WEIGHT = 0.65;
const ARTIST_WEIGHT = 0.35;
/** 가수 정보가 없을 때(붙여넣기 등) 쓰는 중립 점수 */
const UNKNOWN_ARTIST_SIM = 0.5;

const HIGH = 0.9;
const MEDIUM = 0.78;
const LOW = 0.6;

const MAX_TITLE_QUERIES = 2;
const MAX_CANDIDATES = 6;

export function scoreSong(track: TrackQuery, song: KaraokeSong): ScoredSong {
  const titleSim = bestSimilarity(titleVariants(track.title), titleVariants(song.title));
  const trackArtists = expandArtists(track.artists);
  const artistSim = trackArtists.length > 0 ? bestSimilarity(trackArtists, expandArtists([song.singer])) : UNKNOWN_ARTIST_SIM;
  // MR·라이브 같은 별도 수록본보다 원곡 줄이 먼저 오도록 아주 조금 깎는다
  const tagPenalty = song.tags?.length ? 0.02 : 0;
  const score = Math.max(0, TITLE_WEIGHT * titleSim + ARTIST_WEIGHT * artistSim - tagPenalty);
  return { song, score, titleSim, artistSim };
}

export function rankSongs(track: TrackQuery, songs: KaraokeSong[]): ScoredSong[] {
  return songs
    .map((song) => scoreSong(track, song))
    .sort((a, b) => b.score - a.score || Number(a.song.no) - Number(b.song.no));
}

function confidenceOf(score: number, titleSim: number, artistSim: number): Confidence {
  if (score >= HIGH && titleSim >= 0.95 && artistSim >= 0.8) return "high";
  if (score >= MEDIUM) return "medium";
  if (score >= LOW) return "low";
  return "none";
}

/** 점수 목록을 화면에 보낼 결과로 바꾼다 */
export function decide(track: TrackQuery, ranked: ScoredSong[]): BrandMatch {
  const candidates = ranked.slice(0, MAX_CANDIDATES).map((r) => r.song);
  const top = ranked[0];
  if (!top) return { best: null, score: 0, confidence: "none", candidates };

  let score = top.score;
  const exactTitles = ranked.filter((r) => r.titleSim >= 0.95);
  const distinctSingers = new Set(exactTitles.map((r) => compact(r.song.singer)));

  if (top.titleSim >= 0.95 && top.artistSim < 0.8 && track.artists.length > 0 && distinctSingers.size === 1) {
    // 제목이 정확히 같은 곡이 이 가수 하나뿐이면, 가수 표기가 달라도(예: "Paul Kim" / "폴킴") 거의 맞는 곡이다
    score = Math.max(score, MEDIUM);
  }

  let confidence = confidenceOf(score, top.titleSim, top.artistSim);
  if (track.artists.length === 0 && distinctSingers.size > 1 && confidence !== "none") {
    // 가수 정보 없이 같은 제목이 여럿이면 어느 곡인지 알 수 없다
    confidence = "low";
  }

  return {
    best: confidence === "none" ? null : top.song,
    score: Math.round(score * 1000) / 1000,
    confidence,
    candidates,
  };
}

/**
 * 제목 검색어 후보.
 * 노래방 검색은 부분 일치라서 괄호를 뗀 짧은 제목으로 찾으면 괄호가 붙은 제목까지 함께 나온다.
 * 그래서 괄호를 뗀 제목 → 괄호 안의 다른 언어 제목 순으로 찾는다.
 * 다만 "봄"처럼 너무 짧으면 결과가 넘쳐서 괄호까지 붙인 제목을 먼저 쓴다.
 */
export function titleQueries(title: string): string[] {
  const decorated = stripDecorations(collapseSpaces(title));
  const base = stripBrackets(decorated) || decorated;
  const alternates = bracketContents(decorated).filter((c) => !isDecoration(c));
  const ordered = Array.from(compact(base)).length >= 3 ? [base, ...alternates] : [decorated, base, ...alternates];
  const seen = new Set<string>();
  return ordered.filter((q) => {
    const key = compact(q);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 한 노래방 브랜드에서 곡을 찾는다.
 * 제목으로 먼저 찾고, 확실한 결과가 없으면 가수명으로 한 번 더 찾아 후보를 합친다.
 */
export async function matchOnBrand(track: TrackQuery, searcher: KaraokeSearcher): Promise<BrandMatch> {
  const pool = new Map<string, KaraokeSong>();
  let ranked: ScoredSong[] = [];
  let firstError: unknown;
  let succeeded = 0;

  const absorb = async (run: () => Promise<KaraokeSong[]>) => {
    try {
      const songs = await run();
      succeeded++;
      for (const s of songs) if (!pool.has(s.no)) pool.set(s.no, s);
      ranked = rankSongs(track, [...pool.values()]);
    } catch (error) {
      firstError ??= error;
    }
  };

  const isConfident = () => {
    const top = ranked[0];
    return Boolean(top && confidenceOf(top.score, top.titleSim, top.artistSim) === "high");
  };

  const queries = titleQueries(track.title);
  for (const q of queries.slice(0, MAX_TITLE_QUERIES)) {
    await absorb(() => searcher.searchByTitle(q));
    if (isConfident()) break;
  }

  if (!isConfident()) {
    const singer = singerQueries(track.artists)[0];
    if (singer) await absorb(() => searcher.searchBySinger(singer));
  }

  // 아직 없으면 남은 제목 변형(괄호 안 다른 언어 제목 등)을 마지막으로 시도
  if (!isConfident() && queries.length > MAX_TITLE_QUERIES) {
    await absorb(() => searcher.searchByTitle(queries[MAX_TITLE_QUERIES]));
  }

  const result = decide(track, ranked);
  if (succeeded === 0 && firstError) {
    return { ...result, error: describeError(firstError, "노래방 검색") };
  }
  return result;
}
