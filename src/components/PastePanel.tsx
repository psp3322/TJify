"use client";

import { useState } from "react";
import { libraryStore } from "@/lib/client/library-store";
import { pasteStore, updatePrefs } from "@/lib/client/stores";
import { useT } from "@/lib/i18n/react";
import { isPlaylistLink, LINK_ERROR_KEYS, parsePlaylistLink, type LinkErrorCode, type PlaylistLink } from "@/lib/playlist-link";
import { parsePastedList, type PasteOrder } from "@/lib/text/paste-import";
import { RichText } from "./RichText";

interface Props {
  order: PasteOrder;
  savedText: string;
  count: number;
  /** 플레이리스트 링크 하나만 붙여넣었을 때 링크 가져오기로 넘긴다 */
  onLink(link: PlaylistLink): void;
}

/** 목록 붙여넣기. 멜론·지니 목록이나 Exportify CSV처럼 계정 연동 없이 쓰는 방법 */
export function PastePanel({ order, savedText, count, onLink }: Props) {
  const { t } = useT();
  const [text, setText] = useState(savedText);
  // 문구 대신 코드를 들고 있어서 언어를 바꾸면 오류 문구도 따라 바뀐다
  const [error, setError] = useState<LinkErrorCode | null>(null);

  const apply = () => {
    const link = parsePlaylistLink(text);
    if (link) {
      if (isPlaylistLink(link)) onLink(link);
      else setError(link.error);
      return;
    }
    setError(null);
    pasteStore.set(text);
    libraryStore.setStatic("paste", parsePastedList(text, order));
  };

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm text-muted">
        <RichText
          text={t("paste.help")}
          link={(label) => (
            <a href="https://exportify.net" target="_blank" rel="noreferrer" className="underline underline-offset-2">
              {label}
            </a>
          )}
        />
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={t("paste.placeholder")}
        className="w-full resize-y rounded-xl border border-line bg-surface-2 p-3 text-sm outline-none focus:border-muted"
        aria-label={t("paste.aria")}
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          {t("paste.order")}
          <select
            value={order}
            onChange={(e) => updatePrefs({ pasteOrder: e.target.value as PasteOrder })}
            className="rounded-lg border border-line bg-surface-2 px-2 py-1 text-ink"
          >
            <option value="artist-title">{t("paste.artistTitle")}</option>
            <option value="title-artist">{t("paste.titleArtist")}</option>
          </select>
        </label>
        <span className="flex-1" />
        {error && <span className="basis-full text-sm text-danger">{t(LINK_ERROR_KEYS[error])}</span>}
        {count > 0 && <span className="text-sm text-muted">{t("common.songs", { n: count })}</span>}
        <button type="button" onClick={apply} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-bg hover:brightness-95">
          {t("paste.submit")}
        </button>
      </div>
    </div>
  );
}
