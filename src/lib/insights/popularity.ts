import type { SingAlong } from "./types";

export interface PopularitySignals {
  /** 최근 1년 TJ 인기차트 TOP100 최고 순위 */
  chartRank?: number;
  /** Claude 추정 대중성 1~5 */
  aiPopularity?: number | null;
  /** YouTube 조회수 (YouTube에서 가져온 곡만) */
  views?: number;
}

const ORDER: SingAlong[] = ["fans", "some", "many", "everyone"];

function fromAi(p: number | null | undefined): SingAlong | null {
  if (p === null || p === undefined) return null;
  if (p >= 5) return "everyone";
  if (p === 4) return "many";
  if (p === 3) return "some";
  return "fans";
}

function fromViews(v: number | undefined): SingAlong | null {
  if (v === undefined) return null;
  if (v >= 100_000_000) return "everyone";
  if (v >= 20_000_000) return "many";
  if (v >= 3_000_000) return "some";
  return "fans";
}

/**
 * 여러 신호 중 가장 높은 쪽을 쓴다.
 * 노래방 인기차트에 오른 곡은 실제로 많이 불리는 곡이라 그것만으로 "다 같이"로 본다.
 */
export function singAlongLevel(signals: PopularitySignals): SingAlong | null {
  if (signals.chartRank !== undefined) return "everyone";
  const levels = [fromAi(signals.aiPopularity), fromViews(signals.views)].filter((l): l is SingAlong => l !== null);
  if (levels.length === 0) return null;
  return levels.reduce((best, l) => (ORDER.indexOf(l) > ORDER.indexOf(best) ? l : best));
}

/** 정렬용 점수 (높을수록 유명). 정보가 없으면 -1 */
export function popularityScore(signals: PopularitySignals): number {
  if (signals.chartRank !== undefined) return 10 + (101 - signals.chartRank) / 100;
  const level = singAlongLevel(signals);
  return level ? ORDER.indexOf(level) + 1 : -1;
}

/** "1.2억회", "350만회" 같은 한국식 조회수 표기 */
export function formatViews(views: number): string {
  if (views >= 100_000_000) return `${(views / 100_000_000).toFixed(views >= 1_000_000_000 ? 0 : 1).replace(/\.0$/, "")}억회`;
  if (views >= 10_000) return `${Math.round(views / 10_000).toLocaleString("ko-KR")}만회`;
  return `${views.toLocaleString("ko-KR")}회`;
}
