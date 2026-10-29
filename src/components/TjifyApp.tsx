"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/hooks/useSession";
import { loginErrorMessage } from "@/lib/auth/errors";
import { apiPost } from "@/lib/client/api";
import { libraryStore, useLibrary } from "@/lib/client/library-store";
import { matchQueue, useMatchQueue } from "@/lib/client/match-queue";
import { hasNumber, resolveNumber, trackKey, type MatchStore, type OverrideStore } from "@/lib/client/match-store";
import {
  overridesStore,
  pasteStore,
  prefsStore,
  rememberLink,
  setLinkTitle,
  sungStore,
  updatePrefs,
  type BrandView,
  type SortMode,
} from "@/lib/client/stores";
import { useStoredValue } from "@/lib/client/stored-value";
import { MATCHER_VERSION } from "@/lib/constants";
import { canonicalLinkUrl, isPlaylistLink, parsePlaylistLink, type PlaylistLink } from "@/lib/playlist-link";
import { compact } from "@/lib/text/normalize";
import { parsePastedList } from "@/lib/text/paste-import";
import { BRANDS, type Brand, type Track } from "@/lib/types";
import { ConnectBar } from "./ConnectBar";
import { LinkImport } from "./LinkImport";
import { MatchProgress } from "./MatchProgress";
import { PastePanel } from "./PastePanel";
import { forgetPlaylists, PlaylistPicker, type PlaylistSelection } from "./PlaylistPicker";
import { RandomPick } from "./RandomPick";
import { TrackList } from "./TrackList";
import { TrackSheet } from "./TrackSheet";

type TabKey = "link" | "spotify" | "youtube" | "playlists" | "paste";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "link", label: "링크로 가져오기" },
  { key: "spotify", label: "Spotify 좋아요" },
  { key: "youtube", label: "YouTube 좋아요" },
  { key: "playlists", label: "내 플레이리스트" },
  { key: "paste", label: "붙여넣기" },
];

const RECENT_MS = 14 * 24 * 60 * 60 * 1000;

function sortTracks(tracks: Track[], mode: SortMode): Track[] {
  if (mode === "default") return tracks;
  const pick = mode === "title" ? (t: Track) => t.title : (t: Track) => t.artists[0] ?? "";
  return [...tracks].sort((a, b) => pick(a).localeCompare(pick(b), "ko"));
}

function availableIn(key: string, brands: Brand[], store: MatchStore, overrides: OverrideStore) {
  return brands.some((b) => hasNumber(resolveNumber(key, b, store, overrides)));
}

export default function TjifyApp() {
  const session = useSession();
  const prefs = useStoredValue(prefsStore);
  const overrides = useStoredValue(overridesStore);
  const sung = useStoredValue(sungStore);
  const pasteText = useStoredValue(pasteStore);
  const queue = useMatchQueue();
  const params = useSearchParams();
  const router = useRouter();

  const [tabChoice, setTabChoice] = useState<TabKey | null>(null);
  const [playlist, setPlaylist] = useState<PlaylistSelection | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Track | null>(null);
  const [random, setRandom] = useState<{ track: Track | null; pool: number } | null>(null);

  const s = session.data;
  const connected = { spotify: Boolean(s?.spotify.connected), youtube: Boolean(s?.google.connected) };
  const justConnected = params.get("connected");
  // 링크로 연 목록은 주소(?import=)에 남겨서 새로고침하거나 공유해도 같은 목록이 열리게 한다
  const importParam = params.get("import");
  const activeLink = useMemo(() => {
    const parsed = importParam ? parsePlaylistLink(importParam) : null;
    return isPlaylistLink(parsed) ? parsed : null;
  }, [importParam]);
  const tab: TabKey =
    tabChoice ??
    (activeLink
      ? "link"
      : justConnected === "google"
        ? "youtube"
        : justConnected === "spotify" || connected.spotify
          ? "spotify"
          : connected.youtube
            ? "youtube"
            : "link");

  // 서버에서 켜진 브랜드는 항상 같이 찾고, 화면에는 고른 브랜드만 보여 준다
  const brands = useMemo<Brand[]>(() => (s ? BRANDS.filter((b) => s.brands[b]) : []), [s]);
  const viewBrands = prefs.brandView === "both" ? brands : brands.filter((b) => b === prefs.brandView);

  let libKey: string | null;
  if (tab === "link") libKey = activeLink ? `link:${activeLink.source}:${activeLink.id}` : null;
  else if (tab === "spotify") libKey = connected.spotify ? "spotify:liked" : null;
  else if (tab === "youtube") libKey = connected.youtube ? "youtube:liked" : null;
  else if (tab === "playlists") libKey = playlist ? `${playlist.source}:playlist:${playlist.id}` : null;
  else libKey = "paste";
  const library = useLibrary(libKey);

  useEffect(() => {
    if (libKey && libKey !== "paste") void libraryStore.load(libKey);
  }, [libKey]);

  // 링크 기록에 플레이리스트 제목을 채워 둔다
  useEffect(() => {
    if (activeLink && library.title) setLinkTitle(activeLink, library.title);
  }, [activeLink, library.title]);

  const openLink = (link: PlaylistLink) => {
    rememberLink(link, Date.now());
    setTabChoice("link");
    router.replace(`/?import=${encodeURIComponent(canonicalLinkUrl(link))}`, { scroll: false });
  };

  // 저장해 둔 붙여넣기 목록 복원
  useEffect(() => {
    if (tab === "paste" && pasteText && libraryStore.get("paste").status === "idle") {
      libraryStore.setStatic("paste", parsePastedList(pasteText, prefs.pasteOrder));
    }
  }, [tab, pasteText, prefs.pasteOrder]);

  const baseTracks = useMemo(() => {
    let list = library.tracks;
    if (libKey?.startsWith("youtube") && prefs.musicOnly) list = list.filter((t) => t.isMusic !== false);
    return sortTracks(list, prefs.sort);
  }, [library.tracks, libKey, prefs.musicOnly, prefs.sort]);

  useEffect(() => {
    matchQueue.setWork(baseTracks, brands);
  }, [baseTracks, brands]);

  const rows = useMemo(() => {
    const q = compact(query);
    return baseTracks.filter((t) => {
      if (q && !compact(`${t.title} ${t.artists.join(" ")}`).includes(q)) return false;
      if (prefs.onlyAvailable && !availableIn(trackKey(t), viewBrands, queue.store, overrides)) return false;
      return true;
    });
  }, [baseTracks, query, prefs.onlyAvailable, viewBrands, queue.store, overrides]);

  const progress = useMemo(() => {
    const keys = new Set(baseTracks.map(trackKey));
    let done = 0;
    let failed = 0;
    for (const k of keys) {
      const e = queue.store[k];
      if (!e || e.v !== MATCHER_VERSION || !brands.every((b) => e[b])) continue;
      done++;
      if (brands.some((b) => e[b]?.error && !e[b]?.best)) failed++;
    }
    return { done, failed, total: keys.size };
  }, [baseTracks, queue.store, brands]);

  const pickRandom = () => {
    const now = Date.now();
    const pool = baseTracks.filter((t) => {
      const key = trackKey(t);
      const recentlySung = (sung[key] ?? []).some((at) => now - at < RECENT_MS);
      return !recentlySung && availableIn(key, viewBrands, queue.store, overrides);
    });
    setRandom({ track: pool.length ? pool[Math.floor(Math.random() * pool.length)] : null, pool: pool.length });
  };

  const disconnect = async (provider: "spotify" | "google") => {
    await apiPost(`/api/auth/${provider}/logout`).catch(() => undefined);
    libraryStore.forget(provider === "spotify" ? "spotify:" : "youtube:");
    forgetPlaylists(provider === "spotify" ? "spotify" : "youtube");
    if (playlist && (playlist.source === "spotify") === (provider === "spotify")) setPlaylist(null);
    session.refresh();
  };

  const loginError = loginErrorMessage(params.get("error"));
  const providerName = (p: string | null) => (p === "spotify" ? "Spotify" : "YouTube");
  const notice = loginError
    ? { tone: "error" as const, text: `${providerName(params.get("provider"))}: ${loginError}` }
    : justConnected
      ? { tone: "ok" as const, text: `${providerName(justConnected)} 계정을 연결했어요.` }
      : null;

  const anyConnected = connected.spotify || connected.youtube;
  const showList = libKey !== null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-5 px-4 pt-6 pb-16">
      <header className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-black tracking-tight">
            TJify<span className="text-accent">.</span>
          </h1>
          <p className="text-sm text-muted">내 플레이리스트를 노래방 번호로</p>
        </div>
        <BrandToggle value={prefs.brandView} brands={brands} onChange={(brandView) => updatePrefs({ brandView })} />
      </header>

      {notice && (
        <div
          role="status"
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            notice.tone === "error" ? "border-danger/40 bg-danger/10" : "border-ok/40 bg-ok/10"
          }`}
        >
          <span className="flex-1">{notice.text}</span>
          <button
            type="button"
            onClick={() => {
              // 주소의 connected 값이 사라져도 지금 보던 탭과 열어 둔 링크는 유지한다
              setTabChoice(tab);
              router.replace(importParam ? `/?import=${encodeURIComponent(importParam)}` : "/", { scroll: false });
            }}
            className="text-muted hover:text-ink"
            aria-label="알림 닫기"
          >
            ×
          </button>
        </div>
      )}

      {session.error && <p className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm">서버 상태를 확인하지 못했어요: {session.error}</p>}
      {s && !s.sessionSecretOk && (
        <p className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm">
          서버에 <code>SESSION_SECRET</code>이 없어서 계정 연결을 쓸 수 없어요. README의 설정 방법을 따라 환경 변수를 넣어 주세요. 붙여넣기와 YouTube 링크 가져오기는 지금도 됩니다.
        </p>
      )}

      <ConnectBar session={s} onDisconnect={disconnect} />

      <nav aria-label="목록 고르기">
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTabChoice(t.key)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                tab === t.key ? "bg-ink font-semibold text-bg" : "text-muted hover:bg-surface hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex flex-col gap-4">
        {tab === "link" && (
          <>
            {!activeLink && !anyConnected && (
              <p className="text-lg font-bold leading-snug">
                플레이리스트 링크만 넣으면
                <br />
                노래방 번호를 찾아 드려요.
              </p>
            )}
            <LinkImport session={s} onImport={openLink} />
            {activeLink && (
              <LinkHeader
                link={activeLink}
                title={library.title}
                onReload={() => libKey && libraryStore.load(libKey, true)}
                loading={library.status === "loading"}
                failed={library.status === "error"}
              />
            )}
          </>
        )}
        {tab === "spotify" && !connected.spotify && (
          <ConnectPrompt provider="spotify" configured={s?.spotify.configured} loading={!s} anyConnected={anyConnected} onLink={() => setTabChoice("link")} />
        )}
        {tab === "youtube" && !connected.youtube && (
          <ConnectPrompt provider="google" configured={s?.google.configured} loading={!s} anyConnected={anyConnected} onLink={() => setTabChoice("link")} />
        )}
        {tab === "playlists" &&
          (playlist ? (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPlaylist(null)} className="rounded-full border border-line px-3 py-1 text-sm text-muted hover:text-ink">
                ← 목록
              </button>
              <h2 className="truncate font-semibold">{playlist.name}</h2>
            </div>
          ) : (
            <PlaylistPicker connected={connected} onSelect={setPlaylist} />
          ))}
        {tab === "paste" && (
          <PastePanel key={pasteText ? "saved" : "empty"} order={prefs.pasteOrder} savedText={pasteText} count={library.tracks.length} onLink={openLink} />
        )}

        {showList && (
          <>
            {(library.tracks.length > 0 || library.status === "loading") && (
              <Toolbar
                query={query}
                onQuery={setQuery}
                onlyAvailable={prefs.onlyAvailable}
                musicOnly={prefs.musicOnly}
                sort={prefs.sort}
                showMusicFilter={Boolean(libKey?.startsWith("youtube"))}
                onRandom={pickRandom}
              />
            )}
            <LibraryStatus status={library.status} loaded={library.tracks.length} total={library.total} error={library.error} onRetry={() => libKey && libraryStore.load(libKey, true)} />
            <MatchProgress done={progress.done} failed={progress.failed} total={progress.total} running={queue.running} error={queue.error} />
            {rows.length === 0 && library.status === "done" && (
              <p className="py-10 text-center text-muted">{baseTracks.length === 0 ? "곡이 없어요." : "조건에 맞는 곡이 없어요."}</p>
            )}
            <TrackList
              key={`${libKey}|${query}|${prefs.sort}|${prefs.onlyAvailable}`}
              tracks={rows}
              brands={viewBrands}
              store={queue.store}
              overrides={overrides}
              sung={sung}
              onSelect={setSelected}
            />
          </>
        )}
      </main>

      <footer className="mt-auto border-t border-line pt-4 text-xs leading-relaxed text-muted">
        번호는 TJ미디어 공식 반주곡 검색과 Manana 노래방 API(금영)에서 찾아요. 노래방 기기 모델이나 업데이트 시점에 따라 실제 번호와 다를 수 있어요. TJ미디어·금영과는 관계없는 개인 프로젝트입니다.{" "}
        <a href="https://github.com/psp3322/TJify" target="_blank" rel="noreferrer" className="underline underline-offset-2">
          GitHub
        </a>
      </footer>

      {selected && (
        <TrackSheet track={selected} brands={viewBrands} store={queue.store} overrides={overrides} sung={sung} onClose={() => setSelected(null)} />
      )}
      {random && (
        <RandomPick
          track={random.track}
          poolSize={random.pool}
          brands={viewBrands}
          store={queue.store}
          overrides={overrides}
          onReroll={pickRandom}
          onClose={() => setRandom(null)}
        />
      )}
    </div>
  );
}

function BrandToggle({ value, brands, onChange }: { value: BrandView; brands: Brand[]; onChange(v: BrandView): void }) {
  if (brands.length < 2) return null;
  const options: Array<{ v: BrandView; label: string }> = [
    { v: "both", label: "둘 다" },
    { v: "tj", label: "TJ" },
    { v: "ky", label: "금영" },
  ];
  return (
    <div className="flex rounded-full border border-line p-0.5 text-sm" role="radiogroup" aria-label="노래방 브랜드">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-full px-3 py-1 ${value === o.v ? "bg-surface-2 font-semibold" : "text-muted hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toolbar(props: {
  query: string;
  onQuery(q: string): void;
  onlyAvailable: boolean;
  musicOnly: boolean;
  sort: SortMode;
  showMusicFilter: boolean;
  onRandom(): void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="search"
          value={props.query}
          onChange={(e) => props.onQuery(e.target.value)}
          placeholder="제목·가수로 찾기"
          aria-label="목록에서 찾기"
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-muted"
        />
        <button type="button" onClick={props.onRandom} className="shrink-0 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-black hover:brightness-110">
          🎲 뭐 부르지?
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={props.onlyAvailable} onChange={(e) => updatePrefs({ onlyAvailable: e.target.checked })} className="accent-accent" />
          번호 있는 곡만
        </label>
        {props.showMusicFilter && (
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={props.musicOnly} onChange={(e) => updatePrefs({ musicOnly: e.target.checked })} className="accent-accent" />
            음악 영상만
          </label>
        )}
        <label className="ml-auto flex items-center gap-1.5">
          정렬
          <select
            value={props.sort}
            onChange={(e) => updatePrefs({ sort: e.target.value as SortMode })}
            className="rounded-lg border border-line bg-surface px-2 py-1 text-ink"
          >
            <option value="default">추가한 순서</option>
            <option value="title">제목</option>
            <option value="artist">가수</option>
          </select>
        </label>
      </div>
    </div>
  );
}

function LibraryStatus({
  status,
  loaded,
  total,
  error,
  onRetry,
}: {
  status: "idle" | "loading" | "done" | "error";
  loaded: number;
  total?: number;
  error?: string;
  onRetry(): void;
}) {
  if (status === "loading") {
    return (
      <p className="text-xs text-muted">
        곡 목록 불러오는 중… {loaded}
        {total ? ` / ${total}` : ""}
      </p>
    );
  }
  if (status === "error") {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
        <span className="flex-1">{error}</span>
        <button type="button" onClick={onRetry} className="rounded-full border border-line px-3 py-1 hover:bg-surface-2">
          다시 불러오기
        </button>
      </div>
    );
  }
  return null;
}

const LINK_SOURCE_LABEL = { spotify: "Spotify", youtube: "YouTube" } as const;

/** 링크로 연 플레이리스트의 제목줄 */
function LinkHeader({
  link,
  title,
  loading,
  failed,
  onReload,
}: {
  link: PlaylistLink;
  title?: string;
  loading: boolean;
  failed: boolean;
  onReload(): void;
}) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?import=${encodeURIComponent(canonicalLinkUrl(link))}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 권한이 없으면 조용히 넘어간다
    }
  };
  return (
    <div className="space-y-2">
      <div className="min-w-0">
        <p className="text-xs text-muted">{LINK_SOURCE_LABEL[link.source]} 플레이리스트</p>
        <h2 className="truncate text-lg font-semibold">{title ?? (loading ? "불러오는 중…" : failed ? "불러오지 못했어요" : "제목 없음")}</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={canonicalLinkUrl(link)}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-line px-3 py-1 text-sm text-muted hover:text-ink"
        >
          원본 열기 ↗
        </a>
        {link.source === "youtube" && (
          <button type="button" onClick={share} className="rounded-full border border-line px-3 py-1 text-sm text-muted hover:text-ink">
            {copied ? "주소 복사됨" : "이 목록 공유"}
          </button>
        )}
        <button
          type="button"
          onClick={onReload}
          disabled={loading}
          className="rounded-full border border-line px-3 py-1 text-sm text-muted hover:text-ink disabled:opacity-50"
        >
          새로 불러오기
        </button>
      </div>
    </div>
  );
}

function ConnectPrompt({
  provider,
  configured,
  loading,
  anyConnected,
  onLink,
}: {
  provider: "spotify" | "google";
  configured?: boolean;
  loading: boolean;
  anyConnected: boolean;
  onLink(): void;
}) {
  const isSpotify = provider === "spotify";
  const name = isSpotify ? "Spotify" : "YouTube";
  return (
    <div className="rounded-2xl border border-line bg-surface px-5 py-8 text-center">
      {!anyConnected && (
        <p className="mb-2 text-lg font-bold">
          좋아요 누른 노래, 노래방에선 몇 번일까?
        </p>
      )}
      <p className="text-sm text-muted">
        {isSpotify ? "Spotify의 좋아요 표시한 곡" : "YouTube·YouTube Music에서 좋아요 누른 영상"}을 불러와 TJ·금영 번호를 찾아 드려요.
      </p>
      <div className="mt-5 flex flex-col items-center gap-3">
        {loading ? (
          <span className="h-11 w-48 animate-pulse rounded-full bg-surface-2" aria-hidden />
        ) : configured ? (
          <a
            href={`/api/auth/${provider}/login`}
            className={`rounded-full px-6 py-3 font-semibold text-black hover:brightness-110 ${isSpotify ? "bg-spotify" : "bg-youtube text-white"}`}
          >
            {name} 연결하기
          </a>
        ) : (
          <p className="text-sm text-warn">서버에 {name} 연동 설정이 아직 없어요 (README 참고).</p>
        )}
        <button type="button" onClick={onLink} className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
          연결 없이 플레이리스트 링크로 가져오기
        </button>
      </div>
      <p className="mt-5 text-xs text-muted/80">읽기 권한만 요청하고, 로그인 정보는 이 브라우저의 암호화된 쿠키에만 남아요.</p>
    </div>
  );
}
