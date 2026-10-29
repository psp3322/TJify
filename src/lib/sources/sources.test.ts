import { describe, expect, it } from "vitest";
import { normalizeSpotifyItems, normalizeSpotifyTrack, pickImage } from "./spotify";
import { normalizeLikedVideo, normalizePlaylistItem } from "./youtube";

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
