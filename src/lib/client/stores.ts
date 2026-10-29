"use client";

import type { PlaylistLink } from "@/lib/playlist-link";
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

export interface LinkHistoryEntry extends PlaylistLink {
  title?: string;
  at: number;
}

/** 최근에 가져온 플레이리스트 링크 (최대 8개) */
export const linkHistoryStore = createStoredValue<LinkHistoryEntry[]>(STORAGE_KEYS.links, []);

export function rememberLink(link: PlaylistLink, at: number, title?: string) {
  linkHistoryStore.set((prev) => {
    const old = prev.find((e) => e.source === link.source && e.id === link.id);
    const rest = prev.filter((e) => e !== old);
    return [{ source: link.source, id: link.id, title: title ?? old?.title, at }, ...rest].slice(0, 8);
  });
}

export function setLinkTitle(link: PlaylistLink, title: string) {
  linkHistoryStore.set((prev) => {
    if (!prev.some((e) => e.source === link.source && e.id === link.id && e.title !== title)) return prev;
    return prev.map((e) => (e.source === link.source && e.id === link.id ? { ...e, title } : e));
  });
}

export function forgetLink(link: PlaylistLink) {
  linkHistoryStore.set((prev) => prev.filter((e) => !(e.source === link.source && e.id === link.id)));
}

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
