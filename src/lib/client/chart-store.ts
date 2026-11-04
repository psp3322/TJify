"use client";

import { useSyncExternalStore } from "react";
import { assetUrl } from "@/lib/config";
import type { ChartIndex } from "@/lib/karaoke/tj-chart";
import { loadJson, saveJson, STORAGE_KEYS } from "./storage";

const TTL = 12 * 60 * 60 * 1000;

let chart: ChartIndex | null = null;
let requested = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/**
 * 사이트를 빌드할 때 받아 둔 TJ 인기차트(/data/tj-chart.json)를 한 번만 읽는다 (브라우저에 12시간 보관).
 * 파일이 없거나 비어 있으면 차트 정보 없이 넘어간다.
 */
function ensure() {
  if (requested || typeof window === "undefined") return;
  requested = true;
  const saved = loadJson<{ at: number; index: ChartIndex } | null>(STORAGE_KEYS.chart, null);
  if (saved && Date.now() - saved.at < TTL) {
    chart = saved.index;
    emit();
    return;
  }
  fetch(assetUrl("/data/tj-chart.json"))
    .then((res) => (res.ok ? (res.json() as Promise<ChartIndex>) : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then(
      (index) => {
        chart = index;
        saveJson(STORAGE_KEYS.chart, { at: Date.now(), index });
        emit();
      },
      () => {
        if (saved) {
          chart = saved.index;
          emit();
        }
      },
    );
}

const store = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    ensure();
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => chart,
  getServerSnapshot: () => null,
};

export function useTjChart(): ChartIndex | null {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
