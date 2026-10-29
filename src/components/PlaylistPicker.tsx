"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/client/api";
import type { PlaylistSummary } from "@/lib/types";

export type PlaylistSource = "spotify" | "youtube";

export interface PlaylistSelection {
  source: PlaylistSource;
  id: string;
  name: string;
}

const cache = new Map<PlaylistSource, PlaylistSummary[]>();

/** 계정 연결을 해제하면 그 계정의 플레이리스트 목록도 잊는다 */
export function forgetPlaylists(source: PlaylistSource) {
  cache.delete(source);
}

interface Props {
  connected: Record<PlaylistSource, boolean>;
  onSelect(selection: PlaylistSelection): void;
}

/** 연결된 서비스의 플레이리스트(재생목록) 목록에서 하나를 고른다 */
export function PlaylistPicker({ connected, onSelect }: Props) {
  const available = (["spotify", "youtube"] as const).filter((s) => connected[s]);
  const [source, setSource] = useState<PlaylistSource | null>(null);
  const active = source && connected[source] ? source : (available[0] ?? null);
  const [state, setState] = useState<{ source: PlaylistSource | null; items: PlaylistSummary[] | null; error: string | null }>({
    source: null,
    items: null,
    error: null,
  });

  useEffect(() => {
    if (!active || cache.has(active)) return;
    let alive = true;
    apiGet<{ playlists: PlaylistSummary[] }>(`/api/library/${active}/playlists`).then(
      ({ playlists }) => {
        cache.set(active, playlists);
        if (alive) setState({ source: active, items: playlists, error: null });
      },
      (error: unknown) => {
        if (alive) setState({ source: active, items: null, error: error instanceof Error ? error.message : "목록을 불러오지 못했습니다." });
      },
    );
    return () => {
      alive = false;
    };
  }, [active]);

  if (!active) {
    return <p className="py-10 text-center text-muted">Spotify나 YouTube를 먼저 연결하면 플레이리스트를 고를 수 있어요.</p>;
  }

  const items = cache.get(active) ?? (state.source === active ? state.items : null);
  const error = state.source === active ? state.error : null;

  return (
    <div className="space-y-3">
      {available.length > 1 && (
        <div className="flex gap-2" role="tablist" aria-label="플레이리스트 출처">
          {available.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={s === active}
              onClick={() => setSource(s)}
              className={`rounded-full px-3 py-1 text-sm ${s === active ? "bg-ink text-bg" : "border border-line text-muted"}`}
            >
              {s === "spotify" ? "Spotify" : "YouTube"}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      {!items && !error && <p className="py-6 text-center text-muted">플레이리스트 불러오는 중…</p>}
      {items && items.length === 0 && <p className="py-6 text-center text-muted">플레이리스트가 없어요.</p>}
      {items && items.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect({ source: active, id: p.id, name: p.name })}
                className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-2 text-left hover:bg-surface-2"
              >
                {p.imageUrl ? (
                  <Image src={p.imageUrl} alt="" width={48} height={48} unoptimized className="size-12 rounded-lg object-cover" />
                ) : (
                  <span className="size-12 rounded-lg bg-surface-2" aria-hidden />
                )}
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block text-xs text-muted">{p.trackCount !== undefined ? `${p.trackCount}곡` : ""}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
