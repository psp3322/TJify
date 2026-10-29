"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet } from "@/lib/client/api";
import { matchQueue } from "@/lib/client/match-queue";
import { resolveNumber, trackKey, type MatchStore, type OverrideStore } from "@/lib/client/match-store";
import { clearSung, markSung, setOverride } from "@/lib/client/stores";
import { stripDecorations } from "@/lib/text/normalize";
import { BRAND_LABEL, type Brand, type KaraokeSong, type Track } from "@/lib/types";
import { NumberBadge } from "./NumberBadge";

interface Props {
  track: Track;
  brands: Brand[];
  store: MatchStore;
  overrides: OverrideStore;
  sung: Record<string, number[]>;
  onClose(): void;
}

const SOURCE_LABEL = { spotify: "Spotify에서 열기", youtube: "YouTube에서 열기", paste: "" } as const;

/** 곡 상세: 번호 후보 고르기, 직접 검색, 불렀어요 기록 */
export function TrackSheet({ track, brands, store, overrides, sung, onClose }: Props) {
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
          <p className="text-sm text-muted">{track.artists.join(", ") || "가수 정보 없음"}</p>
          {track.rawTitle && track.rawTitle !== track.title && <p className="mt-1 truncate text-xs text-muted/70">원래 제목: {track.rawTitle}</p>}
        </div>
        <button type="button" onClick={() => dialog.current?.close()} className="rounded-full px-2 py-1 text-xl text-muted hover:text-ink" aria-label="닫기">
          ×
        </button>
      </div>

      <div className="space-y-6 px-5 py-5">
        {brands.map((brand) => (
          <BrandSection key={brand} brand={brand} track={track} trackKeyValue={key} store={store} overrides={overrides} />
        ))}

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <button
            type="button"
            onClick={() => markSung(key, Date.now())}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-black hover:brightness-110"
          >
            🎤 불렀어요
          </button>
          {history.length > 0 && (
            <>
              <span className="text-sm text-muted">
                {history.length}번 · 마지막 {new Date(history[history.length - 1]).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
              </span>
              <button type="button" onClick={() => clearSung(key)} className="text-xs text-muted underline-offset-2 hover:underline">
                기록 지우기
              </button>
            </>
          )}
          <span className="flex-1" />
          <button type="button" onClick={() => matchQueue.rematch(key)} className="text-sm text-muted hover:text-ink">
            다시 찾기
          </button>
          {track.url && SOURCE_LABEL[track.source] && (
            <a href={track.url} target="_blank" rel="noreferrer" className="text-sm text-muted hover:text-ink">
              {SOURCE_LABEL[track.source]} ↗
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
    <section aria-label={`${BRAND_LABEL[brand]} 번호`}>
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
          {resolved.status === "maybe" && <p className="mt-1 text-xs text-warn">제목은 비슷한데 가수가 다를 수 있어요. 아래 후보를 확인해 주세요.</p>}
          {resolved.status === "error" && resolved.error && <p className="mt-1 text-xs text-danger/90">{resolved.error}</p>}
          {resolved.status === "none" && !isOverridden && <p className="mt-1 text-xs text-muted">자동으로 찾지 못했어요. 아래에서 직접 검색해 보세요.</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          {resolved.song && (
            <button type="button" onClick={copy} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface-2">
              {copied ? "복사됨" : "번호 복사"}
            </button>
          )}
          {isOverridden ? (
            <button type="button" onClick={() => setOverride(trackKeyValue, brand, undefined)} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface-2">
              자동 결과로
            </button>
          ) : (
            resolved.status !== "pending" && (
              <button type="button" onClick={() => setOverride(trackKeyValue, brand, null)} className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:bg-surface-2">
                번호 없음
              </button>
            )
          )}
        </div>
      </div>

      {auto && auto.candidates.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs text-muted">후보</p>
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState<"title" | "singer">("title");
  const [results, setResults] = useState<KaraokeSong[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
        {BRAND_LABEL[brand]}에서 직접 검색
      </button>
    );
  }

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q: query.trim(), brand, type });
      const { songs } = await apiGet<{ songs: KaraokeSong[] }>(`/api/karaoke/search?${params}`);
      setResults(songs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "검색하지 못했습니다.");
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
          aria-label="검색 기준"
        >
          <option value="title">곡 제목</option>
          <option value="singer">가수</option>
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-muted"
          placeholder={`${BRAND_LABEL[brand]} 검색어`}
          aria-label={`${BRAND_LABEL[brand]} 검색어`}
        />
        <button type="submit" disabled={loading} className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-bg disabled:opacity-50">
          {loading ? "찾는 중" : "검색"}
        </button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {results && results.length === 0 && <p className="text-sm text-muted">검색 결과가 없어요.</p>}
      {results && results.length > 0 && <SongChoices songs={results.slice(0, 30)} onPick={onPick} />}
    </form>
  );
}
