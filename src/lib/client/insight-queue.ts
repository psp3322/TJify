"use client";

import { useSyncExternalStore } from "react";
import { t } from "@/lib/i18n";
import type { InsightClient } from "@/lib/insights/claude";
import type { InsightErrorInfo } from "@/lib/insights/prompt";
import type { InsightEngine, InsightRequestItem, SongInsight } from "@/lib/insights/types";
import { trackKey } from "@/lib/track-key";
import type { Track } from "@/lib/types";
import type { EngineConfig } from "./settings";
import { loadJson, saveJson, STORAGE_KEYS } from "./storage";

export interface StoredInsight {
  at: number;
  insight: SongInsight | null;
  /** 추정한 AI */
  by?: InsightEngine;
}

interface Estimator {
  estimate(items: InsightRequestItem[]): Promise<Array<SongInsight | null>>;
  describe(error: unknown): InsightErrorInfo;
}

/** AI별 코드는 그 AI를 쓸 때 처음 불러온다 (Anthropic SDK는 크기가 커서 첫 화면에 넣지 않는다) */
async function loadEstimator(engine: EngineConfig): Promise<Estimator> {
  if (engine.provider === "claude") {
    const claude = await import("@/lib/insights/claude");
    let client: InsightClient | null = null;
    return {
      estimate: (items) => claude.estimateSongs(items, (client ??= claude.createInsightClient(engine.apiKey)), engine.model),
      describe: claude.describeInsightError,
    };
  }
  const gemini = await import("@/lib/insights/gemini");
  return {
    estimate: (items) => gemini.estimateWithGemini(items, engine.apiKey, { model: engine.model }),
    describe: gemini.describeGeminiError,
  };
}

const engineId = (engine: EngineConfig | null) => (engine ? `${engine.provider}|${engine.model}|${engine.apiKey}` : "");

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
 * 화면에 올라온 곡의 난이도·대중성을 BATCH곡씩 차례로 AI(Gemini 또는 Claude)에 물어본다.
 * 쓸 수 있는 키가 있을 때만 돌고, 브라우저에서 API를 바로 부른다.
 * 결과는 localStorage에 남겨 다음 방문 때 다시 묻지 않는다.
 */
class InsightQueue {
  private store: InsightStore = {};
  private loaded = false;
  private tracks: Track[] = [];
  private engine: EngineConfig | null = null;
  private estimator: Promise<Estimator> | null = null;
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

  /** engine이 null이면 멈춘다. 쓰는 AI나 키를 바꾸면 이전 오류를 지우고 다시 시도한다 */
  setWork(tracks: Track[], engine: EngineConfig | null) {
    this.tracks = tracks;
    if (engineId(engine) !== engineId(this.engine)) {
      this.engine = engine;
      this.estimator = null;
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
    if (this.looping || !this.engine || this.error || typeof window === "undefined") return;
    this.ensureLoaded();
    if (this.nextBatch().length === 0) return;
    this.looping = true;
    this.emit();
    try {
      while (this.engine && !this.error) {
        const batch = this.nextBatch();
        if (batch.length === 0) break;
        const engine = this.engine;
        let estimator: Estimator;
        try {
          estimator = await (this.estimator ??= loadEstimator(engine));
        } catch {
          this.estimator = null;
          this.error = t("error.insightLoad");
          break;
        }
        for (const item of batch) this.attempted.add(item.key);
        try {
          const insights = await estimator.estimate(batch);
          // 기다리는 사이 AI나 키가 바뀌었으면 이 결과는 버린다
          if (engineId(engine) !== engineId(this.engine)) continue;
          const now = Date.now();
          this.store = { ...this.store };
          batch.forEach((item, i) => (this.store[item.key] = { at: now, insight: insights[i] ?? null, by: engine.provider }));
          this.scheduleSave();
        } catch (error) {
          for (const item of batch) this.attempted.delete(item.key);
          const info = estimator.describe(error);
          if (info.retryAfterSec) await sleep(info.retryAfterSec * 1000);
          else if (engineId(engine) === engineId(this.engine)) this.error = info.message;
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
