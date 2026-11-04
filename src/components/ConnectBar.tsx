"use client";

import { startLogin } from "@/lib/client/auth";
import type { ProviderStatus, SiteStatus } from "@/lib/types";

interface Props {
  session: SiteStatus | null;
  onDisconnect(provider: "spotify" | "google"): void;
}

/** 상단의 계정 연결 상태. 이 사이트에 연결 설정이 들어 있는 서비스만 보여 준다 */
export function ConnectBar({ session, onDisconnect }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {session?.spotify.configured && (
        <ConnectChip provider="spotify" label="Spotify" dot="bg-spotify" status={session.spotify} onDisconnect={onDisconnect} />
      )}
      {session?.google.configured && (
        <ConnectChip provider="google" label="YouTube" dot="bg-youtube" status={session.google} onDisconnect={onDisconnect} />
      )}
    </div>
  );
}

function ConnectChip({
  provider,
  label,
  dot,
  status,
  onDisconnect,
}: {
  provider: "spotify" | "google";
  label: string;
  dot: string;
  status?: ProviderStatus;
  onDisconnect(provider: "spotify" | "google"): void;
}) {
  if (!status) {
    return <span className="h-9 w-36 animate-pulse rounded-full bg-surface" aria-hidden />;
  }
  if (status.connected) {
    return (
      <span className="flex items-center gap-2 rounded-full border border-line bg-surface py-1.5 pr-1.5 pl-3 text-sm">
        <span className={`size-2 rounded-full ${dot}`} aria-hidden />
        <span className="max-w-40 truncate">
          {label}
          {status.displayName ? ` · ${status.displayName}` : ""}
        </span>
        <button
          type="button"
          onClick={() => onDisconnect(provider)}
          className="rounded-full px-2 py-0.5 text-xs text-muted hover:bg-surface-2 hover:text-ink"
        >
          해제
        </button>
      </span>
    );
  }
  if (!status.configured) return null;
  return (
    <button
      type="button"
      onClick={() => void startLogin(provider)}
      className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm hover:bg-surface-2"
    >
      <span className={`size-2 rounded-full ${dot} opacity-50`} aria-hidden />
      {label} 연결
    </button>
  );
}
