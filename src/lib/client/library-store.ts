"use client";

import { useSyncExternalStore } from "react";
import { describeError } from "@/lib/http";
import type { Track, TrackPage } from "@/lib/types";
import { libraryLoader } from "./library";

export interface LibraryState {
  status: "idle" | "loading" | "done" | "error";
  tracks: Track[];
  total?: number;
  /** 링크로 가져온 플레이리스트의 제목 */
  title?: string;
  error?: string;
}

const EMPTY: LibraryState = { status: "idle", tracks: [] };
/** 좋아요 목록이 아주 길 때 끝없이 불러오지 않도록 둔 상한 */
const MAX_TRACKS = 5000;

const states = new Map<string, LibraryState>();
const listeners = new Set<() => void>();

function set(key: string, state: LibraryState) {
  states.set(key, state);
  for (const l of listeners) l();
}

export const libraryStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  get(key: string | null): LibraryState {
    return (key && states.get(key)) || EMPTY;
  },

  /** 모든 페이지를 차례로 받아 온다. 이미 받는 중이거나 받았으면 아무것도 안 한다 */
  async load(key: string, force = false) {
    const current = states.get(key);
    if (!force && current && (current.status === "loading" || current.status === "done")) return;
    const loadPage = libraryLoader(key);
    if (!loadPage) return;

    const tracks: Track[] = [];
    const seen = new Set<string>();
    let cursor: string | null = null;
    let total: number | undefined;
    let title: string | undefined;
    set(key, { status: "loading", tracks: [] });
    try {
      do {
        const page: TrackPage = await loadPage(cursor);
        for (const t of page.tracks) {
          if (seen.has(t.id)) continue;
          seen.add(t.id);
          tracks.push(t);
        }
        total = page.total ?? total;
        title = page.title ?? title;
        cursor = page.next;
        set(key, { status: "loading", tracks: [...tracks], total, title });
      } while (cursor && tracks.length < MAX_TRACKS);
      set(key, { status: "done", tracks, total, title });
    } catch (error) {
      set(key, {
        status: "error",
        tracks,
        total,
        title,
        error: describeError(error, "음악 서비스"),
      });
    }
  },

  setStatic(key: string, tracks: Track[]) {
    set(key, { status: "done", tracks, total: tracks.length });
  },

  forget(prefix: string) {
    for (const k of [...states.keys()]) if (k.startsWith(prefix)) states.delete(k);
    for (const l of listeners) l();
  },
};

export function useLibrary(key: string | null): LibraryState {
  return useSyncExternalStore(
    libraryStore.subscribe,
    () => libraryStore.get(key),
    () => EMPTY,
  );
}
