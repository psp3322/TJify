import { describe, expect, it } from "vitest";
import { channelToArtist, parseVideoTitle } from "./youtube-title";

describe("parseVideoTitle", () => {
  const cases: Array<[string, string | undefined, string, string[]]> = [
    ["Love wins all", "IU - Topic", "Love wins all", ["IU"]],
    ["[MV] IU(아이유) _ Love wins all", "1theK (원더케이)", "Love wins all", ["IU(아이유)"]],
    ["aespa 에스파 'Supernova' MV", "SMTOWN", "Supernova", ["aespa 에스파"]],
    ["BTS (방탄소년단) 'Dynamite' Official MV", "HYBE LABELS", "Dynamite", ["BTS (방탄소년단)"]],
    ["NewJeans (뉴진스) 'Ditto' Official MV (side A)", "HYBE LABELS", "Ditto", ["NewJeans (뉴진스)"]],
    ["Ed Sheeran - Shape of You (Official Music Video)", "Ed Sheeran", "Shape of You", ["Ed Sheeran"]],
    ["YOASOBI「アイドル」 Official Music Video", "Ayase / YOASOBI", "アイドル", ["YOASOBI"]],
    ["[Lyrics/가사] 잔나비 - 주저하는 연인들을 위해", "lyrics channel", "주저하는 연인들을 위해", ["잔나비"]],
    ["아이유 (IU) - 밤편지 (Through the Night) [가사/Lyrics]", undefined, "밤편지 (Through the Night)", ["아이유 (IU)"]],
    ["【MV】米津玄師 - Lemon", "米津玄師", "Lemon", ["米津玄師"]],
    ["성시경 - 거리에서 (Live)", undefined, "거리에서 (Live)", ["성시경"]],
    ["Don't Look Back in Anger", "Oasis", "Don't Look Back in Anger", ["Oasis"]],
    ["밤양갱 - Official Video", "비비 BIBI", "밤양갱", ["비비 BIBI"]],
    ["Audio", "LSD - Topic", "Audio", ["LSD"]],
    ["[MV] 이무진 - 신호등 MV", undefined, "신호등", ["이무진"]],
    ["밤편지 | 아이유 Official", "IU Official", "밤편지", ["IU"]],
  ];

  it.each(cases)("%s", (raw, channel, title, artists) => {
    expect(parseVideoTitle(raw, channel)).toEqual({ title, artists });
  });

  it("레이블 채널이면 가수를 비워 둔다", () => {
    expect(parseVideoTitle("Some Song", "SMTOWN")).toEqual({ title: "Some Song", artists: [] });
  });
});

describe("channelToArtist", () => {
  it("Topic·Official·VEVO 꼬리를 뗀다", () => {
    expect(channelToArtist("IU - Topic")).toBe("IU");
    expect(channelToArtist("IU Official")).toBe("IU");
    expect(channelToArtist("EdSheeranVEVO")).toBe("EdSheeran");
    expect(channelToArtist("HYBE LABELS")).toBeNull();
    expect(channelToArtist(undefined)).toBeNull();
  });
});
