"use client";

import { useSyncExternalStore } from "react";
import { loadJson, saveJson } from "./storage";

export interface StoredValue<T> {
  subscribe(listener: () => void): () => void;
  getSnapshot(): T;
  getServerSnapshot(): T;
  set(next: T | ((prev: T) => T)): void;
}

/**
 * localStorage에 저장되는 값. useSyncExternalStore로 구독해서
 * 서버 렌더링 때는 기본값을, 브라우저에서는 저장된 값을 쓴다.
 */
export function createStoredValue<T>(key: string, fallback: T, debounceMs = 0): StoredValue<T> {
  let cache: T | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();

  const read = (): T => {
    if (cache === undefined) cache = typeof window === "undefined" ? fallback : loadJson(key, fallback);
    return cache;
  };

  const persist = () => {
    if (debounceMs <= 0) return saveJson(key, cache);
    clearTimeout(timer);
    timer = setTimeout(() => saveJson(key, cache), debounceMs);
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      const onStorage = (e: StorageEvent) => {
        if (e.key !== key) return;
        cache = undefined;
        listener();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    getSnapshot: read,
    getServerSnapshot: () => fallback,
    set(next) {
      cache = typeof next === "function" ? (next as (prev: T) => T)(read()) : next;
      persist();
      for (const l of listeners) l();
    },
  };
}

export function useStoredValue<T>(store: StoredValue<T>): T {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
