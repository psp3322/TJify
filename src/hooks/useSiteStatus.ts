"use client";

import { useSyncExternalStore } from "react";
import { isConfigured, tokenStores } from "@/lib/client/auth";
import { insightEngine, settingsStore, youtubeApiKey } from "@/lib/client/settings";
import { useStoredValue } from "@/lib/client/stored-value";
import type { SiteStatus } from "@/lib/types";

const subscribeNothing = () => () => {};

/** 정적 HTML과 첫 화면을 맞추려고, 브라우저에서 화면이 살아나기 전까지는 false */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

/** 어떤 계정이 연결돼 있고 어떤 키가 있는지. 화면이 살아나기 전에는 null */
export function useSiteStatus(): SiteStatus | null {
  const hydrated = useHydrated();
  const spotify = useStoredValue(tokenStores.spotify);
  const google = useStoredValue(tokenStores.google);
  const settings = useStoredValue(settingsStore);
  if (!hydrated) return null;
  return {
    spotify: { configured: isConfigured("spotify"), connected: Boolean(spotify), ...(spotify?.displayName ? { displayName: spotify.displayName } : {}) },
    google: { configured: isConfigured("google"), connected: Boolean(google), ...(google?.displayName ? { displayName: google.displayName } : {}) },
    youtubeApiKey: Boolean(youtubeApiKey(settings)),
    ai: insightEngine(settings) !== null,
  };
}
