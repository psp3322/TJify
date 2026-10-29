"use client";

import type { PasteOrder } from "@/lib/text/paste-import";
import type { Brand, KaraokeSong } from "@/lib/types";
import type { OverrideStore } from "./match-store";
import { STORAGE_KEYS } from "./storage";
import { createStoredValue } from "./stored-value";

export type BrandView = "both" | Brand;
export type SortMode = "default" | "title" | "artist";

export interface Prefs {
  brandView: BrandView;
  onlyAvailable: boolean;
  musicOnly: boolean;
  sort: SortMode;
  pasteOrder: PasteOrder;
}

export const DEFAULT_PREFS: Prefs = {
  brandView: "both",
  onlyAvailable: false,
  musicOnly: true,
  sort: "default",
  pasteOrder: "artist-title",
};

export const prefsStore = createStoredValue<Prefs>(STORAGE_KEYS.prefs, DEFAULT_PREFS);
export const overridesStore = createStoredValue<OverrideStore>(STORAGE_KEYS.overrides, {});
/** 곡 키 → 부른 시각 목록 (epoch ms, 최근 20개) */
export const sungStore = createStoredValue<Record<string, number[]>>(STORAGE_KEYS.sung, {});
export const pasteStore = createStoredValue<string>(STORAGE_KEYS.paste, "");

export function setOverride(key: string, brand: Brand, song: KaraokeSong | null | undefined) {
  overridesStore.set((prev) => {
    const entry = { ...(prev[key] ?? {}) };
    if (song === undefined) delete entry[brand];
    else entry[brand] = song;
    const next = { ...prev };
    if (Object.keys(entry).length === 0) delete next[key];
    else next[key] = entry;
    return next;
  });
}

export function markSung(key: string, at: number) {
  sungStore.set((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), at].slice(-20) }));
}

export function clearSung(key: string) {
  sungStore.set((prev) => {
    const next = { ...prev };
    delete next[key];
    return next;
  });
}

export function updatePrefs(patch: Partial<Prefs>) {
  prefsStore.set((prev) => ({ ...DEFAULT_PREFS, ...prev, ...patch }));
}
