"use client";

import { useEffect, useRef } from "react";
import { resolveNumber, trackKey, type MatchStore, type OverrideStore } from "@/lib/client/match-store";
import type { SongMeta } from "@/lib/client/song-meta";
import { markSung } from "@/lib/client/stores";
import type { Brand, Track } from "@/lib/types";
import { NumberBadge } from "./NumberBadge";
import { SongBadges } from "./SongBadges";

interface Props {
  track: Track | null;
  poolSize: number;
  brands: Brand[];
  store: MatchStore;
  overrides: OverrideStore;
  meta?: SongMeta;
  onReroll(): void;
  onClose(): void;
}

/** "오늘 뭐 부르지?" 무작위 추천 카드 */
export function RandomPick({ track, poolSize, brands, store, overrides, meta, onReroll, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  const key = track ? trackKey(track) : null;

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) dialog.current?.close();
      }}
      aria-labelledby="random-title"
      className="m-auto w-[min(92vw,26rem)] rounded-2xl border border-line bg-surface p-6 text-center text-ink"
    >
      <p id="random-title" className="text-sm text-muted">
        오늘 이거 어때요?
      </p>
      {track && key ? (
        <>
          <h2 className="mt-3 text-2xl font-bold leading-snug">{track.title}</h2>
          <p className="mt-1 text-muted">{track.artists.join(", ")}</p>
          {meta && (
            <div className="flex justify-center">
              <SongBadges meta={meta} />
            </div>
          )}
          <div className="mt-5 flex justify-center gap-8">
            {brands.map((b) => (
              <NumberBadge key={b} brand={b} resolved={resolveNumber(key, b, store, overrides)} size="lg" />
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">지금 목록의 조건에 맞는 곡 중 최근 2주 안에 부른 곡을 빼고 {poolSize}곡에서 골랐어요.</p>
          <div className="mt-5 flex justify-center gap-2">
            <button type="button" onClick={onReroll} className="rounded-full border border-line px-4 py-2 text-sm hover:bg-surface-2">
              다시 뽑기
            </button>
            <button
              type="button"
              onClick={() => {
                markSung(key, Date.now());
                dialog.current?.close();
              }}
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-black hover:brightness-110"
            >
              🎤 이거 부를게요
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-4">고를 곡이 아직 없어요.</p>
          <p className="mt-2 text-sm text-muted">번호를 찾은 곡이 생기면 그중에서 골라 드릴게요.</p>
          <button type="button" onClick={() => dialog.current?.close()} className="mt-5 rounded-full border border-line px-4 py-2 text-sm">
            닫기
          </button>
        </>
      )}
    </dialog>
  );
}
