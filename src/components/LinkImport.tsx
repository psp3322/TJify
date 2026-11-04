"use client";

import { useState } from "react";
import { forgetLink, linkHistoryStore } from "@/lib/client/stores";
import { useStoredValue } from "@/lib/client/stored-value";
import { useT } from "@/lib/i18n/react";
import { isPlaylistLink, LINK_ERROR_KEYS, parsePlaylistLink, type LinkErrorCode, type PlaylistLink } from "@/lib/playlist-link";
import type { SiteStatus } from "@/lib/types";
import { RichText } from "./RichText";

const SOURCE_LABEL = { spotify: "Spotify", youtube: "YouTube" } as const;
const SOURCE_DOT = { spotify: "bg-spotify", youtube: "bg-youtube" } as const;

interface Props {
  session: SiteStatus | null;
  onImport(link: PlaylistLink): void;
}

/** 플레이리스트 링크 입력창과 최근에 가져온 링크 */
export function LinkImport({ session, onImport }: Props) {
  const { t } = useT();
  const [text, setText] = useState("");
  const [error, setError] = useState<LinkErrorCode | null>(null);
  const history = useStoredValue(linkHistoryStore);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parsePlaylistLink(text);
    if (!parsed) return setError("unsupported");
    if (!isPlaylistLink(parsed)) return setError(parsed.error);
    setError(null);
    setText("");
    onImport(parsed);
  };

  // 방문자에게 보이는 안내라서 환경 변수 이름 같은 운영자용 말은 쓰지 않는다
  const youtubeNote = !session ? null : session.youtubeApiKey ? (
    t("link.youtubeWithKey")
  ) : session.google.connected ? (
    t("link.youtubeConnected")
  ) : (
    <RichText
      text={t("link.youtubeNeedKey", { connect: session.google.configured ? t("link.youtubeOrConnect") : "" })}
      link={(label) => (
        <a href="#settings" className="underline underline-offset-2 hover:text-ink">
          {label}
        </a>
      )}
    />
  );
  const spotifyNote = !session ? null : session.spotify.configured ? t("link.spotifyConfigured") : t("link.spotifyNoLogin");

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
          placeholder={t("link.placeholder")}
          aria-label={t("link.aria")}
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-muted"
        />
        <button type="submit" className="shrink-0 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-bg hover:brightness-95">
          {t("link.submit")}
        </button>
      </form>
      {error && <p className="text-sm text-danger">{t(LINK_ERROR_KEYS[error])}</p>}

      <ul className="space-y-1 text-xs text-muted">
        {youtubeNote && <li>{youtubeNote}</li>}
        {spotifyNote && <li>{spotifyNote}</li>}
      </ul>

      {history.length > 0 && (
        <div className="space-y-1.5 border-t border-line pt-3">
          <p className="text-xs text-muted">{t("link.recent")}</p>
          <ul className="flex flex-wrap gap-1.5">
            {history.map((h) => (
              <li key={`${h.source}:${h.id}`} className="flex items-center rounded-full border border-line bg-surface-2 text-sm">
                <button type="button" onClick={() => onImport(h)} className="flex max-w-56 items-center gap-1.5 py-1 pr-1 pl-3">
                  <span className={`size-1.5 shrink-0 rounded-full ${SOURCE_DOT[h.source]}`} aria-hidden />
                  <span className="truncate">{h.title ?? t("link.playlistOf", { source: SOURCE_LABEL[h.source] })}</span>
                </button>
                <button
                  type="button"
                  onClick={() => forgetLink(h)}
                  className="rounded-full px-2 py-1 text-muted hover:text-ink"
                  aria-label={t("link.forget", { title: h.title ?? t("link.playlist") })}
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
