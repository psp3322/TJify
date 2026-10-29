import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { buildTjSearchUrl, searchTj } from "./tj";
import { parseTjSearchHtml } from "./tj-parser";

const fixture = readFileSync(new URL("./__fixtures__/tj-search-singer.html", import.meta.url), "utf8");

describe("parseTjSearchHtml", () => {
  it("실제 TJ 검색 결과 마크업에서 곡번호·제목·가수·작사·작곡·아이콘을 읽는다", () => {
    expect(parseTjSearchHtml(fixture)).toEqual([
      {
        brand: "tj",
        no: "80563",
        title: "역겹겠지만(Remember me)",
        singer: "B.I",
        lyricist: "B.I",
        composer: "B.I,MILLENNIUM",
      },
      {
        brand: "tj",
        no: "62976",
        title: "역겹겠지만(Remember me)",
        singer: "B.I",
        lyricist: "B.I",
        composer: "B.I,MILLENNIUM",
        tags: ["MR"],
      },
      expect.objectContaining({ no: "42595", singer: "B.I", tags: ["60이상 반주기 전용곡"] }),
    ]);
  });

  it("결과가 없는 페이지는 빈 배열", () => {
    expect(parseTjSearchHtml("<html><body><p>검색 결과가 없습니다</p></body></html>")).toEqual([]);
  });
});

describe("buildTjSearchUrl", () => {
  it("TJ 사이트 스크립트처럼 검색어 공백을 지우고 strType을 맞춘다", () => {
    const url = new URL(buildTjSearchUrl("좋은 날", "title", 50));
    expect(url.origin + url.pathname).toBe("https://www.tjmedia.com/song/accompaniment_search");
    expect(url.searchParams.get("searchTxt")).toBe("좋은날");
    expect(url.searchParams.get("strType")).toBe("1");
    expect(url.searchParams.get("pageRowCnt")).toBe("50");
    expect(new URL(buildTjSearchUrl("아이유", "singer")).searchParams.get("strType")).toBe("2");
  });
});

describe("searchTj", () => {
  it("받은 HTML을 파싱해 돌려준다", async () => {
    const fetchImpl = vi.fn(async () => new Response(fixture, { status: 200 }));
    const songs = await searchTj("B.I", "singer", { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(songs).toHaveLength(3);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("4xx면 오류를 던진다", async () => {
    const fetchImpl = vi.fn(async () => new Response("forbidden", { status: 403 }));
    await expect(searchTj("x", "title", { fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toThrow("HTTP 403");
  });
});
