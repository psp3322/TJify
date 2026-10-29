"use client";

import type { SongMeta } from "@/lib/client/song-meta";
import { setMyDifficulty } from "@/lib/client/stores";
import { formatViews } from "@/lib/insights/popularity";
import { DIFFICULTY_LABEL, SING_ALONG_LABEL } from "@/lib/insights/types";

interface Props {
  trackKeyValue: string;
  meta: SongMeta;
  aiEnabled: boolean;
  aiPending: boolean;
}

const LEVELS = [1, 2, 3, 4, 5];

/** 곡 상세의 난이도·대중성 영역 */
export function SongInfoSection({ trackKeyValue, meta, aiEnabled, aiPending }: Props) {
  return (
    <section aria-label="난이도와 대중성" className="space-y-4 rounded-xl border border-line bg-surface-2/40 p-4">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">난이도</h3>
          {meta.difficulty !== null && (
            <span className="text-sm">
              {DIFFICULTY_LABEL[meta.difficulty]}
              <span className="ml-1 text-xs text-muted">{meta.difficultyIsMine ? "내 평가" : "Claude 추정"}</span>
            </span>
          )}
        </div>
        {meta.aiDifficulty !== null && (
          <p className="text-xs text-muted">
            Claude 추정: {DIFFICULTY_LABEL[meta.aiDifficulty]}
            {meta.tags.length > 0 && ` · ${meta.tags.join(", ")}`}
          </p>
        )}
        {meta.tip && <p className="text-xs text-muted">팁: {meta.tip}</p>}
        {meta.aiDifficulty === null && (
          <p className="text-xs text-muted">
            {!aiEnabled
              ? "자동 난이도는 꺼져 있어요. 불러 보고 직접 매겨 두면 다음에 참고할 수 있어요."
              : aiPending
                ? "난이도를 추정하는 중이에요…"
                : "Claude도 잘 모르는 곡이에요. 직접 매겨 두세요."}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="내 난이도 평가">
          {LEVELS.map((level) => {
            const active = meta.difficultyIsMine && meta.difficulty === level;
            return (
              <button
                key={level}
                type="button"
                aria-pressed={active}
                onClick={() => setMyDifficulty(trackKeyValue, active ? undefined : level)}
                className={`rounded-full border px-2.5 py-1 text-xs ${active ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink"}`}
              >
                {DIFFICULTY_LABEL[level]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5 border-t border-line pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">다른 사람도 따라 부를 수 있을까?</h3>
          {meta.singAlong && <span className="text-sm text-accent">{SING_ALONG_LABEL[meta.singAlong].long}</span>}
        </div>
        <ul className="space-y-0.5 text-xs text-muted">
          {meta.chart && (
            <li>
              최근 1년 TJ 노래방 인기차트 TOP100 · 최고 {meta.chart[0]}위 ({meta.chart[1]})
            </li>
          )}
          {meta.aiPopularity !== null && <li>Claude 추정 대중성: {meta.aiPopularity}/5</li>}
          {meta.views !== undefined && <li>YouTube 조회수 {formatViews(meta.views)}</li>}
          {!meta.chart && meta.aiPopularity === null && meta.views === undefined && <li>아직 판단할 정보가 없어요.</li>}
        </ul>
      </div>
    </section>
  );
}
