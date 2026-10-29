"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { resolveNumber, trackKey, type MatchStore, type OverrideStore } from "@/lib/client/match-store";
import type { SongMeta } from "@/lib/client/song-meta";
import type { Brand, Track } from "@/lib/types";
import { NumberBadge } from "./NumberBadge";
import { SongBadges } from "./SongBadges";

const PAGE = 150;

interface Props {
  tracks: Track[];
  brands: Brand[];
  store: MatchStore;
  overrides: OverrideStore;
  sung: Record<string, number[]>;
  meta: Map<string, SongMeta>;
  onSelect(track: Track): void;
}

/** 곡 목록. 길면 스크롤할 때마다 PAGE개씩 더 그린다 */
export function TrackList({ tracks, brands, store, overrides, sung, meta, onSelect }: Props) {
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef<HTMLLIElement>(null);
  const hasMore = tracks.length > limit;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setLimit((n) => n + PAGE);
      },
      { rootMargin: "600px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore]);

  if (tracks.length === 0) return null;

  return (
    <ul className="divide-y divide-line/60">
      {tracks.slice(0, limit).map((track) => {
        const key = trackKey(track);
        const sungCount = sung[key]?.length ?? 0;
        const info = meta.get(key);
        return (
          <li key={track.id}>
            <button
              type="button"
              onClick={() => onSelect(track)}
              className="flex w-full items-center gap-3 px-1 py-2.5 text-left transition-colors hover:bg-surface-2/60 focus-visible:bg-surface-2 focus-visible:outline-none"
            >
              <Thumb src={track.imageUrl} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{track.title}</span>
                <span className="block truncate text-sm text-muted">
                  {track.artists.join(", ") || "가수 정보 없음"}
                  {sungCount > 0 && <span className="ml-1.5 text-xs text-accent">🎤 {sungCount}</span>}
                </span>
                {info && <SongBadges meta={info} />}
              </span>
              <span className="flex shrink-0 gap-3">
                {brands.map((b) => (
                  <NumberBadge key={b} brand={b} resolved={resolveNumber(key, b, store, overrides)} />
                ))}
              </span>
            </button>
          </li>
        );
      })}
      {hasMore && (
        <li ref={sentinel} className="py-4 text-center text-sm text-muted">
          더 불러오는 중…
        </li>
      )}
    </ul>
  );
}

function Thumb({ src }: { src?: string }) {
  if (!src) {
    return (
      <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-md bg-surface-2 text-lg text-muted/60">
        ♪
      </span>
    );
  }
  return <Image src={src} alt="" width={44} height={44} unoptimized className="size-11 shrink-0 rounded-md object-cover" loading="lazy" />;
}
