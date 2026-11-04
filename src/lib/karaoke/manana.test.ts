import { describe, expect, it, vi } from "vitest";
import { buildMananaUrl, fetchMananaPopular, parseMananaRows, searchManana } from "./manana";

// Manana API 문서에 나온 응답 필드 모양대로 만든 테스트용 행이다 (실제 곡 데이터 아님).
const rows = [
  { brand: "kumyoung", no: "100", title: "제목A", singer: "가수A", composer: "", lyricist: "작사A", release: "2020-01-01" },
  { brand: "tj", no: "200", title: "제목A", singer: "가수A", composer: "", lyricist: "", release: "2020-01-01" },
  { brand: "kumyoung", no: 101, title: "제목B", singer: "가수B" },
  { brand: "kumyoung", no: "", title: "번호 없음", singer: "?" },
];

describe("parseMananaRows", () => {
  it("요청한 브랜드만 남기고 번호 없는 행은 버린다", () => {
    expect(parseMananaRows(rows, "ky")).toEqual([
      { brand: "ky", no: "100", title: "제목A", singer: "가수A", lyricist: "작사A" },
      { brand: "ky", no: "101", title: "제목B", singer: "가수B" },
    ]);
    expect(parseMananaRows(rows, "tj").map((s) => s.no)).toEqual(["200"]);
  });

  it("v2 형식 { data: [...] }도 받는다", () => {
    expect(parseMananaRows({ total: { row: 1 }, data: [rows[0]] }, "ky")).toHaveLength(1);
    expect(parseMananaRows("nope", "ky")).toEqual([]);
  });
});

describe("buildMananaUrl", () => {
  it("문서에 나온 song/{제목}/{브랜드}.json 경로로 만든다", () => {
    expect(buildMananaUrl("song", "좋은 날", "ky")).toBe("https://api.manana.kr/karaoke/song/%EC%A2%8B%EC%9D%80%20%EB%82%A0/kumyoung.json");
    expect(buildMananaUrl("singer", "AC/DC", "tj")).toBe("https://api.manana.kr/karaoke/singer/AC%20DC/tj.json");
  });
});

describe("searchManana", () => {
  it("HTML이 오면 점검 중으로 본다", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>maintenance</html>", { status: 200 }));
    await expect(searchManana("song", "x", "ky", { fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toThrow("점검");
  });

  it("브라우저에서 사전 요청(preflight)이 생기지 않게 기본 헤더만 보낸다", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json([]));
    await searchManana("singer", "아이유", "tj", { fetchImpl });
    const headers = new Headers(fetchImpl.mock.calls[0][1]?.headers);
    expect([...headers.keys()]).toEqual(["accept"]);
  });

  it("점만 있는 검색어는 경로가 바뀌므로 요청하지 않는다", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(searchManana("song", "..", "tj", { fetchImpl })).resolves.toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("404는 결과 없음으로 본다", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 404 }));
    await expect(searchManana("song", "x", "ky", { fetchImpl: fetchImpl as unknown as typeof fetch })).resolves.toEqual([]);
  });
});

describe("fetchMananaPopular", () => {
  it("인기곡 순서를 순위로 쓰고 rank 필드가 있으면 그 값을 쓴다", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json([
        { brand: "tj", no: "300", title: "곡1", singer: "가수" },
        { brand: "tj", no: "301", title: "곡2", singer: "가수", rank: "5" },
      ]),
    );
    await expect(fetchMananaPopular("tj", "monthly", { fetchImpl })).resolves.toEqual([
      { no: "300", rank: 1, title: "곡1", singer: "가수" },
      { no: "301", rank: 5, title: "곡2", singer: "가수" },
    ]);
    expect(String(fetchImpl.mock.calls[0][0])).toBe("https://api.manana.kr/karaoke/popular/tj/monthly.json");
  });
});
