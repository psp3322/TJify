import { describe, expect, it, vi } from "vitest";
import type { KaraokeSong } from "@/lib/types";
import { decide, matchOnBrand, rankSongs, scoreSong, titleQueries, type KaraokeSearcher } from "./matcher";

// 아래 곡 목록은 매칭 규칙을 확인하려고 만든 테스트용 데이터다 (실제 노래방 번호 아님).
const song = (no: string, title: string, singer: string, tags?: string[]): KaraokeSong => ({
  brand: "tj",
  no,
  title,
  singer,
  ...(tags ? { tags } : {}),
});

function stubSearcher(byTitle: Record<string, KaraokeSong[]>, bySinger: Record<string, KaraokeSong[]> = {}): KaraokeSearcher {
  return {
    searchByTitle: vi.fn(async (q: string) => byTitle[q] ?? []),
    searchBySinger: vi.fn(async (q: string) => bySinger[q] ?? []),
  };
}

describe("scoreSong", () => {
  it("띄어쓰기만 다른 제목 + 별칭으로 이어지는 가수는 거의 만점", () => {
    const s = scoreSong({ title: "좋은 날", artists: ["IU"] }, song("1", "좋은날", "아이유"));
    expect(s.titleSim).toBe(1);
    expect(s.artistSim).toBe(1);
    expect(s.score).toBeCloseTo(1);
  });

  it("MR 같은 별도 수록본은 원곡보다 뒤로 간다", () => {
    const ranked = rankSongs({ title: "Song", artists: ["A"] }, [song("2", "Song", "A", ["MR"]), song("9", "Song", "A")]);
    expect(ranked.map((r) => r.song.no)).toEqual(["9", "2"]);
  });
});

describe("decide", () => {
  it("제목·가수가 모두 맞으면 high", () => {
    const track = { title: "밤편지", artists: ["아이유"] };
    const result = decide(track, rankSongs(track, [song("1", "밤편지", "아이유"), song("2", "밤", "누군가")]));
    expect(result).toMatchObject({ confidence: "high", best: { no: "1" } });
  });

  it("같은 제목이 그 가수 하나뿐이면 표기가 달라도 medium으로 올린다", () => {
    const track = { title: "모든 날, 모든 순간", artists: ["Someone Unknown"] };
    const result = decide(track, rankSongs(track, [song("1", "모든날모든순간", "폴킴")]));
    expect(result.confidence).toBe("medium");
    expect(result.best?.no).toBe("1");
  });

  it("가수 정보 없이 같은 제목이 여럿이면 low", () => {
    const track = { title: "봄날", artists: [] };
    const result = decide(track, rankSongs(track, [song("1", "봄날", "가수A"), song("2", "봄날", "가수B")]));
    expect(result.confidence).toBe("low");
  });

  it("후보가 없으면 none", () => {
    expect(decide({ title: "x", artists: [] }, [])).toMatchObject({ best: null, confidence: "none" });
  });
});

describe("titleQueries", () => {
  it("버전 표시와 괄호를 뗀 제목부터, 그다음 괄호 안 다른 언어 제목", () => {
    expect(titleQueries("Hype Boy (feat. X) ")).toEqual(["Hype Boy"]);
    expect(titleQueries("Good Day(좋은 날)")).toEqual(["Good Day", "좋은 날"]);
    expect(titleQueries("밤편지")).toEqual(["밤편지"]);
  });

  it("괄호를 뗀 제목이 너무 짧으면 괄호까지 붙인 제목을 먼저 쓴다", () => {
    expect(titleQueries("봄 (Spring)")).toEqual(["봄 (Spring)", "봄", "Spring"]);
  });
});

describe("matchOnBrand", () => {
  it("제목 검색에서 확실한 곡을 찾으면 가수 검색은 하지 않는다", async () => {
    const searcher = stubSearcher({ 밤편지: [song("1", "밤편지", "아이유")] });
    const result = await matchOnBrand({ title: "밤편지", artists: ["IU"] }, searcher);
    expect(result.best?.no).toBe("1");
    expect(result.confidence).toBe("high");
    expect(searcher.searchBySinger).not.toHaveBeenCalled();
  });

  it("영문 제목으로 못 찾으면 한글 가수명으로 찾아 괄호 안 제목과 맞춘다", async () => {
    const searcher = stubSearcher({}, { 아이유: [song("7", "좋은날", "아이유"), song("8", "밤편지", "아이유")] });
    const result = await matchOnBrand({ title: "Good Day(좋은 날)", artists: ["IU"] }, searcher);
    expect(searcher.searchBySinger).toHaveBeenCalledWith("아이유");
    expect(result.best?.no).toBe("7");
  });

  it("모든 검색이 실패하면 error를 채운다", async () => {
    const searcher: KaraokeSearcher = {
      searchByTitle: async () => {
        throw new Error("HTTP 403");
      },
      searchBySinger: async () => {
        throw new Error("HTTP 403");
      },
    };
    const result = await matchOnBrand({ title: "x", artists: ["y"] }, searcher);
    expect(result).toMatchObject({ best: null, error: "HTTP 403" });
  });
});
