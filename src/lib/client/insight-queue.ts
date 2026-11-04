"use client";

import { useSyncExternalStore } from "react";
import type { InsightClient } from "@/lib/insights/claude";
import type { InsightRequestItem, SongInsight } from "@/lib/insights/types";
import { trackKey } from "@/lib/track-key";
import type { Track } from "@/lib/types";
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
 * 화면에 올라온 곡의 난이도·대중성을 BATCH곡씩 차례로 Claude에 물어본다.
 * 방문자가 설정에 Anthropic API 키를 넣었을 때만 돌고, 브라우저에서 API를 바로 부른다.
 * 결과는 localStorage에 남겨 다음 방문 때 다시 묻지 않는다.
 */
class InsightQueue {
  private store: InsightStore = {};
  private loaded = false;
  private tracks: Track[] = [];
  private apiKey = "";
  private model = "";
  private client: InsightClient | null = null;
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

  /** apiKey가 빈 값이면 멈춘다. 키나 모델을 바꾸면 이전 오류를 지우고 다시 시도한다 */
  setWork(tracks: Track[], apiKey: string, model: string) {
    this.tracks = tracks;
    if (apiKey !== this.apiKey || model !== this.model) {
      this.apiKey = apiKey;
      this.model = model;
      this.client = null;
      this.error = null;
      this.attempted.clear();
      this.emit();
    }
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
    if (this.looping || !this.apiKey || this.error || typeof window === "undefined") return;
    this.ensureLoaded();
    if (this.nextBatch().length === 0) return;
    this.looping = true;
    this.emit();
    try {
      // Anthropic SDK는 키를 넣은 사람에게만 필요하니 이때 처음 불러온다
      let claude: typeof import("@/lib/insights/claude");
      try {
        claude = await import("@/lib/insights/claude");
      } catch {
        this.error = "난이도 추정 기능을 불러오지 못했어요. 새로고침해 주세요.";
        return;
      }
      while (this.apiKey && !this.error) {
        const batch = this.nextBatch();
        if (batch.length === 0) break;
        for (const item of batch) this.attempted.add(item.key);
        const apiKey = this.apiKey;
        try {
          this.client ??= claude.createInsightClient(apiKey);
          const insights = await claude.estimateSongs(batch, this.client, this.model || claude.DEFAULT_MODEL);
          // 기다리는 사이 키가 바뀌었으면 이 결과는 버린다
          if (apiKey !== this.apiKey) continue;
          const now = Date.now();
          this.store = { ...this.store };
          batch.forEach((item, i) => (this.store[item.key] = { at: now, insight: insights[i] ?? null }));
          this.scheduleSave();
        } catch (error) {
          for (const item of batch) this.attempted.delete(item.key);
          const info = claude.describeInsightError(error);
          if (info.retryAfterSec) await sleep(info.retryAfterSec * 1000);
          else if (apiKey === this.apiKey) this.error = info.message;
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
