import { describe, expect, it } from "vitest";
import { parsePlaylistLink } from "./playlist-link";

describe("parsePlaylistLink", () => {
  it.each([
    ["https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M", { source: "spotify", id: "37i9dQZF1DXcBWIGoYBM5M" }],
    ["https://open.spotify.com/intl-ko/playlist/5Rrf7mqN8uus2AaQQQNdc1?si=abc123", { source: "spotify", id: "5Rrf7mqN8uus2AaQQQNdc1" }],
    ["open.spotify.com/playlist/5Rrf7mqN8uus2AaQQQNdc1", { source: "spotify", id: "5Rrf7mqN8uus2AaQQQNdc1" }],
    ["spotify:playlist:5Rrf7mqN8uus2AaQQQNdc1", { source: "spotify", id: "5Rrf7mqN8uus2AaQQQNdc1" }],
    ["https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG", { source: "youtube", id: "PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG" }],
    ["https://music.youtube.com/playlist?list=OLAK5uy_kY2tWdgYgP0a1xJ2", { source: "youtube", id: "OLAK5uy_kY2tWdgYgP0a1xJ2" }],
    ["https://youtu.be/abcdefghijk?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG&si=xyz", { source: "youtube", id: "PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG" }],
    ["https://m.youtube.com/watch?v=abcdefghijk&list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG", { source: "youtube", id: "PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG" }],
    ["  PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG  ", { source: "youtube", id: "PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG" }],
  ])("%s", (input, expected) => {
    expect(parsePlaylistLink(input)).toEqual(expected);
  });

  it("지원하지 않는 주소는 이유를 알려 준다", () => {
    expect(parsePlaylistLink("https://spotify.link/AbCdEf")).toEqual({ error: "spotify_short_link" });
    expect(parsePlaylistLink("https://www.youtube.com/watch?v=abcdefghijk")).toEqual({ error: "youtube_no_list" });
    expect(parsePlaylistLink("https://open.spotify.com/album/1A2GTWGtFfWp7KSQTwWOyo")).toEqual({ error: "unsupported" });
    expect(parsePlaylistLink("https://www.melon.com/mymusic/playlist/123")).toEqual({ error: "unsupported" });
  });

  it("주소가 아닌 글자는 null", () => {
    expect(parsePlaylistLink("")).toBeNull();
    expect(parsePlaylistLink("아이유 - 밤편지")).toBeNull();
    expect(parsePlaylistLink("밤편지")).toBeNull();
    expect(parsePlaylistLink("https://open.spotify.com/playlist/abc def")).toBeNull();
  });
});
