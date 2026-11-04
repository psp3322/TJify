"use client";

import { PUBLIC_CONFIG } from "@/lib/config";
import { STORAGE_KEYS } from "./storage";
import { createStoredValue } from "./stored-value";

/** 방문자가 직접 넣는 API 키. 이 브라우저(localStorage)에만 저장되고 다른 곳으로는 보내지 않는다 */
export interface UserSettings {
  /** 사이트에 넣어 둔 키가 없거나 할당량이 바닥났을 때 쓰는 내 YouTube Data API 키 */
  youtubeApiKey?: string;
  /** 곡 난이도·대중성 추정에 쓰는 내 Anthropic API 키 */
  anthropicApiKey?: string;
  anthropicModel?: string;
}

export const settingsStore = createStoredValue<UserSettings>(STORAGE_KEYS.settings, {});

export function updateSettings(patch: Partial<UserSettings>) {
  settingsStore.set((prev) => {
    const next: UserSettings = { ...prev, ...patch };
    for (const k of Object.keys(next) as Array<keyof UserSettings>) if (!next[k]?.trim()) delete next[k];
    return next;
  });
}

/** 공개 재생목록을 읽을 YouTube API 키: 내가 넣은 키가 있으면 그것, 없으면 사이트에 넣어 둔 키 */
export function youtubeApiKey(settings: UserSettings = settingsStore.getSnapshot()): string {
  return settings.youtubeApiKey?.trim() || PUBLIC_CONFIG.youtubeApiKey;
}

export function anthropicApiKey(settings: UserSettings = settingsStore.getSnapshot()): string {
  return settings.anthropicApiKey?.trim() ?? "";
}
