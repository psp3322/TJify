"use client";

import { useState } from "react";
import { forgetLink, linkHistoryStore } from "@/lib/client/stores";
import { useStoredValue } from "@/lib/client/stored-value";
import { isPlaylistLink, LINK_ERRORS, parsePlaylistLink, type PlaylistLink } from "@/lib/playlist-link";
import type { SessionStatus } from "@/lib/types";

const SOURCE_LABEL = { spotify: "Spotify", youtube: "YouTube" } as const;
const SOURCE_DOT = { spotify: "bg-spotify", youtube: "bg-youtube" } as const;

interface Props {
  session: SessionStatus | null;
  onImport(link: PlaylistLink): void;
}

/** 플레이리스트 링크 입력창과 최근에 가져온 링크 */
export function LinkImport({ session, onImport }: Props) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const history = useStoredValue(linkHistoryStore);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parsePlaylistLink(text);
    if (!parsed) return setError(LINK_ERRORS.unsupported);
    if (!isPlaylistLink(parsed)) return setError(LINK_ERRORS[parsed.error]);
    setError(null);
    setText("");
    onImport(parsed);
  };

  // 방문자에게 보이는 안내라서 환경 변수 이름 같은 운영자용 말은 쓰지 않는다
  const youtubeNote = !session
    ? null
    : session.youtubeApiKey
      ? "YouTube·YouTube Music 공개 재생목록은 로그인 없이 가져와요."
      : session.google.connected
        ? "YouTube 재생목록은 연결한 계정으로 가져와요."
        : session.google.configured
          ? "YouTube 재생목록을 가져오려면 위에서 YouTube를 연결해 주세요."
          : "이 사이트는 아직 YouTube 링크를 읽을 준비가 안 됐어요. 곡 목록은 붙여넣기로 넣어 주세요.";
  const spotifyNote = !session
    ? null
    : session.spotify.configured
      ? "Spotify 플레이리스트는 Spotify를 연결한 계정이 만들었거나 공동 작업 중인 것만 가져올 수 있어요 (Spotify 정책)."
      : "Spotify 플레이리스트는 Spotify 정책상 로그인 없이 읽을 수 없어요. 곡 목록을 붙여넣기로 넣어 주세요.";

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <form onSubmit={submit} className="flex gap-2">
        <input
          // type="url"이면 브라우저가 spotify:playlist:… 나 주소 없는 ID를 막아서 text로 둔다
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
          }}
          placeholder="플레이리스트 링크 붙여넣기"
          aria-label="플레이리스트 링크"
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-muted"
        />
        <button type="submit" className="shrink-0 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-bg hover:brightness-95">
          가져오기
        </button>
      </form>
      {error && <p className="text-sm text-danger">{error}</p>}

      <ul className="space-y-1 text-xs text-muted">
        {youtubeNote && <li>{youtubeNote}</li>}
        {spotifyNote && <li>{spotifyNote}</li>}
      </ul>

      {history.length > 0 && (
        <div className="space-y-1.5 border-t border-line pt-3">
          <p className="text-xs text-muted">최근에 가져온 링크</p>
          <ul className="flex flex-wrap gap-1.5">
            {history.map((h) => (
              <li key={`${h.source}:${h.id}`} className="flex items-center rounded-full border border-line bg-surface-2 text-sm">
                <button type="button" onClick={() => onImport(h)} className="flex max-w-56 items-center gap-1.5 py-1 pr-1 pl-3">
                  <span className={`size-1.5 shrink-0 rounded-full ${SOURCE_DOT[h.source]}`} aria-hidden />
                  <span className="truncate">{h.title ?? `${SOURCE_LABEL[h.source]} 플레이리스트`}</span>
                </button>
                <button
                  type="button"
                  onClick={() => forgetLink(h)}
                  className="rounded-full px-2 py-1 text-muted hover:text-ink"
                  aria-label={`${h.title ?? "플레이리스트"} 기록 지우기`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
