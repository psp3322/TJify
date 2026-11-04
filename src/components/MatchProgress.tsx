"use client";

import { matchQueue } from "@/lib/client/match-queue";
import { useT } from "@/lib/i18n/react";

interface Props {
  done: number;
  failed: number;
  total: number;
  running: boolean;
  error: string | null;
}

/** 번호 찾기 진행 상황 */
export function MatchProgress({ done, failed, total, running, error }: Props) {
  const { t } = useT();
  if (total === 0) return null;
  const finished = done >= total;
  const pct = Math.round((done / total) * 100);

  if (error) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
        <span className="flex-1">{t("match.stopped", { error })}</span>
        <button type="button" onClick={() => matchQueue.retryFailed()} className="shrink-0 rounded-full border border-line px-3 py-1 hover:bg-surface-2">
          {t("common.retry")}
        </button>
      </div>
    );
  }

  const failedNote =
    failed > 0 ? (
      <span className="flex items-center gap-2 text-xs text-danger/90">
        <span>{t("match.failed", { n: failed })}</span>
        <button type="button" onClick={() => matchQueue.retryFailed()} className="shrink-0 rounded-full border border-line px-2 py-0.5 text-muted hover:text-ink">
          {t("common.retry")}
        </button>
      </span>
    ) : null;

  if (finished) {
    return failedNote ?? <p className="text-xs text-muted">{t("match.done", { n: total })}</p>;
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="flex-1">
          {t("match.progress", { done, total })}
          {!running && t("match.paused")}
        </span>
        <button
          type="button"
          onClick={() => (running ? matchQueue.pause() : matchQueue.resume())}
          className="rounded-full border border-line px-2.5 py-0.5 hover:bg-surface-2"
        >
          {running ? t("match.pause") : t("match.resume")}
        </button>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      {failedNote}
    </div>
  );
}
