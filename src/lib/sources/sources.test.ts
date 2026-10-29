import { describe, expect, it, vi } from "vitest";
import { normalizeSpotifyItems, normalizeSpotifyTrack, pickImage } from "./spotify";
import { fetchPlaylistItems, fetchPlaylistTitle, normalizeLikedVideo, normalizePlaylistItem } from "./youtube";

// Spotify·YouTube API 문서의 응답 모양을 따른 테스트용 객체 (실제 계정 데이터 아님)
const spotifyTrack = {
  id: "track123",
  name: "밤편지",
  type: "track",
  artists: [{ name: "IU" }],
  album: {
    name: "Palette",
    images: [
      { url: "https://i.scdn.co/640", width: 640 },
      { url: "https://i.scdn.co/300", width: 300 },
      { url: "https://i.scdn.co/64", width: 64 },
    ],
  },
  external_urls: { spotify: "https://open.spotify.com/track/track123" },
};

describe("Spotify 정규화", () => {
  it("곡 객체를 Track으로 바꾸고 64px 이상 중 가장 작은 이미지를 고른다", () => {
    expect(normalizeSpotifyTrack(spotifyTrack)).toEqual({
      id: "spotify:track123",
      source: "spotify",
      title: "밤편지",
      artists: ["IU"],
      album: "Palette",
      imageUrl: "https://i.scdn.co/64",
      url: "https://open.spotify.com/track/track123",
    });
    expect(pickImage([])).toBeUndefined();
  });

  it("로컬 파일·팟캐스트 에피소드는 뺀다", () => {
    expect(normalizeSpotifyTrack({ ...spotifyTrack, is_local: true })).toBeNull();
    expect(normalizeSpotifyTrack({ ...spotifyTrack, type: "episode" })).toBeNull();
    expect(normalizeSpotifyTrack({ ...spotifyTrack, id: null })).toBeNull();
  });

  it("2026년 개편 전후 형식(track / item)을 모두 읽는다", () => {
    const tracks = normalizeSpotifyItems([{ track: spotifyTrack }, { item: { ...spotifyTrack, id: "t2" } }, { item: null }]);
    expect(tracks.map((t) => t.id)).toEqual(["spotify:track123", "spotify:t2"]);
  });
});

describe("YouTube 정규화", () => {
  it("좋아요 영상 제목에서 가수·제목을 뽑고 음악 카테고리를 표시한다", () => {
    const track = normalizeLikedVideo({
      id: "vid1",
      snippet: {
        title: "[MV] IU(아이유) _ Love wins all",
        channelTitle: "1theK (원더케이)",
        categoryId: "10",
        thumbnails: { default: { url: "https://i.ytimg.com/vi/vid1/default.jpg" } },
      },
    });
    expect(track).toMatchObject({
      id: "youtube:vid1",
      title: "Love wins all",
      artists: ["IU(아이유)"],
      isMusic: true,
      url: "https://www.youtube.com/watch?v=vid1",
    });
  });

  it("음악이 아닌 영상은 isMusic=false, 삭제된 영상은 뺀다", () => {
    expect(normalizeLikedVideo({ id: "v2", snippet: { title: "브이로그", channelTitle: "누군가", categoryId: "22" } })?.isMusic).toBe(false);
    expect(normalizeLikedVideo({ id: "v3", snippet: { title: "Deleted video" } })).toBeNull();
  });

  it("재생목록 항목은 업로더 채널(videoOwnerChannelTitle)을 쓴다", () => {
    const track = normalizePlaylistItem({
      snippet: { title: "Supernova", videoOwnerChannelTitle: "aespa - Topic", resourceId: { videoId: "v9" } },
    });
    expect(track).toMatchObject({ id: "youtube:v9", title: "Supernova", artists: ["aespa"], isMusic: true });
    expect(normalizePlaylistItem({ snippet: { title: "Private video", resourceId: { videoId: "x" } } })).toBeNull();
  });
});

describe("YouTube 공개 재생목록 (API 키)", () => {
  const page = {
    items: [{ snippet: { title: "Supernova", videoOwnerChannelTitle: "aespa - Topic", resourceId: { videoId: "v1" } } }],
    nextPageToken: "NEXT",
    pageInfo: { totalResults: 120 },
  };

  it("API 키는 key 파라미터로 보내고 Authorization 헤더는 붙이지 않는다", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(page));
    const result = await fetchPlaylistItems({ key: "TEST_KEY" }, "PL123", null, fetchImpl);
    const [url, init] = fetchImpl.mock.calls[0];
    const sent = new URL(String(url));
    expect(sent.pathname).toBe("/youtube/v3/playlistItems");
    expect(sent.searchParams.get("key")).toBe("TEST_KEY");
    expect(sent.searchParams.get("playlistId")).toBe("PL123");
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);
    expect(result).toMatchObject({ next: "NEXT", total: 120, tracks: [{ id: "youtube:v1", title: "Supernova", artists: ["aespa"] }] });
  });

  it("로그인 토큰이면 Bearer 헤더로 보낸다", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(page));
    await fetchPlaylistItems("ACCESS", "PL123", "NEXT", fetchImpl);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(new URL(String(url)).searchParams.get("pageToken")).toBe("NEXT");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer ACCESS");
  });

  it("없는 재생목록·비공개·잘못된 키를 한국어로 알려 준다", async () => {
    const reply = (status: number, error: object) => vi.fn(async () => Response.json({ error }, { status })) as unknown as typeof fetch;
    await expect(fetchPlaylistItems({ key: "k" }, "PLx", null, reply(404, { errors: [{ reason: "playlistNotFound" }] }))).rejects.toMatchObject({
      status: 404,
      message: expect.stringContaining("찾을 수 없어요"),
    });
    await expect(fetchPlaylistItems({ key: "k" }, "PLx", null, reply(403, { errors: [{ reason: "playlistItemsNotAccessible" }] }))).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining("비공개"),
    });
    await expect(
      fetchPlaylistItems({ key: "k" }, "PLx", null, reply(400, { errors: [{ reason: "badRequest" }], details: [{ reason: "API_KEY_INVALID" }] })),
    ).rejects.toMatchObject({ status: 503, message: expect.stringContaining("YOUTUBE_API_KEY") });
  });

  it("제목을 못 가져오면 undefined", async () => {
    const ok = vi.fn(async () => Response.json({ items: [{ id: "PL1", snippet: { title: "노래방 18번" } }] })) as unknown as typeof fetch;
    const fail = vi.fn(async () => new Response("", { status: 500 })) as unknown as typeof fetch;
    await expect(fetchPlaylistTitle({ key: "k" }, "PL1", ok)).resolves.toBe("노래방 18번");
    await expect(fetchPlaylistTitle({ key: "k" }, "PL1", fail)).resolves.toBeUndefined();
  });
});
