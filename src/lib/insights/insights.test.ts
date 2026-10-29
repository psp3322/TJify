import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MODEL, estimateSongs, InsightRefusedError, toInsights, type InsightClient } from "./claude";
import { formatViews, popularityScore, singAlongLevel } from "./popularity";
import { songInsights } from "./service";

// 아래 응답은 구조화 출력 스키마 모양대로 만든 테스트용 데이터다 (실제 Claude 답변 아님)
function fakeClient(parsed: unknown, stopReason = "end_turn") {
  const parse = vi.fn<(params: Record<string, unknown>) => Promise<{ stop_reason: string; parsed_output: unknown }>>(async () => ({
    stop_reason: stopReason,
    parsed_output: parsed,
  }));
  return { client: { beta: { messages: { parse } } } as unknown as InsightClient, parse };
}

type OutputSong = Parameters<typeof toInsights>[1]["songs"][number];

const song = (i: number, extra: Partial<Record<keyof OutputSong, unknown>> = {}): OutputSong =>
  ({ i, known: true, difficulty: 3, tags: ["고음"], popularity: 4, tip: "", ...extra }) as OutputSong;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("toInsights", () => {
  it("입력 순서대로 맞추고, 모르는 곡·빠진 곡은 null", () => {
    const out = toInsights(3, { songs: [song(2, { difficulty: 9, popularity: 0 }), song(0, { known: false })] });
    expect(out[0]).toBeNull();
    expect(out[1]).toBeNull();
    expect(out[2]).toEqual({ difficulty: 5, tags: ["고음"], popularity: 1 });
  });

  it("꼬리표는 중복을 빼고 3개까지, 팁은 앞뒤 공백을 지운다", () => {
    const [x] = toInsights(1, {
      songs: [song(0, { tags: ["고음", "고음", "랩", "긴 곡", "빠른 박자"], tip: "  후렴 전에 숨 고르기  " })],
    });
    expect(x).toEqual({ difficulty: 3, tags: ["고음", "랩", "긴 곡"], popularity: 4, tip: "후렴 전에 숨 고르기" });
  });
});

describe("estimateSongs", () => {
  it("기본 모델·낮은 effort·거절 폴백·구조화 출력으로 요청한다", async () => {
    const { client, parse } = fakeClient({ songs: [song(0)] });
    const out = await estimateSongs([{ key: "k", title: "밤편지", artists: ["아이유"] }], client);
    expect(out).toEqual([{ difficulty: 3, tags: ["고음"], popularity: 4 }]);
    const params = parse.mock.calls[0][0];
    expect(params.model).toBe(DEFAULT_MODEL);
    expect(params.fallbacks).toBe("default");
    expect(params.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(params.output_config).toMatchObject({ effort: "low", format: expect.anything() });
    const messages = params.messages as Array<{ content: string }>;
    expect(JSON.parse(messages[0].content)).toEqual([{ i: 0, title: "밤편지", artist: "아이유" }]);
  });

  it("폴백이 없는 모델(Haiku 5.5)로 바꾸면 fallbacks를 붙이지 않는다", async () => {
    vi.stubEnv("ANTHROPIC_MODEL", "claude-haiku-5-5");
    const { client, parse } = fakeClient({ songs: [song(0)] });
    await estimateSongs([{ key: "k", title: "x", artists: [] }], client);
    const params = parse.mock.calls[0][0];
    expect(params.model).toBe("claude-haiku-5-5");
    expect(params).not.toHaveProperty("fallbacks");
    expect(params).not.toHaveProperty("betas");
  });

  it("거절이면 오류를 던진다", async () => {
    const { client } = fakeClient(null, "refusal");
    await expect(estimateSongs([{ key: "k", title: "x", artists: [] }], client)).rejects.toBeInstanceOf(InsightRefusedError);
  });
});

describe("songInsights", () => {
  it("같은 곡은 서버 캐시에서 돌려주고 Claude에 다시 묻지 않는다", async () => {
    const { client, parse } = fakeClient({ songs: [song(0), song(1, { difficulty: 1 })] });
    const items = [
      { key: "a", title: "캐시 테스트 곡 A", artists: ["가수"] },
      { key: "b", title: "캐시 테스트 곡 B", artists: ["가수"] },
    ];
    const first = await songInsights(items, client);
    const second = await songInsights([{ key: "b2", title: "캐시 테스트 곡 B", artists: ["가수"] }], client);
    expect(first.map((r) => r.insight?.difficulty)).toEqual([3, 1]);
    expect(second).toEqual([{ key: "b2", insight: expect.objectContaining({ difficulty: 1 }) }]);
    expect(parse).toHaveBeenCalledOnce();
  });
});

describe("singAlongLevel", () => {
  it("노래방 인기차트에 든 곡은 '다 같이'", () => {
    expect(singAlongLevel({ chartRank: 80, aiPopularity: 2 })).toBe("everyone");
  });

  it("Claude 추정과 조회수 중 높은 쪽을 쓴다", () => {
    expect(singAlongLevel({ aiPopularity: 3, views: 150_000_000 })).toBe("everyone");
    expect(singAlongLevel({ aiPopularity: 4, views: 1_000 })).toBe("many");
    expect(singAlongLevel({ aiPopularity: 2 })).toBe("fans");
    expect(singAlongLevel({ views: 5_000_000 })).toBe("some");
    expect(singAlongLevel({ aiPopularity: null })).toBeNull();
  });

  it("정렬 점수는 차트 순위가 가장 높다", () => {
    expect(popularityScore({ chartRank: 1 })).toBeGreaterThan(popularityScore({ chartRank: 50 }));
    expect(popularityScore({ chartRank: 100 })).toBeGreaterThan(popularityScore({ aiPopularity: 5 }));
    expect(popularityScore({})).toBe(-1);
  });
});

describe("formatViews", () => {
  it("만·억 단위로 줄인다", () => {
    expect(formatViews(123_000_000)).toBe("1.2억회");
    expect(formatViews(2_000_000_000)).toBe("20억회");
    expect(formatViews(3_500_000)).toBe("350만회");
    expect(formatViews(950)).toBe("950회");
  });
});
