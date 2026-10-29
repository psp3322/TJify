"use client";

import { useSyncExternalStore } from "react";
import type { InsightRequestItem, InsightResult, SongInsight } from "@/lib/insights/types";
import { trackKey } from "@/lib/track-key";
import type { Track } from "@/lib/types";
import { ApiClientError, apiPost } from "./api";
import { loadJson, saveJson, STORAGE_KEYS } from "./storage";

export interface StoredInsight {
  at: number;
  insight: SongInsight | null;
}

export type InsightStore = Record<string, StoredInsight>;

export interface InsightSnapshot {
  store: InsightStore;
  running: boolean;
  error: string | null;
}

const DAY = 24 * 60 * 60 * 1000;
const BATCH = 20;
const MAX_ENTRIES = 6000;
const SERVER_SNAPSHOT: InsightSnapshot = { store: {}, running: false, error: null };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isFresh(entry: StoredInsight | undefined): boolean {
  if (!entry) return false;
  return Date.now() - entry.at < (entry.insight ? 90 * DAY : 14 * DAY);
}

/**
 * 화면에 올라온 곡의 난이도·대중성을 BATCH곡씩 차례로 물어본다 (서버에 ANTHROPIC_API_KEY가 있을 때만).
 * 결과는 localStorage에 남겨 다음 방문 때 다시 묻지 않는다.
 */
class InsightQueue {
  private store: InsightStore = {};
  private loaded = false;
  private tracks: Track[] = [];
  private enabled = false;
  private readonly attempted = new Set<string>();
  private error: string | null = null;
  private looping = false;
  private snapshot: InsightSnapshot = SERVER_SNAPSHOT;
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

  setWork(tracks: Track[], enabled: boolean) {
    this.tracks = tracks;
    this.enabled = enabled;
    void this.pump();
  }

  retry() {
    this.error = null;
    this.attempted.clear();
    this.emit();
    void this.pump();
  }

  private ensureLoaded() {
    if (this.loaded || typeof window === "undefined") return;
    this.loaded = true;
    this.store = loadJson<InsightStore>(STORAGE_KEYS.insights, {});
    this.snapshot = { store: this.store, running: false, error: null };
  }

  private emit() {
    this.snapshot = { store: this.store, running: this.looping, error: this.error };
    for (const l of this.listeners) l();
  }

  private scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      const keys = Object.keys(this.store);
      if (keys.length > MAX_ENTRIES) {
        const keep = keys.sort((a, b) => this.store[b].at - this.store[a].at).slice(0, MAX_ENTRIES);
        this.store = Object.fromEntries(keep.map((k) => [k, this.store[k]]));
      }
      saveJson(STORAGE_KEYS.insights, this.store);
    }, 800);
  }

  private nextBatch(): InsightRequestItem[] {
    const batch: InsightRequestItem[] = [];
    const seen = new Set<string>();
    for (const t of this.tracks) {
      const key = trackKey(t);
      if (seen.has(key) || this.attempted.has(key) || isFresh(this.store[key])) continue;
      seen.add(key);
      batch.push({ key, title: t.title, artists: t.artists });
      if (batch.length >= BATCH) break;
    }
    return batch;
  }

  private async pump() {
    if (this.looping || !this.enabled || this.error || typeof window === "undefined") return;
    this.ensureLoaded();
    this.looping = true;
    this.emit();
    try {
      while (this.enabled && !this.error) {
        const batch = this.nextBatch();
        if (batch.length === 0) break;
        for (const item of batch) this.attempted.add(item.key);
        try {
          const { results } = await apiPost<{ results: InsightResult[] }>("/api/song-insights", { items: batch });
          const now = Date.now();
          this.store = { ...this.store };
          for (const r of results) this.store[r.key] = { at: now, insight: r.insight };
          this.scheduleSave();
        } catch (error) {
          for (const item of batch) this.attempted.delete(item.key);
          if (error instanceof ApiClientError && error.status === 429 && error.retryAfterSec) {
            await sleep(error.retryAfterSec * 1000);
          } else {
            this.error = error instanceof Error ? error.message : "난이도를 추정하지 못했어요.";
          }
        }
        this.emit();
      }
    } finally {
      this.looping = false;
      this.emit();
    }
  }
}

export const insightQueue = new InsightQueue();

export function useInsights(): InsightSnapshot {
  return useSyncExternalStore(insightQueue.subscribe, insightQueue.getSnapshot, insightQueue.getServerSnapshot);
}
