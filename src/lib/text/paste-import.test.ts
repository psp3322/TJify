import { describe, expect, it } from "vitest";
import { parseCsv, parsePastedList } from "./paste-import";

describe("parsePastedList", () => {
  it("'가수 - 제목' 줄을 읽고 번호·글머리표·주석·빈 줄을 무시한다", () => {
    const tracks = parsePastedList("1. 아이유 - 밤편지\n• 잔나비 - 주저하는 연인들을 위해\n\n# 메모\n그냥 제목만");
    expect(tracks.map((t) => [t.artists, t.title])).toEqual([
      [["아이유"], "밤편지"],
      [["잔나비"], "주저하는 연인들을 위해"],
      [[], "그냥 제목만"],
    ]);
  });

  it("'제목 - 가수' 순서도 고를 수 있다", () => {
    const [t] = parsePastedList("밤편지 - 아이유", "title-artist");
    expect(t).toMatchObject({ title: "밤편지", artists: ["아이유"] });
  });

  it("같은 곡은 한 번만 넣는다", () => {
    expect(parsePastedList("IU - 밤편지\nIU -  밤편지")).toHaveLength(1);
  });

  it("Exportify CSV 머리글을 알아본다", () => {
    const csv = [
      '"Track URI","Track Name","Artist URI(s)","Artist Name(s)","Album Name"',
      '"spotify:track:1","밤편지","spotify:artist:1","IU","Palette"',
      '"spotify:track:2","Love, Again","spotify:artist:2,spotify:artist:3","A,B","X"',
    ].join("\n");
    const tracks = parsePastedList(csv);
    expect(tracks.map((t) => [t.title, t.artists])).toEqual([
      ["밤편지", ["IU"]],
      ["Love, Again", ["A", "B"]],
    ]);
  });
});

describe("parseCsv", () => {
  it("따옴표 안의 쉼표·줄바꿈·이스케이프를 처리한다", () => {
    expect(parseCsv('a,"b,c","d ""e""","f\ng"\n1,2,3,4')).toEqual([
      ["a", "b,c", 'd "e"', "f\ng"],
      ["1", "2", "3", "4"],
    ]);
  });
});
