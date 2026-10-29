"use client";

import { useState } from "react";
import { libraryStore } from "@/lib/client/library-store";
import { pasteStore, updatePrefs } from "@/lib/client/stores";
import { isPlaylistLink, LINK_ERRORS, parsePlaylistLink, type PlaylistLink } from "@/lib/playlist-link";
import { parsePastedList, type PasteOrder } from "@/lib/text/paste-import";

const PLACEHOLDER = `아이유 - 밤편지
잔나비 - 주저하는 연인들을 위해
NewJeans - Hype Boy`;

interface Props {
  order: PasteOrder;
  savedText: string;
  count: number;
  /** 플레이리스트 링크 하나만 붙여넣었을 때 링크 가져오기로 넘긴다 */
  onLink(link: PlaylistLink): void;
}

/** 목록 붙여넣기. 멜론·지니 목록이나 Exportify CSV처럼 계정 연동 없이 쓰는 방법 */
export function PastePanel({ order, savedText, count, onLink }: Props) {
  const [text, setText] = useState(savedText);
  const [error, setError] = useState<string | null>(null);

  const apply = () => {
    const link = parsePlaylistLink(text);
    if (link) {
      if (isPlaylistLink(link)) onLink(link);
      else setError(LINK_ERRORS[link.error]);
      return;
    }
    setError(null);
    pasteStore.set(text);
    libraryStore.setStatic("paste", parsePastedList(text, order));
  };

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm text-muted">
        한 줄에 한 곡씩 붙여넣으세요. Spotify 목록은{" "}
        <a href="https://exportify.net" target="_blank" rel="noreferrer" className="underline underline-offset-2">
          Exportify
        </a>
        로 받은 CSV를 그대로 넣어도 됩니다.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={PLACEHOLDER}
        className="w-full resize-y rounded-xl border border-line bg-surface-2 p-3 text-sm outline-none focus:border-muted"
        aria-label="곡 목록"
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          순서
          <select
            value={order}
            onChange={(e) => updatePrefs({ pasteOrder: e.target.value as PasteOrder })}
            className="rounded-lg border border-line bg-surface-2 px-2 py-1 text-ink"
          >
            <option value="artist-title">가수 - 제목</option>
            <option value="title-artist">제목 - 가수</option>
          </select>
        </label>
        <span className="flex-1" />
        {error && <span className="basis-full text-sm text-danger">{error}</span>}
        {count > 0 && <span className="text-sm text-muted">{count}곡</span>}
        <button type="button" onClick={apply} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-bg hover:brightness-95">
          번호 찾기
        </button>
      </div>
    </div>
  );
}
