"use client";

import type { SongMeta } from "@/lib/client/song-meta";
import { setMyDifficulty } from "@/lib/client/stores";
import { useT } from "@/lib/i18n/react";
import { formatViews } from "@/lib/insights/popularity";
import { difficultyKey, singAlongKey, tagLabel } from "@/lib/insights/types";
import { formatChartPeriod } from "@/lib/karaoke/chart-period";
import { RichText } from "./RichText";

interface Props {
  trackKeyValue: string;
  meta: SongMeta;
  aiEnabled: boolean;
  aiPending: boolean;
}

const LEVELS = [1, 2, 3, 4, 5];
const ENGINE_NAME = { claude: "Claude", gemini: "Gemini" } as const;

/** 곡 상세의 난이도·대중성 영역 */
export function SongInfoSection({ trackKeyValue, meta, aiEnabled, aiPending }: Props) {
  const { t, lang } = useT();
  const engine = meta.aiBy ? ENGINE_NAME[meta.aiBy] : t("engine.ai");
  const tip = lang === "en" ? (meta.tipEn ?? meta.tip) : (meta.tip ?? meta.tipEn);

  return (
    <section aria-label={t("info.aria")} className="space-y-4 rounded-xl border border-line bg-surface-2/40 p-4">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">{t("info.difficulty")}</h3>
          {meta.difficulty !== null && (
            <span className="text-sm">
              {t(difficultyKey(meta.difficulty))}
              <span className="ml-1 text-xs text-muted">{meta.difficultyIsMine ? t("info.mine") : t("info.estimate", { engine })}</span>
            </span>
          )}
        </div>
        {meta.aiDifficulty !== null && (
          <p className="text-xs text-muted">
            {t("info.estimateLine", { engine, label: t(difficultyKey(meta.aiDifficulty)) })}
            {meta.tags.length > 0 && ` · ${meta.tags.map((tag) => tagLabel(tag, lang)).join(", ")}`}
          </p>
        )}
        {tip && <p className="text-xs text-muted">{t("info.tip", { tip })}</p>}
        {meta.aiDifficulty === null && (
          <p className="text-xs text-muted">
            {!aiEnabled ? (
              <RichText
                text={t("info.aiOff")}
                link={(label) => (
                  <a href="#settings" className="underline underline-offset-2 hover:text-ink">
                    {label}
                  </a>
                )}
              />
            ) : aiPending ? (
              t("info.aiPending")
            ) : (
              t("info.aiUnknown")
            )}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("info.rateAria")}>
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
                {t(difficultyKey(level))}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5 border-t border-line pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">{t("info.singAlongTitle")}</h3>
          {meta.singAlong && <span className="text-sm text-accent">{t(singAlongKey(meta.singAlong, true))}</span>}
        </div>
        <ul className="space-y-0.5 text-xs text-muted">
          {meta.chart && <li>{t("info.chart", { rank: meta.chart[0], period: formatChartPeriod(meta.chart[1], lang) })}</li>}
          {meta.aiPopularity !== null && <li>{t("info.aiPopularity", { engine, n: meta.aiPopularity })}</li>}
          {meta.views !== undefined && <li>{t("info.views", { views: formatViews(meta.views, lang) })}</li>}
          {!meta.chart && meta.aiPopularity === null && meta.views === undefined && <li>{t("info.noSignals")}</li>}
        </ul>
      </div>
    </section>
  );
}
