import { popularityScore, singAlongLevel } from "@/lib/insights/popularity";
import type { DifficultyTag, SingAlong } from "@/lib/insights/types";
import type { ChartIndex } from "@/lib/karaoke/tj-chart";
import type { Track } from "@/lib/types";
import type { InsightStore } from "./insight-queue";
import { resolveNumber, type MatchStore, type OverrideStore } from "./match-store";

/** 목록 한 줄에 붙이는 난이도·대중성 정보 */
export interface SongMeta {
  /** 1~5. 내가 매긴 값이 있으면 그것, 없으면 Claude 추정 */
  difficulty: number | null;
  difficultyIsMine: boolean;
  aiDifficulty: number | null;
  tags: DifficultyTag[];
  tip?: string;
  aiPopularity: number | null;
  /** 최근 1년 TJ 인기차트 최고 순위와 그 달 */
  chart?: [number, string];
  views?: number;
  singAlong: SingAlong | null;
  popularity: number;
}

export interface MetaSources {
  insights: InsightStore;
  myDifficulty: Record<string, number>;
  chart: ChartIndex | null;
  matches: MatchStore;
  overrides: OverrideStore;
}

export function songMeta(track: Track, key: string, src: MetaSources): SongMeta {
  const insight = src.insights[key]?.insight ?? null;
  const mine = src.myDifficulty[key];
  // 차트는 곡번호로 찾으므로, 확실하거나 직접 고른 TJ 번호일 때만 쓴다
  const tj = resolveNumber(key, "tj", src.matches, src.overrides);
  const chart = tj.song && (tj.status === "found" || tj.status === "manual") ? src.chart?.songs[tj.song.no] : undefined;
  const signals = { chartRank: chart?.[0], aiPopularity: insight?.popularity ?? null, views: track.views };
  return {
    difficulty: mine ?? insight?.difficulty ?? null,
    difficultyIsMine: mine !== undefined,
    aiDifficulty: insight?.difficulty ?? null,
    tags: insight?.tags ?? [],
    ...(insight?.tip ? { tip: insight.tip } : {}),
    aiPopularity: insight?.popularity ?? null,
    ...(chart ? { chart } : {}),
    ...(track.views !== undefined ? { views: track.views } : {}),
    singAlong: singAlongLevel(signals),
    popularity: popularityScore(signals),
  };
}
