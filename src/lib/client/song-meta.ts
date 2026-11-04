import { popularityScore, singAlongLevel } from "@/lib/insights/popularity";
import type { DifficultyTag, InsightEngine, SingAlong } from "@/lib/insights/types";
import type { ChartIndex } from "@/lib/karaoke/tj-chart";
import type { Track } from "@/lib/types";
import type { InsightStore } from "./insight-queue";
import { resolveNumber, type MatchStore, type OverrideStore } from "./match-store";

/** 목록 한 줄에 붙이는 난이도·대중성 정보 */
export interface SongMeta {
  /** 1~5. 내가 매긴 값이 있으면 그것, 없으면 AI 추정 */
  difficulty: number | null;
  difficultyIsMine: boolean;
  aiDifficulty: number | null;
  /** 추정한 AI (예전에 저장한 결과에는 없을 수 있다) */
  aiBy?: InsightEngine;
  tags: DifficultyTag[];
  tip?: string;
  tipEn?: string;
  aiPopularity: number | null;
  /** TJ 인기차트 최고 순위와 그 기간 ("2026-09" 또는 "recent") */
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
  const stored = src.insights[key];
  const insight = stored?.insight ?? null;
  const mine = src.myDifficulty[key];
  // 차트는 곡번호로 찾으므로, 확실하거나 직접 고른 TJ 번호일 때만 쓴다
  const tj = resolveNumber(key, "tj", src.matches, src.overrides);
  const chart = tj.song && (tj.status === "found" || tj.status === "manual") ? src.chart?.songs[tj.song.no] : undefined;
  const signals = { chartRank: chart?.[0], aiPopularity: insight?.popularity ?? null, views: track.views };
  return {
    difficulty: mine ?? insight?.difficulty ?? null,
    difficultyIsMine: mine !== undefined,
    aiDifficulty: insight?.difficulty ?? null,
    ...(insight && stored?.by ? { aiBy: stored.by } : {}),
    tags: insight?.tags ?? [],
    ...(insight?.tip ? { tip: insight.tip } : {}),
    ...(insight?.tipEn ? { tipEn: insight.tipEn } : {}),
    aiPopularity: insight?.popularity ?? null,
    ...(chart ? { chart } : {}),
    ...(track.views !== undefined ? { views: track.views } : {}),
    singAlong: singAlongLevel(signals),
    popularity: popularityScore(signals),
  };
}
