"use client";

import { useEffect, useRef, useState } from "react";
import { matchQueue } from "@/lib/client/match-queue";
import { resolveNumber, trackKey, type MatchStore, type OverrideStore } from "@/lib/client/match-store";
import type { SongMeta } from "@/lib/client/song-meta";
import { clearSung, markSung, setOverride } from "@/lib/client/stores";
import { describeError } from "@/lib/http";
import { locale, t as translateNow } from "@/lib/i18n";
import { useT } from "@/lib/i18n/react";
import { searchers } from "@/lib/karaoke/providers";
import { stripDecorations } from "@/lib/text/normalize";
import type { Brand, KaraokeSong, Track } from "@/lib/types";
import { NumberBadge } from "./NumberBadge";
import { SongInfoSection } from "./SongInfoSection";

interface Props {
  track: Track;
  brands: Brand[];
  store: MatchStore;
  overrides: OverrideStore;
  sung: Record<string, number[]>;
  meta?: SongMeta;
  aiEnabled: boolean;
  aiPending: boolean;
  onClose(): void;
}

/** 곡 상세: 번호 후보 고르기, 직접 검색, 불렀어요 기록 */
export function TrackSheet({ track, brands, store, overrides, sung, meta, aiEnabled, aiPending, onClose }: Props) {
  const { t, lang } = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const key = trackKey(track);
  const history = sung[key] ?? [];

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) dialog.current?.close();
      }}
      aria-labelledby="sheet-title"
      className="mx-auto mt-auto mb-0 max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-line bg-surface p-0 text-ink sm:my-auto sm:rounded-2xl"
    >
      <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-line bg-surface/95 px-5 py-4 backdrop-blur">
        <div className="min-w-0 flex-1">
          <h2 id="sheet-title" className="text-lg font-bold leading-snug">
            {track.title}
          </h2>
          <p className="text-sm text-muted">{track.artists.join(", ") || t("list.noArtist")}</p>
          {track.rawTitle && track.rawTitle !== track.title && (
            <p className="mt-1 truncate text-xs text-muted/70">{t("sheet.rawTitle", { title: track.rawTitle })}</p>
          )}
        </div>
        <button type="button" onClick={() => dialog.current?.close()} className="rounded-full px-2 py-1 text-xl text-muted hover:text-ink" aria-label={t("common.close")}>
          ×
        </button>
      </div>

      <div className="space-y-6 px-5 py-5">
        {brands.map((brand) => (
          <BrandSection key={brand} brand={brand} track={track} trackKeyValue={key} store={store} overrides={overrides} />
        ))}

        {meta && <SongInfoSection trackKeyValue={key} meta={meta} aiEnabled={aiEnabled} aiPending={aiPending} />}

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <button
            type="button"
            onClick={() => markSung(key, Date.now())}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-black hover:brightness-110"
          >
            {t("sheet.sung")}
          </button>
          {history.length > 0 && (
            <>
              <span className="text-sm text-muted">
                {t("sheet.history", {
                  n: history.length,
                  date: new Date(history[history.length - 1]).toLocaleDateString(locale(lang), { month: "long", day: "numeric" }),
                })}
              </span>
              <button type="button" onClick={() => clearSung(key)} className="text-xs text-muted underline-offset-2 hover:underline">
                {t("sheet.clearHistory")}
              </button>
            </>
          )}
          <span className="flex-1" />
          <button type="button" onClick={() => matchQueue.rematch(key)} className="text-sm text-muted hover:text-ink">
            {t("sheet.rematch")}
          </button>
          {track.url && track.source !== "paste" && (
            <a href={track.url} target="_blank" rel="noreferrer" className="text-sm text-muted hover:text-ink">
              {t(`sheet.open.${track.source}`)} ↗
            </a>
          )}
        </div>
      </div>
    </dialog>
  );
}

function BrandSection({
  brand,
  track,
  trackKeyValue,
  store,
  overrides,
}: {
  brand: Brand;
  track: Track;
  trackKeyValue: string;
  store: MatchStore;
  overrides: OverrideStore;
}) {
  const { t } = useT();
  const resolved = resolveNumber(trackKeyValue, brand, store, overrides);
  const auto = store[trackKeyValue]?.[brand];
  const isOverridden = Boolean(overrides[trackKeyValue] && brand in overrides[trackKeyValue]);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!resolved.song) return;
    try {
      await navigator.clipboard.writeText(resolved.song.no);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // 클립보드 권한이 없으면 조용히 넘어간다
    }
  };

  return (
    <section aria-label={t("brandSection.aria", { brand: t(`brand.${brand}`) })}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <NumberBadge brand={brand} resolved={resolved} size="lg" />
          {resolved.song && (
            <p className="mt-1 text-sm text-muted">
              {resolved.song.title} · {resolved.song.singer}
              {resolved.song.tags?.map((t) => (
                <span key={t} className="ml-1 rounded bg-surface-2 px-1 text-[10px]">
                  {t}
                </span>
              ))}
            </p>
          )}
          {resolved.status === "maybe" && <p className="mt-1 text-xs text-warn">{t("brandSection.maybe")}</p>}
          {resolved.status === "error" && resolved.error && <p className="mt-1 text-xs text-danger/90">{resolved.error}</p>}
          {resolved.status === "none" && !isOverridden && <p className="mt-1 text-xs text-muted">{t("brandSection.none")}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          {resolved.song && (
            <button type="button" onClick={copy} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface-2">
              {copied ? t("brandSection.copied") : t("brandSection.copy")}
            </button>
          )}
          {isOverridden ? (
            <button type="button" onClick={() => setOverride(trackKeyValue, brand, undefined)} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface-2">
              {t("brandSection.useAuto")}
            </button>
          ) : (
            resolved.status !== "pending" && (
              <button type="button" onClick={() => setOverride(trackKeyValue, brand, null)} className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:bg-surface-2">
                {t("brandSection.noNumber")}
              </button>
            )
          )}
        </div>
      </div>

      {auto && auto.candidates.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs text-muted">{t("brandSection.candidates")}</p>
          <SongChoices songs={auto.candidates} selectedNo={resolved.song?.no} onPick={(s) => setOverride(trackKeyValue, brand, s)} />
        </div>
      )}

      <ManualSearch brand={brand} initialQuery={stripDecorations(track.title)} onPick={(s) => setOverride(trackKeyValue, brand, s)} />
    </section>
  );
}

function SongChoices({ songs, selectedNo, onPick }: { songs: KaraokeSong[]; selectedNo?: string; onPick(song: KaraokeSong): void }) {
  return (
    <ul className="overflow-hidden rounded-lg border border-line">
      {songs.map((s) => (
        <li key={`${s.brand}-${s.no}`} className="border-b border-line/60 last:border-b-0">
          <button
            type="button"
            onClick={() => onPick(s)}
            className={`flex w-full items-baseline gap-3 px-3 py-2 text-left text-sm hover:bg-surface-2 ${s.no === selectedNo ? "bg-surface-2" : ""}`}
          >
            <span className="num w-14 shrink-0 font-semibold">{s.no}</span>
            <span className="min-w-0 flex-1 truncate">
              {s.title} <span className="text-muted">· {s.singer}</span>
            </span>
            {s.tags?.map((t) => (
              <span key={t} className="shrink-0 rounded bg-surface-2 px-1 text-[10px] text-muted">
                {t}
              </span>
            ))}
          </button>
        </li>
      ))}
    </ul>
  );
}

function ManualSearch({ brand, initialQuery, onPick }: { brand: Brand; initialQuery: string; onPick(song: KaraokeSong): void }) {
  const { t } = useT();
  const brandName = t(`brand.${brand}`);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState<"title" | "singer">("title");
  const [results, setResults] = useState<KaraokeSong[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
        {t("manual.open", { brand: brandName })}
      </button>
    );
  }

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const q = query.trim().slice(0, 100);
      const songs = type === "title" ? await searchers[brand].searchByTitle(q) : await searchers[brand].searchBySinger(q);
      setResults(songs);
    } catch (err) {
      setError(describeError(err, translateNow("target.karaoke")));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={search} className="mt-3 space-y-2">
      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as "title" | "singer")}
          className="rounded-lg border border-line bg-surface-2 px-2 text-sm"
          aria-label={t("manual.by")}
        >
          <option value="title">{t("manual.byTitle")}</option>
          <option value="singer">{t("manual.bySinger")}</option>
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-muted"
          placeholder={t("manual.placeholder", { brand: brandName })}
          aria-label={t("manual.placeholder", { brand: brandName })}
        />
        <button type="submit" disabled={loading} className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-bg disabled:opacity-50">
          {loading ? t("manual.searching") : t("manual.search")}
        </button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {results && results.length === 0 && <p className="text-sm text-muted">{t("manual.noResults")}</p>}
      {results && results.length > 0 && <SongChoices songs={results.slice(0, 30)} onPick={onPick} />}
    </form>
  );
}
