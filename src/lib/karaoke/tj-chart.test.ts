import { describe, expect, it, vi } from "vitest";
import { buildChartIndex, buildTjChartIndex, monthWindows, parseTjChart } from "./tj-chart";

// TJ 차트 API 응답 필드(rank, pro, indexTitle, indexSong)만 맞춘 테스트용 데이터 (실제 차트 아님)
const chart = (items: Array<[number, string]>) => ({
  resultCode: "99",
  resultData: { items: items.map(([rank, pro]) => ({ rank: String(rank), pro, indexTitle: `곡${pro}`, indexSong: "가수" })) },
});

describe("parseTjChart", () => {
  it("곡번호와 순위가 있는 줄만 읽는다", () => {
    expect(parseTjChart({ resultData: { items: [{ rank: "1", pro: 12345, indexTitle: "제목", indexSong: "가수" }, { rank: "x", pro: "1" }] } })).toEqual([
      { no: "12345", rank: 1, title: "제목", singer: "가수" },
    ]);
    expect(parseTjChart({ resultMsg: "error" })).toEqual([]);
  });
});

describe("monthWindows", () => {
  it("한국 시간 기준으로 이번 달은 오늘까지, 지난달들은 말일까지 나눈다", () => {
    // 2026-10-31 23:00 UTC = 2026-11-01 08:00 KST
    const w = monthWindows(new Date(Date.UTC(2026, 9, 31, 23)), 3);
    expect(w).toEqual([
      { start: "2026-11-01", end: "2026-11-01", period: "2026-11" },
      { start: "2026-10-01", end: "2026-10-31", period: "2026-10" },
      { start: "2026-09-01", end: "2026-09-30", period: "2026-09" },
    ]);
  });
});

describe("buildTjChartIndex", () => {
  it("차트 화면에서 받은 쿠키·CSRF 값을 실어 달마다 요청하고 곡별 최고 순위를 남긴다", async () => {
    let month = 0;
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (String(url).endsWith("/chart/top100")) {
        const headers = new Headers();
        headers.append("set-cookie", "JSESSIONID=abc; Path=/; HttpOnly");
        headers.append("set-cookie", "CSRF_TOKEN=tok123; Path=/");
        return new Response("<html></html>", { status: 200, headers });
      }
      const h = new Headers(init?.headers);
      expect(h.get("X-CSRF-TOKEN")).toBe("tok123");
      expect(h.get("Cookie")).toBe("JSESSIONID=abc; CSRF_TOKEN=tok123");
      expect(new URLSearchParams(String(init?.body)).get("chartType")).toBe("TOP");
      month++;
      // 첫 달: 111이 5위, 둘째 달: 111이 2위·222가 9위, 나머지 달: 실패
      if (month === 1) return Response.json(chart([[5, "111"]]));
      if (month === 2) return Response.json(chart([[2, "111"], [9, "222"]]));
      return new Response("busy", { status: 400 });
    });
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const pending = buildTjChartIndex(new Date(Date.UTC(2026, 9, 15)), fetchImpl as unknown as typeof fetch);
    await vi.runAllTimersAsync();
    const index = await pending;
    vi.useRealTimers();
    expect(index.songs).toEqual({ "111": [2, "2026-09"], "222": [9, "2026-09"] });
    expect(index.source).toBe("tj");
  });
});

describe("buildChartIndex", () => {
  it("TJ 사이트가 막히면 Manana 인기곡으로, 그것도 안 되면 빈 차트로 넘어간다", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const tjDown = vi.fn<typeof fetch>(async (url) =>
      String(url).includes("manana") ? Response.json([{ brand: "tj", no: "777", title: "곡", singer: "가수" }]) : new Response("", { status: 403 }),
    );
    const viaManana = await buildChartIndex(new Date(Date.UTC(2026, 9, 15)), tjDown);
    expect(viaManana).toMatchObject({ source: "manana", songs: { "777": [1, "recent"] } });

    const allDown = vi.fn<typeof fetch>(async () => new Response("", { status: 403 }));
    await expect(buildChartIndex(new Date(Date.UTC(2026, 9, 15)), allDown)).resolves.toMatchObject({ source: "none", songs: {} });
    vi.restoreAllMocks();
  });
});
