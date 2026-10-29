"use client";

import { useSyncExternalStore } from "react";
import type { Track, TrackPage } from "@/lib/types";
import { ApiClientError, apiGet } from "./api";

export interface LibraryState {
  status: "idle" | "loading" | "done" | "error";
  tracks: Track[];
  total?: number;
  error?: string;
  errorCode?: string;
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

/** 탭 키 → 목록을 가져올 API 경로. 예: "spotify:liked", "youtube:playlist:PL123" */
export function libraryEndpoint(key: string): string | null {
  const [source, kind, id] = key.split(":");
  if (source !== "spotify" && source !== "youtube") return null;
  if (kind === "liked") return `/api/library/${source}/liked`;
  if (kind === "playlist" && id) return `/api/library/${source}/playlists/${encodeURIComponent(id)}`;
  return null;
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
    const endpoint = libraryEndpoint(key);
    if (!endpoint) return;

    const tracks: Track[] = [];
    const seen = new Set<string>();
    let cursor: string | null = null;
    let total: number | undefined;
    set(key, { status: "loading", tracks: [] });
    try {
      do {
        const url: string = cursor ? `${endpoint}?cursor=${encodeURIComponent(cursor)}` : endpoint;
        const page: TrackPage = await apiGet<TrackPage>(url);
        for (const t of page.tracks) {
          if (seen.has(t.id)) continue;
          seen.add(t.id);
          tracks.push(t);
        }
        total = page.total ?? total;
        cursor = page.next;
        set(key, { status: "loading", tracks: [...tracks], total });
      } while (cursor && tracks.length < MAX_TRACKS);
      set(key, { status: "done", tracks, total });
    } catch (error) {
      set(key, {
        status: "error",
        tracks,
        total,
        error: error instanceof Error ? error.message : "목록을 불러오지 못했습니다.",
        errorCode: error instanceof ApiClientError ? error.code : undefined,
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
