"use client";

import { matchQueue } from "@/lib/client/match-queue";

interface Props {
  done: number;
  failed: number;
  total: number;
  running: boolean;
  error: string | null;
}

/** 번호 찾기 진행 상황 */
export function MatchProgress({ done, failed, total, running, error }: Props) {
  if (total === 0) return null;
  const finished = done >= total;
  const pct = Math.round((done / total) * 100);

  if (error) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
        <span className="flex-1">번호 찾기가 멈췄어요: {error}</span>
        <button type="button" onClick={() => matchQueue.retryFailed()} className="shrink-0 rounded-full border border-line px-3 py-1 hover:bg-surface-2">
          다시 시도
        </button>
      </div>
    );
  }

  const failedNote =
    failed > 0 ? (
      <span className="flex items-center gap-2 text-xs text-danger/90">
        <span>{failed}곡은 노래방 검색에 연결하지 못해 확인하지 못했어요.</span>
        <button type="button" onClick={() => matchQueue.retryFailed()} className="shrink-0 rounded-full border border-line px-2 py-0.5 text-muted hover:text-ink">
          다시 시도
        </button>
      </span>
    ) : null;

  if (finished) {
    return failedNote ?? <p className="text-xs text-muted">{total}곡 모두 확인했어요.</p>;
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="flex-1">
          노래방 번호 찾는 중 {done}/{total}
          {!running && " (일시정지)"}
        </span>
        <button
          type="button"
          onClick={() => (running ? matchQueue.pause() : matchQueue.resume())}
          className="rounded-full border border-line px-2.5 py-0.5 hover:bg-surface-2"
        >
          {running ? "일시정지" : "계속"}
        </button>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      {failedNote}
    </div>
  );
}
