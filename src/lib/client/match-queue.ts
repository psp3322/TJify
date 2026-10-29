"use client";

import { useSyncExternalStore } from "react";
import { MATCH_BATCH_SIZE } from "@/lib/constants";
import type { Brand, MatchRequestItem, MatchResult, Track } from "@/lib/types";
import { ApiClientError, apiPost } from "./api";
import { isFresh, mergeResults, pruneStore, trackKey, type MatchStore } from "./match-store";
import { loadJson, saveJson, STORAGE_KEYS } from "./storage";

export interface QueueSnapshot {
  store: MatchStore;
  running: boolean;
  error: string | null;
  inflight: number;
}

const SERVER_SNAPSHOT: QueueSnapshot = { store: {}, running: false, error: null, inflight: 0 };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 화면에 올라온 곡들의 노래방 번호를 MATCH_BATCH_SIZE개씩 차례로 찾는다.
 * 결과는 localStorage에 남겨서 다음 방문 때 다시 찾지 않는다.
 */
class MatchQueue {
  private store: MatchStore = {};
  private loaded = false;
  private tracks: Track[] = [];
  private brands: Brand[] = [];
  private readonly attempted = new Set<string>();
  private readonly inflight = new Set<string>();
  private running = true;
  private error: string | null = null;
  private looping = false;
  private snapshot: QueueSnapshot = SERVER_SNAPSHOT;
  private readonly listeners = new Set<() => void>();
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  subscribe = (listener: () => void) => {
    this.ensureLoaded();
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => {
    this.ensureLoaded();
    return this.snapshot;
  };

  getServerSnapshot = () => SERVER_SNAPSHOT;

  setWork(tracks: Track[], brands: Brand[]) {
    this.tracks = tracks;
    this.brands = brands;
    void this.pump();
  }

  pause() {
    this.running = false;
    this.emit();
  }

  resume() {
    this.running = true;
    this.error = null;
    this.emit();
    void this.pump();
  }

  /** 한 곡을 처음부터 다시 찾는다 */
  rematch(key: string) {
    const next = { ...this.store };
    delete next[key];
    this.store = next;
    this.attempted.delete(key);
    this.scheduleSave();
    this.emit();
    void this.pump();
  }

  /** 검색 오류가 났던 곡들을 다시 대기열에 올린다 */
  retryFailed() {
    for (const key of [...this.attempted]) {
      if (!isFresh(this.store[key], this.brands)) this.attempted.delete(key);
    }
    this.resume();
  }

  private ensureLoaded() {
    if (this.loaded || typeof window === "undefined") return;
    this.loaded = true;
    this.store = loadJson<MatchStore>(STORAGE_KEYS.matches, {});
    this.snapshot = this.makeSnapshot();
  }

  private makeSnapshot(): QueueSnapshot {
    return { store: this.store, running: this.running, error: this.error, inflight: this.inflight.size };
  }

  private emit() {
    this.snapshot = this.makeSnapshot();
    for (const l of this.listeners) l();
  }

  private scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => saveJson(STORAGE_KEYS.matches, this.store), 800);
  }

  private nextBatch(): MatchRequestItem[] {
    const batch: MatchRequestItem[] = [];
    const seen = new Set<string>();
    for (const t of this.tracks) {
      const key = trackKey(t);
      if (seen.has(key) || this.inflight.has(key) || this.attempted.has(key)) continue;
      seen.add(key);
      if (isFresh(this.store[key], this.brands)) continue;
      batch.push({ key, title: t.title, artists: t.artists });
      if (batch.length >= MATCH_BATCH_SIZE) break;
    }
    return batch;
  }

  private async pump() {
    if (this.looping || typeof window === "undefined") return;
    this.ensureLoaded();
    this.looping = true;
    try {
      while (this.running && !this.error && this.brands.length > 0) {
        const batch = this.nextBatch();
        if (batch.length === 0) break;
        for (const item of batch) {
          this.inflight.add(item.key);
          this.attempted.add(item.key);
        }
        this.emit();
        try {
          const { results } = await apiPost<{ results: MatchResult[] }>("/api/karaoke/match", { items: batch, brands: this.brands });
          this.store = pruneStore(mergeResults(this.store, results));
          this.scheduleSave();
        } catch (error) {
          for (const item of batch) this.attempted.delete(item.key);
          if (error instanceof ApiClientError && error.status === 429) {
            await sleep((error.retryAfterSec ?? 15) * 1000);
          } else {
            this.error = error instanceof Error ? error.message : "번호를 찾지 못했습니다.";
          }
        } finally {
          for (const item of batch) this.inflight.delete(item.key);
          this.emit();
        }
      }
    } finally {
      this.looping = false;
      this.emit();
    }
  }
}

export const matchQueue = new MatchQueue();

export function useMatchQueue(): QueueSnapshot {
  return useSyncExternalStore(matchQueue.subscribe, matchQueue.getSnapshot, matchQueue.getServerSnapshot);
}
